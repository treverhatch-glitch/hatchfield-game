/**
 * 3D terminal hall — orbit camera over furnished rooms + walking guests.
 * Layout follows NODE_POS; rooms appear when furnished. Security is the visual choke.
 */
import * as THREE from 'three'
import { HALL_LIGHT } from '../look'
import { graphicsQuality, subscribeGraphicsQuality, type QualityLevel } from '../graphicsPrefs'
import { readAnimSec } from './animClock'
import { buildFittingMeshes } from './fittings'
import { HallPeople } from './people'
import { pickFacilityId, pickedFacilityId } from './picking'
import { buildLayoutShell } from './shell'
import { canvasToPng } from '../../camera/capture.ts'
import { zoomToCursorShift } from '../../camera/zoom.ts'
import { inputMap } from '../../input/map.ts'
import { perf, perfEnd, perfFrame, perfStart } from '../../core/perf'
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
  HALL_OCCLUDE_M,
} from '../hallCamera'
import { HALL_EDGES, NODE_POS, type HallNode } from '../../game/guests'
import { paintTerrazzo } from '../world/raster'
import { rasterTexture } from '../world/textures'
import type { Game } from '../../game/sim'
import { isAssignKind } from '../../hubprogress/assign.ts'
import { syncLeaseMarks, type LeaseMark } from '../leaseBadge.ts'
import {
  cellCenter,
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
} from '../../game/terminal'
import { itemSize, type PlacementCheck } from '../../game/terminalKit'
import { HallLitterLayer } from '../hallLitter'
import type { HallNavCrowd } from '../hallNavCrowd'
import { releasePerfOverlay, retainPerfOverlay } from '../../perf'
import { HallServiceFx } from '../hallService'
import { nearestFacilityId } from '../../ui/inspector/facilityCard.ts'
import { HALL_WALKER_PICK } from '../../game/hallNavData.ts'
import { BUILD_TUNING, layoutTileM, type FittingKind, type RoomKind } from '../../terminalbuild/index.ts'
import { fittingSpec } from '../../terminalbuild/fittings.ts'
import { QUALITY } from '../world/quality'
import { setFidsOpen } from '../../fids/open'
import { objectIsFidsBoard } from '../../fids/stage'
import type { RoomPlan } from '../world/rooms'
import { hallQueues, type HallQueue } from '../../terminalplay/queues'
import { footprintHit, footprintSpec, stampFrom } from '../../terminalplay/footprints'
import { cellCenterInFloor, cellInFloor } from '../../game/shellFloor.ts'
import { hallBaseLayout } from '../../game/hallNav.ts'
import { dragRect, nearestEdge, tileAtPoint, tilesInRect, wallRun } from '../../terminalbuild/interior.ts'
import { interiorEditSig, roomContains, syncInteriorEdit, syncInteriorGhost } from '../interiorBuild.ts'

/** Hall build mode, driven by the terminal kit bar. */
export type HallBuildMode =
  | { kind: 'place'; def: ItemId; rot: number }
  | { kind: 'fitting'; fitting: FittingKind; rot: number }
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

