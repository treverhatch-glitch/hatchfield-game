import { describe, expect, it } from 'vitest'
import { HALL_AMENITY_EXPENSE } from './catalog.ts'
import { readHubLeaseWarnings, readHubLeases } from './hubProgress.ts'
import { Game } from './sim.ts'
import { LOUNGE_COFUND_SHARE, LEASE_SCORE_CAP } from '../hubprogress/config.ts'
import { RELATION_PART_LABELS } from '../wave3/relations.ts'

function lounge(game: Game, count = 1) {
  game.fits.push({
    origin: { c: 4, r: 4 },
    rooms: { lounge: count },
    premade: true,
    wearBath: 0,
    wearSec: 0,
  } as Game['fits'][number])
}

describe('lounge, gate, and hangar leases', () => {
  it('dedicates a built lounge and refuses a second claim on the same room', () => {
    const game = new Game()
    game.signed = ['gulf_pearl', 'brisa']
    expect(game.dedicateHubFacility('gulf_pearl', 'lounge')).toBe(false)
    lounge(game)
    expect(game.hubFacilityChoices('gulf_pearl').find((row) => row.kind === 'lounge')?.blocked).toBeNull()
    expect(game.dedicateHubFacility('gulf_pearl', 'lounge')).toBe(true)
    expect(game.dedicateHubFacility('brisa', 'lounge')).toBe(false)
    expect(game.hubChecklistFor('gulf_pearl').lines.find((line) => line.id === 'lounge')).toBeUndefined()
    game.hubTiers.gulf_pearl = 'base'
    expect(game.hubChecklistFor('gulf_pearl').lines.find((line) => line.id === 'lounge')?.detail).toBe('1 / 1')
    expect(game.hubChecklistFor('brisa').lines.find((line) => line.id === 'desk')?.detail).toBe('0 / 1')
  })

  it('pays dedicated credit on the daily review without a second fee multiplier', () => {
    const game = new Game()
    game.signed = ['brisa']
    lounge(game, 1)
    for (let c = 0; c < 21; c++) game.tiles[10][c] = 'stand'
    expect(game.dedicateHubFacility('brisa', 'lounge')).toBe(true)
    for (let i = 0; i < 21; i++) expect(game.dedicateHubFacility('brisa', 'gate')).toBe(true)
    const upkeep = game.landsideUpkeep()
    const twin = new Game()
    twin.signed = ['brisa']
    lounge(twin, 1)
    for (let c = 0; c < 21; c++) twin.tiles[10][c] = 'stand'
    twin.clock = 180
    game.clock = 180
    game.tickPayroll(0)
    twin.tickPayroll(0)
    expect(game.landsideUpkeep()).toBe(upkeep)
    expect(twin.landsideUpkeep()).toBe(upkeep)
    expect(game.bank.ledger().byCategory.host_fees ?? 0).toBe(game.hubLoungeShare())
    expect(twin.bank.ledger().byCategory.host_fees ?? 0).toBe(0)
    const parts = game.wave3.relation('brisa').parts
    expect(parts.dedicated).toBe(LEASE_SCORE_CAP)
    expect(RELATION_PART_LABELS.dedicated).toBe('Dedicated leases')
    expect(game.wave3.feeLine('brisa').match(/×/g)).toHaveLength(1)
    expect(game.hubLoungeShare()).toBe(Math.round((HALL_AMENITY_EXPENSE.lounge ?? 0) * LOUNGE_COFUND_SHARE))
  })

  it('warns for 30 days when a gating lounge is released and leaves the flight card alone', () => {
    const game = new Game()
    game.signed = ['gulf_pearl']
    game.hubTiers.gulf_pearl = 'hub'
    lounge(game)
    game.dedicateHubFacility('gulf_pearl', 'lounge')
    const leaseId = game.hubLeases[0]?.id ?? ''
    game.selectedFlight = 'flt-keep'
    const people = game.people
    game.weather = 'storm'
    expect(game.releaseHubLease('gulf_pearl', leaseId)).toBe(true)
    expect(game.hubTiers.gulf_pearl).toBe('hub')
    expect(game.hubLeaseWarningText('gulf_pearl')).toBe('Hub falls in 30 days')
    expect(game.selectedFlight).toBe('flt-keep')
    expect(game.people).toBe(people)
    expect(game.hubLeases).toHaveLength(0)

    game.clock = 180 * 30
    game.tickPayroll(0)
    expect(game.hubTiers.gulf_pearl).toBe('hub')

    game.clock = 180 * 31
    game.tickPayroll(0)
    expect(game.hubTiers.gulf_pearl).toBe('base')
    expect(game.hubLeaseWarningText('gulf_pearl')).toBeNull()
    expect(game.selectedFlight).toBe('flt-keep')
    expect(game.people).toBe(people)
  })

  it('clears the warning when the lounge is dedicated again', () => {
    const game = new Game()
    game.signed = ['gulf_pearl']
    game.hubTiers.gulf_pearl = 'hub'
    lounge(game)
    game.dedicateHubFacility('gulf_pearl', 'lounge')
    game.releaseHubLease('gulf_pearl', game.hubLeases[0]?.id ?? 'missing')
    expect(game.hubLeaseWarningText('gulf_pearl')).toContain('30 days')
    expect(game.dedicateHubFacility('gulf_pearl', 'lounge')).toBe(true)
    expect(game.hubLeaseWarningText('gulf_pearl')).toBeNull()
    expect(game.hubTiers.gulf_pearl).toBe('hub')
  })

  it('counts a hangar bay for cargo and keeps a lounge off that checklist', () => {
    const game = new Game()
    game.signed = ['atlas_cargo']
    game.hubTiers.atlas_cargo = 'base'
    game.tiles[8][8] = 'hangar'
    expect(game.dedicateHubFacility('atlas_cargo', 'hangar')).toBe(true)
    const lines = game.hubChecklistFor('atlas_cargo').lines
    expect(lines.some((line) => line.id === 'lounge')).toBe(false)
    expect(lines.find((line) => line.id === 'hangar')?.detail).toBe('1 / 1')
    expect(readHubLeases([{ id: 'hangar:8,8', kind: 'hangar', airlineId: 'atlas_cargo' }, { id: 'nope' }])).toEqual([
      { id: 'hangar:8,8', kind: 'hangar', airlineId: 'atlas_cargo' },
    ])
    expect(readHubLeaseWarnings({ atlas_cargo: { tier: 'hub', untilDay: 12 }, other: { tier: 'station', untilDay: 1 } })).toEqual({
      atlas_cargo: { tier: 'hub', untilDay: 12 },
    })
  })
})