import { afterEach, describe, expect, it } from 'vitest'
import { createBridges } from './aircraft/bridges'
import { buildTerminalProps } from './terminalProps'
import {
  BAG_STEPS,
  CATERING_STEPS,
  FUEL_STEPS,
  HANDOFF_STEP_M,
  LOCK_TOLERANCE_M,
  PAX_STEPS,
  STAND_AIRFRAME,
  ULD_STEPS,
  type StandSize,
} from '../logistics/socketTurn'
import { disposeJourney, resample, runJourneys } from './handoff'
import { vehicleRig } from './vehicles'
import * as THREE from 'three'

const roots: THREE.Object3D[] = []
afterEach(() => {
  for (const root of roots) disposeJourney(root)
  roots.length = 0
})

describe('socket handoffs', () => {
  it('names the sockets items travel between', () => {
    const cart = vehicleRig('cart', '#c4b7a6')
    const train = vehicleRig('bags', '#c9a227')
    const dolly = vehicleRig('dolly', '#8a939c')
    const lifter = vehicleRig('cargo', '#4a5568')
    const cater = vehicleRig('catering', '#e8eef5')
    const tanker = vehicleRig('fuel', '#c9a227')
    roots.push(cart, train, dolly, lifter, cater, tanker)
    expect(cart.getObjectByName('cart_bed')).toBeTruthy()
    expect(cart.getObjectByName('cart_hitch')).toBeTruthy()
    expect(train.getObjectByName('cart_bed')).toBeTruthy()
    expect(train.getObjectByName('train_hitch')).toBeTruthy()
    expect(dolly.getObjectByName('dolly_deck')).toBeTruthy()
    expect(dolly.getObjectByName('dolly_hitch')).toBeTruthy()
    expect(lifter.getObjectByName('loader_deck')).toBeTruthy()
    expect(cater.getObjectByName('cart_slot')).toBeTruthy()
    expect(tanker.getObjectByName('truck_fill')).toBeTruthy()
    const belt = vehicleRig('belt_loader', '#ddd')
    roots.push(belt)
    expect(belt.getObjectByName('belt_low')).toBeTruthy()

    const bridge = createBridges('b738')
    expect(bridge.getObjectByName('bridge_cab')).toBeTruthy()
    expect(bridge.getObjectByName('bridge_hall')).toBeTruthy()

    const desks = buildTerminalProps([{ type: 'checkin_row', x: 0, z: 0 }])
    expect(desks.getObjectByName('desk_drop')).toBeTruthy()
    expect(desks.getObjectByName('belt_in')).toBeTruthy()
    expect(desks.getObjectByName('belt_out')).toBeTruthy()
    const claim = buildTerminalProps([{ type: 'baggage_carousel', x: 2, z: 3 }])
    expect(claim.getObjectByName('carousel_lip')).toBeTruthy()
    expect(claim.getObjectByName('carousel_feed')).toBeTruthy()
    const gate = buildTerminalProps([{ type: 'jet_bridge', x: 0, z: 0 }])
    expect(gate.getObjectByName('bridge_cab')).toBeTruthy()
  })

  it('keeps resampled hops inside the step length', () => {
    const far = resample([new THREE.Vector3(0, 1, 0), new THREE.Vector3(3, 1.2, 0)], HANDOFF_STEP_M)
    expect(far[0].x).toBeCloseTo(0)
    expect(far[far.length - 1].x).toBeCloseTo(3)
    for (let i = 1; i < far.length; i++) expect(far[i].distanceTo(far[i - 1])).toBeLessThanOrEqual(HANDOFF_STEP_M + 1e-6)
  })

  it.each(['S', 'M', 'L'] as const)('walks a %s-stand bag from check-in to the hold and back to the carousel', (size: StandSize) => {
    const { root, report } = runJourneys(size)
    roots.push(root)
    const bag = report.bag
    expect(bag.steps, STAND_AIRFRAME[size]).toEqual([...BAG_STEPS])
    expect(bag.maxLockGap, 'lock').toBeLessThanOrEqual(LOCK_TOLERANCE_M)
    expect(bag.maxJump, 'teleport').toBeLessThanOrEqual(HANDOFF_STEP_M + 1e-3)
    expect(bag.loose, 'loose').toEqual([])
    expect(bag.minY, 'above ground').toBeGreaterThan(-0.02)
    expect(bag.ended).toBe('carousel_lip')
    expect(bag.holdToClaim, 'left the aircraft').toBeGreaterThan(5)
    expect(bag.docks.makeup, 'cart at the belt').toBeLessThanOrEqual(LOCK_TOLERANCE_M)
    expect(bag.docks.hold, 'cart at the loader').toBeLessThanOrEqual(LOCK_TOLERANCE_M)
    expect(bag.docks.claim, 'cart at the carousel').toBeLessThanOrEqual(LOCK_TOLERANCE_M)
    expect(bag.docks.loader, 'belt at the door').toBeLessThanOrEqual(LOCK_TOLERANCE_M)

    expect(report.uld.steps).toEqual([...ULD_STEPS])
    expect(report.uld.maxLockGap).toBeLessThanOrEqual(LOCK_TOLERANCE_M)
    expect(report.uld.maxJump).toBeLessThanOrEqual(HANDOFF_STEP_M + 1e-3)
    expect(report.uld.loose).toEqual([])
    expect(report.uld.minY).toBeGreaterThan(-0.02)
    expect(report.uld.ended).toBe('plane_hold')
    expect(report.uld.docks.dolly).toBeLessThanOrEqual(LOCK_TOLERANCE_M)

    expect(report.catering.steps).toEqual([...CATERING_STEPS])
    expect(report.catering.maxLockGap).toBeLessThanOrEqual(LOCK_TOLERANCE_M)
    expect(report.catering.maxJump).toBeLessThanOrEqual(HANDOFF_STEP_M + 1e-3)
    expect(report.catering.loose).toEqual([])
    expect(report.catering.minY).toBeGreaterThan(-0.02)
    expect(report.catering.ended).toBe('galley_slot')

    expect(report.pax.steps).toEqual([...PAX_STEPS])
    expect(report.pax.maxLockGap).toBeLessThanOrEqual(LOCK_TOLERANCE_M)
    expect(report.pax.maxJump).toBeLessThanOrEqual(HANDOFF_STEP_M + 1e-3)
    expect(report.pax.loose).toEqual([])
    expect(report.pax.minY).toBeGreaterThan(-0.02)
    expect(report.pax.ended).toBe('bridge_hall')
    expect(report.pax.docks.bridge).toBeLessThanOrEqual(LOCK_TOLERANCE_M)

    expect(report.fuel.steps).toEqual([...FUEL_STEPS])
    expect(report.fuel.maxLockGap).toBeLessThanOrEqual(LOCK_TOLERANCE_M)
    expect(report.fuel.maxJump).toBeLessThanOrEqual(HANDOFF_STEP_M + 1e-3)
    expect(report.fuel.loose).toEqual([])
    expect(report.fuel.minY).toBeGreaterThan(-0.02)
    expect(report.fuel.ended).toBe('truck_fill')
    expect(report.fuel.docks.farm).toBeLessThanOrEqual(LOCK_TOLERANCE_M)
  })
})
