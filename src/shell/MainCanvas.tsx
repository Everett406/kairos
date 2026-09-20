import { Cpu, Gpu, MemoryStick, Timer, ChevronRight } from 'lucide-react'
import { AreaChart } from '../lib/charts'
import { useMonitor } from '../features/monitor/useMonitor'
import { tempTone, toneColor } from '../features/monitor/model'
import type { Stats } from '../features/monitor/model'
import { useStatsHistory } from '../features/monitor/history'
import { usePomodoro } from '../features/pomodoro/usePomodoro'
import { fmtClock } from '../lib/format'

/**
 * v4 主画布：一屏三区 —— 问候 + 三大指标卡 + 今日时间带（左），
 * 专注环 + 传感器（右）。图表 = 轻平滑 + 真实毛刺（v4 决策 2）。
 */

export type MetricId = 'cpu' | 'gpu' | 'mem'

/** 数值变化时的轻微滚动上浮（200ms，v4 决策 6） */
function Roll({ v }: { v: string }) {
  return (
    <span key={v} className="k-roll num">
      {v}
    </span>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 11) return '上午好'
  if (h < 13) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function dateLine(): string {
  const d = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${week}`
}

function shortName(name: string | null): string {
  if (!name) return '—'
  return name.replace(/(AMD|Intel|Radeon|with|Graphics|w\/|CPU)/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ')
}

function MetricCard({
  id,
  icon: Icon,
  label,
  stats,
  hist,
  color,
  onOpen,
}: {
  id: MetricId
  icon: typeof Cpu
  label: string
  stats: Stats | null
  hist: number[]
  color: string
  onOpen: (id: MetricId) => void
}) {
  const gpu = stats?.gpu
  const cur =
    id === 'cpu'
      ? Math.round(stats?.cpu ?? 0)
      : id === 'gpu'
        ? Math.round(gpu?.util ?? 0)
        : Math.round(stats?.memUsed ?? 0)
  const unit = id === 'mem' ? 'GB' : '%'
  const foot =
    id === 'cpu'
      ? `峰值 ${hist.length ? Math.round(Math.max(...hist)) : 0}% · ${stats?.cpuFreqGhz ? stats.cpuFreqGhz.toFixed(1) + ' GHz' : '—'}`
      : id === 'gpu'
        ? `显存 ${gpu?.memUsed != null ? (gpu.memUsed / 1024).toFixed(1) : '—'} / ${gpu?.memTotal != null ? (gpu.memTotal / 1024).toFixed(1) : '—'} GB`
        : `占用 ${stats ? Math.round((stats.memUsed / Math.max(1, stats.memTotal)) * 100) : 0}% · 共 ${stats ? Math.round(stats.memTotal) : '—'} GB`

  return (
    <section className="k-card kx-metric" data-metric={id} onClick={() => onOpen(id)}>
      <header className="kx-metric__hd">
        <Icon size={14} style={{ color }} />
        <span className="kx-metric__lb">{label}</span>
        <span className="kx-metric__aux">
          {id === 'cpu' ? shortName(stats?.cpuName ?? null) : id === 'gpu' ? shortName(gpu?.name ?? null) : (stats?.memInfo ?? '').split('·')[0] || '—'}
        </span>
      </header>
      <div className="kx-metric__num">
        <Roll v={String(cur)} />
        <small>{unit}</small>
      </div>
      <div className="kx-metric__foot">{foot}</div>
      <div className="kx-metric__chart">
        <AreaChart vals={hist.length > 1 ? hist : [0, 0]} color={color} w={340} h={110} />
      </div>
      <span className="kx-metric__go">
        <ChevronRight size={13} />
      </span>
    </section>
  )
}

/** 今日时间带：番茄钟会话如实落在 24h 轨道上（有会话才显示，不造假数据） */
function TimeBand() {
  const p = usePomodoro()
  const sessions = p.sessions
  const focusMin = sessions.reduce((acc, s) => acc + (s.e - s.s) / 60000, 0)
  const last = sessions.length ? sessions[sessions.length - 1].e : null
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nowPct = (nowMin / 1440) * 100

  return (
    <section className="k-card kx-band">
      <header className="kx-band__hd">
        <span className="kx-band__t">今日时间带</span>
        <span className="kx-band__date">
          TODAY · {dateLine()}
        </span>
        <span className="kx-legend">
          <i style={{ background: 'var(--k-warm)' }} />专注
        </span>
      </header>
      <div className="kx-band__zone">
        <div className="kx-now" style={{ left: `${nowPct}%` }}>
          <span className="kx-now__chip num">{fmtClock(Date.now())}</span>
        </div>
        <div className="kx-track">
          {sessions.map((s, i) => {
            const startM = new Date(s.s).getHours() * 60 + new Date(s.s).getMinutes()
            const lenM = Math.max(2, (s.e - s.s) / 60000)
            return (
              <span
                key={i}
                className="kx-track__seg"
                style={{ left: `${(startM / 1440) * 100}%`, width: `${(lenM / 1440) * 100}%` }}
              />
            )
          })}
        </div>
        <div className="kx-ticks num">
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
        </div>
      </div>
      <footer className="kx-band__stats">
        <div className="st">
          <b className="num">{(focusMin / 60).toFixed(1)} 小时</b>
          <span>今日专注</span>
        </div>
        <div className="st">
          <b className="num">{p.doneCount}</b>
          <span>完成番茄</span>
        </div>
        <div className="st">
          <b className="num">{last ? fmtClock(last) : '—'}</b>
          <span>最近一次专注</span>
        </div>
      </footer>
    </section>
  )
}

function FocusRing({ onEnter }: { onEnter: () => void }) {
  const p = usePomodoro()
  const focusMin = p.sessions.reduce((acc, s) => acc + (s.e - s.s) / 60000, 0)
  const goal = 240
  const pct = Math.min(1, focusMin / goal)
  const R = 54
  const CIRC = 2 * Math.PI * R
  const last = p.sessions.length ? p.sessions[p.sessions.length - 1].e : null

  return (
    <section className="k-card kx-focus">
      <header className="kx-focus__hd">
        <span className="kx-cap">FOCUS · 专注</span>
        <button className="kx-focus__enter" onClick={onEnter}>
          进入专注 <ChevronRight size={12} />
        </button>
      </header>
      <div className="kx-ring">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={R} className="kx-ring__track" />
          <circle
            cx="60"
            cy="60"
            r={R}
            className="kx-ring__fill"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct)}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="kx-ring__val">
          <b className="num">
            {(focusMin / 60).toFixed(1)}<small>h</small>
          </b>
          <span>今日专注</span>
        </div>
      </div>
      <footer className="kx-focus__meta">
        <span>目标 4h</span>
        <span className="num">完成 {p.doneCount} 番茄{last ? ` · ${fmtClock(last)}` : ''}</span>
      </footer>
    </section>
  )
}

function Sensors() {
  const stats = useMonitor()
  const cpuT = tempTone(stats?.cpuTemp ?? null)
  const gpuT = tempTone(stats?.gpu?.temp ?? null)
  const memPct = stats ? Math.round((stats.memUsed / Math.max(1, stats.memTotal)) * 100) : 0
  const disk = stats?.disks[0]
  const diskPct = disk ? Math.round((disk.usedGb / Math.max(1, disk.totalGb)) * 100) : 0

  const rows = [
    { nm: 'CPU 温度', v: stats?.cpuTemp != null ? `${Math.round(stats.cpuTemp)}°` : '—', pct: stats?.cpuTemp != null ? Math.min(100, stats.cpuTemp) : 0, color: toneColor(cpuT), has: stats?.cpuTemp != null },
    { nm: 'GPU 温度', v: stats?.gpu?.temp != null ? `${Math.round(stats.gpu.temp)}°` : '—', pct: stats?.gpu?.temp != null ? Math.min(100, stats.gpu.temp) : 0, color: toneColor(gpuT), has: stats?.gpu?.temp != null },
    { nm: '内存占用', v: `${memPct}%`, pct: memPct, color: 'var(--k-chart-mem)', has: true },
    { nm: 'C 盘空间', v: disk ? `${Math.round(disk.usedGb)}G` : '—', pct: diskPct, color: 'var(--k-text-muted)', has: !!disk },
  ]

  return (
    <section className="k-card kx-sensors">
      <header className="kx-cap">SENSORS · 传感器</header>
      <div className="kx-sensors__rows">
        {rows.map((r) => (
          <div className="kx-srow" key={r.nm}>
            <span className="kx-srow__dot" style={{ background: r.has ? r.color : 'var(--k-text-faint)' }} />
            <span className="kx-srow__nm">{r.nm}</span>
            <span className="kx-srow__rail">
              <i style={{ width: `${r.pct}%`, background: r.color }} />
            </span>
            <b className="kx-srow__v num">{r.v}</b>
          </div>
        ))}
      </div>
      {stats && !stats.elevated && (stats.cpuTemp == null || stats.gpu?.temp == null) && (
        <footer className="kx-sensors__tip">温度 / 风扇需以管理员身份运行获取</footer>
      )}
    </section>
  )
}

export function MainCanvas({
  onOpenMetric,
  onEnterFocus,
  scene,
  onScene,
}: {
  onOpenMetric: (id: MetricId) => void
  onEnterFocus: () => void
  scene: 'daily' | 'focus'
  onScene: (s: 'daily' | 'focus') => void
}) {
  const stats = useMonitor()
  const hist = useStatsHistory()

  return (
    <div className="canvas">
      <div className="canvas__main">
        <div className="kx-greet">
          <div>
            <div className="kx-greet__g">{greeting()}</div>
            <div className="kx-greet__s">
              {dateLine()} · {stats?.elevated ? '管理员模式' : '标准模式'}
            </div>
          </div>
          <div className="kx-seg">
            <button className={scene === 'daily' ? 'on' : ''} onClick={() => onScene('daily')}>
              日常
            </button>
            <button className={scene === 'focus' ? 'on' : ''} onClick={onEnterFocus}>
              <Timer size={12} /> 专注
            </button>
          </div>
        </div>

        <div className="kx-hero">
          <MetricCard id="cpu" icon={Cpu} label="CPU" stats={stats} hist={hist.cpu} color="var(--k-chart-cpu)" onOpen={onOpenMetric} />
          <MetricCard id="gpu" icon={Gpu} label="GPU" stats={stats} hist={hist.gpu} color="var(--k-chart-gpu)" onOpen={onOpenMetric} />
          <MetricCard id="mem" icon={MemoryStick} label="内存" stats={stats} hist={hist.mem} color="var(--k-chart-mem)" onOpen={onOpenMetric} />
        </div>

        <TimeBand />
      </div>

      <div className="canvas__side">
        <FocusRing onEnter={onEnterFocus} />
        <Sensors />
      </div>
    </div>
  )
}
