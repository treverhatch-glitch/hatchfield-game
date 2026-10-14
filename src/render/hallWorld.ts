/**
 * 3D terminal hall — orbit camera over furnished rooms + walking guests.
 * Layout follows NODE_POS; rooms appear when furnished. Security is the visual choke.
 */
import * as THREE from 'three'
import { HALL_LIGHT } from './look'
import { graphicsQuality, subscribeGraphicsQuality, type QualityLevel } from './graphicsPrefs'
import { canvasToPng } from '../camera/capture.ts'
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
  HALL_CAM_NEAR,
  HALL_CAM_PITCH,
  HALL_CAM_YAW,
  HALL_OCCLUDE_M,
} from './hallCamera'
import { HALL_EDGES, NODE_POS, type HallNode } from '../game/guests'
import { bake, type BakePiece } from './world/kit'
import { paintTerrazzo } from './world/raster'
import { rasterTexture } from './world/textures'
import type { Game } from '../game/sim'
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
import type { HallNav } from '../game/hallNav'
import { BUILD_TUNING, type Edge } from '../terminalbuild/index.ts'
import { WORLD_PER_METER } from './aircraft/specs'
import {
  apronToHall,
  hallFitFor,
  hallGuestScale,
  hallToApron,
  matchTerminal,
  poseOnPlan,
  roomShellBounds,
  showLegacyHallFurniture,
  type HallFit,
} from './hallRooms'
import { terminals } from './world/layout'
import { baseLevel } from './world/quality'
import { PACK1_REPEAT_M, tileByPosition } from './materials/pack1'
import { disposeTerminalShared, FLOOR_Y, makeTerminalShared, ROOF_Y, TerminalBuilding, type TerminalShared } from './world/terminal'
import type { RoomPlan } from './world/rooms'
import { makeTextures, type WorldTextures } from './world/textures'
import { hallQueues, type HallQueue } from '../terminalplay/queues'
import { footprintHit, footprintSpec, stampFrom } from '../terminalplay/footprints'
import { queueAnchor, queueOrder, slotsAlong, standingInQueue, type QueueSlot } from '../terminalplay/lines'
import { PLAY_TUNING } from '../terminalplay/config'

