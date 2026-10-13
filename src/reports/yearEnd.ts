/**
 * PLAYTEST B6 year-end sections.
 *
 * Composes with:
 * - PR #63 year report: pass that `YearReport` to `mergePlaytestAndTycoon`
 *   (finance, best/worst, awards). Award ids use the one-liners in config.
 * - PR #70 hub: poll `HubYearSource`, or `Game.noteMissedConnectionNights`
 *   / `noteHubConnections`. Missing hooks read as zero.
 * - PR #71 disruptions: poll `DisruptionYearSource` or `noteDisruption`.
 *   Kind labels match the disruption catalog; unknown kinds still list.
 */
import {
  AWARD_REASONS,
  DISRUPTION_LABELS,
  PLAYTEST_YEAR_DAYS,
  YEAR_COST_HEAVY,
  YEAR_EXCLUDED_CATEGORIES,
  YEAR_PAX_GOOD,
  YEAR_REVENUE_GOOD,
} from './config.ts'
import {
  ZERO_AWARD_SOURCE,
  ZERO_DISRUPTION_SOURCE,
  ZERO_HUB_SOURCE,
  clampScore,
  finiteCount,
  finiteNumber,
  pollAwards,
  pollDisruptions,
  pollHub,
  snapshotAwardSource,
  snapshotDisruptionSource,
  snapshotHubSource,
  type AwardYearSource,
  type DisruptionNote,
  type DisruptionYearSource,
  type HubYearCounts,
  type HubYearSource,
  type YearAwardInput,
  type YearFinanceEntry,
  type YearProbes,
} from './sources.ts'

const EXCLUDED = new Set<string>(YEAR_EXCLUDED_CATEGORIES)

export interface YearMetric {
  id: 'revenue' | 'costs' | 'passengers' | 'satisfaction'
  label: string
  value: number
  /** 0–100, higher is better, so costs invert. */
  score: number
}

export interface DisruptionTypeLine {
  kind: string
  label: string
  count: number
  revenueImpact: number
}

export interface WorstDisruptionDay {
  /** 0-based completed day. */
  day: number
  count: number
  revenueImpact: number
}

export interface DisruptionYearSummary {
  byType: DisruptionTypeLine[]
  totalCount: number
  revenueImpact: number
  worstDay: WorstDisruptionDay | null
}

export interface AwardLine {
  id: string
  name: string
  year: number
  prestige: number
  reputation: number
  reason: string
}

export interface YearSectionLine {
  id: string
  label: string
  value: string
  detail?: string
}

export interface YearSectionView {
  id: 'finance' | 'disruptions' | 'hub' | 'awards'
  title: string
  lines: YearSectionLine[]
  /** Set when the section has nothing earned or nothing happened. */
  emptyNote: string | null
}

export interface PlaytestYearReport {
  year: number
  fromDay: number
  toDay: number
  revenue: number
  costs: number
  net: number
  passengers: number
  satisfaction: number
  cleanliness: number
  best: YearMetric
  worst: YearMetric
  /** Raw notes, so a merge with PR #63 keeps the worst day. */
  disruptionNotes: DisruptionNote[]
  disruptions: DisruptionYearSummary
  hub: HubYearCounts
  awards: AwardLine[]
  sections: YearSectionView[]
}

export interface YearFinanceInput {
  year: number
  fromDay: number
  toDay: number
  revenue: number
  costs: number
  /** When omitted, net is revenue − costs. */
  net?: number
  passengers?: number
  satisfaction?: number
  cleanliness?: number
  best?: YearMetric
  worst?: YearMetric
}

export interface PlaytestYearInput extends YearFinanceInput {
  disruptions?: DisruptionYearSource | null
  hub?: HubYearSource | null
  awards?: AwardYearSource | null
}

/** Shape of PR #63 `YearReport`. Extra fields are ignored. */
export interface TycoonYearLike {
  year: number
  fromDay: number
  toDay: number
  revenue: number
  costs: number
  net: number
  passengers: number
  satisfaction: number
  cleanliness?: number
  best?: YearMetric
  worst?: YearMetric
  awards?: readonly YearAwardInput[]
}

export function formatReportMoney(n: number): string {
  const rounded = Math.round(finiteNumber(n, 0))
  const sign = rounded < 0 ? '-' : ''
  return `${sign}$${Math.abs(rounded).toLocaleString('en-US')}`
}

