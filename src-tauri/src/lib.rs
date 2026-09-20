// Kairos — Tauri 主进程入口（薄启动层：插件注册 + 命令挂载 + 后台线程）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod store;

use std::sync::Mutex;

pub struct LyricsCache(pub Mutex<std::collections::HashMap<String, commands::music::LyricsPayload>>);

/// 全局 AppHandle（后台线程需要用时取）
pub static APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .manage(LyricsCache(Mutex::new(std::collections::HashMap::new())))
        .manage(commands::system::SystemState::new())
        .setup(|app| {
            let _ = APP_HANDLE.set(app.handle().clone());
            // 剪贴板轮询监听（后台线程，变化即推送事件 + 写入历史）
            commands::clipboard::spawn_watcher(app.handle().clone());
            commands::system::spawn_gpu_watcher();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::weather::weather_geocode,
            commands::weather::weather_forecast,
            commands::weather::weather_air_quality,
            commands::weather::weather_ip_locate,
            commands::system::system_stats,
            commands::system::system_elevate,
            commands::music::qq_search_songs,
            commands::music::qq_song_url,
            commands::music::fetch_lyrics,
            commands::music::qq_save_login,
            commands::music::qq_login_status,
            commands::music::qq_logout,
            commands::clipboard::clipboard_list,
            commands::clipboard::clipboard_remove,
            commands::clipboard::clipboard_clear,
            commands::translate::translate_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
