import type { ConnectivityBuilding, ConnectivityBuildingId, LinkMode } from './types.ts'

/**
 * Late-game hub buildings from the Hatchfield Late-Game Plan (§3 and §5).
 * The plan gives the people mover a rate and the transfer centre a connection
 * time. The bus is only described as slow and heavy on the apron, so its rate,
 * ride, and traffic are starting balance values. The walk-only connection is
 * the same kind of starting value: the plan specifies 45 and 25, not the
 * unassisted walk.
 */
export const PEOPLE_MOVER_PAX_PER_HOUR = 3_000
export const PEOPLE_MOVER_RIDE_MINUTES = 4

export const BUS_PAX_PER_HOUR = 800
export const BUS_RIDE_MINUTES = 16
export const BUS_APRON_TRAFFIC_PER_HOUR = 6

/** No transfer centre: passengers walk airside between terminals. */
export const WALK_MCT_MINUTES = 90
/** Transfer centre, without the RFID bag line. */
export const TRANSFER_CENTRE_MCT_MINUTES = 45
/** Transfer centre plus the RFID stub flag. */
export const RFID_MCT_MINUTES = 25

/**
 * Standing lost per missed connecting passenger, capped so one bank cannot
 * wipe a carrier. The diplomacy adapter adds the returned number as-is.
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
    paxPerHour: PEOPLE_MOVER_PAX_PER_HOUR,
    apronTrafficPerHour: 0,
    rideMinutes: PEOPLE_MOVER_RIDE_MINUTES,
    linksTerminals: true,
    breakdownStrandsGates: true,
    mctMinutes: null,
    blurb: 'Links terminals at 3,000 passengers per hour.',
    catch: 'A breakdown strands gates.',
  },
  airside_transfer_bus_depot: {
    id: 'airside_transfer_bus_depot',
    name: 'Airside transfer bus depot',
    fieldLevel: 6,
    cost: 90_000,
    upkeepPerDay: 2_600,
    paxPerHour: BUS_PAX_PER_HOUR,
    apronTrafficPerHour: BUS_APRON_TRAFFIC_PER_HOUR,
    rideMinutes: BUS_RIDE_MINUTES,
    linksTerminals: true,
    breakdownStrandsGates: false,
    mctMinutes: null,
    blurb: 'A cheap link between terminals.',
    catch: 'Slow; adds apron traffic.',
  },
  transfer_centre: {
    id: 'transfer_centre',
    name: 'Transfer centre',
    fieldLevel: 7,
    cost: 160_000,
    upkeepPerDay: 4_200,
    paxPerHour: 0,
    apronTrafficPerHour: 0,
    rideMinutes: 0,
    linksTerminals: false,
    breakdownStrandsGates: false,
    mctMinutes: TRANSFER_CENTRE_MCT_MINUTES,
    blurb: 'Connecting passengers, with a 45-minute minimum connection.',
    catch: 'Missed connections hurt airline Standing.',
  },
} as const satisfies Record<ConnectivityBuildingId, ConnectivityBuilding>

export const CONNECTIVITY_BUILDINGS: readonly ConnectivityBuilding[] = [
  CONNECTIVITY_CATALOG.people_mover,
  CONNECTIVITY_CATALOG.airside_transfer_bus_depot,
  CONNECTIVITY_CATALOG.transfer_centre,
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
