/**
 * Default new game, no persona. Finds the in-game day the starter hall
 * first flags a check-in or security bottleneck (wait past the tuned
 * limit, or a line that has spilled its floor marks).
 * Seeded so the day in docs/playtest/STARTER_BOTTLENECK.md can be re-run.
 */
import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'

const SEED = 1
const DAY_SEC = 180
/** Stop here if the hall has not choked. Past this, the starter never bites. */
const HORIZON_DAYS = 16

function withSeed<T>(seed: number, run: () => T): T {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    return run()
  } finally {
    Math.random = orig
  }
}

function facilityChoke(game: Game): { kind: string; count: number; waitSec: number } | null {
  for (const row of game.hallNav.loads()) {
    if (row.kind !== 'checkin_desk' && row.kind !== 'security_lane') continue
    if (!row.bottleneck) continue
    return { kind: row.kind, count: row.queueLength, waitSec: Math.round(row.estWaitSec) }
  }
  return null
}

describe('starter hall bottleneck', () => {
  it('first queues past the threshold a little way into a default new game', () => {
    const found = withSeed(SEED, () => {
      const game = new Game()
      game.sandbox = false
      game.autosave = false
      game.enableHintsAtStart = false
      game.beginNew('easy')
      game.buyLand('city')
      game.buildStarterKit()
      game.speed = 1
      const target = HORIZON_DAYS * DAY_SEC
      let hit: { day: number; clock: number; kind: string; count: number; waitSec: number; signed: string[] } | null =
        null
      while (game.clock < target && !hit) {
        if (game.offer && game.checkinSignReport(game.offer.airline).ok) game.acceptOffer()
        game.tick(0.25)
        const queue = facilityChoke(game)
        if (!queue) continue
        hit = {
          day: game.gameDay() + 1,
          clock: Math.round(game.clock),
          kind: queue.kind,
          count: queue.count,
          waitSec: queue.waitSec,
          signed: game.signed.slice(),
        }
      }
      return { hit, signed: game.signed.slice() }
    })
    expect(found.hit).toMatchObject({
      day: 6,
      clock: 1067,
      kind: 'checkin_desk',
      count: 3,
      waitSec: 409,
    })
    expect(found.signed).toEqual(['air_regional_1', 'zoomjet'])
  }, 180_000)
})
