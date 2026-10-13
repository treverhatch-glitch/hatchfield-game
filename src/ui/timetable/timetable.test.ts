import { describe, expect, it } from 'vitest'
import { contractsAdapter, type ContractMovement } from './contractsAdapter'
import { makeFakeGame } from './fakeGame'
import { gameScheduleAdapter, icaoForAirframe, TOWER_HOLD, TOWER_PULL } from './gameAdapter'
import { boardRows, buildGantt, hourTicks, pxToSec, runwayBuckets } from './layout'
import { clampToWindow, clockLabel, durationLabel, standFits } from './time'

describe('clock face', () => {
  it('renders sim seconds as HH:MM on a 180s day', () => {
    expect(clockLabel(0)).toBe('00:00')
    expect(clockLabel(90)).toBe('12:00')
    expect(clockLabel(180 + 45)).toBe('06:00')
    expect(clockLabel(7.5 * 13)).toBe('13:00')
    expect(durationLabel(7.5)).toBe('1h')
    expect(durationLabel(3.75)).toBe('30m')
  })
  it('hour ticks fall on whole in-game hours', () => {
    const t = hourTicks({ from: 1, to: 31 }, 180)
    expect(t.map((x) => x.label)).toEqual(['01:00', '02:00', '03:00', '04:00'])
  })
  it('clamps to window and floor', () => {
    const w = { start: 10, end: 20, source: 'tower' as const }
    expect(clampToWindow(5, w)).toBe(10)
    expect(clampToWindow(25, w)).toBe(20)
    expect(clampToWindow(12, w, 15)).toBe(15)
  })
  it('ICAO fit and airframe mapping', () => {
    expect(standFits('E', 'C')).toBe(true)
    expect(standFits('C', 'F')).toBe(false)
    expect(icaoForAirframe('a380')).toBe('F')
    expect(icaoForAirframe(null, 'widebody')).toBe('E')
    expect(icaoForAirframe(null, 'narrowbody')).toBe('C')
  })
  it('converts drag pixels into seconds', () => {
    expect(pxToSec(100, 400, { from: 0, to: 80 })).toBe(20)
  })
})

