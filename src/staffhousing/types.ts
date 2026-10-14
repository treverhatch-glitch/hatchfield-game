/** Staff housing and the commute that feeds it. Numbers live in `data.ts`. */

export type HousingTierId = 'dorm' | 'apartments' | 'village'

export type CommuteMode = 'none' | 'road' | 'bus' | 'rail'

export type StaffSeat = 'desk' | 'janitor' | 'mechanic' | 'researcher'

/** Passenger rail from `src/tier3plus`, when that module is on the field. */
export interface Tier3RailStation {
  present: boolean
  /** Minutes between trains. A shorter headway shortens the commute. */
  headwayMin?: number
  /** 0–1 on-time share for the station itself. */
  reliability?: number
  name?: string
}

export interface TransportLinks {
  roadCells: number
  /** An access road touches the map edge, so the city commute is open. */
  roadReachesEdge: boolean
  busStops: number
  /** Rail tile plus the city rail investment. */
  passengerRail: boolean
  tier3Rail: Tier3RailStation | null
}

export interface PlotRef {
  id: string
  col: number
  row: number
  zone: string
  distance: number
}

export interface HousingContext {
  fieldLevel: number
  owned: readonly PlotRef[]
  starterId: string
  mapSize: number
}

export interface HousingBuilding {
  id: string
  tier: HousingTierId
  plotIds: string[]
  anchor: { c: number; r: number }
}

export interface StaffHousingState {
  buildings: HousingBuilding[]
  /** Smoothed 0–1 morale. The panel also shows the live target. */
  morale: number
  shiftLate: boolean
  /** Last operating day that rolled commute and retention. -1 until the first close. */
  lastDay: number
}

export interface StaffHousingSave {
  buildings: HousingBuilding[]
  morale: number
  shiftLate: boolean
  lastDay: number
}

export interface CommuteReport {
  mode: CommuteMode
  modeLabel: string
  /** One-way minutes for someone who still commutes. */
  minutes: number
  /** 0–1 chance a commuter is on time. */
  reliability: number
  /** Minutes past a comfortable door-to-door, after housing. */
  lateMinutes: number
  /** Chance the shift is short because people did not show. */
  failureChance: number
  commuterShare: number
  housed: number
  beds: number
  employed: number
  /** Live morale before the day-close smooth. */
  morale: number
  retention: number
  hireCostMultiplier: number
  economyTier: 0 | 1 | 2 | 3
}

export interface BuildQuote {
  ok: true
  tier: HousingTierId
  name: string
  cost: number
  upkeepPerDay: number
  beds: number
  plotIds: string[]
  anchor: { c: number; r: number }
}

export interface BuildRefusal {
  ok: false
  reason: string
}

export interface StaffCounts {
  desk: number
  janitor: number
  mechanic: number
  researcher: number
}

export interface DayRoll {
  upkeep: number
  late: boolean
  reputationHit: number
  quit: StaffSeat | null
  morale: number
  news: string | null
}

export interface MeshPart {
  /** Width, height, depth in meters. */
  w: number
  h: number
  d: number
  /** Center, meters. Y is up from the ground. */
  x: number
  y: number
  z: number
  color: string
}

export interface WalkerPose {
  id: string
  tier: HousingTierId
  /** Apron cell coordinates. */
  x: number
  y: number
  heading: number
}
