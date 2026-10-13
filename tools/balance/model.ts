import { AIRFRAMES, FIELD_LEVEL_XP, ITEMS, type HallItem, type SimParams, type Stage } from './config'

export interface Owned { id: string; condition: number }
export interface DayResult {
  demand: number
  served: number
  spilled: number
  bottleneck: Stage
  utilisation: number
  stageCaps: Record<'checkin' | 'security' | 'bags' | 'gates', number>
  retailRevenue: number
  feeRevenue: number
  upkeep: number
  profit: number
  happiness: number
}

const byId = new Map(ITEMS.map((i) => [i.id, i]))
export const item = (id: string): HallItem => {
  const it = byId.get(id)
  if (!it) throw new Error(`unknown item ${id}`)
  return it
}

/** Prefab bag belt with no scanner/hall: bagged pax/day it can move. */
export const BAG_BASE = 260

/** Worn items slow down; floor at 50% effectiveness. */
export function effectiveness(condition: number): number {
  const c = Math.min(1, Math.max(0, condition))
  return 0.5 + 0.5 * c
}

/** Pax (or bags) per day one item can serve, sized against the peak hour. */
export function dailyCapacity(it: HallItem, condition: number, p: SimParams): number {
  if (it.dailyCap !== undefined) return it.dailyCap * effectiveness(condition)
  if (it.serviceSec <= 0 || it.servers <= 0) return 0
  const perHour = (it.servers * 3600) / it.serviceSec
  return (perHour * p.opsHours * effectiveness(condition)) / p.peakFactor
}

/** Share of pax with a hold bag at a given field level (mean bagVolume/seats of unlocked pax airframes). */
export function bagShare(level: number): number {
  const fleet = AIRFRAMES.filter((a) => a.level <= Math.max(2, level))
  const r = fleet.reduce((s, a) => s + a.bagVolume / a.seats, 0) / fleet.length
  return Math.min(1, r)
}

export function fieldLevel(xp: number): number {
  for (let l = 5; l >= 2; l--) if (xp >= FIELD_LEVEL_XP[l]) return l
  return 1
}

/** Diminishing returns: k-th copy of the same comfort item gives h * 0.6^(k-1). */
export function comfortScore(owned: Owned[]): number {
  const counts = new Map<string, number>()
  let score = 0
  for (const o of owned) {
    const it = item(o.id)
    if (!it.happiness) continue
    const k = counts.get(o.id) ?? 0
    counts.set(o.id, k + 1)
    score += it.happiness * Math.pow(0.6, k) * effectiveness(o.condition)
  }
  return score
}

/** Evaluate one day of traffic against the terminal. Pure. */
export function evaluateDay(owned: Owned[], demand: number, level: number, p: SimParams): DayResult {
  const b = bagShare(level)
  const cap = (pred: (it: HallItem) => boolean) =>
    owned.reduce((s, o) => (pred(item(o.id)) ? s + dailyCapacity(item(o.id), o.condition, p) : s), 0)

  const deskCap = cap((i) => i.stage === 'checkin' && !i.paxFilter)
  const kioskCap = cap((i) => i.id === 'kiosk')
  const dropCap = cap((i) => i.id === 'bag_drop')
  const bagged = demand * b
  const unbagged = demand - bagged
  // Kiosks take unbagged pax, plus bagged pax that can use a bag drop.
  const kioskServed = Math.min(kioskCap, unbagged + Math.min(dropCap, bagged))
  const checkin = kioskServed + Math.min(deskCap, demand - kioskServed)

  const bagSys = BAG_BASE + cap((i) => i.stage === 'bags' && i.id !== 'bag_drop')
  // Bag system limits bagged pax; unbagged pax pass freely.
  // Total pax/day that get through bags today: unbagged pax pass, bagged pax limited by the bag system.
  const bags = unbagged + Math.min(bagged, bagSys)
  const security = cap((i) => i.stage === 'security')
  const gates = cap((i) => i.stage === 'gates')

  const stageCaps = { checkin, security, bags, gates }
  let bottleneck: Stage = 'checkin'
  let minCap = Infinity
  for (const [k, v] of Object.entries(stageCaps)) if (v < minCap) { minCap = v; bottleneck = k as Stage }
  const served = Math.max(0, Math.min(demand, minCap))
  const spilled = demand - served
  const utilisation = minCap > 0 ? demand / minCap : 99

  // Long queues eat shopping time: above 70% utilisation retail capture falls off.
  const dwell = Math.max(0.3, 1 - Math.max(0, utilisation - 0.7))
  let shoppers = served * p.retailCapture * dwell
  const shops = owned
    .filter((o) => item(o.id).stage === 'retail')
    .map((o) => ({ it: item(o.id), cap: dailyCapacity(item(o.id), o.condition, p) }))
    .sort((a, z) => (z.it.spend ?? 0) - (a.it.spend ?? 0))
  let retailRevenue = 0
  for (const s of shops) {
    const n = Math.min(s.cap, shoppers)
    retailRevenue += n * (s.it.spend ?? 0)
    shoppers -= n
  }

  const happiness = Math.max(0, Math.min(100,
    45 + comfortScore(owned) - 40 * (demand > 0 ? spilled / demand : 0) - 25 * Math.max(0, utilisation - 0.9)))

  const feeRevenue = served * p.paxFee
  const upkeep = owned.reduce((s, o) => s + item(o.id).upkeep, 0)
  return {
    demand, served, spilled, bottleneck, utilisation, stageCaps, retailRevenue, feeRevenue, upkeep,
    profit: feeRevenue + retailRevenue - upkeep, happiness,
  }
}

/** Demand growth multiplier from happiness: 40 = flat, 70 = 2x base growth, <40 shrinks. */
export function growthRate(happiness: number, p: SimParams): number {
  return p.growth * Math.max(-0.5, Math.min(2, (happiness - 40) / 15))
}

/** Expected repair cost per day for an item (amortised). */
export function repairPerDay(it: HallItem, p: SimParams, util = 1): number {
  const wear = it.wearPerDay * (0.5 + Math.min(1.5, util))
  return (it.cost * p.repairCostFrac * wear) / (1 - p.repairAt)
}

/** Cash payback in days; Infinity if the item never pays back. */
export function paybackDays(cost: number, dailyNet: number): number {
  return dailyNet > 0 ? cost / dailyNet : Infinity
}

/** Marginal daily net (profit gain minus repair amortisation) of adding one item. */
export function marginalNet(owned: Owned[], id: string, demand: number, level: number, p: SimParams): number {
  const before = evaluateDay(owned, demand, level, p)
  const after = evaluateDay([...owned, { id, condition: 1 }], demand, level, p)
  return after.profit - before.profit - repairPerDay(item(id), p, after.utilisation)
}
