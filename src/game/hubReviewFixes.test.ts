import { describe, expect, it } from 'vitest'
import { HALL_AMENITY_EXPENSE } from './catalog.ts'
import { SMALL_FIELD_UPKEEP_FACTOR } from './economyTuning.ts'
import { Game } from './sim.ts'
import { SAVE_KEY } from './types.ts'
import { LOUNGE_COFUND_SHARE } from '../hubprogress/config.ts'
import { SAVE_SCHEMA_VERSION, serialize, storedData } from '../features/save/index.ts'

function standing(game: Game, id: string, score: number, kept = 30) {
  if (!game.signed.includes(id)) game.signed.push(id)
  game.wave3.state.relations.rows[id] = {
    score,
    band: 'partner',
    counts: { onTime: 20, delay: 0, cancel: 0, missed: 0, fine: 0, kept },
  }
}

function line(game: Game, airline: string, id: string) {
  return game.hubChecklistFor(airline).lines.find((row) => row.id === id)
}

describe('hub ladder review fixes', () => {
  it('meets overnight parking, a cargo ramp, and a fuel hook from leases the desk can make', () => {
    const game = new Game()
    game.signed = ['brisa', 'atlas_cargo']
    game.hubTiers.brisa = 'focus'
    for (let c = 0; c < 3; c++) game.tiles[10][c] = 'stand'
    expect(line(game, 'brisa', 'overnight')?.status).toBe('missing')
    expect(game.dedicateHubFacility('brisa', 'gate')).toBe(true)
    expect(line(game, 'brisa', 'overnight')?.status).toBe('ok')

    expect(line(game, 'atlas_cargo', 'ramp')?.status).toBe('missing')
    expect(game.dedicateHubFacility('atlas_cargo', 'gate')).toBe(true)
    expect(line(game, 'atlas_cargo', 'ramp')?.status).toBe('ok')

    game.hubTiers.atlas_cargo = 'base'
    expect(line(game, 'atlas_cargo', 'fuel')?.status).toBe('missing')
    const leased = game.hubLeases.find((lease) => lease.airlineId === 'atlas_cargo')!
    game.standPits[leased.id.slice('stand:'.length)] = true
    expect(line(game, 'atlas_cargo', 'fuel')?.status).toBe('ok')
  })

  it('starts tenure for a carrier on a loaded save that never recorded it', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.signed = ['brisa']
    game.clock = 180 * 20
    game.persist()
    const snap = storedData(localStorage.getItem(SAVE_KEY)!) as Record<string, unknown>
    delete snap.hubTierSince
    localStorage.setItem(SAVE_KEY, serialize({ version: SAVE_SCHEMA_VERSION, snapshot: () => snap, restore() {} }, 0))
    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.hubTierSince.brisa).toBe(20)
    loaded.clock = 180 * 30
    expect(line(loaded, 'brisa', 'tenure')?.detail).toContain('10')
  })

  it('holds the hub letter countdown while the player is reading it', () => {
    const game = new Game()
    game.hubOffer = { airline: 'brisa', age: 0, fee: 1000, deadline: 45, tier: 'focus' }
    game.holdLetters(['hub'])
    game.tickHub(60)
    expect(game.hubOffer?.deadline).toBe(45)
    game.holdLetters([])
    game.tickHub(60)
    expect(game.hubOffer).toBeNull()
  })

  it('names the blocking line when the desk button asks for a letter too early', () => {
    const game = new Game()
    standing(game, 'brisa', 50)
    game.hubTierSince.brisa = 0
    game.clock = 180 * 2
    const before = game.news.length
    game.openRelationHub('brisa')
    expect(game.hubOffer).toBeNull()
    expect(game.news.length).toBeGreaterThan(before)
    expect(game.news[0]?.text ?? '').toMatch(/Brisa|brisa/i)
  })

  it('frees leased trucks, facility leases, and the tier when a carrier walks out', () => {
    const game = new Game()
    standing(game, 'brisa', 50)
    game.scaleFleet.pushback_tug = 1
    game.tiles[10][0] = 'stand'
    expect(game.dedicateHubVehicle('brisa', 'tug')).toBe(true)
    expect(game.dedicateHubFacility('brisa', 'gate')).toBe(true)
    game.hubTiers.brisa = 'base'
    game.abandonAirline('brisa', 'test')
    expect(game.hubVehicleLeases).toHaveLength(0)
    expect(game.hubLeases).toHaveLength(0)
    expect(game.hubTiers.brisa).toBeUndefined()
  })

  it('pays the lounge share on the same relief the lounge upkeep gets', () => {
    const game = new Game()
    game.signed = ['brisa']
    game.fits.push({ origin: { c: 4, r: 4 }, rooms: { lounge: 1 }, premade: true, wearBath: 0, wearSec: 0 } as Game['fits'][number])
    expect(game.dedicateHubFacility('brisa', 'lounge')).toBe(true)
    const full = (HALL_AMENITY_EXPENSE.lounge ?? 0) * LOUNGE_COFUND_SHARE
    expect(game.hubLoungeShare()).toBe(Math.round(full * SMALL_FIELD_UPKEEP_FACTOR))
    expect(game.hubLoungeShare()).toBeLessThan((HALL_AMENITY_EXPENSE.lounge ?? 0) * SMALL_FIELD_UPKEEP_FACTOR)
  })
})
