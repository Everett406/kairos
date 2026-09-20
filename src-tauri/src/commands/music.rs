//! 音乐：QQ 音乐搜索 / 音源 / 歌词，外加贴 cookie 轻量登录。
//! 接口为社区通用公开协议：c.y.qq.com 搜索 + musicu.fcg vkey.GetVkeyServer，
//! 未登录（uin=0）可播免费 128k；VIP 歌曲需登录 cookie（uin + qm_keyst）。
//! 歌词两级来源：QQ 同步 LRC（歌名强校验防错配）→ LRCLIB 兜底。

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{Manager, State};

const QQ_SEARCH: &str = "https://c.y.qq.com/soso/fcgi-bin/client_search_cp";
const QQ_MUSICU: &str = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const QQ_LYRIC: &str = "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg";
const LRCLIB_API: &str = "https://lrclib.net/api/search";

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("Kairos/0.3 (desktop assistant)")
        .build()
        .expect("failed to build music http client")
}

// ===== 搜索 =====

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QqSong {
    pub songmid: String,
    pub name: String,
    pub singer: String,
    pub album_mid: String,
    pub duration_sec: f64,
}

#[tauri::command]
pub async fn qq_search_songs(keyword: String) -> Result<Vec<QqSong>, String> {
    let kw = keyword.trim();
    if kw.is_empty() {
        return Ok(vec![]);
    }
    let resp: serde_json::Value = http()
        .get(QQ_SEARCH)
        .query(&[("w", kw), ("format", "json"), ("n", "20")])
        .header("Referer", "https://y.qq.com/")
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| format!("搜索失败：{e}"))?
        .json()
        .await
        .map_err(|e| format!("搜索结果解析失败：{e}"))?;

    let list = resp
        .pointer("/data/song/list")
        .and_then(|v| v.as_array())
        .ok_or("搜索结果格式异常")?;
    Ok(list
        .iter()
        .filter_map(|s| {
            let songmid = s.get("songmid")?.as_str()?.to_string();
            let name = s.get("songname")?.as_str()?.to_string();
            if songmid.is_empty() || name.is_empty() {
                return None;
            }
            let singers: Vec<String> = s
                .get("singer")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|x| x.get("name")?.as_str().map(String::from)).collect())
                .unwrap_or_default();
            Some(QqSong {
                songmid,
                name,
                singer: singers.join("/"),
                album_mid: s.get("albummid").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                duration_sec: s.get("interval").and_then(|v| v.as_f64()).unwrap_or(0.0),
            })
        })
        .collect())
}

// ===== 登录（贴 cookie） =====

#[derive(Serialize, Deserialize, Clone)]
pub struct QqLogin {
    pub uin: String,
    pub music_key: String,
}

fn login_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("qq_login.json"))
}

fn read_login(app: &tauri::AppHandle) -> Option<QqLogin> {
    crate::store::read_json::<QqLogin>(&login_path(app).ok()?)
}

/// 从 cookie 串解析 uin + qm_keyst（兼容 qqmusic_key、微信 wxuin/wxskey）
fn parse_cookie(raw: &str) -> Option<QqLogin> {
    let mut uin = String::new();
    let mut key = String::new();
    for part in raw.split(';') {
        let Some((k, v)) = part.trim().split_once('=') else { continue };
        let v = v.trim().trim_matches('"');
        match k.trim().to_lowercase().as_str() {
            "uin" | "qqmusic_uin" | "wxuin" | "p_uin" if uin.is_empty() => {
                let digits: String = v.chars().filter(|c| c.is_ascii_digit()).collect();
                uin = if digits.is_empty() { v.to_string() } else { digits };
            }
            "qm_keyst" | "qqmusic_key" | "music_key" if key.is_empty() => key = v.to_string(),
            _ => {}
        }
    }
    (uin.len() >= 3 && key.len() >= 8).then_some(QqLogin { uin, music_key: key })
}

#[tauri::command]
pub fn qq_save_login(cookie: String, app: tauri::AppHandle) -> Result<QqLogin, String> {
    let login = parse_cookie(&cookie)
        .ok_or("未能从粘贴内容中解析出 uin 和 qm_keyst——请复制完整的 y.qq.com cookie")?;
    crate::store::write_json(&login_path(&app)?, &login)?;
    Ok(login)
}

#[tauri::command]
pub fn qq_login_status(app: tauri::AppHandle) -> Option<QqLogin> {
    read_login(&app)
}

