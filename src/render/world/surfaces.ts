/**
 * Merged ground meshes: one draw call per surface type, world-space UVs so textures
 * flow across tiles, vertex-colour macro variation so tiling doesn't read.
 */
import * as THREE from 'three'
import type { Tile, Vec } from '../../game/types'
import type { Paint, PaintColor } from './layout'
import { GROUND_LOOK } from '../look'
import { fbm } from './raster'
import { CELL, cellX, cellZ, type WorldView } from './view'

export type SurfaceKind = 'grass' | 'runway' | 'taxi' | 'apron' | 'road' | 'pad'

export function surfaceOf(tile: Tile): SurfaceKind | null {
  switch (tile) {
    case 'grass':
      return 'grass'
    case 'runway':
      return 'runway'
    case 'taxi':
      return 'taxi'
    case 'stand':
      return 'apron'
    case 'road':
    case 'guard':
      return 'road'
    case 'terminal':
      return null
    default:
      return 'pad'
  }
}

export function surfaceCells(view: WorldView): Record<SurfaceKind, Vec[]> {
  const out: Record<SurfaceKind, Vec[]> = { grass: [], runway: [], taxi: [], apron: [], road: [], pad: [] }
  for (let r = 0; r < view.tiles.length; r++) {
    for (let c = 0; c < view.tiles[r].length; c++) {
      const k = surfaceOf(view.tiles[r][c])
      if (k) out[k].push({ c, r })
    }
  }
  return out
}

/**
 * One quad per cell (subdivided `sub`×`sub` for smoother vertex-colour variation),
 * UV = world / uvSize.
 */
