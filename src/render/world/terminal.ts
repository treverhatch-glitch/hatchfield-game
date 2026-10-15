/**
 * Living terminal: glazed curtain walls + skylight roof so the interior reads from
 * the default orbit camera, staffed counters / security / gates / shops as instanced
 * props, seated passengers, and walkers pulling luggage at the nearest LOD.
 */
import * as THREE from 'three'
import { clusterCenter, clusterRadius, DIR_VEC, type TerminalInfo } from './layout'
import { SurfaceLibrary, type LibraryMap } from '../materials/library'
import { tileByPosition } from '../materials/pack1'
import { CARPET_ROOMS, OFFICE_CARPET_ROOMS, PLANK_ROOMS, RUBBER_ROOMS, TERRAZZO_ROOMS } from '../materials/pack4'
import { ROSTER } from '../../airlines/roster'
import type { QualityLevel } from './quality'
import { MATERIAL_TARGETS } from '../../build/materialTargets'
import { tint as lighten } from './buildingSkin'
import { exteriorTexture } from './exteriorArt'
import {
  BAG_COLORS,
  bake,
  FIGURE_HIP_X,
  FIGURE_HIP_Y,
  instanced,
  KIOSK_COLORS,
  PAX_COLORS,
  peopleGeo,
  partSurface,
  propParts,
  setTrs,
  setYawPitch,
  SKIN_COLORS,
  STAFF_COLOR,
  TROUSER_COLORS,
  trs,
  unitBeam,
  walkSwing,
  yawOffset,
  type BakePiece,
  type PeopleGeo,
  type PropPart,
} from './kit'

const PROP_COLORS: Record<string, number> = {
  desk: 0x3d5a74,
  deskTop: 0xe9e4da,
  screen: 0x6ec6ff,
  dark: 0x2a2f36,
  rubber: 0x15171a,
  chrome: 0xb8c0c8,
  tape: 0xc0392b,
  seat: 0x2f5f8a,
  machine: 0x8f9aa6,
  shelf: 0x7a5a3a,
  pot: 0x6a5446,
  leaf: 0x3f8a3a,
  lamp: 0xfff4dc,
}
const UNLIT = new Set(['screen', 'lamp'])
import { pickLod, stepFade } from './lod'
import { planTerminal, terminalPlanSeed, walkerAt, type TerminalPlan } from './plan'
import { roomAt, type RoomKind, type RoomPlan } from './rooms'
import { quadsGeometry } from './surfaces'
import { FidsStage, mountFids } from '../../fids/stage'
import { deskHeaderTexture, fidsBoardTexture, signPanelMaterial, wayfindingSheetTexture } from '../signage/load'
import { departuresBoardTexture, GATE_SIGN, stampWayfindingLogo, wayfindingTexture, type WorldTextures } from './textures'
import { WORLD_PER_METER } from '../aircraft/specs'
import { buildHiDetailProps, buildInteriorDressing, hiDetailOn, hiDetailOwns } from './terminalHiDetail'
import { HALL_NEAR_DIST } from '../hallCamera'
import { setNearPropDetail } from '../terminalProps'
import { CELL, cellX, cellZ } from './view'
import {
  DESK_KINDS,
  hiddenKey,
  hiddenRooms,
  makeSignMesh,
  packSigns,
  roomSpheres,
  visibleInstances,
  writeDeskInstances,
  writeSignInstances,
  type RoomSphere,
  type SignInstance,
  type SignStamp,
} from './roomDraw'

/** Authored shell sizes are meters. */
const m = (meters: number) => meters * WORLD_PER_METER
/** Spread the old 6.2-unit bay across the real cell so furniture still fills the hall. */
const BAY = CELL / 6.2
/** peopleGeo is a 0.9 m figure. Scale it up to 1.75 m, then into world units. */
export const PERSON_SCALE = WORLD_PER_METER * (1.75 / 0.9)

export const FLOOR_Y = m(0.24)
export const SEATED_SCALE = 0.62
export const SEATED_LIFT = m(0.285)
export const ROOF_Y = m(3.9)
const GLASS_TOP = m(3.3)

export interface TerminalShared {
  beam: THREE.BufferGeometry
  people: PeopleGeo
  parts: Record<string, PropPart[]>
  palette: Record<string, THREE.Material>
  textures: WorldTextures
  surfaces: SurfaceLibrary
  signCache: Map<string, THREE.Texture | null>
  /** High / Ultra: detailed render/terminalProps models replace the low-poly plan props. */
  hiDetail: boolean
  /** Live split-flap boards and wayfinding canvases shared by every terminal. */
  fids: FidsStage
}

export function makeTerminalShared(textures: WorldTextures, quality: QualityLevel = 'high'): TerminalShared {
  const fids = new FidsStage()
  const surfaces = new SurfaceLibrary()
  surfaces.loadPngs()
  surfaces.loadPack1(quality)
  surfaces.loadPack4(quality)
  surfaces.loadInteriorFloors(quality)
  const lambert = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) =>
    new THREE.MeshLambertMaterial({ color, ...extra })
  const palette: Record<string, THREE.Material> = {
    desk: lambert(0x3d5a74),
    deskTop: lambert(0xe9e4da),
    screen: new THREE.MeshBasicMaterial({ color: 0x6ec6ff }),
    dark: lambert(0x2a2f36),
    rubber: lambert(0x15171a),
    chrome: lambert(0xb8c0c8),
    tape: lambert(0xc0392b),
    seat: lambert(0x2f5f8a),
    board: signPanelMaterial(fidsBoardTexture() ?? fids.textures.departures ?? departuresBoardTexture() ?? textures.board, 0x071422),
    machine: lambert(0x8f9aa6),
    kiosk: lambert(0xffffff),
    shelf: lambert(0x7a5a3a),
    pot: lambert(0x6a5446),
    leaf: lambert(0x3f8a3a),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff4dc }),
    body: lambert(0xffffff),
    head: lambert(0xffffff),
    bag: lambert(0xffffff),
  }
  return {
    beam: unitBeam(),
    people: peopleGeo(),
    parts: propParts(),
    palette,
    textures,
    surfaces,
    signCache: new Map(),
    hiDetail: hiDetailOn(quality),
    fids,
  }
}

export function disposeTerminalShared(s: TerminalShared) {
  s.beam.dispose()
  s.people.body.dispose()
  s.people.torso.dispose()
  s.people.legL.dispose()
  s.people.legR.dispose()
  s.people.head.dispose()
  s.people.bag.dispose()
  for (const list of Object.values(s.parts)) for (const p of list) p.geo.dispose()
  for (const m of Object.values(s.palette)) m.dispose()
  s.surfaces.dispose()
  for (const t of s.signCache.values()) t?.dispose()
  s.fids.dispose()
}

/** Floor tint per room (multiplies the terrazzo) so room boundaries read from above. */
export const ROOM_FLOOR: Record<RoomKind, number> = {
  checkin: 0xf4f1ea,
  security: 0xf2dca6,
  airside: 0xe2e6ea,
  shops: 0xf1d3bc,
  gate: 0xc9dcf0,
  lab: 0xcfe8cf,
  office: 0xdcd3ea,
}
const THRESHOLD = 0x6f7a84
const SIGN_FG: Partial<Record<RoomKind, string>> = { security: '#f2c14a', lab: '#9be29b', office: '#d7c6ff' }

export const WALL_H = m(2.7)
export const GLASS_WALL_H = m(1.25)
export const DOOR_H = m(2.1)
/** Cutaway stub height for walls between the camera and what it looks at. */
export const WALL_LOW = m(0.32)
/** Far-side walls in the close-up: tall enough to read as rooms, low enough to see over. */
export const WALL_MID = m(1.5)
const WALL_T = m(0.14)

