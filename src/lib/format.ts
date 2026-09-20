/** 展示层格式化工具：时间 / 大小 / 速率 / 时长 */

export function fmtClock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fmtClockSec(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

/** 秒 → 「12 分 28 秒」 */
export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`
}

/** 秒 → 「mm:ss」（超过 1h 进位） */
export function fmtMmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const mm = h > 0 ? `${h}:${String(m).padStart(2, '0')}` : String(m).padStart(2, '0')
  return `${mm}:${String(ss).padStart(2, '0')}`
}

/** 秒 → 「12小时28分」（昼长） */
export function fmtHoursMin(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return `${h}小时${m}分`
}
