import { describe, expect, it } from 'vitest'
import { HALL_D, HALL_W, ITEMS, itemDef, PREFAB_I_OPEN, schemeItems, type PlacedItem } from '../game/terminal'
import { itemSize } from '../game/terminalKit'
import { buildHallDetail, HALL_ITEM_PROP, HALL_REAL_SCALE, HALL_REAL_SIZE, hallDetailScale } from './hallKitDetail'
import { fitScale, TERMINAL_PROP_TYPES, terminalProp } from './terminalProps'

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

  it('keeps security, bag drop, claim, passport, and shop counters near the check-in scale', () => {
    const cols = 8
    const rows = 5
    const cw = HALL_W / cols
    const ch = HALL_D / rows
    const service = [
      'security_small',
      'security_medium',
      'security_large',
      'scanner',
      'bag_drop',
      'claim_carousel',
      'passport_booth',
      'cafe',
      'fast_food',
      'restaurant',
      'newsagent',
    ] as const
    for (const id of service) {
      const type = HALL_ITEM_PROP[id]
      expect(HALL_REAL_SIZE.has(type), id).toBe(true)
      const slots = itemSize(itemDef(id))
      const w = (slots >= 2 ? cw : cw / 2) * 0.92
      const d = (slots >= 4 ? ch : ch / 2) * 0.92
      const fit = fitScale(type, w, d)
      const scale = hallDetailScale(type, fit)
      expect(scale, id).toBeGreaterThanOrEqual(HALL_REAL_SCALE)
      expect(scale, id).toBeGreaterThanOrEqual(fit)
      expect(scale, id).toBeLessThanOrEqual(1)
    }
    const placed = (def: string): PlacedItem => ({ id: def, def, c: 0, r: 0, wear: 0, rot: 0 }) as PlacedItem
    const built = buildHallDetail(
      [
        { item: placed('claim_carousel'), x: 4, z: -2 },
        { item: placed('cafe'), x: -6, z: 3 },
        { item: placed('security_small'), x: -18, z: 0 },
      ],
      cols,
      rows,
    )
    const claimRig = built.group.getObjectByName('sockets:baggage_carousel')
    const cafeRig = built.group.getObjectByName('sockets:shop_coffee')
    expect(claimRig?.scale.x).toBeGreaterThanOrEqual(HALL_REAL_SCALE)
    expect(cafeRig?.scale.x).toBeGreaterThanOrEqual(HALL_REAL_SCALE)
    // Decor stays fitted. A real-size planter would not match the service kit.
    expect(HALL_REAL_SIZE.has('planter')).toBe(false)
    expect(hallDetailScale('planter', 0.4)).toBe(0.4)
    // Concept plates stay on the service props (J58). Scale must not strip them.
    expect(terminalProp('bag_drop_kiosk').parts.some((p) => p.mat === 'plateBagDrop')).toBe(true)
    expect(terminalProp('baggage_carousel').parts.some((p) => p.mat === 'plateClaim')).toBe(true)
    expect(terminalProp('passport_booth').parts.some((p) => p.mat === 'platePassport')).toBe(true)
  })

  it('leaves starter cells open for more desks, lanes, and benches', () => {
    const items = schemeItems(1)
    const taken = new Set(items.map((it) => `${it.c},${it.r}`))
    for (const cell of PREFAB_I_OPEN) expect(taken.has(`${cell.c},${cell.r}`), cell.slot).toBe(false)
    const slots = PREFAB_I_OPEN.map((cell) => cell.slot)
    expect(slots.filter((slot) => slot.includes('desk')).length).toBeGreaterThanOrEqual(4)
    expect(slots.filter((slot) => slot.includes('lane')).length).toBeGreaterThanOrEqual(3)
    // Gate hold cells stay partly empty so another bench or seat row still fits.
    const gateOpen = [
      [0, 4],
      [2, 4],
      [4, 3],
      [4, 4],
      [5, 4],
      [6, 3],
      [6, 4],
    ]
    for (const [c, r] of gateOpen) expect(taken.has(`${c},${r}`), `gate ${c},${r}`).toBe(false)
    expect(items.some((it) => it.def === 'bench')).toBe(true)
    expect(items.filter((it) => it.def === 'seat_row')).toHaveLength(1)
  })
})
