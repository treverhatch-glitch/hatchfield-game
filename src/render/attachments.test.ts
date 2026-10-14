import { afterEach, describe, expect, it } from 'vitest'
import { createAircraft } from './aircraft/factory'
import { ALL_MODELS } from './vehicleModels'
import { LOCK_TOLERANCE_M, STAND_AIRFRAME, TURN_STEPS, type StandSize } from '../logistics/socketTurn'
import { aircraftSocketRig, crewRig, disposeTurnaround, runTurnaround } from './attachments'
import { vehicleRig } from './vehicles'

const roots: import('three').Object3D[] = []
afterEach(() => {
  for (const root of roots) disposeTurnaround(root)
  roots.length = 0
})

const KIND: Record<string, string> = {
  fuel_tanker: 'fuel', hydrant_cart: 'hydrant', baggage_train: 'bags', baggage_cart: 'cart', belt_loader: 'belt_loader',
  catering_hilift: 'catering', arff: 'fire', deice: 'deice', apron_bus: 'termbus', coach: 'coach', box_truck: 'citycargo',
  van: 'delivery', towbar_tug: 'tow', towbarless_tug: 'pushback_tug', gpu: 'gpu', stairs: 'stairs', k_loader: 'cargo',
  uld_dolly: 'dolly', lavatory_truck: 'lav', water_truck: 'water',
}

describe('attachment sockets', () => {
  it('puts a named dock socket on every vehicle', () => {
    for (const model of ALL_MODELS) {
      const rig = vehicleRig(KIND[model] ?? 'delivery', '#3a7bd5')
      roots.push(rig)
      expect(rig.getObjectByName('dock'), model).toBeTruthy()
    }
    expect(roots.find((r) => r.name === 'rig:fuel_tanker')?.getObjectByName('hose_reel_out')).toBeTruthy()
  })

  it('names the crew hand and the airframe service points', () => {
    const crew = crewRig()
    expect(crew.getObjectByName('crew_hand_r')).toBeTruthy()
    expect(crew.getObjectByName('crew_hand_l')).toBeTruthy()
    const plane = aircraftSocketRig('b738')
    for (const name of ['plane_fuel_port', 'plane_cargo_door_fwd', 'catering_door', 'plane_pax_door', 'plane_nose_gear']) {
      expect(plane.getObjectByName(name), name).toBeTruthy()
    }
    const built = createAircraft('e175', { body: '#fff', stripe: '#123' })
    roots.push(built)
    expect(built.getObjectByName('plane_fuel_port')).toBeTruthy()
    expect(built.getObjectByName('plane_nose_gear')).toBeTruthy()
  })

  it.each(['S', 'M', 'L'] as const)('runs a %s stand turnaround on the sockets', (size: StandSize) => {
    const { root, report } = runTurnaround(size)
    roots.push(root)
    expect(report.steps, STAND_AIRFRAME[size]).toEqual([...TURN_STEPS])
    expect(report.maxLockGap, 'lock').toBeLessThanOrEqual(LOCK_TOLERANCE_M)
    expect(report.loose, 'loose props').toEqual([])
    expect(report.fuelStopGap, 'fuel dock').toBeLessThanOrEqual(LOCK_TOLERANCE_M)
    expect(report.approachGap, 'not docked yet').toBeGreaterThan(5)
    expect(report.hoseMinY, 'hose above ground').toBeGreaterThan(-0.02)
    expect(report.departedGap, 'belt leaves').toBeGreaterThan(0.5)
  })
})
