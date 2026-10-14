import type { ResearchId } from '../game/types.ts'
import { TECH_NODES } from '../wave3/research.ts'
import { RESEARCH_NODES } from './nodes.ts'
import type { ResearchState } from './types.ts'

/**
 * Every legacy research-desk id lives on exactly one Growth-tree node.
 * Owning the node grants the project. Hub upgrades still charge their cash
 * build cost in the sim; the node is only the research gate.
 */
export const DESK_TO_NODE: Record<ResearchId, string> = {
  night_bank: 'airside-6',
  deice: 'airfield-2',
  stand_class: 'airfield-3',
  widebody_ops: 'airfield-3',
  heavy_pack: 'airfield-6',
  mil_ramp: 'safety-5',
  hydrant_fuel: 'airside-1',
  rail_fuel: 'airside-6',
  tank_farm_ii: 'airside-4',
  tank_farm_iii: 'airfield-6',
  bag_sorter: 'terminal-2',
  bag_bhs: 'terminal-6',
  self_service: 'terminal-2',
  ct_lanes: 'safety-4',
  egates: 'safety-6',
  travelator: 'terminal-3',
  skywalk: 'terminal-5',
  people_mover: 'terminal-6',
  transfer_centre: 'retail-1',
  rfid_bag_line: 'retail-2',
  mro_hangar: 'airside-5',
  cargo_night_hub: 'airside-6',
}

/**
 * Wave 3 nodes never opened a stamp. Each one now folds onto a tree node
 * that does. Many Wave 3 ids may share a node; none are left unmapped.
 */
export const WAVE3_TO_NODE: Readonly<Record<string, string>> = {
  'passenger.1': 'terminal-1',
  'passenger.2': 'retail-6',
  'passenger.3': 'retail-5',
  'passenger.4': 'terminal-2',
  'passenger.5': 'spec-premium-1',
  'passenger.6': 'spec-hub-1',
  'passenger.7': 'retail-4',
  'passenger.8': 'terminal-6',
  'cargo.1': 'spec-cargo-1',
  'cargo.2': 'airside-3',
  'cargo.3': 'airside-6',
  'cargo.4': 'spec-cargo-2',
  'cargo.5': 'spec-cargo-4',
  'cargo.6': 'landside-5',
  'cargo.7': 'spec-cargo-3',
  'cargo.8': 'spec-cargo-5',
  'efficiency.1': 'airfield-1',
  'efficiency.2': 'spec-lowcost-1',
  'efficiency.3': 'airside-1',
  'efficiency.4': 'safety-1',
  'efficiency.5': 'airfield-5',
  'efficiency.6': 'airside-4',
  'efficiency.7': 'airfield-4',
  'efficiency.8': 'spec-green-2',
  'prestige.1': 'retail-3',
  'prestige.2': 'spec-charter',
  'prestige.3': 'landside-6',
  'prestige.4': 'spec-premium-3',
  'prestige.5': 'landside-2',
  'prestige.6': 'spec-premium-4',
  'prestige.7': 'spec-premium-5',
  'prestige.8': 'spec-hub-5',
}

export function treeCatalogCost(): number {
  return RESEARCH_NODES.reduce((sum, node) => sum + node.baseCost, 0)
}

export function wave3CatalogCost(): number {
  return TECH_NODES.reduce((sum, node) => sum + node.cost, 0)
}

export function deskIdsForNode(nodeIds: readonly string[]): ResearchId[] {
  const owned = new Set(nodeIds)
  return (Object.keys(DESK_TO_NODE) as ResearchId[]).filter((id) => owned.has(DESK_TO_NODE[id]))
}

interface WaveResearch {
  points?: number
  carry?: number
  unlocked?: string[]
  animSeconds?: number
}

interface TreeSave {
  points?: number
  carry?: number
  unlocked?: string[]
  rewardedThrough?: number
  primarySpec?: string | null
}

export interface ResearchFoldInput {
  researchPoints?: number
  researchUnlocked?: readonly string[]
  researchTree?: TreeSave | null
  researchUnified?: boolean
  wave3?: { relations?: unknown; research?: WaveResearch } | null
  fieldXp?: number
}

