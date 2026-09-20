import { useEffect, useState } from 'react'
import { invoke, listen } from '../../lib/bridge'

export interface ClipItem {
  id: string
  /** link | text */
  kind: string
  text: string
  /** 毫秒时间戳 */
  at: number
  /** 置顶收藏（旧历史记录无此字段） */
  pin?: boolean
}

export function clipboardList(): Promise<ClipItem[]> {
  return invoke<ClipItem[]>('clipboard_list')
}

export function clipboardRemove(id: string): Promise<ClipItem[]> {
  return invoke<ClipItem[]>('clipboard_remove', { id })
}

export function clipboardClear(): Promise<ClipItem[]> {
  return invoke<ClipItem[]>('clipboard_clear')
}

/** 置顶 / 取消置顶 */
export function clipboardPin(id: string): Promise<ClipItem[]> {
  return invoke<ClipItem[]>('clipboard_pin', { id })
}

export async function copyText(text: string): Promise<void> {
  const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
  await writeText(text)
}

/** 相对时间：刚刚 / n 分钟前 / n 小时前 / 昨天 / n 天前 */
export function relTime(atMs: number): string {
  const diff = Date.now() - atMs
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 172_800_000) return '昨天'
  return `${Math.floor(diff / 86_400_000)} 天前`
}

/**
 * 订阅剪贴板历史。
 * ModuleCard compact/expanded 切换会重建实例，这里用模块级 cache
 * 保证切换瞬间不闪空；事件 payload 即完整列表。
 */
let cache: ClipItem[] | null = null

export function useClipboardItems(): { items: ClipItem[]; loading: boolean } {
  const [items, setItems] = useState<ClipItem[] | null>(cache)

  useEffect(() => {
    let alive = true
    let un: (() => void) | undefined
    const apply = (list: ClipItem[]) => {
      cache = list
      if (alive) setItems(list)
    }
    clipboardList().then(apply).catch(() => {})
    listen<ClipItem[]>('clipboard-changed', apply).then((u) => {
      if (!alive) u()
      else un = u
    })
    return () => {
      alive = false
      un?.()
    }
  }, [])

  return { items: items ?? [], loading: items == null }
}
