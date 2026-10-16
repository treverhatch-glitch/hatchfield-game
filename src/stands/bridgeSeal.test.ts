import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import type { Flight } from '../game/types.ts'
import { BRIDGE_RETRACT_SEC } from '../ramp/crewConfig.ts'
import { hostKey } from './catalog.ts'

const STAND = { c: 11, r: 6 }

function field(bridge: boolean): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  if (bridge) expect(game.buyFitting(hostKey('stand', STAND.c, STAND.r), 'jet_bridge')).toBe(true)
  return game
}

function boarding(game: Game): Flight {
  const flight: Flight = {
    id: 'seal-1',
    airline: 'northline',
    flightNo: 'NL7',
    airframeId: 'b738',
    airframeName: '737-800',
    pax: 0,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'board',
    stand: { ...STAND },
    x: STAND.c,
    y: STAND.r,
    z: 0,
    heading: 0,
    path: [{ ...STAND }],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: { landing: true, bags: true, bagsLoad: true, fuel: true, catering: true, bagDrop: true, mx: false, deiced: false },
    waitingOn: { bags: false, bagsLoad: false, fuel: false, catering: false, mx: false, deice: false, paxOut: 0, paxIn: 0 },
    phaseTime: 0,
    ledger: [],
  }
  game.flights.push(flight)
  game.beginBoarding(flight)
  flight.waitingOn.paxIn = 0
  return flight
}

/** Tick until the flight leaves board. Returns the bridge reach seen on each board tick. */
function runBoard(game: Game, flight: Flight, maxSec = 400): { reach: number; t: number }[] {
  const seen: { reach: number; t: number }[] = []
  const dt = 0.05
  for (let i = 0; i < maxSec / dt && flight.phase === 'board'; i++) {
    seen.push({ reach: game.bridgeExtendAt(STAND), t: flight.phaseTime })
    game.tick(dt)
  }
  return seen
}

describe('jet bridge seal through boarding', { timeout: 20_000 }, () => {
  it('holds the bridge on the door for the whole board, then retracts before pushback', () => {
    const game = field(true)
    expect(game.standPaxMode(STAND)).toBe('jetway')
    const flight = boarding(game)
    const seen = runBoard(game, flight)
    expect(flight.phase).toBe('pushback')
    const shutAt = seen.findIndex((s) => s.reach < 1)
    expect(shutAt).toBeGreaterThan(0)
    // Docked at 1 on every tick before the doors closed, however long the board ran.
    expect(seen.slice(0, shutAt).every((s) => s.reach === 1)).toBe(true)
    // Then it only pulls back, and the push waits for the full retract.
    const tail = seen.slice(shutAt)
    for (let i = 1; i < tail.length; i++) expect(tail[i]!.reach).toBeLessThanOrEqual(tail[i - 1]!.reach)
    expect(tail[tail.length - 1]!.t - seen[shutAt - 1]!.t).toBeGreaterThanOrEqual(BRIDGE_RETRACT_SEC - 0.1)
    expect(game.bridgeExtendAt(STAND)).toBe(0)
    expect(flight.bridgeShutAt ?? null).toBeNull()
  })

  it('keeps the bridge docked past the boarding picture window', () => {
    const game = field(true)
    const flight = boarding(game)
    flight.phaseTime = 60
    expect(game.bridgeExtendAt(STAND)).toBe(1)
    flight.bridgeShutAt = 60
    flight.phaseTime = 60 + BRIDGE_RETRACT_SEC / 2
    expect(game.bridgeExtendAt(STAND)).toBeCloseTo(0.5, 5)
    flight.phaseTime = 60 + BRIDGE_RETRACT_SEC + 0.01
    expect(game.bridgeExtendAt(STAND)).toBe(0)
  })

  it('leaves a stand without a bridge on stairs, with nothing to retract', () => {
    const game = field(false)
    const flight = boarding(game)
    flight.phaseTime = 30
    expect(game.bridgeExtendAt(STAND)).toBe(0)
    expect(game.bridgeAircraftAt(STAND)).toBeNull()
    expect((game as unknown as { bridgeClear(f: Flight): boolean }).bridgeClear(flight)).toBe(true)
    expect(flight.bridgeShutAt ?? null).toBeNull()
  })

  it('reports the parked aircraft to the bridge only while it sits on the stand', () => {
    const game = field(true)
    const flight = boarding(game)
    expect(game.bridgeAircraftAt(STAND)).toEqual({ airframeId: 'b738', x: STAND.c, y: STAND.r, heading: 0 })
    flight.phase = 'taxi_out'
    expect(game.bridgeAircraftAt(STAND)).toBeNull()
  })
})
