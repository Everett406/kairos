import { useEffect, useRef, useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Search, Music2, LogOut, RefreshCw, FolderOpen, Disc3,
} from 'lucide-react'
import { Button } from '../../design/primitives'
import { fmtMmss } from '../../lib/format'
import {
  localMusicScan, localToTrack, neSearchSongs, neToTrack, qqSearchSongs, qqToTrack, trackCover,
} from './api'
import type { LocalTrack, NeSong, QqSong, Track } from './api'
import { usePlayer } from './player'
import { useSettings } from '../../lib/settings'
import { invoke } from '../../lib/bridge'
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

const SOURCE_LABEL = { qq: 'QQ 音乐', ne: '网易云', local: '本地' } as const

function Cover({ track, size }: { track: Track | null; size: number }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [track?.id, track?.source])
  const url = trackCover(track)
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

/** 播放控制条（expanded 底部固定，v0.4.1 封面加大 + 毛玻璃衬底） */
function Playbar() {
  const { current, playing, position, duration, toggle, seek, next, prev, error } = usePlayer()
  const total = duration || current?.durationSec || 0

  return (
    <div className="mu-playbar">
      <Cover track={current} size={52} />
      <div className="mu-playbar__info">
        <span className="mu-playbar__name">{current?.name ?? '未在播放'}</span>
        <span className="mu-playbar__singer">
          {current ? current.singer || SOURCE_LABEL[current.source] : ''}
        </span>
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
  const { current, lyrics, lyricIndex } = usePlayer()
  const activeRef = useRef<HTMLParagraphElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [lyricIndex])

  if (!current) {
    return <div className="mu-lyrics mu-lyrics--hint">搜索并播放歌曲后，歌词会显示在这里</div>
  }
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

/** QQ 登录区（仅 QQ 源显示） */
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
            <LogOut size={12} />
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

/** 统一列表行模型 */
interface Row {
  track: Track
  album: string
  vip?: boolean
}

export default function MusicPanel({ mode }: { mode: 'compact' | 'expanded' }) {
  const { current, playing, toggle, playSong } = usePlayer()
  const settings = useSettings()
  const source = settings.musicSource
  const [kw, setKw] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [searching, setSearching] = useState(false)
  const [notice, setNotice] = useState('')
  const timer = useRef<number | undefined>(undefined)

  // 本地库：选定目录后全量扫描一次，输入框只做过滤
  const [localTracks, setLocalTracks] = useState<LocalTrack[] | null>(null)

  useEffect(() => {
    setRows([])
    setNotice('')
    setLocalTracks(null)
  }, [source])

  // 目录变化或进入本地源 → 扫描
  useEffect(() => {
    if (source !== 'local' || !settings.musicDir) return
    setSearching(true)
    localMusicScan(settings.musicDir)
      .then((t) => {
        setLocalTracks(t)
        setRows(t.map((x) => ({ track: localToTrack(x), album: '' })))
        if (t.length === 0) setNotice('这个文件夹里没有找到音频文件')
      })
      .catch((e) => setNotice(String(e).replace(/^.*?Error：?/, '')))
      .finally(() => setSearching(false))
  }, [source, settings.musicDir])

  const rescan = () => {
    if (!settings.musicDir) return
    setSearching(true)
    localMusicScan(settings.musicDir)
      .then((t) => {
        setLocalTracks(t)
        setRows(t.map((x) => ({ track: localToTrack(x), album: '' })))
      })
      .catch((e) => setNotice(String(e).replace(/^.*?Error：?/, '')))
      .finally(() => setSearching(false))
  }

  const pickDir = () => {
    invoke<string | null>('pick_folder')
      .then((d) => {
        if (d) {
          setNotice('')
          // settings 变化触发上面的扫描 effect
          void import('../../lib/settings').then(({ updateSettings }) => updateSettings({ musicDir: d }))
        }
      })
      .catch((e) => setNotice(String(e).replace(/^.*?Error：?/, '')))
  }

  // 防抖搜索（qq/ne 在线搜；local 只过滤已扫描列表）
  useEffect(() => {
    const k = kw.trim()
    if (source === 'local') {
      const base = localTracks ?? []
      const filtered = k
        ? base.filter((t) => (t.name + ' ' + t.artist).toLowerCase().includes(k.toLowerCase()))
        : base
      setRows(filtered.map((x) => ({ track: localToTrack(x), album: '' })))
      return
    }
    window.clearTimeout(timer.current)
    if (!k) {
      setRows([])
      setSearching(false)
      return
    }
    setSearching(true)
    timer.current = window.setTimeout(() => {
      const task: Promise<QqSong[] | NeSong[]> = source === 'qq' ? qqSearchSongs(k) : neSearchSongs(k)
      task
        .then((list) => {
          setRows(
            source === 'qq'
              ? (list as QqSong[]).map((s) => ({ track: qqToTrack(s), album: '' }))
              : (list as NeSong[]).map((s) => ({ track: neToTrack(s), album: s.album })),
          )
        })
        .catch((e) => {
          setRows([])
          setNotice(String(e).replace(/^.*?Error：?/, ''))
        })
        .finally(() => setSearching(false))
    }, 400)
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw, source, localTracks])

  // ---------- 紧凑态 ----------
  if (mode === 'compact') {
    if (!current) {
      return (
        <div className="mu-compact mu-compact--idle">
          <div className="mu-disc" aria-hidden>
            <span className="mu-disc__groove" />
            <span className="mu-disc__groove mu-disc__groove--2" />
            <span className="mu-disc__core">
              <Music2 size={22} />
            </span>
          </div>
          <p>展开卡片，搜索想听的歌</p>
        </div>
      )
    }
    return (
      <div className="mu-compact">
        <div className="mu-compact__main" onClick={() => toggle()} title={playing ? '暂停' : '播放'}>
          <Cover track={current} size={48} />
          <div className="mu-compact__info">
            <span className="mu-compact__name">{current.name}</span>
            <span className="mu-compact__singer">{current.singer || SOURCE_LABEL[current.source]}</span>
          </div>
          <EqBars active={playing} />
        </div>
      </div>
    )
  }

  // ---------- 展开态：左列表 + 右歌词，底部播放条 ----------
  const showLogin = source === 'qq'
  const showLocal = source === 'local'

  return (
    <div className="mu-detail">
      <div className="mu-cols">
        <div className="mu-left">
          <div className="mu-sourcebar">
            <span className="mu-source">
              <Disc3 size={13} />
              {SOURCE_LABEL[source]}
            </span>
            {showLogin && <LoginBar />}
            {source === 'ne' && (
              <span className="mu-login__hint">VIP 曲目需扫码登录 · 0.4.2 支持</span>
            )}
            {showLocal && (
              <span className="mu-localbar">
                <span className="mu-login__hint" title={settings.musicDir}>
                  {settings.musicDir || '尚未选择音乐文件夹'}
                </span>
                <button className="mu-login__out" onClick={pickDir} title="选择音乐文件夹（也可在设置里选）">
                  <FolderOpen size={12} /> 选择
                </button>
                <button className="mu-login__out" onClick={rescan} disabled={!settings.musicDir} title="重新扫描">
                  <RefreshCw size={12} />
                </button>
              </span>
            )}
          </div>
          <div className="mu-search">
            <Search size={14} />
            <input
              className="mu-search__input"
              placeholder={showLocal ? '在本地曲库里筛选…' : '搜索歌曲 / 歌手…'}
              value={kw}
              onChange={(e) => setKw(e.target.value)}
            />
            {searching && <span className="mu-search__spin" />}
          </div>
          <div className="mu-list k-scroll">
            {rows.length === 0 && !searching && (
              <div className="k-empty">
                {notice ||
                  (showLocal
                    ? '选择音乐文件夹后自动列出曲目'
                    : '搜索想听的歌，点击播放（免费曲目直接可听）')}
              </div>
            )}
            {rows.map((r, i) => {
              const active = current?.source === r.track.source && current?.id === r.track.id
              return (
                <div
                  key={`${r.track.source}-${r.track.id}`}
                  className={`mu-list__row${active ? ' is-active' : ''}`}
                  onClick={() => playSong(r.track, rows.map((x) => x.track))}
                >
                  <span className="mu-list__idx num">{active && playing ? <EqBars /> : i + 1}</span>
                  <Cover track={r.track} size={30} />
                  <span className="mu-list__name" title={r.track.name}>
                    {r.track.name}
                    {r.vip && <em className="mu-viptag">VIP</em>}
                  </span>
                  <span className="mu-list__singer" title={r.album || r.track.singer}>
                    {r.album || r.track.singer}
                  </span>
                  <span className="mu-list__dur num">{r.track.durationSec ? fmtMmss(Math.floor(r.track.durationSec)) : ''}</span>
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
