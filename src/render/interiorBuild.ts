/**
 * Meshes for a hall's interior edit. Reads the edit; does not change the sim.
 */
import * as THREE from 'three'
import { HALL_D, HALL_W } from '../game/terminal.ts'
import { BUILD_TUNING } from '../terminalbuild/config.ts'
import { dragRect, tileCenter, tilesInRect, wallRun } from '../terminalbuild/interior.ts'
import type { Edge, InteriorEdit, Rect, Room, RoomKind } from '../terminalbuild/types.ts'
import { interiorTexture, type InteriorTile } from './terminalProps/interiorTex.ts'

const TILE = BUILD_TUNING.tileMetres
const WALL_H = 2.6
const WALL_T = 0.18

const ROOM_TINT: Record<RoomKind, string> = {
  checkin: '#7eb6e0',
  security: '#c45c5c',
  gate: '#2f5f9a',
  bagmakeup: '#8a7048',
  retail: '#e0c04a',
  toilets: '#3a9a8a',
  lounge: '#c48a4a',
  office: '#8a7aaa',
}

function disposeGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child)
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
    const mat = mesh.material
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else mat?.dispose()
  }
}

function plate(id: string | undefined): THREE.Texture | null {
  if (!id) return null
  return interiorTexture(id as InteriorTile, [1, 1])
}

function wallPose(edge: Edge): { x: number; z: number; rot: number } {
  const c = tileCenter(edge.x, edge.y, TILE, HALL_W, HALL_D)
  if (edge.dir === 'E') return { x: c.x + TILE / 2, z: c.z, rot: 0 }
  return { x: c.x, z: c.z + TILE / 2, rot: Math.PI / 2 }
}

function addWall(group: THREE.Group, edge: Edge, paint: string | undefined, door: boolean) {
  const pose = wallPose(edge)
  const map = plate(paint)
  const mat = new THREE.MeshLambertMaterial({ map: map ?? undefined, color: map ? '#ffffff' : '#b7a48a' })
  if (door) {
    const jamb = TILE * 0.28
    for (const side of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(jamb, WALL_H, WALL_T), mat)
      const along = (TILE / 2 - jamb / 2) * side
      mesh.position.set(pose.rot === 0 ? pose.x : pose.x + along, WALL_H / 2, pose.rot === 0 ? pose.z + along : pose.z)
      group.add(mesh)
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.28, WALL_T), mat)
    lintel.position.set(pose.x, WALL_H - 0.14, pose.z)
    if (pose.rot) lintel.rotation.y = pose.rot
    group.add(lintel)
    return
  }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE, WALL_H, WALL_T), mat)
  mesh.position.set(pose.x, WALL_H / 2, pose.z)
  if (pose.rot) mesh.rotation.y = pose.rot
  group.add(mesh)
}

function paintOf(edit: InteriorEdit, edge: Edge): string | undefined {
  const key = `${edge.x},${edge.y},${edge.dir}`
  return edit.wallPaint.find((w) => `${w.x},${w.y},${w.dir}` === key)?.paint
}

/** Draw the player's foundation, walls, doors, floor paint, and room slabs. */
export function syncInteriorEdit(group: THREE.Group, edit: InteriorEdit | undefined, sig: string, last: { sig: string }): void {
  if (sig === last.sig) return
  last.sig = sig
  disposeGroup(group)
  if (!edit) return
  for (const t of edit.foundation ?? []) {
    if ((t.floor ?? 0) !== 0) continue
    const c = tileCenter(t.x, t.y, TILE, HALL_W, HALL_D)
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE - 0.04, TILE - 0.04),
      new THREE.MeshLambertMaterial({ color: '#9a958c' }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(c.x, 0.03, c.z)
    group.add(mesh)
  }
  for (const p of edit.floorPaint) {
    if ((p.floor ?? 0) !== 0) continue
    const c = tileCenter(p.x, p.y, TILE, HALL_W, HALL_D)
    const map = plate(p.paint)
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE - 0.06, TILE - 0.06),
      new THREE.MeshLambertMaterial({ map: map ?? undefined, color: map ? '#ffffff' : '#d9d3c7' }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(c.x, 0.12, c.z)
    group.add(mesh)
  }
  const doors = new Set(edit.doors.map((d) => `${d.x},${d.y},${d.dir}`))
  for (const wall of edit.walls) {
    if ((wall.floor ?? 0) !== 0) continue
    const key = `${wall.x},${wall.y},${wall.dir}`
    addWall(group, wall, wall.finish ?? paintOf(edit, wall), doors.has(key))
  }
  for (const door of edit.doors) {
    if ((door.floor ?? 0) !== 0) continue
    const key = `${door.x},${door.y},${door.dir}`
    if (edit.walls.some((w) => `${w.x},${w.y},${w.dir}` === key)) continue
    addWall(group, door, paintOf(edit, door), true)
  }
  for (const room of edit.rooms) {
    if ((room.floor ?? 0) !== 0) continue
    const origin = tileCenter(room.x, room.y, TILE, HALL_W, HALL_D)
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(room.w * TILE - 0.12, room.h * TILE - 0.12),
      new THREE.MeshBasicMaterial({
        color: ROOM_TINT[room.kind],
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(origin.x + ((room.w - 1) * TILE) / 2, 0.05, origin.z + ((room.h - 1) * TILE) / 2)
    group.add(mesh)
  }
}

export function interiorEditSig(edit: InteriorEdit | undefined): string {
  if (!edit) return ''
  const foundation = (edit.foundation ?? []).map((t) => `${t.x},${t.y}`).join('.')
  return `${edit.walls.length}|${edit.doors.length}|${edit.removed.length}|${edit.floorPaint.length}|${edit.wallPaint.length}|${foundation}|${edit.rooms.map((r) => `${r.id}:${r.x},${r.y},${r.w}x${r.h}`).join(';')}|${edit.equipment.length}|${edit.floorPaint.map((p) => p.paint).join(',')}|${edit.wallPaint.map((p) => p.paint).join(',')}`
}

/** Ghost for a drag that has not been paid for yet. */
export function syncInteriorGhost(
  group: THREE.Group,
  tool: 'wall' | 'floor' | 'wallpaper' | 'room' | 'door' | 'foundation' | null,
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | null,
): void {
  disposeGroup(group)
  if (!tool || !a || !b) return
  const mat = new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.45, depthWrite: false })
  if (tool === 'wall' || tool === 'wallpaper') {
    const edges = wallRun(a, b)
    for (const edge of edges) {
      const pose = wallPose(edge)
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.2, WALL_T), mat)
      mesh.position.set(pose.x, 0.12, pose.z)
      if (pose.rot) mesh.rotation.y = pose.rot
      group.add(mesh)
    }
    return
  }
  const rect: Rect = tool === 'room' ? dragRect(a, b) : dragRect(a, b)
  const tiles = tool === 'floor' || tool === 'room' || tool === 'foundation' ? tilesInRect(rect) : []
  for (const t of tiles) {
    const c = tileCenter(t.x, t.y, TILE, HALL_W, HALL_D)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(TILE - 0.1, TILE - 0.1), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(c.x, 0.08, c.z)
    group.add(mesh)
  }
}

export function roomContains(room: Room, t: { x: number; y: number }): boolean {
  return t.x >= room.x && t.y >= room.y && t.x < room.x + room.w && t.y < room.y + room.h
}
