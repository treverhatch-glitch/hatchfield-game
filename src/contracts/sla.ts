import { airframeInfo, DEFAULT_AIRFRAMES } from './airframes.ts'
import { clampStanding, servicesForSeason } from './contracts.ts'
import type { AirframeInfo, Contract, Season, SlotInstance } from './types.ts'

/** Departure counts on time within this many minutes of planned off-block (A15). */
export const ON_TIME_TOLERANCE_MIN = 15
/** Standing at or below this is hostile: repeated breaches can trigger a lawsuit. */
export const HOSTILE_STANDING = -50
export const LAWSUIT_BREACH_WEEKS = 3

export type LedgerKind = 'contract_revenue' | 'sla_penalty' | 'sla_bonus' | 'early_cancel_fee'
/** Posts to the single cash ledger (PR #11). Positive = income. */
export interface LedgerEntry {
  day: number
  kind: LedgerKind
  amount: number
  contractId: string
  memo: string
}

export interface WeekAudit {
  contractId: string
  airlineId: string
  flights: number
  operated: number
  onTimePct: number
  lateMinOverTarget: number
  lostBags: number
  bags: number
  lostBagRatePer1000: number
  groundingBreaches: number
  cateringBreaches: number
  breached: boolean
  standingDelta: number
  ledger: LedgerEntry[]
  lawsuit: boolean
}

/**
 * Weekly audit (#12): reads SlotInstance.actual vs SLA, prices revenue, penalties, standing change.
 * Slots without `actual` are treated as not yet flown and skipped.
 */
export function auditWeek(
  c: Contract,
  slots: SlotInstance[],
  ctx: {
    season: Season
    auditDay: number
    currentStanding: number
    /** consecutive prior weeks with a breach */
    priorBreachWeeks?: number
    /** extra standing cost from off-window drags (adjust.weeklyOffWindowCost) */
    offWindowCost?: number
    airframes?: Record<string, AirframeInfo>
  },
): WeekAudit {
  const airframes = ctx.airframes ?? DEFAULT_AIRFRAMES
  const mine = slots.filter((s) => s.contractId === c.id && !s.cancelled && s.actual)
  const services = servicesForSeason(c, ctx.season)
  const servicePrice = services.reduce((a, s) => a + (c.money.services[s] ?? 0), 0)
  let operated = 0, onTime = 0, lateMin = 0, lost = 0, bags = 0, grounding = 0, catering = 0, revenue = 0
  for (const s of mine) {
    const a = s.actual!
    if (a.grounded) {
      if (a.grounded === 'fuel' && services.includes('fuel')) grounding++
      continue
    }
    operated++
    const line = c.lines.find((l) => l.id === s.lineId)
    const target = line?.turnaroundTargetMin ?? (s.plannedOffBlock - s.plannedOnBlock)
    if (a.offBlock !== undefined && a.offBlock <= s.plannedOffBlock + ON_TIME_TOLERANCE_MIN) onTime++
    if (a.onBlock !== undefined && a.offBlock !== undefined) lateMin += Math.max(0, a.offBlock - a.onBlock - target)
    lost += a.lostBags ?? 0
    bags += a.bagsExpected ?? a.bagsLoaded ?? 0
    if (a.cateringShort && services.includes('catering')) catering++
    const info = airframeInfo(airframes, s.airframeId)
    revenue += info.mtowTonnes * c.money.landingPerTonne + (a.pax ?? 0) * c.money.perPax + servicePrice
  }
  const onTimePct = operated ? onTime / operated : 1
  const lostRate = bags ? (lost / bags) * 1000 : 0
  const penalty = lateMin * c.penalties.perLateMin + lost * c.penalties.perLostBag + grounding * c.penalties.perGrounding
  const missedOnTime = operated > 0 && onTimePct < c.sla.onTimePct
  const missedBags = lostRate > c.sla.lostBagRate
  const breached = missedOnTime || missedBags || grounding > 0 || catering > 0

  let delta = 0
  if (operated > 0 && !breached) delta += 2
  if (missedOnTime) delta -= 3
  if (missedBags) delta -= 2
  delta -= 2 * grounding
  delta -= catering
  delta -= ctx.offWindowCost ?? 0
  delta = Math.max(-10, Math.min(5, delta))
  const newStanding = clampStanding(ctx.currentStanding + delta)
  const ledger: LedgerEntry[] = []
  if (revenue) ledger.push({ day: ctx.auditDay, kind: 'contract_revenue', amount: Math.round(revenue), contractId: c.id, memo: `${operated} flights` })
  if (penalty) ledger.push({ day: ctx.auditDay, kind: 'sla_penalty', amount: -Math.round(penalty), contractId: c.id, memo: `late ${lateMin}m, lost ${lost}, grounded ${grounding}` })
  const breachWeeks = breached ? (ctx.priorBreachWeeks ?? 0) + 1 : 0
  return {
    contractId: c.id,
    airlineId: c.airlineId,
    flights: mine.length,
    operated,
    onTimePct,
    lateMinOverTarget: lateMin,
    lostBags: lost,
    bags,
    lostBagRatePer1000: lostRate,
    groundingBreaches: grounding,
    cateringBreaches: catering,
    breached,
    standingDelta: newStanding - clampStanding(ctx.currentStanding),
    ledger,
    lawsuit: breached && newStanding <= HOSTILE_STANDING && breachWeeks >= LAWSUIT_BREACH_WEEKS,
  }
}

/** Season-end bonuses: each on-time threshold beaten pays; a zero-lost-bags season pays half the first bonus. */
export function seasonBonuses(c: Contract, weeks: WeekAudit[], day: number): LedgerEntry[] {
  const operated = weeks.reduce((a, w) => a + w.operated, 0)
  if (!operated) return []
  const onTime = weeks.reduce((a, w) => a + w.onTimePct * w.operated, 0) / operated
  const out: LedgerEntry[] = []
  for (const b of c.bonuses) {
    if (onTime > b.onTimeOver) out.push({ day, kind: 'sla_bonus', amount: b.amount, contractId: c.id, memo: `season on-time ${(onTime * 100).toFixed(1)}% > ${(b.onTimeOver * 100).toFixed(0)}%` })
  }
  if (weeks.every((w) => w.lostBags === 0) && weeks.some((w) => w.bags > 0)) {
    out.push({ day, kind: 'sla_bonus', amount: Math.round(c.bonuses[0]?.amount ?? 0) / 2, contractId: c.id, memo: 'zero lost bags' })
  }
  return out
}

export function cancelFeeEntry(c: Contract, fee: number, day: number): LedgerEntry {
  return { day, kind: 'early_cancel_fee', amount: -Math.abs(fee), contractId: c.id, memo: 'early cancellation' }
}
