import { describe, expect, it } from 'vitest'
import { YearPlaytestBook } from './book.ts'
import { AWARD_REASONS } from './config.ts'
import {
  ZERO_AWARD_SOURCE,
  ZERO_DISRUPTION_SOURCE,
  ZERO_HUB_SOURCE,
  recordMissedConnectionNights,
  snapshotAwardSource,
  snapshotDisruptionSource,
  snapshotHubSource,
} from './sources.ts'
import {
  awardReason,
  buildPlaytestYearReport,
  lineById,
  mergePlaytestAndTycoon,
  operatingTotals,
  sectionById,
  type TycoonYearLike,
} from './yearEnd.ts'

const events = snapshotDisruptionSource([
  { day: 3, kind: 'volcanic-ash', revenueImpact: 4000 },
  { day: 3, kind: 'strike-day', revenueImpact: 500 },
  { day: 8, kind: 'volcanic-ash', revenueImpact: 9000 },
])

describe('playtest year sections', () => {
  it('renders finance, disruptions, hub, and awards', () => {
    const report = buildPlaytestYearReport({
      year: 1,
      fromDay: 0,
      toDay: 12,
      revenue: 50_000,
      costs: 20_000,
      passengers: 400,
      satisfaction: 80,
      cleanliness: 88,
      disruptions: events,
      hub: snapshotHubSource({ completed: 40, missed: 6, nights: 4 }),
      awards: snapshotAwardSource([
        { id: 'best_regional', name: 'Best Regional Airport', year: 1, prestige: 8, reputation: 4 },
        { id: 'cleanest_terminal', name: 'Cleanest Terminal', year: 1, prestige: 6, reputation: 3 },
      ]),
    })

    const finance = sectionById(report, 'finance')
    expect(finance.title).toBe('Financial summary')
    expect(lineById(finance, 'revenue').value).toBe('$50,000')
    expect(lineById(finance, 'costs').value).toBe('$20,000')
    expect(lineById(finance, 'net').value).toBe('$30,000')
    expect(lineById(finance, 'passengers').value).toBe('400')
    expect(lineById(finance, 'satisfaction').value).toBe('80')
    expect(lineById(finance, 'cleanliness').value).toBe('88')
    expect(lineById(finance, 'best').value).toContain('Revenue')

    const disruptions = sectionById(report, 'disruptions')
    expect(disruptions.emptyNote).toBeNull()
    expect(lineById(disruptions, 'volcanic-ash').value).toBe('2')
    expect(lineById(disruptions, 'volcanic-ash').label).toBe('Volcanic ash')
    expect(lineById(disruptions, 'strike-day').value).toBe('1')
    expect(lineById(disruptions, 'impact').value).toBe('$13,500')
    expect(lineById(disruptions, 'worst-day').value).toBe('Day 9 · $9,000')
    expect(report.disruptions.worstDay).toEqual({ day: 8, count: 1, revenueImpact: 9000 })

    const hub = sectionById(report, 'hub')
    expect(lineById(hub, 'completed').value).toBe('40')
    expect(lineById(hub, 'missed').value).toBe('6')
    expect(lineById(hub, 'nights').value).toBe('4')

    const awards = sectionById(report, 'awards')
    expect(awards.lines.map((line) => line.id)).toEqual(['best_regional', 'cleanest_terminal'])
    expect(awards.lines[0]?.detail).toBe(AWARD_REASONS.best_regional)
    expect(awards.lines[1]?.detail).toBe(AWARD_REASONS.cleanest_terminal)
    expect(awards.emptyNote).toBeNull()
  })

  it('stays zero-safe when sources are missing or non-finite', () => {
    const report = buildPlaytestYearReport({
      year: Number.NaN,
      fromDay: -4,
      toDay: Number.POSITIVE_INFINITY,
      revenue: Number.NaN,
      costs: Number.NaN,
      passengers: -3,
      satisfaction: 140,
      cleanliness: Number.NaN,
      disruptions: null,
      hub: {
        completed: () => Number.NaN,
        missed: () => -8,
        nights: () => Number.POSITIVE_INFINITY,
      },
      awards: null,
    })

    expect(report.year).toBe(1)
    expect(report.fromDay).toBe(0)
    expect(report.toDay).toBe(12)
    expect(report.revenue).toBe(0)
    expect(report.costs).toBe(0)
    expect(report.net).toBe(0)
    expect(report.passengers).toBe(0)
    expect(report.satisfaction).toBe(100)
    expect(report.cleanliness).toBe(0)
    expect(report.hub).toEqual({ completed: 0, missed: 0, nights: 0 })
    expect(report.disruptions.totalCount).toBe(0)
    expect(report.disruptions.revenueImpact).toBe(0)
    expect(report.disruptions.worstDay).toBeNull()
    expect(report.awards).toEqual([])
    expect(sectionById(report, 'disruptions').emptyNote).toBe('No disruptions this year.')
    expect(lineById(sectionById(report, 'disruptions'), 'impact').value).toBe('$0')
    expect(lineById(sectionById(report, 'disruptions'), 'worst-day').value).toBe('—')
    expect(sectionById(report, 'hub').emptyNote).toBe('No connecting passengers this year.')
    expect(sectionById(report, 'awards').emptyNote).toBe('No award this year.')
    expect(sectionById(report, 'finance').lines.length).toBeGreaterThan(0)

    const defaults = buildPlaytestYearReport({
      year: 3,
      fromDay: 24,
      toDay: 36,
      revenue: 0,
      costs: 0,
      disruptions: ZERO_DISRUPTION_SOURCE,
      hub: ZERO_HUB_SOURCE,
      awards: ZERO_AWARD_SOURCE,
    })
    expect(defaults.disruptions.byType).toEqual([])
    expect(defaults.hub).toEqual({ completed: 0, missed: 0, nights: 0 })
    expect(defaults.awards).toEqual([])
  })

  it('lists tycoon award reasons and a fallback line', () => {
    expect(awardReason({ id: 'best_regional', name: 'Best Regional Airport' })).toBe(AWARD_REASONS.best_regional)
    expect(awardReason({ id: 'cleanest_terminal', name: 'Cleanest Terminal' })).toBe(AWARD_REASONS.cleanest_terminal)
    expect(awardReason({ id: 'leased_concourse', name: 'Leased Concourse' })).toBe(AWARD_REASONS.leased_concourse)
    expect(awardReason({ id: 'night_owl', name: 'Night Owl', reason: '  The last bank left on time. ' })).toBe(
      'The last bank left on time.',
    )

    const report = buildPlaytestYearReport({
      year: 2,
      fromDay: 12,
      toDay: 24,
      revenue: 1_000,
      costs: 100,
      awards: snapshotAwardSource([
        { id: 'leased_concourse', name: 'Leased Concourse', year: 2, prestige: 3, reputation: 1 },
        { id: 'night_owl', name: 'Night Owl', year: 2, prestige: 1, reputation: 0 },
        { id: 'leased_concourse', name: 'Leased Concourse', year: 2, prestige: 9 },
      ]),
    })
    const awards = sectionById(report, 'awards')
    expect(awards.lines).toHaveLength(2)
    expect(awards.lines[0]).toMatchObject({
      id: 'leased_concourse',
      value: 'prestige +3',
      detail: AWARD_REASONS.leased_concourse,
    })
    expect(awards.lines[1]?.detail).toBe('Night Owl earned this year.')
  })

  it('drops financing from the operating totals', () => {
    expect(
      operatingTotals([
        { category: 'landing_fees', amount: 1000 },
        { category: 'loan_proceeds', amount: 50_000 },
        { category: 'payroll', amount: -200 },
        { category: 'refunds', amount: 10 },
        { category: 'share_purchases', amount: -5 },
        { category: 'ghost', amount: Number.NaN },
      ]),
    ).toEqual({ revenue: 1000, costs: 200 })
  })

  it('keeps PR #63 finance and awards and the playtest hub section', () => {
    const playtest = buildPlaytestYearReport({
      year: 1,
      fromDay: 0,
      toDay: 12,
      revenue: 1,
      costs: 1,
      passengers: 1,
      satisfaction: 1,
      disruptions: events,
      hub: snapshotHubSource({ completed: 9, missed: 2, nights: 2 }),
      awards: snapshotAwardSource([
        { id: 'night_owl', name: 'Night Owl', year: 1, prestige: 1 },
      ]),
    })
    const tycoon: TycoonYearLike = {
      year: 1,
      fromDay: 0,
      toDay: 12,
      revenue: 80_000,
      costs: 10_000,
      net: 70_000,
      passengers: 900,
      satisfaction: 77,
      cleanliness: 91,
      best: { id: 'revenue', label: 'Revenue', value: 80_000, score: 100 },
      worst: { id: 'costs', label: 'Costs', value: 10_000, score: 94 },
      awards: [{ id: 'best_regional', name: 'Best Regional Airport', year: 1, prestige: 8, reputation: 4 }],
    }
    const merged = mergePlaytestAndTycoon(playtest, tycoon)
    expect(merged?.revenue).toBe(80_000)
    expect(merged?.net).toBe(70_000)
    expect(lineById(sectionById(merged!, 'finance'), 'best').value).toBe('Revenue (100)')
    expect(merged?.awards.map((award) => award.id)).toEqual(['best_regional'])
    expect(merged?.awards[0]?.reason).toBe(AWARD_REASONS.best_regional)
    expect(merged?.hub).toEqual({ completed: 9, missed: 2, nights: 2 })
    expect(merged?.disruptions.worstDay?.day).toBe(8)
    expect(mergePlaytestAndTycoon(playtest, null)).toBe(playtest)
    expect(mergePlaytestAndTycoon(null, null)).toBeNull()
  })
})

