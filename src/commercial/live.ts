import type { MoneyCategory } from '../core/bank.ts'
import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import { seasonOfDay } from '../contracts/seasons.ts'
import {
  type DepositLedgerEntry,
  type DepositStatus,
  type DepositTier,
  collectDeposit,
  forfeitDeposit,
  landingFeeMultiplier,
  refundDeposit,
  serviceFeeMultiplier,
} from './deposits.ts'
import {
  type FeeSchedule,
  DEFAULT_FEE_SCHEDULE,
  scheduleElasticity,
} from './fees.ts'
import { type CarrierRole, earliestFlightDay, resolveLead } from './lead.ts'
import { cash } from './num.ts'

/** One game day on the field clock. Matches the sim's 180-second day. */
export const SIM_SECONDS_PER_GAME_DAY = REAL_SECONDS_PER_GAME_DAY

export const DEPOSIT_IN_CATEGORY = 'deposits' as const satisfies MoneyCategory
export const DEPOSIT_OUT_CATEGORY = 'deposit_refunds' as const satisfies MoneyCategory

const TIERS: readonly DepositTier[] = ['big', 'standard', 'small', 'none']
const STATUSES: readonly DepositStatus[] = ['held', 'refunded', 'forfeited', 'none']

export interface AirlineLead {
  signDay: number
  leadDays: number
  /** The first flight has been released. Later banks are not held again. */
  opened: boolean
}

export interface HeldDeposit {
  contractId: string
  tier: DepositTier
  held: number
  status: DepositStatus
  /** Refund when this game day closes. */
  termEndDay: number
}

export interface CashPost {
  category: MoneyCategory
  /** Signed ledger amount. Income is positive, a refund is negative. */
  amount: number
  label: string
}

export function clockDay(clock: number): number {
  return Math.floor(Math.max(0, Number.isFinite(clock) ? clock : 0) / SIM_SECONDS_PER_GAME_DAY)
}

/** Commuter through T2, flag from T4, hub when the plaque is up. */
export function roleForAirline(tier: number, hub: boolean): CarrierRole {
  if (hub) return 'hub'
  if (tier <= 2) return 'commuter'
  if (tier >= 4) return 'flag'
  return 'default'
}

export function openLead(input: {
  clock: number
  starter: boolean
  tier: number
  hub: boolean
}): AirlineLead {
  return {
    signDay: clockDay(input.clock),
    leadDays: resolveLead({
      starter: input.starter,
      role: roleForAirline(input.tier, input.hub),
    }),
    opened: false,
  }
}

/** Sim-clock of the first legal flight. Day 0 with a starter lead is immediate. */
export function firstFlightClock(lead: AirlineLead): number {
  return earliestFlightDay(lead.signDay, lead.leadDays) * SIM_SECONDS_PER_GAME_DAY
}

/**
 * Scale a live catalog charge by the player's fee versus the published default.
 * At the default schedule the charge is unchanged.
 */
export function scaleListed(amount: number, actual: number, baseline: number): number {
  if (!(amount > 0) || !Number.isFinite(amount)) return 0
  const base = baseline > 0 && Number.isFinite(baseline) ? baseline : 1
  const value = Number.isFinite(actual) ? Math.max(0, actual) : base
  return Math.round(amount * (value / base))
}

export function landingCharge(amount: number, tier: DepositTier, walkIn: boolean): number {
  const scaled = Math.round(amount)
  if (!(scaled > 0)) return 0
  if (walkIn) return scaled
  return Math.round(scaled * landingFeeMultiplier(tier))
}

export function serviceCharge(amount: number, tier: DepositTier, walkIn: boolean): number {
  const scaled = Math.round(amount)
  if (!(scaled > 0)) return 0
  if (walkIn) return scaled
  return Math.round(scaled * serviceFeeMultiplier(tier))
}

export function walkInDemandOf(fees: FeeSchedule): number {
  return scheduleElasticity(fees).demand
}

export function standingForFees(fees: FeeSchedule): number {
  return scheduleElasticity(fees).standingDelta
}

/** Probability an idle stand draws a walk-in parking ask. 0.45 at default prices. */
export function walkInOfferChance(fees: FeeSchedule, base = 0.45): number {
  const demand = walkInDemandOf(fees)
  const chance = base * (Number.isFinite(demand) ? demand : 1)
  return Math.min(0.92, Math.max(0.05, chance))
}

