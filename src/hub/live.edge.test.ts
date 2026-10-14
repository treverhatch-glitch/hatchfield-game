import { describe, expect, it, vi } from 'vitest'
import { SIM_MINUTES_PER_REAL_SECOND } from '../core/clock.ts'
import { checkedPieceCount } from '../game/luggage.ts'
import { Game } from '../game/sim.ts'
import type { HallNode } from '../game/guests.ts'
import type { Flight, ScheduleSlot, Tile, Vec } from '../game/types.ts'
import { PLANNED_TURN_SEC } from '../pax/showup.ts'
import { MCT_RFID, STANDING_HIT_PER_PAX } from './config.ts'

/** Curb-side rooms a connecting passenger must never stand in. Security is the only crossing. */
const LANDSIDE_ONLY: ReadonlySet<HallNode> = new Set(['entrance', 'info', 'checkin', 'bathroom', 'exit'])

type YearSeams = {
  noteHubConnections: ReturnType<typeof vi.fn>
  noteMissedConnectionNights: ReturnType<typeof vi.fn>
}

function field(level: 'mid' | 'early' = 'mid') {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 900_000
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
  if (level === 'mid') {
    game.fieldXp = 220
    game.hubAirlines = ['harbor']
  }
  return game
}

function rfidOn(game: Game) {
  game.researchPoints = 400
  game.buyResearch('transfer_centre')
  game.buyResearch('rfid_bag_line')
  expect(game.hasResearch('rfid_bag_line')).toBe(true)
  expect(game.infoLines('connections')[0]).toBe(`Connection time ${MCT_RFID} min`)
}

function seams(game: Game): YearSeams {
  const year = game as unknown as YearSeams
  year.noteHubConnections = vi.fn()
  year.noteMissedConnectionNights = vi.fn()
  return year
}

function firstStand(game: Game): Vec {
  for (let r = 0; r < game.tiles.length; r++) {
    for (let c = 0; c < game.tiles[r].length; c++) if (game.tiles[r][c] === 'stand') return { c, r }
  }
  throw new Error('no stand')
}

function grass(game: Game) {
  for (let r = 1; r < 30; r++) {
    for (let c = 1; c < 30; c++) {
      if (game.tile({ c, r }) === 'grass' && !game.siteAt({ c, r })) return { c, r }
    }
  }
  throw new Error('no grass')
}

function paint(game: Game, tile: Tile) {
  const cell = grass(game)
  game.tiles[cell.r][cell.c] = tile
  return cell
}

function slot(id: string, eta: number, extra: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return {
    id,
    airline: 'harbor',
    flightNo: id.toUpperCase(),
    eta,
    status: 'scheduled',
    delaySec: 0,
    delayReason: null,
    manual: true,
    flightId: null,
    ...extra,
  }
}

/** Timetable departure `minutes` game-minutes from now at `stand`. */
function onward(game: Game, minutes: number, stand: Vec): ScheduleSlot {
  const eta = (game.simMinutes() + minutes) / SIM_MINUTES_PER_REAL_SECOND - PLANNED_TURN_SEC
  const s = slot(`out${game.schedule.length}`, eta, { standPref: stand })
  game.schedule.push(s)
  return s
}

/** The inbound's own slot, `delayMin` game-minutes behind plan. Done, so it adds no movement. */
function inbound(game: Game, delayMin: number): ScheduleSlot {
  const s = slot('in', -10_000, { status: 'done', delaySec: delayMin / SIM_MINUTES_PER_REAL_SECOND })
  game.schedule.push(s)
  return s
}

function flight(id: string, stand: Vec | null, extra: Partial<Flight> = {}): Flight {
  return {
    id,
    airline: 'harbor',
    flightNo: 'HF100',
    airframeId: 'a320',
    airframeName: 'A320',
    pax: 120,
    cargo: false,
    craft: 'jet',
    kind: 'narrowbody',
    phase: 'deboard',
    stand,
    x: stand?.c ?? 0,
    y: stand?.r ?? 0,
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
    ...extra,
  }
}

function land(game: Game, f: Flight) {
  game.seedHallForFlight(f, 'arrive')
  return game.hallGuests.filter((g) => g.transfer && g.flightId === f.id)
}

