import { describe, expect, it } from 'vitest'
import { AIRFRAMES } from '../game/airframes.ts'
import { filterSpawnFleet, JUMBO_RELATION_TIER } from './fleetGrowth.ts'

const listed = (ids: string[]) => ids.map((id) => AIRFRAMES[id]!).filter(Boolean)

describe('fleet growth gates jumbo spawn', () => {
  it('keeps a small airline off the A380 even after the relationship is flagship', () => {
    const fleet = filterSpawnFleet(listed(['bn2', 'dhc6', 'a380']), 1, 5).map((af) => af.id)
    expect(fleet).not.toContain('a380')
    expect(fleet).toEqual(['bn2', 'dhc6'])
  })

  it('holds the A380 for a new flagship that can still fly the 777', () => {
    const fleet = filterSpawnFleet(listed(['a380', 'b77w']), 5, 1).map((af) => af.id)
    expect(fleet).toEqual(['b77w'])
    expect(JUMBO_RELATION_TIER).toBe(4)
  })

  it('releases the A380 once that flagship reaches Bigger aircraft', () => {
    const fleet = filterSpawnFleet(listed(['a380', 'b77w']), 5, JUMBO_RELATION_TIER).map((af) => af.id)
    expect(fleet).toContain('a380')
    expect(fleet).toContain('b77w')
  })
})
