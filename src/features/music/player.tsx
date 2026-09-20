import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchLyrics, neLyric, neSongUrl, qqLoginStatus, qqLogout, qqSaveLogin, qqSongUrl } from './api'
import type { LyricsPayload, QqLogin, Track } from './api'
import { fileSrc } from '../../lib/bridge'

/**
 * 全局音乐播放器（多源统一）：audio 单例挂在这里（App 顶层 Provider），
 * QQ / 网易云 / 本地三种源归一为 Track；面板 compact/expanded 切换不中断播放。
 */

interface PlayerCtx {
  current: Track | null
  playing: boolean
  position: number
  duration: number
  error: string
  queue: Track[]
  login: QqLogin | null
  lyrics: LyricsPayload | null
  lyricIndex: number
  playSong: (song: Track, queue?: Track[]) => void
  playAt: (index: number) => void
  next: () => void
  prev: () => void
  toggle: () => void
  seek: (t: number) => void
  saveLogin: (cookie: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<PlayerCtx | null>(null)

export function usePlayer(): PlayerCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePlayer 必须在 <PlayerProvider> 内使用')
  return v
}

/** 当前播放行索引：time <= position 的最后一行 */
function locateLyric(lines: { time: number }[], pos: number): number {
  let lo = 0
  let hi = lines.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= pos) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'auto'
  }

  const [current, setCurrent] = useState<Track | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')
  const [queue, setQueue] = useState<Track[]>([])
  const [login, setLogin] = useState<QqLogin | null>(null)
  const [lyrics, setLyrics] = useState<LyricsPayload | null>(null)
  const [lyricIndex, setLyricIndex] = useState(-1)

  const queueRef = useRef(queue)
  queueRef.current = queue
  const currentRef = useRef(current)
  currentRef.current = current

  // ---- QQ 登录态（仅 QQ 源消费） ----
  const refreshLogin = useCallback(() => {
    qqLoginStatus()
      .then(setLogin)
      .catch(() => setLogin(null))
  }, [])
  useEffect(refreshLogin, [refreshLogin])

  const saveLogin = useCallback(async (cookie: string) => {
    const l = await qqSaveLogin(cookie)
    setLogin(l)
  }, [])

  const logout = useCallback(async () => {
    await qqLogout()
    setLogin(null)
  }, [])

  // ---- 歌词：随 current 加载（网易云按歌曲 id，其余按歌名检索） ----
  useEffect(() => {
    setLyrics(null)
    setLyricIndex(-1)
    if (!current) return
    let alive = true
    const task = current.source === 'ne' ? neLyric(Number(current.id)) : fetchLyrics(current.name, current.singer)
    task
      .then((p) => {
        if (alive) setLyrics(p)
      })
      .catch(() => {
        if (alive) setLyrics({ found: false, synced: false, instrumental: false, plain: null, lines: [] })
      })
    return () => {
      alive = false
    }
  }, [current])

  // ---- 音频事件绑定 ----
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => {
      setPosition(a.currentTime)
      setLyrics((l) => {
        if (l?.synced && l.lines.length) {
          const idx = locateLyric(l.lines, a.currentTime)
          setLyricIndex(idx)
        }
        return l
      })
    }
    const onMeta = () => setDuration(a.duration || 0)
    const onEnd = () => setPlaying(false)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onErr = () => {
      setPlaying(false)
      setError('音频加载失败')
    }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('ended', onEnd)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('error', onErr)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('error', onErr)
    }
  }, [])

  const loadAndPlay = useCallback(async (song: Track) => {
    const a = audioRef.current
    if (!a) return
    setError('')
    setPosition(0)
    setDuration(song.durationSec || 0)
    try {
      let url = ''
      if (song.source === 'qq') {
        url = await qqSongUrl(song.id)
      } else if (song.source === 'ne') {
        url = await neSongUrl(Number(song.id))
      } else {
        url = fileSrc(song.localPath ?? '')
        if (!url) throw new Error('NO_URL：浏览器预览无法播放本地文件')
      }
      // 用户在等待期间切了歌
      if (currentRef.current?.id !== song.id || currentRef.current?.source !== song.source) return
      a.src = url
      await a.play()
    } catch (e) {
      const msg = String(e)
      setError(
        msg.includes('NO_URL') || msg.includes('VIP') || msg.includes('版权')
          ? msg.replace(/^.*?(NO_URL：)?/, '')
          : '获取音源失败',
      )
      setPlaying(false)
    }
  }, [])

  const playSong = useCallback(
    (song: Track, q?: Track[]) => {
      if (q) setQueue(q)
      setCurrent(song)
      void loadAndPlay(song)
    },
    [loadAndPlay],
  )

  const playAt = useCallback(
    (index: number) => {
      const q = queueRef.current
      if (index < 0 || index >= q.length) return
      playSong(q[index])
    },
    [playSong],
  )

  const step = useCallback(
    (dir: 1 | -1) => {
      const q = queueRef.current
      const cur = currentRef.current
      if (q.length === 0) return
      const idx = cur ? q.findIndex((s) => s.source === cur.source && s.id === cur.id) : -1
      const nextIdx = (idx + dir + q.length) % q.length
      playSong(q[nextIdx])
    },
    [playSong],
  )

  const next = useCallback(() => step(1), [step])
  const prev = useCallback(() => step(-1), [step])

  // 播完自动下一首
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onEnd = () => {
      if (queueRef.current.length > 1) next()
      else setPlaying(false)
    }
    a.addEventListener('ended', onEnd)
    return () => a.removeEventListener('ended', onEnd)
  }, [next])

  const toggle = useCallback(() => {
    const a = audioRef.current
    if (!a || !current) return
    if (a.paused) void a.play().catch(() => setPlaying(false))
    else a.pause()
  }, [current])

  const seek = useCallback((t: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = t
    setPosition(t)
  }, [])

  const value: PlayerCtx = {
    current,
    playing,
    position,
    duration,
    error,
    queue,
    login,
    lyrics,
    lyricIndex,
    playSong,
    playAt,
    next,
    prev,
    toggle,
    seek,
    saveLogin,
    logout,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
