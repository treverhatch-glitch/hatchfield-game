import type { ResearchId, StandAccess, StandClass, Tile, Vec } from '../game/types'
import type { VehicleType } from '../logistics/types'

/** Three size pillars. Every other system uses the same ladder. */
export type SizeTier = 'small' | 'wide' | 'jumbo'

export type BagSystemId = 'carts' | 'sorter' | 'bhs'

export type FuelSupply = 'road' | 'rail' | 'pipeline'

export type PaxUnit = 'desk' | 'kiosk' | 'bagdrop' | 'scanner' | 'egate'

export interface ScaleHint {
  id: string
  title: string
  detail: string
  fix: string
}

/** Bought progression that is not a map tile. */
export interface PillarState {
  contractId: string | null
  tankTier: 1 | 2 | 3
  litres: number
  supply: FuelSupply
  /** Game-minutes already waited on the road tanker currently inbound. */
  roadMinutes: number
  /** Pipeline batch is held. The line stays connected and moves no litres. */
  lineHeld?: boolean
  fleet: Partial<Record<VehicleType, number>>
  bagSystem: BagSystemId
  desks: number
  kiosks: number
  bagDrops: number
  scannerLanes: number
  eGates: number
}

export interface FieldSnapshot {
  size: number
  fieldLevel: number
  research: ResearchId[]
  tiles: Tile[][]
  standScale: Record<string, SizeTier>
  standClass: Record<string, StandClass>
  standAccess: Record<string, StandAccess>
  hangarScale: Record<string, SizeTier>
  /** Apex / Kiln already signed on the old fuel desk. Counts as a small contract. */
  legacyFuel: boolean
  /** Stand key "c,r" that has a hydrant pit. Missing on older callers. */
  standPits?: Readonly<Record<string, true>>
}

export interface PillarReport {
  ok: boolean
  tier: SizeTier
  hints: ScaleHint[]
}

export interface FuelTickResult {
  delivered: number
  paid: number
  method: FuelSupply | 'none'
  /** Rail just became a live delivery. The caller can say so once. */
  railFlowing: boolean
  waitingOnCash: boolean
}

export type { ResearchId, StandAccess, StandClass, Tile, Vec, VehicleType }
