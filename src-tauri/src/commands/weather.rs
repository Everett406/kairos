//! 天气数据：Open-Meteo 全家桶（免费、无需 key）。
//! - geocode：城市名 → 经纬度候选（中文结果）
//! - forecast：实况 + 15 日预报 + 48h 逐小时（含日出日落/昼长）
//! - air_quality：六项污染物浓度 → HJ 633-2012 中国标准 AQI
//! - ip_locate：公网 IP 粗定位（ipwho.is）→ 就近城市

use serde::{Deserialize, Serialize};
use std::time::Duration;

const GEO_URL: &str = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL: &str = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL: &str = "https://air-quality-api.open-meteo.com/v1/air-quality";
const IP_LOCATE_URL: &str = "https://ipwho.is/";

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("Kairos/0.3 (desktop assistant)")
        .build()
        .expect("failed to build weather http client")
}

// ===== 地理编码 =====

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeoPlace {
    pub name: String,
    pub admin1: Option<String>,
    pub country: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: Option<String>,
}

#[derive(Deserialize)]
struct GeoResponse {
    #[serde(default)]
    results: Vec<GeoRaw>,
}

#[derive(Deserialize)]
struct GeoRaw {
    name: String,
    #[serde(default)]
    admin1: Option<String>,
    #[serde(default)]
    country: Option<String>,
    latitude: f64,
    longitude: f64,
    #[serde(default)]
    timezone: Option<String>,
}

#[tauri::command]
pub async fn weather_geocode(city: String) -> Result<Vec<GeoPlace>, String> {
    let city = city.trim();
    if city.is_empty() {
        return Err("请输入城市名".into());
    }
    let resp: GeoResponse = http()
        .get(GEO_URL)
        .query(&[("name", city), ("count", "5"), ("language", "zh"), ("format", "json")])
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| format!("城市查询失败：{e}"))?
        .json()
        .await
        .map_err(|e| format!("城市数据解析失败：{e}"))?;
    Ok(resp
        .results
        .into_iter()
        .map(|g| GeoPlace {
            name: g.name,
            admin1: g.admin1,
            country: g.country,
            latitude: g.latitude,
            longitude: g.longitude,
            timezone: g.timezone,
        })
        .collect())
}

/// 公网 IP 粗定位 → 就近城市（失败返回 Ok(null)，前端据此提示手动输入）
#[tauri::command]
pub async fn weather_ip_locate() -> Result<Option<GeoPlace>, String> {
    #[derive(Deserialize)]
    struct IpInfo {
        #[serde(default)]
        city: String,
        #[serde(default)]
        region: String,
        #[serde(default)]
        country: String,
        #[serde(default)]
        latitude: Option<f64>,
        #[serde(default)]
        longitude: Option<f64>,
        #[serde(default)]
        timezone: Option<String>,
    }
    let info: IpInfo = http()
        .get(IP_LOCATE_URL)
        .timeout(Duration::from_secs(6))
        .send()
        .await
        .map_err(|e| format!("IP 定位失败：{e}"))?
        .json()
        .await
        .map_err(|e| format!("IP 定位解析失败：{e}"))?;
    let (lat, lon) = match (info.latitude, info.longitude) {
        (Some(a), Some(b)) => (a, b),
        _ => return Ok(None),
    };
    if info.city.is_empty() {
        return Ok(None);
    }
    Ok(Some(GeoPlace {
        name: info.city,
        admin1: if info.region.is_empty() { None } else { Some(info.region) },
        country: if info.country.is_empty() { None } else { Some(info.country) },
        latitude: lat,
        longitude: lon,
        timezone: info.timezone,
    }))
}

