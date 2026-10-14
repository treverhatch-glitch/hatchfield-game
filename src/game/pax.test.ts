import { describe, expect, it } from 'vitest'
import { isPaxEntrance, landsideCurbs, paxGround } from './path'
import { spawnArrivalPax, spawnDeparturePax } from './pax'
import { SIZE, type Tile, type Vec } from './types'

function field(): Tile[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 'grass' as Tile))
}

/** Hall on row 12, curb road on row 13, stand north of the hall, grass between. */
function airport(): Tile[][] {
  const tiles = field()
  for (let c = 10; c <= 14; c++) tiles[12][c] = 'terminal'
  for (let c = 8; c <= 16; c++) tiles[13][c] = 'road'
  tiles[10][12] = 'stand'
  tiles[11][12] = 'taxi'
  tiles[9][12] = 'bags'
  return tiles
}

function cells(path: Vec[]): string[] {
  return path.map((p) => `${p.c},${p.r}`)
}

describe('apron passengers stay on the ground', () => {
  const stand = { c: 12, r: 10 }
  const fit = {
    origin: { c: 12, r: 12 },
    rooms: { bagclaim: 1, souvenir: 1, security: 1, food: 1 },
  } as never

  it('spawns departures on the landside curb, not the first road on the map', () => {
    const tiles = airport()
    tiles[0][0] = 'road'
    const people = spawnDeparturePax(tiles, 'f1', stand, fit, 6)
    expect(people.length).toBeGreaterThan(0)
    const curbs = new Set(landsideCurbs(tiles).map((p) => `${p.c},${p.r}`))
    for (const p of people) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThan(SIZE)
      expect(p.y).toBeLessThan(SIZE)
      expect(curbs.has(`${Math.round(p.x)},${Math.round(p.y)}`)).toBe(true)
      expect(p.path[0]).toEqual({ c: Math.round(p.x), r: Math.round(p.y) })
    }
  })

  it('walks through the door and never chords across grass or the hall', () => {
    const tiles = airport()
    const people = spawnDeparturePax(tiles, 'f1', stand, fit, 4)
    expect(people.length).toBeGreaterThan(0)
    for (const p of people) {
      expect(p.path.length).toBeGreaterThan(1)
      for (let i = 1; i < p.path.length; i++) {
        const a = p.path[i - 1]
        const b = p.path[i]
        expect(Math.abs(a.c - b.c) + Math.abs(a.r - b.r)).toBe(1)
        expect(paxGround(tiles, b.c, b.r)).toBe(true)
        if (tiles[b.r][b.c] === 'terminal') expect(isPaxEntrance(tiles, b.c, b.r)).toBe(true)
      }
      expect(cells(p.path)).not.toContain('0,0')
      expect(p.path.some((step) => tiles[step.r][step.c] === 'grass')).toBe(false)
    }
  })

  it('does not spawn a flying shortcut when the door is walled off', () => {
    const tiles = airport()
    for (let c = 8; c <= 16; c++) tiles[13][c] = 'grass'
    tiles[9][12] = 'grass'
    expect(spawnDeparturePax(tiles, 'f1', stand, fit, 4)).toEqual([])
    expect(spawnArrivalPax(tiles, 'f1', stand, fit, 4)).toEqual([])
  })

  it('brings arrivals off the stand and out through the entrance', () => {
    const tiles = airport()
    const people = spawnArrivalPax(tiles, 'f1', stand, fit, 4)
    expect(people.length).toBeGreaterThan(0)
    for (const p of people) {
      expect(p.path[0]).toEqual(stand)
      expect(p.path.some((step) => tiles[step.r][step.c] === 'grass')).toBe(false)
      const door = p.path.find((step) => tiles[step.r][step.c] === 'terminal')
      if (door) expect(isPaxEntrance(tiles, door.c, door.r)).toBe(true)
    }
  })
})
