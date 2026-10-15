import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'

function starter(): Game {
  const game = new Game()
  game.sandbox = true
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 0
  return game
}

describe('check-in contract demand', () => {
  it('blocks a second passenger contract until the player adds desks', () => {
    const game = starter()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    expect(game.signed).toEqual(['northline'])

    game.offer = { airline: 'harbor', age: 0, deadline: 36 }
    const blocked = game.checkinSignReport('harbor')
    expect(blocked.ok).toBe(false)
    expect(blocked.line).toContain('Add check-in desks')
    expect(blocked.line).toContain('passengers a minute')
    game.acceptOffer()
    expect(game.signed).not.toContain('harbor')
    expect(game.offer?.airline).toBe('harbor')
    expect(game.news.some((note) => note.text.includes('Add check-in desks'))).toBe(true)

    game.offer = { airline: 'umazon', age: 0, deadline: 36 }
    game.acceptOffer()
    expect(game.signed).toContain('umazon')

    game.paxDesks = 8
    game.offer = { airline: 'harbor', age: 0, deadline: 36 }
    expect(game.checkinSignReport('harbor').ok).toBe(true)
    game.acceptOffer()
    expect(game.signed).toContain('harbor')
  })
})
