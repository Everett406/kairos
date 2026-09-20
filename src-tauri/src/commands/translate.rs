//! 翻译：Google gtx 免费端点（无 key），provider 预留配置化。
//! 响应形如 [[["译文","原文",...],...], null, "en", ...]，
//! 译文 = 各分段 [0][i][0] 拼接，检测语言 = [2]。

use serde::Serialize;
use std::time::Duration;

const GTX_URL: &str = "https://translate.googleapis.com/translate_a/single";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateResult {
    pub text: String,
    pub detected: Option<String>,
}

#[tauri::command]
pub async fn translate_text(text: String, target: String) -> Result<TranslateResult, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("请输入要翻译的内容".into());
    }
    let target_norm = target.trim().to_lowercase();
    let target = match target_norm.as_str() {
        "zh" | "zh-cn" | "简体中文" => "zh-CN",
        "zh-tw" => "zh-TW",
        "en" | "英语" => "en",
        "ja" | "日语" => "ja",
        "ko" | "韩语" => "ko",
        "fr" => "fr",
        "de" => "de",
        "ru" => "ru",
        "" => "zh-CN",
        other => other,
    };

    let client = reqwest::Client::builder()
        .user_agent("Kairos/0.3 (desktop assistant)")
        .build()
        .map_err(|e| e.to_string())?;

    let send = |q: String| {
        client
            .get(GTX_URL)
            .query(&[
                ("client", "gtx".to_string()),
                ("sl", "auto".to_string()),
                ("tl", target.to_string()),
                ("dt", "t".to_string()),
                ("dj", "1".to_string()),
                ("q", q),
            ])
            .timeout(Duration::from_secs(10))
    };

    // gtx GET 对 URL 长度敏感：超过 1500 字符分批发送后拼接
    const CHUNK: usize = 1400;
    let mut translated = String::new();
    let mut detected: Option<String> = None;
    if text.len() <= CHUNK {
        let resp: serde_json::Value = send(text.to_string())
            .send()
            .await
            .map_err(|e| format!("翻译请求失败：{e}"))?
            .json()
            .await
            .map_err(|e| format!("翻译结果解析失败：{e}"))?;
        translated = collect_gtx(&resp);
        detected = resp.get("src").and_then(|v| v.as_str()).map(String::from);
    } else {
        // 按句子边界切块（。！??.\n），保证译文可拼接
        let mut rest = text;
        while !rest.is_empty() {
            let mut end = rest.len().min(CHUNK);
            if rest.len() > CHUNK {
                if let Some(pos) = rest[..CHUNK].rfind(['。', '！', '？', '.', '!', '?', '\n']) {
                    end = pos + 1;
                }
            }
            let chunk = &rest[..end];
            rest = &rest[end..];
            let resp: serde_json::Value = send(chunk.to_string())
                .send()
                .await
                .map_err(|e| format!("翻译请求失败：{e}"))?
                .json()
                .await
                .map_err(|e| format!("翻译结果解析失败：{e}"))?;
            translated.push_str(&collect_gtx(&resp));
            if detected.is_none() {
                detected = resp.get("src").and_then(|v| v.as_str()).map(String::from);
            }
        }
    }

    if translated.is_empty() {
        return Err("翻译结果为空".into());
    }
    Ok(TranslateResult { text: translated, detected })
}

/// dj=1 响应：{"sentences":[{"trans":"...","orig":"..."},...], "src":"en"}
fn collect_gtx(resp: &serde_json::Value) -> String {
    resp.get("sentences")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|s| s.get("trans").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default()
}
