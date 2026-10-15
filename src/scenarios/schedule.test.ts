import { describe, expect, it } from 'vitest'
import { SCENARIOS } from './templates.ts'
import { scenarioById, scenarioRuleLines, scoreScenario, type ScenarioRun } from './schedule.ts'

function running(id: string, startedDay = 0): ScenarioRun {
  return { id, startedDay, status: 'running', progress: 0, profitDays: 0 }
}

describe('scenario schedule', () => {
  it('names a rule for every template and does not start one by itself', () => {
    expect(SCENARIOS).toHaveLength(8)
    for (const scenario of SCENARIOS) {
      const lines = scenarioRuleLines(scenario)
      expect(lines.length).toBeGreaterThan(1)
      expect(lines.at(-1)).toContain(`${scenario.goal.byDay} days`)
    }
    expect(scenarioRuleLines(scenarioById('island-hop')!)).toContain('No further parcels.')
    expect(scenarioRuleLines(scenarioById('green-pioneer')!).join(' ')).toContain('cannot be met')
  })

  it('meets a passenger day inside the window and misses a quiet one at the deadline', () => {
    const scenario = scenarioById('island-hop')!
    const met = scoreScenario(running('island-hop'), scenario, {
      day: 3,
      pax: 500,
      profit: 0,
      nightRevenue: 0,
      transferShare: 0,
    })
    expect(met.run.status).toBe('met')
    expect(met.news).toContain('Island Hop met')

    const missed = scoreScenario(running('island-hop'), scenario, {
      day: 15,
      pax: 499,
      profit: 0,
      nightRevenue: 0,
      transferShare: 0,
    })
    expect(missed.run.status).toBe('missed')
  })

  it('counts profitable days and never treats net-zero as met', () => {
    const city = scenarioById('cramped-city')!
    let run = running('cramped-city')
    for (let day = 1; day <= 4; day++) {
      run = scoreScenario(run, city, { day, pax: 0, profit: 10, nightRevenue: 0, transferShare: 0 }).run
    }
    expect(run.status).toBe('running')
    expect(run.profitDays).toBe(4)
    const fifth = scoreScenario(run, city, { day: 5, pax: 0, profit: 1, nightRevenue: 0, transferShare: 0 })
    expect(fifth.run.status).toBe('met')

    const green = scenarioById('green-pioneer')!
    const stuck = scoreScenario(running('green-pioneer'), green, {
      day: 40,
      pax: 9_000,
      profit: 1_000_000,
      nightRevenue: 1_000_000,
      transferShare: 1,
    })
    expect(stuck.run.status).toBe('missed')
    expect(stuck.run.progress).toBe(0)
  })
})
