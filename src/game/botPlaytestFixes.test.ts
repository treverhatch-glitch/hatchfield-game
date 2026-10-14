import { beforeEach, describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'
import { arrivalKeys, createPhoneShell, flashPreview, letterOnStack, phoneSync } from '../phone/logic.ts'
import { readPhoneCards } from '../phone/readGame.ts'

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

function passengerField(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('standard')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

beforeEach(() => {
  localStorage.clear()
})

describe('hall mood stays on the 0–100 scale', () => {
  it('clamps a lounge visit that would push a happy guest past 100', () => {
    const game = passengerField()
    const guest = spawnHallGuest('lounge', 'depart', 'premium')
    guest.node = 'lounge'
    guest.happiness = 96
    guest.clearedSec = true
    game.serveNode(guest, game.hallOpen())
    expect(guest.happiness).toBe(100)
    expect(guest.thought).toBe('Lounge calm')
  })

  it('does not let an empty check-in desk drive mood below 0', () => {
    const game = passengerField()
    game.hallStaff = []
    const guest = spawnHallGuest('desk', 'depart', 'budget')
    guest.node = 'checkin'
    guest.happiness = 1
    game.serveNode(guest, game.hallOpen())
    expect(guest.happiness).toBe(0)
    expect(guest.thought).toMatch(/empty check-in/i)
  })

  it('keeps repeated amenity visits from stacking past 100', () => {
    const game = passengerField()
    const guest = spawnHallGuest('stack', 'depart', 'business')
    guest.clearedSec = true
    guest.happiness = 90
    const open = game.hallOpen()
    for (const node of ['lounge', 'spa', 'pool', 'golf', 'shop', 'food'] as const) {
      guest.node = node
      guest.needs.play = 90
      guest.needs.energy = 90
      guest.needs.shop = 90
      guest.needs.hunger = 90
      guest.wallet = 400
      guest.prefs.play = 1
      guest.prefs.lounge = 1
      guest.prefs.shop = 1
      guest.prefs.food = 1
      game.serveNode(guest, open)
      expect(guest.happiness).toBeGreaterThanOrEqual(0)
      expect(guest.happiness).toBeLessThanOrEqual(100)
    }
    expect(guest.happiness).toBe(100)
  })
})

describe('the opening contract letter', () => {
  it('is on the letter stack and flashes the phone preview within 20s', () => {
    expect(letterOnStack('contract', true)).toBe(true)
    for (const seed of [1, 7, 11, 23]) {
      withSeed(seed, () => {
        const game = passengerField()
        game.speed = 1
        for (let t = 0; t < 20 && !game.offer; t += 0.25) game.tick(0.25)
        expect(game.offer, `seed ${seed}`).not.toBeNull()
        expect(game.clock, `seed ${seed} at ${game.clock}s`).toBeLessThanOrEqual(20)
        const cards = readPhoneCards(game)
        const shell = phoneSync(createPhoneShell(), arrivalKeys(cards))
        const preview = flashPreview(cards, shell.flashKey)
        expect(preview, `seed ${seed}`).toMatch(/wants a contract/)
        expect(cards.some((card) => card.id === 'contract' && card.arrives)).toBe(true)
      })
    }
  })
})
