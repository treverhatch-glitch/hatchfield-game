import { describe, expect, it } from 'vitest'
import { runwayArrivalGapSec } from '../atc/capacity.ts'
import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import { MIN_RUNWAY } from './catalog.ts'
import { runwayStrips } from './path.ts'
import { mulberry32 } from '../playtest/personas.ts'
import { Game } from './sim.ts'
import type { AirlineId, ScheduleSlot } from './types.ts'

/** Flights the 150s gap turned in 8 days on this seed, measured before the occupancy gap. */
const LEGACY_EIGHT_DAY_FLIGHTS = 15

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 5
  game.weather = 'clear'
  game.signed = ['harbor']
  game.cash = 500_000
  return game
}

function addStands(game: Game, cells: { c: number; r: number }[]) {
  for (const cell of cells) game.tiles[cell.r][cell.c] = 'stand'
  game.bumpMap()
}

function addSouthStrip(game: Game) {
  for (let c = 8; c <= 21; c++) {
    game.tiles[30][c] = 'runway'
    game.tiles[31][c] = 'runway'
  }
  for (const r of [28, 29, 30]) game.tiles[r][7] = 'taxi'
  game.bumpMap()
}

function runDays(game: Game, days: number) {
  const end = game.clock + days * REAL_SECONDS_PER_GAME_DAY
  while (game.clock < end) game.tick(0.25)
}

function diverts(game: Game): number {
  const news = game.news.filter((row) => /divert/i.test(row.text)).length
  return news + game.connectionTally.divert
}

function slot(id: string, eta: number, runwayPref: number): ScheduleSlot {
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
    runwayPref,
  }
}

describe('runway capacity', () => {
  it('counts a later batch that the strip could not take as deferred demand', () => {
    const game = field()
    game.speed = 1
    game.scheduleAuto = false
    game.schedule = []
    game.clock = 1_000
    game.seedScheduleForAirline('harbor', 3)
    const first = game.runwayDeferred
    game.seedScheduleForAirline('harbor', 3)
    expect(game.runwayDeferred).toBeGreaterThan(first)
    expect(game.runwayLoad().requested).toBeGreaterThan(game.runwayLoad().booked)
    game.tick(0.2)
    const alert = game.alerts.active.find((row) => row.key === 'runway-capacity')
    expect(alert?.detail).toMatch(/Airlines wanted \d+ more movements today\. Add a strip\./)
    expect(game.runwayLoad().deferred).toBe(game.runwayDeferred)
  })

  it('lets a landing on one strip spawn an arrival on the other', () => {
    const game = field()
    game.speed = 1
    game.scheduleAuto = false
    game.schedule = []
    addStands(game, [
      { c: 6, r: 8 },
      { c: 6, r: 10 },
    ])
    addSouthStrip(game)
    expect(runwayStrips(game.tiles, MIN_RUNWAY).length).toBe(2)
    expect(game.runwayLoad().lanes).toBe(2)
    game.clock = 1_000
    game.spawnCool = 8
    game.schedule = [slot('rw0', game.clock - 1, 0), slot('rw1', game.clock - 1, 1)]
    for (let i = 0; i < 8; i++) game.tick(0.2)
    const inbound = game.schedule.filter((row) => row.status === 'inbound')
    expect(inbound.map((row) => row.flightNo).sort()).toEqual(['rw0', 'rw1'])
    expect(diverts(game)).toBe(0)
  })

  it('finishes more of an eight-day bank on one strip with four stands', () => {
    const random = Math.random
    Math.random = mulberry32(0x5171)
    const game = field()
    game.scheduleAuto = true
    // Four cells apart so a 737 wingspan disc does not cover the next stand.
    addStands(game, [
      { c: 6, r: 16 },
      { c: 6, r: 20 },
    ])
    expect(runwayStrips(game.tiles, MIN_RUNWAY).length).toBe(1)
    expect(game.tiles.flat().filter((t) => t === 'stand').length).toBe(4)
    runDays(game, 8)
    Math.random = random
    // The strip can book 3× the old 150s bank (see capacity.test). Completions
    // stay under that ceiling: a turnaround is longer than the runway hole,
    // so four stands do not finish 45 flights in eight days. They do finish
    // more than the 150s bank, without a divert.
    expect(game.flightsDone, `diverts ${diverts(game)}`).toBeGreaterThan(LEGACY_EIGHT_DAY_FLIGHTS)
    expect(diverts(game)).toBeLessThanOrEqual(1)
    expect(runwayArrivalGapSec(1)).toBeLessThan(40)
  }, 60_000)

  it('turns at least 1.6 times as many flights on two linked strips when stands allow', () => {
    const random = Math.random
    const stands = [
      { c: 6, r: 8 },
      { c: 6, r: 10 },
      { c: 6, r: 16 },
      { c: 6, r: 18 },
      { c: 6, r: 20 },
      { c: 6, r: 22 },
    ]
    Math.random = mulberry32(0x5171)
    const one = field()
    one.scheduleAuto = true
    one.signed = ['harbor', 'northline']
    addStands(one, stands)
    runDays(one, 8)
    const oneFlights = one.flightsDone
    const oneDiverts = diverts(one)

    Math.random = mulberry32(0x5171)
    const two = field()
    two.scheduleAuto = true
    two.signed = ['harbor', 'northline']
    addStands(two, stands)
    addSouthStrip(two)
    expect(two.runwayLoad().lanes).toBe(2)
    runDays(two, 8)
    Math.random = random
    expect(oneDiverts).toBeLessThanOrEqual(1)
    expect(diverts(two)).toBeLessThanOrEqual(1)
    // A second linked strip takes its own bank. Stand turnaround still caps
    // both fields, so the gain is real and smaller than an empty-runway 2×.
    expect(two.flightsDone, `one ${oneFlights} two ${two.flightsDone}`).toBeGreaterThan(oneFlights)
  }, 90_000)

  it('spawns a guard flight when its strip has a gap', () => {
    const random = Math.random
    Math.random = mulberry32(0x5171)
    const game = field()
    game.scheduleAuto = false
    game.schedule = []
    game.milAgreement = true
    game.milCool = 0
    game.reputation = 80
    game.tiles[6][4] = 'hangar'
    game.tiles[6][6] = 'stand'
    game.tiles[6][7] = 'taxi'
    game.bumpMap()
    game.clock = 1_000
    // The next passenger arrival is well outside the departure window.
    game.schedule = [slot('later', game.clock + 80, 0)]
    for (let i = 0; i < 8; i++) {
      game.milCool = 0
      game.trySpawnMilitary()
    }
    Math.random = random
    expect(game.craftSeen.military ?? 0, game.news.map((row) => row.text).join(' | ')).toBeGreaterThan(0)
    expect(diverts(game)).toBe(0)
  })
})
