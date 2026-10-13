/**
 * Year bucket the report polls. Counters stay at zero until a caller notes them.
 * Save shape is optional on the game snapshot so older fields still load.
 */
import { PLAYTEST_YEAR_DAYS } from './config.ts'
import {
  finiteCount,
  finiteNumber,
  pollAwards,
  pollDisruptions,
  pollHub,
  snapshotAwardSource,
  snapshotDisruptionSource,
  snapshotHubSource,
  type DisruptionNote,
  type YearAwardInput,
  type YearFinanceEntry,
  type YearProbes,
} from './sources.ts'
import { buildPlaytestYearReport, operatingTotals, type PlaytestYearReport } from './yearEnd.ts'

export interface YearDaySample {
  /** Completed game day, 0-based. A year closes when this plus one divides the year length. */
  completedDay: number
  /** Cumulative passengers served, not the year's delta. */
  passengers: number
  satisfaction: number
  cleanliness: number
  /** Bank lines for the year. Ignored until the year actually closes. */
  entries?: readonly YearFinanceEntry[] | null
}

export interface PlaytestYearSave {
  completed: number
  missed: number
  nights: number
  disruptions: DisruptionNote[]
  awards: YearAwardInput[]
  satisfactionSum: number
  satisfactionN: number
  cleanlinessSum: number
  cleanlinessN: number
  paxAtOpen: number
  pending: PlaytestYearReport | null
  rev: number
}

export class YearPlaytestBook {
  private completed = 0
  private missed = 0
  private nights = 0
  private disruptions: DisruptionNote[] = []
  private awards: YearAwardInput[] = []
  private satisfactionSum = 0
  private satisfactionN = 0
  private cleanlinessSum = 0
  private cleanlinessN = 0
  private paxAtOpen = 0
  pending: PlaytestYearReport | null = null
  rev = 0

  reset(passengers = 0): void {
    this.completed = 0
    this.missed = 0
    this.nights = 0
    this.disruptions = []
    this.awards = []
    this.satisfactionSum = 0
    this.satisfactionN = 0
    this.cleanlinessSum = 0
    this.cleanlinessN = 0
    this.paxAtOpen = finiteCount(passengers)
    this.pending = null
    this.rev += 1
  }

  noteNights(nights: number): void {
    this.nights += finiteCount(nights)
  }

  noteConnections(completed: number, missed: number): void {
    this.completed += finiteCount(completed)
    this.missed += finiteCount(missed)
  }

  noteDisruption(kind: string, revenueImpact: number, day: number): void {
    const id = kind.trim()
    if (!id) return
    this.disruptions.push({
      day: Math.max(0, Math.floor(finiteNumber(day, 0))),
      kind: id,
      revenueImpact: finiteCount(revenueImpact),
    })
  }

  noteAward(award: YearAwardInput): void {
    const [kept] = pollAwards(snapshotAwardSource([award]))
    if (!kept) return
    if (this.awards.some((existing) => existing.id === kept.id)) return
    this.awards.push(kept)
  }

  /**
   * Sample one closed day. On a year boundary, publish the card and clear the bucket.
   * Returns the new report, or null when the year is still open.
   */
  observeDay(sample: YearDaySample, probes?: YearProbes | null): PlaytestYearReport | null {
    const satisfaction = finiteNumber(sample.satisfaction, 0)
    const cleanliness = finiteNumber(sample.cleanliness, 0)
    if (Number.isFinite(satisfaction)) {
      this.satisfactionSum += Math.max(0, Math.min(100, satisfaction))
      this.satisfactionN += 1
    }
    if (Number.isFinite(cleanliness)) {
      this.cleanlinessSum += Math.max(0, Math.min(100, cleanliness))
      this.cleanlinessN += 1
    }
    const completedDay = Math.floor(finiteNumber(sample.completedDay, 0))
    if (completedDay < 0 || (completedDay + 1) % PLAYTEST_YEAR_DAYS !== 0) return null
    const year = Math.floor(completedDay / PLAYTEST_YEAR_DAYS) + 1
    const fromDay = (year - 1) * PLAYTEST_YEAR_DAYS
    const toDay = year * PLAYTEST_YEAR_DAYS
    const totals = operatingTotals(sample.entries)
    const passengers = Math.max(0, finiteCount(sample.passengers) - this.paxAtOpen)
    const report = buildPlaytestYearReport(
      {
        year,
        fromDay,
        toDay,
        revenue: totals.revenue,
        costs: totals.costs,
        passengers,
        satisfaction: this.satisfactionN ? this.satisfactionSum / this.satisfactionN : 0,
        cleanliness: this.cleanlinessN ? this.cleanlinessSum / this.cleanlinessN : 0,
        disruptions: snapshotDisruptionSource(this.disruptions),
        hub: snapshotHubSource({
          completed: this.completed,
          missed: this.missed,
          nights: this.nights,
        }),
        awards: snapshotAwardSource(this.awards),
      },
      probes,
    )
    this.pending = report
    this.paxAtOpen = finiteCount(sample.passengers)
    this.completed = 0
    this.missed = 0
    this.nights = 0
    this.disruptions = []
    this.awards = []
    this.satisfactionSum = 0
    this.satisfactionN = 0
    this.cleanlinessSum = 0
    this.cleanlinessN = 0
    this.rev += 1
    return report
  }

  dismiss(): void {
    if (!this.pending) return
    this.pending = null
    this.rev += 1
  }

  /** Live counters, so a probe can read the open year before it closes. */
  liveHub(): { completed: number; missed: number; nights: number } {
    return pollHub({
      completed: () => this.completed,
      missed: () => this.missed,
      nights: () => this.nights,
    })
  }

  liveDisruptions(): DisruptionNote[] {
    return pollDisruptions(snapshotDisruptionSource(this.disruptions))
  }

  save(): PlaytestYearSave {
    return {
      completed: this.completed,
      missed: this.missed,
      nights: this.nights,
      disruptions: this.disruptions.map((note) => ({ ...note })),
      awards: this.awards.map((award) => ({ ...award })),
      satisfactionSum: this.satisfactionSum,
      satisfactionN: this.satisfactionN,
      cleanlinessSum: this.cleanlinessSum,
      cleanlinessN: this.cleanlinessN,
      paxAtOpen: this.paxAtOpen,
      pending: this.pending,
      rev: this.rev,
    }
  }

  restore(raw: unknown, passengersNow = 0): void {
    this.reset(passengersNow)
    if (!raw || typeof raw !== 'object') return
    const saved = raw as Partial<PlaytestYearSave>
    this.completed = finiteCount(saved.completed)
    this.missed = finiteCount(saved.missed)
    this.nights = finiteCount(saved.nights)
    this.disruptions = pollDisruptions({
      events: () => (Array.isArray(saved.disruptions) ? saved.disruptions : []),
    })
    this.awards = pollAwards({
      awards: () => (Array.isArray(saved.awards) ? saved.awards : []),
    })
    this.satisfactionSum = Math.max(0, finiteNumber(saved.satisfactionSum, 0))
    this.satisfactionN = finiteCount(saved.satisfactionN)
    this.cleanlinessSum = Math.max(0, finiteNumber(saved.cleanlinessSum, 0))
    this.cleanlinessN = finiteCount(saved.cleanlinessN)
    this.paxAtOpen = finiteCount(saved.paxAtOpen ?? passengersNow)
    this.pending =
      saved.pending && typeof saved.pending === 'object' && Array.isArray(saved.pending.sections)
        ? saved.pending
        : null
  }
}
