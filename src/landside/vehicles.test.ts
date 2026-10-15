import { describe, expect, it } from 'vitest'
import { LANDSIDE } from './config.ts'
import { LandsideTraffic, measure } from './engine.ts'
import { starterField } from './fixtures.test-util.ts'
import type { Cell, LandsideField, VehicleRead } from './types.ts'

const M = LANDSIDE.cellM

interface Box {
  x: number
  y: number
  ux: number
  uy: number
  hl: number
  hw: number
}

function box(car: VehicleRead): Box {
  const body = LANDSIDE.bodies[car.kind]
  return {
    x: car.c * M,
    y: car.r * M,
    ux: Math.cos(car.heading),
    uy: Math.sin(car.heading),
    hl: body.lengthM / 2,
    hw: body.widthM / 2,
  }
}

/** Separating-axis depth of two oriented rectangles, metres. Zero or less means apart. */
function depth(a: Box, b: Box): number {
  const axes = [
    [a.ux, a.uy],
    [-a.uy, a.ux],
    [b.ux, b.uy],
    [-b.uy, b.ux],
  ]
  let least = Infinity
  for (const [nx, ny] of axes) {
    const ra = a.hl * Math.abs(a.ux * nx + a.uy * ny) + a.hw * Math.abs(-a.uy * nx + a.ux * ny)
    const rb = b.hl * Math.abs(b.ux * nx + b.uy * ny) + b.hw * Math.abs(-b.uy * nx + b.ux * ny)
    const d = Math.abs((b.x - a.x) * nx + (b.y - a.y) * ny)
    least = Math.min(least, ra + rb - d)
  }
  return least
}

function worstOverlap(cars: VehicleRead[]): { depth: number; pair: string } {
  let worst = { depth: 0, pair: '' }
  const boxes = cars.map(box)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const d = depth(boxes[i], boxes[j])
      if (d > worst.depth) worst = { depth: d, pair: `${cars[i].id}/${cars[j].id}` }
    }
  }
  return worst
}

/** The starter with the three curb stamps across the road from the hall. */
function stamped(patch: Partial<LandsideField> = {}): LandsideField {
  return starterField({
    busBays: [{ c: 18, r: 8 }],
    curbLanes: [{ c: 18, r: 9 }],
    taxiRanks: [{ c: 18, r: 10 }],
    ...patch,
  })
}

/** A road that turns east past the hall and dead-ends, so traffic corners both ways. */
function cornerField(patch: Partial<LandsideField> = {}): LandsideField {
  const roads: Cell[] = []
  for (let r = 0; r <= 6; r++) roads.push({ c: 7, r })
  for (let c = 8; c <= 12; c++) roads.push({ c, r: 6 })
  const terminals: Cell[] = []
  for (let c = 4; c <= 6; c++) for (let r = 3; r <= 5; r++) terminals.push({ c, r })
  return {
    roads,
    terminals,
    busBays: [{ c: 10, r: 7 }],
    taxiRanks: [{ c: 9, r: 5 }],
    parks: [{ c: 11, r: 5, kind: 'park_s' }],
    rail: false,
    paxPerDay: 2400,
    departures: 14,
    ...patch,
  }
}

