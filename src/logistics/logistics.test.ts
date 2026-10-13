import { describe, expect, it } from 'vitest'
import { AIRFRAMES } from '../game/airframes'
import {
  LogisticsSim,
  RoadGraph,
  allNeeds,
  createLogisticsAdapter,
  defaultConfig,
  needsFor,
  type LogisticsEvent,
} from './index'

function record(sim: LogisticsSim): LogisticsEvent[] {
  const out: LogisticsEvent[] = []
  sim.on((e) => out.push(e))
  return out
}

function runUntilDone(sim: LogisticsSim, id: string, step = 1, max = 2000): void {
  for (let i = 0; i < max && sim.getTurnaround(id)!.completedAt === null; i++) sim.tick(step)
}

describe('turnaround needs', () => {
  it('covers all airframes', () => {
    const total = Object.keys(AIRFRAMES).length
    expect(Object.keys(AIRFRAMES)).toHaveLength(total)
    expect(allNeeds()).toHaveLength(total)
    for (const id of Object.keys(AIRFRAMES)) expect(needsFor(id).airframeId).toBe(id)
  })

  it('scales fuel and meals with size', () => {
    const crj = needsFor('crj700')
    const b738 = needsFor('b738')
    const a380 = needsFor('a380')
    expect(crj.sizeClass).toBe('S')
    expect(b738.sizeClass).toBe('M')
    expect(a380.sizeClass).toBe('L')
    expect(crj.fuelLitres).toBeLessThan(b738.fuelLitres)
    expect(b738.fuelLitres).toBeLessThan(a380.fuelLitres)
    expect(crj.meals).toBeLessThan(b738.meals)
    expect(b738.meals).toBeLessThan(a380.meals)
    expect(b738.fuelLitres).toBe(Math.round((20.8 * 1000 * 0.6) / 0.8))
  })

  it('freighters get no catering, helicopters no pushback', () => {
    expect(needsFor('b748f').services).not.toContain('catering')
    expect(needsFor('b748f').services).toContain('fuel')
    expect(needsFor('aw139').services).not.toContain('pushback')
    expect(needsFor('a320neo').services).toEqual([
      'deplane', 'bag_unload', 'cargo_unload', 'loader', 'fuel', 'catering', 'cleaning',
      'gpu', 'boarding', 'bag_load', 'cargo_load', 'door_close', 'pushback',
    ])
  })

  it('every type has positive fuel need', () => {
    for (const n of allNeeds()) expect(n.fuelLitres).toBeGreaterThan(0)
  })

  it('rejects unknown ids', () => {
    expect(() => needsFor('concorde')).toThrow()
  })
})

describe('road graph', () => {
  const g = new RoadGraph(
    [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 300, y: 400 },
      { id: 'c', x: 600, y: 800 },
      { id: 'z', x: 0, y: 0 },
    ],
    [
      { a: 'a', b: 'b' },
      { a: 'b', b: 'c' },
      { a: 'a', b: 'c', length: 5000 },
    ],
  )
  it('finds shortest path', () => {
    expect(g.distance('a', 'b')).toBe(500)
    expect(g.distance('a', 'c')).toBe(1000)
    expect(g.distance('c', 'a')).toBe(1000)
  })
  it('converts to minutes', () => {
    expect(g.travelMinutes('a', 'c', 60)).toBeCloseTo(1)
  })
  it('unreachable is Infinity', () => {
    expect(g.distance('a', 'z')).toBe(Infinity)
    expect(g.distance('a', 'nope')).toBe(Infinity)
  })
  it('rejects edges to unknown nodes', () => {
    expect(() => new RoadGraph([{ id: 'a', x: 0, y: 0 }], [{ a: 'a', b: 'x' }])).toThrow()
  })
})

