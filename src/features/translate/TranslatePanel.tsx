import { useEffect, useRef, useState } from 'react'
import { Languages, Copy, Check, LoaderCircle } from 'lucide-react'
import { invoke } from '../../lib/bridge'
import { Button, Tag } from '../../design/primitives'
import './translate.css'

interface TranslateResult {
  text: string
  detected: string | null
}

const LANGS: { code: string; label: string }[] = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en', label: '英语' },
  { code: 'ja', label: '日语' },
  { code: 'ko', label: '韩语' },
  { code: 'fr', label: '法语' },
  { code: 'de', label: '德语' },
  { code: 'ru', label: '俄语' },
  { code: 'es', label: '西语' },
]

export default function TranslatePanel({ mode }: { mode: 'compact' | 'expanded' }) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('en')
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const runIdRef = useRef(0)

  const doTranslate = async (text: string, tgt: string) => {
    const runId = ++runIdRef.current
    setBusy(true)
    setError('')
    try {
      let r = await invoke<TranslateResult>('translate_text', { text, target: tgt })
      // 检测语言与目标一致 → 自动换一边重译（en↔zh）
      const det = r.detected?.slice(0, 2) ?? ''
      if (det && det === tgt.slice(0, 2)) {
        const fallback = det === 'zh' ? 'en' : 'zh-CN'
        r = await invoke<TranslateResult>('translate_text', { text, target: fallback })
      }
      if (runId === runIdRef.current) setResult(r)
    } catch (e) {
      if (runId === runIdRef.current) {
        setError(String(e))
        setResult(null)
      }
    } finally {
      if (runId === runIdRef.current) setBusy(false)
    }
  }

  // 防抖自动翻译
  useEffect(() => {
    const text = source.trim()
    if (!text) {
      runIdRef.current++
      setResult(null)
      setError('')
      setBusy(false)
      return
    }
    const t = window.setTimeout(() => void doTranslate(text, target), 600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, target])

  const doCopy = async () => {
    if (!result) return
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    await writeText(result.text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const detectedLabel =
    result?.detected != null
      ? (LANGS.find((l) => l.code.startsWith(result.detected!.slice(0, 2)))?.label ??
        result.detected)
      : null

  return (
    <div className={`t-panel${mode === 'compact' ? ' is-compact' : ''}`}>
      <div className="t-source">
        <textarea
          className="t-area k-field"
          placeholder="输入要翻译的内容，自动出结果…"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="t-toolbar">
        <span className="t-lang">
          <Languages size={13} />
          <select
            className="t-select"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </span>
        <span className="t-status">
          {busy && <LoaderCircle size={13} className="t-spin" />}
          {!busy && detectedLabel && <Tag tone="default">检测到 {detectedLabel}</Tag>}
        </span>
      </div>

      <div className={`t-result${result ? ' is-on' : ''}`}>
        {error ? (
          <p className="t-error">{error}</p>
        ) : result ? (
          <p className="t-text">{result.text}</p>
        ) : (
          <p className="t-placeholder">译文会出现在这里</p>
        )}
        {result && !error && (
          <Button size="sm" variant="ghost" onClick={() => void doCopy()} className="t-copy">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? '已复制' : '复制'}
          </Button>
        )}
      </div>
    </div>
  )
}
