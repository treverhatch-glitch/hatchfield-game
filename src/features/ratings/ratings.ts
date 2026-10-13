/**
 * Airline satisfaction ratings. Each airline scores the airport 0..100 from
 * punctuality, turnaround, fees and passenger mood (smoothed). Sustained low
 * scores raise a "threat to leave"; sustained high scores raise a "more slots"
 * request. Both are non-blocking notifications.
 */
import type { NewNotification } from '../notifications/queue.ts'
import { clamp } from '../shared/rng.ts'

export interface AirlinePeriodStats {
  airline: string
  /** 0..1 share of on-time departures. */
  punctuality: number
  /** Actual / target turnaround minutes (1 = on target, >1 slower). */
  turnaroundRatio: number
  /** Our fee / the airline's acceptable fee (1 = fair, >1 expensive). */
  feeRatio: number
  /** 0..100 average mood of this airline's passengers. */
  passengerMood: number
}

export interface RatingWeights { punctuality: number; turnaround: number; fees: number; mood: number }
export const DEFAULT_WEIGHTS: RatingWeights = { punctuality: 0.35, turnaround: 0.25, fees: 0.2, mood: 0.2 }

export interface RatingConfig {
  weights: RatingWeights
  /** Exponential smoothing factor for new samples (0..1). */
  smoothing: number
  threatBelow: number
  requestAbove: number
  /** Consecutive periods required before a notification fires. */
  streak: number
  /** Periods to wait after a notification before the same airline can fire again. */
  cooldown: number
}
export const DEFAULT_RATING_CONFIG: RatingConfig = {
  weights: DEFAULT_WEIGHTS, smoothing: 0.4, threatBelow: 40, requestAbove: 80, streak: 2, cooldown: 4,
}

export interface AirlineRating {
  airline: string
  score: number
  components: { punctuality: number; turnaround: number; fees: number; mood: number }
  lowStreak: number
  highStreak: number
  cooldown: number
}

export type RatingSignal =
  | { type: 'threat'; airline: string; score: number; worst: keyof AirlineRating['components'] }
  | { type: 'slotRequest'; airline: string; score: number; extraSlots: number }

/** Pure: 0..100 score for one period. */
export function scorePeriod(s: AirlinePeriodStats, w: RatingWeights = DEFAULT_WEIGHTS): AirlineRating['components'] & { total: number } {
  const punctuality = clamp(s.punctuality, 0, 1) * 100
  const turnaround = clamp(100 - (s.turnaroundRatio - 1) * 200, 0, 100)
  const fees = clamp(100 - (s.feeRatio - 1) * 150, 0, 100)
  const mood = clamp(s.passengerMood, 0, 100)
  const sum = w.punctuality + w.turnaround + w.fees + w.mood
  const total = (punctuality * w.punctuality + turnaround * w.turnaround + fees * w.fees + mood * w.mood) / sum
  return { punctuality, turnaround, fees, mood, total: Math.round(total * 10) / 10 }
}

export class AirlineRatings {
  private ratings = new Map<string, AirlineRating>()
  private readonly cfg: RatingConfig
  constructor(cfg: Partial<RatingConfig> = {}) {
    this.cfg = { ...DEFAULT_RATING_CONFIG, ...cfg }
  }

  get(airline: string): AirlineRating | undefined { return this.ratings.get(airline) }
  all(): AirlineRating[] { return [...this.ratings.values()].sort((a, b) => b.score - a.score) }

  /** Feed one period of stats per airline (e.g. weekly). Returns any signals raised. */
  update(stats: AirlinePeriodStats[]): RatingSignal[] {
    const out: RatingSignal[] = []
    for (const s of stats) {
      const p = scorePeriod(s, this.cfg.weights)
      const prev = this.ratings.get(s.airline)
      const a = this.cfg.smoothing
      const score = prev ? Math.round((prev.score * (1 - a) + p.total * a) * 10) / 10 : p.total
      const r: AirlineRating = {
        airline: s.airline, score,
        components: { punctuality: p.punctuality, turnaround: p.turnaround, fees: p.fees, mood: p.mood },
        lowStreak: score < this.cfg.threatBelow ? (prev?.lowStreak ?? 0) + 1 : 0,
        highStreak: score > this.cfg.requestAbove ? (prev?.highStreak ?? 0) + 1 : 0,
        cooldown: Math.max(0, (prev?.cooldown ?? 0) - 1),
      }
      if (r.cooldown === 0) {
        if (r.lowStreak >= this.cfg.streak) {
          const comps = Object.entries(r.components) as [keyof AirlineRating['components'], number][]
          const worst = comps.sort((x, y) => x[1] - y[1])[0][0]
          out.push({ type: 'threat', airline: s.airline, score, worst })
          r.cooldown = this.cfg.cooldown
        } else if (r.highStreak >= this.cfg.streak) {
          out.push({ type: 'slotRequest', airline: s.airline, score, extraSlots: score > 90 ? 2 : 1 })
          r.cooldown = this.cfg.cooldown
        }
      }
      this.ratings.set(s.airline, r)
    }
    return out
  }

  /** Apply a player's response to adjust standing (e.g. fee cut, granted slots). */
  adjust(airline: string, delta: number): void {
    const r = this.ratings.get(airline)
    if (r) r.score = clamp(r.score + delta, 0, 100)
  }
}

const WORST_TEXT: Record<keyof AirlineRating['components'], string> = {
  punctuality: 'too many delays', turnaround: 'slow turnarounds', fees: 'fees are too high', mood: 'unhappy passengers',
}

export function ratingNotification(sig: RatingSignal, now: number, ttl: number): NewNotification<RatingSignal> {
  if (sig.type === 'threat') {
    return {
      kind: 'rating', priority: 'high',
      title: `${sig.airline} may leave`,
      summary: `Rating ${sig.score}/100: ${WORST_TEXT[sig.worst]}.`,
      expiresAt: now + ttl,
      choices: [
        { id: 'discount', label: 'Offer 10% fee discount', hint: '+rating, -income' },
        { id: 'promise', label: 'Promise improvements', hint: 'small +rating' },
        { id: 'ignore', label: 'Ignore', hint: 'risk losing the airline' },
      ],
      defaultChoiceId: 'ignore',
      payload: sig,
    }
  }
  return {
    kind: 'rating', priority: 'normal',
    title: `${sig.airline} wants more slots`,
    summary: `Rating ${sig.score}/100. Requesting ${sig.extraSlots} extra daily slot${sig.extraSlots > 1 ? 's' : ''}.`,
    expiresAt: now + ttl,
    choices: [
      { id: 'accept', label: 'Grant slots', hint: '+income, +rating' },
      { id: 'decline', label: 'Decline', hint: 'small -rating' },
    ],
    defaultChoiceId: 'decline',
    payload: sig,
  }
}

/** Standing change the sim should apply for each response. */
export const RESPONSE_EFFECT: Record<string, number> = { discount: 12, promise: 4, ignore: -8, accept: 6, decline: -3 }
