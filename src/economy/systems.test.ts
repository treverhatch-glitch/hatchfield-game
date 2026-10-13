import { describe, expect, it } from 'vitest'
import { analyzeChains, createFailure } from './bottlenecks.ts'
import { EconomyEngine } from './engine.ts'
import { calculatePower } from './power.ts'
import { DEFAULT_DEMAND_CALENDAR, demandAtDay } from './seasons.ts'
import { calculateStaff } from './staff.ts'
import { realMinutesToSimMinutes } from '../core/clock.ts'

describe('staff economy', () => {
  it('caps commuter pools, allocates by priority, and exposes visible researchers', () => {
    const snapshot = calculateStaff({
      pools: {
        researcher: { hired: 10, wagePerDay: 200 },
        ground_crew: { hired: 40, wagePerDay: 100 },
      },
      buildings: [
        { id: 'fuel', role: 'ground_crew', required: 20 },
        { id: 'rd', role: 'researcher', required: 8, priority: 100 },
      ],
      transitTier: 'road',
      housingTier: 0,
      visibleWorkerSample: 20,
      elapsedSimMinutes: realMinutesToSimMinutes(5),
    })
    expect(snapshot.employed).toBeLessThanOrEqual(snapshot.totalCap)
    expect(snapshot.allocations.find((allocation) => allocation.buildingId === 'rd')?.assigned).toBeGreaterThan(0)
    expect(snapshot.researchers.active).toBeGreaterThan(0)
    expect(snapshot.researchers.visible.every((worker) => worker.role === 'researcher')).toBe(true)
    expect(Object.keys(snapshot.researchers.roomActivity)).toContain('rd')
  })

  it('adds later housing capacity without replacing transit', () => {
    const base = calculateStaff({
      pools: { ground_crew: { hired: 100, wagePerDay: 100 } },
      buildings: [],
      transitTier: 'road',
      housingTier: 0,
      visibleWorkerSample: 0,
      elapsedSimMinutes: 0,
    })
    const housed = calculateStaff({
      pools: { ground_crew: { hired: 100, wagePerDay: 100 } },
      buildings: [],
      transitTier: 'road',
      housingTier: 2,
      visibleWorkerSample: 0,
      elapsedSimMinutes: 0,
    })
    expect(base.totalCap).toBe(45)
    expect(housed.totalCap).toBe(105)
  })
})

describe('power, demand, and bottlenecks', () => {
  it('slows powered services during a brown-out', () => {
    const power = calculatePower(1, [{ id: 'terminal', demand: 400 }])
    expect(power.brownout).toBe(true)
    expect(power.throughputMultiplier).toBeCloseTo(0.625)
    expect(calculatePower(2, [{ id: 'terminal', demand: 400 }]).brownout).toBe(false)
  })

  it('combines map seasons and holidays', () => {
    const summer = demandAtDay(DEFAULT_DEMAND_CALENDAR, 130)
    expect(summer.seasonId).toBe('summer')
    expect(summer.activeHolidayIds).toContain('summer_getaway')
    expect(summer.multiplier).toBeGreaterThan(1.2)
    const winter = demandAtDay(DEFAULT_DEMAND_CALENDAR, 315)
    expect(winter.modifiers['deicing.demand']).toBe(1.5)
  })

  it('always reports a player-created zero-capacity bottleneck', () => {
    const bottlenecks = analyzeChains([
      {
        chain: 'fuel',
        links: [
          { id: 'farm', label: 'Fuel farm', capacity: 0, demand: 10 },
          { id: 'truck', label: 'Fuel trucks', capacity: 20, demand: 10 },
        ],
      },
    ])
    expect(bottlenecks).toHaveLength(1)
    expect(bottlenecks[0]).toMatchObject({ linkId: 'farm', severity: 'blocked' })
    expect(bottlenecks[0].utilization).toBe(Infinity)
  })

  it('rewards a cleared hotspot only once', () => {
    const engine = new EconomyEngine()
    engine.setChains([{ chain: 'security', links: [{ id: 'lanes', label: 'Lanes', capacity: 10, demand: 12 }] }])
    engine.setChains([{ chain: 'security', links: [{ id: 'lanes', label: 'Lanes', capacity: 20, demand: 12 }] }])
    const first = engine.snapshot().state.researchProgress
    engine.setChains([{ chain: 'security', links: [{ id: 'lanes', label: 'Lanes', capacity: 10, demand: 12 }] }])
    engine.setChains([{ chain: 'security', links: [{ id: 'lanes', label: 'Lanes', capacity: 20, demand: 12 }] }])
    expect(first).toBe(0.5)
    expect(engine.snapshot().state.researchPoints).toBe(0)
    expect(engine.snapshot().state.researchProgress).toBe(first)
  })

  it('grounds only fuel outages', () => {
    expect(createFailure('fuel_outage', 'farm', 'fuel', 'Empty farm').grounded).toBe(true)
    const equipment = createFailure('equipment_failure', 'belt', 'baggage', 'Broken belt')
    expect(equipment.grounded).toBe(false)
    expect(equipment.delayMinutes).toBeGreaterThan(0)
    expect(equipment.ratingHit).toBeGreaterThan(0)
  })
})
