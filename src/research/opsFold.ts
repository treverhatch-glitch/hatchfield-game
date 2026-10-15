import { nodeById } from './nodes.ts'
import type { ResearchState } from './types.ts'

/**
 * Live economy-tech ids the airport still reads, each folded onto one
 * existing Growth node. Buying that node is the spend. A save that already
 * owns the economy id is granted the node, so the purchase is not lost.
 */
export const OPS_LIVE_TO_NODE: Readonly<Record<string, string>> = {
  'sustainability.t1': 'spec-green-3',
  'sustainability.t2': 'spec-green-5',
  'safety_security.t2': 'safety-4',
  'cargo.t4': 'spec-cargo-2',
  'maintenance.t4': 'airside-5',
}

export function growthNodeForOpsTech(id: string): string | null {
  const nodeId = OPS_LIVE_TO_NODE[id]
  return nodeId && nodeById(nodeId) ? nodeId : null
}

export interface OpsResearchPot {
  researchPoints: number
  researchProgress: number
  unlockedTech: readonly string[]
}

export interface OpsFold {
  tree: ResearchState
  granted: string[]
}

function banked(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Move a saved Ops balance onto the Growth tree and grant the Growth node
 * for each live economy tech the save already owns. An empty pot does not
 * add points again.
 */
export function foldOpsWallet(tree: ResearchState, pot: OpsResearchPot | null): OpsFold {
  const unlocked = new Set(tree.unlocked)
  const granted: string[] = []
  if (pot) {
    for (const id of pot.unlockedTech) {
      const nodeId = growthNodeForOpsTech(id)
      if (!nodeId || unlocked.has(nodeId)) continue
      unlocked.add(nodeId)
      granted.push(nodeId)
    }
  }
  const extra = pot ? banked(pot.researchPoints) + banked(pot.researchProgress) : 0
  const sum = tree.carry + extra
  const whole = Math.floor(sum)
  return {
    granted,
    tree: {
      ...tree,
      points: tree.points + whole,
      carry: sum - whole,
      unlocked: [...unlocked],
    },
  }
}
