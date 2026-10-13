import { categoryLabel, type MoneyCategory } from './bankAdapter'
import { ratePerDay } from './moneyFormat'

/** One in-game hour is 7.5 sim seconds. A day is 24 of those hours (180s). */
export const HOUR_SEC = 7.5
export const DAY_SEC = 180
export const PAYROLL_SEC = 30
export const TICKS_PER_DAY = DAY_SEC / PAYROLL_SEC
export const HOURS_PER_DAY = 24
export const FLOAT_LIFE_MS = 1700

export type GroundBooks = {
  fuelSales: number
  cateringFees: number
  fuelPurchase: number
  mealProduction: number
  vehicleUpkeep: number
}

export const EMPTY_GROUND: GroundBooks = {
  fuelSales: 0,
  cateringFees: 0,
  fuelPurchase: 0,
  mealProduction: 0,
  vehicleUpkeep: 0,
}

/** One posted earn() or settled payment, already tagged with a bank category. */
export type CashPost = {
  key: string
  category: MoneyCategory
  amount: number
}

export type CashSnapshot = {
  cash: number
  sandbox: boolean
  revenue: number
  hourIncome: number
  hourExpense: number
  econHour: number
  incomePerHour: number
  econHist: { income: number; expense: number }[]
  payrollCool: number
  clock: number
  payrollPerTick: number
  upkeepPerTick: number
  staffLines: { label: string; perTick: number }[]
  payments: CashPost[]
  ground: GroundBooks
}

export type CashLine = { label: string; perDay: number }

export type FlowFloat = {
  id: string
  dir: 'up' | 'down'
  amount: number
  label: string
  at: number
}

export type CashFlowView = {
  cash: number
  netPerDay: number
  incomePerDay: number
  costPerDay: number
  runwayDays: number | null
  runwayText: string | null
  estimateText: string
  arrow: 'up' | 'down' | 'flat'
  incomeLines: CashLine[]
  costLines: CashLine[]
  nextChargeSec: number
  week: {
    income: number
    cost: number
    net: number
    incomeLines: CashLine[]
    costLines: CashLine[]
    bookedHours: number
    bookedIncome: number
    bookedCost: number
  }
  floats: FlowFloat[]
}

export type FlowTracker = {
  revenue: number
  hourIncome: number
  hourExpense: number
  histLen: number
  payrollCool: number
  clock: number
  paymentKeys: string[]
  ground: GroundBooks
  sessionIncome: Record<string, number>
  floats: FlowFloat[]
}

export type FlowCache = {
  sig: string
  tracker: FlowTracker
  view: CashFlowView
}

export function cashSignature(snap: CashSnapshot): string {
  const g = snap.ground
  return [
    snap.cash,
    snap.revenue,
    snap.hourIncome,
    snap.hourExpense,
    snap.econHour.toFixed(2),
    snap.econHist.length,
    snap.payrollCool.toFixed(1),
    snap.clock.toFixed(1),
    snap.payrollPerTick,
    snap.upkeepPerTick,
    snap.sandbox ? 1 : 0,
    snap.payments.map((p) => p.key).join(','),
    g.fuelSales,
    g.cateringFees,
    g.fuelPurchase,
    g.mealProduction,
    g.vehicleUpkeep,
  ].join('|')
}

export function runwayTextFor(days: number): string {
  if (days < 1) return 'Cash lasts under a day'
  const shown = days >= 10 ? String(Math.min(999, Math.round(days))) : String(Math.round(days * 10) / 10)
  const unit = shown === '1' ? 'day' : 'days'
  return `Cash lasts ~${shown} ${unit}`
}

export function estimateTextFor(net: number): string {
  if (net > 0.5) return `Est. +${ratePerDay(net)}`
  if (net < -0.5) return `Est. ${ratePerDay(net)}`
  return `Est. ${ratePerDay(0)}`
}

function bookedUpkeep(snap: CashSnapshot): number {
  return snap.sandbox ? 0 : snap.upkeepPerTick
}

/**
 * Forward pace is daily payroll plus building upkeep.
 * The city levy is not projected. It only shows when a tick actually charges it.
 */
