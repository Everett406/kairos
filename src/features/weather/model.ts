/** 天气数据模型与展示层映射（WMO 代码 / 风级 / UV / 穿衣建议） */

export interface GeoPlace {
  name: string
  admin1: string | null
  country: string | null
  latitude: number
  longitude: number
  timezone: string | null
}

export interface CurrentWeather {
  time: string
  temperature: number
  apparentTemperature: number
  humidity: number
  cloudCover: number | null
  uvIndex: number | null
  windSpeed: number
  windDirection: number | null
  windGusts: number | null
  weatherCode: number
  isDay: boolean
}

export interface HourlyPoint {
  time: string
  temperature: number
  apparentTemperature: number
  precipProbability: number | null
  precipitation: number | null
  cloud_cover: number | null
  uvIndex: number | null
  weatherCode: number | null
}

export interface DailyForecast {
  date: string
  weatherCode: number
  tempMax: number
  tempMin: number
  precipProbability: number | null
  uvIndexMax: number | null
  windSpeedMax: number | null
  sunrise: string | null
  sunset: string | null
  daylightDuration: number | null
}

export interface WeatherData {
  timezone: string
  current: CurrentWeather
  hourly: HourlyPoint[]
  daily: DailyForecast[]
}

export interface AirQuality {
  aqi: number
  level: string
  primary: string | null
  pm25: number
  pm10: number
  updatedAt: string
}

/** WMO 天气代码 → 中文描述 + 图标键（Meteocons） */
const WMO: Record<number, { desc: string; icon: string; night?: string }> = {
  0: { desc: '晴', icon: 'clear-day', night: 'clear-night' },
  1: { desc: '基本晴', icon: 'clear-day', night: 'clear-night' },
  2: { desc: '局部多云', icon: 'partly-cloudy-day', night: 'partly-cloudy-night' },
  3: { desc: '阴', icon: 'overcast-day', night: 'overcast-night' },
  45: { desc: '雾', icon: 'fog-day', night: 'fog-night' },
  48: { desc: '冻雾', icon: 'fog-day', night: 'fog-night' },
  51: { desc: '小毛毛雨', icon: 'drizzle' },
  53: { desc: '毛毛雨', icon: 'drizzle' },
  55: { desc: '大毛毛雨', icon: 'rain' },
  61: { desc: '小雨', icon: 'drizzle' },
  63: { desc: '中雨', icon: 'rain' },
  65: { desc: '大雨', icon: 'rain' },
  66: { desc: '冻雨', icon: 'sleet' },
  67: { desc: '强冻雨', icon: 'sleet' },
  71: { desc: '小雪', icon: 'snow' },
  73: { desc: '中雪', icon: 'snow' },
  75: { desc: '大雪', icon: 'snow' },
  77: { desc: '雪粒', icon: 'snow' },
  80: { desc: '小阵雨', icon: 'partly-cloudy-day-rain', night: 'partly-cloudy-night-rain' },
  81: { desc: '阵雨', icon: 'rain' },
  82: { desc: '强阵雨', icon: 'thunderstorms-day-rain' },
  85: { desc: '小阵雪', icon: 'partly-cloudy-day-snow' },
  86: { desc: '大阵雪', icon: 'snow' },
  95: { desc: '雷暴', icon: 'thunderstorms-day-rain', night: 'thunderstorms-night-rain' },
  96: { desc: '雷暴伴冰雹', icon: 'thunderstorms-day-rain', night: 'thunderstorms-night-rain' },
  99: { desc: '强雷暴伴冰雹', icon: 'thunderstorms-day-rain', night: 'thunderstorms-night-rain' },
}

/** 取描述 + 图标键（夜间替换） */
export function wmo(code: number, isDay = true): { desc: string; icon: string } {
  const m = WMO[code] ?? { desc: '未知', icon: 'not-available' }
  return { desc: m.desc, icon: !isDay && m.night ? m.night : m.icon }
}

const DIR8 = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
export function windDir(deg: number | null | undefined): string {
  if (deg == null) return '—'
  return DIR8[Math.round(deg / 45) % 8] + '风'
}

const BEAUFORT_NAME = ['无风', '软风', '轻风', '微风', '和风', '劲风', '强风', '疾风', '大风', '烈风', '狂风', '暴风', '飓风']
const BEAUFORT_MAX = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]
/** km/h → 蒲福风级名 */
export function beaufort(kmh: number | null | undefined): string {
  if (kmh == null) return '—'
  const i = BEAUFORT_MAX.findIndex((max) => kmh <= max)
  return `${BEAUFORT_NAME[i === -1 ? 12 : i]}·${Math.round(kmh)}km/h`
}

export function uvLevel(uv: number | null | undefined): { label: string; tone: 'success' | 'warning' | 'danger' | 'default' } | null {
  if (uv == null) return null
  if (uv < 3) return { label: '弱', tone: 'success' }
  if (uv < 6) return { label: '中等', tone: 'warning' }
  if (uv < 8) return { label: '强', tone: 'warning' }
  if (uv < 11) return { label: '很强', tone: 'danger' }
  return { label: '极强', tone: 'danger' }
}

/** 穿衣建议：体感温度 + 天气 */
export function clothingAdvice(feels: number, code: number): string {
  const rainy = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)
  const snowy = [71, 73, 75, 77, 85, 86].includes(code)
  if (snowy) return '注意防滑保暖，厚羽绒服/棉服 + 防滑雪地靴'
  if (feels <= -5) return '严寒：厚羽绒服、帽子围巾手套全副武装'
  if (feels <= 3) return '寒冷：羽绒服或厚大衣，注意保暖'
  if (feels <= 10) return '冷：大衣/夹克 + 毛衣'
  if (feels <= 17) return '微凉：风衣、薄毛衣或长袖卫衣'
  if (feels <= 23) return '舒适：长袖衬衫、薄外套'
  if (feels <= 28) return '温暖：短袖 + 薄外搭'
  if (rainy) return '炎热有雨：短袖短裤，随身带伞'
  return '炎热：短袖短裤，注意防晒补水'
}

export function aqiTone(aqi: number): 'success' | 'default' | 'warning' | 'danger' {
  if (aqi <= 50) return 'success'
  if (aqi <= 100) return 'default'
  if (aqi <= 200) return 'warning'
  return 'danger'
}
