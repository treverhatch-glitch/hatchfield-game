import { describe, expect, it } from 'vitest'
import {
  BUILD_TUNING,
  EQUIP_SPEC,
  FLOOR_COST,
  blankLayout,
  buildUpkeepPerDay,
  placeDoor,
  placeEquipment,
  placeFloor,
  placeWall,
  removeDoor,
  removeEquipment,
  removeRoom,
  removeWall,
  runFlow,
  validateLayout,
  type BuildLayout,
  type EditResult,
  type FlowFlight,
} from './index.ts'
import { sampleTerminal } from './sample.ts'

const built = () => sampleTerminal().layout
const ids = (l: BuildLayout) => validateLayout(l).findings.map((f) => f.id)
const ok = (r: EditResult) => {
  expect(r.error).toBeUndefined()
  return r.layout
}
const flight = (over: Partial<FlowFlight> = {}): FlowFlight => ({
  id: 'HF1',
  gate: 'g1',
  departSec: 3 * 3600,
  departing: 120,
  arriveSec: 1800,
  arriving: 120,
  bagsPerPax: 1,
  ...over,
})

describe('build tools', () => {
  it('every edit costs money and the build has daily upkeep', () => {
    const r = sampleTerminal()
    expect(r.error).toBeUndefined()
    expect(r.cost).toBeGreaterThan(48 * FLOOR_COST.build)
    expect(buildUpkeepPerDay(r.layout)).toBeGreaterThan(0)
  })

  it('removals refund part of the price', () => {
    const r = removeEquipment(built(), 'desk1')
    expect(r.cost).toBe(-Math.round(EQUIP_SPEC.checkin_desk.build * BUILD_TUNING.refundShare))
  })

  it('rejects kit on bare ground, stacked kit, and overlapping rooms', () => {
    const l = ok(placeFloor(blankLayout(4, 4), { x: 0, y: 0, w: 2, h: 2 }))
    expect(placeEquipment(l, { id: 'a', kind: 'seat', x: 3, y: 3 }).error).toBeTruthy()
    const one = ok(placeEquipment(l, { id: 'a', kind: 'seat', x: 0, y: 0 }))
    expect(placeEquipment(one, { id: 'b', kind: 'seat', x: 0, y: 0 }).error).toBeTruthy()
    expect(built().rooms.length).toBe(4)
    const r = sampleTerminal().layout
    expect(placeFloor(r, { x: 7, y: 5, w: 3, h: 1 }).error).toBeTruthy()
  })

  it('a door replaces the wall on its edge and a wall replaces a door', () => {
    let l = ok(placeWall(blankLayout(2, 1), { x: 0, y: 0, dir: 'E' }))
    l = ok(placeDoor(l, { x: 0, y: 0, dir: 'E', kind: 'public' }))
    expect(l.walls).toHaveLength(0)
    expect(l.doors).toHaveLength(1)
    l = ok(placeWall(l, { x: 0, y: 0, dir: 'E' }))
    expect(l.doors).toHaveLength(0)
  })
})

