import { EconomyEngine } from './engine'
import { TECH_NODES } from './techTree'
import {
  cityLevyForGameDay,
  operatingMargin,
  payrollForGameDay,
  type FinancialPhase,
} from '../core/bank'
import { realMinutesToSimMinutes } from '../core/clock'
import { LAND_PLOT } from '../game/catalog.ts'
import { seedOwned, starterHolding } from '../land/plots.ts'
import { dailySinks, type DailySinkInput } from '../land/index.ts'

export interface BalanceReport {
  early: {
    realMinutes: number
    researchPointsEarned: number
    unbankedProgress: number
    researchersFirstHour: number
    researchersSecondHour: number
    canAffordOneBranchThroughTier3: boolean
  }
  late: {
    realMinutes: number
    researchPointsEarned: number
    totalTreeCost: number
    affordableTreeShare: number
    researchers: number
  }
  finances: {
    early: {
      income: number
      payroll: number
      otherCosts: number
      margin: number
    }
    midgame: {
      income: number
      payroll: number
      otherCosts: number
      cityLevy: number
      margin: number
    }
  }
  assumptions: string[]
}

function configureResearchers(engine: EconomyEngine, researchers: number): void {
  engine.setStaffPools({
    researcher: { hired: researchers, wagePerDay: 180 },
  })
  engine.setResearchRooms([
    { id: 'rd-main', desks: researchers, powerDemand: 35, active: true },
  ])
  engine.setOperational(true)
}

/** Deterministic, headless RP pacing scenario used by tests and tuning tools. */
export function runHeadlessBalance(): BalanceReport {
  const early = new EconomyEngine()
  configureResearchers(early, 3)
  for (let minute = 1; minute <= 120; minute++) {
    if (minute === 15) early.claimMilestone('first_jet')
    if (minute === 45) early.setFieldLevel(3)
    if (minute === 61) configureResearchers(early, 4)
    if (minute === 70) early.claimMilestone('first_long_haul')
    early.tick(realMinutesToSimMinutes(1))
  }
  const earlyState = early.snapshot().state
  const earlyEarned = earlyState.researchPoints

  const late = new EconomyEngine()
  configureResearchers(late, 16)
  late.setFieldLevel(8)
  late.claimMilestone('first_jet')
  late.claimMilestone('thousand_daily_passengers')
  late.claimMilestone('first_long_haul')
  late.tick(realMinutesToSimMinutes(480))
  const lateState = late.snapshot().state
  const totalTreeCost = TECH_NODES.reduce((sum, node) => sum + node.costRp, 0)
  const earlyIncome = 20_000
  const earlyPayroll = payrollForGameDay(earlyIncome, 'early')
  const earlyOtherCosts = 3_000
  const midgameIncome = 203_000
  const midgamePayroll = payrollForGameDay(midgameIncome, 'midgame')
  const midgameOtherCosts = 35_000
  const midgameLevy = cityLevyForGameDay(500_000)

  return {
    early: {
      realMinutes: 120,
      researchPointsEarned: earlyEarned,
      unbankedProgress: earlyState.researchProgress,
      researchersFirstHour: 3,
      researchersSecondHour: 4,
      canAffordOneBranchThroughTier3: earlyEarned >= 7,
    },
    late: {
      realMinutes: 480,
      researchPointsEarned: lateState.researchPoints,
      totalTreeCost,
      affordableTreeShare: lateState.researchPoints / totalTreeCost,
      researchers: 16,
    },
    finances: {
      early: {
        income: earlyIncome,
        payroll: earlyPayroll,
        otherCosts: earlyOtherCosts,
        margin: operatingMargin(earlyIncome, earlyPayroll + earlyOtherCosts),
      },
      midgame: {
        income: midgameIncome,
        payroll: midgamePayroll,
        otherCosts: midgameOtherCosts,
        cityLevy: midgameLevy,
        margin: operatingMargin(midgameIncome, midgamePayroll + midgameOtherCosts + midgameLevy),
      },
    },
    assumptions: [
      'The airport operates continuously at normal speed.',
      'Three staffed desks become four after the first hour; R&D has enough power.',
      'Field Level 3 is reached at minute 45, first jet at 15, and first long-haul at 70.',
      'Late game models Field Level 8 and sixteen staffed R&D desks for eight real hours.',
      'Early finance uses $20k income and $3k non-payroll daily costs.',
      'Mid-game finance uses the review model: $203k income, $35k other costs, and $500k cash.',
      'Cash, room construction, wages, and player downtime are intentionally outside RP pacing.',
      'Land holding is a separate cash-flow picture: plot tax, insurance, utilities, and licences.',
    ],
  }
}

