import { describe, expect, it } from 'vitest'
import { isAirside, spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'
import { laneStats, schemeRows, schemeSigns, type PlacedItem } from './terminal.ts'

/** Mulberry32 so an overload wave does not depend on whichever test ran first. */
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

function prep(tier: 1 | 2 | 3) {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 200_000
  while ((game.fits[0].tier ?? 1) < tier) game.upgradeHall()
  game.deskStaff = 3
  game.assignHallStaff()
  game.speed = 1
  return game
}

describe('prefab overload', () => {
  for (const tier of [1, 2, 3] as const) {
    it(`prefab ${tier} keeps every passenger and asks for an upgrade when the bank is too big`, () => {
      withSeed(11, () => {
        const game = prep(tier)
        const fit = game.fits[0]
        const rows = schemeRows(tier)
        expect(fit.zones?.length).toBe(rows.length)
        expect(fit.zones?.[0]?.length).toBe(rows[0].length)
        expect(fit.signs).toBe(schemeSigns(tier))
        expect(rows[0].startsWith('C')).toBe(true)
        expect(rows.some((row) => row.includes('S'))).toBe(true)
        expect(rows.some((row) => row.includes('A'))).toBe(true)

        const open = game.hallOpenFor(fit)
        const hallId = game.hallKey(fit)
        const lane = laneStats({
          premade: true,
          tier,
          items: fit.items as PlacedItem[] | undefined,
          roomsSecurity: fit.rooms.security,
      })
      const departures = (fit.capGuests ?? 40) + 12
      const arrivals = Math.max(8, Math.round((fit.capGuests ?? 40) * 0.35))
      for (let i = 0; i < departures; i++) {
        const g = spawnHallGuest(`dep-${tier}-${i}`, 'depart', 'budget', {
          hallId,
          airlineId: 'northline',
        })
        g.needs.hunger = 4
        g.needs.bladder = 4
        g.needs.shop = 4
        g.needs.play = 4
        g.needs.energy = 4
        g.needs.boarding = 22
        g.needs.bags = 0
        g.node = 'entrance'
        g.clearedSec = false
        game.routeGuest(g, 'security', open)
        game.hallGuests.push(g)
      }
      for (let i = 0; i < arrivals; i++) {
        const g = spawnHallGuest(`arr-${tier}-${i}`, 'arrive', 'budget', {
          hallId,
          airlineId: 'northline',
        })
        g.needs.hunger = 4
        g.needs.bladder = 4
        g.needs.shop = 4
        g.needs.play = 4
        g.needs.energy = 4
        g.needs.bags = 70
        g.needs.boarding = 0
        g.node = 'gate'
        g.clearedSec = true
        game.routeGuest(g, 'claim', open)
        game.hallGuests.push(g)
      }

      let peakQueue = 0
      for (let t = 0; t < 180; t += 0.5) {
        game.tick(0.5)
        expect(game.lostPaxCount()).toBe(0)
        expect(game.hallGuests.some((g) => g.lost)).toBe(false)
        expect(game.hallGuests.some((g) => !g.clearedSec && isAirside(g.node))).toBe(false)
        peakQueue = Math.max(peakQueue, game.securityQueueCount())
      }
      expect(peakQueue).toBeGreaterThan(lane.queueCap)
      expect(game.hallOverloaded).toBe(true)
      const note = game.advice.find((a) => a.id === 'over-capacity')
      expect(note).toBeTruthy()
      expect(note?.fix).toMatch(/Upgrade the prefab|expand|design your own terminal/i)
      expect(game.missedFlights).toBeGreaterThan(0)
      })
    })
  }
})
