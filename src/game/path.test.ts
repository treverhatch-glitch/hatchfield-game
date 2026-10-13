import { describe, expect, it } from 'vitest'
import { astar, key, neighbors, parseKey, tilesOf, walkableFor } from './path'
import { SIZE, type Tile, type Vec } from './types'

/** The string-keyed A* this module shipped before the typed-array rewrite (issue #25). */
function astarReference(tiles: Tile[][], start: Vec, goal: Vec, kind: 'jet' | 'truck' | 'person' | 'mechanic'): Vec[] | null {
  if (start.c === goal.c && start.r === goal.r) return [start]
  if (!walkableFor(kind, tiles[start.r][start.c])) return null
  if (!walkableFor(kind, tiles[goal.r][goal.c])) return null
  const startK = key(start.c, start.r)
  const goalK = key(goal.c, goal.r)
  const open: string[] = [startK]
  const came = new Map<string, string>()
  const g = new Map<string, number>([[startK, 0]])
  const h = (c: number, r: number) => Math.abs(c - goal.c) + Math.abs(r - goal.r)
  while (open.length) {
    let bestI = 0
    let bestF = Infinity
    for (let i = 0; i < open.length; i++) {
      const p = parseKey(open[i])
      const f = (g.get(open[i]) ?? 1e9) + h(p.c, p.r)
      if (f < bestF) {
        bestF = f
        bestI = i
      }
    }
    const cur = open.splice(bestI, 1)[0]
    if (cur === goalK) {
      const path = [parseKey(cur)]
      let k = cur
      while (came.has(k)) {
        k = came.get(k)!
        path.push(parseKey(k))
      }
      return path.reverse()
    }
    const p = parseKey(cur)
    for (const n of neighbors(p.c, p.r)) {
      if (!walkableFor(kind, tiles[n.r][n.c])) continue
      const nk = key(n.c, n.r)
      const ng = (g.get(cur) ?? 1e9) + 1
      if (ng < (g.get(nk) ?? Infinity)) {
        came.set(nk, cur)
        g.set(nk, ng)
        if (!open.includes(nk)) open.push(nk)
      }
    }
  }
  return null
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function randomField(rand: () => number, density: number): Tile[][] {
  const pick: Tile[] = ['taxi', 'stand', 'runway', 'road', 'hangar', 'terminal', 'fuel', 'bags']
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => (rand() < density ? pick[Math.floor(rand() * pick.length)] : 'grass')),
  )
}

describe('astar', () => {
  it('returns exactly the paths of the string-keyed reference', () => {
    const rand = rng(25)
    const kinds = ['jet', 'truck', 'person', 'mechanic'] as const
    let found = 0
    for (let field = 0; field < 24; field++) {
      const tiles = randomField(rand, 0.55 + rand() * 0.4)
      for (let q = 0; q < 30; q++) {
        const a = { c: Math.floor(rand() * SIZE), r: Math.floor(rand() * SIZE) }
        const b = { c: Math.floor(rand() * SIZE), r: Math.floor(rand() * SIZE) }
        const kind = kinds[q % kinds.length]
        const want = astarReference(tiles, a, b, kind)
        expect(astar(tiles, a, b, kind)).toEqual(want)
        if (want) found++
      }
    }
    // The sample must exercise real searches, not just unreachable pairs.
    expect(found).toBeGreaterThan(100)
  })

  it('handles out-of-bounds, same-cell and blocked ends', () => {
    const tiles = randomField(rng(3), 1)
    expect(astar(tiles, { c: -1, r: 0 }, { c: 2, r: 2 }, 'truck')).toBeNull()
    expect(astar(tiles, { c: 4, r: 4 }, { c: 4, r: 4 }, 'truck')).toEqual([{ c: 4, r: 4 }])
    tiles[0][0] = 'grass'
    expect(astar(tiles, { c: 0, r: 0 }, { c: 5, r: 5 }, 'truck')).toBeNull()
  })
})

describe('tilesOf', () => {
  it('matches a plain scan for single types and type lists', () => {
    const tiles = randomField(rng(7), 0.7)
    const scan = (types: Tile[]) => {
      const out: Vec[] = []
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (types.includes(tiles[r][c])) out.push({ c, r })
      return out
    }
    expect(tilesOf(tiles, 'stand')).toEqual(scan(['stand']))
    expect(tilesOf(tiles, ['fuel'])).toEqual(scan(['fuel']))
    expect(tilesOf(tiles, ['taxi', 'road'])).toEqual(scan(['taxi', 'road']))
    expect(tilesOf(tiles, [])).toEqual([])
  })
})
