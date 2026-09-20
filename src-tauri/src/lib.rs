// Kairos — Tauri 主进程入口（薄启动层：插件注册 + 命令挂载 + 后台线程）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod store;

use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub struct LyricsCache(pub Mutex<std::collections::HashMap<String, commands::music::LyricsPayload>>);

/// 全局 AppHandle（后台线程需要用时取）
pub static APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

/// 前台显示主窗口（两条全局热键共用）
fn show_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// （重）注册全局热键：cmd = 命令条（global-cmd），clip = 剪贴板历史（global-clipboard）。
/// 前端传 "Ctrl+Alt+K" 形式，内部归一化为 "ctrl+alt+k"。设置页改键后即调本命令。
pub fn apply_hotkeys(app: &tauri::AppHandle, cmd: &str, clip: &str) -> Result<(), String> {
    let norm = |s: &str| {
        s.split('+')
            .map(|p| p.trim().to_lowercase())
            .filter(|p| !p.is_empty())
            .collect::<Vec<_>>()
            .join("+")
    };
    let cmd_s = norm(cmd);
    let clip_s = norm(clip);
    if cmd_s.is_empty() || clip_s.is_empty() || cmd_s == clip_s {
        return Err("两个全局热键不能相同，且都不能为空".into());
    }
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(|e| format!("注销旧热键失败：{e}"))?;
    gs.on_shortcut(cmd_s.as_str(), |app, _sc, event| {
        if event.state == ShortcutState::Pressed {
            show_main(app);
            let _ = app.emit("global-cmd", ());
        }
    })
    .map_err(|e| format!("注册 {cmd} 失败（可能已被占用）：{e}"))?;
    gs.on_shortcut(clip_s.as_str(), |app, _sc, event| {
        if event.state == ShortcutState::Pressed {
            show_main(app);
            let _ = app.emit("global-clipboard", ());
        }
    })
    .map_err(|e| format!("注册 {clip} 失败（可能已被占用）：{e}"))?;
    Ok(())
}

/// 设置页改键命令：保存（前端已写 settings）+ 立即生效
#[tauri::command]
pub fn set_hotkeys(app: tauri::AppHandle, cmd: String, clip: String) -> Result<(), String> {
    apply_hotkeys(&app, &cmd, &clip)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(LyricsCache(Mutex::new(std::collections::HashMap::new())))
        .manage(commands::system::SystemState::new())
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = APP_HANDLE.set(handle.clone());

            // 全局热键：读用户设置，失败回退默认（Ctrl+Alt+K / Ctrl+Alt+V）
            let read_str = |key: &str, field: &str, default: &str| -> String {
                commands::settings::read_value(&handle, key)
                    .and_then(|v| v.get(field).and_then(|x| x.as_str()).map(String::from))
                    .unwrap_or_else(|| default.to_string())
            };
            let cmd_key = read_str("hotkeys", "cmd", "Ctrl+Alt+K");
            let clip_key = read_str("hotkeys", "clip", "Ctrl+Alt+V");
            if let Err(e) = apply_hotkeys(&handle, &cmd_key, &clip_key) {
                log::warn!("自定义热键注册失败，回退默认：{e}");
                let _ = apply_hotkeys(&handle, "Ctrl+Alt+K", "Ctrl+Alt+V");
            }

            // 后台线程：剪贴板监听 / GPU 采集 / 前台应用活动记录
            commands::clipboard::spawn_watcher(handle.clone());
            commands::system::spawn_gpu_watcher();
            commands::activity::spawn_watcher(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::weather::weather_geocode,
            commands::weather::weather_forecast,
            commands::weather::weather_air_quality,
            commands::weather::weather_ip_locate,
            commands::system::system_stats,
            commands::system::system_elevate,
            commands::system::process_top,
            commands::music::qq_search_songs,
            commands::music::qq_song_url,
            commands::music::fetch_lyrics,
            commands::music::qq_save_login,
            commands::music::qq_login_status,
            commands::music::qq_logout,
            commands::music::ne_search_songs,
            commands::music::ne_song_url,
            commands::music::ne_lyric,
            commands::music::local_music_scan,
            commands::clipboard::clipboard_list,
            commands::clipboard::clipboard_remove,
            commands::clipboard::clipboard_clear,
            commands::clipboard::clipboard_pin,
            commands::translate::translate_text,
            commands::activity::activity_today,
            commands::settings::settings_get,
            commands::settings::settings_set,
            commands::settings::autostart_status,
            commands::settings::autostart_set,
            commands::settings::pick_folder,
            set_hotkeys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
