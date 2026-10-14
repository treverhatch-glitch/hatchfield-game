import { describe, expect, it } from 'vitest'
import { CATERING_PHASES, CateringEngine, SHOP_SKUS, type CateringEvent, type ShopSku } from './index.ts'

const order = (id: string, pax = 120, longHaul = false, dueBy = 60) => ({ flightId: id, standId: `S_${id}`, seats: 180, bookedPax: pax, longHaul, dueBy })
const meals = (e: CateringEngine) => e.kitchen.hot_meal + e.kitchen.snack_box + e.kitchen.drinks
const emptyKitchen = { hot_meal: 0, snack_box: 0, drinks: 0 }

function run(e: CateringEngine, to: number, step = 1): CateringEvent[] {
  const out: CateringEvent[] = []
  for (let t = e.now + step; t <= to; t += step) {
    e.tick(t)
    out.push(...e.drainEvents())
  }
  return out
}

describe('catering engine edges', () => {
  it('serves an empty or negative booking as complete with nothing loaded', () => {
    const e = new CateringEngine({ trucks: 1 })
    const before = { ...e.kitchen }
    const g = e.orderCatering({ ...order('E0'), bookedPax: 0 })
    const n = e.orderCatering({ ...order('EN'), bookedPax: -40 })
    expect(g.cartsRequired).toBe(0)
    expect(n.required).toEqual(emptyKitchen)
    e.tick(0)
    run(e, 120)
    for (const id of ['E0', 'EN']) {
      expect(e.galley(id)!.status).toBe('complete')
      expect(e.galley(id)!.loaded).toEqual(emptyKitchen)
    }
    expect(e.kitchen.hot_meal).toBeGreaterThanOrEqual(before.hot_meal)
  })

  it('caps the galley at seats when overbooked', () => {
    const e = new CateringEngine({ trucks: 1 })
    e.orderCatering({ ...order('OB', 400, true), seats: 150 })
    e.tick(0)
    run(e, 60)
    expect(e.galley('OB')!.loaded).toEqual({ hot_meal: 150, snack_box: 0, drinks: 300 })
    expect(e.galley('OB')!.cartsRequired).toBe(5)
  })

  it('sends one truck when the same flight is booked twice', () => {
    const e = new CateringEngine({ trucks: 2 })
    e.orderCatering(order('DUP'))
    e.orderCatering(order('DUP'))
    e.tick(0)
    const ev = [...e.drainEvents(), ...run(e, 80)]
    const trucks = new Set(ev.filter((x) => x.type === 'catering_phase').map((x) => (x as { truckId: string }).truckId))
    expect([...trucks]).toEqual(['cat_1'])
    expect(ev.filter((x) => x.type === 'catering_done')).toHaveLength(1)
    expect(e.trucks.every((t) => t.phase === 'idle')).toBe(true)
  })

  it('never puts one truck on two jobs and clears a long queue in order', () => {
    const e = new CateringEngine({ trucks: 2 })
    for (let i = 0; i < 7; i++) e.orderCatering(order(`Q${i}`, 60, false, 10 + i * 5))
    e.tick(0)
    const ev = [...e.drainEvents(), ...run(e, 400)]
    for (let i = 0; i < 7; i++) expect(e.isCateringDone(`Q${i}`)).toBe(true)
    // Between a truck's first phase and its done event, no other flight uses it.
    const byTruck = new Map<string, string[]>()
    for (const x of ev) {
      if (x.type !== 'catering_phase') continue
      const seq = byTruck.get(x.truckId) ?? []
      if (seq[seq.length - 1] !== x.flightId) seq.push(x.flightId)
      byTruck.set(x.truckId, seq)
    }
    const flights = [...byTruck.values()].flat()
    expect(new Set(flights).size).toBe(flights.length)
    const done = ev.filter((x) => x.type === 'catering_done').map((x) => (x as { flightId: string }).flightId)
    expect(done).toHaveLength(7)
    expect(done.slice(0, 2).sort()).toEqual(['Q0', 'Q1'])
  })

  it('loads exactly what the kitchen holds: enough is complete, one short is short', () => {
    const exact = new CateringEngine({ trucks: 1, kitchenMealsPerMinute: 0, kitchenInitial: { hot_meal: 0, snack_box: 30, drinks: 30 } })
    exact.orderCatering(order('X', 30))
    exact.tick(0)
    run(exact, 60)
    expect(exact.galley('X')!.status).toBe('complete')
    expect(meals(exact)).toBe(0)

    const short = new CateringEngine({ trucks: 1, kitchenMealsPerMinute: 0, kitchenInitial: { hot_meal: 0, snack_box: 29, drinks: 30 } })
    short.orderCatering(order('S', 30))
    short.tick(0)
    run(short, 60)
    expect(short.galley('S')!.status).toBe('short')
    expect(short.galley('S')!.loaded).toEqual({ hot_meal: 0, snack_box: 29, drinks: 30 })
  })

  it('produces the same meals whether time comes in small or large steps', () => {
    const cfg = { kitchenMealsPerMinute: 0.7, kitchenInitial: emptyKitchen, kitchenCapacity: 10_000 }
    const fine = new CateringEngine(cfg)
    for (let t = 0.25; t <= 300; t += 0.25) fine.tick(t)
    const coarse = new CateringEngine(cfg)
    coarse.tick(300)
    expect(meals(fine)).toBe(meals(coarse))
    expect(meals(coarse)).toBe(210)
  })

  it('does not cook meals twice when a tick arrives with an earlier minute', () => {
    const cfg = { kitchenMealsPerMinute: 6, kitchenInitial: emptyKitchen }
    const steady = new CateringEngine(cfg)
    steady.tick(10)
    steady.tick(20)
    const jittery = new CateringEngine(cfg)
    jittery.tick(10)
    jittery.tick(4)
    jittery.tick(20)
    expect(meals(steady)).toBe(120)
    expect(meals(jittery)).toBe(meals(steady))
    expect(jittery.now).toBe(20)
  })

  it('keeps cooking after a NaN or infinite tick', () => {
    const e = new CateringEngine({ kitchenMealsPerMinute: 6, kitchenInitial: emptyKitchen })
    e.tick(10)
    e.tick(Number.NaN)
    e.tick(Number.POSITIVE_INFINITY)
    e.tick(20)
    expect(Number.isFinite(e.now)).toBe(true)
    expect(meals(e)).toBe(120)
  })

  it('restocks the depot once per skipped day and resets the daily shop counters', () => {
    const e = new CateringEngine({ depotInitialPerSku: 0, depotRestockPerDay: 25 }, [
      { id: 'b', name: 'B', skus: ['burger'], capacityPerSku: 1, reorderAt: 0 },
    ])
    e.purchase('p1', 'b', 'burger')
    e.purchase('p2', 'b', 'burger')
    expect(e.shops.get('b')!.salesToday).toBe(1)
    expect(e.shops.get('b')!.lostSalesToday).toBe(1)
    e.tick(1_440 * 3 + 5)
    for (const k of SHOP_SKUS) expect(e.depot[k]).toBe(75)
    expect(e.shops.get('b')!.salesToday).toBe(0)
    expect(e.shops.get('b')!.lostSalesToday).toBe(0)
    e.tick(1_440 * 3 + 600)
    for (const k of SHOP_SKUS) expect(e.depot[k]).toBe(75)
  })

  it('conserves shop stock: depot + shelves + trolley + sold always add up', () => {
    const e = new CateringEngine({ depotInitialPerSku: 120, depotRestockPerDay: 0 })
    const start = (k: ShopSku) => 120 + [...e.shops.values()].reduce((s, shop) => s + shop.stock[k], 0)
    const opening = Object.fromEntries(SHOP_SKUS.map((k) => [k, start(k)])) as Record<ShopSku, number>
    const sold = Object.fromEntries(SHOP_SKUS.map((k) => [k, 0])) as Record<ShopSku, number>
    const shops = [...e.shops.values()]
    let n = 0
    for (let t = 1; t <= 600; t++) {
      for (let i = 0; i < 3; i++) {
        const shop = shops[n % shops.length]!
        const sku = shop.skus[n % shop.skus.length]!
        if (e.purchase(`p${n}`, shop.id, sku).ok) sold[sku] += 1
        n++
      }
      e.tick(t)
      for (const k of SHOP_SKUS) {
        const shelves = shops.reduce((s, shop) => s + shop.stock[k], 0)
        const trolley = e.runners.reduce((s, r) => s + (r.load[k] ?? 0), 0)
        expect(e.depot[k] + shelves + trolley + sold[k]).toBe(opening[k])
        expect(e.depot[k]).toBeGreaterThanOrEqual(0)
      }
    }
    expect(Object.values(sold).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
  })

  it('handles shop controls at the edges', () => {
    const e = new CateringEngine()
    e.setReorderAt('shop_cafe', -4)
    expect(e.shops.get('shop_cafe')!.reorderAt).toBe(0)
    e.setReorderAt('shop_cafe', 7.9)
    expect(e.shops.get('shop_cafe')!.reorderAt).toBe(7)
    expect(() => e.setReorderAt('nope', 3)).not.toThrow()
    expect(e.requestRestock('nope')).toBe(false)
    expect(() => e.purchase('p', 'nope', 'burger')).toThrow()

    // A full shop still runs the visible trip, carries nothing and takes nothing from the depot.
    const depot = { ...e.depot }
    expect(e.requestRestock('shop_news')).toBe(true)
    expect(e.requestRestock('shop_news')).toBe(false)
    e.tick(1)
    const ev = [...e.drainEvents(), ...run(e, 40)]
    expect(e.depot).toEqual(depot)
    const restocked = ev.find((x) => x.type === 'shop_restocked') as Extract<CateringEvent, { type: 'shop_restocked' }>
    expect(restocked.added).toEqual({})
    expect(e.shops.get('shop_news')!.pendingRun).toBe(false)
  })

  it('reports a sku the shop does not carry as a lost sale, not a sale', () => {
    const e = new CateringEngine({}, [{ id: 'b', name: 'B', skus: ['burger'], capacityPerSku: 5, reorderAt: 0 }])
    const res = e.purchase('p', 'b', 'souvenir')
    expect(res.ok).toBe(false)
    expect(e.revenue).toBe(0)
    expect(e.lostRevenue).toBe(e.config.prices.souvenir)
    expect(e.shops.get('b')!.stock.burger).toBe(5)
  })

  it('runs the full phase list exactly once per job under coarse ticks', () => {
    const e = new CateringEngine({ trucks: 1 })
    for (let i = 0; i < 3; i++) e.orderCatering(order(`H${i}`, 90, i === 1, 30))
    e.tick(0)
    const ev = [...e.drainEvents(), ...run(e, 600, 45)]
    const phases = ev.filter((x) => x.type === 'catering_phase')
    expect(phases).toHaveLength(CATERING_PHASES.length * 3)
    for (let i = 0; i < 3; i++) expect(e.isCateringDone(`H${i}`)).toBe(true)
  })
})
