// @ts-expect-error vitest is provided by test runner
import { describe, expect, test } from 'vitest'
import { Game } from './sim'

describe('Multi-hall Premade Terminals', () => {
  test('places two prefabs and asserts two halls with separate capacities, rooms, and stats', () => {
    const game = new Game()
    game.beginNew('easy')
    game.buyLand('city')

    const t1Origin = { c: 10, r: 10 }
    const t2Origin = { c: 22, r: 10 }

    // Place first premade terminal
    game.tool = 'premade'
    game.placePremade(t1Origin)
    expect(game.fits.length).toBe(1)
    const fit1 = game.fits[0]
    expect(fit1.capGuests).toBe(28)
    expect(game.hallLabel(fit1)).toBe('T1')

    // Place second premade terminal
    game.placePremade(t2Origin)
    expect(game.fits.length).toBe(2)
    const fit2 = game.fits[1]
    expect(fit2.capGuests).toBe(28)
    expect(game.hallLabel(fit2)).toBe('T2')

    // Both halls have independent room counts and wear stats
    expect(fit1.rooms.lounge).toBe(1)
    expect(fit2.rooms.lounge).toBe(1)

    // Modifying rooms on T1 does not affect T2
    fit1.rooms.lounge = 5
    expect(fit1.rooms.lounge).toBe(5)
    expect(fit2.rooms.lounge).toBe(1)

    // Modifying wear on T1 does not affect T2
    game.bumpWear('bath', 40, fit1)
    expect(fit1.wearBath).toBe(40)
    expect(fit2.wearBath).toBe(0)

    // Scrubbing T1 cleans T1 without mutating T2
    game.scrubHall(fit1)
    expect(fit1.wearBath).toBeLessThan(40)
    expect(fit2.wearBath).toBe(0)

    // Test routing flights and passengers to the hall serving its stand
    // Place jetway stands near T1 and T2
    const stand1 = { c: 10, r: 14 }
    const stand2 = { c: 22, r: 14 }

    game.tiles[stand1.r][stand1.c] = 'stand'
    game.tiles[stand2.r][stand2.c] = 'stand'
    game.standAccess[`${stand1.c},${stand1.r}`] = 'jetway'
    game.standAccess[`${stand2.c},${stand2.r}`] = 'jetway'

    expect(game.jetwayHall(stand1)?.origin).toEqual(t1Origin)
    expect(game.jetwayHall(stand2)?.origin).toEqual(t2Origin)
    expect(game.roomsAt(stand1)?.origin).toEqual(t1Origin)
    expect(game.roomsAt(stand2)?.origin).toEqual(t2Origin)

    // Seed a flight at stand 2 (T2)
    const flightId = 'flt-t2'
    game.flights.push({
      id: flightId,
      airline: 'harbor',
      flightNo: 'HB202',
      airframeId: 'atr72',
      airframeName: 'ATR 72',
      pax: 50,
      cargo: false,
      craft: 'jet',
      kind: 'regional',
      phase: 'servicing',
      stand: stand2,
      x: stand2.c,
      y: stand2.r,
      z: 0,
      heading: 0,
      path: [],
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: {
        landing: true,
        bags: false,
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
        fuel: false,
        catering: false,
        mx: false,
        deice: false,
        paxOut: 0,
        paxIn: 0,
      },
      phaseTime: 0,
      ledger: [],
    })

    game.seedHallForFlight(game.flights[0], 'arrive')

    const t2Guests = game.hallGuests.filter((g) => g.flightId === flightId)
    expect(t2Guests.length).toBeGreaterThan(0)
    for (const g of t2Guests) {
      expect(g.hallId).toBe(game.hallKey(fit2))
    }
  })
})