#[tauri::command]
pub fn qq_logout(app: tauri::AppHandle) -> Result<(), String> {
    let path = login_path(&app)?;
    match std::fs::remove_file(&path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// ===== 音源 =====

#[tauri::command]
pub async fn qq_song_url(songmid: String, app: tauri::AppHandle) -> Result<String, String> {
    let login = read_login(&app);
    let (uin, music_key) = match &login {
        Some(l) => (l.uin.clone(), Some(l.music_key.clone())),
        None => ("0".to_string(), None),
    };
    let guid = format!("{}", 10_000_000 + (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.subsec_nanos() as u64).unwrap_or(7) % 90_000_000));
    let mut comm = serde_json::json!({ "uin": uin, "format": "json", "ct": 24, "cv": 0 });
    if let Some(k) = &music_key {
        comm["authst"] = serde_json::json!(k);
    }
    let body = serde_json::json!({
        "comm": comm,
        "req_0": {
            "module": "vkey.GetVkeyServer",
            "method": "CgiGetVkey",
            "param": {
                "guid": guid,
                "songmid": [songmid],
                "songtype": [0],
                "uin": uin,
                "loginflag": 1,
                "platform": "20",
                "filename": [format!("M500{}.mp3", songmid)]
            }
        }
    });
    let mut req = http()
        .post(QQ_MUSICU)
        .json(&body)
        .header("Referer", "https://y.qq.com/")
        .timeout(Duration::from_secs(8));
    if let Some(k) = &music_key {
        req = req.header("Cookie", format!("uin={}; qm_keyst={}", uin, k));
    }
    let json: serde_json::Value = req.send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
    let purl = json.pointer("/req_0/data/midurlinfo/0/purl").and_then(|v| v.as_str()).unwrap_or_default();
    if purl.is_empty() {
        return Err(if music_key.is_some() {
            "该歌曲拿不到音源（可能需要更高等级会员或区域限制）".into()
        } else {
            "NO_URL：该歌曲可能需要 QQ 音乐 VIP——登录 QQ 音乐账号后可播".into()
        });
    }
    let sip = json.pointer("/req_0/data/sip/0").and_then(|v| v.as_str()).unwrap_or("https://ws.stream.qqmusic.qq.com/");
    Ok(format!("{}{}", sip.trim_end_matches('/'), purl))
}

// ===== 歌词 =====

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LyricLine {
    pub time: f64,
    pub text: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LyricsPayload {
    pub found: bool,
    pub synced: bool,
    pub instrumental: bool,
    pub plain: Option<String>,
    pub lines: Vec<LyricLine>,
}

fn parse_time_tag(tag: &str) -> Option<f64> {
    let (m, s) = tag.split_once(':')?;
    let mm = m.trim().parse::<f64>().ok()?;
    let ss = s.trim().parse::<f64>().ok()?;
    Some(mm * 60.0 + ss)
}

/// 解析 LRC：支持一行多个时间戳，忽略元数据标签
fn parse_lrc(raw: &str) -> Vec<LyricLine> {
    let mut out = Vec::new();
    for line in raw.lines() {
        let mut rest = line.trim_start();
        let mut times = Vec::new();
        while let Some(inner) = rest.strip_prefix('[') {
            let Some(end) = inner.find(']') else { break };
            match parse_time_tag(&inner[..end]) {
                Some(t) => {
                    times.push(t);
                    rest = &inner[end + 1..];
                }
                None => break,
            }
        }
        if times.is_empty() {
            continue;
        }
        let text = rest.trim().to_string();
        for t in times {
            out.push(LyricLine { time: t, text: text.clone() });
        }
    }
    out.sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap_or(std::cmp::Ordering::Equal));
    out
}

/// QQ 音乐歌词：搜索前 3 个候选 → 歌名强校验 → 逐个取 LRC
async fn query_qq_lyrics(title: &str, artist: &str) -> Option<Vec<LyricLine>> {
    let client = http();
    let query = format!("{title} {artist}");
    let resp: serde_json::Value = client
        .get(QQ_SEARCH)
        .query(&[("w", query.as_str()), ("format", "json"), ("n", "3")])
        .header("Referer", "https://y.qq.com/")
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;

    let songs = resp.pointer("/data/song/list")?.as_array()?.clone();
    let mut candidates: Vec<(String, String)> = songs
        .iter()
        .filter_map(|s| {
            Some((s.get("songmid")?.as_str()?.to_string(), s.get("songname")?.as_str()?.to_string()))
        })
        .collect();
    // 相似度排序：同名 > 包含 > 其余；全都不含目标关键词则整体弃用（防张冠李戴）
    let title_lc = title.to_lowercase();
    candidates.sort_by_key(|(_, name)| {
        let n = name.to_lowercase();
        if n == title_lc { 0 } else if n.contains(&title_lc) || title_lc.contains(&n) { 1 } else { 2 }
    });
    let trusted = candidates
        .first()
        .map(|(_, name)| {
            let n = name.to_lowercase();
            n.contains(&title_lc) || title_lc.contains(&n)
        })
        .unwrap_or(false);
    if !trusted {
        return None;
    }

    for (mid, _) in candidates {
        let Ok(resp) = client
            .get(QQ_LYRIC)
            .query(&[("songmid", mid.as_str()), ("g_tk", "5381"), ("format", "json"), ("nobase64", "0")])
            .header("Referer", "https://c.y.qq.com/")
            .timeout(Duration::from_secs(8))
            .send()
            .await
        else {
            continue;
        };
        let Ok(json) = resp.json::<serde_json::Value>().await else { continue };
        let Some(b64) = json.get("lyric").and_then(|v| v.as_str()) else { continue };
        let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) else { continue };
        let Ok(text) = String::from_utf8(bytes) else { continue };
        let lines = parse_lrc(&text);
        if !lines.is_empty() {
            return Some(lines);
        }
    }
    None
}

