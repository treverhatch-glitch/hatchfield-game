import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import type { Flight } from '../game/types.ts'
import { itemDef, type PlacedItem, type ZoneId } from '../game/terminal.ts'
import { placementCheck } from '../game/terminalKit.ts'
import { isBottleneck, PLAY_TUNING } from './config.ts'
import { facilitiesFromItems, facilityBlockers } from './facilities.ts'
import { findFootprint, footprintReason, footprintSpec, stampFrom } from './footprints.ts'
import { queueAnchor, slotsAlong, standingInQueue } from './lines.ts'
import { collisionReason } from './place.ts'
import { hallQueues, queueAtNode } from './queues.ts'
import { apronToHall, hallFitFor, matchTerminal } from '../render/hallRooms.ts'
import { terminals } from '../render/world/layout.ts'

const ZONES: ZoneId[][] = [
  ['checkin', 'checkin', 'checkin', 'checkin'],
  ['security', 'security', 'security', 'security'],
  ['gates', 'retail', 'toilets', 'gates'],
]

function placed(def: PlacedItem['def'], c: number, r: number): PlacedItem {
  return { id: `${def}-${c}-${r}`, def, c, r, wear: 0 }
}

describe('facility interface for pathing', () => {
  it('exposes position, type, and capacity, and keeps walls and belts out of the route', () => {
    const items = [
      placed('entrance', 0, 0),
      placed('checkin_belt', 1, 0),
      placed('bag_drop', 2, 0),
      placed('wall', 3, 0),
      placed('security_small', 0, 1),
      placed('scanner', 1, 1),
      placed('bag_system', 2, 1),
      placed('toilet', 3, 1),
      placed('cafe', 0, 2),
      placed('newsagent', 1, 2),
      placed('seat_row', 2, 2),
      placed('boarding_desk', 3, 2),
    ]
    const facilities = facilitiesFromItems(items, 4, 3)
    const desk = facilities.find((f) => f.def === 'checkin_belt')
    expect(desk).toMatchObject({ type: 'checkin', c: 1, r: 0, capacity: 1 })
    expect(desk?.x).toBeTypeOf('number')
    expect(desk?.z).toBeTypeOf('number')
    expect(facilities.find((f) => f.type === 'scanner')?.capacity).toBe(1)
    expect(facilities.find((f) => f.type === 'seat')?.capacity).toBe(4)

    const blocked = facilityBlockers(items)
    expect(blocked.has('3,0')).toBe(true)
    expect(blocked.has('2,1')).toBe(true)
    expect(blocked.has('1,0')).toBe(false)
  })
})

describe('terminal placement collision', () => {
  const ok = { fieldLevel: 1, cash: 1e6 }

  it('refuses desks on a wall or a belt, and a wall on an occupied cell', () => {
    const desk = itemDef('checkin_belt')!
    const wall = itemDef('wall')!
    const belt = itemDef('bag_system')!
    expect(collisionReason([placed('wall', 0, 0)], desk, 0, 0)).toBe('On a wall')
    expect(placementCheck(ZONES, [placed('wall', 0, 0)], desk, 0, 0, ok).reason).toBe('On a wall')
    expect(placementCheck(ZONES, [placed('bag_system', 1, 0)], desk, 1, 0, ok).reason).toBe('On a bag belt')
    expect(placementCheck(ZONES, [placed('bench', 2, 2)], wall, 2, 2, ok).reason).toBe('Cell is occupied')
    expect(placementCheck(ZONES, [], belt, 3, 0, ok).ok).toBe(true)
    expect(placementCheck(ZONES, [], wall, 2, 2, ok).ok).toBe(true)
  })

  it('places, moves, and removes a desk without landing on a wall', () => {
    const game = new Game()
    game.sandbox = true
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.sandbox = true
    expect(game.placeHallItemAt('wall', 4, 3, 0)).toBe(true)
    expect(game.placeHallItemAt('checkin_belt', 4, 3, 0)).toBe(false)
    expect(game.placeHallItemAt('bag_drop', 1, 0, 0)).toBe(false)
    expect(game.placeHallItemAt('newsagent', 2, 4, 0)).toBe(true)
    expect(game.placeHallItemAt('scanner', 1, 2, 0)).toBe(true)
    const shop = game.fits[0].items?.find((it) => it.def === 'newsagent' && !it.bundle)
    expect(shop).toBeTruthy()
    expect(game.moveHallItem(shop!.id, 4, 3, 1)).toBe(false)
    expect(game.moveHallItem(shop!.id, 5, 4, 1)).toBe(true)
    expect(game.fits[0].items?.find((it) => it.id === shop!.id)).toMatchObject({ c: 5, r: 4, rot: 1 })
    const wall = game.fits[0].items?.find((it) => it.def === 'wall' && !it.bundle)
    expect(game.removeHallItem(wall!.id)).toBe(true)
    expect(game.placeHallItemAt('seat_row', 4, 3, 0)).toBe(true)
    const listed = facilitiesFromItems((game.fits[0].items ?? []) as PlacedItem[], 8, 5)
    expect(listed.some((f) => f.type === 'shop' && f.c === 5 && f.r === 4)).toBe(true)
    expect(listed.some((f) => f.type === 'scanner')).toBe(true)
  })
})