describe('validateLayout', () => {
  it('a complete small terminal has no findings', () => {
    const v = validateLayout(built())
    expect(v.findings).toEqual([])
    expect(v.ok).toBe(true)
  })

  it('an empty plot lists every required room and no entrance', () => {
    const v = validateLayout(blankLayout(6, 6))
    expect(v.ok).toBe(false)
    expect(v.findings.map((f) => f.id)).toEqual(
      expect.arrayContaining(['missing_checkin', 'missing_security', 'missing_gate', 'missing_bagmakeup', 'no_entrance']),
    )
  })

  it('finds a gap in the outer wall', () => {
    const l = ok(removeWall(built(), { x: 3, y: 5, dir: 'S' }))
    const f = validateLayout(l).findings.find((x) => x.id === 'wall_gap')
    expect(f?.severity).toBe('blocker')
    expect(f?.cells).toEqual([{ x: 3, y: 5 }])
    expect(f?.blocksFlow).toBe(false)
  })

  it('a missing wall on the security line is a bypass', () => {
    const l = ok(removeWall(built(), { x: 0, y: 1, dir: 'S' }))
    expect(ids(l)).toContain('security_bypass')
  })

  it('arrivals need the one-way exit; security lanes do not run backwards', () => {
    const l = ok(placeWall(built(), { x: 5, y: 1, dir: 'S' }))
    expect(ids(l)).toEqual(['arrivals_no_exit'])
  })

  it('removing a door leaves an open seam, which is a bypass', () => {
    const l = ok(removeDoor(built(), { x: 5, y: 1, dir: 'S' }))
    expect(ids(l)).toContain('security_bypass')
  })

  it('the exit door does not let departures skip security', () => {
    let l = built()
    for (const id of ['lane1', 'lane2']) l = ok(removeEquipment(l, id))
    expect(ids(l)).toContain('security_bypass')
    for (const x of [1, 3]) l = ok(placeWall(l, { x, y: 1, dir: 'S' }))
    const got = ids(l)
    expect(got).not.toContain('security_bypass')
    expect(got).toContain('room_empty:sec:security_lane')
    expect(got).toContain('gate_unreachable:g1')
  })

  it('a desk with no belt to make-up leaves bags behind', () => {
    const l = ok(removeEquipment(built(), 'belt2'))
    const got = ids(l)
    expect(got).toContain('bags_no_route:desk2')
    expect(got).not.toContain('bags_no_route:desk1')
  })

  it('make-up needs an apron door for the bag carts', () => {
    const l = ok(removeDoor(built(), { x: 7, y: -1, dir: 'S' }))
    expect(ids(l)).toContain('makeup_no_apron:mk1')
  })

  it('a gate with no apron door is flagged', () => {
    const l = ok(removeDoor(built(), { x: 0, y: -1, dir: 'S' }))
    expect(ids(l)).toContain('gate_no_apron:g1')
  })

  it('missing required rooms and empty rooms', () => {
    const noSec = ok(removeRoom(built(), 'sec'))
    expect(ids(noSec)).toContain('missing_security')
    const noDesk = ok(removeEquipment(built(), 'gd1'))
    expect(ids(noDesk)).toContain('room_empty:g1:gate_desk')
  })

  it('boxed-in kit is blocked', () => {
    let l = ok(placeWall(built(), { x: 4, y: 4, dir: 'E' }))
    l = ok(placeWall(l, { x: 5, y: 3, dir: 'S' }))
    const f = validateLayout(l).findings.find((x) => x.id === 'equip_blocked:desk1')
    expect(f?.severity).toBe('blocker')
    expect(f?.blocksFlow).toBe(true)
  })

  it('a walled-off gate is unreachable, and so is its desk', () => {
    let l = built()
    for (let x = 0; x < 6; x++) l = ok(placeWall(l, { x, y: 0, dir: 'S' }))
    const got = ids(l)
    expect(got).toContain('gate_unreachable:g1')
    expect(got).toContain('equip_unreachable:gd1')
  })

  it('door rules: curb doors stay before security', () => {
    const l = ok(placeDoor(built(), { x: 0, y: -1, dir: 'S', kind: 'curb' }))
    expect(ids(l).some((id) => id.startsWith('door_side:'))).toBe(true)
  })

  it('kit outside its room is a warning', () => {
    const l = ok(placeEquipment(built(), { id: 'shop', kind: 'shop_counter', x: 0, y: 3 }))
    const f = validateLayout(l).findings.find((x) => x.id === 'equip_room:shop')
    expect(f?.severity).toBe('warning')
  })

  it('player copy never says landside or airside', () => {
    let l = ok(removeWall(built(), { x: 0, y: 1, dir: 'S' }))
    l = ok(removeDoor(l, { x: 5, y: 1, dir: 'S' }))
    l = ok(placeDoor(l, { x: 0, y: -1, dir: 'S', kind: 'curb' }))
    const all = [...validateLayout(l).findings, ...validateLayout(blankLayout(3, 3)).findings]
    for (const f of all) expect(`${f.title} ${f.detail} ${f.fix}`).not.toMatch(/landside|airside/i)
  })
})

describe('runFlow', () => {
  it('a terminal built from scratch moves every passenger and bag', () => {
    const v = validateLayout(built())
    expect(v.ok).toBe(true)
    const r = runFlow(built(), [flight(), flight({ id: 'HF2', departSec: 4 * 3600, arriveSec: 2.5 * 3600 })])
    expect(r.departing).toBe(240)
    expect(r.boarded).toBe(240)
    expect(r.lostPax).toBe(0)
    expect(r.bagsChecked).toBe(240)
    expect(r.bagsLoaded).toBe(240)
    expect(r.lostBags).toBe(0)
    expect(r.exited).toBe(240)
    expect(r.lostArrivals).toBe(0)
  })

  it('kit wears with use', () => {
    const r = runFlow(built(), [flight()])
    const desk = r.layout.equipment.find((e) => e.id === 'desk1')!
    expect(desk.wear).toBeGreaterThan(0)
    expect(built().equipment.find((e) => e.id === 'desk1')!.wear).toBe(0)
  })

  it('too few desks for the load misses departures (a player choice, not a cap)', () => {
    const l = ok(removeEquipment(built(), 'desk2'))
    const r = runFlow(l, [flight({ departing: 300 })])
    expect(r.lostPax).toBeGreaterThan(0)
    expect(r.maxWaitSec).toBeGreaterThan(0)
  })

  it('broken bag routes leave bags behind', () => {
    let l = ok(removeEquipment(built(), 'belt1'))
    l = ok(removeEquipment(l, 'belt2'))
    const r = runFlow(l, [flight()])
    expect(r.lostBags).toBe(r.bagsChecked)
  })

  it('no exit door strands arrivals', () => {
    const l = ok(placeWall(built(), { x: 5, y: 1, dir: 'S' }))
    expect(runFlow(l, [flight()]).lostArrivals).toBe(120)
  })
})
