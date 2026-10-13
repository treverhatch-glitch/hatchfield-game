import { beforeEach, describe, expect, it } from 'vitest'
import { LAND, RUNWAY_PREFAB_COST, START_CASH, STARTER_KIT_COST } from './catalog.ts'
import { Game } from './sim.ts'
import type { FieldTask } from './types.ts'

function fresh(difficulty: 'easy' | 'standard' = 'standard'): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew(difficulty)
  game.buyLand('city')
  return game
}

beforeEach(() => {
  localStorage.clear()
})

describe('field and info letters', () => {
  it('keeps a field ask after Got it, and does not show that same letter again', () => {
    const game = fresh()
    const task: FieldTask = {
      id: 'ask-1',
      airline: 'northline',
      kind: 'bathroom',
      title: 'Restrooms',
      blurb: 'Add a restroom',
      bonus: 1000,
      deadline: game.clock + 80,
      age: 0,
    }
    game.fieldTask = task
    expect(game.letterAcked('field:ask-1')).toBe(false)
    game.ackLetter('field:ask-1')
    expect(game.letterAcked('field:ask-1')).toBe(true)
    expect(game.fieldTask?.id).toBe('ask-1')
    expect(game.letterAcked('field:ask-2')).toBe(false)
  })
})

describe('Accept on a prospect letter', () => {
  it('signs Zoomjet when the field can host them', () => {
    const game = fresh('easy')
    game.buildStarterKit()
    game.presentNegotiation('zoomjet')
    expect(game.offer?.airline).toBe('zoomjet')
    game.acceptNegotiation()
    expect(game.signed).toContain('zoomjet')
    expect(game.offer).toBeNull()
  })

  it('names the missing requirement and leaves the letter up', () => {
    const game = fresh('easy')
    game.buildStarterKit()
    game.presentNegotiation('harbor')
    game.acceptNegotiation()
    expect(game.signed).not.toContain('harbor')
    expect(game.offer?.airline).toBe('harbor')
    expect(game.news[0]?.text ?? '').toMatch(/will not sign yet/i)
    expect(game.news[0]?.text ?? '').toMatch(/still need/i)
  })

  it('says so when no letter is open', () => {
    const game = fresh('easy')
    game.buildStarterKit()
    game.offer = null
    game.acceptNegotiation()
    expect(game.news[0]?.text ?? '').toMatch(/no contract letter/i)
  })
})

describe('starter kit on a fresh plot', () => {
  it('will not let a runway spend the kit budget', () => {
    const game = fresh('standard')
    const left = START_CASH.standard - LAND.city.cost
    expect(game.cash).toBe(left)
    expect(left - RUNWAY_PREFAB_COST).toBeLessThan(STARTER_KIT_COST)
    expect(game.spend(RUNWAY_PREFAB_COST, 'runway')).toBe(false)
    expect(game.cash).toBe(left)
    expect(game.news[0]?.text ?? '').toMatch(/starter kit/i)

    game.placeRunway({ c: 2, r: 20 })
    expect(game.cash).toBe(left)
    expect(game.sites.some((s) => s.kind === 'runway')).toBe(false)
  })

  it('still stamps the kit when a stray runway is already on the grass', () => {
    const game = fresh('easy')
    for (let c = 0; c < 8; c++) game.tiles[12][c] = 'runway'
    expect(game.starterFieldUp()).toBe(false)
    game.buildStarterKit()
    expect(game.fits.length).toBe(1)
    expect(game.starterFieldUp()).toBe(true)
  })

  it('releases the budget when the player builds freehand', () => {
    const game = fresh('standard')
    game.chooseFreehand()
    expect(game.starterFreehand).toBe(true)
    expect(game.starterKitProtected()).toBe(false)
    const before = game.cash
    expect(game.spend(1_000, 'taxi')).toBe(true)
    expect(game.cash).toBe(before - 1_000)
  })
})
