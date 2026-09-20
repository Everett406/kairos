import { useEffect, useRef, useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Search, Music2, LogOut, Trash2,
} from 'lucide-react'
import { Button } from '../../design/primitives'
import { fmtMmss } from '../../lib/format'
import { qqSearchSongs, coverUrl } from './api'
import type { QqSong } from './api'
import { usePlayer } from './player'
import './music.css'

/** 紧凑卡头的当前播放角标（App.tsx 里作为 badge 传入） */
export function MusicBadge() {
  const { current, playing } = usePlayer()
  if (!current) return null
  return (
    <span className="mu-badge">
      {playing && <i className="mu-badge__dot" />}
      <span className="mu-badge__text">{current.name}</span>
    </span>
  )
}

function Cover({ albumMid, size }: { albumMid: string; size: number }) {
  const [failed, setFailed] = useState(false)
  const url = coverUrl(albumMid)
  if (!url || failed) {
    return (
      <span className="mu-cover mu-cover--ph" style={{ width: size, height: size }}>
        <Music2 size={Math.round(size * 0.4)} />
      </span>
    )
  }
  return (
    <img
      className="mu-cover"
      src={url}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  )
}

/** 播放控制条（expanded 底部固定） */
function Playbar() {
  const { current, playing, position, duration, toggle, seek, next, prev, error } = usePlayer()
  const total = duration || current?.durationSec || 0

  return (
    <div className="mu-playbar">
      <Cover albumMid={current?.albumMid ?? ''} size={40} />
      <div className="mu-playbar__info">
        <span className="mu-playbar__name">{current?.name ?? '未在播放'}</span>
        <span className="mu-playbar__singer">{current?.singer ?? ''}</span>
        {error && <span className="mu-playbar__err" title={error}>{error}</span>}
      </div>
      <div className="mu-playbar__seek">
        <span className="num mu-playbar__time">{fmtMmss(Math.floor(position))}</span>
        <input
          className="mu-range"
          type="range"
          min={0}
          max={Math.max(1, Math.floor(total))}
          value={Math.floor(position)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!current}
        />
        <span className="num mu-playbar__time">{fmtMmss(Math.floor(total))}</span>
      </div>
      <div className="mu-playbar__btns">
        <button className="mu-ctl" onClick={prev} disabled={!current} title="上一首">
          <SkipBack size={15} />
        </button>
        <button className="mu-ctl mu-ctl--main" onClick={toggle} disabled={!current} title={playing ? '暂停' : '播放'}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="mu-ctl" onClick={next} disabled={!current} title="下一首">
          <SkipForward size={15} />
        </button>
      </div>
    </div>
  )
}

/** 歌词面板 */
function LyricsPane() {
  const { lyrics, lyricIndex } = usePlayer()
  const activeRef = useRef<HTMLParagraphElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [lyricIndex])

  if (!lyrics) {
    return <div className="mu-lyrics mu-lyrics--hint">歌词加载中…</div>
  }
  if (!lyrics.found) {
    return <div className="mu-lyrics mu-lyrics--hint">{lyrics.instrumental ? '纯音乐 · 无歌词' : '没有找到歌词'}</div>
  }
  if (!lyrics.synced && lyrics.plain != null) {
    return (
      <div className="mu-lyrics k-scroll">
        {lyrics.plain.split('\n').map((l, i) => (
          <p key={i} className="mu-lyrics__line">{l}</p>
        ))}
      </div>
    )
  }
  return (
    <div className="mu-lyrics k-scroll">
      {lyrics.lines.map((l, i) => (
        <p
          key={i}
          className={`mu-lyrics__line${i === lyricIndex ? ' is-active' : ''}`}
          ref={i === lyricIndex ? activeRef : undefined}
        >
          {l.text || '· · ·'}
        </p>
      ))}
    </div>
  )
}

