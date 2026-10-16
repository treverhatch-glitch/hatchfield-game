import { describe, expect, it } from 'vitest'
import { penetration, type Body } from '../bodies/index.ts'
import { LANDSIDE } from './config.ts'
import { LandsideTraffic, measure } from './engine.ts'
import { starterField } from './fixtures.test-util.ts'
import type { Cell, LandsideField, VehicleRead } from './types.ts'

const M = LANDSIDE.cellM

function body(car: VehicleRead): Body {
  const size = LANDSIDE.bodies[car.kind]
  return {
    id: car.id,
    owner: 'landside',
    kind: car.kind,
    x: car.c * M,
    y: car.r * M,
    heading: car.heading,
    halfLength: size.lengthM / 2,
    halfWidth: size.widthM / 2,
    speed: car.speed,
  }
}

function worstOverlap(cars: VehicleRead[]): { depth: number; pair: string } {
  let worst = { depth: 0, pair: '' }
  const bodies = cars.map(body)
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const d = penetration(bodies[i], bodies[j])
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

  it('steers through a lane change, and turns around on an arc instead of snapping', () => {
    const sim = new LandsideTraffic()
    const field = stamped({ departures: 14, paxPerDay: 2400 })
    const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
    let leaned = 0
    let noseIn = 0
    let maxTurnStep = 0
    let arcSamples = 0
    const prev = new Map<string, { heading: number; r: number }>()
    for (let t = 0; t < 900 * 4; t++) {
      for (const car of sim.tick(0.25, field).vehicles) {
        const was = prev.get(car.id)
        prev.set(car.id, { heading: car.heading, r: car.r })
        if (car.r > 2 && car.r < 10 && Math.abs(Math.cos(car.heading)) > 0.08 && Math.abs(Math.sin(car.heading)) > 0.9) leaned++
        // About 17° or more off the lane line: the nose is leading into the lane, not sliding.
        if (car.r > 2 && car.r < 10 && Math.abs(Math.cos(car.heading)) > 0.3 && Math.abs(Math.sin(car.heading)) > 0.85) noseIn++
        if (!was || car.r < 10.5 || was.r < 10.5) continue
        const step = Math.abs(wrapA(car.heading - was.heading))
        maxTurnStep = Math.max(maxTurnStep, step)
        if (step > 0.02) arcSamples++
      }
    }
    expect(leaned, 'lane changes yaw the nose').toBeGreaterThan(20)
    expect(noseIn, 'lane changes point well into the new lane').toBeGreaterThan(10)
    expect(arcSamples, 'the U-turn is crossed in more than one pose').toBeGreaterThan(20)
    // The 2×4 hall lengthens the exit by one cell, so a lane change can still
    // be yawing where the curb lane enters the U-turn. This field peaks near
    // 0.49 rad per step. A flipped heading is near π.
    expect(maxTurnStep, 'no heading snap on the U-turn').toBeLessThan(0.55)
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

  it('follows by at least a body length in the through lanes, buses and taxis included', { timeout: 60_000 }, () => {
    const lengthOf = (car: VehicleRead) => LANDSIDE.bodies[car.kind].lengthM
    for (const field of [stamped({ departures: 14, paxPerDay: 2400 }), starterField({ departures: 14, paxPerDay: 2400 })]) {
      const sim = new LandsideTraffic()
      let pairs = 0
      let closest = { short: Infinity, at: '' }
      for (let t = 0; t < 1200 * 4; t++) {
        const straight = sim.tick(0.25, field).vehicles.filter(
          (car) => car.lane < 2 && car.r > 0.5 && car.r < 11.5 && Math.abs(Math.sin(car.heading)) > 0.999,
        )
        for (const a of straight) {
          for (const b of straight) {
            const dir = Math.sign(Math.sin(a.heading))
            if (a === b || a.lane !== b.lane || Math.sign(Math.sin(b.heading)) !== dir) continue
            if (Math.abs(a.c - b.c) > 0.05) continue
            const ahead = (b.r - a.r) * dir * M
            if (ahead <= 0) continue
            const gap = ahead - lengthOf(a) / 2 - lengthOf(b) / 2
            const want = Math.max(LANDSIDE.minGapM, LANDSIDE.followBodyLengths * lengthOf(a))
            if (gap < want * 3) pairs++
            if (gap - want < closest.short) closest = { short: gap - want, at: `${a.id} behind ${b.id} at ${t / 4}s` }
          }
        }
      }
      expect(pairs).toBeGreaterThan(50)
      expect(closest.short, closest.at).toBeGreaterThanOrEqual(-0.02)
      expect(closest.short).toBeLessThan(1)
    }
  })

  it('never drives through a stopped bus: cars behind it in its lane wait, others pass in the next lane', () => {
    const sim = new LandsideTraffic()
    const field = stamped({ departures: 14, paxPerDay: 2400 })
    const along = (car: VehicleRead) => car.r * Math.sign(Math.sin(car.heading))
    let before = new Map<string, VehicleRead>()
    let queued = 0
    let passed = 0
    for (let t = 0; t < 1800 * 4; t++) {
      const now = new Map(sim.tick(0.25, field).vehicles.map((car) => [car.id, car]))
      for (const bus of now.values()) {
        const was = before.get(bus.id)
        if (bus.kind !== 'bus' || !was || was.speed > 0.05 || bus.speed > 0.05) continue
        for (const car of now.values()) {
          const prev = before.get(car.id)
          if (car === bus || !prev || Math.abs(Math.sin(car.heading)) < 0.99) continue
          if (Math.sign(Math.sin(car.heading)) !== Math.sign(Math.sin(bus.heading))) continue
          const wasBehind = along(prev) < along(was)
          const isAhead = along(car) > along(bus)
          if (car.lane === bus.lane && prev.lane === was.lane) {
            expect(wasBehind && isAhead, `${car.id} through stopped ${bus.id} at ${t / 4}s`).toBe(false)
            if (wasBehind && (along(bus) - along(car)) * M < 20) queued++
          } else if (wasBehind && isAhead) {
            passed++
          }
        }
      }
      before = now
    }
    expect(queued).toBeGreaterThan(0)
    expect(passed).toBeGreaterThan(0)
  })

  it('keeps vehicles leaving every ten minutes for two hours, so merges and pull-outs never lock', { timeout: 60_000 }, () => {
    for (const [name, field] of [
      ['stamped', stamped({ departures: 14, paxPerDay: 2400 })],
      ['stamped with a car park', stamped({ departures: 14, paxPerDay: 2400, parks: [{ c: 16, r: 6, kind: 'park_s' }] })],
      ['jammed starter', starterField({ departures: 14, paxPerDay: 2400 })],
    ] as const) {
      const sim = new LandsideTraffic()
      let live = new Set<string>()
      let gone = 0
      for (let t = 0; t < 7200 * 4; t++) {
        const now = new Set(sim.tick(0.25, field).vehicles.map((car) => car.id))
        for (const id of live) if (!now.has(id)) gone++
        live = now
        if ((t + 1) % (600 * 4)) continue
        expect(gone, `${name}: exits in the 10 minutes to ${(t + 1) / 240} min`).toBeGreaterThan(20)
        gone = 0
      }
    }
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
