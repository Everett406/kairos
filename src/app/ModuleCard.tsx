import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Flip } from 'gsap/Flip'
import gsap from 'gsap'
import type { LucideIcon } from 'lucide-react'
import './app.css'

/**
 * 外壳约定：
 * - 每个模块是一个 Panel 组件，props: { mode: 'compact' | 'expanded' }；
 *   紧凑态渲染卡片摘要，展开态在同一组件里追加/切换详情区。
 * - ModuleCard 负责卡片框架（头/体）与 FLIP 展开-收起动画。
 */

gsap.registerPlugin(Flip)

export interface ModuleDef {
  id: string
  title: string
  icon: LucideIcon
  Panel: (props: { mode: 'compact' | 'expanded' }) => ReactNode
  /** 卡头右侧附加信息（紧凑态），如当前播放 */
  badge?: ReactNode
  /** 卡头右侧操作（展开态），如番茄钟齿轮 */
  headExtra?: ReactNode
}

export function ModuleCard({
  mod,
  expanded,
  onExpand,
  onCollapse,
}: {
  mod: ModuleDef
  expanded: string | null
  onExpand: (id: string) => void
  onCollapse: () => void
}) {
  const isExpanded = expanded === mod.id
  const ref = useRef<HTMLElement | null>(null)
  const flipState = useRef<Flip.FlipState | null>(null)

  const handleExpand = () => {
    if (expanded) return
    const el = ref.current
    if (el) {
      flipState.current = Flip.getState(el)
    }
    onExpand(mod.id)
  }

  const handleCollapse = () => {
    const el = ref.current
    if (el) {
      flipState.current = Flip.getState(el)
    }
    onCollapse()
  }

  useLayoutEffect(() => {
    const el = ref.current
    const state = flipState.current
    if (!el || !state) return
    flipState.current = null
    Flip.from(state, {
      duration: 0.42,
      ease: 'power3.inOut',
      scale: false,
      onComplete: () => gsap.set(el, { clearProps: 'all' }),
    })
  }, [isExpanded])

  // Esc 收起
  useEffect(() => {
    if (!isExpanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCollapse()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded])

  const Icon = mod.icon
  const { Panel } = mod

  return (
    <section
      ref={ref}
      className={`k-card module-card${isExpanded ? ' is-expanded' : ''}`}
      onClick={isExpanded ? undefined : handleExpand}
    >
      <header className="module-card__head">
        {isExpanded ? (
          <button className="module-card__back" onClick={handleCollapse} title="返回 (Esc)">
            ‹ 返回
          </button>
        ) : (
          <span className="module-card__icon">
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
        <span className="module-card__title">{mod.title}</span>
        <span className="module-card__spacer" />
        <span className="module-card__extra">{isExpanded ? mod.headExtra : mod.badge}</span>
      </header>
      <div className="module-card__body">
        {!isExpanded && (
          <div className="module-card__pane">
            <Panel mode="compact" />
          </div>
        )}
        {isExpanded && (
          <div className="module-card__pane module-card__pane--detail k-scroll">
            <Panel mode="expanded" />
          </div>
        )}
      </div>
    </section>
  )
}

export function CardGrid({ mods }: { mods: ModuleDef[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <main className="modules">
      {mods.map((m) => (
        <ModuleCard
          key={m.id}
          mod={m}
          expanded={expanded}
          onExpand={setExpanded}
          onCollapse={() => setExpanded(null)}
        />
      ))}
    </main>
  )
}
