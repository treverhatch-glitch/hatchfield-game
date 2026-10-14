/**
 * Scripted stuck-flight repros. The JSON fixtures name the flight; this loader
 * rebuilds the stall on a live starter field (landing exit blocked, dead board,
 * taxi path off the graph).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { jetRouteOnGraph, tilesOf } from './path.ts'
import type { Game } from './sim.ts'
import type { AirlineId, Flight, Phase, Vec } from './types.ts'

export type StuckClass = 'landing' | 'board' | 'taxi_out'

export interface StuckFixture {
  flightNo: string
  airline: string
  klass: StuckClass
  airframeId: string
  pax: number
  ledger: { label: string; amount: number }[]
  note: string
}

const HERE = dirname(fileURLToPath(import.meta.url))

export function loadStuckFixture(name: 'bu131-landing' | 'zo116-board' | 'bu130-taxi'): StuckFixture {
  const raw = readFileSync(join(HERE, 'fixtures', `${name}.json`), 'utf8')
  return JSON.parse(raw) as StuckFixture
}

/** Quiet spawners so the repro is the only traffic. */
export function quietField(game: Game) {
  game.speed = 1
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.heloCool = 1e9
  game.milCool = 1e9
  game.ambuCool = 1e9
  game.offerCool = 1e9
  game.mxOfferCool = 1e9
  game.layoverOfferCool = 1e9
  game.parkingCool = 1e9
  game.crashCool = 1e9
  game.cash = 250_000
}

/** Advance the field by `minutes` sim minutes. One tick is 0.4 sim minutes. */
export function advanceSimMinutes(game: Game, minutes: number) {
  const start = game.simMinutes()
  let guard = 0
  while (game.simMinutes() - start < minutes - 1e-9) {
    game.tick(0.05)
    guard += 1
    if (guard > 20_000) throw new Error('clock did not advance')
  }
}

/**
 * Place the fixture's flight and return it. Landing also parks a broken
 * taxi-out on the runway exit so the arrival cannot roll off.
 */
export function applyStuckRepro(game: Game, fixture: StuckFixture): Flight {
  const stands = tilesOf(game.tiles, 'stand')
  const stand = stands[0]
  if (!stand) throw new Error(`${fixture.flightNo}: starter field has no stand`)
  if (fixture.klass === 'landing') return placeLanding(game, fixture, stand)
  if (fixture.klass === 'board') return placeBoard(game, fixture, stand)
  return placeTaxi(game, fixture, stand)
}

/** Grass cell the BU130 chord aims at, so a test can prove the jet never uses it. */
export function taxiChordTarget(stand: Vec): Vec {
  return { c: stand.c + 5, r: stand.r }
}

function placeTaxi(game: Game, fixture: StuckFixture, stand: Vec): Flight {
  const target = taxiChordTarget(stand)
  const flight = blankFlight(fixture, {
    id: 'bu130',
    phase: 'taxi_out',
    stand,
    x: stand.c,
    y: stand.r,
    path: [stand, target],
  })
  if (jetRouteOnGraph(game.tiles, flight.path)) {
    throw new Error('BU130 chord is on the taxiway graph; the repro would not stall')
  }
  game.flights.push(flight)
  return flight
}

function placeBoard(game: Game, fixture: StuckFixture, stand: Vec): Flight {
  const flight = blankFlight(fixture, {
    id: 'zo116',
    phase: 'board',
    stand,
    x: stand.c,
    y: stand.r,
    path: [stand],
    paxIn: 6,
  })
  game.flights.push(flight)
  return flight
}

function placeLanding(game: Game, fixture: StuckFixture, stand: Vec): Flight {
  const route = game.landingRoute(stand)
  if (!route || route.length < 3) throw new Error('BU131: no landing route')
  const exitIdx = route.findIndex((cell, index) => index > 0 && game.tile(cell) !== 'runway')
  if (exitIdx <= 0) throw new Error('BU131: landing route has no taxi exit')
  const exit = route[exitIdx]
  const hold = route[exitIdx - 1]
  const blocker = blankFlight(
    {
      ...fixture,
      flightNo: 'BU-EXIT',
      ledger: [],
    },
    {
      id: 'bu-exit',
      phase: 'taxi_out',
      stand,
      x: exit.c,
      y: exit.r,
      path: [exit, { c: exit.c + 6, r: exit.r + 6 }],
    },
  )
  if (jetRouteOnGraph(game.tiles, blocker.path)) {
    throw new Error('BU131 exit holder is on the taxiway graph; it would roll away')
  }
  const arrival = blankFlight(fixture, {
    id: 'bu131',
    phase: 'landing',
    stand,
    x: hold.c,
    y: hold.r,
    z: 0.2,
    path: route,
    seg: exitIdx - 1,
  })
  // The holder is registered first, so it heads the exit queue.
  game.flights.push(blocker, arrival)
  return arrival
}

function blankFlight(
  fixture: StuckFixture,
  pose: {
    id: string
    phase: Phase
    stand: Vec
    x: number
    y: number
    z?: number
    path: Vec[]
    seg?: number
    paxIn?: number
  },
): Flight {
  return {
    id: pose.id,
    airline: fixture.airline as AirlineId,
    flightNo: fixture.flightNo,
    airframeId: fixture.airframeId,
    airframeName: fixture.airframeId,
    pax: fixture.pax,
    cargo: false,
    craft: 'jet',
    kind: 'regional',
    phase: pose.phase,
    stand: pose.stand,
    x: pose.x,
    y: pose.y,
    z: pose.z ?? 0.12,
    heading: 0,
    path: pose.path,
    seg: pose.seg ?? 0,
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
      paxIn: pose.paxIn ?? 0,
    },
    phaseTime: 0,
    ledger: fixture.ledger.map((line) => ({ ...line })),
  }
}