describe('turnarounds', () => {
  it('truck refuel: services run, pushback last, events in order', () => {
    const sim = new LogisticsSim(defaultConfig())
    const ev = record(sim)
    const id = sim.startTurnaround('stand-2', 'b738', 60)
    runUntilDone(sim, id)
    const t = sim.getTurnaround(id)!
    expect(t.completedAt).not.toBeNull()
    expect(Object.values(t.services).every((s) => s === 'done')).toBe(true)
    const types = ev.filter((e) => e.type !== 'money').map((e) => e.type)
    expect(types).toContain('truck_arrive')
    const start = ev.find((e) => e.type === 'refuel_start')!
    const stop = ev.find((e) => e.type === 'refuel_stop')!
    expect(start.type === 'refuel_start' && start.method).toBe('truck')
    expect(stop.time - start.time).toBeCloseTo(needsFor('b738').fuelLitres / 1000)
    const doneOrder = ev.filter((e) => e.type === 'service_done').map((e) => (e.type === 'service_done' ? e.service : ''))
    expect(doneOrder[doneOrder.length - 1]).toBe('pushback')
    expect(types[types.length - 1]).toBe('turnaround_complete')
    expect(sim.turnaroundAt('stand-2')).toBeUndefined()
  })

  it('hydrant stand needs no fuel truck and is faster', () => {
    const sim = new LogisticsSim(defaultConfig())
    const ev = record(sim)
    const id = sim.startTurnaround('stand-1', 'a359', 120)
    runUntilDone(sim, id)
    const fuelArrivals = ev.filter((e) => e.type === 'truck_arrive' && e.vehicle === 'fuel_truck')
    expect(fuelArrivals).toHaveLength(0)
    const start = ev.find((e) => e.type === 'refuel_start')!
    expect(start.type === 'refuel_start' && start.method).toBe('hydrant')
    const deplaned = ev.find((e) => e.type === 'pax_deplaned')!
    expect(start.time).toBeCloseTo(deplaned.time)
  })

  it('draws fuel and meals from stock', () => {
    const sim = new LogisticsSim(defaultConfig({ kitchen: { ...defaultConfig().kitchen, mealsPerHour: 0 } }))
    const id = sim.startTurnaround('stand-2', 'a321', 90)
    runUntilDone(sim, id)
    const n = needsFor('a321')
    const truckFuel = sim.vehicles.filter((v) => v.type === 'fuel_truck').reduce((s, v) => s + v.load, 0)
    expect(300000 - sim.fuelLitres - truckFuel).toBe(n.fuelLitres)
    const truckMeals = sim.vehicles.filter((v) => v.type === 'catering_truck').reduce((s, v) => s + v.load, 0)
    expect(1500 - sim.meals - truckMeals).toBe(n.meals)
  })

  it('on time with a generous schedule', () => {
    const sim = new LogisticsSim(defaultConfig())
    const id = sim.startTurnaround('stand-2', 'crj700', 120)
    runUntilDone(sim, id)
    expect(sim.currentDelay(id)).toBe(0)
  })

  it('second aircraft waits for the only fuel truck: delayed with no_vehicle', () => {
    const sim = new LogisticsSim(defaultConfig({ vehicles: { ...defaultConfig().vehicles, fuel_truck: 1 } }))
    const ev = record(sim)
    const a = sim.startTurnaround('stand-2', 'b789', 70)
    const b = sim.startTurnaround('stand-3', 'b789', 70)
    runUntilDone(sim, a)
    runUntilDone(sim, b)
    const done = ev.filter((e) => e.type === 'turnaround_complete')
    const late = done.find((e) => e.type === 'turnaround_complete' && e.turnaroundId === b)!
    expect(late.type === 'turnaround_complete' && late.delayMinutes).toBeGreaterThan(0)
    expect(late.type === 'turnaround_complete' && late.causes).toContain('no_vehicle')
  })

  it('big uplift takes multiple truck trips', () => {
    const sim = new LogisticsSim(defaultConfig())
    const ev = record(sim)
    const id = sim.startTurnaround('stand-4', 'a380', 240)
    runUntilDone(sim, id)
    const stops = ev.filter((e) => e.type === 'refuel_stop')
    const pumped = stops.reduce((s, e) => s + (e.type === 'refuel_stop' ? e.litres : 0), 0)
    expect(stops.length).toBeGreaterThan(1)
    expect(pumped).toBe(needsFor('a380').fuelLitres)
  })

  it('empty fuel farm blocks until a tanker delivers', () => {
    const base = defaultConfig()
    const sim = new LogisticsSim({ ...base, fuelFarm: { ...base.fuelFarm, initialLitres: 0, deliveryLeadMinutes: 60 } })
    const ev = record(sim)
    const id = sim.startTurnaround('stand-2', 'b738', 45)
    sim.tick(30)
    expect(sim.vehicles.some((v) => v.phase === 'waiting_stock')).toBe(true)
    sim.orderFuel()
    runUntilDone(sim, id)
    const t = sim.getTurnaround(id)!
    expect(t.completedAt!).toBeGreaterThan(90)
    const done = ev.find((e) => e.type === 'turnaround_complete')!
    expect(done.type === 'turnaround_complete' && done.causes).toContain('no_fuel')
    expect(ev.some((e) => e.type === 'delivery_arrived')).toBe(true)
  })

  it('hydrant waits for stock too', () => {
    const base = defaultConfig()
    const sim = new LogisticsSim({ ...base, fuelFarm: { ...base.fuelFarm, initialLitres: 1000, deliveryLeadMinutes: 30 } })
    const id = sim.startTurnaround('stand-1', 'b738', 45)
    sim.tick(10)
    expect(sim.getTurnaround(id)!.services.fuel).toBe('pending')
    sim.orderFuel()
    runUntilDone(sim, id)
    expect(sim.getTurnaround(id)!.causes.has('no_fuel')).toBe(true)
    expect(sim.getTurnaround(id)!.completedAt).not.toBeNull()
  })

  it('kitchen shortage delays catering', () => {
    const base = defaultConfig()
    const sim = new LogisticsSim({ ...base, kitchen: { ...base.kitchen, initialMeals: 0, mealsPerHour: 60 } })
    const id = sim.startTurnaround('stand-2', 'b789', 40)
    runUntilDone(sim, id)
    expect(sim.getTurnaround(id)!.causes.has('no_meals')).toBe(true)
    expect(sim.currentDelay(id)).toBeGreaterThan(0)
  })

  it('rejects bad input', () => {
    const sim = new LogisticsSim(defaultConfig())
    expect(() => sim.startTurnaround('nope', 'b738', 30)).toThrow()
    expect(() => sim.startTurnaround('stand-2', 'zzz', 30)).toThrow()
    sim.startTurnaround('stand-2', 'b738', 30)
    expect(() => sim.startTurnaround('stand-2', 'b738', 30)).toThrow()
  })

  it('stand frees after completion and can be reused', () => {
    const sim = new LogisticsSim(defaultConfig())
    const a = sim.startTurnaround('stand-3', 'e175', 60)
    runUntilDone(sim, a)
    const b = sim.startTurnaround('stand-3', 'a320neo', 60)
    runUntilDone(sim, b)
    expect(sim.getTurnaround(b)!.completedAt).not.toBeNull()
  })

  it('every airframe completes a turnaround on a truck stand and a hydrant stand', () => {
    for (const id of Object.keys(AIRFRAMES)) {
      for (const stand of ['stand-1', 'stand-2']) {
        const sim = new LogisticsSim(defaultConfig())
        const t = sim.startTurnaround(stand, id, 120)
        runUntilDone(sim, t)
        expect(sim.getTurnaround(t)!.completedAt, `${id}@${stand}`).not.toBeNull()
      }
    }
  })
})

