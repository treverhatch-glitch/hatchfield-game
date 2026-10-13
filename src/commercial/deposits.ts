import { cash, finite, nonNegative } from './num.ts'

/**
 * Cash held at signing, as a share of list-price season revenue.
 * Big 15% buys 10% lower fees. Standard 5% leaves fees alone.
 * Small or none adds 15% to service fees.
 * The hold is refunded at term end and forfeited if the airline cancels early.
 */

export type DepositTier = 'big' | 'standard' | 'small' | 'none'

export const DEPOSIT_RATE: Record<DepositTier, number> = {
  big: 0.15,
  standard: 0.05,
  small: 0,
  none: 0,
}

/** Landing and passenger fee multiplier before any separate discount. */
export function landingFeeMultiplier(tier: DepositTier): number {
  return tier === 'big' ? 0.9 : 1
}

/** Service-fee multiplier before any separate discount. */
export function serviceFeeMultiplier(tier: DepositTier): number {
  if (tier === 'big') return 0.9
  if (tier === 'small' || tier === 'none') return 1.15
  return 1
}

export type DepositStatus = 'held' | 'refunded' | 'forfeited' | 'none'

export interface DepositAccount {
  contractId: string
  tier: DepositTier
  /** Cash still held. Zero after refund, forfeit, or a none/small tier. */
  held: number
  status: DepositStatus
}

export type DepositLedgerKind = 'deposit_in' | 'deposit_out' | 'deposit_forfeit'

export interface DepositLedgerEntry {
  day: number
  kind: DepositLedgerKind
  /** Signed cash movement. In is positive, refund is negative, forfeit is 0. */
  amount: number
  /** Cash kept on an airline early cancel. Zero otherwise. */
  retained: number
  contractId: string
  memo: string
}

function entry(
  day: number,
  kind: DepositLedgerKind,
  amount: number,
  retained: number,
  contractId: string,
  memo: string,
): DepositLedgerEntry {
  return {
    day: finite(day),
    kind,
    amount: cash(amount),
    retained: cash(retained),
    contractId,
    memo,
  }
}

export function depositAmount(tier: DepositTier, seasonRevenue: number): number {
  const revenue = nonNegative(seasonRevenue)
  return cash(revenue * DEPOSIT_RATE[tier])
}

/** Take the deposit at signing. Amount is always a finite integer. */
export function collectDeposit(input: {
  contractId: string
  tier: DepositTier
  seasonRevenue: number
  day: number
}): { account: DepositAccount; entry: DepositLedgerEntry } {
  const held = depositAmount(input.tier, input.seasonRevenue)
  const status: DepositStatus = input.tier === 'none' ? 'none' : 'held'
  const account: DepositAccount = {
    contractId: input.contractId,
    tier: input.tier,
    held: status === 'none' ? 0 : held,
    status,
  }
  return {
    account,
    entry: entry(
      input.day,
      'deposit_in',
      account.held,
      0,
      input.contractId,
      `${input.tier} deposit`,
    ),
  }
}

/** Term end: pay the hold back. A second call does not pay twice. */
export function refundDeposit(account: DepositAccount, day: number): { account: DepositAccount; entry: DepositLedgerEntry } {
  if (account.status !== 'held') {
    return {
      account,
      entry: entry(day, 'deposit_out', 0, 0, account.contractId, 'no deposit to refund'),
    }
  }
  const out = nonNegative(account.held)
  return {
    account: { ...account, held: 0, status: 'refunded' },
    entry: entry(day, 'deposit_out', -out, 0, account.contractId, 'deposit refunded at term end'),
  }
}

/** Airline walks early: the hold stays with the airport. No refund entry. */
export function forfeitDeposit(account: DepositAccount, day: number): { account: DepositAccount; entry: DepositLedgerEntry } {
  if (account.status !== 'held') {
    return {
      account,
      entry: entry(day, 'deposit_forfeit', 0, 0, account.contractId, 'no deposit to forfeit'),
    }
  }
  const retained = nonNegative(account.held)
  return {
    account: { ...account, held: 0, status: 'forfeited' },
    entry: entry(
      day,
      'deposit_forfeit',
      0,
      retained,
      account.contractId,
      'airline early cancel — deposit forfeited',
    ),
  }
}
