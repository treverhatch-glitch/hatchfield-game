import type { ConnectivityBuilding, ConnectivityBuildingId, LinkMode } from './types.ts'

/**
 * Late-game hub buildings from the Hatchfield Late-Game Plan (§3 and §5),
 * plus the hall walkway and the skywalk.
 * Minimum connection time is not in this catalog. The hub config publishes
 * 60 / 45 / 25 game-minutes. There is one Transfer Centre, and it lives there.
 * The bus rate, ride, and apron traffic are starting balance values.
 */
export const PEOPLE_MOVER_PAX_PER_HOUR = 3_000
export const PEOPLE_MOVER_RIDE_MINUTES = 4

export const BUS_PAX_PER_HOUR = 800
export const BUS_RIDE_MINUTES = 16
export const BUS_APRON_TRAFFIC_PER_HOUR = 6

/** Wear added on a day when maintenance is below `LINK_MAINT_SAFE`. */
export const LINK_WEAR_PER_DAY = 45
export const LINK_WEAR_BREAK = 100
export const LINK_MAINT_SAFE = 40

/**
 * Standing lost per missed connecting passenger, capped so one bank cannot
 * wipe a carrier. The diplomacy adapter adds the returned number as-is.
 * The live miss bill is the hub penalty. This number is the plain delta only.
 */
export const STANDING_PER_MISSED_PASSENGER = 0.25
export const STANDING_HIT_CAP = 8

export const CONNECTIVITY_CATALOG = {
  people_mover: {
    id: 'people_mover',
    name: 'People mover',
    fieldLevel: 7,
    cost: 420_000,
    upkeepPerDay: 9_600,
    repairCost: 36_000,
    paxPerHour: PEOPLE_MOVER_PAX_PER_HOUR,
    apronTrafficPerHour: 0,
    rideMinutes: PEOPLE_MOVER_RIDE_MINUTES,
    lengthMetres: 0,
    speedMult: 1,
    metresPerMin: 0,
    linksTerminals: true,
    breakdownStrandsGates: true,
    blurb: 'Links terminals at 3,000 passengers per hour.',
    catch: 'A breakdown strands gates.',
  },
  airside_transfer_bus_depot: {
    id: 'airside_transfer_bus_depot',
    name: 'Airside transfer bus depot',
    fieldLevel: 6,
    cost: 90_000,
    upkeepPerDay: 2_600,
    repairCost: 8_000,
    paxPerHour: BUS_PAX_PER_HOUR,
    apronTrafficPerHour: BUS_APRON_TRAFFIC_PER_HOUR,
    rideMinutes: BUS_RIDE_MINUTES,
    lengthMetres: 0,
    speedMult: 1,
    metresPerMin: 0,
    linksTerminals: true,
    breakdownStrandsGates: false,
    blurb: 'A cheap link between terminals.',
    catch: 'Slow; adds apron traffic.',
  },
  moving_walkway: {
    id: 'moving_walkway',
    name: 'Moving walkway',
    fieldLevel: 4,
    cost: 2_400,
    upkeepPerDay: 160,
    repairCost: 0,
    paxPerHour: 0,
    apronTrafficPerHour: 0,
    rideMinutes: 0,
    lengthMetres: 6,
    speedMult: 1.85,
    metresPerMin: 0,
    linksTerminals: false,
    breakdownStrandsGates: false,
    blurb: 'A cheap belt inside the hall. Walking is faster along its length.',
    catch: 'It only helps the stretch it covers.',
  },
  skywalk: {
    id: 'skywalk',
    name: 'Skywalk',
    fieldLevel: 5,
    cost: 54_000,
    upkeepPerDay: 1_200,
    repairCost: 0,
    paxPerHour: 0,
    apronTrafficPerHour: 0,
    rideMinutes: 0,
    lengthMetres: 0,
    speedMult: 1,
    metresPerMin: 140,
    linksTerminals: true,
    breakdownStrandsGates: false,
    blurb: 'A covered bridge between two terminals.',
    catch: 'Slower than a bus, and it only links halls it touches.',
  },
} as const satisfies Record<ConnectivityBuildingId, ConnectivityBuilding>

export const CONNECTIVITY_BUILDINGS: readonly ConnectivityBuilding[] = [
  CONNECTIVITY_CATALOG.moving_walkway,
  CONNECTIVITY_CATALOG.skywalk,
  CONNECTIVITY_CATALOG.airside_transfer_bus_depot,
  CONNECTIVITY_CATALOG.people_mover,
]

/** The depot is the building. The bus is the link it runs. */
export const LINK_BUILDING: Record<LinkMode, ConnectivityBuildingId> = {
  people_mover: 'people_mover',
  airside_transfer_bus: 'airside_transfer_bus_depot',
}

export function buildingById(id: ConnectivityBuildingId): ConnectivityBuilding {
  return CONNECTIVITY_CATALOG[id]
}

export function isUnlocked(id: ConnectivityBuildingId, fieldLevel: number): boolean {
  if (!Number.isFinite(fieldLevel)) return false
  return fieldLevel >= CONNECTIVITY_CATALOG[id].fieldLevel
}

/** Daily upkeep of the buildings the player has placed. Nothing in the catalog is free. */
export function dailyUpkeep(ids: readonly ConnectivityBuildingId[]): number {
  let total = 0
  for (const id of ids) total += nonNegative(CONNECTIVITY_CATALOG[id].upkeepPerDay)
  return finite(total)
}

export function nonNegative(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value
}

export function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}
