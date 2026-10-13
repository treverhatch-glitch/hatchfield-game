/**
 * Alerts — live operational problems, separate from layout hints.
 * A stuck aircraft, a dry fuel farm, a hall over capacity, bins overflowing,
 * a failed inbound, cash running out. Pure; the sim raises, the stack UI reads.
 *
 * Duplicates are debounced by key: raising a key that is already showing
 * bumps its count instead of adding a row, and a dismissed key stays quiet
 * for a while. "Ignore" silences a key until the problem clears.
 */
import type { AdviceCell } from './advisor.ts'
import { ALERT_TUNING } from './alertsData.ts'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export const ALERT_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }

export interface AlertFocus {
  view: 'apron' | 'hall'
  cells: AdviceCell[]
  /** Hall key (`c,r` of the stamp) for hall alerts. */
  hall?: string
}

export interface AlertInput {
  /** Debounce key. One row per key. */
  key: string
  severity: AlertSeverity
  title: string
  detail: string
  at?: AlertFocus
  /** Condition alerts stay until cleared; event alerts fade after `eventTtlSec`. */
  event?: boolean
}

export interface Alert extends AlertInput {
  id: string
  raisedAt: number
  lastAt: number
  /** Times this key was raised while showing. */
  count: number
}

export interface AlertTuning {
  dismissQuietSec: number
  eventTtlSec: number
}

export class AlertStack {
  active: Alert[] = []
  minimised = false
  /** Bumped on every change, so the UI can cheaply tell when to redraw. */
  rev = 0
  private quietUntil = new Map<string, number>()
  private ignored = new Set<string>()
  private seq = 0
  private readonly tune: AlertTuning

  constructor(tune: Partial<AlertTuning> = {}) {
    this.tune = { dismissQuietSec: ALERT_TUNING.dismissQuietSec, eventTtlSec: ALERT_TUNING.eventTtlSec, ...tune }
  }

  /** Raise or refresh. Returns the row, or null when debounced, ignored, or quiet. */
  raise(input: AlertInput, now: number): Alert | null {
    if (this.ignored.has(input.key)) return null
    const cur = this.active.find((a) => a.key === input.key)
    if (cur) {
      const worse = ALERT_RANK[input.severity] < ALERT_RANK[cur.severity]
      const changed = worse || cur.detail !== input.detail
      Object.assign(cur, { ...input, severity: worse ? input.severity : cur.severity, lastAt: now })
      if (input.event) cur.count += 1
      if (changed || input.event) this.rev++
      return cur
    }
    if ((this.quietUntil.get(input.key) ?? -Infinity) > now) return null
    this.quietUntil.delete(input.key)
    const alert: Alert = { ...input, id: `al${++this.seq}`, raisedAt: now, lastAt: now, count: 1 }
    this.active.push(alert)
    this.rev++
    return alert
  }

  /** The problem is gone: drop the row and forget any ignore or quiet timer. */
  clear(key: string): void {
    const n = this.active.length
    this.active = this.active.filter((a) => a.key !== key)
    const had = this.ignored.delete(key) || this.quietUntil.delete(key)
    if (n !== this.active.length || had) this.rev++
  }

  /**
   * Keep condition alerts under `prefix` in step with what is true now:
   * any key under it that is not in `live` is cleared.
   */
  sync(prefix: string, live: ReadonlySet<string>): void {
    const keys = new Set<string>()
    for (const a of this.active) if (!a.event && a.key.startsWith(prefix)) keys.add(a.key)
    for (const k of this.ignored) if (k.startsWith(prefix)) keys.add(k)
    for (const k of this.quietUntil.keys()) if (k.startsWith(prefix)) keys.add(k)
    for (const k of keys) if (!live.has(k)) this.clear(k)
  }

  /** Close one row. It may return after the quiet window if the problem is still live. */
  dismiss(id: string, now: number): void {
    const a = this.active.find((x) => x.id === id)
    if (!a) return
    this.active = this.active.filter((x) => x.id !== id)
    this.quietUntil.set(a.key, now + this.tune.dismissQuietSec)
    this.rev++
  }

  /** Close one row and stay silent about that problem until it clears. */
  ignore(id: string): void {
    const a = this.active.find((x) => x.id === id)
    if (!a) return
    this.active = this.active.filter((x) => x.id !== id)
    this.ignored.add(a.key)
    this.rev++
  }

  setMinimised(on: boolean): void {
    if (this.minimised === on) return
    this.minimised = on
    this.rev++
  }

  /** Fade old event rows. Call from the sim tick. */
  tick(now: number): void {
    const before = this.active.length
    this.active = this.active.filter((a) => !a.event || now - a.lastAt < this.tune.eventTtlSec)
    if (before !== this.active.length) this.rev++
  }

  /** Worst first, newest first within a severity. */
  ranked(): Alert[] {
    return [...this.active].sort(
      (a, b) => ALERT_RANK[a.severity] - ALERT_RANK[b.severity] || b.raisedAt - a.raisedAt,
    )
  }

  get count(): number {
    return this.active.length
  }

  reset(): void {
    this.active = []
    this.minimised = false
    this.quietUntil.clear()
    this.ignored.clear()
    this.rev++
  }
}
