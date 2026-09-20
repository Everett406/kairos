import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, Minus, Plus, Coffee } from 'lucide-react'
import { Button, Tag } from '../../design/primitives'
import { notify } from '../../lib/bridge'
import { fmtMmss } from '../../lib/format'
import './pomodoro.css'

type Mode = 'focus' | 'short' | 'long'

const MODE_META: Record<Mode, { label: string; defMin: number; doneText: string }> = {
  focus: { label: '专注', defMin: 25, doneText: '专注完成，休息一下吧' },
  short: { label: '短休', defMin: 5, doneText: '休息结束，继续专注' },
  long: { label: '长休', defMin: 15, doneText: '长休息结束，继续专注' },
}

const DUR_KEY = 'kairos.pomodoro.durations'
const COUNT_KEY = 'kairos.pomodoro.count'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadDurations(): Record<Mode, number> {
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

export default function PomodoroPanel({ mode }: { mode: 'compact' | 'expanded' }) {
  const [mode_, setMode] = useState<Mode>('focus')
  const [durations, setDurations] = useState(loadDurations)
  const [running, setRunning] = useState(false)
  // 用时间戳倒计时，避免 interval 漂移；暂停时保留剩余秒
  const [remainSec, setRemainSec] = useState(durations.focus * 60)
  const endAtRef = useRef<number | null>(null)
  const [doneCount, setDoneCount] = useState(loadTodayCount)

  const totalSec = durations[mode_] * 60

  // 切模式：重置计时
  const switchMode = (m: Mode) => {
    setMode(m)
    setRunning(false)
    endAtRef.current = null
    setRemainSec(loadDurations()[m] * 60)
  }

  const onDone = useCallback(() => {
    setRunning(false)
    endAtRef.current = null
    const meta = MODE_META[mode_]
    if (mode_ === 'focus') {
      bumpTodayCount()
      setDoneCount(loadTodayCount())
      // 每 4 个专注进长休
      const next = (doneCount + 1) % 4 === 0 ? 'long' : 'short'
      notify('番茄钟', meta.doneText)
      setMode(next)
      setRemainSec(loadDurations()[next] * 60)
    } else {
      notify('番茄钟', meta.doneText)
      setMode('focus')
      setRemainSec(loadDurations().focus * 60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode_, doneCount])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      const endAt = endAtRef.current
      if (endAt == null) return
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000))
      setRemainSec(left)
      if (left <= 0) onDone()
    }, 250)
    return () => window.clearInterval(id)
  }, [running, onDone])

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (running) {
      setRunning(false)
      endAtRef.current = null
    } else {
      endAtRef.current = Date.now() + remainSec * 1000
      setRunning(true)
    }
  }

  const reset = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRunning(false)
    endAtRef.current = null
    setRemainSec(totalSec)
  }

  const adjustDur = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation()
    if (running) return
    setDurations((prev) => {
      const next = { ...prev, [mode_]: Math.min(180, Math.max(1, prev[mode_] + delta)) }
      localStorage.setItem(DUR_KEY, JSON.stringify(next))
      setRemainSec(next[mode_] * 60)
      return next
    })
  }

  const progress = totalSec > 0 ? 1 - remainSec / totalSec : 0
  const runningCls = running ? ' is-running' : ''

  // R = 46, 周长 ≈ 289
  const CIRC = 2 * Math.PI * 46

  const dial = (
    <div className={`p-dial${runningCls}`}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle className="p-dial__track" cx="50" cy="50" r="46" />
        <circle
          className="p-dial__fill"
          cx="50"
          cy="50"
          r="46"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="p-dial__inner">
        <span className="num p-dial__time">{fmtMmss(remainSec)}</span>
        <span className="p-dial__mode">{MODE_META[mode_].label}</span>
      </div>
    </div>
  )

  if (mode === 'compact') {
    return (
      <div className="p-compact">
        {dial}
        <div className="p-compact__foot">
          <span className="p-today">
            <Coffee size={12} />
            <span className="num">今日 {doneCount} 番茄</span>
          </span>
          <span className="p-compact__btns">
            <button className="p-icon-btn" onClick={toggle} title={running ? '暂停' : '开始'}>
              {running ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button className="p-icon-btn" onClick={reset} title="重置">
              <RotateCcw size={14} />
            </button>
          </span>
        </div>
      </div>
    )
  }

  // ===== 展开态 =====
  return (
    <div className="p-detail">
      {dial}

      <div className="p-modes" onClick={(e) => e.stopPropagation()}>
        {(Object.keys(MODE_META) as Mode[]).map((m) => (
          <button
            key={m}
            className={`p-mode${m === mode_ ? ' is-active' : ''}`}
            onClick={() => switchMode(m)}
          >
            {MODE_META[m].label}
            <span className="num p-mode__min">{durations[m]}min</span>
          </button>
        ))}
      </div>

      <div className="p-controls" onClick={(e) => e.stopPropagation()}>
        <Button variant={running ? 'ghost' : 'primary'} size="md" onClick={toggle}>
          {running ? <Pause size={15} /> : <Play size={15} />}
          {running ? '暂停' : remainSec < totalSec ? '继续' : '开始'}
        </Button>
        <Button variant="ghost" size="md" onClick={reset}>
          <RotateCcw size={15} />
          重置
        </Button>
      </div>

      <div className="p-adjust" onClick={(e) => e.stopPropagation()}>
        <span>调整{MODE_META[mode_].label}时长</span>
        <button className="p-icon-btn" onClick={(e) => adjustDur(e, -5)} disabled={running}>
          <Minus size={13} />
        </button>
        <span className="num p-adjust__val">{durations[mode_]} min</span>
        <button className="p-icon-btn" onClick={(e) => adjustDur(e, 5)} disabled={running}>
          <Plus size={13} />
        </button>
      </div>

      <div className="p-stats">
        <Tag tone={doneCount > 0 ? 'accent' : 'default'}>
          今日完成 {doneCount} 个番茄
        </Tag>
        {doneCount >= 4 && <Tag tone="success">已达成 {Math.floor(doneCount / 4)} 轮</Tag>}
      </div>
    </div>
  )
}
