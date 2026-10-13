import { describe, expect, it } from 'vitest'
import { createDiplomacyBridge } from './diplomacyBridge.ts'
import type { DiplomacyAdapterHost } from '../diplomacy/adapter.ts'
import { Game } from './sim.ts'

function host(news: string[] = []): DiplomacyAdapterHost {
  return {
    addMoney() {},
    getCash: () => 1_000_000,
    getContext: () => ({
      fieldLevel: 1,
      metrics: {
        onTimePct: 92,
        feeIndex: 1,
        cafes: 1,
        loungeSeats: 24,
        standCount: 4,
        standUtilization: 0.4,
        familyAmenities: 1,
        cargoFacilities: 0,
      },
    }),
    notify(message) {
      news.push(message)
    },
  }
}

describe('diplomacy bridge', () => {
  it('grades a signed carrier and resumes from the save', () => {
    const news: string[] = []
    const bridge = createDiplomacyBridge(host(news), 1)
    expect(bridge.gradeFlight({
      flightId: 'early',
      airlineId: 'northline',
      delayMinutes: 0,
      bagFault: false,
      paxMood: 0.8,
      standFit: true,
    }).grade).toBeNull()
    bridge.mirrorSigned('northline')
    expect(bridge.relation('northline')?.status).toBe('signed')
    const graded = bridge.gradeFlight({
      flightId: 'nl1',
      airlineId: 'northline',
      delayMinutes: 0,
      bagFault: false,
      paxMood: 0.8,
      standFit: true,
    })
    expect(graded.grade).toBe('A')
    expect(bridge.gradeFlight({
      flightId: 'nl1',
      airlineId: 'northline',
      delayMinutes: 0,
      bagFault: false,
      paxMood: 0.8,
      standFit: true,
    }).grade).toBeNull()
    expect(bridge.feeFactor('northline')).toBe(1)
    expect(bridge.capacityFactor('northline')).toBe(1)
    bridge.tick(1440)
    expect(bridge.day()).toBeCloseTo(1)
    expect(news.some((line) => /Tier 1/.test(line))).toBe(true)
    const saved = bridge.save()
    const again = createDiplomacyBridge(host(), 99)
    again.load(saved)
    expect(again.relation('northline')?.status).toBe('signed')
    expect(again.day()).toBeCloseTo(1)
  })

  it('opens tier 1 on the live field after one sim day', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.scheduleAuto = false
    game.schedule = []
    game.spawnCool = 1e9
    game.offerCool = 1e9
    game.heloCool = 1e9
    game.milCool = 1e9
    game.ambuCool = 1e9
    game.threatCool = 1e9
    game.emergencyCool = 1e9
    game.signed = ['northline']
    game.speed = 1
    game.tick(180)
    expect(game.diplomacyDay()).toBeGreaterThanOrEqual(1)
    expect(game.diplomacyRoster().some((row) => row.id === 'northline')).toBe(true)
  })
})
