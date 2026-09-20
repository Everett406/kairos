import { useCallback, useEffect, useState } from 'react'
import { listen } from './lib/bridge'
import { Titlebar } from './shell/Titlebar'
import { MainCanvas } from './shell/MainCanvas'
import type { MetricId } from './shell/MainCanvas'
import { Drawer } from './shell/Drawer'
import { FeaturePanel } from './shell/FeaturePanel'
import { CommandBar } from './shell/CommandBar'
import { FocusScene } from './shell/FocusScene'
import { Modal } from './shell/Modal'
import { SettingsScene } from './shell/SettingsScene'
import MonitorPanel from './features/monitor/MonitorPanel'
import WeatherPanel from './features/weather/WeatherPanel'
import ClipboardPanel from './features/clipboard/ClipboardPanel'
import { CloudSun, Activity, X } from 'lucide-react'
import { PlayerProvider } from './features/music/player'
import { useSettings } from './lib/settings'
import './shell/shell.css'

/**
 * v0.4.1 外壳：
 * 主画布（仪表 + 活动时间轴）+ 指标抽屉 + 功能面板（九宫格）+ 全局命令条
 * + 专注场景 + 设置页 + 剪贴板全局呼出浮层。
 * 快捷键：热键可自定义（默认 Ctrl+Alt+K 命令条 / Ctrl+Alt+V 剪贴板）。
 */
export default function App() {
  const [metric, setMetric] = useState<MetricId | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [clipPop, setClipPop] = useState(false)
  const [focus, setFocus] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [monitorOpen, setMonitorOpen] = useState(false)
  const [weatherOpen, setWeatherOpen] = useState(false)
  const settings = useSettings()

  // 设置副作用：主题 / 强调色 / 磨砂浓度写到 html 根
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.accent = settings.accent
    root.style.setProperty('--k-frost', String(Math.min(1, Math.max(0, settings.frost / 100))))
  }, [settings.theme, settings.accent, settings.frost])

  // 全局热键（Rust 端注册，转发事件；热键组合可在设置里改）
  useEffect(() => {
    let un: (() => void) | undefined
    let un2: (() => void) | undefined
    listen<void>('global-cmd', () => setCmdOpen((o) => !o)).then((fn) => (un = fn))
    listen<void>('global-clipboard', () => setClipPop((o) => !o)).then((fn) => (un2 = fn))
    return () => {
      un?.()
      un2?.()
    }
  }, [])

  // 应用内 Ctrl+K；Esc 关闭剪贴板浮层
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((o) => !o)
      }
      if (e.key === 'Escape') setClipPop(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const enterFocus = useCallback(() => {
    setPanelOpen(false)
    setCmdOpen(false)
    setFocus(true)
  }, [])

  return (
    <PlayerProvider>
      <div className="app">
        <Titlebar
          onCommand={() => setCmdOpen(true)}
          onPanel={() => setPanelOpen((o) => !o)}
          onWeather={() => setWeatherOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          panelOpen={panelOpen}
        />

        <MainCanvas onOpenMetric={setMetric} onEnterFocus={enterFocus} />

        {metric && (
          <Drawer metric={metric} onClose={() => setMetric(null)} onFullDetail={() => setMonitorOpen(true)} />
        )}
        <FeaturePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
        <CommandBar
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
          onOpenFocus={enterFocus}
          onOpenPanel={() => setPanelOpen(true)}
          onOpenMonitor={() => setMonitorOpen(true)}
        />
        {clipPop && (
          <div className="kx-clipwrap" onClick={() => setClipPop(false)}>
            <div className="kx-clippop k-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="剪贴板历史">
              <header className="kx-clippop__hd">
                <span className="kx-cap">CLIPBOARD · 剪贴板</span>
                <button className="k-icon-btn" onClick={() => setClipPop(false)} title="关闭 (Esc)">
                  <X size={15} />
                </button>
              </header>
              <ClipboardPanel mode="expanded" />
            </div>
          </div>
        )}
        {focus && <FocusScene onExit={() => setFocus(false)} />}
        {settingsOpen && <SettingsScene onClose={() => setSettingsOpen(false)} />}
        {monitorOpen && (
          <Modal title="系统监控" icon={Activity} accent="monitor" onClose={() => setMonitorOpen(false)}>
            <MonitorPanel mode="expanded" />
          </Modal>
        )}
        {weatherOpen && (
          <Modal title="天气" icon={CloudSun} accent="weather" onClose={() => setWeatherOpen(false)}>
            <WeatherPanel mode="expanded" />
          </Modal>
        )}
      </div>
    </PlayerProvider>
  )
}
