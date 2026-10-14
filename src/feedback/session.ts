import { FEEDBACK } from './config.ts'
import { detectCelebrations, rememberCelebrations, type Celebration, type CelebrationMemory } from './celebrations.ts'
import { armWatches, settleWatches, type EffectToast, type EffectWatch } from './effects.ts'
import { completedMilestones, currentGoals, type GoalView, type MilestoneReward } from './milestones.ts'
import { emptyThoughts, stepThoughts, type LiveThought, type ThoughtState } from './thoughts.ts'
import type { FeedbackWorld } from './types.ts'

export interface CameraBeat {
  id: string
  duration: number
  dolly: number
}

export interface PaidLine {
  id: string
  title: string
  rewardText: string
  until: number
}

export interface FeedbackView {
  goals: readonly GoalView[]
  toasts: readonly { id: string; text: string }[]
  celebration: Celebration | null
  paid: readonly { id: string; title: string; rewardText: string }[]
}

export interface FeedbackFrame {
  rewards: readonly MilestoneReward[]
  celebrations: readonly Celebration[]
  sounds: readonly string[]
  beat: CameraBeat | null
  bubbles: readonly LiveThought[]
}

export const EMPTY_FEEDBACK_VIEW: FeedbackView = {
  goals: [],
  toasts: [],
  celebration: null,
  paid: [],
}

const EMPTY_FRAME: FeedbackFrame = {
  rewards: [],
  celebrations: [],
  sounds: [],
  beat: null,
  bubbles: [],
}

/**
 * Milestone stack, celebrations, thought bubbles, and before/after watches.
 * No rendering and no cash ledger — the host grants rewards and plays sounds.
 */
export class FeedbackSession {
  private primed = false
  private claimed = new Set<string>()
  private memory: CelebrationMemory = { landing: false, hundred: false, airlines: new Set() }
  private thoughts: ThoughtState = emptyThoughts()
  private levers = new Map<string, number>()
  private metrics = new Map<string, number>()
  private watches: EffectWatch[] = []
  private toasts: EffectToast[] = []
  private paid: PaidLine[] = []
  private seq = 1
  private queue: Celebration[] = []
  private active: Celebration | null = null
  private activeUntil = 0
  private listeners = new Set<() => void>()
  private snap: FeedbackView = EMPTY_FEEDBACK_VIEW
  private sig = ''

  reset(): void {
    this.primed = false
    this.claimed = new Set()
    this.memory = { landing: false, hundred: false, airlines: new Set() }
    this.thoughts = emptyThoughts()
    this.levers = new Map()
    this.metrics = new Map()
    this.watches = []
    this.toasts = []
    this.paid = []
    this.seq = 1
    this.queue = []
    this.active = null
    this.activeUntil = 0
    this.snap = EMPTY_FEEDBACK_VIEW
    this.sig = ''
    this.publish(EMPTY_FEEDBACK_VIEW)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): FeedbackView => this.snap

  step(world: FeedbackWorld): FeedbackFrame {
    if (!this.primed) {
      this.prime(world)
      this.primed = true
      this.publish(this.viewOf(world))
      return { ...EMPTY_FRAME, bubbles: this.thoughts.live }
    }

    const rewards = completedMilestones(world, this.claimed)
    for (const reward of rewards) {
      this.claimed.add(reward.id)
      this.paid.push({
        id: reward.id,
        title: reward.title,
        rewardText: reward.rewardText,
        until: world.now + FEEDBACK.celebrationSec,
      })
    }

    const celebrations = detectCelebrations(world, this.memory)
    this.memory = rememberCelebrations(world, this.memory)
    const queued = new Set(this.queue.map((c) => c.id))
    if (this.active) queued.add(this.active.id)
    for (const celebration of celebrations) {
      if (queued.has(celebration.id)) continue
      this.queue.push(celebration)
    }

    this.thoughts = stepThoughts(this.thoughts, world.passengers, world.now)

    const armed = armWatches(world.levers, world.metrics, this.levers, this.metrics, world.now, this.seq)
    this.seq = armed.seq
    this.watches.push(...armed.watches)
    this.remember(world)

    const settled = settleWatches(this.watches, world.metrics, world.now, this.seq)
    this.seq = settled.seq
    this.watches = settled.pending
    this.toasts.push(...settled.toasts)
    this.toasts = this.toasts.filter((toast) => toast.until > world.now).slice(-FEEDBACK.toastLimit)
    this.paid = this.paid.filter((line) => line.until > world.now)

    let beat: CameraBeat | null = null
    if (this.active && world.now >= this.activeUntil) this.active = null
    if (!this.active && this.queue.length > 0) {
      this.active = this.queue.shift() ?? null
      if (this.active) {
        this.activeUntil = world.now + FEEDBACK.celebrationSec
        beat = { id: this.active.id, duration: FEEDBACK.beatSec, dolly: FEEDBACK.beatDolly }
      }
    }

    this.publish(this.viewOf(world))
    return {
      rewards,
      celebrations,
      sounds: celebrations.map((c) => c.sound),
      beat,
      bubbles: this.thoughts.live,
    }
  }

  private prime(world: FeedbackWorld): void {
    // A field that is already past a goal does not pay out again on load.
    for (const reward of completedMilestones(world, this.claimed)) this.claimed.add(reward.id)
    this.memory = {
      landing: world.flightsLanded >= 1,
      hundred: world.passengersServed >= 100,
      airlines: new Set(world.airlines.map((a) => a.id)),
    }
    this.thoughts = emptyThoughts(world.now + FEEDBACK.bubbleSampleEvery)
    this.remember(world)
  }

  private remember(world: FeedbackWorld): void {
    this.levers = new Map(world.levers.map((lever) => [lever.id, lever.value]))
    this.metrics = new Map(world.metrics.map((metric) => [metric.id, metric.value]))
  }

  private viewOf(world: FeedbackWorld): FeedbackView {
    return {
      goals: currentGoals(world, this.claimed),
      toasts: this.toasts.map((toast) => ({ id: toast.id, text: toast.text })),
      celebration: this.active,
      paid: this.paid.map((line) => ({ id: line.id, title: line.title, rewardText: line.rewardText })),
    }
  }

  private publish(view: FeedbackView): void {
    const sig = signature(view)
    if (sig === this.sig) return
    this.sig = sig
    this.snap = view
    for (const listener of this.listeners) listener()
  }
}

function signature(view: FeedbackView): string {
  const goals = view.goals.map((g) => `${g.id}:${g.value}:${g.ratio.toFixed(3)}`).join(',')
  const toasts = view.toasts.map((t) => t.id).join(',')
  const paid = view.paid.map((p) => p.id).join(',')
  return `${goals}|${toasts}|${view.celebration?.id ?? ''}|${paid}`
}
