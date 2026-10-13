/**
 * 3D terminal hall — orbit camera over furnished rooms + walking guests.
 * Layout follows NODE_POS; rooms appear when furnished. Security is the visual choke.
 */
import * as THREE from 'three'
import { HALL_EDGES, isAirside, NODE_POS, type HallNode } from '../game/guests'
import type { Game } from '../game/sim'
import {
  cellCenter,
  GRID_C,
  GRID_R,
  HALL_D,
  HALL_W,
  prefabZones,
  zoneDef,
  type ZoneId,
} from '../game/terminal'

function nodeWorld(id: HallNode): THREE.Vector3 {
  const p = NODE_POS[id]
  return new THREE.Vector3((p.x - 0.5) * HALL_W, 0, (p.y - 0.5) * HALL_D)
}

const ROOM_COLOR: Partial<Record<HallNode, string>> = {
  entrance: '#6a8a72',
  info: '#5a7a8a',
  checkin: '#4a7a9a',
  bathroom: '#5a6a70',
  security: '#c9a227',
  food: '#8a6a4a',
  shop: '#7a5a8a',
  lounge: '#3a6a8a',
  gate: '#2f6f9a',
  claim: '#6a7a8a',
  exit: '#5a8a6a',
  golf: '#4a8a5a',
  spa: '#8a6a7a',
  pool: '#3a7a9a',
  dayhotel: '#8a7a5a',
  gaming: '#6a4a7a',
  waterfall: '#4a8a9a',
}

export class HallWorld {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  pivot = new THREE.Vector3(0, 0, 0)
  yaw = 0.55
  pitch = 0.95
  dist = 52
  dragging: 'orbit' | 'pan' | null = null
  lastX = 0
  lastY = 0
  roomGroup = new THREE.Group()
  guestGroup = new THREE.Group()
  guests = new Map<string, THREE.Mesh>()
  roomHash = ''
  private floor: THREE.Mesh
  private game: Game | null = null
  private downX = 0
  private downY = 0
  private ray = new THREE.Raycaster()

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#1a2a32')
    this.scene.fog = new THREE.Fog('#1a2a32', 40, 90)

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
    this.placeCam()

