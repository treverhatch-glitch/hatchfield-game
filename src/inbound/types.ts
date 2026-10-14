// Inbound requests — pure data. String unions only (erasableSyntaxOnly).

import type { Contract } from '../contracts/types.ts'

export type WeatherKind = 'clear' | 'rain' | 'fog' | 'storm' | 'snow'

/** Priority asks. A deliberate refuse posts the refuse fine. Timing out posts the timeout fine. */
export type PriorityKind =
  | 'weather_divert'
  | 'medical'
  | 'fuel_low'
  | 'technical'
  | 'vip'
  | 'medevac'
  | 'tanker'
  | 'tanker_mx'
  | 'military'

/** Walk-in traffic. Refusing posts no fine. */
export type GeneralKind = 'ga' | 'bizjet' | 'charter' | 'ferry' | 'storage'

export type RequestKind = PriorityKind | GeneralKind

export type PadKind = 'stand' | 'remote' | 'grass' | 'heli' | 'guard'

export type RequestStatus = 'queued' | 'pending' | 'accepted' | 'refused' | 'expired' | 'failed' | 'declined'

/** What hosting this arrival consumes. Booleans are capabilities; counts are stocks. */
export interface ServiceNeeds {
  arff: boolean
  ambulance: boolean
  securityCorridor: boolean
  catering: boolean
  cleaning: boolean
  gpu: boolean
  customs: boolean
  pad: PadKind | 'none'
  padFallback?: PadKind
  fuelLitres: number
  hotelRooms: number
  hangarBays: number
  runwayMetres: number
}

export interface InboundRequest {
  id: string
  kind: RequestKind
  priority: boolean
  title: string
  blurb: string
  /** Game day the offer was rolled on. */
  day: number
  /** Sim-second the decision card opens. */
  opensAt: number
  /** Sim-second the card expires. Unanswered cards time out on their own. */
  deadline: number
  etaSec: number
  needs: ServiceNeeds
  /** Landing fee posted on a successful accept. Storage is 0; it pays daily. */
  reward: number
  /** GA day-rate while a storage visit holds a pad. */
  dailyFee: number
  stayDays: number
  fineOnRefuse: number
  /** Charged when the card expires with no answer. Not the refuse fine. */
  fineOnTimeout: number
  fineOnFail: number
  reputationOnAccept: number
  reputationOnRefuse: number
  xpOnAccept: number
  status: RequestStatus
}

export interface Visit {
  id: string
  requestId: string
  kind: RequestKind
  needs: ServiceNeeds
  pad: PadKind | 'none'
  arrivalDay: number
  /** First game day the pad is free again. */
  departDay: number
  stayDays: number
  dailyFee: number
  lastChargedDay: number
  paidDays: number
  status: 'parked' | 'departed'
}

/** Pads, rooms and bays currently withheld. Fuel burned is tracked separately. */
export interface ResourceHold {
  stands: number
  remoteStands: number
  grassPads: number
  heliPads: number
  guardPads: number
  hotelRooms: number
  hangarBays: number
}

export interface FieldCapabilities {
  stands: number
  remoteStands: number
  grassPads: number
  heliPads: number
  guardPads: number
  arff: boolean
  ambulance: boolean
  /** Litres on the farm before this module's burn. */
  fuelLitres: number
  hotelRooms: number
  securityCorridor: boolean
  hangarBays: number
  gpu: boolean
  catering: boolean
  cleaning: boolean
  customs: boolean
  runwayMetres: number
}

export interface InboundWorld {
  /** 1..10. Scales how many offers the day rolls. */
  fieldLevel: number
  /**
   * 1 = catalog default fees.
   * Below 1 draws more walk-in traffic. Above 1.3 cuts it.
   */
  feeMultiplier: number
  weather: WeatherKind
  capabilities: FieldCapabilities
}

export interface LedgerEntry {
  day: number
  /** Positive earns, negative charges. */
  amount: number
  reason: string
  requestId?: string
  visitId?: string
  contractId?: string
}

/** A Guard contract is a #19 Contract plus the night-circuit costs. */
export interface MilitaryDeal {
  templateId: string
  noisePerNight: number
  approvalPerNight: number
  contract: Contract
}

export interface InboundStats {
  accepted: number
  refused: number
  failed: number
  expired: number
  sortiesFlown: number
  sortiesMissed: number
}

export interface InboundState {
  version: 1
  rngState: number
  nextId: number
  clock: number
  /** Last game day whose offers were rolled. -1 before the first tick. */
  rolledDay: number
  requests: InboundRequest[]
  visits: Visit[]
  deals: MilitaryDeal[]
  held: ResourceHold
  /** Fuel litres already uplifted. Not returned when the aircraft leaves. */
  burnedFuel: number
  corridorHeld: boolean
  licence: { guardAgreement: boolean; clearance: boolean }
  cityApproval: number
  noise: number
  reputation: number
  guardStanding: number
  favour: number
  xp: number
  ledger: LedgerEntry[]
  stats: InboundStats
}

export type InboundEvent =
  | { type: 'offered'; request: InboundRequest }
  | {
      type: 'accepted'
      requestId: string
      visitId: string
      reward: number
      hotelIncome: number
      consumed: ServiceNeeds
      pad: PadKind | 'none'
      xp: number
    }
  | { type: 'refused'; requestId: string; fine: number; reputation: number }
  | { type: 'expired'; requestId: string; fine: number; reputation: number }
  | { type: 'failed_host'; requestId: string; fine: number; gaps: string[] }
  | { type: 'declined'; requestId: string; gaps: string[] }
  | { type: 'departed'; visitId: string; kind: RequestKind }
  | { type: 'parking_fee'; visitId: string; amount: number; day: number }
  | {
      type: 'week_audit'
      contractId: string
      flown: number
      missed: number
      pay: number
      penalty: number
      noise: number
      approvalDelta: number
      breach: boolean
    }
  | { type: 'military_offered'; contractId: string }
  | { type: 'military_signed'; contractId: string }
  | { type: 'military_cancelled'; contractId: string; fee: number; standingDelta: number }
  | { type: 'licence'; licence: 'guard' | 'clearance'; cost: number }

export type RespondChoice = 'accept' | 'refuse'

export type OfferPolicy = (
  request: InboundRequest,
  state: InboundState,
  world: InboundWorld,
) => RespondChoice | 'hold'
