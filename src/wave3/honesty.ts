import { LATE_DEPARTURE_GAME_MIN } from './config.ts'

/**
 * Landing relationship factor.
 * Wave 3 owns it. Diplomacy capacity is a slot count, not a second fee.
 */
export function relationshipLandingFactor(wave3FeeMult: number): number {
  const factor = Number.isFinite(wave3FeeMult) ? wave3FeeMult : 1
  return factor > 0 ? factor : 1
}

export function relationshipFeeLine(feeMult: number, label: string): string {
  return `Relationship fee ×${relationshipLandingFactor(feeMult).toFixed(2)} · ${label}`
}

export function extraSlotLine(extraSlots: number): string {
  const n = Math.max(0, Math.floor(extraSlots))
  return n === 0 ? 'Extra slots · 0' : `Extra slots · +${n} on the timetable`
}

const LATE_TURN_GRADES = new Set(['C', 'D', 'E', 'F'])

/**
 * One score per finished turn.
 * Cancel is a scrub or a divert. Weather excuses a cancel.
 * Delay is a late pushback or a turnaround grade of C or worse.
 * Arrival schedule slip is not an input.
 */
export function classifyTurn(input: {
  cancelled?: boolean
  diverted?: boolean
  excused?: boolean
  grade?: string | null
  departureLateMin?: number
}): 'success' | 'delay' | 'cancel' | null {
  if (input.cancelled || input.diverted) {
    if (input.excused) return null
    return 'cancel'
  }
  const lateGrade = input.grade != null && LATE_TURN_GRADES.has(input.grade)
  const lateDep = (input.departureLateMin ?? 0) > LATE_DEPARTURE_GAME_MIN
  if (lateGrade || lateDep) return 'delay'
  return 'success'
}
