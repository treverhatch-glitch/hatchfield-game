import { describe, expect, it } from 'vitest'
import { Game } from './sim'
import { clampReputation, smoothReputation, takeReputationDrift } from './reputation'

describe('reputation display', () => {
  it('clamps and eases instead of snapping through a boarding wave', () => {
    expect(clampReputation(-4)).toBe(0)
    expect(clampReputation(140)).toBe(100)
    expect(clampReputation(Number.NaN)).toBe(0)
    const eased = smoothReputation(100, 4, 0.2)
    expect(eased).toBeGreaterThan(4)
    expect(eased).toBeLessThan(100)
    const burst = takeReputationDrift(50, 1)
    expect(burst.apply).toBeLessThan(50)
    expect(burst.apply + burst.left).toBeCloseTo(50)
  })

  it('keeps the HUD figure inside 0–100 while passenger drift arrives slowly', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.speed = 1
    game.reputation = -4
    game.reputationShown = 100
    for (let i = 0; i < 8; i++) game.tick(0.5)
    const shown = game.reputationDisplay()
    expect(shown).toBeGreaterThanOrEqual(0)
    expect(shown).toBeLessThanOrEqual(100)
    expect(game.reputation).toBeGreaterThanOrEqual(0)
    expect(game.reputation).toBeLessThanOrEqual(100)
    expect(shown).toBeLessThan(100)
  })

  it('does not let a hall of boardings jump the score to 100 in one tick', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.speed = 1
    game.reputation = 40
    game.reputationShown = 40
    for (let i = 0; i < 40; i++) (game as unknown as { queueReputation(n: number): void }).queueReputation(0.4)
    game.tick(1)
    expect(game.reputation).toBeLessThan(50)
    expect(game.reputationDisplay()).toBeGreaterThanOrEqual(0)
    expect(game.reputationDisplay()).toBeLessThanOrEqual(100)
  })
})
