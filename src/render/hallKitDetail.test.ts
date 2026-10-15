import { describe, expect, it } from 'vitest'
import { ITEMS, type PlacedItem } from '../game/terminal'
import { buildHallDetail, HALL_ITEM_PROP } from './hallKitDetail'
import { TERMINAL_PROP_TYPES } from './terminalProps'

describe('hall kit detailed models', () => {
  it('maps real catalog ids to registered prop types', () => {
    const ids = new Set(ITEMS.map((i) => i.id as string))
    for (const [id, t] of Object.entries(HALL_ITEM_PROP)) {
      expect(ids.has(id), id).toBe(true)
      expect(TERMINAL_PROP_TYPES).toContain(t)
    }
    for (const id of ['departures_wall', 'gate_pylon', 'kiosk', 'bag_drop', 'claim_carousel', 'passport_booth']) {
      expect(ids.has(id)).toBe(true)
    }
  })
  it('splits mapped items from low-poly ones', () => {
    const it = (def: string, id: string): PlacedItem => ({ id, def, c: 0, r: 0, wear: 0, rot: 1 }) as PlacedItem
    const { group, rest } = buildHallDetail(
      [
        { item: it('kiosk', 'a'), x: 0, z: 0 },
        { item: it('gate_pylon', 'b'), x: 3, z: 0 },
        { item: it('art', 'c'), x: 6, z: 0 },
      ],
      8,
      5,
    )
    expect(rest.map((r) => r.item.id)).toEqual(['c'])
    expect(group.children.length).toBeGreaterThan(3)
  })
})
