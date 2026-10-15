import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'

describe('ban clock', () => {
  it('does not treat a missing ban as active while the clock is negative', () => {
    const game = new Game()
    game.beginNew('easy')
    game.clock = -0.14
    game.signed = ['northline', 'bushline']
    game.airlineBanUntil = {}
    expect(game.isBanned('northline')).toBe(false)
    expect(game.banRemaining('bushline')).toBe(0)

    game.airlineBanUntil.northline = 0
    expect(game.isBanned('northline')).toBe(false)

    const before = game.schedule.length
    game.addManualSlot('northline', 22)
    expect(game.schedule.length).toBe(before + 1)
    expect(game.schedule.some((s) => s.airline === 'northline')).toBe(true)
    expect(game.news.some((n) => n.text.includes('banned'))).toBe(false)
  })

  it('still refuses a slot while a ban is in the future', () => {
    const game = new Game()
    game.beginNew('easy')
    game.clock = -0.14
    game.signed = ['northline']
    game.airlineBanUntil = { northline: game.clock + 90 }
    expect(game.isBanned('northline')).toBe(true)
    expect(game.banRemaining('northline')).toBeCloseTo(90, 5)

    const before = game.schedule.length
    game.addManualSlot('northline', 22)
    expect(game.schedule.length).toBe(before)
    expect(game.news.some((n) => /banned/i.test(n.text))).toBe(true)
  })
})
