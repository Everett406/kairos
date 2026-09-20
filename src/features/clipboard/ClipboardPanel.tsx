import { useState } from 'react'
import { Link2, Text as TextIcon, Trash2, Check } from 'lucide-react'
import { Button } from '../../design/primitives'
import { clipboardClear, clipboardRemove, copyText, relTime, useClipboardItems } from './api'
import type { ClipItem } from './api'
import './clipboard.css'

function ClipRow({ item, onCopied }: { item: ClipItem; onCopied: () => void }) {
  const [copied, setCopied] = useState(false)

  const doCopy = async () => {
    await copyText(item.text)
    onCopied()
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="c-row" onClick={() => void doCopy()} title="点击复制">
      <span className={`c-row__icon${item.kind === 'link' ? ' is-link' : ''}`}>
        {item.kind === 'link' ? <Link2 size={13} /> : <TextIcon size={13} />}
      </span>
      <div className="c-row__body">
        {item.kind === 'link' ? (
          <span className="c-row__link">{item.text}</span>
        ) : (
          <span className="c-row__text">{item.text}</span>
        )}
        <span className="c-row__time num">{relTime(item.at)}</span>
      </div>
      <span className={`c-row__copied${copied ? ' is-on' : ''}`}>
        <Check size={12} /> 已复制
      </span>
      <button
        className="c-row__del"
        title="删除"
        onClick={(e) => {
          e.stopPropagation()
          void clipboardRemove(item.id)
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export default function ClipboardPanel({ mode }: { mode: 'compact' | 'expanded' }) {
  const { items, loading } = useClipboardItems()
  const [, bump] = useState(0)

  if (loading) {
    return <div className="c-init">读取剪贴板历史…</div>
  }

  const visible = mode === 'compact' ? items.slice(0, 5) : items

  return (
    <div className="c-panel">
      {items.length === 0 ? (
        <div className="k-empty c-empty">复制任意内容后自动出现在这里</div>
      ) : (
        <>
          <div className="c-list">
            {visible.map((it) => (
              <ClipRow key={it.id} item={it} onCopied={() => bump((n) => n + 1)} />
            ))}
          </div>
          {mode === 'compact' && items.length > 5 && (
            <div className="c-more num">还有 {items.length - 5} 条，点击卡片查看</div>
          )}
          {mode === 'expanded' && (
            <div className="c-foot" onClick={(e) => e.stopPropagation()}>
              <span className="num">{items.length} 条记录</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void clipboardClear()}
              >
                <Trash2 size={13} />
                清空
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
