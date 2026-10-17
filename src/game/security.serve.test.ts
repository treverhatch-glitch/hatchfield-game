import { describe, expect, it } from 'vitest'
import { isAirside, spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'
import { withSeed } from '../test/withSeed.ts'

function starter(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

describe('security lane releases the people it screens', () => {
  it('screens a line at the security node and lets them leave', () => {
    withSeed(3, () => {
      const game = starter()
      const hallId = game.hallKey(game.fits[0])
      for (let i = 0; i < 12; i++) {
        const g = spawnHallGuest(`lane-${i}`, 'depart', 'budget', { hallId, airlineId: 'northline' })
        g.node = 'security'
        g.path = []
        g.clearedSec = false
        g.needs.boarding = 90
        g.needs.hunger = 80
        g.needs.bladder = 4
        g.needs.shop = 4
        g.needs.play = 4
        g.needs.energy = 4
        game.hallGuests.push(g)
      }
      let sawServing = 0
      const clearedIds = new Set<string>()
      const reachedAirside = new Set<string>()
      for (let t = 0; t < 45; t += 0.25) {
        game.tick(0.25)
        for (const g of game.hallGuests) {
          if (!g.flightId.startsWith('lane-')) continue
          if (g.clearedSec) clearedIds.add(g.id)
          if (g.clearedSec && isAirside(g.node)) reachedAirside.add(g.id)
          if (!g.clearedSec && (g.serviceLeft ?? 0) > 0) sawServing += 1
        }
      }
      const still = game.hallGuests.filter((g) => g.flightId.startsWith('lane-') && g.node === 'security')
      expect(sawServing).toBeGreaterThan(0)
      expect(clearedIds.size).toBe(12)
      expect(game.missedFlights).toBe(0)
      for (const g of still) {
        expect(g.clearedSec).toBe(true)
        expect(g.path[g.seg + 1]).toBeTruthy()
        expect(g.serviceLeft ?? 0).toBe(0)
      }
      const stuckIds = new Set(still.map((g) => g.id))
      for (let t = 0; t < 3; t += 0.25) game.tick(0.25)
      const remain = game.hallGuests.filter((g) => stuckIds.has(g.id) && g.node === 'security')
      expect(remain.length).toBe(0)
      expect(reachedAirside.size).toBeGreaterThan(0)
      for (const g of game.hallGuests) {
        if (!g.flightId.startsWith('lane-') || !g.clearedSec) continue
        expect(g.node).not.toBe('security')
        expect(isAirside(g.node)).toBe(true)
      }
    })
  })

  it('a screened passenger walks to food without being sent back through security', () => {
    withSeed(5, () => {
      const game = starter()
      const fit = game.fits[0]
      const open = game.hallOpenFor(fit)
      const g = spawnHallGuest('hungry', 'depart', 'budget', {
        hallId: game.hallKey(fit),
        airlineId: 'northline',
      })
      g.node = 'gate'
      g.clearedSec = true
      g.needs.hunger = 90
      g.needs.boarding = 40
      g.needs.bladder = 4
      g.needs.shop = 4
      g.needs.play = 4
      g.needs.energy = 4
      game.hallGuests.push(g)
      game.routeGuest(g, 'food', open)
      expect(g.path[0]).toBe('gate')
      expect(g.path).not.toContain('security')
      expect(g.path.at(-1)).toBe('food')
      for (let t = 0; t < 8; t += 0.25) game.tick(0.25)
      const body = game.hallGuests.find((x) => x.flightId === 'hungry')
      expect(body?.node).not.toBe('security')
      expect(body?.clearedSec).toBe(true)
    })
  })

  it('one airline does not leave a growing crowd of screened people on the security node', () => {
    withSeed(11, () => {
      const game = starter()
      game.startFocus = 'pax'
      game.offer = { airline: 'northline', age: 0, deadline: 36 }
      game.acceptOffer()
      let peakHeld = 0
      let cleared = 0
      let maxWaitingWhileDeskEmpty = 0
      const seen = new Set<string>()
      const dayHeld: number[] = []
      const dayWaiting: number[] = []
      const dayCheckin: number[] = []
      for (let t = 0; t < 180 * 4; t += 0.5) {
        const before = new Set(game.hallGuests.filter((g) => g.clearedSec).map((g) => g.id))
        game.tick(0.5)
        for (const g of game.hallGuests) {
          if (g.clearedSec && !before.has(g.id) && !seen.has(g.id)) {
            seen.add(g.id)
            cleared += 1
          }
        }
        const checkin = game.hallGuests.filter(
          (g) => !g.dead && g.job === 'depart' && g.node === 'checkin',
        ).length
        const waiting = game.securityQueueCount()
        if (checkin === 0) maxWaitingWhileDeskEmpty = Math.max(maxWaitingWhileDeskEmpty, waiting)
        peakHeld = Math.max(
          peakHeld,
          game.hallGuests.filter((g) => g.node === 'security' && g.clearedSec).length,
        )
        if (game.clock > 0 && Math.abs(game.clock % 180) < 0.51) {
          dayHeld.push(game.hallGuests.filter((g) => g.node === 'security' && g.clearedSec).length)
          dayWaiting.push(waiting)
          dayCheckin.push(checkin)
        }
      }
      expect(cleared).toBeGreaterThan(10)
      expect(dayCheckin.length).toBeGreaterThan(0)
      // A Bellwater walk-in dip can leave one extra body on the desk at the day sample.
      expect(Math.max(...dayCheckin)).toBeLessThan(16)
      // A finished taxi frees the stand, so a later bank can reach the lane after
      // the desk has emptied. Two prefab banks may share it. The line has to fall
      // again — a new wave after an empty sample is not a queue that ratchets up.
      const twoBanks = 48
      expect(maxWaitingWhileDeskEmpty).toBeLessThan(twoBanks)
      expect(dayWaiting.every((n) => n < twoBanks)).toBe(true)
      for (let i = 1; i < dayWaiting.length; i++) {
        const prior = Math.max(...dayWaiting.slice(0, i))
        const slack = prior < 8 ? twoBanks - 8 : 8
        expect(dayWaiting[i]).toBeLessThanOrEqual(prior + slack)
      }
      expect(Math.max(...dayHeld)).toBeLessThan(20)
      expect(dayHeld[dayHeld.length - 1]).toBeLessThanOrEqual(16)
      expect(peakHeld).toBeLessThan(24)
    })
  }, 20000)
})
