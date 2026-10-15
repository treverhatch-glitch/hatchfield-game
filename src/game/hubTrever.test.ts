import { describe, expect, it } from 'vitest'
import { readPhoneCards } from '../phone/readGame.ts'
import { DEFAULT_VEHICLE_SPECS } from '../logistics/defaults.ts'
import { LEASE_SCORE_CAP } from '../hubprogress/config.ts'
import { Game } from './sim.ts'
import type { ResearchId } from './types.ts'

function standing(game: Game, id: string, score: number, kept = 30) {
  if (!game.signed.includes(id)) game.signed.push(id)
  game.wave3.state.relations.rows[id] = {
    score,
    band: 'partner',
    counts: { onTime: 20, delay: 0, cancel: 0, missed: 0, fine: 0, kept },
  }
}

describe('dedicated vehicles, tenure, and rival hubs', () => {
  it('takes one tug out of the pool, raises the dedicated part, and leaves the desk waiting', () => {
    const game = new Game()
    standing(game, 'brisa', 50, 20)
    standing(game, 'gulf_pearl', 50, 20)
    game.scaleFleet.pushback_tug = 1
    expect(DEFAULT_VEHICLE_SPECS.pushback_tug.upkeepPerDay).toBe(90)
    const cash = game.cash
    expect(game.dedicateHubVehicle('brisa', 'tug')).toBe(true)
    expect(game.dedicateHubVehicle('gulf_pearl', 'tug')).toBe(false)
    expect(game.cash).toBe(cash)
    expect(game.hubVehicleLeases[0]).toMatchObject({ airlineId: 'brisa', role: 'tug', type: 'pushback_tug' })
    game.hubTiers.brisa = 'focus'
    game.hubTierSince.brisa = -20
    expect(game.hubChecklistFor('brisa').lines.find((line) => line.id === 'veh-tug')?.status).toBe('ok')
    expect(game.hubChecklistFor('brisa').lines.find((line) => line.id === 'desk')?.detail).toBe('Waiting on the desk allocator')
    game.clock = 180
    game.tickPayroll(0)
    expect(game.wave3.relation('brisa').parts.dedicated).toBe(0.08)
    expect(game.wave3.relation('brisa').parts.dedicated).toBeLessThanOrEqual(LEASE_SCORE_CAP)
    expect(game.wave3.feeLine('brisa').match(/×/g)).toHaveLength(1)
  })

  it('does not send the next letter until the current tier has been held and the on-time sample is in', () => {
    const game = new Game()
    standing(game, 'brisa', 25, 14)
    game.openRelationHub('brisa')
    expect(game.hubOffer).toBeNull()
    game.hubTierSince.brisa = -7
    game.openRelationHub('brisa')
    expect(game.hubOffer).toMatchObject({ airline: 'brisa', tier: 'focus' })
    expect(game.hubTiers.brisa).toBeUndefined()
  })

  it('warns who the hub will anger, then drops a rival, cuts a route, or sends them to Bellwater', () => {
    const game = new Game()
    game.sandbox = true
    for (const id of ['gulf_pearl', 'zephyr_go', 'tango_air', 'seoul_star']) standing(game, id, 80)
    game.hubTiers.gulf_pearl = 'base'
    const preview = game.hubAngerPreview('gulf_pearl')
    expect(preview.anger).toContain('Accepting will anger')
    expect(preview.anger).toContain(game.airline('zephyr_go').name)
    expect(preview.anger).toContain(game.airline('tango_air').name)
    expect(preview.spared).toContain(game.airline('seoul_star').name)
    game.hubOffer = { airline: 'gulf_pearl', age: 0, fee: 14_000, deadline: 45, tier: 'hub' }
    const card = readPhoneCards(game).find((row) => row.kind === 'hub')
    expect(card?.body).toContain('Accepting will anger')
    expect(card?.body).toContain(game.airline('seoul_star').name)
    expect(card?.actions.find((action) => action.label === 'Accept')?.disabled).toBe(true)

    const cargo = new Game()
    cargo.sandbox = true
    cargo.researchUnlocked.push('transfer_centre' as ResearchId)
    standing(cargo, 'atlas_cargo', 75, 30)
    standing(cargo, 'polar_freight', 40, 30)
    cargo.hubTiers.atlas_cargo = 'base'
    cargo.hubTierSince.atlas_cargo = -30
    cargo.hubDedicated.atlas_cargo = { hangars: 1, fuel: 1, ramp: 1 }
    cargo.scaleFleet.fuel_truck = 1
    expect(cargo.dedicateHubVehicle('atlas_cargo', 'fuelTruck')).toBe(true)
    cargo.schedule.push({
      id: 'slot-polar',
      airline: 'polar_freight',
      flightNo: 'PL1',
      eta: 400,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: false,
      flightId: null,
    })
    cargo.hubRivalRoll = 0.15
    cargo.openRelationHub('atlas_cargo')
    expect(cargo.hubOffer?.tier).toBe('hub')
    const before = cargo.wave3.relation('polar_freight').score
    cargo.acceptHub()
    expect(cargo.hubTiers.atlas_cargo).toBe('hub')
    expect(cargo.wave3.relation('polar_freight').score).toBe(before - 8)
    expect(cargo.schedule.find((slot) => slot.id === 'slot-polar')?.status).toBe('cancelled')
    expect(cargo.seedScheduleForAirline('polar_freight', 1)).toBeUndefined()
    expect(cargo.schedule.filter((slot) => slot.airline === 'polar_freight' && slot.status === 'scheduled')).toHaveLength(0)

    const gone = new Game()
    gone.sandbox = true
    gone.researchUnlocked.push('transfer_centre' as ResearchId)
    standing(gone, 'atlas_cargo', 75, 30)
    standing(gone, 'polar_freight', 40, 30)
    gone.airlineHeat.polar_freight = 20
    gone.hubTiers.atlas_cargo = 'base'
    gone.hubTierSince.atlas_cargo = -30
    gone.hubDedicated.atlas_cargo = { hangars: 1, fuel: 1, ramp: 1 }
    gone.scaleFleet.fuel_truck = 1
    expect(gone.dedicateHubVehicle('atlas_cargo', 'fuelTruck')).toBe(true)
    gone.hubRivalRoll = 0.05
    gone.openRelationHub('atlas_cargo')
    gone.acceptHub()
    expect(gone.signed).not.toContain('polar_freight')
    expect(gone.news.some((row) => row.text.includes('Bellwater'))).toBe(true)
    expect(readPhoneCards(gone).some((row) => row.kind === 'rival' && row.body.includes('Bellwater'))).toBe(true)

    const refused = new Game()
    refused.sandbox = true
    standing(refused, 'harbor_heli', 50, 20)
    standing(refused, 'island_heli', 50, 20)
    refused.hubTierSince.harbor_heli = -20
    refused.hubDedicated.harbor_heli = { pads: 1, fuel: 1 }
    refused.hubRivalRoll = 0.05
    refused.openRelationHub('harbor_heli')
    expect(refused.hubOffer?.tier).toBe('base')
    refused.acceptHub()
    expect(refused.hubTiers.harbor_heli).toBe('base')
    refused.signed = refused.signed.filter((id) => id !== 'island_heli')
    refused.offer = { airline: 'island_heli', age: 0, deadline: 30 }
    refused.acceptOffer()
    expect(refused.signed).not.toContain('island_heli')
    expect(refused.news.some((row) => row.text.includes('refused'))).toBe(true)
  })
})
