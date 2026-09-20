import { useEffect } from 'react'
import { ArrowLeft, Music, Pause, Play, RotateCcw } from 'lucide-react'
import { usePomodoro, MODE_META } from '../features/pomodoro/usePomodoro'
import type { PomodoroMode } from '../features/pomodoro/usePomodoro'
import { usePlayer } from '../features/music/player'
import { fmtMmss } from '../lib/format'

/**
 * 专注场景（v4 帧四）：全屏只剩极细倒计时 + 琥珀进度线 + 底部控制。
 * 空与静是专注场景最大的功能 —— 计时状态与功能面板共享（不中断）。
 */
export function FocusScene({ onExit }: { onExit: () => void }) {
  const p = usePomodoro()
  const player = usePlayer()
  const endsAt = p.running ? new Date(Date.now() + p.remainSec * 1000) : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  const focusMinToday = p.sessions.reduce((acc, s) => acc + (s.e - s.s) / 60000, 0)
  const progress = p.totalSec > 0 ? 1 - p.remainSec / p.totalSec : 0

  return (
    <div className="kx-fscene">
      <header className="kx-fscene__top">
        <button className="kx-fscene__back" onClick={onExit}>
          <ArrowLeft size={14} /> 返回 <kbd>Esc</kbd>
        </button>
        <span className="kx-fscene__mute">{p.running ? '专注进行中' : '准备就绪'}</span>
      </header>

      <div className="kx-fscene__center">
        <span className="kx-cap">
          FOCUS · {MODE_META[p.mode].label} · 第 {Math.floor(p.doneCount / 4) + 1} 轮
        </span>
        <div className="kx-fscene__timer num">{fmtMmss(p.remainSec)}</div>
        <div className="kx-fscene__line">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="kx-fscene__cap num">
          {endsAt ? `${String(endsAt.getHours()).padStart(2, '0')}:${String(endsAt.getMinutes()).padStart(2, '0')} 结束` : '按 开始 进入专注'}
          {' · '}今日专注 {(focusMinToday / 60).toFixed(1)} 小时
        </span>
      </div>

      <footer className="kx-fscene__bottom">
        <div className="kx-seg">
          {(Object.keys(MODE_META) as PomodoroMode[]).map((m) => (
            <button key={m} className={p.mode === m ? 'on' : ''} onClick={() => p.switchMode(m)}>
              {MODE_META[m].label}
            </button>
          ))}
        </div>
        <div className="kx-fscene__btns">
          <button className="kx-fscene__play" onClick={() => (p.running ? p.pause() : p.start())}>
            {p.running ? <Pause size={17} /> : <Play size={17} />}
            {p.running ? '暂停' : p.remainSec < p.totalSec ? '继续' : '开始'}
          </button>
          <button className="k-icon-btn" onClick={p.reset} title="重置">
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="kx-fscene__music">
          <Music size={12.5} />
          {player.current ? (
            <span>
              {player.current.name} · {player.current.singer}
            </span>
          ) : (
            <span>音乐未播放 · 在命令条或功能面板里选一首</span>
          )}
        </div>
      </footer>
    </div>
  )
}
