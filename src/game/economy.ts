import { cityLevyForGameDay } from '../core/bank.ts'
import {
  BUDGET_BASE,
  DESK_STAFF_WAGE,
  JANITOR_WAGE,
  MECHANIC_WAGE,
  money,
  RESEARCHER_WAGE,
  START_CASH,
} from './catalog.ts'
import { SANDBOX_CASH } from './types.ts'
import type { BudgetKey, LoanProduct } from './types.ts'

/**
 * Busy fields cost more to run — signed carriers, extra stands, and turn volume
 * scale ops payroll so mid/late game stays a money puzzle (capped).
 */
export function fieldOpsMultiplier(signed: number, stands: number, flightsDone: number): number {
  const s = Number.isFinite(signed) ? signed : 0
  const st = Number.isFinite(stands) ? stands : 0
  const f = Number.isFinite(flightsDone) ? flightsDone : 0
  const load =
    1 +
    Math.max(0, s - 1) * 0.055 +
    Math.max(0, st - 2) * 0.04 +
    Math.min(0.35, Math.max(0, f) * 0.0035)
  return Math.min(1.65, Math.max(1, load))
}

/** Title checkbox. Off names the standard bank instead of a silent "off". */
export function sandboxChoiceLabel(on: boolean): string {
  return on
    ? `Sandbox (unlimited money) · ${money(SANDBOX_CASH)}`
    : `Sandbox (unlimited money) · standard ${money(START_CASH.standard)}`
}

/** Face of a loan button: cash received, the fee, and the balance the desk will show. */
export function loanProductLabel(p: Pick<LoanProduct, 'label' | 'principal' | 'fee'>): string {
  return `${p.label} · ${money(p.principal)} · fee ${money(p.fee)} · owe ${money(p.principal + p.fee)}`
}

const GUARD_LOAN = /host military|military\s*\/\s*guard|guard loan/i