export function quadsGeometry(
  cells: readonly Vec[],
  opts: { y?: number; uvSize?: number; sub?: number; macro?: number; seed?: number; inset?: number } = {},
): THREE.BufferGeometry {
  const y = opts.y ?? 0
  const uv = opts.uvSize ?? CELL
  const sub = Math.max(1, opts.sub ?? 1)
  const macro = opts.macro ?? 0
  const seed = opts.seed ?? 1
  const inset = opts.inset ?? 0
  const vpc = (sub + 1) * (sub + 1)
  const pos = new Float32Array(cells.length * vpc * 3)
  const uvs = new Float32Array(cells.length * vpc * 2)
  const col = new Float32Array(cells.length * vpc * 3)
  const idx: number[] = []
  let v = 0
  const size = CELL - inset * 2
  for (const cell of cells) {
    const x0 = cellX(cell.c) - size / 2
    const z0 = cellZ(cell.r) - size / 2
    const base = v
    for (let j = 0; j <= sub; j++) {
      for (let i = 0; i <= sub; i++) {
        const x = x0 + (i / sub) * size
        const z = z0 + (j / sub) * size
        pos[v * 3] = x
        pos[v * 3 + 1] = y
        pos[v * 3 + 2] = z
        uvs[v * 2] = x / uv
        uvs[v * 2 + 1] = z / uv
        const n = macro ? fbm(x / 160 + 0.5, z / 160 + 0.5, 3, 3, seed) : 0.5
        const k = 1 - macro + macro * 2 * n
        col[v * 3] = k
        col[v * 3 + 1] = k
        col[v * 3 + 2] = k
        v++
      }
    }
    for (let j = 0; j < sub; j++) {
      for (let i = 0; i < sub; i++) {
        const a = base + j * (sub + 1) + i
        const b = a + 1
        const c = a + sub + 1
        const d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // Normals of a flat grid are +y; computeVertexNormals keeps it exact.
  g.computeBoundingSphere()
  return g
}

/** Axis-aligned concrete pads (stand limit boxes) sharing the apron material. */
export function rectsGeometry(
  rects: readonly { x: number; z: number; w: number; d: number }[],
  y = 0.02,
  uvSize = 6.2,
): THREE.BufferGeometry {
  const pos = new Float32Array(rects.length * 4 * 3)
  const uvs = new Float32Array(rects.length * 4 * 2)
  const col = new Float32Array(rects.length * 4 * 3)
  const idx: number[] = []
  rects.forEach((rect, n) => {
    const x0 = rect.x - rect.w / 2
    const z0 = rect.z - rect.d / 2
    const corners: [number, number][] = [
      [x0, z0],
      [x0 + rect.w, z0],
      [x0 + rect.w, z0 + rect.d],
      [x0, z0 + rect.d],
    ]
    const base = n * 4
    corners.forEach(([x, z], i) => {
      const v = base + i
      pos[v * 3] = x
      pos[v * 3 + 1] = y
      pos[v * 3 + 2] = z
      uvs[v * 2] = x / uvSize
      uvs[v * 2 + 1] = z / uvSize
      col[v * 3] = 1
      col[v * 3 + 1] = 1
      col[v * 3 + 2] = 1
    })
    idx.push(base, base + 3, base + 1, base + 1, base + 3, base + 2)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

export const PAINT_RGB: Record<PaintColor, number> = {
  white: 0xf2f4f6,
  yellow: 0xf2c230,
  red: 0xd0402e,
  black: 0x1c1e22,
  S: 0x6aae7a,
  M: 0xc9a227,
  L: 0xc97816,
}

/** Paint rectangles → one vertex-coloured mesh, with world UVs for the paint plate. */
export function paintGeometry(list: readonly Paint[], y = 0.035, tile = GROUND_LOOK.paintTile): THREE.BufferGeometry {
  const pos = new Float32Array(list.length * 4 * 3)
  const col = new Float32Array(list.length * 4 * 3)
  const nor = new Float32Array(list.length * 4 * 3)
  const uvs = new Float32Array(list.length * 4 * 2)
  const idx: number[] = []
  const c = new THREE.Color()
  const span = tile > 0 ? tile : 1
  list.forEach((p, i) => {
    c.setHex(PAINT_RGB[p.color], THREE.SRGBColorSpace)
    c.multiplyScalar(1.15)
    const corners = [
      [p.x - p.w / 2, p.z - p.d / 2],
      [p.x + p.w / 2, p.z - p.d / 2],
      [p.x - p.w / 2, p.z + p.d / 2],
      [p.x + p.w / 2, p.z + p.d / 2],
    ]
    // Stack later paint slightly higher so plates sit on top of envelopes.
    const yy = y + (p.color === 'S' || p.color === 'M' || p.color === 'L' ? 0.004 : 0)
    corners.forEach(([x, z], k) => {
      const o = (i * 4 + k) * 3
      pos[o] = x
      pos[o + 1] = yy
      pos[o + 2] = z
      col[o] = c.r
      col[o + 1] = c.g
      col[o + 2] = c.b
      nor[o + 1] = 1
      uvs[(i * 4 + k) * 2] = x / span
      uvs[(i * 4 + k) * 2 + 1] = z / span
    })
    const b = i * 4
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

/** One merged kerb mesh. Each segment is a low box sitting on the road edge. */
export function kerbGeometry(list: readonly { x: number; z: number; w: number; d: number }[]): THREE.BufferGeometry {
  const h = GROUND_LOOK.kerbH
  const y0 = 0.02
  const pos = new Float32Array(list.length * 24 * 3)
  const nor = new Float32Array(list.length * 24 * 3)
  const col = new Float32Array(list.length * 24 * 3)
  const idx: number[] = []
  const tint = new THREE.Color(GROUND_LOOK.kerb)
  const faces: number[][] = [
    [0, 1, 2, 0, 2, 3],
    [4, 6, 5, 4, 7, 6],
    [0, 4, 5, 0, 5, 1],
    [1, 5, 6, 1, 6, 2],
    [2, 6, 7, 2, 7, 3],
    [3, 7, 4, 3, 4, 0],
  ]
  const normals: [number, number, number][] = [
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, -1],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ]
  list.forEach((seg, n) => {
    const x0 = seg.x - seg.w / 2
    const x1 = seg.x + seg.w / 2
    const z0 = seg.z - seg.d / 2
    const z1 = seg.z + seg.d / 2
    const corners: [number, number, number][] = [
      [x0, y0 + h, z0],
      [x1, y0 + h, z0],
      [x1, y0 + h, z1],
      [x0, y0 + h, z1],
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ]
    const base = n * 24
    faces.forEach((face, f) => {
      const normal = normals[f]
      face.forEach((corner, k) => {
        const v = base + f * 4 + k
        const p = corners[corner]
        pos[v * 3] = p[0]
        pos[v * 3 + 1] = p[1]
        pos[v * 3 + 2] = p[2]
        nor[v * 3] = normal[0]
        nor[v * 3 + 1] = normal[1]
        nor[v * 3 + 2] = normal[2]
        col[v * 3] = tint.r
        col[v * 3 + 1] = tint.g
        col[v * 3 + 2] = tint.b
      })
      const b = base + f * 4
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
    })
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}
