/**
 * Stuck-flight watchdog. Pure: no rendering, no Game, no three.js.
 *
 * The host samples flights, aircraft, and vehicles whose state is not progressing
 * and applies the returned step. Steps always run in order, one per observation:
 * re-path, release the reservation, teleport to a safe node, cancel with a refund.
 */
import { STUCK_WATCH, stuckLadderMin, stuckLimitMin } from './stuckWatchdogData.ts'

export type WatchKind = 'flight' | 'aircraft' | 'vehicle'
export type RecoveryStep = 'repath' | 'release' | 'teleport' | 'cancel'

export const RECOVERY_STEPS: readonly RecoveryStep[] = ['repath', 'release', 'teleport', 'cancel']

export interface WatchSample {
  id: string
  kind: WatchKind
  /** Phase or vehicle mission. Selects the stall limit. */
  state: string
  /** Unchanged token means the entity has not progressed. */
  token: string
  nowMin: number
  label: string
}

export interface RecoveryAction {
  id: string
  kind: WatchKind
  state: string
  step: RecoveryStep
  label: string
}

export interface RecoveryLogEntry {
  atMin: number
  id: string
  label: string
  kind: WatchKind
  state: string
  step: RecoveryStep
  detail: string
}

export interface StuckStrike {
  id: string
  kind: WatchKind
  state: string
  label: string
  /** Sim minutes since the token last changed, or since the previous step. */
  stalledMin: number
  /** Recovery steps already issued for this episode. */
  strikes: number
}

interface Track {
  token: string
  sinceMin: number
  strikes: number
  kind: WatchKind
  state: string
  label: string
  id: string
}

export class StuckWatchdog {
  private tracks = new Map<string, Track>()

  /**
   * Advance every sample to `nowMin`. The first time an entity is seen it is
   * only remembered; a later call fires at most one step if the token is unchanged.
   * A token change keeps the strike count (so a failed re-path still escalates)
   * but restarts the wait. Entities missing from `samples` are forgotten.
   */
  observe(samples: readonly WatchSample[]): RecoveryAction[] {
    const seen = new Set<string>()
    const actions: RecoveryAction[] = []
    for (const sample of samples) {
      const key = trackKey(sample.kind, sample.id)
      seen.add(key)
      let row = this.tracks.get(key)
      if (!row) {
        this.tracks.set(key, {
          token: sample.token,
          sinceMin: sample.nowMin,
          strikes: 0,
          kind: sample.kind,
          state: sample.state,
          label: sample.label,
          id: sample.id,
        })
        continue
      }
      row.kind = sample.kind
      row.state = sample.state
      row.label = sample.label
      if (row.token !== sample.token) {
        row.token = sample.token
        row.sinceMin = sample.nowMin
        continue
      }
      if (row.strikes >= RECOVERY_STEPS.length) continue
      const wait = row.strikes === 0 ? stuckLimitMin(sample.state) : STUCK_WATCH.stepMin
      if (sample.nowMin < row.sinceMin + wait) continue
      const step = RECOVERY_STEPS[row.strikes]
      row.strikes += 1
      row.sinceMin = sample.nowMin
      actions.push({
        id: sample.id,
        kind: sample.kind,
        state: sample.state,
        step,
        label: sample.label,
      })
    }
    for (const key of this.tracks.keys()) {
      if (!seen.has(key)) this.tracks.delete(key)
    }
    return actions
  }

  /**
   * Entities the ladder has already cancelled that are still present, or entities
   * that stayed frozen past the point where the next step should have fired.
   */
  outstanding(nowMin: number): StuckStrike[] {
    const out: StuckStrike[] = []
    for (const row of this.tracks.values()) {
      const stalledMin = Math.max(0, nowMin - row.sinceMin)
      const wait = row.strikes === 0 ? stuckLimitMin(row.state) : STUCK_WATCH.stepMin
      const missed = row.strikes < RECOVERY_STEPS.length && stalledMin >= wait + STUCK_WATCH.stepMin
      if (row.strikes < RECOVERY_STEPS.length && !missed) continue
      if (row.strikes >= RECOVERY_STEPS.length || missed) {
        out.push({
          id: row.id,
          kind: row.kind,
          state: row.state,
          label: row.label,
          stalledMin,
          strikes: row.strikes,
        })
      }
    }
    return out
  }

  /** Sim-minute budget of the full ladder for a state. Exposed for tests. */
  ladderMin(state: string): number {
    return stuckLadderMin(state)
  }
}

function trackKey(kind: WatchKind, id: string): string {
  return `${kind}:${id}`
}
