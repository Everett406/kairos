import { invoke } from '../../lib/bridge'

/** system_stats 命令返回（Rust 端 serde camelCase） */
export interface Volume {
  letter: string
  usedGb: number
  totalGb: number
}

export interface DiskGroup {
  model: string
  letters: string
  sizeGb: number
  usedGb: number
  totalGb: number
  volumes: Volume[]
  busyPct: number | null
  temp: number | null
}

export interface GpuInfo {
  name: string | null
  util: number | null
  temp: number | null
  memUsed: number | null
  memTotal: number | null
  memClock: number | null
  coreClock: number | null
  fan: number | null
}

export interface Stats {
  elevated: boolean
  cpu: number
  /** 每核占用 0-100（抽屉/监控可视化用） */
  cpuCores: number[]
  cpuName: string | null
  cpuFreqGhz: number | null
  cpuTemp: number | null
  fanCpu: number | null
  memUsed: number
  memTotal: number
  memInfo: string | null
  disks: DiskGroup[]
  netDown: number
  netUp: number
  gpu: GpuInfo | null
}

export function fetchStats(): Promise<Stats> {
  return invoke<Stats>('system_stats')
}

/** 管理员重启（UAC 弹窗，成功后当前进程退出） */
export function elevate(): Promise<void> {
  return invoke<void>('system_elevate')
}

export interface ProcInfo {
  name: string
  pid: number
  memMb: number
  cpu: number
}

/** 占用 Top 进程（监控弹窗内 3s 轮询；首次调用 cpu 为 0，属预期） */
export function fetchProcTop(): Promise<ProcInfo[]> {
  return invoke<ProcInfo[]>('process_top')
}

/** 网速文本：<1MB/s 显示 KB/s */
export function fmtSpeed(mbps: number): string {
  if (mbps >= 1024) return `${(mbps / 1024).toFixed(1)} GB/s`
  if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`
  return `${Math.round(mbps * 1024)} KB/s`
}

/** 温度语义 tone：>=80 danger / >=60 warning / 其余正常 */
export function tempTone(t: number | null | undefined): 'danger' | 'warning' | 'ok' | null {
  if (t == null) return null
  if (t >= 80) return 'danger'
  if (t >= 60) return 'warning'
  return 'ok'
}

/** 占用 tone：>=90 danger / >=70 warning */
export function pctTone(p: number): 'danger' | 'warning' | 'ok' {
  if (p >= 90) return 'danger'
  if (p >= 70) return 'warning'
  return 'ok'
}

/** 温度后缀样式变量（供 bar/数字染色） */
export function toneColor(tone: 'danger' | 'warning' | 'ok' | null): string {
  if (tone === 'danger') return 'var(--k-danger)'
  if (tone === 'warning') return 'var(--k-warning)'
  if (tone === 'ok') return 'var(--k-success)'
  return 'var(--k-text-muted)'
}
