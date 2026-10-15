import { PRESTIGE_LANDMARKS, TIER3_BUILDINGS } from '../content/buildings_tier3.ts'
import { COLD_STORE } from './cargoConfig.ts'
import { LANDMARK_RUNWAY_CLEAR_M, LANDMARK_TICKET_USD } from './landmarkConfig.ts'
import type { CargoLateBuilding, LandmarkBuilding, LandmarkId, Tier3PlusBuilding, Tier3PlusId } from './types.ts'

/**
 * Late-game building table (Tier III and Prestige).
 * Field level, sticker price, and daily upkeep are the table values.
 * Hotel room count and night rates are balance seeds: the table prices the
 * building, not the rack rate. $95 matches the field's existing hotel night.
 */
export const catalog: readonly Tier3PlusBuilding[] = [
  {
    id: 'airport_hotel',
    kind: 'hotel',
    name: 'Airport hotel',
    fieldLevel: 7,
    cost: 260_000,
    dailyUpkeep: 5_400,
    buildDays: 0,
    rooms: 120,
    transferNightRate: 95,
    crewNightRate: 70,
    purpose: 'Overnight transfer and crew income',
    catch: 'Empty rooms still cost',
  },
  {
    id: 'rail_link',
    kind: 'rail',
    name: 'Rail link station',
    fieldLevel: 9,
    cost: 600_000,
    dailyUpkeep: 7_000,
    buildDays: 10,
    demandBonus: 0.2,
    purpose: '+20% demand',
    catch: '10-day build',
  },
  {
    id: 'saf_blending',
    kind: 'saf',
    name: 'SAF blending',
    fieldLevel: 8,
    cost: 190_000,
    dailyUpkeep: 4_000,
    buildDays: 0,
    fuelCostMultiplier: 1.08,
    satisfiesGreen: true,
    purpose: 'Satisfies green airline demand',
    catch: 'Fuel cost +8%',
  },
  {
    id: 'spotters_deck',
    kind: 'spotters',
    name: 'Spotters deck',
    fieldLevel: 8,
    cost: 145_000,
    dailyUpkeep: 1_600,
    buildDays: 0,
    dailyIncome: 3_200,
    prestigeItems: 1,
    crowdSize: 18,
    unique: true,
    purpose: 'Daily visitor income and +1 prestige',
    catch: 'One deck per airport; upkeep is paid every day',
  },
]

const landmarks: readonly LandmarkBuilding[] = PRESTIGE_LANDMARKS.map((row) => ({
  id: row.id as LandmarkId,
  kind: 'landmark',
  name: row.name,
  fieldLevel: row.unlockFL,
  cost: row.cost,
  dailyUpkeep: row.upkeepPerDay,
  buildDays: row.buildDays,
  purpose: row.purpose,
  catch: row.catch,
  unlockPrestigeStars: row.unlockPrestigeStars,
  visitorsPerDay: row.effects.touristFootfallPerDay ?? 0,
  ticketUsd: LANDMARK_TICKET_USD[row.id as LandmarkId] ?? 0,
  demandBonus: row.effects.demandBonus ?? 0,
  ratingBonus: row.effects.ratingBonus ?? 0,
  runwayClearM: LANDMARK_RUNWAY_CLEAR_M[row.id as LandmarkId] ?? 0,
}))

const hubRow = TIER3_BUILDINGS.find((row) => row.id === 'cargo_hub_ii')
const cargoLate: readonly CargoLateBuilding[] = [
  ...(hubRow
    ? [
        {
          id: 'cargo_hub_ii',
          kind: 'cargo',
          name: hubRow.name,
          fieldLevel: hubRow.unlockFL,
          cost: hubRow.cost,
          dailyUpkeep: hubRow.upkeepPerDay,
          buildDays: hubRow.buildDays,
          purpose: hubRow.purpose,
          catch: hubRow.catch,
          requiresTech: null,
          coldRooms: 0,
        } satisfies CargoLateBuilding,
      ]
    : []),
  {
    id: 'cold_store',
    kind: 'cargo',
    name: 'Cold store',
    fieldLevel: COLD_STORE.fieldLevel,
    cost: COLD_STORE.cost,
    dailyUpkeep: COLD_STORE.dailyUpkeep,
    buildDays: COLD_STORE.buildDays,
    purpose: COLD_STORE.purpose,
    catch: COLD_STORE.catch,
    requiresTech: COLD_STORE.techId,
    coldRooms: COLD_STORE.rooms,
  },
]

export const landmarkCatalog = landmarks

const BY_ID = new Map<string, Tier3PlusBuilding>(
  [...catalog, ...landmarks, ...cargoLate].map((building) => [building.id, building]),
)

export function buildingById(id: Tier3PlusId | string): Tier3PlusBuilding | undefined {
  return BY_ID.get(id)
}
