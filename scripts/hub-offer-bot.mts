/**
 * 90 careful days. Confirms the relationship gate sends at least one hub letter.
 * Not part of `npm test`. Run with vitest.hub-bot.config.ts.
 */
import { describe, expect, it } from 'vitest'
import { Game } from '../src/game/sim.ts'
import { mulberry32 } from '../src/playtest/personas.ts'
import { PERSONAS, runHeadless } from '../src/playtest/run.ts'

describe('careful hub offer', () => {
  it('earns at least one hub letter in 90 days', () => {
    const spec = PERSONAS.find((persona) => persona.id === 'careful')
    if (!spec) throw new Error('careful persona missing')
    // Same served check-in the 60-day relations bot uses, so turns can be on time.
    const random = Math.random
    Math.random = mulberry32(0x5eed)
    const origKit = Game.prototype.buildStarterKit
    Game.prototype.buildStarterKit = function (this: Game) {
      const built = origKit.call(this)
      this.paxDesks = 8
      this.paxKiosks = 2
      return built
    }
    let report: ReturnType<typeof runHeadless>[number]
    try {
      ;[report] = runHeadless({ personas: [{ ...spec, days: 90 }] })
    } finally {
      Game.prototype.buildStarterKit = origKit
      Math.random = random
    }
    const line = report?.notes.find((note) => note.startsWith('hub-offers:')) ?? 'hub-offers:0'
    const ladder = report?.notes.find((note) => note.startsWith('hub-ladder:')) ?? ''
    console.log(line)
    console.log(ladder)
    const earned = Number(line.slice('hub-offers:'.length))
    expect(earned).toBeGreaterThanOrEqual(1)
  })
})
