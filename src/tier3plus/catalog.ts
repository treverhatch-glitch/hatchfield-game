import type { Tier3PlusBuilding, Tier3PlusId } from './types.ts'

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

const BY_ID = new Map<string, Tier3PlusBuilding>(catalog.map((building) => [building.id, building]))

export function buildingById(id: Tier3PlusId | string): Tier3PlusBuilding | undefined {
  return BY_ID.get(id)
}
