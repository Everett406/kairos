/**
 * 活动记录：Rust 端每 5 秒采样前台窗口，同应用连续使用合并为会话段。
 * 主画布「今日活动」时间轴 + 使用时长榜消费。
 */

import { invoke } from '../../lib/bridge'

export interface ActivitySeg {
  app: string
  title: string
  start: number
  end: number
}

export function fetchActivity(): Promise<ActivitySeg[]> {
  return invoke<ActivitySeg[]>('activity_today')
}

/** 常见应用的展示名（进程名 → 可读名） */
const APP_NAMES: Record<string, string> = {
  code: 'VS Code',
  'code - insiders': 'VS Code',
  chrome: 'Chrome',
  msedge: 'Edge',
  firefox: 'Firefox',
  weixin: '微信',
  wechat: '微信',
  qq: 'QQ',
  ntqq: 'QQ',
  dingtalk: '钉钉',
  feishu: '飞书',
  lark: '飞书',
  steam: 'Steam',
  steamwebhelper: 'Steam',
  cs2: 'CS2',
  explorer: '文件资源管理器',
  cmd: '终端',
  windowsterminal: '终端',
  pwsh: '终端',
  powershell: '终端',
  wt: '终端',
  kairos: 'Kairos',
  cloudmusic: '网易云',
  qqmusic: 'QQ音乐',
  spotify: 'Spotify',
  potplayer: 'PotPlayer',
  wps: 'WPS',
  winword: 'Word',
  excel: 'Excel',
  powerpnt: 'PPT',
  notion: 'Notion',
  typora: 'Typora',
  obs64: 'OBS',
  idea64: 'IDEA',
  pycharm64: 'PyCharm',
  devenv: 'Visual Studio',
}

/** 时间轴应用色：低饱和同族色板，固定映射 + 哈希兜底 */
const PALETTE = ['#7ca5f7', '#a79bf5', '#6fcfc7', '#e5b368', '#c084fc', '#ef7d9d', '#64b5ff', '#94a8c2']

const APP_COLORS: Record<string, string> = {
  code: '#a79bf5',
  'code - insiders': '#a79bf5',
  chrome: '#7ca5f7',
  msedge: '#64b5ff',
  firefox: '#ef7d9d',
  weixin: '#6fcfc7',
  wechat: '#6fcfc7',
  qq: '#6fcfc7',
  ntqq: '#6fcfc7',
  steam: '#e06a8a',
  steamwebhelper: '#e06a8a',
  cs2: '#e06a8a',
  kairos: '#e5b368',
  cloudmusic: '#c084fc',
  qqmusic: '#c084fc',
  explorer: '#94a8c2',
}

export function appLabel(app: string): string {
  const key = app.toLowerCase().replace(/\.exe$/, '')
  return APP_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

export function appColor(app: string): string {
  const key = app.toLowerCase().replace(/\.exe$/, '')
  if (APP_COLORS[key]) return APP_COLORS[key]
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** 汇总各应用今日使用时长（秒），按降序 */
export function sumByApp(segs: ActivitySeg[]): { app: string; seconds: number }[] {
  const map = new Map<string, number>()
  for (const s of segs) {
    map.set(s.app, (map.get(s.app) ?? 0) + Math.max(0, s.end - s.start) / 1000)
  }
  return [...map.entries()]
    .map(([app, seconds]) => ({ app, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
}

/** 秒数 → 人话时长：">=1h: x.x 小时 / >=60s: x 分钟 / else x 秒" */
export function fmtDuration(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} 小时`
  if (seconds >= 60) return `${Math.round(seconds / 60)} 分钟`
  return `${Math.round(seconds)} 秒`
}
