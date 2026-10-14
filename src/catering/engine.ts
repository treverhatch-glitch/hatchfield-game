import { DEFAULT_CATERING, DEFAULT_SHOPS, wishThought } from './defaults.ts'
import {
  CATERING_PHASES,
  MEAL_ITEMS,
  SHOP_SKUS,
  SUPPLY_PHASES,
  type Basket,
  type CateringConfig,
  type CateringEvent,
  type CateringPhase,
  type CateringTruck,
  type CrewMember,
  type FlightCateringOrder,
  type GalleyState,
  type PurchaseResult,
  type ShopConfig,
  type ShopSku,
  type ShopState,
  type SupplyPhase,
  type SupplyRunner,
} from './types.ts'

const emptyBasket = (): Basket => ({ hot_meal: 0, snack_box: 0, drinks: 0 })
const basketTotal = (b: Basket): number => b.hot_meal + b.snack_box + b.drinks

/** Where each crew member stands during a phase (driver, helper). */
const CREW_AT: Record<CateringPhase, [CrewMember['at'], CrewMember['at']]> = {
  loading_at_kitchen: ['ground', 'ground'],
  driving_to_stand: ['cab', 'cab'],
  parking: ['cab', 'cab'],
  crew_exit: ['ground', 'ground'],
  lift_raise: ['lift', 'lift'],
  carts_out: ['lift', 'galley'],
  carts_in: ['lift', 'galley'],
  lift_lower: ['lift', 'lift'],
  crew_board: ['cab', 'cab'],
  driving_to_kitchen: ['cab', 'cab'],
  unloading_at_kitchen: ['ground', 'ground'],
}

export function galleyRequirement(o: FlightCateringOrder): Basket {
  const pax = Math.max(0, Math.min(o.bookedPax, o.seats))
  return o.longHaul ? { hot_meal: pax, snack_box: 0, drinks: pax * 2 } : { hot_meal: 0, snack_box: pax, drinks: pax }
}

export function cartsFor(pax: number, divisor: number): number {
  return pax <= 0 ? 0 : Math.max(1, Math.ceil(pax / divisor))
}

export class CateringEngine {
  readonly config: CateringConfig
  now = 0
  kitchen: Basket
  depot: Record<ShopSku, number>
  readonly trucks: CateringTruck[] = []
  readonly runners: SupplyRunner[] = []
  readonly galleys = new Map<string, GalleyState>()
  readonly shops = new Map<string, ShopState>()
  readonly events: CateringEvent[] = []
  revenue = 0
  lostRevenue = 0
  private orders: FlightCateringOrder[] = []
  private supplyQueue: string[] = []
  private lateFlagged = new Set<string>()
  private kitchenFrac = 0
  private lastDay = 0

  constructor(config: Partial<CateringConfig> = {}, shops: ShopConfig[] = DEFAULT_SHOPS) {
    this.config = { ...DEFAULT_CATERING, ...config }
    this.kitchen = { ...this.config.kitchenInitial }
    this.depot = Object.fromEntries(SHOP_SKUS.map((s) => [s, this.config.depotInitialPerSku])) as Record<ShopSku, number>
    for (let i = 0; i < this.config.trucks; i++) this.addTruck()
    for (let i = 0; i < this.config.supplyRunners; i++) this.addRunner()
    for (const s of shops) this.addShop(s)
  }

  addTruck(): CateringTruck {
    const id = `cat_${this.trucks.length + 1}`
    const t: CateringTruck = {
      id,
      crew: [
        { id: `${id}_driver`, role: 'driver', at: 'cab' },
        { id: `${id}_helper`, role: 'helper', at: 'cab' },
      ],
      phase: 'idle',
      phaseEndsAt: 0,
      liftHeight: 0,
      freshCarts: 0,
      usedCarts: 0,
      cargo: emptyBasket(),
    }
    this.trucks.push(t)
    return t
  }

  addRunner(): SupplyRunner {
    const id = `sup_${this.runners.length + 1}`
    const r: SupplyRunner = { id, crew: [{ id: `${id}_porter`, role: 'driver', at: 'cab' }], phase: 'idle', phaseEndsAt: 0, load: {} }
    this.runners.push(r)
    return r
  }

  addShop(c: ShopConfig): ShopState {
    const stock = Object.fromEntries(SHOP_SKUS.map((s) => [s, c.skus.includes(s) ? c.capacityPerSku : 0])) as Record<ShopSku, number>
    const s: ShopState = { ...c, skus: [...c.skus], stock, pendingRun: false, salesToday: 0, lostSalesToday: 0 }
    this.shops.set(c.id, s)
    return s
  }

  /** Player control: change reorder threshold (0 = manual only). */
  setReorderAt(shopId: string, level: number): void {
    const s = this.shops.get(shopId)
    if (s) s.reorderAt = Math.max(0, Math.floor(level))
  }

