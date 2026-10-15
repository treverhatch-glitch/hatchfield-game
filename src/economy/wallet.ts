import { DEFAULT_ECONOMY_CONFIG } from './engine.ts'
import { TECH_TREE, techNode } from './techTree.ts'
import type { EconomyState, TechNode } from './types.ts'
import { HELD_REASON, LIVE_TECH } from './wiring.ts'

export type WalletRole = 'live' | 'stepping' | 'held'
export type WalletState = 'owned' | 'buyable' | 'short' | 'locked' | 'held'

export interface WalletNodeView {
  id: string
  tier: number
  name: string
  description: string
  costRp: number
  fieldLevel: number
  role: WalletRole
  state: WalletState
  /** Why the node cannot be bought right now. Null when it can, or when it is owned. */
  reason: string | null
  /** What the player sees once it is owned. */
  shows: string
  /** Live nodes a stepping stone leads to. */
  opens: string[]
}

export interface WalletBranchView {
  id: string
  name: string
  nodes: WalletNodeView[]
}

export interface WalletView {
  points: number
  /** Fraction of the next whole point already earned. */
  progress: number
  fieldLevel: number
  branches: WalletBranchView[]
  /** Nodes the player can buy this moment. */
  buyable: number
  /** Cheapest node the player can buy this moment, or null. */
  nextBuy: string | null
  owned: number
  sources: string[]
}

const FIRST_NODE = TECH_TREE.flatMap((branch) => branch.nodes)

function transitiveRequires(id: string, seen = new Set<string>()): Set<string> {
  const node = techNode(id)
  if (!node) return seen
  for (const need of node.requires) {
    if (seen.has(need)) continue
    seen.add(need)
    transitiveRequires(need, seen)
  }
  return seen
}

const OPENS = new Map<string, string[]>()
for (const live of Object.keys(LIVE_TECH)) {
  for (const need of transitiveRequires(live)) {
    const list = OPENS.get(need) ?? []
    list.push(live)
    OPENS.set(need, list)
  }
}

export function walletRole(id: string): WalletRole {
  if (LIVE_TECH[id]) return 'live'
  if (OPENS.has(id)) return 'stepping'
  return 'held'
}

/** True when the sim reads this node, or it is a step toward one that it reads. */
export function walletCanSell(id: string): boolean {
  return walletRole(id) !== 'held'
}

function nameOf(id: string): string {
  return techNode(id)?.name ?? id
}

function stateOf(
  node: TechNode,
  role: WalletRole,
  state: Pick<EconomyState, 'researchPoints' | 'unlockedTech' | 'fieldLevel'>,
  fieldLevel: number,
  free: boolean,
): { state: WalletState; reason: string | null } {
  const owned = new Set(state.unlockedTech)
  if (owned.has(node.id)) return { state: 'owned', reason: null }
  if (role === 'held') return { state: 'held', reason: HELD_REASON }
  const missing = node.requires.find((need) => !owned.has(need))
  if (missing) return { state: 'locked', reason: `Needs ${nameOf(missing)} first.` }
  if (fieldLevel < node.fieldLevel) return { state: 'locked', reason: `Needs Field level ${node.fieldLevel}.` }
  if (!free && state.researchPoints < node.costRp) {
    const short = node.costRp - state.researchPoints
    return { state: 'short', reason: `${short} more RP.` }
  }
  return { state: 'buyable', reason: null }
}

export function sourceLines(): string[] {
  const cfg = DEFAULT_ECONOMY_CONFIG
  return [
    `${cfg.fieldLevelRp} RP each time the field reaches a new level.`,
    `${cfg.bottleneckClearRp} RP each time a bottleneck the airport reported clears.`,
    `${(cfg.operationRpPerRealMinute * 3).toFixed(3)} RP a game day once flights are turning.`,
    `${(cfg.researcherRpPerRealMinute * 3).toFixed(3)} RP a game day for each researcher at a powered desk.`,
  ]
}

/** Wallet sheet model. `free` is the dev sandbox, where spending never fails. */
export function walletView(
  state: Pick<EconomyState, 'researchPoints' | 'researchProgress' | 'unlockedTech' | 'fieldLevel'>,
  fieldLevel: number,
  free = false,
): WalletView {
  let buyable = 0
  let nextBuy: WalletNodeView | null = null
  const branches = TECH_TREE.map((branch): WalletBranchView => {
    const nodes = branch.nodes.map((node): WalletNodeView => {
      const role = walletRole(node.id)
      const status = stateOf(node, role, state, fieldLevel, free)
      const view: WalletNodeView = {
        id: node.id,
        tier: node.tier,
        name: node.name,
        description: node.description,
        costRp: node.costRp,
        fieldLevel: node.fieldLevel,
        role,
        state: status.state,
        reason: status.reason,
        shows:
          LIVE_TECH[node.id]?.shows ??
          (role === 'stepping'
            ? `A step toward ${(OPENS.get(node.id) ?? []).map(nameOf).join(', ')}.`
            : HELD_REASON),
        opens: role === 'stepping' ? (OPENS.get(node.id) ?? []).map(nameOf) : [],
      }
      if (status.state === 'buyable') {
        buyable += 1
        if (!nextBuy || node.costRp < nextBuy.costRp) nextBuy = view
      }
      return view
    })
    return { id: branch.id, name: branch.name, nodes }
  })
  const owned = new Set(state.unlockedTech)
  return {
    points: Math.floor(state.researchPoints),
    progress: Math.max(0, Math.min(1, state.researchProgress)),
    fieldLevel,
    branches,
    buyable,
    nextBuy: (nextBuy as WalletNodeView | null)?.id ?? null,
    owned: FIRST_NODE.filter((node) => owned.has(node.id)).length,
    sources: sourceLines(),
  }
}

/** Gate for the sim. Returns a refusal sentence, or null when the node may be bought. */
export function walletRefusal(
  id: string,
  state: Pick<EconomyState, 'researchPoints' | 'unlockedTech' | 'fieldLevel'>,
  fieldLevel: number,
  free = false,
): string | null {
  const node = techNode(id)
  if (!node) return 'Unknown technology.'
  const status = stateOf(node, walletRole(id), state, fieldLevel, free)
  if (status.state === 'owned') return `${node.name} is already owned.`
  if (status.state === 'buyable') return null
  return `${node.name}: ${status.reason ?? 'not available.'}`
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/** Read a saved economy block. Unknown tech ids are dropped; a missing block starts fresh. */
export function restoreEconomyState(saved: unknown): EconomyState | null {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null
  const rec = saved as Record<string, unknown>
  return {
    elapsedSimMinutes: Math.max(0, finite(rec.elapsedSimMinutes)),
    fieldLevel: Math.max(1, Math.floor(finite(rec.fieldLevel, 1))),
    researchPoints: Math.max(0, Math.floor(finite(rec.researchPoints))),
    researchProgress: Math.max(0, Math.min(0.999, finite(rec.researchProgress))),
    unlockedTech: [...new Set(strings(rec.unlockedTech))].filter((id) => techNode(id)),
    claimedMilestones: strings(rec.claimedMilestones),
    clearedBottlenecks: strings(rec.clearedBottlenecks),
    transitTier: rec.transitTier === 'rail' || rec.transitTier === 'bus' ? rec.transitTier : 'road',
    housingTier: [0, 1, 2, 3].includes(rec.housingTier as number) ? (rec.housingTier as EconomyState['housingTier']) : 0,
    powerPlantTier: [1, 2, 3].includes(rec.powerPlantTier as number)
      ? (rec.powerPlantTier as EconomyState['powerPlantTier'])
      : 1,
  }
}
