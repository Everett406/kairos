import { useEffect, useRef, useState } from 'react'
import { MapPin, Wind, Droplets, Thermometer, Sun, Sunrise, Sunset, Umbrella } from 'lucide-react'
import { Button, Input } from '../../design/primitives'
import { fmtHoursMin } from '../../lib/format'
import { AreaChart } from '../../lib/charts'
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
      <img className="w-current__icon" src={weatherIcon(icon)} alt="" />
      <div className="w-current__col">
        <div className="w-current__temp k-bignum num">
          {Math.round(cur.temperature)}
          <i className="w-current__deg">°</i>
        </div>
        <div className="w-current__desc">{desc}</div>
        <div className="w-current__chips">
          {today && <span className="num w-chip">高 {Math.round(today.tempMax)}° 低 {Math.round(today.tempMin)}°</span>}
          {rainToday != null && <span className="num w-chip">降水 {rainToday}%</span>}
        </div>
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

  // ===== 展开态（v0.4.1 重排：hero 两栏 + 24h 温度曲线 + 紧凑 15 日，不再拉长页） =====
  const uv = uvLevel(cur.uvIndex)
  const aqiToneCls = aqi ? `k-tag--${aqiTone(aqi.aqi)}` : ''
  const hourly24 = data.hourly
    .filter((h) => new Date(h.time).getTime() >= Date.now() - 3600_000)
    .slice(0, 24)
  const maxRain = Math.max(10, ...hourly24.map((h) => h.precipProbability ?? 0))
  const tempVals = hourly24.map((h) => h.temperature)

  // 15 日温度范围条：按全期最低/最高定位每条的区间
  const gMin = Math.min(...data.daily.map((d) => d.tempMin))
  const gMax = Math.max(...data.daily.map((d) => d.tempMax))
  const gSpan = Math.max(1, gMax - gMin)

  return (
    <div className="w-detail">
      {cityBar}

      <div className="w-hero">
        {current}
        <div className="w-hero__right">
          {aqi && (
            <div className="w-aqi w-aqi--hero">
              <span className={`k-tag ${aqiToneCls}`}>
                AQI {aqi.aqi} · {aqi.level}
              </span>
              <span className="w-aqi__sub num">
                PM2.5 {Math.round(aqi.pm25)} · PM10 {Math.round(aqi.pm10)}
                {aqi.primary ? ` · 首要 ${aqi.primary}` : ''}
              </span>
            </div>
          )}
          <div className="w-grid w-grid--tight">
            <div className="w-cell">
              <Thermometer size={13} />
              <span>体感</span>
              <b className="num">{Math.round(cur.apparentTemperature)}°</b>
            </div>
            <div className="w-cell">
              <Droplets size={13} />
              <span>湿度</span>
              <b className="num">{cur.humidity}%</b>
            </div>
            <div className="w-cell">
              <Wind size={13} />
              <span>{windDir(cur.windDirection)}</span>
              <b className="num">{beaufort(cur.windGusts ?? cur.windSpeed)}</b>
            </div>
            <div className="w-cell">
              <Sun size={13} />
              <span>紫外线</span>
              <b>{uv ? uv.label : '—'}</b>
            </div>
          </div>
        </div>
      </div>

      {today && (
        <div className="w-meta">
          {today.sunrise && (
            <span className="w-sun__item">
              <Sunrise size={13} /> <span className="num">{hhmm(today.sunrise)}</span>
            </span>
          )}
          {today.sunset && (
            <span className="w-sun__item">
              <Sunset size={13} /> <span className="num">{hhmm(today.sunset)}</span>
            </span>
          )}
          {today.daylightDuration != null && (
            <span className="w-sun__item num">昼长 {fmtHoursMin(today.daylightDuration)}</span>
          )}
          <span className="w-meta__advice">
            <Umbrella size={13} />
            {clothingAdvice(cur.apparentTemperature, cur.weatherCode)}
          </span>
        </div>
      )}

      {/* 未来 24h：温度曲线 + 降水概率 */}
      <section className="w-section">
        <h4>未来 24 小时</h4>
        {tempVals.length > 2 && (
          <div className="w-tempchart">
            <AreaChart vals={tempVals} color="var(--k-chart-cpu)" w={620} h={96} grid />
            <div className="w-tempchart__ticks num">
              <span>{hourly24[0]?.time.slice(11, 16)}</span>
              <span>{hourly24[Math.floor(hourly24.length / 2)]?.time.slice(11, 16)}</span>
              <span>{hourly24[hourly24.length - 1]?.time.slice(11, 16)}</span>
            </div>
          </div>
        )}
        <div className="w-rain24">
          {hourly24.map((h) => {
            const p = h.precipProbability ?? 0
            return (
              <div className="w-rain24__col" key={h.time} title={`${h.time.slice(11, 16)} 降水 ${p}%`}>
                <div className="w-rain24__bar">
                  <i style={{ height: `${(p / maxRain) * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 15 日预报：紧凑行 + 真实温度范围条 */}
      <section className="w-section">
        <h4>15 日预报</h4>
        <div className="w-fifteen">
          {data.daily.map((d, i) => {
            const { desc: dd, icon: di } = wmo(d.weatherCode, true)
            const left = ((d.tempMin - gMin) / gSpan) * 100
            const width = Math.max(6, ((d.tempMax - d.tempMin) / gSpan) * 100)
            return (
              <div className="w-fifteen__row" key={d.date}>
                <span className="w-fifteen__day">{dayLabel(d.date, i)}</span>
                <img src={weatherIcon(di)} alt={dd} title={dd} />
                <span className="w-fifteen__desc">{dd}</span>
                <span className="num w-fifteen__lo">{Math.round(d.tempMin)}°</span>
                <span className="w-fifteen__range">
                  <i style={{ left: `${left}%`, width: `${width}%` }} />
                </span>
                <span className="num w-fifteen__hi">{Math.round(d.tempMax)}°</span>
                <span className="w-fifteen__pop num">{d.precipProbability != null ? `${d.precipProbability}%` : ''}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
