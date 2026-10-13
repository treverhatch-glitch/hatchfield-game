export interface LoanScheduleEntry {
  day: number
  payment: number
  principalPayment: number
  interestPayment: number
  remainingBalance: number
}

export interface LoanSchedule {
  principal: number
  annualRate: number
  days: number
  dailyPayment: number
  schedule: LoanScheduleEntry[]
}

export interface EarlyRepayResult {
  payoffAmount: number
  fee: number
  principalPaid: number
}

function safeNum(val: unknown, fallback = 0): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
    return fallback
  }
  return val
}

/**
 * Calculates a daily loan amortisation schedule.
 * Year length is defined as 360 game days.
 */
export function amortise(
  principal: number,
  annualRate: number,
  days: number
): LoanSchedule {
  const safeP = Math.max(0, safeNum(principal))
  const safeRate = Math.max(0, safeNum(annualRate))
  const safeDays = Math.floor(Math.max(0, safeNum(days)))

  if (safeP === 0 || safeDays === 0) {
    return {
      principal: 0,
      annualRate: safeRate,
      days: safeDays,
      dailyPayment: 0,
      schedule: [],
    }
  }

  const dailyRate = safeRate / 360
  let dailyPayment = 0

  if (dailyRate === 0) {
    dailyPayment = safeP / safeDays
  } else {
    const factor = Math.pow(1 + dailyRate, safeDays)
    dailyPayment = (safeP * dailyRate * factor) / (factor - 1)
  }

  if (!Number.isFinite(dailyPayment) || Number.isNaN(dailyPayment)) {
    dailyPayment = safeP / safeDays
  }

  const schedule: LoanScheduleEntry[] = []
  let currentBalance = safeP

  for (let d = 1; d <= safeDays; d++) {
    const interestPayment = currentBalance * dailyRate
    let principalPayment = dailyPayment - interestPayment

    if (d === safeDays || principalPayment >= currentBalance) {
      principalPayment = currentBalance
    }

    const actualPayment = principalPayment + interestPayment
    const remBal = Math.max(0, currentBalance - principalPayment)
    currentBalance = remBal

    schedule.push({
      day: d,
      payment: safeNum(actualPayment),
      principalPayment: safeNum(principalPayment),
      interestPayment: safeNum(interestPayment),
      remainingBalance: safeNum(remBal),
    })
  }

  return {
    principal: safeP,
    annualRate: safeRate,
    days: safeDays,
    dailyPayment: safeNum(dailyPayment),
    schedule,
  }
}

/**
 * Returns the remaining principal balance after a given day's payment.
 * Day <= 0 returns initial principal.
 */
export function remainingBalance(
  schedule: LoanSchedule | LoanScheduleEntry[] | null | undefined,
  day: number
): number {
  if (!schedule) return 0
  const safeDay = Math.floor(safeNum(day, 0))

  const entries = Array.isArray(schedule) ? schedule : schedule.schedule
  if (!entries || entries.length === 0) return 0

  const initialPrincipal =
    !Array.isArray(schedule) && schedule.principal != null
      ? safeNum(schedule.principal)
      : safeNum(entries[0].remainingBalance + entries[0].principalPayment)

  if (safeDay <= 0) {
    return initialPrincipal
  }

  if (safeDay > entries.length) {
    return 0
  }

  const entry = entries[safeDay - 1]
  return entry ? safeNum(entry.remainingBalance) : 0
}

/**
 * Calculates early repayment for a loan on a given day with a 2% fee.
 */
export function earlyRepay(
  schedule: LoanSchedule | LoanScheduleEntry[] | null | undefined,
  day: number
): EarlyRepayResult {
  const safeDay = Math.floor(safeNum(day, 1))
  // Outstanding principal before day's payment
  const balance = remainingBalance(schedule, safeDay - 1)

  if (balance <= 0) {
    return {
      payoffAmount: 0,
      fee: 0,
      principalPaid: 0,
    }
  }

  const fee = balance * 0.02
  const payoffAmount = balance + fee

  return {
    payoffAmount: safeNum(payoffAmount),
    fee: safeNum(fee),
    principalPaid: safeNum(balance),
  }
}
