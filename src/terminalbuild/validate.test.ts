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
})
