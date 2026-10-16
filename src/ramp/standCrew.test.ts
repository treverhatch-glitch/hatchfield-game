import { describe, expect, it } from 'vitest'
import { AIRCRAFT_VISUAL_SCALE, getAircraftSpec } from '../render/aircraft/specs.ts'
import { STAND_TIMELINE as T } from './crewConfig.ts'
import { standConePoints, standCrewPeople, standProps, type StandArrival } from './standCrew.ts'

const at = (t: number): StandArrival => ({ id: 'f1', x: 0, y: 0, heading: 0, lengthM: 37.6, spanM: 35.8, t })

describe('stand arrival crew', () => {
  it('has the marshaller wave the aircraft in, then leave', () => {
    const guiding = standCrewPeople(at(2), 1).find((p) => p.id === 'f1:marshal')
    expect(guiding?.role).toBe('walker')
    expect(guiding?.pose).toBe('reach')
    // In front of the nose, facing back at the aircraft.
    expect(guiding!.c).toBeGreaterThan(37.6 / 2)
    expect(standCrewPeople(at(T.marshalOff + 1), 1).some((p) => p.id === 'f1:marshal')).toBe(false)
  })

  it('walks the chocks pair to the nose gear and kneels there', () => {
    const walking = standCrewPeople(at((T.chocksWalk + T.chocksOn) / 2), 1).filter((p) => p.id.includes('chock'))
    expect(walking).toHaveLength(2)
    expect(walking.every((p) => p.pose === 'walk')).toBe(true)
    const kneeling = standCrewPeople(at(T.chocksOn + 1), 1).filter((p) => p.id.includes('chock'))
    expect(kneeling.every((p) => p.pose === 'kneel')).toBe(true)
    expect(standProps(at(T.chocksOn + 1), 1).filter((p) => p.kind === 'chock')).toHaveLength(2)
  })

  it('sets the four cones in order and keeps them until pushback', () => {
    expect(standProps(at(T.conesStart - 0.1), 1).filter((p) => p.kind === 'cone')).toHaveLength(0)
    expect(standProps(at(T.conesStart + 0.1), 1).filter((p) => p.kind === 'cone')).toHaveLength(1)
    const settled = standProps(at(T.settled), 1)
    expect(settled.filter((p) => p.kind === 'cone')).toHaveLength(4)
    // Wingtip cones sit outside the span.
    const [, left, right] = standConePoints(at(0))
    expect(Math.abs(left[1])).toBeGreaterThan(35.8 / 2)
    expect(Math.abs(right[1])).toBeGreaterThan(35.8 / 2)
    // Nobody left standing around once the aircraft is settled.
    expect(standCrewPeople(at(T.settled), 1)).toHaveLength(0)
  })

  it('never teleports anyone between frames', () => {
    let prev = new Map<string, { c: number; r: number }>()
    for (let t = 0; t < T.settled; t += 0.05) {
      const now = new Map(standCrewPeople(at(t), 1).map((p) => [p.id, { c: p.c, r: p.r }]))
      for (const [id, p] of now) {
        const was = prev.get(id)
        if (was) expect(Math.hypot(p.c - was.c, p.r - was.r)).toBeLessThan(1.2)
      }
      prev = now
    }
  })

  it('keeps arrival crew outside the drawn fuselage on a CRJ and a 737', () => {
    const inside = (x: number, z: number, length: number, skin: number) => {
      const half = length / 2
      const rad = skin + 0.15
      const ax = Math.abs(x)
      if (ax > half + 0.15) return false
      const body = Math.max(0, half - rad)
      if (ax <= body) return Math.abs(z) <= rad
      const dx = ax - body
      return dx * dx + z * z <= rad * rad
    }
    for (const id of ['crj700', 'b738'] as const) {
      const spec = getAircraftSpec(id)
      const s = AIRCRAFT_VISUAL_SCALE
      const arrival = (t: number): StandArrival => ({
        id: 'f1',
        x: 0,
        y: 0,
        heading: 0,
        lengthM: spec.lengthM * s,
        spanM: spec.spanM * s,
        skinM: spec.rx * s,
        t,
      })
      for (let t = 0; t < T.settled; t += 0.1) {
        for (const person of standCrewPeople(arrival(t), 1)) {
          expect(inside(person.c, person.r, spec.lengthM * s, spec.rx * s), `${id} ${person.id} t=${t}`).toBe(false)
        }
      }
    }
  })
})
