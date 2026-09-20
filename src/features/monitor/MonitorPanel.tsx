import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ShieldCheck, Cpu, MemoryStick, HardDrive, Wifi, ListOrdered } from 'lucide-react'
import { Button } from '../../design/primitives'
import { fmtSpeed, fetchProcTop, pctTone, tempTone, toneColor, elevate } from './model'
import type { ProcInfo } from './model'
import { useMonitor } from './useMonitor'
import './monitor.css'

function MemBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const tone = pctTone(pct)
  return (
    <div className="m-bar">
      <i style={{ width: `${pct}%`, background: toneColor(tone) }} />
    </div>
  )
}

/** 每核负载小柱（与抽屉同款可视化） */
function CoreBars({ cores, color }: { cores: number[]; color: string }) {
  const list = cores.length ? cores : [0]
  return (
    <div className="kx-cores kx-cores--sm" title="每核负载（%）">
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

/** 进程 Top：3s 轮询，仅展开态挂载 */
function ProcTop() {
  const [procs, setProcs] = useState<ProcInfo[]>([])
  useEffect(() => {
    let alive = true
    const load = () =>
      fetchProcTop()
        .then((p) => {
          if (alive) setProcs(p)
        })
        .catch(() => {})
    load()
    const t = window.setInterval(load, 3000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  const maxCpu = Math.max(1, ...procs.map((p) => p.cpu))
  return (
    <div className="m-section">
      <h4>
        <ListOrdered size={13} /> 进程占用 Top
      </h4>
      {procs.length === 0 ? (
        <div className="k-empty">读取进程列表…（首次采样后显示 CPU 占用）</div>
      ) : (
        <div className="m-procs">
          {procs.map((p) => (
            <div className="m-proc" key={p.pid}>
              <span className="m-proc__name" title={p.name}>
                {p.name}
              </span>
              <span className="m-proc__bar">
                <i style={{ width: `${Math.max(2, (p.cpu / maxCpu) * 100)}%` }} />
              </span>
              <b className="num m-proc__cpu">{p.cpu.toFixed(1)}%</b>
              <b className="num m-proc__mem">{p.memMb >= 1024 ? `${(p.memMb / 1024).toFixed(1)}G` : `${Math.round(p.memMb)}M`}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MonitorPanel({ mode }: { mode: 'compact' | 'expanded' }) {
  const s = useMonitor()
  const [elevating, setElevating] = useState(false)

  if (!s) {
    return <div className="m-init">读取系统信息…</div>
  }

  const cpuTone = pctTone(s.cpu)
  const memPct = s.memTotal > 0 ? (s.memUsed / s.memTotal) * 100 : 0

  const doElevate = () => {
    setElevating(true)
    elevate().catch(() => setElevating(false))
  }

  const elevateBar = !s.elevated && (
    <div className="m-elevate">
      <ShieldCheck size={14} />
      <span>管理员模式可查看温度、风扇与磁盘详情</span>
      <Button size="sm" variant="ghost" onClick={doElevate} disabled={elevating}>
        {elevating ? '等待授权…' : '启用'}
      </Button>
    </div>
  )

  if (mode === 'compact') {
    return (
      <div className="m-compact">
        <div className="m-hero">
          <span className="m-hero__temp num" style={{ color: toneColor(tempTone(s.cpuTemp)) }}>
            {s.cpuTemp != null ? `${Math.round(s.cpuTemp)}°` : ''}
          </span>
          <div className="m-hero__num k-bignum num">
            {Math.round(s.cpu)}
            <small>%</small>
          </div>
          <span className="m-hero__label">CPU 占用</span>
        </div>
        <div className="m-rows">
          <div className="m-row">
            <span className="m-row__label">内存</span>
            <MemBar used={s.memUsed} total={s.memTotal} />
            <b className="m-row__val num">
              {Math.round(s.memUsed)}/{Math.round(s.memTotal)}G
            </b>
          </div>
          {s.gpu && (
            <div className="m-row">
              <span className="m-row__label">显卡</span>
              <div className="m-bar">
                <i style={{ width: `${s.gpu.util ?? 0}%`, background: 'var(--k-mod)' }} />
              </div>
              <b className="m-row__val num">
                {Math.round(s.gpu.util ?? 0)}%
                {s.gpu.temp != null ? ` · ${Math.round(s.gpu.temp)}°` : ''}
              </b>
            </div>
          )}
          <div className="m-net num">
            <span>
              <ArrowDown size={11} /> {fmtSpeed(s.netDown)}
            </span>
            <span>
              <ArrowUp size={11} /> {fmtSpeed(s.netUp)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ===== 展开态（v0.4.1：每核可视化 + 进程 Top + 磁盘详情） =====
  const gpu = s.gpu

  return (
    <div className="m-detail">
      {s.cpuName && <div className="m-cpu-name">{s.cpuName}{s.cpuFreqGhz != null ? ` · ${s.cpuFreqGhz.toFixed(2)} GHz` : ''}</div>}

      <div className="m-grid">
        <div className="m-cell">
          <div className="m-cell__head">
            <Cpu size={13} /> <span>处理器</span>
            <b className="num" style={{ color: toneColor(cpuTone) }}>{Math.round(s.cpu)}%</b>
          </div>
          <div className="m-bar">
            <i style={{ width: `${s.cpu}%`, background: toneColor(cpuTone) }} />
          </div>
          <div className="m-cell__meta">
            <span className="num" style={{ color: toneColor(tempTone(s.cpuTemp)) }}>
              {s.cpuTemp != null ? `${s.cpuTemp.toFixed(1)}°` : '温度 —'}
            </span>
            {s.fanCpu != null && <span className="num">{Math.round(s.fanCpu)} RPM</span>}
          </div>
          <CoreBars cores={s.cpuCores ?? []} color="var(--k-chart-cpu)" />
        </div>

        <div className="m-cell">
          <div className="m-cell__head">
            <MemoryStick size={13} /> <span>内存</span>
            <b className="num">{Math.round(memPct)}%</b>
          </div>
          <div className="m-bar">
            <i style={{ width: `${memPct}%`, background: toneColor(pctTone(memPct)) }} />
          </div>
          <div className="m-cell__meta">
            <span className="num">{s.memUsed.toFixed(1)} / {s.memTotal.toFixed(1)} GB</span>
            {s.memInfo && <span>{s.memInfo}</span>}
          </div>
        </div>

        <div className="m-cell">
          <div className="m-cell__head">
            <HardDrive size={13} /> <span>显卡</span>
            {gpu ? <b className="num">{Math.round(gpu.util ?? 0)}%</b> : <b className="m-none">N/A</b>}
          </div>
          {gpu ? (
            <>
              <div className="m-bar">
                <i style={{ width: `${gpu.util ?? 0}%`, background: 'var(--k-chart-gpu)' }} />
              </div>
              <div className="m-cell__meta">
                <span className="num" style={{ color: toneColor(tempTone(gpu.temp)) }}>
                  {gpu.temp != null ? `${Math.round(gpu.temp)}°` : ''}
                </span>
                {gpu.memTotal != null && (
                  <span className="num">
                    显存 {Math.round(gpu.memUsed ?? 0)} / {Math.round(gpu.memTotal)} MB
                  </span>
                )}
                {gpu.fan != null && <span className="num">{Math.round(gpu.fan)} RPM</span>}
              </div>
            </>
          ) : (
            <div className="m-cell__meta"><span>未检测到 NVIDIA 显卡</span></div>
          )}
        </div>

        <div className="m-cell">
          <div className="m-cell__head">
            <Wifi size={13} /> <span>网络</span>
          </div>
          <div className="m-net-rows">
            <span className="num"><ArrowDown size={11} /> {fmtSpeed(s.netDown)}</span>
            <span className="num"><ArrowUp size={11} /> {fmtSpeed(s.netUp)}</span>
          </div>
        </div>
      </div>

      <ProcTop />

      {s.disks.length > 0 && (
        <div className="m-section">
          <h4>磁盘</h4>
          {s.disks.map((d) => {
            const pct = d.totalGb > 0 ? (d.usedGb / d.totalGb) * 100 : 0
            const tone = pctTone(pct)
            return (
              <div className="m-disk" key={d.letters || d.model}>
                <div className="m-disk__head">
                  <span className="m-disk__model" title={d.model}>{d.model}</span>
                  <span className="m-disk__letters">{d.letters}</span>
                  <span className="m-disk__busy num">
                    {d.busyPct != null ? `忙碌 ${d.busyPct}%` : ''}
                    {d.temp != null ? ` · ${Math.round(d.temp)}°` : ''}
                  </span>
                </div>
                <div className="m-bar">
                  <i style={{ width: `${pct}%`, background: toneColor(tone) }} />
                </div>
                <div className="m-disk__meta num">
                  {d.usedGb} / {d.totalGb} GB
                  {d.volumes.length > 1 &&
                    ` · ${d.volumes.map((v) => `${v.letter} ${v.usedGb}/${v.totalGb}`).join('　')}`}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {elevateBar}
    </div>
  )
}
