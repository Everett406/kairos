import { useEffect, useRef, useState } from 'react'
import {
  Palette, Keyboard, LayoutGrid, Music2, SlidersHorizontal, X, ChevronUp, ChevronDown,
  FolderOpen, AlertCircle, Check,
} from 'lucide-react'
import {
  useSettings, updateSettings, toggleTile, moveTile, TILE_META, ACCENT_META,
} from '../lib/settings'
import type { AccentId, ThemeMode, TileId } from '../lib/settings'
import { invoke } from '../lib/bridge'

/**
 * 设置页：全屏浮层，左导航 + 右内容。
 * 外观（主题/强调色/磨砂浓度）· 热键（全局呼出/剪贴板，点击录制）
 * · 主页磁贴（显隐 + 排序）· 音乐（源切换 + 本地目录）· 通用（开机自启）。
 */

type Section = 'appearance' | 'hotkeys' | 'tiles' | 'music' | 'general'

const NAV: { id: Section; label: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'hotkeys', label: '热键', icon: Keyboard },
  { id: 'tiles', label: '主页磁贴', icon: LayoutGrid },
  { id: 'music', label: '音乐', icon: Music2 },
  { id: 'general', label: '通用', icon: SlidersHorizontal },
]

const ALL_TILES: TileId[] = ['metrics', 'activity', 'focus', 'sensors']

/** 快捷键录制框：点击进入录制，按下组合键即捕获 */
function HotkeyField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [rec, setRec] = useState(false)
  const ref = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!rec) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRec(false)
        return
      }
      const parts: string[] = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      if (e.metaKey) parts.push('Win')
      const k = e.key
      const main = k.length === 1 ? k.toUpperCase() : k
      const norm = main === ' ' ? 'Space' : main
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(k) && parts.length > 0) {
        parts.push(norm)
        setRec(false)
        onCommit(parts.join('+'))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [rec, onCommit])

  useEffect(() => {
    if (rec) ref.current?.focus()
  }, [rec])

  return (
    <button
      ref={ref}
      className={`kx-hkfield${rec ? ' is-rec' : ''}`}
      onClick={() => setRec(true)}
      title="点击后按下新的快捷键"
    >
      {rec ? (
        <span className="kx-hkfield__rec">按下快捷键…（Esc 取消）</span>
      ) : (
        value
          .split('+')
          .map((p) => (
            <kbd key={p}>{p}</kbd>
          ))
      )}
    </button>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="kx-setrow">
      <div className="kx-setrow__text">
        <span className="kx-setrow__label">{label}</span>
        {hint && <span className="kx-setrow__hint">{hint}</span>}
      </div>
      <div className="kx-setrow__ctl">{children}</div>
    </div>
  )
}

