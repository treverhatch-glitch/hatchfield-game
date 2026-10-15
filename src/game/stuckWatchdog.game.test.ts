import { describe, expect, it } from 'vitest'
import { jetRouteOnGraph, tilesOf } from './path.ts'
import {
  advanceSimMinutes,
  applyStuckRepro,
  loadStuckFixture,
  quietField,
  taxiChordTarget,
} from './stuckRepro.ts'
import { Game } from './sim.ts'
import { STUCK_WATCH } from './stuckWatchdogData.ts'
import type { Truck, Vec } from './types.ts'

function field(): Game {
  const game = new Game()
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  quietField(game)
  return game
}

function recovered(game: Game, flightNo: string, start: { x: number; y: number }): boolean {
  const flight = game.flights.find((item) => item.flightNo === flightNo)
  if (!flight || flight.phase === 'gone' || flight.phase === 'takeoff') return true
  if (flightNo === 'ZO116' && flight.phase !== 'board') return true
  if (flightNo === 'BU131' && flight.phase !== 'landing') return true
  if (flight.path.length >= 2 && jetRouteOnGraph(game.tiles, flight.path)) return true
  return Math.hypot(flight.x - start.x, flight.y - start.y) > 0.25
}

describe('scripted stuck-flight repros', () => {
  it('sends a blocked landing to the free exit and recovers ZO116 and BU130 within five sim minutes', () => {
    const game = field()
    const landing = applyStuckRepro(game, loadStuckFixture('bu131-landing'))
    const board = applyStuckRepro(game, loadStuckFixture('zo116-board'))
    const taxi = applyStuckRepro(game, loadStuckFixture('bu130-taxi'))
    const starts = {
      BU131: { x: landing.x, y: landing.y },
      ZO116: { x: board.x, y: board.y },
      BU130: { x: taxi.x, y: taxi.y },
    }
    const banned = taxiChordTarget(taxi.stand!)
    const visited: Vec[] = []
    const startMin = game.simMinutes()
    let guard = 0
    while (game.simMinutes() - startMin < STUCK_WATCH.recoverWithinMin - 1e-9) {
      game.tick(0.05)
      for (const flight of game.flights) {
        if (flight.flightNo !== 'BU130') continue
        const cell = { c: Math.round(flight.x), r: Math.round(flight.y) }
        if (cell.c === banned.c && cell.r === banned.r) visited.push(cell)
      }
      guard += 1
      if (guard > 20_000) throw new Error('clock did not advance')
    }
    expect(game.simMinutes() - startMin).toBeGreaterThanOrEqual(STUCK_WATCH.recoverWithinMin - 0.05)
    expect(recovered(game, 'BU131', starts.BU131)).toBe(true)
    expect(landing.y).toBeGreaterThan(starts.BU131.y)
    expect(landing.path.some((cell) => cell.c === 11 && cell.r === 25)).toBe(false)
    expect(landing.path.filter((cell) => cell.r === 28).length).toBeGreaterThan(3)
    expect(game.recoveryLog.some((entry) => entry.label === 'BU131')).toBe(false)
    expect(recovered(game, 'ZO116', starts.ZO116)).toBe(true)
    expect(recovered(game, 'BU130', starts.BU130)).toBe(true)
    expect(visited).toEqual([])
    for (const flightNo of ['ZO116', 'BU130']) {
      expect(game.recoveryLog.some((entry) => entry.label === flightNo)).toBe(true)
    }
    expect(game.recoveryCount).toBeGreaterThanOrEqual(2)
  })

  it('cancels a flight with no pavement and refunds the fees it collected', () => {
    const game = new Game()
    game.beginNew('easy')
    game.buyLand('city')
    for (const row of game.tiles) row.fill('grass')
    game.fits = []
    quietField(game)
    const fixture = loadStuckFixture('zo116-board')
    const flight = {
      id: 'zo116',
      airline: fixture.airline,
      flightNo: fixture.flightNo,
      airframeId: fixture.airframeId,
      airframeName: 'A320',
      pax: fixture.pax,
      cargo: false,
      craft: 'jet' as const,
      kind: 'narrowbody' as const,
      phase: 'board' as const,
      stand: null,
      x: 4,
      y: 4,
      z: 0.12,
      heading: 0,
      path: [] as Vec[],
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: {
        landing: true,
        bags: true,
        bagsLoad: true,
        fuel: true,
        catering: true,
        bagDrop: true,
        mx: true,
        deiced: true,
      },
      waitingOn: {
        bags: false,
        bagsLoad: false,
        fuel: false,
        catering: false,
        mx: false,
        deice: false,
        paxOut: 0,
        paxIn: 6,
      },
      phaseTime: 0,
      ledger: fixture.ledger.map((line) => ({ ...line })),
    }
    game.flights.push(flight)
    const before = game.cash
    advanceSimMinutes(game, STUCK_WATCH.recoverWithinMin)
    expect(game.flights.some((item) => item.flightNo === 'ZO116' && item.phase !== 'gone')).toBe(false)
    const cancel = game.recoveryLog.find((entry) => entry.step === 'cancel' && entry.label === 'ZO116')
    expect(cancel?.detail).toContain('refunded $680')
    expect(game.cash).toBe(before - 680)
    expect(game.bank.ledger().entries.some((entry) => entry.category === 'penalties' && entry.amount === -680)).toBe(
      true,
    )
  })

  it('removes a vehicle that never rolls', () => {
    const game = field()
    const home = tilesOf(game.tiles, 'taxi')[0] ?? { c: 2, r: 2 }
    const truck: Truck = {
      id: 'trk-stuck',
      kind: 'bags',
      flightId: null,
      x: 1,
      y: 1,
      path: [],
      seg: 0,
      t: 0,
      returning: false,
      dwell: 0,
      preDwell: 0,
      patrol: false,
      mission: 'load',
      home,
    }
    game.trucks.push(truck)
    game.watchStuck()
    for (let i = 0; i < 8; i++) {
      game.clock += 0.2
      game.watchStuck()
    }
    expect(game.trucks.some((item) => item.id === 'trk-stuck')).toBe(false)
    expect(game.recoveryLog.some((entry) => entry.kind === 'vehicle' && entry.step === 'cancel')).toBe(true)
  })
})
