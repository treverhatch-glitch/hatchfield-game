import { beforeEach, describe, expect, it } from 'vitest'
import { gateLeaseId } from '../hubprogress/leases.ts'
import { resetFlightCard, syncFlightCardClick, flightCardFlightId, isFlightCardOpen } from '../ui/inspector/flightCard.ts'
import { Game } from './sim.ts'
import type { Flight, Vec } from './types.ts'

function parked(id: string, stand: Vec): Flight {
  return {
    id,
    airline: 'harbor',
    flightNo: 'HB202',
    airframeId: 'b738',
    airframeName: 'Boeing 737-800',
    pax: 80,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'servicing',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0,
    heading: 0,
    path: [],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: true,
      bags: true,
      bagsLoad: false,
      fuel: false,
      catering: false,
      bagDrop: false,
      mx: false,
      deiced: false,
    },
    waitingOn: {
      bags: false,
      bagsLoad: false,
      fuel: true,
      catering: false,
      mx: false,
      deice: false,
      paxOut: 0,
      paxIn: 4,
    },
    phaseTime: 12,
    ledger: [],
  }
}

function field(): Game {
  const game = new Game()
  game.tool = 'pan'
  game.tiles[8]![3] = 'stand'
  game.tiles[8]![6] = 'stand'
  return game
}

describe('stand click', () => {
  beforeEach(() => resetFlightCard())

  it('opens the dedicate panel on empty stand ground', () => {
    const game = field()
    const at = { c: 3, r: 8 }
    game.clickTile(at, null)
    syncFlightCardClick(game, at, null, null)
    expect(game.assignPick).toMatchObject({ kind: 'gate', id: gateLeaseId(3, 8) })
    expect(isFlightCardOpen()).toBe(false)
  })

  it('selects the flight when the click hits the aircraft mesh on its stand', () => {
    const game = field()
    const at = { c: 3, r: 8 }
    const flight = parked('flt-mesh', at)
    game.flights.push(flight)
    const before = game.selectedFlight
    game.clickTile(at, flight.id)
    syncFlightCardClick(game, at, before, flight.id)
    expect(game.assignPick).toBeNull()
    expect(game.selectedFlight).toBe(flight.id)
    expect(isFlightCardOpen()).toBe(true)
    expect(flightCardFlightId()).toBe(flight.id)
  })

  it('keeps the stand panel closed when a plane occupies the stand and the ray misses the mesh', () => {
    const game = field()
    const at = { c: 3, r: 8 }
    const flight = parked('flt-body', at)
    game.flights.push(flight)
    game.clickTile(at, null)
    syncFlightCardClick(game, at, null, null)
    expect(game.assignPick).toBeNull()
    expect(game.selectedFlight).toBe(flight.id)
    expect(flightCardFlightId()).toBe(flight.id)
  })

  it('opens the empty stand beside a parked aircraft', () => {
    const game = field()
    game.flights.push(parked('flt-next', { c: 3, r: 8 }))
    const empty = { c: 6, r: 8 }
    game.clickTile(empty, null)
    syncFlightCardClick(game, empty, null, null)
    expect(game.assignPick).toMatchObject({ kind: 'gate', id: gateLeaseId(6, 8) })
    expect(isFlightCardOpen()).toBe(false)
  })
})
