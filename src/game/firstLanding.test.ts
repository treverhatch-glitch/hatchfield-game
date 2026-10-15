import { describe, expect, it } from 'vitest'
import { OPENING_RESERVE, START_CASH, STARTER_KIT_COST, LAND } from './catalog.ts'
import { FIRST_LETTER_COOL, FIRST_SLOT_GAP } from './openingData.ts'
import { runwayExitCells } from './tips.ts'
import { Game } from './sim.ts'
import type { Phase } from './types.ts'

/**
 * Real seconds at 1×. The first contract flight has to be on the ground
 * inside this window on a new game that stamps its kit and signs the letter.
 */
export const FIRST_LANDING_LIMIT_SEC = 180

const LANDED: ReadonlySet<Phase> = new Set([
  'landing',
  'taxi_in',
  'deboard',
  'servicing',
  'board',
  'parked',
  'pushback',
  'taxi_out',
  'takeoff',
  'gone',
])

function withSeed(seed: number, run: () => void) {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    run()
  } finally {
    Math.random = orig
  }
}

/** Eager new game: stamp the chosen kit, sign the first letter, run at 1×. */
function firstLandingSec(seed: number, focus: 'pax' | 'cargo'): number | null {
  let landed: number | null = null
  withSeed(seed, () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('standard')
    const site = focus === 'cargo' ? 'factory' : 'city'
    expect(game.startChosenKit(site, focus)).toBe(true)
    expect(game.starterKitStamped).toBe(true)
    game.speed = 1
    const opened = game.clock
    for (let t = 0; t < FIRST_LANDING_LIMIT_SEC; t += 0.5) {
      if (game.offer && game.signed.length === 0) game.acceptNegotiation()
      game.tick(0.5)
      const down = game.flights.some((f) => game.signed.includes(f.airline) && LANDED.has(f.phase))
      if (down) {
        landed = game.clock - opened
        break
      }
    }
  })
  return landed
}

describe('first landing on a new game', () => {
  it('leaves an operating reserve after the standard kit', () => {
    expect(START_CASH.standard - LAND.city.cost - STARTER_KIT_COST).toBe(OPENING_RESERVE)
    expect(FIRST_LETTER_COOL).toBeLessThanOrEqual(4)
    expect(FIRST_SLOT_GAP).toBeLessThanOrEqual(8)
  })

  it('the starter strip has a threshold exit and a mid-strip exit', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('standard')
    game.startChosenKit('city', 'pax')
    const exits = runwayExitCells(game.tiles)
    const rows = new Set(exits.map((e) => e.r))
    expect(exits.length).toBeGreaterThan(1)
    expect(rows.size).toBeGreaterThan(1)
  })

  it('lands the first contract flight within 180 real seconds at 1×', { timeout: 120_000 }, () => {
    const times: number[] = []
    for (const seed of [1, 7, 11, 23, 41]) {
      const at = firstLandingSec(seed, 'pax')
      expect(at, `passenger seed ${seed}`).not.toBeNull()
      expect(at!, `passenger seed ${seed} landed at ${at}s`).toBeLessThanOrEqual(FIRST_LANDING_LIMIT_SEC)
      times.push(at!)
    }
    const cargo = firstLandingSec(5, 'cargo')
    expect(cargo, 'cargo seed 5').not.toBeNull()
    expect(cargo!, `cargo seed 5 landed at ${cargo}s`).toBeLessThanOrEqual(FIRST_LANDING_LIMIT_SEC)
    times.push(cargo!)
    expect(Math.max(...times)).toBeLessThanOrEqual(FIRST_LANDING_LIMIT_SEC)
  })
})
