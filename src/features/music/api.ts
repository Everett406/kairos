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

// ===== 网易云（免费曲库直连；扫码登录 0.4.2） =====

export interface NeSong {
  id: number
  name: string
  singer: string
  album: string
  picUrl: string
  durationSec: number
  /** 0 免费 / 1 VIP / 4 需购买 / 8 低音质免费 */
  fee: number
}

export function neSearchSongs(keyword: string): Promise<NeSong[]> {
  return invoke<NeSong[]>('ne_search_songs', { keyword })
}

export function neSongUrl(id: number): Promise<string> {
  return invoke<string>('ne_song_url', { id })
}

export function neLyric(id: number): Promise<LyricsPayload> {
  return invoke<LyricsPayload>('ne_lyric', { id })
}

// ===== 本地音乐 =====

export interface LocalTrack {
  path: string
  name: string
  artist: string
  sizeMb: number
}

export function localMusicScan(dir: string): Promise<LocalTrack[]> {
  return invoke<LocalTrack[]>('local_music_scan', { dir })
}

// ===== 统一播放模型：三种源归一成 Track 给 player =====

export type TrackSource = 'qq' | 'ne' | 'local'

export interface Track {
  source: TrackSource
  /** qq: songmid / ne: 歌曲id / local: 文件路径 */
  id: string
  name: string
  singer: string
  durationSec: number
  /** qq 专辑 mid（封面） */
  albumMid?: string
  /** ne 专辑图（封面） */
  picUrl?: string
  /** 本地文件完整路径 */
  localPath?: string
  /** vip 标记（仅 ne 搜索结果已知） */
  vip?: boolean
}

export function qqToTrack(s: QqSong): Track {
  return { source: 'qq', id: s.songmid, name: s.name, singer: s.singer, durationSec: s.durationSec, albumMid: s.albumMid }
}

export function neToTrack(s: NeSong): Track {
  return {
    source: 'ne',
    id: String(s.id),
    name: s.name,
    singer: s.singer,
    durationSec: s.durationSec,
    picUrl: s.picUrl,
    vip: s.fee === 1 || s.fee === 4,
  }
}

export function localToTrack(t: LocalTrack): Track {
  return { source: 'local', id: t.path, name: t.name, singer: t.artist, durationSec: 0, localPath: t.path }
}

/** 统一封面解析：本地无封面 → QQ 图床 → 网易云 picUrl */
export function trackCover(t: Track | null, size: 300 | 68 = 300): string | null {
  if (!t) return null
  if (t.source === 'ne' && t.picUrl) return t.picUrl
  if (t.source === 'qq') return coverUrl(t.albumMid ?? '', size)
  return null
}
