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
