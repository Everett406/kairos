import { useEffect } from 'react'
import { Activity, Cpu, Fan, Gauge, MemoryStick, Network, Thermometer, X, HardDrive } from 'lucide-react'
import { AreaChart } from '../lib/charts'
import { useMonitor } from '../features/monitor/useMonitor'
import { fmtSpeed } from '../features/monitor/model'
import { useStatsHistory } from '../features/monitor/history'
import type { MetricId } from './MainCanvas'

/**
 * 指标详情抽屉（v0.4.1 加宽 + 可视化增强）：
 * 大曲线（网格 + 峰值）+ 每核负载 / 显存占用条 + 四格读数 + 关键信息行。
 */

const META: Record<MetricId, { cap: string; title: string; color: string }> = {
  cpu: { cap: 'SYSTEM · CPU', title: '处理器', color: 'var(--k-chart-cpu)' },
  gpu: { cap: 'SYSTEM · GPU', title: '显卡', color: 'var(--k-chart-gpu)' },
  mem: { cap: 'SYSTEM · MEMORY', title: '内存', color: 'var(--k-chart-mem)' },
}

function Stat({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: string }) {
  return (
    <div className="kx-stat">
      <span className="kx-stat__lb">
        <Icon size={12} />
        {label}
      </span>
      <b className="kx-stat__v num">{value}</b>
    </div>
  )
}

/** 每核负载小柱：高度 ∝ 占用，超 70% 染警示色 */
function CoreBars({ cores, color }: { cores: number[]; color: string }) {
  const list = cores.length ? cores : [0]
  return (
    <div className="kx-cores" title="每核负载（%）">
      {list.map((v, i) => (
        <span className="kx-cores__col" key={i}>
          <i
            style={{
              height: `${Math.max(6, Math.min(100, v))}%`,
              background: v >= 70 ? 'var(--k-danger)' : v >= 45 ? 'var(--k-warning)' : color,
            }}
          />
          <em className="num">{Math.round(v)}</em>
        </span>
      ))}
    </div>
  )
}

