import { RESEARCH_NODES } from './nodes.ts'

/**
 * Small, stacked bonuses for tree nodes that do not open a stamp or a legacy
 * project. Identity (1, or 0 cargo) when nothing in that column is owned.
 * Tunables live here so the sim only multiplies.
 */
export const MOD_TURN = 0.99
export const MOD_SECURITY = 0.98
export const MOD_RETAIL = 1.02
export const MOD_CARGO = 40
export const MOD_DEMAND = 1.01

export type ModField = 'turn' | 'security' | 'retail' | 'cargo' | 'demand'

/**
 * One field per node that is not already a build gate or a desk project.
 * The sim reads every field in `researchMods`.
 */
export const NODE_MODS: Readonly<Record<string, ModField>> = {
  'airfield-1': 'turn',
  'terminal-1': 'security',
  'landside-1': 'demand',
  'landside-3': 'retail',
  'landside-4': 'demand',
  'safety-1': 'security',
  'safety-2': 'turn',
  'safety-3': 'security',
  'retail-3': 'retail',
  'retail-4': 'retail',
  'retail-5': 'demand',
  'retail-6': 'retail',
  'spec-charter': 'demand',
  'spec-hub-1': 'demand',
  'spec-hub-2': 'turn',
  'spec-hub-3': 'security',
  'spec-hub-4': 'demand',
  'spec-hub-5': 'retail',
  'spec-cargo-1': 'cargo',
  'spec-cargo-2': 'cargo',
  'spec-cargo-3': 'cargo',
  'spec-cargo-4': 'cargo',
  'spec-cargo-5': 'cargo',
  'spec-lowcost-1': 'turn',
  'spec-lowcost-2': 'turn',
  'spec-lowcost-3': 'retail',
  'spec-lowcost-4': 'demand',
  'spec-lowcost-5': 'turn',
  'spec-premium-1': 'security',
  'spec-premium-2': 'security',
  'spec-premium-3': 'retail',
  'spec-premium-4': 'demand',
  'spec-premium-5': 'retail',
  'spec-green-2': 'turn',
  'spec-green-3': 'demand',
  'spec-green-4': 'cargo',
  'spec-green-5': 'retail',
}

export interface ResearchMods {
  /** Multiplier on turnaround minutes. */
  turn: number
  /** Multiplier on security screening time. */
  security: number
  /** Multiplier on retail spend. */
  retail: number
  /** Extra cargo warehouse tonnes. */
  cargo: number
  /** Multiplier on the player's share of catchment demand. */
  demand: number
}

const AMOUNT: Record<ModField, number> = {
  turn: MOD_TURN,
  security: MOD_SECURITY,
  retail: MOD_RETAIL,
  cargo: MOD_CARGO,
  demand: MOD_DEMAND,
}

export function researchMods(unlocked: readonly string[]): ResearchMods {
  const mods: ResearchMods = { turn: 1, security: 1, retail: 1, cargo: 0, demand: 1 }
  const owned = new Set(unlocked)
  for (const node of RESEARCH_NODES) {
    const field = NODE_MODS[node.id]
    if (!field || !owned.has(node.id)) continue
    if (field === 'cargo') mods.cargo += AMOUNT.cargo
    else mods[field] *= AMOUNT[field]
  }
  return mods
}

/** Fields the sim is expected to read. Tests fail if a column is dropped. */
export const CONSUMED_MOD_FIELDS: readonly ModField[] = ['turn', 'security', 'retail', 'cargo', 'demand']
