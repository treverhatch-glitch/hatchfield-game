/**
 * Static room batching for the terminal interior.
 * Signs share one atlas and one instanced plane. Desks are instanced so a
 * room outside the camera can drop out without rebuilding the building.
 * Wall boxes are baked separately (see TerminalBuilding).
 */
import * as THREE from 'three'
import { trs } from './kit'
import type { RoomPlan } from './rooms'
import { squareCenter } from './rooms'

export const DESK_KINDS = new Set(['counter', 'monitor', 'podium'])

const ATLAS_MAX = 2048

export interface SignStamp {
  text: string
  bg: string
  fg: string
  w: number
  h: number
  x: number
  y: number
  z: number
  yaw: number
  /** Owning room, or -1 for a shell sign that is always drawn. */
  room: number
}

export interface SignInstance {
  matrix: THREE.Matrix4
  uv: [number, number, number, number]
  room: number
  bg: string
}

export interface PackedSigns {
  texture: THREE.Texture | null
  instances: SignInstance[]
}

export interface RoomSphere {
  id: number
  x: number
  y: number
  z: number
  radius: number
}

export function roomSpheres(plan: RoomPlan, y: number): RoomSphere[] {
  return plan.rooms.map((room) => {
    let radius = plan.size
    for (const s of room.squares) {
      const c = squareCenter(plan, s)
      radius = Math.max(radius, Math.hypot(c.x - room.x, c.z - room.z))
    }
    return { id: room.id, x: room.x, y, z: room.z, radius: radius + plan.size * 0.5 }
  })
}

/**
 * Rooms whose sphere misses the frustum. An empty set means draw everything.
 * If the test would hide every room, draw everything — the camera matrix is
 * not ready yet, and a blank terminal is worse than a cheap extra draw.
 */
export function hiddenRooms(
  rooms: readonly RoomSphere[],
  matrixWorld: THREE.Matrix4,
  frustum: THREE.Frustum,
): Set<number> {
  if (!rooms.length) return new Set()
  const center = new THREE.Vector3()
  const sphere = new THREE.Sphere()
  const scale = new THREE.Vector3().setFromMatrixScale(matrixWorld)
  const s = Math.max(scale.x, scale.y, scale.z, 1e-4)
  const hidden = new Set<number>()
  for (const room of rooms) {
    center.set(room.x, room.y, room.z).applyMatrix4(matrixWorld)
    sphere.center.copy(center)
    sphere.radius = room.radius * s
    if (!frustum.intersectsSphere(sphere)) hidden.add(room.id)
  }
  if (hidden.size >= rooms.length) hidden.clear()
  return hidden
}

export function hiddenKey(hidden: ReadonlySet<number>): string {
  if (!hidden.size) return ''
  return [...hidden].sort((a, b) => a - b).join(',')
}

/** Keep shell signs (room < 0) and signs in rooms the camera can see. */
export function visibleInstances<T extends { room: number }>(items: readonly T[], hidden: ReadonlySet<number>): T[] {
  if (!hidden.size) return items as T[]
  return items.filter((item) => item.room < 0 || !hidden.has(item.room))
}

function signPixels(stamp: SignStamp): { pw: number; ph: number } {
  const pw = 512
  const ph = Math.max(16, Math.round((512 * stamp.h) / Math.max(0.01, stamp.w)))
  return { pw, ph }
}

