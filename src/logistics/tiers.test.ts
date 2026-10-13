import { describe, expect, it } from 'vitest'
import { LogisticsSim } from './engine'
import {
  A380_READY_FLEET,
  A380_STAND_UNLOCK,
  DEFAULT_VEHICLE_SPECS,
  STARTER_FLEET_PURCHASE,
  VEHICLE_CATALOG,
  a380ScenarioConfig,
  defaultConfig,
  fleetCost,
  isUnlocked,
  unlockedVehicles,
} from './defaults'
import { needsFor } from './needs'
import { VEHICLE_TYPES, type LogisticsEvent } from './types'

function runA380(upgraded: boolean, scheduled = 120) {
  const sim = new LogisticsSim(a380ScenarioConfig(upgraded))
  const events: LogisticsEvent[] = []
  sim.on((e) => events.push(e))
  const id = sim.startTurnaround('heavy-1', 'a380', scheduled)
  for (let i = 0; i < 400 && sim.getTurnaround(id)!.completedAt === null; i++) sim.tick(1)
  const done = events.find((e) => e.type === 'turnaround_complete')
  if (!done || done.type !== 'turnaround_complete') throw new Error('A380 never finished')
  return { done, events }
}

describe('vehicle tiers: A380', () => {
  it('is late with the basic fleet, with undersized-vehicle causes', () => {
    const { done } = runA380(false)
    expect(done.delayMinutes).toBeGreaterThan(5)
    expect(done.causes).toContain('undersized_vehicle')
  })

  it('is on time with the A380-ready fleet', () => {
    const { done, events } = runA380(true)
    expect(done.delayMinutes).toBe(0)
    expect(done.causes).not.toContain('undersized_vehicle')
    const used = new Set(events.flatMap((e) => (e.type === 'truck_arrive' ? [e.vehicle] : [])))
    for (const t of ['heavy_tug', 'highlift_catering', 'hydrant_dispenser'] as const) expect(used).toContain(t)
  })

  it('is deterministic', () => {
    expect(runA380(false).done.delayMinutes).toBe(runA380(false).done.delayMinutes)
  })
})

describe('size-class needs', () => {
  it('flags super-heavy, upper deck, fuel points and bridge doors', () => {
    const a = needsFor('a380')
    expect(a.superHeavy && a.upperDeck).toBe(true)
    expect(a.fuelPoints).toBe(2)
    expect(a.maxBridgeDoors).toBe(3)
    expect(needsFor('a320neo').superHeavy).toBe(false)
  })

  it('a narrowbody never needs the heavy kit', () => {
    const sim = new LogisticsSim(defaultConfig({ vehicles: A380_READY_FLEET }))
    const causes: string[] = []
    sim.on((e) => e.type === 'turnaround_complete' && causes.push(...e.causes))
    sim.startTurnaround('stand-1', 'a320neo', 60)
    for (let i = 0; i < 200; i++) sim.tick(1)
    expect(causes).not.toContain('undersized_vehicle')
  })
})

describe('vehicle catalog', () => {
  it('covers every vehicle type with cost and upkeep', () => {
    for (const t of VEHICLE_TYPES) {
      expect(VEHICLE_CATALOG[t].cost).toBeGreaterThan(0)
      expect(DEFAULT_VEHICLE_SPECS[t].upkeepPerDay).toBeGreaterThan(0)
    }
  })

  it('unlocks heavy kit by field level and tech tier', () => {
    expect(isUnlocked('heavy_tug', 5, 3)).toBe(false)
    expect(isUnlocked('heavy_tug', 6, 2)).toBe(false)
    expect(isUnlocked('heavy_tug', 6, 3)).toBe(true)
    const l1 = unlockedVehicles(1, 1)
    expect(l1).toContain('fuel_truck')
    expect(l1).not.toContain('heavy_fuel_truck')
    expect(unlockedVehicles(6, 3)).toHaveLength(VEHICLE_TYPES.length)
  })

  it('prices a fleet at game scale and grants the opening depot fleet', () => {
    const c = fleetCost({ heavy_tug: 1, gpu: 2 })
    expect(c.purchase).toBe(VEHICLE_CATALOG.heavy_tug.cost + 2 * VEHICLE_CATALOG.gpu.cost)
    expect(VEHICLE_CATALOG.fuel_truck.cost).toBe(12_000)
    expect(VEHICLE_CATALOG.heavy_tug.cost).toBe(90_000)
    expect(A380_STAND_UNLOCK.cost).toBe(250_000)
    expect(STARTER_FLEET_PURCHASE).toBe(0)
    expect(c.upkeepPerDay).toBe(DEFAULT_VEHICLE_SPECS.heavy_tug.upkeepPerDay + 2 * DEFAULT_VEHICLE_SPECS.gpu.upkeepPerDay)
  })
})
