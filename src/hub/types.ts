export type CarrierBiz = 'charter' | 'lcc' | 'full_service' | 'cargo'

export interface CarrierProfile {
  kind: 'pax' | 'cargo'
  bizModel: CarrierBiz
  tier: number
  /** Signed hub carrier (base airline at this field). */
  hub: boolean
  likesLayovers: boolean
}

export interface HubFacilities {
  transferCentre: boolean
  rfid: boolean
}

export interface GatePoint {
  id: string
  /** Pier position in metres. */
  x: number
  y: number
}

export type ConnectionFail = 'ok' | 'below_mct' | 'pax_late' | 'bag_late'

export interface ConnectionVerdict {
  made: boolean
  paxMade: boolean
  bagMade: boolean
  mct: number
  available: number
  paxMinutes: number
  bagMinutes: number
  walkMinutes: number
  rideMinutes: number | null
  mode: 'walk' | 'ride'
  reason: ConnectionFail
}

export interface Movement {
  id: string
  airlineId: string
  gateId: string
  direction: 'arr' | 'dep'
  /** Game-minute timestamp. */
  at: number
}

export interface BankWave {
  id: string
  arrivals: string[]
  departures: string[]
  arrivalOpen: number
  arrivalClose: number
  departureOpen: number
  departureClose: number
  /** Minutes from the last arrival to the first departure. */
  gap: number
  /** 0 loose … 1 tight. */
  tightness: number
  /** Multiplier on transfer share. 1 when the bank is loose. */
  transferDemand: number
  /** Sterile-area crowd multiplier. 1 when the bank is loose. */
  crowdPeak: number
}

export type MissKind = 'hotel' | 'rebook'

export interface MissPenalty {
  kind: MissKind
  /** Cash the airport pays. Always finite and ≥ 0. */
  amount: number
  /** Standing delta. Zero or negative, always finite. */
  standing: number
  passengers: number
}

export interface GatePairTime {
  from: string
  to: string
  metres: number
  walkMinutes: number
  rideMinutes: number | null
  mode: 'walk' | 'ride'
}

export interface ConnectionMap {
  mct: number
  missed: number
  crowdPeak: number
  ride: boolean
  pairs: GatePairTime[]
  lines: string[]
}

export type HubUpgradeId = 'transfer_centre' | 'rfid_bag_line'

export interface HubUpgrade {
  id: HubUpgradeId
  name: string
  rp: number
  buildCost: number
  upkeepPerDay: number
  minFieldLevel: number
  requires?: HubUpgradeId
  blurb: string
}
