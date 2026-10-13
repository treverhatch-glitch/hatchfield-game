import { describe, expect, it } from 'vitest'
import { AIRFRAMES } from './airframes'

describe('AIRFRAMES catalog', () => {
  it('contains the four new airframe IDs', () => {
    expect(AIRFRAMES.a223).toBeDefined()
    expect(AIRFRAMES.e195e2).toBeDefined()
    expect(AIRFRAMES.b38m).toBeDefined()
    expect(AIRFRAMES.a21xlr).toBeDefined()

    expect(AIRFRAMES.a223.id).toBe('a223')
    expect(AIRFRAMES.e195e2.id).toBe('e195e2')
    expect(AIRFRAMES.b38m.id).toBe('b38m')
    expect(AIRFRAMES.a21xlr.id).toBe('a21xlr')
  })

  it('has unique IDs equal to object keys', () => {
    const keys = Object.keys(AIRFRAMES)
    const ids = new Set<string>()

    for (const key of keys) {
      const airframe = AIRFRAMES[key]
      expect(airframe.id).toBe(key)
      expect(ids.has(airframe.id)).toBe(false)
      ids.add(airframe.id)
    }
  })

  it('has non-negative numeric fields for all airframes', () => {
    for (const [key, af] of Object.entries(AIRFRAMES)) {
      expect(af.minRunway, `${key}.minRunway`).toBeGreaterThanOrEqual(0)
      expect(af.paxMin, `${key}.paxMin`).toBeGreaterThanOrEqual(0)
      expect(af.paxMax, `${key}.paxMax`).toBeGreaterThanOrEqual(0)
      expect(af.seats, `${key}.seats`).toBeGreaterThanOrEqual(0)
      expect(af.bagVolume, `${key}.bagVolume`).toBeGreaterThanOrEqual(0)
      expect(af.cargoHold, `${key}.cargoHold`).toBeGreaterThanOrEqual(0)
      expect(af.fuelLoad, `${key}.fuelLoad`).toBeGreaterThanOrEqual(0)
      expect(af.scale, `${key}.scale`).toBeGreaterThanOrEqual(0)
      expect(af.landingMult, `${key}.landingMult`).toBeGreaterThanOrEqual(0)
    }
  })

  it('ensures paxMin <= seats <= paxMax for passenger airframe types', () => {
    for (const [key, af] of Object.entries(AIRFRAMES)) {
      if (af.kind === 'regional' || af.kind === 'narrowbody' || af.kind === 'widebody') {
        expect(af.paxMin, `${key}.paxMin <= seats`).toBeLessThanOrEqual(af.seats)
        expect(af.seats, `${key}.seats <= paxMax`).toBeLessThanOrEqual(af.paxMax)
      }
    }
  })
})
