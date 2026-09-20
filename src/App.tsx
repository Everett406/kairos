import { useCallback, useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { listen } from './lib/bridge'
import { Titlebar } from './shell/Titlebar'
import { MainCanvas } from './shell/MainCanvas'
import type { MetricId } from './shell/MainCanvas'
import { Drawer } from './shell/Drawer'
import { FeaturePanel } from './shell/FeaturePanel'
import { CommandBar } from './shell/CommandBar'
import { FocusScene } from './shell/FocusScene'
import { Modal } from './shell/Modal'
import MonitorPanel from './features/monitor/MonitorPanel'
import WeatherPanel from './features/weather/WeatherPanel'
import { CloudSun } from 'lucide-react'
import { PlayerProvider } from './features/music/player'
import './shell/shell.css'

/**
 * v4「Quiet Instrument」外壳：
 * 主画布（仪表）+ 指标抽屉 + 功能面板（九宫格）+ 全局命令条 + 专注场景。
 * 快捷键：Ctrl+K 命令条；Ctrl+Alt+K 全局（Rust 端注册，回传 global-cmd 事件）。
 */
export default function App() {
  const [metric, setMetric] = useState<MetricId | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [focus, setFocus] = useState(false)
  const [monitorOpen, setMonitorOpen] = useState(false)
  const [weatherOpen, setWeatherOpen] = useState(false)

  // 全局热键：Rust 端 Ctrl+Alt+K → show+focus 窗口 → 转发事件
  useEffect(() => {
    let un: (() => void) | undefined
    listen<void>('global-cmd', () => setCmdOpen((o) => !o)).then((fn) => (un = fn))
    return () => un?.()
  }, [])

  // 应用内 Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((o) => !o)
      }
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
          panelOpen={panelOpen}
        />

        <MainCanvas onOpenMetric={setMetric} onEnterFocus={enterFocus} scene="daily" onScene={() => setFocus(true)} />

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
        {focus && <FocusScene onExit={() => setFocus(false)} />}
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
