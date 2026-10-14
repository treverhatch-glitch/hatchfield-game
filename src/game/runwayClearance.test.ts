import { describe, expect, it } from 'vitest'
import { Game } from './sim'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.cash = 500_000
  return game
}

describe('runway clearance placement', () => {
  it('blocks buildings in the shoulder and still lets a taxiway cross', () => {
    const game = field()
    expect(game.tile({ c: 10, r: 24 })).toBe('grass')

    game.setTool('stand')
    game.placeSingle({ c: 10, r: 24 })
    expect(game.sites).toHaveLength(0)
    expect(game.tile({ c: 10, r: 24 })).toBe('grass')
    expect(game.news[0]?.text ?? '').toMatch(/clearance/i)
    expect(game.ghostBlocked([{ c: 10, r: 24 }])).toBe(true)

    game.setTool('taxi')
    expect(game.ghostBlocked([{ c: 10, r: 24 }])).toBe(false)
    game.placeSingle({ c: 10, r: 24 })
    expect(game.sites.some((site) => site.tile === 'taxi')).toBe(true)

    const close = field()
    close.setTool('runway')
    close.placeRunway({ c: 8, r: 24 })
    expect(close.sites.some((site) => site.tile === 'runway')).toBe(false)
    expect(close.news[0]?.text ?? '').toMatch(/clearance/i)

    close.facing = 'v'
    close.placeRunway({ c: 2, r: 0 })
    expect(close.sites.some((site) => site.tile === 'runway')).toBe(true)
  })
})
