import {
  BUDGET_BASE,
  DESK_STAFF_WAGE,
  JANITOR_WAGE,
  MECHANIC_WAGE,
  RESEARCHER_WAGE,
} from './catalog.ts'
import type { BudgetKey, LoanProduct } from './types.ts'

/**
 * Busy fields cost more to run — signed carriers, extra stands, and turn volume
 * scale ops payroll so mid/late game stays a money puzzle (capped).
 */
export function fieldOpsMultiplier(signed: number, stands: number, flightsDone: number): number {
  const load =
    1 +
    Math.max(0, signed - 1) * 0.055 +
    Math.max(0, stands - 2) * 0.04 +
    Math.min(0.35, flightsDone * 0.0035)
  return Math.min(1.65, load)
}

/** Interest due this loan tick: at least the product floor, else ~rate × balance. */
export function loanInterestDue(balance: number, rate: number, floor: number): number {
  return Math.max(floor, Math.round(balance * rate))
}

/** Unpaid interest shortfall capitalizes, hard-capped at 2.1× the amount opened. */
export function nextLoanBalance(balance: number, short: number, opened: number): number {
  return Math.min(opened * 2.1, balance + short)
}

export function loansAvailable<T extends Pick<LoanProduct, 'minFieldLevel' | 'minRep'>>(
  products: readonly T[],
  fieldLevel: number,
  rep: number,
  sandbox: boolean,
): T[] {
  if (sandbox) return products.slice()
  return products.filter((p) => fieldLevel >= p.minFieldLevel && rep >= p.minRep)
}

export function payrollAmount(lineCosts: readonly number[], opsMult: number): number {
  let total = 0
  for (const cost of lineCosts) total += cost
  return Math.round(total * opsMult)
}

/** City levy starts on cash above this. Opening banks (easy and standard, after land) sit under it. */
export const CITY_LEVY_FLOOR = 140_000
/** Share of the surplus taken once per sim day. Payroll itself still ticks every 30 sim-seconds. */
export const CITY_LEVY_RATE = 0.03

/**
 * Soft prosperity levy. Three percent of cash above the floor, after payroll.
 * Sandbox is exempt: a $9,999,999 trial pile would otherwise lose about $293k a tick.
 */
export function cityLevy(cash: number, sandbox = false): number {
  if (sandbox || cash <= CITY_LEVY_FLOOR) return 0
  return Math.round((cash - CITY_LEVY_FLOOR) * CITY_LEVY_RATE)
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
  const pct = input.budgetPct / 100
  let base = BUDGET_BASE[input.key] * pct
  if (input.key === 'maintenance') {
    base += input.mechanics * MECHANIC_WAGE * pct
    // Hangar on field adds a shop overhead even at low slider (tools still cost).
    if (input.hangars) base += 90 * Math.max(0.25, pct)
    // Lab staff wages ride the MX slider — empty labs still cost if hired.
    base += input.researchers * RESEARCHER_WAGE * Math.max(0.35, pct)
    base += (input.desks * 40 + input.boards * 25 + input.machines * 70) * Math.max(0.2, pct)
  }
  if (input.key === 'security') {
    base *= 1 + input.securityPosts * 0.12
    base += input.deskStaff * DESK_STAFF_WAGE * Math.max(0.4, pct)
  }
  if (input.key === 'cleaning') {
    base *= 1 + input.cleanRooms * 0.08
    base += input.janitors * JANITOR_WAGE * pct
  }
  if (input.key === 'fire') {
    const stations = Math.max(1, input.fireStations)
    base *= stations
    if (!input.fireStations) base *= 0.35 // skeleton ARFF desk
  }
  if (input.key === 'ambulance') {
    if (!input.signed && !input.helipads) base *= 0.4
  }
  return base
}
