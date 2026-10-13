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
  /** Routes, heat, and advisor marks. Hidden unless the player asks or a note is focused. */
  overlay = new THREE.Group()
  /** Queue, lost, bag, and shop markers. Always drawn. Numbers open on click. */
  hotspotGroup = new THREE.Group()
  bagGroup = new THREE.Group()
  guests = new Map<string, THREE.Mesh>()
  private beltCubes: THREE.Mesh[] = []
  private claimCubes: THREE.Mesh[] = []
  private sortCubes: THREE.Mesh[] = []
  private luggageBuilt = false
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
    this.overlay.visible = false
    this.scene.add(this.overlay)
    this.scene.add(this.hotspotGroup)
    this.scene.add(this.bagGroup)

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
    const spotHits = this.ray.intersectObjects(this.hotspotGroup.children, true)
    const hits = this.ray.intersectObjects(this.guestGroup.children, true)
    const spot = spotHits[0]
    const person = hits[0]
    if (spot && (!person || spot.distance <= person.distance)) {
      let obj: THREE.Object3D | null = spot.object
      while (obj) {
        if (typeof obj.userData.infoId === 'string') {
          this.game.toggleInfo(obj.userData.infoId)
          return
        }
        obj = obj.parent
      }
    }
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

  /** Perimeter shell with door gaps, plus walls where security meets the curb side. */
  private buildShell(zones: ZoneId[][]) {
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
    this.buildSecureWalls(zones)
  }

  /** Wall a security cell against check-in or arrivals. Leave the gate side open. */
  private buildSecureWalls(zones: ZoneId[][]) {
    const rows = zones.length
    const cols = zones[0]?.length ?? 0
    if (!rows || !cols) return
    const cw = HALL_W / cols
    const rh = HALL_D / rows
    const h = 3.15
    const t = 0.28
    const blocks = (a: ZoneId, b: ZoneId) => {
      if (a === b) return false
      const air = (z: ZoneId) => z === 'gates' || z === 'retail'
      if ((a === 'security' && air(b)) || (b === 'security' && air(a))) return false
      return a === 'security' || b === 'security'
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const z = zones[r][c]
        if (!z) continue
        if (c + 1 < cols && zones[r][c + 1] && blocks(z, zones[r][c + 1])) {
          const x = -HALL_W / 2 + (c + 1) * cw
          const zpos = -HALL_D / 2 + (r + 0.5) * rh
          this.box(t, h, rh * 0.9, '#c9a27a', x, h / 2, zpos)
        }
        if (r + 1 < rows && zones[r + 1][c] && blocks(z, zones[r + 1][c])) {
          const x = -HALL_W / 2 + (c + 0.5) * cw
          const zpos = -HALL_D / 2 + (r + 1) * rh
          this.box(cw * 0.9, h, t, '#c9a27a', x, h / 2, zpos)
        }
      }
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
    const cols = zones[0]?.length || GRID_C
    const rows = zones.length || GRID_R
    this.buildShell(zones as ZoneId[][])

    const cw = HALL_W / cols
    const rh = HALL_D / rows
    for (let r = 0; r < zones.length; r++) {
      for (let c = 0; c < zones[r].length; c++) {
        const z = zones[r][c] as ZoneId | null
        if (!z) continue
        const pos = cellCenter(c, r, cols, rows)
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
      const pos = cellCenter(it.c, it.r, cols, rows)
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
        for (const key of ['pin', 'carry', 'checked'] as const) {
          const child = mesh.userData[key] as THREE.Mesh | undefined
          child?.geometry.dispose()
          ;(child?.material as THREE.Material | undefined)?.dispose()
        }
        const bubble = mesh.userData.bubble as THREE.Sprite | undefined
        const bubbleMat = bubble?.material as THREE.SpriteMaterial | undefined
        bubbleMat?.map?.dispose()
        bubbleMat?.dispose()
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
        const carry = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.36, 0.16),
          new THREE.MeshBasicMaterial({ color: '#3ec6ff', fog: false }),
        )
        carry.position.set(0.46, 0.2, 0)
        mesh.add(carry)
        mesh.userData.carry = carry
        const checked = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.62, 0.28),
          new THREE.MeshBasicMaterial({ color: '#ffb703', fog: false }),
        )
        checked.position.set(-0.62, -0.12, 0.18)
        mesh.add(checked)
        mesh.userData.checked = checked
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
      const carry = mesh.userData.carry as THREE.Mesh
      const checked = mesh.userData.checked as THREE.Mesh
      carry.visible = g.carryOn !== false
      checked.visible = Boolean(g.hasChecked)
      this.syncBubble(mesh, g.thought)
    }
  }

  /** Wish line while they leave an empty counter. */
  private syncBubble(mesh: THREE.Mesh, thought: string) {
    const show = thought.startsWith('wish they')
    let sprite = mesh.userData.bubble as THREE.Sprite | undefined
    if (!show) {
      if (sprite) sprite.visible = false
      return
    }
    if (!sprite) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false })
      sprite = new THREE.Sprite(mat)
      sprite.position.set(0, 1.45, 0)
      sprite.scale.set(2.8, 0.75, 1)
      mesh.add(sprite)
      mesh.userData.bubble = sprite
    }
    if (mesh.userData.bubbleText !== thought) {
      const c = document.createElement('canvas')
      c.width = 512
      c.height = 128
      const ctx = c.getContext('2d')!
      ctx.fillStyle = 'rgba(255,255,255,0.94)'
      ctx.fillRect(8, 16, 496, 96)
      ctx.strokeStyle = '#1a2a32'
      ctx.lineWidth = 6
      ctx.strokeRect(8, 16, 496, 96)
      ctx.fillStyle = '#1a2a32'
      ctx.font = '700 40px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(thought, 256, 78)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      const mat = sprite.material as THREE.SpriteMaterial
      mat.map?.dispose()
      mat.map = tex
      mat.needsUpdate = true
      mesh.userData.bubbleText = thought
    }
    sprite.visible = true
  }

  private clearHotspots() {
    this.hotspotGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    })
    this.hotspotGroup.clear()
  }

  /** Markers stay up. The counts live in the click submenu. */
  syncHotspots(game: Game) {
    this.clearHotspots()
    if (!game.fits.length) return
    const spots: { id: string; node: HallNode; color: string }[] = [
      { id: 'queue', node: 'security', color: '#e0a020' },
      { id: 'lost', node: 'entrance', color: '#e23b2f' },
      { id: 'bags', node: 'claim', color: '#3a8ec2' },
      { id: 'retail', node: 'food', color: '#8a6a4a' },
    ]
    for (const spot of spots) {
      if (!game.infoHotspots().some((h) => h.id === spot.id)) continue
      const p = nodeWorld(spot.node)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.82, 20),
        new THREE.MeshBasicMaterial({
          color: spot.color,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
        }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.set(p.x, 0.18, p.z)
      ring.userData.infoId = spot.id
      this.hotspotGroup.add(ring)
    }
  }

  private clearOverlay() {
    this.overlay.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    })
    this.overlay.clear()
  }

  /**
   * Separate layer. Hidden unless Show passenger flows is on.
   * An advisor highlight draws only the marked cells, not the flow lines.
   */
  syncOverlay(game: Game) {
    const show = game.showFlows
    const marks = game.advisorCells
    this.clearOverlay()
    this.overlay.visible = show || marks.length > 0
    if (!this.overlay.visible) return
    const fit = game.activeHall()
    const zones = fit?.zones ?? []
    const cols = zones[0]?.length || GRID_C
    const rows = zones.length || GRID_R
    if (marks.length) {
      for (const cell of marks) {
        const pos = cellCenter(cell.c, cell.r, cols, rows)
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(HALL_W / cols - 0.05, 0.12, HALL_D / rows - 0.05),
          new THREE.MeshBasicMaterial({ color: '#f0c14a', transparent: true, opacity: 0.85 }),
        )
        tile.position.set(pos.x, 0.2, pos.z)
        this.overlay.add(tile)
      }
    }
    if (!show) return
    const open = game.hallOpen()
    const load = new Map<HallNode, number>()
    for (const g of game.hallGuests) {
      if (g.dead) continue
      load.set(g.node, (load.get(g.node) ?? 0) + 1)
      if (g.path.length > 1) {
        for (let i = 0; i < g.path.length - 1; i++) {
          const a = nodeWorld(g.path[i])
          const b = nodeWorld(g.path[i + 1])
          const mid = a.clone().add(b).multiplyScalar(0.5)
          const len = a.distanceTo(b)
          const line = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(0.15, len), 0.04, 0.12),
            new THREE.MeshBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.45 }),
          )
          line.position.set(mid.x, 0.35, mid.z)
          line.lookAt(b.x, 0.35, b.z)
          line.rotateY(Math.PI / 2)
          this.overlay.add(line)
        }
      }
    }
    for (const [a, b] of HALL_EDGES) {
      if (!open.has(a) || !open.has(b)) continue
      const pa = nodeWorld(a)
      const pb = nodeWorld(b)
      const mid = pa.clone().add(pb).multiplyScalar(0.5)
      const len = pa.distanceTo(pb)
      const flow = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.2, len), 0.03, 0.22),
        new THREE.MeshBasicMaterial({ color: '#7dffb2', transparent: true, opacity: 0.28 }),
      )
      flow.position.set(mid.x, 0.16, mid.z)
      flow.lookAt(pb.x, 0.16, pb.z)
      flow.rotateY(Math.PI / 2)
      this.overlay.add(flow)
    }
    const signs = fit?.signs ?? 0
    const reach = 1.1 + signs * 0.45
    for (const node of open) {
      const degree = HALL_EDGES.filter(([a, b]) => a === node || b === node).length
      if (degree < 3 && node !== 'info') continue
      const p = nodeWorld(node)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(reach * 0.35, reach * 0.55, 18),
        new THREE.MeshBasicMaterial({
          color: node === 'info' ? '#f0c14a' : '#9ad0ff',
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.set(p.x, 0.22, p.z)
      this.overlay.add(ring)
    }
    for (const [node, n] of load) {
      if (n < 2) continue
      const p = nodeWorld(node)
      const heat = new THREE.Mesh(
        new THREE.CircleGeometry(0.35 + Math.min(6, n) * 0.18, 16),
        new THREE.MeshBasicMaterial({
          color: n > 8 ? '#e23b2f' : n > 4 ? '#e07a2f' : '#e0c14a',
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
        }),
      )
      heat.rotation.x = -Math.PI / 2
      heat.position.set(p.x, 0.12, p.z)
      this.overlay.add(heat)
    }
  }

  render(game: Game) {
    this.game = game
    this.resize()
    this.rebuildRooms(game)
    this.syncGuests(game)
    this.syncLuggage(game)
    this.syncOverlay(game)
    this.syncHotspots(game)
    this.renderer.render(this.scene, this.camera)
  }

  /** Belt, hold-bag scanner, sort pile, and claim carousel. Cubes are a capped parade. */
  private syncLuggage(game: Game) {
    if (!game.fits.length) {
      this.bagGroup.visible = false
      return
    }
    this.bagGroup.visible = true
    if (!this.luggageBuilt) this.buildLuggage()
    const motion = game.luggageMotion()
    const spin = (motion.phase + performance.now() * 0.00012) % 1
    const checkin = nodeWorld('checkin')
    const bay = new THREE.Vector3(checkin.x - 6.2, 0, checkin.z + 4.4)
    const screen = new THREE.Vector3(
      checkin.x + (bay.x - checkin.x) * 0.45,
      0,
      checkin.z + (bay.z - checkin.z) * 0.45,
    )
    const claim = nodeWorld('claim')
    this.beltCubes.forEach((cube, i) => {
      cube.visible = motion.belt
      const t = (spin + i / this.beltCubes.length) % 1
      const p = t < 0.55 ? checkin.clone().lerp(screen, t / 0.55) : screen.clone().lerp(bay, (t - 0.55) / 0.45)
      cube.position.set(p.x, 0.42, p.z)
    })
    this.sortCubes.forEach((cube, i) => {
      cube.visible = motion.sort
      cube.position.y = 0.28 + (i % 3) * 0.22 + Math.sin(spin * Math.PI * 2 + i) * 0.04
    })
    this.claimCubes.forEach((cube, i) => {
      cube.visible = motion.carousel
      const a = (spin + i / this.claimCubes.length) * Math.PI * 2
      cube.position.set(claim.x + Math.cos(a) * 2.15, 0.48, claim.z + Math.sin(a) * 1.15)
    })
  }

  private buildLuggage() {
    this.luggageBuilt = true
    const checkin = nodeWorld('checkin')
    const bay = new THREE.Vector3(checkin.x - 6.2, 0, checkin.z + 4.4)
    const screen = new THREE.Vector3(
      checkin.x + (bay.x - checkin.x) * 0.45,
      0,
      checkin.z + (bay.z - checkin.z) * 0.45,
    )
    const claim = nodeWorld('claim')
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.12, 7.2),
      new THREE.MeshLambertMaterial({ color: '#2a3238' }),
    )
    deck.position.set((checkin.x + bay.x) / 2, 0.16, (checkin.z + bay.z) / 2)
    deck.rotation.y = Math.atan2(bay.x - checkin.x, bay.z - checkin.z)
    this.bagGroup.add(deck)

    const frameMat = new THREE.MeshLambertMaterial({ color: '#14181c' })
    const glow = new THREE.MeshLambertMaterial({ color: '#e0c14a', emissive: '#e0c14a', emissiveIntensity: 0.35 })
    for (const side of [-0.55, 0.55]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), frameMat)
      post.position.set(screen.x + side, 0.7, screen.z)
      this.bagGroup.add(post)
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.16), frameMat)
    lintel.position.set(screen.x, 1.25, screen.z)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.06), glow)
    mouth.position.set(screen.x, 0.72, screen.z)
    this.bagGroup.add(lintel, mouth)

    const hall = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.3, 2.2),
      new THREE.MeshLambertMaterial({ color: '#5c6570' }),
    )
    hall.position.set(bay.x, 0.7, bay.z)
    this.bagGroup.add(hall)
    const label = this.makeLabel('BAGGAGE HALL', '#d7e2ea')
    label.position.set(bay.x, 0.08, bay.z + 1.6)
    label.rotation.x = -Math.PI / 2
    this.bagGroup.add(label)

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.16, 8, 28),
      new THREE.MeshLambertMaterial({ color: '#3a4550' }),
    )
    ring.rotation.x = Math.PI / 2
    ring.scale.set(1, 0.55, 1)
    ring.position.set(claim.x, 0.28, claim.z)
    this.bagGroup.add(ring)

    const bagMat = new THREE.MeshBasicMaterial({ color: '#ffb703', fog: false })
    const blue = new THREE.MeshBasicMaterial({ color: '#3ec6ff', fog: false })
    for (let i = 0; i < 6; i++) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.62), i % 2 ? blue : bagMat)
      this.bagGroup.add(cube)
      this.beltCubes.push(cube)
    }
    for (let i = 0; i < 6; i++) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.58), i % 2 ? blue : bagMat)
      cube.position.set(bay.x - 0.7 + (i % 3) * 0.42, 0.3, bay.z - 0.3 + Math.floor(i / 3) * 0.4)
      this.bagGroup.add(cube)
      this.sortCubes.push(cube)
    }
    for (let i = 0; i < 5; i++) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.64), i % 2 ? blue : bagMat)
      this.bagGroup.add(cube)
      this.claimCubes.push(cube)
    }
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
