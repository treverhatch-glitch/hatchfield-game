/**
 * Read-only counters the year-end report polls.
 *
 * PR #70 (hub) and PR #71 (disruptions) are not on trunk. These interfaces
 * default to zero so the card still renders. When those modules call
 * `Game.noteMissedConnectionNights` / `noteHubConnections` / `noteDisruption`,
 * or expose `hubYearSnapshot` / `disruptionYearEvents`, the same card fills in.
 */

export interface DisruptionNote {
  /** Completed game day, 0-based, matching the sim clock. */
  day: number
  /** Disruption id, for example `volcanic-ash` from PR #71. */
  kind: string
  /** Estimated dollars of revenue lost. Finite and ≥ 0. */
  revenueImpact: number
}

export interface DisruptionYearSource {
  events(): readonly DisruptionNote[]
}

export interface HubYearCounts {
  /** Connecting passengers who made the onward flight. */
  completed: number
  /** Connecting passengers who missed. */
  missed: number
  /** Overnight hotel nights billed for misses. */
  nights: number
}

export interface HubYearSource {
  completed(): number
  missed(): number
  nights(): number
}

export interface YearAwardInput {
  id: string
  name: string
  year: number
  prestige?: number
  reputation?: number
  /** When set, this one-liner wins over the built-in award copy. */
  reason?: string
}

export interface AwardYearSource {
  awards(): readonly YearAwardInput[]
}

export interface YearFinanceEntry {
  category: string
  amount: number
}

/** Optional probes a later merge can hang on Game without editing this report. */
export interface YearProbes {
  hubYearSnapshot?: () => Partial<HubYearCounts> | null | undefined
  disruptionYearEvents?: () => readonly DisruptionNote[] | null | undefined
  tycoonAwardsThisYear?: () => readonly YearAwardInput[] | null | undefined
  noteMissedConnectionNights?: (nights: number) => void
}

export const ZERO_HUB: HubYearCounts = { completed: 0, missed: 0, nights: 0 }

export const ZERO_DISRUPTION_SOURCE: DisruptionYearSource = { events: () => [] }

export const ZERO_HUB_SOURCE: HubYearSource = {
  completed: () => 0,
  missed: () => 0,
  nights: () => 0,
}

export const ZERO_AWARD_SOURCE: AwardYearSource = { awards: () => [] }

export function finiteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? n : fallback
}

/** Whole number ≥ 0. Non-finite and negatives become 0. */
export function finiteCount(value: unknown): number {
  return Math.max(0, Math.round(finiteNumber(value, 0)))
}

export function clampScore(value: unknown): number {
  return Math.max(0, Math.min(100, Math.round(finiteNumber(value, 0))))
}

function safeCall<T>(read: () => T, fallback: T): T {
  try {
    return read()
  } catch {
    return fallback
  }
}

export function pollDisruptions(source: DisruptionYearSource | null | undefined): DisruptionNote[] {
  if (!source || typeof source.events !== 'function') return []
  const raw = safeCall(() => source.events(), [])
  if (!Array.isArray(raw)) return []
  const notes: DisruptionNote[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const kind = typeof item.kind === 'string' ? item.kind.trim() : ''
    if (!kind) continue
    notes.push({
      day: Math.max(0, Math.floor(finiteNumber(item.day, 0))),
      kind,
      revenueImpact: finiteCount(item.revenueImpact),
    })
  }
  return notes
}

export function pollHub(source: HubYearSource | null | undefined): HubYearCounts {
  if (!source) return { ...ZERO_HUB }
  return {
    completed: finiteCount(safeCall(() => source.completed(), 0)),
    missed: finiteCount(safeCall(() => source.missed(), 0)),
    nights: finiteCount(safeCall(() => source.nights(), 0)),
  }
}

export function pollAwards(source: AwardYearSource | null | undefined): YearAwardInput[] {
  if (!source || typeof source.awards !== 'function') return []
  const raw = safeCall(() => source.awards(), [])
  if (!Array.isArray(raw)) return []
  const awards: YearAwardInput[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    const reason = typeof item.reason === 'string' ? item.reason.trim() : ''
    awards.push({
      id,
      name,
      year: Math.max(1, Math.round(finiteNumber(item.year, 1))),
      prestige: finiteCount(item.prestige),
      reputation: finiteNumber(item.reputation, 0),
      ...(reason ? { reason } : {}),
    })
  }
  return awards
}

/**
 * Record hotel nights when the host implements the hook.
 * A field with no hook (trunk before PR #70 is wired) is a no-op.
 */
export function recordMissedConnectionNights(
  host: { noteMissedConnectionNights?: (nights: number) => void } | null | undefined,
  nights: number,
): void {
  if (!host || typeof host.noteMissedConnectionNights !== 'function') return
  host.noteMissedConnectionNights(finiteCount(nights))
}

export function snapshotDisruptionSource(events: readonly DisruptionNote[]): DisruptionYearSource {
  const copy = events.map((event) => ({ ...event }))
  return { events: () => copy }
}

export function snapshotHubSource(counts: HubYearCounts): HubYearSource {
  const copy = { ...counts }
  return {
    completed: () => copy.completed,
    missed: () => copy.missed,
    nights: () => copy.nights,
  }
}

export function snapshotAwardSource(awards: readonly YearAwardInput[]): AwardYearSource {
  const copy = awards.map((award) => ({ ...award }))
  return { awards: () => copy }
}