  /** Book catering for a departing flight. */
  orderCatering(o: FlightCateringOrder): GalleyState {
    const required = galleyRequirement(o)
    const carts = cartsFor(Math.min(o.bookedPax, o.seats), this.config.cartsPerPaxDivisor)
    const g: GalleyState = { flightId: o.flightId, standId: o.standId, required, loaded: emptyBasket(), usedCartsOnBoard: carts, cartsRequired: carts, status: 'waiting' }
    this.galleys.set(o.flightId, g)
    this.orders.push(o)
    this.orders.sort((a, b) => a.dueBy - b.dueBy)
    return g
  }

  galley(flightId: string): GalleyState | undefined {
    return this.galleys.get(flightId)
  }

  isCateringDone(flightId: string): boolean {
    const g = this.galleys.get(flightId)
    return !!g && (g.status === 'complete' || g.status === 'short')
  }

  /** Passenger tries to buy. Out of stock: thought bubble, mild happiness drop, lost sale, walk away. */
  purchase(paxId: string, shopId: string, sku: ShopSku): PurchaseResult {
    const s = this.shops.get(shopId)
    const price = this.config.prices[sku]
    if (!s) throw new Error(`unknown shop ${shopId}`)
    if (s.stock[sku] > 0) {
      s.stock[sku]--
      s.salesToday++
      this.revenue += price
      this.emit({ type: 'shop_sale', time: this.now, shopId, sku, paxId, amount: price })
      this.maybeReorder(s)
      return { ok: true, amount: price }
    }
    const thought = wishThought(sku)
    const delta = this.config.outOfStockHappiness
    s.lostSalesToday++
    this.lostRevenue += price
    this.emit({ type: 'shop_out_of_stock', time: this.now, shopId, sku, paxId, thought, happinessDelta: delta, lostSale: price })
    this.emit({ type: 'pax_walk_away', time: this.now, shopId, paxId })
    this.maybeReorder(s)
    return { ok: false, thought, happinessDelta: delta, walkAway: true, lostSale: price }
  }

  /** Manual restock order from the shop's info panel. */
  requestRestock(shopId: string): boolean {
    const s = this.shops.get(shopId)
    if (!s || s.pendingRun) return false
    s.pendingRun = true
    this.supplyQueue.push(shopId)
    return true
  }

  /** Advance to sim minute `now`. */
  tick(minute: number): void {
    // Time only moves forward. A stale or non-finite minute must not re-cook or stall the kitchen.
    const now = Number.isFinite(minute) ? Math.max(this.now, minute) : this.now
    const dt = now - this.now
    this.now = now
    this.produceMeals(dt)
    const day = Math.floor(now / 1440)
    if (day > this.lastDay) {
      for (const k of SHOP_SKUS) this.depot[k] += this.config.depotRestockPerDay * (day - this.lastDay)
      for (const s of this.shops.values()) {
        s.salesToday = 0
        s.lostSalesToday = 0
      }
      this.lastDay = day
    }
    // Advance phases, possibly several per tick for big dt.
    for (let guard = 0; guard < 64; guard++) {
      let moved = false
      for (const t of this.trucks) if (t.phase !== 'idle' && t.phaseEndsAt <= now) moved = this.advanceTruck(t) || moved
      for (const r of this.runners) if (r.phase !== 'idle' && r.phaseEndsAt <= now) moved = this.advanceRunner(r) || moved
      moved = this.dispatch() || moved
      if (!moved) break
    }
    for (const o of this.orders) {
      const g = this.galleys.get(o.flightId)
      if (g?.status === 'waiting' && now >= o.dueBy && !this.lateFlagged.has(o.flightId)) {
        this.lateFlagged.add(o.flightId)
        this.emit({ type: 'catering_late', time: now, flightId: o.flightId, reason: 'no_truck' })
      }
    }
  }

  drainEvents(): CateringEvent[] {
    return this.events.splice(0)
  }

  // ---- internals ----

  private emit(e: CateringEvent): void {
    this.events.push(e)
  }

  private produceMeals(dt: number): void {
    if (dt <= 0) return
    this.kitchenFrac += dt * this.config.kitchenMealsPerMinute
    let n = Math.floor(this.kitchenFrac)
    this.kitchenFrac -= n
    let i = 0
    while (n > 0 && basketTotal(this.kitchen) < this.config.kitchenCapacity) {
      this.kitchen[MEAL_ITEMS[i % MEAL_ITEMS.length]]++
      n--
      i++
    }
  }

  private maybeReorder(s: ShopState): void {
    if (s.reorderAt <= 0 || s.pendingRun) return
    if (s.skus.some((k) => s.stock[k] <= s.reorderAt)) this.requestRestock(s.id)
  }

