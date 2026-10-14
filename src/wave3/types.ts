import type { ContractTier, ResearchBranch } from './config.ts'

export type RelationBand = 'hostile' | 'cold' | 'neutral' | 'warm' | 'partner'

export interface RelationParts {
  letter: number
  onTime: number
  delay: number
  cancel: number
  kept: number
  capacity: number
  lounge: number
  gate: number
  missed: number
  fine: number
}

export interface RelationCounts {
  onTime: number
  delay: number
  cancel: number
  missed: number
  fine: number
  kept: number
}

/** Persisted row. Older saves only stored score and band. */
export interface RelationRow {
  score: number
  band: RelationBand
  parts?: RelationParts
  counts?: RelationCounts
  /** Last game day this signed carrier was reviewed. -1 until the first close. */
  reviewedDay?: number
  /** Extra routes already written onto the timetable for the current tier. */
  routesGranted?: number
  hubAsked?: boolean
  exclusiveNoted?: boolean
}

/** Row after missing fields are filled in. */
export interface RelationSnapshot {
  score: number
  band: RelationBand
  parts: RelationParts
  counts: RelationCounts
  reviewedDay: number
  routesGranted: number
  hubAsked: boolean
  exclusiveNoted: boolean
}

export interface RelationsState {
  rows: Record<string, RelationRow>
}

export interface PortraitSlot {
  seed: number
  skin: string
  hair: string
  hairStyle: 'short' | 'long' | 'bun' | 'bald'
  suit: string
  accent: string
  glasses: boolean
}

export interface CeoCard {
  airlineId: string
  name: string
  title: string
  traits: readonly [string, string]
  portrait: PortraitSlot
  /** One trait-flavoured line for the letter. */
  voice: string
}

export interface ContractShape {
  tier: ContractTier
  label: string
  feeMult: number
  extraSlots: number
  /** Airframe ids this carrier actually flies. Tiers do not add to this list. */
  airframes: readonly string[]
}

export interface ResearchState {
  points: number
  /** Fractional carry so a slow trickle is not lost to rounding. */
  carry: number
  unlocked: string[]
  /** Seconds the placeholder lab animation has been running. */
  animSeconds: number
}

export interface Wave3State {
  relations: RelationsState
  research: ResearchState
}

export interface RoomCounts {
  desk: number
  board: number
  machine: number
}

export interface LabFrame {
  seconds: number
  rooms: number
  phase: 'empty' | 'idle' | 'scan' | 'spark'
  bob: number
  glow: number
  spark: number
}

export interface TechNode {
  id: string
  branch: ResearchBranch
  depth: number
  name: string
  blurb: string
  cost: number
  fieldLevel: number
  requires: readonly string[]
}
