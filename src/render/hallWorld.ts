/**
 * 3D terminal hall — orbit camera over furnished rooms + walking guests.
 * Layout follows NODE_POS; rooms appear when furnished. Security is the visual choke.
 */
import * as THREE from 'three'
import { HALL_LIGHT } from './look'
import { graphicsQuality, subscribeGraphicsQuality, type QualityLevel } from './graphicsPrefs'
import { buildHallDetail } from './hallKitDetail'
import { buildTerminalProps, capTerminalPropMetal, setNearPropDetail } from './terminalProps'
import { SupplyCartLayer } from './supplyCart'
import { hiDetailOn } from './world/terminalHiDetail'
import { canvasToPng } from '../camera/capture.ts'
import { zoomToCursorShift } from '../camera/zoom.ts'
import { inputMap } from '../input/map.ts'
import { perf, perfEnd, perfFrame, perfStart } from '../core/perf'
import {
  HALL_CAM_DIST,
  HALL_CAM_FAR,
  HALL_CAM_FOV,
  HALL_CAM_LOOK_X,
  HALL_CAM_LOOK_Z,
  HALL_CAM_MAX_DIST,
  HALL_CAM_MIN_DIST,
  HALL_FOLLOW_DIST,
  HALL_CAM_NEAR,
  HALL_CAM_PITCH,
  HALL_CAM_YAW,
  HALL_NEAR_DIST,
  HALL_OCCLUDE_M,
} from './hallCamera'
import { HALL_EDGES, NODE_POS, type HallNode } from '../game/guests'
import { bake, type BakePiece } from './world/kit'
import { paintTerrazzo } from './world/raster'
import { rasterTexture } from './world/textures'
import type { Game } from '../game/sim'
import { isAssignKind } from '../hubprogress/assign.ts'
import { syncLeaseMarks, type LeaseMark } from './leaseBadge.ts'
import {
  GRID_C,
  GRID_R,
  HALL_D,
  HALL_W,
  itemDef,
  prefabZones,
  zoneDef,
  type ItemId,
  type PlacedItem,
  type ZoneId,
} from '../game/terminal'
import { cellLoad, itemSize, type PlacementCheck } from '../game/terminalKit'
import {
  buildGhost,
  buildKitInstances,
  disposeKitInstances,
  hasKitMesh,
  kitMeshKey,
  layoutItems,
  slotCenter,
} from './hallKitMeshes'
import { HallLitterLayer } from './hallLitter'
import { HallNavCrowd } from './hallNavCrowd'
import { HallFigureBatch, type FigureDraw } from './hallFigures'
import { releasePerfOverlay, retainPerfOverlay } from '../perf'
import { HallServiceFx } from './hallService'
import { HALL_WALKER_PICK } from '../game/hallNavData.ts'
import type { HallNav } from '../game/hallNav'
import { BUILD_TUNING, type Edge, type RoomKind } from '../terminalbuild/index.ts'
import { WORLD_PER_METER } from './aircraft/specs'
import {
  apronToHall,
  hallFitFor,
  hallGuestScale,
  hallToApron,
  matchTerminal,
  poseOnPlan,
  shellHallBounds,
  showLegacyHallFurniture,
  stampAnchor,
  type HallFit,
} from './hallRooms'
import { facadeOpenings, outwardYaw } from './world/facade'
import { terminals } from './world/layout'
import { baseLevel } from './world/quality'
import { boardSnapshot, isFidsSource } from '../fids/project'
import { setFidsOpen } from '../fids/open'
import { objectIsFidsBoard } from '../fids/stage'
import { disposeTerminalShared, FLOOR_Y, makeTerminalShared, ROOF_Y, TerminalBuilding, type TerminalShared } from './world/terminal'
import type { RoomPlan } from './world/rooms'
import { makeTextures, type WorldTextures } from './world/textures'
import { hallQueues, type HallQueue } from '../terminalplay/queues'
import { footprintHit, footprintSpec, stampFrom } from '../terminalplay/footprints'
import { cellCenterInFloor, cellInFloor } from '../game/shellFloor.ts'
import { hallBaseLayout } from '../game/hallNav.ts'
import { dragRect, nearestEdge, tileAtPoint, tilesInRect, wallRun } from '../terminalbuild/interior.ts'
import { interiorEditSig, roomContains, syncInteriorEdit, syncInteriorGhost } from './interiorBuild.ts'
import { queueAnchor, queueOrder, slotsAlong, standingInQueue, type QueueSlot } from '../terminalplay/lines'
import { PLAY_TUNING } from '../terminalplay/config'

/** Hall build mode, driven by the terminal kit bar. */
export type HallBuildMode =
  | { kind: 'place'; def: ItemId; rot: number }
  | { kind: 'bulldoze' }
  | { kind: 'move'; itemId: string | null; def: ItemId | null; rot: number }
  | { kind: 'foundation' }
  | { kind: 'wall'; erase: boolean }
  | { kind: 'door' }
  | { kind: 'floor'; paint: string }
  | { kind: 'wallpaper'; paint: string }
  | { kind: 'room'; room: RoomKind; selected: string | null }
  | null

/** What sits under the cursor while building. Feeds the cost tooltip. */
export interface HallHover {
  c: number
  r: number
  /** Hall metres under the cursor. Footprint placement uses these, not the cell. */
  hx: number
  hz: number
  sx: number
  sy: number
  check: PlacementCheck | null
  /** Bulldoze target: the newest item in the hovered cell. */
  target: PlacedItem | null
}

function nodeWorld(id: HallNode): THREE.Vector3 {
  const p = NODE_POS[id]
  return new THREE.Vector3((p.x - 0.5) * HALL_W, 0, (p.y - 0.5) * HALL_D)
}

const FIGURE_SKINS = ['#f6d2b0', '#e0ac69', '#c68642', '#8d5524', '#6b3f2a', '#ffe0c2']
const FIGURE_TROUSERS = ['#f2e2c4', '#6ea2e0', '#8fbf7a', '#d08a62', '#c9b59a', '#e8eef4']

