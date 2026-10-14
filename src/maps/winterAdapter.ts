import { winterForecast } from './effects'
import type { WinterOpsReading, WinterOpsWeather } from './types'

/**
 * `src/winterops` is optional. Vite only fills this map when the folder
 * exists, so a branch without winter ops never imports it.
 */
interface WinterOpsModule {
  needsDeicing: (weather: WinterOpsWeather) => boolean
  runwayRateFactor: (visibilityM?: number | null, hasCat3?: boolean) => number
}

const winterPacks = import.meta.glob<WinterOpsModule>('../winterops/index.ts', { eager: true })

export function loadedWinterOps(): WinterOpsModule | null {
  for (const mod of Object.values(winterPacks)) {
    if (mod && typeof mod.needsDeicing === 'function' && typeof mod.runwayRateFactor === 'function') return mod
  }
  return null
}

/** Push a snowy-winter sample into winter ops when the module is installed. */
export function feedWinterOps(
  weather: WinterOpsWeather | null,
  mod: WinterOpsModule | null = loadedWinterOps(),
): WinterOpsReading | null {
  if (!weather || !mod) return null
  return {
    tempC: weather.tempC,
    precip: weather.precip,
    visibilityM: weather.visibilityM,
    needsDeicing: mod.needsDeicing(weather),
    runwayRate: mod.runwayRateFactor(weather.visibilityM, false),
  }
}

export { winterForecast }