/** LOD thresholds (camera → building distance) before the quality scale. */
export const TERMINAL_LOD = [52 * BAY, 120 * BAY] as const
/** Camera distance under which the roof lifts off so the hall reads from above. */
export const ROOF_CUTAWAY = 34 * BAY

export class TerminalBuilding {
  readonly root = new THREE.Group()
  readonly info: TerminalInfo
  readonly plan: TerminalPlan
  readonly center: THREE.Vector3
  readonly radius: number
  lod = 2
  /** 0..1 fade for interior props (LOD ≤ 1) and the living crowd (LOD 0). */
  propFade = 0
  lifeFade = 0
  private shell = new THREE.Group()
  private roof = new THREE.Group()
  /** Split-flap boards and wayfinding signs. Clicking a board opens the panel. */
  readonly fidsGroup = new THREE.Group()
  private roofMats: THREE.Material[] = []
  /** 1 = roof on; fades to 0 for the close-up cutaway. */
  roofFade = 1
  private props = new THREE.Group()
  private life = new THREE.Group()
  private walkers: THREE.InstancedMesh[] = []
  private propMats: THREE.Material[] = []
  private lifeMats: THREE.Material[] = []
  private owned: { geos: THREE.BufferGeometry[]; mats: THREE.Material[] } = { geos: [], mats: [] }
  private floorMat: THREE.MeshLambertMaterial
  private glassMat: THREE.MeshLambertMaterial
  private skyMat: THREE.MeshLambertMaterial
  private shared: TerminalShared
  private time = 0
  private wallSets: { mesh: THREE.InstancedMesh; walls: WallInst[] }[] = []
  private glassWallMat: THREE.MeshLambertMaterial | null = null
  private ceiling: THREE.Mesh | null = null
  /** Hall view sets this when the real camera is under the tiles. */
  ceilingForce = false
  private wallMats: THREE.Material[] = []
  private nearCut = false
  /** Merged full-height walls. Shown whenever the cutaway is not animating. */
  private staticWalls: THREE.Mesh | null = null
  private staticGlass: THREE.Mesh | null = null
  private signQueue: (SignStamp & { into: 'shell' | 'props' })[] = []
  private signSets: { mesh: THREE.InstancedMesh; items: SignInstance[] }[] = []
  private signTextures: THREE.Texture[] = []
  private deskSets: { mesh: THREE.InstancedMesh; items: { matrix: THREE.Matrix4; room: number }[] }[] = []
  private roomBalls: RoomSphere[] = []
  private hiddenRooms = new Set<number>()
  private hiddenSig = ''
  private poseKey = ''
  private nearShown = true
  private roofTarget = 1
  private propTarget = 0
  private lifeTarget = 0
  private readonly frustum = new THREE.Frustum()
  private readonly projView = new THREE.Matrix4()
  private detail = new THREE.Group()
  /** Prefab II / III: an airside band and a short stub. Real jet bridges stay on the stands. */
  private pier = false

