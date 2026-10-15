import { describe, expect, it } from 'vitest'
import { runwayArrivalGapSec } from '../atc/capacity.ts'
import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import { Game } from './sim.ts'
import type { AirlineId, ScheduleSlot } from './types.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  game.scheduleAuto = false
  game.weather = 'clear'
  game.signed = ['harbor']
  return game
}

function slot(id: string, eta: number): ScheduleSlot {
  return {
    id,
    airline: 'harbor' as AirlineId,
    flightNo: id,
    eta,
    status: 'scheduled',
    delaySec: 0,
    delayReason: null,
    manual: true,
    flightId: null,
  }
}

describe('runway bank', () => {
  it('spaces a single-runway bank by the strip headway', () => {
    const game = field()
    game.clock = 700
    game.schedule = []
    game.seedScheduleForAirline('harbor', 3)
    const etas = game.schedule.map((row) => row.eta).sort((a, b) => a - b)
    expect(etas.length).toBeGreaterThan(1)
    const gap = runwayArrivalGapSec(game.runwayStripCount())
    for (let i = 1; i < etas.length; i++) expect(etas[i] - etas[i - 1]).toBeGreaterThanOrEqual(gap - 1e-6)
    expect(game.runwayLoad().overbooked).toBe(false)
  })

  it('warns when contracts book more movements than the strip can turn', () => {
    const game = field()
    game.clock = 1_000
    game.schedule = []
    const count = 8
    for (let i = 0; i < count; i++) game.schedule.push(slot(`tight-${i}`, game.clock + i * 4))
    const load = game.runwayLoad()
    expect(load.scheduled).toBeGreaterThan(load.capacity)
    expect(load.overbooked).toBe(true)
    game.tick(0.2)
    const alert = game.alerts.active.find((row) => row.key === 'runway-capacity')
    expect(alert?.detail).toMatch(/contracts/i)
    expect(alert?.detail).toContain(String(Math.max(1, Math.round(load.capacity))))
    const view = game.runwayLoad()
    expect(view.capacity).toBeGreaterThan(0)
    expect(view.capacity).toBeLessThan(REAL_SECONDS_PER_GAME_DAY)
  })

  it('records the real wait when a free strip releases an overdue in-capacity slot', () => {
    const game = field()
    game.clock = 1_000
    game.spawnCool = 5
    game.schedule = [slot('due', game.clock - 10)]
    expect(game.runwayLoad().overbooked).toBe(false)
    game.tick(0.2)
    const due = game.schedule[0]
    expect(due?.status).toBe('inbound')
    expect(due?.delaySec).toBeGreaterThan(9)
    expect(due?.delaySec).toBeLessThan(12)
  })

  it('books lateness when an overbooked slot is held past the slack', () => {
    const game = field()
    game.clock = 1_000
    game.spawnCool = 5
    game.schedule.push(slot('late-due', game.clock - 10))
    for (let i = 0; i < 8; i++) game.schedule.push(slot(`late-${i}`, game.clock + 6 + i * 4))
    expect(game.runwayLoad().overbooked).toBe(true)
    game.tick(0.2)
    expect(game.schedule.some((row) => row.delaySec >= 6)).toBe(true)
  })
})
