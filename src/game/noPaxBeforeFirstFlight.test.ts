import { describe, expect, it } from 'vitest'
import { PLANNED_TURN_SEC } from '../pax/showup.ts'
import { Game } from './sim.ts'

function fresh(focus: 'pax' | 'cargo' | 'hybrid' = 'pax'): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = focus
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

describe('no passengers before the first show-up', () => {
  it('stays empty until the show-up window, then admits a departure', () => {
    const game = fresh('pax')
    expect(game.hallGuests).toHaveLength(0)
    expect(game.terminalPaxCount()).toBe(0)
    for (let i = 0; i < 40; i++) game.tick(0.5)
    expect(game.hallGuests.filter((g) => !g.dead)).toHaveLength(0)
    expect(game.terminalPaxCount()).toBe(0)

    const openAt = game.clock + 30
    const fit = game.fits[0]
    game.schedule.push({
      id: 'wp1-show',
      airline: 'northline',
      flightNo: 'NL9',
      eta: openAt - PLANNED_TURN_SEC,
      status: 'inbound',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: null,
    })
    game.showUps.push({
      slotId: 'wp1-show',
      std: openAt,
      hallId: game.hallKey(fit),
      airlineId: 'northline',
      intl: false,
      tags: ['budget'],
      releases: [openAt],
      spawned: 0,
      flightId: null,
      closed: false,
    })
    game.tick(0.5)
    expect(game.clock).toBeLessThan(openAt)
    expect(game.hallGuests.filter((g) => !g.dead)).toHaveLength(0)
    expect(game.terminalPaxCount()).toBe(0)

    game.clock = openAt
    game.tick(0.05)
    expect(game.hallGuests.some((g) => !g.dead && !g.preview)).toBe(true)
    expect(game.terminalPaxCount()).toBeGreaterThan(0)
  })

  it('starts a cargo field with an empty hall too', () => {
    const game = fresh('cargo')
    expect(game.hallGuests).toHaveLength(0)
    expect(game.terminalPaxCount()).toBe(0)
  })
})
