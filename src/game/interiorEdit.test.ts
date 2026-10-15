import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { hallNavLayout } from './hallNav.ts'

function fresh(): Game {
  const game = new Game()
  game.sandbox = true
  game.beginNew('easy')
  game.buyLand('city')
  game.cash = 500_000
  return game
}

function finish(game: Game) {
  const site = game.sites.at(-1)
  expect(site).toBeTruthy()
  game.finishSite(site!)
  game.sites = game.sites.filter((row) => row !== site)
}

describe('terminal interior edit', () => {
  it('drags a wall into the walk layout and validates a shop', () => {
    const game = fresh()
    game.placeTerminal({ c: 10, r: 10 })
    finish(game)
    expect(game.activeHall()?.interior).toBeUndefined()
    const before = hallNavLayout(game.activeHall()!)!
    expect(game.dragInteriorWall({ x: 2, y: 2 }, { x: 4, y: 2 }, false)).toBe(true)
    const after = hallNavLayout(game.activeHall()!)!
    expect(after.walls.length).toBe(before.walls.length + 3)
    expect(after.walls.some((w) => w.floor === 0 && w.x === 3 && w.y === 2 && w.dir === 'S')).toBe(true)

    expect(game.assignInteriorRoom('retail', { x: 0, y: 0, w: 2, h: 2 })).toBe(true)
    const room = game.activeHall()?.interior?.rooms[0]
    expect(room?.kind).toBe('retail')
    expect(room?.floor).toBe(0)
    const missing = game.interiorFindings(room!.id)
    expect(missing.some((f) => f.title.toLowerCase().includes('shop'))).toBe(true)
    expect(game.interiorChecks().some((f) => f.id.includes('shop_counter'))).toBe(true)
    expect(game.furnishInteriorRoom(room!.id)).toBe(true)
    expect(game.interiorFindings(room!.id).some((f) => f.id.includes('shop_counter'))).toBe(false)
    expect(game.resizeInteriorRoom(room!.id, { x: 0, y: 0, w: 3, h: 2 })).toBe(true)
    expect(game.activeHall()?.interior?.rooms[0]?.w).toBe(3)
    expect(game.deleteInteriorRoom(room!.id)).toBe(true)
    expect(game.activeHall()?.interior?.rooms).toHaveLength(0)

    expect(game.paintInteriorFloor([{ x: 1, y: 1 }], 'floor_carpet')).toBe(true)
    expect(hallNavLayout(game.activeHall()!)?.floorPaint?.[1]?.[1]).toBe('floor_carpet')

    expect(game.dragInteriorFoundation([{ x: 1, y: 1 }, { x: 2, y: 1 }])).toBe(true)
    expect(game.activeHall()?.interior?.foundation).toHaveLength(2)
    expect(hallNavLayout(game.activeHall()!)?.floor[1]?.[1]).toBe(true)
    expect(game.interiorChecks()).toEqual([])
  })
})
