import { describe, expect, it } from 'vitest'
import {
  LogisticsSim,
  MAINTENANCE_TIERS,
  createLogisticsAdapter,
  defaultConfig,
  defaultMaintenanceConfig,
  featureEventWorldPatch,
  withoutDuplicateBreakdownEvents,
  type LogisticsEvent,
  type MaintenanceConfig,
} from './index'

function make(m: Partial<MaintenanceConfig> = {}) {
  const sim = new LogisticsSim(defaultConfig({ maintenance: defaultMaintenanceConfig(m) }))
  const ev: LogisticsEvent[] = []
  sim.on((e) => ev.push(e))
  return { sim, ev, m: sim.maintenance! }
}

function run(sim: LogisticsSim, id: string, step = 1, max = 3000): void {
  for (let i = 0; i < max && sim.getTurnaround(id)!.completedAt === null; i++) sim.tick(step)
}

const vehicle = (sim: LogisticsSim, id: string) => sim.vehicles.find((v) => v.id === id)!

/** Busy day: keeps every stand cycling. */
function busyDay(sim: LogisticsSim, minutes: number, step = 10): void {
  const stands = ['stand-1', 'stand-2', 'stand-3', 'stand-4', 'remote-1']
  const types = ['b738', 'a320neo', 'crj700', 'a321', 'e175']
  let k = 0
  for (let t = 0; t < minutes; t += step) {
    for (const s of stands) {
      if (!sim.turnaroundAt(s) && sim.standAvailable(s) && (t / step + k) % 5 === 0) {
        sim.startTurnaround(s, types[k++ % types.length], 80)
        sim.maintenance?.recordMovement()
      }
    }
    sim.tick(step)
  }
}

describe('maintenance basics', () => {
  it('is off unless configured', () => {
    const sim = new LogisticsSim(defaultConfig())
    expect(sim.maintenance).toBeNull()
    expect(sim.maintenanceMetrics()).toBeNull()
    expect(sim.forceBreakdown('fuel_truck')).toEqual([])
  })

  it('every vehicle type wears with distance and use', () => {
    const { sim } = make({ baseBreakdownPerTrip: 0 })
    const id = sim.startTurnaround('remote-1', 'b789', 120)
    run(sim, id)
    const used = sim.vehicles.filter((v) => v.wear.uses > 0)
    const types = new Set(used.map((v) => v.type))
    for (const t of ['fuel_truck', 'catering_truck', 'baggage_tug', 'pushback_tug', 'gpu', 'pax_bus', 'uld_loader']) expect(types.has(t as never)).toBe(true)
    for (const v of used) {
      expect(v.wear.km).toBeGreaterThan(0)
      expect(v.wear.condition).toBeLessThan(100)
    }
  })

  it('breakdown odds rise as condition drops and when service is overdue', () => {
    const { sim, m } = make()
    const v = vehicle(sim, 'fuel_truck-1')
    const fresh = m.breakdownChance(v)
    v.wear.condition = 40
    const worn = m.breakdownChance(v)
    v.wear.lastServiceAt = -1440 * 3
    const overdue = m.breakdownChance(v)
    expect(worn).toBeGreaterThan(fresh * 3)
    expect(overdue).toBeGreaterThan(worn)
  })

  it('worn vehicles are slower', () => {
    const { sim, m } = make()
    const v = vehicle(sim, 'gpu-1')
    expect(m.speedFactor(v)).toBe(1)
    v.wear.condition = 20
    expect(m.speedFactor(v)).toBeCloseTo(0.82)
  })

  it('tiers grow bays, staff, speed and crews', () => {
    expect(MAINTENANCE_TIERS[1].bays).toBeLessThan(MAINTENANCE_TIERS[2].bays)
    expect(MAINTENANCE_TIERS[2].speed).toBeLessThan(MAINTENANCE_TIERS[3].speed)
    expect(MAINTENANCE_TIERS[3].crews.repair_van).toBeGreaterThan(MAINTENANCE_TIERS[1].crews.repair_van)
    const t3 = make({ building: { node: 'depot', tier: 3 } })
    expect(t3.m.metrics().crewTotal).toBe(10)
  })
})

