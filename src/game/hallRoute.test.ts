import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import { legRoute, routeRoomKinds } from './hallRoute.ts'
import { Game } from './sim.ts'
import { squareAt, STERILE_ROOMS, type RoomKind } from '../render/world/rooms.ts'

function starter() {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  game.speed = 1
  return game
}

describe('hall doorway routes', () => {
  it('keeps an uncleared departure on the landside of security', () => {
    const game = starter()
    const fit = game.fits[0]
    const open = game.hallOpenFor(fit)
    const g = spawnHallGuest('dep-door', 'depart', 'budget', { hallId: game.hallKey(fit) })
    g.node = 'entrance'
    g.clearedSec = false
    g.needs.boarding = 40
    game.routeGuest(g, 'gate', open)
    expect(g.lost).toBeFalsy()
    expect(g.path[g.path.length - 1]).toBe('security')
    expect(g.route && g.route.length).toBeGreaterThan(1)
    const plan = game.roomPlanForHall(g.hallId)
    expect(plan).toBeTruthy()
    const kinds = new Set(routeRoomKinds(plan!, g.route!))
    for (const kind of kinds) expect(STERILE_ROOMS.has(kind)).toBe(false)
    expect(kinds.has('security') || kinds.has('checkin')).toBe(true)
    for (const p of g.route!) {
      const s = squareAt(plan!, p.x, p.z)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(plan!.blocked[s]).toBe(0)
    }

    game.hallGuests = [g]
    const x0 = g.wx
    game.tick(0.4)
    expect(g.lost).toBeFalsy()
    expect(g.wx).not.toBe(x0)
    const stood = routeRoomKinds(plan!, [
      { x: g.wx!, z: g.wz! },
      { x: g.wx!, z: g.wz! },
    ])
    for (const kind of stood) expect(STERILE_ROOMS.has(kind)).toBe(false)
  })

  it('walks a cleared passenger from security to the gate through a doorway', () => {
    const game = starter()
    const fit = game.fits[0]
    const open = game.hallOpenFor(fit)
    const g = spawnHallGuest('dep-sterile', 'depart', 'budget', { hallId: game.hallKey(fit) })
    g.node = 'security'
    g.clearedSec = true
    game.routeGuest(g, 'gate', open)
    expect(g.lost).toBeFalsy()
    expect(g.path[0]).toBe('security')
    expect(g.path[g.path.length - 1]).toBe('gate')
    const plan = game.roomPlanForHall(g.hallId)!
    const seen = new Set<RoomKind>()
    let guard = 0
    while (g.route && g.route.length > 1 && guard++ < 8) {
      for (const kind of routeRoomKinds(plan, g.route)) seen.add(kind)
      const end = g.route[g.route.length - 1]
      g.wx = end.x
      g.wz = end.z
      if (g.seg >= g.path.length - 2) break
      g.seg += 1
      g.node = g.path[g.seg]
      g.t = 0
      game.armGuestRoute(g)
    }
    expect(seen.size).toBeGreaterThan(1)
    expect(seen.has('gate') || seen.has('airside')).toBe(true)
    expect(g.lost).toBeFalsy()
  })

  it('returns null instead of a shortcut when the goal room is missing', () => {
    const game = starter()
    const plan = game.roomPlanForHall(game.hallKey(game.fits[0]))!
    const stripped = { ...plan, rooms: plan.rooms.filter((r) => r.kind === 'checkin') }
    const route = legRoute(
      stripped,
      { id: 'no-sterile', node: 'checkin', job: 'depart', clearedSec: false },
      'gate',
    )
    expect(route).toBeNull()
  })
})