export function SettingsScene({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const [sec, setSec] = useState<Section>('appearance')
  const [hkMsg, setHkMsg] = useState('')
  const [hkErr, setHkErr] = useState('')
  const [auto, setAuto] = useState<boolean | null>(null)
  const [autoErr, setAutoErr] = useState('')
  const [pickErr, setPickErr] = useState('')

  useEffect(() => {
    invoke<boolean>('autostart_status')
      .then(setAuto)
      .catch(() => setAuto(null))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.kx-hkfield.is-rec')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const commitHotkeys = (next: { cmd: string; clip: string }) => {
    setHkMsg('')
    setHkErr('')
    invoke('set_hotkeys', { cmd: next.cmd, clip: next.clip })
      .then(() => {
        updateSettings({ hotkeys: next })
        setHkMsg('已生效')
        window.setTimeout(() => setHkMsg(''), 1800)
      })
      .catch((e) => setHkErr(String(e).replace(/^.*?Error：?/, '')))
  }

  const pickDir = () => {
    setPickErr('')
    invoke<string | null>('pick_folder')
      .then((d) => {
        if (d) updateSettings({ musicDir: d })
      })
      .catch((e) => setPickErr(String(e).replace(/^.*?Error：?/, '')))
  }

  const toggleAutostart = () => {
    setAutoErr('')
    const next = !auto
    invoke('autostart_set', { enable: next })
      .then(() => setAuto(next))
      .catch((e) => setAutoErr(String(e).replace(/^.*?Error：?/, '')))
  }

  return (
    <div className="kx-settings" role="dialog" aria-label="设置">
      <aside className="kx-settings__nav">
        <header className="kx-settings__brand">
          <span className="kx-cap">KAIROS · 设置</span>
        </header>
        {NAV.map((n) => (
          <button key={n.id} className={`kx-settings__item${sec === n.id ? ' is-on' : ''}`} onClick={() => setSec(n.id)}>
            <n.icon size={14} />
            {n.label}
          </button>
        ))}
        <footer className="kx-settings__ver num">Kairos v0.4.1</footer>
      </aside>

      <div className="kx-settings__body k-scroll">
        <header className="kx-settings__hd">
          <h3>{NAV.find((n) => n.id === sec)?.label}</h3>
          <button className="k-icon-btn" onClick={onClose} title="关闭 (Esc)">
            <X size={16} />
          </button>
        </header>

        {sec === 'appearance' && (
          <div className="kx-setsec">
            <Row label="主题模式" hint="亮色「晨雾」为磨砂白玻璃">
              <div className="kx-segbtns">
                {(['dark', 'light'] as ThemeMode[]).map((m) => (
                  <button key={m} className={s.theme === m ? 'is-on' : ''} onClick={() => updateSettings({ theme: m })}>
                    {m === 'dark' ? '暗色' : '亮色'}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="主题色" hint="按钮、选中态与强调元素">
              <div className="kx-swatches">
                {ACCENT_META.map((a) => (
                  <button
                    key={a.id}
                    className={`kx-swatch${s.accent === a.id ? ' is-on' : ''}`}
                    title={a.label}
                    onClick={() => updateSettings({ accent: a.id as AccentId })}
                  >
                    <i style={{ background: a.swatch }} />
                    {s.accent === a.id && <Check size={11} />}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="磨砂浓度" hint="越高越深邃，越低桌面壁纸越明显">
              <div className="kx-frost">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={s.frost}
                  onChange={(e) => updateSettings({ frost: Number(e.target.value) })}
                />
                <b className="num">{s.frost}</b>
              </div>
            </Row>
          </div>
        )}

        {sec === 'hotkeys' && (
          <div className="kx-setsec">
            <Row label="全局呼出命令条" hint="任何应用下呼出 Kairos 命令条">
              <HotkeyField
                value={s.hotkeys.cmd}
                onCommit={(v) => commitHotkeys({ ...s.hotkeys, cmd: v })}
              />
            </Row>
            <Row label="全局呼出剪贴板" hint="系统 Win+V 之外的自定义呼出">
              <HotkeyField
                value={s.hotkeys.clip}
                onCommit={(v) => commitHotkeys({ ...s.hotkeys, clip: v })}
              />
            </Row>
            {(hkMsg || hkErr) && (
              <div className={`kx-setmsg${hkErr ? ' is-err' : ''}`}>
                {hkErr ? <AlertCircle size={13} /> : <Check size={13} />}
                {hkErr || hkMsg}
              </div>
            )}
            <p className="kx-setnote">快捷键在窗口最小化或失焦时同样生效；若被其他软件占用会注册失败并提示。</p>
          </div>
        )}

        {sec === 'tiles' && (
          <div className="kx-setsec">
            <p className="kx-setnote">勾选显示在主页的磁贴，用箭头调整上下顺序。</p>
            <div className="kx-tilelist">
              {ALL_TILES.map((id) => {
                const idx = s.tiles.indexOf(id)
                const on = idx >= 0
                return (
                  <div className={`kx-tilerow${on ? '' : ' is-off'}`} key={id}>
                    <button className={`kx-check${on ? ' is-on' : ''}`} onClick={() => toggleTile(id)} title={on ? '隐藏' : '显示'}>
                      {on && <Check size={12} />}
                    </button>
                    <div className="kx-tilerow__text">
                      <span>{TILE_META[id].label}</span>
                      <em>{TILE_META[id].desc}</em>
                    </div>
                    <span className="kx-tilerow__ops">
                      <button disabled={!on || idx === 0} onClick={() => moveTile(id, -1)} title="上移">
                        <ChevronUp size={14} />
                      </button>
                      <button disabled={!on || idx === s.tiles.length - 1} onClick={() => moveTile(id, 1)} title="下移">
                        <ChevronDown size={14} />
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {sec === 'music' && (
          <div className="kx-setsec">
            <Row label="音乐源" hint="网易云免费曲库可直接播放；VIP 与扫码登录在 0.4.2 支持">
              <div className="kx-segbtns">
                {(
                  [
                    ['qq', 'QQ 音乐'],
                    ['ne', '网易云'],
                    ['local', '本地'],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} className={s.musicSource === id ? 'is-on' : ''} onClick={() => updateSettings({ musicSource: id })}>
                    {label}
                  </button>
                ))}
              </div>
            </Row>
            {s.musicSource === 'local' && (
              <>
                <Row label="音乐文件夹" hint={s.musicDir || '尚未选择，将扫描其中音频文件（最多 2000 首）'}>
                  <button className="kx-dirbtn" onClick={pickDir}>
                    <FolderOpen size={13} />
                    选择文件夹
                  </button>
                </Row>
                {pickErr && (
                  <div className="kx-setmsg is-err">
                    <AlertCircle size={13} />
                    {pickErr}
                  </div>
                )}
              </>
            )}
            <p className="kx-setnote">QQ 音乐 VIP 需在音乐面板内粘贴 cookie 登录；本地播放支持 mp3 / flac / wav / m4a / ogg。</p>
          </div>
        )}

        {sec === 'general' && (
          <div className="kx-setsec">
            <Row label="开机自启" hint="登录 Windows 后自动在后台启动 Kairos">
              <button
                className={`kx-switch${auto ? ' is-on' : ''}`}
                onClick={toggleAutostart}
                disabled={auto == null}
                role="switch"
                aria-checked={!!auto}
              >
                <i />
              </button>
            </Row>
            {autoErr && (
              <div className="kx-setmsg is-err">
                <AlertCircle size={13} />
                {autoErr}
              </div>
            )}
            <Row label="版本" hint="Everett406/kairos · Quiet Instrument">
              <b className="num kx-setver">v0.4.1</b>
            </Row>
          </div>
        )}
      </div>
    </div>
  )
}
