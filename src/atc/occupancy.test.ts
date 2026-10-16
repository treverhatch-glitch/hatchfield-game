import { describe, expect, it } from 'vitest'
import { ARRIVAL_OCCUPANCY_SEC } from './capacity.ts'
import { MIN_RUNWAY } from '../game/catalog.ts'
import { runwayStrips, tilesOf } from '../game/path.ts'
import { Game } from '../game/sim.ts'
import { mulberry32 } from '../playtest/personas.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  game.scheduleAuto = false
  game.weather = 'clear'
  game.signed = ['harbor']
  game.schedule = []
  game.clock = 400
  game.spawnCool = 0
  return game
}

describe('measured strip occupancy', () => {
  it('keeps the starter arrival and departure locks inside the occupancy constants', () => {
    const random = Math.random
    Math.random = mulberry32(0x5171)
    const game = field()
    const strips = runwayStrips(game.tiles, MIN_RUNWAY)
    expect(strips.length).toBe(1)
    expect(tilesOf(game.tiles, 'runway').length).toBeGreaterThan(0)
    game.addManualSlot('harbor', 2)

    let lockOn: number | null = null
    let lockOff: number | null = null
    let depLockOn: number | null = null
    let depLockOff: number | null = null
    let sawLanding = false

    for (let i = 0; i < 12000; i++) {
      game.tick(0.05)
      const f = game.flights.find((row) => (row.craft ?? 'jet') === 'jet')
      if (!f) {
        if (game.flightsDone > 0) break
        continue
      }
      const holds = game.atc.holdsRunway(f.id)
      if (holds && lockOn == null && (f.phase === 'approach' || f.phase === 'landing')) lockOn = game.clock
      if (
        lockOn != null &&
        lockOff == null &&
        !holds &&
        (f.phase === 'landing' || f.phase === 'taxi_in' || f.phase === 'deboard' || f.phase === 'servicing')
      ) {
        lockOff = game.clock
      }
      if (f.phase === 'landing') sawLanding = true
      if (sawLanding && (f.phase === 'taxi_out' || f.phase === 'takeoff') && holds && depLockOn == null) {
        depLockOn = game.clock
      }
      if (depLockOn != null && depLockOff == null && !holds && f.phase === 'takeoff') depLockOff = game.clock
      if (f.phase === 'gone') break
    }

    expect(lockOn).not.toBeNull()
    expect(lockOff).not.toBeNull()
    expect(depLockOn).not.toBeNull()
    expect(depLockOff).not.toBeNull()
    const arrival = (lockOff ?? 0) - (lockOn ?? 0)
    const departure = (depLockOff ?? 0) - (depLockOn ?? 0)
    expect(arrival).toBeGreaterThanOrEqual(8)
    expect(arrival).toBeLessThanOrEqual(ARRIVAL_OCCUPANCY_SEC + 1)
    expect(departure).toBeGreaterThanOrEqual(10)
    // Seed 0x5171 on the four-stall hall holds the strip for 13.85s.
    // Bag tugs cross the taxi on one cell. The spacing constant stays 14s.
    expect(departure).toBeCloseTo(13.85, 2)
    expect(game.flightsDone).toBeGreaterThan(0)
    Math.random = random
  }, 20_000)
})