describe('landside vehicles', () => {
  it('never lets two bodies overlap, on a straight road, a busy curb, or round corners', () => {
    const cases: [string, LandsideField, number][] = [
      ['quiet starter', starterField(), 0.25],
      ['jammed starter', starterField({ departures: 14, paxPerDay: 2400 }), 0.25],
      ['stamped starter', stamped({ departures: 14, paxPerDay: 2400, parks: [{ c: 16, r: 6, kind: 'park_s' }] }), 0.25],
      ['stamped starter, long ticks', stamped({ departures: 14, paxPerDay: 2400 }), 1],
      ['corner road', cornerField(), 0.25],
    ]
    for (const [name, field, dt] of cases) {
      const sim = new LandsideTraffic()
      let worst = { depth: 0, pair: '', t: 0 }
      let most = 0
      for (let t = 0; t < 1800 / dt; t++) {
        const view = sim.tick(dt, field)
        most = Math.max(most, view.vehicles.length)
        const w = worstOverlap(view.vehicles)
        if (w.depth > worst.depth) worst = { ...w, t: t * dt }
      }
      expect(most, name).toBeGreaterThan(2)
      expect(worst.depth, `${name}: ${worst.pair} at ${worst.t}s`).toBeLessThanOrEqual(0.01)
    }
  })

  it('sends vehicles at the arrival rate the capacity model measures', () => {
    const field = starterField()
    const sample = measure(field)
    const perMin = sample.carVehPerMin + sample.taxiVehPerMin + sample.busVehPerMin
    const sim = new LandsideTraffic()
    const ids = new Set<string>()
    const minutes = 20
    for (let t = 0; t < minutes * 60 * 2; t++) for (const car of sim.tick(0.5, field).vehicles) ids.add(car.id)
    expect(perMin).toBeGreaterThan(1)
    expect(ids.size).toBeGreaterThanOrEqual(Math.floor(perMin * minutes * 0.95))
    expect(ids.size).toBeLessThanOrEqual(Math.ceil(perMin * minutes * 1.05) + 1)
  })

  it('keeps a quiet starter curb clear: no more stopped than stalls, no standing queue', () => {
    const field = starterField()
    const sim = new LandsideTraffic()
    let most = 0
    let stopped = 0
    let queued = 0
    let pressure = 0
    for (let t = 0; t < 20 * 60 * 4; t++) {
      const view = sim.tick(0.25, field)
      pressure = view.pressure
      most = Math.max(most, view.vehicles.length)
      stopped = Math.max(stopped, view.vehicles.filter((car) => car.state === 'stop').length)
      queued = Math.max(queued, view.vehicles.filter((car) => car.state === 'queue').length)
    }
    expect(pressure).toBeLessThan(1)
    expect(stopped).toBeLessThanOrEqual(3)
    expect(queued).toBeLessThanOrEqual(2)
    expect(most).toBeLessThanOrEqual(10)
  })

  it('drives one car in from the city edge, stops it at the hall, lets a passenger out, then turns it round and away', () => {
    const field = starterField()
    const sim = new LandsideTraffic()
    const states: string[] = []
    let stopAt: VehicleRead | null = null
    let walked = false
    let turned = false
    let lastSeen: VehicleRead | null = null
    for (let t = 0; t < 600 * 4; t++) {
      const view = sim.tick(0.25, field)
      const car = view.vehicles.find((v) => v.id === 'curb-1')
      if (!car) {
        if (lastSeen) break
        continue
      }
      if (states.at(-1) !== car.state) states.push(car.state)
      if (car.state === 'stop' && !stopAt) stopAt = car
      if (view.passengers.some((p) => p.id.startsWith('curb-1-p'))) walked = true
      if (car.c > 17 && Math.sin(car.heading) < -0.9) turned = true
      lastSeen = car
    }
    expect(states[0]).toBe('drive')
    expect(states).toContain('stop')
    expect(states.at(-1)).toBe('leave')
    expect(stopAt).not.toBeNull()
    // In the layby on the hall side, beside the hall rows.
    expect(stopAt!.c).toBeLessThan(17 - 0.3)
    expect(stopAt!.r).toBeGreaterThan(7.5)
    expect(stopAt!.r).toBeLessThan(10.5)
    expect(walked).toBe(true)
    expect(turned).toBe(true)
    // It leaves at the north edge, on the far side of the median.
    expect(lastSeen!.r).toBeLessThan(0)
    expect(lastSeen!.c).toBeGreaterThan(17)
  })

  it('keeps right: southbound west of the median, northbound east of it', () => {
    const sim = new LandsideTraffic()
    const field = stamped({ departures: 8, paxPerDay: 900 })
    let checked = 0
    for (let t = 0; t < 1200; t++) {
      for (const car of sim.tick(0.25, field).vehicles) {
        if (car.r < 0.5 || car.r > 11.5) continue
        const s = Math.sin(car.heading)
        if (s > 0.95) {
          expect(car.c, car.id).toBeLessThan(17)
          checked++
        } else if (s < -0.95) {
          expect(car.c, car.id).toBeGreaterThan(17)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('changes lane to pass a held queue and back into the curb lane to stop', () => {
    const sim = new LandsideTraffic()
    const field = stamped({ departures: 14, paxPerDay: 2400 })
    const lanes = new Map<string, number[]>()
    for (let t = 0; t < 900 * 4; t++) {
      for (const car of sim.tick(0.25, field).vehicles) {
        const seq = lanes.get(car.id) ?? []
        if (seq.at(-1) !== car.lane) seq.push(car.lane)
        lanes.set(car.id, seq)
      }
    }
    const passed = [...lanes.values()].filter((seq) => seq.join(',').includes('1,0,1,2'))
    expect(passed.length).toBeGreaterThan(0)
  })

  it('treats bays, ranks and car parks as places to go', () => {
    const sim = new LandsideTraffic()
    const field = stamped({ departures: 8, paxPerDay: 900, parks: [{ c: 16, r: 6, kind: 'park_s' }] })
    const stops = new Map<string, VehicleRead>()
    const firstSeen = new Map<string, VehicleRead>()
    const live = new Set<string>()
    let parkedIn = 0
    for (let t = 0; t < (LANDSIDE.parkDwellMin * 60 + 300) * 2; t++) {
      const view = sim.tick(0.5, field)
      const now = new Set(view.vehicles.map((car) => car.id))
      for (const id of live) {
        const at = stops.get(id)
        if (!now.has(id) && at && at.r > 5.5 && at.r < 6.5) parkedIn++
      }
      for (const car of view.vehicles) {
        if (!firstSeen.has(car.id)) firstSeen.set(car.id, car)
        if (car.state === 'stop' && !stops.has(car.id)) stops.set(car.id, car)
      }
      live.clear()
      for (const id of now) live.add(id)
    }
    const all = [...stops.values()]
    const buses = all.filter((car) => car.kind === 'bus')
    const taxis = all.filter((car) => car.kind === 'taxi')
    expect(buses.length).toBeGreaterThan(0)
    for (const bus of buses) {
      expect(bus.c).toBeGreaterThan(17.3)
      expect(Math.round(bus.r)).toBe(8)
    }
    expect(taxis.some((taxi) => taxi.c > 17.3 && Math.round(taxi.r) === 10)).toBe(true)
    expect(parkedIn).toBeGreaterThan(0)
    // A parked car comes back out of the car park, not out of thin air.
    const outOfLot = [...firstSeen.values()].filter((car) => car.state === 'leave')
    expect(outOfLot.length).toBeGreaterThan(0)
    for (const car of outOfLot) {
      expect(Math.round(car.r)).toBe(6)
      expect(car.c).toBeLessThan(17)
    }
  })
})
