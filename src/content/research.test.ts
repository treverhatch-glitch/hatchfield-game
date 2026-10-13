import { describe, expect, it } from 'vitest'
import { RESEARCH_NODES } from '../game/catalog.ts'
import { TECH_NODES } from '../economy/techTree.ts'
import { RESEARCH_TIER4 } from './research_tier4.ts'
import { RESEARCH_TIER5 } from './research_tier5.ts'
import { validateResearchGraph, type ResearchDef } from './researchTypes.ts'

describe('Late tech tree research graph', () => {
  const catalogIds = RESEARCH_NODES.map((node) => node.id)
  const techNodeIds = TECH_NODES.map((node) => node.id)
  const knownIds = Array.from(new Set([...catalogIds, ...techNodeIds]))

  it('has valid tier 4 and tier 5 research item counts', () => {
    expect(RESEARCH_TIER4).toHaveLength(10)
    expect(RESEARCH_TIER5).toHaveLength(8)
  })

  it('has unique research IDs across tier 4, tier 5, and known IDs', () => {
    const allTier45 = [...RESEARCH_TIER4, ...RESEARCH_TIER5]
    const ids = allTier45.map((d) => d.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)

    for (const def of allTier45) {
      expect(knownIds).not.toContain(def.id)
    }
  })

  it('validates that the complete research graph is valid and cycle-free', () => {
    const defs = [...RESEARCH_TIER4, ...RESEARCH_TIER5]
    const errors = validateResearchGraph(defs, knownIds)
    expect(errors).toEqual([])
  })

  it('ensures research costs rise by tier', () => {
    const tier4Costs = RESEARCH_TIER4.map((d) => d.cost)
    const tier5Costs = RESEARCH_TIER5.map((d) => d.cost)

    const minTier4Cost = Math.min(...tier4Costs)
    const maxTier4Cost = Math.max(...tier4Costs)
    const minTier5Cost = Math.min(...tier5Costs)

    // All tier 4 costs should be positive and reasonable
    expect(minTier4Cost).toBeGreaterThan(0)
    // Minimum tier 5 cost should be higher than maximum tier 4 cost
    expect(minTier5Cost).toBeGreaterThan(maxTier4Cost)
  })

  it('detects injected cycles in the research graph', () => {
    // Inject a cycle: ct_scanners (tier 4) -> biometric_journey (tier 5) -> ct_scanners
    const defs: ResearchDef[] = [
      ...RESEARCH_TIER4.map((d) =>
        d.id === 'ct_scanners' ? { ...d, requires: [...d.requires, 'biometric_journey'] } : d
      ),
      ...RESEARCH_TIER5,
    ]

    const errors = validateResearchGraph(defs, knownIds)
    expect(errors.some((err) => err.includes('Cycle detected'))).toBe(true)
  })

  it('detects missing prerequisites', () => {
    const defs: ResearchDef[] = [
      {
        id: 'orphan_item',
        name: 'Orphan Item',
        tier: 4,
        cost: 100,
        days: 5,
        requires: ['non_existent_prereq_id'],
        unlocks: [],
        minFL: 4,
        blurb: 'Test item with invalid prerequisite.',
      },
    ]

    const errors = validateResearchGraph(defs, knownIds)
    expect(errors.some((err) => err.includes('missing prerequisite'))).toBe(true)
  })

  it('detects tier-order violations', () => {
    const defs: ResearchDef[] = [
      {
        id: 'tier4_invalid',
        name: 'Invalid Tier 4',
        tier: 4,
        cost: 70,
        days: 5,
        requires: ['tier5_item'],
        unlocks: [],
        minFL: 4,
        blurb: 'Tier 4 requiring Tier 5.',
      },
      {
        id: 'tier5_item',
        name: 'Tier 5 Item',
        tier: 5,
        cost: 120,
        days: 8,
        requires: [],
        unlocks: [],
        minFL: 5,
        blurb: 'Tier 5 item.',
      },
    ]

    const errors = validateResearchGraph(defs, knownIds)
    expect(errors.some((err) => err.includes('Tier-order violation'))).toBe(true)
  })
})
