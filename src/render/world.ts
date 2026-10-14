import * as THREE from 'three'
import { perf, perfEnd, perfFrame, perfStart } from '../core/perf'
import { inBounds } from '../game/path'
import { standEntry } from '../game/standFoot'
import type { Game } from '../game/sim'
import { SIZE } from '../game/types'
import type { HotelClass, ParkTerm, Tile, Vec } from '../game/types'
import {
  createAircraft,
  createBridges,
  disposeAircraftLibrary,
  bridgeMirror,
  bridgeYawToward,
  liveryKey,
  ParkedFleet,
  releaseAircraft,
  setAircraftLamp,
  setAircraftQuality,
  aircraftWorldPerMeter,
  CELL,
  updateAircraft,
  WORLD_PER_METER,
  type Livery,
  type ParkedPlane,
} from './aircraft/index'
import { arrivalPose, finalStraight, orientAircraft, takeoffPose, takeoffTimeline } from './flightPose'
import { canvasToPng } from '../camera/capture.ts'
import { inputMap } from '../input/map.ts'
import { orbitFromLook } from '../camera/orbit.ts'
import { previewAirframe } from '../scale/logic'
import { ConstructionLayer } from '../build/construction'
import { ghostify as ghostifyModel, ghostMaterials } from '../build/ghost'
import { buildModel, standAircraftGhost } from '../build/models'
import {
  addFuelRail,
  addHangar,
  addOilStation,
  addPeopleMover,
  addSkywalk,
  addTravelator,
} from '../scale/placeholders'
import type { SizeTier } from '../scale/types'
import { addMroMesh, addNightHubMesh } from '../tier3/meshes.ts'
import { syncStaffHousing } from './staffHousing.ts'
import { disposeVehicleLibrary, vehicleMesh } from './vehicles.ts'
import { VehicleHeadlights } from './vehicleLights.ts'
import type { DayNightControl } from './world/dayNight'
import { CrewFigures } from './crew/figures.ts'
import { pathHeading } from '../ramp/present.ts'
import {
  initWorldRender,
  QUALITY,
  REPLACED_TILES,
  type QualityLevel,
  type WorldRender,
} from './world/index'
import { chooseGraphicsQuality, graphicsQuality, subscribeGraphicsQuality } from './graphicsPrefs'
import { standBox } from './world/layout'
import { ROOF_Y } from './world/terminal'

interface ClimbOut {
  airframeId: string
  livery: Livery
  ox: number
  oy: number
  heading: number
  elapsed: number
  retired: boolean
}

interface DrawnPose {
  x: number
  y: number
  alt: number
  heading: number
  pitch: number
  gearDown: boolean
  visible: boolean
}

export { CELL }

/** Closest hall view. The interior cutaway engages below about 54. */
const MIN_DIST = 12
const MAX_DIST = 280
const MIN_PITCH = 0.28
const MAX_PITCH = 1.35

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

/** Grow or fold a jet bridge. The cab stays on the door; the tunnel reaches the terminal. */
function applyBridge(root: THREE.Object3D, extend: number) {
  const u = Math.min(1, Math.max(0, extend))
  root.traverse((obj) => {
    if (obj.name !== 'bridge-tunnel' && obj.name !== 'bridge-column') return
    const rest = obj.userData.restScaleZ
    const anchor = obj.userData.anchor
    const side = obj.userData.side === -1 ? -1 : 1
    if (typeof rest !== 'number' || typeof anchor !== 'number') return
    obj.visible = u > 0.04
    if (obj.name === 'bridge-tunnel') {
      obj.scale.z = rest * Math.max(0.02, u)
      obj.position.z = anchor + side * (obj.scale.z / 2)
    } else {
      obj.position.z = anchor + side * rest * u
    }
  })
}

/** Nearest terminal cell, or null when the stand is too far for a bridge. */
function nearestTerminal(game: Game, stand: Vec): Vec | null {
  let best: Vec | null = null
  let bestD = Infinity
  for (let r = 0; r < SIZE; r++) {
    const row = game.tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'terminal') continue
      const d = Math.abs(c - stand.c) + Math.abs(r - stand.r)
      if (d < bestD) {
        bestD = d
        best = { c, r }
      }
    }
  }
  return best && bestD <= 8 ? best : null
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

/** Smooth the scissor lift across the phase. The sim still flips the latch at the boundary. */
function visualLift(phase: string, u: number, raw: number): number {
  if (phase === 'lift_raise') return Math.min(1, Math.max(0, u))
  if (phase === 'lift_lower') return Math.min(1, Math.max(0, 1 - u))
  if (phase === 'carts_out' || phase === 'carts_in') return 1
  if (phase === 'parking' || phase === 'crew_exit' || phase === 'crew_board') return 0
  return raw
}

const CATER_MAST_M = 2.2

