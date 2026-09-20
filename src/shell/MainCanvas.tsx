import { useEffect, useState } from 'react'
import { Cpu, Gpu, MemoryStick, ChevronRight } from 'lucide-react'
import { AreaChart } from '../lib/charts'
import { useMonitor } from '../features/monitor/useMonitor'
import { tempTone, toneColor } from '../features/monitor/model'
import type { Stats } from '../features/monitor/model'
import { useStatsHistory } from '../features/monitor/history'
import { usePomodoro } from '../features/pomodoro/usePomodoro'
import { fmtClock } from '../lib/format'
import { useSettings } from '../lib/settings'
import type { TileId } from '../lib/settings'
import { fetchActivity, appColor, appLabel, sumByApp, fmtDuration } from '../features/activity/api'
import type { ActivitySeg } from '../features/activity/api'

/**
 * v0.4.1 主画布：问候行横贯全宽，卡片行分左右两列（顶部对齐指标卡）。
 * 左列 = 三大指标卡 + 今日活动时间轴（应用使用 + 专注记录）；
 * 右列 = 专注环 + 传感器。磁贴显隐由设置驱动。
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

/**
 * 今日活动时间轴：上层 = 前台应用使用段（每 30s 刷新，Rust 端 5s 采样），
 * 下层 = 专注会话（琥珀）。统计行 = 最常用应用 + 专注合计 + 番茄数。
 * 空数据时不造假：显示引导文案。
 */
function ActivityBand() {
  const p = usePomodoro()
  const [segs, setSegs] = useState<ActivitySeg[] | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchActivity()
        .then((s) => {
          if (alive) setSegs(s)
        })
        .catch(() => {})
    load()
    const t = window.setInterval(load, 30_000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  const byApp = segs ? sumByApp(segs) : []
  const top = byApp.slice(0, 3)
  const focusMin = p.sessions.reduce((acc, s) => acc + (s.e - s.s) / 60000, 0)
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nowPct = (nowMin / 1440) * 100

  return (
    <section className="k-card kx-band">
      <header className="kx-band__hd">
        <span className="kx-band__t">今日活动</span>
        <span className="kx-band__date">
          TODAY · {dateLine()}
        </span>
        <span className="kx-legend">
          <i className="kx-legend__apps" />
          应用
          <i style={{ background: 'var(--k-warm)', marginLeft: 10 }} />
          专注
        </span>
      </header>
      <div className="kx-band__zone">
        <div className="kx-now" style={{ left: `${nowPct}%` }}>
          <span className="kx-now__chip num">{fmtClock(Date.now())}</span>
        </div>
        <div className="kx-track kx-track--apps">
          {(segs ?? []).map((s, i) => {
            const startM = new Date(s.start).getHours() * 60 + new Date(s.start).getMinutes()
            const endM = new Date(s.end).getHours() * 60 + new Date(s.end).getMinutes()
            const lenM = Math.max(2, endM - startM)
            return (
              <span
                key={i}
                className="kx-track__app"
                style={{ left: `${(startM / 1440) * 100}%`, width: `${(lenM / 1440) * 100}%`, background: appColor(s.app) }}
                title={`${appLabel(s.app)} · ${fmtClock(s.start)} - ${fmtClock(s.end)}`}
              />
            )
          })}
        </div>
        <div className="kx-track kx-track--focus">
          {p.sessions.map((s, i) => {
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
        <div className="st kx-band__apps">
          <b className="kx-band__apptop">
            {top.length ? (
              <>
                <i style={{ background: appColor(top[0].app) }} />
                {appLabel(top[0].app)}
              </>
            ) : (
              '—'
            )}
          </b>
          <span>{top.length ? `最常用 · ${fmtDuration(top[0].seconds)}` : '使用应用后自动记录在这里'}</span>
        </div>
        <div className="st">
          <b className="num">{top[1] ? appLabel(top[1].app) : '—'}</b>
          <span>{top[1] ? `次常用 · ${fmtDuration(top[1].seconds)}` : '—'}</span>
        </div>
        <div className="st">
          <b className="num">{(focusMin / 60).toFixed(1)} 小时</b>
          <span>今日专注</span>
        </div>
        <div className="st">
          <b className="num">{p.doneCount}</b>
          <span>完成番茄</span>
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

/** 磁贴渲染表：id → 组件 */
function Tile({
  id,
  stats,
  hist,
  onOpenMetric,
  onEnterFocus,
}: {
  id: TileId
  stats: Stats | null
  hist: ReturnType<typeof useStatsHistory>
  onOpenMetric: (id: MetricId) => void
  onEnterFocus: () => void
}) {
  switch (id) {
    case 'metrics':
      return (
        <div className="kx-hero" key="metrics">
          <MetricCard id="cpu" icon={Cpu} label="CPU" stats={stats} hist={hist.cpu} color="var(--k-chart-cpu)" onOpen={onOpenMetric} />
          <MetricCard id="gpu" icon={Gpu} label="GPU" stats={stats} hist={hist.gpu} color="var(--k-chart-gpu)" onOpen={onOpenMetric} />
          <MetricCard id="mem" icon={MemoryStick} label="内存" stats={stats} hist={hist.mem} color="var(--k-chart-mem)" onOpen={onOpenMetric} />
        </div>
      )
    case 'activity':
      return <ActivityBand key="activity" />
    case 'focus':
      return <FocusRing key="focus" onEnter={onEnterFocus} />
    case 'sensors':
      return <Sensors key="sensors" />
  }
}

export function MainCanvas({
  onOpenMetric,
  onEnterFocus,
}: {
  onOpenMetric: (id: MetricId) => void
  onEnterFocus: () => void
}) {
  const stats = useMonitor()
  const hist = useStatsHistory()
  const settings = useSettings()

  const tiles = settings.tiles
  const mainTiles = tiles.filter((t) => t === 'metrics' || t === 'activity')
  const sideTiles = tiles.filter((t) => t === 'focus' || t === 'sensors')
  const empty = mainTiles.length === 0 && sideTiles.length === 0

  return (
    <div className="canvas">
      <div className="kx-greet">
        <div>
          <div className="kx-greet__g">{greeting()}</div>
          <div className="kx-greet__s">
            {dateLine()} · {stats?.elevated ? '管理员模式' : '标准模式'}
          </div>
        </div>
      </div>

      {empty ? (
        <div className="k-card kx-tilesempty">
          所有主页磁贴都关闭了。右键标题栏齿轮 → 设置 → 主页磁贴 可重新打开。
        </div>
      ) : (
        <div className="canvas__cols">
          <div className="canvas__main">
            {mainTiles.map((id) => (
              <Tile key={id} id={id} stats={stats} hist={hist} onOpenMetric={onOpenMetric} onEnterFocus={onEnterFocus} />
            ))}
          </div>
          {sideTiles.length > 0 && (
            <div className="canvas__side">
              {sideTiles.map((id) => (
                <Tile key={id} id={id} stats={stats} hist={hist} onOpenMetric={onOpenMetric} onEnterFocus={onEnterFocus} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