describe('breakdowns', () => {
  it('a truck breaking down en route hands its job to another truck', () => {
    const { sim, ev } = make({ baseBreakdownPerTrip: 0 })
    const id = sim.startTurnaround('stand-2', 'b738', 90)
    while (!sim.vehicles.some((v) => v.type === 'fuel_truck' && v.requestId !== null)) sim.tick(0.5)
    const busy = sim.vehicles.find((v) => v.type === 'fuel_truck' && v.requestId !== null)!
    busy.wear.condition = 50
    expect(sim.forceBreakdown('fuel_truck', 1)).toEqual([busy.id])
    expect(busy.phase).toBe('broken')
    expect(busy.requestId).toBeNull()
    run(sim, id)
    const pumped = ev.filter((e) => e.type === 'refuel_start')
    expect(pumped.length).toBeGreaterThan(0)
    expect(pumped.every((e) => e.type === 'refuel_start' && e.vehicleId !== busy.id)).toBe(true)
    expect(sim.getTurnaround(id)!.causes.has('vehicle_breakdown')).toBe(true)
  })

  it('broken vehicle blocks its lane until fixed in place by a repair van', () => {
    const { sim, ev } = make({ baseBreakdownPerTrip: 0 })
    const v = vehicle(sim, 'gpu-1')
    v.wear.condition = 60
    sim.forceBreakdown('gpu', 1)
    expect(sim.roads.penaltyAt(v.node)).toBe(400)
    for (let i = 0; i < 200 && v.phase === 'broken'; i++) sim.tick(1)
    expect(ev.some((e) => e.type === 'crew_dispatched' && e.crew === 'repair_van')).toBe(true)
    expect(ev.some((e) => e.type === 'vehicle_repaired' && e.vehicleId === v.id && e.inPlace)).toBe(true)
    expect(sim.roads.penaltyAt(v.node)).toBe(0)
    expect(v.phase).toBe('idle')
    expect(sim.ledger.maintenanceRepair).toBe(700)
  })

  it('lane penalty slows routes through the blocked node', () => {
    const { sim } = make()
    const before = sim.roads.travelMinutes('depot', 's4', 20)
    sim.roads.setPenalty('j2', 400)
    expect(sim.roads.travelMinutes('depot', 's4', 20)).toBeGreaterThan(before)
    sim.roads.setPenalty('j2', 0)
    expect(sim.roads.travelMinutes('depot', 's4', 20)).toBeCloseTo(before)
  })

  it('a badly worn vehicle is towed back and rebuilt in a bay', () => {
    const { sim, ev } = make({ baseBreakdownPerTrip: 0 })
    const v = vehicle(sim, 'baggage_tug-1')
    v.wear.condition = 10
    sim.forceBreakdown('baggage_tug', 1)
    for (let i = 0; i < 400 && v.phase !== 'idle'; i++) sim.tick(1)
    expect(ev.some((e) => e.type === 'tow_start' && e.vehicleId === v.id)).toBe(true)
    expect(ev.some((e) => e.type === 'vehicle_serviced' && e.vehicleId === v.id && e.repair)).toBe(true)
    expect(v.wear.condition).toBe(100)
    expect(sim.ledger.maintenanceRepair).toBe(900 + 700)
    expect(sim.ledger.maintenanceRepair).toBeGreaterThan(defaultMaintenanceConfig().serviceCost * 5)
  })

  it('event breakdowns with a duration come back without a crew', () => {
    const { sim, ev } = make({ baseBreakdownPerTrip: 0 })
    const ids = sim.forceBreakdown('fuel_truck', 1, 30)
    expect(sim.workingVehicles('fuel_truck')).toBe(1)
    sim.tick(29)
    expect(vehicle(sim, ids[0]).phase).toBe('broken')
    sim.tick(2)
    expect(vehicle(sim, ids[0]).phase).toBe('idle')
    expect(ev.some((e) => e.type === 'crew_dispatched')).toBe(false)
  })

  it('without a maintenance building nothing gets fixed', () => {
    const { sim } = make({ building: null, baseBreakdownPerTrip: 0 })
    sim.forceBreakdown('pax_bus', 1)
    sim.tick(600)
    expect(sim.maintenanceMetrics()!.broken).toBe(1)
    expect(sim.maintenanceMetrics()!.hints[0]).toMatch(/No maintenance building/)
  })

  it('random breakdowns replay exactly for a seed and differ across seeds', () => {
    const log = (seed: number, step: number) => {
      const { sim, ev } = make({ seed, baseBreakdownPerTrip: 0.05 })
      busyDay(sim, 720, step)
      return JSON.stringify(
        ev.filter((e) => e.type !== 'money'),
        (_k, v: unknown) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v),
      )
    }
    const a = log(3, 10)
    expect(log(3, 10)).toBe(a)
    expect(a).toContain('vehicle_breakdown')
    expect(log(4, 10)).not.toBe(a)
  })
})

