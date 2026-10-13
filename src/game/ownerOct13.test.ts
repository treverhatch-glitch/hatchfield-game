import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
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
  game.offerCool = 1e9
  game.heloCool = 1e9
  game.milCool = 1e9
  game.ambuCool = 1e9
  game.threatCool = 1e9
  game.emergencyCool = 1e9
  return game
}

function parked(game: Game, stand: Vec, cargo = false): Flight {
  const f: Flight = {
    id: cargo ? 'flt-cargo' : 'flt-pax',
    airline: 'northline',
    flightNo: cargo ? 'NL200' : 'NL100',
    airframeId: 'crj700',
    airframeName: 'CRJ-700',
    pax: cargo ? 0 : 20,
    cargo,
    craft: 'jet',
    kind: cargo ? 'freighter' : 'regional',
    phase: 'board',
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
      fuel: false,
      catering: true,
      bagDrop: true,
      mx: false,
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
    phaseTime: 400,
    ledger: [],
  }
  game.flights.push(f)
  return f
}

describe('owner decisions 13 Oct', () => {
  it('grounds a departure that needs fuel when the farm is empty', () => {
    const game = field()
    game.fuelLoads = 0
    const f = parked(game, { c: 12, r: 21 })
    const before = game.standingOf('northline')
    game.tick(0.3)
    expect(f.phase).toBe('board')
    expect(game.news.some((n) => n.text.includes('grounded'))).toBe(true)
    expect(game.standingOf('northline')).toBeLessThan(before)

    game.fuelLoads = 4
    game.tick(0.3)
    expect(f.phase).toBe('board')
    expect(game.news.some((n) => n.text.includes('has fuel again'))).toBe(true)
  })

  it('lets a fueled aircraft leave when the ramp is short on something else', () => {
    const game = field()
    game.tiles[10][15] = 'depot'
    game.bumpMap()
    const f = parked(game, { c: 12, r: 21 })
    f.phase = 'servicing'
    f.phaseTime = 0
    game.beginServicing(f)
    expect(f.groundTurn).toBe('12,21')
    f.posted.fuel = true
    f.phase = 'board'
    f.phaseTime = 400
    const before = game.standingOf('northline')
    game.tick(0.4)
    expect(f.phase).toBe('pushback')
    expect(game.news.some((n) => n.text.includes('ramp unfinished'))).toBe(true)
    expect(game.standingOf('northline')).toBeLessThan(before)
  })

  it('does not hold threats or emergency asks behind a first-hour timer', () => {
    const game = field()
    expect(game.threatCool).toBe(1e9)
    const fresh = new Game()
    fresh.sandbox = false
    fresh.beginNew('easy')
    fresh.buyLand('city')
    fresh.buildStarterKit()
    expect(fresh.threatCool).toBe(45)
    expect(fresh.emergencyCool).toBe(70)

    fresh.startFocus = 'cargo'
    fresh.buildStarterKit()
    expect(fresh.threatCool).toBe(45)
    expect(fresh.emergencyCool).toBe(70)

    fresh.startFocus = 'pax'
    fresh.buildStarterKit()
    fresh.signed = ['northline']
    fresh.fits[0].rooms.security = 0
    parked(fresh, { c: 12, r: 21 })
    fresh.threatCool = 0
    fresh.tickThreats(1)
    expect(fresh.threatCool).toBeGreaterThan(8)
    expect(fresh.threatCool).toBeLessThan(20)

    fresh.fits[0].rooms.security = 2
    fresh.budgets.security = 100
    fresh.pendingThreat = null
    fresh.threatCool = 0
    fresh.tickThreats(1)
    expect(fresh.threatCool).toBeGreaterThan(30)
    expect(fresh.threatCool).toBeLessThan(50)

    fresh.pendingThreat = null
    fresh.fuelLoads = 0
    fresh.fuelBrand = null
    fresh.emergencyCool = 0
    fresh.tickEmergencies(1)
    expect(fresh.emergencyCool).toBeGreaterThan(10)
    expect(fresh.emergencyCool).toBeLessThan(22)
  })

  it('walks a passenger off an empty counter and logs the lost spend', () => {
    const game = field()
    const open = game.hallOpen()
    game.foodShelf = 0
    game.shopShelf = 0
    const hungry = spawnHallGuest('f1', 'depart', 'budget')
    hungry.node = 'food'
    hungry.needs.hunger = 80
    hungry.wallet = 80
    hungry.prefs.food = 1
    hungry.clearedSec = true
    const cash = game.cash
    const mood = hungry.happiness
    game.serveNode(hungry, open)
    expect(game.cash).toBe(cash)
    expect(hungry.happiness).toBe(mood - 3)
    expect(hungry.thought).toBe('wish they had burgers')
    expect(hungry.needs.hunger).toBeLessThanOrEqual(18)
    expect(hungry.path.length).toBeGreaterThan(1)
    expect(game.lostSpend).toBe(12)

    const shopper = spawnHallGuest('f2', 'depart', 'budget')
    shopper.node = 'shop'
    shopper.needs.shop = 80
    shopper.wallet = 80
    shopper.prefs.shop = 1
    shopper.clearedSec = true
    const shopMood = shopper.happiness
    game.serveNode(shopper, open)
    expect(shopper.thought).toBe('wish they had souvenirs')
    expect(shopper.happiness).toBe(shopMood - 3)
    expect(shopper.path[shopper.path.length - 1]).not.toBe('shop')
    expect(game.lostSpend).toBe(12 + 18)
    expect(game.cash).toBe(cash)

    game.foodShelf = 2
    const buyer = spawnHallGuest('f3', 'depart', 'budget')
    buyer.node = 'food'
    buyer.needs.hunger = 90
    buyer.wallet = 80
    buyer.prefs.food = 1
    buyer.clearedSec = true
    game.serveNode(buyer, open)
    expect(game.foodShelf).toBe(1)
    expect(game.cash).toBe(cash + 12)
    expect(buyer.thought).toBe('Ate (−$12)')
  })

  it('keeps info-view counts behind a click and leaves flow lines off', () => {
    const game = field()
    expect(game.showFlows).toBe(false)
    const ids = game.infoHotspots().map((h) => h.id)
    expect(ids).toEqual(['queue', 'lost', 'bags', 'retail', 'fuel', 'power'])
    expect(game.infoOpen).toBeNull()
    expect(game.infoLines('queue').join(' ')).toMatch(/\d+ waiting at security/)
    expect(game.infoLines('retail').join(' ')).toMatch(/lost spend/)
    game.toggleInfo('queue')
    expect(game.infoOpen).toBe('queue')
    expect(game.showFlows).toBe(false)
    game.toggleInfo('queue')
    expect(game.infoOpen).toBeNull()
  })
})
