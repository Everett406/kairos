import { useEffect, useState } from 'react'
import { fetchStats } from './model'
import type { Stats } from './model'

/**
 * 模块级共享轮询：
 * ModuleCard 的 compact/expanded 是两个实例切换，为避免重复建立轮询
 * 与切换时的数据闪空，这里用单例 ticker + 订阅集合 + 最新值缓存。
 */

const POLL_MS = 2000

let timer: number | undefined
let latest: Stats | null = null
let inflight = false
const subs = new Set<(s: Stats) => void>()

function tick() {
  if (inflight) return
  inflight = true
  fetchStats()
    .then((s) => {
      latest = s
      for (const fn of subs) fn(s)
    })
    .catch(() => {
      /* 后台轮询静默失败，UI 保留上次值 */
    })
    .finally(() => {
      inflight = false
    })
}

function ensurePolling() {
  if (timer != null) return
  tick()
  timer = window.setInterval(tick, POLL_MS)
}

function maybeStopPolling() {
  if (subs.size > 0 || timer == null) return
  window.clearInterval(timer)
  timer = undefined
}

/** 订阅系统指标；组件卸载时自动取消订阅（延迟一拍，容忍 compact↔expanded 切换） */
export function useMonitor(): Stats | null {
  const [stats, setStats] = useState<Stats | null>(latest)

  useEffect(() => {
    const fn = (s: Stats) => setStats(s)
    subs.add(fn)
    ensurePolling()
    if (latest) setStats(latest)

    let stopped = false
    const cleanup = () => {
      subs.delete(fn)
      window.setTimeout(() => {
        if (!stopped) maybeStopPolling()
      }, 120)
    }
    stopped = false
    return () => {
      stopped = true
      cleanup()
    }
  }, [])

  return stats
}

/** 无 React 的原始订阅（历史缓冲等非组件消费场景用），会兜底启动轮询 */
export function onStats(fn: (s: Stats) => void): () => void {
  subs.add(fn)
  ensurePolling()
  return () => {
    subs.delete(fn)
    maybeStopPolling()
  }
}
