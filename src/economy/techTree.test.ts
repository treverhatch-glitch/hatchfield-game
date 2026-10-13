import { describe, expect, it } from 'vitest'
import { EconomyEngine } from './engine.ts'
import { TECH_TREE, availableTech } from './techTree.ts'

describe('economy tech tree', () => {
  it('contains nine independent four-tier branches with doubling costs', () => {
    expect(TECH_TREE).toHaveLength(9)
    for (const branch of TECH_TREE) {
      expect(branch.nodes).toHaveLength(4)
      expect(branch.nodes.map((node) => node.costRp)).toEqual([1, 2, 4, 8])
      expect(branch.nodes.map((node) => node.fieldLevel)).toEqual([1, 3, 5, 8])
    }
  })

  it('gates tiers by field level and prior nodes', () => {
    const unlocked = new Set<string>()
    expect(availableTech(1, unlocked)).toHaveLength(9)
    unlocked.add('terminal_ops.t1')
    expect(availableTech(2, unlocked).some((node) => node.id === 'terminal_ops.t2')).toBe(false)
    expect(availableTech(3, unlocked).some((node) => node.id === 'terminal_ops.t2')).toBe(true)
  })

  it('requires powered infrastructure before jet bridges', () => {
    const unlocked = new Set(['airside_ops.t1'])
    expect(availableTech(3, unlocked).some((node) => node.id === 'airside_ops.t2')).toBe(false)
    unlocked.add('sustainability.t1')
    expect(availableTech(3, unlocked).some((node) => node.id === 'airside_ops.t2')).toBe(true)
  })

  it('spends RP and exposes technology modifiers', () => {
    const engine = new EconomyEngine()
    engine.setOperational(true)
    engine.setStaffPools({ researcher: { hired: 8, wagePerDay: 100 } })
    engine.setResearchRooms([{ id: 'lab', desks: 8, powerDemand: 20 }])
    engine.tick(20)
    expect(engine.snapshot().state.researchPoints).toBeGreaterThanOrEqual(2)
    expect(engine.unlockTech('terminal_ops.t1')).toBe(true)
    expect(engine.getModifier('terminal.checkinSpeed')).toBe(1.3)
    expect(engine.unlockTech('terminal_ops.t2')).toBe(false)
  })
})
