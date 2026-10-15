// Airline contracts & seasonal scheduling — pure data types.
// erasableSyntaxOnly-safe: string unions only, no enums / namespaces / parameter properties.

export type SeasonKind = 'summer' | 'winter'
export interface Season {
  id: string
  kind: SeasonKind
  year: number
  /** inclusive absolute game day */
  startDay: number
  /** inclusive absolute game day */
  endDay: number
}

export type ServiceKind =
  | 'fuel'
  | 'catering'
  | 'cleaning'
  | 'baggage'
  | 'cargo'
  | 'prm'
  | 'deice'
  | 'pushback'
  | 'lav_water'
  | 'gpu_pca'
  | 'fast_track'
  | 'premium_checkin'

export const ALL_SERVICES: readonly ServiceKind[] = [
  'fuel', 'catering', 'cleaning', 'baggage', 'cargo', 'prm', 'deice', 'pushback', 'lav_water', 'gpu_pca',
  'fast_track', 'premium_checkin',
]

export type SizeClass = 'regional' | 'narrow' | 'wide' | 'super'
export const SIZE_ORDER: readonly SizeClass[] = ['regional', 'narrow', 'wide', 'super']

/** All values in minutes. softMin = free ± tolerance; hardMin = max ± shift (player only, costs standing). */
export interface TimeWindow {
  preferredMin: number
  softMin: number
  hardMin: number
}

export type FlightKind = 'pax' | 'freighter' | 'mixed'

export interface FlightLine {
  id: string
  airframeId: string
  kind: FlightKind
  /** 0 = Mon … 6 = Sun */
  days: number[]
  /** on-block window, minute of day */
  arrival: TimeWindow
  /** MTT + margin */
  turnaroundTargetMin: number
  origin: string
  destination: string
  flightNumber?: string
}

export interface SlaKpis {
  onTimePct: number
  firstBagMin: number
  lastBagMin: number
  /** per 1000 bags */
  lostBagRate: number
  prmWaitMin?: number
}

export interface Money {
  landingPerTonne: number
  perPax: number
  services: Partial<Record<ServiceKind, number>>
}

export type ContractStatus = 'offered' | 'active' | 'expiring' | 'ended' | 'cancelled'
export type ContractTerm = 1 | 2 | 4

export interface Contract {
  id: string
  airlineId: string
  isHub: boolean
  /** hub airlines keep to this pier when possible */
  homePier?: string
  seasons: string[]
  lines: FlightLine[]
  services: ServiceKind[]
  sla: SlaKpis
  money: Money
  penalties: { perLateMin: number; perLostBag: number; perGrounding: number }
  bonuses: { onTimeOver: number; amount: number }[]
  earlyCancel: { fee: number; standingHit: number; favourHit: number }
  status: ContractStatus
  /** term length chosen at offer time (1 starter, 2 standard, 4 hub) */
  termSeasons?: ContractTerm
}

export type SlotFlag = 'ok' | 'off_window' | 'over_capacity'

export interface SlotActual {
  onBlock?: number
  offBlock?: number
  bagsLoaded?: number
  bagsExpected?: number
  lostBags?: number
  pax?: number
  grounded?: 'fuel' | 'weather'
  cateringShort?: boolean
}

export interface SlotInstance {
  id: string
  contractId: string
  lineId: string
  airlineId: string
  airframeId: string
  /** absolute game day */
  day: number
  /** absolute game minutes (day*1440 + minute of day) */
  plannedOnBlock: number
  plannedOffBlock: number
  standId: string | null
  /** arrival runway / departure runway */
  runwayId: string | null
  depRunwayId: string | null
  pinned: boolean
  /** player pinned to this stand (survives re-runs) */
  standPinned: boolean
  /** this day's operation was cancelled by the player */
  cancelled: boolean
  flag: SlotFlag
  /** human readable reasons for red/amber flags (never hidden) */
  issues: string[]
  actual?: SlotActual
}

export interface StandDef {
  id: string
  sizeClass: SizeClass
  contact: boolean
  pier?: string
  /** Hub lease holder. Other airlines are refused. */
  leaseAirlineId?: string | null
  closed?: boolean
  reserved?: boolean
}

export interface RunwayDef {
  id: string
  movesPerHour: number
}

export interface Infrastructure {
  stands: StandDef[]
  runways: RunwayDef[]
}

export interface HourCapacity {
  hour: number
  runwayMoves: number
  standsByClass: Record<SizeClass, number>
}

export interface ScheduleState {
  season: Season
  autoByAirline: Record<string, boolean>
  slots: SlotInstance[]
  declaredCapacity: HourCapacity[]
  /** IATA 80/20 use-it-or-lose-it; default false (decision #21) */
  slotRule80: boolean
}

export interface AirframeInfo {
  sizeClass: SizeClass
  mtowTonnes: number
  seats: number
}

export interface SchedulerOptions {
  stepMin: number
  /** buffer between turns on the same stand */
  standBufferMin: number
  airframes: Record<string, AirframeInfo>
}