  constructor(info: TerminalInfo, shared: TerminalShared, opts: { density: number; walkersPerCell: number; index: number; pier?: boolean }) {
    this.info = info
    this.shared = shared
    this.plan = planTerminal(info, {
      density: opts.density,
      walkersPerCell: opts.walkersPerCell,
      seed: terminalPlanSeed(opts.index),
    })
    const c = clusterCenter(info.cluster)
    this.center = new THREE.Vector3(c.x, 2, c.z)
    this.radius = clusterRadius(info.cluster)
    this.root.name = `terminal-${opts.index}`
    this.pier = opts.pier === true
    this.shell.name = 'terminal-shell'
    this.roof.name = 'terminal-roof-group'
    this.detail.name = 'props-detail'
    this.props.add(this.detail)
    this.root.add(this.shell, this.roof, this.props, this.life)

    const own = <T extends THREE.Material>(m: T) => {
      this.owned.mats.push(m)
      return m
    }
    this.floorMat = own(
      new THREE.MeshLambertMaterial({
        map: shared.surfaces.maps.terrazzo,
        vertexColors: true,
        emissive: 0xffe2b0,
        emissiveIntensity: 0,
      }),
    )
    shared.surfaces.watch(this.floorMat)
    tileByPosition(this.floorMat, shared.surfaces.repeatFor('terrazzo'))
    const curtain = exteriorTexture('curtain')
    this.glassMat = own(
      new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: curtain ?? shared.surfaces.maps.glass,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        emissive: 0xffc070,
        emissiveIntensity: 0,
      }),
    )
    if (!curtain) shared.surfaces.watch(this.glassMat)
    tileByPosition(this.glassMat, shared.surfaces.repeatFor('glass'))
    this.skyMat = own(this.glassMat.clone())
    this.skyMat.opacity = 0.18
    this.buildShell(opts.index)
    this.buildProps()
    this.buildRooms(opts.index)
    this.mountFids()
    this.buildLife()
    this.flushSigns()
    this.roomBalls = roomSpheres(this.plan.rooms, FLOOR_Y + WALL_H * 0.5)
    this.syncWallMode()
  }

  /**
   * The SVG pack used to replace floor and glass. Texture pack 1 owns those
   * surfaces now, so a later SVG decode must not paint over the JPEGs.
   */
  applyPackMaps(_floor: THREE.Texture | null, _glass: THREE.Texture | null) {}

  get rooms(): RoomPlan {
    return this.plan.rooms
  }

  private bakedMesh(pieces: BakePiece[], mat: THREE.Material, into: THREE.Group, name: string, shadow = false, receive = shadow) {
    const geo = bake(pieces)
    if (!geo) return null
    this.owned.geos.push(geo)
    const m = new THREE.Mesh(geo, mat)
    m.name = name
    m.castShadow = shadow
    m.receiveShadow = receive
    into.add(m)
    return m
  }

  private buildShell(index: number) {
    const { cluster, edges, airside } = this.info
    const own = <T extends THREE.Material>(m: T) => (this.owned.mats.push(m), m)
    const shellM = own(new THREE.MeshLambertMaterial({ vertexColors: true }))
    // Roof tint from the terminal material target; the membrane photo or raster is the map.
    const roofM = own(new THREE.MeshLambertMaterial({ map: this.shared.textures.roof, color: lighten(MATERIAL_TARGETS.terminal.roof) }))

    const slab: THREE.Matrix4[] = []
    const roofFrame: THREE.Matrix4[] = []
    const columns: THREE.Matrix4[] = []
    const mullions: THREE.Matrix4[] = []
    const fascia: THREE.Matrix4[] = []
    const hvac: THREE.Matrix4[] = []
    const rim = m(0.6)
    const slabH = Math.max(m(0.08), FLOOR_Y - m(0.01))
    for (const p of cluster.cells) {
      const x = cellX(p.c)
      const z = cellZ(p.r)
      slab.push(trs(x, 0, z, 0, CELL, slabH, CELL))
      // Roof frame around a central skylight.
      roofFrame.push(trs(x, ROOF_Y, z - CELL / 2 + rim / 2, 0, CELL, m(0.16), rim))
      roofFrame.push(trs(x, ROOF_Y, z + CELL / 2 - rim / 2, 0, CELL, m(0.16), rim))
      roofFrame.push(trs(x - CELL / 2 + rim / 2, ROOF_Y, z, 0, rim, m(0.16), CELL - rim * 2))
      roofFrame.push(trs(x + CELL / 2 - rim / 2, ROOF_Y, z, 0, rim, m(0.16), CELL - rim * 2))
      // Skylight glazing bars.
      for (const k of [-1, 0, 1]) roofFrame.push(trs(x + k * m(1.1), ROOF_Y + m(0.02), z, 0, m(0.06), m(0.06), CELL - rim * 2))
      for (const k of [-0.5, 0.5]) {
        for (const j of [-0.5, 0.5]) columns.push(trs(x + k * CELL * 0.5, FLOOR_Y, z + j * CELL * 0.5, 0, m(0.3), ROOF_Y - FLOOR_Y, m(0.3)))
      }
      if ((p.c * 7 + p.r * 3) % 4 === 0) hvac.push(trs(x - CELL / 2 + rim / 2, ROOF_Y + m(0.16), z, 0, m(1.6), m(0.9), m(2.2)))
    }

    // Curtain walls on every exterior side.
    const glassPos: number[] = []
    const glassIdx: number[] = []
    const quad = (ax: number, az: number, bx: number, bz: number, y0: number, y1: number) => {
      const b = glassPos.length / 3
      glassPos.push(ax, y0, az, bx, y0, bz, ax, y1, az, bx, y1, bz)
      glassIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2)
    }
    for (const e of edges) {
      const v = DIR_VEC[e.side]
      const cx = cellX(e.c) + v.dc * CELL * 0.5
      const cz = cellZ(e.r) + v.dr * CELL * 0.5
      const tx = v.dr !== 0 ? 1 : 0
      const tz = v.dc !== 0 ? 1 : 0
      const h = CELL / 2
      // Wind so the front face looks outward; single-sided glass halves the overdraw.
      const flip = e.side === 'n' || e.side === 'e' ? -1 : 1
      quad(cx - flip * tx * h, cz - flip * tz * h, cx + flip * tx * h, cz + flip * tz * h, FLOOR_Y, GLASS_TOP)
      for (let k = 0; k <= 4; k++) {
        const o = -h + (k * CELL) / 4
        mullions.push(trs(cx + tx * o, FLOOR_Y, cz + tz * o, 0, m(0.12), GLASS_TOP - FLOOR_Y, m(0.12)))
      }
      const yaw = tx ? 0 : Math.PI / 2
      mullions.push(trs(cx, m(2.35), cz, yaw, CELL, m(0.08), m(0.12)))
      mullions.push(trs(cx, FLOOR_Y, cz, yaw, CELL, m(0.16), m(0.18)))
      fascia.push(trs(cx + v.dc * m(0.2), GLASS_TOP, cz + v.dr * m(0.2), yaw, CELL + m(0.3), ROOF_Y + m(0.22) - GLASS_TOP, m(0.45)))
      // Landside drop-off canopy.
      if (e.side === landsideSide(airside)) {
        const ox = cx + v.dc * m(2.4)
        const oz = cz + v.dr * m(2.4)
        fascia.push(trs(ox, m(2.55), oz, yaw, CELL, m(0.14), m(3.6)))
        mullions.push(trs(ox + v.dc * m(1.5) + tx * h * 0.6, 0, oz + v.dr * m(1.5) + tz * h * 0.6, 0, m(0.18), m(2.55), m(0.18)))
        mullions.push(trs(ox + v.dc * m(1.5) - tx * h * 0.6, 0, oz + v.dr * m(1.5) - tz * h * 0.6, 0, m(0.18), m(2.55), m(0.18)))
      }
    }
    const beam = this.shared.beam
    const piece = (list: THREE.Matrix4[], color: number) => list.map((matrix) => ({ geo: beam, matrix, color }))
    this.bakedMesh(piece(slab, 0xffffff), this.floorMat, this.shell, 'terminal-slab', false, true)
    this.bakedMesh(
      [...piece(columns, 0xe6eaee), ...piece(mullions, 0x5b6672), ...piece(fascia, 0xe6eaee)],
      shellM,
      this.shell,
      'terminal-shell',
      true,
    )
    const roof = instanced(beam, roofM, roofFrame)
    roof.castShadow = true
    roof.receiveShadow = true
    roof.name = 'terminal-roof'
    this.roof.add(roof)
    const hvacM = own(new THREE.MeshLambertMaterial({ color: 0x5b6672 }))
    if (hvac.length) {
      const units = instanced(beam, hvacM, hvac)
      units.castShadow = true
      this.roof.add(units)
    }
    this.roofMats.push(roofM, hvacM)

    const glassGeo = new THREE.BufferGeometry()
    glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(glassPos, 3))
    glassGeo.setIndex(glassIdx)
    glassGeo.computeVertexNormals()
    this.owned.geos.push(glassGeo)
    const glass = new THREE.Mesh(glassGeo, this.glassMat)
    glass.renderOrder = 2
    this.shell.add(glass)

    const skyGeo = quadsGeometry(cluster.cells, { y: ROOF_Y + m(0.08), inset: rim })
    skyGeo.deleteAttribute('color')
    this.owned.geos.push(skyGeo)
    const sky = new THREE.Mesh(skyGeo, this.skyMat)
    sky.renderOrder = 3
    this.roof.add(sky)

    this.buildSigns(index)
  }

  private queueSign(
    text: string,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    yaw: number,
    into: 'shell' | 'props',
    room = -1,
    bg = '#13293d',
    fg = '#f4f6f8',
  ) {
    this.signQueue.push({ text, bg, fg, w, h, x, y, z, yaw, room, into })
  }

  private plane(w: number, h: number, mat: THREE.Material, x: number, y: number, z: number, yaw: number, into: THREE.Group) {
    const g = new THREE.PlaneGeometry(w, h)
    this.owned.geos.push(g)
    const mesh = new THREE.Mesh(g, mat)
    mesh.position.set(x, y, z)
    mesh.rotation.y = yaw
    into.add(mesh)
    return mesh
  }

  private wayfindingSign(title: string, sub?: string): THREE.Material {
    const panel = title === 'CHECK-IN' ? wayfindingSheetTexture('checkin') : title === 'SECURITY' ? wayfindingSheetTexture('security') : null
    if (panel) {
      const photo = signPanelMaterial(panel, 0x0e2230)
      photo.name = `way:${title}`
      this.owned.mats.push(photo)
      return photo
    }
    const key = `way|${title}|${sub ?? ''}`
    if (!this.shared.signCache.has(key)) this.shared.signCache.set(key, wayfindingTexture(title, sub))
    const tex = this.shared.signCache.get(key) ?? null
    const m = new THREE.MeshBasicMaterial(tex ? { map: tex, side: THREE.FrontSide } : { color: 0x0e2233, side: THREE.FrontSide })
    this.owned.mats.push(m)
    return m
  }

  /** Navy gate board with the airline mark painted on the left once the JPEG arrives. */
  private gateSign(gateId: string, slot: number): THREE.Material {
    const key = `way|GATES|${gateId}`
    if (!this.shared.signCache.has(key)) this.shared.signCache.set(key, wayfindingTexture('GATES', gateId))
    const tex = this.shared.signCache.get(key) ?? null
    const mat = new THREE.MeshBasicMaterial(tex ? { map: tex, toneMapped: false, side: THREE.FrontSide } : { color: 0x0e2233, side: THREE.FrontSide })
    this.owned.mats.push(mat)
    if (tex) this.shared.surfaces.onRosterLogo(slot, (image) => stampWayfindingLogo(tex, 'GATES', gateId, image))
    return mat
  }

  /** One instanced mesh per parent. Shell signs and room signs do not share a material, so a prop fade cannot blank the fascia. */
  private flushSigns() {
    for (const into of ['shell', 'props'] as const) {
      const stamps = this.signQueue.filter((s) => s.into === into)
      if (!stamps.length) continue
      const packed = packSigns(stamps)
      const mesh = makeSignMesh(packed, into === 'shell' ? 'shell-signs' : 'room-sign')
      if (!mesh) {
        packed.texture?.dispose()
        continue
      }
      if (packed.texture) this.signTextures.push(packed.texture)
      this.owned.geos.push(mesh.geometry)
      const mat = mesh.material as THREE.Material
      this.owned.mats.push(mat)
      if (into === 'props') this.propMats.push(mat)
      ;(into === 'shell' ? this.shell : this.props).add(mesh)
      this.signSets.push({ mesh, items: packed.instances })
    }
    this.signQueue = []
  }

  /** Departures, arrivals, and the check-in / security / gates / baggage signs. */
  private mountFids() {
    const land = landsideSide(this.info.airside)
    const yaw = land === 's' ? 0 : land === 'n' ? Math.PI : land === 'e' ? Math.PI / 2 : -Math.PI / 2
    this.fidsGroup.name = 'fids-install'
    this.props.add(this.fidsGroup)
    const mounted = mountFids(this.fidsGroup, this.plan.rooms.rooms, yaw, m, this.shared.fids.textures)
    this.owned.geos.push(...mounted.geos)
    for (const mat of mounted.mats) {
      this.owned.mats.push(mat)
      this.propMats.push(mat)
    }
  }

  private buildSigns(index: number) {
    const { edges, airside } = this.info
    const land = landsideSide(airside)
    const landEdges = edges.filter((e) => e.side === land)
    const airEdges = edges.filter((e) => e.side === airside)
    const yawOut = (side: string) => (side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2)
    if (landEdges.length) {
      const mid = landEdges[Math.floor(landEdges.length / 2)]
      const v = DIR_VEC[land]
      const brand = this.shared.surfaces.brandMaterial()
      this.owned.mats.push(brand)
      this.plane(
        m(4.6),
        m(4.6),
        brand,
        cellX(mid.c) + v.dc * (CELL * 0.5 + m(0.4)),
        m(3.2),
        cellZ(mid.r) + v.dr * (CELL * 0.5 + m(0.4)),
        yawOut(land),
        this.shell,
      )
      const dep = landEdges[0]
      this.queueSign(
        'DEPARTURES',
        m(4.8),
        m(0.7),
        cellX(dep.c) + v.dc * (CELL * 0.5 + m(2.4)),
        m(2.45),
        cellZ(dep.r) + v.dr * (CELL * 0.5 + m(2.4)),
        yawOut(land),
        'shell',
        -1,
        '#c9a227',
        '#13293d',
      )
    }
    if (this.pier && airEdges.length) {
      const mid = airEdges[Math.floor(airEdges.length / 2)]
      const v = DIR_VEC[airside]
      const x = cellX(mid.c) + v.dc * (CELL * 0.5 + m(0.35))
      const z = cellZ(mid.r) + v.dr * (CELL * 0.5 + m(0.35))
      const yaw = yawOut(airside)
      this.queueSign('PREFAB', m(2.4), m(0.45), x, m(4.4), z, yaw, 'shell', -1, '#1f3b57', '#f4f7fa')
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(m(3.4), m(0.28), m(0.12)),
        new THREE.MeshLambertMaterial({ color: 0x2f6fa8 }),
      )
      band.position.set(x, m(4.05), z)
      band.rotation.y = yaw
      band.name = 'prefab-band'
      this.owned.mats.push(band.material)
      this.owned.geos.push(band.geometry)
      this.shell.add(band)
      const stub = new THREE.Mesh(
        new THREE.BoxGeometry(m(0.7), m(0.4), m(2.4)),
        new THREE.MeshLambertMaterial({ color: 0xd7dee6 }),
      )
      stub.position.set(x + v.dc * m(1.4), m(2.5), z + v.dr * m(1.4))
      stub.rotation.y = yaw
      stub.name = 'prefab-stub'
      this.owned.mats.push(stub.material)
      this.owned.geos.push(stub.geometry)
      this.shell.add(stub)
    }
    airEdges.forEach((e, i) => {
      const v = DIR_VEC[airside]
      const x = cellX(e.c) + v.dc * (CELL * 0.5 + m(0.4))
      const z = cellZ(e.r) + v.dr * (CELL * 0.5 + m(0.4))
      const yaw = yawOut(airside)
      this.queueSign(`GATE ${String.fromCharCode(65 + index)}${i + 1}`, m(2.2), m(0.7), x, m(3.6), z, yaw, 'shell', -1, '#1b4f72', '#ffffff')
      const logo = this.shared.surfaces.rosterMaterial(i)
      this.owned.mats.push(logo)
      const side = yaw + Math.PI / 2
      this.plane(m(0.9), m(0.9), logo, x + Math.sin(side) * m(1.7), m(3.6), z + Math.cos(side) * m(1.7), yaw, this.shell)
    })
  }

  /** Room floors, interior walls / partitions / lintels, and a hanging sign per room. */
  private buildRooms(index: number) {
    const rp = this.plan.rooms
    const floorSpecs = [
      [roomFloorGeometry(rp, FLOOR_Y, { kinds: new Set(TERRAZZO_ROOMS), flat: true }), 'terrazzo', 'terminal-floor'],
      [roomFloorGeometry(rp, FLOOR_Y, { kinds: new Set(CARPET_ROOMS), flat: true }), 'carpet', 'terminal-carpet'],
      [roomFloorGeometry(rp, FLOOR_Y, { kinds: new Set(OFFICE_CARPET_ROOMS), flat: true }), 'carpetGrey', 'terminal-office-carpet'],
      [roomFloorGeometry(rp, FLOOR_Y, { kinds: new Set(RUBBER_ROOMS), flat: true }), 'lane', 'terminal-rubber'],
      [roomFloorGeometry(rp, FLOOR_Y, { kinds: new Set(PLANK_ROOMS), flat: true }), 'plank', 'terminal-plank'],
    ] as const
    const floorMeshes: [THREE.BufferGeometry, THREE.Material, string][] = floorSpecs.map(([geo, kind, name]) => {
      const mat = new THREE.MeshLambertMaterial({
        map: this.shared.surfaces.maps[kind],
        vertexColors: true,
      })
      this.shared.surfaces.watch(mat)
      tileByPosition(mat, this.shared.surfaces.repeatFor(kind))
      this.owned.mats.push(mat)
      return [geo, mat, name]
    })
    for (const [geo, mat, name] of floorMeshes) {
      if (!geo.getAttribute('position')?.count) {
        geo.dispose()
        continue
      }
      const mesh = new THREE.Mesh(geo, mat)
      this.owned.geos.push(geo)
      mesh.receiveShadow = true
      mesh.name = name
      this.shell.add(mesh)
    }
    const ceilGeo = roomFloorGeometry(rp, ROOF_Y - m(0.12), { flat: true })
    const ceilMat = new THREE.MeshLambertMaterial({
      map: this.shared.surfaces.maps.ceiling,
      side: THREE.DoubleSide,
      color: 0xffffff,
    })
    this.shared.surfaces.watch(ceilMat)
    tileByPosition(ceilMat, this.shared.surfaces.repeatFor('ceiling'))
    this.owned.mats.push(ceilMat)
    if (ceilGeo.getAttribute('position')?.count) {
      const ceiling = new THREE.Mesh(ceilGeo, ceilMat)
      this.owned.geos.push(ceilGeo)
      ceiling.name = 'terminal-ceiling'
      this.shell.add(ceiling)
      this.ceiling = ceiling
    } else ceilGeo.dispose()

    const solidM = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: this.shared.surfaces.maps.wall,
      vertexColors: true,
    })
    this.shared.surfaces.watch(solidM)
    tileByPosition(solidM, this.shared.surfaces.repeatFor('wall'))
    this.owned.mats.push(solidM)
    this.wallMats.push(solidM)
    const glassM = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: this.shared.surfaces.maps.glass,
      transparent: true,
      opacity: 0.9,
      depthWrite: true,
    })
    this.shared.surfaces.watch(glassM)
    tileByPosition(glassM, this.shared.surfaces.repeatFor('glass'))
    this.owned.mats.push(glassM)
    this.glassWallMat = glassM
    const solid: WallInst[] = []
    const glass: WallInst[] = []
    for (const w of rp.walls) {
      const inst: WallInst = {
        x: (w.x0 + w.x1) / 2,
        z: (w.z0 + w.z1) / 2,
        len: Math.hypot(w.x1 - w.x0, w.z1 - w.z0),
        alongX: w.z0 === w.z1,
        full: w.kind === 'glass' ? GLASS_WALL_H : WALL_H,
        header: !!w.header,
        h: -1,
        rested: false,
      }
      ;(w.kind === 'glass' ? glass : solid).push(inst)
    }
    const add = (list: WallInst[], mat: THREE.Material, name: string, colors?: number[]) => {
      if (!list.length) return
      const mesh = instanced(this.shared.beam, mat, list.map(() => trs(0, -10, 0)), colors)
      mesh.name = name
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      this.props.add(mesh)
      this.wallSets.push({ mesh, walls: list })
    }
    add(solid, solidM, 'room-walls', solid.map((w) => (w.header ? 0xd7d1c6 : 0xffffff)))
    add(glass, glassM, 'room-glass')
    for (const set of this.wallSets) this.layoutWalls(set, 1)
    this.staticWalls = this.bakeWalls(solid, false)
    this.staticGlass = this.bakeWalls(glass, true)

    const land = landsideSide(this.info.airside)
    const yaw = land === 's' ? 0 : land === 'n' ? Math.PI : land === 'e' ? Math.PI / 2 : -Math.PI / 2
    let gateN = 0
    for (const room of rp.rooms) {
      const gate = room.kind === 'gate'
      if (gate || room.kind === 'checkin' || room.kind === 'security') {
        // Wayfinding boards keep their own texture so the gate board can take the airline mark.
        const gateId = `${String.fromCharCode(65 + index)}${room.label.replace(/\D/g, '') || ''}`
        const w = gate ? m(1.72 * (GATE_SIGN.w / GATE_SIGN.h)) : m(5.6)
        const h = gate ? m(1.72) : m(1.5)
        const mat = gate
          ? this.gateSign(gateId, gateN++)
          : this.wayfindingSign(room.kind === 'checkin' ? 'CHECK-IN' : 'SECURITY')
        this.propMats.push(mat)
        for (const a of [yaw, yaw + Math.PI]) {
          const board = this.plane(w, h, mat, room.x + Math.sin(a) * m(0.03), WALL_H + m(0.35), room.z + Math.cos(a) * m(0.03), a, this.props)
          board.name = gate ? 'gate-sign' : 'wayfinding-sign'
        }
        continue
      }
      const text = room.label
      const w = Math.min(m(4.2), m(0.7) + text.length * m(0.18))
      const h = m(0.55)
      // Back-to-back so the label reads from either side of the hall.
      for (const [o, a] of [[m(0.02), yaw], [-m(0.02), yaw + Math.PI]] as [number, number][]) {
        this.queueSign(
          text,
          w,
          h,
          room.x + Math.sin(yaw) * o,
          WALL_H + m(0.35),
          room.z + Math.cos(yaw) * o,
          a,
          'props',
          room.id,
          '#0e2233',
          SIGN_FG[room.kind] ?? '#ffffff',
        )
      }
    }
  }

  /** Full-height walls as one mesh. The instanced set only runs while the cutaway is moving. */
  private bakeWalls(list: WallInst[], glass: boolean): THREE.Mesh | null {
    const pieces: BakePiece[] = []
    for (const w of list) {
      const sx = w.alongX ? w.len : WALL_T
      const sz = w.alongX ? WALL_T : w.len
      const hh = w.header ? w.full - DOOR_H : w.full
      if (hh <= 0.02) continue
      const y = w.header ? FLOOR_Y + DOOR_H : FLOOR_Y
      pieces.push({
        geo: this.shared.beam,
        matrix: trs(w.x, y, w.z, 0, sx, hh, sz),
        color: glass ? 0xb8d8ea : w.header ? 0x46525e : 0xece6dc,
      })
    }
    if (!pieces.length) return null
    if (glass && this.glassWallMat) {
      const mesh = this.bakedMesh(pieces, this.glassWallMat, this.props, 'room-glass-static', true, true)
      return mesh
    }
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
    this.owned.mats.push(mat)
    this.wallMats.push(mat)
    return this.bakedMesh(pieces, mat, this.props, 'room-walls-static', true, true)
  }

  /** Lower walls on the camera side (and everything when very close) so rooms never block the view. */
  private stepWalls(camPos: THREE.Vector3, focus: { x: number; z: number }, dt: number) {
    if (!this.wallSets.length) return
    const tx = camPos.x - focus.x
    const tz = camPos.z - focus.z
    const flat = Math.hypot(tx, tz) || 1
    const ux = tx / flat
    const uz = tz / flat
    const steep = camPos.y / flat
    const close = Math.hypot(flat, camPos.y) < 18
    const k = Math.min(1, dt * 5)
    for (const set of this.wallSets) {
      let dirty = false
      for (const w of set.walls) {
        let target = w.full
        if (this.nearCut) {
          const t = (w.x - focus.x) * ux + (w.z - focus.z) * uz
          const near = Math.hypot(camPos.x - w.x, camPos.z - w.z) < 6
          if (close || near || (t > -1.2 * BAY && steep < 2.6)) target = Math.min(w.full, WALL_LOW)
          else target = Math.min(w.full, WALL_MID)
        }
        const h = w.h < 0 ? target : w.h + (target - w.h) * k
        w.rested = Math.abs(h - target) < 1e-2
        if (Math.abs(h - w.h) > 1e-3) {
          w.h = h
          dirty = true
        }
      }
      if (dirty) this.layoutWalls(set, 0)
    }
  }

  private layoutWalls(set: { mesh: THREE.InstancedMesh; walls: WallInst[] }, init: number) {
    const m = new THREE.Matrix4()
    set.walls.forEach((w, i) => {
      if (init) {
        w.h = w.full
        w.rested = true
      }
      const sx = w.alongX ? w.len : WALL_T
      const sz = w.alongX ? WALL_T : w.len
      if (w.header) {
        const hh = w.h - DOOR_H
        if (hh > 0.02) m.compose(new THREE.Vector3(w.x, FLOOR_Y + DOOR_H, w.z), Q0, new THREE.Vector3(sx, hh, sz))
        else m.makeTranslation(0, -10, 0)
      } else m.compose(new THREE.Vector3(w.x, FLOOR_Y, w.z), Q0, new THREE.Vector3(sx, Math.max(0.02, w.h), sz))
      set.mesh.setMatrixAt(i, m)
    })
    set.mesh.instanceMatrix.needsUpdate = true
  }

  private buildProps() {
    const lit: BakePiece[] = []
    const wood: BakePiece[] = []
    const plaster: BakePiece[] = []
    const unlit: BakePiece[] = []
    const extraSurfaces = new Map<LibraryMap, BakePiece[]>()
    const lamps: BakePiece[] = []
    const boards: THREE.Matrix4[] = []
    const desks = new Map<
      string,
      { geo: THREE.BufferGeometry; mat: string; surface?: LibraryMap; items: { matrix: THREE.Matrix4; room: number }[] }
    >()
    const logoSlots: THREE.Matrix4[] = []
    const headerSlots: { matrix: THREE.Matrix4; room: number }[] = []
    const detail = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; matrices: THREE.Matrix4[]; colors: number[] }>()
    const hi = this.shared.hiDetail === true
    for (const p of this.plan.props) {
      if (hiDetailOwns(p.kind, hi)) continue
      const matrix = trs(p.x, FLOOR_Y, p.z, p.yaw, WORLD_PER_METER, WORLD_PER_METER, WORLD_PER_METER)
      const room = roomAt(this.plan.rooms, p.x, p.z)?.id ?? -1
      if (DESK_KINDS.has(p.kind)) {
        for (const part of this.shared.parts[p.kind] ?? []) {
          if (part.mat === 'logo') {
            logoSlots.push(matrix)
            continue
          }
          if (part.mat === 'deskHeader') {
            headerSlots.push({ matrix, room })
            continue
          }
          const surface = partSurface(part)
          const map: LibraryMap | undefined = surface
          const key = `${part.geo.uuid}|${part.mat}|${map ?? ''}`
          const list = desks.get(key) ?? { geo: part.geo, mat: part.mat, surface: map, items: [] }
          list.items.push({ matrix, room })
          desks.set(key, list)
        }
        continue
      }
      for (const part of this.shared.parts[p.kind] ?? []) {
        const surface = partSurface(part)
        const color = surface
          ? 0xffffff
          : part.mat === 'kiosk'
            ? KIOSK_COLORS[(p.tint ?? 0) % KIOSK_COLORS.length]
            : (PROP_COLORS[part.mat] ?? 0xffffff)
        if (part.detail) {
          const mat = surface
            ? this.shared.surfaces.material(part.mat, 0xffffff, surface)
            : (this.shared.palette[part.mat] ?? this.shared.palette.desk)
          const key = `${part.geo.uuid}|${part.mat}|${surface ?? ''}`
          let batch = detail.get(key)
          if (!batch) {
            batch = { geo: part.geo, mat, matrices: [], colors: [] }
            detail.set(key, batch)
          }
          batch.matrices.push(matrix)
          batch.colors.push(color)
          continue
        }
        if (part.mat === 'board') {
          boards.push(matrix)
          continue
        }
        if (part.mat === 'logo') {
          logoSlots.push(matrix)
          continue
        }
        const bucket =
          p.kind === 'light'
            ? lamps
            : surface
              ? surface === 'wall'
                ? plaster
                : surface === 'wood'
                  ? wood
                  : null
              : UNLIT.has(part.mat)
                ? unlit
                : lit
        if (bucket) bucket.push({ geo: part.geo, matrix, color })
        else if (surface) {
          const kind: LibraryMap = surface
          let extra = extraSurfaces.get(kind)
          if (!extra) {
            extra = []
            extraSurfaces.set(kind, extra)
          }
          extra.push({ geo: part.geo, matrix, color })
        }
      }
    }
    const own = <T extends THREE.Material>(m: T) => {
      this.owned.mats.push(m)
      this.propMats.push(m)
      return m
    }
    const mapped = (map: THREE.Texture) => {
      const m = own(new THREE.MeshLambertMaterial({ vertexColors: true, map }))
      this.shared.surfaces.watch(m)
      return m
    }
    this.bakedMesh(lit, own(new THREE.MeshLambertMaterial({ vertexColors: true })), this.props, 'props-lit')
    const mappedKind = (kind: LibraryMap) => {
      const m = mapped(this.shared.surfaces.maps[kind])
      tileByPosition(m, this.shared.surfaces.repeatFor(kind))
      return m
    }
    this.bakedMesh(wood, mappedKind('wood'), this.props, 'props-wood')
    this.bakedMesh(plaster, mappedKind('wall'), this.props, 'props-wall')
    for (const [kind, pieces] of extraSurfaces) this.bakedMesh(pieces, mappedKind(kind), this.props, `props-${kind}`)
    this.bakedMesh(unlit, own(new THREE.MeshBasicMaterial({ vertexColors: true })), this.props, 'props-unlit')
    for (const list of desks.values()) {
      const src = this.shared.palette[list.mat]
      let mat: THREE.Material
      if (list.surface) {
        // Granite tops and the like: per-terminal copy so the prop fade does not touch other terminals.
        const surfaced = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.shared.surfaces.maps[list.surface] })
        tileByPosition(surfaced, this.shared.surfaces.repeatFor(list.surface))
        this.shared.surfaces.watch(surfaced)
        mat = surfaced
      } else {
        mat = src ? src.clone() : new THREE.MeshLambertMaterial({ color: PROP_COLORS[list.mat] ?? 0xffffff })
      }
      own(mat)
      const mesh = instanced(
        list.geo,
        mat,
        list.items.map((item) => item.matrix),
      )
      mesh.name = 'props-desks'
      mesh.frustumCulled = false
      this.props.add(mesh)
      this.deskSets.push({ mesh, items: list.items })
    }
    // Ceiling lamps hang from the roof, so they leave with it in the cutaway.
    const lampM = new THREE.MeshBasicMaterial({ vertexColors: true })
    this.owned.mats.push(lampM)
    this.roofMats.push(lampM)
    this.bakedMesh(lamps, lampM, this.roof, 'roof-lamps')
    const logoGeo = this.shared.parts.counter?.find((x) => x.mat === 'logo')?.geo
    if (logoGeo && logoSlots.length) {
      const byMark = new Map<number, THREE.Matrix4[]>()
      logoSlots.forEach((matrix, i) => {
        const slot = i % ROSTER.length
        const list = byMark.get(slot) ?? []
        list.push(matrix)
        byMark.set(slot, list)
      })
      for (const [slot, matrices] of byMark) {
        const mat = own(this.shared.surfaces.rosterMaterial(slot))
        const mesh = instanced(logoGeo, mat, matrices)
        mesh.name = 'desk-logo'
        this.props.add(mesh)
      }
    }
    const headerGeo = this.shared.parts.counter?.find((x) => x.mat === 'deskHeader')?.geo
    if (headerGeo && headerSlots.length) {
      const byNumber = new Map<number, { matrix: THREE.Matrix4; room: number }[]>()
      headerSlots.forEach((slot, i) => {
        const n = (i % 6) + 1
        const list = byNumber.get(n) ?? []
        list.push(slot)
        byNumber.set(n, list)
      })
      for (const [n, slots] of byNumber) {
        const mat = own(signPanelMaterial(deskHeaderTexture(n), 0x12304a))
        mat.name = `desk-header:${n}`
        const mesh = instanced(
          headerGeo,
          mat,
          slots.map((slot) => slot.matrix),
        )
        mesh.name = `desk-header-${n}`
        this.props.add(mesh)
        this.deskSets.push({ mesh, items: slots })
      }
    }
    const board = this.shared.parts.board?.find((x) => x.mat === 'board')
    if (board && boards.length) {
      const m = instanced(board.geo, own(this.shared.palette.board.clone()), boards)
      m.name = 'props-boards'
      this.props.add(m)
    }
    for (const batch of detail.values()) {
      const mesh = instanced(batch.geo, batch.mat, batch.matrices, batch.colors)
      mesh.castShadow = false
      mesh.frustumCulled = false
      this.detail.add(mesh)
    }
    if (hi) {
      this.props.add(buildHiDetailProps(this.plan.props, this.shared.parts, WORLD_PER_METER, FLOOR_Y))
      this.props.add(buildInteriorDressing(this.plan.rooms, WORLD_PER_METER, FLOOR_Y))
    }
  }

  private buildLife() {
    const g = this.shared.people
    const pieces: BakePiece[] = []
    this.plan.people.forEach((p, i) => {
      const seated = p.role === 'seated'
      // Seated figures are shortened and lifted so they rest on the seat top (0.285).
      const sy = (seated ? SEATED_SCALE : 1) * PERSON_SCALE
      const matrix = trs(p.x, FLOOR_Y + (seated ? SEATED_LIFT : 0), p.z, p.yaw, PERSON_SCALE, sy, PERSON_SCALE)
      pieces.push({ geo: g.body, matrix, color: p.role === 'staff' ? STAFF_COLOR : PAX_COLORS[p.tint % PAX_COLORS.length] })
      pieces.push({ geo: g.head, matrix, color: SKIN_COLORS[(i * 7) % SKIN_COLORS.length] })
    })
    const peopleM = new THREE.MeshLambertMaterial({ vertexColors: true })
    this.owned.mats.push(peopleM)
    this.lifeMats.push(peopleM)
    this.bakedMesh(pieces, peopleM, this.life, 'people-static')
    const mk = (geo: THREE.BufferGeometry, key: string, m: THREE.Matrix4[], c: number[]) => {
      const mat = this.shared.palette[key].clone()
      this.lifeMats.push(mat)
      this.owned.mats.push(mat)
      const mesh = instanced(geo, mat, m, c)
      mesh.name = `people-${key}`
      this.life.add(mesh)
      return mesh
    }
    const w = this.plan.walkers
    if (w.length) {
      const zero = w.map(() => trs(0, -10, 0))
      const shirts = w.map((x) => (x.staff ? STAFF_COLOR : PAX_COLORS[x.tint % PAX_COLORS.length]))
      const trousers = w.map((x) => TROUSER_COLORS[x.tint % TROUSER_COLORS.length])
      const wt = mk(g.torso, 'body', zero, shirts)
      const wh = mk(g.head, 'head', zero, w.map((_, i) => SKIN_COLORS[(i * 3) % SKIN_COLORS.length]))
      const bags = w.filter((x) => x.bag)
      const wl = mk(g.bag, 'bag', bags.map(() => trs(0, -10, 0)), bags.map((_, i) => BAG_COLORS[i % BAG_COLORS.length]))
      const wL = mk(g.legL, 'body', zero, trousers)
      const wR = mk(g.legR, 'body', zero, trousers)
      for (const mesh of [wt, wh, wl, wL, wR]) mesh.frustumCulled = false
      this.walkers = [wt, wh, wl, wL, wR]
      this.stepWalkers(0)
    }
  }

  private stepWalkers(t: number) {
    if (!this.walkers.length) return
    const [wt, wh, wl, wL, wR] = this.walkers
    let bi = 0
    this.plan.walkers.forEach((w, i) => {
      const p = walkerAt(w, t)
      const bob = Math.abs(Math.sin(t * 7 * w.speed + i)) * m(0.04)
      const y = FLOOR_Y + bob
      setTrs(wt, i, p.x, y, p.z, p.yaw, PERSON_SCALE, PERSON_SCALE)
      setTrs(wh, i, p.x, y, p.z, p.yaw, PERSON_SCALE, PERSON_SCALE)
      const swing = walkSwing(t, w.phase, w.speed)
      yawOffset(p.yaw, -FIGURE_HIP_X * PERSON_SCALE, FIGURE_HIP_Y * PERSON_SCALE + bob, 0, HIP)
      setYawPitch(wL, i, p.x + HIP.x, FLOOR_Y + HIP.y, p.z + HIP.z, p.yaw, swing, PERSON_SCALE, PERSON_SCALE)
      yawOffset(p.yaw, FIGURE_HIP_X * PERSON_SCALE, FIGURE_HIP_Y * PERSON_SCALE + bob, 0, HIP)
      setYawPitch(wR, i, p.x + HIP.x, FLOOR_Y + HIP.y, p.z + HIP.z, p.yaw, -swing, PERSON_SCALE, PERSON_SCALE)
      if (w.bag) {
        // Case trails behind and to the right of the walker.
        const back = 0.32 * PERSON_SCALE
        const side = 0.16 * PERSON_SCALE
        const sx = Math.sin(p.yaw)
        const sz = Math.cos(p.yaw)
        setTrs(wl, bi++, p.x - sx * back + sz * side, FLOOR_Y, p.z - sz * back - sx * side, p.yaw, PERSON_SCALE, PERSON_SCALE)
      }
    })
    for (const mesh of this.walkers) mesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Per frame: LOD pick from camera distance, fades, walkers, night glow.
   * `enclosed` is the airport view: the roof stays on and the walls stay up.
   * A still camera with settled fades skips the rebuild. Off-screen rooms drop
   * their signs and desks; the merged walls stay one draw.
   */
  update(
    camPos: THREE.Vector3,
    dt: number,
    lodScale: number,
    night: number,
    focus?: { x: number; z: number },
    enclosed = false,
    camera?: THREE.Camera,
  ) {
    const look = focus ?? { x: this.center.x, z: this.center.z }
    const dist = Math.max(0, camPos.distanceTo(this.center) - this.radius * 0.5)
    const near = dist <= HALL_NEAR_DIST * WORLD_PER_METER
    if (near !== this.nearShown) {
      this.nearShown = near
      setNearPropDetail(this.props, near)
    }
    const pose = `${interiorPoseKey(camPos, look, lodScale, night, enclosed)}|${this.ceilingForce ? 1 : 0}`
    if (pose === this.poseKey && this.settled()) return
    this.poseKey = pose

    this.lod = pickLod(this.lod, dist, TERMINAL_LOD.map((t) => t * lodScale))
    const close = this.lod === 0 && dist < ROOF_CUTAWAY * lodScale
    // Hall view only: close and above the roof lifts it off. Airport view stays enclosed.
    const cut = !enclosed && close && camPos.y > ROOF_Y + m(1.5)
    const aboveCeiling = camPos.y > ROOF_Y - m(0.2)
    if (this.ceiling) this.ceiling.visible = this.ceilingForce || !aboveCeiling
    this.nearCut = !enclosed && close
    this.roofTarget = cut ? 0 : 1
    this.propTarget = this.lod <= 1 ? 1 : 0
    this.lifeTarget = this.lod === 0 ? 1 : 0
    this.roofFade = stepFade(this.roofFade, this.roofTarget, dt, 1.1)
    applyFade(this.roof, this.roofMats, this.roofFade)
    // Lift as it fades so the cutaway reads as the roof coming off, not blinking out.
    const lift = 1 - this.roofFade
    this.roof.position.y = lift * lift * m(4)
    this.skyMat.opacity = 0.18 * this.roofFade
    this.propFade = stepFade(this.propFade, this.propTarget, dt, 3)
    this.lifeFade = stepFade(this.lifeFade, this.lifeTarget, dt, 3)
    applyFade(this.props, this.propMats, this.propFade)
    applyFade(this.props, this.wallMats, this.propFade)
    this.detail.visible = this.lod === 0 && this.propFade > 0.2
    if (this.glassWallMat) this.glassWallMat.opacity = 0.9 * this.propFade
    if (!this.nearCut && this.propFade < 0.001) this.snapWallsFull()
    else if (this.propFade > 0 && (this.nearCut || !this.wallsFull())) this.stepWalls(camPos, look, dt)
    this.syncWallMode()
    applyFade(this.life, this.lifeMats, this.lifeFade)
    this.time += dt
    if (this.lifeFade > 0) this.stepWalkers(this.time)
    if (this.propFade > 0.001) this.cullInterior(camera)
    this.floorMat.emissiveIntensity = night * 0.32
    // Curtain wall reads as lit rooms once the sun is down. Day stays at the clear 0.3.
    this.glassMat.opacity = 0.3 + night * 0.22
    this.glassMat.emissiveIntensity = night * 1.05
    this.skyMat.emissiveIntensity = night * 0.25
  }

  /** True once fades, walls, and walkers have nothing left to animate. */
  settled(): boolean {
    if (this.walkers.length > 0 && this.lifeFade > 0.001) return false
    if (Math.abs(this.roofFade - this.roofTarget) > 1e-3) return false
    if (Math.abs(this.propFade - this.propTarget) > 1e-3) return false
    if (Math.abs(this.lifeFade - this.lifeTarget) > 1e-3) return false
    return this.wallsResting()
  }

  /** Instanced signs and desks, plus the merged wall meshes, for the draw budget. */
  drawBudget() {
    let signInstances = 0
    let deskInstances = 0
    for (const set of this.signSets) signInstances += set.mesh.count
    for (const set of this.deskSets) deskInstances += set.mesh.count
    return {
      signMeshes: this.signSets.length,
      signInstances,
      deskMeshes: this.deskSets.length,
      deskInstances,
      staticWalls: this.staticWalls ? 1 : 0,
      staticGlass: this.staticGlass ? 1 : 0,
      hiddenRooms: this.hiddenRooms.size,
    }
  }

  /** Merged full-height walls while the cutaway is still. Instanced walls only while they move. */
  private syncWallMode() {
    const animate = this.nearCut || !this.wallsFull()
    for (const set of this.wallSets) set.mesh.visible = animate
    if (this.staticWalls) this.staticWalls.visible = !animate
    if (this.staticGlass) this.staticGlass.visible = !animate
  }

  private wallsFull(): boolean {
    for (const set of this.wallSets) {
      for (const w of set.walls) if (Math.abs(w.h - w.full) > 1e-2) return false
    }
    return true
  }

  private wallsResting(): boolean {
    for (const set of this.wallSets) {
      for (const w of set.walls) if (!w.rested) return false
    }
    return true
  }

  /** Zoomed-out frames hide the interior, so put every wall back to full height in one step. */
  private snapWallsFull() {
    for (const set of this.wallSets) {
      let dirty = false
      for (const w of set.walls) {
        if (w.rested && Math.abs(w.h - w.full) <= 1e-3) continue
        w.h = w.full
        w.rested = true
        dirty = true
      }
      if (dirty) this.layoutWalls(set, 0)
    }
  }

  /** Drop signs and desks whose room sphere misses the camera. Shell signs stay. */
  private cullInterior(camera?: THREE.Camera) {
    if (!camera) {
      if (!this.hiddenSig) return
      this.hiddenRooms = new Set()
      this.hiddenSig = ''
      this.applyHidden()
      return
    }
    camera.updateMatrixWorld()
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.frustum.setFromProjectionMatrix(this.projView)
    this.props.updateWorldMatrix(true, true)
    const hidden = hiddenRooms(this.roomBalls, this.props.matrixWorld, this.frustum)
    const sig = hiddenKey(hidden)
    if (sig === this.hiddenSig) return
    this.hiddenRooms = hidden
    this.hiddenSig = sig
    this.applyHidden()
  }

  private applyHidden() {
    for (const set of this.signSets) writeSignInstances(set.mesh, visibleInstances(set.items, this.hiddenRooms))
    for (const set of this.deskSets) writeDeskInstances(set.mesh, set.items, this.hiddenRooms)
  }

  setShadows(on: boolean) {
    this.shell.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.castShadow = on
    })
  }

  counts() {
    return {
      roof: Math.round(this.roofFade * 100) / 100,
      props: this.plan.props.length,
      people: this.plan.people.length,
      walkers: this.plan.walkers.length,
      staff: this.plan.people.filter((p) => p.role === 'staff').length,
      seated: this.plan.people.filter((p) => p.role === 'seated').length,
      bags: this.plan.walkers.filter((w) => w.bag).length,
      rooms: this.plan.rooms.rooms.length,
      doors: this.plan.rooms.doors.length,
      walls: this.plan.rooms.walls.length,
      wallsLowered: this.wallSets.reduce((n, s) => n + s.walls.filter((w) => w.h < WALL_LOW + 0.2).length, 0),
    }
  }

  dispose() {
    for (const t of this.signTextures) t.dispose()
    this.signTextures = []
    this.shared.surfaces.unwatch(this.floorMat)
    for (const mat of this.owned.mats) {
      this.shared.surfaces.unwatch(mat)
      this.shared.surfaces.releaseLogo(mat)
    }
    for (const g of this.owned.geos) g.dispose()
    for (const m of this.owned.mats) m.dispose()
    this.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose()
    })
    this.root.removeFromParent()
  }
}

