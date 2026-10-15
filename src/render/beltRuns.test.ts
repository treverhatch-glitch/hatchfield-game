import { describe, expect, it } from 'vitest'
import type { Tile } from '../game/types.ts'
import { deckSides } from './beltDeck.ts'
import { alongRun, bagsPerRun, beltArms, beltRuns, type BeltCell } from './beltRuns.ts'

function grid(belts: [number, number][]): Tile[][] {
  const tiles: Tile[][] = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 'grass' as Tile))
  for (const [c, r] of belts) tiles[r][c] = 'belt'
  return tiles
}

/** The two starter runs: stand (11,6) to the hall, and the sort to the south stand. */
const STARTER: [number, number][] = [
  [11, 7], [11, 8], [12, 8], [13, 8],
  [12, 12], [13, 12], [13, 11], [13, 10],
]

function adjacent(a: BeltCell, b: BeltCell): boolean {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1
}

describe('belt runs', () => {
  it('splits the starter belts into two runs, end to end', () => {
    const runs = beltRuns(grid(STARTER))
    expect(runs).toEqual([
      [{ c: 11, r: 7 }, { c: 11, r: 8 }, { c: 12, r: 8 }, { c: 13, r: 8 }],
      [{ c: 13, r: 10 }, { c: 13, r: 11 }, { c: 13, r: 12 }, { c: 12, r: 12 }],
    ])
  })

  it('keeps every bag on a belt cell and never crosses the gap between (13,8) and (13,10)', () => {
    const tiles = grid(STARTER)
    const runs = beltRuns(tiles)
    const share = bagsPerRun(runs.map((run) => run.length - 1), 8)
    expect(share).toEqual([4, 4])
    for (const run of runs) {
      const points = run.map((p) => ({ x: p.c, z: p.r }))
      for (let i = 0; i <= 200; i++) {
        const at = alongRun(points, i / 200)
        const cell = { c: Math.round(at.x), r: Math.round(at.z) }
        expect(tiles[cell.r][cell.c]).toBe('belt')
        expect(cell.c === 13 && cell.r === 9).toBe(false)
      }
    }
  })

  it('turns a junction into runs that only step between neighbouring belt cells', () => {
    const tee: [number, number][] = [[4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [6, 5], [6, 6], [6, 7]]
    const runs = beltRuns(grid(tee))
    const covered = new Set(runs.flat().map((p) => `${p.c},${p.r}`))
    expect(covered.size).toBe(tee.length)
    for (const run of runs) {
      for (let i = 1; i < run.length; i++) expect(adjacent(run[i - 1], run[i])).toBe(true)
    }
  })

  it('gives a lone belt cell its own one-cell run', () => {
    expect(beltRuns(grid([[3, 3]]))).toEqual([[{ c: 3, r: 3 }]])
    expect(beltRuns(grid([]))).toEqual([])
  })

  it('splits bags by run length, one per run first', () => {
    expect(bagsPerRun([3, 1], 8).reduce((n, k) => n + k, 0)).toBe(8)
    expect(Math.min(...bagsPerRun([3, 1], 8))).toBeGreaterThanOrEqual(1)
    expect(bagsPerRun([6, 2], 8)).toEqual([6, 2])
    expect(bagsPerRun([1, 1, 1], 2)).toEqual([1, 1, 0])
    expect(bagsPerRun([], 8)).toEqual([])
  })
})

describe('belt deck', () => {
  it('runs the deck along the belt, including north-south runs and bends', () => {
    const tiles = grid(STARTER)
    expect(deckSides(beltArms(tiles, 11, 7)).sort()).toEqual(['n', 's'])
    expect(deckSides(beltArms(tiles, 11, 8)).sort()).toEqual(['e', 'n'])
    expect(deckSides(beltArms(tiles, 12, 8)).sort()).toEqual(['e', 'w'])
    expect(deckSides(beltArms(tiles, 13, 11)).sort()).toEqual(['n', 's'])
    expect(deckSides(undefined).sort()).toEqual(['e', 'w'])
  })
})
