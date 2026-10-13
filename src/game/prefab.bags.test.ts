import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'
import { SIZE, type Flight } from './types.ts'

function quiet(tier: 1 | 2 | 3) {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  while ((game.fits[0].tier ?? 1) < tier) game.upgradeHall()
  game.deskStaff = 3
  game.assignHallStaff()
  game.speed = 1
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.offerCool = 1e9
  game.threatCool = 1e9
  game.emergencyCool = 1e9
  game.heloCool = 1e9
  game.milCool = 1e9
  game.ambuCool = 1e9
  return game
}

function parked(game: Game, id: string): Flight {
  const stand = { c: 12, r: 21 }
  const f: Flight = {
    id,
    airline: 'northline',
    flightNo: 'NL240',
    airframeId: 'crj700',
    airframeName: 'CRJ-700',
    pax: 40,
    cargo: false,
    craft: 'jet',
    kind: 'regional',
    phase: 'parked',
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
      bagsLoad: true,
      fuel: true,
      catering: true,
      bagDrop: false,
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
    bagUnits: 6,
    bagStage: 'pax_deposit',
    bagsDeposited: 0,
    claimLane: 1,
  }
  game.flights.push(f)
  return f
}

function dropWave(game: Game, flightId: string) {
  const fit = game.fits[0]
  const hallId = game.hallKey(fit)
  for (let i = 0; i < 8; i++) {
    const g = spawnHallGuest(flightId, 'depart', 'budget', { hallId, airlineId: 'northline' })
    g.node = 'checkin'
    g.path = []
    g.clearedSec = false
    g.hasChecked = true
    g.carryOn = true
    g.bagDepositLeft = 0.15
    g.needs.hunger = 2
    g.needs.bladder = 2
    g.needs.shop = 2
    g.needs.play = 2
    g.needs.energy = 2
    g.needs.boarding = 80
    game.hallGuests.push(g)
  }
}

describe('prefab bags', () => {
  for (const tier of [1, 2, 3] as const) {
    it(`prefab ${tier} keeps every checked bag through screening, the aircraft, and claim`, () => {
      const game = quiet(tier)
      const flight = parked(game, `bags-${tier}`)
      dropWave(game, flight.id)
      for (let t = 0; t < 6; t += 0.5) game.tick(0.5)
      const screened = game.bagBook(flight.id)
      expect(game.bagsLost).toBe(0)
      expect(screened).toBeTruthy()
      expect(screened!.dropped).toBeGreaterThan(0)
      expect(screened!.screened).toBe(screened!.dropped)
      expect(screened!.lost).toBe(0)
      expect(flight.bagStage === 'outbound_sort' || flight.bagStage === 'load_aircraft').toBe(true)

      flight.bagStage = 'inflight'
      game.tick(0.5)
      const loaded = game.bagBook(flight.id)!
      expect(loaded.loaded).toBe(loaded.dropped)
      expect(loaded.lost).toBe(0)
      expect(game.bagsLost).toBe(0)

      flight.bagStage = 'on_claim'
      const fit = game.fits[0]
      const hallId = game.hallKey(fit)
      const servedBefore = game.paxServed
      for (let i = 0; i < 4; i++) {
        const g = spawnHallGuest(flight.id, 'arrive', 'budget', { hallId, airlineId: 'northline' })
        g.node = 'claim'
        g.path = []
        g.clearedSec = true
        g.hasChecked = false
        g.carryOn = true
        g.needs.bags = 12
        g.needs.hunger = 2
        g.needs.bladder = 2
        g.needs.shop = 2
        g.needs.play = 2
        g.needs.energy = 2
        g.needs.boarding = 0
        game.hallGuests.push(g)
      }
      for (let t = 0; t < 6; t += 0.5) game.tick(0.5)
      expect(game.bagsLost).toBe(0)
      expect(game.paxServed).toBeGreaterThan(servedBefore)
      const picked = game.bagBook(flight.id)!
      expect(picked.lost).toBe(0)
      expect(picked.claimed).toBe(picked.units)

      flight.bagStage = 'complete'
      game.tick(0.5)
      const done = game.bagBook(flight.id)!
      expect(done.lost).toBe(0)
      expect(done.claimed).toBe(done.units)
      expect(game.bagsLost).toBe(0)
      expect(game.lostPaxCount()).toBe(0)
    })
  }

  it('a custom hall with no bag building and no belt can lose an unscreened drop', () => {
    const game = quiet(1)
    game.fits[0].redesigned = true
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const tile = game.tiles[r][c]
        if (tile === 'bags' || tile === 'belt') game.tiles[r][c] = 'grass'
      }
    }
    expect(game.bagHallReady()).toBe(false)
    const flight = parked(game, 'custom-bags')
    expect(game.prefabFlight(flight)).toBe(false)
    dropWave(game, flight.id)
    for (let t = 0; t < 4; t += 0.5) game.tick(0.5)
    const book = game.bagBook(flight.id)
    expect(book?.dropped).toBeGreaterThan(0)
    expect(book?.lost).toBe(book?.dropped)
    expect(game.bagsLost).toBeGreaterThan(0)
  })
})
