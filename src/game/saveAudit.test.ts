import { beforeEach, describe, expect, it } from 'vitest'
import { AUTOSAVE_ID, listSlots } from '../features/save/library.ts'
import { Game } from './sim.ts'

/**
 * Durable field state. Live flights, trucks, and hall guests are rebuilt
 * from the timetable on the next ticks; they are not in the snapshot.
 */
function tileBag(game: Game): Record<string, number> {
  const bag: Record<string, number> = {}
  for (const row of game.tiles) {
    for (const tile of row) bag[tile] = (bag[tile] ?? 0) + 1
  }
  return bag
}

describe('save audit for the playtest field', () => {
  beforeEach(() => localStorage.clear())

  it('restores money, the timetable, buildings, airlines, hub, research, vehicles, fuel, and check-in', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('standard')
    expect(game.buyLand('city', 'pax')).toBe(true)
    game.buildStarterKit()
    game.offer = { airline: 'northline', age: 0, deadline: 36 }
    game.acceptOffer()
    expect(game.signed).toContain('northline')

    game.cash = 123_456
    game.clock = 180 * 4
    game.flightsDone = 3
    game.contractId = 'kiln_regional'
    game.fuelBrand = 'kiln'
    game.tankLitres = 51_000
    game.fuelLoads = 3
    game.spotOffer = { flightNo: 'NL220', flightId: 'spot-1', expiresAt: 900 }
    game.spotInbound = { litres: 12_000, perLitre: 0.9, minutesLeft: 14, waitNoted: false }
    game.paxDesks = 6
    game.dedicatedDesks = [{ deskId: 'desk-1', airlineId: 'northline' }]
    game.scaleFleet = { pushback_tug: 2, fuel_truck: 1 }
    game.researchPoints = 17
    game.hubTiers = { northline: 'base' }
    game.hubDedicated = { northline: { pier: 1, fuel: 1 } }
    game.hubLeases = [{ id: 'stand:8,8', kind: 'gate', airlineId: 'northline' }]
    game.schedule = [
      {
        id: 'slot-1',
        airline: 'northline',
        flightNo: 'NL101',
        eta: 400,
        status: 'scheduled',
        delaySec: 0,
        delayReason: null,
        manual: true,
        flightId: 'live-1',
      },
    ]
    const fit = game.fits[0]
    expect(fit).toBeTruthy()
    fit!.rooms = { ...fit!.rooms, checkin: 4 }
    const tiles = tileBag(game)
    const tree = game.researchTree.save()
    expect((tiles.terminal ?? 0) + (tiles.runway ?? 0)).toBeGreaterThan(0)

    game.persist()
    const slots = listSlots()
    expect(slots[0]).toMatchObject({ id: AUTOSAVE_ID, cash: 123_456, gameDay: 4, kind: 'autosave' })

    const loaded = new Game()
    expect(loaded.load()).toBe(true)
    expect(loaded.cash).toBe(123_456)
    expect(loaded.clock).toBe(180 * 4)
    expect(loaded.gameDay()).toBe(4)
    expect(loaded.flightsDone).toBe(3)
    expect(loaded.flights).toEqual([])
    expect(loaded.schedule).toHaveLength(1)
    expect(loaded.schedule[0]).toMatchObject({ airline: 'northline', flightNo: 'NL101', flightId: null })
    expect(tileBag(loaded)).toEqual(tiles)
    expect(loaded.fits).toHaveLength(game.fits.length)
    expect(loaded.fits[0]?.rooms.checkin).toBe(4)
    expect(loaded.signed).toContain('northline')
    expect(loaded.hubTiers.northline).toBe('base')
    expect(loaded.hubDedicated.northline).toEqual({ pier: 1, fuel: 1 })
    expect(loaded.hubLeases).toEqual([{ id: 'stand:8,8', kind: 'gate', airlineId: 'northline' }])
    expect(loaded.researchPoints).toBeCloseTo(17)
    expect(loaded.researchTree.save()).toEqual(tree)
    expect(loaded.scaleFleet.pushback_tug).toBe(2)
    expect(loaded.scaleFleet.fuel_truck).toBe(1)
    expect(loaded.contractId).toBe('kiln_regional')
    expect(loaded.fuelBrand).toBe('kiln')
    expect(loaded.tankLitres).toBe(51_000)
    expect(loaded.fuelLoads).toBe(3)
    expect(loaded.spotOffer).toEqual({ flightNo: 'NL220', flightId: 'spot-1', expiresAt: 900 })
    expect(loaded.spotInbound).toEqual({ litres: 12_000, perLitre: 0.9, minutesLeft: 14, waitNoted: false })
    expect(loaded.paxDesks).toBe(6)
    expect(loaded.dedicatedDesks).toEqual([{ deskId: 'desk-1', airlineId: 'northline' }])
  })
})
