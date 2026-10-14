import { beforeEach, describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { buildAdvice, buildAlerts, hallCellOf } from './terminalBuildBridge.ts'
import { GRID_C, GRID_R } from './terminal.ts'
import { blankLayout, runFlow, validateLayout } from '../terminalbuild/index.ts'
import { sampleTerminalEdits } from '../terminalbuild/sample.ts'

function started(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 2_000_000
  game.speed = 1
  return game
}

const buildIds = (game: Game) => game.advice.filter((a) => a.id.startsWith('build-')).map((a) => a.id)
const buildAlertKeys = (game: Game) => game.alerts.active.filter((a) => a.key.startsWith('cond:build:')).map((a) => a.key)

describe('terminal build bridge', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('maps build tiles into the hall grid', () => {
    expect(hallCellOf({ x: 0, y: 0 })).toEqual({ c: 0, r: 0 })
    expect(hallCellOf({ x: 999, y: 999 })).toEqual({ c: GRID_C - 1, r: GRID_R - 1 })
  })

  it('every finding is a hint; only flow blockers are alerts', () => {
    const l = blankLayout(4, 4)
    const findings = validateLayout(l).findings
    expect(buildAdvice(l)).toHaveLength(findings.length)
    const alerts = buildAlerts(l, '1,1', 'T1')
    expect(alerts).toHaveLength(findings.filter((f) => f.blocksFlow).length)
    expect(alerts.every((a) => a.key.startsWith('cond:build:1,1:'))).toBe(true)
  })

  it('prefab halls are unchanged: no build, no build hints, no build alerts', () => {
    const game = started()
    for (let i = 0; i < 20; i++) game.tick(0.2)
    expect(game.fits.every((f) => !f.build)).toBe(true)
    expect(buildIds(game)).toEqual([])
    expect(buildAlertKeys(game)).toEqual([])
  })

  it('builds a terminal from scratch in the sim: hints and alerts guide it, then it runs clean', () => {
    const game = started()
    const cash0 = game.cash
    const edits = sampleTerminalEdits()
    let layout = blankLayout(8, 6)
    let spent = 0
    for (const [i, edit] of edits.entries()) {
      const res = edit(layout)
      expect(game.applyHallBuild(res)).toBe(true)
      layout = res.layout
      spent += res.cost
      if (i === 0) {
        // Bare floor: the advisor names what is missing, and it blocks flow.
        expect(buildIds(game)).toEqual(expect.arrayContaining(['build-missing_checkin', 'build-no_entrance', 'build-wall_gap']))
        for (let t = 0; t < 20; t++) game.tick(0.2)
        expect(buildAlertKeys(game).some((k) => k.endsWith(':missing_checkin'))).toBe(true)
      }
    }
    expect(game.cash).toBeLessThanOrEqual(cash0 - spent + 1)
    expect(game.activeHall()?.build).toBe(layout)
    expect(buildIds(game)).toEqual([])
    for (let t = 0; t < 20; t++) game.tick(0.2)
    expect(buildAlertKeys(game)).toEqual([])

    const report = runFlow(game.activeHall()!.build!, [
      { id: 'HF1', gate: 'g1', departSec: 3 * 3600, departing: 150, arriveSec: 3600, arriving: 150, bagsPerPax: 1 },
    ])
    expect(report.lostPax).toBe(0)
    expect(report.lostBags).toBe(0)
    expect(report.lostArrivals).toBe(0)
    expect(report.boarded).toBe(150)
    expect(report.bagsLoaded).toBe(150)
  })

  it('a rejected edit changes nothing and costs nothing', () => {
    const game = started()
    const cash0 = game.cash
    expect(game.applyHallBuild({ layout: blankLayout(2, 2), cost: 0, error: 'Off the plot.' })).toBe(false)
    expect(game.cash).toBe(cash0)
    expect(game.activeHall()?.build).toBeUndefined()
  })
})
