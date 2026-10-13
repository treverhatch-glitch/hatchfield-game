import type { Tier3RailStation } from './types.ts'

/**
 * Passenger rail from `src/tier3plus`, if that folder is in the build.
 * A missing module is an empty glob, not an error: the city rail tile still counts.
 */
export function readTier3Rail(): Tier3RailStation | null {
  const mods = import.meta.glob('../tier3plus/**/*.{ts,tsx}', { eager: true }) as Record<
    string,
    Record<string, unknown>
  >
  for (const mod of Object.values(mods)) {
    const station = stationFrom(mod)
    if (station?.present) return station
  }
  return null
}

function stationFrom(mod: Record<string, unknown>): Tier3RailStation | null {
  for (const key of ['railStation', 'RAIL_STATION', 'staffRailStation'] as const) {
    const value = mod[key]
    if (isStation(value)) return value
  }
  return null
}

function isStation(value: unknown): value is Tier3RailStation {
  if (!value || typeof value !== 'object') return false
  const row = value as { present?: unknown }
  return typeof row.present === 'boolean'
}
