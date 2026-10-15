import { describe, expect, it } from 'vitest'
import { spawnHallGuest } from './guests.ts'
import { legRoute, routeRoomKinds, seededRand } from './hallRoute.ts'
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
    const x0 = g.wx ?? 0
    const z0 = g.wz ?? 0
    game.tick(0.4)
    expect(g.lost).toBeFalsy()
    // The first doorway step is often north-south, so x alone stays put.
    expect(Math.hypot((g.wx ?? x0) - x0, (g.wz ?? z0) - z0)).toBeGreaterThan(0.02)
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

  it('handles edge case: no halls', () => {
    const game = starter()
    game.fits = []
    game.tiles = []
    const stand = { c: 10, r: 10 }
    expect(game.roomPlanForHall('no-hall')).toBeNull()
    expect(game.jetwayHall(stand)).toBeNull()

    const guest = { id: 'g-nohall', node: 'entrance', job: 'depart' as const, clearedSec: false }
    expect(legRoute(null as any, guest, 'gate')).toBeNull()

    const emptyPlan = { ...starter().roomPlanForHall(null)!, rooms: [] }
    expect(legRoute(emptyPlan, guest, 'gate')).toBeNull()
  })

  it('handles edge case: a stand that no hall serves', () => {
    const game = starter()
    const maxR = game.tiles.length - 1
    const maxC = game.tiles[0].length - 1
    const remoteStand = { c: maxC, r: maxR }
    game.tiles[remoteStand.r][remoteStand.c] = 'stand'
    expect(game.jetwayHall(remoteStand)).toBeNull()

    const hallStands = game.standsForHall(game.fits[0])
    expect(hallStands.some((s) => s.c === remoteStand.c && s.r === remoteStand.r)).toBe(false)
  })

  it('handles edge case: two halls with ties', () => {
    const game = starter()
    const hall1 = { ...game.fits[0], origin: { c: 10, r: 10 } }
    const hall2 = { ...game.fits[0], origin: { c: 10, r: 18 } }
    game.fits = [hall1, hall2]

    // Stand equidistant from both halls within JETWAY_RANGE (Manhattan distance = 4)
    const tiedStand = { c: 10, r: 14 }
    if (!game.tiles[tiedStand.r]) game.tiles[tiedStand.r] = []
    game.tiles[tiedStand.r][tiedStand.c] = 'stand'
    game.standAccess[`${tiedStand.c},${tiedStand.r}`] = 'jetway'

    const choice1 = game.jetwayHall(tiedStand)
    expect(choice1).toBe(hall1)

    // Swap array order to confirm deterministic array-order tie breaking
    game.fits = [hall2, hall1]
    const choice2 = game.jetwayHall(tiedStand)
    expect(choice2).toBe(hall2)
  })

  it('handles edge case: an unreachable gate', () => {
    const game = starter()
    const plan = game.roomPlanForHall(game.hallKey(game.fits[0]))!
    // Block all intermediate tiles in the plan to isolate rooms
    const blockedGrid = new Uint8Array(plan.blocked.length).fill(1)
    const blockedPlan = { ...plan, blocked: blockedGrid }
    const guest = { id: 'g-unreachable', node: 'security', job: 'depart' as const, clearedSec: true }
    const route = legRoute(blockedPlan, guest, 'gate')
    expect(route).toBeNull()
  })

  it('handles edge case: a deterministic result for the same input', () => {
    const game = starter()
    const plan = game.roomPlanForHall(game.hallKey(game.fits[0]))!
    const guest = { id: 'g-deterministic', node: 'security', job: 'depart' as const, clearedSec: true }

    const route1 = legRoute(plan, guest, 'gate')
    const route2 = legRoute(plan, guest, 'gate')
    expect(route1).not.toBeNull()
    expect(route2).not.toBeNull()
    expect(route1).toEqual(route2)

    // Verify seededRand repeatability
    const randA = seededRand('test-seed-123')
    const randB = seededRand('test-seed-123')
    const seqA = [randA(), randA(), randA()]
    const seqB = [randB(), randB(), randB()]
    expect(seqA).toEqual(seqB)
  })
})
