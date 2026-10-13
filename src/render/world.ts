import * as THREE from 'three'
import { inBounds } from '../game/path'
import type { Game } from '../game/sim'
import { SIZE } from '../game/types'
import type { HotelClass, ParkTerm, Tile, Vec } from '../game/types'
import {
  createAircraft,
  createBridges,
  disposeAircraftLibrary,
  gatePreviewId,
  bridgeYawToward,
  loadAircraftQuality,
  ParkedFleet,
  releaseAircraft,
  setAircraftNight,
  aircraftWorldPerMeter,
  CELL,
  updateAircraft,
  WORLD_PER_METER,
  type Livery,
  type ParkedPlane,
} from './aircraft/index'
import {
  initWorldRender,
  parseQuality,
  REPLACED_TILES,
  suggestQuality,
  type QualityLevel,
  type WorldRender,
} from './world/index'

export { CELL }

/** Closest hall view. The interior cutaway engages below about 54. */
const MIN_DIST = 12
const MAX_DIST = 280

/**
 * True when the drawing buffer does not match CSS size × pixel ratio.
 * Comparing `canvas.width` to `clientWidth` resizes every frame whenever the ratio is not 1.
 */
export function needsResize(
  canvasWidth: number,
  canvasHeight: number,
  clientWidth: number,
  clientHeight: number,
  pixelRatio: number,
): boolean {
  const bw = Math.floor(clientWidth * pixelRatio)
  const bh = Math.floor(clientHeight * pixelRatio)
  return canvasWidth !== bw || canvasHeight !== bh
}

export function toWorld(c: number, r: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3(
    (c - (SIZE - 1) / 2) * CELL,
    y,
    (r - (SIZE - 1) / 2) * CELL,
  )
}

function wu(meters: number): number {
  return meters * WORLD_PER_METER
}

/** Length, height, width in meters. Aircraft are the only meshes with a visual exaggeration. */
function vehicleMeters(kind: string): [number, number, number] {
  if (kind === 'citycargo' || kind === 'catering_truck') return [8.5, 3.2, 2.5]
  if (kind === 'delivery' || kind === 'contractor') return [7.2, 2.8, 2.4]
  if (kind === 'fuel' || kind === 'fuel_truck') return [8, 3, 2.5]
  if (kind === 'pax_bus') return [12, 3, 2.5]
  if (kind === 'uld_loader') return [8, 2.4, 2.6]
  if (kind === 'gpu') return [3.2, 1.6, 1.4]
  if (kind === 'baggage_tug' || kind === 'belt_loader' || kind === 'bags') return [6.5, 1.8, 1.6]
  return [4.5, 1.9, 1.8]
}

function crewSpot(at: 'cab' | 'ground' | 'lift' | 'galley', lift: number, helper: boolean): { x: number; y: number; z: number } {
  const side = helper ? -1 : 1
  if (at === 'cab') return { x: wu(2.4) * side, y: wu(1.7), z: wu(0.35) }
  if (at === 'ground') return { x: wu(0.4) * side, y: wu(0.9), z: wu(1.7) }
  if (at === 'lift') return { x: wu(-1.2) * side, y: wu(1.4 + lift * 2.6), z: wu(-1.6) }
  return { x: wu(-2.0), y: wu(2.6 + lift * 0.6), z: wu(-1.9) }
}

const CATER_MAST_M = 2.2

function makeCateringRig(): THREE.Group {
  const g = new THREE.Group()
  const bodyL = wu(8.5)
  const bodyH = wu(3.2)
  const bodyW = wu(2.5)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyL, bodyH, bodyW),
    new THREE.MeshStandardMaterial({ color: '#e07a3d', roughness: 0.45 }),
  )
  body.position.y = bodyH / 2
  body.castShadow = true
  g.add(body)
  const mastH = wu(CATER_MAST_M)
  const mast = new THREE.Mesh(
    new THREE.BoxGeometry(wu(0.18), mastH, wu(0.18)),
    new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.5 }),
  )
  mast.name = 'mast'
  mast.position.set(-bodyL * 0.28, mastH / 2, -bodyW * 0.42)
  g.add(mast)
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(wu(1.6), wu(0.12), wu(1.1)),
    new THREE.MeshStandardMaterial({ color: '#d8dee6', roughness: 0.4 }),
  )
  platform.name = 'platform'
  platform.position.set(-bodyL * 0.28, wu(1.2), -bodyW * 0.55)
  g.add(platform)
  const personR = wu(0.22)
  const personL = wu(1.75 - 0.44)
  for (const role of ['driver', 'helper'] as const) {
    const cap = new THREE.Mesh(
      new THREE.CapsuleGeometry(personR, personL, 3, 6),
      new THREE.MeshLambertMaterial({ color: role === 'driver' ? '#1f3a5a' : '#6a4328' }),
    )
    cap.name = role
    cap.castShadow = true
    g.add(cap)
  }
  return g
}

