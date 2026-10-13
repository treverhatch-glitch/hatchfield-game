/**
 * Guard contracts on the airline-contract model (#19):
 * lines, weekly sorties, sign / early-cancel, season status.
 * Night lines (arrival at or after 16:00) cost noise and city approval
 * and do not fly without a security-clearance licence.
 * Signing is never blocked by apron capacity. A missing apron misses the
 * sortie and pays the penalty; it does not leave an aircraft parked.
 */
import { DEFAULT_AIRFRAMES } from '../contracts/airframes.ts'
import {
  advanceSeason,
  cancelEarly,
  clampStanding,
  makeOffer,
  signContract,
  validateContract,
  weeklyFlights,
} from '../contracts/contracts.ts'
import { seasonOfDay } from '../contracts/seasons.ts'
import type { Contract } from '../contracts/types.ts'
import {
  APPROVAL_PER_NIGHT,
  CLEARANCE_LICENCE_COST,
  MILITARY_AIRFRAMES,
  MILITARY_TEMPLATES,
  NIGHT_START_MIN,
  NOISE_BREACH_AT,
  NOISE_BREACH_FINE,
  NOISE_PER_NIGHT,
  GUARD_STANDING_CLEAN_WEEK,
  GUARD_STANDING_PER_MISS,
  militaryTemplate,
} from './data.ts'
import {
  MIL_AGREE_COST,
  MIL_EARLY_CANCEL_FEE,
  MIL_LANDING,
  MIL_WEEKLY_RETAINER,
  MISSED_SORTIE_PENALTY,
  SIM_DAY_SEC,
} from './fees.ts'
import { pickWeighted } from './rng.ts'
import type { InboundEvent, InboundState, InboundWorld, LedgerEntry, MilitaryDeal } from './types.ts'
import { freePads } from './services.ts'

export const GUARD_AIRLINE = 'guard'

const AIRFRAMES = { ...DEFAULT_AIRFRAMES, ...MILITARY_AIRFRAMES }

export function nightSorties(contract: Contract): number {
  let n = 0
  for (const line of contract.lines) {
    if (line.arrival.preferredMin >= NIGHT_START_MIN) n += line.days.length
  }
  return n
}

export function daySorties(contract: Contract): number {
  return weeklyFlights(contract).total - nightSorties(contract)
}

function pushLedger(state: InboundState, entry: Omit<LedgerEntry, 'day'> & { day?: number }): LedgerEntry {
  const row: LedgerEntry = { day: entry.day ?? dayOf(state), ...entry }
  state.ledger.push(row)
  return row
}

function dayOf(state: InboundState): number {
  return Math.floor(state.clock / SIM_DAY_SEC)
}

function nextId(state: InboundState, prefix: string): string {
  const id = `${prefix}-${state.nextId}`
  state.nextId += 1
  return id
}

export type LicenceResult = { ok: true; cost: number } | { ok: false; reason: string }

export function signGuardAgreement(state: InboundState): LicenceResult {
  if (state.licence.guardAgreement) return { ok: false, reason: 'guard agreement already signed' }
  state.licence.guardAgreement = true
  pushLedger(state, { amount: -MIL_AGREE_COST, reason: 'Guard transit agreement' })
  return { ok: true, cost: MIL_AGREE_COST }
}

export function buyClearance(state: InboundState): LicenceResult {
  if (state.licence.clearance) return { ok: false, reason: 'clearance already held' }
  state.licence.clearance = true
  pushLedger(state, { amount: -CLEARANCE_LICENCE_COST, reason: 'Security clearance licence' })
  return { ok: true, cost: CLEARANCE_LICENCE_COST }
}

export type OfferResult = { ok: true; deal: MilitaryDeal } | { ok: false; reason: string }

export function offerMilitaryContract(state: InboundState, templateId?: string): OfferResult {
  if (!state.licence.guardAgreement) return { ok: false, reason: 'guard agreement required' }
  const template = templateId
    ? militaryTemplate(templateId)
    : pickWeighted(state, MILITARY_TEMPLATES, () => 1)
  if (!template) return { ok: false, reason: 'no military template' }
  const contract = makeOffer({
    id: nextId(state, 'mil'),
    airlineId: GUARD_AIRLINE,
    lines: template.lines.map((line) => ({ ...line, arrival: { ...line.arrival }, days: [...line.days] })),
    services: [...template.services],
    term: template.term,
    money: { landingPerTonne: Math.round(MIL_LANDING / 100), perPax: 0 },
    penalties: { perGrounding: MISSED_SORTIE_PENALTY },
    bonuses: [],
    earlyCancel: { fee: MIL_EARLY_CANCEL_FEE, standingHit: 10, favourHit: 5 },
  })
  const errors = validateContract(contract, AIRFRAMES)
  if (errors.length) return { ok: false, reason: errors.join('; ') }
  const deal: MilitaryDeal = {
    templateId: template.id,
    noisePerNight: NOISE_PER_NIGHT,
    approvalPerNight: APPROVAL_PER_NIGHT,
    contract,
  }
  state.deals.push(deal)
  return { ok: true, deal }
}

