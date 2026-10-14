import { describe, expect, it } from 'vitest'
import { tilesOf } from './path.ts'
import { quietField } from './stuckRepro.ts'
import { Game } from './sim.ts'
import type { AirlineId, Flight, Person, Phase, Truck, Vec } from './types.ts'

function field(): Game {
  const game = new Game()
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  quietField(game)
  return game
}

function pose(id: string, flightNo: string, phase: Phase, stand: Vec, x: number, y: number, path: Vec[], seg = 0): Flight {
  return {
    id,
    airline: 'bushline' as AirlineId,
    flightNo,
    airframeId: 'bn2',
    airframeName: 'Islander',
    pax: 8,
    cargo: false,
    craft: 'jet',
    kind: 'regional',
    phase,
    stand,
    x,
    y,
    z: 0.12,
    heading: 0,
    path,
    seg,
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
      paxIn: 0,
    },
    phaseTime: 0,
    ledger: [],
  }
}

function walker(id: string, x: number, y: number): Person {
  return {
    id,
    flightId: 'crowd',
    x,
    y,
    path: [],
    seg: 0,
    t: 0,
    color: '#ccc',
    job: 'board',
    itinerary: [],
    label: 'Pax',
    wantBag: false,
    wantFood: false,
    wantGift: false,
    stage: 0,
    paidFood: false,
    paidGift: false,
  }
}

describe('taxi-out stall', () => {
  it('a departure rolls while an arrival is still on the far end of the spine', () => {
    const game = field()
    const stands = tilesOf(game.tiles, 'stand')
    const north = stands.find((cell) => cell.r <= 6)
    const south = stands.find((cell) => cell.r >= 12)
    if (!north || !south) throw new Error('starter field needs both stands')
    const inbound = game.landingRoute(south)
    const outbound = game.departurePath(pose('dep', 'DEP1', 'taxi_out', north, north.c, north.r, [north]))
    if (!inbound || !outbound || outbound.length < 8) throw new Error('starter departure path is too short')
    const at = inbound.findIndex((cell, index) => index > 2 && cell.r >= south.r + 10 && game.tile(cell) === 'taxi')
    if (at < 0) throw new Error('landing route has no south taxi cell')
    const spot = inbound[at]!
    const arrival = pose('arr', 'ARR1', 'landing', south, spot.c, spot.r, inbound, at)
    const departure = pose('dep', 'DEP1', 'taxi_out', north, north.c, north.r, outbound, 0)
    game.flights.push(arrival, departure)
    const start = { x: departure.x, y: departure.y }

    for (let i = 0; i < 80; i++) game.tick(0.05)
    expect(Math.hypot(departure.x - start.x, departure.y - start.y)).toBeGreaterThan(2)
    expect(arrival.y).toBeGreaterThan(departure.y + 6)

    let peak = departure.phaseTime
    let guard = 0
    while (departure.phase === 'taxi_out' && guard < 1600) {
      game.tick(0.05)
      if (departure.phase === 'taxi_out') peak = departure.phaseTime
      guard += 1
    }
    expect(departure.phase).toBe('takeoff')
    expect(peak).toBeLessThan(40)
    expect(game.recoveryTeleports).toBe(0)
    expect(game.recoveryLog.some((entry) => entry.reason === 'teleport')).toBe(false)
  })

  it('apron walkers beside the taxiway do not freeze a jet', () => {
    const game = field()
    const dep = pose('dep', 'DEP1', 'taxi_out', { c: 7, r: 10 }, 7, 10, [
      { c: 7, r: 10 },
      { c: 7, r: 11 },
    ])
    game.flights.push(dep)
    for (let i = 0; i < 12; i++) game.people.push(walker(`w${i}`, 8, 10))
    expect(game.congestionAt(7, 10, dep.id)).toBe(1)
    game.people.push(walker('on', 7.2, 10))
    expect(game.congestionAt(7, 10, dep.id)).toBe(1)
  })

  it('an on-screen stall drives or cancels and never teleports', () => {
    const game = field()
    const home = tilesOf(game.tiles, 'taxi')[0]
    if (!home) throw new Error('no taxi home')
    const truck: Truck = {
      id: 'trk-screen',
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
    game.noteRecoveryView(1, 1, 4)
    game.watchStuck()
    for (let i = 0; i < 8; i++) {
      game.clock += 0.2
      game.watchStuck()
    }
    expect(game.recoveryTeleports).toBe(0)
    expect(game.trucks.some((item) => item.id === 'trk-screen')).toBe(false)
    const reasons = game.recoveryLog.map((entry) => entry.reason)
    expect(reasons).toContain('drive-failed')
    expect(reasons).toContain('cancel-refund')
    expect(reasons).not.toContain('teleport')
    expect(game.news.some((item) => item.text.includes('reason:drive-failed'))).toBe(true)
    expect(game.news.some((item) => item.text.includes('reason:cancel-refund'))).toBe(true)
    const alert = game.alerts.active.find((item) => item.key.startsWith('event:recovery:'))
    expect(alert?.detail).toContain('reason:')
  })
})