export class World {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  pivot = new THREE.Vector3(0, 0, 0)
  yaw = 0.72
  pitch = 0.68
  dist = 88
  dragging: 'orbit' | 'pan' | 'pending' | 'paint' | null = null
  lastX = 0
  lastY = 0
  downX = 0
  downY = 0
  tilesGroup = new THREE.Group()
  entGroup = new THREE.Group()
  ghostGroup = new THREE.Group()
  siteGroup = new THREE.Group()
  /** Empty-gate jet bridges. Kept off tilesGroup so releaseTiles cannot dispose shared bridge geometry. */
  gateGroup = new THREE.Group()
  parkedFleet = new ParkedFleet()
  tileHash = ''
  private gateHash = ''
  ghostHash = ''
  jets = new Map<string, THREE.Group>()
  trucks = new Map<string, THREE.Object3D>()
  service = new Map<string, THREE.Object3D>()
  cateringCrew = new Map<string, THREE.Group>()
  people = new Map<string, THREE.Mesh>()
  private beltCubes: THREE.Mesh[] = []
  private beltPath: THREE.Vector3[] = []
  private beltRev = -1
  ray = new THREE.Raycaster()
  ndc = new THREE.Vector2()
  ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  hit = new THREE.Vector3()
  sun: THREE.DirectionalLight
  onHover: (v: Vec | null) => void = () => {}
  onClick: (v: Vec, shift: boolean) => void = () => {}
  getTool: () => string = () => 'pan'
  lastPaint: Vec | null = null
  private liteMode = false
  private lastFrame = performance.now()
  /** Textured airfield, sky, and living terminals. See docs/GRAPHICS.md. */
  wr: WorldRender
  private canvas: HTMLCanvasElement
  private onPointerDown!: (e: PointerEvent) => void
  private onPointerMove!: (e: PointerEvent) => void
  private onPointerUp!: (e: PointerEvent) => void
  private onWheel!: (e: WheelEvent) => void
  private onContextMenu!: (e: Event) => void
  /** True after pointerdown already stamped — blocks duplicate up/down fires. */
  private paintedThisGesture = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    // Cap DPR + shadows — software GL / cloud desktops hitch hard at 2× + 2k maps.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.BasicShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#87b7d9')
    this.scene.fog = new THREE.Fog('#9fc5dd', 220, 640)

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 1200)
    this.placeCam()

    const hemi = new THREE.HemisphereLight('#e8f3ff', '#6b8a4a', 0.85)
    this.scene.add(hemi)
    this.sun = new THREE.DirectionalLight('#fff3d4', 1.2)
    this.sun.position.set(40, 70, 18)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.camera.near = 10
    this.sun.shadow.camera.far = 400
    this.sun.shadow.camera.left = -140
    this.sun.shadow.camera.right = 140
    this.sun.shadow.camera.top = 140
    this.sun.shadow.camera.bottom = -140
    this.scene.add(this.sun)
    this.scene.add(new THREE.AmbientLight('#b9c9a8', 0.28))

    const earth = new THREE.Mesh(
      new THREE.CircleGeometry(420, 48),
      new THREE.MeshLambertMaterial({ color: '#2d5a34' }),
    )
    earth.rotation.x = -Math.PI / 2
    earth.position.y = -0.08
    earth.receiveShadow = true
    this.scene.add(earth)

    this.gateGroup.name = 'gate-bridges'
    this.scene.add(this.tilesGroup)
    this.scene.add(this.gateGroup)
    this.scene.add(this.entGroup)
    this.entGroup.add(this.parkedFleet.root)
    this.scene.add(this.ghostGroup)
    this.scene.add(this.siteGroup)
    loadAircraftQuality()
    this.addPlotFence()
    this.addHorizon()
    this.bind(canvas)
    this.wr = initWorldRender(this.scene, this.pickQuality(), {
      renderer: this.renderer,
      sun: this.sun,
    })
  }

  /** Saved `hatchfield-gfx`, otherwise a guess (software GL starts on low). */
  private pickQuality(): QualityLevel {
    let saved: string | null = null
    try {
      saved = globalThis.localStorage?.getItem('hatchfield-gfx') ?? null
    } catch {
      saved = null
    }
    if (saved) return parseQuality(saved)
    let gpu = ''
    try {
      const gl = this.renderer.getContext()
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      if (dbg) gpu = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
    } catch {
      gpu = ''
    }
    const nav = navigator as Navigator & { deviceMemory?: number }
    return suggestQuality({
      renderer: gpu,
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: nav.hardwareConcurrency,
    })
  }

  addPlotFence() {
    const e = (SIZE * CELL) / 2
    const pts = [
      new THREE.Vector3(-e, 0.25, -e),
      new THREE.Vector3(e, 0.25, -e),
      new THREE.Vector3(e, 0.25, e),
      new THREE.Vector3(-e, 0.25, e),
      new THREE.Vector3(-e, 0.25, -e),
    ]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    this.scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#e6c85a' })))
  }

  addHorizon() {
    const g = new THREE.CircleGeometry(200, 40)
    const m = new THREE.MeshBasicMaterial({
      color: '#cfe4f2',
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    })
    const disc = new THREE.Mesh(g, m)
    disc.rotation.x = -Math.PI / 2
    // Under the earth disc. At y = 0.02 this sat on the tiles, z-fought them, and washed the field blue.
    disc.position.y = -0.2
    this.scene.add(disc)
  }

  bind(canvas: HTMLCanvasElement) {
    this.onContextMenu = (e) => e.preventDefault()
    this.onPointerDown = (e: PointerEvent) => {
      const tool = this.getTool()
      this.paintedThisGesture = false
      // Middle (1) or right (2) = orbit. Left + build tool = one stamp. Left + select = click/pan.
      if (e.button === 1 || e.button === 2) this.dragging = 'orbit'
      else if (e.button === 0 && tool !== 'pan') this.dragging = 'paint'
      else if (e.button === 0) this.dragging = 'pending'
      else this.dragging = 'orbit'
      this.lastX = e.clientX
      this.lastY = e.clientY
      this.downX = e.clientX
      this.downY = e.clientY
      this.lastPaint = null
      if (this.dragging === 'paint') {
        const v = this.pick(e)
        if (v) {
          this.lastPaint = v
          this.paintedThisGesture = true
          this.onClick(v, false)
        }
      }
      canvas.setPointerCapture(e.pointerId)
    }
    this.onPointerMove = (e: PointerEvent) => {
      const v = this.pick(e)
      this.onHover(v)
      if (!this.dragging) return
      // Single-click stamps only — no drag-paint (prevents multi-place feel).
      if (this.dragging === 'paint') return
      if (this.dragging === 'pending') {
        const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY)
        if (dist < 8) return
        this.dragging = 'pan'
      }
      const dx = e.clientX - this.lastX
      const dy = e.clientY - this.lastY
      this.lastX = e.clientX
      this.lastY = e.clientY
      if (this.dragging === 'orbit') {
        this.yaw -= dx * 0.007
        this.pitch = clamp(this.pitch - dy * 0.005, 0.28, 1.35)
        this.placeCam()
      } else if (this.dragging === 'pan') {
        this.nudgePan(-dx * 0.08, dy * 0.08)
      }
    }
    this.onPointerUp = (e: PointerEvent) => {
      const was = this.dragging
      this.dragging = null
      if (was === 'pending' && e.button === 0 && !this.paintedThisGesture) {
        const v = this.pick(e)
        if (v) this.onClick(v, e.shiftKey)
      }
      this.lastPaint = null
      this.paintedThisGesture = false
    }
    this.onWheel = (e: WheelEvent) => {
      e.preventDefault()
      this.dist = clamp(this.dist + e.deltaY * 0.06, MIN_DIST, MAX_DIST)
      this.placeCam()
    }
    canvas.addEventListener('contextmenu', this.onContextMenu)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  /** Keyboard / UI pan in camera-local ground plane. */
  nudgePan(rightAmt: number, forwardAmt: number) {
    const right = new THREE.Vector3()
    this.camera.getWorldDirection(right)
    const forward = right.clone()
    right.cross(this.camera.up).normalize()
    forward.y = 0
    forward.normalize()
    this.pivot.addScaledVector(right, rightAmt)
    this.pivot.addScaledVector(forward, forwardAmt)
    this.placeCam()
  }

  nudgeYaw(delta: number) {
    this.yaw += delta
    this.placeCam()
  }

  nudgeZoom(delta: number) {
    this.dist = clamp(this.dist + delta, MIN_DIST, MAX_DIST)
    this.placeCam()
  }

  pick(e: PointerEvent | MouseEvent): Vec | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.ray.setFromCamera(this.ndc, this.camera)
    const ok = this.ray.ray.intersectPlane(this.ground, this.hit)
    if (!ok) return null
    const c = Math.round(this.hit.x / CELL + (SIZE - 1) / 2)
    const r = Math.round(this.hit.z / CELL + (SIZE - 1) / 2)
    if (c < -1 || r < -1 || c > SIZE || r > SIZE) return null
    return {
      c: clamp(c, 0, SIZE - 1),
      r: clamp(r, 0, SIZE - 1),
    }
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
    if (needsResize(canvas.width, canvas.height, w, h, this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / Math.max(1, h)
      this.camera.updateProjectionMatrix()
    }
  }

  /** Drop per-tile geometries and materials before the group forgets them. */
  private releaseTiles() {
    const geos = new Set<THREE.BufferGeometry>()
    const mats = new Set<THREE.Material>()
    this.tilesGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) geos.add(mesh.geometry)
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) for (const m of mat) mats.add(m)
      else if (mat) mats.add(mat)
    })
    for (const g of geos) g.dispose()
    for (const m of mats) m.dispose()
    this.tilesGroup.clear()
  }

  rebuildTiles(game: Game) {
    // Cheap revision check — avoid flattening 32² tiles into a string every frame.
    const hash = `${game.mapRev}|${game.lateMeshSig()}`
    if (hash !== this.tileHash) {
      this.tileHash = hash
      this.releaseTiles()
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const tile = game.tiles[r][c]
          // The world layer redraws these. A second mesh per cell was most of the frame cost.
          if (REPLACED_TILES.has(tile)) continue
          const pos = toWorld(c, r, 0.02)
          const key = `${c},${r}`
          this.tilesGroup.add(
            this.building(tile, pos, {
              hotelClass: game.hotelClass[key],
              parkTerm: game.parkTerms[key],
              lateOpen: game.lateOpenAt(c, r),
            }),
          )
        }
      }
      this.gateHash = ''
    }
    this.syncGateBridges(game)
  }

  /** Stand class and jetway links can change without a map revision. */
  private gateSig(game: Game): string {
    const cls = Object.entries(game.standClass)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join(',')
    const acc = Object.entries(game.standAccess)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join(',')
    return `${game.mapRev}|${game.standAccessMode}|${game.fits.length}|${cls}|${acc}`
  }

  private syncGateBridges(game: Game) {
    const sig = this.gateSig(game)
    if (sig !== this.gateHash) {
      this.gateHash = sig
      this.rebuildGateBridges(game)
    }
    const parked = new Set<string>()
    for (const f of game.flights) {
      if (f.phase !== 'parked' || !f.stand) continue
      parked.add(`${f.stand.c},${f.stand.r}`)
    }
    for (const child of this.gateGroup.children) {
      const key = child.userData.standKey as string
      child.visible = !parked.has(key)
    }
  }

  /**
   * Preview bridges on empty jetway stands. Local +Z aims at the nearest terminal.
   * Shared bridge materials stay alive — this group is not released with the tiles.
   */
  private rebuildGateBridges(game: Game) {
    this.gateGroup.clear()
    const terminals: Vec[] = []
    for (let r = 0; r < SIZE; r++) {
      const row = game.tiles[r]
      if (!row) continue
      for (let c = 0; c < SIZE; c++) {
        if (row[c] === 'terminal') terminals.push({ c, r })
      }
    }
    if (!terminals.length) return
    for (let r = 0; r < SIZE; r++) {
      const row = game.tiles[r]
      if (!row) continue
      for (let c = 0; c < SIZE; c++) {
        if (row[c] !== 'stand') continue
        const stand = { c, r }
        if (game.standAccessAt(stand) !== 'jetway') continue
        let best = terminals[0]
        let bestD = Infinity
        for (const t of terminals) {
          const d = Math.abs(t.c - c) + Math.abs(t.r - r)
          if (d < bestD) {
            best = t
            bestD = d
          }
        }
        if (bestD > 8) continue
        const preview = createBridges(gatePreviewId(game.standClassAt(stand)))
        preview.position.copy(toWorld(c, r, 0.04))
        preview.rotation.y = bridgeYawToward(stand, best)
        preview.userData.standKey = `${c},${r}`
        this.gateGroup.add(preview)
      }
    }
  }

  building(
    tile: Tile,
    pos: THREE.Vector3,
    opts: { hotelClass?: HotelClass; parkTerm?: ParkTerm; lateOpen?: boolean } = {},
  ): THREE.Group {
    const g = new THREE.Group()
    g.position.copy(pos)
    if (tile === 'terminal') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.92, 3.4, CELL * 0.92),
        new THREE.MeshStandardMaterial({
          color: '#e8eef4',
          roughness: 0.42,
          metalness: 0.08,
        }),
      )
      body.position.y = 1.7
      body.castShadow = true
      body.receiveShadow = true
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 1.02, 0.18, CELL * 1.02),
        new THREE.MeshStandardMaterial({ color: '#2f6f9a', roughness: 0.5 }),
      )
      roof.position.y = 3.5
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.78, 1.1, 0.08),
        new THREE.MeshStandardMaterial({
          color: '#7ec3e8',
          emissive: '#1a3a55',
          emissiveIntensity: 0.2,
          roughness: 0.12,
          metalness: 0.4,
        }),
      )
      glass.position.set(0, 1.6, CELL * 0.46)
      g.add(body, roof, glass)
    } else if (tile === 'snack') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 1.6, CELL * 0.7),
        new THREE.MeshStandardMaterial({ color: '#d9a441' }),
      )
      body.position.y = 0.8
      body.castShadow = true
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.85, 0.12, CELL * 0.5),
        new THREE.MeshStandardMaterial({ color: '#b33' }),
      )
      awning.position.set(0, 1.55, 0.6)
      g.add(body, awning)
    } else if (tile === 'bags') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.78, 2.1, CELL * 0.7),
        new THREE.MeshStandardMaterial({ color: '#8a909a' }),
      )
      body.position.y = 1.05
      body.castShadow = true
      g.add(body)
    } else if (tile === 'belt') {
      // Low conveyor strip — distinct from taxi/road so broken chains read on the apron.
      const deck = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.42),
        new THREE.MeshLambertMaterial({ color: '#2a3238' }),
      )
      deck.rotation.x = -Math.PI / 2
      deck.position.y = 0.05
      deck.receiveShadow = true
      const railA = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.88, 0.08, 0.06),
        new THREE.MeshStandardMaterial({
          color: '#c9a227',
          emissive: '#5a4810',
          emissiveIntensity: 0.25,
          roughness: 0.45,
        }),
      )
      railA.position.set(0, 0.1, -CELL * 0.14)
      const railB = railA.clone()
      railB.position.z = CELL * 0.14
      const roller = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 0.06, CELL * 0.18),
        new THREE.MeshStandardMaterial({
          color: '#5a6a78',
          metalness: 0.35,
          roughness: 0.4,
        }),
      )
      roller.position.y = 0.09
      g.add(deck, railA, railB, roller)
    } else if (tile === 'fuel') {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 2.4, 16),
        new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.45, roughness: 0.35 }),
      )
      tank.position.y = 1.2
      tank.castShadow = true
      g.add(tank)
    } else if (tile === 'fire') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.75, 2.2, CELL * 0.7),
        new THREE.MeshStandardMaterial({ color: '#b33a2a' }),
      )
      body.position.y = 1.1
      body.castShadow = true
      const bay = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.5, 1.1, 0.12),
        new THREE.MeshStandardMaterial({ color: '#f0c040' }),
      )
      bay.position.set(0, 0.9, CELL * 0.36)
      g.add(body, bay)
    } else if (tile === 'police') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 2.0, CELL * 0.65),
        new THREE.MeshStandardMaterial({ color: '#1e3a5f' }),
      )
      body.position.y = 1.0
      body.castShadow = true
      g.add(body)
    } else if (tile === 'cargo') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.9, 2.6, CELL * 0.85),
        new THREE.MeshStandardMaterial({ color: '#6a6258' }),
      )
      body.position.y = 1.3
      body.castShadow = true
      g.add(body)
    } else if (tile === 'guard') {
      // City-edge booth — screens inbound trucks.
      const booth = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 1.7, CELL * 0.55),
        new THREE.MeshStandardMaterial({ color: '#3d4a3a', roughness: 0.55 }),
      )
      booth.position.y = 0.85
      booth.castShadow = true
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.85, 0.1, 0.12),
        new THREE.MeshStandardMaterial({
          color: '#c9a227',
          emissive: '#4a3a10',
          emissiveIntensity: 0.2,
        }),
      )
      bar.position.set(0, 1.15, CELL * 0.28)
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.35, 0.18),
        new THREE.MeshStandardMaterial({
          color: '#e8d080',
          emissive: '#8a7020',
          emissiveIntensity: 0.35,
        }),
      )
      lamp.position.set(0, 1.9, 0)
      g.add(booth, bar, lamp)
    } else if (tile === 'road') {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.98, CELL * 0.98),
        new THREE.MeshLambertMaterial({ color: '#3a3d42' }),
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.03
      mesh.receiveShadow = true
      g.add(mesh)
    } else if (tile === 'tower') {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.9, 5.2, 8),
        new THREE.MeshStandardMaterial({ color: '#cfd8e3' }),
      )
      shaft.position.y = 2.6
      shaft.castShadow = true
      const cab = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.1, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: '#2f6f9a', metalness: 0.3 }),
      )
      cab.position.y = 5.4
      g.add(shaft, cab)
    } else if (tile === 'hangar') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.95, 3.2, CELL * 0.95),
        new THREE.MeshStandardMaterial({ color: '#7a8490' }),
      )
      body.position.y = 1.6
      body.castShadow = true
      g.add(body)
    } else if (tile === 'hotel') {
      this.addHotelBuilding(g, opts.hotelClass ?? 'business')
    } else if (
      tile === 'park_s' ||
      tile === 'park_l' ||
      tile === 'park_g' ||
      tile === 'park_u'
    ) {
      this.addParkBuilding(g, tile, opts.parkTerm ?? 'short')
    } else if (tile === 'helipad') {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(CELL * 0.42, CELL * 0.42, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: '#3a3f48', roughness: 0.55 }),
      )
      pad.position.y = 0.08
      pad.receiveShadow = true
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(CELL * 0.32, 0.05, 8, 28),
        new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.4 }),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.16
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.08, 0.06, CELL * 0.42),
        new THREE.MeshStandardMaterial({ color: '#e8eef4' }),
      )
      bar.position.y = 0.16
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.42, 0.06, CELL * 0.08),
        new THREE.MeshStandardMaterial({ color: '#e8eef4' }),
      )
      cross.position.y = 0.16
      g.add(pad, ring, bar, cross)
    } else if (tile === 'deice') {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95),
        new THREE.MeshLambertMaterial({ color: '#3a4a58' }),
      )
      pad.rotation.x = -Math.PI / 2
      pad.position.y = 0.04
      pad.receiveShadow = true
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 1.6, 12),
        new THREE.MeshStandardMaterial({
          color: '#4aa8c8',
          metalness: 0.35,
          roughness: 0.35,
        }),
      )
      tank.position.set(-CELL * 0.18, 0.85, 0)
      tank.castShadow = true
      const boom = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 0.12, 0.18),
        new THREE.MeshStandardMaterial({ color: '#e8eef4' }),
      )
      boom.position.set(CELL * 0.12, 1.35, 0)
      const drip = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.55, 0.14),
        new THREE.MeshStandardMaterial({
          color: '#7ec8e0',
          emissive: '#2a6070',
          emissiveIntensity: 0.25,
        }),
      )
      drip.position.set(CELL * 0.32, 1.0, 0)
      g.add(pad, tank, boom, drip)
    } else if (tile === 'bus') {
      const curb = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.55),
        new THREE.MeshLambertMaterial({ color: '#3d4248' }),
      )
      curb.rotation.x = -Math.PI / 2
      curb.position.y = 0.05
      curb.receiveShadow = true
      const shelter = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 1.4, 0.35),
        new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.45 }),
      )
      shelter.position.set(0, 0.75, -CELL * 0.25)
      shelter.castShadow = true
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: '#e8eef4' }),
      )
      pole.position.set(CELL * 0.28, 1.1, CELL * 0.1)
      g.add(curb, shelter, pole)
    } else if (tile === 'termbus') {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95),
        new THREE.MeshLambertMaterial({ color: '#2c3338' }),
      )
      pad.rotation.x = -Math.PI / 2
      pad.position.y = 0.04
      pad.receiveShadow = true
      const shed = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.75, 1.8, CELL * 0.55),
        new THREE.MeshStandardMaterial({ color: '#3d6a8a', roughness: 0.45 }),
      )
      shed.position.y = 0.95
      shed.castShadow = true
      const bus = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 0.7, CELL * 0.28),
        new THREE.MeshStandardMaterial({ color: '#e8c56a', roughness: 0.4 }),
      )
      bus.position.set(0, 0.45, CELL * 0.28)
      bus.castShadow = true
      g.add(pad, shed, bus)
    } else if (tile === 'rail') {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95),
        new THREE.MeshLambertMaterial({ color: '#2a3238' }),
      )
      pad.rotation.x = -Math.PI / 2
      pad.position.y = 0.04
      pad.receiveShadow = true
      const hall = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 2.4, CELL * 0.55),
        new THREE.MeshStandardMaterial({ color: '#8a9aaa', roughness: 0.4 }),
      )
      hall.position.y = 1.2
      hall.castShadow = true
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.9, 0.12, CELL * 0.75),
        new THREE.MeshStandardMaterial({ color: '#c9a227' }),
      )
      canopy.position.y = 2.5
      g.add(pad, hall, canopy)
    } else if (tile === 'kitchen') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.8, 2.2, CELL * 0.7),
        new THREE.MeshStandardMaterial({ color: '#e07a3d', roughness: 0.5 }),
      )
      body.position.y = 1.1
      body.castShadow = true
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.35, 0.45, CELL * 0.28),
        new THREE.MeshStandardMaterial({ color: '#f2d4b8', roughness: 0.4 }),
      )
      vent.position.set(0, 2.35, 0)
      vent.castShadow = true
      g.add(body, vent)
    } else if (tile === 'depot') {
      const shed = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.9, 1.8, CELL * 0.75),
        new THREE.MeshStandardMaterial({ color: '#3d6a8a', roughness: 0.45 }),
      )
      shed.position.y = 0.9
      shed.castShadow = true
      const bay = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 0.9, 0.12),
        new THREE.MeshStandardMaterial({ color: '#f2d24a' }),
      )
      bay.position.set(0, 0.7, CELL * 0.38)
      const truck = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.4, 0.45, CELL * 0.22),
        new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.4 }),
      )
      truck.position.set(0, 0.35, CELL * 0.22)
      truck.castShadow = true
      g.add(shed, bay, truck)
    } else if (tile === 'late_hotel') {
      this.addLateHotel(g)
    } else if (tile === 'late_rail') {
      if (opts.lateOpen === false) this.addRailScaffold(g)
      else this.addLateRail(g)
    } else if (tile === 'saf') {
      this.addSafPlant(g)
    }
    return g
  }

  /** Airport hotel — a short tower, not the landside inn. */
  addLateHotel(g: THREE.Group) {
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.92, 0.2, CELL * 0.92),
      new THREE.MeshStandardMaterial({ color: '#6a6e76', roughness: 0.8 }),
    )
    plinth.position.y = 0.1
    plinth.receiveShadow = true
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.62, 5.2, CELL * 0.5),
      new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.55 }),
    )
    tower.position.y = 2.8
    tower.castShadow = true
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.66, 0.35, CELL * 0.54),
      new THREE.MeshStandardMaterial({ color: '#2f6f9a', roughness: 0.4 }),
    )
    band.position.y = 4.6
    const pent = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.36, 0.7, CELL * 0.3),
      new THREE.MeshStandardMaterial({ color: '#8a939c', roughness: 0.45 }),
    )
    pent.position.y = 5.6
    pent.castShadow = true
    g.add(plinth, tower, band, pent)
  }

  /** Rail link under its 10-day build. */
  addRailScaffold(g: THREE.Group) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.9, 0.12, CELL * 0.9),
      new THREE.MeshStandardMaterial({ color: '#8a7048', roughness: 0.85 }),
    )
    pad.position.y = 0.06
    pad.receiveShadow = true
    const postMat = new THREE.MeshStandardMaterial({ color: '#c4a46a', roughness: 0.6 })
    const posts: THREE.Object3D[] = [pad]
    for (const [x, z] of [
      [-0.8, -0.8],
      [0.8, -0.8],
      [-0.8, 0.8],
      [0.8, 0.8],
    ] as const) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.14), postMat)
      post.position.set(x, 1.15, z)
      post.castShadow = true
      posts.push(post)
    }
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.7, 0.12, CELL * 0.7),
      new THREE.MeshStandardMaterial({ color: '#a88848', roughness: 0.55 }),
    )
    beam.position.y = 2.2
    posts.push(beam)
    g.add(...posts)
  }

  /** Open rail link — platform, rails, and a small hall. */
  addLateRail(g: THREE.Group) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.96, 0.16, CELL * 0.96),
      new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.7 }),
    )
    pad.position.y = 0.08
    pad.receiveShadow = true
    const railMat = new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.45, roughness: 0.35 })
    const railA = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.9, 0.08, 0.08), railMat)
    railA.position.set(0, 0.22, -0.35)
    const railB = railA.clone()
    railB.position.z = 0.35
    const hall = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.55, 2.2, CELL * 0.4),
      new THREE.MeshStandardMaterial({ color: '#8aa0b4', roughness: 0.45 }),
    )
    hall.position.set(0, 1.2, -CELL * 0.22)
    hall.castShadow = true
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.85, 0.1, CELL * 0.7),
      new THREE.MeshStandardMaterial({ color: '#2f6f9a', roughness: 0.4 }),
    )
    canopy.position.y = 2.4
    g.add(pad, railA, railB, hall, canopy)
  }

  /** SAF tanks beside a low blending shed. */
  addSafPlant(g: THREE.Group) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.94, 0.12, CELL * 0.94),
      new THREE.MeshStandardMaterial({ color: '#2c3338', roughness: 0.75 }),
    )
    pad.position.y = 0.06
    pad.receiveShadow = true
    const shed = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.42, 1.6, CELL * 0.55),
      new THREE.MeshStandardMaterial({ color: '#dfe6ea', roughness: 0.5 }),
    )
    shed.position.set(-CELL * 0.18, 0.9, 0)
    shed.castShadow = true
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.44, 0.22, CELL * 0.57),
      new THREE.MeshStandardMaterial({ color: '#3d8a4a', roughness: 0.45 }),
    )
    band.position.set(-CELL * 0.18, 1.35, 0)
    const tankMat = new THREE.MeshStandardMaterial({ color: '#e7eef2', metalness: 0.25, roughness: 0.35 })
    const tankA = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.7, 8), tankMat)
    tankA.position.set(CELL * 0.18, 0.95, -0.4)
    tankA.castShadow = true
    const tankB = tankA.clone()
    tankB.position.z = 0.4
    const pipe = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.1, 0.1),
      new THREE.MeshStandardMaterial({ color: '#3d8a4a', roughness: 0.4 }),
    )
    pipe.position.set(0.05, 1.15, 0)
    g.add(pad, shed, band, tankA, tankB, pipe)
  }

  /** Outside hotel grades — real buildings, not flat pads. */
  addHotelBuilding(g: THREE.Group, cls: HotelClass) {
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.96, 0.18, CELL * 0.96),
      new THREE.MeshStandardMaterial({ color: '#6a6e76', roughness: 0.8 }),
    )
    plinth.position.y = 0.09
    plinth.receiveShadow = true
    g.add(plinth)

    if (cls === 'inn') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.82, 2.6, CELL * 0.7),
        new THREE.MeshStandardMaterial({ color: '#c9b08a', roughness: 0.55 }),
      )
      body.position.y = 1.45
      body.castShadow = true
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(CELL * 0.62, 1.1, 4),
        new THREE.MeshStandardMaterial({ color: '#6b3a2a', roughness: 0.65 }),
      )
      roof.position.y = 3.3
      roof.rotation.y = Math.PI / 4
      roof.castShadow = true
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.45, 0.1, CELL * 0.28),
        new THREE.MeshStandardMaterial({ color: '#2f6f9a' }),
      )
      awning.position.set(0, 1.55, CELL * 0.38)
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 1.1, 0.08),
        new THREE.MeshStandardMaterial({ color: '#3a2a1a' }),
      )
      door.position.set(0, 0.75, CELL * 0.36)
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.35, 0.28, 0.06),
        new THREE.MeshStandardMaterial({
          color: '#c9a227',
          emissive: '#6a5010',
          emissiveIntensity: 0.2,
        }),
      )
      sign.position.set(0, 2.35, CELL * 0.37)
      for (const dx of [-0.9, 0.9]) {
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.55, 0.06),
          new THREE.MeshStandardMaterial({
            color: '#7ec3e8',
            emissive: '#1a3a55',
            emissiveIntensity: 0.25,
            roughness: 0.15,
          }),
        )
        win.position.set(dx, 1.85, CELL * 0.36)
        g.add(win)
      }
      g.add(body, roof, awning, door, sign)
      return
    }

    if (cls === 'resort') {
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.72, 7.2, CELL * 0.62),
        new THREE.MeshStandardMaterial({ color: '#d8e0e8', roughness: 0.35, metalness: 0.15 }),
      )
      tower.position.y = 3.7
      tower.castShadow = true
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.58, 5.8, 0.08),
        new THREE.MeshStandardMaterial({
          color: '#5eb8d8',
          emissive: '#163848',
          emissiveIntensity: 0.3,
          roughness: 0.1,
          metalness: 0.45,
        }),
      )
      glass.position.set(0, 3.4, CELL * 0.32)
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.95, 2.2, CELL * 0.55),
        new THREE.MeshStandardMaterial({ color: '#b8c4ce', roughness: 0.45 }),
      )
      wing.position.set(0, 1.2, -CELL * 0.12)
      wing.castShadow = true
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 0.12, CELL * 0.45),
        new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.3 }),
      )
      canopy.position.set(0, 2.4, CELL * 0.4)
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.78, 0.45, CELL * 0.68),
        new THREE.MeshStandardMaterial({
          color: '#2f6f9a',
          emissive: '#1a3a55',
          emissiveIntensity: 0.15,
        }),
      )
      crown.position.y = 7.5
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6),
        new THREE.MeshStandardMaterial({ color: '#e8eef4' }),
      )
      mast.position.y = 8.2
      g.add(tower, glass, wing, canopy, crown, mast)
      // Window grid on sides
      for (let floor = 0; floor < 5; floor++) {
        for (const side of [-1, 1] as const) {
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.45, 0.7),
            new THREE.MeshStandardMaterial({
              color: '#7ec3e8',
              emissive: '#1a3a55',
              emissiveIntensity: 0.2,
            }),
          )
          win.position.set(side * CELL * 0.37, 2.2 + floor * 1.05, 0)
          g.add(win)
        }
      }
      return
    }

    // Business mid-rise
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.86, 4.8, CELL * 0.74),
      new THREE.MeshStandardMaterial({ color: '#c4b49a', roughness: 0.5 }),
    )
    body.position.y = 2.5
    body.castShadow = true
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.92, 0.28, CELL * 0.8),
      new THREE.MeshStandardMaterial({ color: '#4a4038' }),
    )
    roof.position.y = 5.05
    const entry = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.5, 1.6, CELL * 0.22),
      new THREE.MeshStandardMaterial({ color: '#8a9088', roughness: 0.4 }),
    )
    entry.position.set(0, 0.9, CELL * 0.42)
    entry.castShadow = true
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.62, 0.1, CELL * 0.35),
      new THREE.MeshStandardMaterial({ color: '#2f6f9a' }),
    )
    canopy.position.set(0, 1.85, CELL * 0.48)
    g.add(body, roof, entry, canopy)
    for (let floor = 0; floor < 3; floor++) {
      for (const dx of [-1.15, 0, 1.15]) {
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.55, 0.06),
          new THREE.MeshStandardMaterial({
            color: '#7ec3e8',
            emissive: '#1a3a55',
            emissiveIntensity: 0.22,
            roughness: 0.12,
          }),
        )
        win.position.set(dx, 2.4 + floor * 0.95, CELL * 0.38)
        g.add(win)
      }
    }
  }

  /** Four park versions × short/long term paint — real buildings / structures. */
  addParkBuilding(
    g: THREE.Group,
    kind: 'park_s' | 'park_l' | 'park_g' | 'park_u',
    term: ParkTerm,
  ) {
    const accent = term === 'short' ? '#3a8fd4' : '#d4782a'
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95),
      new THREE.MeshLambertMaterial({
        color: kind === 'park_u' ? '#2a3038' : kind === 'park_g' ? '#3a4550' : '#3d4248',
      }),
    )
    pad.rotation.x = -Math.PI / 2
    pad.position.y = 0.03
    pad.receiveShadow = true
    g.add(pad)

    // Stall stripes on surface lots
    if (kind === 'park_s' || kind === 'park_l') {
      for (let i = 0; i < (kind === 'park_l' ? 5 : 3); i++) {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(0.08, CELL * 0.55),
          new THREE.MeshLambertMaterial({ color: '#e8eef4' }),
        )
        stripe.rotation.x = -Math.PI / 2
        stripe.position.set(-CELL * 0.28 + i * (kind === 'park_l' ? 0.55 : 0.7), 0.04, 0.15)
        g.add(stripe)
      }
    }

    if (kind === 'park_s') {
      // Small lot — ticket booth + boom arm
      const booth = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.5, 1.1),
        new THREE.MeshStandardMaterial({ color: '#e8eef4', roughness: 0.45 }),
      )
      booth.position.set(-CELL * 0.28, 0.85, -CELL * 0.28)
      booth.castShadow = true
      const boothRoof = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.15, 1.35),
        new THREE.MeshStandardMaterial({ color: accent }),
      )
      boothRoof.position.set(-CELL * 0.28, 1.7, -CELL * 0.28)
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.45, 0.06),
        new THREE.MeshStandardMaterial({
          color: '#7ec3e8',
          emissive: '#1a3a55',
          emissiveIntensity: 0.2,
        }),
      )
      window.position.set(-CELL * 0.28, 1.05, -CELL * 0.28 + 0.56)
      const boom = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 0.08, 0.08),
        new THREE.MeshStandardMaterial({ color: '#e8c44a' }),
      )
      boom.position.set(CELL * 0.05, 0.95, -CELL * 0.28)
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6),
        new THREE.MeshStandardMaterial({ color: '#c9c4b0' }),
      )
      pole.position.set(-CELL * 0.05, 0.55, -CELL * 0.28)
      g.add(booth, boothRoof, window, boom, pole)
      return
    }

    if (kind === 'park_l') {
      // Large lot — entry canopy building + dual lamps
      const office = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.55, 2.2, CELL * 0.4),
        new THREE.MeshStandardMaterial({ color: '#b8c0c8', roughness: 0.5 }),
      )
      office.position.set(-CELL * 0.2, 1.2, -CELL * 0.28)
      office.castShadow = true
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.9, 0.14, CELL * 0.55),
        new THREE.MeshStandardMaterial({ color: accent, metalness: 0.25 }),
      )
      canopy.position.set(0.2, 2.45, -CELL * 0.1)
      canopy.castShadow = true
      const pillarL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 2.3, 8),
        new THREE.MeshStandardMaterial({ color: '#8a9098' }),
      )
      pillarL.position.set(-CELL * 0.25, 1.15, CELL * 0.12)
      const pillarR = pillarL.clone()
      pillarR.position.set(CELL * 0.35, 1.15, CELL * 0.12)
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.4, 0.35, 0.08),
        new THREE.MeshStandardMaterial({
          color: accent,
          emissive: accent,
          emissiveIntensity: 0.15,
        }),
      )
      sign.position.set(-CELL * 0.2, 2.0, -CELL * 0.08)
      for (const [x, z] of [
        [CELL * 0.32, CELL * 0.32],
        [-CELL * 0.32, CELL * 0.32],
      ] as const) {
        const lamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6),
          new THREE.MeshStandardMaterial({ color: '#c9c4b0' }),
        )
        lamp.position.set(x, 1.2, z)
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.12, 0.25),
          new THREE.MeshStandardMaterial({
            color: '#f0f4a8',
            emissive: '#a0a040',
            emissiveIntensity: 0.35,
          }),
        )
        head.position.set(x, 2.45, z)
        g.add(lamp, head)
      }
      g.add(office, canopy, pillarL, pillarR, sign)
      return
    }

    if (kind === 'park_g') {
      // Multi-level parking garage building
      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.92, 4.6, CELL * 0.92),
        new THREE.MeshStandardMaterial({ color: '#7a8490', roughness: 0.65 }),
      )
      shell.position.y = 2.4
      shell.castShadow = true
      shell.receiveShadow = true
      g.add(shell)
      for (let floor = 0; floor < 4; floor++) {
        const deck = new THREE.Mesh(
          new THREE.BoxGeometry(CELL * 0.94, 0.16, CELL * 0.94),
          new THREE.MeshStandardMaterial({ color: '#5a646e' }),
        )
        deck.position.y = 0.9 + floor * 1.15
        g.add(deck)
        // Open parking bays on front face
        for (const dx of [-1.2, 0, 1.2]) {
          const bay = new THREE.Mesh(
            new THREE.BoxGeometry(0.95, 0.75, 0.08),
            new THREE.MeshStandardMaterial({
              color: '#1a2028',
              roughness: 0.9,
            }),
          )
          bay.position.set(dx, 1.35 + floor * 1.15, CELL * 0.47)
          g.add(bay)
        }
      }
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.35, 0.2, CELL * 0.85),
        new THREE.MeshStandardMaterial({ color: '#4a5058' }),
      )
      ramp.position.set(CELL * 0.28, 0.55, 0)
      ramp.rotation.x = -0.35
      const badge = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.5, 0.4, 0.1),
        new THREE.MeshStandardMaterial({
          color: accent,
          emissive: accent,
          emissiveIntensity: 0.2,
        }),
      )
      badge.position.set(0, 5.0, CELL * 0.48)
      const parapet = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.96, 0.35, CELL * 0.96),
        new THREE.MeshStandardMaterial({ color: '#6a7480' }),
      )
      parapet.position.y = 4.85
      g.add(ramp, badge, parapet)
      return
    }

    // Underground — portal building + ramp into ground
    const portal = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.7, 2.8, CELL * 0.45),
      new THREE.MeshStandardMaterial({ color: '#8a949e', roughness: 0.45 }),
    )
    portal.position.set(0, 1.5, -CELL * 0.2)
    portal.castShadow = true
    const atrium = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.5, 1.6, 0.08),
      new THREE.MeshStandardMaterial({
        color: '#5eb8d8',
        emissive: '#163848',
        emissiveIntensity: 0.25,
        roughness: 0.12,
        metalness: 0.4,
      }),
    )
    atrium.position.set(0, 1.7, -CELL * 0.2 + 0.24)
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.55, 1.4, CELL * 0.5),
      new THREE.MeshStandardMaterial({ color: '#1a2028', roughness: 0.9 }),
    )
    mouth.position.set(0, 0.75, CELL * 0.15)
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.5, 0.18, CELL * 0.7),
      new THREE.MeshStandardMaterial({ color: '#3a4048' }),
    )
    ramp.position.set(0, 0.25, CELL * 0.2)
    ramp.rotation.x = 0.4
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.8, 0.2, CELL * 0.55),
      new THREE.MeshStandardMaterial({ color: accent }),
    )
    roof.position.set(0, 3.0, -CELL * 0.2)
    const vent = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: '#5a6068' }),
    )
    vent.position.set(CELL * 0.28, 0.4, CELL * 0.28)
    g.add(portal, atrium, mouth, ramp, roof, vent)
  }

  /**
   * 5× fast-forward asks the world layer for its light mode (shadows and the grass ring off).
   * Leaving 5× must not force shadows back on — a low quality preset keeps them off.
   * Runs before `wr.update`, which only latches light mode on.
   */
  applyPerfMode(game: Game) {
    const lite = game.speed >= 5
    if (lite === this.liteMode) return
    this.liteMode = lite
    this.wr.setLiteMode(lite)
  }

  syncGhost(game: Game) {
    const h = game.hover
    const next = `${game.tool}|${game.facing}|${h ? `${h.c},${h.r}` : ''}|${game.mapRev}`
    if (next === this.ghostHash) return
    this.ghostHash = next
    this.clearGhost()
    const cells = game.ghostCells(game.hover)
    const geo = new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95)
    geo.rotateX(-Math.PI / 2)
    const ok = new THREE.MeshBasicMaterial({
      color: '#7dff9a',
      transparent: true,
      opacity: 0.38,
    })
    const bad = new THREE.MeshBasicMaterial({
      color: '#ff6b6b',
      transparent: true,
      opacity: 0.38,
    })
    const stampRunway =
      game.tool === 'runway' ||
      game.tool === 'runway_heavy' ||
      game.tool === 'runway_short'
    const runwayReady =
      stampRunway &&
      cells.length > 1 &&
      cells.every((p) => inBounds(p.c, p.r) && game.tile(p) === 'grass')
    for (const p of cells) {
      if (p.c < 0) continue
      const t = game.tile(p)
      const clear = t === 'grass' || game.tool === 'clear'
      const ready = stampRunway ? runwayReady : clear
      const mesh = new THREE.Mesh(geo, ready ? ok : bad)
      mesh.position.copy(toWorld(p.c, p.r, 0.12))
      this.ghostGroup.add(mesh)
    }
  }

  /**
   * Aircraft use meters × WORLD_PER_METER × AIRCRAFT_VISUAL_SCALE.
   * Jetway bridges parent on the aircraft root while parked.
   * Remote duplicates share a parked batch.
   */
  private syncAircraft(game: Game) {
    const groups = new Map<string, Game['flights']>()
    for (const f of game.flights) {
      if (f.phase !== 'parked' || f.craft === 'helo' || game.selectedFlight === f.id) continue
      const cell = { c: Math.round(f.x), r: Math.round(f.y) }
      if (game.standAccessAt(cell) === 'jetway') continue
      const paint = flightLivery(game, f)
      const key = `${f.airframeId}|${paint.body}|${paint.stripe}`
      const list = groups.get(key)
      if (list) list.push(f)
      else groups.set(key, [f])
    }
    const batched = new Set<string>()
    const planes: ParkedPlane[] = []
    for (const list of groups.values()) {
      if (list.length < 2) continue
      for (const f of list) {
        batched.add(f.id)
        const alt = Math.max(0, f.z - 0.1)
        _euler.set(0, -f.heading, 0)
        _quat.setFromEuler(_euler)
        const visual = aircraftWorldPerMeter()
        _scale.set(visual, visual, visual)
        planes.push({
          id: f.id,
          airframeId: f.airframeId || 'b738',
          livery: flightLivery(game, f),
          matrix: new THREE.Matrix4().compose(toWorld(f.x, f.y, 0.04 + alt), _quat, _scale),
        })
      }
    }
    for (const id of batched) {
      const old = this.jets.get(id)
      if (!old) continue
      releaseAircraft(old)
      this.jets.delete(id)
    }
    this.parkedFleet.sync(planes, this.camera)

    const seen = new Set<string>()
    for (const f of game.flights) {
      if (batched.has(f.id)) continue
      seen.add(f.id)
      let mesh = this.jets.get(f.id)
      const paint = flightLivery(game, f)
      if (!mesh) {
        mesh = createAircraft(f.airframeId || 'b738', paint)
        this.jets.set(f.id, mesh)
        this.entGroup.add(mesh)
      }
      const alt = Math.max(0, f.z - 0.1)
      mesh.position.copy(toWorld(f.x, f.y, 0.04 + alt))
      mesh.rotation.y = -f.heading
      mesh.rotation.x =
        f.craft === 'helo' ? 0 : f.phase === 'takeoff' || f.phase === 'approach' ? -0.12 : 0
      const gearDown = !(
        f.phase === 'hold' ||
        f.phase === 'gone' ||
        (f.phase === 'takeoff' && f.z > 1.6) ||
        (f.phase === 'approach' && f.z > 3.2)
      )
      updateAircraft(mesh, gearDown)
      const cell = { c: Math.round(f.x), r: Math.round(f.y) }
      const jetway = f.craft !== 'helo' && f.phase === 'parked' && game.standAccessAt(cell) === 'jetway'
      const bridges = mesh.getObjectByName('bridges')
      if (jetway) {
        if (!bridges) mesh.add(createBridges(f.airframeId || 'b738'))
      } else if (bridges) {
        mesh.remove(bridges)
      }
      mesh.scale.setScalar(game.selectedFlight === f.id ? 1.06 : 1)
    }
    for (const [id, mesh] of this.jets) {
      if (seen.has(id)) continue
      releaseAircraft(mesh)
      this.jets.delete(id)
    }
  }

  syncEntities(game: Game) {
    this.syncAircraft(game)

    const seenT = new Set<string>()
    for (const t of game.trucks) {
      seenT.add(t.id)
      let mesh = this.trucks.get(t.id)
      if (!mesh) {
        const color =
          t.kind === 'fuel'
            ? '#c9a227'
            : t.kind === 'bags'
              ? '#6b7280'
              : t.kind === 'citycargo'
                ? '#5a4a38'
                : t.kind === 'deice'
                  ? '#4aa8c8'
                  : t.kind === 'termbus'
                    ? '#e8c56a'
                    : t.kind === 'contractor'
                      ? '#d8dee6'
                      : t.kind === 'delivery'
                        ? '#c47a3a'
                        : '#c45c26'
        const [lenM, htM, widM] = vehicleMeters(t.kind)
        const len = wu(lenM)
        const ht = wu(htM)
        const wid = wu(widM)
        const g = new THREE.Group()
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(len, ht, wid),
          new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
        )
        body.position.y = ht / 2
        body.castShadow = true
        body.name = 'body'
        g.add(body)
        // Manor Lords-style visible load — crates on bag carts / city trucks.
        if (t.kind === 'bags' || t.kind === 'citycargo') {
          const crateH = wu(t.kind === 'citycargo' ? 1.2 : 0.7)
          const crate = new THREE.Mesh(
            new THREE.BoxGeometry(wu(t.kind === 'citycargo' ? 2.2 : 1.1), crateH, wu(t.kind === 'citycargo' ? 2.0 : 1.0)),
            new THREE.MeshStandardMaterial({
              color: t.kind === 'citycargo' ? '#9a7a40' : '#8a7348',
              roughness: 0.55,
              emissive: '#3a2e14',
              emissiveIntensity: 0.15,
            }),
          )
          crate.position.set(0, ht + crateH / 2, 0)
          crate.name = 'crate'
          crate.visible = false
          g.add(crate)
          if (t.kind === 'bags') {
            for (let i = 0; i < 3; i++) {
              const bag = new THREE.Mesh(
                new THREE.BoxGeometry(wu(0.7), wu(0.5), wu(0.35)),
                new THREE.MeshBasicMaterial({
                  color: i === 1 ? '#3ec6ff' : '#ffb703',
                  fog: false,
                }),
              )
              bag.position.set((i - 1) * wu(0.8), ht + wu(0.35), 0)
              bag.name = 'suitcase'
              g.add(bag)
            }
          }
        }
        mesh = g
        this.trucks.set(t.id, mesh)
        this.entGroup.add(mesh)
      }
      mesh.position.copy(toWorld(t.x, t.y, 0))
      mesh.rotation.y = -Math.atan2(
        (t.path[Math.min(t.seg + 1, t.path.length - 1)]?.r ?? t.y) - t.y,
        (t.path[Math.min(t.seg + 1, t.path.length - 1)]?.c ?? t.x) - t.x,
      )
      const loaded = Boolean(t.cargoUnits && t.cargoUnits > 0)
      const crate = mesh.getObjectByName('crate')
      if (crate) {
        crate.visible = loaded
        const s = clamp(0.85 + Math.min(1.4, (t.cargoUnits ?? 0) / 80), 0.85, 1.35)
        crate.scale.set(s, s, s)
      }
      mesh.traverse((obj) => {
        if (obj.name === 'suitcase') obj.visible = loaded
      })
    }
    for (const [id, m] of this.trucks) {
      if (!seenT.has(id)) {
        this.entGroup.remove(m)
        disposeObject(m)
        this.trucks.delete(id)
      }
    }

    const seenS = new Set<string>()
    for (const pose of game.servicePoses()) {
      seenS.add(pose.id)
      let mesh = this.service.get(pose.id)
      if (!mesh) {
        const color =
          pose.type === 'fuel_truck'
            ? '#c9a227'
            : pose.type === 'catering_truck'
              ? '#e07a3d'
              : pose.type === 'pax_bus'
                ? '#3d6a8a'
                : pose.type === 'pushback_tug'
                  ? '#f2d24a'
                  : pose.type === 'gpu'
                    ? '#5b8c5a'
                    : pose.type === 'uld_loader'
                      ? '#4a5568'
                      : '#8a93a0'
        const [lenM, htM, widM] = vehicleMeters(pose.type)
        const len = wu(lenM)
        const ht = wu(htM)
        const wid = wu(widM)
        const g = new THREE.Group()
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(len, ht, wid),
          new THREE.MeshStandardMaterial({ color, roughness: 0.45 }),
        )
        body.position.y = ht / 2
        body.castShadow = true
        g.add(body)
        if (pose.type === 'baggage_tug' || pose.type === 'belt_loader') {
          const bed = new THREE.Mesh(
            new THREE.BoxGeometry(wu(2.4), wu(0.25), wid),
            new THREE.MeshStandardMaterial({ color: '#3d4650', roughness: 0.6 }),
          )
          bed.position.set(-len * 0.28, ht * 0.55, 0)
          g.add(bed)
          for (let i = 0; i < 3; i++) {
            const bag = new THREE.Mesh(
              new THREE.BoxGeometry(wu(0.7), wu(0.5), wu(0.35)),
              new THREE.MeshStandardMaterial({
                color: i === 1 ? '#2f4a6a' : '#6a4328',
                roughness: 0.55,
              }),
            )
            bag.position.set(-len * 0.28 + (i - 1) * wu(0.8), ht * 0.55 + wu(0.4), 0)
            g.add(bag)
          }
        }
        mesh = g
        this.service.set(pose.id, mesh)
        this.entGroup.add(mesh)
      }
      mesh.position.copy(toWorld(pose.x, pose.y, 0))
      mesh.rotation.y = -pose.heading
    }
    for (const [id, m] of this.service) {
      if (!seenS.has(id)) {
        this.entGroup.remove(m)
        disposeObject(m)
        this.service.delete(id)
      }
    }

    const seenC = new Set<string>()
    for (const pose of game.cateringPoses()) {
      seenC.add(pose.id)
      let rig = this.cateringCrew.get(pose.id)
      if (!rig) {
        rig = makeCateringRig()
        this.cateringCrew.set(pose.id, rig)
        this.entGroup.add(rig)
      }
      rig.position.copy(toWorld(pose.x, pose.y, 0))
      rig.rotation.y = -pose.heading
      const mast = rig.getObjectByName('mast')
      const platform = rig.getObjectByName('platform')
      const h = wu(CATER_MAST_M) + pose.liftHeight * wu(2.4)
      if (mast) {
        mast.scale.y = h / wu(CATER_MAST_M)
        mast.position.y = h / 2
      }
      if (platform) platform.position.y = wu(1.2) + pose.liftHeight * wu(2.2)
      for (const member of pose.crew) {
        const cap = rig.getObjectByName(member.role)
        if (!cap) continue
        const spot = crewSpot(member.at, pose.liftHeight, member.role === 'helper')
        cap.position.set(spot.x, spot.y, spot.z)
      }
    }
    for (const [id, m] of this.cateringCrew) {
      if (!seenC.has(id)) {
        this.entGroup.remove(m)
        disposeObject(m)
        this.cateringCrew.delete(id)
      }
    }

    const seenP = new Set<string>()
    for (const p of game.people) {
      seenP.add(p.id)
      let mesh = this.people.get(p.id)
      if (!mesh) {
        const heightM = p.job === 'mechanic' ? 1.85 : 1.75
        const radius = wu(0.22)
        const length = wu(heightM - 0.44)
        mesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(radius, length, 3, 6),
          new THREE.MeshLambertMaterial({ color: p.color }),
        )
        mesh.castShadow = true
        if (p.job === 'arrive' || p.job === 'board') {
          const carry = new THREE.Mesh(
            new THREE.BoxGeometry(wu(0.55), wu(0.4), wu(0.25)),
            new THREE.MeshLambertMaterial({ color: '#1f3a5a' }),
          )
          carry.position.set(radius + wu(0.12), wu(0.2), wu(0.05))
          mesh.add(carry)
        }
        this.people.set(p.id, mesh)
        this.entGroup.add(mesh)
      }
      mesh.position.copy(toWorld(p.x, p.y, wu(p.job === 'mechanic' ? 0.925 : 0.875)))
      // Face travel direction so flow reads clearly
      if (p.path.length > 1) {
        const a = p.path[Math.min(p.seg, p.path.length - 1)]
        const b = p.path[Math.min(p.seg + 1, p.path.length - 1)]
        mesh.rotation.y = -Math.atan2(b.r - a.r, b.c - a.c)
      }
    }
    for (const [id, m] of this.people) {
      if (!seenP.has(id)) {
        this.entGroup.remove(m)
        disposeObject(m)
        this.people.delete(id)
      }
    }
    this.syncBeltBags(game)
  }

  /** A few suitcases sliding the apron belt. The ledger stays aggregate. */
  private syncBeltBags(game: Game) {
    if (game.mapRev !== this.beltRev) {
      this.beltRev = game.mapRev
      this.beltPath = []
      for (let r = 0; r < SIZE; r++) {
        const row = game.tiles[r]
        if (!row) continue
        for (let c = 0; c < row.length; c++) {
          if (row[c] === 'belt') this.beltPath.push(toWorld(c, r, wu(0.55)))
        }
      }
    }
    while (this.beltCubes.length < 8) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(wu(0.7), wu(0.5), wu(0.35)),
        new THREE.MeshBasicMaterial({ color: '#ffb703', fog: false }),
      )
      cube.castShadow = true
      cube.visible = false
      this.entGroup.add(cube)
      this.beltCubes.push(cube)
    }
    const motion = game.luggageMotion()
    const path = this.beltPath
    const show = motion.belt && path.length > 0
    const spin = (motion.phase + performance.now() * 0.00015) % 1
    for (let i = 0; i < this.beltCubes.length; i++) {
      const cube = this.beltCubes[i]
      cube.visible = show
      if (!show) continue
      const n = path.length
      const t = (spin + i / this.beltCubes.length) % 1
      const scaled = t * n
      const idx = Math.floor(scaled) % n
      const next = path[(idx + 1) % n]
      const a = path[idx]
      const f = scaled - Math.floor(scaled)
      cube.position.set(a.x + (next.x - a.x) * f, 0.48, a.z + (next.z - a.z) * f)
    }
  }

  /** Ghost tiles share one geometry per rebuild — dispose it once, not every hover forever. */
  private clearGhost() {
    let geo: THREE.BufferGeometry | null = null
    const mats: THREE.Material[] = []
    for (const child of this.ghostGroup.children) {
      if (child instanceof THREE.Mesh) {
        geo = child.geometry
        const mat = child.material
        if (Array.isArray(mat)) mats.push(...mat)
        else mats.push(mat)
      }
    }
    geo?.dispose()
    for (const m of new Set(mats)) m.dispose()
    this.ghostGroup.clear()
  }

  syncSites(game: Game) {
    this.siteGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    })
    this.siteGroup.clear()
    for (const site of game.sites) {
      const progress = Math.max(0.04, Math.min(1, site.elapsed / site.duration))
      for (const cell of site.cells) {
        const p = toWorld(cell.c, cell.r, 0)
        const pole = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 2.4, 0.18),
          new THREE.MeshLambertMaterial({ color: '#c4a574' }),
        )
        pole.position.set(p.x, 1.2, p.z)
        this.siteGroup.add(pole)
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(CELL * 0.7 * progress, 0.22, 0.28),
          new THREE.MeshLambertMaterial({ color: '#7dcea0' }),
        )
        bar.position.set(p.x - (CELL * 0.7 * (1 - progress)) / 2, 2.5, p.z)
        this.siteGroup.add(bar)
      }
    }
    if (game.advisorCells.length) {
      const fit = game.activeHall() ?? game.fits[0]
      if (fit) {
        const mark = new THREE.Mesh(
          new THREE.RingGeometry(CELL * 1.2, CELL * 1.45, 20),
          new THREE.MeshBasicMaterial({
            color: '#f0c14a',
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
          }),
        )
        const p = toWorld(fit.origin.c, fit.origin.r, 0.4)
        mark.rotation.x = -Math.PI / 2
        mark.position.copy(p)
        this.siteGroup.add(mark)
      }
    }
    for (const cell of game.apronFocus) {
      const mark = new THREE.Mesh(
        new THREE.RingGeometry(CELL * 0.7, CELL * 0.9, 20),
        new THREE.MeshBasicMaterial({
          color: '#e07a3d',
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        }),
      )
      const p = toWorld(cell.c, cell.r, 0.45)
      mark.rotation.x = -Math.PI / 2
      mark.position.copy(p)
      this.siteGroup.add(mark)
    }
    for (let r = 0; r < game.tiles.length; r++) {
      const row = game.tiles[r]
      if (!row) continue
      for (let c = 0; c < row.length; c++) {
        const tile = row[c]
        if (tile !== 'fuel' && tile !== 'bags') continue
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(CELL * 0.32, CELL * 0.46, 18),
          new THREE.MeshBasicMaterial({
            color: tile === 'fuel' ? '#e0a020' : '#3a8ec2',
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
          }),
        )
        const p = toWorld(c, r, 0.5)
        ring.rotation.x = -Math.PI / 2
        ring.position.copy(p)
        this.siteGroup.add(ring)
      }
    }
  }

  render(game: Game) {
    const now = performance.now()
    const dt = (now - this.lastFrame) / 1000
    this.lastFrame = now
    setAircraftNight(game.isNight())
    this.resize()
    this.applyPerfMode(game)
    this.rebuildTiles(game)
    this.syncGhost(game)
    this.syncEntities(game)
    this.syncSites(game)
    this.wr.update(game, this.camera, dt)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    for (const mesh of this.jets.values()) releaseAircraft(mesh)
    this.jets.clear()
    this.parkedFleet.dispose()
    this.gateGroup.clear()
    disposeAircraftLibrary()
    this.wr.dispose()
    this.releaseTiles()
    const canvas = this.canvas
    canvas.removeEventListener('contextmenu', this.onContextMenu)
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('wheel', this.onWheel)
    this.renderer.dispose()
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

const _euler = new THREE.Euler()
const _quat = new THREE.Quaternion()
const _scale = new THREE.Vector3()

function flightLivery(game: Game, f: Game['flights'][number]): Livery {
  const a = game.airline(f.airline)
  let body = a.color
  let stripe = a.stripe
  if (f.kind === 'military') {
    body = f.airframeId === 'f15' ? '#2a3028' : '#3d4a32'
    stripe = f.airframeId === 'f15' ? '#8a9a6a' : '#c9a227'
  } else if (f.kind === 'air_ambulance' || f.kind === 'helo_med') {
    body = '#b33a2a'
    stripe = '#f0c040'
  } else if (f.kind === 'freighter') {
    body = '#5a5348'
    stripe = '#d9a441'
  } else if (f.kind === 'helo_exec') {
    body = '#1a3a4a'
    stripe = '#c9a227'
  }
  return { body, stripe, tail: stripe }
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    mesh.geometry?.dispose()
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) for (const m of mat) m.dispose()
    else mat?.dispose()
  })
}
