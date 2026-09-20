import { useMemo, useState } from 'react'
import { Link2, Text as TextIcon, Trash2, Check, Search, Pin, PinOff } from 'lucide-react'
import { Button } from '../../design/primitives'
import { clipboardClear, clipboardPin, clipboardRemove, copyText, relTime, useClipboardItems } from './api'
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

  const doPin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await clipboardPin(item.id)
  }

  return (
    <div className={`c-row${item.pin ? ' is-pinned' : ''}`} onClick={() => void doCopy()} title="点击复制">
      <span className={`c-row__icon${item.kind === 'link' ? ' is-link' : ''}`}>
        {item.kind === 'link' ? <Link2 size={13} /> : <TextIcon size={13} />}
      </span>
      <div className="c-row__body">
        {item.kind === 'link' ? (
          <span className="c-row__link">{item.text}</span>
        ) : (
          <span className="c-row__text">{item.text}</span>
        )}
        <span className="c-row__time num">
          {item.pin ? '置顶 · ' : ''}
          {relTime(item.at)}
        </span>
      </div>
      <span className={`c-row__copied${copied ? ' is-on' : ''}`}>
        <Check size={12} /> 已复制
      </span>
      <button className="c-row__pin" title={item.pin ? '取消置顶' : '置顶'} onClick={(e) => void doPin(e)}>
        {item.pin ? <PinOff size={12} /> : <Pin size={12} />}
      </button>
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
  const [kw, setKw] = useState('')

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase()
    if (!k) return items
    return items.filter((i) => i.text.toLowerCase().includes(k))
  }, [items, kw])

  if (loading) {
    return <div className="c-init">读取剪贴板历史…</div>
  }

  const visible = mode === 'compact' ? filtered.slice(0, 5) : filtered

  return (
    <div className="c-panel">
      {mode === 'expanded' && items.length > 0 && (
        <div className="c-search">
          <Search size={13} />
          <input placeholder="搜索剪贴板历史…" value={kw} onChange={(e) => setKw(e.target.value)} />
        </div>
      )}
      {items.length === 0 ? (
        <div className="k-empty c-empty">复制任意内容后自动出现在这里</div>
      ) : filtered.length === 0 ? (
        <div className="k-empty c-empty">没有匹配「{kw}」的记录</div>
      ) : (
        <>
          <div className="c-list">
            {visible.map((it) => (
              <ClipRow key={it.id} item={it} onCopied={() => bump((n) => n + 1)} />
            ))}
          </div>
          {mode === 'compact' && filtered.length > 5 && (
            <div className="c-more num">还有 {filtered.length - 5} 条，点击卡片查看</div>
          )}
          {mode === 'expanded' && (
            <div className="c-foot" onClick={(e) => e.stopPropagation()}>
              <span className="num">
                {kw ? `${filtered.length} / ${items.length} 条` : `${items.length} 条记录`}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void clipboardClear()}
                title="清空（置顶项保留）"
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
