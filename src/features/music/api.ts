import { invoke } from '../../lib/bridge'

export interface QqSong {
  songmid: string
  name: string
  singer: string
  albumMid: string
  durationSec: number
}

/** 注意：Rust 端 QqLogin 未做 camelCase 重命名，字段为 music_key */
export interface QqLogin {
  uin: string
  music_key: string
}

export interface LyricLine {
  time: number
  text: string
}

export interface LyricsPayload {
  found: boolean
  synced: boolean
  instrumental: boolean
  plain: string | null
  lines: LyricLine[]
}

export function qqSearchSongs(keyword: string): Promise<QqSong[]> {
  return invoke<QqSong[]>('qq_search_songs', { keyword })
}

export function qqSongUrl(songmid: string): Promise<string> {
  return invoke<string>('qq_song_url', { songmid })
}

export function fetchLyrics(title: string, artist: string): Promise<LyricsPayload> {
  return invoke<LyricsPayload>('fetch_lyrics', { title, artist })
}

export function qqLoginStatus(): Promise<QqLogin | null> {
  return invoke<QqLogin | null>('qq_login_status')
}

export function qqSaveLogin(cookie: string): Promise<QqLogin> {
  return invoke<QqLogin>('qq_save_login', { cookie })
}

export function qqLogout(): Promise<void> {
  return invoke<void>('qq_logout')
}

/** 专辑封面（QQ 图床） */
export function coverUrl(albumMid: string, size: 300 | 68 = 300): string | null {
  if (!albumMid) return null
  return `https://y.gtimg.cn/music/photo_new/T002R${size}x${size}M000${albumMid}.jpg`
}