function drain(game: Game, sec: number, each?: () => void) {
  for (let t = 0; t < sec; t += 0.25) {
    game.tick(0.25)
    each?.()
  }
}

function transferHits(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter((call) => call[2] === 'transfers')
}

function bagsOf(game: Game, ids: string[]) {
  return ids.flatMap((id) => game.bagTagsFor(id).filter((tag) => tag.kind === 'transfer'))
}

describe('live minimum connection time', () => {
  it('makes the connection exactly at MCT and just over, and loads every bag', () => {
    for (const minutes of [MCT_RFID, MCT_RFID + 0.1]) {
      const game = field()
      rfidOn(game)
      const year = seams(game)
      const stand = firstStand(game)
      onward(game, minutes, stand)
      const heat = vi.spyOn(game, 'adjustHeat')
      const transfers = land(game, flight(`exact${minutes}`, stand))
      expect(transfers.length).toBeGreaterThan(0)
      const ids = transfers.map((g) => g.id)
      const pieces = transfers.reduce((n, g) => n + checkedPieceCount(g.tag), 0)
      expect(bagsOf(game, ids)).toHaveLength(pieces)

      drain(game, 6)
      expect(game.hallGuests.some((g) => ids.includes(g.id))).toBe(false)
      expect(game.missedConnections).toBe(0)
      expect(transferHits(heat)).toHaveLength(0)
      const bags = bagsOf(game, ids)
      expect(bags).toHaveLength(pieces)
      expect(bags.every((tag) => tag.loaded && tag.picked && tag.fault == null)).toBe(true)
      expect(game.bagsMishandled).toBe(0)
      expect(game.bagsLost).toBe(0)
      expect(year.noteHubConnections).toHaveBeenCalledTimes(1)
      expect(year.noteHubConnections).toHaveBeenCalledWith(transfers.length, 0)
      expect(year.noteMissedConnectionNights).not.toHaveBeenCalled()
    }
  })

  it('never sells a departure just under MCT on an on-time inbound', () => {
    const game = field()
    rfidOn(game)
    const stand = firstStand(game)
    onward(game, MCT_RFID - 0.1, stand)
    inbound(game, 0)
    const transfers = land(game, flight('ontime', stand, { scheduleId: 'in' }))
    expect(transfers.length).toBeGreaterThan(0)
    const ids = transfers.map((g) => g.id)
    drain(game, 12)
    expect(game.missedConnections).toBe(0)
    expect(bagsOf(game, ids).every((tag) => tag.loaded && tag.fault == null)).toBe(true)
  })

  it('misses just under MCT when the inbound ran late, bills once and rebooks the bags', () => {
    const game = field()
    rfidOn(game)
    const year = seams(game)
    const stand = firstStand(game)
    onward(game, MCT_RFID - 0.1, stand)
    inbound(game, 0.2)
    const heat = vi.spyOn(game, 'adjustHeat')
    const cash = game.cash
    const transfers = land(game, flight('late', stand, { scheduleId: 'in' }))
    const n = transfers.length
    expect(n).toBeGreaterThan(0)
    const ids = transfers.map((g) => g.id)
    const pieces = transfers.reduce((sum, g) => sum + checkedPieceCount(g.tag), 0)

    drain(game, 4)
    expect(game.missedConnections).toBe(n)
    const hits = transferHits(heat)
    expect(hits).toHaveLength(n)
    for (const hit of hits) expect(hit[1]).toBeCloseTo(-STANDING_HIT_PER_PAX, 9)
    expect(game.cash).toBeLessThan(cash)
    const bags = bagsOf(game, ids)
    expect(bags).toHaveLength(pieces)
    for (const tag of bags) {
      expect(tag.fault).toBe('missed_connection')
      expect(tag.loaded).toBe(false)
      expect(tag.connectFlightId).toBe('rebook:harbor')
    }
    expect(game.bagsMishandled).toBe(pieces)
    expect(year.noteHubConnections).toHaveBeenCalledWith(0, n)
    expect(year.noteMissedConnectionNights).not.toHaveBeenCalled()

    // Nothing bills or counts twice once the window has closed.
    drain(game, 8)
    expect(game.missedConnections).toBe(n)
    expect(transferHits(heat)).toHaveLength(n)
    expect(game.bagsMishandled).toBe(pieces)
    expect(Number.isFinite(game.cash)).toBe(true)
  })
})

