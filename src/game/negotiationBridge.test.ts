import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'

describe('negotiation bridge', () => {
  it('applies a walk through the diplomacy adapter', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.presentNegotiation('northline')
    for (const service of ['landing', 'pax', 'bags', 'fuel', 'catering', 'parking'] as const) {
      game.setNegotiationFee(service, 80)
    }
    game.counterNegotiation()
    const rows = game.negotiationStanding('northline')
    expect(rows.some((row) => row.source === 'walk' && row.value === -10)).toBe(true)
    expect(rows.some((row) => row.source === 'hard_bargain')).toBe(false)
    expect(game.rivalCard()?.airlines).toContain('northline')
    expect(game.rivalCard()?.headline).toBe('+$18k/day')
  })
})
