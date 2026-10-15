import { describe, expect, it } from 'vitest'
import { gateLeaseId } from '../hubprogress/leases.ts'
import { Game } from './sim.ts'

function stands(game: Game) {
  game.tiles[8][3] = 'stand'
  game.tiles[8][4] = 'stand'
}

describe('dedicate picker', () => {
  it('locks the desk that was clicked and clears the checklist line', () => {
    const game = new Game()
    game.sandbox = true
    game.beginNew('easy')
    game.startFocus = 'pax'
    game.buyLand('city')
    game.buildStarterKit()
    game.signed = ['brisa']
    game.tickHallNav(0.05)
    const alloc = game.checkinAllocation()
    const belt = alloc.desks.find((row) => row.mode !== 'kiosk')
    const kiosk = alloc.desks.find((row) => row.mode === 'kiosk')
    expect(belt).toBeTruthy()
    expect(game.dedicateDesk('brisa', 'missing-desk')).toBe(false)
    expect(game.dedicatedDesks).toHaveLength(0)
    if (kiosk) expect(game.dedicateDesk('brisa', kiosk.deskId)).toBe(false)
    expect(game.dedicateDesk('brisa', belt!.deskId)).toBe(true)
    expect(game.dedicatedDesks).toEqual([{ deskId: belt!.deskId, airlineId: 'brisa', mode: 'dedicated' }])
    expect(game.hubChecklistFor('brisa').lines.find((line) => line.id === 'desk')).toMatchObject({
      detail: '1 / 1',
      status: 'ok',
    })

    const lane = game.lanePlates()[0]
    expect(lane).toBeTruthy()
    expect(game.dedicateLane('brisa', lane!.id)).toBe(true)
    expect(game.dedicatedHoldings('brisa').some((row) => row.kind === 'lane')).toBe(true)
    expect(game.unassignDedicated('brisa', 'lane', lane!.id)).toBe(true)
    expect(game.dedicatedLanes).toHaveLength(0)
  })

  it('paints two stands, shows the three sentences, and unassigns from the profile list', () => {
    const game = new Game()
    game.signed = ['gulf_pearl', 'zephyr_go', 'brisa']
    game.hubTiers.gulf_pearl = 'base'
    stands(game)
    const copy = game.assignPreview('gulf_pearl', 'gate')
    expect(copy.relationship).toContain('0.08')
    expect(copy.relationship).toContain('1.6')
    expect(copy.rival.startsWith('No rival hit for the lease.')).toBe(true)
    expect(copy.rival).toContain('Zephyr Go')
    expect(copy.flexibility).toContain('Serves only Gulf Pearl')
    expect(copy.flexibility).toContain('common pool')

    game.tool = 'pan'
    game.toggleAssignBulk()
    game.clickTile({ c: 3, r: 8 })
    game.clickTile({ c: 4, r: 8 })
    expect(game.assignSelection).toHaveLength(2)
    expect(game.applyAssign('gulf_pearl')).toBe(2)
    expect(game.hubLeases.map((row) => row.airlineId)).toEqual(['gulf_pearl', 'gulf_pearl'])
    expect(game.dedicateHubFacility('brisa', 'gate', gateLeaseId(3, 8))).toBe(false)

    const marks = game.apronLeaseMarks()
    expect(marks).toHaveLength(2)
    expect(marks[0]?.primary.startsWith('#')).toBe(true)
    expect(marks[0]?.code.length).toBeGreaterThan(0)

    const held = game.dedicatedHoldings('gulf_pearl')
    expect(held).toHaveLength(2)
    expect(game.unassignDedicated('gulf_pearl', 'gate', held[0]!.id)).toBe(true)
    expect(game.dedicatedHoldings('gulf_pearl')).toHaveLength(1)
    expect(game.hubChecklistFor('brisa').lines.find((line) => line.id === 'desk')?.detail).toBe('0 / 1')
  })

  it('opens the picker when a stand is clicked', () => {
    const game = new Game()
    game.tool = 'pan'
    stands(game)
    game.clickTile({ c: 3, r: 8 })
    expect(game.assignPick).toMatchObject({ kind: 'gate', id: gateLeaseId(3, 8) })
    game.closeAssign()
    expect(game.assignPick).toBeNull()
  })
})
