import { ratePerDay } from './moneyFormat'

/** One in-game hour is 7.5 sim seconds. A day is 24 of those hours (180s). */
export const HOUR_SEC = 7.5
export const DAY_SEC = 180
export const PAYROLL_SEC = 30
export const TICKS_PER_DAY = DAY_SEC / PAYROLL_SEC
export const HOURS_PER_DAY = 24
/**
 * City levy the payroll tick already charges once cash is above this.
 * Derived here so the runway matches the books without editing the sim.
 */
export const LEVY_CASH = 140_000
export const LEVY_RATE = 0.03
export const FLOAT_LIFE_MS = 1700

export type CashNews = { id: string; text: string }

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
  news: CashNews[]
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
  newsIds: string[]
  sessionIncome: Record<string, number>
  floats: FlowFloat[]
}

export type FlowCache = {
  sig: string
  tracker: FlowTracker
  view: CashFlowView
}

export function cashSignature(snap: CashSnapshot): string {
  const head = snap.news[0]?.id ?? ''
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
    head,
    snap.news.length,
  ].join('|')
}

export function incomeSource(text: string): string {
  const t = text.toLowerCase()
  if (/bag/.test(t)) return 'Bags'
  if (/fuel/.test(t)) return 'Fuel'
  if (/cater/.test(t)) return 'Catering'
  if (/de-?ice/.test(t)) return 'De-ice'
  if (/park/.test(t)) return 'Parking'
  if (/\bmx\b|hangar/.test(t)) return 'Maintenance'
  if (/cargo/.test(t)) return 'Cargo'
  if (/layover|volume|contract/.test(t)) return 'Contracts'
  if (/clean/.test(t)) return 'Cleaning'
  if (/landing|pad fee/.test(t)) return 'Landings'
  if (/bonus|ask done|mission/.test(t)) return 'Bonuses'
  return 'Other'
}

export function moneyInText(text: string): number | null {
  const m = text.match(/\+\s*\$([\d,]+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Levy due on the next payroll tick, after staff and upkeep leave the till. Sandbox is exempt. */
export function projectedLevy(cash: number, staff: number, upkeep: number, sandbox = false): number {
  if (sandbox) return 0
  const after = cash - staff - upkeep
  if (after <= LEVY_CASH) return 0
  return Math.round((after - LEVY_CASH) * LEVY_RATE)
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

export function scheduledCostLines(snap: CashSnapshot): CashLine[] {
  const lines: CashLine[] = []
  const upkeep = bookedUpkeep(snap)
  if (upkeep >= 1) lines.push({ label: 'Upkeep', perDay: upkeep * TICKS_PER_DAY })
  const raw = snap.staffLines.reduce((sum, line) => sum + line.perTick, 0)
  const scale = raw > 0 ? snap.payrollPerTick / raw : 0
  for (const line of snap.staffLines) {
    const perDay = line.perTick * scale * TICKS_PER_DAY
    if (perDay >= 1) lines.push({ label: line.label, perDay })
  }
  const levy = projectedLevy(snap.cash, snap.payrollPerTick, upkeep, snap.sandbox)
  if (levy >= 1) lines.push({ label: 'Fees', perDay: levy * TICKS_PER_DAY })
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
    newsIds: snap.news.map((n) => n.id),
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
  const addIncome = (label: string, amount: number, id: string) => {
    if (amount < 1) return
    sessionIncome[label] = (sessionIncome[label] ?? 0) + amount
    floats.push({ id, dir: 'up', amount, label, at: now })
  }

  let remain = Math.max(0, snap.revenue - prev.revenue)
  const seen = new Set(prev.newsIds)
  const fresh = snap.news.filter((n) => !seen.has(n.id)).reverse()
  for (const item of fresh) {
    const parsed = moneyInText(item.text)
    if (parsed == null || parsed <= 0) continue
    const take = Math.min(parsed, remain)
    if (take < 1) continue
    addIncome(incomeSource(item.text), take, `in-${item.id}`)
    remain -= take
  }
  if (remain >= 1) addIncome('Passenger spend', remain, `pax-${snap.clock.toFixed(2)}-${Math.round(remain)}`)

  const pulse = expensePulse(prev, snap)
  const payrollFired = snap.payrollCool > prev.payrollCool + 1
  if (pulse >= 1) {
    if (payrollFired) {
      let left = pulse
      const upkeepHit = Math.min(bookedUpkeep(snap), left)
      left -= upkeepHit
      const staffHit = Math.min(snap.payrollPerTick, left)
      left -= staffHit
      const bits: [string, number][] = [
        ['Upkeep', upkeepHit],
        ['Staff', staffHit],
        ['Fees', left],
      ]
      for (const [label, amount] of bits) {
        if (amount < 1) continue
        floats.push({
          id: `out-${label}-${snap.clock.toFixed(2)}`,
          dir: 'down',
          amount,
          label,
          at: now,
        })
      }
    } else {
      floats.push({
        id: `out-Fees-${snap.clock.toFixed(2)}`,
        dir: 'down',
        amount: pulse,
        label: 'Fees',
        at: now,
      })
    }
  }

  const tracker: FlowTracker = {
    revenue: snap.revenue,
    hourIncome: snap.hourIncome,
    hourExpense: snap.hourExpense,
    histLen: snap.econHist.length,
    payrollCool: snap.payrollCool,
    clock: snap.clock,
    newsIds: snap.news.map((n) => n.id),
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
