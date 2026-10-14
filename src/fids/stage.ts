import * as THREE from 'three'
import { BOARD_H, BOARD_METERS, BOARD_W, SIGN_H, SIGN_METERS, SIGN_W } from './config'
import { blankFlaps, stepFlaps, type FlapState } from './flap'
import { paintBoard, paintWayfinding, type FlapCanvas } from './paint'
import { WAYFINDING, WAYFINDING_KINDS } from './signs'
import type { BoardSnapshot, WayfindingKind } from './types'

export interface FidsTextures {
  departures: THREE.Texture | null
  arrivals: THREE.Texture | null
  signs: Record<WayfindingKind, THREE.Texture | null>
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

function canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

function screenMaterial(map: THREE.Texture | null, fallback: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    ...(map ? { map } : {}),
    color: map ? 0xffffff : fallback,
    toneMapped: false,
    side: THREE.DoubleSide,
  })
}

/** Owns the high-res canvases and the flap state. Meshes share these textures. */
export class FidsStage {
  private flaps: FlapState = blankFlaps()
  private painted = false
  private airport = ''
  private readonly boards: Record<'departures' | 'arrivals', HTMLCanvasElement | null>
  private readonly signCanvas: Record<WayfindingKind, HTMLCanvasElement | null>
  readonly textures: FidsTextures

  constructor() {
    this.boards = {
      departures: makeCanvas(BOARD_W, BOARD_H),
      arrivals: makeCanvas(BOARD_W, BOARD_H),
    }
    this.signCanvas = {
      checkin: makeCanvas(SIGN_W, SIGN_H),
      security: makeCanvas(SIGN_W, SIGN_H),
      gates: makeCanvas(SIGN_W, SIGN_H),
      baggage: makeCanvas(SIGN_W, SIGN_H),
    }
    this.textures = {
      departures: this.boards.departures ? canvasTexture(this.boards.departures) : null,
      arrivals: this.boards.arrivals ? canvasTexture(this.boards.arrivals) : null,
      signs: {
        checkin: this.signCanvas.checkin ? canvasTexture(this.signCanvas.checkin) : null,
        security: this.signCanvas.security ? canvasTexture(this.signCanvas.security) : null,
        gates: this.signCanvas.gates ? canvasTexture(this.signCanvas.gates) : null,
        baggage: this.signCanvas.baggage ? canvasTexture(this.signCanvas.baggage) : null,
      },
    }
  }

  /** Step the flaps and repaint any canvas whose leaves moved. */
  tick(dt: number, snapshot: BoardSnapshot) {
    const stepped = stepFlaps(this.flaps, snapshot, dt)
    this.flaps = stepped.state
    const rename = snapshot.airportName !== this.airport
    if (!this.painted || stepped.dirty) this.paintBoards()
    if (!this.painted || rename) this.paintSigns(snapshot.airportName)
    this.airport = snapshot.airportName
    this.painted = true
  }

  private paintBoards() {
    this.paintOne(this.boards.departures, this.textures.departures, 'DEPARTURES', this.flaps.departures)
    this.paintOne(this.boards.arrivals, this.textures.arrivals, 'ARRIVALS', this.flaps.arrivals)
  }

  private paintOne(
    canvas: HTMLCanvasElement | null,
    map: THREE.Texture | null,
    title: string,
    rows: FlapState['departures'],
  ) {
    if (!canvas || !map) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    paintBoard(ctx as unknown as FlapCanvas, { title, clock: this.flaps.clock, rows })
    map.needsUpdate = true
  }

  private paintSigns(airportName: string) {
    for (const kind of WAYFINDING_KINDS) {
      const canvas = this.signCanvas[kind]
      const map = this.textures.signs[kind]
      if (!canvas || !map) continue
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      paintWayfinding(ctx as unknown as FlapCanvas, WAYFINDING[kind], airportName)
      map.needsUpdate = true
    }
  }

  dispose() {
    this.textures.departures?.dispose()
    this.textures.arrivals?.dispose()
    for (const kind of WAYFINDING_KINDS) this.textures.signs[kind]?.dispose()
  }
}

