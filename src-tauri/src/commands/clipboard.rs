//! 剪贴板历史：后台线程轮询（800ms）→ 变化去重 → JSON 持久化 → 事件推送前端。
//! tauri-plugin-clipboard-manager 只提供读写、无系统级监听事件，轮询是桌面端
//! 剪贴板历史工具的通行做法，CPU 开销可忽略。

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_clipboard_manager::ClipboardExt;

const HISTORY_FILE: &str = "clipboard_history.json";
const MAX_ITEMS: usize = 100;
const MAX_TEXT_LEN: usize = 20_000;
const POLL_MS: u64 = 800;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClipItem {
    pub id: String,
    /// link（http/https 开头）或 text
    pub kind: String,
    pub text: String,
    /// 记录时间戳（毫秒）
    pub at: u64,
}

fn history_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    crate::store::data_file(app, HISTORY_FILE)
}

fn load(app: &AppHandle) -> Vec<ClipItem> {
    history_path(app).and_then(|p| crate::store::read_json::<Vec<ClipItem>>(&p)).unwrap_or_default()
}

fn save(app: &AppHandle, items: &[ClipItem]) {
    if let Some(p) = history_path(app) {
        let _ = crate::store::write_json(&p, &items);
    }
}

/// 静态锁：防 watcher 线程与 remove/clear 命令并发写坏文件
static WRITE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn push(app: &AppHandle, text: &str) {
    if text.trim().is_empty() || text.len() > MAX_TEXT_LEN {
        return;
    }
    let _guard = WRITE_LOCK.lock().unwrap();
    let mut items = load(app);
    // 去重：已有相同内容则提到最前（时间刷新）
    items.retain(|i| i.text != text);
    let kind = if text.trim_start().starts_with("http://") || text.trim_start().starts_with("https://") {
        "link"
    } else {
        "text"
    };
    items.insert(
        0,
        ClipItem { id: format!("{}", chrono_like_id()), kind: kind.into(), text: text.to_string(), at: now_ms() },
    );
    items.truncate(MAX_ITEMS);
    save(app, &items);
    let _ = app.emit("clipboard-changed", &items);
}

fn now_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn chrono_like_id() -> u64 {
    now_ms() * 1000 + (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.subsec_nanos() as u64 % 1000).unwrap_or(0))
}

/// 后台轮询线程：启动即挂载，应用生命周期常驻
pub fn spawn_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last = app.clipboard().read_text().ok().unwrap_or_default();
        loop {
            std::thread::sleep(std::time::Duration::from_millis(POLL_MS));
            let Ok(current) = app.clipboard().read_text() else { continue };
            if current.is_empty() || current == last {
                continue;
            }
            last = current.clone();
            push(&app, &current);
        }
    });
}

#[tauri::command]
pub fn clipboard_list(app: AppHandle) -> Vec<ClipItem> {
    load(&app)
}

#[tauri::command]
pub fn clipboard_remove(app: AppHandle, id: String) -> Vec<ClipItem> {
    let _guard = WRITE_LOCK.lock().unwrap();
    let mut items = load(&app);
    items.retain(|i| i.id != id);
    save(&app, &items);
    items
}

#[tauri::command]
pub fn clipboard_clear(app: AppHandle) -> Vec<ClipItem> {
    let _guard = WRITE_LOCK.lock().unwrap();
    save(&app, &[]);
    vec![]
}