/** Walkway stamps in hall metres. Footprint stamps keep hx/hz; cell stamps fill quarter slots. */
function walkwaySpots(items: readonly PlacedItem[], cols: number, rows: number): { item: PlacedItem; x: number; z: number }[] {
  const load = new Map<string, number>()
  const out: { item: PlacedItem; x: number; z: number }[] = []
  for (const item of items) {
    if (item.def !== 'walkway') continue
    if (item.hx != null && item.hz != null) {
      out.push({ item, x: item.hx, z: item.hz })
      continue
    }
    const key = `${item.c},${item.r}`
    const start = load.get(key) ?? 0
    const size = itemSize(itemDef(item.def))
    load.set(key, start + size)
    const base = cellCenter(item.c, item.r, cols, rows)
    if (size >= 4) {
      out.push({ item, x: base.x, z: base.z })
      continue
    }
    const qx = HALL_W / cols / 4
    const qz = HALL_D / rows / 4
    const quad = (i: number) => ({ x: (i % 2 ? 1 : -1) * qx, z: (i >= 2 ? 1 : -1) * qz })
    const a = quad(start)
    const b = quad(Math.min(3, start + size - 1))
    out.push({ item, x: base.x + (a.x + b.x) / 2, z: base.z + (a.z + b.z) / 2 })
  }
  return out
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
  /** Departures and arrivals from the hall's PaxNav. */
  readonly people = new HallPeople()
  readonly navCrowd: HallNavCrowd = this.people.crowd
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
  private perfOverlay = retainPerfOverlay()
  private beltCubes: THREE.Mesh[] = []
  private claimCubes: THREE.Mesh[] = []
  private sortCubes: THREE.Mesh[] = []
  private deskCubes: THREE.Mesh[] = []
  private luggageBuilt = false
  roomHash = ''
  /** Metre-scale hall. Nothing under this node is scaled away from 1. */
  readonly hallRoot = new THREE.Group()
  /** Kept empty. The apron terminal picture is not parented into the hall. */
  private interiorGroup = new THREE.Group()
  private roomPlan: RoomPlan | null = null
  private fadeCamKey = ''
  private hotspotSig = ''
  private overlaySig = ''
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
  /** Passenger under the cursor (client pixels), or null. Drives the hover tooltip. */
  onWalkerHover: ((hover: { id: string; sx: number; sy: number } | null) => void) | null = null
  private walkerHover: { id: string; sx: number; sy: number } | null = null
  /** Presentation seconds, advanced one frame at a time. Camera ease only. */
  private presentSec = 0
  private hoverAt = 0
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
  private frameLines: { node: HallNode; x: number; z: number; x2: number; z2: number }[] = []
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private offGfx: () => void = () => {}

  constructor(canvas: HTMLCanvasElement) {
    const preset = QUALITY[graphicsQuality()]
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: preset.msaa,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    this.renderer.setClearColor('#c5d0d8', 1)
    const pixelCap = preset.level === 'low' || preset.level === 'ultra' ? preset.pixelRatioCap : Math.min(preset.pixelRatioCap, 1.25)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap))
    this.renderer.shadowMap.enabled = preset.shadowMapSize > 0
    this.renderer.shadowMap.type = preset.shadowType
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
    sun.castShadow = preset.shadowMapSize > 0
    sun.shadow.mapSize.set(preset.shadowMapSize > 0 ? preset.shadowMapSize : 1024, preset.shadowMapSize > 0 ? preset.shadowMapSize : 1024)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 120
    // The 88 m starter is wider than the old 48 m shell. Keep both ends in the map.
    sun.shadow.camera.left = -52
    sun.shadow.camera.right = 52
    sun.shadow.camera.top = 32
    sun.shadow.camera.bottom = -32
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
    this.floor.receiveShadow = true
    this.hallRoot.name = 'hall-root'
    this.scene.add(this.hallRoot)
    this.floor.visible = false
    this.hallRoot.add(this.floor)

    this.hallRoot.add(this.roomGroup)
    this.interiorEdit.name = 'interior-edit'
    this.hallRoot.add(this.interiorEdit)
    this.hallRoot.add(this.interiorGhost)
    this.interiorGroup.name = 'hall-rooms'
    this.hallRoot.add(this.interiorGroup)
    this.zoneTint.visible = false
    this.hallRoot.add(this.zoneTint)
    this.kitGroup.name = 'hall-kit'
    this.hallRoot.add(this.kitGroup)
    this.hallRoot.add(this.walkGroup)
    this.hallRoot.add(this.litter.group)
    this.hallRoot.add(this.navCrowd.group)
    this.navCrowd.skipRole = HallServiceFx.drawsRole
    this.leaseGroup.name = 'hall-lease-marks'
    this.hallRoot.add(this.serviceFx.group)
    this.hallRoot.add(this.leaseGroup)
    this.overlay.visible = false
    this.scene.add(this.overlay)
    this.scene.add(this.hotspotGroup)
    this.scene.add(this.queueGroup)
    this.ghostPlate.visible = false
    this.scene.add(this.ghostPlate)
    this.hallRoot.add(this.bagGroup)

    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointerleave', this.onUp)
    canvas.addEventListener('pointerleave', this.onLeave)
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

  private onLeave = () => this.setWalkerHover(null)

  private onMove = (e: PointerEvent) => {
    if (this.build) this.trackHover(e)
    else this.trackWalkerHover(e)
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

  /** Passenger under the cursor, for the hover tooltip. Picked at most every `HALL_WALKER_PICK.hoverEveryMs`. */
  private trackWalkerHover(e: PointerEvent) {
    if (!this.onWalkerHover) return
    if (this.dragging || e.buttons !== 0) {
      this.setWalkerHover(null)
      return
    }
    const now = this.presentSec
    if (now - this.hoverAt < HALL_WALKER_PICK.hoverEveryMs / 1000) return
    this.hoverAt = now
    const id = this.pickWalker(e.clientX, e.clientY)
    this.setWalkerHover(id ? { id, sx: e.clientX, sy: e.clientY } : null)
  }

  private setWalkerHover(next: { id: string; sx: number; sy: number } | null) {
    const cur = this.walkerHover
    if (!next && !cur) return
    if (next && cur && next.id === cur.id && next.sx === cur.sx && next.sy === cur.sy) return
    this.walkerHover = next
    this.onWalkerHover?.(next)
  }

  /** Walker nearest the click in screen space, departures and arrivals. Crew are skipped. */
  private pickWalker(clientX: number, clientY: number): string | null {
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
      const d = (sx - clientX) ** 2 + (sy - clientY) ** 2
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
      if (this.game.assignBulk && (kind === 'desk' || kind === 'gate')) {
        this.game.toggleAssignSelection(kind, id)
        return
      }
      // A desk or lane click opens that point's card. Dedicate stays on the hub and the paint tool.
      if (!this.game.assignBulk && (kind === 'desk' || kind === 'lane')) {
        this.game.selectFacility(id)
        return
      }
      this.game.openAssign(kind, id)
      return
    }
    // A lane, desk, bag drop, or claim belt wins over the passenger standing in it.
    // pickWalker runs in screen space and used to take the click, then selectGuest
    // cleared the facility and left the dock on "Select a building".
    const serviceId = this.serviceVolumeId()
    if (serviceId) {
      this.game.selectFacility(serviceId)
      return
    }
    const walked = this.pickWalker(e.clientX, e.clientY)
    if (walked) {
      this.game.selectGuest(walked)
      return
    }
    const spotHits = this.ray.intersectObjects(this.hotspotGroup.children, true)
    const queueHits = this.ray.intersectObjects(this.queueGroup.children, true)
    const roomHits = this.ray.intersectObjects([...this.roomGroup.children, ...this.kitGroup.children], true)
    const spot = spotHits[0]
    // Nav-grid walkers are instanced: pick the one nearest where the ray crosses body height.
    if (this.game.hallNav.live) {
      const r = this.ray.ray
      const t = Math.abs(r.direction.y) > 1e-6 ? (HALL_WALKER_PICK.bodyY - r.origin.y) / r.direction.y : -1
      const id = t > 0 ? this.game.hallNav.pickAt(r.origin.x + r.direction.x * t, r.origin.z + r.direction.z * t, HALL_WALKER_PICK.radiusM) : null
      if (id) {
        this.game.selectGuest(id)
        return
      }
    }
    const fidsHit = this.ray.intersectObjects(this.interiorGroup.children, true).find((hit) => objectIsFidsBoard(hit.object))
    if (fidsHit) {
      setFidsOpen(true)
      return
    }
    const pointHits = this.ray.intersectObjects(this.serviceFx.facilityTargets(), false)
    const facilityHit = [...pointHits, ...queueHits, ...roomHits].find((hit) => {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        if (typeof obj.userData.facilityId === 'string') return true
        obj = obj.parent
      }
      return false
    })
    if (facilityHit) {
      let obj: THREE.Object3D | null = facilityHit.object
      while (obj) {
        if (typeof obj.userData.facilityId === 'string') {
          this.game.selectFacility(obj.userData.facilityId)
          return
        }
        obj = obj.parent
      }
    }
    if (spot) {
      let obj: THREE.Object3D | null = spot.object
      while (obj) {
        if (typeof obj.userData.infoId === 'string') {
          this.game.toggleInfo(obj.userData.infoId)
          return
        }
        obj = obj.parent
      }
    }
    if (this.game.hallNav.live) {
      const ray = this.ray.ray
      const t = Math.abs(ray.direction.y) > 1e-6 ? (0.9 - ray.origin.y) / ray.direction.y : -1
      if (t > 0) {
        const near = nearestFacilityId(
          this.game.hallNav.metrics(),
          ray.origin.x + ray.direction.x * t,
          ray.origin.z + ray.direction.z * t,
          this.game.hallNav.originX,
          this.game.hallNav.originZ,
          3.2,
        )
        if (near) {
          this.game.selectFacility(near)
          return
        }
      }
    }
    this.game.selectGuest(null)
  }

  /**
   * Service volumes under the cursor. A nav point (`lane-0`) beats a placed
   * fitting (`item:…`) when the ray hits both, so the lane card stays the
   * one with that point's queue and served count.
   */
  private serviceVolumeId(): string | null {
    const picks = [...this.kitGroup.children, ...this.roomGroup.children]
    const hits = this.ray.intersectObjects([...this.serviceFx.facilityTargets(), ...picks], true)
    const ranked: { id: string; fromCenter: number }[] = []
    for (const hit of hits) {
      const id = hit.object.userData.facilityId
      if (typeof id !== 'string' || !id) continue
      const origin = hit.object.getWorldPosition(this.zoomScratch)
      ranked.push({ id, fromCenter: hit.point.distanceToSquared(origin) })
    }
    return pickedFacilityId(ranked)
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
        const useFoot = Boolean(footDef && footprintSpec(footDef) && this.roomPlan)
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
    if (this.build.kind === 'fitting') {
      const tileM = BUILD_TUNING.tileMetres
      const fit = game.activeHall()
      const doc = fit?.layout?.version === 2 ? fit.layout : null
      const tile = doc
        ? tileAtPoint(hover.hx, hover.hz, layoutTileM(doc), doc.w * layoutTileM(doc), doc.h * layoutTileM(doc), doc.w, doc.h)
        : tileAtPoint(hover.hx, hover.hz, tileM, HALL_W, HALL_D, 12, 8)
      if (!tile) return
      const placed = game.placeLayoutFitting(this.build.fitting, tile.x, tile.y, this.build.rot as 0 | 1 | 2 | 3)
      if (placed) this.onPlaced?.()
      return
    }
    if (this.build.kind === 'place') {
      const foot = footprintSpec(this.build.def) && this.roomPlan
      const placed = foot
        ? game.placeHallFootprint(this.build.def, hover.hx, hover.hz, this.build.rot)
        : game.placeHallItemAt(this.build.def, hover.c, hover.r, this.build.rot)
      if (placed) this.onPlaced?.()
    } else if (this.build.kind === 'move') {
      if (!this.build.itemId) {
        if (hover.target) this.onMovePick?.(hover.target.id, hover.target.def)
      } else {
        const foot = Boolean(this.build.def && footprintSpec(this.build.def) && this.roomPlan)
        const moved = foot
          ? game.moveHallFootprint(this.build.itemId, hover.hx, hover.hz, this.build.rot)
          : game.moveHallItem(this.build.itemId, hover.c, hover.r, this.build.rot)
        if (moved) this.onMovePick?.(null, null)
      }
    } else if (hover.target) {
      const sold = this.fittingUnder(hover.hx, hover.hz)
      if (sold) game.sellLayoutFitting(sold)
      else game.removeHallItem(hover.target.id)
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

  /** Fitting id under a hall-metre point, from the pick boxes. */
  private fittingUnder(hx: number, hz: number): string | null {
    const ray = new THREE.Raycaster(new THREE.Vector3(hx, 8, hz), new THREE.Vector3(0, -1, 0))
    return pickFacilityId(ray, this.kitGroup.children, this.zoomScratch)
  }

  /** Green / red ghost on the hovered cell's next free slot. */
  private syncGhost(game: Game) {
    const mode = this.build
    const hover = this.hover
    if (mode?.kind === 'fitting') {
      this.syncFittingGhost(game, hover)
      return
    }
    const def = mode?.kind === 'place' ? mode.def : mode?.kind === 'move' ? mode.def : null
    if (!mode || !def || !hover) {
      if (this.ghost) this.ghost.visible = false
      this.ghostPlate.visible = false
      return
    }
    if (!this.ghost || this.ghostDef !== def) {
      if (this.ghost) this.scene.remove(this.ghost)
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.2), this.ghostMat)
      box.position.y = 0.55
      this.ghost = new THREE.Group()
      this.ghost.add(box)
      this.ghostDef = def
      this.scene.add(this.ghost)
    }
    const { cols, rows } = this.zoneGrid()
    const carried = mode.kind === 'move' ? mode.itemId : null
    const rot = mode.kind === 'move' || mode.kind === 'place' ? mode.rot : 0
    const stamp = footprintSpec(def) && this.roomPlan ? stampFrom(def, hover.hx, hover.hz, rot) : null
    const cw = HALL_W / Math.max(1, cols)
    const rh = HALL_D / Math.max(1, rows)
    const at = stamp
      ? { x: stamp.hx, z: stamp.hz }
      : { x: -HALL_W / 2 + (hover.c + 0.5) * cw, z: -HALL_D / 2 + (hover.r + 0.5) * rh }
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
      this.ghostPlate.geometry.dispose()
      this.ghostPlate.geometry = new THREE.BoxGeometry(Math.max(0.2, stamp.w), 0.08, Math.max(0.2, stamp.d))
      this.ghostPlate.scale.set(1, 1, 1)
      this.ghostPlate.position.set(stamp.hx, 0.16, stamp.hz)
      ;(this.ghostPlate.material as THREE.MeshBasicMaterial).color.set(color)
      this.ghostPlate.visible = true
    } else {
      this.ghostPlate.visible = false
    }
  }

  /** Footprint plate for a catalog fitting. A socket snap still shows the catalog size. */
  private syncFittingGhost(game: Game, hover: HallHover | null) {
    const mode = this.build
    if (mode?.kind !== 'fitting' || !hover) {
      if (this.ghost) this.ghost.visible = false
      this.ghostPlate.visible = false
      return
    }
    const spec = fittingSpec(mode.fitting)
    const doc = game.activeHall()?.layout
    const tile = doc ? layoutTileM(doc) : 1
    const w = doc?.w ?? HALL_W
    const h = doc?.h ?? HALL_D
    const ox = (-w * tile) / 2
    const oz = (-h * tile) / 2
    const rot = mode.rot % 2 === 0 ? { w: spec.w, d: spec.d } : { w: spec.d, d: spec.w }
    const x = ox + (Math.floor((hover.hx - ox) / tile) + rot.w / 2) * tile
    const z = oz + (Math.floor((hover.hz - oz) / tile) + rot.d / 2) * tile
    if (!this.ghost || this.ghostDef !== mode.fitting) {
      if (this.ghost) this.scene.remove(this.ghost)
      const box = new THREE.Mesh(new THREE.BoxGeometry(rot.w, Math.max(0.4, spec.h), rot.d), this.ghostMat)
      box.position.y = spec.h / 2
      this.ghost = new THREE.Group()
      this.ghost.add(box)
      this.ghostDef = mode.fitting
      this.scene.add(this.ghost)
    }
    this.ghost.position.set(x, 0, z)
    this.ghostMat.color.set('#4ade80')
    this.ghost.visible = true
    this.ghostPlate.visible = false
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
    const now = this.presentSec
    const dt = this.goalFrame ? Math.min(0.1, now - this.goalFrame) : 0
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


  /** The layout shell is the picture. The old labelled floor stays hidden. */
  private applyRoomLayer() {
    this.kitGroup.visible = true
    this.floor.visible = false
  }


  rebuildRooms(game: Game) {
    const fit = game.activeHall()
    const zones = fit?.zones ?? (fit?.premade ? prefabZones() : [])
    const open = [...game.hallOpen()].sort().join(',')
    const choke = game.hasSecurityChoke() ? '1' : '0'
    const paint = zones.map((row) => row.join(',')).join('|')
    const doc = fit?.layout?.version === 2 ? fit.layout : null
    const stuff = doc
      ? `${(doc.fittings ?? []).map((f) => `${f.kind}@${f.x},${f.y}r${f.rot}`).join(';')}|w${doc.walls.length}|d${doc.doors.length}|b${(doc.belts ?? []).length}`
      : (fit?.items ?? []).map((i) => `${i.def}@${i.c},${i.r}r${i.rot ?? 0}`).join(';')
    const nav = game.hallNav
    const walk = nav.live ? `${nav.nav?.revision}:${nav.nav?.layout.walls.length}:${nav.nav?.layout.doors.length}` : '-'
    const rooms = this.roomPlan ? 'rooms' : 'open'
    const hash = `${open}|${choke}|${fit?.tier ?? 0}|${paint}|${stuff}|${walk}|${rooms}`
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
    if (doc) {
      const shell = buildLayoutShell(doc)
      this.roomGroup.add(shell)
      const span = Math.hypot(doc.w, doc.h) * layoutTileM(doc)
      const need = span / (2 * Math.tan((HALL_CAM_FOV * Math.PI) / 360))
      this.maxDist = Math.max(HALL_CAM_MAX_DIST, need * 1.35)
      if (!this.framedHall) {
        this.dist = Math.min(this.maxDist, Math.max(HALL_CAM_DIST, need * 0.95))
        this.framedHall = true
        this.placeCam()
      }
      this.shellBounds = {
        minX: (-doc.w * layoutTileM(doc)) / 2,
        maxX: (doc.w * layoutTileM(doc)) / 2,
        minZ: (-doc.h * layoutTileM(doc)) / 2,
        maxZ: (doc.h * layoutTileM(doc)) / 2,
      }
    }
    this.fadeCamKey = ''
    this.clearKit()
    if (doc) this.kitGroup.add(buildFittingMeshes(doc))
    this.applyRoomLayer()
  }

  private framedHall = false

  private clearKit() {
    this.kitGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry && mesh.parent === this.kitGroup) mesh.geometry.dispose()
    })
    this.kitGroup.clear()
  }

  /**
   * The apron terminal picture is not drawn in the hall.
   * The walk's layout is the picture, in metres, under hall-root.
   */
  private syncInterior() {
    this.interiorGroup.scale.set(1, 1, 1)
    this.interiorGroup.position.set(0, 0, 0)
    if (this.roomPlan) this.roomPlan = null
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
   * Queue lines are the walk's own lines. The fitted apron plan no longer
   * places a second set of people in the hall.
   */
  private buildFrameQueues(_game: Game) {
    this.frameLines = []
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

  render(game: Game) {
    this.game = game
    // Camera ease and hover keep moving while the sim is paused. Trays and belts read animSec.
    this.presentSec += 1 / 60
    perfFrame()
    let t = perfStart()
    this.resize()
    this.syncInterior()
    this.rebuildRooms(game)
    syncInteriorEdit(this.interiorEdit, game.activeHall()?.interior, interiorEditSig(game.activeHall()?.interior), this.interiorSig)
    this.syncZoneTint(game)
    if (this.followId) this.easeFollow()
    else this.easeToGoal(game)
    this.syncWalkways(game)
    this.buildFrameQueues(game)
    // The walk's crowd stands in the real queues, so a staffed desk shows the line and the serve pose.
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
      const laid = walkwaySpots((fit?.items ?? []) as PlacedItem[], cols, rows)
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
    const phase = (readAnimSec() / 0.9) % 1
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
    const spin = (motion.phase + readAnimSec() * 0.12) % 1
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

    const ringGeo = new THREE.TorusGeometry(2.15, 0.16, 8, 28)
    ringGeo.rotateX(Math.PI / 2)
    ringGeo.scale(1, 0.55, 1)
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshLambertMaterial({ color: '#3a4550' }))
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
    canvas.removeEventListener('pointerleave', this.onLeave)
    canvas.removeEventListener('wheel', this.onWheel)
    this.clearKit()
    syncInteriorEdit(this.interiorEdit, undefined, 'dispose', this.interiorSig)
    syncInteriorGhost(this.interiorGhost, null, null, null)
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
    releasePerfOverlay()
    this.offGfx()
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

/** Scene and camera for the metre hall. HallWorld is the same class. */
export { HallWorld as InteriorView }
