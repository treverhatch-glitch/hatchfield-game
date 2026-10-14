import { describe, expect, it } from 'vitest'
import { LANDSIDE } from './config.ts'
import { LandsideTraffic, measure, pressureColor } from './engine.ts'
import { approachLanes, buildNetwork } from './network.ts'
import type { Cell, LandsideField } from './types.ts'

function halls(): Cell[] {
  const cells: Cell[] = []
  for (let c = 4; c <= 6; c++) for (let r = 4; r <= 6; r++) cells.push({ c, r })
  return cells
}

function approach(): Cell[] {
  const cells: Cell[] = []
  for (let r = 0; r <= 8; r++) cells.push({ c: 7, r })
  return cells
}

function field(patch: Partial<LandsideField> = {}): LandsideField {
  return {
    roads: approach(),
    terminals: halls(),
    busBays: [],
    parks: [],
    rail: false,
    paxPerDay: 0,
    departures: 2,
    ...patch,
  }
}

function parallel(roads: Cell[]): Cell[] {
  return [...roads, ...roads.map((cell) => ({ c: cell.c + 1, r: cell.r }))]
}

function longerCurb(roads: Cell[]): Cell[] {
  const extra: Cell[] = []
  for (let r = 3; r <= 7; r++) extra.push({ c: 7, r })
  const seen = new Set(roads.map((cell) => `${cell.c},${cell.r}`))
  return [...roads, ...extra.filter((cell) => !seen.has(`${cell.c},${cell.r}`))]
}

describe('curb network', () => {
  it('gives the hall frontage a stall count and the approach one lane', () => {
    const net = buildNetwork(field())
    expect(net.frontage.map((cell) => cell.r).sort((a, b) => a - b)).toEqual([4, 5, 6])
    expect(net.curbStalls).toBe(3 * LANDSIDE.stallsPerCurbCell)
    expect(net.lanes).toBe(1)
    expect(net.path[0]).toEqual({ c: 7, r: 0 })
    expect(net.path.at(-1)?.c).toBe(7)
  })

  it('counts a parallel road as a second lane only when it runs the whole approach', () => {
    const base = field()
    expect(approachLanes(buildNetwork(base).path, parallel(base.roads))).toBe(2)
    const stub = [...base.roads, { c: 8, r: 4 }]
    expect(approachLanes(buildNetwork(base).path, stub)).toBe(1)
  })
})

describe('capacity', () => {
  it('keeps a small bank on time', () => {
    const sim = new LandsideTraffic()
    let view = sim.snapshot()
    let steppedOut = 0
    for (let t = 0; t < 90; t++) {
      view = sim.tick(1, field())
      steppedOut = Math.max(steppedOut, view.passengers.length)
    }
    expect(view.delaySec).toBeLessThan(LANDSIDE.delayGraceSec)
    expect(view.queue).toBeLessThan(1)
    expect(view.satisfactionDelta).toBe(0)
    expect(view.vehicles.length).toBeGreaterThan(0)
    expect(view.vehicles.some((car) => car.state === 'stop' || car.state === 'leave')).toBe(true)
    expect(steppedOut).toBeGreaterThan(0)
  })

  it('queues cars and nudges satisfaction once the bank outgrows the curb', () => {
    const sim = new LandsideTraffic()
    const grown = field({ departures: 14, paxPerDay: 2400 })
    let view = sim.snapshot()
    let heard = ''
    for (let t = 0; t < 120; t++) {
      view = sim.tick(1, grown)
      if (view.news) heard = view.news
    }
    expect(view.pressure).toBeGreaterThan(1)
    expect(view.queue).toBeGreaterThan(2)
    expect(view.delaySec).toBeGreaterThan(LANDSIDE.delayGraceSec)
    expect(view.satisfactionDelta).toBeLessThan(0)
    expect(heard).toMatch(/arriving late/)
    expect(view.vehicles.some((car) => car.state === 'queue')).toBe(true)
  })

  it('relieves a lane bottleneck when the player builds a parallel lane', () => {
    const grown = field({ departures: 14, paxPerDay: 2400 })
    const before = measure(grown)
    const after = measure(grown, buildNetwork({ ...grown, roads: parallel(grown.roads) }))
    expect(after.lanes).toBeGreaterThan(before.lanes)
    expect(after.laneFlowPerMin).toBeGreaterThan(before.laneFlowPerMin)
    expect(after.delaySec).toBeLessThan(before.delaySec)
  })

  it('relieves the curb when the frontage gets longer', () => {
    const shortRoads = parallel(approach()).filter((cell) => cell.r <= 5)
    const tight = field({ departures: 10, paxPerDay: 400, roads: shortRoads })
    const short = measure(tight)
    const extended = measure(
      tight,
      buildNetwork({ ...tight, roads: longerCurb(parallel(approach())) }),
    )
    expect(extended.curbStalls).toBeGreaterThan(short.curbStalls)
    expect(extended.delaySec).toBeLessThan(short.delaySec)
  })

  it('lets parking and a bus bay take cars and coaches off the curb', () => {
    const grown = field({ departures: 14, paxPerDay: 2400 })
    const bare = measure(grown)
    const parked = measure(grown, buildNetwork({ ...grown, parks: [{ c: 9, r: 4, kind: 'park_g' }] }))
    const bay = measure(grown, buildNetwork({ ...grown, busBays: [{ c: 9, r: 6 }] }))
    expect(parked.curbVehPerMin).toBeLessThan(bare.curbVehPerMin)
    expect(parked.parkSpaces).toBe(LANDSIDE.parkSpaces.park_g)
    expect(bay.busBays).toBe(1)
    expect(bay.curbVehPerMin).toBeLessThan(bare.curbVehPerMin)
    expect(bay.modes.bus).toBeGreaterThan(0)
  })

  it('moves a share off the road once rail is open', () => {
    const grown = field({ departures: 14, paxPerDay: 2400 })
    const road = measure(grown)
    const rail = measure({ ...grown, rail: true })
    expect(rail.modes.rail).toBeGreaterThan(0)
    expect(rail.roadVehPerMin).toBeLessThan(road.roadVehPerMin)
  })

  it('grows the arrival rate with the airport', () => {
    const quiet = measure(field({ departures: 1, paxPerDay: 40 }))
    const busy = measure(field({ departures: 12, paxPerDay: 2000 }))
    expect(busy.arrivalsPerMin).toBeGreaterThan(quiet.arrivalsPerMin * 2)
  })

  it('paints load from green through amber to red', () => {
    expect(pressureColor(0.2)).toBe('#3dbe6e')
    expect(pressureColor(0.8)).toBe('#e0b15a')
    expect(pressureColor(1.4)).toBe('#d35a4a')
  })

  it('repeats the same cars for the same field', () => {
    const grown = field({ departures: 8, paxPerDay: 900 })
    const a = new LandsideTraffic()
    const b = new LandsideTraffic()
    let left = a.snapshot()
    let right = b.snapshot()
    for (let t = 0; t < 40; t++) {
      left = a.tick(0.25, grown)
      right = b.tick(0.25, grown)
    }
    expect(left).toEqual(right)
  })
})