function paintSign(stamp: SignStamp, pw: number, ph: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = pw
  canvas.height = ph
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = stamp.bg
  ctx.fillRect(0, 0, pw, ph)
  ctx.fillStyle = stamp.fg
  ctx.font = `600 ${Math.round(ph * 0.56)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(stamp.text, pw / 2, ph / 2 + 2)
  return canvas
}

/** One atlas for every stamp. Duplicate labels share a cell. No document → flat colour. */
export function packSigns(stamps: readonly SignStamp[]): PackedSigns {
  const instances: SignInstance[] = stamps.map((stamp) => ({
    matrix: trs(stamp.x, stamp.y, stamp.z, stamp.yaw, stamp.w, stamp.h, 1),
    uv: [0, 0, 1, 1],
    room: stamp.room,
    bg: stamp.bg,
  }))
  if (!stamps.length || typeof document === 'undefined') return { texture: null, instances }

  const keyOf = (stamp: SignStamp) => `${stamp.text}|${stamp.bg}|${stamp.fg}|${Math.round(stamp.w * 100)}|${Math.round(stamp.h * 100)}`
  const order: string[] = []
  const cells = new Map<string, { pw: number; ph: number; src: HTMLCanvasElement; x: number; y: number }>()
  for (const stamp of stamps) {
    const key = keyOf(stamp)
    if (cells.has(key)) continue
    const { pw, ph } = signPixels(stamp)
    const src = paintSign(stamp, pw, ph)
    if (!src) return { texture: null, instances }
    cells.set(key, { pw, ph, src, x: 0, y: 0 })
    order.push(key)
  }

  let x = 0
  let y = 0
  let rowH = 0
  let width = 0
  for (const key of order) {
    const cell = cells.get(key)!
    if (x > 0 && x + cell.pw > ATLAS_MAX) {
      y += rowH
      x = 0
      rowH = 0
    }
    cell.x = x
    cell.y = y
    x += cell.pw
    rowH = Math.max(rowH, cell.ph)
    width = Math.max(width, x)
  }
  const height = y + rowH
  if (width < 1 || height < 1) return { texture: null, instances }

  const atlas = document.createElement('canvas')
  atlas.width = width
  atlas.height = height
  const ctx = atlas.getContext('2d')
  if (!ctx) return { texture: null, instances }
  for (const key of order) {
    const cell = cells.get(key)!
    ctx.drawImage(cell.src, cell.x, cell.y)
  }

  stamps.forEach((stamp, i) => {
    const cell = cells.get(keyOf(stamp))!
    instances[i].uv = [
      cell.x / width,
      1 - (cell.y + cell.ph) / height,
      cell.pw / width,
      cell.ph / height,
    ]
  })

  const texture = new THREE.CanvasTexture(atlas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.flipY = true
  texture.needsUpdate = true
  return { texture, instances }
}

/** Instanced hanging signs. Per-instance uvRect picks a cell out of the atlas. */
export function makeSignMesh(packed: PackedSigns, name: string): THREE.InstancedMesh | null {
  if (!packed.instances.length) return null
  const geo = new THREE.PlaneGeometry(1, 1)
  const mat = packed.texture
    ? new THREE.MeshBasicMaterial({ map: packed.texture, side: THREE.FrontSide })
    : new THREE.MeshBasicMaterial({ color: packed.instances[0].bg, side: THREE.FrontSide })
  if (packed.texture) {
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <uv_pars_vertex>', '#include <uv_pars_vertex>\nattribute vec4 uvRect;')
        .replace(
          'vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;',
          'vMapUv = ( mapTransform * vec3( MAP_UV * uvRect.zw + uvRect.xy, 1 ) ).xy;',
        )
    }
    mat.customProgramCacheKey = () => 'sign-uvrect'
  }
  const mesh = new THREE.InstancedMesh(geo, mat, packed.instances.length)
  mesh.name = name
  mesh.count = packed.instances.length
  mesh.frustumCulled = false
  const uv = new THREE.InstancedBufferAttribute(new Float32Array(packed.instances.length * 4), 4)
  packed.instances.forEach((inst, i) => {
    mesh.setMatrixAt(i, inst.matrix)
    uv.setXYZW(i, inst.uv[0], inst.uv[1], inst.uv[2], inst.uv[3])
  })
  geo.setAttribute('uvRect', uv)
  mesh.instanceMatrix.needsUpdate = true
  uv.needsUpdate = true
  return mesh
}

export function writeSignInstances(mesh: THREE.InstancedMesh, shown: readonly SignInstance[]) {
  const uv = mesh.geometry.getAttribute('uvRect') as THREE.InstancedBufferAttribute
  shown.forEach((inst, i) => {
    mesh.setMatrixAt(i, inst.matrix)
    uv.setXYZW(i, inst.uv[0], inst.uv[1], inst.uv[2], inst.uv[3])
  })
  mesh.count = shown.length
  mesh.visible = shown.length > 0
  mesh.instanceMatrix.needsUpdate = true
  uv.needsUpdate = true
}

export function writeDeskInstances(
  mesh: THREE.InstancedMesh,
  items: readonly { matrix: THREE.Matrix4; room: number }[],
  hidden: ReadonlySet<number>,
) {
  const shown = visibleInstances(items, hidden)
  shown.forEach((inst, i) => mesh.setMatrixAt(i, inst.matrix))
  mesh.count = shown.length
  mesh.visible = shown.length > 0
  mesh.instanceMatrix.needsUpdate = true
}