function interiorPoseKey(
  cam: THREE.Vector3,
  focus: { x: number; z: number },
  lodScale: number,
  night: number,
  enclosed: boolean,
): string {
  const q = (n: number) => Math.round(n * 20)
  return [q(cam.x), q(cam.y), q(cam.z), q(focus.x), q(focus.z), Math.round(lodScale * 100), Math.round(night * 50), enclosed ? 1 : 0].join(',')
}

export function landsideSide(airside: 'n' | 's' | 'e' | 'w'): 'n' | 's' | 'e' | 'w' {
  return airside === 'n' ? 's' : airside === 's' ? 'n' : airside === 'e' ? 'w' : 'e'
}

function applyFade(group: THREE.Group, mats: THREE.Material[], f: number) {
  group.visible = f > 0.001
  if (!group.visible) return
  const fading = f < 0.999
  for (const m of mats) {
    if (m.transparent !== fading) {
      m.transparent = fading
      m.depthWrite = !fading
    }
    m.opacity = f
  }
}

const Q0 = new THREE.Quaternion()
const HIP = new THREE.Vector3()

interface WallInst {
  x: number
  z: number
  len: number
  alongX: boolean
  full: number
  header: boolean
  /** Current animated height. */
  h: number
  /** Height has caught the cutaway target, so the mesh can sit still. */
  rested: boolean
}

