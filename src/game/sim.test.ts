import { describe, expect, it } from 'vitest'
import type { Flight } from './types.ts'
import { Game } from './sim.ts'

function openPremade(game: Game, origin: { c: number; r: number }) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) game.tiles[origin.r + r][origin.c + c] = 'grass'
  }
  const before = game.fits.length
  game.placePremade(origin)
  const site = game.sites.at(-1)
  expect(site?.kind).toBe('premade')
  game.finishSite(site!)
  game.sites = game.sites.filter((s) => s !== site)
  expect(game.fits.length).toBe(before + 1)
  return game.fits[game.fits.length - 1]
}

describe('multi-hall premade terminals', () => {
  it('keeps capacity, rooms, wear, and stand routing on the hall that owns the stand', () => {
    const game = new Game()
    game.beginNew('easy')
    game.buyLand('city')

    const t1Origin = { c: 10, r: 10 }
    const t2Origin = { c: 22, r: 10 }
    const fit1 = openPremade(game, t1Origin)
    expect(fit1.capGuests).toBe(40)
    expect(game.hallLabel(fit1)).toBe('T1')
    const fit2 = openPremade(game, t2Origin)
    expect(fit2.capGuests).toBe(40)
    expect(game.hallLabel(fit2)).toBe('T2')

    expect(fit1.rooms.lounge).toBe(1)
    expect(fit2.rooms.lounge).toBe(1)
    fit1.rooms.lounge = 5
    expect(fit2.rooms.lounge).toBe(1)

    game.bumpWear('bath', 40, fit1)
    expect(fit1.wearBath).toBe(40)
    expect(fit2.wearBath).toBe(0)
    game.scrubHall(fit1)
    expect(fit1.wearBath).toBeLessThan(40)
    expect(fit2.wearBath).toBe(0)

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

    const flight: Flight = {
      id: 'flt-t2',
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
    }
    game.flights.push(flight)
    game.seedHallForFlight(flight, 'arrive')
    const t2Guests = game.hallGuests.filter((g) => g.flightId === flight.id)
    expect(t2Guests.length).toBeGreaterThan(0)
    for (const g of t2Guests) expect(g.hallId).toBe(game.hallKey(fit2))

    fit1.rooms.bagclaim = 2
    fit2.rooms.bagclaim = 2
    flight.claimLane = 1
    flight.bagUnits = 80
    const other: Flight = {
      ...flight,
      id: 'flt-t1',
      flightNo: 'HB101',
      stand: stand1,
      claimLane: null,
      bagUnits: 10,
    }
    game.flights.push(other)
    game.assignClaimLane(other)
    expect(other.claimLane).toBe(1)
  })
})