async fn query_lrclib(title: &str, artist: &str) -> Option<Vec<serde_json::Value>> {
    let resp = http()
        .get(LRCLIB_API)
        .query(&[("track_name", title), ("artist_name", artist)])
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    resp.json::<Vec<serde_json::Value>>().await.ok()
}

#[tauri::command]
pub async fn fetch_lyrics(
    title: String,
    artist: String,
    cache: State<'_, crate::LyricsCache>,
) -> Result<LyricsPayload, String> {
    let key = format!("{artist}|{title}");
    if let Some(hit) = cache.0.lock().unwrap().get(&key) {
        return Ok(hit.clone());
    }

    // 1. QQ 音乐同步 LRC
    if let Some(lines) = query_qq_lyrics(&title, &artist).await {
        let payload = LyricsPayload { found: true, synced: true, instrumental: false, plain: None, lines };
        cache.0.lock().unwrap().insert(key, payload.clone());
        return Ok(payload);
    }

    // 2. LRCLIB 兜底：同步 → 纯文本 → 标记纯音乐
    let hits = query_lrclib(&title, &artist).await.unwrap_or_default();
    let synced = hits.iter().find(|h| {
        h.get("syncedLyrics").and_then(|v| v.as_str()).is_some_and(|s| !s.trim().is_empty())
    });
    let payload = if let Some(hit) = synced {
        let lines = parse_lrc(hit.get("syncedLyrics").and_then(|v| v.as_str()).unwrap());
        LyricsPayload { found: true, synced: true, instrumental: false, plain: None, lines }
    } else {
        let plain = hits.iter().find(|h| {
            h.get("instrumental").and_then(|v| v.as_bool()) != Some(true)
                && h.get("plainLyrics").and_then(|v| v.as_str()).is_some_and(|s| !s.trim().is_empty())
        });
        match plain {
            Some(hit) => LyricsPayload {
                found: true,
                synced: false,
                instrumental: false,
                plain: hit.get("plainLyrics").and_then(|v| v.as_str()).map(String::from),
                lines: vec![],
            },
            None => LyricsPayload {
                found: false,
                synced: false,
                instrumental: hits.iter().any(|h| h.get("instrumental").and_then(|v| v.as_bool()) == Some(true)),
                plain: None,
                lines: vec![],
            },
        }
    };
    cache.0.lock().unwrap().insert(key, payload.clone());
    Ok(payload)
}

// ===== 网易云（免费曲库直连：搜索 / 外链播放 / 歌词 / 封面） =====
// 接口实测（2026-09）：搜索走 /api/cloudsearch/pc（明文 JSON，老 /api/search/get 已加密）；
// 播放走 /song/media/outer/url 外链 302 到 CDN（免费歌可播，VIP 歌 302 到 /404，
// 以此判别并给出友好报错）；歌词 /api/song/lyric 明文。扫码登录（VIP 曲库）0.4.2 再上。

const NE_CLOUDSEARCH: &str = "https://music.163.com/api/cloudsearch/pc";
const NE_LYRIC: &str = "https://music.163.com/api/song/lyric";
const NE_OUTER: &str = "https://music.163.com/song/media/outer/url";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NeSong {
    pub id: u64,
    pub name: String,
    pub singer: String,
    pub album: String,
    pub pic_url: String,
    pub duration_sec: f64,
    /// 0 免费 / 1 VIP / 4 需购买专辑 / 8 低音质免费
    pub fee: u32,
}