export function scheduledCostLines(snap: CashSnapshot): CashLine[] {
  const lines: CashLine[] = []
  const upkeep = bookedUpkeep(snap) * TICKS_PER_DAY
  if (upkeep >= 1) lines.push({ label: categoryLabel('building_upkeep'), perDay: upkeep })
  const raw = snap.staffLines.reduce((sum, line) => sum + line.perTick, 0)
  const scale = raw > 0 ? snap.payrollPerTick / raw : 0
  let staffDay = 0
  for (const line of snap.staffLines) {
    const perDay = line.perTick * scale * TICKS_PER_DAY
    staffDay += perDay
    if (perDay >= 1) lines.push({ label: line.label, perDay })
  }
  const payrollDay = snap.payrollPerTick * TICKS_PER_DAY
  if (staffDay < 1 && payrollDay >= 1) {
    lines.push({ label: categoryLabel('payroll'), perDay: payrollDay })
  }
  return lines
}

function incomePerDayOf(snap: CashSnapshot): number {
  const openHours = snap.econHour / HOUR_SEC
  const hist = snap.econHist.slice(-24)
  if (hist.length === 0 && openHours < 0.45) return 0
  const weight = hist.length + openHours
  if (weight <= 0) return 0
  const sum = hist.reduce((total, row) => total + row.income, 0) + snap.hourIncome
  return (sum / weight) * HOURS_PER_DAY
}

function shareLines(totalPerDay: number, session: Record<string, number>): CashLine[] {
  const total = Object.values(session).reduce((sum, n) => sum + n, 0)
  if (total <= 0 || totalPerDay <= 0) return []
  return Object.entries(session)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({ label, perDay: (amount / total) * totalPerDay }))
}

function weekOf(lines: CashLine[]): CashLine[] {
  return lines.map((line) => ({ label: line.label, perDay: line.perDay * 7 }))
}

function expensePulse(prev: FlowTracker, snap: CashSnapshot): number {
  if (snap.econHist.length > prev.histLen) {
    const closed = snap.econHist.slice(prev.histLen)
    let pulse = Math.max(0, (closed[0]?.expense ?? 0) - prev.hourExpense)
    for (let i = 1; i < closed.length; i++) pulse += Math.max(0, closed[i].expense)
    pulse += Math.max(0, snap.hourExpense)
    return pulse
  }
  return Math.max(0, snap.hourExpense - prev.hourExpense)
}

function seed(snap: CashSnapshot): FlowTracker {
  return {
    revenue: snap.revenue,
    hourIncome: snap.hourIncome,
    hourExpense: snap.hourExpense,
    histLen: snap.econHist.length,
    payrollCool: snap.payrollCool,
    clock: snap.clock,
    paymentKeys: snap.payments.map((p) => p.key),
    ground: { ...snap.ground },
    sessionIncome: {},
    floats: [],
  }
}

function freshGame(prev: FlowTracker, snap: CashSnapshot): boolean {
  return snap.clock + 0.05 < prev.clock || snap.revenue + 1 < prev.revenue
}

function buildView(snap: CashSnapshot, tracker: FlowTracker, now: number): CashFlowView {
  const incomePerDay = incomePerDayOf(snap)
  const costLines = scheduledCostLines(snap)
  const costPerDay = costLines.reduce((sum, line) => sum + line.perDay, 0)
  const netPerDay = incomePerDay - costPerDay
  const runwayDays = netPerDay < -0.5 && snap.cash > 0 ? snap.cash / -netPerDay : null
  const incomeLines = shareLines(incomePerDay, tracker.sessionIncome)
  const hist = snap.econHist
  const floats = tracker.floats.filter((f) => now - f.at < FLOAT_LIFE_MS)
  return {
    cash: snap.cash,
    netPerDay,
    incomePerDay,
    costPerDay,
    runwayDays,
    runwayText: runwayDays == null ? null : runwayTextFor(runwayDays),
    estimateText: estimateTextFor(netPerDay),
    arrow: netPerDay > 0.5 ? 'up' : netPerDay < -0.5 ? 'down' : 'flat',
    incomeLines,
    costLines,
    nextChargeSec: Math.max(0, snap.payrollCool),
    week: {
      income: incomePerDay * 7,
      cost: costPerDay * 7,
      net: netPerDay * 7,
      incomeLines: weekOf(incomeLines),
      costLines: weekOf(costLines),
      bookedHours: hist.length,
      bookedIncome: hist.reduce((sum, row) => sum + row.income, 0),
      bookedCost: hist.reduce((sum, row) => sum + row.expense, 0),
    },
    floats,
  }
}

function pushDown(floats: FlowFloat[], label: string, amount: number, id: string, now: number) {
  if (amount < 1) return
  floats.push({ id, dir: 'down', amount, label, at: now })
}

