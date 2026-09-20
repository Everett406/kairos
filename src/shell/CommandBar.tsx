import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, CornerDownLeft, Languages, ListChecks, MonitorDot, Music, Search, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { invoke } from '../lib/bridge'
import { copyText, clipboardList, relTime } from '../features/clipboard/api'
import type { ClipItem } from '../features/clipboard/api'
import { usePlayer } from '../features/music/player'
import { usePomodoro } from '../features/pomodoro/usePomodoro'

/**
 * 全局命令条（v4 决策 4）：应用内 Ctrl+K / 任何应用下 Ctrl+Alt+K 呼出。
 * 建议操作 + 输入即翻译 + 最近剪贴板，↑↓ 选择、Enter 执行、Esc 关闭。
 */

interface Row {
  key: string
  icon: LucideIcon
  label: string
  kbd?: string
  run: () => void | Promise<void>
}

export function CommandBar({
  open,
  onClose,
  onOpenFocus,
  onOpenPanel,
  onOpenMonitor,
}: {
  open: boolean
  onClose: () => void
  onOpenFocus: () => void
  onOpenPanel: () => void
  onOpenMonitor: () => void
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [clips, setClips] = useState<ClipItem[]>([])
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const player = usePlayer()
  const pomo = usePomodoro()

  useEffect(() => {
    if (!open) return
    setQ('')
    setResult(null)
    setActive(0)
    window.setTimeout(() => inputRef.current?.focus(), 30)
    clipboardList()
      .then((items) => setClips(items.slice(0, 2)))
      .catch(() => setClips([]))
  }, [open])

  const doTranslate = async (text: string) => {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const target = /[\u4e00-\u9fff]/.test(text) ? 'en' : 'zh'
      const r = await invoke<{ text: string }>('translate_text', { text, target })
      setResult(r.text)
    } catch {
      setResult('翻译失败，请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = []
    const kw = q.trim().toLowerCase()
    const match = (s: string) => !kw || s.toLowerCase().includes(kw)

    if (q.trim()) {
      list.push({
        key: 'translate',
        icon: Languages,
        label: `翻译：「${q.trim().slice(0, 24)}${q.trim().length > 24 ? '…' : ''}」`,
        kbd: 'Enter',
        run: () => doTranslate(q.trim()),
      })
    }
    if (match('开始专注 番茄钟'))
      list.push({
        key: 'focus',
        icon: Timer,
        label: '开始专注 · 25 分钟',
        kbd: 'Enter',
        run: () => {
          if (pomo.mode !== 'focus') pomo.switchMode('focus')
          pomo.start()
          onOpenFocus()
          onClose()
        },
      })
    if (match('功能面板 音乐 剪贴板'))
      list.push({
        key: 'panel',
        icon: ListChecks,
        label: '打开功能面板（番茄钟 · 音乐 · 剪贴板 · 翻译）',
        run: () => {
          onOpenPanel()
          onClose()
        },
      })
    if (match('系统 监控 磁盘'))
      list.push({
        key: 'monitor',
        icon: MonitorDot,
        label: '打开系统监控（磁盘 · 网络 · 传感器）',
        run: () => {
          onOpenMonitor()
          onClose()
        },
      })
    if (match('音乐 播放 暂停'))
      list.push({
        key: 'music',
        icon: Music,
        label: player.current
          ? `${player.playing ? '暂停' : '播放'}：${player.current.name}`
          : '播放 / 暂停音乐',
        run: () => {
          player.toggle()
          onClose()
        },
      })
    for (const c of clips) {
      if (!match(c.text)) continue
      list.push({
        key: `clip-${c.id}`,
        icon: ClipboardList,
        label: `复制 ${relTime(c.at)} · ${c.text.slice(0, 30)}${c.text.length > 30 ? '…' : ''}`,
        run: async () => {
          await copyText(c.text)
          onClose()
        },
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, clips, player.current, player.playing, busy])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, rows.length - 1)))
  }, [rows.length])

  if (!open) return null

  const exec = (row: Row | undefined) => {
    if (!row) return
    void row.run()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(rows.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      exec(rows[active])
    }
  }

  return (
    <div className="kx-cmdbar-dim" onClick={onClose}>
      <div className="kx-cmdbar k-card" onClick={(e) => e.stopPropagation()}>
        <div className="kx-cmdbar__in">
          <Search size={16} />
          <input
            ref={inputRef}
            value={q}
            placeholder="打字直达：翻译、开始专注、播放音乐…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="kx-cmdbar__grp">
          <span className="kx-cmdbar__cap">{q.trim() ? '翻译与操作' : '建议操作'}</span>
          {rows.length === 0 && <div className="kx-cmdbar__none">没有匹配的操作</div>}
          {rows.map((r, i) => {
            const Icon = r.icon
            return (
              <button
                key={r.key}
                className={`kx-cmdbar__row${i === active ? ' hot' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => exec(r)}
              >
                <span className="ric">
                  <Icon size={13.5} />
                </span>
                <span className="lbl">{r.label}</span>
                {i === active && <kbd><CornerDownLeft size={10} /> Enter</kbd>}
              </button>
            )
          })}
        </div>

        {result && (
          <div className="kx-cmdbar__grp kx-cmdbar__result">
            <span className="kx-cmdbar__cap">翻译结果</span>
            <p>{result}</p>
            <button
              className="kx-cmdbar__copy"
              onClick={async () => {
                await copyText(result)
                onClose()
              }}
            >
              <ClipboardList size={12} /> 复制结果并关闭
            </button>
          </div>
        )}

        <footer className="kx-cmdbar__ft">
          <span>翻译 · 剪贴板 · 音乐 · 番茄钟都在这里</span>
          <span className="r">
            <kbd>↑</kbd>
            <kbd>↓</kbd> 选择 <kbd>Enter</kbd> 执行 <kbd>Ctrl+Alt+K</kbd> 全局呼出
          </span>
        </footer>
      </div>
    </div>
  )
}