export function Drawer({
  metric,
  onClose,
  onFullDetail,
}: {
  metric: MetricId
  onClose: () => void
  onFullDetail: () => void
}) {
  const stats = useMonitor()
  const hist = useStatsHistory()
  const meta = META[metric]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const gpu = stats?.gpu
  const memPct = stats ? Math.round((stats.memUsed / Math.max(1, stats.memTotal)) * 100) : 0
  const vals = metric === 'cpu' ? hist.cpu : metric === 'gpu' ? hist.gpu : hist.mem
  const peak = vals.length ? Math.max(...vals) : 0
  const isPercent = metric !== 'mem'

  const bigNum =
    metric === 'cpu' ? (
      <>
        {Math.round(stats?.cpu ?? 0)}
        <small>%</small>
      </>
    ) : metric === 'gpu' ? (
      <>
        {Math.round(gpu?.util ?? 0)}
        <small>%</small>
      </>
    ) : (
      <>
        {(stats?.memUsed ?? 0).toFixed(1)}
        <small>GB</small>
      </>
    )

  const side =
    metric === 'cpu'
      ? `${stats?.cpuFreqGhz ? stats.cpuFreqGhz.toFixed(2) + ' GHz' : '—'} · ${stats?.cpuName ? stats.cpuName.split(' ').slice(0, 4).join(' ') : '—'}`
      : metric === 'gpu'
        ? `${gpu?.name ?? '—'}`
        : `共 ${stats ? Math.round(stats.memTotal) : '—'} GB · ${stats?.memInfo ?? '—'}`

  const stat4 =
    metric === 'cpu' ? (
      <>
        <Stat icon={Gauge} label="使用率" value={`${Math.round(stats?.cpu ?? 0)}%`} />
        <Stat icon={Thermometer} label="温度" value={stats?.cpuTemp != null ? `${Math.round(stats.cpuTemp)}°` : '—'} />
        <Stat icon={Activity} label="频率" value={stats?.cpuFreqGhz ? `${stats.cpuFreqGhz.toFixed(1)} GHz` : '—'} />
        <Stat icon={Fan} label="风扇 RPM" value={stats?.fanCpu != null ? stats.fanCpu.toLocaleString() : '—'} />
      </>
    ) : metric === 'gpu' ? (
      <>
        <Stat icon={Gauge} label="利用率" value={`${Math.round(gpu?.util ?? 0)}%`} />
        <Stat icon={Thermometer} label="温度" value={gpu?.temp != null ? `${Math.round(gpu.temp)}°` : '—'} />
        <Stat icon={MemoryStick} label="显存" value={gpu?.memUsed != null ? `${(gpu.memUsed / 1024).toFixed(1)} GB` : '—'} />
        <Stat icon={Activity} label="核心频率" value={gpu?.coreClock != null ? `${gpu.coreClock} MHz` : '—'} />
      </>
    ) : (
      <>
        <Stat icon={MemoryStick} label="已用" value={`${(stats?.memUsed ?? 0).toFixed(1)} GB`} />
        <Stat icon={MemoryStick} label="可用" value={stats ? `${(stats.memTotal - stats.memUsed).toFixed(1)} GB` : '—'} />
        <Stat icon={Gauge} label="占用比" value={`${memPct}%`} />
        <Stat icon={HardDrive} label="内存规格" value={(stats?.memInfo ?? '—').split('·')[0] || '—'} />
      </>
    )

  return (
    <>
      <div className="kx-dim" onClick={onClose} />
      <aside className="kx-drawer k-card" role="dialog" aria-label={`${meta.title}详情`}>
        <header className="kx-drawer__top">
          <span className="kx-cap">{meta.cap}</span>
          <button className="k-icon-btn" onClick={onClose} title="关闭 (Esc)">
            <X size={15} />
          </button>
        </header>
        <h3 className="kx-drawer__title">{meta.title}</h3>
        <div className="kx-drawer__num num">{bigNum}</div>
        <div className="kx-drawer__side">{side}</div>

        <div className="kx-drawer__chart">
          <AreaChart
            vals={vals.length > 1 ? vals : [0, 0]}
            color={meta.color}
            w={540}
            h={170}
            grid
            peakLabel={isPercent ? '峰值' : undefined}
          />
        </div>
        <div className="kx-drawer__xl num">
          <span>实时 · 每 2 秒采样</span>
          <span>{isPercent ? `窗口 ≈ 2 分钟` : `峰值 ${peak.toFixed(1)} GB`}</span>
        </div>

        {metric === 'cpu' && (
          <div className="kx-coreswrap">
            <span className="kx-coreswrap__cap">每核负载</span>
            <CoreBars cores={stats?.cpuCores ?? []} color={meta.color} />
          </div>
        )}

        {metric === 'gpu' && gpu && (
          <div className="kx-meter">
            <div className="kx-meter__hd">
              <span>显存占用</span>
              <b className="num">
                {gpu.memUsed != null ? (gpu.memUsed / 1024).toFixed(1) : '—'} / {gpu.memTotal != null ? (gpu.memTotal / 1024).toFixed(1) : '—'} GB
              </b>
            </div>
            <div className="kx-meter__bar">
              <i
                style={{
                  width: `${gpu.memUsed != null && gpu.memTotal ? Math.min(100, (gpu.memUsed / gpu.memTotal) * 100) : 0}%`,
                  background: meta.color,
                }}
              />
            </div>
          </div>
        )}

        {metric === 'mem' && (
          <div className="kx-meter">
            <div className="kx-meter__hd">
              <span>物理内存</span>
              <b className="num">{memPct}%</b>
            </div>
            <div className="kx-meter__bar">
              <i style={{ width: `${memPct}%`, background: meta.color }} />
            </div>
            {stats?.disks[0] && (
              <div className="kx-meter__hd kx-meter__hd--sub">
                <span>{stats.disks[0].model}</span>
                <b className="num">
                  {stats.disks[0].usedGb} / {stats.disks[0].totalGb} GB
                </b>
              </div>
            )}
            <div className="kx-meter__bar">
              <i
                style={{
                  width: `${stats?.disks[0] ? Math.min(100, (stats.disks[0].usedGb / Math.max(1, stats.disks[0].totalGb)) * 100) : 0}%`,
                  background: 'var(--k-text-muted)',
                }}
              />
            </div>
          </div>
        )}

        <div className="kx-stat4">{stat4}</div>

        {metric === 'cpu' && (
          <div className="kx-drawer__row">
            <Network size={13} />
            <span>网络</span>
            <b className="num">↓ {fmtSpeed(stats?.netDown ?? 0)}</b>
            <b className="num">↑ {fmtSpeed(stats?.netUp ?? 0)}</b>
          </div>
        )}
        {metric === 'gpu' && gpu && (
          <div className="kx-drawer__row">
            <Fan size={13} />
            <span>显存频率 {gpu.memClock ?? '—'} MHz · 风扇 {gpu.fan ?? '—'}%</span>
          </div>
        )}

        <button className="kx-drawer__more" onClick={onFullDetail}>
          <Activity size={13} />
          打开完整系统监控（磁盘 · 网络 · 提权）
        </button>
      </aside>
    </>
  )
}
