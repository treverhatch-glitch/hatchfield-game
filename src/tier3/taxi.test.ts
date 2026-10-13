import { describe, expect, it } from 'vitest'
import { MRO_TAXI_MINUTES } from './config.ts'
import {
  bayOffset,
  createTaxiMachine,
  machinePose,
  mroRoute,
  poseDelta,
  poseForPhase,
  stepTaxiMachine,
} from './taxi.ts'

const stand = { c: 12, r: 21 }
const hangar = { c: 10, r: 23 }
const taxiway = [
  stand,
  { c: 12, r: 22 },
  { c: 12, r: 23 },
  { c: 11, r: 23 },
  hangar,
]

function routeFor(bayId: string, size: 'narrow' | 'wide' | 'jumbo') {
  return mroRoute(stand, taxiway, hangar, bayId, size)
}

describe('MRO bay taxi', () => {
  it('enters along the taxiway, sits in the bay, and exits to the stand', () => {
    const path = routeFor('narrow-a', 'narrow')
    let machine = createTaxiMachine(path, 8, 1)
    const seen: string[] = []
    let steps = 0
    let previous = machinePose(machine)
    expect(previous.atStand).toBe(true)
    expect(previous.inBay).toBe(false)
    while (machine.leg !== 'done' && steps < 400) {
      const before = machinePose(machine)
      machine = stepTaxiMachine(machine, 1)
      const pose = machinePose(machine)
      const moved = poseDelta(before, pose)
      const span = path.reduce((sum, point, index) => {
        const next = path[index + 1]
        return next ? sum + Math.hypot(next.c - point.c, next.r - point.r) : sum
      }, 0)
      expect(moved).toBeLessThan(span * (1 / MRO_TAXI_MINUTES) + 0.05)
      previous = pose
      if (!seen.includes(machine.leg)) seen.push(machine.leg)
      steps += 1
    }
    expect(seen).toEqual(['enter', 'service', 'exit', 'done'])
    expect(machine.leg).toBe('done')
    const parked = machinePose(machine)
    expect(parked.atStand).toBe(true)
    expect(parked.inBay).toBe(false)
    expect(parked.x).toBeCloseTo(stand.c)
    expect(parked.y).toBeCloseTo(stand.r)
    expect(previous.atStand).toBe(true)
  })

  it('holds in the bay when the check cannot move, then leaves once the rate returns', () => {
    const path = routeFor('wide', 'wide')
    let machine = createTaxiMachine(path, 10, 0)
    machine = stepTaxiMachine(machine, MRO_TAXI_MINUTES)
    expect(machine.leg).toBe('service')
    const bay = machinePose(machine)
    expect(bay.inBay).toBe(true)
    machine = stepTaxiMachine(machine, 500)
    expect(machine.leg).toBe('service')
    expect(machinePose(machine).inBay).toBe(true)
    machine = { ...machine, serviceRate: 1 }
    let guard = 0
    while (machine.leg !== 'done' && guard < 400) {
      machine = stepTaxiMachine(machine, 1)
      guard += 1
    }
    expect(machine.leg).toBe('done')
    expect(machinePose(machine).atStand).toBe(true)
  })

  it('parks narrow, wide, and jumbo aircraft in different bay slots', () => {
    const sizes = [
      ['narrow-a', 'narrow'],
      ['wide', 'wide'],
      ['jumbo', 'jumbo'],
    ] as const
    const ends = sizes.map(([bayId, size]) => {
      const path = routeFor(bayId, size)
      const pose = poseForPhase({ phase: 'in_bay', remaining: 10, path })
      const slot = bayOffset(bayId, size)
      expect(pose.inBay).toBe(true)
      expect(pose.door).toBe(1)
      expect(pose.x).toBeCloseTo(hangar.c + slot.c)
      expect(pose.y).toBeCloseTo(hangar.r + slot.r)
      expect(Math.hypot(pose.x - hangar.c, pose.y - hangar.r)).toBeLessThan(1)
      return `${pose.x.toFixed(2)},${pose.y.toFixed(2)}`
    })
    expect(new Set(ends).size).toBe(3)
  })

  it('opens the door on the roll-in and shuts it again on the way out', () => {
    const path = routeFor('jumbo', 'jumbo')
    const closed = poseForPhase({ phase: 'taxi_in', remaining: MRO_TAXI_MINUTES, path })
    const opening = poseForPhase({ phase: 'taxi_in', remaining: MRO_TAXI_MINUTES * 0.2, path })
    const inside = poseForPhase({ phase: 'in_bay', remaining: 4, path })
    const leaving = poseForPhase({ phase: 'taxi_out', remaining: MRO_TAXI_MINUTES * 0.2, path })
    expect(closed.door).toBe(0)
    expect(opening.door).toBe(1)
    expect(inside.door).toBe(1)
    expect(inside.inBay).toBe(true)
    expect(leaving.door).toBe(0)
    expect(leaving.atStand).toBe(false)
  })
})
