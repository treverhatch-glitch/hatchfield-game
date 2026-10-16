/**
 * Bag-sort yaw. The mesh's vehicle bays face local +Z. This turns that face
 * toward the apron (stands, taxi, belts), and ignores a side road.
 */
import type { Tile } from '../../game/types.ts'

const DIRS = [
  // Three.js Y rotation sends local +Z to (sin θ, cos θ). +π/2 is east, −π/2 is west.
  { dir: 'e' as const, dc: 1, dr: 0, yaw: Math.PI / 2 },
  { dir: 'w' as const, dc: -1, dr: 0, yaw: -Math.PI / 2 },
  { dir: 's' as const, dc: 0, dr: 1, yaw: 0 },
  { dir: 'n' as const, dc: 0, dr: -1, yaw: Math.PI },
]

function apronWeight(tile: Tile | undefined): number {
  if (tile === 'stand') return 4
  if (tile === 'taxi' || tile === 'runway') return 2
  if (tile === 'belt') return 1
  return 0
}

/** Radians. 0 keeps +Z (the bays) pointing south. */
export function bagSortYaw(tiles: readonly (readonly Tile[])[], c: number, r: number): number {
  const score = { n: 0, e: 0, s: 0, w: 0 }
  for (let rr = r - 8; rr <= r + 8; rr++) {
    const row = tiles[rr]
    if (!row) continue
    for (let cc = c - 8; cc <= c + 8; cc++) {
      const w = apronWeight(row[cc])
      if (!w) continue
      const dc = cc - c
      const dr = rr - r
      if (dc === 0 && dr === 0) continue
      if (Math.abs(dc) >= Math.abs(dr)) score[dc > 0 ? 'e' : 'w'] += w
      else score[dr > 0 ? 's' : 'n'] += w
    }
  }
  let best: (typeof DIRS)[number] | null = null
  for (const d of DIRS) {
    if (!best || score[d.dir] > score[best.dir]) best = d
  }
  if (best && score[best.dir] > 0) return best.yaw
  for (const d of DIRS) {
    const tile = tiles[r + d.dr]?.[c + d.dc]
    if (tile === 'road' || tile === 'guard') return d.yaw
  }
  return 0
}
