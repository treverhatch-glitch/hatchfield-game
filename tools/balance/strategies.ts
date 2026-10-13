import { ITEMS, PREFAB, type SimParams } from './config'
import { evaluateDay, fieldLevel, growthRate, item, marginalNet, paybackDays, type Owned } from './model'

export type Strategy = 'greedy' | 'cheapest' | 'balanced'
export const STRATEGIES: Strategy[] = ['greedy', 'cheapest', 'balanced']
export const MAX_COPIES = 12

export interface RunLog {
  strategy: Strategy
  finalCash: number
  finalDemand: number
  finalLevel: number
  totalServed: number
  totalSpilled: number
  avgHappiness: number
  repairsSpent: number
  bought: Record<string, number>
  firstBuyDay: Record<string, number>
  daysBottleneck: Record<string, number>
  daily: { day: number; cash: number; demand: number; served: number; level: number; happiness: number; bottleneck: string; owned: number }[]
}

function choose(s: Strategy, owned: Owned[], cash: number, demand: number, level: number, p: SimParams, banned?: string): string | null {
  const counts = new Map<string, number>()
  for (const o of owned) counts.set(o.id, (counts.get(o.id) ?? 0) + 1)
  const pool = ITEMS.filter((i) => i.unlockLevel <= level && i.id !== banned && (counts.get(i.id) ?? 0) < MAX_COPIES)
  const budget = s === 'balanced' ? cash - p.reserve : cash
  const afford = pool.filter((i) => i.cost <= budget)
  if (!afford.length) return null
  // Look slightly ahead: evaluate against demand a week out so players can build before the crunch.
  const ahead = demand * (1 + p.growth * 7)

  if (s === 'cheapest') {
    afford.sort((a, z) => a.cost - z.cost)
    return afford[0].id
  }
  const scored = afford.map((i) => ({ i, net: marginalNet(owned, i.id, ahead, level, p) }))
  if (s === 'greedy') {
    scored.sort((a, z) => z.net - a.net)
    return scored[0].net > 0 ? scored[0].i.id : null
  }
  // balanced: fix the bottleneck first, then fast-payback items, then comfort when unhappy.
  const day = evaluateDay(owned, ahead, level, p)
  const fixes = scored
    .filter((x) => x.net > 0 && paybackDays(x.i.cost, x.net) < 90)
    .sort((a, z) => paybackDays(a.i.cost, a.net) - paybackDays(z.i.cost, z.net))
  const bn = fixes.find((x) => x.i.stage === day.bottleneck)
  if (bn && day.utilisation > 0.85) return bn.i.id
  if (fixes.length && paybackDays(fixes[0].i.cost, fixes[0].net) < 45) return fixes[0].i.id
  if (day.happiness < 65) {
    const comfort = afford
      .filter((i) => i.happiness)
      .sort((a, z) => (z.happiness! / (z.cost + 30 * z.upkeep)) - (a.happiness! / (a.cost + 30 * a.upkeep)))
    if (comfort.length) return comfort[0].id
  }
  return null
}

export function runStrategy(s: Strategy, p: SimParams, opts: { banned?: string } = {}): RunLog {
  let owned: Owned[] = PREFAB.map((id) => ({ id, condition: 1 }))
  let cash = p.startCash
  let demand = p.baseDemand
  let xp = 0
  const log: RunLog = {
    strategy: s, finalCash: 0, finalDemand: 0, finalLevel: 1, totalServed: 0, totalSpilled: 0, avgHappiness: 0,
    repairsSpent: 0, bought: {}, firstBuyDay: {}, daysBottleneck: {}, daily: [],
  }
  let happySum = 0
  for (let day = 0; day < p.days; day++) {
    const level = fieldLevel(xp)
    // Up to 3 purchases per day.
    for (let k = 0; k < 3; k++) {
      const pick = choose(s, owned, cash, demand, level, p, opts.banned)
      if (!pick) break
      cash -= item(pick).cost
      owned = [...owned, { id: pick, condition: 1 }]
      log.bought[pick] = (log.bought[pick] ?? 0) + 1
      if (log.firstBuyDay[pick] === undefined) log.firstBuyDay[pick] = day
    }
    const r = evaluateDay(owned, demand, level, p)
    cash += r.profit
    log.totalServed += r.served
    log.totalSpilled += r.spilled
    log.daysBottleneck[r.bottleneck] = (log.daysBottleneck[r.bottleneck] ?? 0) + 1
    happySum += r.happiness
    // Wear scales with utilisation; repair when below threshold.
    owned = owned.map((o) => {
      const it = item(o.id)
      let c = o.condition - it.wearPerDay * (0.5 + Math.min(1.5, r.utilisation))
      if (c < p.repairAt) {
        const rc = it.cost * p.repairCostFrac
        cash -= rc
        log.repairsSpent += rc
        c = 1
      }
      return { id: o.id, condition: c }
    })
    xp += (r.served / 1000) * p.xpPer1000Pax
    demand = Math.min(p.levelDemandCap[fieldLevel(xp)], demand * (1 + growthRate(r.happiness, p)))
    log.daily.push({ day, cash: Math.round(cash), demand: Math.round(demand), served: Math.round(r.served), level, happiness: Math.round(r.happiness), bottleneck: r.bottleneck, owned: owned.length })
  }
  log.finalCash = cash
  log.finalDemand = demand
  log.finalLevel = fieldLevel(xp)
  log.avgHappiness = happySum / p.days
  return log
}
