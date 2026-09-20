/**
 * 全局设置中心：settings.json 单键存储（Rust 端 settings_get/settings_set），
 * 前端 useSyncExternalStore 订阅。App 根据它应用主题 / 强调色 / 磨砂浓度。
 */

import { invoke } from './bridge'
import { useSyncExternalStore } from 'react'

export type ThemeMode = 'dark' | 'light'
export type AccentId = 'indigo' | 'teal' | 'amber' | 'rose'
export type MusicSource = 'qq' | 'ne' | 'local'
export type TileId = 'metrics' | 'activity' | 'focus' | 'sensors'

export interface KairosSettings {
  theme: ThemeMode
  accent: AccentId
  /** 磨砂浓度 0-100：越高越透，壁纸在玻璃深处越明显 */
  frost: number
  /** 主页磁贴：数组顺序即排列顺序，不在数组内 = 关闭 */
  tiles: TileId[]
  hotkeys: { cmd: string; clip: string }
  musicSource: MusicSource
  musicDir: string
}

export const TILE_META: Record<TileId, { label: string; desc: string }> = {
  metrics: { label: '指标卡组', desc: 'CPU / GPU / 内存三卡' },
  activity: { label: '今日活动', desc: '应用使用时间轴与专注记录' },
  focus: { label: '专注', desc: '今日专注环与进入专注' },
  sensors: { label: '传感器', desc: '温度 / 内存 / 磁盘读数' },
}

export const ACCENT_META: { id: AccentId; label: string; swatch: string }[] = [
  { id: 'indigo', label: '靛蓝', swatch: '#6d8bff' },
  { id: 'teal', label: '青玉', swatch: '#46c8b2' },
  { id: 'amber', label: '琥珀', swatch: '#e5b368' },
  { id: 'rose', label: '玫瑰', swatch: '#ef7d9d' },
]

export const DEFAULTS: KairosSettings = {
  theme: 'dark',
  accent: 'indigo',
  frost: 88,
  tiles: ['metrics', 'activity', 'focus', 'sensors'],
  hotkeys: { cmd: 'Ctrl+Alt+K', clip: 'Ctrl+Alt+V' },
  musicSource: 'qq',
  musicDir: '',
}

const KEY = 'ui'

let cache: KairosSettings = { ...DEFAULTS }
const subs = new Set<() => void>()

function emit() {
  for (const fn of subs) fn()
}

// 启动即拉取（mock 环境下 localStorage 兜底）
invoke<Partial<KairosSettings> | null>('settings_get', { key: KEY })
  .then((v) => {
    if (v && typeof v === 'object') {
      cache = {
        ...DEFAULTS,
        ...v,
        hotkeys: { ...DEFAULTS.hotkeys, ...(v.hotkeys ?? {}) },
        tiles: Array.isArray(v.tiles) && v.tiles.length ? v.tiles : DEFAULTS.tiles,
      }
    }
    emit()
  })
  .catch(() => emit())

function subscribe(fn: () => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}

function getSnapshot(): KairosSettings {
  return cache
}

/** 订阅当前设置（未加载完时给默认值，加载后自动刷新） */
export function useSettings(): KairosSettings {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function getSettings(): KairosSettings {
  return cache
}

export function updateSettings(patch: Partial<KairosSettings>): void {
  cache = { ...cache, ...patch }
  emit()
  invoke('settings_set', { key: KEY, value: cache }).catch(() => {})
}

/** 磁贴开关 / 排序辅助 */
export function toggleTile(id: TileId): void {
  const on = cache.tiles.includes(id)
  updateSettings({ tiles: on ? cache.tiles.filter((t) => t !== id) : [...cache.tiles, id] })
}

export function moveTile(id: TileId, dir: -1 | 1): void {
  const arr = [...cache.tiles]
  const i = arr.indexOf(id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  updateSettings({ tiles: arr })
}
