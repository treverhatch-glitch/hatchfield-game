import { airframeInfo, DEFAULT_AIRFRAMES, DEFAULT_MTT } from './airframes.ts'
import { seasonRun } from './seasons.ts'
import type { AirframeInfo, Contract, ContractTerm, FlightLine, Season, ServiceKind, SlaKpis, TimeWindow } from './types.ts'

export const STANDING_MIN = -100
export const STANDING_MAX = 100
export function clampStanding(v: number): number {
  return Math.max(STANDING_MIN, Math.min(STANDING_MAX, Math.round(v)))
}

/** Default window: ±20 min soft, ±60 min hard (doc §9 proposal). */
export function timeWindow(preferredMin: number, softMin = 20, hardMin = 60): TimeWindow {
  return { preferredMin, softMin, hardMin }
}

export const DEFAULT_SLA: SlaKpis = { onTimePct: 0.85, firstBagMin: 15, lastBagMin: 35, lostBagRate: 5 }
/** Hub gets first pick + 4-season term but stricter KPIs (doc §3). */
export const HUB_SLA: SlaKpis = { onTimePct: 0.9, firstBagMin: 12, lastBagMin: 30, lostBagRate: 3 }

export interface ContractDraft {
  id: string
  airlineId: string
  isHub?: boolean
  homePier?: string
  lines: FlightLine[]
  services: ServiceKind[]
  term?: ContractTerm
  sla?: Partial<SlaKpis>
  money?: Partial<Contract['money']>
  penalties?: Partial<Contract['penalties']>
  bonuses?: Contract['bonuses']
  earlyCancel?: Partial<Contract['earlyCancel']>
}

/** Build an 'offered' contract with sensible defaults. Term defaults: hub 4, else 2 (standard). */
export function makeOffer(d: ContractDraft): Contract {
  const isHub = d.isHub ?? false
  const term: ContractTerm = d.term ?? (isHub ? 4 : 2)
  return {
    id: d.id,
    airlineId: d.airlineId,
    isHub,
    homePier: d.homePier,
    seasons: [],
    lines: d.lines,
    services: [...new Set(d.services)],
    sla: { ...(isHub ? HUB_SLA : DEFAULT_SLA), ...d.sla },
    money: { landingPerTonne: 8, perPax: 12, services: {}, ...d.money },
    penalties: { perLateMin: 150, perLostBag: 250, perGrounding: 20_000, ...d.penalties },
    bonuses: d.bonuses ?? [{ onTimeOver: 0.9, amount: 50_000 }],
    earlyCancel: { fee: 100_000 * term, standingHit: 15, favourHit: 10, ...d.earlyCancel },
    status: 'offered',
    termSeasons: term,
  }
}

export function termOf(c: Contract): ContractTerm {
  return c.termSeasons ?? (c.seasons.length === 4 ? 4 : c.seasons.length === 1 ? 1 : 2)
}

/** Validation errors (empty = valid). Never checks capacity — that only warns (see previewOffer). */
export function validateContract(c: Contract, airframes: Record<string, AirframeInfo> = DEFAULT_AIRFRAMES): string[] {
  const errs: string[] = []
  if (!c.lines.length) errs.push('contract has no flight lines')
  const ids = new Set<string>()
  for (const l of c.lines) {
    if (ids.has(l.id)) errs.push(`duplicate line id ${l.id}`)
    ids.add(l.id)
    if (!airframes[l.airframeId]) { errs.push(`${l.id}: unknown airframe ${l.airframeId}`); continue }
    if (!l.days.length) errs.push(`${l.id}: no operating days`)
    if (l.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) errs.push(`${l.id}: days must be 0..6`)
    if (new Set(l.days).size !== l.days.length) errs.push(`${l.id}: duplicate days`)
    const w = l.arrival
    if (w.preferredMin < 0 || w.preferredMin >= 1440) errs.push(`${l.id}: preferred time must be within the day`)
    if (w.softMin < 0 || w.hardMin < w.softMin) errs.push(`${l.id}: need 0 ≤ soft ≤ hard`)
    const mtt = DEFAULT_MTT[airframeInfo(airframes, l.airframeId).sizeClass]
    if (l.turnaroundTargetMin < mtt) errs.push(`${l.id}: turnaround target ${l.turnaroundTargetMin} below MTT ${mtt}`)
    if (l.kind === 'freighter' && c.services.includes('prm')) {
      errs.push(`${l.id}: PRM service on a freighter line`)
    }
  }
  if (c.sla.onTimePct < 0 || c.sla.onTimePct > 1) errs.push('onTimePct must be 0..1')
  if (c.isHub && termOf(c) !== 4) errs.push('hub contracts run 4 seasons')
  return errs
}

