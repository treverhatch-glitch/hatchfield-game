import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { Tile } from '../game/types.ts'
import { CELL } from './aircraft/specs.ts'
import { addBeltDeck, beltArmRange, BELT_SURFACE_Y, deckSides } from './beltDeck.ts'
import { alongRun, bagsPerRun, beltArms, beltRuns, type BeltCell } from './beltRuns.ts'

function grid(belts: [number, number][]): Tile[][] {
  const tiles: Tile[][] = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 'grass' as Tile))
  for (const [c, r] of belts) tiles[r][c] = 'belt'
  return tiles
}

/** The starter belt: one run beside the sort, from the north stand to the south stand. */
const STARTER: [number, number][] = [
  [11, 7], [11, 8], [12, 8], [12, 9], [12, 10], [12, 11], [12, 12],
]

function adjacent(a: BeltCell, b: BeltCell): boolean {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1
}

describe('belt runs', () => {
  it('walks the starter belt in one run from the north stand to the south stand', () => {
    const runs = beltRuns(grid(STARTER))
    expect(runs).toEqual([[
      { c: 11, r: 7 },
      { c: 11, r: 8 },
      { c: 12, r: 8 },
      { c: 12, r: 9 },
      { c: 12, r: 10 },
      { c: 12, r: 11 },
      { c: 12, r: 12 },
    ]])
  })

  it('reaches the deck into the sort building and keeps suitcases on belt cells', () => {
    const tiles = grid(STARTER)
    tiles[9][13] = 'bags'
    expect(beltArms(tiles, 12, 9).e).toBe(true)
    const runs = beltRuns(tiles)
    const share = bagsPerRun(runs.map((run) => run.length - 1), 8)
    expect(share).toEqual([8])
    for (const run of runs) {
      const points = run.map((p) => ({ x: p.c, z: p.r }))
      for (let i = 0; i <= 200; i++) {
        const at = alongRun(points, i / 200)
        const cell = { c: Math.round(at.x), r: Math.round(at.z) }
        expect(tiles[cell.r][cell.c], `${cell.c},${cell.r}`).toBe('belt')
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
  function worldBoxes(arms: Parameters<typeof addBeltDeck>[1]) {
    const g = new THREE.Group()
    addBeltDeck(g, arms)
    g.updateMatrixWorld(true)
    const boxes: { kind: string; box: THREE.Box3 }[] = []
    g.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry.computeBoundingBox()
      const box = mesh.geometry.boundingBox!.clone()
      box.applyMatrix4(mesh.matrixWorld)
      const kind = mesh.name === 'belt-deck' ? 'deck' : mesh.name === 'belt-rail' ? 'rail' : 'roller'
      boxes.push({ kind, box })
    })
    return boxes
  }

  it('meets the next straight cell so a bag does not cross a dark gap', () => {
    const span = beltArmRange(false)
    expect(span.from).toBe(0)
    expect(CELL - span.to * 2).toBeLessThanOrEqual(0)
    const a = worldBoxes({ e: true, w: true, n: false, s: false })
    const b = worldBoxes({ e: true, w: true, n: false, s: false })
    for (const row of b) row.box.translate(new THREE.Vector3(CELL, 0, 0))
    const east = a.filter((row) => row.kind === 'deck').sort((p, q) => q.box.max.x - p.box.max.x)[0]
    const west = b.filter((row) => row.kind === 'deck').sort((p, q) => p.box.min.x - q.box.min.x)[0]
    expect(west.box.min.x - east.box.max.x).toBeLessThanOrEqual(-0.4)
  })

  it('keeps the visible deck above the rollers at the bag surface', () => {
    const boxes = worldBoxes({ e: true, w: true, n: false, s: false })
    const decks = boxes.filter((row) => row.kind === 'deck')
    const rollers = boxes.filter((row) => row.kind === 'roller')
    expect(decks.length).toBeGreaterThan(0)
    expect(rollers.length).toBeGreaterThan(0)
    for (const deck of decks) {
      expect(deck.box.max.y).toBeCloseTo(BELT_SURFACE_Y, 2)
      expect(deck.box.max.y - deck.box.min.y).toBeGreaterThan(0.1)
    }
    for (const roller of rollers) expect(roller.box.max.y).toBeLessThan(decks[0].box.min.y)
  })

  it('keeps bend rails on their own arm instead of crossing into an X', () => {
    const bend = beltArmRange(true)
    const halfW = (CELL * 0.42) / 2
    expect(bend.from).toBeGreaterThanOrEqual(halfW - 1e-6)
    expect(bend.to).toBe(beltArmRange(false).to)
    const boxes = worldBoxes({ e: true, w: false, n: true, s: false })
    const rails = boxes.filter((row) => row.kind === 'rail')
    const decks = boxes.filter((row) => row.kind === 'deck')
    expect(rails.length).toBe(4)
    const along = (box: THREE.Box3) => {
      const size = new THREE.Vector3()
      box.getSize(size)
      return size.x >= size.z ? 'x' : 'z'
    }
    let crossed = 0
    for (const rail of rails) {
      for (const deck of decks) {
        if (along(rail.box) === along(deck.box)) continue
        const hit = rail.box.clone().intersect(deck.box)
        if (hit.isEmpty()) continue
        const size = new THREE.Vector3()
        hit.getSize(size)
        if (Math.min(size.x, size.z) > 0.08) crossed += 1
      }
    }
    expect(crossed).toBe(0)
    let joined = 0
    for (let i = 0; i < rails.length; i++) {
      for (let j = i + 1; j < rails.length; j++) {
        if (!rails[i].box.clone().intersect(rails[j].box).isEmpty()) joined += 1
      }
    }
    expect(joined).toBe(1)
  })

  it('runs the deck along the belt, including north-south runs and bends', () => {
    const tiles = grid(STARTER)
    expect(deckSides(beltArms(tiles, 11, 7)).sort()).toEqual(['n', 's'])
    expect(deckSides(beltArms(tiles, 11, 8)).sort()).toEqual(['e', 'n'])
    expect(deckSides(beltArms(tiles, 12, 8)).sort()).toEqual(['s', 'w'])
    expect(deckSides(beltArms(tiles, 12, 9)).sort()).toEqual(['n', 's'])
    expect(deckSides(undefined).sort()).toEqual(['e', 'w'])
  })
})
