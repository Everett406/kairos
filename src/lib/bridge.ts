/**
 * Kairos 唯一 IPC 桥：invoke / listen / 窗口控制 / 系统通知。
 * 前端所有与 Rust 的通信只允许经过本文件。
 */

import { invoke as tauriInvoke, convertFileSrc } from '@tauri-apps/api/core'
import { listen as tauriListen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { mockInvoke, mockListen } from './mock'

/** 是否运行在真实桌面（Tauri WebView）里；浏览器 `pnpm dev` 预览时走 mock */
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

type Args = Record<string, unknown>

export function invoke<T = unknown>(cmd: string, args?: Args): Promise<T> {
  return IS_TAURI ? tauriInvoke<T>(cmd, args ?? {}) : mockInvoke<T>(cmd, args ?? {})
}

export function listen<T = unknown>(event: string, handler: (payload: T) => void): Promise<() => void> {
  return IS_TAURI ? tauriListen<T>(event, (e) => handler(e.payload)) : mockListen<T>(event, handler)
}

export const appWindow = {
  minimize: () => getCurrentWindow().minimize(),
  close: () => getCurrentWindow().close(),
}

/** 本地文件 → WebView 可访问的 asset 协议 URL（浏览器环境返回空串） */
export function fileSrc(path: string): string {
  if (!IS_TAURI || !path) return ''
  return convertFileSrc(path)
}

export async function notify(title: string, body: string) {
  let granted = await isPermissionGranted()
  if (!granted) {
    const perm = await requestPermission()
    granted = perm === 'granted'
  }
  if (granted) sendNotification({ title, body })
}
