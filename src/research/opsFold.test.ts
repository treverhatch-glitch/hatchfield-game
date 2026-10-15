import { describe, expect, it } from 'vitest'
import { RESEARCH_NODES } from './nodes.ts'
import { BUILD_LINKS } from './links.ts'
import { OPS_LIVE_TO_NODE, foldOpsWallet, growthNodeForOpsTech } from './opsFold.ts'
import { emptyResearchState } from './logic.ts'

describe('ops wallet fold', () => {
  it('maps every live economy tech onto a real Growth node', () => {
    const ids = new Set(RESEARCH_NODES.map((node) => node.id))
    for (const [techId, nodeId] of Object.entries(OPS_LIVE_TO_NODE)) {
      expect(ids.has(nodeId), techId).toBe(true)
      expect(growthNodeForOpsTech(techId)).toBe(nodeId)
    }
    expect(growthNodeForOpsTech('commercial.t1')).toBeNull()
    expect(BUILD_LINKS.cold_store).toBe(OPS_LIVE_TO_NODE['cargo.t4'])
  })

  it('moves the banked balance once and grants the node the player already bought', () => {
    const first = foldOpsWallet(emptyResearchState(), {
      researchPoints: 7,
      researchProgress: 0.4,
      unlockedTech: ['cargo.t4', 'commercial.t1'],
    })
    expect(first.tree.points).toBe(7)
    expect(first.tree.carry).toBeCloseTo(0.4, 8)
    expect(first.tree.unlocked).toEqual(['spec-cargo-2'])
    expect(first.granted).toEqual(['spec-cargo-2'])

    const again = foldOpsWallet(first.tree, {
      researchPoints: 0,
      researchProgress: 0,
      unlockedTech: ['cargo.t4'],
    })
    expect(again.tree.points).toBe(7)
    expect(again.tree.carry).toBeCloseTo(0.4, 8)
    expect(again.tree.unlocked).toEqual(['spec-cargo-2'])
    expect(again.granted).toEqual([])
  })
})
