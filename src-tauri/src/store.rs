//! 本地 JSON 持久化：应用数据目录下的简单键值文件存取。
//! 数据量都很小（剪贴板历史 ≤100 条），JSON 文件足够，不引数据库。

use std::path::PathBuf;
use tauri::Manager;

/// app_data_dir 下的文件路径（目录不存在则创建）
pub fn data_file(app: &tauri::AppHandle, name: &str) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join(name))
}

/// 读 JSON 文件，不存在或损坏返回 None
pub fn read_json<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Option<T> {
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

/// 原子写 JSON 文件（先写临时文件再改名，避免写一半崩掉）
pub fn write_json<T: serde::Serialize>(path: &PathBuf, value: &T) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}
