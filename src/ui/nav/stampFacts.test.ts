import { describe, expect, it } from 'vitest'
import { unlocksAtLevel } from './levelUnlocks.ts'
import { stampCard, toolStampInput } from './stampFacts.ts'
import { STAMP_HOVER_MS } from './taxonomy.ts'

describe('stamp cards', () => {
  it('waits 400 ms before a hover card and names a field-level lock', () => {
    expect(STAMP_HOVER_MS).toBe(400)
    const locked = stampCard(toolStampInput('saf_blending', 1, 1, new Set()))
    expect(locked.locked).toBe(true)
    expect(locked.badge).toEqual({ kind: 'research', label: 'SAF blend', nodeId: 'spec-green-1' })
    expect(locked.sentence).toContain('Requires research: SAF blend (Specialisations T1).')
    expect(locked.sentence).toContain('Field level 8')
    expect(locked.link?.tab).toBe('research')
    const card = stampCard(toolStampInput('saf_blending', 1, 1, new Set(), new Set(['spec-green-1'])))
    expect(card.locked).toBe(true)
    expect(card.badge).toEqual({ kind: 'field', label: 'Field level 8' })
    expect(card.sentence).toBe('Unlocks at Field level 8.')
    expect(card.link).toEqual({ tab: 'levels', anchor: 'level-8', label: 'Field level 8' })
    expect(card.price).not.toBe('Refund')
    expect(card.upkeep).toMatch(/day/)
  })

  it('wears the research node badge, including its name, even before the field level', () => {
    const early = stampCard(toolStampInput('stand_w', 1, 1, new Set()))
    expect(early.badge).toEqual({ kind: 'research', label: 'Large stands', nodeId: 'airfield-3' })
    expect(early.sentence).toContain('Requires research: Large stands (Airfield T3).')
    expect(early.sentence).not.toContain('Widebody ops')
    expect(early.sentence).toContain('Field level 4')
    expect(early.link).toEqual({
      tab: 'research',
      anchor: 'research-node-airfield-3',
      label: 'Large stands',
    })

    const levelOnly = stampCard(
      toolStampInput('stand_w', 1, 1, new Set(['widebody_ops']), new Set(['airfield-3'])),
    )
    expect(levelOnly.badge).toEqual({ kind: 'field', label: 'Field level 4' })
    expect(levelOnly.sentence).toBe('Unlocks at Field level 4.')

    const treeOwned = stampCard(toolStampInput('stand_w', 4, 4, new Set(), new Set(['airfield-3'])))
    expect(treeOwned.locked).toBe(false)
    expect(treeOwned.badge).toBeNull()
    expect(treeOwned.sentence).toBeNull()

    const owned = stampCard(
      toolStampInput('stand_w', 4, 4, new Set(['widebody_ops']), new Set(['airfield-3'])),
    )
    expect(owned.locked).toBe(false)
    expect(owned.link).toBeNull()
  })

  it('puts price, upkeep, capacity, and noise on the card', () => {
    const runway = stampCard(toolStampInput('runway_heavy', 5, 5, new Set()))
    expect(runway.price).not.toBe('—')
    expect(runway.capacity).toBe('20 × 3 cells')
    expect(runway.upkeep).toBe('None')
    const night = stampCard(toolStampInput('nighthub', 4, 4, new Set()))
    expect(night.noise).toBe('The city bills it')
    const hotel = stampCard(toolStampInput('airport_hotel', 7, 7, new Set(), new Set(['landside-6'])))
    expect(hotel.capacity).toBe('120 rooms')
    expect(hotel.locked).toBe(false)
    const hotelLocked = stampCard(toolStampInput('airport_hotel', 7, 7, new Set()))
    expect(hotelLocked.badge).toEqual({ kind: 'research', label: 'Airport hotel', nodeId: 'landside-6' })
  })

  it('names Fuel rail on the rail and the oil station, and leaves Night bank on the night hub', () => {
    const rail = stampCard(toolStampInput('fuel_rail', 1, 1, new Set()))
    const oil = stampCard(toolStampInput('oil', 1, 1, new Set()))
    const night = stampCard(toolStampInput('nighthub', 1, 1, new Set()))
    expect(rail.badge).toEqual({ kind: 'research', label: 'Fuel rail', nodeId: 'airside-6' })
    expect(rail.sentence).toContain('Research Fuel rail')
    expect(rail.sentence).toContain('map edge')
    expect(rail.sentence).toContain('oil station')
    expect(rail.sentence).not.toContain('Night bank')
    expect(oil.badge?.label).toBe('Fuel rail')
    expect(oil.sentence).toContain('beside the farm')
    expect(oil.sentence).not.toContain('Night bank')
    expect(night.badge).toEqual({ kind: 'research', label: 'Night bank', nodeId: 'airside-6' })
    const pipe = stampCard(toolStampInput('fuel_pipe', 5, 5, new Set()))
    const manifold = stampCard(toolStampInput('manifold', 5, 5, new Set()))
    expect(pipe.badge).toEqual({ kind: 'research', label: 'Fuel pipeline', nodeId: 'airside-7' })
    expect(pipe.sentence).toContain('Paint the pipe')
    expect(pipe.sentence).toContain('receipt manifold')
    expect(manifold.badge?.label).toBe('Fuel pipeline')
    expect(manifold.sentence).toContain('beside the farm')
  })

  it('names the hydrant research on the pit, then the field level once that research is owned', () => {
    const locked = stampCard(toolStampInput('hydrant', 5, 5, new Set()))
    expect(locked.locked).toBe(true)
    expect(locked.badge).toEqual({ kind: 'research', label: 'Hydrant', nodeId: 'airside-1' })
    expect(locked.sentence).toContain('Research the hydrant system')
    expect(locked.sentence).toContain('Stamp the pit on a stand')
    expect(locked.link).toEqual({
      tab: 'research',
      anchor: 'research-node-airside-1',
      label: 'Hydrant',
    })
    const level = stampCard(toolStampInput('hydrant', 1, 1, new Set(['hydrant_fuel'])))
    expect(level.badge).toEqual({ kind: 'field', label: 'Field level 5' })
    expect(level.sentence).toBe('Unlocks at Field level 5.')
    const open = stampCard(toolStampInput('hydrant', 5, 5, new Set(['hydrant_fuel'])))
    expect(open.locked).toBe(false)
    expect(open.badge).toBeNull()
  })
})

describe('field level unlocks', () => {
  it('lists the heavy runway at field level 5 and research that opens there', () => {
    const names = unlocksAtLevel(5).map((row) => row.name)
    expect(names).toContain('Heavy runway')
    expect(names).toContain('Heavy metal pack')
    expect(unlocksAtLevel(4).map((row) => row.name)).toContain('Widebody ops')
    expect(unlocksAtLevel(8).map((row) => row.name)).toContain('SAF blending')
  })
})
