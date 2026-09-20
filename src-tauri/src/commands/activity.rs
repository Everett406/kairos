//! 活动追踪：后台线程每 5 秒采样前台窗口（进程名 + 窗口标题），
//! 同应用连续使用合并为会话段（ActivitySeg），按天落盘 activity/YYYY-MM-DD.json，
//! 启动时清理 7 天前的旧文件。主画布「今日活动」时间轴直接消费。
//!
//! 采样失败 / 无前台窗口（锁屏、Win+D）时跳过该次采样——时间轴上自然留白，
//! 不伪造数据。重启后历史仍在（文件在应用数据目录）。

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};

const POLL_MS: u64 = 5000;
const KEEP_DAYS: i64 = 7;
/// 同应用间隔小于该值视为继续使用（短暂切走又切回不切碎时间段）
const MERGE_GAP_MS: u64 = 15_000;
const DIR_NAME: &str = "activity";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySeg {
    /// 进程名（小写，含 .exe）
    pub app: String,
    /// 段开始时的窗口标题
    pub title: String,
    /// epoch ms
    pub start: u64,
    pub end: u64,
}

struct Cache {
    day: String,
    segs: Vec<ActivitySeg>,
}

static CACHE: Mutex<Option<Cache>> = Mutex::new(None);

fn today_str() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

fn dir(app: &AppHandle) -> Option<std::path::PathBuf> {
    let dir = app.path().app_data_dir().ok()?.join(DIR_NAME);
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

fn day_path(app: &AppHandle, day: &str) -> Option<std::path::PathBuf> {
    dir(app).map(|d| d.join(format!("{day}.json")))
}

fn load_day(app: &AppHandle, day: &str) -> Vec<ActivitySeg> {
    day_path(app, day)
        .and_then(|p| crate::store::read_json::<Vec<ActivitySeg>>(&p))
        .unwrap_or_default()
}

fn save_day(app: &AppHandle, day: &str, segs: &[ActivitySeg]) {
    if let Some(p) = day_path(app, day) {
        let _ = crate::store::write_json(&p, &segs);
    }
}

/// 启动清理：删除 KEEP_DAYS 天前的记录文件
fn prune_old(app: &AppHandle) {
    let Some(d) = dir(app) else { return };
    let Ok(rd) = std::fs::read_dir(&d) else { return };
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        let Some(day) = name.strip_suffix(".json") else { continue };
        if day.len() != 10 {
            continue;
        }
        if let Ok(d0) = chrono::NaiveDate::parse_from_str(day, "%Y-%m-%d") {
            let age = (chrono::Local::now().date_naive() - d0).num_days();
            if age > KEEP_DAYS {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
}

/// 采样一次前台窗口并合入缓存；有新段 / 满一分钟时落盘
#[cfg(windows)]
fn sample(app: &AppHandle) {
    let (app_name, title) = foreground();
    if app_name.is_empty() {
        return;
    }
    let now = now_ms();
    let today = today_str();

    let mut guard = CACHE.lock().unwrap();

    // 首次访问 / 跨天：旧的一天落盘，新的一天从文件载入（重启不丢当天记录）
    let same_day = matches!(guard.as_ref(), Some(c) if c.day == today);
    if !same_day {
        if let Some(c) = guard.take() {
            save_day(app, &c.day, &c.segs);
        }
        let segs = load_day(app, &today);
        *guard = Some(Cache { day: today, segs });
    }
    let cache = guard.as_mut().unwrap();

    if let Some(last) = cache.segs.last_mut() {
        if last.app == app_name && now.saturating_sub(last.end) < MERGE_GAP_MS {
            last.end = now;
            return;
        }
    }
    cache.segs.push(ActivitySeg { app: app_name, title, start: now, end: now });
    save_day(app, &cache.day, &cache.segs);
}

#[cfg(not(windows))]
fn sample(_app: &AppHandle) {}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn spawn_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        prune_old(&app);
        loop {
            std::thread::sleep(Duration::from_millis(POLL_MS));
            sample(&app);
        }
    });
}

/// 今天已记录的活动段（时间轴直接渲染）
#[tauri::command]
pub fn activity_today(app: AppHandle) -> Vec<ActivitySeg> {
    let today = today_str();
    let mut guard = CACHE.lock().unwrap();
    match guard.as_mut() {
        Some(c) if c.day == today => c.segs.clone(),
        _ => {
            let segs = load_day(&app, &today);
            *guard = Some(Cache { day: today, segs: segs.clone() });
            segs
        }
    }
}

// ===== Windows：前台窗口进程名与标题 =====

#[cfg(windows)]
fn foreground() -> (String, String) {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    };

    unsafe {
        let hwnd = GetForegroundWindow();
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return (String::new(), String::new());
        }

        let mut title_buf = [0u16; 256];
        let tlen = GetWindowTextW(hwnd, &mut title_buf).max(0) as usize;
        let title = String::from_utf16_lossy(&title_buf[..tlen.min(title_buf.len())]);

        let app = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
            .ok()
            .and_then(|h| {
                let mut buf = [0u16; 512];
                let mut len = buf.len() as u32;
                let name = QueryFullProcessImageNameW(
                    h,
                    PROCESS_NAME_WIN32,
                    windows::core::PWSTR(buf.as_mut_ptr()),
                    &mut len,
                )
                .ok()
                .map(|_| {
                    let full = String::from_utf16_lossy(&buf[..len as usize]);
                    full.rsplit(['\\', '/']).next().unwrap_or("").to_lowercase()
                });
                let _ = CloseHandle(h);
                name
            })
            .unwrap_or_default();

        (app, title)
    }
}
