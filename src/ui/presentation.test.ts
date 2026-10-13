import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { readChrome } from './chromeView.ts'

describe('presentation reads', () => {
  it('publishes ambience from the tick without an audio device', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.speed = 1
    const samples: number[] = []
    const cues: string[] = []
    game.events.on('ambience', ({ dt }) => samples.push(dt))
    game.events.on('sfx', ({ name }) => cues.push(name))
    game.tick(0.2)
    expect(samples).toEqual([0.2])
    expect(cues).toEqual([])
    const chrome = readChrome(game)
    expect(chrome.showFlows).toBe(false)
    expect(chrome.hotspots.length).toBeGreaterThan(0)
  })
})