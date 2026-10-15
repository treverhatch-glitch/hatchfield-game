import { describe, expect, it } from 'vitest'
import { readPhoneCards } from '../phone/readGame.ts'
import { Game } from './sim.ts'

function standing(game: Game, id: string, score: number, kept = 30) {
  if (!game.signed.includes(id)) game.signed.push(id)
  game.wave3.state.relations.rows[id] = {
    score,
    band: 'partner',
    counts: { onTime: 20, delay: 0, cancel: 0, missed: 0, fine: 0, kept },
  }
}

describe('hub tier offers', () => {
  it('sends Focus from the relationship gate and keeps the fee string singular', () => {
    const game = new Game()
    standing(game, 'brisa', 25, 14)
    game.hubTierSince.brisa = -7
    game.openRelationHub('brisa')
    expect(game.hubOffer).toMatchObject({ airline: 'brisa', tier: 'focus', fee: 4_000 })
    const card = readPhoneCards(game).find((row) => row.kind === 'hub')
    expect(card?.tab).toBe('messages')
    expect(card?.title).toContain('Focus city offer')
    expect(card?.actions.find((action) => action.label === 'Accept')?.disabled).toBe(true)
    expect(card?.lines?.some((line) => line.label.includes('Waiting on the desk allocator'))).toBe(true)
    expect(game.wave3.feeLine('brisa').match(/×/g)).toHaveLength(1)
    expect(card?.body.includes('feeMult')).toBe(false)
  })

  it('refuses a flag Hub while the desk line is waiting', () => {
    const game = new Game()
    game.sandbox = true
    standing(game, 'gulf_pearl', 75)
    game.hubTiers.gulf_pearl = 'base'
    game.hubDedicated.gulf_pearl = { lounges: 1 }
    game.hubOffer = { airline: 'gulf_pearl', age: 0, fee: 14_000, deadline: 45, tier: 'hub' }
    const card = readPhoneCards(game).find((row) => row.kind === 'hub')
    expect(card?.title).toContain('Hub offer')
    expect(card?.actions.find((action) => action.label === 'Accept')?.disabled).toBe(true)
    expect(card?.lines?.some((line) => line.label.includes('Waiting on the desk allocator'))).toBe(true)
    game.acceptHub()
    expect(game.hubTiers.gulf_pearl).toBe('base')
  })

  it('lets one cargo carrier take Primary and names the holder on the second accept', () => {
    const game = new Game()
    game.sandbox = true
    for (const id of ['atlas_cargo', 'polar_freight']) {
      standing(game, id, 95)
      game.hubTiers[id] = 'hub'
      game.hubTierSince[id] = -40
      game.hubDedicated[id] = { hangars: 1, fuel: 1, ramp: 1 }
      game.scaleFleet.fuel_truck = (game.scaleFleet.fuel_truck ?? 0) + 1
      expect(game.dedicateHubVehicle(id, 'fuelTruck')).toBe(true)
    }
    game.hubRivalRoll = 1
    const holder = game.airline('atlas_cargo').name
    game.hubOffer = { airline: 'atlas_cargo', age: 0, fee: 22_000, deadline: 45, tier: 'primary' }
    const first = readPhoneCards(game).find((row) => row.kind === 'hub')
    expect(first?.lines?.some((line) => line.label.toLowerCase().includes('lounge'))).toBe(false)
    expect(first?.actions.find((action) => action.label === 'Accept')?.disabled).toBe(false)
    game.acceptHub()
    expect(game.hubTiers.atlas_cargo).toBe('primary')

    game.wave3.state.relations.rows.polar_freight = {
      score: 95,
      band: 'partner',
      counts: { onTime: 20, delay: 0, cancel: 0, missed: 0, fine: 0, kept: 30 },
    }
    game.hubOffer = { airline: 'polar_freight', age: 0, fee: 22_000, deadline: 45, tier: 'primary' }
    const second = readPhoneCards(game).find((row) => row.kind === 'hub')
    expect(second?.actions.find((action) => action.label === 'Accept')?.disabled).toBe(true)
    expect(second?.lines?.some((line) => line.label.includes(`${holder} is already the Hub (one at a time).`))).toBe(true)
    game.acceptHub()
    expect(game.hubTiers.polar_freight).toBe('hub')
    expect(game.news[0]?.text).toContain(`${holder} is already the Hub (one at a time).`)
  })

  it('declines without clearing a dedicated count or the stored tier', () => {
    const game = new Game()
    standing(game, 'brisa', 50)
    game.hubTiers.brisa = 'focus'
    game.hubDedicated.brisa = { overnight: 1 }
    game.hubOffer = { airline: 'brisa', age: 0, fee: 8_000, deadline: 45, tier: 'base' }
    game.declineHub()
    expect(game.hubOffer).toBeNull()
    expect(game.hubTiers.brisa).toBe('focus')
    expect(game.hubDedicated.brisa.overnight).toBe(1)
  })
})