function guestSalt(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Lateral offset so walkers on the same edge don't stack into one blob. */
function guestLane(id: string): number {
  return ((guestSalt(id) % 5) - 2) * 0.72
}

/** Living-interior floor tints. These multiply the terrazzo; they are not the zone paint. */
const FLOOR_TINT: Record<ZoneId, string> = {
  checkin: '#f4f1ea',
  security: '#f2dca6',
  gates: '#e2e6ea',
  arrivals: '#f7f4ee',
  retail: '#f1d3bc',
  toilets: '#e7efe9',
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
  yaw = HALL_CAM_YAW
  pitch = HALL_CAM_PITCH
  dist = HALL_CAM_DIST
  maxDist = HALL_CAM_MAX_DIST
  shellBounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null
  dragging: 'orbit' | 'pan' | 'draw' | null = null
  lastX = 0
  lastY = 0
  roomGroup = new THREE.Group()
  /** Walls, paint, and room slabs from the interior edit. */
  interiorEdit = new THREE.Group()
  interiorGhost = new THREE.Group()
  private interiorSig = { sig: '' }
  private drawA: { x: number; y: number } | null = null
  private drawB: { x: number; y: number } | null = null
  private drawHit = new THREE.Vector3()
  guestGroup = new THREE.Group()
  /** Departures and arrivals from the hall's PaxNav. Stand in for the old hall figures while live. */
  readonly navCrowd = new HallNavCrowd()
  /** Check-in and security interiors: desk signs, bag scales, X-ray trays, queue barriers, staff figures. */
  readonly serviceFx = new HallServiceFx()
  /** Lounge badges. Click opens the dedicate picker. */
  readonly leaseGroup = new THREE.Group()
  /** Walkers drawn last frame (tests, perf probes). */
  navDrawn = 0
  /** Routes, heat, and advisor marks. Hidden unless the player asks or a note is focused. */
  overlay = new THREE.Group()
  /** Queue, lost, bag, and shop markers. Always drawn. Numbers open on click. */
  hotspotGroup = new THREE.Group()
  bagGroup = new THREE.Group()
  guests = new Map<string, THREE.Object3D>()
  /** Legs, arms, torso, head, and carry-on: five instanced meshes for every guest. */
  readonly figures = new HallFigureBatch()
  private perfOverlay = retainPerfOverlay()
  private readonly figBag = new THREE.BoxGeometry(0.22, 0.32, 0.14)
  private readonly figPin = new THREE.ConeGeometry(0.09, 0.26, 6)
  private readonly figSnack = new THREE.BoxGeometry(0.1, 0.12, 0.1)
  private readonly figMats = new Map<string, THREE.Material>()
  private beforeLabel!: THREE.Mesh
  private afterLabel!: THREE.Mesh
    private beltCubes: THREE.Mesh[] = []
  private claimCubes: THREE.Mesh[] = []
  private sortCubes: THREE.Mesh[] = []
  private deskCubes: THREE.Mesh[] = []
  private luggageBuilt = false
  roomHash = ''
  /** Apron terminal drawn inside the hall: rooms, plaster, glass, signs, desks. */
  private interiorGroup = new THREE.Group()
  private interior: TerminalBuilding | null = null
  private interiorFit: HallFit | null = null
  private roomPlan: RoomPlan | null = null
  private interiorKey = ''
  private interiorMs = 0
  /** Last hall-camera pose passed into the interior. A match plus a settled building skips the step. */
  private interiorPose = ''
  private fadeCamKey = ''
  private hotspotSig = ''
  private overlaySig = ''
  private readonly apronCamPos = new THREE.Vector3()
  private readonly routeCache = new Map<string, { x: number; z: number }[] | null>()
  private terminalTextures: WorldTextures | null = null
  private terminalShared: TerminalShared | null = null
  private floor: THREE.Mesh
  /** Shared polished-floor map. Room slabs tint it; they do not own it. */
  private terrazzo: THREE.Texture
  private floorMap: THREE.Texture
  /** Loud zone colours. Off unless the player is building or painting. */
  private zoneTint = new THREE.Group()
  private zoneTintSig = ''
  private paintZones = false
  private game: Game | null = null
  private downX = 0
  private downY = 0
  private ray = new THREE.Raycaster()
  private zoomScratch = new THREE.Vector3()
  private proj = new THREE.Vector3()
  private poseBuf = new Float32Array(256 * 4)
  /** Passenger the camera is easing toward. Cleared by pan, orbit, or a lost id. */
  followId: string | null = null
  private followSnapDist = false
  /** Instanced food, seat, and decor meshes. Rebuilt with the room hash. */
  kitGroup = new THREE.Group()
  private supply = new SupplyCartLayer()
  private walkGroup = new THREE.Group()
  private walkSig = ''
  private walkSlats: { mesh: THREE.Mesh; originX: number; originZ: number; rot: number }[] = []
  /** Floor litter decals and janitor pawns. */
  litter = new HallLitterLayer()
  build: HallBuildMode = null
  /** Called after a successful place, so the bar can close. */
  onPlaced: (() => void) | null = null
  /** Move mode: the player picked a piece, or cleared the pick. */
  onMovePick: ((id: string | null, def: ItemId | null) => void) | null = null
  /** A click on a room the player already drew. */
  onInteriorSelect: ((id: string) => void) | null = null
  /** PNG data URL from the frame that was just drawn. */
  onCaptured: ((url: string) => void) | null = null
  private captureWanted = false
  onHover: ((hover: HallHover | null) => void) | null = null
  private hover: HallHover | null = null
  private queueGroup = new THREE.Group()
  private queueSig = ''
  private queueTex = new Map<string, THREE.CanvasTexture>()
  private ghost: THREE.Group | null = null
  private ghostDef = ''
  private ghostMat = new THREE.MeshBasicMaterial({
    color: '#4ade80',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  /** Slab the size of the piece, sitting on the floor so the footprint reads from above. */
  private ghostPlate = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.08, 1),
    new THREE.MeshBasicMaterial({
      color: '#4ade80',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  )
  private fidsAt = 0
  private frameQueues = new Map<string, QueueSlot>()
  private frameLines: { node: HallNode; x: number; z: number; x2: number; z2: number }[] = []
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private offGfx: () => void = () => {}

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    this.renderer.setClearColor('#c5d0d8', 1)
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.applyHallGrade(graphicsQuality())
    this.offGfx = subscribeGraphicsQuality((level) => this.applyHallGrade(level))

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#c5d0d8')
    this.scene.fog = new THREE.Fog('#c5d0d8', 120, 240)

    this.camera = new THREE.PerspectiveCamera(HALL_CAM_FOV, 1, HALL_CAM_NEAR, HALL_CAM_FAR)
    // Curb side of the walk, elevated, looking toward the gate.
    this.pivot.set(HALL_CAM_LOOK_X, 0, HALL_CAM_LOOK_Z)
    this.placeCam()

    // Lambert divides by pi, so the fill sits above 1 or the terrazzo reads as mud.
    this.scene.add(new THREE.HemisphereLight(HALL_LIGHT.hemiSky, HALL_LIGHT.hemiGround, HALL_LIGHT.hemi))
    const sun = new THREE.DirectionalLight(HALL_LIGHT.sun, HALL_LIGHT.sunI)
    sun.position.set(18, 42, 14)
    this.scene.add(sun)
    this.scene.add(new THREE.AmbientLight(HALL_LIGHT.ambient, HALL_LIGHT.ambientI))

    const terrazzo = rasterTexture(paintTerrazzo(256), { anisotropy: 4 })
    this.terrazzo = terrazzo
    const floorMap = terrazzo.clone()
    floorMap.repeat.set((HALL_W + 8) / 4.2, (HALL_D + 8) / 4.2)
    this.floorMap = floorMap
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(HALL_W + 8, HALL_D + 8),
      new THREE.MeshLambertMaterial({ map: floorMap, color: '#f4f1ea' }),
    )
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = 0
    this.scene.add(this.floor)

    const before = this.makeLabel('BEFORE SECURITY', '#8ee0a8')
    before.position.set(-HALL_W * 0.28, 0.08, -HALL_D * 0.42)
    before.rotation.x = -Math.PI / 2
    this.beforeLabel = before
    this.scene.add(before)
    const after = this.makeLabel('AFTER SECURITY', '#7ec3e8')
    after.position.set(HALL_W * 0.28, 0.08, -HALL_D * 0.42)
    after.rotation.x = -Math.PI / 2
    this.afterLabel = after
    this.scene.add(after)

    this.scene.add(this.roomGroup)
    this.interiorEdit.name = 'interior-edit'
    this.scene.add(this.interiorEdit)
    this.scene.add(this.interiorGhost)
    this.interiorGroup.name = 'hall-rooms'
    this.scene.add(this.interiorGroup)
    this.zoneTint.visible = false
    this.scene.add(this.zoneTint)
    this.scene.add(this.kitGroup)
    this.scene.add(this.supply.counters)
    this.scene.add(this.supply.group)
    this.scene.add(this.walkGroup)
    this.scene.add(this.litter.group)
    this.scene.add(this.guestGroup)
    this.scene.add(this.figures.group)
    this.scene.add(this.navCrowd.group)
    this.navCrowd.skipRole = HallServiceFx.drawsRole
    this.leaseGroup.name = 'hall-lease-marks'
    this.scene.add(this.serviceFx.group)
    this.scene.add(this.leaseGroup)
    this.overlay.visible = false
    this.scene.add(this.overlay)
    this.scene.add(this.hotspotGroup)
    this.scene.add(this.queueGroup)
    this.ghostPlate.visible = false
    this.scene.add(this.ghostPlate)
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
    // The player grabbed the camera: stop easing toward a "Show me" target.
    this.goalTo = null
    this.followId = null
    // Middle/right = orbit; left-drag = pan (WASD also pans).
    if (this.interiorKind() && e.button === 0 && !e.shiftKey) {
      this.dragging = 'draw'
      const t = this.interiorTile(e)
      this.drawA = t
      this.drawB = t
      this.refreshInteriorGhost()
      return
    }
    if (e.button === 1 || e.button === 2) this.dragging = 'orbit'
    else this.dragging = e.shiftKey ? 'orbit' : 'pan'
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.downX = e.clientX
    this.downY = e.clientY
  }

  private onMove = (e: PointerEvent) => {
    if (this.build) this.trackHover(e)
    if (this.dragging === 'draw') {
      const t = this.interiorTile(e)
      if (t) this.drawB = t
      this.refreshInteriorGhost()
      return
    }
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
    this.followId = null
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    this.pivot.addScaledVector(right, rightAmt)
    this.pivot.addScaledVector(fwd, forwardAmt)
    this.placeCam()
  }

  nudgeYaw(delta: number) {
    this.followId = null
    this.yaw += delta
    this.placeCam()
  }

  /** Positive delta pulls back. Keyboard and triggers pass a distance; the wheel scales it. */
  nudgeZoom(delta: number) {
    this.followSnapDist = false
    this.dist = Math.min(this.maxDist, Math.max(HALL_CAM_MIN_DIST, this.dist + delta))
    this.placeCam()
  }

  /** Scroll zoom. The floor point under the cursor stays put. */
  zoomToward(clientX: number, clientY: number, delta: number) {
    this.followSnapDist = false
    const before = this.floorAt(clientX, clientY)
    const bx = before?.x ?? 0
    const bz = before?.z ?? 0
    this.dist = Math.min(this.maxDist, Math.max(HALL_CAM_MIN_DIST, this.dist + delta))
    this.placeCam()
    const after = before ? this.floorAt(clientX, clientY) : null
    const shift = zoomToCursorShift(before ? { x: bx, z: bz } : null, after ? { x: after.x, z: after.z } : null)
    if (shift.x !== 0 || shift.z !== 0) {
      this.pivot.x += shift.x
      this.pivot.z += shift.z
      this.placeCam()
    }
  }

  /** Follow a selected passenger. Pass the same id again to let go. */
  setFollow(id: string | null) {
    if (!id || this.followId === id) {
      this.followId = null
      return
    }
    this.followId = id
    this.goalTo = null
    this.followSnapDist = true
  }

  private floorAt(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const w = rect.width || 1
    const h = rect.height || 1
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / w) * 2 - 1,
      -((clientY - rect.top) / h) * 2 + 1,
    )
    this.ray.setFromCamera(ndc, this.camera)
    return this.ray.ray.intersectPlane(this.floorPlane, this.zoomScratch)
  }

  /** Walker nearest the click in screen space, departures and arrivals. Crew are skipped. */
  private pickWalker(e: PointerEvent): string | null {
    const game = this.game
    if (!game?.hallNav.live) return null
    const nav = game.hallNav
    const pax = nav.passengers
    if (pax <= 0) return null
    if (this.poseBuf.length < pax * 4) this.poseBuf = new Float32Array(pax * 4)
    nav.writePoses(this.poseBuf)
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ox = nav.originX
    const oz = nav.originZ
    const limit = HALL_WALKER_PICK.screenPx * HALL_WALKER_PICK.screenPx
    let best: string | null = null
    let bestD = limit
    for (let i = 0; i < pax; i++) {
      this.proj.set(this.poseBuf[i * 4] + ox, HALL_WALKER_PICK.bodyY, this.poseBuf[i * 4 + 2] + oz)
      this.proj.project(this.camera)
      if (this.proj.z < -1 || this.proj.z > 1) continue
      const sx = (this.proj.x * 0.5 + 0.5) * rect.width + rect.left
      const sy = (-this.proj.y * 0.5 + 0.5) * rect.height + rect.top
      const d = (sx - e.clientX) ** 2 + (sy - e.clientY) ** 2
      if (d > bestD) continue
      const id = nav.idAt(i)
      if (!id) continue
      bestD = d
      best = id
    }
    return best
  }

  private easeFollow() {
    const id = this.followId
    const game = this.game
    if (!id || !game) return
    const at = game.hallNav.locate(id)
    if (!at) {
      this.followId = null
      return
    }
    const k = 0.22
    this.pivot.x += (at.x - this.pivot.x) * k
    this.pivot.z += (at.z - this.pivot.z) * k
    if (this.followSnapDist) {
      this.dist += (HALL_FOLLOW_DIST - this.dist) * k
      if (Math.abs(this.dist - HALL_FOLLOW_DIST) < 0.35) this.followSnapDist = false
    }
    this.placeCam()
  }

  private onUp = (e: PointerEvent) => {
    const dx = e.clientX - this.downX
    const dy = e.clientY - this.downY
    const drag = this.dragging
    this.dragging = null
    if (drag === 'draw') {
      this.commitInteriorDraw()
      return
    }
    if (e.button !== 0 || Math.hypot(dx, dy) > 6 || !this.game) return
    if (this.build) {
      this.buildClick(e)
      return
    }
    this.aim(e)
    const assignHit = this.assignHit()
    if (assignHit) {
      const { kind, id } = assignHit
      if (this.game.assignBulk && (kind === 'desk' || kind === 'gate')) this.game.toggleAssignSelection(kind, id)
      else this.game.openAssign(kind, id)
      return
    }
    const walked = this.pickWalker(e)
    if (walked) {
      this.game.selectGuest(walked)
      return
    }
    const spotHits = this.ray.intersectObjects(this.hotspotGroup.children, true)
    const queueHits = this.ray.intersectObjects(this.queueGroup.children, true)
    const roomHits = this.ray.intersectObjects(this.roomGroup.children, true)
    const bodyHits = this.ray.intersectObject(this.figures.torso, false)
    const hits = this.ray.intersectObjects(this.guestGroup.children, true)
    const spot = spotHits[0]
    const person = bodyHits[0] && (!hits[0] || bodyHits[0].distance <= hits[0].distance) ? bodyHits[0] : hits[0]
    // Nav-grid walkers are instanced: pick the one nearest where the ray crosses body height.
    if (!person && this.game.hallNav.live) {
      const r = this.ray.ray
      const t = Math.abs(r.direction.y) > 1e-6 ? (HALL_WALKER_PICK.bodyY - r.origin.y) / r.direction.y : -1
      const id = t > 0 ? this.game.hallNav.pickAt(r.origin.x + r.direction.x * t, r.origin.z + r.direction.z * t, HALL_WALKER_PICK.radiusM) : null
      if (id) {
        this.game.selectGuest(id)
        return
      }
    }
    const fidsHit = this.ray.intersectObjects(this.interiorGroup.children, true).find((hit) => objectIsFidsBoard(hit.object))
    if (fidsHit && (!person || fidsHit.distance <= person.distance)) {
      setFidsOpen(true)
      return
    }
    const facilityHit = [...queueHits, ...roomHits].find((hit) => {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        if (typeof obj.userData.facilityId === 'string') return true
        obj = obj.parent
      }
      return false
    })
    if (facilityHit && (!person || facilityHit.distance <= person.distance)) {
      let obj: THREE.Object3D | null = facilityHit.object
      while (obj) {
        if (typeof obj.userData.facilityId === 'string') {
          this.game.selectFacility(obj.userData.facilityId)
          return
        }
        obj = obj.parent
      }
    }
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
    const body = bodyHits[0]
    if (body && (!hits[0] || body.distance <= hits[0].distance)) {
      id = this.figures.guestId(body.instanceId ?? -1)
    }
    for (const hit of id ? [] : hits) {
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

  private assignHit(): { kind: 'desk' | 'lane' | 'gate' | 'lounge' | 'hangar' | 'vehicle'; id: string } | null {
    const hits = this.ray.intersectObjects([...this.serviceFx.pickTargets(), ...this.leaseGroup.children], true)
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        const kind = obj.userData.assignKind
        const id = obj.userData.assignId
        if (isAssignKind(kind) && typeof id === 'string' && id) return { kind, id }
        obj = obj.parent
      }
    }
    return null
  }

  private syncHallLeases(game: Game) {
    const marks: LeaseMark[] = game.hallLoungeMarks().map((row) => ({
      key: row.id,
      x: -6 + row.index * 1.6,
      y: 0.02,
      z: 3.2,
      primary: row.primary,
      code: row.code,
      lay: 'upright',
      span: 0.7,
      kind: 'lounge',
      id: row.id,
    }))
    syncLeaseMarks(this.leaseGroup, marks)
  }

  private aim(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    )
    this.ray.setFromCamera(ndc, this.camera)
  }

  private zoneGrid(): { cols: number; rows: number } {
    const zones = this.game?.activeHall()?.zones ?? []
    return { cols: zones[0]?.length || GRID_C, rows: zones.length || GRID_R }
  }

  /** Zone-cell centre. Expanded shells keep the original cells and add wings. */
  private cellPos(c: number, r: number, cols: number, rows: number): { x: number; z: number } {
    return cellCenterInFloor(c, r, this.game?.activeHall()?.floorExtra, cols, rows)
  }

  /** Grow the pick floor and pull the camera back when the shell is larger than the stamp. */
  private frameShell(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
    this.shellBounds = bounds
    const minX = Math.min(bounds.minX, -HALL_W / 2)
    const maxX = Math.max(bounds.maxX, HALL_W / 2)
    const minZ = Math.min(bounds.minZ, -HALL_D / 2)
    const maxZ = Math.max(bounds.maxZ, HALL_D / 2)
    const w = maxX - minX + 8
    const d = maxZ - minZ + 8
    this.floor.geometry.dispose()
    this.floor.geometry = new THREE.PlaneGeometry(w, d)
    this.floor.position.x = (minX + maxX) / 2
    this.floor.position.z = (minZ + maxZ) / 2
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)
    const base = Math.max(HALL_W, HALL_D) - 2.2
    const grow = Math.max(1, span / base)
    this.maxDist = Math.max(HALL_CAM_MAX_DIST, HALL_CAM_DIST * grow * 1.15)
    if (grow > 1.05) this.dist = Math.min(this.maxDist, HALL_CAM_DIST * grow)
    const fog = this.scene.fog as THREE.Fog
    fog.near = 120 * grow
    fog.far = 240 * grow
    this.placeCam()
  }

  /** Snap the cursor to a hall cell and re-check the placement. */
  private trackHover(e: PointerEvent) {
    const game = this.game
    if (!game || !this.build) return
    this.aim(e)
    const hit = new THREE.Vector3()
    const { cols, rows } = this.zoneGrid()
    let next: HallHover | null = null
    if (this.ray.ray.intersectPlane(this.floorPlane, hit)) {
      const cell = cellInFloor(hit.x, hit.z, game.activeHall()?.floorExtra, cols, rows)
      const c = cell.c
      const r = cell.r
      const box = this.shellBounds
      const onShell = box != null && hit.x >= box.minX && hit.x <= box.maxX && hit.z >= box.minZ && hit.z <= box.maxZ
      const onHall = hit.x >= -HALL_W / 2 && hit.x < HALL_W / 2 && hit.z >= -HALL_D / 2 && hit.z < HALL_D / 2
      if ((onHall || onShell) && c >= 0 && r >= 0 && c < cols && r < rows) {
        const items = (game.activeHall()?.items ?? []) as PlacedItem[]
        const inCell = items.filter((i) => i.c === c && i.r === r)
        const loose = inCell.filter((i) => !i.bundle)
        const moveId = this.build.kind === 'move' ? this.build.itemId : null
        const picking = this.build.kind === 'move' && !moveId
        const placeDef = this.build.kind === 'place' ? this.build.def : null
        const moveDef = this.build.kind === 'move' ? this.build.def : null
        const footDef = placeDef ?? (moveId ? moveDef : null)
        const useFoot = Boolean(footDef && footprintSpec(footDef) && this.roomPlan && this.interiorFit)
        const stamped = footprintHit(items, hit.x, hit.z) as PlacedItem | null
        const cellTarget = loose[loose.length - 1] ?? (picking ? (inCell[inCell.length - 1] ?? null) : null)
        next = {
          c,
          r,
          hx: hit.x,
          hz: hit.z,
          sx: e.clientX,
          sy: e.clientY,
          check: useFoot
            ? game.hallFootprintCheck(footDef as ItemId, hit.x, hit.z, this.build.kind === 'move' || this.build.kind === 'place' ? this.build.rot : 0, moveId ?? undefined)
            : this.build.kind === 'place'
              ? game.hallPlacement(this.build.def, c, r)
              : moveId
                ? game.hallMoveCheck(moveId, c, r)
                : null,
          target:
            this.build.kind === 'bulldoze' || picking
              ? (stamped && !stamped.bundle ? stamped : cellTarget)
              : null,
        }
      }
    }
    this.hover = next
    this.onHover?.(next)
  }

  private buildClick(e: PointerEvent) {
    const game = this.game
    if (!game || !this.build) return
    this.trackHover(e)
    const hover = this.hover
    if (!hover) return
    if (
      this.build.kind === 'foundation' ||
      this.build.kind === 'wall' ||
      this.build.kind === 'door' ||
      this.build.kind === 'floor' ||
      this.build.kind === 'wallpaper' ||
      this.build.kind === 'room'
    ) {
      return
    }
    if (this.build.kind === 'place') {
      const foot = footprintSpec(this.build.def) && this.roomPlan && this.interiorFit
      const placed = foot
        ? game.placeHallFootprint(this.build.def, hover.hx, hover.hz, this.build.rot)
        : game.placeHallItemAt(this.build.def, hover.c, hover.r, this.build.rot)
      if (placed) this.onPlaced?.()
    } else if (this.build.kind === 'move') {
      if (!this.build.itemId) {
        if (hover.target) this.onMovePick?.(hover.target.id, hover.target.def)
      } else {
        const foot = Boolean(this.build.def && footprintSpec(this.build.def) && this.roomPlan && this.interiorFit)
        const moved = foot
          ? game.moveHallFootprint(this.build.itemId, hover.hx, hover.hz, this.build.rot)
          : game.moveHallItem(this.build.itemId, hover.c, hover.r, this.build.rot)
        if (moved) this.onMovePick?.(null, null)
      }
    } else if (hover.target) {
      game.removeHallItem(hover.target.id)
    }
    this.trackHover(e)
  }

  /** Set the build mode. Clears the ghost and tooltip when building stops. */
  setBuild(mode: HallBuildMode) {
    this.build = mode
    if (!mode) {
      this.hover = null
      this.onHover?.(null)
    }
  }

  /** Zone paint from the hall sheet. Tint stays off during ordinary play. */
  setPaintZones(on: boolean) {
    this.paintZones = on
  }

  /** Green / red ghost on the hovered cell's next free slot. */
  private syncGhost(game: Game) {
    const mode = this.build
    const hover = this.hover
    const def = mode?.kind === 'place' ? mode.def : mode?.kind === 'move' ? mode.def : null
    if (!mode || !def || !hover) {
      if (this.ghost) this.ghost.visible = false
      this.ghostPlate.visible = false
      return
    }
    if (!this.ghost || this.ghostDef !== def) {
      if (this.ghost) this.scene.remove(this.ghost)
      this.ghost = buildGhost(def, this.ghostMat)
      this.ghostDef = def
      this.scene.add(this.ghost)
    }
    const { cols, rows } = this.zoneGrid()
    const items = (game.activeHall()?.items ?? []) as PlacedItem[]
    const carried = mode.kind === 'move' ? mode.itemId : null
    const rot = mode.kind === 'move' || mode.kind === 'place' ? mode.rot : 0
    const stamp = footprintSpec(def) && this.roomPlan && this.interiorFit ? stampFrom(def, hover.hx, hover.hz, rot) : null
    const loadItems = carried ? items.filter((it) => it.id !== carried) : items
    const start = Math.min(3, cellLoad(loadItems, hover.c, hover.r))
    const at = stamp
      ? { x: stamp.hx, z: stamp.hz }
      : slotCenter(hover.c, hover.r, start, itemSize(itemDef(def)), cols, rows)
    const check = stamp
      ? game.hallFootprintCheck(def as ItemId, hover.hx, hover.hz, rot, carried ?? undefined)
      : carried
        ? game.hallMoveCheck(carried, hover.c, hover.r)
        : game.hallPlacement(def, hover.c, hover.r)
    const color = check.ok ? '#4ade80' : '#ef4444'
    this.ghostMat.color.set(color)
    this.ghost.position.set(at.x, 0.07, at.z)
    this.ghost.rotation.y = (rot * Math.PI) / 2
    this.ghost.visible = true
    if (stamp) {
      this.ghostPlate.scale.set(stamp.w, 1, stamp.d)
      this.ghostPlate.position.set(stamp.hx, 0.16, stamp.hz)
      ;(this.ghostPlate.material as THREE.MeshBasicMaterial).color.set(color)
      this.ghostPlate.visible = true
    } else {
      this.ghostPlate.visible = false
    }
  }

  private onWheel = (e: WheelEvent) => {
    if (!inputMap.wheelMatches(e.deltaY)) return
    e.preventDefault()
    const step = Math.max(0.02, this.dist * 0.0012)
    this.zoomToward(e.clientX, e.clientY, e.deltaY * step)
  }

  private goalSeq = 0
  private goalTo: { x: number; z: number } | null = null
  private goalFrame = 0

  /** Ease the pivot toward the last "Show me" / "Pan to problem" hall cell. */
  private easeToGoal(game: Game) {
    const now = performance.now()
    const dt = this.goalFrame ? Math.min(0.1, (now - this.goalFrame) / 1000) : 0
    this.goalFrame = now
    const g = game.camGoal
    if (g && g.view === 'hall' && g.seq !== this.goalSeq) {
      this.goalSeq = g.seq
      const { cols, rows } = this.zoneGrid()
      this.goalTo = this.cellPos(g.c, g.r, cols, rows)
    }
    if (!this.goalTo) return
    const k = 1 - Math.exp(-dt * 6)
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
    if (w < 2 || h < 2) return
    if (canvas.width !== w || canvas.height !== h) {
      this.renderer.setSize(w, h, false)
    }
    // The buffer can already match the CSS size while the lens is still square.
    const aspect = w / h
    if (Math.abs(this.camera.aspect - aspect) > 0.001) {
      this.camera.aspect = aspect
      this.camera.updateProjectionMatrix()
    }
  }

  /** High / Ultra: a detailed jet bridge on the airside gate door. Kept out of roomGroup so its shared materials survive rebuilds. */
  private jetBridge: THREE.Group | null = null
  private placeJetBridge(x: number, z: number, yaw = 0) {
    if (!hiDetailOn(graphicsQuality())) return
    if (!this.jetBridge) {
      capTerminalPropMetal(0.4)
      this.jetBridge = buildTerminalProps([{ type: 'jet_bridge', x: 0, z: 0, yaw: Math.PI / 2 }])
      this.jetBridge.name = 'hall-jet-bridge'
      this.scene.add(this.jetBridge)
    }
    this.jetBridge.rotation.y = yaw
    const out = 2.2
    this.jetBridge.position.set(x + Math.cos(yaw) * out, 0, z - Math.sin(yaw) * out)
    this.jetBridge.visible = true
    setNearPropDetail(this.jetBridge, this.dist <= HALL_NEAR_DIST)
  }

  private box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, mat?: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat ?? new THREE.MeshLambertMaterial({ color }))
    mesh.position.set(x, y, z)
    this.roomGroup.add(mesh)
  }

  /**
   * Dock the hall's jet bridge on the same airside bay the exterior uses.
   * The curtain wall itself is the TerminalBuilding shell, already in the hall frame.
   */
  private dockAirsideBridge() {
    const building = this.interior
    const fit = this.interiorFit
    if (!building || !fit) return
    const gates = facadeOpenings(building.info).filter((o) => o.kind === 'gate')
    if (!gates.length) return
    const opening = gates[Math.floor(gates.length / 2)]
    const hall = apronToHall(opening.x, opening.z, fit)
    this.placeJetBridge(hall.x, hall.z, outwardYaw(opening.side))
  }

  /** Zone boxes, the carousel and the old columns draw only when the room plan is off. */
  private applyRoomLayer() {
    const legacy = showLegacyHallFurniture(this.roomPlan != null)
    this.kitGroup.visible = legacy
    this.beforeLabel.visible = legacy
    this.afterLabel.visible = legacy
    this.floor.position.y = legacy ? 0 : -0.05
  }

  /**
   * Perimeter shell with door gaps, plus walls where security meets the curb side.
   * When the room interior is up, the nav grid's inner partitions stay off so the
   * nine rooms are the walls you see. The outer shell still frames the hall.
   */
  private buildShell(zones: ZoneId[][], nav: HallNav, rooms: boolean) {
    const h = 3.15
    const t = 0.38
    const y = h / 2
    const wall = '#d5ddd8'
    const halfW = HALL_W / 2
    const halfD = HALL_D / 2
    const layout = nav.live ? nav.nav?.layout : null
    if (layout) {
      // Walkers are live: draw exactly the walls they walk round, gaps at every door.
      const m = BUILD_TUNING.tileMetres
      const o = nav.origin()
      const outer = (e: Edge) => e.x < 0 || e.y < 0 || (e.dir === 'E' ? e.x >= layout.w - 1 : e.y >= layout.h - 1)
      for (const e of layout.walls) {
        if (rooms && !outer(e)) continue
        const color = outer(e) ? wall : '#c9a27a'
        const thick = outer(e) ? t : 0.28
        if (e.dir === 'E') this.box(thick, h, m + thick, color, o.x + (e.x + 1) * m, y, o.z + (e.y + 0.5) * m)
        else this.box(m + thick, h, thick, color, o.x + (e.x + 0.5) * m, y, o.z + (e.y + 1) * m)
      }
      this.box(HALL_W + 0.6, 0.18, 0.5, '#e7eee9', 0, h, -halfD)
      this.box(HALL_W + 0.6, 0.18, 0.5, '#e7eee9', 0, h, halfD)
      // Living-interior columns stay up while the nav shell is drawn.
      for (const x of [-16, -4, 8, 18]) {
        for (const z of [-11, 11]) {
          this.box(0.42, h, 0.42, '#e6eaee', x, y, z)
        }
      }
      if (rooms) this.buildSecureWalls(zones)
      return
    }
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
    this.placeJetBridge(halfW, eastGapZ)
    // Cornice only — no roof slab.
    this.box(HALL_W + 0.6, 0.18, 0.5, '#e7eee9', 0, h, -halfD)
    this.box(HALL_W + 0.6, 0.18, 0.5, '#e7eee9', 0, h, halfD)
    // Columns down the concourse, clear of the doors and the centre walk.
    for (const x of [-16, -4, 8, 18]) {
      for (const z of [-11, 11]) {
        this.box(0.42, h, 0.42, '#e6eaee', x, y, z)
      }
    }
    this.buildSecureWalls(zones)
  }

  /** Full-height plaster where security meets check-in or arrivals. The gate side stays open. */
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
    const stuff = (fit?.items ?? []).map((i) => `${i.def}@${i.c},${i.r}r${i.rot ?? 0}${kitMeshKey(i as PlacedItem)}`).join(';')
    const nav = game.hallNav
    const walk = nav.live ? `${nav.nav?.revision}:${nav.nav?.layout.walls.length}:${nav.nav?.layout.doors.length}` : '-'
    const rooms = this.roomPlan ? 'rooms' : 'open'
    const hash = `${open}|${choke}|${fit?.tier ?? 0}|${paint}|${stuff}|${walk}|${rooms}`
    if (hash === this.roomHash) return
    this.roomHash = hash
    if (this.jetBridge) this.jetBridge.visible = false
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
    const hasRooms = this.roomPlan != null && this.interiorFit != null
    if (hasRooms) this.dockAirsideBridge()
    else this.buildShell(zones as ZoneId[][], nav, false)

    if (hasRooms) {
      this.clearKit()
      this.applyRoomLayer()
      return
    }

    const cw = HALL_W / cols
    const rh = HALL_D / rows
    const floorPieces: BakePiece[] = []
    const floorGeos: THREE.BufferGeometry[] = []
    const tint = new THREE.Color()
    for (let r = 0; r < zones.length; r++) {
      for (let c = 0; c < zones[r].length; c++) {
        const z = zones[r][c] as ZoneId | null
        if (!z) continue
        const pos = this.cellPos(c, r, cols, rows)
        const geo = new THREE.PlaneGeometry(cw - 0.04, rh - 0.04)
        geo.rotateX(-Math.PI / 2)
        floorGeos.push(geo)
        floorPieces.push({
          geo,
          matrix: new THREE.Matrix4().makeTranslation(pos.x, 0.02, pos.z),
          color: tint.set(FLOOR_TINT[z]).getHex(),
        })
      }
    }
    const floorGeo = bake(floorPieces, true)
    for (const geo of floorGeos) geo.dispose()
    if (floorGeo) {
      const floor = new THREE.Mesh(
        floorGeo,
        new THREE.MeshLambertMaterial({ map: this.terrazzo, vertexColors: true }),
      )
      floor.name = 'hall-floor'
      this.roomGroup.add(floor)
    }
    this.fadeCamKey = ''

    const laid = layoutItems((fit?.items ?? []) as PlacedItem[], cols, rows)
    for (const { item: it, x, z } of laid) {
      if (hasKitMesh(it.def)) continue
      const worn = it.wear >= 55 ? '#8a5a4a' : (ROOM_COLOR[it.def as HallNode] ?? '#e8eef2')
      const tall = String(it.def).includes('security') ? 1.5 : 0.7
      this.box(1.4, tall, 1.1, worn, x, tall / 2 + 0.05, z)
    }
    for (const { item: it, x, z } of laid) {
      const pick = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.6, 1.4),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      )
      pick.position.set(x, 0.9, z)
      pick.userData.facilityId = `item:${it.id}`
      this.roomGroup.add(pick)
    }
    this.clearKit()
    if (hiDetailOn(graphicsQuality())) {
      const { group, rest } = buildHallDetail(laid, cols, rows)
      this.kitGroup.add(group, buildKitInstances(rest))
    } else this.kitGroup.add(buildKitInstances(laid))
    this.applyRoomLayer()
  }

  private clearKit() {
    for (const sub of this.kitGroup.children) disposeKitInstances(sub as THREE.Group)
    this.kitGroup.clear()
  }

  /**
   * Draw the active hall's planTerminal rooms in the hall frame.
   * Decorative walkers stay at 0; the sim's hallGuests are the crowd.
   */
  private syncInterior(game: Game) {
    const hall = game.activeHall()
    const origin = hall?.origin ?? null
    const hit = matchTerminal(terminals(game), origin)
    const span = hit ? `${hit.info.cluster.maxC - hit.info.cluster.minC}x${hit.info.cluster.maxR - hit.info.cluster.minR}` : ''
    const key = hit ? `${game.mapRev}|${hit.index}|${hit.info.cluster.minC},${hit.info.cluster.minR}|${span}` : ''
    if (key !== this.interiorKey) {
      this.interiorKey = key
      this.clearInterior()
      this.routeCache.clear()
      if (hit) {
        if (!this.terminalShared) {
          this.terminalTextures = makeTextures(64, 4)
          this.terminalShared = makeTerminalShared(this.terminalTextures, baseLevel(graphicsQuality()))
        }
        const anchor = hall?.origin ? stampAnchor(hall.origin, hall.premade) : undefined
        const fit = hallFitFor(hit.info, undefined, anchor)
        this.frameShell(shellHallBounds(hit.info, fit))
        const building = new TerminalBuilding(hit.info, this.terminalShared, {
          density: 1,
          walkersPerCell: 0,
          index: hit.index,
        })
        building.root.position.set(-fit.cx, 0, -fit.cz)
        building.propFade = 1
        building.lifeFade = 1
        this.interiorGroup.scale.setScalar(fit.scale)
        this.interiorGroup.position.y = -FLOOR_Y * fit.scale
        this.interiorGroup.add(building.root)
        this.interior = building
        this.interiorFit = fit
        this.roomPlan = building.rooms
        this.interiorPose = ''
      }
    }
    this.stepInterior()
  }

  /** Cutaway follows the hall camera, pulled in so near walls drop. The shell stays: it is the exterior. */
  private stepInterior() {
    const building = this.interior
    const fit = this.interiorFit
    if (!building || !fit) return
    const now = performance.now()
    const dt = this.interiorMs ? Math.min(0.05, (now - this.interiorMs) / 1000) : 0.016
    this.interiorMs = now
    const cam = this.camera.position
    const local = hallToApron(cam.x, cam.z, fit)
    let x = local.x
    let z = local.z
    const dx = x - building.center.x
    const dz = z - building.center.z
    const flat = Math.hypot(dx, dz) || 1
    const maxFlat = 10
    if (flat > maxFlat) {
      x = building.center.x + (dx / flat) * maxFlat
      z = building.center.z + (dz / flat) * maxFlat
    }
    const y = Math.max(cam.y / fit.scale, ROOF_Y + WORLD_PER_METER * 2)
    const ceilingY = (ROOF_Y - FLOOR_Y) * fit.scale
    const ceiling = cam.y < ceilingY
    const pose = `${x.toFixed(2)}|${y.toFixed(2)}|${z.toFixed(2)}|${ceiling ? 1 : 0}`
    if (pose === this.interiorPose && building.settled()) return
    this.interiorPose = pose
    this.apronCamPos.set(x, y, z)
    building.ceilingForce = ceiling
    building.update(this.apronCamPos, dt, 1, 0, { x: building.center.x, z: building.center.z }, false, this.camera)
    if (this.jetBridge) setNearPropDetail(this.jetBridge, this.dist <= HALL_NEAR_DIST)
  }

  private clearInterior() {
    this.interior?.dispose()
    this.interior = null
    this.interiorFit = null
    this.roomPlan = null
    this.interiorGroup.clear()
    this.interiorGroup.scale.set(1, 1, 1)
    this.interiorGroup.position.y = 0
  }

  /** Rooms, walls and walker count for the fitted interior. Null until a hall has a terminal. */
  interiorCounts() {
    const counts = this.interior?.counts() ?? null
    return counts ? { ...counts, figures: this.guests.size } : null
  }

  private sharedMat(kind: 'lambert' | 'basic', color: string, glow = 0): THREE.Material {
    const key = `${kind}|${color}|${glow}`
    const hit = this.figMats.get(key)
    if (hit) return hit
    const mat =
      kind === 'basic'
        ? new THREE.MeshBasicMaterial({ color, fog: false })
        : new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: glow })
    this.figMats.set(key, mat)
    return mat
  }

  /** Head, torso, arms, and two legs. Geometries and clothing materials are shared. */
  private buildFigure(id: string, color: string): THREE.Group {
    const root = new THREE.Group()
    root.userData.guestId = id
    const salt = guestSalt(id)
    const skin = FIGURE_SKINS[salt % FIGURE_SKINS.length]
    const trousers = FIGURE_TROUSERS[(salt >>> 4) % FIGURE_TROUSERS.length]

    const left = new THREE.Group()
    left.position.set(-0.11, 0.86, 0)
    const leftLeg = new THREE.Object3D()
    leftLeg.position.y = -0.43
    left.add(leftLeg)
    root.add(left)

    const right = new THREE.Group()
    right.position.set(0.11, 0.86, 0)
    const rightLeg = new THREE.Object3D()
    rightLeg.position.y = -0.43
    right.add(rightLeg)
    root.add(right)
    root.userData.leftLeg = left
    root.userData.rightLeg = right
    root.userData.legL = leftLeg
    root.userData.legR = rightLeg

    const torso = new THREE.Object3D()
    torso.position.y = 1.13
    root.add(torso)
    root.userData.torso = torso
    const armL = new THREE.Group()
    armL.position.set(-0.27, 1.38, 0)
    const armMeshL = new THREE.Object3D()
    armMeshL.position.y = -0.24
    armL.add(armMeshL)
    root.add(armL)
    const armR = new THREE.Group()
    armR.position.set(0.27, 1.38, 0)
    const armMeshR = new THREE.Object3D()
    armMeshR.position.y = -0.24
    armR.add(armMeshR)
    root.add(armR)
    root.userData.leftArm = armL
    root.userData.rightArm = armR
    root.userData.armL = armMeshL
    root.userData.armR = armMeshR

    const head = new THREE.Object3D()
    head.position.y = 1.58
    root.add(head)
    root.userData.head = head
    root.userData.shirtColor = new THREE.Color(color)
    root.userData.trouserColor = new THREE.Color(trousers)
    root.userData.skinColor = new THREE.Color(skin)

    const build = 0.9 + (salt % 6) * 0.025
    const width = 0.9 + ((salt >>> 8) % 5) * 0.04
    root.userData.bodyH = build
    root.userData.bodyW = width
    const luggage = (salt >>> 16) % 5
    root.userData.luggage = luggage === 0 ? 'none' : luggage < 3 ? 'roller' : 'backpack'
    const pin = new THREE.Mesh(this.figPin, this.sharedMat('lambert', '#e23b2f', 0.2))
    pin.position.y = 1.98
    root.add(pin)
    root.userData.pin = pin

    const carry = new THREE.Object3D()
    if (root.userData.luggage === 'backpack') {
      carry.position.set(0, 1.22, -0.22)
      carry.scale.set(1.15, 0.75, 0.5)
    } else {
      carry.position.set(0.36, 0.36, 0.16)
    }
    root.add(carry)
    root.userData.carry = carry
    const bags = ['#1f2937', '#7f1d1d', '#1e3a8a', '#065f46', '#9a3412']
    root.userData.bagColor = new THREE.Color(bags[salt % bags.length])

    const checked = new THREE.Mesh(this.figBag, this.sharedMat('basic', '#ffb703'))
    checked.position.set(-0.32, 0.22, 0.04)
    root.add(checked)
    root.userData.checked = checked

    const snack = new THREE.Mesh(this.figSnack, this.sharedMat('lambert', '#f4efe4', 0.15))
    snack.position.set(0.28, 1.08, 0.16)
    root.add(snack)
    root.userData.snack = snack
    return root
  }

  private disposeFigure(root: THREE.Object3D) {
    root.traverse((obj) => {
      const sprite = obj as THREE.Sprite
      if (!sprite.isSprite) return
      const mat = sprite.material
      mat.map?.dispose()
      mat.dispose()
    })
  }

  syncGuests(game: Game) {
    // Departures and arrivals on the live walk are the nav-grid crowd (one
    // queue per desk or lane, plus the serve pose). Doorway figures stay for
    // everyone the walk does not draw, so the two pictures do not stack.
    const nav = game.hallNav
    const routed = this.roomPlan != null && this.interiorFit != null
    const drawn = nav.live
      ? game.hallGuests.filter((g) => g.job !== 'depart' && !nav.drawsArrival(g.id))
      : game.hallGuests
    const live = new Set(drawn.map((g) => g.id))
    for (const [id, mesh] of this.guests) {
      if (!live.has(id)) {
        this.guestGroup.remove(mesh)
        this.disposeFigure(mesh)
        this.guests.delete(id)
      }
    }
    const pile = new Map<string, number>()
    const figureDraws: FigureDraw[] = []
    const zones = game.activeHall()?.zones ?? []
    const cols = zones[0]?.length || GRID_C
    const rows = zones.length || GRID_R
    for (const g of drawn) {
      if (g.releaseAt != null && g.releaseAt > game.clock) continue
      let mesh = this.guests.get(g.id)
      if (!mesh) {
        mesh = this.buildFigure(g.id, g.color)
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
      const pose =
        routed && this.roomPlan && this.interiorFit
          ? poseOnPlan(
              this.roomPlan,
              {
                id: g.id,
                node,
                job: g.job,
                clearedSec: g.clearedSec,
                wx: g.wx,
                wz: g.wz,
                t: g.t,
                wyaw: g.wyaw,
                route: g.route,
              },
              next,
              this.routeCache,
            )
          : null
      let x = a.x + (b.x - a.x) * t
      let z = a.z + (b.z - a.z) * t
      if (pose && this.interiorFit) {
        const hall = apronToHall(pose.x, pose.z, this.interiorFit)
        x = hall.x
        z = hall.z
        if (next && !pose.fromSim) {
          const lane = (g.lane ?? guestLane(g.id)) * 0.28
          x += -Math.cos(pose.yaw) * lane
          z += Math.sin(pose.yaw) * lane
        }
        mesh.rotation.y = pose.yaw + (g.previewDir === -1 ? Math.PI : 0)
      } else if (next) {
        const dx = b.x - a.x
        const dz = b.z - a.z
        const len = Math.hypot(dx, dz) || 1
        const lane = g.lane ?? guestLane(g.id)
        x += (-dz / len) * lane
        z += (dx / len) * lane
        mesh.rotation.y = Math.atan2(dx, dz) + (g.previewDir === -1 ? Math.PI : 0)
      } else {
        x += (slot % 4) * 0.48 - 0.72
        z += Math.floor(slot / 4) * 0.48
      }
      const queued = this.frameQueues.get(g.id)
      if (queued) {
        x = queued.x
        z = queued.z
        mesh.rotation.y = queued.yaw
      }
      const desk = g.atBagDesk ? nodeWorld('claim') : null
      mesh.position.set(desk ? desk.x - 3.4 + (slot % 3) * 0.7 : x, 0, desk ? desk.z + 2.4 : z)
      const figure = this.interiorFit ? hallGuestScale(this.interiorFit) : 1
      const bodyH = (mesh.userData.bodyH as number) || 1
      const bodyW = (mesh.userData.bodyW as number) || 1
      mesh.scale.set(figure * bodyW, figure * bodyH, figure * bodyW)
      if (g.meal) {
        // Walk the tray from the counter to the booked seat, then sit: lower and squat.
        const seat = this.cellPos(g.meal.c, g.meal.r, cols, rows)
        const sx = seat.x + (g.meal.slot % 2) * 0.9 - 0.45
        const sz = seat.z + Math.floor(g.meal.slot / 2) * 0.9 - 0.45
        const k = g.meal.walkSec > 0 ? 1 - g.meal.walk / g.meal.walkSec : 1
        mesh.position.x += (sx - mesh.position.x) * k
        mesh.position.z += (sz - mesh.position.z) * k
        if (g.seated) mesh.scale.y = figure * bodyH * 0.72
      }
      const walking = Boolean(next) && !g.seated
      const phase = (guestSalt(g.id) % 628) / 100
      const swing = walking ? Math.sin(game.clock * 6.5 + phase) * 0.65 : Math.sin(game.clock * 1.25 + phase) * 0.08
      const left = mesh.userData.leftLeg as THREE.Object3D
      const right = mesh.userData.rightLeg as THREE.Object3D
      left.rotation.x = swing
      right.rotation.x = -swing
      const leftArm = mesh.userData.leftArm as THREE.Object3D | undefined
      const rightArm = mesh.userData.rightArm as THREE.Object3D | undefined
      if (leftArm && rightArm) {
        leftArm.rotation.x = -swing * 0.65
        rightArm.rotation.x = swing * 0.65
      }
      mesh.position.y = Math.abs(Math.sin(game.clock * (walking ? 6.5 : 1.25) + phase)) * (walking ? 0.045 : 0.012)
      const pin = mesh.userData.pin as THREE.Mesh
      pin.visible = Boolean(g.lost)
      const checked = mesh.userData.checked as THREE.Mesh
      checked.visible = Boolean(g.hasChecked)
      const snack = mesh.userData.snack as THREE.Mesh
      snack.visible = Boolean(g.snack)
      if (g.snack) snack.scale.set(g.snack.kind === 'meal' ? 1.8 : 1, g.snack.kind === 'meal' ? 0.6 : 1, 1)
      this.syncBubble(mesh, g.thought)
      mesh.updateWorldMatrix(true, true)
      figureDraws.push({
        id: g.id,
        legL: mesh.userData.legL as THREE.Object3D,
        legR: mesh.userData.legR as THREE.Object3D,
        armL: mesh.userData.armL as THREE.Object3D,
        armR: mesh.userData.armR as THREE.Object3D,
        torso: mesh.userData.torso as THREE.Object3D,
        head: mesh.userData.head as THREE.Object3D,
        carry: mesh.userData.carry as THREE.Object3D,
        showCarry: g.carryOn !== false && mesh.userData.luggage !== 'none',
        bag: mesh.userData.bagColor as THREE.Color,
        shirt: mesh.userData.shirtColor as THREE.Color,
        trousers: mesh.userData.trouserColor as THREE.Color,
        skin: mesh.userData.skinColor as THREE.Color,
      })
    }
    this.figures.write(figureDraws)
  }

  /** Walls and counters that sit in the lens fade instead of clipping the frame. */
  private fadeNearShell() {
    const cam = this.camera.position
    const key = `${cam.x.toFixed(2)}|${cam.y.toFixed(2)}|${cam.z.toFixed(2)}`
    if (key === this.fadeCamKey) return
    this.fadeCamKey = key
    const limit = HALL_OCCLUDE_M
    this.roomGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const geo = mesh.geometry as THREE.BoxGeometry
      const h = geo.parameters?.height ?? 0
      if (h < 0.5) return
      const mat = mesh.material as THREE.MeshLambertMaterial
      if (!mat || Array.isArray(mat) || !('opacity' in mat)) return
      const d = mesh.position.distanceTo(cam)
      if (d < limit) {
        const opacity = Math.max(0.05, (d - HALL_CAM_NEAR) / (limit - HALL_CAM_NEAR))
        mat.transparent = true
        mat.opacity = opacity
        mat.depthWrite = opacity > 0.85
      } else if (mat.opacity !== 1 || mat.transparent) {
        mat.opacity = 1
        mat.transparent = false
        mat.depthWrite = true
      }
    })
  }

  /** Wish line while they leave an empty counter. */
  private syncBubble(mesh: THREE.Object3D, thought: string) {
    const show = thought.startsWith('wish they') || thought.startsWith('Lost-bag')
    let sprite = mesh.userData.bubble as THREE.Sprite | undefined
    if (!show) {
      if (sprite) sprite.visible = false
      return
    }
    if (!sprite) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false })
      sprite = new THREE.Sprite(mat)
      sprite.position.set(0, 2.15, 0)
      sprite.scale.set(2.8, 0.75, 1)
      mesh.add(sprite)
      mesh.userData.bubble = sprite
    }
    if (mesh.userData.bubbleText !== thought) {
      const c = document.createElement('canvas')
      c.width = 512
      const ctx = c.getContext('2d')!
      ctx.font = '700 36px sans-serif'
      const words = thought.split(' ')
      const lines: string[] = []
      let line = ''
      for (const word of words) {
        const next = line ? `${line} ${word}` : word
        if (ctx.measureText(next).width > 470 && line) {
          lines.push(line)
          line = word
        } else line = next
      }
      if (line) lines.push(line)
      const shown = lines.slice(0, 3)
      c.height = 56 + shown.length * 52
      ctx.font = '700 36px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.94)'
      ctx.fillRect(8, 10, 496, c.height - 20)
      ctx.strokeStyle = '#1a2a32'
      ctx.lineWidth = 6
      ctx.strokeRect(8, 10, 496, c.height - 20)
      ctx.fillStyle = '#1a2a32'
      ctx.textAlign = 'center'
      shown.forEach((row, i) => ctx.fillText(row, 256, 52 + i * 46))
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      const mat = sprite.material as THREE.SpriteMaterial
      mat.map?.dispose()
      mat.map = tex
      mat.needsUpdate = true
      mesh.userData.bubbleText = thought
      sprite.scale.set(3.4, 0.62 + shown.length * 0.42, 1)
      sprite.position.y = 1.9 + shown.length * 0.28
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

  /**
   * People who have reached a desk stand in a spaced line. The badge count
   * is the same set, painted red once it is long enough to be a bottleneck.
   */
  private buildFrameQueues(game: Game) {
    this.frameQueues.clear()
    this.frameLines = []
    const plan = this.roomPlan
    const fit = this.interiorFit
    if (!plan || !fit) return
    const items = game.activeHall()?.items ?? []
    const nodes: HallNode[] = ['checkin', 'security', 'bathroom', 'food', 'shop', 'gate']
    for (const node of nodes) {
      const people = queueOrder(
        game.hallGuests.filter((g) => standingInQueue(g, node, game.clock)),
      )
      if (!people.length) continue
      const anchor = queueAnchor(plan, fit, items, node)
      if (!anchor) continue
      const slots = slotsAlong(anchor, people.length, PLAY_TUNING.queueSpacingM)
      people.forEach((g, i) => {
        const slot = slots[i]
        if (slot) this.frameQueues.set(g.id, slot)
      })
      const tail = slots[slots.length - 1]
      if (tail) this.frameLines.push({ node, x: anchor.x, z: anchor.z, x2: tail.x, z2: tail.z })
    }
  }

  /** Queue counts float over the desks. Red means the line is a bottleneck. */
  private syncQueues(game: Game) {
    // While the walk is live its real lines are the queues; else the hall figures' count.
    const walk = game.hallNav.live
    const rows: readonly (HallQueue & { at?: { x: number; z: number } })[] = walk ? game.hallNav.queues() : hallQueues(game.hallGuests)
    const rooms = this.roomPlan ? 1 : 0
    const sig = `${rooms}|${rows.map((row) => `${row.node}:${row.count}:${row.bottleneck ? 1 : 0}`).join('|')}|${this.frameLines.map((l) => `${l.x.toFixed(1)},${l.z.toFixed(1)}`).join(';')}`
    if (sig === this.queueSig) return
    this.queueSig = sig
    for (const child of this.queueGroup.children) {
      const mesh = child as THREE.Mesh
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
      if (child.type === 'Mesh') mesh.geometry?.dispose()
    }
    this.queueGroup.clear()
    for (const row of rows) {
      const key = `${row.count}:${row.bottleneck ? 1 : 0}`
      let tex = this.queueTex.get(key)
      if (!tex) {
        const c = document.createElement('canvas')
        c.width = 128
        c.height = 64
        const ctx = c.getContext('2d')!
        ctx.fillStyle = row.bottleneck ? '#e23b2f' : '#e0a020'
        ctx.fillRect(4, 8, 120, 48)
        ctx.fillStyle = '#1a1408'
        ctx.font = '700 28px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(row.count), 64, 42)
        tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        this.queueTex.set(key, tex)
      }
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
      sprite.scale.set(1.6, 0.8, 1)
      const line = walk ? undefined : this.frameLines.find((l) => l.node === row.node)
      const at = row.at ?? (line ? { x: line.x2, z: line.z2 } : nodeWorld(row.node))
      sprite.position.set(at.x, 2.35, at.z)
      sprite.userData.facilityId = row.node
      this.queueGroup.add(sprite)
      if (line) {
        const dx = line.x2 - line.x
        const dz = line.z2 - line.z
        const len = Math.hypot(dx, dz)
        if (len > 0.15) {
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.03, len),
            new THREE.MeshBasicMaterial({
              color: row.bottleneck ? '#e23b2f' : '#e0a020',
              transparent: true,
              opacity: 0.9,
            }),
          )
          strip.position.set((line.x + line.x2) / 2, 0.18, (line.z + line.z2) / 2)
          strip.rotation.y = Math.atan2(dx, dz)
          this.queueGroup.add(strip)
        }
      }
    }
  }

  /** Markers stay up. The counts live in the click submenu. */
  syncHotspots(game: Game) {
    const ids = game.fits.length ? game.infoHotspots().map((h) => h.id).sort().join(',') : ''
    const sig = `${game.fits.length}|${ids}`
    if (sig === this.hotspotSig) return
    this.hotspotSig = sig
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

  /** Bright zone paint. Hidden in play; on while placing, moving, bulldozing, or painting. */
  private syncZoneTint(game: Game) {
    const show = this.paintZones || this.build != null
    if (!show) {
      this.zoneTint.visible = false
      return
    }
    const fit = game.activeHall()
    const zones = fit?.zones ?? []
    const sig = zones.map((row) => row.join(',')).join('|')
    this.zoneTint.visible = true
    if (sig === this.zoneTintSig && this.zoneTint.children.length > 0) return
    this.zoneTintSig = sig
    for (const child of this.zoneTint.children) {
      const mesh = child as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | undefined
      mat?.dispose()
    }
    this.zoneTint.clear()
    const cols = zones[0]?.length || GRID_C
    const rows = zones.length || GRID_R
    const extra = fit?.floorExtra
    const cw = extra && extra.baseCols ? HALL_W / extra.baseCols : HALL_W / cols
    const rh = extra && extra.baseRows ? HALL_D / extra.baseRows : HALL_D / rows
    for (let r = 0; r < zones.length; r++) {
      for (let c = 0; c < (zones[r]?.length ?? 0); c++) {
        const z = zones[r][c] as ZoneId | null
        if (!z) continue
        const pos = this.cellPos(c, r, cols, rows)
        const tile = new THREE.Mesh(
          new THREE.PlaneGeometry(cw - 0.12, rh - 0.12),
          new THREE.MeshBasicMaterial({
            color: zoneDef(z).color,
            transparent: true,
            opacity: 0.38,
            depthWrite: false,
          }),
        )
        tile.rotation.x = -Math.PI / 2
        tile.position.set(pos.x, 0.05, pos.z)
        this.zoneTint.add(tile)
      }
    }
  }

  /**
   * Separate layer. Hidden unless Show passenger flows is on.
   * An advisor highlight draws only the marked cells, not the flow lines.
   */
  syncOverlay(game: Game) {
    const show = game.showFlows
    const marks = game.advisorCells
    const fit = game.activeHall()
    const sig = overlaySignature(game, show, marks, fit)
    if (sig === this.overlaySig) return
    this.overlaySig = sig
    this.clearOverlay()
    this.overlay.visible = show || marks.length > 0
    if (!this.overlay.visible) return
    const zones = fit?.zones ?? []
    const cols = zones[0]?.length || GRID_C
    const rows = zones.length || GRID_R
    if (marks.length) {
      for (const cell of marks) {
        const pos = this.cellPos(cell.c, cell.r, cols, rows)
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
    if (this.terminalShared && isFidsSource(game)) {
      const now = performance.now()
      const dt = this.fidsAt ? Math.min(0.05, (now - this.fidsAt) / 1000) : 0
      this.fidsAt = now
      this.terminalShared.fids.tick(dt, boardSnapshot(game))
    }
    perfFrame()
    let t = perfStart()
    this.resize()
    this.syncInterior(game)
    this.rebuildRooms(game)
    syncInteriorEdit(this.interiorEdit, game.activeHall()?.interior, interiorEditSig(game.activeHall()?.interior), this.interiorSig)
    this.syncZoneTint(game)
    if (this.followId) this.easeFollow()
    else this.easeToGoal(game)
    this.syncWalkways(game)
    this.buildFrameQueues(game)
    this.syncGuests(game)
    // The room plan keeps its own counters. The walk's crowd still stands in
    // those queues, so a staffed desk shows the line and the serve pose.
    const walk = game.hallNav.live
    if (!walk) {
      this.navCrowd.group.visible = false
      this.serviceFx.group.visible = false
      this.navDrawn = 0
    } else {
      // The room plan has its own counters. The walk still owns the queue,
      // so the airline sign is painted here from the sim's desk list.
      this.navDrawn = this.navCrowd.sync(game.hallNav, game.clock, this.camera)
      const crew = this.navCrowd.lastPoses()
      this.serviceFx.lanePlates = game.lanePlates()
      this.serviceFx.sync(game.hallNav, game.clock, this.camera, game.deskBrands(), crew.poses, crew.total)
    }
    this.syncHallLeases(game)
    this.supply.sync(game.supplyCartPoses())
    this.syncLuggage(game)
    this.syncOverlay(game)
    this.syncHotspots(game)
    this.syncQueues(game)
    this.syncGhost(game)
    const { cols, rows } = this.zoneGrid()
    this.litter.sync(game, cols, rows)
    this.fadeNearShell()
    perfEnd('hall.sync', t)
    t = perfStart()
    this.renderer.render(this.scene, this.camera)
    this.perfOverlay.update(this.renderer, this.scene, {
      passengers: game.terminalPaxCount(),
      vehicles: game.trucks.length + game.servicePoses().length + game.cateringPoses().length,
      aircraft: game.flights.length,
    })
    if (this.captureWanted) {
      this.captureWanted = false
      const url = canvasToPng(this.renderer.domElement)
      if (url) this.onCaptured?.(url)
    }
    if (perf.syncGpu) this.renderer.getContext().finish()
    perfEnd('hall.gl', t)
  }

  /** Moving-walkway belts. Slats travel the length of each stamp. */
  private syncWalkways(game: Game) {
    const fit = game.activeHall()
    const items = (fit?.items ?? []).filter((item) => item.def === 'walkway')
    const sig = items.map((item) => `${item.id}@${item.c},${item.r}r${item.rot ?? 0}`).join(';')
    if (sig !== this.walkSig) {
      this.walkSig = sig
      for (const slat of this.walkSlats) {
        slat.mesh.geometry.dispose()
        ;(slat.mesh.material as THREE.Material).dispose()
      }
      this.walkGroup.clear()
      this.walkSlats = []
      const cols = fit?.zones?.[0]?.length || GRID_C
      const rows = fit?.zones?.length || GRID_R
      const laid = layoutItems((fit?.items ?? []) as PlacedItem[], cols, rows)
      for (const { item, x, z } of laid) {
        if (item.def !== 'walkway') continue
        const rot = ((item.rot ?? 0) * Math.PI) / 2
        for (let i = 0; i < 4; i++) {
          const slat = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.04, 0.85),
            new THREE.MeshLambertMaterial({ color: i % 2 ? '#3a8ad8' : '#d8dde2' }),
          )
          slat.position.set(x, 0.24, z)
          slat.rotation.y = rot
          slat.name = 'belt-slat'
          this.walkGroup.add(slat)
          this.walkSlats.push({ mesh: slat, originX: x, originZ: z, rot })
        }
      }
    }
    const phase = (performance.now() / 900) % 1
    this.walkSlats.forEach((slat, index) => {
      const along = (((phase + index / 4) % 1) - 0.5) * 4.6
      slat.mesh.position.x = slat.originX + Math.cos(slat.rot) * along
      slat.mesh.position.z = slat.originZ + Math.sin(slat.rot) * along
    })
  }

  /** Grab a PNG on the next `render`. */
  requestCapture() {
    this.captureWanted = true
  }

  /** Belt, hold-bag scanner, sort pile, and claim carousel. Cubes are a capped parade. */
  private syncLuggage(game: Game) {
    if (!game.fits.length || this.roomPlan) {
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
    const pile = game.bagDeskPile()
    this.deskCubes.forEach((cube, i) => {
      cube.visible = i < pile
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

    const deskX = claim.x - 3.4
    const deskZ = claim.z + 2.4
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.72, 0.7),
      new THREE.MeshLambertMaterial({ color: '#6a3a32' }),
    )
    desk.position.set(deskX, 0.36, deskZ)
    this.bagGroup.add(desk)
    const deskLabel = this.makeLabel('LOST BAGS', '#f0d0c8')
    deskLabel.position.set(deskX, 0.08, deskZ + 0.9)
    deskLabel.rotation.x = -Math.PI / 2
    this.bagGroup.add(deskLabel)

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
    for (let i = 0; i < 4; i++) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.5, 0.36), bagMat)
      cube.position.set(deskX - 0.72 + i * 0.48, 0.97, deskZ)
      cube.visible = false
      this.bagGroup.add(cube)
      this.deskCubes.push(cube)
    }
  }

  /** Medium and High use the same filmic curve as the apron. Low stays unmapped. */
  private applyHallGrade(level: QualityLevel) {
    const grade = level !== 'low'
    this.renderer.toneMapping = grade ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
    this.renderer.toneMappingExposure = grade ? HALL_LIGHT.exposure : 1
  }

  private interiorKind(): 'foundation' | 'wall' | 'door' | 'floor' | 'wallpaper' | 'room' | null {
    const kind = this.build?.kind
    if (kind === 'foundation' || kind === 'wall' || kind === 'door' || kind === 'floor' || kind === 'wallpaper' || kind === 'room') return kind
    return null
  }

  /** Build tile under the cursor, inside the hall box the walk uses. */
  private interiorTile(e: PointerEvent): { x: number; y: number } | null {
    this.aim(e)
    const hit = new THREE.Vector3()
    if (!this.ray.ray.intersectPlane(this.floorPlane, hit)) return null
    this.drawHit.copy(hit)
    const fit = this.game?.activeHall()
    const layout = fit ? hallBaseLayout(fit) : null
    return tileAtPoint(hit.x, hit.z, BUILD_TUNING.tileMetres, HALL_W, HALL_D, layout?.w ?? 12, layout?.h ?? 8)
  }

  private refreshInteriorGhost() {
    const kind = this.interiorKind()
    syncInteriorGhost(this.interiorGhost, kind, this.drawA, this.drawB)
  }

  private commitInteriorDraw() {
    const game = this.game
    const mode = this.build
    const a = this.drawA
    const b = this.drawB ?? a
    this.drawA = null
    this.drawB = null
    this.refreshInteriorGhost()
    if (!game || !mode || !a || !b) return
    const tileM = BUILD_TUNING.tileMetres
    if (mode.kind === 'foundation') game.dragInteriorFoundation(tilesInRect(dragRect(a, b)))
    else if (mode.kind === 'wall') game.dragInteriorWall(a, b, mode.erase)
    else if (mode.kind === 'door') game.placeInteriorDoor(nearestEdge(this.drawHit.x, this.drawHit.z, a, tileM, HALL_W, HALL_D))
    else if (mode.kind === 'floor') game.paintInteriorFloor(tilesInRect(dragRect(a, b)), mode.paint)
    else if (mode.kind === 'wallpaper') game.paintInteriorWalls(wallRun(a, b), mode.paint)
    else if (mode.kind === 'room') {
      const rooms = game.activeHall()?.interior?.rooms ?? []
      const hit = rooms.find((room) => roomContains(room, a))
      if (a.x === b.x && a.y === b.y && hit) {
        this.onInteriorSelect?.(hit.id)
        return
      }
      if (mode.selected && rooms.some((room) => room.id === mode.selected && roomContains(room, a))) {
        game.resizeInteriorRoom(mode.selected, dragRect(a, b))
        return
      }
      game.assignInteriorRoom(mode.room, dragRect(a, b))
    }
  }

  dispose() {
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.onDown)
    canvas.removeEventListener('pointermove', this.onMove)
    canvas.removeEventListener('pointerup', this.onUp)
    canvas.removeEventListener('pointerleave', this.onUp)
    canvas.removeEventListener('wheel', this.onWheel)
    this.clearKit()
    syncInteriorEdit(this.interiorEdit, undefined, 'dispose', this.interiorSig)
    syncInteriorGhost(this.interiorGhost, null, null, null)
    if (this.jetBridge) for (const c of this.jetBridge.children) (c as THREE.InstancedMesh).dispose?.()
    this.clearInterior()
    if (this.terminalShared) disposeTerminalShared(this.terminalShared)
    this.terminalTextures?.dispose()
    this.terminalShared = null
    this.terminalTextures = null
    for (const tex of this.queueTex.values()) tex.dispose()
    this.queueTex.clear()
    this.ghostMat.dispose()
    this.ghostPlate.geometry.dispose()
    ;(this.ghostPlate.material as THREE.Material).dispose()
    this.terrazzo.dispose()
    this.floorMap.dispose()
    this.litter.dispose()
    this.navCrowd.dispose()
    this.serviceFx.dispose()
    this.figures.dispose()
    releasePerfOverlay()
    this.offGfx()
    for (const mat of this.figMats.values()) mat.dispose()
    this.figMats.clear()
    this.renderer.dispose()
  }
}

/** Everything the flow overlay draws from. Empty when the overlay is hidden. */
export function overlaySignature(
  game: Game,
  show: boolean,
  marks: readonly { c: number; r: number }[],
  fit: ReturnType<Game['activeHall']>,
): string {
  if (!show && !marks.length) return ''
  const zones = fit?.zones ?? []
  const parts = [
    show ? 'flows' : 'marks',
    `${zones[0]?.length ?? 0}x${zones.length}`,
    marks.map((cell) => `${cell.c},${cell.r}`).join(';'),
  ]
  if (show) {
    parts.push(String(fit?.signs ?? 0), [...game.hallOpen()].join(','))
    for (const g of game.hallGuests) {
      if (!g.dead) parts.push(`${g.node}>${g.path.join('>')}`)
    }
  }
  return parts.join('|')
}
