import { useEffect, useRef, useState } from 'react'
import { ClipboardList, Languages, Maximize2, Music, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import PomodoroPanel from '../features/pomodoro/PomodoroPanel'
import MusicPanel from '../features/music/MusicPanel'
import ClipboardPanel from '../features/clipboard/ClipboardPanel'
import TranslatePanel from '../features/translate/TranslatePanel'
import { Modal } from './Modal'

/**
 * 功能面板：标题栏九宫格呼出（v4 决策 3）。
 * 2×2 迷你卡 = 各模块 compact 态；点击头部的展开按钮 → 完整面板弹窗。
 */

type FeatureId = 'pomodoro' | 'music' | 'clipboard' | 'translate'

const FEATURES: { id: FeatureId; title: string; icon: LucideIcon; Panel: (p: { mode: 'compact' | 'expanded' }) => React.ReactNode }[] = [
  { id: 'pomodoro', title: '番茄钟', icon: Timer, Panel: PomodoroPanel },
  { id: 'music', title: '音乐', icon: Music, Panel: MusicPanel },
  { id: 'clipboard', title: '剪贴板', icon: ClipboardList, Panel: ClipboardPanel },
  { id: 'translate', title: '翻译', icon: Languages, Panel: TranslatePanel },
]

function Mini({
  feat,
  onExpand,
}: {
  feat: (typeof FEATURES)[number]
  onExpand: (id: FeatureId) => void
}) {
  const Icon = feat.icon
  const { Panel } = feat
  return (
    <section className="k-card kx-mini" data-mod={feat.id}>
      <header className="kx-mini__hd">
        <span className="kx-mini__icon">
          <Icon size={14} />
        </span>
        <span className="kx-mini__t">{feat.title}</span>
        <button
          className="kx-mini__more"
          title={`展开${feat.title}`}
          onClick={() => onExpand(feat.id)}
        >
          <Maximize2 size={12.5} />
        </button>
      </header>
      <div className="kx-mini__body" onClick={() => onExpand(feat.id)}>
        <Panel mode="compact" />
      </div>
    </section>
  )
}

export function FeaturePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<FeatureId | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        expanded ? setExpanded(null) : onClose()
      }
    }
    const onDown = (e: MouseEvent) => {
      // 展开弹窗时交给 Modal 自管（点弹窗内部不属于「面板外」）
      if (expanded) return
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    // 延迟一拍挂载，避免呼出按钮自身的 click 冒泡误关
    const t = window.setTimeout(() => window.addEventListener('mousedown', onDown), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.clearTimeout(t)
    }
  }, [open, onClose, expanded])

  if (!open) return null

  const cur = FEATURES.find((f) => f.id === expanded)

  return (
    <>
      <div className="kx-panel" ref={ref}>
        <div className="kx-panel__grid">
          {FEATURES.map((f) => (
            <Mini key={f.id} feat={f} onExpand={setExpanded} />
          ))}
        </div>
        <footer className="kx-panel__ft">翻译 · 剪贴板 · 音乐 · 番茄钟都在这里，点卡片展开完整面板</footer>
      </div>
      {/* Modal 必须挂在面板外：backdrop-filter 会劫持 fixed 定位的包含块 */}
      {cur && (
        <Modal title={cur.title} icon={cur.icon} accent={cur.id} onClose={() => setExpanded(null)}>
          <cur.Panel mode="expanded" />
        </Modal>
      )}
    </>
  )
}