describe('live links between terminals', () => {
  const cases: { tile: Tile | null; word: string }[] = [
    { tile: 'mover', word: 'people mover' },
    { tile: 'xferbus', word: 'transfer bus' },
    { tile: null, word: 'walk' },
  ]
  for (const { tile, word } of cases) {
    it(`connects by ${word}`, () => {
      const game = field()
      rfidOn(game)
      if (tile) paint(game, tile)
      const stand = firstStand(game)
      onward(game, 60, stand)
      const transfers = land(game, flight(`link-${word}`, stand))
      expect(transfers.length).toBeGreaterThan(0)
      expect(transfers.every((g) => g.thought.startsWith(`Connecting — ${word} to gate`))).toBe(true)
      drain(game, 10)
      expect(game.missedConnections).toBe(0)
      expect(bagsOf(game, transfers.map((g) => g.id)).every((tag) => tag.loaded && !tag.fault)).toBe(true)
    })
  }

  it('connects across a skywalk to the gate of the booked departure in the other hall', () => {
    const game = field()
    game.fieldXp = 420
    rfidOn(game)
    const origin = game.fits[0].origin
    game.fits.push({ ...game.fits[0], origin: { c: origin.c, r: origin.r - 9 }, items: [] })
    for (let r = origin.r - 6; r <= origin.r - 1; r++) game.tiles[r][origin.c] = 'skywalk'
    const near = { c: origin.c - 3, r: origin.r - 8 }
    game.tiles[near.r][near.c] = 'stand'
    const far = { c: 12, r: 21 }
    expect(game.connectionLink(`${near.c},${near.r}`, `${far.c},${far.r}`)).toBe('skywalk')
    onward(game, 90, far)
    const transfers = land(game, flight('sky', near))
    expect(transfers.length).toBeGreaterThan(0)
    expect(transfers.every((g) => g.thought === `Connecting — skywalk to gate ${far.c},${far.r}`)).toBe(true)
    drain(game, 14)
    expect(game.missedConnections).toBe(0)
    expect(bagsOf(game, transfers.map((g) => g.id)).every((tag) => tag.loaded && !tag.fault)).toBe(true)
  })
})

describe('disrupted inbounds', () => {
  it('a hub meltdown delay turns a sold connection into one miss per passenger', () => {
    for (const melt of [false, true]) {
      const game = field()
      game.fieldXp = 700
      rfidOn(game)
      const stand = firstStand(game)
      const own = slot('in', game.clock + 30)
      game.schedule.push(own)
      if (melt) {
        expect(game.triggerDisruption('hub-meltdown')).not.toBeNull()
        expect(own.status).toBe('delayed')
        expect(own.delaySec).toBeGreaterThan(0)
      }
      // It lands now; its own onward leg sits far behind.
      own.status = 'done'
      onward(game, 10, stand)
      const heat = vi.spyOn(game, 'adjustHeat')
      const transfers = land(game, flight(`melt${melt}`, stand, { scheduleId: 'in' }))
      const n = transfers.length
      expect(n).toBeGreaterThan(0)
      drain(game, 14)
      if (melt) {
        expect(game.missedConnections).toBe(n)
        expect(transferHits(heat)).toHaveLength(n)
      } else {
        // Not sold on a 10 min connection, so a later flight is booked and made.
        expect(game.missedConnections).toBe(0)
        expect(transferHits(heat)).toHaveLength(0)
      }
    }
  })

  it('an inbound diverted after a long hold bills its connectors once', () => {
    const game = field()
    const year = seams(game)
    game.schedule.push(slot('in', game.clock, { status: 'inbound' }))
    const f = flight('held', firstStand(game), { phase: 'hold', phaseTime: 100, scheduleId: 'in' })
    game.flights.push(f)
    const share = game.connectingShare('harbor')
    expect(share).toBeGreaterThan(0)
    const heat = vi.spyOn(game, 'adjustHeat')
    const mishandled = game.bagsMishandled

    game.tickHoldWatchdog(0)
    expect(f.phase).toBe('gone')
    const n = game.missedConnections
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThanOrEqual(18)
    const hits = transferHits(heat)
    expect(hits).toHaveLength(1)
    expect(hits[0][1]).toBeCloseTo(-STANDING_HIT_PER_PAX * n, 9)
    expect(year.noteHubConnections).toHaveBeenCalledWith(0, n)
    expect(game.bagsMishandled).toBe(mishandled)

    game.tickHoldWatchdog(0)
    drain(game, 2)
    expect(game.missedConnections).toBe(n)
    expect(transferHits(heat)).toHaveLength(1)
  })

  it('a cancelled slot never boards connectors, so no miss and no transfer hit', () => {
    const game = field()
    game.schedule.push(slot('gone', game.clock + 40))
    const heat = vi.spyOn(game, 'adjustHeat')
    game.cancelSlot('gone')
    drain(game, 2)
    expect(game.missedConnections).toBe(0)
    expect(transferHits(heat)).toHaveLength(0)
    expect(game.hallGuests.some((g) => g.transfer)).toBe(false)
  })

  it('a hosted divert is not ticketed through this hub', () => {
    const game = field()
    const transfers = land(game, flight('hosted', firstStand(game), { hostKind: 'divert' }))
    expect(transfers).toHaveLength(0)
    expect(game.hallGuests.some((g) => g.flightId === 'hosted')).toBe(true)
  })
})

