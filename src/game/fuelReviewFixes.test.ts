import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { contractById, emptyPillar, tickFuel } from '../scale/logic.ts'
import type { FieldSnapshot } from '../scale/types.ts'
import type { Tile } from './types.ts'

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.tiles[5][6] = 'depot'
  game.tiles[5][5] = 'kitchen'
  game.bumpMap()
  game.speed = 1
  game.schedule = []
  game.flights = []
  game.spawnCool = 10_000
  game.offerCool = 10_000
  return game
}

type GroundHost = {
  ensureGround(): { sim: { fuelLitres: number } } | null
}

describe('fuel review fixes', () => {
  it('counts a depot truck load as term uplift', () => {
    const game = field()
    game.cash = 80_000
    game.signScaleContract('apex_local')
    game.tankLitres = 20_000
    game.termUpliftLitres = 0
    const ground = (game as unknown as GroundHost).ensureGround()
    expect(ground).not.toBeNull()
    ground!.sim.fuelLitres = ground!.sim.fuelLitres - 6_000
    expect(game.tankLitres).toBe(14_000)
    expect(game.termUpliftLitres).toBe(6_000)
  })

  it('does not refill an empty tank when the ground sim is rebuilt', () => {
    const game = field()
    const host = game as unknown as GroundHost
    expect(host.ensureGround()).not.toBeNull()
    game.tankLitres = 0
    game.fuelLoads = 12
    game.bumpMap()
    host.ensureGround()
    expect(game.tankLitres).toBe(0)
  })

  it('keeps road tankers coming on a rail term while the line is not laid', () => {
    const tiles: Tile[][] = Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 'grass' as Tile))
    tiles[2][2] = 'fuel'
    const snap: FieldSnapshot = {
      size: 6,
      fieldLevel: 5,
      research: ['rail_fuel'],
      tiles,
      standScale: {},
      standClass: {},
      standAccess: {},
      hangarScale: {},
      legacyFuel: false,
    }
    const state = emptyPillar()
    state.contractId = 'mega_jumbo'
    state.supply = 'rail'
    state.tankTier = 3
    const lead = contractById('mega_jumbo')!.leadMinutes
    const result = tickFuel(snap, state, lead + 1, 5_000_000)
    expect(result.method).toBe('road')
    expect(result.delivered).toBeGreaterThan(0)
  })
})
