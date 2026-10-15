import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { mulberry32 } from '../playtest/personas.ts'
import { TIP_PERSONAS, runHeadless } from '../playtest/run.ts'

describe('game body list', () => {
  it('carries the landside road vehicles, and none of them overlap', { timeout: 120_000 }, () => {
    const spec = TIP_PERSONAS.find((persona) => persona.id === 'careful')
    expect(spec).toBeTruthy()
    let ticks = 0
    let most = 0
    let owners: string[] = []
    const worst = { depth: 0, pair: '' }
    const orig = Game.prototype.tick
    Game.prototype.tick = function (this: Game, dt: number) {
      orig.call(this, dt)
      if (ticks++ % 10) return
      owners = this.bodies.owners()
      const bodies = this.bodies.all()
      expect(bodies.length).toBe(this.landsideView().vehicles.length)
      most = Math.max(most, bodies.length)
      const deepest = this.bodies.overlaps(0.01)[0]
      if (deepest && deepest.depth > worst.depth) Object.assign(worst, { depth: deepest.depth, pair: `${deepest.a.id}/${deepest.b.id}` })
    }
    const random = Math.random
    Math.random = mulberry32(0x5eed)
    try {
      runHeadless({ personas: [{ ...spec!, days: 4 }] })
    } finally {
      Game.prototype.tick = orig
      Math.random = random
    }
    expect(owners).toContain('landside')
    expect(most).toBeGreaterThan(3)
    expect(worst.depth, worst.pair).toBe(0)
  })
})
