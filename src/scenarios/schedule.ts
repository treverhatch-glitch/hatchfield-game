import { SCENARIOS } from './templates.ts'
import type { Scenario, ScenarioGoal } from './types.ts'

/** One opt-in scenario. A new game leaves this empty. */
export interface ScenarioRun {
  id: string
  /** Field day the player pressed Start. The window counts from here. */
  startedDay: number
  status: 'running' | 'met' | 'missed'
  /** Latest reading of the goal (passengers, share, night revenue, or profit days). */
  progress: number
  profitDays: number
}

export interface ScenarioDay {
  /** Day that just closed. */
  day: number
  pax: number
  /** Income minus expense for that day. */
  profit: number
  nightRevenue: number
  /** Mean connecting share of signed passenger carriers, 0..1. */
  transferShare: number
}

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id)
}

export function scenarioDeadline(run: ScenarioRun, goal: ScenarioGoal): number {
  return run.startedDay + goal.byDay
}

export function scenarioGoalLine(goal: ScenarioGoal): string {
  switch (goal.kind) {
    case 'pax_per_day':
      return `Serve ${goal.target.toLocaleString('en-US')} passengers in one day.`
    case 'profit_days':
      return `Close ${goal.target.toLocaleString('en-US')} profitable days.`
    case 'night_revenue':
      return `Take $${goal.target.toLocaleString('en-US')} of night-hub revenue in one day.`
    case 'transfer_share':
      return `Reach a ${(goal.target * 100).toFixed(0)}% connecting share across signed passenger carriers.`
    case 'net_zero':
      return 'Reach net-zero carbon.'
    default:
      return 'Meet the posted goal.'
  }
}

/** What Start will change, in the order a player should read it. */
export function scenarioRuleLines(scenario: Scenario): string[] {
  const lines = [scenarioGoalLine(scenario.goal)]
  const rules = scenario.constraints
  if (rules.noLandPlots) lines.push('No further parcels.')
  if (rules.maxRunwayM != null) lines.push(`Runway cap ${rules.maxRunwayM.toLocaleString('en-US')} m.`)
  if (rules.curfew) lines.push('Night curfew stays on, including after Night bank.')
  if (rules.snow) lines.push('Snow is noted. This map still rolls its own weather.')
  if (rules.nightRevenueShare != null) {
    lines.push(`The brief asks for ${(rules.nightRevenueShare * 100).toFixed(0)}% night revenue. The goal scores night-hub takings.`)
  }
  if (rules.startDebt != null && rules.startDebt > 0) {
    lines.push(`$${rules.startDebt.toLocaleString('en-US')} goes on the loan book. No cash is wired with it.`)
  }
  if (rules.militaryApron) {
    lines.push('Hangar-side hardstands and a Guard agreement. Incident drill opens the ramp.')
  }
  if (rules.netZeroByDay != null || scenario.goal.kind === 'net_zero') {
    lines.push('Net-zero is not on the day book, so this goal cannot be met.')
  }
  lines.push(`The window is ${scenario.goal.byDay} days from the day you start.`)
  return lines
}

function goalReached(goal: ScenarioGoal, progress: number, profitDays: number): boolean {
  if (goal.kind === 'net_zero') return false
  if (goal.kind === 'profit_days') return profitDays >= goal.target
  return progress >= goal.target
}

/** Advance one closed day. Net-zero stays unmet because the day book has no carbon line. */
export function scoreScenario(
  run: ScenarioRun,
  scenario: Scenario,
  day: ScenarioDay,
): { run: ScenarioRun; news: string | null } {
  if (run.status !== 'running' || day.day < run.startedDay) return { run, news: null }
  const next: ScenarioRun = { ...run }
  switch (scenario.goal.kind) {
    case 'pax_per_day':
      next.progress = day.pax
      break
    case 'profit_days':
      if (day.profit > 0) next.profitDays += 1
      next.progress = next.profitDays
      break
    case 'night_revenue':
      next.progress = day.nightRevenue
      break
    case 'transfer_share':
      next.progress = day.transferShare
      break
    case 'net_zero':
      next.progress = 0
      break
    default:
      break
  }
  if (goalReached(scenario.goal, next.progress, next.profitDays)) {
    next.status = 'met'
    return { run: next, news: `${scenario.name} met. ${scenarioGoalLine(scenario.goal)}` }
  }
  if (day.day >= scenarioDeadline(run, scenario.goal)) {
    next.status = 'missed'
    return {
      run: next,
      news: `${scenario.name} missed. The window closed on day ${day.day}.`,
    }
  }
  return { run: next, news: null }
}
