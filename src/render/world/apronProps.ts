/**
 * Landside benches and bins, and the geometries the airfield dresses with.
 * Placement is derived from the terminal footprint. Nothing here is simulated.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PROP_LOOK } from '../look'
import { WORLD_PER_METER } from '../aircraft/specs'
import { DIR_VEC, terminals, type Dir } from './layout'
import { trs } from './kit'
import { CELL, cellX, cellZ, type WorldView } from './view'

const M = WORLD_PER_METER

function paintedBox(w: number, h: number, d: number, x: number, y: number, z: number, hex: string): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  const n = g.getAttribute('position').count
  const c = new THREE.Color(hex)
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

function mergePaint(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false)
  if (!merged) throw new Error('apron prop merge failed')
  for (const p of parts) p.dispose()
  return merged
}

/** Timber slat bench, 1.8 m long, facing local +Z. */
export function benchGeometry(): THREE.BufferGeometry {
  const wood = PROP_LOOK.benchWood
  const steel = PROP_LOOK.benchSteel
  const parts: THREE.BufferGeometry[] = []
  const len = 1.8 * M
  const legX = len * 0.38
  for (const x of [-legX, legX]) {
    parts.push(paintedBox(0.04 * M, 0.42 * M, 0.04 * M, x, 0.21 * M, 0.18 * M, steel))
    parts.push(paintedBox(0.04 * M, 0.78 * M, 0.04 * M, x, 0.39 * M, -0.22 * M, steel))
    parts.push(paintedBox(0.04 * M, 0.04 * M, 0.42 * M, x, 0.08 * M, 0, steel))
  }
  parts.push(paintedBox(len, 0.04 * M, 0.04 * M, 0, 0.44 * M, 0.18 * M, steel))
  for (let i = 0; i < 4; i++) {
    const z = 0.02 * M + i * 0.1 * M
    parts.push(paintedBox(len * 0.92, 0.025 * M, 0.07 * M, 0, 0.48 * M, z, wood))
  }
  for (let i = 0; i < 3; i++) {
    const y = 0.58 * M + i * 0.1 * M
    parts.push(paintedBox(len * 0.92, 0.06 * M, 0.025 * M, 0, y, -0.22 * M, wood))
  }
  return mergePaint(parts)
}

/** Square litter bin with a lid and a coloured band. About 0.95 m tall. */
export function binGeometry(): THREE.BufferGeometry {
  const body = PROP_LOOK.bin
  const band = PROP_LOOK.binBand
  const steel = PROP_LOOK.benchSteel
  const s = 0.42 * M
  return mergePaint([
    paintedBox(s, 0.78 * M, s, 0, 0.39 * M, 0, body),
    paintedBox(s * 1.04, 0.08 * M, s * 1.04, 0, 0.72 * M, 0, band),
    paintedBox(s * 1.08, 0.06 * M, s * 1.08, 0, 0.82 * M, 0, steel),
    paintedBox(s * 0.7, 0.04 * M, s * 0.16, 0, 0.5 * M, s * 0.52, steel),
  ])
}

export interface CurbFurniture {
  benches: THREE.Matrix4[]
  bins: THREE.Matrix4[]
}

/**
 * One bench or bin on each landside terminal edge, just outside the wall.
 * Airside edges stay clear for the jet bridges.
 */
export function curbFurniture(view: WorldView): CurbFurniture {
  const benches: THREE.Matrix4[] = []
  const bins: THREE.Matrix4[] = []
  let n = 0
  for (const term of terminals(view)) {
    for (const edge of term.edges) {
      if (edge.side === term.airside) continue
      const out = DIR_VEC[edge.side]
      const x = cellX(edge.c) + out.dc * (CELL * 0.5 + 0.7)
      const z = cellZ(edge.r) + out.dr * (CELL * 0.5 + 0.7)
      const yaw = Math.atan2(out.dc, out.dr)
      const slot = n % 2 === 0 ? benches : bins
      slot.push(trs(x, 0, z, yaw))
      n++
    }
  }
  return { benches, bins }
}

/** Yaw that points a +Z-facing prop along `dir`. Exported for the placement test. */
export function yawFor(dir: Dir): number {
  const v = DIR_VEC[dir]
  return Math.atan2(v.dc, v.dr)
}
