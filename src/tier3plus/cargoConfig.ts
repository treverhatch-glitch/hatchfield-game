/**
 * Cargo hub II and the cold store. Cost, upkeep and build days for the hub come from
 * src/content/buildings_tier3.ts. The night-wave effects live in src/tier3/config.ts.
 */
export const COLD_STORE = {
  fieldLevel: 8,
  cost: 380_000,
  dailyUpkeep: 5_200,
  buildDays: 10,
  /** Chilled rooms each store counts as. Diplomacy asks for one. */
  rooms: 2,
  purpose: 'Chilled rooms that lift every night freighter wave',
  catch: 'Needs the night hub, power and crew; the rooms cost money even on a quiet night',
} as const

/** Late ids that extend the night hub and need one on the field. */
export const NEEDS_NIGHT_HUB: ReadonlySet<string> = new Set(['cargo_hub_ii', 'cold_store'])