export interface ResearchFold {
  researchPoints: number
  researchUnlocked: ResearchId[]
  researchTree: ResearchState
  researchUnified: true
  wave3Research: { points: number; carry: number; unlocked: string[]; animSeconds: number }
  /** Node ids granted by this fold (includes ones the tree already owned). */
  granted: string[]
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function splitPoints(total: number): { points: number; carry: number } {
  const safe = Math.max(0, total)
  const points = Math.floor(safe)
  return { points, carry: safe - points }
}

/**
 * Move desk points, Wave 3 points, and both unlock lists onto the Growth tree.
 * A second call does not add points again. Owned capabilities are granted,
 * not rebought. Wave 3 relations are not touched.
 */
export function foldResearch(input: ResearchFoldInput, fieldLevel = 1): ResearchFold {
  const tree = input.researchTree
  const wave = input.wave3?.research
  const unlocked = new Set(stringList(tree?.unlocked))
  const deskOwned = stringList(input.researchUnlocked)
  const waveOwned = stringList(wave?.unlocked)

  for (const id of deskOwned) {
    const nodeId = DESK_TO_NODE[id as ResearchId]
    if (nodeId) unlocked.add(nodeId)
  }
  for (const id of waveOwned) {
    const nodeId = WAVE3_TO_NODE[id]
    if (nodeId) unlocked.add(nodeId)
  }

  const already = input.researchUnified === true
  const treePoints = finite(tree?.points)
  const treeCarry = finite(tree?.carry)
  const deskPoints = Math.max(0, finite(input.researchPoints))
  const wavePoints = Math.max(0, finite(wave?.points) + finite(wave?.carry))
  const ratio = treeCatalogCost() / Math.max(1, wave3CatalogCost())
  const combined = already ? treePoints + treeCarry : treePoints + treeCarry + deskPoints + wavePoints * ratio
  const split = splitPoints(combined)
  const level = Math.max(1, Math.floor(fieldLevel) || 1)
  const rewardedThrough = tree
    ? Math.max(1, Math.floor(finite(tree.rewardedThrough, level)))
    : level

  // Keep desk ids the player already bought. Do not invent hub upgrades
  // just because a tree node was owned under an older unlock text.
  const researchUnlocked = new Set<ResearchId>(deskOwned.filter((id): id is ResearchId => id in DESK_TO_NODE))

  const primary = tree?.primarySpec
  const primarySpec =
    primary === 'hub' || primary === 'cargo' || primary === 'lowcost' || primary === 'premium' || primary === 'green'
      ? primary
      : null

  return {
    researchPoints: split.points,
    researchUnlocked: [...researchUnlocked],
    researchUnified: true,
    granted: [...unlocked],
    researchTree: {
      points: split.points,
      carry: split.carry,
      unlocked: [...unlocked],
      rewardedThrough,
      primarySpec,
    },
    wave3Research: {
      points: 0,
      carry: 0,
      unlocked: [],
      animSeconds: Math.max(0, finite(wave?.animSeconds)),
    },
  }
}

/** Merge a save record. Relations and every non-research field pass through. */
export function foldResearchSave(data: Record<string, unknown>, fieldLevel = 1): Record<string, unknown> {
  const wave3 = isRecord(data.wave3) ? data.wave3 : undefined
  const folded = foldResearch(
    {
      researchPoints: typeof data.researchPoints === 'number' ? data.researchPoints : undefined,
      researchUnlocked: Array.isArray(data.researchUnlocked) ? (data.researchUnlocked as string[]) : undefined,
      researchTree: isRecord(data.researchTree) ? (data.researchTree as TreeSave) : undefined,
      researchUnified: data.researchUnified === true,
      wave3: wave3
        ? {
            relations: wave3.relations,
            research: isRecord(wave3.research) ? (wave3.research as WaveResearch) : undefined,
          }
        : undefined,
    },
    fieldLevel,
  )
  const nextWave = wave3 ? { ...wave3, research: folded.wave3Research } : { relations: { rows: {} }, research: folded.wave3Research }
  return {
    ...data,
    researchPoints: folded.researchPoints,
    researchUnlocked: folded.researchUnlocked,
    researchTree: folded.researchTree,
    researchUnified: true,
    wave3: nextWave,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
