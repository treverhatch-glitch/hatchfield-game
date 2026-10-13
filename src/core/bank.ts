import { SIM_MINUTES_PER_GAME_DAY, type SimMinutes } from './clock'

/** Canonical categories shared by gameplay modules, HUD cash flow, and reports. */
export const MONEY_CATEGORIES = [
  'landing_fees',
  'passenger_fees',
  'baggage_fees',
  'fuel_sales',
  'catering_fees',
  'retail_sales',
  'cargo_fees',
  'landside_fees',
  'parking_fees',
  'host_fees',
  'contract_fees',
  'deposits',
  'maintenance_income',
  'task_rewards',
  'loan_proceeds',
  'ipo_proceeds',
  'share_sales',
  'refunds',
  'construction',
  'contract_signing',
  'deposit_refunds',
  'advertising',
  'payroll',
  'building_upkeep',
  'vehicle_upkeep',
  'fuel_purchase',
  'meal_production',
  'loan_interest',
  'loan_repayment',
  'penalties',
  'city_levy',
  'share_purchases',
  'staff_hiring',
] as const

export type MoneyCategory = (typeof MONEY_CATEGORIES)[number]
export type MoneyDirection = 'income' | 'expense'

const INCOME_CATEGORIES = new Set<MoneyCategory>([
  'landing_fees',
  'passenger_fees',
  'baggage_fees',
  'fuel_sales',
  'catering_fees',
  'retail_sales',
  'cargo_fees',
  'landside_fees',
  'parking_fees',
  'host_fees',
  'contract_fees',
  'deposits',
  'maintenance_income',
  'task_rewards',
  'loan_proceeds',
  'ipo_proceeds',
  'share_sales',
  'refunds',
])

export interface BankPostMeta {
  simMinutes: SimMinutes
  source?: string
  sourceId?: string
  label?: string
  details?: Readonly<Record<string, string | number | boolean | null>>
}

export interface BankEntry {
  id: number
  category: MoneyCategory
  amount: number
  direction: MoneyDirection
  meta: BankPostMeta
  balanceAfter: number
}

export type CategoryTotals = Partial<Record<MoneyCategory, number>>

export interface BankLedger {
  openingBalance: number
  balance: number
  totalIncome: number
  totalExpense: number
  net: number
  byCategory: CategoryTotals
  entries: BankEntry[]
}

export interface BankState {
  openingBalance: number
  entries: BankEntry[]
  nextEntryId: number
}

export type BankListener = (entry: BankEntry, ledger: BankLedger) => void

export function moneyDirection(category: MoneyCategory): MoneyDirection {
  return INCOME_CATEGORIES.has(category) ? 'income' : 'expense'
}

/**
 * Single money bus. Amounts are signed: income is positive and expenses are
 * negative. Direction/category mismatches throw so integrations fail visibly.
 */
export class Bank {
  private readonly openingBalance: number
  private readonly records: BankEntry[] = []
  private readonly listeners: BankListener[] = []
  private nextEntryId = 1
  private currentBalance: number
  private income = 0
  private expense = 0
  private readonly totals: CategoryTotals = {}

  constructor(openingBalance = 0, state?: BankState) {
    this.openingBalance = state?.openingBalance ?? openingBalance
    this.currentBalance = this.openingBalance
    if (state) {
      for (const entry of state.entries) this.restore(entry)
      this.nextEntryId = Math.max(state.nextEntryId, this.nextEntryId)
    }
  }

  get balance(): number {
    return this.currentBalance
  }

  post(category: MoneyCategory, amount: number, meta: BankPostMeta): BankEntry {
    if (!Number.isFinite(amount) || amount === 0) throw new Error('Bank amount must be a finite, non-zero number')
    if (!Number.isFinite(meta.simMinutes) || meta.simMinutes < 0) {
      throw new Error('Bank post requires a non-negative simMinutes timestamp')
    }
    const direction = moneyDirection(category)
    if ((direction === 'income' && amount < 0) || (direction === 'expense' && amount > 0)) {
      throw new Error(`${category} is an ${direction} category but received ${amount}`)
    }
    const entry: BankEntry = {
      id: this.nextEntryId++,
      category,
      amount,
      direction,
      meta: cloneMeta(meta),
      balanceAfter: this.currentBalance + amount,
    }
    this.apply(entry)
    const ledger = this.ledger()
    for (const listener of this.listeners) listener(cloneEntry(entry), ledger)
    return cloneEntry(entry)
  }