describe('transfer passengers stay airside', () => {
  it('never steps landside or into check-in, even when they need the WC', () => {
    const game = field()
    const stand = firstStand(game)
    onward(game, 120, stand)
    const transfers = land(game, flight('airside', stand))
    expect(transfers.length).toBeGreaterThan(0)
    for (const g of transfers) {
      g.needs.bladder = 95
      g.needs.hunger = 60
    }
    const ids = new Set(transfers.map((g) => g.id))
    const visited = new Set<HallNode>()
    drain(game, 14, () => {
      for (const g of game.hallGuests) {
        if (!ids.has(g.id)) continue
        visited.add(g.node)
        for (const node of g.path) visited.add(node)
        expect(g.clearedSec).toBe(true)
      }
    })
    for (const node of LANDSIDE_ONLY) expect(visited.has(node)).toBe(false)
    expect(visited.has('claim')).toBe(false)
    expect(game.lostPaxCount()).toBe(0)
  })
})

describe('year counters and empty loads', () => {
  it('feeds hotel nights for each missed connection when a hotel is open', () => {
    const game = field()
    rfidOn(game)
    game.hotelLevel = 1
    const year = seams(game)
    const stand = firstStand(game)
    onward(game, MCT_RFID - 0.1, stand)
    inbound(game, 0.2)
    const n = land(game, flight('hotel', stand, { scheduleId: 'in' })).length
    expect(n).toBeGreaterThan(0)
    drain(game, 4)
    const nights = year.noteMissedConnectionNights.mock.calls.reduce((sum, call) => sum + Number(call[0]), 0)
    expect(nights).toBe(n)
    expect(year.noteHubConnections).toHaveBeenCalledWith(0, n)
  })

  it('has no NaN or negative counts with zero transfer passengers', () => {
    const game = field('early')
    expect(game.fieldLevel()).toBe(1)
    const year = seams(game)
    const cash = game.cash
    expect(land(game, flight('quiet', firstStand(game)))).toHaveLength(0)
    drain(game, 4)
    expect(game.applyMissedConnections('harbor', 0)).toBe(0)
    expect(game.applyMissedConnections('harbor', Number.NaN)).toBe(0)
    expect(game.applyMissedConnections('harbor', -4)).toBe(0)
    expect(game.missedConnections).toBe(0)
    expect(game.bagsMishandled).toBe(0)
    expect(game.cash).toBeLessThanOrEqual(cash)
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(year.noteHubConnections).not.toHaveBeenCalled()
    expect(year.noteMissedConnectionNights).not.toHaveBeenCalled()
    expect(game.infoLines('connections')[1] ?? 'Missed connections 0').toBe('Missed connections 0')
  })
})
