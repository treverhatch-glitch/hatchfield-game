import { describe, expect, it } from 'vitest'
import { FEE_FIELDS } from '../commercial/fees'
import { ROOMS } from '../game/catalog'
import { ITEMS } from '../game/terminal'
import { HALL_ROOMS, KIT_TABS } from './uiCatalog'

const BANNED = /^(ops|specs|spec|ads|ad|late|todo|tbd|lorem|placeholder|click me|button|xxx|wip|n\/a|test|figure)$/i

describe('hall kit catalog', () => {
  it('gives every hall room one desk and puts shops on the commercial kit tab', () => {
    const placed = [
      ...HALL_ROOMS.services,
      ...HALL_ROOMS.commercial,
      ...HALL_ROOMS.research,
    ]
    expect(new Set(placed).size).toBe(placed.length)
    expect(placed.slice().sort()).toEqual(ROOMS.map((room) => room.id).sort())
    expect(KIT_TABS.map((tab) => tab.label)).toContain('Commercial')
    expect(KIT_TABS.map((tab) => tab.id)).not.toContain('food')
    for (const id of ['fast_food', 'cafe', 'restaurant', 'newsagent']) {
      expect(ITEMS.find((item) => item.id === id)?.category).toBe('commercial')
    }
  })

  it('rejects duplicate and placeholder fee labels', () => {
    const feeLabels = FEE_FIELDS.map((field) => field.label)
    expect(new Set(feeLabels).size).toBe(feeLabels.length)
    for (const label of feeLabels) expect(label).not.toMatch(BANNED)
  })
})