/** One row per id and per label. Host Military/Guard is listed once even if the desk repeats it. */
export function loanDeskRows<T extends { id: string; label: string }>(products: readonly T[]): T[] {
  const seen = new Set<string>()
  let guard = false
  const out: T[] = []
  for (const p of products) {
    if (!p?.id || !p.label) continue
    const label = p.label.trim().toLowerCase()
    if (GUARD_LOAN.test(p.label)) {
      if (guard) continue
      guard = true
    }
    const key = `${p.id}|${label}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

/** Slider caption: the name and the amount the thumb is on. */
export function loanAmountLabel(amount: number): string {
  const n = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0
  return `Loan amount · ${money(n)}`
}

/** Interest due this loan tick: at least the product floor, else ~rate × balance. */
export function loanInterestDue(balance: number, rate: number, floor: number): number {
  const safeBalance = Number.isFinite(balance) && balance > 0 ? balance : 0
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0
  const safeFloor = Number.isFinite(floor) && floor > 0 ? floor : 0
  return Math.max(safeFloor, Math.round(safeBalance * safeRate))
}

/** Unpaid interest shortfall capitalizes, hard-capped at 2.1× the amount opened. */
export function nextLoanBalance(balance: number, short: number, opened: number): number {
  const safeOpened = Number.isFinite(opened) && opened > 0 ? opened : 0
  const safeBalance = Number.isFinite(balance) && balance > 0 ? balance : 0
  const safeShort = Number.isFinite(short) && short > 0 ? short : 0
  return Math.max(0, Math.min(safeOpened * 2.1, safeBalance + safeShort))
}

export function loansAvailable<T extends Pick<LoanProduct, 'minFieldLevel' | 'minRep'>>(
  products: readonly T[],
  fieldLevel: number,
  rep: number,
  sandbox: boolean,
): T[] {
  if (!Array.isArray(products)) return []
  if (sandbox) return products.slice()
  const safeLevel = Number.isFinite(fieldLevel) ? fieldLevel : 0
  const safeRep = Number.isFinite(rep) ? rep : 0
  return products.filter((p) => p && safeLevel >= p.minFieldLevel && safeRep >= p.minRep)
}

/** Staffing floor is billed once per game day (180s), not on the old 30s tick. */
export const PAYROLL_PERIOD = 'day'

export function payrollPreviewLabel(amount: number, formatMoney: (n: number) => string): string {
  return `Payroll ~${formatMoney(amount)} / ${PAYROLL_PERIOD}`
}

export function payrollPreviewTitle(daySeconds: number): string {
  return `Staffing floor, charged once per game day (${daySeconds}s). Cash can still rise between days.`
}

export function payrollAmount(lineCosts: readonly number[], opsMult: number): number {
  if (!Array.isArray(lineCosts)) return 0
  const safeMult = Number.isFinite(opsMult) && opsMult > 0 ? opsMult : 0
  let total = 0
  for (const cost of lineCosts) {
    if (Number.isFinite(cost) && cost > 0) total += cost
  }
  const scaled = total * safeMult
  return Number.isFinite(scaled) && scaled > 0 ? Math.round(scaled) : 0
}

export interface PayrollSettlement {
  due: number
  paid: number
  /**
   * Payroll due minus cash paid. Zero when the bill is covered, including a
   * remainder that would print as $0. Never NaN and never negative.
   */
  shortfall: number
}

/**
 * How much of today's payroll cash can cover.
 * A shortfall entry exists only when the unpaid amount is greater than 0
 * after whole-dollar rounding — a 40¢ gap is not a shortfall row.
 */
export function settlePayroll(due: number, cash: number): PayrollSettlement {
  const bill = Number.isFinite(due) && due > 0 ? due : 0
  const available = Number.isFinite(cash) && cash > 0 ? cash : 0
  const paid = Math.min(bill, available)
  const unpaid = bill - paid
  const shortfall = Number.isFinite(unpaid) && unpaid > 0 && Math.round(unpaid) > 0 ? unpaid : 0
  return { due: bill, paid, shortfall }
}

/** City levy starts on cash above this. Opening banks (easy and standard, after land) sit under it. */
export const CITY_LEVY_FLOOR = 140_000
/** Share of the surplus taken once per game day, after that day's payroll. */
export const CITY_LEVY_RATE = 0.005

/**
 * Soft prosperity levy. Half a percent of cash above the floor, once per game day.
 * Sandbox is exempt: a trial pile is not a city that owes the levy.
 */
export function cityLevy(cash: number, sandbox = false): number {
  if (sandbox || !Number.isFinite(cash) || cash <= CITY_LEVY_FLOOR) return 0
  return cityLevyForGameDay(cash, CITY_LEVY_FLOOR)
}

/** Counts the sim already has — pure so payroll math can be tested without a field. */
export type BudgetLineInput = {
  key: BudgetKey
  /** Slider 0–100, same as Game.budgets. */
  budgetPct: number
  mechanics: number
  hangars: number
  researchers: number
  desks: number
  boards: number
  machines: number
  /** Police tiles plus hall security rooms. */
  securityPosts: number
  deskStaff: number
  /** Bathroom + food rooms. */
  cleanRooms: number
  janitors: number
  fireStations: number
  signed: number
  helipads: number
}

export function budgetLineCost(input: BudgetLineInput): number {
  const pct = Math.max(0, Number.isFinite(input.budgetPct) ? input.budgetPct : 0) / 100
  const mechanics = Math.max(0, Number.isFinite(input.mechanics) ? input.mechanics : 0)
  const hangars = Math.max(0, Number.isFinite(input.hangars) ? input.hangars : 0)
  const researchers = Math.max(0, Number.isFinite(input.researchers) ? input.researchers : 0)
  const desks = Math.max(0, Number.isFinite(input.desks) ? input.desks : 0)
  const boards = Math.max(0, Number.isFinite(input.boards) ? input.boards : 0)
  const machines = Math.max(0, Number.isFinite(input.machines) ? input.machines : 0)
  const securityPosts = Math.max(0, Number.isFinite(input.securityPosts) ? input.securityPosts : 0)
  const deskStaff = Math.max(0, Number.isFinite(input.deskStaff) ? input.deskStaff : 0)
  const cleanRooms = Math.max(0, Number.isFinite(input.cleanRooms) ? input.cleanRooms : 0)
  const janitors = Math.max(0, Number.isFinite(input.janitors) ? input.janitors : 0)
  const fireStations = Math.max(0, Number.isFinite(input.fireStations) ? input.fireStations : 0)
  const signed = Math.max(0, Number.isFinite(input.signed) ? input.signed : 0)
  const helipads = Math.max(0, Number.isFinite(input.helipads) ? input.helipads : 0)

  let base = (BUDGET_BASE[input.key] ?? 0) * pct
  if (input.key === 'maintenance') {
    base += mechanics * MECHANIC_WAGE * pct
    // Hangar on field adds a shop overhead even at low slider (tools still cost).
    if (hangars) base += 90 * Math.max(0.25, pct)
    // Lab staff wages ride the MX slider — empty labs still cost if hired.
    base += researchers * RESEARCHER_WAGE * Math.max(0.35, pct)
    base += (desks * 40 + boards * 25 + machines * 70) * Math.max(0.2, pct)
  }
  if (input.key === 'security') {
    base *= 1 + securityPosts * 0.12
    base += deskStaff * DESK_STAFF_WAGE * Math.max(0.4, pct)
  }
  if (input.key === 'cleaning') {
    base *= 1 + cleanRooms * 0.08
    base += janitors * JANITOR_WAGE * pct
  }
  if (input.key === 'fire') {
    const stations = Math.max(1, fireStations)
    base *= stations
    if (!fireStations) base *= 0.35 // skeleton ARFF desk
  }
  if (input.key === 'ambulance') {
    if (!signed && !helipads) base *= 0.4
  }
  return Number.isFinite(base) && base > 0 ? base : 0
}
