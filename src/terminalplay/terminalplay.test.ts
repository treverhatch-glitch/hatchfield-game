import { describe, expect, it } from 'vitest'
import { Game } from '../game/sim.ts'
import { itemDef, type PlacedItem, type ZoneId } from '../game/terminal.ts'
import { placementCheck } from '../game/terminalKit.ts'
import { isBottleneck } from './config.ts'
import { facilitiesFromItems, facilityBlockers, placeholderRoute } from './facilities.ts'
import { collisionReason } from './place.ts'
import { hallQueues, queueAtNode } from './queues.ts'

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

    const route = placeholderRoute(facilities).map((f) => f.type)
    expect(route).toEqual([
      'entrance',
      'checkin',
      'bag_drop',
      'security',
      'scanner',
      'restroom',
      'food',
      'shop',
      'seat',
      'gate',
    ])
    expect(route).not.toContain('wall')
    expect(route).not.toContain('belt')

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
    const shop = game.fits[0].items?.find((it) => it.def === 'newsagent')
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
