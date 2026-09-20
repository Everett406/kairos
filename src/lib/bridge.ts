/**
 * Kairos 唯一 IPC 桥：invoke / listen / 窗口控制 / 系统通知。
 * 前端所有与 Rust 的通信只允许经过本文件。
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen as tauriListen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'

type Args = Record<string, unknown>

export function invoke<T = unknown>(cmd: string, args?: Args): Promise<T> {
  return tauriInvoke<T>(cmd, args ?? {})
}

export function listen<T = unknown>(event: string, handler: (payload: T) => void): Promise<() => void> {
  return tauriListen<T>(event, (e) => handler(e.payload))
}

export const appWindow = {
  minimize: () => getCurrentWindow().minimize(),
  close: () => getCurrentWindow().close(),
}

export async function notify(title: string, body: string) {
  let granted = await isPermissionGranted()
  if (!granted) {
    const perm = await requestPermission()
    granted = perm === 'granted'
  }
  if (granted) sendNotification({ title, body })
}
