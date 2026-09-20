//! 设置：settings.json 键值存取（前端 useSettings 消费）+ Windows 开机自启
//! （reg.exe 写 HKCU Run 键，免依赖）+ 音乐文件夹选择（rfd 原生对话框）。

use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

static WRITE_LOCK: Mutex<()> = Mutex::new(());

fn path(app: &AppHandle) -> Option<std::path::PathBuf> {
    crate::store::data_file(app, "settings.json")
}

/// 读取某个设置键（lib.rs 启动时读热键也走这里）
pub fn read_value(app: &AppHandle, key: &str) -> Option<Value> {
    let p = path(app)?;
    let map = crate::store::read_json::<serde_json::Map<String, Value>>(&p)?;
    map.get(key).cloned()
}

#[tauri::command]
pub fn settings_get(app: AppHandle, key: String) -> Option<Value> {
    read_value(&app, &key)
}

#[tauri::command]
pub fn settings_set(app: AppHandle, key: String, value: Value) -> Result<(), String> {
    let _guard = WRITE_LOCK.lock().unwrap();
    let p = path(&app).ok_or("无法定位设置文件")?;
    let mut map = crate::store::read_json::<serde_json::Map<String, Value>>(&p).unwrap_or_default();
    map.insert(key, value);
    crate::store::write_json(&p, &Value::Object(map))
}

/// 设置页改键命令：前端已写好 settings，这里让新热键立即生效
#[tauri::command]
pub fn set_hotkeys(app: AppHandle, cmd: String, clip: String) -> Result<(), String> {
    crate::apply_hotkeys(&app, &cmd, &clip)
}

// ===== 开机自启（Windows 注册表 HKCU Run，经 reg.exe，免新增依赖） =====

#[cfg(windows)]
const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg(windows)]
const RUN_VAL: &str = "Kairos";

#[cfg(windows)]
fn reg(args: &[&str]) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let out = std::process::Command::new("reg")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("reg 执行失败：{e}"))?;
    let text = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
    if out.status.success() {
        Ok(text)
    } else {
        Err(text.trim().to_string())
    }
}

#[tauri::command]
pub fn autostart_status() -> bool {
    #[cfg(windows)]
    {
        reg(&["query", RUN_KEY, "/v", RUN_VAL]).is_ok()
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[tauri::command]
pub fn autostart_set(enable: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        if enable {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let val = format!("\"{}\"", exe.display());
            reg(&["add", RUN_KEY, "/v", RUN_VAL, "/t", "REG_SZ", "/d", &val, "/f"]).map(|_| ())
        } else {
            // 未设置过时 reg delete 返回非零，属预期，视为成功
            match reg(&["delete", RUN_KEY, "/v", RUN_VAL, "/f"]) {
                Ok(_) => Ok(()),
                Err(e) if e.to_lowercase().contains("unable to find") => Ok(()),
                Err(e) => Err(e),
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = enable;
        Err("仅 Windows 支持开机自启".into())
    }
}

// ===== 文件夹选择（本地音乐目录） =====

#[tauri::command]
pub fn pick_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("选择音乐文件夹")
        .pick_folder()
        .map(|p| p.to_string_lossy().into_owned())
}