export function disruptionLabel(kind: string): string {
  const known = DISRUPTION_LABELS[kind]
  if (known) return known
  return kind
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function awardReason(award: Pick<YearAwardInput, 'id' | 'name' | 'reason'>): string {
  const custom = typeof award.reason === 'string' ? award.reason.trim() : ''
  if (custom) return custom
  const known = AWARD_REASONS[award.id]
  if (known) return known
  const name = award.name.trim()
  return name ? `${name} earned this year.` : 'Award earned this year.'
}

/** Lean years score well. Spending more than you earned does not. */
export function costScore(costs: number, revenue: number): number {
  const spent = Math.max(0, finiteNumber(costs, 0))
  const earned = finiteNumber(revenue, 0)
  if (spent <= 0 && earned <= 0) return 50
  if (earned > 0) return clampScore(100 - (spent / earned) * 50)
  return clampScore(100 - (spent / YEAR_COST_HEAVY) * 100)
}

export function operatingTotals(entries: readonly YearFinanceEntry[] | null | undefined): {
  revenue: number
  costs: number
} {
  let revenue = 0
  let costs = 0
  if (!entries) return { revenue, costs }
  for (const entry of entries) {
    if (!entry || EXCLUDED.has(entry.category)) continue
    const amount = finiteNumber(entry.amount, 0)
    if (amount > 0) revenue += amount
    else if (amount < 0) costs += -amount
  }
  return { revenue: Math.round(revenue), costs: Math.round(costs) }
}

export function scoreYear(figures: {
  revenue: number
  costs: number
  passengers: number
  satisfaction: number
}): { best: YearMetric; worst: YearMetric; metrics: YearMetric[] } {
  const metrics: YearMetric[] = [
    {
      id: 'revenue',
      label: 'Revenue',
      value: Math.round(figures.revenue),
      score: clampScore((figures.revenue / YEAR_REVENUE_GOOD) * 100),
    },
    {
      id: 'costs',
      label: 'Costs',
      value: Math.round(figures.costs),
      score: costScore(figures.costs, figures.revenue),
    },
    {
      id: 'passengers',
      label: 'Passengers',
      value: Math.round(figures.passengers),
      score: clampScore((figures.passengers / YEAR_PAX_GOOD) * 100),
    },
    {
      id: 'satisfaction',
      label: 'Satisfaction',
      value: Math.round(figures.satisfaction),
      score: clampScore(figures.satisfaction),
    },
  ]
  const ranked = [...metrics].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  return { best: ranked[0] ?? metrics[0], worst: ranked[ranked.length - 1] ?? metrics[0], metrics }
}

export function summarizeDisruptions(notes: readonly DisruptionNote[]): DisruptionYearSummary {
  const byKind = new Map<string, DisruptionTypeLine>()
  const byDay = new Map<number, WorstDisruptionDay>()
  for (const note of notes) {
    const kindLine = byKind.get(note.kind) ?? {
      kind: note.kind,
      label: disruptionLabel(note.kind),
      count: 0,
      revenueImpact: 0,
    }
    kindLine.count += 1
    kindLine.revenueImpact += note.revenueImpact
    byKind.set(note.kind, kindLine)
    const dayLine = byDay.get(note.day) ?? { day: note.day, count: 0, revenueImpact: 0 }
    dayLine.count += 1
    dayLine.revenueImpact += note.revenueImpact
    byDay.set(note.day, dayLine)
  }
  const byType = [...byKind.values()].sort(
    (a, b) => b.count - a.count || b.revenueImpact - a.revenueImpact || a.label.localeCompare(b.label),
  )
  let totalCount = 0
  let revenueImpact = 0
  for (const line of byType) {
    totalCount += line.count
    revenueImpact += line.revenueImpact
  }
  const worstDay =
    [...byDay.values()].sort(
      (a, b) => b.revenueImpact - a.revenueImpact || b.count - a.count || a.day - b.day,
    )[0] ?? null
  return { byType, totalCount, revenueImpact, worstDay }
}

function listAwards(raw: readonly YearAwardInput[], fallbackYear: number): AwardLine[] {
  return raw.map((award) => ({
    id: award.id,
    name: award.name,
    year: award.year > 0 ? award.year : fallbackYear,
    prestige: finiteCount(award.prestige),
    reputation: Math.round(finiteNumber(award.reputation, 0)),
    reason: awardReason(award),
  }))
}

function financeLines(report: {
  revenue: number
  costs: number
  net: number
  passengers: number
  satisfaction: number
  cleanliness: number
  best: YearMetric
  worst: YearMetric
}): YearSectionLine[] {
  return [
    { id: 'revenue', label: 'Revenue', value: formatReportMoney(report.revenue) },
    { id: 'costs', label: 'Costs', value: formatReportMoney(report.costs) },
    { id: 'net', label: 'Net', value: formatReportMoney(report.net) },
    { id: 'passengers', label: 'Passengers', value: report.passengers.toLocaleString('en-US') },
    { id: 'satisfaction', label: 'Satisfaction', value: String(report.satisfaction) },
    { id: 'cleanliness', label: 'Cleanliness', value: String(report.cleanliness) },
    { id: 'best', label: 'Best', value: `${report.best.label} (${report.best.score})` },
    { id: 'worst', label: 'Worst', value: `${report.worst.label} (${report.worst.score})` },
  ]
}

function disruptionLines(summary: DisruptionYearSummary): YearSectionLine[] {
  const lines: YearSectionLine[] = summary.byType.map((line) => ({
    id: line.kind,
    label: line.label,
    value: String(line.count),
    detail: `Estimated impact ${formatReportMoney(line.revenueImpact)}`,
  }))
  lines.push({
    id: 'impact',
    label: 'Revenue impact',
    value: formatReportMoney(summary.revenueImpact),
  })
  lines.push({
    id: 'worst-day',
    label: 'Worst day',
    value: summary.worstDay
      ? `Day ${summary.worstDay.day + 1} · ${formatReportMoney(summary.worstDay.revenueImpact)}`
      : '—',
  })
  return lines
}

function hubLines(hub: HubYearCounts): YearSectionLine[] {
  return [
    { id: 'completed', label: 'Connections completed', value: hub.completed.toLocaleString('en-US') },
    { id: 'missed', label: 'Missed connections', value: hub.missed.toLocaleString('en-US') },
    { id: 'nights', label: 'Hotel nights', value: hub.nights.toLocaleString('en-US') },
  ]
}

function awardLines(awards: readonly AwardLine[]): YearSectionLine[] {
  return awards.map((award) => ({
    id: award.id,
    label: award.name,
    value: `prestige +${award.prestige}`,
    detail: award.reason,
  }))
}

export function buildYearSections(report: Omit<PlaytestYearReport, 'sections'>): YearSectionView[] {
  return [
    {
      id: 'finance',
      title: 'Financial summary',
      lines: financeLines(report),
      emptyNote: null,
    },
    {
      id: 'disruptions',
      title: 'Disruptions',
      lines: disruptionLines(report.disruptions),
      emptyNote: report.disruptions.totalCount === 0 ? 'No disruptions this year.' : null,
    },
    {
      id: 'hub',
      title: 'Hub connections',
      lines: hubLines(report.hub),
      emptyNote:
        report.hub.completed === 0 && report.hub.missed === 0 && report.hub.nights === 0
          ? 'No connecting passengers this year.'
          : null,
    },
    {
      id: 'awards',
      title: 'Awards',
      lines: awardLines(report.awards),
      emptyNote: report.awards.length === 0 ? 'No award this year.' : null,
    },
  ]
}

function normalizeWindow(input: YearFinanceInput): { year: number; fromDay: number; toDay: number } {
  const fromDay = Math.max(0, Math.floor(finiteNumber(input.fromDay, 0)))
  let toDay = Math.floor(finiteNumber(input.toDay, fromDay + PLAYTEST_YEAR_DAYS))
  if (!Number.isFinite(input.toDay) || toDay <= fromDay) toDay = fromDay + PLAYTEST_YEAR_DAYS
  let year = Math.round(finiteNumber(input.year, 0))
  if (year < 1) year = Math.floor(fromDay / PLAYTEST_YEAR_DAYS) + 1
  return { year, fromDay, toDay }
}

function resolveAwards(
  source: AwardYearSource | null | undefined,
  probes: YearProbes | null | undefined,
  year: number,
): AwardLine[] {
  const fromSource = pollAwards(source)
  if (fromSource.length) return listAwards(fromSource, year)
  if (probes && typeof probes.tycoonAwardsThisYear === 'function') {
    try {
      const remote = probes.tycoonAwardsThisYear()
      return listAwards(pollAwards(snapshotAwardSource(Array.isArray(remote) ? remote : [])), year)
    } catch {
      return []
    }
  }
  return []
}

function resolveHub(
  source: HubYearSource | null | undefined,
  probes: YearProbes | null | undefined,
): HubYearCounts {
  const local = pollHub(source ?? ZERO_HUB_SOURCE)
  if (!probes || typeof probes.hubYearSnapshot !== 'function') return local
  let remote: Partial<HubYearCounts> | null | undefined
  try {
    remote = probes.hubYearSnapshot()
  } catch {
    return local
  }
  if (!remote) return local
  return {
    completed: remote.completed === undefined ? local.completed : finiteCount(remote.completed),
    missed: remote.missed === undefined ? local.missed : finiteCount(remote.missed),
    nights: remote.nights === undefined ? local.nights : finiteCount(remote.nights),
  }
}

function resolveDisruptions(
  source: DisruptionYearSource | null | undefined,
  probes: YearProbes | null | undefined,
): DisruptionNote[] {
  const local = pollDisruptions(source ?? ZERO_DISRUPTION_SOURCE)
  if (!probes || typeof probes.disruptionYearEvents !== 'function') return local
  let remote: readonly DisruptionNote[] | null | undefined
  try {
    remote = probes.disruptionYearEvents()
  } catch {
    return local
  }
  const remoteNotes = pollDisruptions(snapshotDisruptionSource(Array.isArray(remote) ? remote : []))
  return remoteNotes.length ? remoteNotes : local
}

export function buildPlaytestYearReport(input: PlaytestYearInput, probes?: YearProbes | null): PlaytestYearReport {
  const window = normalizeWindow(input)
  const revenue = Math.max(0, Math.round(finiteNumber(input.revenue, 0)))
  const costs = Math.max(0, Math.round(finiteNumber(input.costs, 0)))
  const net = input.net === undefined ? revenue - costs : Math.round(finiteNumber(input.net, revenue - costs))
  const passengers = finiteCount(input.passengers)
  const satisfaction = clampScore(input.satisfaction)
  const cleanliness = clampScore(input.cleanliness)
  const scored =
    input.best && input.worst
      ? { best: input.best, worst: input.worst }
      : scoreYear({ revenue, costs, passengers, satisfaction })
  const disruptionNotes = resolveDisruptions(input.disruptions, probes)
  const disruptions = summarizeDisruptions(disruptionNotes)
  const hub = resolveHub(input.hub, probes)
  const awards = resolveAwards(input.awards ?? ZERO_AWARD_SOURCE, probes, window.year)
  const body = {
    ...window,
    revenue,
    costs,
    net,
    passengers,
    satisfaction,
    cleanliness,
    best: scored.best,
    worst: scored.worst,
    disruptionNotes,
    disruptions,
    hub,
    awards,
  }
  return { ...body, sections: buildYearSections(body) }
}

/**
 * Keep PR #63's year figures and awards, and attach disruption / hub sections.
 * Hub and disruption sources default to zero when those modules are absent.
 */
export function mergePlaytestAndTycoon(
  playtest: PlaytestYearReport | null | undefined,
  tycoon: TycoonYearLike | null | undefined,
): PlaytestYearReport | null {
  if (!tycoon) return playtest ?? null
  const sameYear = !!playtest && playtest.year === Math.max(1, Math.round(finiteNumber(tycoon.year, 1)))
  return buildPlaytestYearReport({
    year: tycoon.year,
    fromDay: tycoon.fromDay,
    toDay: tycoon.toDay,
    revenue: tycoon.revenue,
    costs: tycoon.costs,
    net: tycoon.net,
    passengers: tycoon.passengers,
    satisfaction: tycoon.satisfaction,
    cleanliness: tycoon.cleanliness ?? playtest?.cleanliness,
    best: tycoon.best,
    worst: tycoon.worst,
    awards: snapshotAwardSource(tycoon.awards ?? []),
    disruptions: sameYear ? snapshotDisruptionSource(playtest.disruptionNotes ?? []) : ZERO_DISRUPTION_SOURCE,
    hub: sameYear ? snapshotHubSource(playtest.hub) : ZERO_HUB_SOURCE,
  })
}

export function sectionById(report: PlaytestYearReport, id: YearSectionView['id']): YearSectionView {
  const found = report.sections.find((section) => section.id === id)
  if (!found) throw new Error(`missing year section ${id}`)
  return found
}

export function lineById(section: YearSectionView, id: string): YearSectionLine {
  const found = section.lines.find((line) => line.id === id)
  if (!found) throw new Error(`missing year line ${section.id}.${id}`)
  return found
}
