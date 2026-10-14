/**
 * Runway obstacle clearance. Tunables live in catalog.ts.
 * A stamped strip keeps a shoulder beside each edge and a run past each
 * threshold. Buildings and stands are blocked there. Taxiways may cross.
 */
import { RUNWAY_CLEARANCE_END, RUNWAY_CLEARANCE_SIDE } from './catalog'
import { SIZE, type Tile, type Vec } from './types'

export interface RunwayBox {
  minC: number
  maxC: number
  minR: number
  maxR: number
  /** Long axis. */
  axis: 'h' | 'v'
  cells: Vec[]
}

export interface ClearanceRect {
  minC: number
  maxC: number
  minR: number
  maxR: number
}

export function runwayBoxes(tiles: Tile[][]): RunwayBox[] {
  const seen = new Set<string>()
  const out: RunwayBox[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const key = `${c},${r}`
      if (seen.has(key) || tiles[r]?.[c] !== 'runway') continue
      const cells: Vec[] = []
      const stack: Vec[] = [{ c, r }]
      seen.add(key)
      let minC = c
      let maxC = c
      let minR = r
      let maxR = r
      while (stack.length) {
        const p = stack.pop()!
        cells.push(p)
        minC = Math.min(minC, p.c)
        maxC = Math.max(maxC, p.c)
        minR = Math.min(minR, p.r)
        maxR = Math.max(maxR, p.r)
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nc = p.c + dc
          const nr = p.r + dr
          const nk = `${nc},${nr}`
          if (nc < 0 || nr < 0 || nc >= SIZE || nr >= SIZE || seen.has(nk)) continue
          if (tiles[nr][nc] !== 'runway') continue
          seen.add(nk)
          stack.push({ c: nc, r: nr })
        }
      }
      const cols = maxC - minC + 1
      const rows = maxR - minR + 1
      out.push({
        minC,
        maxC,
        minR,
        maxR,
        axis: cols >= rows ? 'h' : 'v',
        cells,
      })
    }
  }
  return out
}

export function clearanceRect(box: RunwayBox): ClearanceRect {
  if (box.axis === 'h') {
    return {
      minC: box.minC - RUNWAY_CLEARANCE_END,
      maxC: box.maxC + RUNWAY_CLEARANCE_END,
      minR: box.minR - RUNWAY_CLEARANCE_SIDE,
      maxR: box.maxR + RUNWAY_CLEARANCE_SIDE,
    }
  }
  return {
    minC: box.minC - RUNWAY_CLEARANCE_SIDE,
    maxC: box.maxC + RUNWAY_CLEARANCE_SIDE,
    minR: box.minR - RUNWAY_CLEARANCE_END,
    maxR: box.maxR + RUNWAY_CLEARANCE_END,
  }
}

function onPavement(box: RunwayBox, c: number, r: number): boolean {
  return c >= box.minC && c <= box.maxC && r >= box.minR && r <= box.maxR
}

/** Shoulder / threshold cells. The paved strip itself is not part of the zone. */
export function cellInRunwayClearance(tiles: Tile[][], c: number, r: number): boolean {
  for (const box of runwayBoxes(tiles)) {
    const rect = clearanceRect(box)
    if (c < rect.minC || c > rect.maxC || r < rect.minR || r > rect.maxR) continue
    if (!onPavement(box, c, r)) return true
  }
  return false
}

/** Gap, in cells, between two parallel strips. Null when they are not separated on one axis. */
export function runwayEdgeGap(a: RunwayBox, b: RunwayBox): number | null {
  const aWest = a.maxC < b.minC
  const bWest = b.maxC < a.minC
  if (aWest || bWest) return (aWest ? b.minC - a.maxC : a.minC - b.maxC) - 1
  const aNorth = a.maxR < b.minR
  const bNorth = b.maxR < a.minR
  if (aNorth || bNorth) return (aNorth ? b.minR - a.maxR : a.minR - b.maxR) - 1
  return null
}

const CLEARANCE_OK = new Set<Tile>(['grass', 'runway', 'taxi'])

/** Tiles that may not occupy a clearance shoulder. */
export function clearanceIntrusions(tiles: Tile[][]): Vec[] {
  const hits: Vec[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const tile = tiles[r][c]
      if (CLEARANCE_OK.has(tile)) continue
      if (cellInRunwayClearance(tiles, c, r)) hits.push({ c, r })
    }
  }
  return hits
}
