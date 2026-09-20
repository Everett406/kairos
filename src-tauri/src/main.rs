//! 主进程 main.rs：桌面端直接调用 lib::run
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_lib::run()
}
