import { describe, expect, it } from 'vitest'
import { makeOffer } from './contracts.ts'
import { previewOffer } from './preview.ts'
import { active, INFRA, line, SUMMER } from './testkit.ts'
import type { Infrastructure } from './types.ts'

describe('previewOffer (contract offer card)', () => {
  it('green when capacity is ample', () => {
    const offer = makeOffer({ id: 'o', airlineId: 'x', lines: [line('l', 'a320', 480)], services: [] })
    const p = previewOffer(offer, [], SUMMER, INFRA)
    expect(p.hours.length).toBe(24)
    expect(p.warnings).toEqual([])
    expect(p.overCapacitySlots).toBe(0)
    expect(p.hours.every((h) => h.light !== 'red')).toBe(true)
  })
  it('warns with a stand-capacity message but does not block', () => {
    const infra: Infrastructure = { stands: [{ id: 'W1', sizeClass: 'wide', contact: true }], runways: [{ id: 'R', movesPerHour: 30 }] }
    const existing = [active('e', 'y', [line('l', 'b777', 420, { turnaroundTargetMin: 150 })])]
    const offer = makeOffer({ id: 'o', airlineId: 'x', lines: [line('l', 'b777', 450, { turnaroundTargetMin: 90 })], services: [] })
    const p = previewOffer(offer, existing, SUMMER, infra)
    expect(p.overCapacitySlots).toBeGreaterThan(0)
    expect(p.warnings.some((w) => /exceeds declared stand capacity \d\d:\d\d–\d\d:\d\d/.test(w))).toBe(true)
    expect(p.hours[7].light).toBe('red')
    expect(p.hours[3].light).toBe('green')
  })
  it('runway warning and amber band', () => {
    const infra: Infrastructure = { stands: Array.from({ length: 20 }, (_, i) => ({ id: `N${i}`, sizeClass: 'narrow' as const, contact: true })), runways: [{ id: 'R', movesPerHour: 5 }] }
    const tight = { preferredMin: 600, softMin: 0, hardMin: 60 }
    const offer = makeOffer({ id: 'o', airlineId: 'x', lines: Array.from({ length: 4 }, (_, i) => line(`l${i}`, 'a320', 600, { arrival: tight, turnaroundTargetMin: 120 })), services: [] })
    const p = previewOffer(offer, [], SUMMER, infra)
    expect(p.hours[10].light).toBe('amber') // 4 arrivals / 5
    const big = makeOffer({ id: 'o', airlineId: 'x', lines: Array.from({ length: 7 }, (_, i) => line(`l${i}`, 'a320', 600, { arrival: tight, turnaroundTargetMin: 120 })), services: [] })
    const p2 = previewOffer(big, [], SUMMER, infra)
    expect(p2.warnings.some((w) => /runway capacity 10:00–11:00/.test(w))).toBe(true)
  })
})
