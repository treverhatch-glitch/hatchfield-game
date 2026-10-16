import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { HallGuest } from '../../game/guests.ts'
import { Game } from '../../game/sim.ts'
import type { Flight } from '../../game/types.ts'
import { WalkerOnlyCard } from '../WalkerCard.tsx'
import { ApronFlightCard } from './FlightCard.tsx'
import {
  FLIGHT_CARD_BOTTOM,
  FLIGHT_CARD_WIDTH,
  closeFlightCard,
  flightLiveKey,
  isFlightCardOpen,
  openFlightCard,
  resetFlightCard,
  syncFlightCardClick,
} from './flightCard.ts'

function flightAt(stand: { c: number; r: number }): Flight {
  return {
    id: 'flt-card',
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
    ledger: [{ label: 'Landing', amount: 7400 }],
    scheduleId: 'slot-card',
    destination: 'Juneau',
  }
}

describe('apron flight card', () => {
  beforeEach(() => resetFlightCard())

  it('renders from a selected flight with the planner closed, and dismiss leaves the selection', () => {
    const game = new Game()
    const stand = { c: 4, r: 6 }
    game.tiles[stand.r]![stand.c] = 'stand'
    const flight = flightAt(stand)
    const onward: Flight = { ...flight, id: 'flt-out', flightNo: 'HB303', scheduleId: null }
    game.flights.push(flight, onward)
    game.schedule.push({
      id: 'slot-card',
      airline: 'harbor',
      flightNo: 'HB202',
      eta: 40,
      status: 'delayed',
      delaySec: 90,
      delayReason: 'Runway sequence',
      manual: false,
      flightId: flight.id,
    })
    game.hallGuests.push({
      id: 'guest-connect',
      flightId: flight.id,
      dead: false,
      transfer: true,
      connectFlightId: `connect:${onward.id}:G2`,
    } as HallGuest)
    game.selectedFlight = flight.id
    game.tool = 'pan'
    const cell = { c: stand.c, r: stand.r }
    syncFlightCardClick(game, cell, null)

    const html = renderToStaticMarkup(<ApronFlightCard game={game} />)
    expect(html).toContain('data-testid="flight-card"')
    expect(html).toContain('data-testid="flight-phase"')
    expect(html).toContain('data-phase="servicing"')
    expect(html).toContain('Servicing · 12s')
    expect(html.indexOf('flight-phase')).toBeLessThan(html.indexOf('flight-stand'))
    expect(html).not.toContain('Flight planner')
    expect(html).toContain('Harbor Air')
    expect(html).toContain('Boeing 737-800')
    expect(html).toContain(`data-testid="flight-stand">${game.gateLabel(stand)}`)
    expect(html).toContain('data-service="fuel" data-state="waiting"')
    expect(html).toContain('Bags in · Done')
    expect(html).toContain('Board · 4 still moving')
    expect(html).toContain('Runway sequence · 90s')
    expect(html).toContain('1 connection · HB303 · gate G2')
    expect(html).toContain(`width:${FLIGHT_CARD_WIDTH}px`)
    expect(html).toContain(`bottom:${FLIGHT_CARD_BOTTOM}`)
    expect(html).not.toContain('guest-card')
    expect(html).not.toContain('walker-card')

    closeFlightCard()
    expect(game.selectedFlight).toBe(flight.id)
    expect(isFlightCardOpen()).toBe(false)
    const closed = renderToStaticMarkup(<ApronFlightCard game={game} />)
    expect(closed).not.toContain('data-testid="flight-card"')
    expect(renderToStaticMarkup(<WalkerOnlyCard game={game} id={null} />)).toBe('')
  })

  it('closes on a second click and leaves the flight selected', () => {
    const game = new Game()
    const stand = { c: 8, r: 8 }
    const flight = flightAt(stand)
    game.flights.push(flight)
    game.tool = 'pan'
    const cell = { c: stand.c, r: stand.r }

    const before = game.selectedFlight
    game.clickTile(cell)
    syncFlightCardClick(game, cell, before)
    expect(game.selectedFlight).toBe(flight.id)
    expect(isFlightCardOpen()).toBe(true)
    expect(renderToStaticMarkup(<ApronFlightCard game={game} />)).toContain('HB202')

    const again = game.selectedFlight
    game.clickTile(cell)
    syncFlightCardClick(game, cell, again)
    expect(isFlightCardOpen()).toBe(false)
    expect(game.selectedFlight).toBe(flight.id)
    expect(renderToStaticMarkup(<ApronFlightCard game={game} />)).toBe('')
  })

  it('live key follows the selected flight phase, not the first flight', () => {
    const game = new Game()
    const stand = { c: 3, r: 3 }
    const first = flightAt(stand)
    first.id = 'flt-first'
    first.phase = 'landing'
    first.phaseTime = 4
    const selected = flightAt(stand)
    selected.id = 'flt-selected'
    selected.flightNo = 'HB404'
    selected.phase = 'board'
    selected.phaseTime = 2
    game.flights.push(first, selected)
    game.selectedFlight = selected.id
    openFlightCard(selected.id)

    expect(flightLiveKey(game).split('|')[1]).toBe('board')
    selected.phase = 'pushback'
    selected.phaseTime = 0.2
    expect(flightLiveKey(game).split('|')[1]).toBe('pushback')
    first.phase = 'takeoff'
    expect(flightLiveKey(game)).not.toContain('takeoff')
    expect(flightLiveKey(game).split('|')[1]).toBe('pushback')
  })
})
