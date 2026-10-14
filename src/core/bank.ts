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
  'diplomacy_income',
  'contract_fees',
  'deposits',
  'maintenance_income',
  'task_rewards',
  'level_reward',
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
  'land_holding',
  'vehicle_upkeep',
  'fuel_purchase',
  'meal_production',
  'retail_cogs',
  'loan_interest',
  'loan_repayment',
  'penalties',
  'diplomacy',
  'legal',
  'security_shock',
  'task_miss',
  'emergency_refuse',
  'inbound_fine',
  'missed_connection',
  'cargo_miss',
  'crash_fine',
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
  'diplomacy_income',
  'contract_fees',
  'deposits',
  'maintenance_income',
  'task_rewards',
  'level_reward',
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
  /**
   * The bill was not taken from cash. The line stays on the journal for the
   * finance panel and does not move the balance, income, expense, or category totals.
   */
  unpaid?: boolean
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

  /**
   * Add `amount` onto the newest same-category line in this game day.
   * The balance and the category total move with that line. Returns false
   * when this day has no line yet, so the caller posts a new one.
   * Hall food and shop sales use this: one line per day, not one per burger.
   */
  addToLatest(category: MoneyCategory, amount: number, simMinutes: number): boolean {
    if (!Number.isFinite(amount) || amount === 0) return false
    if (!Number.isFinite(simMinutes) || simMinutes < 0) return false
    const direction = moneyDirection(category)
    if ((direction === 'income' && amount < 0) || (direction === 'expense' && amount > 0)) return false
    const dayStart = Math.floor(simMinutes / SIM_MINUTES_PER_GAME_DAY) * SIM_MINUTES_PER_GAME_DAY
    for (let i = this.records.length - 1; i >= 0; i--) {
      const entry = this.records[i]
      if (entry.meta.simMinutes < dayStart) return false
      if (entry.category !== category) continue
      entry.amount += amount
      this.currentBalance += amount
      if (amount > 0) this.income += amount
      else this.expense += -amount
      this.totals[category] = (this.totals[category] ?? 0) + amount
      for (let j = i; j < this.records.length; j++) this.records[j].balanceAfter += amount
      return true
    }
    return false
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
    const unpaid = meta.unpaid === true
    const entry: BankEntry = {
      id: this.nextEntryId++,
      category,
      amount,
      direction,
      meta: cloneMeta(meta),
      balanceAfter: this.currentBalance,
    }
    if (unpaid) this.records.push(entry)
    else this.apply(entry)
    if (this.listeners.length > 0) {
      const ledger = this.ledger()
      for (const listener of this.listeners) listener(cloneEntry(entry), ledger)
    }
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

  /**
   * Forget journal lines older than `simMinutes`. Category totals and the
   * balance stay, so year cards and the HUD still add up. Callers keep the
   * window that year-close and tycoon catch-up still read.
   */
  retainFrom(simMinutes: number): number {
    if (!Number.isFinite(simMinutes) || simMinutes <= 0) return 0
    const index = this.records.findIndex((entry) => entry.meta.simMinutes >= simMinutes)
    const drop = index < 0 ? this.records.length : index
    if (drop > 0) this.records.splice(0, drop)
    return drop
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
    const cloned = cloneEntry(entry)
    if (cloned.meta.unpaid) {
      this.records.push({ ...cloned, balanceAfter: this.currentBalance })
      return
    }
    this.apply({ ...cloned, balanceAfter: this.currentBalance + entry.amount })
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
  early: 0.45,
  midgame: 0.4,
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
    if (entry.meta.unpaid) continue
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
