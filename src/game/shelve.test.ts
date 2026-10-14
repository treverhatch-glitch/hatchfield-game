import { describe, expect, it } from 'vitest'
import { Game } from './sim'
import { SAVE_KEY } from './types'

describe('quit to title', () => {
  it('shelves the field and leaves the save file alone', () => {
    const game = new Game()
    game.sandbox = true
    game.beginNew('easy')
    expect(game.buyLand('city')).toBe(true)
    const saved = localStorage.getItem(SAVE_KEY)
    expect(saved).toBeTruthy()
    game.shelveForTitle()
    expect(game.site).toBeNull()
    expect(game.speed).toBe(0)
    expect(game.tool).toBe('pan')
    expect(localStorage.getItem(SAVE_KEY)).toBe(saved)
  })
})
