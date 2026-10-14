import { describe, expect, it } from 'vitest'
import { SIM_MINUTES_PER_REAL_SECOND } from '../core/clock.ts'
import { Game } from '../game/sim.ts'
import type { Flight, Vec } from '../game/types.ts'
import { PLANNED_TURN_SEC } from '../pax/showup.ts'
import { HOTEL_NIGHT_COST, REBOOK_FEE } from './index.ts'

function field() {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 500_000
  game.speed = 1
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

function arrival(id: string, airline: string, stand: Vec): Flight {
  return {
    id,
    airline,
    flightNo: 'HF100',
    airframeId: 'a320',
    airframeName: 'A320',
    pax: 96,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'deboard',
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
}

describe('hub wiring', () => {
  it('leaves the early hall unchanged', () => {
    const game = field()
    expect(game.fieldLevel()).toBe(1)
    expect(game.connectingShare('harbor')).toBe(0)
    expect(game.connectingShare('umazon')).toBe(0)
    expect(game.infoHotspots().some((spot) => spot.id === 'connections')).toBe(false)
    const stand = { c: 12, r: 21 }
    game.seedHallForFlight(arrival('early', 'harbor', stand), 'arrive')
    expect(game.hallGuests.some((g) => g.transfer)).toBe(false)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
    expect(game.canBuyResearch('transfer_centre').ok).toBe(false)
  })

  it('connects airside in mid-game and bills a finite miss without losing bags', () => {
    const game = field()
    game.fieldXp = 220
    expect(game.fieldLevel()).toBe(3)
    expect(game.connectingShare('umazon')).toBe(0)
    const plain = game.connectingShare('harbor')
    game.hubAirlines = ['harbor']
    const hub = game.connectingShare('harbor')
    expect(plain).toBeGreaterThan(0)
    expect(hub).toBeGreaterThan(plain)
    expect(game.connectingShare('bushline')).toBeLessThan(plain)

    const stand = { c: 12, r: 21 }
    game.seedHallForFlight(arrival('mid', 'harbor', stand), 'arrive')
    const transfers = game.hallGuests.filter((g) => g.transfer)
    expect(transfers.length).toBeGreaterThan(0)
    expect(transfers.every((g) => g.clearedSec && g.node === 'gate' && (g.needs.bags ?? 0) === 0)).toBe(true)
    expect(transfers.every((g) => !g.path.includes('checkin') && !g.path.includes('security'))).toBe(true)
    expect(game.hallGuests.some((g) => !g.transfer)).toBe(true)

    game.tick(12)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
    expect(Number.isFinite(game.cash)).toBe(true)

    const cash = game.cash
    const standing = game.standingOf('harbor')
    const billed = game.applyMissedConnection('harbor')
    expect(billed).toBe(REBOOK_FEE)
    expect(game.cash).toBe(cash - REBOOK_FEE)
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.standingOf('harbor')).toBeLessThan(standing)
    expect(game.missedConnections).toBe(1)
    expect(game.bagsLost).toBe(0)
    expect(game.bank.ledger().byCategory.missed_connection).toBe(-REBOOK_FEE)

    game.hotelLevel = 1
    const hotelCash = game.cash
    expect(game.applyMissedConnection('harbor')).toBe(HOTEL_NIGHT_COST)
    expect(game.cash).toBe(hotelCash - HOTEL_NIGHT_COST)
    expect(Number.isFinite(game.cash)).toBe(true)
  })

  it('opens the connection map and buys the Transfer Centre then the RFID line', () => {
    const game = field()
    game.fieldXp = 220
    game.researchPoints = 200
    expect(game.infoHotspots().some((spot) => spot.id === 'connections')).toBe(true)
    game.toggleInfo('connections')
    expect(game.infoOpen).toBe('connections')
    const lines = game.infoLines('connections')
    expect(lines[0]).toBe('Connection time 60 min')
    expect(lines[1]).toBe('Missed connections 0')
    expect(lines.some((line) => line.includes('→') && line.includes('walk'))).toBe(true)

    expect(game.canBuyResearch('transfer_centre').ok).toBe(true)
    game.buyResearch('transfer_centre')
    expect(game.hasResearch('transfer_centre')).toBe(true)
    expect(game.infoLines('connections')[0]).toBe('Connection time 45 min')
    expect(game.cash).toBe(500_000 - 42_000)

    game.buyResearch('rfid_bag_line')
    expect(game.hasResearch('rfid_bag_line')).toBe(true)
    expect(game.infoLines('connections')[0]).toBe('Connection time 25 min')
    expect(game.cash).toBe(500_000 - 42_000 - 28_000)
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.bagsLost).toBe(0)
    expect(game.lostPaxCount()).toBe(0)
  })

  it('notes hub connections and hotel nights when a connection window closes', () => {
    const game = field()
    game.fieldXp = 220
    game.hubAirlines = ['harbor']
    game.hotelLevel = 1
    // Sold against the planned arrival. The inbound is 44 game-minutes late, so the
    // booked departure is only 16 minutes after landing — under MCT, and the window
    // closes inside one short tick. An on-time slot this tight is not sold at all.
    const delayMin = 44
    const slackMin = 16
    game.schedule.push({
      id: 'in',
      airline: 'harbor',
      flightNo: 'HF100',
      eta: -10_000,
      status: 'done',
      delaySec: delayMin / SIM_MINUTES_PER_REAL_SECOND,
      delayReason: null,
      manual: true,
      flightId: null,
    })
    game.schedule.push({
      id: 'tight',
      airline: 'harbor',
      flightNo: 'HF200',
      eta: (game.simMinutes() + slackMin) / SIM_MINUTES_PER_REAL_SECOND - PLANNED_TURN_SEC,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: null,
    })
    const inbound = arrival('year', 'harbor', { c: 12, r: 21 })
    inbound.scheduleId = 'in'
    game.seedHallForFlight(inbound, 'arrive')
    const transfers = game.hallGuests.filter((g) => g.transfer)
    expect(transfers.length).toBeGreaterThan(0)
    game.tick(4)
    const hub = game.playtestYear.liveHub()
    expect(hub.completed + hub.missed).toBe(transfers.length)
    expect(hub.missed).toBe(transfers.length)
    expect(hub.nights).toBe(transfers.length)
    expect(game.missedHotelNights).toBe(transfers.length)
    expect(game.connectionTally.belowMct).toBe(transfers.length)
    const lines = game.infoLines('connections')
    expect(lines.some((line) => line.startsWith('Late inbound'))).toBe(true)
    expect(lines.some((line) => /Inbound was \d+ min late/.test(line))).toBe(true)
    expect(game.alerts.active.some((alert) => alert.key === 'event:missed-connection' && /minimum/.test(alert.detail))).toBe(true)
    game.tick(1)
    expect(game.playtestYear.liveHub()).toEqual(hub)
  })

  it('keeps a late inbound when its own aircraft is still on stand', () => {
    const game = field()
    game.fieldXp = 220
    game.hubAirlines = ['harbor']
    const delayMin = 44
    game.schedule.push({
      id: 'in',
      airline: 'harbor',
      flightNo: 'HF100',
      eta: -10_000,
      status: 'inbound',
      delaySec: delayMin / SIM_MINUTES_PER_REAL_SECOND,
      delayReason: null,
      manual: true,
      flightId: null,
    })
    // The ticketed departure is already inside MCT. The aircraft's own turn is still ahead.
    game.schedule.push({
      id: 'tight',
      airline: 'harbor',
      flightNo: 'HF200',
      eta: (game.simMinutes() + 16) / SIM_MINUTES_PER_REAL_SECOND - PLANNED_TURN_SEC,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: null,
    })
    const inbound = arrival('live', 'harbor', { c: 12, r: 21 })
    inbound.scheduleId = 'in'
    const cash = game.cash
    game.seedHallForFlight(inbound, 'arrive')
    const transfers = game.hallGuests.filter((g) => g.transfer)
    expect(transfers.length).toBeGreaterThan(0)
    expect(transfers.every((g) => g.thought.includes('next wave'))).toBe(true)
    // The turn is 20 real seconds. Nothing is billed before it, or after it leaves.
    game.tick(4)
    expect(game.missedConnections).toBe(0)
    expect(game.cash).toBe(cash)
    game.tick(20)
    expect(game.missedConnections).toBe(0)
    expect(game.cash).toBe(cash)
    expect(game.connectionTally.made).toBe(transfers.length)
    expect(game.connectionTally.belowMct).toBe(0)
    expect(game.hallGuests.filter((g) => g.transfer).every((g) => g.thought === 'Made the connection')).toBe(true)
  })
})