export interface DayCashFlow {
  income: number
  payroll: number
  otherCosts: number
  sinks: number
  cityLevy: number
}

export interface CashFlowPicture {
  phase: FinancialPhase
  income: number
  otherCosts: number
  minimumStaffing: number
  /** Charged land sinks for the day. Loan interest stays on the loan clock. */
  sinkCharged: number
}

export function dayExpenses(day: DayCashFlow): number {
  return day.payroll + day.otherCosts + day.sinks + day.cityLevy
}

export function dayMargin(day: DayCashFlow): number {
  return operatingMargin(day.income, dayExpenses(day))
}

export function closeDayCash(opening: number, day: DayCashFlow): number {
  return opening + day.income - dayExpenses(day)
}

/** End-of-day cash divided by an earlier day. Days are indexes into a series that starts at day 0. */
export function cashGrowthMultiple(series: readonly number[], fromDay: number, toDay: number): number {
  const start = series[fromDay]
  const end = series[toDay]
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(start > 0)) return Number.POSITIVE_INFINITY
  return end / start
}

/** One line per day, index 0 is the opening cash before day 1 closes. */
export function projectCashFlow(opening: number, days: number, picture: CashFlowPicture): number[] {
  const series = [opening]
  let cash = opening
  const span = Math.max(0, Math.floor(days))
  for (let day = 0; day < span; day++) {
    const payroll = payrollForGameDay(picture.income, picture.phase, picture.minimumStaffing)
    const levy = cityLevyForGameDay(Math.max(0, cash))
    cash = closeDayCash(cash, {
      income: picture.income,
      payroll,
      otherCosts: picture.otherCosts,
      sinks: picture.sinkCharged,
      cityLevy: levy,
    })
    series.push(cash)
  }
  return series
}

export interface OperatingMarginSample {
  early: DayCashFlow & { margin: number }
  midgame: DayCashFlow & { margin: number }
  series: number[]
  growthDay20to30: number
}

/** Headless early and mid-game days, including the land sinks a field of that size would pay. */
export function sampleOperatingMargins(openingCash = 500_000): OperatingMarginSample {
  const earlySinks = chargedSinks({
    plots: [starterHolding(LAND_PLOT)],
    assetValue: starterHolding(LAND_PLOT).assessed,
    incidents: 0,
    fieldLevel: 1,
    operational: false,
    powerLoad: 0,
    waterLoad: 0,
    fireStations: 0,
    intl: false,
    maintenanceContract: false,
    loanBalance: 0,
    loanRate: 0,
    loanFloor: 0,
    loanEverySeconds: 55,
    sandbox: false,
  })
  const midPlots = seedOwned(3, LAND_PLOT)
  const midSinks = chargedSinks({
    plots: midPlots,
    assetValue: 400_000,
    incidents: 1,
    fieldLevel: 3,
    operational: true,
    powerLoad: 20,
    waterLoad: 8,
    fireStations: 1,
    intl: false,
    maintenanceContract: false,
    loanBalance: 0,
    loanRate: 0,
    loanFloor: 0,
    loanEverySeconds: 55,
    sandbox: false,
  })
  const earlyIncome = 20_000
  const earlyPayroll = payrollForGameDay(earlyIncome, 'early')
  const earlyOther = 3_000
  const early: DayCashFlow = {
    income: earlyIncome,
    payroll: earlyPayroll,
    otherCosts: earlyOther,
    sinks: earlySinks,
    cityLevy: 0,
  }
  const midIncome = 203_000
  const midPayroll = payrollForGameDay(midIncome, 'midgame')
  const midOther = 35_000
  const mid: DayCashFlow = {
    income: midIncome,
    payroll: midPayroll,
    otherCosts: midOther,
    sinks: midSinks,
    cityLevy: cityLevyForGameDay(openingCash),
  }
  const series = projectCashFlow(openingCash, 30, {
    phase: 'midgame',
    income: midIncome,
    otherCosts: midOther,
    minimumStaffing: 0,
    sinkCharged: midSinks,
  })
  return {
    early: { ...early, margin: dayMargin(early) },
    midgame: { ...mid, margin: dayMargin(mid) },
    series,
    growthDay20to30: cashGrowthMultiple(series, 20, 30),
  }
}

function chargedSinks(input: DailySinkInput): number {
  return dailySinks(input, LAND_PLOT).chargedTotal
}