#[tauri::command]
pub async fn ne_search_songs(keyword: String) -> Result<Vec<NeSong>, String> {
    let kw = keyword.trim();
    if kw.is_empty() {
        return Ok(vec![]);
    }
    let resp: serde_json::Value = http()
        .post(NE_CLOUDSEARCH)
        .form(&[
            ("s", kw),
            ("type", "1"),
            ("offset", "0"),
            ("limit", "20"),
            ("total", "true"),
        ])
        .header("Referer", "https://music.163.com/")
        .header("Origin", "https://music.163.com")
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| format!("搜索失败：{e}"))?
        .json()
        .await
        .map_err(|e| format!("搜索结果解析失败：{e}"))?;

    let list = resp
        .pointer("/result/songs")
        .and_then(|v| v.as_array())
        .ok_or("搜索结果格式异常")?;
    Ok(list
        .iter()
        .filter_map(|s| {
            let id = s.get("id")?.as_u64()?;
            let name = s.get("name")?.as_str()?.to_string();
            if name.is_empty() {
                return None;
            }
            let singers: Vec<String> = s
                .get("ar")
                .or_else(|| s.get("artists"))
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|x| x.get("name")?.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let album_obj = s.get("al").or_else(|| s.get("album"));
            Some(NeSong {
                id,
                name,
                singer: singers.join("/"),
                album: album_obj
                    .and_then(|a| a.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                pic_url: album_obj
                    .and_then(|a| a.get("picUrl"))
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                duration_sec: s.get("dt").or_else(|| s.get("duration")).and_then(|v| v.as_f64()).unwrap_or(0.0) / 1000.0,
                fee: s.get("fee").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            })
        })
        .collect())
}

#[tauri::command]
pub async fn ne_song_url(id: u64) -> Result<String, String> {
    let url = format!("{NE_OUTER}?id={id}.mp3");
    let resp = http()
        .get(&url)
        .header("Referer", "https://music.163.com/")
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("获取音源失败：{e}"))?;
    let final_url = resp.url().to_string();
    if !resp.status().is_success() || final_url.contains("/404") {
        return Err("NO_URL：该歌曲需要 VIP 或暂无版权（网易云扫码登录 0.4.2 支持）".into());
    }
    Ok(final_url)
}

#[tauri::command]
pub async fn ne_lyric(id: u64) -> Result<LyricsPayload, String> {
    let id_s = id.to_string();
    let json: serde_json::Value = http()
        .get(NE_LYRIC)
        .query(&[("id", id_s.as_str()), ("lv", "1"), ("kv", "1"), ("tv", "-1")])
        .header("Referer", "https://music.163.com/")
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| format!("歌词获取失败：{e}"))?
        .json()
        .await
        .map_err(|e| format!("歌词解析失败：{e}"))?;
    let lrc = json.pointer("/lrc/lyric").and_then(|v| v.as_str()).unwrap_or("");
    let lines = parse_lrc(lrc);
    Ok(LyricsPayload {
        found: !lines.is_empty(),
        synced: !lines.is_empty(),
        instrumental: json.get("pureMusic").and_then(|v| v.as_bool()).unwrap_or(false),
        plain: None,
        lines,
    })
}

// ===== 本地音乐（目录扫描；播放走 asset 协议 + WebView audio） =====

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalTrack {
    pub path: String,
    pub name: String,
    pub artist: String,
    pub size_mb: f64,
}

const AUDIO_EXT: [&str; 8] = ["mp3", "flac", "wav", "m4a", "ogg", "oga", "opus", "wma"];

fn scan_impl(dir: &str) -> Result<Vec<LocalTrack>, String> {
    let root = std::path::PathBuf::from(dir);
    if !root.is_dir() {
        return Err("目录不存在".into());
    }
    let mut out: Vec<LocalTrack> = Vec::new();
    fn walk(d: &std::path::Path, depth: u8, out: &mut Vec<LocalTrack>) {
        if depth > 4 || out.len() >= 2000 {
            return;
        }
        let Ok(rd) = std::fs::read_dir(d) else { return };
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                walk(&p, depth + 1, out);
                continue;
            }
            let ext = p
                .extension()
                .and_then(|x| x.to_str())
                .map(|s| s.to_lowercase())
                .unwrap_or_default();
            if !AUDIO_EXT.contains(&ext.as_str()) {
                continue;
            }
            let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
            // "歌手 - 歌名.mp3" 约定；否则整名当歌名
            let (artist, name) = match stem.split_once(" - ") {
                Some((a, t)) if !a.trim().is_empty() && !t.trim().is_empty() => {
                    (a.trim().to_string(), t.trim().to_string())
                }
                _ => (String::new(), stem),
            };
            let size_mb = e.metadata().map(|m| m.len()).unwrap_or(0) as f64 / 1_048_576.0;
            out.push(LocalTrack {
                path: p.to_string_lossy().into_owned(),
                name,
                artist,
                size_mb: (size_mb * 10.0).round() / 10.0,
            });
        }
    }
    walk(&root, 0, &mut out);
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

/// 扫描本地音乐目录（大库可能耗时，放 blocking 线程池跑）
#[tauri::command]
pub async fn local_music_scan(dir: String) -> Result<Vec<LocalTrack>, String> {
    tauri::async_runtime::spawn_blocking(move || scan_impl(&dir))
        .await
        .map_err(|e| format!("扫描任务失败：{e}"))?
}
