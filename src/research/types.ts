import type { ResearchCategoryId, SpecBranchId } from './config.ts'

export type NodeState = 'owned' | 'available' | 'locked'

export interface ResearchNode {
  id: string
  category: ResearchCategoryId
  /** 1-based tier. Tier 1 of a line category is free. */
  tier: number
  name: string
  blurb: string
  /** Build items or policies this node opens. */
  unlocks: string
  requires: readonly string[]
  /** Base cost before the specialisation penalty. Tier 1 of a line is 0. */
  baseCost: number
  branch?: SpecBranchId
}

export interface ResearchState {
  points: number
  carry: number
  unlocked: string[]
  /** Field levels whose cash and RP lump have already been paid. */
  rewardedThrough: number
  /** First specialisation branch the player bought into. Others cost more. */
  primarySpec: SpecBranchId | null
}

export interface RoomCounts {
  desk: number
  board: number
  machine: number
}