export type SignResult = { ok: true; contractId: string } | { ok: false; reason: string }

/** Capacity is not checked. A bare field may sign and then miss the sorties. */
export function signMilitaryContract(state: InboundState, contractId: string): SignResult {
  const deal = state.deals.find((d) => d.contract.id === contractId)
  if (!deal) return { ok: false, reason: 'no such offer' }
  if (!state.licence.guardAgreement) return { ok: false, reason: 'guard agreement required' }
  const existing = state.deals.map((d) => d.contract)
  const signed = signContract(deal.contract, seasonOfDay(dayOf(state)), existing, AIRFRAMES)
  if (!signed.ok) return signed
  deal.contract = signed.contract
  return { ok: true, contractId }
}

export type CancelResult =
  | { ok: true; fee: number; standingDelta: number; favourDelta: number }
  | { ok: false; reason: string }

export function cancelMilitaryContract(state: InboundState, contractId: string): CancelResult {
  const deal = state.deals.find((d) => d.contract.id === contractId)
  if (!deal) return { ok: false, reason: 'no such contract' }
  const outcome = cancelEarly(deal.contract)
  if (!outcome) return { ok: false, reason: `contract is ${deal.contract.status}` }
  deal.contract = outcome.contract
  state.guardStanding = clampStanding(state.guardStanding + outcome.standingDelta)
  state.favour += outcome.favourDelta
  pushLedger(state, {
    amount: -outcome.fee,
    reason: 'Guard contract cancelled early',
    contractId,
  })
  return { ok: true, fee: outcome.fee, standingDelta: outcome.standingDelta, favourDelta: outcome.favourDelta }
}

export function advanceMilitarySeasons(state: InboundState, day: number): void {
  if (day <= 0) return
  const prev = seasonOfDay(day - 1)
  const next = seasonOfDay(day)
  if (prev.id === next.id) return
  const updated = advanceSeason(
    state.deals.map((d) => d.contract),
    prev,
    next,
  )
  state.deals = state.deals.map((deal, i) => ({ ...deal, contract: updated[i] ?? deal.contract }))
}

function live(deal: MilitaryDeal): boolean {
  return deal.contract.status === 'active' || deal.contract.status === 'expiring'
}

/**
 * One week of sorties for every live Guard contract.
 * Flown sorties pay MIL_LANDING. Missed sorties pay the penalty and park nothing.
 */
export function auditMilitaryWeek(state: InboundState, world: InboundWorld): InboundEvent[] {
  const events: InboundEvent[] = []
  const apron = freePads(state, world.capabilities, 'guard') > 0
  for (const deal of state.deals) {
    if (!live(deal)) continue
    const night = nightSorties(deal.contract)
    const day = daySorties(deal.contract)
    let flown = 0
    let missed = 0
    let nightFlown = 0
    if (!apron) {
      missed = day + night
    } else {
      flown += day
      if (state.licence.clearance) {
        flown += night
        nightFlown = night
      } else {
        missed += night
      }
    }
    const pay = flown * MIL_LANDING + (flown > 0 ? MIL_WEEKLY_RETAINER : 0)
    const penalty = missed * MISSED_SORTIE_PENALTY
    const noise = nightFlown * deal.noisePerNight
    const approvalDelta = -(nightFlown * deal.approvalPerNight)
    state.noise += noise
    state.cityApproval = Math.max(0, Math.min(100, state.cityApproval + approvalDelta))
    const breach = nightFlown > 0 && state.cityApproval < NOISE_BREACH_AT
    if (pay) pushLedger(state, { amount: pay, reason: 'Guard sorties', contractId: deal.contract.id })
    if (penalty) {
      pushLedger(state, { amount: -penalty, reason: 'Missed Guard sortie', contractId: deal.contract.id })
    }
    if (breach) {
      pushLedger(state, { amount: -NOISE_BREACH_FINE, reason: 'Night-circuit noise breach', contractId: deal.contract.id })
    }
    state.stats.sortiesFlown += flown
    state.stats.sortiesMissed += missed
    state.guardStanding = clampStanding(
      state.guardStanding + (missed === 0 ? GUARD_STANDING_CLEAN_WEEK : missed * GUARD_STANDING_PER_MISS),
    )
    events.push({
      type: 'week_audit',
      contractId: deal.contract.id,
      flown,
      missed,
      pay,
      penalty,
      noise,
      approvalDelta,
      breach,
    })
  }
  return events
}
