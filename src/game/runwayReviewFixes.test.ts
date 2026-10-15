import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import type { ScheduleSlot } from './types.ts'

function field(): Game {
  const game = new Game()
  game.autosave = false
  game.sandbox = false
  game.beginNew('standard')
  game.buyLand('city')
  game.buildStarterKit()
  game.scheduleAuto = false
  game.clock = 1000
  return game
}

function slot(id: string, airline: string, airframeId: string, eta: number): ScheduleSlot {
  return { id, airline, airframeId, eta, status: 'scheduled' } as unknown as ScheduleSlot
}

describe('runway review fixes', () => {
  it('leaves helipad turns out of the strip movement count', () => {
    const game = field()
    game.schedule = [slot('j1', 'northline', 'crj700', 1100)]
    const jets = game.runwayLoad().scheduled
    expect(jets).toBe(2)
    game.schedule = [
      slot('j1', 'northline', 'crj700', 1100),
      ...Array.from({ length: 10 }, (_, i) => slot(`h${i}`, 'harbor_heli', 'aw139', 1100 + i * 5)),
    ]
    expect(game.runwayLoad().scheduled).toBe(jets)
    expect(game.runwayLoad().overbooked).toBe(false)
  })
})