/** Cool-down between walk-in visits. Higher demand shortens the wait. */
export function demandInterval(seconds: number, fees: FeeSchedule): number {
  if (!(seconds > 0) || !Number.isFinite(seconds)) return 0
  const demand = Math.max(0.2, walkInDemandOf(fees))
  return seconds / demand
}

export function daysLeftInSeason(day: number): { days: number; endDay: number } {
  const safe = Math.floor(Number.isFinite(day) ? day : 0)
  const season = seasonOfDay(safe)
  const from = Math.max(safe, season.startDay)
  return { days: Math.max(1, season.endDay - from + 1), endDay: season.endDay }
}

/**
 * One landing-fee turn per remaining season day.
 * The deposit is a share of that list-price season revenue.
 */
export function signDeposit(input: {
  airlineId: string
  tier: DepositTier
  landingFee: number
  day: number
}): { account: HeldDeposit; entry: DepositLedgerEntry } {
  const span = daysLeftInSeason(input.day)
  const seasonRevenue = cash(Math.max(0, input.landingFee) * span.days)
  const taken = collectDeposit({
    contractId: input.airlineId,
    tier: input.tier,
    seasonRevenue,
    day: input.day,
  })
  return {
    account: { ...taken.account, termEndDay: span.endDay },
    entry: taken.entry,
  }
}

/** Bank line for a deposit movement. A forfeit keeps the cash and posts nothing. */
export function depositCashPost(entry: DepositLedgerEntry): CashPost | null {
  if (entry.kind === 'deposit_in' && entry.amount > 0) {
    return { category: DEPOSIT_IN_CATEGORY, amount: entry.amount, label: entry.memo }
  }
  if (entry.kind === 'deposit_out' && entry.amount < 0) {
    return { category: DEPOSIT_OUT_CATEGORY, amount: entry.amount, label: entry.memo }
  }
  return null
}

export function settleHeld(
  account: HeldDeposit,
  day: number,
): { account: HeldDeposit; entry: DepositLedgerEntry } | null {
  if (account.status !== 'held' || day < account.termEndDay) return null
  const back = refundDeposit(account, day)
  return { account: { ...back.account, termEndDay: account.termEndDay }, entry: back.entry }
}

export function forfeitHeld(
  account: HeldDeposit,
  day: number,
): { account: HeldDeposit; entry: DepositLedgerEntry } {
  const kept = forfeitDeposit(account, day)
  return { account: { ...kept.account, termEndDay: account.termEndDay }, entry: kept.entry }
}

export function restoreFees(raw: { [key: string]: number | undefined } | undefined): FeeSchedule {
  const next: FeeSchedule = { ...DEFAULT_FEE_SCHEDULE }
  if (!raw) return next
  for (const key of Object.keys(DEFAULT_FEE_SCHEDULE) as (keyof FeeSchedule)[]) {
    const value = raw[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) next[key] = value
  }
  return next
}

export function restoreTier(raw: unknown): DepositTier {
  return TIERS.includes(raw as DepositTier) ? (raw as DepositTier) : 'standard'
}

export function restoreDeposits(raw: Record<string, Partial<HeldDeposit>> | undefined): Record<string, HeldDeposit> {
  const out: Record<string, HeldDeposit> = {}
  if (!raw) return out
  for (const [id, row] of Object.entries(raw)) {
    if (!row || typeof row.held !== 'number' || !Number.isFinite(row.held)) continue
    const status = STATUSES.includes(row.status as DepositStatus) ? (row.status as DepositStatus) : 'held'
    out[id] = {
      contractId: typeof row.contractId === 'string' ? row.contractId : id,
      tier: restoreTier(row.tier),
      held: Math.max(0, Math.round(row.held)),
      status,
      termEndDay: typeof row.termEndDay === 'number' && Number.isFinite(row.termEndDay) ? row.termEndDay : 0,
    }
  }
  return out
}

export function restoreLeads(raw: Record<string, Partial<AirlineLead>> | undefined): Record<string, AirlineLead> {
  const out: Record<string, AirlineLead> = {}
  if (!raw) return out
  for (const [id, row] of Object.entries(raw)) {
    if (!row || typeof row.leadDays !== 'number' || !Number.isFinite(row.leadDays)) continue
    out[id] = {
      signDay: typeof row.signDay === 'number' && Number.isFinite(row.signDay) ? row.signDay : 0,
      leadDays: Math.max(0, Math.round(row.leadDays)),
      opened: Boolean(row.opened),
    }
  }
  return out
}
