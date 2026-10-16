/**
 * Floors, walls, doors and glazing read from the layout.
 * One metre is one unit. Nothing here is scaled away from 1.
 * Wall tops stay under the 1-story roof so the hall camera can see the floor.
 */
import * as THREE from 'three'
import { layoutTileM } from '../../terminalbuild/config.ts'
import { CLEAR_H_GROUND_M, DOOR_H_M, roofHeightM } from '../../terminalbuild/scale.ts'
import type { BuildLayout, Door, Edge } from '../../terminalbuild/types.ts'

const WALL_T = 0.18
const WALL_H = CLEAR_H_GROUND_M

const ZONE_TINT: Record<string, string> = {
  landside: '#f7f4ee',
  checkin: '#f4f1ea',
  security: '#f2dca6',
  airside: '#e7eef6',
  gates: '#e2e6ea',
  retail: '#f1d3bc',
  office: '#e6e2da',
  claim: '#e4eef2',
  arrivals: '#e4eef2',
  baggage: '#e6e0d4',
  bagroom: '#e6e0d4',
  vertical: '#dedede',
}

function edgeKey(e: Edge): string {
  return `${e.x},${e.y},${e.dir}`
}

function origin(layout: BuildLayout): { ox: number; oz: number; tile: number } {
  const tile = layoutTileM(layout)
  return { ox: (-layout.w * tile) / 2, oz: (-layout.h * tile) / 2, tile }
}

function exterior(layout: BuildLayout, e: Edge): boolean {
  if (e.dir === 'E' && (e.x < 0 || e.x >= layout.w - 1)) return true
  if (e.dir === 'S' && (e.y < 0 || e.y >= layout.h - 1)) return true
  return false
}

interface Run {
  dir: 'E' | 'S'
  x: number
  y: number
  n: number
  glass: boolean
}

/** Join collinear wall edges so a 1 m hall is not one mesh per metre. */
function runsOf(layout: BuildLayout, edges: readonly Edge[], glass: boolean): Run[] {
  const groups = new Map<string, number[]>()
  for (const e of edges) {
    if ((e.floor ?? 0) !== 0) continue
    if (exterior(layout, e) !== glass) continue
    const key = e.dir === 'E' ? `E:${e.x}` : `S:${e.y}`
    const along = e.dir === 'E' ? e.y : e.x
    const list = groups.get(key)
    if (list) list.push(along)
    else groups.set(key, [along])
  }
  const out: Run[] = []
  for (const [key, list] of groups) {
    list.sort((a, b) => a - b)
    const dir = key.startsWith('E') ? 'E' : 'S'
    const fixed = Number(key.slice(2))
    let start = list[0]
    let prev = list[0]
    const flush = (from: number, to: number) => {
      const n = to - from + 1
      if (n <= 0) return
      if (dir === 'E') out.push({ dir, x: fixed, y: from, n, glass })
      else out.push({ dir, x: from, y: fixed, n, glass })
    }
    for (let i = 1; i < list.length; i++) {
      if (list[i] === prev + 1) prev = list[i]
      else {
        flush(start, prev)
        start = prev = list[i]
      }
    }
    flush(start, prev)
  }
  return out
}

function addRun(group: THREE.Group, layout: BuildLayout, run: Run, mat: THREE.Material) {
  const { ox, oz, tile } = origin(layout)
  const len = run.n * tile
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(run.dir === 'E' ? WALL_T : len, WALL_H, run.dir === 'E' ? len : WALL_T), mat)
  if (run.dir === 'E') {
    mesh.position.set(ox + (run.x + 1) * tile, WALL_H / 2, oz + (run.y + run.n / 2) * tile)
  } else {
    mesh.position.set(ox + (run.x + run.n / 2) * tile, WALL_H / 2, oz + (run.y + 1) * tile)
  }
  mesh.name = run.glass ? 'hall-glazing' : 'hall-wall'
  mesh.userData.piece = 'wall'
  mesh.castShadow = !run.glass
  mesh.receiveShadow = true
  group.add(mesh)
}