/** Hall build mode, driven by the terminal kit bar. */
export type HallBuildMode =
  | { kind: 'place'; def: ItemId; rot: number }
  | { kind: 'bulldoze' }
  | { kind: 'move'; itemId: string | null; def: ItemId | null; rot: number }
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
  dragging: 'orbit' | 'pan' | null = null
  lastX = 0
  lastY = 0
  roomGroup = new THREE.Group()
  guestGroup = new THREE.Group()
  /** Departures and arrivals from the hall's PaxNav. Stand in for the old hall figures while live. */
  readonly navCrowd = new HallNavCrowd()
  /** Walkers drawn last frame (tests, perf probes). */
  navDrawn = 0
  /** Routes, heat, and advisor marks. Hidden unless the player asks or a note is focused. */
  overlay = new THREE.Group()
  /** Queue, lost, bag, and shop markers. Always drawn. Numbers open on click. */
  hotspotGroup = new THREE.Group()
  bagGroup = new THREE.Group()
  guests = new Map<string, THREE.Object3D>()
  private readonly figLeg = new THREE.BoxGeometry(0.18, 0.86, 0.18)
  private readonly figTorso = new THREE.BoxGeometry(0.46, 0.56, 0.26)
  private readonly figHead = new THREE.SphereGeometry(0.2, 14, 10)
  private readonly figArm = new THREE.BoxGeometry(0.12, 0.48, 0.12)
  private readonly figCarry = new THREE.BoxGeometry(0.18, 0.24, 0.1)
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
    this.interiorGroup.name = 'hall-rooms'
    this.scene.add(this.interiorGroup)
    this.zoneTint.visible = false
    this.scene.add(this.zoneTint)
    this.scene.add(this.kitGroup)
    this.scene.add(this.walkGroup)
    this.scene.add(this.litter.group)
    this.scene.add(this.guestGroup)
    this.scene.add(this.navCrowd.group)
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
    // Middle/right = orbit; left-drag = pan (WASD also pans).
    if (e.button === 1 || e.button === 2) this.dragging = 'orbit'
    else this.dragging = e.shiftKey ? 'orbit' : 'pan'
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.downX = e.clientX
    this.downY = e.clientY
  }

  private onMove = (e: PointerEvent) => {
    if (this.build) this.trackHover(e)
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

  /** Positive delta pulls back. Keyboard and triggers pass a distance; the wheel scales it. */
  nudgeZoom(delta: number) {
    this.dist = Math.min(HALL_CAM_MAX_DIST, Math.max(HALL_CAM_MIN_DIST, this.dist + delta))
    this.placeCam()
  }

  private onUp = (e: PointerEvent) => {
    const dx = e.clientX - this.downX
    const dy = e.clientY - this.downY
    this.dragging = null
    if (e.button !== 0 || Math.hypot(dx, dy) > 6 || !this.game) return
    if (this.build) {
      this.buildClick(e)
      return
    }
    this.aim(e)
    const spotHits = this.ray.intersectObjects(this.hotspotGroup.children, true)
    const queueHits = this.ray.intersectObjects(this.queueGroup.children, true)
    const roomHits = this.ray.intersectObjects(this.roomGroup.children, true)
    const hits = this.ray.intersectObjects(this.guestGroup.children, true)
    const spot = spotHits[0]
    const person = hits[0]
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

  /** Snap the cursor to a hall cell and re-check the placement. */
  private trackHover(e: PointerEvent) {
    const game = this.game
    if (!game || !this.build) return
    this.aim(e)
    const hit = new THREE.Vector3()
    const { cols, rows } = this.zoneGrid()
    let next: HallHover | null = null
    if (this.ray.ray.intersectPlane(this.floorPlane, hit)) {
      const c = Math.floor(((hit.x + HALL_W / 2) / HALL_W) * cols)
      const r = Math.floor(((hit.z + HALL_D / 2) / HALL_D) * rows)
      if (c >= 0 && r >= 0 && c < cols && r < rows) {
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
    this.nudgeZoom(e.deltaY * step)
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
      this.goalTo = cellCenter(g.c, g.r, cols, rows)
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

  private watchedShell: THREE.Material[] = []

  private releaseShellMats() {
    const surfaces = this.terminalShared?.surfaces
    for (const mat of this.watchedShell) {
      surfaces?.unwatch(mat)
      surfaces?.releaseLogo(mat)
    }
    this.watchedShell = []
  }

  private box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, mat?: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat ?? new THREE.MeshLambertMaterial({ color }))
    mesh.position.set(x, y, z)
    this.roomGroup.add(mesh)
  }

  /**
   * Walls around the fitted rooms, with a door on the west side.
   * The full 48 m hall is wider than the square terminal, so the shell follows the rooms.
   */
  /** Cream wall panels on the fitted shell. Repeat is in metres (this view is). */
  private shellWallMat(): THREE.Material {
    const map = this.terminalShared?.surfaces.maps.wall
    const mat = new THREE.MeshLambertMaterial({ color: map ? 0xffffff : 0xd5ddd8, map: map ?? null })
    if (map && this.terminalShared) {
      tileByPosition(mat, PACK1_REPEAT_M.wall)
      this.terminalShared.surfaces.watch(mat)
      this.watchedShell.push(mat)
    }
    return mat
  }

  private buildFittedShell() {
    const plan = this.roomPlan
    const fit = this.interiorFit
    if (!plan || !fit) return
    const b = roomShellBounds(plan, fit)
    const h = 3.15
    const t = 0.38
    const y = h / 2
    const width = b.maxX - b.minX
    const depth = b.maxZ - b.minZ
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2
    const door = 3.2
    const side = Math.max(0.4, (depth - door) / 2)
    this.box(width + t, h, t, '#d5ddd8', cx, y, b.minZ, this.shellWallMat())
    this.box(width + t, h, t, '#d5ddd8', cx, y, b.maxZ, this.shellWallMat())
    this.box(t, h, depth, '#d5ddd8', b.maxX, y, cz, this.shellWallMat())
    this.box(t, h, side, '#d5ddd8', b.minX, y, b.minZ + side / 2, this.shellWallMat())
    this.box(t, h, side, '#d5ddd8', b.minX, y, b.maxZ - side / 2, this.shellWallMat())
    this.box(width + 0.6, 0.18, 0.5, '#e7eee9', cx, h, b.minZ)
    this.box(width + 0.6, 0.18, 0.5, '#e7eee9', cx, h, b.maxZ)
    this.brandMark(b.minX - 0.04, 2.15, cz)
  }

  /** Hatchfield mark on the landside face, above the door. */
  private brandMark(x: number, y: number, z: number) {
    const surfaces = this.terminalShared?.surfaces
    if (!surfaces) return
    const mat = surfaces.brandMaterial()
    this.watchedShell.push(mat)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), mat)
    mesh.position.set(x, y, z)
    mesh.rotation.y = -Math.PI / 2
    mesh.name = 'hatchfield-logo'
    this.roomGroup.add(mesh)
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
    this.releaseShellMats()
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
    if (hasRooms) this.buildFittedShell()
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
        const pos = cellCenter(c, r, cols, rows)
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
    this.kitGroup.add(buildKitInstances(laid))
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
    const origin = game.activeHall()?.origin ?? null
    const hit = matchTerminal(terminals(game), origin)
    const key = hit ? `${game.mapRev}|${hit.index}|${hit.info.cluster.minC},${hit.info.cluster.minR}` : ''
    if (key !== this.interiorKey) {
      this.interiorKey = key
      this.clearInterior()
      this.routeCache.clear()
      if (hit) {
        if (!this.terminalShared) {
          this.terminalTextures = makeTextures(64, 4)
          this.terminalShared = makeTerminalShared(this.terminalTextures, baseLevel(graphicsQuality()))
        }
        const fit = hallFitFor(hit.info)
        const building = new TerminalBuilding(hit.info, this.terminalShared, {
          density: 1,
          walkersPerCell: 0,
          index: hit.index,
        })
        building.root.position.set(-fit.cx, 0, -fit.cz)
        building.propFade = 1
        building.lifeFade = 1
        this.hideTerminalShell(building)
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

  private hideTerminalShell(building: TerminalBuilding) {
    const shell = building.root.getObjectByName('terminal-shell')
    const roof = building.root.getObjectByName('terminal-roof-group')
    if (shell) {
      shell.visible = true
      for (const child of shell.children) child.visible = child.name === 'terminal-floor' || child.name === 'terminal-carpet'
    }
    if (roof) roof.visible = false
  }

  /** Cutaway follows the hall camera, pulled in so near walls drop. */
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
    this.hideTerminalShell(building)
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
    const shirt = this.sharedMat('lambert', color, 0.55)
    const legs = this.sharedMat('lambert', trousers, 0.35)
    const face = this.sharedMat('lambert', skin, 0.4)

    const left = new THREE.Group()
    left.position.set(-0.11, 0.86, 0)
    const leftLeg = new THREE.Mesh(this.figLeg, legs)
    leftLeg.position.y = -0.43
    left.add(leftLeg)
    root.add(left)

    const right = new THREE.Group()
    right.position.set(0.11, 0.86, 0)
    const rightLeg = new THREE.Mesh(this.figLeg, legs)
    rightLeg.position.y = -0.43
    right.add(rightLeg)
    root.add(right)
    root.userData.leftLeg = left
    root.userData.rightLeg = right

    const torso = new THREE.Mesh(this.figTorso, shirt)
    torso.position.y = 1.13
    root.add(torso)
    const armL = new THREE.Group()
    armL.position.set(-0.27, 1.38, 0)
    const armMeshL = new THREE.Mesh(this.figArm, shirt)
    armMeshL.position.y = -0.24
    armL.add(armMeshL)
    root.add(armL)
    const armR = new THREE.Group()
    armR.position.set(0.27, 1.38, 0)
    const armMeshR = new THREE.Mesh(this.figArm, shirt)
    armMeshR.position.y = -0.24
    armR.add(armMeshR)
    root.add(armR)
    root.userData.leftArm = armL
    root.userData.rightArm = armR

    const head = new THREE.Mesh(this.figHead, face)
    head.position.y = 1.58
    root.add(head)

    const pin = new THREE.Mesh(this.figPin, this.sharedMat('lambert', '#e23b2f', 0.2))
    pin.position.y = 1.98
    root.add(pin)
    root.userData.pin = pin

    const carry = new THREE.Mesh(this.figCarry, this.sharedMat('basic', '#3ec6ff'))
    carry.position.set(0.36, 0.98, 0.06)
    root.add(carry)
    root.userData.carry = carry

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
    // Room interior: every hall guest walks the doorway plan. Otherwise departures
    // and arrivals stay on the nav-grid crowd so the two pictures do not stack.
    const nav = game.hallNav
    const routed = this.roomPlan != null && this.interiorFit != null
    const drawn = routed || !nav.live ? game.hallGuests : game.hallGuests.filter((g) => g.job !== 'depart' && !nav.drawsArrival(g.id))
    const live = new Set(drawn.map((g) => g.id))
    for (const [id, mesh] of this.guests) {
      if (!live.has(id)) {
        this.guestGroup.remove(mesh)
        this.disposeFigure(mesh)
        this.guests.delete(id)
      }
    }
    const pile = new Map<string, number>()
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
      mesh.scale.set(figure, figure, figure)
      if (g.meal) {
        // Walk the tray from the counter to the booked seat, then sit: lower and squat.
        const seat = cellCenter(g.meal.c, g.meal.r, cols, rows)
        const sx = seat.x + (g.meal.slot % 2) * 0.9 - 0.45
        const sz = seat.z + Math.floor(g.meal.slot / 2) * 0.9 - 0.45
        const k = g.meal.walkSec > 0 ? 1 - g.meal.walk / g.meal.walkSec : 1
        mesh.position.x += (sx - mesh.position.x) * k
        mesh.position.z += (sz - mesh.position.z) * k
        if (g.seated) mesh.scale.y = figure * 0.72
      }
      const walking = Boolean(next) && !g.seated
      const swing = walking ? Math.sin(game.clock * 6.5 + (guestSalt(g.id) % 628) / 100) * 0.7 : 0
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
      if (walking) mesh.position.y = Math.abs(Math.sin(game.clock * 6.5)) * 0.045
      const pin = mesh.userData.pin as THREE.Mesh
      pin.visible = Boolean(g.lost)
      const carry = mesh.userData.carry as THREE.Mesh
      const checked = mesh.userData.checked as THREE.Mesh
      carry.visible = g.carryOn !== false
      checked.visible = Boolean(g.hasChecked)
      const snack = mesh.userData.snack as THREE.Mesh
      snack.visible = Boolean(g.snack)
      if (g.snack) snack.scale.set(g.snack.kind === 'meal' ? 1.8 : 1, g.snack.kind === 'meal' ? 0.6 : 1, 1)
      this.syncBubble(mesh, g.thought)
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
    const cw = HALL_W / cols
    const rh = HALL_D / rows
    for (let r = 0; r < zones.length; r++) {
      for (let c = 0; c < (zones[r]?.length ?? 0); c++) {
        const z = zones[r][c] as ZoneId | null
        if (!z) continue
        const pos = cellCenter(c, r, cols, rows)
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
    perfFrame()
    let t = perfStart()
    this.resize()
    this.syncInterior(game)
    this.rebuildRooms(game)
    this.syncZoneTint(game)
    this.easeToGoal(game)
    this.syncWalkways(game)
    this.buildFrameQueues(game)
    this.syncGuests(game)
    if (this.roomPlan) {
      this.navCrowd.group.visible = false
      this.navDrawn = 0
    } else {
      this.navDrawn = this.navCrowd.sync(game.hallNav, game.clock, this.camera)
    }
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

  dispose() {
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.onDown)
    canvas.removeEventListener('pointermove', this.onMove)
    canvas.removeEventListener('pointerup', this.onUp)
    canvas.removeEventListener('pointerleave', this.onUp)
    canvas.removeEventListener('wheel', this.onWheel)
    this.clearKit()
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
    this.offGfx()
    for (const mat of this.figMats.values()) mat.dispose()
    this.figMats.clear()
    this.renderer.dispose()
  }
}