/** 登录区：贴 cookie 轻量登录 */
function LoginBar() {
  const { login, saveLogin, logout } = usePlayer()
  const [open, setOpen] = useState(false)
  const [cookie, setCookie] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const doSave = async () => {
    setBusy(true)
    setErr('')
    try {
      await saveLogin(cookie)
      setOpen(false)
      setCookie('')
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  if (login) {
    return (
      <div className="mu-login mu-login--on">
        <span className="mu-login__uin">QQ {login.uin}</span>
        <button className="mu-login__out" onClick={() => void logout()} title="退出登录">
          <LogOut size={12} /> 退出
        </button>
      </div>
    )
  }
  return (
    <div className="mu-login">
      {!open ? (
        <>
          <span className="mu-login__hint">未登录 · VIP 歌曲需登录后播放</span>
          <button className="mu-login__out" onClick={() => setOpen(true)}>登录</button>
        </>
      ) : (
        <div className="mu-login__form">
          <input
            className="k-field mu-login__input"
            placeholder="粘贴 y.qq.com 的完整 cookie（含 uin 与 qm_keyst）"
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            autoFocus
          />
          <Button size="sm" variant="primary" onClick={() => void doSave()} disabled={busy || !cookie.trim()}>
            {busy ? '解析中…' : '保存'}
          </Button>
          <button className="mu-login__out" onClick={() => setOpen(false)} title="取消">
            <Trash2 size={12} />
          </button>
        </div>
      )}
      {err && <span className="mu-login__err">{err}</span>}
    </div>
  )
}

/** 播放中的小均衡器动画 */
function EqBars({ active = true }: { active?: boolean }) {
  return (
    <span className={`mu-eq${active ? ' is-on' : ''}`}>
      <i /><i /><i />
    </span>
  )
}

export default function MusicPanel({ mode }: { mode: 'compact' | 'expanded' }) {
  const { current, playing, toggle, playSong } = usePlayer()
  const [kw, setKw] = useState('')
  const [list, setList] = useState<QqSong[]>([])
  const [searching, setSearching] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // 防抖搜索
  useEffect(() => {
    const k = kw.trim()
    window.clearTimeout(timer.current)
    if (!k) {
      setList([])
      setSearching(false)
      return
    }
    setSearching(true)
    timer.current = window.setTimeout(() => {
      qqSearchSongs(k)
        .then(setList)
        .catch(() => setList([]))
        .finally(() => setSearching(false))
    }, 400)
    return () => window.clearTimeout(timer.current)
  }, [kw])

  // ---------- 紧凑态 ----------
  if (mode === 'compact') {
    if (!current) {
      return (
        <div className="mu-compact mu-compact--idle">
          <Music2 size={22} />
          <p>展开卡片搜索歌曲</p>
        </div>
      )
    }
    return (
      <div className="mu-compact">
        <div className="mu-compact__main" onClick={() => toggle()} title={playing ? '暂停' : '播放'}>
          <Cover albumMid={current.albumMid} size={48} />
          <div className="mu-compact__info">
            <span className="mu-compact__name">{current.name}</span>
            <span className="mu-compact__singer">{current.singer}</span>
          </div>
          <EqBars active={playing} />
        </div>
      </div>
    )
  }

  // ---------- 展开态：左列表 + 右歌词，底部播放条 ----------
  return (
    <div className="mu-detail">
      <div className="mu-cols">
        <div className="mu-left">
          <LoginBar />
          <div className="mu-search">
            <Search size={14} />
            <input
              className="mu-search__input"
              placeholder="搜索歌曲 / 歌手…"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
            />
            {searching && <span className="mu-search__spin" />}
          </div>
          <div className="mu-list k-scroll">
            {list.length === 0 && !searching && (
              <div className="k-empty">搜索想听的歌，点击播放</div>
            )}
            {list.map((s, i) => {
              const active = current?.songmid === s.songmid
              return (
                <div
                  key={s.songmid}
                  className={`mu-list__row${active ? ' is-active' : ''}`}
                  onClick={() => playSong(s, list)}
                >
                  <span className="mu-list__idx num">{active && playing ? <EqBars /> : i + 1}</span>
                  <span className="mu-list__name" title={s.name}>{s.name}</span>
                  <span className="mu-list__singer" title={s.singer}>{s.singer}</span>
                  <span className="mu-list__dur num">{fmtMmss(Math.floor(s.durationSec))}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mu-right">
          <LyricsPane />
        </div>
      </div>
      <Playbar />
    </div>
  )
}
