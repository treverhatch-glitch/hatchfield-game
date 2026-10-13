import { describe, expect, it } from 'vitest'
import { adviseHall, securityBypassEdges } from './advisor.ts'
import { openNodesFromRooms, type HallNode } from './guests.ts'
import { Game } from './sim.ts'
import { schemeSigns, schemeZones } from './terminal.ts'

function fitOf(tier: 1 | 2 | 3) {
  return {
    premade: true,
    redesigned: false,
    tier,
    signs: schemeSigns(tier),
    capGuests: tier === 1 ? 28 : tier === 2 ? 48 : 80,
    secPerMin: tier === 1 ? 20 : tier === 2 ? 60 : 128,
    zones: schemeZones(tier),
    rooms: {
      checkin: 2,
      security: 2,
      gate: 2,
      bagclaim: 1,
      food: 1,
      souvenir: 1,
      bagdrop: 1,
      lounge: 1,
      bathroom: 2,
    },
  }
}

describe('design advisor', () => {
  it('all three prefab schemes are clean until the hall is overloaded', () => {
    for (const tier of [1, 2, 3] as const) {
      const open = openNodesFromRooms(fitOf(tier).rooms)
      expect(adviseHall(fitOf(tier), open)).toEqual([])
    }
  })

  it('flags a gate that cannot be reached', () => {
    const fit = fitOf(1)
    fit.rooms.gate = 0
    const open = openNodesFromRooms(fit.rooms)
    const notes = adviseHall(fit, open)
    expect(notes.some((n) => n.id === 'unreachable-gate')).toBe(true)
  })

  it('flags a painted zone whose room is missing', () => {
    const fit = fitOf(1)
    fit.rooms.food = 0
    fit.rooms.souvenir = 0
    const open = openNodesFromRooms(fit.rooms)
    const notes = adviseHall(fit, open)
    expect(notes.some((n) => n.id === 'zone-retail')).toBe(true)
  })

  it('flags a graph edge that skips security', () => {
    const open = openNodesFromRooms(fitOf(1).rooms)
    open.add('gate')
    const bad = securityBypassEdges(open, [['checkin', 'gate']])
    expect(bad).toEqual([['checkin', 'gate']])
  })

  it('flags a dead end', () => {
    const open = new Set<HallNode>(['pool'])
    const notes = adviseHall(
      { ...fitOf(1), rooms: { ...fitOf(1).rooms, gate: 0, bathroom: 0, food: 0, checkin: 0, security: 0, bagclaim: 0, souvenir: 0 } },
      open,
    )
    expect(notes.some((n) => n.id === 'dead-pool')).toBe(true)
  })

  it('flags a walk past the five-junction cap when signs are missing', () => {
    const rooms = { ...fitOf(1).rooms, rdesk: 1, rboard: 1, rmachine: 1, pool: 1 }
    const open = openNodesFromRooms(rooms)
    open.delete('info')
    const notes = adviseHall({ ...fitOf(1), signs: 0, rooms }, open)
    expect(notes.some((n) => n.id === 'missing-signs')).toBe(true)
  })

  it('flags security and check-in that cannot clear the bank', () => {
    const fit = fitOf(1)
    fit.secPerMin = 0
    fit.rooms.checkin = 0
    fit.rooms.security = 0
    const open = openNodesFromRooms({ ...fit.rooms, security: 1, checkin: 1 })
    const notes = adviseHall(fit, open, [{ status: 'scheduled' }, { status: 'scheduled' }])
    expect(notes.some((n) => n.id === 'undersized-security')).toBe(true)
    expect(notes.some((n) => n.id === 'undersized-checkin')).toBe(true)
  })

  it('flags bag claim and toilets that are not open', () => {
    const fit = fitOf(1)
    fit.rooms.bagclaim = 0
    fit.rooms.bathroom = 0
    const open = openNodesFromRooms(fit.rooms)
    const notes = adviseHall(fit, open)
    expect(notes.some((n) => n.id === 'claim-far')).toBe(true)
    expect(notes.some((n) => n.id === 'toilets-far')).toBe(true)
  })

  it('prompts an upgrade when the prefab is over capacity', () => {
    const notes = adviseHall(fitOf(1), openNodesFromRooms(fitOf(1).rooms), [], true)
    const hit = notes.find((n) => n.id === 'over-capacity')
    expect(hit?.fix).toMatch(/Upgrade the prefab|expand|design your own terminal/i)
    expect(hit?.cells.length).toBeGreaterThan(0)
  })

  it('a live overload stores the upgrade prompt on the game', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    expect(game.advice.filter((a) => a.id === 'over-capacity')).toEqual([])
    game.markHallOverloaded()
    expect(game.advice.some((a) => a.id === 'over-capacity')).toBe(true)
    game.focusAdvice('over-capacity')
    expect(game.advisorCells.length).toBeGreaterThan(0)
    expect(game.showFlows).toBe(false)
  })
})