    this.scene.add(new THREE.HemisphereLight('#d0e8f8', '#2a3a40', 0.9))
    const sun = new THREE.DirectionalLight('#fff4e0', 0.7)
    sun.position.set(12, 28, 8)
    this.scene.add(sun)

    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(HALL_W + 8, HALL_D + 8),
      new THREE.MeshLambertMaterial({ color: '#2a3840' }),
    )
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = 0
    this.scene.add(this.floor)

    const before = this.makeLabel('BEFORE SECURITY', '#8ee0a8')
    before.position.set(-HALL_W * 0.28, 0.08, -HALL_D * 0.42)
    before.rotation.x = -Math.PI / 2
    this.scene.add(before)
    const after = this.makeLabel('AFTER SECURITY', '#7ec3e8')
    after.position.set(HALL_W * 0.28, 0.08, -HALL_D * 0.42)
    after.rotation.x = -Math.PI / 2
    this.scene.add(after)

    this.scene.add(this.roomGroup)
    this.scene.add(this.guestGroup)

    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointerleave', this.onUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  private makeLabel(text: string, color: string): THREE.Mesh {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = color
    ctx.font = '700 36px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(text, 128, 44)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return new THREE.Mesh(
      new THREE.PlaneGeometry(6, 1.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    )
  }

  private onDown = (e: PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    // Middle/right = orbit; left-drag = pan (WASD also pans).
    if (e.button === 1 || e.button === 2) this.dragging = 'orbit'
    else this.dragging = e.shiftKey ? 'orbit' : 'pan'
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.downX = e.clientX
    this.downY = e.clientY
  }

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY
    if (this.dragging === 'orbit') {
      this.yaw -= dx * 0.008
      this.pitch = Math.min(1.35, Math.max(0.35, this.pitch + dy * 0.006))
    } else {
      this.nudgePan(-dx * 0.04, -dy * 0.04)
    }
    this.placeCam()
  }

  nudgePan(rightAmt: number, forwardAmt: number) {
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    this.pivot.addScaledVector(right, rightAmt)
    this.pivot.addScaledVector(fwd, forwardAmt)
    this.placeCam()
  }

  nudgeYaw(delta: number) {
    this.yaw += delta
    this.placeCam()
  }

  private onUp = (e: PointerEvent) => {
    const dx = e.clientX - this.downX
    const dy = e.clientY - this.downY
    this.dragging = null
    if (e.button !== 0 || Math.hypot(dx, dy) > 6 || !this.game) return
    const canvas = this.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    )
    this.ray.setFromCamera(ndc, this.camera)
    const hits = this.ray.intersectObjects(this.guestGroup.children, true)
    let id: string | null = null
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        if (typeof obj.userData.guestId === 'string') {
          id = obj.userData.guestId
          break
        }
        obj = obj.parent
      }
      if (id) break
    }
    this.game.selectGuest(id)
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.dist = Math.min(70, Math.max(18, this.dist + e.deltaY * 0.04))
    this.placeCam()
  }

  placeCam() {
    const x = Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist
    const y = Math.sin(this.pitch) * this.dist
    const z = Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist
    this.camera.position.set(this.pivot.x + x, y, this.pivot.z + z)
    this.camera.lookAt(this.pivot)
  }

  resize() {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== w || canvas.height !== h) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / Math.max(1, h)
      this.camera.updateProjectionMatrix()
    }
  }

  private box(w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }),
    )
    mesh.position.set(x, y, z)
    this.roomGroup.add(mesh)
  }

  /** Perimeter shell with door gaps, plus the security wall with a walk-through. */
  private buildShell() {
    const h = 3.15
    const t = 0.38
    const y = h / 2
    const wall = '#d5ddd8'
    const halfW = HALL_W / 2
    const halfD = HALL_D / 2
    // North and south — solid. The roof is gone so the floor stays readable.
    this.box(HALL_W + t, h, t, wall, 0, y, -halfD)
    this.box(HALL_W + t, h, t, wall, 0, y, halfD)
    // West doors at the curb (z ≈ 0). Two wall pieces leave the gap.
    const door = 4.2
    const westLen = (HALL_D - door) / 2
    this.box(t, h, westLen, wall, -halfW, y, -halfD + westLen / 2)
    this.box(t, h, westLen, wall, -halfW, y, halfD - westLen / 2)
    // East jetway door, offset toward the gate desks.
    const eastGapZ = -6.5
    const eastHalf = (HALL_D - door) / 2
    this.box(t, h, eastHalf, wall, halfW, y, -halfD + eastHalf / 2 - 1.2)
    this.box(t, h, eastHalf * 0.72, wall, halfW, y, eastGapZ + door / 2 + (eastHalf * 0.72) / 2)
    // Cornice only — no roof slab.
    this.box(HALL_W + 0.6, 0.18, 0.5, '#e7eee9', 0, h, -halfD)
    this.box(HALL_W + 0.6, 0.18, 0.5, '#e7eee9', 0, h, halfD)
    // Security walls on both sides of column 3, gap at the lane (z ≈ -3).
    const gap = 3.6
    const gapZ = -3.2
    for (const x of [-6, 0]) {
      const northLen = gapZ - gap / 2 - -halfD
      const southLen = halfD - (gapZ + gap / 2)
      this.box(t, h, Math.max(0.4, northLen), '#c9a27a', x, y, -halfD + northLen / 2)
      this.box(t, h, Math.max(0.4, southLen), '#c9a27a', x, y, halfD - southLen / 2)
      // Arch over the walk-through.
      this.box(t + 0.05, 0.35, gap, '#e8eef4', x, h - 0.2, gapZ)
    }
  }

  rebuildRooms(game: Game) {
    const fit = game.activeHall()
    const zones = fit?.zones ?? (fit?.premade ? prefabZones() : [])
    const open = [...game.hallOpen()].sort().join(',')
    const choke = game.hasSecurityChoke() ? '1' : '0'
    const paint = zones.map((row) => row.join(',')).join('|')
    const stuff = (fit?.items ?? []).map((i) => `${i.def}@${i.c},${i.r}`).join(';')
    const hash = `${open}|${choke}|${fit?.tier ?? 0}|${paint}|${stuff}`
    if (hash === this.roomHash) return
    this.roomHash = hash
    this.roomGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else if (mat) mat.dispose()
    })
    this.roomGroup.clear()
    this.buildShell()

    const cw = HALL_W / GRID_C
    const rh = HALL_D / GRID_R
    for (let r = 0; r < zones.length; r++) {
      for (let c = 0; c < zones[r].length; c++) {
        const z = zones[r][c] as ZoneId | null
        if (!z) continue
        const pos = cellCenter(c, r)
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(cw - 0.18, 0.06, rh - 0.18),
          new THREE.MeshLambertMaterial({ color: zoneDef(z).color }),
        )
        tile.position.set(pos.x, 0.04, pos.z)
        this.roomGroup.add(tile)
      }
    }

    for (const [a, b] of HALL_EDGES) {
      if (!game.hallOpen().has(a) || !game.hallOpen().has(b)) continue
      const pa = nodeWorld(a)
      const pb = nodeWorld(b)
      const mid = pa.clone().add(pb).multiplyScalar(0.5)
      const len = pa.distanceTo(pb)
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.4, len - 1.2), 0.05, 0.4),
        new THREE.MeshLambertMaterial({
          color: isAirside(a) || isAirside(b) ? '#3a5a70' : '#3a5a48',
        }),
      )
      beam.position.copy(mid)
      beam.position.y = 0.08
      beam.lookAt(pb.x, 0.08, pb.z)
      beam.rotateY(Math.PI / 2)
      this.roomGroup.add(beam)
    }

    for (const it of fit?.items ?? []) {
      const pos = cellCenter(it.c, it.r)
      const worn = it.wear >= 55 ? '#8a5a4a' : (ROOM_COLOR[it.def as HallNode] ?? '#e8eef2')
      const tall = String(it.def).includes('security') ? 1.5 : 0.7
      this.box(1.4, tall, 1.1, worn, pos.x, tall / 2 + 0.05, pos.z)
    }
  }

  syncGuests(game: Game) {
    const live = new Set(game.hallGuests.map((g) => g.id))
    for (const [id, mesh] of this.guests) {
      if (!live.has(id)) {
        this.guestGroup.remove(mesh)
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
        const pin = mesh.userData.pin as THREE.Mesh | undefined
        pin?.geometry.dispose()
        ;(pin?.material as THREE.Material | undefined)?.dispose()
        this.guests.delete(id)
      }
    }
    const pile = new Map<string, number>()
    for (const g of game.hallGuests) {
      let mesh = this.guests.get(g.id)
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.22, 0.55, 3, 6),
          new THREE.MeshLambertMaterial({ color: g.color }),
        )
        mesh.userData.guestId = g.id
        const pin = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.42, 5),
          new THREE.MeshLambertMaterial({ color: '#e23b2f' }),
        )
        pin.position.y = 1.15
        mesh.add(pin)
        mesh.userData.pin = pin
        this.guests.set(g.id, mesh)
        this.guestGroup.add(mesh)
      }
      const node = g.path.length ? g.path[Math.min(g.seg, g.path.length - 1)] : g.node
      const next = g.path.length && g.seg < g.path.length - 1 ? g.path[g.seg + 1] : null
      const a = nodeWorld(node)
      const b = next ? nodeWorld(next) : a
      const t = next ? g.t : 0
      const key = `${node}:${next ?? ''}`
      const slot = pile.get(key) ?? 0
      pile.set(key, slot + 1)
      const ox = next ? 0 : (slot % 4) * 0.42 - 0.6
      const oz = next ? 0 : Math.floor(slot / 4) * 0.42
      mesh.position.set(a.x + (b.x - a.x) * t + ox, 0.55, a.z + (b.z - a.z) * t + oz)
      const pin = mesh.userData.pin as THREE.Mesh
      pin.visible = Boolean(g.lost)
    }
  }

  render(game: Game) {
    this.game = game
    this.resize()
    this.rebuildRooms(game)
    this.syncGuests(game)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.onDown)
    canvas.removeEventListener('pointermove', this.onMove)
    canvas.removeEventListener('pointerup', this.onUp)
    canvas.removeEventListener('pointerleave', this.onUp)
    canvas.removeEventListener('wheel', this.onWheel)
    this.renderer.dispose()
  }
}
