import { CateringEngine, FuelOutageMonitor, type CateringEvent, type CateringPhase, type ShopSku } from '../catering/index.ts'
import type { PurchaseResult } from '../catering/types.ts'

/** Where a crew member stands relative to the truck, for the apron renderer. */
export interface CateringCrewPose {
  id: string
  role: 'driver' | 'helper'
  at: 'cab' | 'ground' | 'lift' | 'galley'
}

/** One visible catering truck. Coordinates are apron cells. */
export interface CateringPose {
  id: string
  x: number
  y: number
  heading: number
  liftHeight: number
  phase: CateringPhase
  /** 0 at the start of `phase`, 1 at the end. Crew walk this, they do not jump. */
  phaseU: number
  standId: string
  crew: CateringCrewPose[]
}

const AT_STAND = new Set<CateringPhase>([
  'parking',
  'crew_exit',
  'lift_raise',
  'carts_out',
  'carts_in',
  'lift_lower',
  'crew_board',
])

export function cateringCue(event: CateringEvent): string | null {
  if (event.type === 'catering_phase') {
    if (event.phase === 'lift_raise' || event.phase === 'carts_out' || event.phase === 'carts_in') return 'catering_lift_start'
    if (event.phase === 'lift_lower' || event.phase === 'crew_board') return 'catering_lift_stop'
    if (event.phase === 'parking' || event.phase === 'driving_to_stand') return 'truck_arrive'
    return null
  }
  if (event.type === 'catering_done') return 'cash_in'
  if (event.type === 'shop_out_of_stock') return 'rating_down'
  if (event.type === 'catering_late') return 'disruption'
  return null
}

/**
 * Galley trucks, airside shop stock, and the fuel-outage check.
 * The engine's clock is absolute game minutes, the same minute the ramp uses.
 */
export class CateringBridge {
  readonly engine = new CateringEngine()
  readonly fuel = new FuelOutageMonitor()
  postedRevenue = 0
  postedLost = 0

  orderFor(flightId: string, standId: string, seats: number, bookedPax: number, longHaul: boolean, dueBy: number) {
    if (this.engine.galley(flightId)) return this.engine.galley(flightId)!
    const safeSeats = Number.isFinite(seats) ? Math.max(0, seats) : 0
    const safePax = Number.isFinite(bookedPax) ? Math.max(0, bookedPax) : 0
    const safeDueBy = Number.isFinite(dueBy) ? Math.max(0, dueBy) : 0
    return this.engine.orderCatering({ flightId, standId, seats: safeSeats, bookedPax: safePax, longHaul, dueBy: safeDueBy })
  }

  /**
   * Empty hall shelf. Zero the matching SKU first so a full default shop
   * cannot ring up a sale the counter does not have.
   */
  stockout(paxId: string, kind: 'food' | 'shop'): PurchaseResult {
    const shopId = kind === 'food' ? 'shop_burger' : 'shop_news'
    const sku: ShopSku = kind === 'food' ? 'burger' : 'souvenir'
    const shop = this.engine.shops.get(shopId)
    if (shop) shop.stock[sku] = 0
    return this.engine.purchase(paxId, shopId, sku)
  }

  poses(kitchen: { c: number; r: number } | null): CateringPose[] {
    const safeKitchen =
      kitchen && Number.isFinite(kitchen.c) && Number.isFinite(kitchen.r)
        ? kitchen
        : null
    const out: CateringPose[] = []
    for (const truck of this.engine.trucks) {
      if (truck.phase === 'idle' || !truck.job) continue
      const phase = truck.phase
      const galley = this.engine.galley(truck.job)
      const stand = parseCell(galley?.standId)
      const from = safeKitchen ?? stand
      const to = stand ?? safeKitchen
      if (!from || !to) continue
      const dur = this.engine.config.durations[phase]
      const u = dur > 0 ? clamp01(1 - (truck.phaseEndsAt - this.engine.now) / dur) : 1
      let x = to.c
      let y = to.r
      if (phase === 'loading_at_kitchen' || phase === 'unloading_at_kitchen') {
        x = from.c
        y = from.r
      } else if (phase === 'driving_to_stand') {
        x = from.c + (to.c - from.c) * u
        y = from.r + (to.r - from.r) * u
      } else if (phase === 'driving_to_kitchen') {
        x = to.c + (from.c - to.c) * u
        y = to.r + (from.r - to.r) * u
      } else if (!AT_STAND.has(phase)) {
        x = from.c
        y = from.r
      }
      const heading = Math.atan2(to.r - from.r, to.c - from.c)
      out.push({
        id: truck.id,
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        heading: Number.isFinite(heading) ? heading : 0,
        liftHeight: Number.isFinite(truck.liftHeight) ? truck.liftHeight : 0,
        phase,
        phaseU: u,
        standId: galley?.standId ?? '',
        crew: truck.crew.map((c) => ({ id: c.id, role: c.role, at: c.at })),
      })
    }
    return out
  }
}

function parseCell(id: string | undefined): { c: number; r: number } | null {
  if (!id) return null
  const [c, r] = id.split(',').map(Number)
  if (!Number.isFinite(c) || !Number.isFinite(r)) return null
  return { c, r }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}
