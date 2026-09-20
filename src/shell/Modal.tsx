import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * 共享功能弹窗：功能面板 / 抽屉的「展开完整面板」都落到这里。
 * 克制动效：240ms 缩放淡入（v4 决策 6）。
 */
export function Modal({
  title,
  icon: Icon,
  accent,
  onClose,
  children,
}: {
  title: string
  icon: LucideIcon
  accent?: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="k-modal-dim" onClick={onClose}>
      <section
        className="k-modal k-card"
        data-mod={accent}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <header className="k-modal__head">
          <span className="k-modal__icon">
            <Icon size={16} />
          </span>
          <span className="k-modal__title">{title}</span>
          <span className="k-modal__spacer" />
          <button className="k-icon-btn" onClick={onClose} title="关闭 (Esc)">
            <X size={15} />
          </button>
        </header>
        <div className="k-modal__body">{children}</div>
      </section>
    </div>
  )
}