describe('terminal queue readout', () => {
  it('counts who is already waiting and paints a long line as a bottleneck', () => {
    const waiting = Array.from({ length: 8 }, () => ({
      node: 'security' as const,
      job: 'depart' as const,
      clearedSec: false,
      serviceLeft: 0,
      dead: false,
    }))
    expect(queueAtNode(waiting, 'security')).toBe(8)
    expect(hallQueues(waiting)[0]).toMatchObject({ node: 'security', count: 8, bottleneck: true })
    expect(isBottleneck(7)).toBe(false)
    expect(isBottleneck(8)).toBe(true)
  })
})

function hallFrame(game: Game) {
  const hall = game.fits[0]
  const plan = game.roomPlanForHall(game.hallKey(hall))!
  const hit = matchTerminal(terminals(game), hall.origin)!
  return { plan, fit: hallFitFor(hit.info), hall }
}

describe('true footprints inside the nine rooms', () => {
  it('keeps the nine-room set and stamps each operated piece on its real size', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    const { plan, fit } = hallFrame(game)
    const kinds = new Set(plan.rooms.map((r) => r.kind))
    expect(kinds).toEqual(new Set(['checkin', 'security', 'airside', 'shops', 'gate', 'lab', 'office']))
    expect(plan.rooms.filter((r) => r.kind === 'gate')).toHaveLength(3)

    const desk = stampFrom('checkin_belt', 0, 0, 0)!
    expect(desk.w).toBe(3)
    expect(desk.d).toBe(1.2)
    expect(stampFrom('checkin_belt', 0, 0, 1)!.w).toBe(1.2)
    expect(footprintSpec('security_small')).toMatchObject({ w: 3.2, d: 4, rooms: ['security'] })
    expect(footprintSpec('seat_row')?.rooms).toEqual(['gate'])
    expect(footprintSpec('newsagent')?.rooms).toEqual(['shops'])
    expect(footprintSpec('toilet')?.rooms).toContain('checkin')

    for (const id of ['checkin_belt', 'security_small', 'newsagent', 'toilet', 'seat_row'] as const) {
      const spot = findFootprint(plan, fit, [], id, 0)
      expect(spot, id).toBeTruthy()
      expect(footprintReason(plan, fit, [], id, spot!.hx, spot!.hz, 0)).toBeNull()
      const size = footprintSpec(id)!
      expect(spot!.w === size.w || spot!.w === size.d).toBe(true)
    }
  })

  it('refuses a desk on a wall, in a doorway, in the wrong room, and on another desk', () => {
    const game = new Game()
    game.sandbox = true
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    const { plan, fit } = hallFrame(game)
    const wall = plan.walls.find((w) => !w.header)!
    const wallAt = apronToHall((wall.x0 + wall.x1) / 2, (wall.z0 + wall.z1) / 2, fit)
    expect(footprintReason(plan, fit, [], 'checkin_belt', wallAt.x, wallAt.z, 0)).toBe('On a wall')

    const door = plan.doors.find((d) => d.kind === 'opening')!
    const doorAt = apronToHall(door.x, door.z, fit)
    expect(footprintReason(plan, fit, [], 'checkin_belt', doorAt.x, doorAt.z, 0)).toBe('Blocks a door')

    const gate = plan.rooms.find((r) => r.kind === 'gate')!
    const gateAt = apronToHall(gate.x, gate.z, fit)
    expect(footprintReason(plan, fit, [], 'checkin_belt', gateAt.x, gateAt.z, 0)).toMatch(/Goes in the check-in hall|wall|fixture|door/)

    const spot = findFootprint(plan, fit, [], 'checkin_belt', 0)!
    expect(game.placeHallFootprint('checkin_belt', spot.hx, spot.hz, 0)).toBe(true)
    const placed = game.fits[0].items?.find((it) => it.def === 'checkin_belt' && it.hx != null)
    expect(placed?.fw).toBe(3)
    expect(placed?.fd).toBe(1.2)
    expect(footprintReason(plan, fit, game.fits[0].items ?? [], 'kiosk', spot.hx, spot.hz, 0)).toBe('Overlaps another item')
    expect(game.placeHallFootprint('checkin_belt', spot.hx, spot.hz, 0)).toBe(false)

    const seat = game.findHallFootprint('seat_row')
    expect(seat).toBeTruthy()
    expect(game.placeHallFootprint('seat_row', seat!.hx, seat!.hz, seat!.rot)).toBe(true)
    const shop = game.findHallFootprint('newsagent')
    expect(shop).toBeTruthy()
    expect(game.placeHallFootprint('newsagent', shop!.hx, shop!.hz, 0)).toBe(true)
    const wc = game.findHallFootprint('toilet')
    expect(wc).toBeTruthy()
    expect(game.placeHallFootprint('toilet', wc!.hx, wc!.hz, 0)).toBe(true)
    const lane = game.findHallFootprint('security_small')
    expect(lane).toBeTruthy()
    expect(game.placeHallFootprint('security_small', lane!.hx, lane!.hz, 0)).toBe(true)
  })
})

