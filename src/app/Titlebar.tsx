import { Minus, X } from 'lucide-react'
import { appWindow } from '../lib/bridge'

/** 无边框窗口自绘标题栏：拖动区 + 窗控 */
export function Titlebar() {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar__brand" data-tauri-drag-region>
        <span className="titlebar__logo" />
        <span className="titlebar__name">Kairos</span>
        <span className="titlebar__sub">桌面助手</span>
      </div>
      <div className="titlebar__actions">
        <button className="k-icon-btn" onClick={appWindow.minimize} title="最小化">
          <Minus size={15} />
        </button>
        <button className="k-icon-btn k-icon-btn--close" onClick={appWindow.close} title="退出 Kairos">
          <X size={15} />
        </button>
      </div>
    </header>
  )
}
