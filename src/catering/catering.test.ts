import { describe, expect, it } from 'vitest'
import { CATERING_PHASES, CateringEngine, FuelOutageMonitor, cartsFor, galleyRequirement, type CateringEvent } from './index.ts'

const order = (id: string, pax = 120, longHaul = false, dueBy = 60) => ({ flightId: id, standId: `S_${id}`, seats: 180, bookedPax: pax, longHaul, dueBy })
function run(e: CateringEngine, to: number, step = 1): CateringEvent[] {
  const out: CateringEvent[] = []
  for (let t = e.now + step; t <= to; t += step) {
    e.tick(t)
    out.push(...e.drainEvents())
  }
  return out
}

describe('galley requirements', () => {
  it('long haul gets hot meals and double drinks; short haul snacks', () => {
    expect(galleyRequirement(order('a', 100, true))).toEqual({ hot_meal: 100, snack_box: 0, drinks: 200 })
    expect(galleyRequirement(order('b', 100, false))).toEqual({ hot_meal: 0, snack_box: 100, drinks: 100 })
    expect(galleyRequirement({ ...order('c'), bookedPax: 500 }).snack_box).toBe(180)
    expect(cartsFor(0, 30)).toBe(0)
    expect(cartsFor(31, 30)).toBe(2)
  })
})

describe('visible catering process', () => {
  it('runs every phase in order with crew out of the cab and lift up at the door', () => {
    const e = new CateringEngine({ trucks: 1 })
    e.orderCatering(order('F1'))
    e.tick(0)
    const ev = [...e.drainEvents(), ...run(e, 60)]
    const phases = ev.filter((x) => x.type === 'catering_phase').map((x) => (x as { phase: string }).phase)
    expect(phases).toEqual([...CATERING_PHASES])
    const at = (p: string) => ev.find((x) => x.type === 'catering_phase' && x.phase === p) as Extract<CateringEvent, { type: 'catering_phase' }>
    expect(at('driving_to_stand').crew.every((c) => c.at === 'cab')).toBe(true)
    expect(at('crew_exit').crew.every((c) => c.at === 'ground')).toBe(true)
    expect(at('carts_in').crew.map((c) => c.at)).toEqual(['lift', 'galley'])
    expect(at('carts_out').liftHeight).toBe(1)
    expect(at('crew_board').liftHeight).toBe(0)
    const done = ev.find((x) => x.type === 'catering_done') as Extract<CateringEvent, { type: 'catering_done' }>
    expect(done.short).toBe(false)
    expect(done.loaded).toEqual({ hot_meal: 0, snack_box: 120, drinks: 120 })
    expect(e.isCateringDone('F1')).toBe(true)
    expect(e.galley('F1')!.usedCartsOnBoard).toBe(0)
    expect(e.trucks[0].phase).toBe('idle')
  })

  it('phase timings sum to configured durations (no teleporting)', () => {
    const e = new CateringEngine({ trucks: 1 })
    e.orderCatering(order('F1'))
    e.tick(0)
    const ev = [...e.drainEvents(), ...run(e, 60)].filter((x) => x.type === 'catering_phase') as Extract<CateringEvent, { type: 'catering_phase' }>[]
    for (let i = 1; i < ev.length; i++) expect(ev[i].time - ev[i - 1].time).toBe(e.config.durations[ev[i - 1].phase])
  })

  it('works with a coarse tick (big dt) and still emits every phase', () => {
    const e = new CateringEngine({ trucks: 1 })
    e.orderCatering(order('F1'))
    e.tick(0)
    e.tick(100)
    expect(e.drainEvents().filter((x) => x.type === 'catering_phase')).toHaveLength(CATERING_PHASES.length)
  })

  it('too few trucks is a player-made bottleneck: second flight waits and is flagged late', () => {
    const e = new CateringEngine({ trucks: 1 })
    e.orderCatering(order('F1', 120, false, 10))
    e.orderCatering(order('F2', 120, false, 12))
    const ev = run(e, 15)
    expect(ev.some((x) => x.type === 'catering_late' && x.flightId === 'F2' && x.reason === 'no_truck')).toBe(true)
    run(e, 120)
    expect(e.isCateringDone('F2')).toBe(true)
  })

  it('kitchen shortage leaves the galley short, never magically full', () => {
    const e = new CateringEngine({ trucks: 1, kitchenInitial: { hot_meal: 10, snack_box: 0, drinks: 0 }, kitchenMealsPerMinute: 0 })
    e.orderCatering(order('LH', 50, true))
    const ev = run(e, 60)
    expect(ev.some((x) => x.type === 'catering_late' && x.reason === 'no_meals')).toBe(true)
    expect(e.galley('LH')!.status).toBe('short')
    expect(e.galley('LH')!.loaded.hot_meal).toBe(10)
  })

  it('kitchen production respects capacity', () => {
    const e = new CateringEngine({ kitchenCapacity: 100, kitchenInitial: { hot_meal: 0, snack_box: 0, drinks: 0 }, kitchenMealsPerMinute: 10 })
    run(e, 50)
    expect(e.kitchen.hot_meal + e.kitchen.snack_box + e.kitchen.drinks).toBe(100)
  })
})

