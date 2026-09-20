import { invoke } from '../../lib/bridge'
import type { AirQuality, GeoPlace, WeatherData } from './model'

export function geocode(city: string): Promise<GeoPlace[]> {
  return invoke<GeoPlace[]>('weather_geocode', { city })
}

export function forecast(latitude: number, longitude: number): Promise<WeatherData> {
  return invoke<WeatherData>('weather_forecast', { latitude, longitude })
}

export function airQuality(latitude: number, longitude: number): Promise<AirQuality> {
  return invoke<AirQuality>('weather_air_quality', { latitude, longitude })
}

export function ipLocate(): Promise<GeoPlace | null> {
  return invoke<GeoPlace | null>('weather_ip_locate')
}

/** Meteocons 动画 SVG 图标（vite url import） */
import clearDay from '@meteocons/svg/fill/clear-day.svg?url'
import clearNight from '@meteocons/svg/fill/clear-night.svg?url'
import partlyDay from '@meteocons/svg/fill/partly-cloudy-day.svg?url'
import partlyNight from '@meteocons/svg/fill/partly-cloudy-night.svg?url'
import overcastDay from '@meteocons/svg/fill/overcast-day.svg?url'
import overcastNight from '@meteocons/svg/fill/overcast-night.svg?url'
import fogDay from '@meteocons/svg/fill/fog-day.svg?url'
import fogNight from '@meteocons/svg/fill/fog-night.svg?url'
import drizzle from '@meteocons/svg/fill/drizzle.svg?url'
import rain from '@meteocons/svg/fill/rain.svg?url'
import sleet from '@meteocons/svg/fill/sleet.svg?url'
import snow from '@meteocons/svg/fill/snow.svg?url'
import partlyRainDay from '@meteocons/svg/fill/partly-cloudy-day-rain.svg?url'
import partlyRainNight from '@meteocons/svg/fill/partly-cloudy-night-rain.svg?url'
import partlySnowDay from '@meteocons/svg/fill/partly-cloudy-day-snow.svg?url'
import thunderDay from '@meteocons/svg/fill/thunderstorms-day-rain.svg?url'
import thunderNight from '@meteocons/svg/fill/thunderstorms-night-rain.svg?url'
import notAvailable from '@meteocons/svg/fill/not-available.svg?url'

const ICONS: Record<string, string> = {
  'clear-day': clearDay,
  'clear-night': clearNight,
  'partly-cloudy-day': partlyDay,
  'partly-cloudy-night': partlyNight,
  'overcast-day': overcastDay,
  'overcast-night': overcastNight,
  'fog-day': fogDay,
  'fog-night': fogNight,
  drizzle,
  rain,
  sleet,
  snow,
  'partly-cloudy-day-rain': partlyRainDay,
  'partly-cloudy-night-rain': partlyRainNight,
  'partly-cloudy-day-snow': partlySnowDay,
  'thunderstorms-day-rain': thunderDay,
  'thunderstorms-night-rain': thunderNight,
  'not-available': notAvailable,
}

export function weatherIcon(iconKey: string): string {
  return ICONS[iconKey] ?? notAvailable
}