function addDoor(group: THREE.Group, layout: BuildLayout, door: Door, glass: THREE.Material, frame: THREE.Material) {
  const { ox, oz, tile } = origin(layout)
  const h = Math.min(DOOR_H_M, WALL_H - 0.2)
  const along = door.dir === 'E'
  const cx = along ? ox + (door.x + 1) * tile : ox + (door.x + 0.5) * tile
  const cz = along ? oz + (door.y + 0.5) * tile : oz + (door.y + 1) * tile
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.04 : tile * 0.72, h, along ? tile * 0.72 : 0.04), glass)
  leaf.position.set(cx, h / 2, cz)
  leaf.name = 'hall-door'
  leaf.userData.piece = 'door'
  leaf.userData.doorKind = door.kind
  group.add(leaf)
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(along ? WALL_T : tile, WALL_H - h, along ? tile : WALL_T),
    frame,
  )
  lintel.position.set(cx, h + (WALL_H - h) / 2, cz)
  lintel.name = 'hall-door-lintel'
  lintel.userData.piece = 'door'
  group.add(lintel)
}

function addFloor(group: THREE.Group, layout: BuildLayout) {
  const { ox, oz, tile } = origin(layout)
  const step = 4
  const geos: THREE.BufferGeometry[] = []
  const positions: number[] = []
  const colors: number[] = []
  const tint = new THREE.Color()
  for (let y = 0; y < layout.h; y += step) {
    for (let x = 0; x < layout.w; x += step) {
      if (!layout.floor[y]?.[x]) continue
      const zone = layout.zones[y]?.[x] ?? 'landside'
      tint.set(ZONE_TINT[zone] ?? '#f7f4ee')
      const w = Math.min(step, layout.w - x) * tile
      const d = Math.min(step, layout.h - y) * tile
      const cx = ox + x * tile + w / 2
      const cz = oz + y * tile + d / 2
      const geo = new THREE.PlaneGeometry(w - 0.02, d - 0.02)
      geo.rotateX(-Math.PI / 2)
      geo.translate(cx, 0.02, cz)
      geos.push(geo)
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
        colors.push(tint.r, tint.g, tint.b)
      }
    }
  }
  for (const geo of geos) geo.dispose()
  if (!positions.length) return
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  merged.computeVertexNormals()
  const floor = new THREE.Mesh(
    merged,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  )
  floor.name = 'hall-floor'
  floor.userData.piece = 'floor'
  floor.receiveShadow = true
  group.add(floor)
}

/** Shell meshes for one layout. The caller parents them under hall-root. */
export function buildLayoutShell(layout: BuildLayout): THREE.Group {
  const group = new THREE.Group()
  group.name = 'hall-shell'
  addFloor(group, layout)
  const doors = new Set((layout.doors ?? []).filter((d) => (d.floor ?? 0) === 0).map(edgeKey))
  const walls = (layout.walls ?? []).filter((e) => (e.floor ?? 0) === 0 && !doors.has(edgeKey(e)))
  const plaster = new THREE.MeshLambertMaterial({ color: '#e7e4dc' })
  const glass = new THREE.MeshLambertMaterial({
    color: '#c5e4ee',
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  })
  const frame = new THREE.MeshLambertMaterial({ color: '#d5d0c6' })
  for (const run of runsOf(layout, walls, false)) addRun(group, layout, run, plaster)
  for (const run of runsOf(layout, walls, true)) addRun(group, layout, run, glass)
  for (const door of layout.doors ?? []) {
    if ((door.floor ?? 0) !== 0) continue
    addDoor(group, layout, door, glass, frame)
  }
  group.userData.roofM = roofHeightM(layout.stories ?? 1)
  return group
}

/** Highest vertex in the shell, for the roof-height audit. */
export function shellTopM(group: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(group)
  return box.max.y
}
