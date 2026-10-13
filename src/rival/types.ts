export interface FeeLevels {
  landing: number
  passenger: number
  cargo: number
}

export type CarrierKind = 'pax' | 'cargo'

export interface RivalCarrier {
  id: string
  name: string
  tier: number
  kind: CarrierKind
  sinceDay: number
  /** 0–100. Higher means a player pitch is less likely to land. */
  loyalty: number
}

export interface RivalMove {
  day: number
  kind: 'undercut' | 'raise' | 'court' | 'poach' | 'lost' | 'expand' | 'hold' | 'info'
  text: string
  /** Player news ticker. Quiet bookkeeping stays on the panel only. */
  announce: boolean
  tone: 'ok' | 'good' | 'bad'
}

/** A carrier flying the player's field today. */
export interface PlayerCarrier {
  id: string
  name: string
  tier: number
  kind: CarrierKind
  /** 0–100 standing on the player's field. */
  standing: number
}

/** A carrier that walked off the player's field since the last rival day. */
export interface Walkaway {
  id: string
  name: string
  tier: number
  kind: CarrierKind
  reason: string
}

export interface PlayerSnapshot {
  name: string
  /** Published tariff. 1 is list price. */
  feeIndex: number
  /** 0–100 blend of reputation and airline standing. */
  service: number
  /** Stands the player can turn. */
  capacity: number
  reputation: number
  airlines: PlayerCarrier[]
}

/** What the player puts on the table when courting a Bellwater carrier. */
export interface CourtOffer {
  feeIndex: number
  service: number
  capacity: number
}

export interface DemandSplit {
  playerScore: number
  rivalScore: number
  playerShare: number
  rivalShare: number
  /** Multiplier on the player's loads. 1 when the two fields split evenly. */
  playerFactor: number
}

export interface CourtQuote {
  ok: boolean
  cost: number
  chance: number
  reason: string
}

export interface CourtResult {
  ok: boolean
  won: boolean
  cost: number
  chance: number
  text: string
  carrier: RivalCarrier | null
}

export interface DayResult {
  day: number
  moves: RivalMove[]
  poached: RivalCarrier[]
  demand: DemandSplit
}

export interface RivalCompareRow {
  label: string
  player: string
  rival: string
  edge: 'you' | 'bellwater' | 'even'
}

export interface RivalCourtRow {
  id: string
  name: string
  kind: CarrierKind
  tier: number
  cost: number
  chance: number
  ok: boolean
  reason: string
}

export interface RivalPanelModel {
  name: string
  code: string
  day: number
  reputation: number
  service: number
  capacity: number
  maxCapacity: number
  treasury: number
  dailyUpkeep: number
  fees: FeeLevels
  feeBlend: number
  roster: { id: string; name: string; kind: CarrierKind; tier: number; loyalty: number }[]
  moves: { day: number; text: string; tone: 'ok' | 'good' | 'bad' }[]
  comparison: RivalCompareRow[]
  demand: DemandSplit
  court: RivalCourtRow[]
}

export interface RivalState {
  version: 1
  name: string
  day: number
  rng: number
  reputation: number
  service: number
  capacity: number
  treasury: number
  fees: FeeLevels
  roster: RivalCarrier[]
  moves: RivalMove[]
  lastPoachDay: number
  lastExpandDay: number
}
