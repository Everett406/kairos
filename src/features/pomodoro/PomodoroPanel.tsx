import { Play, Pause, RotateCcw, Minus, Plus, Coffee } from 'lucide-react'
import { Button, Tag } from '../../design/primitives'
import { fmtMmss } from '../../lib/format'
import { usePomodoro, MODE_META } from './usePomodoro'
import type { PomodoroMode } from './usePomodoro'
import './pomodoro.css'

/**
 * 番茄钟面板：UI 与状态分离 —— 计时状态在 usePomodoro 全局单例，
 * 与专注场景 / 命令条共享同一份，切面板不中断计时。
 */
export default function PomodoroPanel({ mode }: { mode: 'compact' | 'expanded' }) {
  const p = usePomodoro()
  const { running, remainSec, totalSec, progress, doneCount } = p
  const meta = MODE_META[p.mode]

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    running ? p.pause() : p.start()
  }
  const reset = (e: React.MouseEvent) => {
    e.stopPropagation()
    p.reset()
  }
  const adjustDur = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation()
    p.adjustDur(p.mode, delta)
  }

  const runningCls = running ? ' is-running' : ''

  // R = 46, 周长 ≈ 289；外圈刻度环 + 渐变描边（v0.4.1 设计感打磨）
  const CIRC = 2 * Math.PI * 46

  const dial = (
    <div className={`p-dial${runningCls}`}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="p-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--k-mod)" />
            <stop offset="1" stopColor="var(--k-warm)" />
          </linearGradient>
        </defs>
        {/* 刻度环：60 格，安静表盘质感 */}
        <circle
          className="p-dial__ticks"
          cx="50"
          cy="50"
          r="48.5"
          strokeDasharray="0.55 4.5"
          transform="rotate(-90 50 50)"
        />
        <circle className="p-dial__track" cx="50" cy="50" r="46" />
        <circle
          className="p-dial__fill"
          cx="50"
          cy="50"
          r="46"
          stroke="url(#p-grad)"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="p-dial__inner">
        <span className="num p-dial__time">{fmtMmss(remainSec)}</span>
        <span className="p-dial__mode">{meta.label}</span>
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
        {(Object.keys(MODE_META) as PomodoroMode[]).map((m) => (
          <button
            key={m}
            className={`p-mode${m === p.mode ? ' is-active' : ''}`}
            onClick={() => p.switchMode(m)}
          >
            {MODE_META[m].label}
            <span className="num p-mode__min">{p.durations[m]}min</span>
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
        <span>调整{meta.label}时长</span>
        <button className="p-icon-btn" onClick={(e) => adjustDur(e, -5)} disabled={running}>
          <Minus size={13} />
        </button>
        <span className="num p-adjust__val">{p.durations[p.mode]} min</span>
        <button className="p-icon-btn" onClick={(e) => adjustDur(e, 5)} disabled={running}>
          <Plus size={13} />
        </button>
      </div>

      <div className="p-stats">
        <div className="p-dots" title={`今日完成 ${doneCount} 个番茄`}>
          {Array.from({ length: Math.max(doneCount, 1) }, (_, i) => (
            <i key={i} className={i < doneCount ? 'is-done' : ''} />
          ))}
          <span className="num">{doneCount > 0 ? `${doneCount} 番茄` : '今日还没有番茄'}</span>
        </div>
        {doneCount >= 4 && <Tag tone="success">已达成 {Math.floor(doneCount / 4)} 轮</Tag>}
      </div>
    </div>
  )
}
