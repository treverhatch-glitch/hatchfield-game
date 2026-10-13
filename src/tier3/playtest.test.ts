import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import type { Flight, Phase, Truck } from '../game/types.ts'

const PHASE_LIMIT: Partial<Record<Phase, number>> = {
  hold: 600,
  approach: 400,
  landing: 120,
  taxi_in: 240,
  deboard: 500,
  servicing: 700,
  board: 600,
  pushback: 180,
  taxi_out: 300,
  takeoff: 120,
  mx_taxi: 300,
  mx_return: 300,
  mx_bay: 1200,
}

/**
 * Headless multi-day apron with two MRO hangars and a cargo night hub.
 * Same stuck rules as the QA bot: a phase that overstays, or a truck that
 * does not move for 240 sim-seconds while it is supposed to be rolling.
 */
describe('tier III multi-day run', () => {
  it('loses no passengers or bags and leaves no aircraft or truck stuck', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.fieldXp = 700
    game.researchUnlocked = [
      'night_bank',
      'deice',
      'stand_class',
      'widebody_ops',
      'heavy_pack',
      'mro_hangar',
      'cargo_night_hub',
    ]
    game.cash = 2_000_000
    game.mechanics = 20
    game.fuelLoads = 40
    game.tankLitres = 200_000
    game.tiles[23][11] = 'taxi'
    game.tiles[23][13] = 'taxi'
    game.tiles[22][10] = 'taxi'
    game.tiles[22][14] = 'taxi'
    game.tool = 'mro'
    game.placeSingle({ c: 10, r: 23 })
    game.tickConstruction(40)
    game.placeSingle({ c: 14, r: 23 })
    game.tool = 'nighthub'
    game.placeSingle({ c: 8, r: 12 })
    game.tool = 'depot'
    game.placeSingle({ c: 15, r: 10 })
    game.tickConstruction(40)
    expect(game.tiles[23][10]).toBe('mro')
    expect(game.tiles[23][14]).toBe('mro')
    expect(game.tiles[12][8]).toBe('nighthub')
    game.upgradePowerPlant()
    game.upgradePowerPlant()
    expect(game.powerPlantTier).toBe(3)
    expect(game.powerReport().brownout).toBe(false)

    const since = new Map<string, { phase: Phase; at: number }>()
    const trucks = new Map<string, { key: string; at: number }>()
    const stuckFlights: string[] = []
    const stuckTrucks: string[] = []
    let lost = 0
    let bags = 0
    const days = 2
    const step = 2
    for (let t = 0; t < 180 * days; t += step) {
      if (game.offer) game.acceptOffer()
      game.tick(step)
      lost = Math.max(lost, game.lostPaxCount())
      bags = Math.max(bags, game.bagsLost)
      for (const flight of game.flights) noteFlight(game.clock, flight, since, stuckFlights)
      for (const truck of game.trucks) noteTruck(game.clock, truck, trucks, stuckTrucks)
    }

    expect(lost).toBe(0)
    expect(bags).toBe(0)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
    expect(stuckFlights).toEqual([])
    expect(stuckTrucks).toEqual([])
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.tier3Snapshot().mro.built).toBe(2)
    expect(game.tier3Snapshot().nightHub.built).toBe(1)
  }, 120_000)
})

function noteFlight(clock: number, flight: Flight, since: Map<string, { phase: Phase; at: number }>, stuck: string[]) {
  const row = since.get(flight.id)
  if (!row || row.phase !== flight.phase) {
    since.set(flight.id, { phase: flight.phase, at: clock })
    return
  }
  const limit = PHASE_LIMIT[flight.phase]
  if (!limit || clock - row.at <= limit) return
  const label = `${flight.flightNo} ${flight.phase}`
  if (!stuck.includes(label)) stuck.push(label)
}

function noteTruck(clock: number, truck: Truck, rows: Map<string, { key: string; at: number }>, stuck: string[]) {
  const key = `${truck.x.toFixed(2)},${truck.y.toFixed(2)}`
  const row = rows.get(truck.id)
  if (!row || row.key !== key) {
    rows.set(truck.id, { key, at: clock })
    return
  }
  if (truck.patrol || (truck.dwell ?? 0) > 0 || (truck.preDwell ?? 0) > 0) return
  if (clock - row.at <= 240) return
  const label = `${truck.id} ${truck.kind}`
  if (!stuck.includes(label)) stuck.push(label)
}