  onPost(listener: BankListener): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index >= 0) this.listeners.splice(index, 1)
    }
  }

  ledger(): BankLedger {
    return {
      openingBalance: this.openingBalance,
      balance: this.currentBalance,
      totalIncome: this.income,
      totalExpense: this.expense,
      net: this.income - this.expense,
      byCategory: { ...this.totals },
      entries: this.records.map(cloneEntry),
    }
  }

  entriesBetween(start: SimMinutes, end: SimMinutes): BankEntry[] {
    return this.records
      .filter((entry) => entry.meta.simMinutes >= start && entry.meta.simMinutes < end)
      .map(cloneEntry)
  }

  ledgerForGameDay(gameDay: number): BankLedger {
    const start = Math.max(0, Math.floor(gameDay)) * SIM_MINUTES_PER_GAME_DAY
    return ledgerFromEntries(0, this.entriesBetween(start, start + SIM_MINUTES_PER_GAME_DAY))
  }

  snapshot(): BankState {
    return {
      openingBalance: this.openingBalance,
      entries: this.records.map(cloneEntry),
      nextEntryId: this.nextEntryId,
    }
  }

  private restore(entry: BankEntry): void {
    if (!MONEY_CATEGORIES.includes(entry.category)) throw new Error(`Unknown money category: ${entry.category}`)
    if (entry.id >= this.nextEntryId) this.nextEntryId = entry.id + 1
    this.apply({ ...cloneEntry(entry), balanceAfter: this.currentBalance + entry.amount })
  }

  private apply(entry: BankEntry): void {
    this.currentBalance += entry.amount
    if (entry.amount > 0) this.income += entry.amount
    else this.expense += -entry.amount
    this.totals[entry.category] = (this.totals[entry.category] ?? 0) + entry.amount
    this.records.push({ ...entry, balanceAfter: this.currentBalance })
  }
}

export type FinancialPhase = 'early' | 'midgame'

export const DAILY_PAYROLL_SHARE: Readonly<Record<FinancialPhase, number>> = {
  early: 0.75,
  midgame: 0.575,
}

/** Income-indexed daily payroll target used after the terminal's daily rollover. */
export function payrollForGameDay(
  grossOperatingIncome: number,
  phase: FinancialPhase,
  minimumStaffingCost = 0,
): number {
  const target = Math.max(0, grossOperatingIncome) * DAILY_PAYROLL_SHARE[phase]
  return Math.round(Math.max(target, minimumStaffingCost))
}

/** Replacement for the old six-times-per-day levy. Charge once at day rollover. */
export function cityLevyForGameDay(cash: number, protectedCash = 140_000): number {
  return Math.round(Math.max(0, cash - protectedCash) * 0.005)
}

export function operatingMargin(income: number, expenses: number): number {
  return income > 0 ? (income - Math.max(0, expenses)) / income : 0
}

function cloneMeta(meta: BankPostMeta): BankPostMeta {
  return {
    ...meta,
    details: meta.details ? { ...meta.details } : undefined,
  }
}

function cloneEntry(entry: BankEntry): BankEntry {
  return {
    ...entry,
    meta: cloneMeta(entry.meta),
  }
}

function ledgerFromEntries(openingBalance: number, entries: readonly BankEntry[]): BankLedger {
  const byCategory: CategoryTotals = {}
  let totalIncome = 0
  let totalExpense = 0
  let balance = openingBalance
  for (const entry of entries) {
    balance += entry.amount
    if (entry.amount > 0) totalIncome += entry.amount
    else totalExpense += -entry.amount
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + entry.amount
  }
  return {
    openingBalance,
    balance,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    byCategory,
    entries: entries.map(cloneEntry),
  }
}
