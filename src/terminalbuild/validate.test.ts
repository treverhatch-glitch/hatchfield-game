import { describe, expect, it } from 'vitest'
import { fittingRoomViolation } from './fittings.ts'
import { split1f } from './starter/split1f.ts'
import { validateLayout } from './validate.ts'

describe('fitting room rules', () => {
  it('blocks security kit outside the security room', () => {
    const layout = split1f()
    expect(fittingRoomViolation(layout, 'security_lane', 10, 30)).toMatch(/security room/)
    expect(fittingRoomViolation(layout, 'bp_podium', 10, 40)).toMatch(/security room/)
    layout.fittings = [...(layout.fittings ?? []), { id: 'bad-lane', kind: 'security_lane', x: 10, y: 30, floor: 0, rot: 0, wear: 0 }]
    const v = validateLayout(layout)
    expect(v.findings.some((f) => f.id === 'room_rule:bad-lane')).toBe(true)
    const clean = split1f()
    const outside = (clean.fittings ?? []).filter((f) => f.kind === 'security_lane' || f.kind === 'bp_podium')
    for (const piece of outside) expect(fittingRoomViolation(clean, piece.kind, piece.x, piece.y)).toBeNull()
  })

  it('blocks a passport booth on landside, security, or airside', () => {
    const layout = split1f()
    expect(fittingRoomViolation(layout, 'passport_booth', 10, 40)).toMatch(/claim/)
    expect(fittingRoomViolation(layout, 'passport_booth', 40, 20)).toMatch(/claim/)
    expect(fittingRoomViolation(layout, 'passport_booth', 40, 4)).toMatch(/claim/)
    expect(fittingRoomViolation(layout, 'passport_booth', 4, 8)).toBeNull()
    layout.fittings = [...(layout.fittings ?? []), { id: 'bad-pass', kind: 'passport_booth', x: 40, y: 40, floor: 0, rot: 0, wear: 0 }]
    const v = validateLayout(layout)
    expect(v.findings.some((f) => f.id === 'room_rule:bad-pass')).toBe(true)
  })

  it('requires a staffed booth only when an international arrival is scheduled', () => {
    const clean = split1f()
    expect(validateLayout(clean).findings.some((f) => f.title === 'International arrivals need passport control')).toBe(false)
    const blocked = validateLayout(clean, { intlArrival: true })
    expect(blocked.findings.some((f) => f.id === 'passport_missing' && f.title === 'International arrivals need passport control' && f.blocksFlow)).toBe(true)
    const staffed = split1f()
    staffed.fittings = [...(staffed.fittings ?? []), { id: 'pass-1', kind: 'passport_booth', x: 4, y: 8, floor: 0, rot: 0, wear: 0, staffed: true }]
    expect(validateLayout(staffed, { intlArrival: true }).findings.some((f) => f.id === 'passport_missing')).toBe(false)
    const closed = split1f()
    closed.fittings = [...(closed.fittings ?? []), { id: 'pass-1', kind: 'passport_booth', x: 4, y: 8, floor: 0, rot: 0, wear: 0, staffed: false }]
    expect(validateLayout(closed, { intlArrival: true }).findings.some((f) => f.id === 'passport_missing')).toBe(true)
  })
})