describe('airside shops', () => {
  it('sells until empty, then wish bubble, mild happiness drop, lost sale, walk away', () => {
    const e = new CateringEngine({}, [{ id: 'b', name: 'B', skus: ['burger'], capacityPerSku: 2, reorderAt: 0 }])
    expect(e.purchase('p1', 'b', 'burger').ok).toBe(true)
    expect(e.purchase('p2', 'b', 'burger').ok).toBe(true)
    const r = e.purchase('p3', 'b', 'burger')
    expect(r).toEqual({ ok: false, thought: 'wish they had burgers', happinessDelta: -3, walkAway: true, lostSale: 12 })
    const ev = e.drainEvents()
    expect(ev.map((x) => x.type)).toEqual(['shop_sale', 'shop_sale', 'shop_out_of_stock', 'pax_walk_away'])
    expect(e.revenue).toBe(24)
    expect(e.lostRevenue).toBe(12)
    expect(e.shops.get('b')!.lostSalesToday).toBe(1)
  })

  it('reorderAt=0 means no auto restock (player choice); manual order works through visible supply run', () => {
    const e = new CateringEngine({}, [{ id: 'b', name: 'B', skus: ['burger'], capacityPerSku: 3, reorderAt: 0 }])
    for (let i = 0; i < 3; i++) e.purchase(`p${i}`, 'b', 'burger')
    run(e, 60)
    expect(e.shops.get('b')!.stock.burger).toBe(0)
    expect(e.requestRestock('b')).toBe(true)
    expect(e.requestRestock('b')).toBe(false)
    const ev = run(e, 120)
    expect(ev.filter((x) => x.type === 'supply_phase').map((x) => (x as { phase: string }).phase)).toEqual([
      'loading_at_depot', 'driving_to_dock', 'security_screening', 'trolley_to_shop', 'shelving', 'returning',
    ])
    expect(e.shops.get('b')!.stock.burger).toBe(3)
    expect(e.depot.burger).toBe(e.config.depotInitialPerSku - 3)
  })

  it('auto reorder triggers at threshold and refills from depot', () => {
    const e = new CateringEngine({}, [{ id: 'c', name: 'C', skus: ['coffee'], capacityPerSku: 10, reorderAt: 5 }])
    for (let i = 0; i < 5; i++) e.purchase(`p${i}`, 'c', 'coffee')
    expect(e.shops.get('c')!.pendingRun).toBe(true)
    run(e, 40)
    expect(e.shops.get('c')!.stock.coffee).toBe(10)
    expect(e.shops.get('c')!.pendingRun).toBe(false)
  })

  it('empty depot means restock delivers nothing until the daily delivery', () => {
    const e = new CateringEngine({ depotInitialPerSku: 0, depotRestockPerDay: 50 }, [{ id: 'w', name: 'W', skus: ['water'], capacityPerSku: 5, reorderAt: 0 }])
    for (let i = 0; i < 5; i++) e.purchase(`p${i}`, 'w', 'water')
    e.requestRestock('w')
    run(e, 60)
    expect(e.shops.get('w')!.stock.water).toBe(0)
    run(e, 1450, 10)
    expect(e.depot.water).toBe(50)
    e.requestRestock('w')
    run(e, 1520)
    expect(e.shops.get('w')!.stock.water).toBe(5)
  })
})

describe('fuel outages ground flights', () => {
  it('grounds flights that cannot be fuelled, in departure order, and releases them', () => {
    const m = new FuelOutageMonitor()
    const d = [
      { flightId: 'B', litres: 5000, departAt: 20 },
      { flightId: 'A', litres: 5000, departAt: 10 },
    ]
    expect(m.evaluate(0, 6000, d)).toEqual(['A'])
    expect(m.isGrounded('B')).toBe(true)
    expect(m.events[0]).toMatchObject({ type: 'flight_grounded', flightId: 'B', available: 1000 })
    m.evaluate(1, 6000, d)
    expect(m.events).toHaveLength(1)
    expect(m.evaluate(5, 20000, d)).toEqual(['A', 'B'])
    expect(m.isGrounded('B')).toBe(false)
    expect(m.events[1]).toMatchObject({ type: 'flight_released', flightId: 'B' })
  })
})
