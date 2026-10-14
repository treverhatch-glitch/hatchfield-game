import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { OPS_TRICKLE_PER_SEC } from '../wave3/config.ts'

function opened(): Game {
  const game = new Game()
  game.autosave = false
  game.beginNew('easy')
  game.buyLand('city')
  return game
}

describe('wave 3 on the field', () => {
  it('earns research points on day 1 before any staff are hired', () => {
    const game = opened()
    expect(game.researchers).toBe(0)
    expect(game.labGear()).toEqual({ desks: 0, boards: 0, machines: 0 })
    expect(game.fits.length).toBe(0)
    const before = game.wave3.points() + game.wave3.state.research.carry
    game.tick(120)
    const after = game.wave3.points() + game.wave3.state.research.carry
    expect(after - before).toBeCloseTo(OPS_TRICKLE_PER_SEC * 120, 5)
    expect(game.wave3.points()).toBeGreaterThan(0)
    expect(game.researchers).toBe(0)
  })

  it('never offers or flies Bushline on a 737 or an A321', () => {
    const game = opened()
    game.buildStarterKit()
    for (const score of [0, 25, 50, 75, 100]) {
      game.wave3.state = {
        ...game.wave3.state,
        relations: {
          rows: {
            ...game.wave3.state.relations.rows,
            bushline: { score, band: score >= 90 ? 'partner' : score >= 60 ? 'warm' : 'neutral' },
          },
        },
      }
      expect(game.wave3.fleetOf('bushline')).toEqual(['bn2', 'dhc6'])
      expect(game.wave3.allowsMetal('bushline', 'b738')).toBe(false)
      expect(game.wave3.allowsMetal('bushline', 'a321')).toBe(false)
      expect(game.wave3.relation('bushline').airframes).toEqual(['bn2', 'dhc6'])
      const metal = game.previewMetal('bushline')
      if (metal) expect(['bn2', 'dhc6']).toContain(metal)
    }
    expect(game.wave3.allowsMetal('harbor', 'b738')).toBe(true)
  })
})
