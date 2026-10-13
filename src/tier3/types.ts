import type { BaySize } from './config.ts'

export type Tier3Kind = 'mro' | 'night_hub'

export type MroPhase = 'taxi_in' | 'in_bay' | 'taxi_out'

export interface Tier3Building {
  id: string
  kind: Tier3Kind
}

export interface MroCandidate {
  id: string
  airframeId: string
  standKey: string
}

export interface MroJob {
  id: string
  aircraftId: string
  buildingId: string
  bayId: string
  airframeId: string
  size: BaySize
  standKey: string
  phase: MroPhase
  /** Game minutes left in the current phase. */
  remaining: number
}

export interface Tier3Posting {
  amount: number
  label: string
}

export interface Tier3TickResult {
  postings: Tier3Posting[]
  /** Applied once to each signed passenger airline when a night wave launches. */
  paxHeat: number
}

export interface MroJobView {
  airframeId: string
  bayId: string
  phase: MroPhase
  remainingMinutes: number
}

export interface Tier3Snapshot {
  mro: {
    built: number
    bays: number
    occupied: number
    standsTied: number
    taxiwaysTied: number
    techsAssigned: number
    techsRequired: number
    powerDemand: number
    powerCapacity: number
    revenue: number
    upkeepPerDay: number
    jobs: MroJobView[]
  }
  nightHub: {
    built: number
    storageTonnes: number
    handlingTonnes: number
    bankTonnes: number
    flights: number
    revenue: number
    noise: number
    upkeepPerDay: number
    groundCrewAssigned: number
    groundCrewRequired: number
    curfewRelaxed: boolean
  }
}

export interface Tier3Save {
  minutes: number
  lastUpkeepDay: number
  nextInductionAt: number
  launchedNight: number | null
  mroRevenue: number
  nightRevenue: number
  nightNoise: number
  bankTonnes: number
  bankFlights: number
  jobs: MroJob[]
}
