import { describe, expect, it } from 'vitest'
import { LANDSIDE } from './config.ts'
import { LandsideTraffic } from './engine.ts'
import { buildNetwork } from './network.ts'
import type { Cell, LandsideField } from './types.ts'

function halls(): Cell[] {
  const cells: Cell[] = []
  for (let c = 4; c <= 6; c++) for (let r = 4; r <= 6; r++) cells.push({ c, r })
  return cells
}

function roads(): Cell[] {
  const cells: Cell[] = []
  for (let r = 0; r <= 8; r++) cells.push({ c: 7, r })
  return cells
}

function field(departures: number, paxPerDay: number, extra: Partial<LandsideField> = {}): LandsideField {
  return {
    roads: roads(),
    terminals: halls(),
    busBays: [],
    parks: [],
    rail: false,
    paxPerDay,
    departures,
    ...extra,
  }
}

/** The built answer: a second lane, a longer curb, a garage, a bus bay, and rail. */
function relieved(base: LandsideField): LandsideField {
  const widened: Cell[] = []
  for (const road of base.roads) {
    widened.push(road)
    widened.push({ c: road.c + 1, r: road.r })
  }
  const terminals = [...base.terminals]
  for (let c = 4; c <= 6; c++) {
    terminals.push({ c, r: 7 })
    terminals.push({ c, r: 8 })
  }
  return {
    ...base,
    roads: widened,
    terminals,
    parks: [{ c: 10, r: 4, kind: 'park_g' }],
    busBays: [{ c: 10, r: 6 }],
    rail: true,
  }
}

describe('landside soak', () => {
  it('grows a queue with the airport, then clears it when the curb is built out', () => {
    const sim = new LandsideTraffic()
    let view = sim.snapshot()
    for (let minute = 0; minute < 3; minute++) {
      const departures = 1 + minute
      for (let t = 0; t < 30; t++) view = sim.tick(1, field(departures, 40 * departures))
    }
    expect(view.delaySec).toBeLessThan(LANDSIDE.delayGraceSec)
    expect(Number.isFinite(view.queue)).toBe(true)
    expect(view.vehicles.every((car) => Number.isFinite(car.c) && Number.isFinite(car.r))).toBe(true)

    const grown = field(14, 2400)
    for (let t = 0; t < 180; t++) view = sim.tick(1, grown)
    const late = view.delaySec
    const queued = view.queue
    expect(late).toBeGreaterThan(LANDSIDE.delayGraceSec)
    expect(queued).toBeGreaterThan(2)
    expect(view.satisfactionDelta).toBeLessThan(0)
    expect(view.satisfactionDelta).toBeGreaterThan(-LANDSIDE.satCapPerSec - 1e-9)

    const fixed = relieved(grown)
    expect(buildNetwork(fixed).lanes).toBeGreaterThan(buildNetwork(grown).lanes)
    expect(buildNetwork(fixed).curbStalls).toBeGreaterThan(buildNetwork(grown).curbStalls)
    for (let t = 0; t < 180; t++) view = sim.tick(1, fixed)
    expect(view.delaySec).toBeLessThan(late * 0.5)
    expect(view.delaySec).toBeLessThan(LANDSIDE.delayGraceSec)
    expect(view.queue).toBeLessThan(queued * 0.5)
    expect(view.satisfactionDelta).toBe(0)
    for (const segment of view.segments) {
      expect(Number.isFinite(segment.ratio)).toBe(true)
      expect(Number.isFinite(segment.flowPerMin)).toBe(true)
      expect(segment.capacity).toBeGreaterThan(0)
    }
  })
})
