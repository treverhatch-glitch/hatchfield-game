import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import type { Flight, Vec } from './types.ts'

function starter(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

function stands(game: Game): Vec[] {
  const out: Vec[] = []
  game.tiles.forEach((row, r) => row.forEach((tile, c) => tile === 'stand' && out.push({ c, r })))
  return out
}

const key = (p: Vec) => `${Math.round(p.c)},${Math.round(p.r)}`

describe('starter runway lineup', () => {
  it('lines departures up from the end of the strip, off the row arrivals vacate by', () => {
    const game = starter()
    const all = stands(game)
    expect(all.length).toBeGreaterThan(0)
    for (const stand of all) {
      const landing = game.landingRoute(stand)
      expect(landing, `landing to ${key(stand)}`).not.toBeNull()
      const firstRunway = landing!.findIndex((p) => game.tiles[p.r]?.[p.c] === 'runway')
      let i = firstRunway
      while (i < landing!.length && game.tiles[landing![i].r]?.[landing![i].c] === 'runway') i++
      const vacate = new Set(landing!.slice(i, i + 4).map(key))

      const out = game.departurePath({ stand } as unknown as Flight)
      expect(out, `departure from ${key(stand)}`).not.toBeNull()
      const onto = out!.findIndex((p) => game.tiles[p.r]?.[p.c] === 'runway')
      const hold = out![onto - 1]!
      expect(game.tiles[hold.r][hold.c]).toBe('taxi')
      expect(hold.r).toBe(out![onto].r)
      for (const p of out!.slice(0, onto)) expect(vacate.has(key(p)), `${key(p)} on the arrival exit`).toBe(false)
    }
  })

  it('keeps an arrival in the stack while a jet sits on the ground it would roll after landing', () => {
    const game = starter()
    const stand = stands(game)[0]!
    const route = game.landingRoute(stand)!
    const firstRunway = route.findIndex((p) => game.tiles[p.r]?.[p.c] === 'runway')
    let i = firstRunway
    while (i < route.length && game.tiles[route[i].r]?.[route[i].c] === 'runway') i++
    const onExit = route[i + 2]!
    const occupied = (game as unknown as { exitRouteOccupied(r: Vec[], self: string): boolean }).exitRouteOccupied
    const blocker = { id: 'dep', craft: 'jet', phase: 'taxi_out', x: onExit.c, y: onExit.r } as unknown as Flight
    expect(occupied.call(game, route, 'arr')).toBe(false)
    game.flights.push(blocker)
    expect(occupied.call(game, route, 'arr')).toBe(true)
    blocker.phase = 'servicing'
    expect(occupied.call(game, route, 'arr')).toBe(false)
  })
})
