import { describe, expect, it } from 'vitest'
import { JUMBO_RELATION_TIER } from '../wave3/fleetGrowth.ts'
import { Game } from './sim.ts'

describe('spawn respects airline size and growth', () => {
  it('schedules a commuter for Bushline and holds Crown’s A380 until the relationship grows', () => {
    const game = new Game()
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.signed.push('bushline', 'crown')

    game.addManualSlot('bushline')
    const small = game.schedule.find((slot) => slot.airline === 'bushline')
    expect(small?.airframeId).toBeTruthy()
    expect(small?.airframeId).not.toBe('a380')

    game.addManualSlot('crown')
    const fresh = game.schedule.find((slot) => slot.airline === 'crown')
    expect(fresh?.airframeId).toBe('b77w')

    while (game.wave3.relation('crown').tier < JUMBO_RELATION_TIER) {
      game.wave3.noteTurnaround('crown', 'success')
    }
    game.addManualSlot('crown')
    const grown = game.schedule.filter((slot) => slot.airline === 'crown').at(-1)
    expect(grown?.airframeId).toBe('a380')
  })
})
