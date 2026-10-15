import { describe, expect, it } from 'vitest'
import { readPhoneCards } from '../phone/readGame.ts'
import { dispatchPhoneAction, phoneHost } from '../phone/commands.ts'
import { Game } from './sim.ts'

function advanceDays(game: Game, days: number) {
  game.clock += days * 180
  game.tickPayroll(0)
}

describe('hub warmth texts and maintenance ferries', () => {
  it('sends a desk nudge, lets Later return, and lets Decline silence that step', () => {
    const game = new Game()
    game.signed = ['brisa']
    advanceDays(game, 1)
    const nudge = game.hubNudges.find((row) => row.airlineId === 'brisa')
    expect(nudge?.step).toBe('desk')
    expect(nudge?.text).toContain('Focus city')
    const card = readPhoneCards(game).find((row) => row.kind === 'hub-nudge')
    expect(card?.actions.map((action) => action.label)).toEqual(['Airlines', 'Later', 'Decline'])

    game.laterHubNudge('brisa')
    expect(game.hubNudges).toEqual([])
    advanceDays(game, 4)
    expect(game.hubNudges.some((row) => row.airlineId === 'brisa' && row.step === 'desk')).toBe(true)

    game.declineHubNudge('brisa')
    advanceDays(game, 4)
    expect(game.hubNudges.some((row) => row.step === 'desk')).toBe(false)
    expect(game.hubNudgeSilenced).toEqual([{ airlineId: 'brisa', step: 'desk' }])
  })

  it('caps the field at three new texts in one day', () => {
    const game = new Game()
    game.signed = ['brisa', 'gulf_pearl', 'zephyr_go', 'tango_air']
    advanceDays(game, 1)
    expect(game.hubNudges).toHaveLength(3)
  })

  it('paints a dedicated tug with the airline primary and does not add upkeep', () => {
    const game = new Game()
    game.signed = ['brisa']
    game.scaleFleet.pushback_tug = 1
    const cash = game.cash
    expect(game.dedicateHubVehicle('brisa', 'tug')).toBe(true)
    expect(game.cash).toBe(cash)
    expect(game.hubVehicleColor('pushback_tug-1')).toBe(game.hubVehicleLeases[0]?.primary)
    expect(game.hubVehicleColor('pushback_tug-2')).toBeNull()
  })

  it('ferries a hub aircraft into a dedicated MRO bay', () => {
    const game = new Game()
    game.signed = ['gulf_pearl']
    game.hubTiers.gulf_pearl = 'hub'
    game.tiles[2][2] = 'mro'
    expect(game.dedicateHubFacility('gulf_pearl', 'hangar')).toBe(true)
    advanceDays(game, 1)
    const job = game.tier3.activeJobs().find((row) => row.aircraftId.startsWith('ferry:gulf_pearl'))
    expect(job?.buildingId).toBe('2,2')
    expect(job?.phase).toBe('taxi_in')
    expect(game.news.some((row) => row.text.includes('heavy check'))).toBe(true)
    const before = game.tier3.activeJobs().filter((row) => row.aircraftId.startsWith('ferry:')).length
    advanceDays(game, 1)
    expect(game.tier3.activeJobs().filter((row) => row.aircraftId.startsWith('ferry:'))).toHaveLength(before)
  })

  it('opens Airlines from the phone nudge', () => {
    const game = new Game()
    game.signed = ['brisa']
    advanceDays(game, 1)
    dispatchPhoneAction(phoneHost(game), { type: 'open-airlines', airlineId: 'brisa' })
    expect(game.hubDeepLinkTick).toBe(1)
    expect(game.hubDeepLinkAirline).toBe('brisa')
  })
})
