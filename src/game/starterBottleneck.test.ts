/**
 * Default new game, no persona. Seeded so the note in
 * docs/playtest/STARTER_BOTTLENECK.md can be re-run.
 * Passengers ride to the four-stall curb. Bag tugs use the truck pavement,
 * and check-in first crosses the 360s red line on day 7. The peak is that
 * same reading.
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
  it('flags check-in on day 7 once the tug trains clear the stands', () => {
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
      let hit: { day: number; clock: number; kind: string; count: number; waitSec: number } | null = null
      let peak = { day: 0, kind: '', count: 0, waitSec: 0 }
      while (game.clock < target && !hit) {
        if (game.offer && game.checkinSignReport(game.offer.airline).ok) game.acceptOffer()
        game.tick(0.25)
        for (const row of game.hallNav.loads()) {
          if (row.kind !== 'checkin_desk' && row.kind !== 'security_lane') continue
          const waitSec = Math.round(row.estWaitSec)
          if (waitSec > peak.waitSec) peak = { day: game.gameDay() + 1, kind: row.kind, count: row.queueLength, waitSec }
        }
        const queue = facilityChoke(game)
        if (!queue) continue
        hit = {
          day: game.gameDay() + 1,
          clock: Math.round(game.clock),
          kind: queue.kind,
          count: queue.count,
          waitSec: queue.waitSec,
        }
      }
      return { hit, peak, signed: game.signed.slice() }
    })
    expect(found.hit).toEqual({ day: 7, clock: 1216, kind: 'checkin_desk', count: 1, waitSec: 400 })
    expect(found.signed).toEqual(['air_regional_1', 'zoomjet'])
    expect(found.peak).toEqual({ day: 7, kind: 'checkin_desk', count: 1, waitSec: 400 })
  }, 180_000)
})
