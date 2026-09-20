import { useEffect, useState } from 'react'
import { notify } from '../../lib/bridge'

/**
 * 番茄钟全局单例状态：专注场景、功能面板、命令条共享同一份计时。
 * 与 useMonitor 同一套「单例 ticker + 订阅集合」模式。
 * 专注会话按 {start, end} 落地 localStorage，供主画布「今日时间带」渲染。
 */

export type PomodoroMode = 'focus' | 'short' | 'long'

export const MODE_META: Record<PomodoroMode, { label: string; defMin: number; doneText: string }> = {
  focus: { label: '专注', defMin: 25, doneText: '专注完成，休息一下吧' },
  short: { label: '短休', defMin: 5, doneText: '休息结束，继续专注' },
  long: { label: '长休', defMin: 15, doneText: '长休息结束，继续专注' },
}

const DUR_KEY = 'kairos.pomodoro.durations'
const COUNT_KEY = 'kairos.pomodoro.count'
const SESSION_KEY = 'kairos.pomodoro.sessions'

export interface FocusSession {
  s: number
  e: number
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadDurations(): Record<PomodoroMode, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(DUR_KEY) || '{}')
    return {
      focus: raw.focus ?? MODE_META.focus.defMin,
      short: raw.short ?? MODE_META.short.defMin,
      long: raw.long ?? MODE_META.long.defMin,
    }
  } catch {
    return { focus: 25, short: 5, long: 15 }
  }
}

function loadTodayCount(): number {
  try {
    const obj = JSON.parse(localStorage.getItem(COUNT_KEY) || '{}')
    return obj[today()] ?? 0
  } catch {
    return 0
  }
}

function bumpTodayCount() {
  try {
    const obj = JSON.parse(localStorage.getItem(COUNT_KEY) || '{}')
    obj[today()] = (obj[today()] ?? 0) + 1
    localStorage.setItem(COUNT_KEY, JSON.stringify(obj))
  } catch {
    /* ignore */
  }
}

function loadSessions(): FocusSession[] {
  try {
    const obj = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}')
    return obj[today()] ?? []
  } catch {
    return []
  }
}

function saveSession(session: FocusSession) {
  try {
    const obj = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}')
    const list = obj[today()] ?? []
    list.push(session)
    obj[today()] = list
    localStorage.setItem(SESSION_KEY, JSON.stringify(obj))
  } catch {
    /* ignore */
  }
}

// ---- 单例状态 ----
let durations = loadDurations()
let mode: PomodoroMode = 'focus'
let running = false
let remainSec = durations.focus * 60
let endAt: number | null = null
let sessionStart: number | null = null
let doneCount = loadTodayCount()
let sessions = loadSessions()

let timer: number | undefined
const subs = new Set<() => void>()

function emit() {
  for (const fn of subs) fn()
}

function tick() {
  if (endAt == null) return
  const left = Math.max(0, Math.round((endAt - Date.now()) / 1000))
  remainSec = left
  if (left <= 0) finish()
  else emit()
}

function ensureTicker() {
  if (timer != null || !running) return
  timer = window.setInterval(tick, 250)
}

function stopTicker() {
  if (timer != null) {
    window.clearInterval(timer)
    timer = undefined
  }
}

function finish() {
  stopTicker()
  running = false
  endAt = null
  if (sessionStart != null) {
    saveSession({ s: sessionStart, e: Date.now() })
    sessionStart = null
  }
  if (mode === 'focus') {
    bumpTodayCount()
    doneCount = loadTodayCount()
    sessions = loadSessions()
    notify('番茄钟', MODE_META.focus.doneText)
    mode = (doneCount % 4 === 0 ? 'long' : 'short') as PomodoroMode
  } else {
    notify('番茄钟', MODE_META[mode].doneText)
    mode = 'focus'
  }
  remainSec = durations[mode] * 60
  emit()
}

export interface PomodoroApi {
  mode: PomodoroMode
  durations: Record<PomodoroMode, number>
  running: boolean
  remainSec: number
  totalSec: number
  progress: number
  doneCount: number
  sessions: FocusSession[]
  start: () => void
  pause: () => void
  reset: () => void
  switchMode: (m: PomodoroMode) => void
  adjustDur: (m: PomodoroMode, delta: number) => void
}

export function usePomodoro(): PomodoroApi {
  const [, force] = useState(0)

  useEffect(() => {
    const fn = () => force((n) => n + 1)
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  }, [])

  return {
    mode,
    durations,
    running,
    remainSec,
    totalSec: durations[mode] * 60,
    progress: durations[mode] * 60 > 0 ? 1 - remainSec / (durations[mode] * 60) : 0,
    doneCount,
    sessions,
    start: () => {
      if (running) return
      running = true
      endAt = Date.now() + remainSec * 1000
      if (mode === 'focus') sessionStart = Date.now()
      ensureTicker()
      emit()
    },
    pause: () => {
      if (!running) return
      running = false
      endAt = null
      stopTicker()
      if (sessionStart != null) {
        if (Date.now() - sessionStart > 60_000) saveSession({ s: sessionStart, e: Date.now() })
        sessionStart = null
      }
      emit()
    },
    reset: () => {
      running = false
      endAt = null
      stopTicker()
      sessionStart = null
      remainSec = durations[mode] * 60
      emit()
    },
    switchMode: (m) => {
      mode = m
      running = false
      endAt = null
      stopTicker()
      sessionStart = null
      durations = loadDurations()
      remainSec = durations[m] * 60
      emit()
    },
    adjustDur: (m, delta) => {
      if (running) return
      const next = { ...durations, [m]: Math.min(180, Math.max(1, durations[m] + delta)) }
      durations = next
      try {
        localStorage.setItem(DUR_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      if (m === mode && !running) remainSec = next[m] * 60
      emit()
    },
  }
}
