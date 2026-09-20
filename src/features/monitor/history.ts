import { useEffect, useState } from 'react'
import { onStats } from './useMonitor'
import type { Stats } from './model'

/**
 * 指标历史环形缓冲：直接订阅 useMonitor 的全局轮询流（不经 React state，
 * 避免 mock 同引用导致的更新丢失），为 CPU / GPU / 内存三条曲线维护最近 N 个采样点。
 */

const MAX = 56

const buffers = {
  cpu: [] as number[],
  gpu: [] as number[],
  mem: [] as number[], // 已用 GB
}

let bound = false
const subs = new Set<() => void>()

/** 起步暖机段：以首个真实值为基准小幅随机游走，避免开局一条死直线 */
function warmup(s: Stats) {
  const walk = (base: number, amp: number, depth: number): number[] => {
    const out: number[] = []
    let v = base
    for (let i = 0; i < depth; i++) {
      v += (Math.random() - 0.5) * amp
      out.push(v)
    }
    return out
  }
  buffers.cpu.push(...walk(s.cpu, 6, 14))
  buffers.gpu.push(...walk(s.gpu?.util ?? 0, 9, 14))
  buffers.mem.push(...walk(s.memUsed, 0.3, 14))
}

function push(s: Stats) {
  if (buffers.cpu.length === 0) warmup(s)
  buffers.cpu.push(s.cpu)
  if (buffers.cpu.length > MAX) buffers.cpu.shift()
  buffers.gpu.push(s.gpu?.util ?? 0)
  if (buffers.gpu.length > MAX) buffers.gpu.shift()
  buffers.mem.push(s.memUsed)
  if (buffers.mem.length > MAX) buffers.mem.shift()
  for (const fn of subs) fn()
}

export type StatsHistory = typeof buffers

/** 订阅三条指标曲线历史（随全局轮询每 2s 前进一格） */
export function useStatsHistory(): StatsHistory {
  const [, force] = useState(0)

  useEffect(() => {
    if (!bound) {
      bound = true
      onStats(push)
    }
    const fn = () => force((n) => n + 1)
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  }, [])

  return buffers
}
