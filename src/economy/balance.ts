import { EconomyEngine } from './engine'
import { TECH_NODES } from './techTree'
import {
  cityLevyForGameDay,
  operatingMargin,
  payrollForGameDay,
} from '../core/bank'
import { realMinutesToSimMinutes } from '../core/clock'

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
    ],
  }
}
