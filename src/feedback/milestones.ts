import { FEEDBACK, MILESTONES, type MilestoneDef, type MilestoneMeter } from './config.ts'
import type { FeedbackWorld } from './types.ts'

export interface GoalView {
  id: string
  title: string
  detail: string
  value: number
  target: number
  /** 0–1 fill for the progress bar. */
  ratio: number
  rewardText: string
}

export interface MilestoneReward {
  id: string
  cash: number
  label: string
  title: string
  rewardText: string
}

export function moneyText(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

export function meterValue(world: FeedbackWorld, meter: MilestoneMeter): number {
  switch (meter) {
    case 'airlines':
      return world.airlines.length
    case 'flights':
      return world.flightsLanded
    case 'passengers':
      return world.passengersServed
    case 'reputation':
      return world.reputation
  }
}

export function goalView(def: MilestoneDef, world: FeedbackWorld): GoalView {
  const value = Math.max(0, meterValue(world, def.meter))
  const target = def.target
  const ratio = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0
  return {
    id: def.id,
    title: def.title,
    detail: def.detail,
    value,
    target,
    ratio,
    rewardText: moneyText(def.rewardCash),
  }
}

/** The short list of goals still ahead. */
export function currentGoals(world: FeedbackWorld, claimed: ReadonlySet<string>, limit = FEEDBACK.stackSize): GoalView[] {
  const out: GoalView[] = []
  for (const def of MILESTONES) {
    if (claimed.has(def.id)) continue
    out.push(goalView(def, world))
    if (out.length >= limit) break
  }
  return out
}

/** Goals whose bar just filled. The caller marks them claimed. */
export function completedMilestones(world: FeedbackWorld, claimed: ReadonlySet<string>): MilestoneReward[] {
  const out: MilestoneReward[] = []
  for (const def of MILESTONES) {
    if (claimed.has(def.id)) continue
    if (meterValue(world, def.meter) < def.target) continue
    out.push({
      id: def.id,
      cash: def.rewardCash,
      label: def.rewardLabel,
      title: def.title,
      rewardText: moneyText(def.rewardCash),
    })
  }
  return out
}
