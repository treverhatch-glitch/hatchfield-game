import { BUDGET_LABEL } from '../game/catalog'
import type { Game } from '../game/sim'
import type { BudgetKey } from '../game/types'
import { categoryForEarnLabel } from './bankAdapter'
import {
  cashSignature,
  readFlow,
  type CashFlowView,
  type CashPost,
  type CashSnapshot,
  type FlowCache,
} from './cashFlow'

const STAFF_KEYS: BudgetKey[] = ['maintenance', 'security', 'cleaning', 'fire', 'ambulance']

const flowCache = new WeakMap<Game, FlowCache>()

/** Public sim fields only. Derived cash-flow lives in the UI layer. */
export function readCashSnapshot(game: Game): CashSnapshot {
  const mult = game.fieldOpsMult()
  return {
    cash: game.cash,
    sandbox: game.sandbox,
    revenue: game.revenue,
    hourIncome: game.hourIncome,
    hourExpense: game.hourExpense,
    econHour: game.econHour,
    incomePerHour: game.incomePerHour,
    econHist: game.econHist.map((row) => ({ income: row.income, expense: row.expense })),
    payrollCool: game.payrollCool,
    clock: game.clock,
    payrollPerTick: game.payrollPreview(),
    upkeepPerTick: game.landsideUpkeep(),
    staffLines: STAFF_KEYS.map((key) => ({
      label: BUDGET_LABEL[key],
      perTick: game.lineCost(key) * mult,
    })),
    payments: paymentPosts(game),
    ground: {
      fuelSales: game.groundBooks.fuelSales,
      cateringFees: game.groundBooks.cateringFees,
      fuelPurchase: game.groundBooks.fuelPurchase,
      mealProduction: game.groundBooks.mealProduction,
      vehicleUpkeep: game.groundBooks.vehicleUpkeep,
    },
  }
}

/** Ledger lines and settled payments, keyed so a departure does not count twice. */
function paymentPosts(game: Game): CashPost[] {
  const lines: { label: string; amount: number }[] = []
  for (const flight of game.flights) {
    for (const line of flight.ledger) {
      if (line.amount > 0) lines.push(line)
    }
  }
  for (const line of game.settledPayments) {
    if (line.amount > 0) lines.push({ label: line.label, amount: line.amount })
  }
  lines.sort((a, b) => a.label.localeCompare(b.label) || a.amount - b.amount)
  const counts = new Map<string, number>()
  return lines.map((line) => {
    const category = categoryForEarnLabel(line.label)
    const base = `${category}|${line.label}|${line.amount}`
    const n = (counts.get(base) ?? 0) + 1
    counts.set(base, n)
    return { key: `${base}#${n}`, category, amount: line.amount }
  })
}

export function selectCashFlow(game: Game, now = Date.now()): CashFlowView {
  const snap = readCashSnapshot(game)
  const next = readFlow(flowCache.get(game) ?? null, snap, cashSignature(snap), now)
  flowCache.set(game, next)
  return next.view
}
