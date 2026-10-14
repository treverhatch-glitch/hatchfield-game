import { describe, expect, it } from 'vitest'
import { DIVERT_FEE_MIN } from './catalog.ts'
import { Game } from './sim.ts'

function starter(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

describe('disruption wiring', () => {
  it('stays quiet on a starter field and does not lose passengers or bags', () => {
    const game = starter()
    expect(game.fieldLevel()).toBeLessThan(3)
    for (let t = 0; t < 180 * 2; t += 0.5) game.tick(0.5)
    expect(game.disruptionFeed()).toEqual([])
    expect(game.disruptions.checkInMultiplier()).toBe(1)
    expect(game.disruptions.feeMultiplier()).toBe(1)
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
  }, 20_000)

  it('slows check-in during a software outage and restores it on the suggested fix', () => {
    const game = starter()
    game.fieldXp = 700
    const before = game.cash
    const ev = game.triggerDisruption('software-outage')
    expect(ev).not.toBeNull()
    expect(ev!.explanation).toContain('manual')
    expect(ev!.suggestedFix.length).toBeGreaterThan(10)
    expect(game.disruptions.checkInMultiplier()).toBeGreaterThan(1)
    expect(game.disruptionFeed()[0]?.title).toBe('Software outage')
    game.recoverDisruption(ev!.id)
    expect(game.disruptions.checkInMultiplier()).toBe(1)
    expect(game.disruptionFeed()).toEqual([])
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.cash).toBeLessThan(before)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('holds the runway during a state visit and pans to the apron', () => {
    const game = starter()
    game.fieldXp = 700
    game.signed = ['northline']
    const ev = game.triggerDisruption('state-visit')
    expect(ev).not.toBeNull()
    expect(game.disruptions.runwayClosed(game.clock)).toBe(true)
    game.schedule.push({
      id: 'due',
      airline: 'northline',
      flightNo: 'NL9',
      eta: game.clock - 1,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: null,
    })
    game.spawnCool = 0
    game.trySpawn()
    const slot = game.schedule.find((s) => s.id === 'due')
    expect(slot?.delayReason).toBe('Runway closed')
    expect(slot?.status).toBe('delayed')
    game.panToDisruption(ev!.id)
    expect(game.view).toBe('apron')
    game.recoverDisruption(ev!.id)
    expect(game.disruptions.runwayClosed(game.clock)).toBe(false)
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
  })

  it('lands ash diversions through the existing divert path', () => {
    const game = starter()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    game.fieldXp = 700
    const before = game.cash
    const ev = game.triggerDisruption('volcanic-ash')
    expect(ev).not.toBeNull()
    expect(ev!.effect.diversions).toBeGreaterThanOrEqual(8)
    expect(ev!.effect.diversions).toBeLessThanOrEqual(12)
    expect(ev!.effect.hosted + ev!.effect.onward).toBe(ev!.effect.diversions)
    const landed = game.flights.filter((f) => f.hostKind === 'divert')
    expect(landed).toHaveLength(ev!.effect.hosted)
    if (ev!.effect.hosted > 0) {
      expect(game.cash).toBeGreaterThanOrEqual(before + DIVERT_FEE_MIN)
    }
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
    game.recoverDisruption(ev!.id)
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.bagsLost).toBe(0)
  })

  it('rebanks one wave after a hub meltdown without dropping bags', () => {
    const game = starter()
    game.fieldXp = 420
    game.schedule.push(
      {
        id: 'a',
        airline: 'northline',
        flightNo: 'NL1',
        eta: 40,
        status: 'scheduled',
        delaySec: 0,
        delayReason: null,
        manual: true,
        flightId: null,
      },
      {
        id: 'b',
        airline: 'northline',
        flightNo: 'NL2',
        eta: 50,
        status: 'scheduled',
        delaySec: 0,
        delayReason: null,
        manual: true,
        flightId: null,
      },
    )
    const ev = game.triggerDisruption('hub-meltdown')
    expect(ev).not.toBeNull()
    expect(ev!.effect.flightIds.length).toBeGreaterThan(0)
    for (const id of ev!.effect.flightIds) {
      expect(game.schedule.find((s) => s.id === id)?.status).toBe('delayed')
    }
    game.recoverDisruption(ev!.id)
    for (const id of ev!.effect.flightIds) {
      const slot = game.schedule.find((s) => s.id === id)
      expect(slot?.status).toBe('scheduled')
      expect(slot?.delayReason).toBe('Rebanked after the storm')
    }
    expect(Number.isFinite(game.cash)).toBe(true)
    expect(game.lostPaxCount()).toBe(0)
    expect(game.bagsLost).toBe(0)
  })
})
