import { Grip, Minus, X, Search } from 'lucide-react'
import { appWindow } from '../lib/bridge'
import { useWeather } from '../features/weather/useWeather'
import { wmo } from '../features/weather/model'
import { weatherIcon } from '../features/weather/api'

/**
 * v4 无边框标题栏：品牌 · 天气 chip · 命令条 chip · 九宫格入口 · 窗控。
 * 天气收进标题栏（v4 决策：低频信息不占画布）。
 */
export function Titlebar({
  onCommand,
  onPanel,
  onWeather,
  panelOpen,
}: {
  onCommand: () => void
  onPanel: () => void
  onWeather: () => void
  panelOpen: boolean
}) {
  const { data } = useWeather()
  const cur = data?.current
  const code = cur ? wmo(cur.weatherCode, cur.isDay) : null

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar__brand" data-tauri-drag-region>
        <span className="titlebar__logo" />
        <span className="titlebar__name">Kairos</span>
      </div>

      <div className="titlebar__mid">
        {cur && code && (
          <button className="titlebar__wx" onClick={onWeather} title={`${code.desc} · 点击查看详情`}>
            <img src={weatherIcon(code.icon)} alt="" />
            <span className="num">{Math.round(cur.temperature)}°</span>
            <em>{code.desc}</em>
          </button>
        )}
      </div>

      <div className="titlebar__actions">
        <button className="k-chip titlebar__cmd" onClick={onCommand} title="全局命令条（任何应用下 Ctrl+Alt+K）">
          <Search size={12.5} />
          <span>命令</span>
          <kbd>Ctrl</kbd>
          <kbd>K</kbd>
        </button>
        <button
          className={`k-icon-btn titlebar__apps${panelOpen ? ' is-on' : ''}`}
          onClick={onPanel}
          title="功能面板：番茄钟 · 音乐 · 剪贴板 · 翻译"
        >
          <Grip size={15} />
        </button>
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
