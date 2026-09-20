import { Activity, CloudSun, ClipboardList, Languages, Music, Timer } from 'lucide-react'
import { Titlebar } from './app/Titlebar'
import { CardGrid } from './app/ModuleCard'
import type { ModuleDef } from './app/ModuleCard'
import WeatherPanel from './features/weather/WeatherPanel'
import MonitorPanel from './features/monitor/MonitorPanel'
import PomodoroPanel from './features/pomodoro/PomodoroPanel'
import ClipboardPanel from './features/clipboard/ClipboardPanel'
import TranslatePanel from './features/translate/TranslatePanel'
import MusicPanel from './features/music/MusicPanel'
import { MusicBadge } from './features/music/MusicPanel'
import { PlayerProvider } from './features/music/player'

const MODULES: ModuleDef[] = [
  { id: 'weather', title: '天气', icon: CloudSun, Panel: WeatherPanel },
  { id: 'monitor', title: '系统', icon: Activity, Panel: MonitorPanel },
  { id: 'pomodoro', title: '番茄钟', icon: Timer, Panel: PomodoroPanel },
  { id: 'music', title: '音乐', icon: Music, Panel: MusicPanel, badge: <MusicBadge /> },
  { id: 'clipboard', title: '剪贴板', icon: ClipboardList, Panel: ClipboardPanel },
  { id: 'translate', title: '翻译', icon: Languages, Panel: TranslatePanel },
]

export default function App() {
  return (
    <PlayerProvider>
      <div className="app">
        <Titlebar />
        <CardGrid mods={MODULES} />
      </div>
    </PlayerProvider>
  )
}