function makeCateringRig(): THREE.Group {
  const g = new THREE.Group()
  const bodyL = wu(8.5)
  const bodyW = wu(2.5)
  g.add(vehicleMesh('catering_truck', '#e07a3d', vehicleMeters('catering_truck'), WORLD_PER_METER))
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
  construction = new ConstructionLayer((tile, c, r) => {
    const g = this.building(tile as Tile, toWorld(c, r, 0.02))
    return g.children.length ? g : null
  })
  /** Empty-gate jet bridges. Kept off tilesGroup so releaseTiles cannot dispose shared bridge geometry. */
  gateGroup = new THREE.Group()
  parkedFleet = new ParkedFleet()
  tileHash = ''
  private gateHash = ''
  ghostHash = ''
  jets = new Map<string, THREE.Group>()
  /** Visual takeoff roll. Continues after the sim drops the flight. */
  private climbOut = new Map<string, ClimbOut>()
  /** Sim distance before the threshold, latched on the first approach frame. */
  private arrivalBefore = new Map<string, number>()
  trucks = new Map<string, THREE.Object3D>()
  service = new Map<string, THREE.Object3D>()
  cateringCrew = new Map<string, THREE.Group>()
  private crewFigures = new CrewFigures(this.entGroup)
  people = new Map<string, THREE.Mesh>()
  housingGroup = new THREE.Group()
  private housingMeshes = new Map<string, THREE.Group>()
  private housingWalkers = new Map<string, THREE.Group>()
  private beltCubes: THREE.Mesh[] = []
  private beltPath: THREE.Vector3[] = []
  private beltRev = -1
  private sitesHash = ''
  private siteBars: THREE.Mesh[] = []
  ray = new THREE.Raycaster()
  ndc = new THREE.Vector2()
  ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  hit = new THREE.Vector3()
  sun: THREE.DirectionalLight
  onHover: (v: Vec | null) => void = () => {}
  onClick: (v: Vec, shift: boolean) => void = () => {}
  /** Fired when a pan or orbit drag actually moves, so follow cam can let go. */
  onUserDrag: () => void = () => {}
  /** Wheel while follow cam is held. The orbit rig ignores it until follow ends. */
  onFollowZoom: (deltaY: number) => void = () => {}
  /** PNG data URL from the frame that was just drawn. */
  onCaptured: ((url: string) => void) | null = null
  getTool: () => string = () => 'pan'
  /** True while an external chase pose owns the camera. */
  followHeld = false
  lastPaint: Vec | null = null
  private liteMode = false
  private lastFrame = performance.now()
  /** Textured airfield, sky, and living terminals. See docs/GRAPHICS.md. */
  wr: WorldRender
  private offGfx: () => void = () => {}
  private canvas: HTMLCanvasElement
  private onPointerDown!: (e: PointerEvent) => void
  private onPointerMove!: (e: PointerEvent) => void
  private onPointerUp!: (e: PointerEvent) => void
  private onWheel!: (e: WheelEvent) => void
  private onContextMenu!: (e: Event) => void
  /** True after pointerdown already stamped — blocks duplicate up/down fires. */
  private paintedThisGesture = false
  private lookAim = new THREE.Vector3()
  private captureWanted = false
  private headlights = new VehicleHeadlights()
  private headlightRoots: THREE.Object3D[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    // Quality is picked before the context exists: MSAA cannot be switched off afterwards.
    const quality = graphicsQuality()
    setAircraftQuality(quality)
    markGraphicsPreset(quality)
    const preset = QUALITY[quality]
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: preset.msaa,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    // Cap DPR + shadows — software GL / cloud desktops hitch hard at 2× + 2k maps.
    // Low (what SwiftShader auto-picks) stays under 1× with the shadow map off.
    const pixelCap = quality === 'low' ? preset.pixelRatioCap : Math.min(preset.pixelRatioCap, 1.25)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.shadowMap.enabled = preset.shadowMapSize > 0
    this.renderer.shadowMap.type = preset.shadowType
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.localClippingEnabled = true // construction reveal

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#87b7d9')
    this.scene.fog = new THREE.Fog('#9fc5dd', 220, 640)

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 1200)
    this.placeCam()

    const hemi = new THREE.HemisphereLight('#e8f3ff', '#6b8a4a', 0.85)
    this.scene.add(hemi)
    this.sun = new THREE.DirectionalLight('#fff3d4', 1.2)
    this.sun.position.set(40, 70, 18)
    this.sun.castShadow = preset.shadowMapSize > 0
    this.sun.shadow.mapSize.set(
      preset.shadowMapSize > 0 ? preset.shadowMapSize : 1024,
      preset.shadowMapSize > 0 ? preset.shadowMapSize : 1024,
    )
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
    this.housingGroup.name = 'staff-housing'
    this.scene.add(this.tilesGroup)
    this.scene.add(this.gateGroup)
    this.scene.add(this.housingGroup)
    this.scene.add(this.entGroup)
    this.scene.add(this.headlights.group)
    this.entGroup.add(this.parkedFleet.root)
    this.scene.add(this.ghostGroup)
    this.scene.add(this.siteGroup)
    this.scene.add(this.construction.group)
    this.addPlotFence()
    this.addHorizon()
    this.bind(canvas)
    this.wr = initWorldRender(this.scene, quality, {
      renderer: this.renderer,
      sun: this.sun,
    })
    this.offGfx = subscribeGraphicsQuality((level) => this.applyGraphicsQuality(level))
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
      // The player grabbed the camera: stop easing toward a "Show me" target.
      this.goalTo = null
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
      if ((this.dragging === 'orbit' || this.dragging === 'pan') && (dx !== 0 || dy !== 0)) {
        this.onUserDrag()
      }
      if (this.dragging === 'orbit') {
        this.yaw -= dx * 0.007
        this.pitch = clamp(this.pitch - dy * 0.005, MIN_PITCH, MAX_PITCH)
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
      if (!inputMap.wheelMatches(e.deltaY)) return
      e.preventDefault()
      if (this.followHeld) {
        this.onFollowZoom(e.deltaY)
        return
      }
      this.nudgeZoom(e.deltaY * 0.06)
    }
    canvas.addEventListener('contextmenu', this.onContextMenu)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  /** Keyboard / UI pan in camera-local ground plane. */
  nudgePan(rightAmt: number, forwardAmt: number) {
    if (this.followHeld) return
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
    if (this.followHeld) return
    this.yaw += delta
    this.placeCam()
  }

  nudgeZoom(delta: number) {
    if (this.followHeld) return
    this.dist = clamp(this.dist + delta, MIN_DIST, MAX_DIST)
    this.placeCam()
  }

  /** Live orbit (or chase) pose, used to seed a smooth follow. */
  cameraPose(): { position: { x: number; y: number; z: number }; aim: { x: number; y: number; z: number } } {
    const aim = this.followHeld ? this.lookAim : this.pivot
    return {
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      aim: { x: aim.x, y: aim.y, z: aim.z },
    }
  }

  /** Place the chase camera. Orbit drags call `onUserDrag` and then `releaseFollow`. */
  applyFollow(position: { x: number; y: number; z: number }, aim: { x: number; y: number; z: number }) {
    this.followHeld = true
    this.lookAim.set(aim.x, aim.y, aim.z)
    this.camera.position.set(position.x, position.y, position.z)
    this.camera.lookAt(this.lookAim)
    this.camera.updateMatrixWorld()
  }

  /** Hand the current shot back to yaw / pitch / distance. */
  releaseFollow() {
    if (!this.followHeld) return
    this.followHeld = false
    const rig = orbitFromLook(
      { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      { x: this.lookAim.x, y: 0, z: this.lookAim.z },
      { minDist: MIN_DIST, maxDist: MAX_DIST, minPitch: MIN_PITCH, maxPitch: MAX_PITCH },
    )
    this.yaw = rig.yaw
    this.pitch = rig.pitch
    this.dist = rig.dist
    this.pivot.set(rig.pivot.x, 0, rig.pivot.z)
    this.placeCam()
  }

  /**
   * Graphics preset for ground, lights, shadows and aircraft detail. Saved for the next
   * boot; MSAA is fixed with the WebGL context, so that part follows on reload.
   * F8 reaches this through the action map. A settings control can call it directly.
   */
  setGraphicsQuality(level: QualityLevel) {
    this.applyGraphicsQuality(level)
    chooseGraphicsQuality(level)
    markGraphicsPreset(level)
  }

  /** Settings and F8. Aircraft detail follows the same preset. */
  private applyGraphicsQuality(level: QualityLevel) {
    if (this.wr.quality === level) return
    this.wr.setQuality(level)
    setAircraftQuality(level)
  }

  /** Photo mode. `null` follows the sim clock and leaves any day/night override in place. */
  setTimeOfDay(hour: number | null) {
    this.wr.setTimeOfDay(hour)
  }

  /**
   * Lighting-rig hook. `null` returns the sky to the sim clock.
   * `daylight` blends the sun toward night; `lights` drives the field lamps.
   */
  setDayNight(control: DayNightControl | null) {
    this.wr.setDayNight(control)
  }

  /** Grab a PNG on the next `render`, while the drawing buffer is still current. */
  requestCapture() {
    this.captureWanted = true
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

  private goalSeq = 0
  private goalTo: THREE.Vector3 | null = null

  /** Ease the pivot toward the last "Show me" / "Pan to problem" cell. A few cheap lerps, then done. */
  private easeToGoal(game: Game, dt: number) {
    const g = game.camGoal
    if (g && g.view === 'apron' && g.seq !== this.goalSeq) {
      this.goalSeq = g.seq
      this.goalTo = toWorld(g.c, g.r, this.pivot.y)
    }
    if (!this.goalTo) return
    const k = 1 - Math.exp(-Math.max(0, dt) * 6)
    this.pivot.x += (this.goalTo.x - this.pivot.x) * k
    this.pivot.z += (this.goalTo.z - this.pivot.z) * k
    if (Math.hypot(this.goalTo.x - this.pivot.x, this.goalTo.z - this.pivot.z) < 0.05) {
      this.pivot.x = this.goalTo.x
      this.pivot.z = this.goalTo.z
      this.goalTo = null
    }
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
          const built = this.building(tile, pos, {
            hotelClass: game.hotelClass[key],
            parkTerm: game.parkTerms[key],
            hangarTier: game.hangarScale[key],
            lateOpen: game.lateOpenAt(c, r),
          })
          built.userData.cellKey = key
          this.tilesGroup.add(built)
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
    const scale = Object.entries(game.standScale)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join(',')
    return `${game.mapRev}|${game.standAccessMode}|${game.fits.length}|${cls}|${acc}|${scale}`
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
        const marked = game.standScale[`${c},${r}`]
        const tier: SizeTier = marked ?? (game.standClassAt(stand) === 'L' ? 'jumbo' : 'small')
        const preview = createBridges(previewAirframe(tier))
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
    opts: {
      hotelClass?: HotelClass
      parkTerm?: ParkTerm
      hangarTier?: SizeTier
      lateOpen?: boolean
    } = {},
  ): THREE.Group {
    const g = new THREE.Group()
    g.position.copy(pos)
    const model = buildModel(tile, { hangarTier: opts.hangarTier })
    if (model) {
      g.add(...model.children)
      return g
    }
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
        new THREE.BoxGeometry(CELL * 0.96, 0.18, CELL * 0.96),
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
      // Round cab stays inside the cell. The keep-out in buildingFootprint
      // refuses a stamp whose neighbours are roads, so the shaft cannot sit on one.
      const cabR = CELL * 0.42
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(cabR * 0.45, cabR * 0.72, CELL * 0.55, 10),
        new THREE.MeshStandardMaterial({ color: '#cfd8e3' }),
      )
      shaft.position.y = CELL * 0.28
      shaft.castShadow = true
      const cab = new THREE.Mesh(
        new THREE.CylinderGeometry(cabR, cabR * 0.86, CELL * 0.12, 12),
        new THREE.MeshStandardMaterial({ color: '#2f6f9a', metalness: 0.3 }),
      )
      cab.position.y = CELL * 0.58
      g.add(shaft, cab)
    } else if (tile === 'hangar') {
      addHangar(g, opts.hangarTier ?? 'small')
    } else if (tile === 'mro') {
      addMroMesh(g, CELL)
    } else if (tile === 'nighthub') {
      addNightHubMesh(g, CELL)
    } else if (tile === 'fuel_rail') {
      addFuelRail(g)
    } else if (tile === 'oil') {
      addOilStation(g)
    } else if (tile === 'travelator') {
      addTravelator(g)
    } else if (tile === 'skywalk') {
      addSkywalk(g)
    } else if (tile === 'mover') {
      addPeopleMover(g)
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
    } else if (tile === 'xferbus') {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95),
        new THREE.MeshLambertMaterial({ color: '#243038' }),
      )
      pad.rotation.x = -Math.PI / 2
      pad.position.y = 0.04
      const shed = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.7, 1.6, CELL * 0.5),
        new THREE.MeshStandardMaterial({ color: '#c47a3a', roughness: 0.5 }),
      )
      shed.position.y = 0.85
      shed.castShadow = true
      const bus = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.62, 0.72, CELL * 0.26),
        new THREE.MeshStandardMaterial({ color: '#e07a3d', roughness: 0.4 }),
      )
      bus.position.set(0, 0.46, CELL * 0.28)
      bus.name = 'xfer-bus'
      bus.castShadow = true
      g.add(pad, shed, bus)
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
      canopy.position.set(0, 2.4, CELL * 0.22)
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
    entry.position.set(0, 0.9, CELL * 0.34)
    entry.castShadow = true
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.62, 0.1, CELL * 0.35),
      new THREE.MeshStandardMaterial({ color: '#2f6f9a' }),
    )
    canopy.position.set(0, 1.85, CELL * 0.28)
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
    const cells = game.ghostCells(h)
    const ready = game.ghostReady(cells)
    const preview = game.standPreview()
    const next = `${game.tool}|${game.facing}|${h ? `${h.c},${h.r}` : ''}|${game.mapRev}|${preview ? `${preview.cls}${preview.scale ?? ''}` : ''}|${ready ? 1 : 0}`
    if (next === this.ghostHash) return
    this.ghostHash = next
    this.clearGhost()
    const tint = ready ? 0x7dff9a : 0xff6b6b
    const quad = new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
    const geo = new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95)
    geo.rotateX(-Math.PI / 2)
    for (const p of cells) {
      if (!inBounds(p.c, p.r)) continue
      const mesh = new THREE.Mesh(geo, quad)
      mesh.position.copy(toWorld(p.c, p.r, 0.12))
      this.ghostGroup.add(mesh)
    }
    this.addGhostPrefab(game, cells, tint)
  }

  /** Translucent true-size preview. One mesh for a hall or a runway, the aircraft box for a stand. */
  private addGhostPrefab(game: Game, cells: Vec[], tint: number) {
    const tile = game.placementTile()
    if (!tile || !game.hover || !cells.length) return
    const ghostMats = ghostMaterials(tint !== 0xff6b6b)
    const mat = ghostMats.body
    this.ghostGroup.userData.ghostMats = ghostMats
    if (tile === 'runway' || tile === 'taxi' || tile === 'road') {
      this.ghostGroup.add(this.ghostSlab(cells, tile === 'runway' ? 0.22 : 0.16, mat))
      return
    }
    if (tile === 'terminal') {
      let real = 0
      for (const p of cells) {
        if (!inBounds(p.c, p.r)) continue
        const built = this.building(tile, toWorld(p.c, p.r, 0))
        if (!built.children.length) continue
        ghostifyModel(built, ghostMats, { edges: false })
        this.ghostGroup.add(built)
        real++
      }
      if (real) return
      const slab = this.ghostSlab(cells, ROOF_Y, mat)
      slab.position.y = ROOF_Y / 2
      this.ghostGroup.add(slab)
      return
    }
    if (tile === 'stand') {
      const spec = game.standPreview()
      if (!spec) return
      const entry = standEntry(game.tiles, game.hover.c, game.hover.r)
      const box = standBox({
        c: game.hover.c,
        r: game.hover.r,
        cls: spec.cls,
        scale: spec.scale ?? undefined,
        jetway: game.standAccessMode === 'jetway',
        entry,
      })
      const alongX = box.depthAlongX
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? box.depth : box.width, 0.16, alongX ? box.width : box.depth),
        mat,
      )
      pad.position.set(box.x, 0.14, box.z)
      const plane = standAircraftGhost(box.depth, box.width, mat, alongX)
      plane.position.set(box.x, 0.14, box.z)
      this.ghostGroup.add(pad, plane)
      return
    }
    for (const p of cells) {
      if (!inBounds(p.c, p.r)) continue
      const built = this.building(tile, toWorld(p.c, p.r, 0))
      ghostifyModel(built, ghostMats)
      this.ghostGroup.add(built)
    }
  }

  private ghostSlab(cells: Vec[], height: number, mat: THREE.Material): THREE.Mesh {
    let minC = Infinity
    let maxC = -Infinity
    let minR = Infinity
    let maxR = -Infinity
    for (const p of cells) {
      if (!inBounds(p.c, p.r)) continue
      minC = Math.min(minC, p.c)
      maxC = Math.max(maxC, p.c)
      minR = Math.min(minR, p.r)
      maxR = Math.max(maxR, p.r)
    }
    if (!Number.isFinite(minC)) {
      return new THREE.Mesh(new THREE.BoxGeometry(CELL, height, CELL), mat)
    }
    const w = (maxC - minC + 1) * CELL
    const d = (maxR - minR + 1) * CELL
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), mat)
    const cx = (minC + maxC) / 2
    const rz = (minR + maxR) / 2
    mesh.position.copy(toWorld(cx, rz, height / 2))
    return mesh
  }

  /**
   * Aircraft use meters × WORLD_PER_METER × AIRCRAFT_VISUAL_SCALE.
   * Jetway bridges parent on the aircraft root while parked.
   * Remote duplicates share a parked batch.
   */
  private syncAircraft(game: Game, dt: number) {
    const step = Math.min(0.05, Math.max(0, dt)) * Math.max(0, game.speed)
    const groups = new Map<string, Game['flights']>()
    for (const f of game.flights) {
      if (f.phase !== 'parked' || f.craft === 'helo' || game.selectedFlight === f.id) continue
      const cell = { c: Math.round(f.x), r: Math.round(f.y) }
      if (game.standAccessAt(cell) === 'jetway') continue
      const paint = flightLivery(game, f)
      const key = `${f.airframeId}|${liveryKey(paint)}`
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
      const pose = this.poseAircraft(game, f, paint, step)
      mesh.visible = pose.visible
      if (pose.visible) {
        mesh.position.copy(toWorld(pose.x, pose.y, 0.04 + pose.alt))
        orientAircraft(mesh, pose.heading, pose.pitch)
        updateAircraft(mesh, pose.gearDown)
      }
      const cell = { c: Math.round(f.x), r: Math.round(f.y) }
      const jetway =
        f.craft !== 'helo' &&
        (f.phase === 'deboard' || f.phase === 'servicing' || f.phase === 'board' || f.phase === 'parked') &&
        game.standAccessAt(cell) === 'jetway'
      const bridges = mesh.getObjectByName('bridges')
      if (jetway) {
        const term = nearestTerminal(game, cell)
        const side = term ? bridgeMirror(f.heading, cell, term) : 1
        if (!bridges || bridges.userData.side !== side) {
          if (bridges) mesh.remove(bridges)
          mesh.add(createBridges(f.airframeId || 'b738', side))
        }
      } else if (bridges) {
        mesh.remove(bridges)
      }
      const docked = mesh.getObjectByName('bridges')
      if (docked) applyBridge(docked, game.bridgeExtend(f.id))
      mesh.scale.setScalar(game.selectedFlight === f.id ? 1.06 : 1)
    }
    this.stepClimbGhosts(
      step,
      new Set(game.flights.map((f) => f.id)),
      seen,
    )
    for (const [id, mesh] of this.jets) {
      if (seen.has(id)) continue
      releaseAircraft(mesh)
      this.jets.delete(id)
    }
  }

  /**
   * Jets draw a kinematic takeoff and a 3° arrival. Helos keep the sim altitude.
   * The sim phase clock is not touched.
   */
  private poseAircraft(game: Game, f: Game['flights'][number], paint: Livery, step: number): DrawnPose {
    if (f.craft === 'helo') {
      this.climbOut.delete(f.id)
      this.arrivalBefore.delete(f.id)
      return {
        x: f.x,
        y: f.y,
        alt: Math.max(0, f.z - 0.1),
        heading: f.heading,
        pitch: 0,
        gearDown: !(
          f.phase === 'hold' ||
          f.phase === 'gone' ||
          (f.phase === 'takeoff' && f.z > 1.6) ||
          (f.phase === 'approach' && f.z > 3.2)
        ),
        visible: true,
      }
    }
    if (f.phase !== 'taxi_out' && f.phase !== 'takeoff') this.climbOut.delete(f.id)
    const climb = this.trackClimb(f, paint)
    if (climb) {
      if (!climb.retired) climb.elapsed += step
      const posed = takeoffPose(climb.elapsed, climb.ox, climb.oy, climb.heading, climb.airframeId)
      if (posed.retire) climb.retired = true
      return {
        x: posed.x,
        y: posed.y,
        alt: posed.alt,
        heading: posed.heading,
        pitch: posed.pitch,
        gearDown: posed.gearDown,
        visible: !climb.retired,
      }
    }
    if (f.phase === 'approach' || f.phase === 'landing') {
      const posed = arrivalPose({
        x: f.x,
        y: f.y,
        heading: f.heading,
        path: f.path,
        airframeId: f.airframeId || 'b738',
        initialBefore: this.arrivalBefore.get(f.id) ?? null,
        onRunway: (p) => {
          const c = Math.round(p.c)
          const r = Math.round(p.r)
          return inBounds(c, r) && game.tiles[r]?.[c] === 'runway'
        },
      })
      this.arrivalBefore.set(f.id, posed.initialBefore)
      return {
        x: posed.x,
        y: posed.y,
        alt: posed.alt,
        heading: posed.heading,
        pitch: posed.pitch,
        gearDown: true,
        visible: true,
      }
    }
    this.arrivalBefore.delete(f.id)
    return {
      x: f.x,
      y: f.y,
      alt: Math.max(0, f.z - 0.1),
      heading: f.heading,
      pitch: 0,
      gearDown: f.phase !== 'hold' && f.phase !== 'gone',
      visible: true,
    }
  }

  /** Latch the roll once the jet is on the departure straight, inside its class distance. */
  private trackClimb(f: Game['flights'][number], paint: Livery): ClimbOut | null {
    const existing = this.climbOut.get(f.id)
    if (existing) return existing
    if (f.phase !== 'taxi_out' && f.phase !== 'takeoff') return null
    const timeline = takeoffTimeline(f.airframeId || 'b738')
    const straight = finalStraight(f.path, f.x, f.y, f.seg)
    const ready =
      f.phase === 'takeoff' || (straight != null && straight.remaining <= timeline.rollCells + 0.2)
    if (!ready) return null
    const heading = straight?.heading ?? f.heading
    let ox = f.x
    let oy = f.y
    let elapsed = 0
    if (f.phase === 'takeoff' && (straight == null || straight.remaining < 0.45)) {
      elapsed = timeline.tRotate
      ox = f.x - Math.cos(heading) * timeline.rollCells
      oy = f.y - Math.sin(heading) * timeline.rollCells
    }
    const climb: ClimbOut = {
      airframeId: f.airframeId || 'b738',
      livery: paint,
      ox,
      oy,
      heading,
      elapsed,
      retired: false,
    }
    this.climbOut.set(f.id, climb)
    return climb
  }

  /** Keep a departing jet in the air after the sim has deleted it, until it is clear of the field. */
  private stepClimbGhosts(step: number, live: Set<string>, seen: Set<string>) {
    for (const [id, climb] of this.climbOut) {
      if (live.has(id)) continue
      if (climb.retired) {
        this.climbOut.delete(id)
        continue
      }
      climb.elapsed += step
      const posed = takeoffPose(climb.elapsed, climb.ox, climb.oy, climb.heading, climb.airframeId)
      if (posed.retire) {
        this.climbOut.delete(id)
        continue
      }
      let mesh = this.jets.get(id)
      if (!mesh) {
        mesh = createAircraft(climb.airframeId, climb.livery)
        this.jets.set(id, mesh)
        this.entGroup.add(mesh)
      }
      mesh.visible = true
      mesh.position.copy(toWorld(posed.x, posed.y, 0.04 + posed.alt))
      orientAircraft(mesh, posed.heading, posed.pitch)
      updateAircraft(mesh, posed.gearDown)
      const bridges = mesh.getObjectByName('bridges')
      if (bridges) mesh.remove(bridges)
      mesh.scale.setScalar(1)
      seen.add(id)
    }
  }

  syncEntities(game: Game, dt = 0) {
    this.syncAircraft(game, dt)

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
        const size = vehicleMeters(t.kind)
        const ht = wu(size[1])
        const g = new THREE.Group()
        g.userData.headlight = { length: wu(size[0]), width: wu(size[2]) }
        g.add(vehicleMesh(t.kind, color, size, WORLD_PER_METER))
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
      const ahead = t.path[Math.min(t.seg + 1, t.path.length - 1)]
      const dx = (ahead?.c ?? t.x) - t.x
      const dy = (ahead?.r ?? t.y) - t.y
      const heading = Math.hypot(dx, dy) > 0.08 ? Math.atan2(dy, dx) : pathHeading(t.path)
      mesh.rotation.y = -heading
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
        g.userData.headlight = { length: len, width: wid }
        g.add(vehicleMesh(pose.type, color, [lenM, htM, widM], WORLD_PER_METER))
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
      const lift = visualLift(pose.phase, pose.phaseU, pose.liftHeight)
      const h = wu(CATER_MAST_M) + lift * wu(2.4)
      if (mast) {
        mast.scale.y = h / wu(CATER_MAST_M)
        mast.position.y = h / 2
      }
      if (platform) platform.position.y = wu(1.2) + lift * wu(2.2)
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
      if ((p.job === 'arrive' || p.job === 'board') && game.paxPicture(p.flightId)) continue
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
      const gc = Math.min(SIZE - 1, Math.max(0, p.x))
      const gr = Math.min(SIZE - 1, Math.max(0, p.y))
      mesh.position.copy(toWorld(gc, gr, wu(p.job === 'mechanic' ? 0.925 : 0.875)))
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
    this.crewFigures.update(game.crewScene(), this.camera, dt, game.speed >= 5, (c, r, y) => toWorld(c, r, y))
    syncStaffHousing(
      this.housingGroup,
      this.housingMeshes,
      this.housingWalkers,
      game.staffSites(),
      game.staffWalkers(),
      toWorld,
    )
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

  /** Ghost meshes are rebuilt per hover. Dispose every geometry and cloned material. */
  private clearGhost() {
    const geos = new Set<THREE.BufferGeometry>()
    const mats = new Set<THREE.Material>()
    this.ghostGroup.traverse((o) => {
      if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.LineSegments)) return
      geos.add(o.geometry)
      const mat = o.material
      if (Array.isArray(mat)) for (const m of mat) mats.add(m)
      else mats.add(mat)
    })
    for (const g of geos) g.dispose()
    for (const m of mats) m.dispose()
    this.ghostGroup.clear()
  }

  /**
   * Construction poles + progress bars, advisor / focus rings, fuel and bag-farm rings.
   * Meshes are rebuilt only when the set of marks changes; bars just rescale each frame.
   */
  syncSites(game: Game) {
    const key = this.sitesKey(game)
    if (key !== this.sitesHash) {
      this.sitesHash = key
      this.rebuildSites(game)
    }
    this.construction.sync(game.sites)
    let i = 0
    for (const site of game.sites) {
      const progress = Math.max(0.04, Math.min(1, site.elapsed / site.duration))
      for (const cell of site.cells) {
        const bar = this.siteBars[i++]
        if (!bar) continue
        const p = toWorld(cell.c, cell.r, 0)
        bar.scale.x = progress
        bar.position.set(p.x - (CELL * 0.7 * (1 - progress)) / 2, 2.5, p.z)
      }
    }
  }

  private sitesKey(game: Game): string {
    let k = `${game.mapRev}|${game.advisorCells.length ? 1 : 0}|`
    const fit = game.advisorCells.length ? (game.activeHall() ?? game.fits[0]) : null
    if (fit) k += `${fit.origin.c},${fit.origin.r}`
    k += '|'
    for (const site of game.sites) {
      k += `${site.cells.length}:`
      for (const cell of site.cells) k += `${cell.c},${cell.r};`
    }
    k += '|'
    for (const cell of game.apronFocus) k += `${cell.c},${cell.r};`
    return k
  }

  private rebuildSites(game: Game) {
    this.siteGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    })
    this.siteGroup.clear()
    this.siteBars = []
    for (const site of game.sites) {
      for (const cell of site.cells) {
        const p = toWorld(cell.c, cell.r, 0)
        const pole = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 2.4, 0.18),
          new THREE.MeshLambertMaterial({ color: '#c4a574' }),
        )
        pole.position.set(p.x, 1.2, p.z)
        this.siteGroup.add(pole)
        // Full-width box scaled on x by progress in syncSites.
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(CELL * 0.7, 0.22, 0.28),
          new THREE.MeshLambertMaterial({ color: '#7dcea0' }),
        )
        this.siteGroup.add(bar)
        this.siteBars.push(bar)
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

  /** Pods shuttle while the people mover is open. A breakdown parks them. */
  private animateLinks(game: Game) {
    const moving = !game.linkStopped('people_mover')
    const t = performance.now() / 1000
    this.tilesGroup.traverse((obj) => {
      if (obj.name !== 'pod') return
      const home = typeof obj.userData.home === 'number' ? obj.userData.home : 0
      obj.position.x = moving ? home + Math.sin(t * 1.3) * CELL * 0.22 : home
      const glass = obj.parent?.getObjectByName('pod-glass')
      if (glass) glass.position.x = obj.position.x
    })
  }

  /** Headlamps follow trucks and service vehicles. Pools stay off on Low. */
  private syncHeadlights() {
    this.headlightRoots.length = 0
    for (const mesh of this.trucks.values()) this.headlightRoots.push(mesh)
    for (const mesh of this.service.values()) this.headlightRoots.push(mesh)
    this.headlights.sync(this.headlightRoots, this.wr.dayNightSample.headlights, this.wr.quality !== 'low')
  }

  render(game: Game) {
    const now = performance.now()
    const dt = (now - this.lastFrame) / 1000
    this.lastFrame = now
    perfFrame()
    let t = perfStart()
    this.resize()
    this.easeToGoal(game, dt)
    this.applyPerfMode(game)
    this.rebuildTiles(game)
    this.animateLinks(game)
    this.syncGhost(game)
    perfEnd('world.tiles', t)
    t = perfStart()
    this.syncEntities(game, dt)
    perfEnd('world.entities', t)
    t = perfStart()
    this.syncSites(game)
    perfEnd('world.sites', t)
    t = perfStart()
    this.followCameraCue(game)
    this.syncMroDoors(game)
    this.wr.update(game, this.camera, dt)
    this.syncHeadlights()
    setAircraftLamp(this.wr.dayNightSample.aircraft)
    perfEnd('world.wr', t)
    t = perfStart()
    this.renderer.render(this.scene, this.camera)
    if (this.captureWanted) {
      this.captureWanted = false
      const url = canvasToPng(this.renderer.domElement)
      if (url) this.onCaptured?.(url)
    }
    if (perf.syncGpu) this.renderer.getContext().finish()
    perfEnd('world.gl', t)
  }

  /** Advisor pan. One cue, then the player has the camera again. */
  private followCameraCue(game: Game) {
    const cue = game.consumeCameraCue()
    if (!cue) return
    const p = toWorld(cue.c, cue.r, 0)
    this.pivot.set(p.x, 0, p.z)
    this.placeCam()
  }

  /**
   * Slide the hangar doors only when the camera is close and the sim is not in the 5× lite pass.
   * Far buildings keep the shut pose they were built with.
   */
  private syncMroDoors(game: Game) {
    if (this.liteMode) return
    const cam = this.camera.position
    for (const child of this.tilesGroup.children) {
      const key = child.userData.cellKey as string | undefined
      if (!key || !child.getObjectByName('mro-door')) continue
      child.getWorldPosition(_doorPos)
      if (cam.distanceTo(_doorPos) > CELL * 14) continue
      const open = game.mroDoorOpen(key)
      child.traverse((obj) => {
        const door = obj as THREE.Mesh
        if (!door.userData.mroDoor) return
        const rest = typeof door.userData.restY === 'number' ? door.userData.restY : door.position.y
        door.position.y = rest + open * CELL * 0.36
      })
    }
  }

  dispose() {
    for (const mesh of this.jets.values()) releaseAircraft(mesh)
    this.jets.clear()
    this.climbOut.clear()
    this.arrivalBefore.clear()
    this.parkedFleet.dispose()
    this.crewFigures.dispose()
    this.gateGroup.clear()
    disposeAircraftLibrary()
    disposeVehicleLibrary()
    this.offGfx()
    this.wr.dispose()
    this.headlights.dispose()
    syncStaffHousing(this.housingGroup, this.housingMeshes, this.housingWalkers, [], [], toWorld)
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

/** Low preset drops the HUD backdrop blur. Med and high keep it. See index.css. */
function markGraphicsPreset(level: QualityLevel) {
  const root = globalThis.document?.documentElement
  if (root) root.dataset.gfx = level
}

const _euler = new THREE.Euler()
const _quat = new THREE.Quaternion()
const _scale = new THREE.Vector3()
const _doorPos = new THREE.Vector3()

const SOLID_PAINT = new Set<string>(['military', 'air_ambulance', 'helo_med', 'freighter', 'helo_exec'])

function flightLivery(game: Game, f: Game['flights'][number]): Livery {
  const a = game.airline(f.airline)
  let body = a.color
  let stripe = a.stripe
  // Airline fin over a white crown. Special kinds keep their solid paint below.
  if (!SOLID_PAINT.has(f.kind)) return { body, stripe, tail: body, scheme: 'twotone' }
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
  return { body, stripe, tail: stripe, scheme: 'solid' }
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    // Pooled vehicle shells outlive any one truck.
    if (obj.userData.shared) return
    const mesh = obj as THREE.Mesh
    mesh.geometry?.dispose()
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) for (const m of mat) m.dispose()
    else mat?.dispose()
  })
}
