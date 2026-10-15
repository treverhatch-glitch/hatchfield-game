import { describe, expect, it } from 'vitest'
import { ALLOCATOR_WAIT } from '../hubprogress/config.ts'
import { gateLeaseId, hangarLeaseId, loungeLeaseId } from '../hubprogress/leases.ts'
import { Game } from './sim.ts'

describe('assign screen', () => {
  it('names a stand, a maintenance bay, a lounge, and a tug without clearing the desk line', () => {
    const game = new Game()
    game.signed = ['brisa', 'gulf_pearl']
    game.tiles[8][3] = 'stand'
    game.tiles[2][2] = 'mro'
    game.fits.push({
      origin: { c: 4, r: 4 },
      rooms: { lounge: 1 },
      premade: true,
      wearBath: 0,
      wearSec: 0,
    } as Game['fits'][number])
    game.scaleFleet.pushback_tug = 1

    expect(game.leaseNamedFacility('brisa', 'gate', gateLeaseId(3, 8))).toBe(true)
    expect(game.leaseNamedFacility('gulf_pearl', 'gate', gateLeaseId(3, 8))).toBe(false)
    expect(game.leaseNamedFacility('gulf_pearl', 'hangar', hangarLeaseId(2, 2))).toBe(true)
    expect(game.leaseNamedFacility('brisa', 'lounge', loungeLeaseId(4, 4, 0))).toBe(true)
    expect(game.leaseNamedVehicle('brisa', 'pushback_tug', 1)).toBe(true)
    const desk = game.hubChecklistFor('brisa').lines.find((line) => line.id === 'desk')
    expect(desk?.detail).toBe('0 / 1')
    expect(desk?.detail).not.toBe(ALLOCATOR_WAIT)
    expect(game.facilityAssignRows('hangar').some((row) => row.label.startsWith('Maintenance bay'))).toBe(true)
    expect(game.vehicleAssignRows().some((row) => row.holderId === 'brisa' && row.label === 'tug 1')).toBe(true)
  })

  it('names a security lane and still waits on the allocator', () => {
    const game = new Game()
    game.sandbox = true
    game.beginNew('easy')
    game.startFocus = 'pax'
    game.buyLand('city')
    game.buildStarterKit()
    game.tickHallNav(0.05)
    game.signed = ['brisa']
    const lane = game.securityLaneRows()[0]
    expect(lane).toBeTruthy()
    expect(game.leaseLane('brisa', lane!.id, true)).toBe(true)
    expect(game.dedicatedLanes).toEqual([{ laneId: lane!.id, airlineId: 'brisa' }])
    const line = game.hubChecklistFor('brisa').lines.find((row) => row.id === 'lane' || row.id === 'desk')
    expect(line?.detail).not.toBe(ALLOCATOR_WAIT)
  })
})
