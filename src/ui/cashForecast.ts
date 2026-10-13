/**
 * Cash-flow forecast for the HUD. One game day is 24 book hours (7.5 sim
 * seconds each). Daily charges are the scheduled operating-day bill; the week
 * is that bill seven times. Income is the live hourly rate projected forward.
 */

export const HOURS_PER_GAME_DAY = 24
export const DAYS_PER_WEEK = 7

export interface OperatingCharges {
  payroll: number
  upkeep: number
  holding: number
  levy: number
}

export interface CashForecast {
  hourlyIncome: number
  dailyIncome: number
  dailyCharges: number
  weeklyCharges: number
  dailyNet: number
  weeklyNet: number
  cashInSevenDays: number
  charges: OperatingCharges
}

const n = (v: number) => (Number.isFinite(v) ? v : 0)

export function projectCash(cash: number, hourlyIncome: number, charges: OperatingCharges): CashForecast {
  const payroll = n(charges.payroll)
  const upkeep = n(charges.upkeep)
  const holding = n(charges.holding)
  const levy = n(charges.levy)
  const dailyCharges = payroll + upkeep + holding + levy
  const hourly = n(hourlyIncome)
  const dailyIncome = hourly * HOURS_PER_GAME_DAY
  const dailyNet = dailyIncome - dailyCharges
  const weeklyCharges = dailyCharges * DAYS_PER_WEEK
  const weeklyNet = dailyNet * DAYS_PER_WEEK
  return {
    hourlyIncome: hourly,
    dailyIncome,
    dailyCharges,
    weeklyCharges,
    dailyNet,
    weeklyNet,
    cashInSevenDays: n(cash) + weeklyNet,
    charges: { payroll, upkeep, holding, levy },
  }
}
