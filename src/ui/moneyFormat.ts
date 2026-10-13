/** In-game day = 24 in-game hours. One in-game hour is 7.5 sim seconds. */
export const HOURS_PER_DAY = 24
/** Payroll and landside upkeep bill every 30 sim seconds. A day is 180s. */
export const TICKS_PER_DAY = 6

export function perDayFromHour(hourly: number): number {
  return hourly * HOURS_PER_DAY
}

export function perDayFromTick(perTick: number): number {
  return perTick * TICKS_PER_DAY
}

/** Compact cash: $1.24M, $3.2k, $480. */
export function moneyAbbrev(n: number): string {
  const sign = n < 0 ? '-' : ''
  const v = Math.abs(n)
  if (v >= 1_000_000) {
    const m = v / 1_000_000
    const digits = m >= 10 ? 1 : 2
    return `${sign}$${trimZeros(m.toFixed(digits))}M`
  }
  if (v >= 1000) {
    const k = v / 1000
    const digits = k >= 100 ? 0 : 1
    return `${sign}$${trimZeros(k.toFixed(digits))}k`
  }
  return `${sign}$${Math.round(v)}`
}

function trimZeros(s: string): string {
  return s.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1')
}

/** Every rate on the HUD uses the same labelled unit. */
export function ratePerDay(amount: number): string {
  return `${moneyAbbrev(amount)}/day`
}

export function signedRatePerDay(amount: number): string {
  const core = ratePerDay(amount)
  if (amount > 0) return `+${core}`
  return core
}