  private dispatch(): boolean {
    let moved = false
    for (const o of this.orders) {
      const g = this.galleys.get(o.flightId)
      if (!g || g.status !== 'waiting') continue
      const t = this.trucks.find((x) => x.phase === 'idle')
      if (!t) break
      const cargo = emptyBasket()
      let short = false
      for (const k of MEAL_ITEMS) {
        const take = Math.min(g.required[k], this.kitchen[k])
        cargo[k] = take
        this.kitchen[k] -= take
        if (take < g.required[k]) short = true
      }
      if (short && !this.lateFlagged.has(o.flightId)) {
        this.emit({ type: 'catering_late', time: this.now, flightId: o.flightId, reason: 'no_meals' })
        this.emit({ type: 'low_stock', time: this.now, stock: 'meals', level: basketTotal(this.kitchen) })
      }
      t.cargo = cargo
      t.freshCarts = g.cartsRequired
      t.usedCarts = 0
      t.job = o.flightId
      g.status = 'assigned'
      g.truckId = t.id
      this.enterTruckPhase(t, 'loading_at_kitchen')
      moved = true
    }
    for (const r of this.runners) {
      if (r.phase !== 'idle' || this.supplyQueue.length === 0) continue
      const shopId = this.supplyQueue.shift()!
      const s = this.shops.get(shopId)!
      const load: Partial<Record<ShopSku, number>> = {}
      for (const k of s.skus) {
        const want = s.capacityPerSku - s.stock[k]
        const take = Math.max(0, Math.min(want, this.depot[k]))
        if (take > 0) load[k] = take
        this.depot[k] -= take
      }
      r.load = load
      r.shopId = shopId
      this.enterRunnerPhase(r, 'loading_at_depot')
      moved = true
    }
    return moved
  }

  private enterTruckPhase(t: CateringTruck, p: CateringPhase): void {
    const start = t.phase === 'idle' ? this.now : t.phaseEndsAt
    t.phase = p
    t.phaseEndsAt = start + this.config.durations[p]
    const [d, h] = CREW_AT[p]
    t.crew[0].at = d
    t.crew[1].at = h
    const g = t.job ? this.galleys.get(t.job) : undefined
    if (p === 'crew_exit' && g) g.status = 'servicing'
    this.emit({ type: 'catering_phase', time: start, truckId: t.id, flightId: t.job ?? '', standId: g?.standId ?? '', phase: p, crew: t.crew.map((c) => ({ ...c })), liftHeight: t.liftHeight })
  }

  private advanceTruck(t: CateringTruck): boolean {
    const p = t.phase as CateringPhase
    const g = t.job ? this.galleys.get(t.job) : undefined
    // Apply end-of-phase effects.
    if (p === 'lift_raise') t.liftHeight = 1
    if (p === 'lift_lower') t.liftHeight = 0
    if (p === 'carts_out' && g) {
      t.usedCarts += g.usedCartsOnBoard
      g.usedCartsOnBoard = 0
    }
    if (p === 'carts_in' && g) {
      g.loaded = { ...t.cargo }
      t.cargo = emptyBasket()
      t.freshCarts = 0
    }
    if (p === 'crew_board' && g) {
      const short = MEAL_ITEMS.some((k) => g.loaded[k] < g.required[k])
      g.status = short ? 'short' : 'complete'
      this.emit({ type: 'catering_done', time: t.phaseEndsAt, flightId: g.flightId, standId: g.standId, loaded: { ...g.loaded }, short })
      this.orders = this.orders.filter((o) => o.flightId !== g.flightId)
    }
    if (p === 'unloading_at_kitchen') {
      t.usedCarts = 0
      t.phase = 'idle'
      t.job = undefined
      t.crew.forEach((c) => (c.at = 'cab'))
      return true
    }
    const next = CATERING_PHASES[CATERING_PHASES.indexOf(p) + 1]
    this.enterTruckPhase(t, next)
    return true
  }

  private enterRunnerPhase(r: SupplyRunner, p: SupplyPhase): void {
    const start = r.phase === 'idle' ? this.now : r.phaseEndsAt
    r.phase = p
    r.phaseEndsAt = start + this.config.supplyDurations[p]
    r.crew[0].at = p === 'driving_to_dock' || p === 'returning' ? 'cab' : 'ground'
    this.emit({ type: 'supply_phase', time: start, runnerId: r.id, shopId: r.shopId ?? '', phase: p })
  }

  private advanceRunner(r: SupplyRunner): boolean {
    const p = r.phase as SupplyPhase
    if (p === 'shelving' && r.shopId) {
      const s = this.shops.get(r.shopId)!
      for (const [k, n] of Object.entries(r.load) as [ShopSku, number][]) s.stock[k] = Math.min(s.capacityPerSku, s.stock[k] + n)
      s.pendingRun = false
      this.emit({ type: 'shop_restocked', time: r.phaseEndsAt, shopId: s.id, added: { ...r.load } })
      r.load = {}
    }
    if (p === 'returning') {
      r.phase = 'idle'
      r.shopId = undefined
      r.crew[0].at = 'cab'
      return true
    }
    this.enterRunnerPhase(r, SUPPLY_PHASES[SUPPLY_PHASES.indexOf(p) + 1])
    return true
  }
}
