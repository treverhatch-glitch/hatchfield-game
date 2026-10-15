import { describe, expect, it } from 'vitest'
import { GAME_MINUTES_PER_SIM_SECOND } from '../../pax/showup'
import { contractsAdapter, type ContractMovement } from './contractsAdapter'
import { makeFakeGame } from './fakeGame'
import { gameScheduleAdapter, hardWindow, icaoForAirframe } from './gameAdapter'
import { axisTicks, barNote, boardRows, buildGantt, hourTicks, pxToSec, runwayBuckets, runwayLanes, runwayOf, viewSpan } from './layout'
import type { TtFlight } from './types'
import { gameMinToSim, SCHEDULE, turnBand, turnSimSec } from './scheduleConfig'
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
  it('draws a faint half-hour between the hours', () => {
    const t = axisTicks({ from: 0, to: 15 }, 180)
    expect(t.map((x) => x.label)).toEqual(['00:00', '', '01:00', '', '02:00'])
    expect(t.filter((x) => x.minor)).toHaveLength(2)
  })
  it('opens the sheet on the whole day and zooms inside it', () => {
    expect(viewSpan(100, 180, 24)).toEqual({ from: 0, to: 180 })
    const six = viewSpan(100, 180, 6)
    expect(six.to - six.from).toBeCloseTo(180 / 4, 5)
    expect(six.from).toBeGreaterThanOrEqual(0)
    expect(six.to).toBeLessThanOrEqual(180)
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

describe('schedule turn config', () => {
  it('keeps a narrowbody turn inside 35–45 game minutes', () => {
    expect(SCHEDULE.turnMin.narrow).toBeGreaterThanOrEqual(35)
    expect(SCHEDULE.turnMin.narrow).toBeLessThanOrEqual(45)
    expect(turnSimSec('narrow') * GAME_MINUTES_PER_SIM_SECOND).toBe(SCHEDULE.turnMin.narrow)
    expect(durationLabel(turnSimSec('narrow'))).toBe('40m')
  })

  it('maps code C to the narrowbody turn and code F to the heavy turn', () => {
    expect(turnBand('C')).toBe('narrow')
    expect(turnBand('C', 'regional')).toBe('regional')
    expect(turnBand('E', 'widebody')).toBe('wide')
    expect(turnBand('F')).toBe('heavy')
    expect(turnSimSec('narrow')).toBeLessThan(10)
  })
})

function bare(over: Partial<TtFlight> = {}): TtFlight {
  return {
    id: 'a:arr',
    flightNo: 'A1',
    airlineName: 'A',
    color: '#fff',
    direction: 'arr',
    time: 10,
    onStandFrom: 10,
    onStandTo: 15,
    window: null,
    status: 'scheduled',
    delaySec: 0,
    delayReason: null,
    standId: '1,1',
    standLabel: 'G1',
    pinned: true,
    icao: 'C',
    aircraft: 'A320',
    runwayId: null,
    manual: true,
    movable: true,
    ...over,
  }
}

describe('clash and buffer', () => {
  const stand = { id: '1,1', label: 'G1', icao: 'C' as const }
  const barsOf = (flights: TtFlight[]) => buildGantt(flights, [stand], { from: 0, to: 80 })[0].rows[0].bars

  it('flags a 5-minute gap as amber and not red', () => {
    const gap = gameMinToSim(5)
    const bars = barsOf([
      bare(),
      bare({ id: 'b:arr', flightNo: 'B2', onStandFrom: 15 + gap, onStandTo: 20 + gap, time: 15 + gap }),
    ])
    expect(bars[0].conflict).toBe(false)
    expect(bars[0].buffer).toBe(true)
    expect(barNote(bars[0])).toContain('5m')
    expect(barNote(bars[0])).toContain(`${SCHEDULE.standBufferMin}m`)
  })

  it('flags an overlap as red', () => {
    const bars = barsOf([
      bare(),
      bare({ id: 'b:arr', flightNo: 'B2', onStandFrom: 14, onStandTo: 19, time: 14 }),
    ])
    expect(bars.every((b) => b.conflict)).toBe(true)
    expect(bars[0].buffer).toBe(false)
    expect(barNote(bars[0])).toMatch(/^Clash/)
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
    expect(s2.window).toEqual(hardWindow(150, 100))
    expect(s2.onStandTo - s2.onStandFrom).toBeCloseTo(turnSimSec('narrow'), 5)
  })

  it('lists every stand in one group, with the tower lane first', () => {
    const { a } = setup()
    const groups = buildGantt(a.flights(), a.stands(), { from: 90, to: 250 })
    expect(groups.map((g) => g.icao)).toEqual(['none', 'stands'])
    expect(groups[1].rows.map((r) => r.stand?.label)).toEqual(['G4', 'G6'])
    expect(groups[1].rows[1].bars[0].flight.flightNo).toBe('PI2')
    expect(groups[0].rows[0].bars[0].flight.flightNo).toBe('SK1')
  })

  it('moveTo clamps into the hard window and maps to pull/bump', () => {
    const { a, log, game } = setup()
    const reach = gameMinToSim(SCHEDULE.hardWindowMin)
    a.moveTo('s1:arr', 500)
    expect(game.schedule[0].eta).toBeCloseTo(130 + reach, 5)
    a.moveTo('s1:arr', 0)
    expect(game.schedule[0].eta).toBeCloseTo(130 - reach, 5)
    expect(log[0]).toMatch(/^bump s1/)
    expect(log[1]).toMatch(/^pull s1/)
  })

  it('pins a fitting stand and refuses one the aircraft does not fit', () => {
    const { a, game } = setup()
    game.flights.push({ id: 'heavy', airframeId: 'a380', kind: 'widebody' } as (typeof game.flights)[number])
    game.schedule[0].flightId = 'heavy'
    a.pinStand('s1:arr', '4,4')
    expect(game.schedule[0].standPref).toBeNull()
    a.pinStand('s1:arr', '6,4')
    expect(game.schedule[0].standPref).toEqual({ c: 6, r: 4 })
    a.pinStand('s1:arr', null)
    expect(game.schedule[0].standPref).toBeNull()
  })

  it('snaps a drag back to the hard window', () => {
    const { a, game } = setup()
    const reach = gameMinToSim(SCHEDULE.hardWindowMin)
    a.moveTo('s1:arr', 10_000)
    expect(game.schedule[0].eta).toBeCloseTo(130 + reach, 5)
    expect(game.schedule[0].eta).toBeLessThan(200)
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
    const row = g.find((group) => group.icao === 'stands')!.rows.find((r) => r.stand?.id === '6,4')!
    expect(row.bars.length).toBeGreaterThan(1)
    expect(row.bars.every((b) => b.conflict)).toBe(true)
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

describe('multiple runways', () => {
  const setup = (strips = 3) => {
    const f = makeFakeGame({ clock: 100, strips })
    f.addStand(4, 4, 'M')
    f.slot('s1', 'sky', 110, { runwayPref: 0 })
    f.slot('s2', 'pink', 112, { runwayPref: 1 })
    f.slot('s3', 'sky', 114, { runwayPref: 1 })
    f.slot('s4', 'pink', 116, { runwayPref: null })
    return { ...f, a: gameScheduleAdapter(f.game) }
  }

  it('lists one runway per strip with its own capacity', () => {
    const { a } = setup(3)
    const rw = a.runways()
    expect(rw.map((r) => r.label)).toEqual(['RW1', 'RW2', 'RW3'])
    expect(rw.map((r) => r.id)).toEqual(['rw0', 'rw1', 'rw2'])
    expect(rw.every((r) => r.hourlyCap > 0)).toBe(true)
  })

  it('stamps runway from scheduleForRunway onto arr + dep rows', () => {
    const { a } = setup()
    const rows = a.flights()
    expect(rows.find((r) => r.id === 's2:arr')!.runwayId).toBe('rw1')
    expect(rows.find((r) => r.id === 's2:dep')!.runwayId).toBe('rw1')
    expect(rows.find((r) => r.id === 's4:arr')!.runwayId).toBeNull()
  })

  it('builds per-runway lanes, an Auto lane and a combined total', () => {
    const { a } = setup(3)
    const { lanes, total } = runwayLanes(a.flights(), a.runways(), { from: 97.5, to: 240 }, 180)
    expect(lanes.map((l) => l.label)).toEqual(['RW1', 'RW2', 'RW3', 'Auto'])
    const count = (id: string) => lanes.find((l) => l.id === id)!.buckets.reduce((s, b) => s + b.arr + b.dep, 0)
    expect(count('rw0')).toBe(2)
    expect(count('rw1')).toBe(4)
    expect(count('rw2')).toBe(0)
    expect(count('auto')).toBe(2)
    expect(total.buckets.reduce((s, b) => s + b.arr + b.dep, 0)).toBe(8)
    expect(total.cap).toBe(a.runways().reduce((s, r) => s + r.hourlyCap, 0))
    expect(lanes[0].cap).toBe(a.runways()[0].hourlyCap)
  })

  it('flags a single runway over its own cap even when the total is fine', () => {
    const { a, slot } = setup(2)
    const cap = a.runways()[1].hourlyCap
    for (let i = 0; i < cap; i++) slot(`x${i}`, 'sky', 113 + i * 0.1, { runwayPref: 1 })
    const span = { from: 112.5, to: 120 }
    const per = runwayBuckets(a.flights(), a.runways(), span, 180, 'rw1')
    expect(per[0].over).toBe(true)
    const tot = runwayBuckets(a.flights(), a.runways(), span, 180)
    expect(tot[0].cap).toBe(a.runways()[0].hourlyCap + cap)
  })

  it('setRunway steps cycleSlotRunway to the requested strip and back to auto', () => {
    const { a, game } = setup(3)
    a.setRunway('s4:arr', 'rw2')
    expect(game.schedule[3].runwayPref).toBe(2)
    a.setRunway('s4:arr', 'rw0')
    expect(game.schedule[3].runwayPref).toBe(0)
    a.setRunway('s4:arr', null)
    expect(game.schedule[3].runwayPref).toBeNull()
    a.setRunway('s4:arr', 'rw9')
    expect(game.schedule[3].runwayPref).toBeNull()
    game.schedule[0].status = 'inbound'
    a.setRunway('s1:arr', 'rw2')
    expect(game.schedule[0].runwayPref).toBe(0)
  })

  it('contracts adapter keeps separate arrival and departure runways', () => {
    let set: [string, string | null] | null = null
    const base = {
      contractId: 'c1', flightNo: 'HF1', airlineName: 'H', color: '#fff', windowStart: 0, windowEnd: 100,
      standId: null, icao: 'E' as const, aircraft: 'A350', turnTarget: 30, services: [], status: 'scheduled' as const, rotationId: 'r1',
    }
    const a = contractsAdapter({
      dayLength: 180,
      now: () => 0,
      movements: () => [
        { ...base, id: 'm1', direction: 'arr', time: 40, runwayId: 'R09L', depRunwayId: 'R09R' },
        { ...base, id: 'm2', direction: 'dep', time: 80, runwayId: 'R09L', depRunwayId: 'R09R' },
      ],
      stands: () => [],
      runways: () => [
        { id: 'R09L', index: 0, label: '09L', hourlyCap: 20 },
        { id: 'R09R', index: 1, label: '09R', hourlyCap: 18 },
      ],
      reschedule: (_id, t) => t,
      assignStand: () => {},
      assignRunway: (id, rw) => {
        set = [id, rw]
      },
    })
    const rows = a.flights()
    expect(runwayOf(rows[0])).toBe('R09L')
    expect(runwayOf(rows[1])).toBe('R09R')
    const { lanes, total } = runwayLanes(rows, a.runways(), { from: 0, to: 120 }, 180)
    expect(lanes.map((l) => l.flights.length)).toEqual([1, 1])
    expect(total.cap).toBe(38)
    expect(a.caps.runway).toBe(true)
    a.setRunway('r1:dep', 'R09L')
    expect(set).toEqual(['m2', 'R09L'])
  })
})