describe('live queues on the doorway walk', () => {
  it('spaces a security line and paints eight waiting people as a bottleneck', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    const { plan, fit } = hallFrame(game)
    const anchor = queueAnchor(plan, fit, [], 'security')
    expect(anchor).toBeTruthy()
    const slots = slotsAlong(anchor!, 8)
    expect(slots).toHaveLength(8)
    for (let i = 1; i < slots.length; i++) {
      const step = Math.hypot(slots[i].x - slots[i - 1].x, slots[i].z - slots[i - 1].z)
      expect(step).toBeCloseTo(PLAY_TUNING.queueSpacingM, 5)
    }
    const waiting = Array.from({ length: 8 }, (_, i) => ({
      id: `q-${i}`,
      node: 'security' as const,
      job: 'depart' as const,
      clearedSec: false,
      serviceLeft: 0,
      path: ['security'],
      seg: 0,
      queueSeq: i,
    }))
    expect(waiting.every((g) => standingInQueue(g, 'security', 0))).toBe(true)
    expect(hallQueues(waiting)[0]).toMatchObject({ node: 'security', count: 8, bottleneck: true })
    const walking = { ...waiting[0], id: 'walk', path: ['checkin', 'security'], seg: 0 }
    expect(standingInQueue(walking, 'security', 0)).toBe(false)
  })

  it('walks a departure from the doors through security to the gate', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    expect(game.hallGuests.filter((g) => g.preview)).toHaveLength(0)
    expect(game.hallGuests).toHaveLength(0)
    expect(game.securityQueueCount()).toBe(0)
    game.tickHall(1.5)
    expect(game.hallGuests).toHaveLength(0)
    expect(game.securityQueueCount()).toBe(0)
    game.demoHallCrowd(1)
    const dep = game.hallGuests.find((row) => !row.preview)!
    expect(dep.path[0]).toBe('entrance')
    expect(dep.clearedSec).toBe(false)
    let guard = 0
    while (guard++ < 500 && !(dep.clearedSec && dep.node === 'gate')) game.tick(0.25)
    expect(dep.lost).toBeFalsy()
    expect(dep.clearedSec).toBe(true)
    expect(dep.node).toBe('gate')
  })
})

describe('prefab pace', () => {
  it('lets one bank through security, and holds a stacked bank in taxis at the curb', () => {
    const game = new Game()
    game.sandbox = false
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    game.speed = 1
    const stand = { c: 11, r: 6 }
    game.clock = 30
    game.seedHallForFlight(
      { id: 'early-bank', cargo: false, pax: 55, airline: 'bushline', stand, std: 70, kind: 'narrow' } as unknown as Flight,
      'depart',
    )
    let early = 0
    for (let i = 0; i < 160; i++) {
      game.tick(0.5)
      early = Math.max(early, game.securityQueueCount())
    }
    // One flight drips through the layby. Security peaks at one, under the red line of 8.
    expect(early).toBe(1)

    game.clock = 800
    for (let n = 0; n < 3; n++) {
      game.seedHallForFlight(
        {
          id: `late-bank-${n}`,
          cargo: false,
          pax: 99,
          airline: 'northline',
          stand,
          std: game.clock + 1,
          kind: 'narrow',
        } as unknown as Flight,
        'depart',
      )
    }
    const late = game.hallGuests.filter((g) => g.flightId.startsWith('late-bank'))
    expect(late).toHaveLength(39)
    expect(late.every((g) => g.arriveMode === 'dropoff' && g.curbHold === 'ride')).toBe(true)

    // Three banks due together take taxis. The layby meters them, so security
    // stays at one. All three stalls (rows 8, 9 and 10) take a taxi. Two can
    // sit at once: a drop-off stop is 1.2s and the next taxi is still pulling in.
    // The rest queue on the approach. Curb load is those cars, not the rate model.
    let security = 0
    let maxStop = 0
    const rows = new Set<number>()
    let maxQueue = 0
    let maxBusy = 0
    for (let i = 0; i < 360; i++) {
      game.tick(0.25)
      security = Math.max(security, game.securityQueueCount())
      const view = game.landsideView()
      const trips = view.vehicles.filter((v) => v.orderId)
      const stopped = trips.filter((v) => v.state === 'stop' && v.c < 16.85 && v.r > 7 && v.r < 11)
      maxStop = Math.max(maxStop, stopped.length)
      maxQueue = Math.max(maxQueue, trips.filter((v) => v.state === 'queue').length)
      maxBusy = Math.max(maxBusy, view.curbBusy)
      for (const v of stopped) rows.add(Math.round(v.r))
    }
    expect(security).toBe(1)
    expect(maxStop).toBe(2)
    expect([...rows].sort((a, b) => a - b)).toEqual([8, 9, 10])
    expect(maxQueue).toBe(18)
    expect(maxBusy).toBeGreaterThan(2)
    expect(maxBusy).toBeLessThan(2.5)
  })
})