export function stepCashFlow(
  prev: FlowTracker | null,
  snap: CashSnapshot,
  now = Date.now(),
): { tracker: FlowTracker; view: CashFlowView } {
  if (!prev || freshGame(prev, snap)) {
    const tracker = seed(snap)
    return { tracker, view: buildView(snap, tracker, now) }
  }

  const floats = prev.floats.filter((f) => now - f.at < FLOAT_LIFE_MS)
  const sessionIncome = { ...prev.sessionIncome }
  const addIncome = (category: MoneyCategory, amount: number, id: string) => {
    if (amount < 1) return
    const label = categoryLabel(category)
    sessionIncome[label] = (sessionIncome[label] ?? 0) + amount
    floats.push({ id, dir: 'up', amount, label, at: now })
  }

  const seen = new Set(prev.paymentKeys)
  let posted = 0
  for (const item of snap.payments) {
    if (seen.has(item.key)) continue
    addIncome(item.category, item.amount, `in-${item.key}`)
    posted += item.amount
  }

  const fuelDelta = Math.max(0, snap.ground.fuelSales - prev.ground.fuelSales)
  const caterDelta = Math.max(0, snap.ground.cateringFees - prev.ground.cateringFees)
  addIncome('fuel_sales', fuelDelta, `in-fuel-${snap.ground.fuelSales}`)
  addIncome('catering_fees', caterDelta, `in-cater-${snap.ground.cateringFees}`)

  const remain = Math.max(0, snap.revenue - prev.revenue - posted - fuelDelta - caterDelta)
  if (remain >= 1) addIncome('retail_sales', remain, `retail-${snap.clock.toFixed(2)}-${Math.round(remain)}`)

  const pulse = expensePulse(prev, snap)
  let left = pulse
  const fuelBuy = Math.max(0, -(snap.ground.fuelPurchase - prev.ground.fuelPurchase))
  const meals = Math.max(0, -(snap.ground.mealProduction - prev.ground.mealProduction))
  const vehicles = Math.max(0, -(snap.ground.vehicleUpkeep - prev.ground.vehicleUpkeep))
  const take = (amount: number) => {
    const hit = Math.min(amount, left)
    left -= hit
    return hit
  }
  const groundHits: [string, number][] = [
    [categoryLabel('fuel_purchase'), take(fuelBuy)],
    [categoryLabel('meal_production'), take(meals)],
    [categoryLabel('vehicle_upkeep'), take(vehicles)],
  ]
  for (const [label, amount] of groundHits) {
    pushDown(floats, label, amount, `out-${label}-${snap.clock.toFixed(2)}`, now)
  }

  const payrollFired = snap.payrollCool > prev.payrollCool + 1
  if (left >= 1 && payrollFired) {
    const upkeepHit = take(bookedUpkeep(snap))
    const staffHit = take(snap.payrollPerTick)
    pushDown(floats, categoryLabel('building_upkeep'), upkeepHit, `out-upkeep-${snap.clock.toFixed(2)}`, now)
    pushDown(floats, categoryLabel('payroll'), staffHit, `out-payroll-${snap.clock.toFixed(2)}`, now)
    pushDown(floats, categoryLabel('city_levy'), left, `out-levy-${snap.clock.toFixed(2)}`, now)
  } else if (left >= 1) {
    pushDown(floats, categoryLabel('penalties'), left, `out-penalties-${snap.clock.toFixed(2)}`, now)
  }

  const tracker: FlowTracker = {
    revenue: snap.revenue,
    hourIncome: snap.hourIncome,
    hourExpense: snap.hourExpense,
    histLen: snap.econHist.length,
    payrollCool: snap.payrollCool,
    clock: snap.clock,
    paymentKeys: snap.payments.map((p) => p.key),
    ground: { ...snap.ground },
    sessionIncome,
    floats,
  }
  return { tracker, view: buildView(snap, tracker, now) }
}

/** Same snapshot returns the cached view so a second render does not double-count. */
export function readFlow(cache: FlowCache | null, snap: CashSnapshot, sig: string, now: number): FlowCache {
  if (cache && cache.sig === sig) {
    const floats = cache.tracker.floats.filter((f) => now - f.at < FLOAT_LIFE_MS)
    if (floats.length === cache.view.floats.length) return cache
    const tracker = { ...cache.tracker, floats }
    const view = { ...cache.view, floats }
    return { sig, tracker, view }
  }
  const stepped = stepCashFlow(cache?.tracker ?? null, snap, now)
  return { sig, tracker: stepped.tracker, view: stepped.view }
}