describe('servicing', () => {
  it('vehicles go back for scheduled service, bays limit throughput, condition restored', () => {
    const { sim, ev, m } = make({ baseBreakdownPerTrip: 0, serviceIntervalMinutes: 120 })
    for (const v of sim.vehicles) v.wear.condition = 80
    let maxBusy = 0
    for (let i = 0; i < 900; i++) {
      sim.tick(1)
      maxBusy = Math.max(maxBusy, sim.vehicles.filter((v) => v.phase === 'in_bay' && v.phaseEnd !== Infinity).length)
    }
    expect(maxBusy).toBe(Math.min(MAINTENANCE_TIERS[1].bays, MAINTENANCE_TIERS[1].staff))
    expect(ev.filter((e) => e.type === 'vehicle_serviced' && !e.repair).length).toBeGreaterThanOrEqual(23)
    expect(sim.ledger.maintenancePreventive).toBeGreaterThanOrEqual(23 * 150)
    expect(sim.vehicles.every((v) => v.wear.lastServiceAt > 0)).toBe(true)
    expect(m.metrics().avgVehicleCondition).toBeGreaterThan(80)
  })

  it('higher tiers service faster', () => {
    const finish = (tier: 1 | 3) => {
      const { sim, ev } = make({ baseBreakdownPerTrip: 0, serviceIntervalMinutes: 60, building: { node: 'depot', tier } })
      for (let i = 0; i < 600; i++) {
        sim.tick(1)
        if (ev.filter((e) => e.type === 'vehicle_serviced').length >= 23) return sim.now
      }
      return Infinity
    }
    expect(finish(3)).toBeLessThan(finish(1))
  })

  it('advisor flags an under-built maintenance building', () => {
    const { sim } = make()
    for (const v of sim.vehicles) v.wear.lastServiceAt = -3000
    expect(sim.maintenanceMetrics()!.overdue).toBe(23)
    expect(sim.maintenanceMetrics()!.hints).toContain('Maintenance under-built: 23 vehicles overdue for service.')
  })

  it('preventive servicing is cheaper than repairs', () => {
    const c = defaultMaintenanceConfig()
    expect(c.serviceCost).toBeLessThan(c.repairCost)
    expect(c.repairCost).toBeLessThan(c.repairCost + c.towCost)
  })
})