/** Terrazzo floor tinted per room, runs merged per row, darker thresholds at doorways. */
export function roomFloorGeometry(
  rp: RoomPlan,
  y: number,
  opts: { kinds?: ReadonlySet<string>; flat?: boolean } = {},
): THREE.BufferGeometry {
  const near = new Uint8Array(rp.w * rp.h)
  for (const e of rp.doorEdges) {
    const s = e >> 1
    near[s] = 1
    near[s + ((e & 1) === 0 ? 1 : rp.w)] = 1
  }
  const accept = (s: number) => {
    if (rp.grid[s] < 0) return false
    const kind = rp.rooms[rp.grid[s]]?.kind
    return !opts.kinds || (kind != null && opts.kinds.has(kind))
  }
  const colorOf = (s: number) => {
    if (opts.flat) return 0xffffff
    return near[s] ? THRESHOLD : ROOM_FLOOR[rp.rooms[rp.grid[s]].kind]
  }
  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const c = new THREE.Color()
  const uvSize = 3.1
  for (let j = 0; j < rp.h; j++) {
    let i = 0
    while (i < rp.w) {
      const s = j * rp.w + i
      if (!accept(s)) {
        i++
        continue
      }
      const hex = colorOf(s)
      let i1 = i + 1
      while (i1 < rp.w && accept(j * rp.w + i1) && colorOf(j * rp.w + i1) === hex) i1++
      const xa = rp.x0 + i * rp.size
      const xb = rp.x0 + i1 * rp.size
      const za = rp.z0 + j * rp.size
      const zb = za + rp.size
      const b = pos.length / 3
      pos.push(xa, y, za, xb, y, za, xa, y, zb, xb, y, zb)
      uv.push(xa / uvSize, -za / uvSize, xb / uvSize, -za / uvSize, xa / uvSize, -zb / uvSize, xb / uvSize, -zb / uvSize)
      c.setHex(hex)
      for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b)
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
      i = i1
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 3).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}
