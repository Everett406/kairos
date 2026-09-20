import { useState } from 'react'
import { ArrowDown, ArrowUp, ShieldCheck, Cpu, MemoryStick, HardDrive, Wifi } from 'lucide-react'
import { Button } from '../../design/primitives'
import { fmtSpeed, pctTone, tempTone, toneColor, elevate } from './model'
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
        <div className="m-compact__top">
          <span className="m-compact__cpu num">{Math.round(s.cpu)}<small>%</small></span>
          <span className="m-compact__label">CPU</span>
          <span className="m-compact__right num" style={{ color: toneColor(tempTone(s.cpuTemp)) }}>
            {s.cpuTemp != null ? `${Math.round(s.cpuTemp)}°` : ''}
          </span>
        </div>
        <div className="m-compact__mem">
          <MemBar used={s.memUsed} total={s.memTotal} />
          <span className="num m-compact__mem-text">
            内存 {Math.round(s.memUsed)} / {Math.round(s.memTotal)} GB
          </span>
        </div>
        <div className="m-compact__meta">
          {s.gpu && (
            <span className="num">
              GPU {Math.round(s.gpu.util ?? 0)}%
              {s.gpu.temp != null ? ` · ${Math.round(s.gpu.temp)}°` : ''}
            </span>
          )}
          <span className="num m-net">
            <ArrowDown size={11} /> {fmtSpeed(s.netDown)}
            <ArrowUp size={11} /> {fmtSpeed(s.netUp)}
          </span>
        </div>
      </div>
    )
  }

  // ===== 展开态 =====
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
                <i style={{ width: `${gpu.util ?? 0}%` }} />
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
