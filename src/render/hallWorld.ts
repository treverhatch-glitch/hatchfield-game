/**
 * 3D terminal hall — orbit camera over furnished rooms + walking guests.
 * Layout follows NODE_POS; rooms appear when furnished. Security is the visual choke.
 */
import * as THREE from 'three'
import { HALL_EDGES, isAirside, NODE_POS, type HallNode } from '../game/guests'
import type { Game } from '../game/sim'

const HALL_W = 48
const HALL_D = 32

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
  yaw = 0.4
  pitch = 0.85
  dist = 42
  dragging: 'orbit' | 'pan' | null = null
  lastX = 0
  lastY = 0
  roomGroup = new THREE.Group()
  guestGroup = new THREE.Group()
  guests = new Map<string, THREE.Mesh>()
  roomHash = ''
  private floor: THREE.Mesh
  private secWall: THREE.Mesh

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

    // Secure-line wall visual (gap at security desk)
    this.secWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 3.2, HALL_D * 0.85),
      new THREE.MeshLambertMaterial({ color: '#c9a227', transparent: true, opacity: 0.35 }),
    )
    const sec = nodeWorld('security')
    this.secWall.position.set(sec.x - 1.2, 1.6, 0)
    this.scene.add(this.secWall)

    const landLabel = this.makeLabel('LANDSIDE', '#8ee0a8')
    landLabel.position.set(-HALL_W * 0.35, 0.05, HALL_D * 0.42)
    landLabel.rotation.x = -Math.PI / 2
    this.scene.add(landLabel)
    const airLabel = this.makeLabel('AIRSIDE', '#7ec3e8')
    airLabel.position.set(HALL_W * 0.32, 0.05, HALL_D * 0.42)
    airLabel.rotation.x = -Math.PI / 2
    this.scene.add(airLabel)

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
    this.dragging = e.button === 2 || e.shiftKey ? 'pan' : 'orbit'
    this.lastX = e.clientX
    this.lastY = e.clientY
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
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
      const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
      this.pivot.addScaledVector(right, -dx * 0.04)
      this.pivot.addScaledVector(fwd, -dy * 0.04)
    }
    this.placeCam()
  }

  private onUp = () => {
    this.dragging = null
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

  rebuildRooms(game: Game) {
    const open = [...game.hallOpen()].sort().join(',')
    const choke = game.hasSecurityChoke() ? '1' : '0'
    const hash = `${open}|${choke}`
    if (hash === this.roomHash) return
    this.roomHash = hash
    this.roomGroup.clear()
    this.secWall.visible = choke === '1'

    // Corridor edges
    for (const [a, b] of HALL_EDGES) {
      if (!game.hallOpen().has(a) || !game.hallOpen().has(b)) continue
      const pa = nodeWorld(a)
      const pb = nodeWorld(b)
      const mid = pa.clone().add(pb).multiplyScalar(0.5)
      const len = pa.distanceTo(pb)
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.4, len - 1.2), 0.08, 0.55),
        new THREE.MeshLambertMaterial({
          color: isAirside(a) || isAirside(b) ? '#3a5a70' : '#3a5a48',
        }),
      )
      beam.position.copy(mid)
      beam.position.y = 0.04
      beam.lookAt(pb.x, 0.04, pb.z)
      beam.rotateY(Math.PI / 2)
      this.roomGroup.add(beam)
    }

    for (const id of game.hallOpen()) {
      const pos = nodeWorld(id)
      const h = id === 'security' ? 3.4 : id === 'gate' ? 3.8 : 2.6
      const w = id === 'security' ? 3.2 : 2.6
      const d = id === 'security' ? 2.2 : 2.4
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({
          color: ROOM_COLOR[id] ?? '#4a6a7a',
        }),
      )
      body.position.set(pos.x, h / 2, pos.z)
      this.roomGroup.add(body)
      if (id === 'security') {
        const arch = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 2.4, 0.3),
          new THREE.MeshLambertMaterial({ color: '#e8eef4' }),
        )
        arch.position.set(pos.x + 1.4, 1.2, pos.z)
        this.roomGroup.add(arch)
      }
    }
  }

  syncGuests(game: Game) {
    const live = new Set(game.hallGuests.map((g) => g.id))
    for (const [id, mesh] of this.guests) {
      if (!live.has(id)) {
        this.guestGroup.remove(mesh)
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
        this.guests.delete(id)
      }
    }
    for (const g of game.hallGuests) {
      let mesh = this.guests.get(g.id)
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.22, 0.55, 3, 6),
          new THREE.MeshLambertMaterial({ color: g.color }),
        )
        this.guests.set(g.id, mesh)
        this.guestGroup.add(mesh)
      }
      const node = g.path.length ? g.path[Math.min(g.seg, g.path.length - 1)] : g.node
      const next =
        g.path.length && g.seg < g.path.length - 1 ? g.path[g.seg + 1] : null
      const a = nodeWorld(node)
      const b = next ? nodeWorld(next) : a
      const t = next ? g.t : 0
      mesh.position.set(
        a.x + (b.x - a.x) * t,
        0.55,
        a.z + (b.z - a.z) * t,
      )
    }
  }

  render(game: Game) {
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
