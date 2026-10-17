import { beforeEach, describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import { Game } from './sim.ts'
import { itemDef } from './terminal.ts'
import { arrivalKeys, createPhoneShell, flashPreview, letterOnStack, phoneSync } from '../phone/logic.ts'
import { readPhoneCards } from '../phone/readGame.ts'
import { withSeed } from '../test/withSeed.ts'

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
    const fit = game.activeHall()!
    // The starter kiosk would still be open. This case is a hall with no open desk.
    fit.items = (fit.items ?? []).filter((it) => {
      const def = itemDef(it.def)
      return !(def && def.staff <= 0 && (def.room === 'checkin' || def.room === 'bagdrop'))
    })
    for (const it of fit.items) {
      const def = itemDef(it.def)
      if (def?.room === 'checkin' || def?.room === 'bagdrop') it.bundle = false
    }
    const guest = spawnHallGuest('desk', 'depart', 'budget', { hallId: game.hallKey(fit) })
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
  it('flashes the phone preview within 20s and stays off the letter stack', () => {
    expect(letterOnStack('contract', true)).toBe(false)
    expect(letterOnStack('crash', true)).toBe(true)
    for (const seed of [1, 7, 11, 23]) {
      withSeed(seed, () => {
        const game = passengerField()
        game.speed = 1
        const opened = game.clock
        for (let t = 0; t < 20 && !game.offer; t += 0.25) game.tick(0.25)
        expect(game.offer, `seed ${seed}`).not.toBeNull()
        const waited = game.clock - opened
        expect(waited, `seed ${seed} after ${waited}s`).toBeLessThanOrEqual(20)
        const cards = readPhoneCards(game)
        const contract = cards.find((card) => card.id === 'contract')
        expect(contract?.arrives, `seed ${seed}`).toBe(true)
        expect(contract?.preview, `seed ${seed}`).toMatch(/wants a contract/)
        const shell = phoneSync(createPhoneShell(), arrivalKeys(cards))
        expect(flashPreview(cards, shell.flashKey), `seed ${seed}`).toBeTruthy()
      })
    }
  })
})