/** Weekly flights per line and total (for the offer card). */
export function weeklyFlights(c: Contract): { total: number; byLine: Record<string, number> } {
  const byLine: Record<string, number> = {}
  for (const l of c.lines) byLine[l.id] = l.days.length
  return { total: Object.values(byLine).reduce((a, b) => a + b, 0), byLine }
}

/** De-icing only exists in the Winter annex. */
export function servicesForSeason(c: Contract, season: Season): ServiceKind[] {
  return c.services.filter((s) => s !== 'deice' || season.kind === 'winter')
}

export type SignResult = { ok: true; contract: Contract } | { ok: false; reason: string }

/**
 * Sign an offer starting at `first`. Enforces one hub airline (#20). Capacity is NOT checked — signing over capacity
 * is the player's choice (#8); show previewOffer warnings instead.
 */
export function signContract(offer: Contract, first: Season, existing: Contract[], airframes?: Record<string, AirframeInfo>): SignResult {
  if (offer.status !== 'offered') return { ok: false, reason: `contract is ${offer.status}` }
  const errs = validateContract(offer, airframes)
  if (errs.length) return { ok: false, reason: errs.join('; ') }
  if (offer.isHub && existing.some((c) => c.isHub && c.id !== offer.id && c.airlineId !== offer.airlineId && (c.status === 'active' || c.status === 'expiring'))) {
    return { ok: false, reason: 'another airline already holds the hub contract' }
  }
  const seasons = seasonRun(first, termOf(offer)).map((s) => s.id)
  return { ok: true, contract: { ...offer, seasons, status: seasons.length === 1 ? 'expiring' : 'active' } }
}

/**
 * Season boundary. Call when `ended` finishes: contracts whose term ended become 'ended';
 * those entering their final season become 'expiring' (renewal offer due). Airlines exit only here (#18).
 */
export function advanceSeason(contracts: Contract[], ended: Season, next: Season): Contract[] {
  return contracts.map((c) => {
    if (c.status !== 'active' && c.status !== 'expiring') return c
    const last = c.seasons[c.seasons.length - 1]
    if (last === ended.id) return { ...c, status: 'ended' }
    if (last === next.id) return { ...c, status: 'expiring' }
    return c
  })
}

/** Airline asks to leave: honoured at season end only, by shortening the term to the current season. */
export function airlineRequestsExit(c: Contract, current: Season): Contract {
  if (c.status !== 'active' && c.status !== 'expiring') return c
  const idx = c.seasons.indexOf(current.id)
  if (idx < 0) return c
  return { ...c, seasons: c.seasons.slice(0, idx + 1), status: 'expiring' }
}

/** Renewal offered at season end: new offered contract continuing the same lines. */
export function renewalOffer(c: Contract, newId: string, sweetener = 0): Contract {
  return {
    ...c,
    id: newId,
    seasons: [],
    status: 'offered',
    money: { ...c.money, perPax: c.money.perPax + sweetener },
  }
}

export interface CancelOutcome {
  contract: Contract
  fee: number
  standingDelta: number
  favourDelta: number
}

/** Player early cancel: fee + standing + favour (#17). Uses the diplomacy fee + favour path. */
export function cancelEarly(c: Contract): CancelOutcome | null {
  if (c.status !== 'active' && c.status !== 'expiring') return null
  return {
    contract: { ...c, status: 'cancelled' },
    fee: c.earlyCancel.fee,
    standingDelta: -Math.abs(c.earlyCancel.standingHit),
    favourDelta: -Math.abs(c.earlyCancel.favourHit),
  }
}