describe('stock and money', () => {
  it('low-stock alert fires once and auto-reorder brings a tanker', () => {
    const base = defaultConfig()
    const sim = new LogisticsSim({
      ...base,
      fuelFarm: { ...base.fuelFarm, initialLitres: 90000, autoReorder: true, deliveryLeadMinutes: 60 },
    })
    const ev = record(sim)
    sim.startTurnaround('stand-1', 'a359', 120)
    sim.startTurnaround('stand-2', 'b789', 120)
    sim.tick(30)
    expect(ev.filter((e) => e.type === 'low_stock' && e.stock === 'fuel')).toHaveLength(1)
    expect(ev.filter((e) => e.type === 'delivery_ordered')).toHaveLength(1)
    sim.tick(60)
    const arrived = ev.find((e) => e.type === 'delivery_arrived')!
    expect(arrived.type === 'delivery_arrived' && arrived.litres).toBe(36000)
    expect(sim.ledger.fuelPurchase).toBeCloseTo(36000 * 0.7)
  })

  it('delivery is capped at farm capacity', () => {
    const base = defaultConfig()
    const sim = new LogisticsSim({ ...base, fuelFarm: { ...base.fuelFarm, initialLitres: 490000, deliveryLeadMinutes: 1 } })
    sim.orderFuel()
    sim.tick(2)
    expect(sim.fuelLitres).toBe(500000)
    expect(sim.ledger.fuelPurchase).toBeCloseTo(10000 * 0.7)
  })

  it('fuel sold at a throughput fee, catering fees, upkeep accrues', () => {
    const sim = new LogisticsSim(defaultConfig({ kitchen: { ...defaultConfig().kitchen, mealsPerHour: 0 } }))
    const id = sim.startTurnaround('stand-2', 'a320neo', 90)
    runUntilDone(sim, id)
    const n = needsFor('a320neo')
    expect(sim.ledger.fuelSales).toBeCloseTo(n.fuelLitres * (0.7 + 0.012))
    expect(sim.ledger.cateringFees).toBeCloseTo(n.meals * 6)
    const cfg = defaultConfig()
    const perDay = Object.entries(cfg.vehicles).reduce(
      (s, [k, n]) => s + (n ?? 0) * cfg.vehicleSpecs[k as keyof typeof cfg.vehicleSpecs].upkeepPerDay,
      0,
    )
    expect(sim.ledger.vehicleUpkeep).toBeCloseTo((perDay * sim.now) / 1440)
    expect(sim.profit).toBeCloseTo(sim.ledger.fuelSales + sim.ledger.cateringFees - sim.ledger.vehicleUpkeep)
  })

  it('kitchen produces meals up to capacity and charges cost', () => {
    const base = defaultConfig()
    const sim = new LogisticsSim({ ...base, kitchen: { ...base.kitchen, initialMeals: 2900 } })
    sim.tick(60)
    expect(sim.meals).toBe(3000)
    expect(sim.ledger.mealProduction).toBeCloseTo(100 * 4.5)
  })
})

