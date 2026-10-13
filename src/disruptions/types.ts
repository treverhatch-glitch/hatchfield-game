// Late-game disruption data. String unions only (erasableSyntaxOnly).

/** Staff pools a strike can thin. Desk is the check-in crew; the rest are budget pools. */
export type StaffPoolId = 'maintenance' | 'security' | 'cleaning' | 'fire' | 'ambulance' | 'desk'

export type DisruptionId =
  | 'volcanic-ash'
  | 'state-visit'
  | 'software-outage'
  | 'strike-day'
  | 'hub-meltdown'
  | 'health-screening'
  | 'rival-price-war'

export type FeedStatus = 'live' | 'minimised' | 'dismissed' | 'ignored' | 'recovered'

/** Where "Pan to problem" should look. The alert stack owns the card; this is only the locus. */
export type FocusTarget = 'apron' | 'runway' | 'checkin' | 'security' | 'staff' | 'fees'

export interface FlightBank {
  id: string
  label: string
  flightIds: string[]
}

/** Read-only field the scheduler needs. The sim fills this; the module does not read Game. */
export interface DisruptionWorld {
  fieldLevel: number
  /** Mastery goals are done. */
  goalsComplete: boolean
  /** After the goals, endless keeps the same pool rolling at random. */
  endless: boolean
  standsFree: number
  hotelRooms: number
  banks: FlightBank[]
  staffPools: StaffPoolId[]
  /** Sim seconds. One day is DISRUPTION_DAY_SEC. */
  clock: number
}

/**
 * One weather divert in the shape inbound already lands
 * (`spawnOffer(state, 'weather_divert')` on PR #42).
 * hotelRooms matches that profile. This module does not spawn the aircraft.
 */
export interface WeatherDivertAsk {
  kind: 'weather_divert'
  needsStand: true
  arff: true
  hotelRooms: number
}

export interface RunwayWindow {
  /** Inclusive sim-second the strip stops launching. */
  start: number
  /** Exclusive sim-second it opens again. */
  end: number
}

export interface DisruptionModifiers {
  /** 1 = normal desks. Higher = manual check-in. */
  checkInMultiplier: number
  /** 1 = normal lanes. Higher = an extra screening step. */
  screeningMultiplier: number
  secureZone: boolean
  runwayWindows: RunwayWindow[]
  /** Missing pool means full strength. A present value is the fraction still working. */
  staffScale: Partial<Record<StaffPoolId, number>>
  /** 1 = catalog fees. Lower is price-war pressure, never below the floor. */
  feeMultiplier: number
  hotelShortRooms: number
}

export interface DisruptionEffect {
  diversions: number
  hosted: number
  onward: number
  hotelShortRooms: number
  runwayWindows: RunwayWindow[]
  checkInMultiplier: number
  staffPool: StaffPoolId | null
  staffScale: number
  bankId: string | null
  bankLabel: string
  flightIds: string[]
  delaySec: number
  screeningMultiplier: number
  feeMultiplier: number
  rivalName: string
}

export interface ActiveDisruption {
  id: string
  kind: DisruptionId
  day: number
  startedAt: number
  endsAt: number
  title: string
  explanation: string
  suggestedFix: string
  focus: FocusTarget
  effect: DisruptionEffect
  recoveryCost: number
}

export interface FeedItem {
  id: string
  kind: DisruptionId
  title: string
  explanation: string
  suggestedFix: string
  focus: FocusTarget
  status: FeedStatus
  day: number
}

export interface CashPosting {
  amount: number
  reason: string
}

export interface RecoveryResult {
  ok: boolean
  cost: number
  explanation: string
}

/**
 * What the live field must do. Volcanic ash calls acceptWeatherDivert once per aircraft
 * so the inbound / apron divert path lands them. Cash must stay finite.
 */
export interface DisruptionHost {
  acceptWeatherDivert(ask: WeatherDivertAsk): { hosted: boolean }
  postCash(amount: number, reason: string): void
  delayBank(flightIds: string[], sec: number, reason: string): void
  rebookBank(flightIds: string[]): void
  news(text: string, tone: 'bad' | 'ok' | 'good'): void
}