describe('game schedule adapter', () => {
  const setup = () => {
    const f = makeFakeGame({ clock: 100 })
    f.addStand(4, 4, 'S')
    f.addStand(6, 4, 'L')
    f.slot('s1', 'sky', 130)
    f.slot('s2', 'pink', 150, { standPref: { c: 6, r: 4 } })
    return { ...f, a: gameScheduleAdapter(f.game) }
  }

  it('emits an arrival + departure per slot with clock-time positions', () => {
    const { a } = setup()
    const rows = a.flights()
    expect(rows.filter((r) => r.direction === 'arr')).toHaveLength(2)
    expect(rows.filter((r) => r.direction === 'dep')).toHaveLength(2)
    const s2 = rows.find((r) => r.id === 's2:arr')!
    expect(s2.pinned).toBe(true)
    expect(s2.standLabel).toBe('G6')
    expect(s2.window).toEqual({ start: 150 - TOWER_PULL, end: 150 + TOWER_HOLD, source: 'tower' })
  })

  it('groups stands by ICAO class, largest first, with unassigned last', () => {
    const { a } = setup()
    const groups = buildGantt(a.flights(), a.stands(), { from: 90, to: 250 })
    expect(groups.map((g) => g.icao)).toEqual(['F', 'C', 'none'])
    expect(groups[0].rows[0].bars[0].flight.flightNo).toBe('PI2')
  })

  it('moveTo clamps into the window and maps to pull/bump', () => {
    const { a, log, game } = setup()
    a.moveTo('s1:arr', 500)
    expect(game.schedule[0].eta).toBe(130 + TOWER_HOLD)
    a.moveTo('s1:arr', 0)
    expect(game.schedule[0].eta).toBe(106)
    expect(log[0]).toMatch(/^bump s1/)
    expect(log[1]).toMatch(/^pull s1/)
  })

  it('pins, swaps, pulls, bumps, cancels', () => {
    const { a, game } = setup()
    a.pinStand('s1:arr', '4,4')
    expect(game.schedule[0].standPref).toEqual({ c: 4, r: 4 })
    a.swapStands('s1:arr', 's2:arr')
    expect(game.schedule[0].standPref).toEqual({ c: 6, r: 4 })
    expect(game.schedule[1].standPref).toEqual({ c: 4, r: 4 })
    a.bump('s1:dep')
    expect(game.schedule[0].eta).toBe(148)
    a.pull('s1:arr')
    expect(game.schedule[0].eta).toBe(136)
    a.cancel('s2:arr')
    expect(a.flights().find((r) => r.id === 's2:arr')!.status).toBe('cancelled')
  })

  it('locks inbound slots', () => {
    const { a, game } = setup()
    game.schedule[0].status = 'inbound'
    expect(a.flights().find((r) => r.id === 's1:arr')!.movable).toBe(false)
    expect(a.moveTo('s1:arr', 140)).toBeNull()
  })

  it('flags overlap and too-small stands as conflicts', () => {
    const { a, slot } = setup()
    slot('s3', 'sky', 152, { standPref: { c: 6, r: 4 } })
    const g = buildGantt(a.flights(), a.stands(), { from: 90, to: 300 })
    expect(g[0].rows[0].bars.every((b) => b.conflict)).toBe(true)
  })

  it('runway buckets count movements per hour against capacity', () => {
    const { a } = setup()
    const b = runwayBuckets(a.flights(), a.runways(), { from: 97.5, to: 160 }, 180)
    expect(b[0].label).toBe('13:00')
    const total = b.reduce((s, x) => s + x.arr + x.dep, 0)
    expect(total).toBeGreaterThanOrEqual(2)
    expect(b[0].cap).toBeGreaterThan(0)
  })

  it('board shows clock times and late estimates', () => {
    const { a, game } = setup()
    game.schedule[0].delaySec = 7.5
    game.schedule[0].eta = 137.5
    game.schedule[0].status = 'delayed'
    const rows = boardRows(a.flights(), 'arr', game.clock, 180)
    expect(rows[0]).toMatchObject({ time: '17:20', est: '18:20', status: 'Delayed', late: true })
  })
})

describe('contracts adapter', () => {
  const mv = (over: Partial<ContractMovement>): ContractMovement => ({
    id: 'm1',
    contractId: 'c1',
    flightNo: 'HF100',
    airlineName: 'Hatch Air',
    color: '#fff',
    direction: 'arr',
    time: 50,
    windowStart: 40,
    windowEnd: 70,
    standId: null,
    icao: 'E',
    aircraft: 'A350',
    turnTarget: 30,
    services: ['fuel', 'catering'],
    status: 'scheduled',
    rotationId: 'r1',
    ...over,
  })
  it('pairs rotations, carries contract window, clamps reschedule', () => {
    const moves = [mv({}), mv({ id: 'm2', direction: 'dep', time: 90, windowStart: 85, windowEnd: 100 })]
    let applied: [string, number] | null = null
    const a = contractsAdapter({
      dayLength: 180,
      now: () => 0,
      movements: () => moves,
      stands: () => [],
      runways: () => [],
      reschedule: (id, t) => ((applied = [id, t]), t),
      assignStand: () => {},
    })
    const rows = a.flights()
    expect(rows[0].id).toBe('r1:arr')
    expect(rows[0].onStandTo).toBe(84)
    expect(rows[0].window?.source).toBe('contract')
    expect(rows[0].services).toEqual(['fuel', 'catering'])
    a.moveTo('r1:arr', 10)
    expect(applied).toEqual(['m1', 40])
    expect(a.caps.swap).toBe(false)
  })
})
