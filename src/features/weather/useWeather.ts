import { useCallback, useEffect, useState } from 'react'
import { airQuality, forecast, geocode, ipLocate } from './api'
import type { AirQuality, GeoPlace, WeatherData } from './model'
import { notify } from '../../lib/bridge'

const LS_PLACE = 'kairos.weather.place'
const REFRESH_MS = 30 * 60 * 1000

interface WeatherState {
  place: GeoPlace | null
  data: WeatherData | null
  aqi: AirQuality | null
  status: 'idle' | 'locating' | 'loading' | 'ready' | 'error'
  error: string | null
}

/** 模块级缓存：compact/detail 两个面板实例切换时不重复请求 */
let cache: WeatherState | null = null
const LS_ALERT_KEY = (kind: string) => `kairos.weather.alert.${new Date().toISOString().slice(0, 10)}.${kind}`

function loadPlace(): GeoPlace | null {
  try {
    return JSON.parse(localStorage.getItem(LS_PLACE) || 'null') as GeoPlace
  } catch {
    return null
  }
}

function alertOnce(kind: string, title: string, body: string) {
  const key = LS_ALERT_KEY(kind)
  if (localStorage.getItem(key)) return
  localStorage.setItem(key, '1')
  notify(title, body)
}

/** 预警：带伞 / 降温 / 防晒 / 每日简报（每天各至多一次） */
function checkAlerts(data: WeatherData) {
  const today = data.daily[0]
  const tomorrow = data.daily[1]
  if (!today) return

  // 未来 12h 降水概率峰值
  const now = Date.now()
  const next12 = data.hourly.filter((h) => {
    const t = new Date(h.time).getTime()
    return t >= now && t <= now + 12 * 3600 * 1000
  })
  const rainPeak = Math.max(0, ...next12.map((h) => h.precipProbability ?? 0))
  if (rainPeak >= 60) {
    alertOnce('rain', '记得带伞', `未来 12 小时降水概率最高 ${rainPeak}%`)
  }
  if (today.uvIndexMax != null && today.uvIndexMax >= 8) {
    alertOnce('uv', '紫外线很强', `今天紫外线指数 ${Math.round(today.uvIndexMax)}，注意防晒`)
  }
  if (tomorrow && today.tempMin != null && tomorrow.tempMin != null && today.tempMax != null) {
    if (today.tempMax - tomorrow.tempMax >= 5) {
      alertOnce('cold', '明天降温', `最高温较今天低 ${Math.round(today.tempMax - tomorrow.tempMax)}°C，记得添衣`)
    }
  }
  alertOnce('daily', '今日天气', `${Math.round(today.tempMin)}~${Math.round(today.tempMax)}°C，合理安排出行`)
}

export function useWeather() {
  const [state, setState] = useState<WeatherState>(
    cache ?? { place: loadPlace(), data: null, aqi: null, status: 'idle', error: null },
  )
  const update = (patch: Partial<WeatherState>) =>
    setState((s) => {
      const next = { ...s, ...patch }
      cache = next
      return next
    })

  const load = useCallback(async (place: GeoPlace) => {
    update({ status: 'loading', place, error: null })
    try {
      const [data, aqi] = await Promise.all([
        forecast(place.latitude, place.longitude),
        airQuality(place.latitude, place.longitude).catch(() => null),
      ])
      update({ data, aqi, status: 'ready' })
      checkAlerts(data)
    } catch (e) {
      update({ status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 选定城市 → 持久化 + 加载 */
  const selectPlace = useCallback(
    (place: GeoPlace) => {
      localStorage.setItem(LS_PLACE, JSON.stringify(place))
      void load(place)
    },
    [load],
  )

  /** 首次进入：有记忆城市直接加载，否则 IP 自动定位 */
  useEffect(() => {
    if (cache) return
    const saved = loadPlace()
    if (saved) {
      void load(saved)
      return
    }
    update({ status: 'locating' })
    ipLocate()
      .then((place) => {
        if (place) {
          localStorage.setItem(LS_PLACE, JSON.stringify(place))
          void load(place)
        } else {
          update({ status: 'idle' })
        }
      })
      .catch(() => update({ status: 'idle' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 自动刷新（每 30 分钟，模块存活期间）
  useEffect(() => {
    const t = setInterval(() => {
      const place = cache?.place
      if (place) void load(place)
    }, REFRESH_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const search = useCallback(async (kw: string): Promise<GeoPlace[]> => {
    return geocode(kw)
  }, [])

  return { ...state, selectPlace, search }
}
