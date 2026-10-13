import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import type { DailySinkInput, DailySinks, LandPlotConfig, SinkLine } from './types.ts'

/**
 * Recurring money sinks for one game day.
 * Property tax, plot upkeep, insurance, utilities, licences, and the optional
 * maintenance contract are charged. Loan interest is quoted from the existing
 * loan clock so a day-close does not bill it a second time.
 */
export function dailySinks(input: DailySinkInput, config: LandPlotConfig): DailySinks {
  const lines: SinkLine[] = []
  const plots = input.plots.length
  const assessed = sumAssessed(input)

  push(lines, 'plot_upkeep', 'Plot upkeep', roundMoney(plots * config.dailyUpkeep), true)
  push(lines, 'property_tax', 'Property tax', roundMoney(assessed * rate(config.propertyTaxRate)), true)

  const incidentMult =
    1 + Math.min(nonNeg(config.insuranceIncidentCap), nonNeg(input.incidents)) * rate(config.insurancePerIncident)
  const insured = Math.max(assessed, nonNeg(input.assetValue))
  push(lines, 'insurance', 'Insurance', roundMoney(insured * rate(config.insuranceRate) * incidentMult), true)

  push(
    lines,
    'utilities',
    'Utilities',
    roundMoney(nonNeg(input.powerLoad) * config.utilityPerPower + nonNeg(input.waterLoad) * config.utilityPerWater),
    true,
  )

  if (input.operational) {
    const level = Math.max(0, Math.floor(nonNeg(input.fieldLevel)))
    push(
      lines,
      'licence_operating',
      'Operating certificate',
      roundMoney(config.operatingLicence[level] ?? 0),
      true,
    )
    push(
      lines,
      'licence_arff',
      'ARFF licence',
      roundMoney(nonNeg(input.fireStations) * config.arffLicence),
      true,
    )
    if (input.intl) {
      push(lines, 'licence_intl', 'International licence', roundMoney(config.intlLicence), true)
    }
  }

  if (input.maintenanceContract) {
    push(lines, 'maintenance_contract', 'Maintenance contract', roundMoney(config.maintenanceContract), true)
  }

  push(lines, 'loan_interest', 'Loan interest', loanInterestPerDay(input), false)

  const charged = lines.filter((line) => line.charged)
  const chargedTotal = input.sandbox ? 0 : charged.reduce((sum, line) => sum + line.amount, 0)
  const quotedTotal = lines.reduce((sum, line) => sum + line.amount, 0)
  return {
    lines: input.sandbox ? lines.map((line) => ({ ...line, amount: line.charged ? 0 : line.amount })) : lines,
    chargedTotal: finite(chargedTotal),
    quotedTotal: finite(input.sandbox ? chargedTotal : quotedTotal),
  }
}

/** Interest the loan clock will take across one game day at the current balance. */
export function loanInterestPerDay(input: Pick<DailySinkInput, 'loanBalance' | 'loanRate' | 'loanFloor' | 'loanEverySeconds'>): number {
  if (!(input.loanBalance > 0) || !(input.loanEverySeconds > 0)) return 0
  const variable = Number.isFinite(input.loanRate) ? input.loanBalance * input.loanRate : 0
  const floor = Number.isFinite(input.loanFloor) ? input.loanFloor : 0
  const perTick = Math.max(floor, Math.round(variable))
  const ticks = REAL_SECONDS_PER_GAME_DAY / input.loanEverySeconds
  return roundMoney(perTick * ticks)
}

function sumAssessed(input: DailySinkInput): number {
  let total = 0
  for (const plot of input.plots) total += nonNeg(plot.assessed)
  return total
}

function push(lines: SinkLine[], id: SinkLine['id'], label: string, amount: number, charged: boolean) {
  if (!(amount > 0)) return
  lines.push({ id, label, amount, charged })
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value)
}

function nonNeg(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value
}

function rate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}
