import { useId } from 'react'

/**
 * v4「Quiet Instrument」图表模块 —— 从视觉稿移植。
 * 轻平滑（Catmull-Rom，除数 9 保留传感器毛刺）+ 面积渐变 + 峰值标注。
 * SVG viewBox 等比拉伸，vector-effect 保证线宽恒定 2px。
 */

export interface Area {
  line: string
  area: string
  end: { x: number; y: number }
  pts: { x: number; y: number }[]
  maxIdx: number
  hi: number
}

/** Catmull-Rom → 贝塞尔；除数越大越接近折线（保留真实毛刺） */
export function smoothLine(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n < 2) return ''
  const d = 9
  let path = `M ${pts[0].x},${pts[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(n - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / d
    const c1y = p1.y + (p2.y - p0.y) / d
    const c2x = p2.x - (p3.x - p1.x) / d
    const c2y = p2.y - (p3.y - p1.y) / d
    path += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return path
}

export function areaShape(vals: number[], w: number, h: number, pad = 5): Area {
  const n = vals.length
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  // 上下各留 14% 边距；数据退化（全相同）时曲线居中而非贴底
  const margin = (hi - lo) * 0.14 || 4
  const lo2 = lo - margin
  const span = hi + margin - lo2
  const pts = vals.map((v, i) => ({
    x: (i / (n - 1)) * w,
    y: pad + (1 - (v - lo2) / span) * (h - pad * 2),
  }))
  const line = smoothLine(pts)
  const maxIdx = vals.indexOf(hi)
  return {
    line,
    area: `${line} L ${w},${h} L 0,${h} Z`,
    end: pts[n - 1],
    pts,
    maxIdx,
    hi,
  }
}

export function AreaChart({
  vals,
  color,
  w = 320,
  h = 96,
  grid = false,
  peakLabel,
}: {
  vals: number[]
  color: string
  w?: number
  h?: number
  /** 两条虚线参考网格 */
  grid?: boolean
  /** 峰值标注文字前缀（如「峰值」），显示峰值圆环 + 数值 */
  peakLabel?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gid = `g${uid}`
  const a = areaShape(vals, w, h)
  const peak = a.pts[a.maxIdx]
  const peakX = Math.min(Math.max(peak.x, 34), w - 34)

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: '100%' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="55%" stopColor={color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid && (
        <g stroke="rgba(255,255,255,0.07)" strokeDasharray="2 5" strokeWidth="1" vectorEffect="non-scaling-stroke">
          <line x1="0" y1={h * 0.3} x2={w} y2={h * 0.3} vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={h * 0.62} x2={w} y2={h * 0.62} vectorEffect="non-scaling-stroke" />
        </g>
      )}
      <path d={a.area} fill={`url(#${gid})`} />
      <path
        d={a.line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* 末端点 + 光晕 */}
      <circle cx={a.end.x} cy={a.end.y} r="6.5" fill={color} opacity="0.18" />
      <circle cx={a.end.x} cy={a.end.y} r="2.6" fill={color} />
      {peakLabel && (
        <g>
          <circle
            cx={peak.x}
            cy={peak.y}
            r="4"
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={peakX}
            y={Math.max(peak.y - 10, 10)}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="600"
            fill="currentColor"
            stroke="rgba(8, 10, 16, 0.85)"
            strokeWidth="3"
            paintOrder="stroke"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {peakLabel} {Math.round(a.hi)}%
          </text>
        </g>
      )}
    </svg>
  )
}
