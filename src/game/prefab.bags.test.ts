import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import { STARTER_CAPACITY } from './openingData.ts'
import { Game } from './sim.ts'
import { SIZE, type Flight, type Truck } from './types.ts'

function quiet(tier: 1 | 2 | 3) {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  game.fieldXp = 2300
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
      expect(game.bagsMishandled).toBe(0)
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

  it('pairs each arrival with their own bags and keeps a normal prefab free of mishandled bags', () => {
    const game = quiet(1)
    const flight = parked(game, 'pair')
    flight.bagStage = 'on_claim'
    const hallId = game.hallKey(game.fits[0])
    const people = []
    for (let i = 0; i < 2; i++) {
      const g = spawnHallGuest(flight.id, 'arrive', 'family', { hallId, airlineId: 'northline' })
      g.node = 'claim'
      g.path = []
      g.clearedSec = true
      g.hasChecked = false
      g.needs.bags = 40
      g.needs.hunger = 2
      g.needs.bladder = 2
      g.needs.shop = 2
      g.needs.play = 2
      g.needs.energy = 2
      people.push(g)
      game.hallGuests.push(g)
    }
    game.tick(0.5)
    for (const g of people) {
      const tags = game.bagTagsFor(g.id)
      expect(tags.length).toBe(2)
      expect(tags.every((t) => t.ownerPassengerId === g.id && t.flightId === flight.id && t.kind === 'in')).toBe(
        true,
      )
    }
    const [fast, slow] = people
    for (const tag of game.bagTagsFor(fast.id)) {
      tag.releaseAt = 0
      tag.wait = 0
      tag.onClaim = false
    }
    for (const tag of game.bagTagsFor(slow.id)) {
      tag.releaseAt = 8
      tag.wait = 0
      tag.onClaim = false
    }
    game.tick(0.5)
    game.tick(0.5)
    expect(fast.hasChecked).toBe(true)
    expect(fast.needs.bags).toBe(0)
    expect(fast.thought).toBe('Heading to exit')
    expect(fast.path[fast.path.length - 1]).toBe('exit')
    expect(game.bagTagsFor(fast.id).every((t) => t.picked && t.onClaim)).toBe(true)
    expect(slow.hasChecked).toBe(false)
    expect(slow.thought).toBe('Waiting for my bag')
    expect(game.bagTagsFor(slow.id).every((t) => !t.picked && !t.onClaim)).toBe(true)
    expect(game.bagsMishandled).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('keeps a transfer bag on the connecting flight in a prefab, and sends a missed one to the desk', () => {
    const game = quiet(1)
    const gone = parked(game, 'gone-conn')
    gone.phase = 'gone'
    game.spawnTransferGuest('northline')
    const guest = game.hallGuests.find((g) => g.transfer)
    expect(guest).toBeTruthy()
    const tags = game.bagTagsFor(guest!.id)
    expect(tags.length).toBeGreaterThan(0)
    expect(tags.every((t) => t.kind === 'transfer' && t.ownerPassengerId === guest!.id)).toBe(true)
    game.tick(0.5)
    expect(game.bagsMishandled).toBe(0)
    expect(game.bagTagsFor(guest!.id).every((t) => t.loaded && t.fault == null)).toBe(true)

    game.fits[0].redesigned = true
    const custom = quiet(1)
    custom.fits[0].redesigned = true
    const missed = parked(custom, 'missed-conn')
    missed.phase = 'gone'
    custom.spawnTransferGuest('northline')
    const who = custom.hallGuests.find((g) => g.transfer)!
    const before = who.happiness
    for (const tag of custom.bagTagsFor(who.id)) tag.connectFlightId = 'missed-conn'
    custom.tick(0.5)
    expect(custom.bagsMishandled).toBeGreaterThan(0)
    expect(who.atBagDesk).toBe(true)
    expect(who.bagFault).toBe('missed_connection')
    expect(who.happiness).toBeLessThan(before)
    expect(who.thought.startsWith('Lost-bag desk')).toBe(true)
  })

  it('a prefab under normal load does not call a slow carousel mishandled', () => {
    const game = quiet(1)
    const flight = parked(game, 'slow-claim')
    flight.bagStage = 'inbound_sort'
    const g = spawnHallGuest(flight.id, 'arrive', 'budget', {
      hallId: game.hallKey(game.fits[0]),
      airlineId: 'northline',
    })
    g.node = 'claim'
    g.path = []
    g.clearedSec = true
    g.needs.bags = 40
    g.needs.hunger = 2
    g.needs.bladder = 2
    g.needs.shop = 2
    g.needs.play = 2
    g.needs.energy = 2
    game.hallGuests.push(g)
    for (let t = 0; t < 24; t += 0.5) game.tick(0.5)
    expect(game.bagsMishandled).toBe(0)
    expect(g.atBagDesk).toBeFalsy()
    expect(g.bagFault == null).toBe(true)
  })

  function bagTruck(flightId: string, mission: Truck['mission']): Truck {
    return {
      id: 'trk-test',
      kind: 'bags',
      flightId,
      x: 0,
      y: 0,
      path: [],
      seg: 0,
      t: 0,
      returning: false,
      dwell: 0,
      preDwell: 0,
      patrol: false,
      mission,
      home: null,
      cargoUnits: 0,
    }
  }

  it('does not call a short cart loaded, and records the bags left behind on release', () => {
    const game = quiet(1)
    const flight = parked(game, 'short-out')
    flight.phase = 'board'
    flight.pax = 193
    flight.bagUnits = 193
    flight.bagsDeposited = 0
    flight.bagStage = 'pax_deposit'
    flight.posted.bagsLoad = false
    flight.posted.fuel = true
    flight.waitingOn.bagsLoad = true
    game.finishTruck(bagTruck(flight.id, 'load'))
    expect(flight.posted.bagsLoad).toBe(false)
    expect(flight.bagStage).not.toBe('inflight')
    expect(flight.bagsOffloaded ?? 0).toBe(0)

    flight.phaseTime = 40
    game.tick(0.5)
    expect(['pushback', 'taxi_out', 'takeoff']).toContain(flight.phase)
    expect(flight.bagsOffloaded).toBe(193)
    expect(flight.bagsLoaded).toBe(0)
    expect((flight.bagsLoaded ?? 0) + (flight.bagsOffloaded ?? 0)).toBe(flight.bagUnits ?? 0)
    expect(flight.posted.bagsLoad).toBe(false)
    expect(flight.bagStage).not.toBe('inflight')
    expect(game.bagBook(flight.id)?.offloaded).toBe(193)
    expect(game.bagsMishandled).toBe(0)
    expect(game.bagsLost).toBe(0)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.news.some((n) => n.text.includes('offloaded, not loaded'))).toBe(true)
  })

  it('records a completed arrival cart that never made the outbound belt', () => {
    const game = quiet(1)
    const flight = parked(game, 'complete-out')
    flight.phase = 'board'
    flight.pax = 76
    flight.bagUnits = 44
    flight.bagsDeposited = 0
    flight.bagStage = 'complete'
    flight.posted.bagsLoad = false
    flight.posted.fuel = true
    flight.waitingOn.bagsLoad = false
    flight.phaseTime = 40
    game.tick(0.5)
    expect(['pushback', 'taxi_out', 'takeoff']).toContain(flight.phase)
    expect((flight.bagsDeposited ?? 0) + (flight.bagsOffloaded ?? 0)).toBeGreaterThanOrEqual(flight.bagUnits ?? 0)
    expect(flight.posted.bagsLoad).toBe(false)
    expect(game.bagsMishandled).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('calls a cart loaded only when the bags aboard cover the flight', () => {
    const game = quiet(1)
    const flight = parked(game, 'full-out')
    flight.phase = 'board'
    flight.pax = 97
    flight.bagUnits = 97
    flight.bagsDeposited = 97
    flight.bagStage = 'pax_deposit'
    flight.posted.bagsLoad = false
    flight.posted.fuel = true
    flight.waitingOn.bagsLoad = true
    game.finishTruck(bagTruck(flight.id, 'load'))
    expect(flight.posted.bagsLoad).toBe(true)
    expect(flight.bagsOffloaded ?? 0).toBe(0)
    expect(flight.bagsLoaded).toBe(97)
    expect(flight.bagStage).toBe('inflight')

    flight.phaseTime = 40
    game.tick(0.5)
    expect(['pushback', 'taxi_out', 'takeoff']).toContain(flight.phase)
    expect((flight.bagsDeposited ?? 0) + (flight.bagsOffloaded ?? 0)).toBeGreaterThanOrEqual(flight.bagUnits ?? 0)
    expect(flight.posted.bagsLoad).toBe(true)
    expect(game.bagsMishandled).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('records widebody bags that do not fit the claim instead of a coin-flip jam', () => {
    const game = quiet(1)
    const flight = parked(game, 'wide-claim')
    flight.phase = 'deboard'
    flight.pax = 400
    flight.bagUnits = 180
    flight.bagStage = 'unload_aircraft'
    flight.posted.bags = false
    game.finishTruck(bagTruck(flight.id, 'unload'))
    const hold = STARTER_CAPACITY.bagAllowance
    const overflow = 180 - hold
    expect(flight.claimLeft).toBe(overflow)
    expect(game.bagBook(flight.id)?.claimLeft).toBe(overflow)
    expect(game.news.some((n) => n.text.includes('claim jammed') && n.text.includes('offloaded'))).toBe(true)
    game.tick(0.5)
    const book = game.bagBook(flight.id)!
    expect(book.lost).toBe(0)
    expect(book.claimLeft).toBe(overflow)
    expect(book.unloaded).toBeLessThanOrEqual(hold)
    expect(game.bagsMishandled).toBe(0)
    expect(game.lostPaxCount()).toBe(0)
  })
})