describe('year counters', () => {
  it('reads noteMissedConnectionNights and ignores a host with no hook', () => {
    const book = new YearPlaytestBook()
    const game = { noteMissedConnectionNights: (nights: number) => book.noteNights(nights) }
    recordMissedConnectionNights(game, 5)
    recordMissedConnectionNights(game, Number.NaN)
    recordMissedConnectionNights({}, 9)
    recordMissedConnectionNights(null, 3)
    book.noteConnections(12, 5)
    book.noteDisruption('software-outage', 1500, 2)
    book.noteDisruption('software-outage', -20, 2)
    book.noteAward({ id: 'cleanest_terminal', name: 'Cleanest Terminal', year: 1, prestige: 6, reputation: 3 })

    const report = book.observeDay({
      completedDay: 11,
      passengers: 80,
      satisfaction: 70,
      cleanliness: 85,
      entries: [{ category: 'passenger_fees', amount: 4000 }],
    })
    expect(report?.hub).toEqual({ completed: 12, missed: 5, nights: 5 })
    expect(report?.disruptions.byType).toEqual([
      { kind: 'software-outage', label: 'Software outage', count: 2, revenueImpact: 1500 },
    ])
    expect(report?.awards[0]?.reason).toBe(AWARD_REASONS.cleanest_terminal)
    expect(report?.revenue).toBe(4000)
    expect(book.liveHub()).toEqual({ completed: 0, missed: 0, nights: 0 })
  })

  it('does not publish before the year closes, and the next year starts empty', () => {
    const book = new YearPlaytestBook()
    book.noteNights(1)
    expect(
      book.observeDay({ completedDay: 3, passengers: 10, satisfaction: 50, cleanliness: 50, entries: [] }),
    ).toBeNull()
    expect(book.pending).toBeNull()
    book.observeDay({
      completedDay: 11,
      passengers: 10,
      satisfaction: 50,
      cleanliness: 50,
      entries: [],
    })
    expect(book.pending?.year).toBe(1)
    expect(book.pending?.hub.nights).toBe(1)
    const second = book.observeDay({
      completedDay: 23,
      passengers: 15,
      satisfaction: 40,
      cleanliness: 40,
      entries: [{ category: 'landing_fees', amount: 250 }],
    })
    expect(second?.year).toBe(2)
    expect(second?.passengers).toBe(5)
    expect(second?.hub.nights).toBe(0)
    expect(second?.revenue).toBe(250)
    book.dismiss()
    expect(book.pending).toBeNull()
  })

  it('restores a corrupt save as zeros', () => {
    const book = new YearPlaytestBook()
    book.restore({ nights: -3, completed: 'nope', disruptions: [{ kind: '', day: 1, revenueImpact: 4 }] }, 20)
    expect(book.liveHub()).toEqual({ completed: 0, missed: 0, nights: 0 })
    expect(book.liveDisruptions()).toEqual([])
    expect(book.save().paxAtOpen).toBe(20)
  })

  it('prefers a later module snapshot when one is attached', () => {
    const report = buildPlaytestYearReport(
      {
        year: 1,
        fromDay: 0,
        toDay: 12,
        revenue: 0,
        costs: 0,
        hub: ZERO_HUB_SOURCE,
        disruptions: ZERO_DISRUPTION_SOURCE,
      },
      {
        hubYearSnapshot: () => ({ completed: 3, missed: 1, nights: 1 }),
        disruptionYearEvents: () => [{ day: 1, kind: 'state-visit', revenueImpact: 200 }],
        tycoonAwardsThisYear: () => [{ id: 'leased_concourse', name: 'Leased Concourse', year: 1, prestige: 3, reputation: 1 }],
      },
    )
    expect(report.hub).toEqual({ completed: 3, missed: 1, nights: 1 })
    expect(report.disruptions.byType[0]?.label).toBe('State visit')
    expect(report.awards[0]?.reason).toBe(AWARD_REASONS.leased_concourse)
  })
})