export function objectIsFidsBoard(obj: THREE.Object3D | null): boolean {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (cur.userData.fids === 'board') return true
    cur = cur.parent
  }
  return false
}

interface RoomSpot {
  kind: string
  x: number
  z: number
}

/**
 * Hang a departures board, an arrivals board, and the four wayfinding signs
 * in the terminal. Sizes are metres, scaled by `meters`.
 */
export function mountFids(
  parent: THREE.Group,
  rooms: readonly RoomSpot[],
  yaw: number,
  meters: (n: number) => number,
  textures: FidsTextures,
): { geos: THREE.BufferGeometry[]; mats: THREE.Material[] } {
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const checkin = rooms.find((room) => room.kind === 'checkin') ?? rooms[0] ?? { kind: 'checkin', x: 0, z: 0 }
  const security = rooms.find((room) => room.kind === 'security')
  const gate = rooms.find((room) => room.kind === 'gate')
  const faceX = Math.sin(yaw)
  const faceZ = Math.cos(yaw)
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)
  const m = meters

  const span = m(BOARD_METERS.w + BOARD_METERS.gap) / 2
  const boards: { name: string; map: THREE.Texture | null; side: number }[] = [
    { name: 'fids-departures', map: textures.departures, side: -1 },
    { name: 'fids-arrivals', map: textures.arrivals, side: 1 },
  ]
  for (const board of boards) {
    const boardGeo = new THREE.PlaneGeometry(m(BOARD_METERS.w), m(BOARD_METERS.h))
    geos.push(boardGeo)
    const mat = screenMaterial(board.map, board.side < 0 ? 0x143028 : 0x10283a)
    mats.push(mat)
    const mesh = new THREE.Mesh(boardGeo, mat)
    mesh.name = board.name
    mesh.userData.fids = 'board'
    mesh.position.set(checkin.x + rightX * span * board.side, m(BOARD_METERS.y), checkin.z + rightZ * span * board.side)
    mesh.rotation.y = yaw
    parent.add(mesh)
  }

  const spots: { kind: WayfindingKind; x: number; z: number }[] = [
    { kind: 'checkin', x: checkin.x + faceX * m(3.4), z: checkin.z + faceZ * m(3.4) },
    {
      kind: 'security',
      x: (security?.x ?? checkin.x) + rightX * m(security ? 0 : 4.2),
      z: (security?.z ?? checkin.z) + rightZ * m(security ? 0 : 4.2),
    },
    {
      kind: 'gates',
      x: (gate?.x ?? checkin.x) - faceX * m(gate ? 1.2 : 0),
      z: (gate?.z ?? checkin.z) - faceZ * m(gate ? 1.2 : 0),
    },
    {
      kind: 'baggage',
      x: checkin.x - faceX * m(3.2) + rightX * m(4.6),
      z: checkin.z - faceZ * m(3.2) + rightZ * m(4.6),
    },
  ]
  for (const spot of spots) {
    const signGeo = new THREE.PlaneGeometry(m(SIGN_METERS.w), m(SIGN_METERS.h))
    const postGeo = new THREE.BoxGeometry(m(SIGN_METERS.post), m(SIGN_METERS.y - SIGN_METERS.h / 2), m(SIGN_METERS.post))
    geos.push(signGeo, postGeo)
    const mat = screenMaterial(textures.signs[spot.kind], 0x0e2230)
    const postMat = new THREE.MeshLambertMaterial({ color: 0x2a3138 })
    mats.push(mat, postMat)
    const sign = new THREE.Mesh(signGeo, mat)
    sign.name = `fids-sign-${spot.kind}`
    sign.position.set(spot.x, m(SIGN_METERS.y), spot.z)
    sign.rotation.y = yaw
    const post = new THREE.Mesh(postGeo, postMat)
    post.name = `fids-post-${spot.kind}`
    post.position.set(spot.x, m((SIGN_METERS.y - SIGN_METERS.h / 2) / 2), spot.z)
    parent.add(post, sign)
  }

  return { geos, mats }
}
