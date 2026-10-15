import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResearchTree } from '../ui/research/ResearchTree.tsx'
import { OPS_RP_PER_SEC, RESEARCH_DAY_SEC, ROOM_RP_PER_SEC, SPEC_PENALTY, STAFF_ROOM_BOOST, TIER_COSTS } from './config.ts'
import { ResearchEngine } from './engine.ts'
import { linkFor } from './links.ts'
import { accrue, buyNode, emptyResearchState, lockCopy, nodeCost, nodeState, researchRate, shortfallCopy } from './logic.ts'
import type { ResearchState, RoomCounts } from './types.ts'
import { RESEARCH_NODES, nodesInCategory } from './nodes.ts'

describe('research tree', () => {
  it('charges nothing for a category first node and more for each deeper tier', () => {
    for (let i = 2; i < TIER_COSTS.length; i++) {
      expect(TIER_COSTS[i]).toBeGreaterThan(TIER_COSTS[i - 1]!)
    }
    for (const category of ['airfield', 'terminal', 'airside', 'landside', 'safety', 'retail'] as const) {
      const nodes = nodesInCategory(category)
      expect(nodes.map((node) => node.baseCost)).toEqual([...TIER_COSTS])
      expect(nodes[0]?.baseCost).toBe(0)
      expect(nodes[0]?.requires).toEqual([])
      for (let i = 1; i < nodes.length; i++) {
        expect(nodes[i]?.requires).toEqual([nodes[i - 1]!.id])
      }
    }
  })

  it('keeps a category locked until its field level, then offers the free node', () => {
    const state = emptyResearchState()
    const safety = nodesInCategory('safety')[0]!
    expect(nodeState(state, safety, 1)).toBe('locked')
    expect(nodeState(state, safety, 3)).toBe('available')
    const bought = buyNode(state, safety.id, 3)
    expect(bought.ok).toBe(true)
    expect(bought.state.points).toBe(0)
    expect(bought.state.unlocked).toContain(safety.id)
  })

  it('lets furnished rooms earn with no staff, and lets staff raise only that room rate', () => {
    const empty = { desk: 0, board: 0, machine: 0 }
    const careful = { desk: 1, board: 1, machine: 1 }
    const roomSum = ROOM_RP_PER_SEC.desk + ROOM_RP_PER_SEC.board + ROOM_RP_PER_SEC.machine
    expect(researchRate(empty, true, 0)).toBe(OPS_RP_PER_SEC)
    expect(researchRate(empty, true, 3)).toBe(OPS_RP_PER_SEC)
    expect(researchRate(careful, true, 0)).toBeCloseTo(OPS_RP_PER_SEC + roomSum, 5)
    expect(researchRate(careful, true, 2)).toBeCloseTo(OPS_RP_PER_SEC + roomSum * (1 + 2 * STAFF_ROOM_BOOST), 5)
    const day = researchRate(careful, true, 0) * RESEARCH_DAY_SEC
    expect(day).toBeLessThan(TIER_COSTS[1]!)
    expect(TIER_COSTS[1]).toBeGreaterThan(0)
  })

  it('earns a passive trickle before any staff or rooms', () => {
    const engine = new ResearchEngine()
    engine.tick(180, true, { desk: 0, board: 0, machine: 0 })
    expect(engine.points()).toBeGreaterThan(0)
    expect(engine.points() + engine.state.carry).toBeCloseTo(OPS_RP_PER_SEC * 180, 5)
    const idle = new ResearchEngine()
    idle.tick(600, false, { desk: 1, board: 1, machine: 1 })
    expect(idle.points()).toBe(0)
  })

  it('says how many days the shortfall takes at the current rate', () => {
    expect(shortfallCopy(0, 3, OPS_RP_PER_SEC)).toBe('Need 3 more RP (~2 days)')
    expect(shortfallCopy(3, 3, OPS_RP_PER_SEC)).toBeNull()
  })

  it('names the field level when Airside is shut, and the previous node once the category is open', () => {
    const state = emptyResearchState()
    const airside = nodesInCategory('airside')
    const first = airside[0]!
    const next = airside[1]!
    expect(lockCopy(state, first, 1)).toBe('Needs Field Level 2.')
    expect(lockCopy(state, next, 1)).toBe('Needs Field Level 2.')
    expect(lockCopy(state, next, 2)).toBe(`Research ${first.name} first.`)
    expect(first.name).toBe('Fuel farm')
    const owned = buyNode(state, first.id, 2).state
    expect(lockCopy(owned, first, 2)).toBeNull()
    expect(nodeState(owned, next, 2)).toBe('available')
    expect(lockCopy(owned, next, 2)).toBeNull()
  })

  it('shows the missing gate on a locked card and the point shortfall on an available one', () => {
    const shut = renderToStaticMarkup(
      createElement(ResearchTree, {
        state: emptyResearchState(),
        fieldLevel: 1,
        ratePerSec: OPS_RP_PER_SEC,
        focusId: 'airside-1',
        onUnlock: () => {},
      }),
    )
    expect(shut).toContain('Needs Field Level 2.')
    expect(shut).toContain('data-testid="research-lock"')
    expect(shut).toContain('data-testid="research-node-airside-1"')
    expect(shut).toContain('data-testid="research-node-airside-2"')
    expect(shut).toContain('data-state="locked"')
    expect(shut).toContain('>Locked<')

    const open = buyNode(emptyResearchState(), 'airside-1', 2).state
    const short = renderToStaticMarkup(
      createElement(ResearchTree, {
        state: open,
        fieldLevel: 2,
        ratePerSec: OPS_RP_PER_SEC,
        focusId: 'airside-2',
        onUnlock: () => {},
      }),
    )
    expect(short).toContain('Need 50 more RP')
    expect(short).toContain('Available')
    expect(short).not.toContain('data-testid="research-lock"')
    expect(short).toContain('data-state="locked"')
    expect(short).not.toContain('>Locked<')
  })

  it('opens specialisations at mid-game and prices the other branches higher', () => {
    const charter = RESEARCH_NODES.find((node) => node.id === 'spec-charter')!
    expect(nodeState(emptyResearchState(), charter, 3)).toBe('locked')
    expect(nodeState(emptyResearchState(), charter, 4)).toBe('available')
    let state = buyNode(emptyResearchState(), charter.id, 4).state
    state = { ...state, points: TIER_COSTS[1] }
    const hub = buyNode(state, 'spec-hub-1', 4)
    expect(hub.ok).toBe(true)
    expect(hub.state.primarySpec).toBe('hub')
    const cargo = RESEARCH_NODES.find((node) => node.id === 'spec-cargo-1')!
    expect(nodeCost(hub.state, cargo)).toBe(Math.ceil(cargo.baseCost * SPEC_PENALTY))
    expect(nodeCost(hub.state, RESEARCH_NODES.find((node) => node.id === 'spec-hub-2')!)).toBe(TIER_COSTS[2])
  })

  it('pays cash and research points when the field level rises, once', () => {
    const engine = new ResearchEngine()
    const first = engine.claimNewLevels(2)
    expect(first).toEqual([{ level: 2, cash: 2_500, rp: 2 }])
    expect(engine.points()).toBe(2)
    expect(engine.claimNewLevels(2)).toEqual([])
    expect(engine.points()).toBe(2)
  })

  it('paces one lab to about a third of the tree by day 30 and the rest after day 120', () => {
    const careful = playDays(30, { desk: 1, board: 1, machine: 1 }, 0)
    const share30 = careful / RESEARCH_NODES.length
    expect(share30).toBeGreaterThanOrEqual(0.25)
    expect(share30).toBeLessThanOrEqual(0.35)
    expect(playDays(22, { desk: 1, board: 1, machine: 1 }, 0)).toBeLessThan(RESEARCH_NODES.length)
    const share120 = playDays(120, { desk: 1, board: 1, machine: 1 }, 0) / RESEARCH_NODES.length
    expect(share120).toBeGreaterThanOrEqual(0.9)
    expect(share120).toBeLessThan(1)
    expect(playDays(150, { desk: 1, board: 1, machine: 1 }, 0)).toBe(RESEARCH_NODES.length)
    const staffed = playDays(30, { desk: 2, board: 2, machine: 2 }, 2)
    expect(staffed / RESEARCH_NODES.length).toBeGreaterThan(share30)
    expect(playDays(60, { desk: 2, board: 2, machine: 2 }, 2)).toBe(RESEARCH_NODES.length)
  })

  it('links a locked build item to its node', () => {
    const link = linkFor('stand_l')
    expect(link?.label).toBe('Large stands (Airfield T3)')
    const engine = new ResearchEngine()
    expect(engine.blockReason('stand_l')).toBe('Requires research: Large stands (Airfield T3).')
    expect(engine.blockReason('runway')).toBeNull()
  })
})

/** Field level 4, so every category is open and points are the only limit. Buys the cheapest node whenever it is affordable. */
function playDays(days: number, rooms: RoomCounts, staff: number): number {
  let state: ResearchState = emptyResearchState()
  for (let day = 0; day < days; day++) {
    state = accrue(state, RESEARCH_DAY_SEC, rooms, true, staff)
    while (true) {
      const open = RESEARCH_NODES.filter((node) => nodeState(state, node, 4) === 'available').sort(
        (a, b) => nodeCost(state, a) - nodeCost(state, b) || a.id.localeCompare(b.id),
      )
      const next = open[0]
      if (!next) break
      const bought = buyNode(state, next.id, 4)
      if (!bought.ok) break
      state = bought.state
    }
  }
  return state.unlocked.length
}
