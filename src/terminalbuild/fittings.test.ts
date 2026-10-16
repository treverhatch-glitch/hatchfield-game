import { describe, expect, it } from 'vitest'
import { itemDef } from '../game/terminal.ts'
import { footprint } from '../render/terminalProps/parts.ts'
import { terminalProp } from '../render/terminalProps/index.ts'
import { EQUIP_SPEC } from './config.ts'
import { FITTING_KINDS, fittingSpec } from './fittings.ts'
import type { FittingKind } from './types.ts'

/** Axis-aligned size of a prop, ignoring the near-only trim. */
function measured(type: 'bag_drop_kiosk' | 'baggage_carousel' | 'passport_booth'): { w: number; d: number } {
  const size = footprint(terminalProp(type).parts.filter((p) => !p.near))
  return { w: size.w, d: size.d }
}

describe('fitting catalog', () => {
  it('reads prices from the item or the equip row, and never a second number', () => {
    const fromItem: [FittingKind, string][] = [
      ['checkin_desk', 'checkin_belt'],
      ['checkin_kiosk', 'kiosk'],
      ['bag_drop', 'bag_drop'],
      ['queue_rail', 'queue_rail'],
      ['security_lane', 'security_small'],
      ['gate_desk', 'boarding_desk'],
      ['seat_row', 'seat_row'],
      ['bench', 'bench'],
      ['shop_counter', 'cafe'],
      ['wc_block', 'toilet'],
      ['claim_carousel', 'claim_carousel'],
      ['passport_booth', 'passport_booth'],
      ['fids', 'info_screen'],
      ['wayfinding', 'wayfinding'],
    ]
    for (const [kind, id] of fromItem) {
      const spec = fittingSpec(kind)
      const def = itemDef(id)!
      expect(spec.cost, kind).toBe(def.cost)
      expect(spec.upkeep, kind).toBe(def.upkeep)
      expect(spec.priceFrom, kind).toBe(id)
    }
    expect(fittingSpec('belt').cost).toBe(EQUIP_SPEC.bag_belt.build)
    expect(fittingSpec('belt').upkeep).toBe(EQUIP_SPEC.bag_belt.upkeepPerDay)
  })

  it('gives every kind an inspector label, price, and prop', () => {
    for (const kind of FITTING_KINDS) {
      const spec = fittingSpec(kind)
      expect(spec.label.length, kind).toBeGreaterThan(0)
      expect(spec.blurb.length, kind).toBeGreaterThan(0)
      expect(spec.prop.length, kind).toBeGreaterThan(0)
      expect(Number.isFinite(spec.cost), kind).toBe(true)
      expect(Number.isFinite(spec.upkeep), kind).toBe(true)
      expect(spec.w, kind).toBeGreaterThan(0)
      expect(spec.d, kind).toBeGreaterThan(0)
    }
  })

  it('pins bag drop, carousel, and passport footprints to the builders within 5%', () => {
    const rows: [FittingKind, 'bag_drop_kiosk' | 'baggage_carousel' | 'passport_booth'][] = [
      ['bag_drop', 'bag_drop_kiosk'],
      ['claim_carousel', 'baggage_carousel'],
      ['passport_booth', 'passport_booth'],
    ]
    for (const [kind, prop] of rows) {
      const spec = fittingSpec(kind)
      const box = measured(prop)
      expect(Math.abs(spec.w - box.w) / box.w, `${kind} w catalog ${spec.w} mesh ${box.w}`).toBeLessThanOrEqual(0.05)
      expect(Math.abs(spec.d - box.d) / box.d, `${kind} d catalog ${spec.d} mesh ${box.d}`).toBeLessThanOrEqual(0.05)
    }
  })

  it('allows a passport booth only on claim and arrivals', () => {
    const spec = fittingSpec('passport_booth')
    expect(spec.zones).toEqual(['claim', 'arrivals'])
    expect(spec.side).toBe('sterile_arr')
  })
})