describe('facilities', () => {
  it('failed stand goes out of service', () => {
    const { sim, m } = make()
    m.setFacilityCondition('stand-3', 10)
    expect(sim.standAvailable('stand-3')).toBe(false)
    expect(() => sim.startTurnaround('stand-3', 'b738', 60)).toThrow(/out of service/)
    expect(sim.maintenanceMetrics()!.standsOutOfService).toEqual(['stand-3'])
  })

  it('failed hydrant falls back to a fuel truck', () => {
    const { sim, ev, m } = make({ baseBreakdownPerTrip: 0 })
    m.setFacilityCondition('hydrant-1', 5)
    const id = sim.startTurnaround('stand-1', 'a320neo', 120)
    run(sim, id)
    const start = ev.find((e) => e.type === 'refuel_start')!
    expect(start.type === 'refuel_start' && start.method).toBe('truck')
  })

  it('failed runway closes; worn taxiway slows taxiing', () => {
    const { m } = make()
    m.setFacilityCondition('rwy-09', 10)
    expect(m.runwayClosed()).toBe(true)
    m.setFacilityCondition('twy-a', 40)
    expect(m.taxiSpeedFactor()).toBe(0.8)
  })

  it('crews restore worn facilities; emergency repairs cost more', () => {
    const cost = (cond: number) => {
      const { sim, ev, m } = make({ baseBreakdownPerTrip: 0 })
      m.setFacilityCondition('stand-4', cond)
      for (let i = 0; i < 300 && !ev.some((e) => e.type === 'facility_repaired'); i++) sim.tick(1)
      const r = ev.find((e) => e.type === 'facility_repaired')!
      expect(m.facilities.get('stand-4')!.condition).toBe(100)
      return r.type === 'facility_repaired' ? r.cost / (100 - cond) : 0
    }
    // Per condition point (a little hourly wear sneaks in before the crew arrives).
    expect(cost(10)).toBeCloseTo(defaultMaintenanceConfig().facilityCostPerPoint * 3, 0)
    expect(cost(60)).toBeCloseTo(defaultMaintenanceConfig().facilityCostPerPoint, 0)
  })

  it('a broken-up runway gets FOD closures, inspection reopens it', () => {
    const { sim, ev, m } = make({ seed: 7, baseBreakdownPerTrip: 0 })
    m.setFacilityCondition('rwy-09', 30)
    for (let i = 0; i < 48 && !ev.some((e) => e.type === 'runway_fod'); i++) sim.tick(60)
    expect(ev.some((e) => e.type === 'runway_fod')).toBe(true)
    expect(ev.some((e) => e.type === 'runway_closed' && e.reason === 'fod')).toBe(true)
    sim.tick(120)
    expect(ev.some((e) => e.type === 'runway_reopened')).toBe(true)
  })

  it('run-down terminal hits passenger mood hourly', () => {
    const moods: number[] = []
    const ad = createLogisticsAdapter(
      { onPassengerMoodHit: (n) => moods.push(n) },
      defaultConfig({ maintenance: defaultMaintenanceConfig({ building: null }) }),
    )
    ad.sim.maintenance!.setFacilityCondition('terminal', 40)
    ad.tick(180)
    expect(moods).toEqual([1, 1, 1])
    expect(ad.maintenanceMetrics()!.paxMoodPenalty).toBe(3)
  })

  it('neglect causes safety incidents that hit ratings', () => {
    let rating = 0
    const ad = createLogisticsAdapter(
      { onRatingHit: (n) => (rating += n) },
      defaultConfig({ maintenance: defaultMaintenanceConfig({ seed: 7, building: null }) }),
    )
    ad.sim.maintenance!.setFacilityCondition('rwy-09', 26)
    ad.tick(60 * 24 * 3)
    const mm = ad.maintenanceMetrics()!
    expect(mm.safetyIncidents).toBeGreaterThan(0)
    expect(rating).toBe(mm.ratingPenalty)
  })
})

describe('feature events bridge', () => {
  it('fuel-truck event breaks a real truck for its duration; world uses working trucks', () => {
    const sounds: string[] = []
    const ad = createLogisticsAdapter(
      { playSound: (c) => sounds.push(c) },
      defaultConfig({ maintenance: defaultMaintenanceConfig({ baseBreakdownPerTrip: 0 }) }),
    )
    expect(featureEventWorldPatch(ad.sim)).toEqual({ fuelTrucks: 2 })
    expect(ad.applyEventEffect({ fuelTrucksDisabled: 1, durationMin: 30, cash: -1500 })).toHaveLength(1)
    expect(featureEventWorldPatch(ad.sim)).toEqual({ fuelTrucks: 1 })
    expect(sounds).toContain('vehicle_breakdown')
    ad.tick(31)
    expect(featureEventWorldPatch(ad.sim)).toEqual({ fuelTrucks: 2 })
    expect(ad.applyEventEffect({ cash: -10 })).toEqual([])
  })

  it('drops the duplicate random breakdown event when maintenance is on', () => {
    const defs = [{ id: 'storm-runway' }, { id: 'fuel-truck-breakdown' }]
    expect(withoutDuplicateBreakdownEvents(defs, true)).toEqual([{ id: 'storm-runway' }])
    expect(withoutDuplicateBreakdownEvents(defs, false)).toHaveLength(2)
  })
})

describe('determinism with maintenance', () => {
  it('independent of tick size', () => {
    const log = (step: number) => {
      const { sim, ev } = make({ seed: 9, baseBreakdownPerTrip: 0.03 })
      sim.startTurnaround('stand-2', 'b738', 70)
      sim.startTurnaround('remote-1', 'a321', 80)
      sim.startTurnaround('stand-1', 'b789', 100)
      for (let t = 0; t < 600; t += step) sim.tick(step)
      return JSON.stringify(
        ev.filter((e) => e.type !== 'money'),
        (_k, v: unknown) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v),
      )
    }
    const a = log(0.5)
    expect(log(1)).toBe(a)
    expect(log(15)).toBe(a)
  })
})
