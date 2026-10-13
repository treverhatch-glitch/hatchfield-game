export interface InsuranceIncident {
  day: number
  severity: 1 | 2 | 3 | number
}

function safeNum(val: unknown, fallback = 0): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
    return fallback
  }
  return val
}

const SEVERITY_RATES: Record<number, number> = {
  1: 0.15,
  2: 0.4,
  3: 0.9,
}

/**
 * Calculates the daily insurance premium for a given asset value and incident history.
 * Base rate: 0.5% of asset value per 30 days, prorated daily.
 * Incident penalty: +15% / +40% / +90% per incident by severity (1, 2, 3), decaying with a 30-day half-life.
 */
export function dailyPremium(
  assetValue: number,
  incidents: InsuranceIncident[] | null | undefined,
  today: number
): number {
  const safeAsset = Math.max(0, safeNum(assetValue))
  if (safeAsset === 0) return 0

  const safeToday = safeNum(today, 0)
  const baseDaily = (safeAsset * 0.005) / 30

  let totalSurcharge = 0

  if (Array.isArray(incidents)) {
    for (const inc of incidents) {
      if (!inc) continue
      const incDay = safeNum(inc.day, -1)
      const severity = Math.floor(safeNum(inc.severity, 0))

      if (incDay < 0 || incDay > safeToday) {
        continue
      }

      const rate = SEVERITY_RATES[severity] ?? 0
      if (rate <= 0) continue

      const elapsed = safeToday - incDay
      const decay = Math.pow(0.5, elapsed / 30)

      if (Number.isFinite(decay) && !Number.isNaN(decay)) {
        totalSurcharge += rate * decay
      }
    }
  }

  const premium = baseDaily * (1 + totalSurcharge)
  return Math.max(0, safeNum(premium))
}
