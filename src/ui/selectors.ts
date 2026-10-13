import { BUDGET_LABEL } from '../game/catalog'
import type { Game } from '../game/sim'
import type { BudgetKey } from '../game/types'
import {
  cashSignature,
  readFlow,
  type CashFlowView,
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
    news: game.news.map((item) => ({ id: item.id, text: item.text })),
  }
}

export function selectCashFlow(game: Game, now = Date.now()): CashFlowView {
  const snap = readCashSnapshot(game)
  const next = readFlow(flowCache.get(game) ?? null, snap, cashSignature(snap), now)
  flowCache.set(game, next)
  return next.view
}
