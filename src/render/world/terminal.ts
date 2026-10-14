/**
 * Living terminal: glazed curtain walls + skylight roof so the interior reads from
 * the default orbit camera, staffed counters / security / gates / shops as instanced
 * props, seated passengers, and walkers pulling luggage at the nearest LOD.
 */
import * as THREE from 'three'
import { clusterCenter, clusterRadius, DIR_VEC, type TerminalInfo } from './layout'
import {
  BAG_COLORS,
  bake,
  instanced,
  KIOSK_COLORS,
  PAX_COLORS,
  peopleGeo,
  propParts,
  setTrs,
  SKIN_COLORS,
  STAFF_COLOR,
  trs,
  unitBeam,
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
import { type RoomKind, type RoomPlan } from './rooms'
import { quadsGeometry } from './surfaces'
import { textTexture, type WorldTextures } from './textures'
import { WORLD_PER_METER } from '../aircraft/specs'
import { CELL, cellX, cellZ } from './view'

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
  signCache: Map<string, THREE.Texture | null>
}

export function makeTerminalShared(textures: WorldTextures): TerminalShared {
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
    board: new THREE.MeshBasicMaterial({ map: textures.board }),
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
    signCache: new Map(),
  }
}

export function disposeTerminalShared(s: TerminalShared) {
  s.beam.dispose()
  s.people.body.dispose()
  s.people.head.dispose()
  s.people.bag.dispose()
  for (const list of Object.values(s.parts)) for (const p of list) p.geo.dispose()
  for (const m of Object.values(s.palette)) m.dispose()
  for (const t of s.signCache.values()) t?.dispose()
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
  private wallMats: THREE.Material[] = []
  private nearCut = false

  constructor(info: TerminalInfo, shared: TerminalShared, opts: { density: number; walkersPerCell: number; index: number }) {
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
    this.shell.name = 'terminal-shell'
    this.roof.name = 'terminal-roof-group'
    this.root.add(this.shell, this.roof, this.props, this.life)

    const own = <T extends THREE.Material>(m: T) => {
      this.owned.mats.push(m)
      return m
    }
    this.floorMat = own(
      new THREE.MeshLambertMaterial({
        map: shared.textures.terrazzo,
        vertexColors: true,
        emissive: 0xffe2b0,
        emissiveIntensity: 0,
      }),
    )
    this.glassMat = own(
      new THREE.MeshLambertMaterial({
        color: 0x9cc4dc,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        emissive: 0xffc070,
        emissiveIntensity: 0,
      }),
    )
    this.skyMat = own(this.glassMat.clone())
    this.skyMat.opacity = 0.18
    this.buildShell(opts.index)
    this.buildProps()
    this.buildRooms(opts.index)
    this.buildLife()
  }

  /** Swap in the SVG pack once it has decoded. Procedural maps stay until then. */
  applyPackMaps(floor: THREE.Texture | null, glass: THREE.Texture | null) {
    if (floor) {
      this.floorMat.map = floor
      this.floorMat.needsUpdate = true
    }
    if (glass) {
      this.glassMat.map = glass
      this.glassMat.color.setHex(0xffffff)
      this.glassMat.needsUpdate = true
    }
  }

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
    const roofM = own(new THREE.MeshLambertMaterial({ map: this.shared.textures.roof }))

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
    this.bakedMesh(
      [...piece(slab, 0x9aa0a6), ...piece(columns, 0xe6eaee), ...piece(mullions, 0x5b6672), ...piece(fascia, 0xe6eaee)],
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

  private sign(text: string, w: number, h: number, bg = '#13293d', fg = '#f4f6f8'): THREE.Material {
    const key = `${text}|${bg}|${fg}`
    if (!this.shared.signCache.has(key)) this.shared.signCache.set(key, textTexture(text, { bg, fg, w: 512, h: Math.round((512 * h) / w) }))
    const tex = this.shared.signCache.get(key) ?? null
    const m = new THREE.MeshBasicMaterial(tex ? { map: tex } : { color: new THREE.Color(bg) })
    this.owned.mats.push(m)
    return m
  }

  private plane(w: number, h: number, mat: THREE.Material, x: number, y: number, z: number, yaw: number, into: THREE.Group) {
    const g = new THREE.PlaneGeometry(w, h)
    this.owned.geos.push(g)
    const m = new THREE.Mesh(g, mat)
    m.position.set(x, y, z)
    m.rotation.y = yaw
    into.add(m)
    return m
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
      const w = Math.min(m(14), landEdges.length * m(8))
      const h = m(1.4)
      this.plane(
        w,
        h,
        this.sign(`TERMINAL ${index + 1}`, w, h, '#13293d', '#f2c14a'),
        cellX(mid.c) + v.dc * (CELL * 0.5 + m(0.4)),
        m(3.6),
        cellZ(mid.r) + v.dr * (CELL * 0.5 + m(0.4)),
        yawOut(land),
        this.shell,
      )
      const dep = landEdges[0]
      this.plane(
        m(4.8),
        m(0.7),
        this.sign('DEPARTURES', m(4.8), m(0.7), '#c9a227', '#13293d'),
        cellX(dep.c) + v.dc * (CELL * 0.5 + m(2.4)),
        m(2.45),
        cellZ(dep.r) + v.dr * (CELL * 0.5 + m(2.4)),
        yawOut(land),
        this.shell,
      )
    }
    airEdges.forEach((e, i) => {
      const v = DIR_VEC[airside]
      this.plane(
        m(2.8),
        m(0.7),
        this.sign(`GATE ${String.fromCharCode(65 + index)}${i + 1}`, m(2.8), m(0.7), '#1b4f72', '#ffffff'),
        cellX(e.c) + v.dc * (CELL * 0.5 + m(0.4)),
        m(3.6),
        cellZ(e.r) + v.dr * (CELL * 0.5 + m(0.4)),
        yawOut(airside),
        this.shell,
      )
    })
  }

  /** Room floors, interior walls / partitions / lintels, and a hanging sign per room. */
  private buildRooms(index: number) {
    const rp = this.plan.rooms
    const floor = new THREE.Mesh(roomFloorGeometry(rp, FLOOR_Y), this.floorMat)
    this.owned.geos.push(floor.geometry)
    floor.receiveShadow = true
    floor.name = 'terminal-floor'
    this.shell.add(floor)

    const solidM = new THREE.MeshLambertMaterial({ color: 0xffffff })
    this.owned.mats.push(solidM)
    this.wallMats.push(solidM)
    const glassM = this.glassMat.clone()
    glassM.opacity = 0.4
    glassM.color.setHex(0xb8d8ea)
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
    add(solid, solidM, 'room-walls', solid.map((w) => (w.header ? 0x46525e : 0xece6dc)))
    add(glass, glassM, 'room-glass')
    for (const set of this.wallSets) this.layoutWalls(set, 1)

    const land = landsideSide(this.info.airside)
    const yaw = land === 's' ? 0 : land === 'n' ? Math.PI : land === 'e' ? Math.PI / 2 : -Math.PI / 2
    for (const room of rp.rooms) {
      const text = room.kind === 'gate' ? room.label.replace('GATE ', `GATE ${String.fromCharCode(65 + index)}`) : room.label
      const w = Math.min(m(4.2), m(0.7) + text.length * m(0.18))
      const h = m(0.55)
      const mat = this.sign(text, w, h, '#0e2233', SIGN_FG[room.kind] ?? '#ffffff')
      this.propMats.push(mat)
      // Back-to-back so the label reads from either side of the hall.
      for (const [o, a] of [[m(0.02), yaw], [-m(0.02), yaw + Math.PI]] as [number, number][]) {
        const sign = this.plane(w, h, mat, room.x + Math.sin(yaw) * o, WALL_H + m(0.35), room.z + Math.cos(yaw) * o, a, this.props)
        sign.name = 'room-sign'
      }
    }
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
      if (init) w.h = w.full
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
    const unlit: BakePiece[] = []
    const lamps: BakePiece[] = []
    const boards: THREE.Matrix4[] = []
    for (const p of this.plan.props) {
      const matrix = trs(p.x, FLOOR_Y, p.z, p.yaw, WORLD_PER_METER, WORLD_PER_METER, WORLD_PER_METER)
      for (const part of this.shared.parts[p.kind] ?? []) {
        if (part.mat === 'board') {
          boards.push(matrix)
          continue
        }
        const color =
          part.mat === 'kiosk' ? KIOSK_COLORS[(p.tint ?? 0) % KIOSK_COLORS.length] : (PROP_COLORS[part.mat] ?? 0xffffff)
        ;(p.kind === 'light' ? lamps : UNLIT.has(part.mat) ? unlit : lit).push({ geo: part.geo, matrix, color })
      }
    }
    const own = <T extends THREE.Material>(m: T) => {
      this.owned.mats.push(m)
      this.propMats.push(m)
      return m
    }
    this.bakedMesh(lit, own(new THREE.MeshLambertMaterial({ vertexColors: true })), this.props, 'props-lit')
    this.bakedMesh(unlit, own(new THREE.MeshBasicMaterial({ vertexColors: true })), this.props, 'props-unlit')
    // Ceiling lamps hang from the roof, so they leave with it in the cutaway.
    const lampM = new THREE.MeshBasicMaterial({ vertexColors: true })
    this.owned.mats.push(lampM)
    this.roofMats.push(lampM)
    this.bakedMesh(lamps, lampM, this.roof, 'roof-lamps')
    const board = this.shared.parts.board?.find((x) => x.mat === 'board')
    if (board && boards.length) {
      const m = instanced(board.geo, own(this.shared.palette.board.clone()), boards)
      m.name = 'props-boards'
      this.props.add(m)
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
      const wb = mk(g.body, 'body', zero, w.map((x) => (x.staff ? STAFF_COLOR : PAX_COLORS[x.tint % PAX_COLORS.length])))
      const wh = mk(g.head, 'head', zero, w.map((_, i) => SKIN_COLORS[(i * 3) % SKIN_COLORS.length]))
      const bags = w.filter((x) => x.bag)
      const wl = mk(g.bag, 'bag', bags.map(() => trs(0, -10, 0)), bags.map((_, i) => BAG_COLORS[i % BAG_COLORS.length]))
      for (const m of [wb, wh, wl]) m.frustumCulled = false
      this.walkers = [wb, wh, wl]
      this.stepWalkers(0)
    }
  }

  private stepWalkers(t: number) {
    if (!this.walkers.length) return
    const [wb, wh, wl] = this.walkers
    let bi = 0
    this.plan.walkers.forEach((w, i) => {
      const p = walkerAt(w, t)
      const bob = Math.abs(Math.sin(t * 7 * w.speed + i)) * m(0.04)
      setTrs(wb, i, p.x, FLOOR_Y + bob, p.z, p.yaw, PERSON_SCALE, PERSON_SCALE)
      setTrs(wh, i, p.x, FLOOR_Y + bob, p.z, p.yaw, PERSON_SCALE, PERSON_SCALE)
      if (w.bag) {
        // Case trails behind and to the right of the walker.
        const back = 0.32 * PERSON_SCALE
        const side = 0.16 * PERSON_SCALE
        const sx = Math.sin(p.yaw)
        const sz = Math.cos(p.yaw)
        setTrs(wl, bi++, p.x - sx * back + sz * side, FLOOR_Y, p.z - sz * back - sx * side, p.yaw, PERSON_SCALE, PERSON_SCALE)
      }
    })
    for (const m of this.walkers) m.instanceMatrix.needsUpdate = true
  }

  /**
   * Per frame: LOD pick from camera distance, fades, walkers, night glow.
   * `enclosed` is the airport view: the roof stays on and the walls stay up.
   */
  update(
    camPos: THREE.Vector3,
    dt: number,
    lodScale: number,
    night: number,
    focus?: { x: number; z: number },
    enclosed = false,
  ) {
    const dist = Math.max(0, camPos.distanceTo(this.center) - this.radius * 0.5)
    this.lod = pickLod(this.lod, dist, TERMINAL_LOD.map((t) => t * lodScale))
    const close = this.lod === 0 && dist < ROOF_CUTAWAY * lodScale
    // Hall view only: close and above the roof lifts it off. Airport view stays enclosed.
    const cut = !enclosed && close && camPos.y > ROOF_Y + m(1.5)
    this.nearCut = !enclosed && close
    this.roofFade = stepFade(this.roofFade, cut ? 0 : 1, dt, 1.1)
    applyFade(this.roof, this.roofMats, this.roofFade)
    // Lift as it fades so the cutaway reads as the roof coming off, not blinking out.
    const lift = 1 - this.roofFade
    this.roof.position.y = lift * lift * m(4)
    this.skyMat.opacity = 0.18 * this.roofFade
    this.propFade = stepFade(this.propFade, this.lod <= 1 ? 1 : 0, dt, 3)
    this.lifeFade = stepFade(this.lifeFade, this.lod === 0 ? 1 : 0, dt, 3)
    applyFade(this.props, this.propMats, this.propFade)
    applyFade(this.props, this.wallMats, this.propFade)
    if (this.glassWallMat) this.glassWallMat.opacity = 0.4 * this.propFade
    if (this.propFade > 0) this.stepWalls(camPos, focus ?? { x: this.center.x, z: this.center.z }, dt)
    applyFade(this.life, this.lifeMats, this.lifeFade)
    this.time += dt
    if (this.lifeFade > 0) this.stepWalkers(this.time)
    this.floorMat.emissiveIntensity = night * 0.32
    // Curtain wall reads as lit rooms once the sun is down. Day stays at the clear 0.3.
    this.glassMat.opacity = 0.3 + night * 0.22
    this.glassMat.emissiveIntensity = night * 1.05
    this.skyMat.emissiveIntensity = night * 0.25
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
    for (const g of this.owned.geos) g.dispose()
    for (const m of this.owned.mats) m.dispose()
    this.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose()
    })
    this.root.removeFromParent()
  }
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

interface WallInst {
  x: number
  z: number
  len: number
  alongX: boolean
  full: number
  header: boolean
  /** Current animated height. */
  h: number
}

/** Terrazzo floor tinted per room, runs merged per row, darker thresholds at doorways. */
export function roomFloorGeometry(rp: RoomPlan, y: number): THREE.BufferGeometry {
  const near = new Uint8Array(rp.w * rp.h)
  for (const e of rp.doorEdges) {
    const s = e >> 1
    near[s] = 1
    near[s + ((e & 1) === 0 ? 1 : rp.w)] = 1
  }
  const colorOf = (s: number) => (near[s] ? THRESHOLD : ROOM_FLOOR[rp.rooms[rp.grid[s]].kind])
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
      if (rp.grid[s] < 0) {
        i++
        continue
      }
      const hex = colorOf(s)
      let i1 = i + 1
      while (i1 < rp.w && rp.grid[j * rp.w + i1] >= 0 && colorOf(j * rp.w + i1) === hex) i1++
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
