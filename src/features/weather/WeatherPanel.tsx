import { useEffect, useRef, useState } from 'react'
import { MapPin, Wind, Droplets, Thermometer, Sun, Sunrise, Sunset, Umbrella } from 'lucide-react'
import { Button, Input } from '../../design/primitives'
import { fmtHoursMin } from '../../lib/format'
import { weatherIcon } from './api'
import { useWeather } from './useWeather'
import { aqiTone, beaufort, clothingAdvice, uvLevel, windDir, wmo } from './model'
import type { GeoPlace } from './model'
import './weather.css'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return '今天'
  if (index === 1) return '明天'
  const [y, m, d] = dateStr.split('-').map(Number)
  return WEEK[new Date(y, m - 1, d).getDay()]
}

function hhmm(iso: string | null): string {
  return iso ? iso.slice(11, 16) : '—'
}

/** 城市选择：输入 → 候选列表 */
function CityPicker({ onPick, onCancel }: { onPick: (p: GeoPlace) => void; onCancel: () => void }) {
  const { search } = useWeather()
  const [kw, setKw] = useState('')
  const [candidates, setCandidates] = useState<GeoPlace[]>([])
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const doSearch = (keyword: string) => {
    setBusy(true)
    search(keyword)
      .then(setCandidates)
      .catch(() => setCandidates([]))
      .finally(() => setBusy(false))
  }

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (!kw.trim()) {
      setCandidates([])
      return
    }
    timer.current = window.setTimeout(() => doSearch(kw), 350)
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw])

  return (
    <div className="w-picker">
      <div className="w-picker__row">
        <Input
          autoFocus
          placeholder="输入城市名，如：上海 / Tokyo"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        />
        <Button size="sm" onClick={onCancel}>
          取消
        </Button>
      </div>
      {busy && <div className="k-empty">搜索中…</div>}
      {!busy && kw.trim() && candidates.length === 0 && <div className="k-empty">没有匹配的城市</div>}
      {candidates.map((p) => (
        <button
          key={`${p.latitude},${p.longitude}`}
          className="w-picker__item"
          onClick={() => onPick(p)}
        >
          <MapPin size={14} />
          <span className="w-picker__name">{p.name}</span>
          <span className="w-picker__meta">
            {[p.admin1, p.country].filter(Boolean).join(' · ')}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function WeatherPanel({ mode }: { mode: 'compact' | 'expanded' }) {
  const { place, data, aqi, status, error, selectPlace } = useWeather()
  const [picking, setPicking] = useState(false)

  if (picking) {
    return (
      <CityPicker
        onPick={(p) => {
          setPicking(false)
          selectPlace(p)
        }}
        onCancel={() => setPicking(false)}
      />
    )
  }

  if (status === 'locating' || status === 'idle') {
    return (
      <div className="w-init">
        <MapPin size={20} />
        <p>{status === 'locating' ? '正在定位…' : '还没有城市'}</p>
        <Button variant="primary" size="sm" onClick={() => setPicking(true)}>
          选择城市
        </Button>
      </div>
    )
  }

  if (!data || !place) {
    return (
      <div className="w-init">
        <p className="k-empty">{status === 'loading' ? '加载中…' : error || '暂无数据'}</p>
        <Button size="sm" onClick={() => setPicking(true)}>
          换个城市
        </Button>
      </div>
    )
  }

  const cur = data.current
  const { desc, icon } = wmo(cur.weatherCode, cur.isDay)
  const today = data.daily[0]
  const next4 = data.daily.slice(1, 5)
  const rainToday = today?.precipProbability ?? null

  const current = (
    <div className="w-current">
      <div className="w-current__main">
        <img className="w-current__icon" src={weatherIcon(icon)} alt="" />
        <div>
          <div className="w-current__temp num">{Math.round(cur.temperature)}°</div>
          <div className="w-current__desc">{desc}</div>
        </div>
      </div>
      <div className="w-current__meta">
        {today && (
          <span className="num">
            高 {Math.round(today.tempMax)}° / 低 {Math.round(today.tempMin)}°
          </span>
        )}
        {rainToday != null && <span className="num">降水 {rainToday}%</span>}
      </div>
    </div>
  )

  const cityBar = (
    <div className="w-city">
      <MapPin size={13} />
      <span>{place.name}</span>
      <button
        className="w-city__btn"
        onClick={(e) => {
          e.stopPropagation()
          setPicking(true)
        }}
        title="切换城市"
      >
        切换
      </button>
    </div>
  )

  if (mode === 'compact') {
    return (
      <div className="w-compact">
        {cityBar}
        {current}
        <div className="w-days">
          {next4.map((d, i) => {
            const { icon: di } = wmo(d.weatherCode, true)
            return (
              <div className="w-days__item" key={d.date}>
                <span className="w-days__label">{dayLabel(d.date, i + 1)}</span>
                <img src={weatherIcon(di)} alt="" />
                <span className="num w-days__temp">
                  {Math.round(d.tempMax)}° <em>/ {Math.round(d.tempMin)}°</em>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ===== 展开态 =====
  const uv = uvLevel(cur.uvIndex)
  const aqiToneCls = aqi ? `k-tag--${aqiTone(aqi.aqi)}` : ''
  const hourly24 = data.hourly
    .filter((h) => new Date(h.time).getTime() >= Date.now() - 3600_000)
    .slice(0, 24)
  const maxRain = Math.max(10, ...hourly24.map((h) => h.precipProbability ?? 0))

  return (
    <div className="w-detail">
      {cityBar}
      {current}

      <div className="w-grid">
        <div className="w-cell">
          <Thermometer size={14} />
          <span>体感</span>
          <b className="num">{Math.round(cur.apparentTemperature)}°</b>
        </div>
        <div className="w-cell">
          <Droplets size={14} />
          <span>湿度</span>
          <b className="num">{cur.humidity}%</b>
        </div>
        <div className="w-cell">
          <Wind size={14} />
          <span>{windDir(cur.windDirection)}</span>
          <b className="num">{beaufort(cur.windGusts ?? cur.windSpeed)}</b>
        </div>
        <div className="w-cell">
          <Sun size={14} />
          <span>紫外线</span>
          <b>{uv ? `${uv.label}${cur.uvIndex != null ? ` · ${Math.round(cur.uvIndex)}` : ''}` : '—'}</b>
        </div>
      </div>

      {today && (
        <div className="w-advice">
          <Umbrella size={14} />
          <span>{clothingAdvice(cur.apparentTemperature, cur.weatherCode)}</span>
        </div>
      )}

      {today?.sunrise && (
        <div className="w-sun">
          <span className="w-sun__item">
            <Sunrise size={14} /> 日出 {hhmm(today.sunrise)}
          </span>
          <span className="w-sun__item">
            <Sunset size={14} /> 日落 {hhmm(today.sunset ?? null)}
          </span>
          {today.daylightDuration != null && (
            <span className="w-sun__item num">昼长 {fmtHoursMin(today.daylightDuration)}</span>
          )}
        </div>
      )}

      {aqi && (
        <div className="w-aqi">
          <div className="w-aqi__head">
            <span>空气质量</span>
            <span className={`k-tag ${aqiToneCls}`}>
              AQI {aqi.aqi} · {aqi.level}
            </span>
          </div>
          <div className="w-aqi__body">
            <span>PM2.5 <b className="num">{Math.round(aqi.pm25)}</b></span>
            <span>PM10 <b className="num">{Math.round(aqi.pm10)}</b></span>
            {aqi.primary && <span>首要污染物 <b>{aqi.primary}</b></span>}
          </div>
        </div>
      )}

      {/* 未来 24h 降水概率 */}
      <section className="w-section">
        <h4>未来 24 小时降水</h4>
        <div className="w-rain24">
          {hourly24.map((h) => {
            const p = h.precipProbability ?? 0
            return (
              <div className="w-rain24__col" key={h.time} title={`${h.time.slice(11, 16)} 降水 ${p}%`}>
                <div className="w-rain24__bar">
                  <i style={{ height: `${(p / maxRain) * 100}%` }} />
                </div>
                <span className="w-rain24__hour">{h.time.slice(11, 13)}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 15 日预报 */}
      <section className="w-section">
        <h4>15 日预报</h4>
        <div className="w-fifteen">
          {data.daily.map((d, i) => {
            const { desc: dd, icon: di } = wmo(d.weatherCode, true)
            return (
              <div className="w-fifteen__row" key={d.date}>
                <span className="w-fifteen__day">{dayLabel(d.date, i)}</span>
                <img src={weatherIcon(di)} alt={dd} title={dd} />
                <span className="w-fifteen__desc">{dd}</span>
                <span className="w-fifteen__pop num">{d.precipProbability != null ? `${d.precipProbability}%` : ''}</span>
                <span className="num w-fifteen__temp">
                  {Math.round(d.tempMin)}° <i><b style={{ width: '34px' }} /></i> {Math.round(d.tempMax)}°
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
