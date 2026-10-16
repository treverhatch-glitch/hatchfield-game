import { describe, expect, it } from 'vitest'
import { SERVICE_SPOT } from './serviceSpotData.ts'
import { auditSpots, reservedSpots } from './serviceSpots.ts'

const SMALL = ['crj700', 'e175'] as const
const LARGE = ['b738', 'b789'] as const

function dump(id: string) {
  return JSON.stringify(auditSpots(id))
}

describe('service spots', () => {
  it('parks a small bowser forward of the wing and angled, clear of the airframe', () => {
    for (const id of SMALL) {
      const audit = auditSpots(id)
      expect(audit.fuel.clear, dump(id)).toBe(true)
      expect(audit.bags.clear, dump(id)).toBe(true)
      expect(audit.belt.clear, dump(id)).toBe(true)
      expect(audit.fuel.size).toBe('small')
      expect(audit.fuel.yaw).toBeGreaterThan(0.5)
      expect(audit.fuel.localX).toBeGreaterThan(audit.leadingX)
      expect(audit.fuel.gaps[0], dump(id)).toBeGreaterThanOrEqual(SERVICE_SPOT.minSeparationM - 0.05)
      expect(audit.vehiclesClear, dump(id)).toBe(true)
      expect(audit.belt.tipApart, dump(id)).toBeLessThan(1.2)
      expect(audit.belt.deck, dump(id)).toBeGreaterThan(0.05)
    }
  })

  it('keeps a large bowser beside the fuel port, closer and less angled than a regional', () => {
    const regional = auditSpots('crj700')
    for (const id of LARGE) {
      const audit = auditSpots(id)
      expect(audit.fuel.clear, dump(id)).toBe(true)
      expect(audit.bags.clear, dump(id)).toBe(true)
      expect(audit.belt.clear, dump(id)).toBe(true)
      expect(audit.fuel.size).toBe('large')
      expect(audit.fuel.yaw).toBeLessThan(0.25)
      expect(Math.abs(audit.fuel.localX - audit.portX)).toBeLessThan(Math.abs(regional.fuel.localX - regional.portX))
      expect(audit.fuel.gaps[0], dump(id)).toBeGreaterThanOrEqual(SERVICE_SPOT.minSeparationM - 0.05)
      expect(audit.vehiclesClear, dump(id)).toBe(true)
      expect(audit.belt.tipApart, dump(id)).toBeLessThan(1.2)
      expect(audit.belt.deck, dump(id)).toBeGreaterThan(0.08)
    }
  })

  it('turns the stop with the aircraft heading', () => {
    const a = reservedSpots('crj700', { x: 10, y: 6, heading: 0 }).fuel
    const b = reservedSpots('crj700', { x: 10, y: 6, heading: Math.PI / 2 }).fuel
    const dx0 = a.x - 10
    const dy0 = a.y - 6
    expect(b.x - 10).toBeCloseTo(-dy0, 3)
    expect(b.y - 6).toBeCloseTo(dx0, 3)
    expect(Math.hypot(dx0, dy0)).toBeGreaterThan(0.2)
  })

  it('does not park either truck on the stand cell centre', () => {
    for (const id of [...SMALL, ...LARGE]) {
      const spots = reservedSpots(id, { x: 11, y: 6, heading: 0.4 })
      for (const spot of [spots.fuel, spots.bags, spots.belt]) {
        expect(Math.hypot(spot.x - 11, spot.y - 6)).toBeGreaterThan(0.15)
        expect(spot.socket === 'plane_fuel_port' || spot.socket === 'plane_cargo_door_fwd').toBe(true)
      }
      expect(spots.fuel.socket).toBe('plane_fuel_port')
      expect(spots.bags.socket).toBe('plane_cargo_door_fwd')
      expect(Math.hypot(spots.fuel.localX - spots.bags.localX, spots.fuel.localZ - spots.bags.localZ)).toBeGreaterThan(SERVICE_SPOT.minSeparationM - 0.05)
    }
  })
})