// ===== 天气实况与预报 =====

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherData {
    pub timezone: String,
    pub current: CurrentWeather,
    pub hourly: Vec<HourlyPoint>,
    pub daily: Vec<DailyForecast>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentWeather {
    pub time: String,
    pub temperature: f64,
    pub apparent_temperature: f64,
    pub humidity: i64,
    pub cloud_cover: Option<i64>,
    pub uv_index: Option<f64>,
    pub wind_speed: f64,
    pub wind_direction: Option<f64>,
    pub wind_gusts: Option<f64>,
    pub weather_code: i64,
    pub is_day: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HourlyPoint {
    pub time: String,
    pub temperature: f64,
    pub apparent_temperature: f64,
    pub precip_probability: Option<i64>,
    pub precipitation: Option<f64>,
    pub cloud_cover: Option<i64>,
    pub uv_index: Option<f64>,
    pub weather_code: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyForecast {
    pub date: String,
    pub weather_code: i64,
    pub temp_max: f64,
    pub temp_min: f64,
    pub precip_probability: Option<i64>,
    pub uv_index_max: Option<f64>,
    pub wind_speed_max: Option<f64>,
    pub sunrise: Option<String>,
    pub sunset: Option<String>,
    pub daylight_duration: Option<f64>,
}

#[derive(Deserialize)]
struct ForecastResponse {
    #[serde(default)]
    timezone: String,
    current: Option<ForecastCurrent>,
    hourly: Option<ForecastHourly>,
    daily: Option<ForecastDaily>,
}

#[derive(Deserialize)]
struct ForecastCurrent {
    time: String,
    temperature_2m: f64,
    apparent_temperature: f64,
    relative_humidity_2m: i64,
    cloud_cover: Option<i64>,
    uv_index: Option<f64>,
    wind_speed_10m: f64,
    wind_direction_10m: Option<f64>,
    wind_gusts_10m: Option<f64>,
    weather_code: i64,
    is_day: i64,
}

#[derive(Deserialize)]
struct ForecastHourly {
    time: Vec<String>,
    temperature_2m: Vec<Option<f64>>,
    apparent_temperature: Vec<Option<f64>>,
    #[serde(default)]
    precipitation_probability: Vec<Option<i64>>,
    #[serde(default)]
    precipitation: Vec<Option<f64>>,
    #[serde(default)]
    cloud_cover: Vec<Option<i64>>,
    #[serde(default)]
    uv_index: Vec<Option<f64>>,
    #[serde(default)]
    weather_code: Vec<Option<i64>>,
}

#[derive(Deserialize)]
struct ForecastDaily {
    time: Vec<String>,
    weather_code: Vec<i64>,
    temperature_2m_max: Vec<f64>,
    temperature_2m_min: Vec<f64>,
    #[serde(default)]
    precipitation_probability_max: Vec<Option<i64>>,
    #[serde(default)]
    uv_index_max: Vec<Option<f64>>,
    #[serde(default)]
    wind_speed_10m_max: Vec<Option<f64>>,
    #[serde(default)]
    sunrise: Vec<String>,
    #[serde(default)]
    sunset: Vec<String>,
    #[serde(default)]
    daylight_duration: Vec<Option<f64>>,
}

fn opt_at<T: Copy>(v: &[Option<T>], i: usize) -> Option<T> {
    v.get(i).copied().flatten()
}

fn str_at(v: &[String], i: usize) -> Option<String> {
    v.get(i).filter(|s| !s.is_empty()).cloned()
}

#[tauri::command]
pub async fn weather_forecast(latitude: f64, longitude: f64) -> Result<WeatherData, String> {
    let resp: ForecastResponse = http()
        .get(FORECAST_URL)
        .query(&[
            ("latitude", latitude.to_string()),
            ("longitude", longitude.to_string()),
            ("current", "temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,uv_index".to_string()),
            ("hourly", "temperature_2m,apparent_temperature,precipitation_probability,precipitation,cloud_cover,uv_index,weather_code".to_string()),
            ("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,sunrise,sunset,daylight_duration".to_string()),
            ("timezone", "auto".to_string()),
            ("forecast_days", "15".to_string()),
        ])
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("天气请求失败：{e}"))?
        .json()
        .await
        .map_err(|e| format!("天气数据解析失败：{e}"))?;

    let current = resp.current.ok_or("天气响应缺少 current 字段")?;
    let daily = resp.daily.ok_or("天气响应缺少 daily 字段")?;
    let hourly_raw = resp.hourly.ok_or("天气响应缺少 hourly 字段")?;

    let daily_out: Vec<DailyForecast> = daily
        .time
        .iter()
        .enumerate()
        .map(|(i, date)| DailyForecast {
            date: date.clone(),
            weather_code: daily.weather_code.get(i).copied().unwrap_or(0),
            temp_max: daily.temperature_2m_max.get(i).copied().unwrap_or(0.0),
            temp_min: daily.temperature_2m_min.get(i).copied().unwrap_or(0.0),
            precip_probability: opt_at(&daily.precipitation_probability_max, i),
            uv_index_max: opt_at(&daily.uv_index_max, i),
            wind_speed_max: opt_at(&daily.wind_speed_10m_max, i),
            sunrise: str_at(&daily.sunrise, i),
            sunset: str_at(&daily.sunset, i),
            daylight_duration: opt_at(&daily.daylight_duration, i),
        })
        .collect();

    let hourly_out: Vec<HourlyPoint> = hourly_raw
        .time
        .iter()
        .enumerate()
        .map(|(i, t)| HourlyPoint {
            time: t.clone(),
            temperature: hourly_raw.temperature_2m.get(i).copied().flatten().unwrap_or(0.0),
            apparent_temperature: hourly_raw.apparent_temperature.get(i).copied().flatten().unwrap_or(0.0),
            precip_probability: opt_at(&hourly_raw.precipitation_probability, i),
            precipitation: opt_at(&hourly_raw.precipitation, i),
            cloud_cover: opt_at(&hourly_raw.cloud_cover, i),
            uv_index: opt_at(&hourly_raw.uv_index, i),
            weather_code: opt_at(&hourly_raw.weather_code, i),
        })
        .collect();

    Ok(WeatherData {
        timezone: if resp.timezone.is_empty() { "auto".into() } else { resp.timezone },
        current: CurrentWeather {
            time: current.time,
            temperature: current.temperature_2m,
            apparent_temperature: current.apparent_temperature,
            humidity: current.relative_humidity_2m,
            cloud_cover: current.cloud_cover,
            uv_index: current.uv_index,
            wind_speed: current.wind_speed_10m,
            wind_direction: current.wind_direction_10m,
            wind_gusts: current.wind_gusts_10m,
            weather_code: current.weather_code,
            is_day: current.is_day == 1,
        },
        hourly: hourly_out,
        daily: daily_out,
    })
}

// ===== 空气质量（中国标准 AQI，HJ 633-2012） =====

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirQuality {
    pub aqi: u32,
    pub level: String,
    pub primary: Option<String>,
    pub pm25: f64,
    pub pm10: f64,
    pub updated_at: String,
}

#[derive(Deserialize)]
struct AqResponse {
    current: Option<AqCurrent>,
}

#[derive(Deserialize)]
struct AqCurrent {
    #[serde(default)]
    time: String,
    pm10: Option<f64>,
    pm2_5: Option<f64>,
    carbon_monoxide: Option<f64>,
    nitrogen_dioxide: Option<f64>,
    sulphur_dioxide: Option<f64>,
    ozone: Option<f64>,
}

/// 单项污染物 IAQI：浓度在断点区间内线性插值，超出最高断点记 500
fn iaqi(conc: f64, breakpoints: &[f64; 8]) -> f64 {
    const IAQI: [f64; 8] = [0.0, 50.0, 100.0, 150.0, 200.0, 300.0, 400.0, 500.0];
    if conc < 0.0 {
        return 0.0;
    }
    for i in 1..8 {
        if conc <= breakpoints[i] {
            let (lo, hi) = (breakpoints[i - 1], breakpoints[i]);
            let span = hi - lo;
            if span <= 0.0 {
                return IAQI[i];
            }
            return (IAQI[i] - IAQI[i - 1]) * (conc - lo) / span + IAQI[i - 1];
        }
    }
    500.0
}

/// 中国 AQI：六项污染物 1h 浓度分别算 IAQI 取最大，最大项为首要污染物。
/// CO 接口单位 μg/m³，标准断点为 mg/m³，需 /1000。
fn china_aqi(pm25: Option<f64>, pm10: Option<f64>, so2: Option<f64>, no2: Option<f64>, co_ugm3: Option<f64>, o3: Option<f64>) -> (u32, Option<&'static str>) {
    let items: [(Option<f64>, [f64; 8], &str); 6] = [
        (pm25, [0.0, 35.0, 75.0, 115.0, 150.0, 250.0, 350.0, 500.0], "PM2.5"),
        (pm10, [0.0, 50.0, 150.0, 250.0, 350.0, 420.0, 500.0, 600.0], "PM10"),
        (so2, [0.0, 150.0, 500.0, 650.0, 800.0, 1600.0, 2400.0, f64::INFINITY], "SO₂"),
        (no2, [0.0, 100.0, 200.0, 700.0, 1200.0, 2340.0, 3090.0, 3840.0], "NO₂"),
        (co_ugm3.map(|v| v / 1000.0), [0.0, 5.0, 10.0, 35.0, 60.0, 90.0, 120.0, 150.0], "CO"),
        (o3, [0.0, 160.0, 200.0, 300.0, 400.0, 800.0, 1000.0, 1200.0], "O₃"),
    ];
    let mut best = 0.0f64;
    let mut primary = None;
    for (conc, bp, name) in items {
        if let Some(c) = conc {
            let v = iaqi(c, &bp);
            if v > best {
                best = v;
                primary = Some(name);
            }
        }
    }
    (best.round() as u32, primary)
}

fn aqi_level(aqi: u32) -> &'static str {
    match aqi {
        0..=50 => "优",
        51..=100 => "良",
        101..=150 => "轻度污染",
        151..=200 => "中度污染",
        201..=300 => "重度污染",
        _ => "严重污染",
    }
}

#[tauri::command]
pub async fn weather_air_quality(latitude: f64, longitude: f64) -> Result<AirQuality, String> {
    let resp: AqResponse = http()
        .get(AIR_QUALITY_URL)
        .query(&[
            ("latitude", latitude.to_string()),
            ("longitude", longitude.to_string()),
            ("current", "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone".to_string()),
            ("timezone", "auto".to_string()),
        ])
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| format!("空气质量请求失败：{e}"))?
        .json()
        .await
        .map_err(|e| format!("空气质量解析失败：{e}"))?;

    let cur = resp.current.ok_or("空气质量响应缺少 current 字段")?;
    let (aqi, primary) = china_aqi(cur.pm2_5, cur.pm10, cur.sulphur_dioxide, cur.nitrogen_dioxide, cur.carbon_monoxide, cur.ozone);
    Ok(AirQuality {
        aqi,
        level: aqi_level(aqi).into(),
        primary: if aqi > 50 { primary.map(Into::into) } else { None },
        pm25: cur.pm2_5.unwrap_or(0.0),
        pm10: cur.pm10.unwrap_or(0.0),
        updated_at: cur.time,
    })
}
