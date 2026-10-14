import type { PassengerLink } from '../connectivity/types.ts'
import type { HubFacilities } from '../hub/types.ts'

export type AirlineType = 'full_service' | 'lcc' | 'charter' | 'cargo'

/** Layover choice is driven by the trait, not the fare class. */
export type LayoverTrait = 'business' | 'budget' | 'family'

export interface PaxMix {
  /** Share of the load connecting through this airport. */
  transfer: number
  /** Share starting or ending here (origin and destination). */
  od: number
  /** Share of connecting passengers who must be screened again. */
  screen: number
}

export interface LoadSplit {
  od: number
  transfer: number
  screened: number
}

export type TransferStep =
  | 'deplane'
  | 'transfer_security'
  | 'landside_recheck'
  | 'walk'
  | 'ride'
  | 'departure_gate'

export interface TransferRouteInput {
  /** Pier metres between the two gates. */
  metres: number
  link: PassengerLink
  walkwayMetres?: number
  /** This passenger needs screening before the onward gate. */
  screened: boolean
  /** A transfer security lane exists airside. */
  transferLane: boolean
}

export interface TransferRoute {
  steps: TransferStep[]
  /** Never touches landside. False only for a re-screen without a transfer lane. */
  airsideOnly: boolean
  /** Deplane + screening + travel, game-minutes. */
  minutes: number
  screenMinutes: number
  travelMinutes: number
}

export interface LayoutMctInput {
  facilities: HubFacilities
  /** Gate-pair distances in metres (any order). */
  pairMetres: readonly number[]
  link: PassengerLink
  walkwayMetres?: number
  transferLane: boolean
  /** Share of connecting traffic that is re-screened. */
  screenShare: number
}

export interface LayoutMct {
  /** Facility floor from the hub layer (bag sort + process). */
  base: number
  walkMinutes: number
  screenMinutes: number
  /** Published MCT, rounded up. */
  total: number
}

export interface SortCapacityInput {
  belts: number
  transferCentre: boolean
  rfid: boolean
}

export type LayoverClass = 'tight' | 'short' | 'long' | 'overnight'

export type OvernightChoice = 'transit_hotel' | 'landside_hotel' | 'lounge' | 'terminal_sleep'

export interface OvernightOptions {
  transitRooms: number
  landsideRooms: number
  /** A landside hotel has a shuttle or walkway to the terminal. */
  landsideLinked: boolean
  lounge: boolean
  /** A voucher pays the room. */
  voucher: boolean
}

export type StrandCause = 'cancel' | 'delay' | 'misconnect'
export type VoucherPayer = 'airline' | 'airport'
export type VoucherTerms = Readonly<Record<StrandCause, VoucherPayer>>

export interface StrandedGroup {
  id: string
  airlineId: string
  pax: number
  cause: StrandCause
  /** Game-minute the group was stranded. */
  at: number
  /** Apron cell for pan-to-problem. */
  cell?: { c: number; r: number }
}

export interface RebookDeparture {
  id: string
  airlineId: string
  /** Game-minute departure. */
  at: number
  seatsFree: number
}

export interface RebookResult {
  groupId: string
  airlineId: string
  cause: StrandCause
  payer: VoucherPayer
  /** Rebooked onto a departure the same day. */
  sameDay: number
  /** No seat before the night: needs a hotel voucher. */
  overnight: number
  /** Departure ids used, in order. */
  flights: string[]
  /** Seats taken per departure id. */
  taken: Record<string, number>
  /** Meal vouchers and desk handling, dollars. */
  handling: number
}

export interface ConnectionsDay {
  day: number
  transfers: number
  made: number
  missed: number
  missedMct: number
  screened: number
  landsideRecheck: number
  transferBags: number
  misconnectedBags: number
  stranded: number
  rebooked: number
  overnight: number
  voucherAirport: number
  voucherAirline: number
  layoverShort: number
  layoverLong: number
}

export type ConnectionsAlertKind = 'mct_miss' | 'misconnect' | 'stranded' | 'hotel_full' | 'recheck'

export interface ConnectionsAlert {
  id: string
  kind: ConnectionsAlertKind
  text: string
  day: number
  /** Apron cell for pan-to-problem. */
  cell?: { c: number; r: number }
}
