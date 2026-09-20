/**
 * 浏览器开发环境 mock：仅在非 Tauri 环境（window.__TAURI_INTERNALS__ 不存在）下被
 * bridge.ts 启用，用于 `pnpm dev` 在纯浏览器里预览 / 截图。
 * 真实桌面运行时完全不走本文件。
 */

import type { AirQuality, GeoPlace, WeatherData } from '../features/weather/model'
import type { ClipItem } from '../features/clipboard/api'
import type { LocalTrack, LyricsPayload, NeSong, QqSong } from '../features/music/api'
import type { Stats } from '../features/monitor/model'
import type { ActivitySeg } from '../features/activity/api'
import type { KairosSettings } from './settings'

const now = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const dateStr = (offsetDays = 0) => {
  const d = new Date(now)
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const hourStr = (h: number) => `${dateStr()}T${pad(h)}:00`

const SHANGHAI: GeoPlace = {
  name: '上海',
  admin1: '上海市',
  country: '中国',
  latitude: 31.23,
  longitude: 121.47,
  timezone: 'Asia/Shanghai',
}

function buildWeather(): WeatherData {
  const codes = [2, 3, 61, 80, 1, 0, 3, 45, 2, 1, 63, 0, 2, 3, 1]
  const daily = codes.map((code, i) => ({
    date: dateStr(i),
    weatherCode: code,
    tempMax: 27 - Math.round(Math.sin(i) * 3),
    tempMin: 20 - Math.round(Math.cos(i) * 2),
    precipProbability: [10, 20, 75, 60, 15, 5, 25][i % 7],
    uvIndexMax: i % 3 === 0 ? 6 : 3,
    windSpeedMax: 18 + (i % 4) * 6,
    sunrise: `${dateStr(i)}T05:58`,
    sunset: `${dateStr(i)}T17:36`,
    daylightDuration: 41880,
  }))
  const hourly = Array.from({ length: 48 }, (_, i) => {
    const h = (now.getHours() + i) % 24
    return {
      time: i < 24 ? hourStr(h) : `${dateStr(1)}T${pad(h)}:00`,
      temperature: 24 + Math.round(Math.sin((h - 6) / 3.8) * 4),
      apparentTemperature: 25 + Math.round(Math.sin((h - 6) / 3.8) * 4),
      precipProbability: i < 8 ? 70 - i * 5 : Math.max(0, 30 - Math.abs(h - 14) * 3),
      precipitation: null,
      cloud_cover: 60,
      uvIndex: h >= 7 && h <= 17 ? 5 : 0,
      weatherCode: 2,
    }
  })
  return {
    timezone: 'Asia/Shanghai',
    current: {
      time: hourStr(now.getHours()),
      temperature: 24.6,
      apparentTemperature: 25.8,
      humidity: 68,
      cloudCover: 55,
      uvIndex: 5.2,
      windSpeed: 14,
      windDirection: 135,
      windGusts: 26,
      weatherCode: 2,
      isDay: true,
    },
    hourly,
    daily,
  }
}

const AQI: AirQuality = {
  aqi: 62,
  level: '良',
  primary: 'PM2.5',
  pm25: 38,
  pm10: 71,
  updatedAt: hourStr(now.getHours()),
}

const STATS: Stats = {
  elevated: true,
  cpu: 31.6,
  cpuCores: [22, 38, 17, 44, 29, 12, 51, 33, 41, 19, 27, 36, 14, 47, 25, 31],
  cpuName: 'AMD Ryzen 7 7840H w/ Radeon 780M Graphics',
  cpuFreqGhz: 4.87,
  cpuTemp: 58.4,
  fanCpu: 2140,
  memUsed: 12.4,
  memTotal: 31.3,
  memInfo: 'DDR5-5600 · 2×16GB',
  disks: [
    {
      model: 'Samsung SSD 990 PRO 1TB',
      letters: 'C:',
      sizeGb: 953,
      usedGb: 387,
      totalGb: 953,
      volumes: [{ letter: 'C', usedGb: 387, totalGb: 953 }],
      busyPct: 3,
      temp: 41,
    },
    {
      model: 'WD Blue SN5800 2TB',
      letters: 'D:, E:',
      sizeGb: 1863,
      usedGb: 1102,
      totalGb: 1863,
      volumes: [
        { letter: 'D', usedGb: 742, totalGb: 1023 },
        { letter: 'E', usedGb: 360, totalGb: 840 },
      ],
      busyPct: 11,
      temp: 38,
    },
  ],
  netDown: 2.34,
  netUp: 0.42,
  gpu: {
    name: null,
    util: 46,
    temp: 61,
    memUsed: 1980,
    memTotal: 8188,
    memClock: 6751,
    coreClock: 2520,
    fan: 38,
  },
}

const SONGS: QqSong[] = [
  { songmid: 'm1', name: '夜空中最亮的星', singer: '逃跑计划', albumMid: '', durationSec: 268 },
  { songmid: 'm2', name: '平凡之路', singer: '朴树', albumMid: '', durationSec: 323 },
  { songmid: 'm3', name: '海阔天空', singer: 'Beyond', albumMid: '', durationSec: 326 },
  { songmid: 'm4', name: '如也', singer: '毛不易', albumMid: '', durationSec: 245 },
  { songmid: 'm5', name: '起风了', singer: '买辣椒也用券', albumMid: '', durationSec: 325 },
  { songmid: 'm6', name: '成都', singer: '赵雷', albumMid: '', durationSec: 287 },
]

const LYRICS: LyricsPayload = {
  found: true,
  synced: true,
  instrumental: false,
  plain: null,
  lines: [
    { time: 0, text: '夜空中最亮的星' },
    { time: 12, text: '能否听清' },
    { time: 20, text: '那仰望的人' },
    { time: 26, text: '心底的孤独和叹息' },
    { time: 36, text: 'oh 夜空中最亮的星' },
    { time: 46, text: '能否记起' },
    { time: 54, text: '曾与我同行' },
    { time: 60, text: '消失在风里的身影' },
  ],
}

const CLIPS: ClipItem[] = [
  { id: 'c1', kind: 'link', text: 'https://github.com/Everett406/kairos/releases/tag/v0.3.0', at: Date.now() - 40_000 },
  { id: 'c2', kind: 'text', text: '明天上午十点和产品对齐第三阶段的排期，记得带上新设计稿的评审记录', at: Date.now() - 320_000 },
  { id: 'c3', kind: 'text', text: 'git rebase -i HEAD~3 之后逐个 squash，别再把 WIP 提交直接推上去了', at: Date.now() - 1_500_000 },
  { id: 'c4', kind: 'text', text: 'sudo nvidia-smi -pl 250  # 限功率后噪音明显下来了', at: Date.now() - 3_600_000 },
]

function translate(text: string, target: string) {
  const trimmed = text.trim()
  const isChinese = /[\u4e00-\u9fff]/.test(trimmed)
  if (isChinese && target.startsWith('en')) {
    return {
      text: 'Kairos is an acrylic frosted system dashboard built with Tauri 2, where the global command bar is one keystroke away.',
      detected: 'zh-CN',
    }
  }
  if (!isChinese) {
    return {
      text: 'Kairos 是一个基于 Tauri 2 的磨砂质感系统仪表盘，全局命令条一键直达，翻译剪贴板音乐番茄钟都在这里。',
      detected: 'en',
    }
  }
  return { text: `（${target} 译文）${trimmed}`, detected: 'zh-CN' }
}

// ===== v0.4.1 mock 扩展：活动记录 / 网易云 / 本地音乐 =====

const SONG_COVER = (h1: string, h2: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${h1}"/><stop offset="1" stop-color="${h2}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="150" cy="150" r="52" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="7"/><circle cx="150" cy="150" r="9" fill="rgba(255,255,255,.8)"/></svg>`,
  )}`

const NE_SONGS: NeSong[] = [
  { id: 1, name: '夜空中最亮的星', singer: '逃跑计划', album: '世界', picUrl: SONG_COVER('#3d4f8a', '#7ca5f7'), durationSec: 268, fee: 0 },
  { id: 2, name: '平凡之路', singer: '朴树', album: '猎户座', picUrl: SONG_COVER('#4b4358', '#a79bf5'), durationSec: 323, fee: 0 },
  { id: 3, name: '海阔天空', singer: 'Beyond', album: '乐与怒', picUrl: SONG_COVER('#37505c', '#6fcfc7'), durationSec: 326, fee: 1 },
  { id: 4, name: '如也', singer: '毛不易', album: '平凡的一天', picUrl: SONG_COVER('#5a4a3c', '#e5b368'), durationSec: 245, fee: 0 },
  { id: 5, name: '起风了', singer: '买辣椒也用券', album: '起风了', picUrl: SONG_COVER('#4a6258', '#8fd4b8'), durationSec: 325, fee: 0 },
  { id: 6, name: '成都', singer: '赵雷', album: '无法长大', picUrl: SONG_COVER('#5c4a52', '#ef7d9d'), durationSec: 328, fee: 1 },
]

const LOCAL_TRACKS: LocalTrack[] = [
  { path: 'D:/Music/周杰伦 - 晴天.mp3', name: '晴天', artist: '周杰伦', sizeMb: 8.4 },
  { path: 'D:/Music/陈奕迅 - 孤勇者.flac', name: '孤勇者', artist: '陈奕迅', sizeMb: 31.2 },
  { path: 'D:/Music/朴树 - 那些花儿.mp3', name: '那些花儿', artist: '朴树', sizeMb: 7.1 },
  { path: 'D:/Music/告五人 - 唯一.m4a', name: '唯一', artist: '告五人', sizeMb: 9.8 },
  { path: 'D:/Music/周杰伦 - 七里香.flac', name: '七里香', artist: '周杰伦', sizeMb: 28.6 },
  { path: 'D:/Music/五月天 - 温柔.mp3', name: '温柔', artist: '五月天', sizeMb: 8.9 },
]

/** 今天 08:00 起到现在的活动段（按分钟铺一条真实的作息） */
function genActivity(): ActivitySeg[] {
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const nowMin = Math.max(600, Math.round((Date.now() - midnight.getTime()) / 60000))
  // [app, title, startMin, endMin]
  const plan: [string, string, number, number][] = [
    ['code', 'kairos — HANDOFF.md', 8 * 60 + 6, 9 * 60 + 47],
    ['chrome', 'GitHub - Everett406/kairos', 9 * 60 + 47, 10 * 60 + 12],
    ['code', 'ActivityBand.tsx — kairos', 10 * 60 + 12, 11 * 60 + 38],
    ['weixin', '微信', 11 * 60 + 38, 11 * 60 + 55],
    ['chrome', 'MDN Web Docs — backdrop-filter', 11 * 60 + 55, 12 * 60 + 21],
    ['kairos', 'Kairos', 12 * 60 + 21, 12 * 60 + 44],
    ['explorer', 'D:/Music', 12 * 60 + 44, 12 * 60 + 51],
    ['code', 'shell.css — kairos', 12 * 60 + 51, 14 * 60 + 9],
    ['steam', 'Steam 图书馆', 14 * 60 + 9, 14 * 60 + 58],
    ['chrome', 'Bilibili — 4K 显示器测评', 14 * 60 + 58, 15 * 60 + 26],
    ['code', 'WeatherPanel.tsx — kairos', 15 * 60 + 26, 16 * 60 + 2],
    ['msedge', '知乎 — 磨砂玻璃 UI', 16 * 60 + 2, 16 * 60 + 17],
  ]
  const out: ActivitySeg[] = []
  for (const [app, title, s, e] of plan) {
    if (s >= nowMin) break
    out.push({
      app,
      title,
      start: midnight.getTime() + s * 60_000,
      end: midnight.getTime() + Math.min(e, nowMin) * 60_000,
    })
  }
  return out
}

export function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const a = args ?? {}
  const ok = (v: unknown) => Promise.resolve(v as T)
  switch (cmd) {
    case 'weather_geocode': {
      const kw = String(a.city ?? '')
      if (!kw.trim()) return ok([])
      return ok([SHANGHAI, { ...SHANGHAI, name: kw, admin1: null, country: null }])
    }
    case 'weather_forecast':
      return ok(buildWeather())
    case 'weather_air_quality':
      return ok(AQI)
    case 'weather_ip_locate':
      return ok(SHANGHAI)
    case 'system_stats': {
      // 轻微抖动，让监控条看起来是活的
      STATS.cpu = Math.min(95, Math.max(4, STATS.cpu + (Math.random() - 0.5) * 6))
      STATS.netDown = Math.max(0.02, STATS.netDown + (Math.random() - 0.5) * 0.8)
      STATS.netUp = Math.max(0.02, STATS.netUp + (Math.random() - 0.5) * 0.2)
      // 内存慢漂移：真实系统里随应用开关缓变
      STATS.memUsed = Math.min(16, Math.max(9, STATS.memUsed + (Math.random() - 0.5) * 0.24))
      if (STATS.gpu) STATS.gpu.util = Math.min(98, Math.max(3, STATS.gpu.util + (Math.random() - 0.5) * 10))
      // 每核抖动（围绕各自基准起伏）
      STATS.cpuCores = STATS.cpuCores.map((c) => Math.min(98, Math.max(2, c + (Math.random() - 0.5) * 14)))
      // 返回深克隆：保持每次调用引用不同，否则 React setState 判等会跳过更新
      return ok({
        ...STATS,
        cpuCores: [...STATS.cpuCores],
        disks: STATS.disks.map((d) => ({ ...d, volumes: d.volumes.map((v) => ({ ...v })) })),
        gpu: STATS.gpu ? { ...STATS.gpu } : null,
      })
    }
    case 'process_top':
      return ok([
        { name: 'code', pid: 8241, memMb: 682.4, cpu: 12.6 },
        { name: 'chrome', pid: 11903, memMb: 1024.8, cpu: 8.3 },
        { name: 'kairos', pid: 35212, memMb: 96.2, cpu: 2.1 },
        { name: 'steamwebhelper', pid: 6612, memMb: 431.5, cpu: 1.8 },
        { name: 'msedge', pid: 27718, memMb: 388.1, cpu: 1.2 },
        { name: 'explorer', pid: 2296, memMb: 142.6, cpu: 0.6 },
        { name: 'dwm', pid: 1512, memMb: 88.4, cpu: 0.5 },
        { name: 'weixin', pid: 9181, memMb: 296.9, cpu: 0.4 },
      ])
    case 'activity_today':
      return ok(genActivity())
    case 'settings_get': {
      try {
        const raw = localStorage.getItem('kairos.mock.settings')
        return ok(raw ? JSON.parse(raw) : null)
      } catch {
        return ok(null)
      }
    }
    case 'settings_set': {
      try {
        localStorage.setItem('kairos.mock.settings', JSON.stringify(a.value ?? {}))
      } catch {
        /* 忽略 */
      }
      return ok(undefined)
    }
    case 'set_hotkeys':
      return ok(undefined)
    case 'autostart_status':
      return ok(false)
    case 'autostart_set':
      return Promise.reject('浏览器预览不支持开机自启')
    case 'pick_folder':
      return Promise.reject('浏览器预览不支持文件夹选择')
    case 'ne_search_songs': {
      const kw = String(a.keyword ?? '').trim().toLowerCase()
      const hit = kw ? NE_SONGS.filter((t) => (t.name + t.singer + t.album).toLowerCase().includes(kw)) : []
      return ok(kw ? hit : NE_SONGS)
    }
    case 'ne_song_url':
      return Promise.reject('NO_URL：浏览器预览不提供音源')
    case 'ne_lyric':
      return ok(LYRICS)
    case 'local_music_scan':
      return ok(LOCAL_TRACKS)
    case 'system_elevate':
      return Promise.reject('浏览器预览不支持提权')
    case 'qq_search_songs':
      return ok(SONGS)
    case 'qq_song_url':
      return Promise.reject('NO_URL：浏览器预览不提供音源')
    case 'fetch_lyrics':
      return ok(LYRICS)
    case 'qq_login_status':
      return ok(null)
    case 'qq_save_login':
      return ok({ uin: '123456789', music_key: 'mock_key_xxxxxxxxxxxx' })
    case 'qq_logout':
      return ok(undefined)
    case 'clipboard_list':
      return ok(CLIPS)
    case 'clipboard_remove': {
      const rest = CLIPS.filter((c) => c.id !== a.id)
      CLIPS.length = 0
      CLIPS.push(...rest)
      return ok([...rest])
    }
    case 'clipboard_pin': {
      const it = CLIPS.find((c) => c.id === a.id)
      if (it) it.pin = !it.pin
      CLIPS.sort((x, y) => Number(y.pin ?? false) - Number(x.pin ?? false) || y.at - x.at)
      return ok([...CLIPS])
    }
    case 'clipboard_clear':
      CLIPS.length = 0
      return ok([])
    case 'translate_text':
      return ok(translate(String(a.text ?? ''), String(a.target ?? 'en')))
    default:
      return Promise.reject(`mock 未覆盖命令：${cmd}`)
  }
}

/** 浏览器里事件永不触发（剪贴板监听等），返回取消函数即可 */
export async function mockListen<T = unknown>(
  _event: string,
  _handler: (payload: T) => void,
): Promise<() => void> {
  return () => {}
}
