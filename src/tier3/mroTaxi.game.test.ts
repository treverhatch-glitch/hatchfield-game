import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import type { Flight, Vec } from '../game/types.ts'
import { MRO_BAYS, MRO_TAXI_MINUTES } from './config.ts'
import { bayOffset } from './taxi.ts'

function parked(game: Game, stand: Vec, id: string, airframeId: string): Flight {
  const flight: Flight = {
    id,
    airline: 'northline',
    flightNo: id.toUpperCase(),
    airframeId,
    airframeName: airframeId,
    pax: 20,
    cargo: false,
    craft: 'jet',
    kind: airframeId === 'a380' ? 'widebody' : airframeId === 'b789' ? 'widebody' : 'narrowbody',
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
      bagDrop: true,
      mx: false,
      deiced: true,
    },
    waitingOn: { bags: false, bagsLoad: false, fuel: false, catering: false, mx: false, deice: false, paxOut: 0, paxIn: 0 },
    phaseTime: 4,
    ledger: [],
  }
  game.flights.push(flight)
  return flight
}

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.fieldXp = 700
  game.researchUnlocked = ['night_bank', 'deice', 'stand_class', 'heavy_pack', 'mro_hangar', 'cargo_night_hub']
  game.cash = 400_000
  game.mechanics = 16
  game.tiles[23][11] = 'taxi'
  game.tool = 'mro'
  game.placeSingle({ c: 10, r: 23 })
  game.tickConstruction(30)
  game.speed = 1
  game.spawnCool = 10_000
  game.offerCool = 10_000
  return game
}

describe('hangar taxi on the apron', () => {
  it('rolls a narrowbody into the bay and back out without getting stuck', () => {
    const game = field()
    const flight = parked(game, { c: 12, r: 21 }, 'flt-narrow', 'b738')
    const samples: { x: number; y: number }[] = []
    for (let i = 0; i < 8; i++) {
      game.tick(0.5)
      samples.push({ x: flight.x, y: flight.y })
    }
    const moved = samples.some((sample, index) => {
      const prev = samples[index - 1]
      return prev && Math.hypot(sample.x - prev.x, sample.y - prev.y) > 0.05
    })
    expect(moved).toBe(true)
    const bay = game.tier3Snapshot().mro.jobs[0]
    expect(bay?.phase === 'in_bay' || bay?.phase === 'taxi_out' || bay == null).toBe(true)
    const slot = bayOffset('narrow-a', 'narrow')
    const visitedBay = samples.some((sample) => Math.hypot(sample.x - (10 + slot.c), sample.y - (23 + slot.r)) < 0.35)
    expect(visitedBay).toBe(true)
    const occupiedWhileThere = samples.filter((sample) => Math.hypot(sample.x - (10 + slot.c), sample.y - (23 + slot.r)) < 0.35)
    expect(occupiedWhileThere.length).toBeGreaterThan(0)
    expect(game.tier3Snapshot().mro.occupied).toBe(game.tier3.activeJobs().filter((job) => job.phase === 'in_bay' || job.phase === 'taxi_in' || job.phase === 'taxi_out').length)

    const narrow = MRO_BAYS[0]
    const serviceSeconds = narrow.checkMinutes / 8 + 1
    let leftBay = false
    let backTowardStand = false
    game.tick(serviceSeconds)
    for (let i = 0; i < 12; i++) {
      game.tick(0.4)
      const job = game.tier3.activeJobs().find((item) => item.aircraftId === flight.id)
      const distStand = Math.hypot(flight.x - 12, flight.y - 21)
      const distBay = Math.hypot(flight.x - (10 + slot.c), flight.y - (23 + slot.r))
      if (job?.phase === 'taxi_out' && distStand < distBay) backTowardStand = true
      if (!job || distStand < 0.35) leftBay = true
    }
    expect(backTowardStand || leftBay).toBe(true)
    expect(flight.phase === 'mx_taxi' || flight.phase === 'mx_bay').toBe(false)
  })

  it('uses the wide and jumbo slots for those airframes', () => {
    const wide = bayOffset('wide', 'wide')
    const jumbo = bayOffset('jumbo', 'jumbo')
    expect(wide).not.toEqual(jumbo)
    expect(bayOffset('narrow-a', 'narrow')).not.toEqual(wide)
    const game = field()
    parked(game, { c: 12, r: 21 }, 'flt-wide', 'b789')
    game.tick(0.2)
    expect(game.tier3Snapshot().mro.jobs[0]?.bayId).toBe('wide')
    expect(game.tier3.activeJobs()[0]?.size).toBe('wide')
    const jumboGame = field()
    parked(jumboGame, { c: 12, r: 21 }, 'flt-jumbo', 'a380')
    jumboGame.tick(0.2)
    expect(jumboGame.tier3Snapshot().mro.jobs[0]?.bayId).toBe('jumbo')
    expect(jumboGame.tier3.activeJobs()[0]?.size).toBe('jumbo')
    const minutesLeft = MRO_TAXI_MINUTES
    expect(minutesLeft).toBeGreaterThan(0)
  })
})
