import type { HousingTier, TransitTier } from '../economy/types.ts'

export type Cabin = 'economy' | 'business' | 'first' | 'premium' | 'vip'

export type ScreenPath = 'vip_room' | 'fast_track' | 'general'

export interface BuiltFacility {
  id: string
  itemId: import('./data.ts').PremiumItemId
}

export interface PremiumState {
  built: BuiltFacility[]
  /** Player choice. Off until they turn the fee on. */
  feeEnabled: boolean
  /** Security officers on the shared roster. Lanes do not keep a private crew. */
  securityOfficers: number
  /** Game day the miss counters belong to. */
  day: number
  missedPremium: Record<string, number>
  standingFromPremium: Record<string, number>
  standingFromVip: Record<string, number>
  /** Game hour the lane counters belong to. */
  hour: number
  servedThisHour: Record<string, number>
  nextId: number
}

export interface StaffPools {
  security_officer: number
  terminal_staff: number
}

export interface PoolContext {
  transitTier?: TransitTier
  housingTier?: HousingTier
}

export interface PremiumGate {
  fieldLevel: number
  hasCt: boolean
  /** When set, miss counters reset if the day changed. */
  day?: number
  /** When set, lane counters reset if the hour changed. */
  hourIndex?: number
  /** Hours of lane capacity this call may consume. */
  hours?: number
}

export interface ScreeningPax {
  id: string
  cabin: Cabin
  airlineId: string
}

export interface ScreenRow {
  id: string
  cabin: Cabin
  path: ScreenPath
  laneId: string | null
  checkinId: string | null
  escorted: boolean
  happinessDelta: number
  standingDelta: number
  fee: number
}

export interface AirlineServiceProfile {
  tier?: number
  persona?: string
  kind?: string
}