describe('determinism', () => {
  function scenario(step: number): string {
    const sim = new LogisticsSim(defaultConfig({
      vehicles: { fuel_truck: 1, catering_truck: 1, baggage_tug: 2, pushback_tug: 1, gpu: 1, pax_bus: 1, belt_loader: 1, uld_loader: 1 },
    }))
    const ev = record(sim)
    sim.startTurnaround('stand-1', 'a359', 60)
    sim.startTurnaround('stand-2', 'b738', 50)
    sim.startTurnaround('stand-3', 'a380', 90)
    sim.startTurnaround('stand-4', 'b748f', 80)
    const total = 600
    for (let t = 0; t < total; t += step) sim.tick(step)
    return JSON.stringify(
      ev.filter((e) => e.type !== 'money'),
      (_k, v: unknown) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v),
    ) + JSON.stringify({ fuel: sim.fuelLitres, ledger: Object.values(sim.ledger).map((x) => Math.round(x * 1000)) })
  }
  it('same input same output', () => {
    expect(scenario(1)).toBe(scenario(1))
  })
  it('independent of tick size', () => {
    const a = scenario(0.5)
    expect(scenario(1)).toBe(a)
    expect(scenario(5)).toBe(a)
    expect(scenario(60)).toBe(a)
  })
  it('ignores non-positive dt', () => {
    const sim = new LogisticsSim(defaultConfig())
    sim.tick(0)
    sim.tick(-5)
    expect(sim.now).toBe(0)
  })
})

describe('adapter', () => {
  it('routes money, sounds and notices to the host', () => {
    const sounds: string[] = []
    const notes: string[] = []
    let cash = 0
    const ad = createLogisticsAdapter({
      addMoney: (a) => (cash += a),
      playSound: (c) => sounds.push(c),
      notify: (m) => notes.push(m),
    })
    ad.onAircraftParked('stand-2', 'b738', 10)
    expect(ad.isReadyToDepart('stand-2')).toBe(false)
    for (let i = 0; i < 200 && !ad.isReadyToDepart('stand-2'); i++) ad.tick(1)
    expect(ad.isReadyToDepart('stand-2')).toBe(true)
    expect(sounds).toContain('refuel_start')
    expect(sounds).toContain('refuel_stop')
    expect(sounds).toContain('truck_arrive')
    expect(cash).toBeCloseTo(ad.sim.profit)
    expect(notes.some((n) => n.includes('late'))).toBe(true)
    expect(ad.completed[0].delayMinutes).toBeGreaterThan(0)
  })

  it('delayAt and snapshot', () => {
    const ad = createLogisticsAdapter()
    ad.onAircraftParked('stand-3', 'a380', 5)
    ad.tick(20)
    expect(ad.delayAt('stand-3')).toBeCloseTo(15)
    const s = ad.snapshot()
    expect(s.time).toBe(20)
    expect(s.busyVehicles).toBeGreaterThan(0)
    expect(s.totalVehicles).toBe(23)
    expect(ad.delayAt('stand-4')).toBe(0)
  })

  it('tanker delivery plays a sound', () => {
    const sounds: string[] = []
    const ad = createLogisticsAdapter({ playSound: (c) => sounds.push(c) })
    ad.orderFuel(1000)
    ad.tick(200)
    expect(sounds).toEqual(['tanker_arrive'])
  })
})
