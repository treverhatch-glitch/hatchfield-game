import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CART_TUNING } from '../carts/index.ts'
import { FlightCard } from '../ui/inspector/FlightCard.tsx'
import { Game } from './sim.ts'
import type { Flight, Vec } from './types.ts'

function field() {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 500_000
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.speed = 1
  return game
}

function parked(game: Game, stand: Vec, id: string): Flight {
  const flight: Flight = {
    id,
    airline: 'northline',
    flightNo: id.toUpperCase(),
    airframeId: 'crj700',
    airframeName: 'CRJ-700',
    pax: 40,
    cargo: false,
    craft: 'jet',
    kind: 'regional',
    phase: 'servicing',
    stand,
    x: stand.c,
    y: stand.r,
    z: 0.12,
    heading: 0,
    path: [stand],
    seg: 0,
    t: 0,
    holdAngle: 0,
    posted: {
      landing: true,
      bags: true,
      bagsLoad: false,
      fuel: true,
      catering: false,
      bagDrop: true,
      mx: false,
      deiced: true,
    },
    waitingOn: {
      bags: false,
      bagsLoad: true,
      fuel: false,
      catering: false,
      mx: false,
      deice: false,
      paxOut: 0,
      paxIn: 0,
    },
    phaseTime: 4,
    ledger: [],
    bagStage: 'outbound_sort',
    bagUnits: CART_TUNING.bagUnitsPerCart,
  }
  game.flights.push(flight)
  return flight
}

describe('cart wait cause', () => {
  it('says a turn is waiting on a bag cart and points at the depot stamp', () => {
    const game = field()
    const stands: Vec[] = []
    for (let i = 0; i < CART_TUNING.bagCarts + 1; i++) {
      const stand = { c: 6, r: 6 + i * 2 }
      game.tiles[stand.r]![stand.c] = 'stand'
      stands.push(stand)
    }
    game.bumpMap()
    for (let i = 0; i < stands.length; i++) parked(game, stands[i]!, `bag-${i}`)
    game.tick(0.5)

    const held = game.flights.filter((flight) => game.cartCause(flight.id) === 'Waiting on bag cart')
    expect(held.length).toBeGreaterThan(0)
    expect(game.cartWaitCount()).toBe(held.length)

    const note = game.advice.find((row) => row.id === 'cart-bag')
    expect(note?.title).toBe('Waiting on bag cart')
    expect(note?.fix).toBe('Build → Vehicle depot')
    expect(note?.detail).toMatch(/held until a bag cart is free/)

    const flight = held[0]!
    game.selectedBuilding = `${flight.stand!.c},${flight.stand!.r}`
    expect(game.buildingCard()?.note).toContain('Waiting on bag cart')
    expect(game.buildingCard()?.note).toContain('Build → Vehicle depot')

    const html = renderToStaticMarkup(<FlightCard game={game} flight={flight} />)
    expect(html).toContain('data-testid="flight-cart-cause"')
    expect(html).toContain('Waiting on bag cart')
    expect(html).toContain('Build → Vehicle depot')
    expect(html).toContain('Bags out · Waiting on bag cart')
  })
})
