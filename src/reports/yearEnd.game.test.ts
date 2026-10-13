import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { AWARD_REASONS } from './config.ts'
import { lineById, sectionById } from './yearEnd.ts'

describe('Game year-end card', () => {
  it('publishes disruptions, hub misses, and awards when the year closes', () => {
    const game = new Game()
    game.noteHubConnections(7, 2)
    game.noteMissedConnectionNights(2)
    game.noteDisruption('software-outage', 1200, 4)
    game.noteYearAward({
      id: 'best_regional',
      name: 'Best Regional Airport',
      year: 1,
      prestige: 8,
      reputation: 4,
    })
    game.bank.post('passenger_fees', 6400, { simMinutes: 100, source: 'test' })
    game.bank.post('loan_proceeds', 20_000, { simMinutes: 100, source: 'test' })
    game.clock = 180 * 12
    game.tickPayroll(0)

    const report = game.playtestYearCard()
    expect(report?.year).toBe(1)
    expect(report?.fromDay).toBe(0)
    expect(report?.toDay).toBe(12)
    expect(report?.revenue).toBe(6400)
    expect(report?.hub).toEqual({ completed: 7, missed: 2, nights: 2 })
    expect(lineById(sectionById(report!, 'disruptions'), 'software-outage').value).toBe('1')
    expect(lineById(sectionById(report!, 'disruptions'), 'impact').value).toBe('$1,200')
    expect(report?.awards[0]?.reason).toBe(AWARD_REASONS.best_regional)
    expect(game.news.some((item) => item.text === 'Year 1 report is ready.')).toBe(true)

    game.dismissPlaytestYear()
    expect(game.playtestYearCard()).toBeNull()
  })

  it('starts the next year at zero and keeps a pending card across save', () => {
    const game = new Game()
    game.noteMissedConnectionNights(4)
    game.clock = 180 * 24
    game.tickPayroll(0)
    const second = game.playtestYearCard()
    expect(second?.year).toBe(2)
    expect(second?.hub.nights).toBe(0)

    game.site = 'city'
    game.noteDisruption('hub-meltdown', 800, 20)
    game.persist()
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.playtestYear.liveDisruptions()).toEqual([
      { day: 20, kind: 'hub-meltdown', revenueImpact: 800 },
    ])
    loaded.clock = 180 * 36
    loaded.payrollDay = 24
    loaded.tickPayroll(0)
    expect(loaded.playtestYearCard()?.disruptions.byType[0]?.kind).toBe('hub-meltdown')
  })
})
