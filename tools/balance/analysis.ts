import { ITEMS, PREFAB, type SimParams } from './config'
import { BAG_BASE, bagShare, dailyCapacity, evaluateDay, item, marginalNet, paybackDays, repairPerDay, type Owned } from './model'
import { runStrategy } from './strategies'

/** Demand used as reference when judging items unlocked at each level. */
export const LEVEL_DEMAND = [0, 450, 700, 1100, 1700, 2600]

export interface ItemRow {
  id: string
  name: string
  stage: string
  unlockLevel: number
  cost: number
  upkeep: number
  repairPerDay: number
  /** Marginal daily net in the prefab terminal at the unlock-level reference demand. */
  prefabNet: number
  /** Marginal daily net when this item's stage is the ONLY limit (other stages unbounded). */
  isolatedNet: number
  paybackDays: number
  roi30: number
  /** Final-cash loss of the balanced strategy if this item is banned (long-run value incl. happiness). */
  banValue: number
  verdict: 'dominant' | 'useless' | 'ok' | 'niche'
  suggestion: string
}

/** Everything except `stage` scaled up so only that stage limits. */
function isolatedState(stage: string): Owned[] {
  const base: Owned[] = PREFAB.map((id) => ({ id, condition: 1 }))
  const boost: Record<string, string> = { checkin: 'checkin_bag', security: 'sec_large', bags: 'bag_hall', gates: 'boarding' }
  for (const [st, id] of Object.entries(boost)) if (st !== stage) for (let i = 0; i < 20; i++) base.push({ id, condition: 1 })
  return base
}

export function analyseItems(p: SimParams, baseline = runStrategy('balanced', p).finalCash): ItemRow[] {
  return ITEMS.map((it) => {
    const demand = LEVEL_DEMAND[it.unlockLevel]
    const prefab: Owned[] = PREFAB.map((id) => ({ id, condition: 1 }))
    const prefabNet = marginalNet(prefab, it.id, demand, it.unlockLevel, p)
    let isolatedNet = prefabNet
    if (['checkin', 'security', 'bags', 'gates'].includes(it.stage)) {
      const iso = isolatedState(it.stage)
      // Bag drop only matters next to kiosks (bagged pax use kiosk + drop instead of a desk).
      if (it.id === 'bag_drop') for (let i = 0; i < 3; i++) iso.push({ id: 'kiosk', condition: 1 })
      // Demand just above the isolated stage's capacity.
      const capNow = evaluateDay(iso, p.levelDemandCap[5] * 3, it.unlockLevel, p).served
      // Demand just high enough to use this one extra item fully.
      const extra = dailyCapacity(it, 1, p) / (it.paxFilter === 'bagged' || it.stage === 'bags' ? Math.max(0.01, bagShare(it.unlockLevel)) : 1)
      // ...but never more than the traffic that exists at that Field Level.
      isolatedNet = marginalNet(iso, it.id, Math.min(capNow + extra, p.levelDemandCap[it.unlockLevel]), it.unlockLevel, p)
    }
    const best = Math.max(prefabNet, isolatedNet)
    const pb = paybackDays(it.cost, best)
    const banValue = baseline - runStrategy('balanced', p, { banned: it.id }).finalCash
    let verdict: ItemRow['verdict'] = 'ok'
    let suggestion = '—'
    const comfort = it.stage === 'comfort'
    if (!comfort && pb < 7) {
      verdict = 'dominant'
      const target = Math.round((best * 20) / 100) * 100
      suggestion = `Pays back in ${pb.toFixed(1)} d. Raise cost to ~$${target.toLocaleString()} (20-day payback) or upkeep +${Math.round(best * 0.3)}/d.`
    } else if (!comfort && (pb > 150 || best <= 0) && banValue > it.cost * 8) {
      verdict = 'ok'
      suggestion = 'No same-day profit at the reference demand, but banning it costs the balanced run >8x its price: value comes later, via growth.'
    } else if (!comfort && (pb > 150 || best <= 0)) {
      verdict = banValue <= 0 ? 'useless' : 'niche'
      if (best <= 0) {
        suggestion = `Never earns: upkeep+wear ($${Math.round(it.upkeep + repairPerDay(it, p))}/d) exceeds its gain. Cut upkeep ~50% or raise its throughput/spend.`
      } else {
        const target = Math.round((best * 60) / 100) * 100
        suggestion = `Payback ${pb.toFixed(0)} d. Cut cost to ~$${target.toLocaleString()} for a 60-day payback.`
      }
    } else if (comfort && banValue <= 0) {
      verdict = 'useless'
      suggestion = 'Banning it does not hurt long-run cash: raise happiness or growth link, or lower cost/upkeep.'
    } else if (comfort && banValue > it.cost * 8) {
      verdict = 'dominant'
      suggestion = 'Long-run value > 8x cost: add stronger diminishing returns or more upkeep.'
    }
    return {
      id: it.id, name: it.name, stage: it.stage, unlockLevel: it.unlockLevel, cost: it.cost, upkeep: it.upkeep,
      repairPerDay: repairPerDay(it, p), prefabNet, isolatedNet, paybackDays: pb,
      roi30: best > 0 ? (best * 30 - it.cost) / it.cost : -1, banValue, verdict, suggestion,
    }
  })
}

export { BAG_BASE, item }
