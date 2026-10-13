import { describe, expect, it } from 'vitest'
import { liveHallAdvice, planFromHall, type LiveHall } from './adapter.ts'
import { adviseTerminal } from './advisor.ts'
import { isBlocked } from './plan.ts'
import { schemeItems, schemeZones } from '../game/terminal.ts'

const prefab = (tier: 1 | 2 | 3): LiveHall => ({ zones: schemeZones(tier), items: schemeItems(tier) })
const ids = (hall: LiveHall) => liveHallAdvice(hall).map((a) => a.id)

/** A small custom kit hall, front row is the curb:
 *   C C S G G
 *   A A S G T
 */
function kitHall(): { zones: (string | null)[][]; items: { def: string; c: number; r: number }[] } {
  return {
    zones: [
      ['checkin', 'checkin', 'security', 'gates', 'gates'],
      ['arrivals', 'arrivals', 'security', 'gates', 'toilets'],
    ],
    items: [
      { def: 'entrance', c: 0, r: 0 },
      { def: 'checkin_belt', c: 1, r: 0 },
      { def: 'security_small', c: 2, r: 0 },
      { def: 'boarding_desk', c: 3, r: 0 },
      { def: 'bench', c: 4, r: 0 },
      { def: 'claim_carousel', c: 0, r: 1 },
      { def: 'toilet', c: 4, r: 1 },
      { def: 'trash_can', c: 3, r: 1 },
    ],
  }
}

describe('terminal advisor adapter — prefab halls', () => {
  it.each([1, 2, 3] as const)('prefab tier %i reads clean', (tier) => {
    expect(liveHallAdvice(prefab(tier))).toEqual([])
  })

  it('maps zones to rooms and kit items to equipment', () => {
    const p = planFromHall(prefab(1))!
    expect(p.w).toBe(8)
    expect(p.h).toBe(5)
    const L = p.floors[0]
    expect(L.cells[0][0].room).toBe('checkin')
    expect(L.cells[0][6].room).toBe('bagclaim')
    expect(L.cells[2][0].room).toBe('security')
    expect(L.cells[3][2].room).toBe('food')
    expect(p.equipment.map((e) => e.id)).toEqual(
      expect.arrayContaining(['desk', 'kiosk', 'scanner', 'gate_desk', 'seat', 'carousel', 'belt', 'toilet', 'shop_unit']),
    )
    expect(L.doors.some((d) => d.kind === 'curb')).toBe(true)
  })

  it('walls check-in off from a touching gate (security is the only bridge)', () => {
    // Tier II paints check-in right beside the pier.
    const p = planFromHall(prefab(2))!
    expect(p.floors[0].cells[0][3].room).toBe('checkin')
    expect(p.floors[0].cells[0][4].room).toBe('gates')
    expect(isBlocked(p.floors[0], { x: 3, y: 0, dir: 'E' })).toBe(true)
    expect(adviseTerminal(p).map((h) => h.id)).not.toContain('security_bypass')
  })

  it('returns nothing for an unpainted shell', () => {
    expect(planFromHall({ zones: [[null, null]], items: [] })).toBeNull()
    expect(liveHallAdvice({})).toEqual([])
  })
})

describe('terminal advisor adapter — custom kit hall', () => {
  it('a sound kit hall has no blockers', () => {
    const notes = liveHallAdvice(kitHall())
    expect(notes.filter((n) => n.severity === 'blocker')).toEqual([])
  })

  it('blocker: no way in from the curb', () => {
    const hall = kitHall()
    hall.zones = [hall.zones[1], hall.zones[0]].map((row) => row.map((z) => (z === 'arrivals' ? 'gates' : z)))
    hall.zones[0][0] = 'gates'
    hall.zones[0][1] = 'gates'
    hall.items = hall.items.filter((i) => i.def !== 'entrance')
    const notes = liveHallAdvice(hall)
    const curb = notes.find((n) => n.id === 'plan-no_curb')
    expect(curb?.severity).toBe('blocker')
    expect(curb?.title).toMatch(/curb/)
  })

  it('blocker: no security zone', () => {
    const hall = kitHall()
    hall.zones[0][2] = 'checkin'
    hall.zones[1][2] = 'arrivals'
    const r = ids(hall)
    expect(r).toContain('plan-missing_security')
    expect(r).toContain('plan-gates_unreachable')
    expect(liveHallAdvice(hall).find((n) => n.id === 'plan-missing_security')?.severity).toBe('blocker')
  })

  it('blocker: gates that do not touch security cannot be reached', () => {
    const hall = kitHall()
    // A shops strip between the lane and the gates.
    hall.zones = hall.zones.map((row) => [...row.slice(0, 3), 'retail', ...row.slice(3)])
    hall.items = hall.items.map((i) => (i.c >= 3 ? { ...i, c: i.c + 1 } : i))
    const hit = liveHallAdvice(hall).find((n) => n.id === 'plan-gates_unreachable')
    expect(hit?.severity).toBe('blocker')
    expect(hit?.cells.length).toBeGreaterThan(0)
  })

  it('blocker: arrivals with no way out', () => {
    const hall = kitHall()
    // Arrivals boxed in by gates: the inbound door is one-way, so nobody gets out to the curb.
    hall.zones = [
      ['checkin', 'security', 'gates', 'gates', 'gates'],
      ['checkin', 'security', 'gates', 'arrivals', 'gates'],
    ]
    const hit = liveHallAdvice(hall).find((n) => n.id === 'plan-claim_unreachable')
    expect(hit?.severity).toBe('blocker')
    expect(hit?.cells).toEqual([{ c: 3, r: 1 }])
  })

  it('a check-in seam onto the gates never counts as a bypass', () => {
    const hall = kitHall()
    hall.zones[1][2] = 'checkin' // check-in now touches gates directly
    expect(ids(hall)).not.toContain('plan-security_bypass')
  })

  it('warning: a painted zone with nothing serving it', () => {
    const hall = kitHall()
    hall.items = hall.items.filter((i) => i.def !== 'security_small')
    const hit = liveHallAdvice(hall).find((n) => n.id === 'plan-equip_security_scanner')
    expect(hit?.severity).toBe('warning')
    expect(hit?.title).toBe('Security has no security lane')
    expect(hit?.cells).toHaveLength(1)
  })

  it('warning: cut-off toilets on the far side', () => {
    const hall = kitHall()
    hall.zones = [
      ['checkin', 'checkin', 'security', 'gates', 'gates', null, 'toilets'],
      ['arrivals', 'arrivals', 'security', 'gates', 'gates', null, 'toilets'],
    ]
    hall.items = hall.items.filter((i) => i.def !== 'toilet').concat({ def: 'toilet', c: 6, r: 0 })
    const hit = liveHallAdvice(hall).find((n) => n.id === 'plan-dead_restrooms')
    expect(hit?.severity).toBe('warning')
    expect(hit?.cells).toEqual([
      { c: 6, r: 0 },
      { c: 6, r: 1 },
    ])
  })
})
