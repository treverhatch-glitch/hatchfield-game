/**
 * Round E service-vehicle models. One builder per vehicle model, real sizes in
 * metres (+X forward, +Y up, Z across, ground at y = 0, centred on the footprint).
 *
 * A builder emits coloured primitives tagged with a part name. Static parts
 * merge into one shell per model; named parts ("boom", "belt", "scissor"...)
 * stay separate so Round B can pose them. Emissive parts (lights, beacons,
 * light bars) are tagged `lit` and drawn unlit so they read as glowing.
 */
import * as THREE from 'three'
import { FULL_DETAIL_DIST } from './viewBudget'
import { PROP_LOOK } from './look'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export type VehicleModel =
  | 'fuel_tanker'
  | 'hydrant_cart'
  | 'baggage_train'
  | 'baggage_cart'
  | 'belt_loader'
  | 'catering_hilift'
  | 'arff'
  | 'deice'
  | 'apron_bus'
  | 'coach'
  | 'box_truck'
  | 'van'
  | 'towbar_tug'
  | 'towbarless_tug'
  | 'gpu'
  | 'stairs'
  | 'k_loader'
  | 'uld_dolly'
  | 'lavatory_truck'
  | 'water_truck'
  | 'police'

/** Sim / render kind -> model. Unknown kinds draw as a van. */
export function vehicleModel(kind: string): VehicleModel {
  switch (kind) {
    case 'fuel':
    case 'fuel_truck':
    case 'heavy_fuel_truck':
      return 'fuel_tanker'
    case 'hydrant':
    case 'hydrant_cart':
    case 'hydrant_dispenser':
      return 'hydrant_cart'
    case 'bags':
    case 'baggage_tug':
    case 'heavy_baggage_tug':
      return 'baggage_train'
    case 'cart':
      return 'baggage_cart'
    case 'belt_loader':
      return 'belt_loader'
    case 'catering':
    case 'catering_truck':
    case 'highlift_catering':
      return 'catering_hilift'
    case 'fire':
    case 'arff':
      return 'arff'
    case 'deice':
      return 'deice'
    case 'termbus':
    case 'pax_bus':
      return 'apron_bus'
    case 'coach':
      return 'coach'
    case 'citycargo':
      return 'box_truck'
    case 'tow':
      return 'towbar_tug'
    case 'pushback_tug':
    case 'heavy_tug':
      return 'towbarless_tug'
    case 'gpu':
      return 'gpu'
    case 'stairs':
      return 'stairs'
    case 'cargo':
    case 'uld_loader':
    case 'main_deck_loader':
      return 'k_loader'
    case 'dolly':
    case 'uld_dolly':
      return 'uld_dolly'
    case 'lav':
    case 'lavatory':
    case 'lavatory_truck':
      return 'lavatory_truck'
    case 'water':
    case 'potable':
    case 'water_truck':
    case 'potable_water':
      return 'water_truck'
    case 'police':
      return 'police'
    default:
      return 'van'
  }
}

/** Overall length, height, width in metres per model (Round A targets). */
export const MODEL_SIZE: Record<VehicleModel, readonly [number, number, number]> = {
  fuel_tanker: [10, 3.2, 2.5],
  hydrant_cart: [6.2, 2.5, 2.4],
  baggage_train: [9.6, 1.9, 1.6],
  baggage_cart: [3.0, 1.7, 1.55],
  belt_loader: [7.6, 2.4, 2.1],
  catering_hilift: [8.6, 3.7, 2.5],
  arff: [12, 3.6, 3],
  deice: [9.2, 3.5, 2.5],
  apron_bus: [14, 3.1, 3],
  coach: [12.4, 3.6, 2.55],
  box_truck: [8.5, 3.4, 2.5],
  van: [6, 2.6, 2.1],
  towbar_tug: [6, 1.6, 2.5],
  towbarless_tug: [7.8, 1.7, 3.2],
  gpu: [3.4, 1.7, 1.6],
  stairs: [7.4, 3.6, 2.4],
  k_loader: [9, 2.5, 3.4],
  uld_dolly: [3.4, 0.75, 1.9],
  lavatory_truck: [7.2, 2.8, 2.3],
  water_truck: [7.0, 2.7, 2.3],
  police: [4.9, 1.65, 1.85],
}

/** Neutral GSE livery; the caller's colour is the airport accent tint. */
export const LIVERY = {
  white: '#eef0ee',
  gseYellow: '#f2bf1f',
  arffRed: '#c8231e',
  black: '#17191b',
  tyre: '#1c1e21',
  hub: '#a7aeb5',
  chassis: '#2b3035',
  steel: '#7d868f',
  diamond: '#9aa1a8',
  glass: '#1f3340',
  rubber: '#26292d',
  hose: '#1e2226',
  // Lit (unlit-shaded) parts
  head: '#fff6d8',
  reverse: '#f4f8ff',
  tail: '#e0281e',
  amber: '#ffa514',
  blue: '#2a6cff',
} as const

/**
 * Surface texture per vertex (Round C). The vehicle shader picks a detail map by
 * this id: paint and panels modulate the vertex colour, chevrons and the belt
 * replace it.
 */
export const TEX = { none: 0, paint: 1, panel: 2, plate: 3, chevron: 4, belt: 5, livery: 6 } as const
/**
 * Cells across the shared side-livery atlas, left to right.
 * 0–4 stay the turnaround set. 5–15 are the rest of the ground fleet.
 */
export const LIVERY_CELL = {
  fuel: 0,
  catering: 1,
  ground: 2,
  tug: 3,
  shuttle: 4,
  lav: 5,
  water: 6,
  power: 7,
  stairs: 8,
  bags: 9,
  dolly: 10,
  loader: 11,
  deice: 12,
  fire: 13,
  police: 14,
  clean: 15,
} as const
export const LIVERY_CELLS = 16
/**
 * One cell is a landscape banner (see scripts/apron_livery.py).
 * Placards are scaled to this aspect so the brand is not stretched or cropped.
 */
export const LIVERY_CELL_ASPECT = 1024 / 280
/** Full vehicle mesh inside the play orbit. The cheap shell is only past this. */
export const VEHICLE_LOD_M = FULL_DETAIL_DIST
export type TexId = (typeof TEX)[keyof typeof TEX]

function autoTex(hex: string, lit: boolean): TexId {
  if (lit) return TEX.none
  switch (hex) {
    case LIVERY.gseYellow:
    case LIVERY.arffRed:
    case '#a81c18':
      return TEX.paint
    case LIVERY.white:
      return TEX.panel
    case LIVERY.diamond:
    case LIVERY.steel:
      return TEX.plate
    case LIVERY.rubber:
      return TEX.belt
    default:
      return TEX.none
  }
}

const _n = new THREE.Vector3()
const _ab = new THREE.Vector3()
const _cb = new THREE.Vector3()

/** Box-projected UVs in metres (one unit = 1 m), plus the texture id attribute. */
function surface(geo: THREE.BufferGeometry, tex: TexId) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const n = pos.count
  const uv = new Float32Array(n * 2)
  const tid = new Float32Array(n).fill(tex)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i + 2 < n; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    _cb.subVectors(c, b)
    _ab.subVectors(a, b)
    _n.crossVectors(_cb, _ab)
    const ax = Math.abs(_n.x)
    const ay = Math.abs(_n.y)
    const az = Math.abs(_n.z)
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c
      const o = (i + k) * 2
      if (ay >= ax && ay >= az) {
        uv[o] = v.x
        uv[o + 1] = v.z
      } else if (ax >= az) {
        uv[o] = v.z
        uv[o + 1] = v.y
      } else {
        uv[o] = v.x
        uv[o + 1] = v.y
      }
    }
  }
  geo.setAttribute('uvm', new THREE.BufferAttribute(uv, 2))
  geo.setAttribute('tid', new THREE.BufferAttribute(tid, 1))
}

export interface VPart {
  /** '' = static shell. Anything else is a named moving part for Round B. */
  name: string
  lit: boolean
  geo: THREE.BufferGeometry
}

/** Named moving parts each model exposes, for Round B rigs and tests. */
export const MODEL_PARTS: Record<VehicleModel, readonly string[]> = {
  fuel_tanker: ['wheels_front', 'wheels_rear', 'wheels_rear_2', 'beacon', 'hose_reel', 'hose', 'grounding', 'reverse', 'beam'],
  hydrant_cart: ['wheels_front', 'wheels_rear', 'beacon', 'lift_platform', 'hose_reel', 'hose', 'reverse', 'beam'],
  baggage_train: ['wheels_front', 'wheels_rear', 'beacon', 'cart_1', 'cart_2', 'beam'],
  baggage_cart: ['wheels_front', 'wheels_rear', 'curtain'],
  belt_loader: ['wheels_front', 'wheels_rear', 'beacon', 'belt', 'belt_bags', 'reverse'],
  catering_hilift: ['wheels_front', 'wheels_rear', 'beacon', 'scissor', 'box', 'deck', 'reverse', 'beam'],
  arff: ['wheels_front', 'wheels_rear', 'wheels_rear_2', 'lightbar', 'roof_turret', 'bumper_turret', 'locker_doors', 'foam', 'reverse', 'beam'],
  deice: ['wheels_front', 'wheels_rear', 'beacon', 'boom', 'basket', 'spray', 'reverse', 'beam'],
  apron_bus: ['wheels_front', 'wheels_rear', 'beacon', 'doors', 'reverse', 'beam'],
  coach: ['wheels_front', 'wheels_rear', 'doors', 'reverse', 'beam'],
  box_truck: ['wheels_front', 'wheels_rear', 'rollup_door', 'tail_lift', 'reverse', 'beam'],
  van: ['wheels_front', 'wheels_rear', 'beacon', 'reverse', 'beam'],
  towbar_tug: ['wheels_front', 'wheels_rear', 'beacon', 'towbar', 'reverse', 'beam'],
  towbarless_tug: ['wheels_front', 'wheels_rear', 'beacon', 'cradle', 'beam'],
  gpu: ['wheels_front', 'wheels_rear', 'cable_reel', 'cable'],
  stairs: ['wheels_front', 'wheels_rear', 'beacon', 'stair', 'canopy', 'reverse', 'beam'],
  k_loader: ['wheels_front', 'wheels_front_2', 'wheels_rear', 'wheels_rear_2', 'beacon', 'front_platform', 'rear_platform', 'reverse'],
  uld_dolly: ['wheels_front', 'wheels_rear', 'rollers', 'cargo'],
  lavatory_truck: ['wheels_front', 'wheels_rear', 'beacon', 'hose_reel', 'hose', 'reverse', 'beam'],
  water_truck: ['wheels_front', 'wheels_rear', 'beacon', 'hose_reel', 'hose', 'reverse', 'beam'],
  police: ['wheels_front', 'wheels_rear', 'lightbar', 'reverse', 'beam'],
}

const _c = new THREE.Color()

class Kit {
  readonly parts: VPart[] = []
  readonly accent: string
  constructor(accent: string) {
    this.accent = accent
  }

  /** Overrides the automatic texture pick for the next add() calls while set. */
  tex: TexId | null = null
  private axleAt = new Map<string, number>()

  add(geo: THREE.BufferGeometry, hex: string, x: number, y: number, z: number, name = '', lit = false, lay?: 'x' | 'z') {
    if (lay === 'z') geo.rotateX(Math.PI / 2)
    else if (lay === 'x') geo.rotateZ(Math.PI / 2)
    geo.translate(x, y, z)
    const flat = geo.index ? geo.toNonIndexed() : geo
    if (flat !== geo) geo.dispose()
    flat.deleteAttribute('uv')
    const n = flat.getAttribute('position').count
    const colors = new Float32Array(n * 3)
    _c.set(hex)
    for (let i = 0; i < n; i++) {
      colors[i * 3] = _c.r
      colors[i * 3 + 1] = _c.g
      colors[i * 3 + 2] = _c.b
    }
    flat.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    surface(flat, this.tex ?? autoTex(hex, lit))
    this.parts.push({ name, lit, geo: flat })
  }

  /** Boxes over ~25 cm get bevelled edges so panels catch a highlight instead of a hard CG corner. */
  box(hex: string, w: number, h: number, d: number, x: number, y: number, z: number, name = '', lit = false) {
    const m = Math.min(w, h, d)
    if (m < 0.25 || lit) this.add(new THREE.BoxGeometry(w, h, d), hex, x, y, z, name, lit)
    else this.rbox(hex, w, h, d, x, y, z, Math.min(0.08, m * 0.12), name)
  }

  /** Rounded box with an explicit corner radius (cabs, hoods). */
  rbox(hex: string, w: number, h: number, d: number, x: number, y: number, z: number, radius: number, name = '') {
    const rad = Math.max(0.005, Math.min(radius, Math.min(w, h, d) * 0.49))
    this.add(new RoundedBoxGeometry(w, h, d, 2, rad), hex, x, y, z, name)
  }

  /** Headlight lens plus a soft forward light cone (part 'beam', drawn additive when lit). */
  head(w: number, h: number, d: number, x: number, y: number, z: number, _name = '', _lit = true) {
    this.box(LIVERY.head, w, h, d, x, y, z, '', true)
    const len = 5.5
    const cone = new THREE.ConeGeometry(0.95, len, 14, 1, true).rotateZ(Math.PI / 2)
    cone.rotateZ(-0.06) // dipped beam: aim slightly down
    this.add(cone, '#fff1c4', x + w / 2 + len / 2, y - 0.2, z, 'beam', true)
  }

  /** Box rotated about Z (pitch), for booms, belts and stairs. */
  slab(hex: string, w: number, h: number, d: number, x: number, y: number, z: number, pitch: number, name = '') {
    const g = new THREE.BoxGeometry(w, h, d)
    g.rotateZ(pitch)
    this.add(g, hex, x, y, z, name)
  }

  cyl(hex: string, r: number, len: number, x: number, y: number, z: number, lay: 'x' | 'z' | undefined, name = '', seg = 12, lit = false) {
    this.add(new THREE.CylinderGeometry(r, r, len, seg), hex, x, y, z, name, lit, lay)
  }

  /** Start point of each hanging hose / cable (the reel end), by part name. */
  readonly anchors = new Map<string, readonly [number, number, number]>()

  /**
   * Round F: a hose or cable hanging between the truck (x, y, z) and a point
   * `len` metres out along +Z and `rise` metres up, sagging `sag` metres as a
   * catenary. Built as one tube so it still scales with the pay-out pose.
   */
  sagLine(hex: string, r: number, x: number, y: number, z: number, len: number, rise: number, sag: number, name: string, seg = 6) {
    const pts = catenaryPoints(len, rise, sag, 16).map(([dz, dy]) => new THREE.Vector3(0, dy, dz))
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, seg, false)
    this.add(geo, hex, x, y, z, name)
    if (!this.anchors.has(name)) this.anchors.set(name, [x, y, z])
  }

  /** One axle: two tyres, hubs and a tread ring. Doubles for rear truck axles. */
  axle(x: number, r: number, W: number, name: string, dual = false, inset = 0.06) {
    // Each wheel axle is its own part so it can spin about its own centre.
    if (name.startsWith('wheels')) {
      const prev = this.axleAt.get(name)
      if (prev !== undefined && Math.abs(prev - x) > 1e-6) name = `${name}_2`
      this.axleAt.set(name, x)
    }
    const tw = r * 0.62
    for (const s of [1, -1]) {
      const z = s * (W / 2 - tw / 2 - inset)
      this.cyl(LIVERY.tyre, r * 0.94, tw, x, r, z, 'z', name, 18)
      // tread: raised lugs round the crown, alternating offset so it reads as a block pattern
      const lugs = Math.max(12, Math.round(r * 40))
      for (let j = 0; j < lugs; j++) {
        const a = (j / lugs) * Math.PI * 2
        const lug = new THREE.BoxGeometry(r * 0.1, (Math.PI * 2 * r) / lugs * 0.55, tw * 0.46)
        lug.translate(r * 0.95, 0, (j % 2 ? 0.25 : -0.25) * tw).rotateZ(a)
        this.add(lug, LIVERY.tyre, x, r, z, name)
      }
      // wheel arch: dark half-ring flare above the tyre (static shell)
      const arch = new THREE.TorusGeometry(r * 1.14, 0.06, 5, 14, Math.PI)
      this.add(arch, LIVERY.black, x, r, s * (W / 2 + 0.01))
      this.add(new THREE.TorusGeometry(r * 1.14, 0.06, 5, 14, Math.PI), LIVERY.black, x, r, s * (W / 2 - tw - inset))
      this.cyl(LIVERY.hub, r * 0.52, tw * 1.04, x, r, z, 'z', name, 10)
      this.cyl(LIVERY.chassis, r * 0.18, tw * 1.1, x, r, z, 'z', name, 6)
      if (dual) this.cyl(LIVERY.tyre, r, tw * 0.9, x, r, z - s * tw * 0.98, 'z', name, 14)
      // hub spokes so a spinning wheel reads
      for (const rot of [0, Math.PI / 2]) {
        const g = new THREE.BoxGeometry(r * 0.95, r * 0.12, tw * 1.08).rotateZ(rot)
        this.add(g, LIVERY.chassis, x, r, z, name)
      }
    }
    this.box(LIVERY.chassis, 0.14, 0.14, W - tw * 2, x, r, 0, name)
  }

  /**
   * Forward-control truck cab at the +X end. Returns the cab rear X.
   * `rake` leans the windscreen back (radians) and adds a short hood so the
   * nose reads as a truck instead of a stack of boxes. Cab rear X is unchanged.
   */
  cab(L: number, W: number, base: number, h: number, len: number, hex: string, opts: { beacon?: boolean; part?: string; rake?: number } = {}) {
    const shell = opts.part ?? ''
    const x0 = L / 2 - len / 2
    const top = base + h
    this.rbox(hex, len, h * 0.5, W, x0, base + h * 0.25, 0, Math.min(0.22, h * 0.1), shell) // lower cab, rounded corners
    this.rbox(hex, len * 0.9, h * 0.14, W * 0.98, x0 - len * 0.05, top - h * 0.07, 0, h * 0.07, shell) // domed roof
    // glazing band with pillars
    const gy = base + h * 0.7
    const gh = h * 0.38
    const rake = opts.rake ?? 0
    if (rake > 0.05) {
      const screen = new THREE.BoxGeometry(0.05, gh * 1.05, W * 0.84)
      screen.rotateZ(-rake)
      this.add(screen, LIVERY.glass, L / 2 - len * 0.16, gy - 0.04, 0, shell)
      this.rbox(hex, len * 0.4, h * 0.2, W * 0.94, L / 2 - len * 0.18, base + h * 0.14, 0, Math.min(0.08, h * 0.08), shell)
      this.box(LIVERY.black, len * 0.42, 0.05, W * 0.7, L / 2 - len * 0.22, gy + gh * 0.42, 0, shell) // sun visor
    } else {
      this.box(LIVERY.glass, 0.05, gh, W * 0.86, L / 2 - 0.02, gy, 0, shell)
    }
    this.box(LIVERY.glass, len * 0.72, gh, W * 1.005, x0 + len * 0.04, gy, 0, shell)
    for (const s of [1, -1]) {
      this.box(hex, 0.09, gh, 0.09, L / 2 - 0.04, gy, s * (W / 2 - 0.05), shell) // A pillar
      this.box(hex, 0.12, gh, W * 1.01, x0 - len * 0.34, gy, 0, shell) // B pillar band
      // mirror arm + head
      this.box(LIVERY.black, 0.05, 0.05, 0.28, L / 2 - 0.2, gy + gh * 0.2, s * (W / 2 + 0.14), shell)
      this.box(LIVERY.black, 0.07, 0.36, 0.18, L / 2 - 0.2, gy, s * (W / 2 + 0.3), shell)
      // headlights + indicators stay on the shell so the beam part is unchanged
      this.head(0.04, 0.16, 0.34, L / 2 + 0.01, base + 0.32, s * (W / 2 - 0.3), '', true)
      this.box(LIVERY.amber, 0.04, 0.1, 0.14, L / 2 + 0.01, base + 0.32, s * (W / 2 - 0.08), '', true)
    }
    this.box(LIVERY.black, 0.08, 0.26, W * 1.02, L / 2 + 0.02, base + 0.08, 0, shell) // bumper
    this.box(LIVERY.chassis, 0.03, h * 0.16, W * 0.5, L / 2 + 0.01, base + h * 0.42, 0, shell) // grille
    if (opts.beacon !== false) this.beacon(x0 - len * 0.1, top + 0.02)
    return L / 2 - len
  }

  beacon(x: number, y: number, z = 0, name = 'beacon') {
    this.cyl(LIVERY.black, 0.1, 0.05, x, y + 0.025, z, undefined, name, 10)
    // Dim dome plus a bright reflector half: rotating it reads as a sweeping beam.
    this.cyl('#7a4a08', 0.08, 0.16, x, y + 0.13, z, undefined, name, 10, true)
    this.add(new THREE.CylinderGeometry(0.085, 0.085, 0.17, 10, 1, false, 0, Math.PI * 0.8), LIVERY.amber, x, y + 0.13, z, name, true)
  }

  tail(x: number, y: number, W: number) {
    for (const s of [1, -1]) {
      this.box(LIVERY.tail, 0.04, 0.16, 0.24, x - 0.01, y, s * (W / 2 - 0.2), '', true)
      this.box(LIVERY.amber, 0.04, 0.1, 0.12, x - 0.01, y + 0.15, s * (W / 2 - 0.2), '', true)
      this.box(LIVERY.reverse, 0.045, 0.1, 0.14, x - 0.015, y, s * (W / 2 - 0.42), 'reverse', true)
    }
  }

  /** Yellow/black chevrons across the rear face at x (facing -X). */
  chevrons(x: number, y0: number, h: number, W: number, n = 6) {
    void n
    this.tex = TEX.chevron
    this.box(LIVERY.gseYellow, 0.03, h, W, x - 0.015, y0 + h / 2, 0)
    this.tex = null
  }

  /** Hazard stripe along both sides. */
  sideStripe(x: number, len: number, y: number, W: number, hex = this.accent, h = 0.14, name = '') {
    this.box(hex, len, h, W + 0.02, x, y, 0, name)
  }

  /** Fleet number plate block on each door (reads as a dark tag). */
  fleetNo(x: number, y: number, W: number) {
    for (const s of [1, -1]) this.box(LIVERY.black, 0.4, 0.18, 0.02, x, y, s * (W / 2 + 0.012))
  }

  /**
   * Side sign from the shared livery atlas. The plane faces outward.
   * On the +Z side the nose (+X) is to the viewer's right, so U grows with X.
   * On the -Z side the nose is to the viewer's left, so U runs the other way.
   * `z` is how far outside the centreline the sign sits.
   */
  livery(cell: number, w: number, h: number, x: number, y: number, z: number, face: 1 | -1, name = '') {
    // Contain the whole cell inside the panel. A wide slot letterboxes; a tall slot pillars.
    let pw = Math.max(0.05, w)
    let ph = Math.max(0.05, h)
    if (pw / ph > LIVERY_CELL_ASPECT) pw = ph * LIVERY_CELL_ASPECT
    else ph = pw / LIVERY_CELL_ASPECT
    const g = new THREE.PlaneGeometry(pw, ph)
    if (face < 0) g.rotateY(Math.PI)
    this.tex = TEX.livery
    this.add(g, '#f4f5f6', x, y, face * Math.abs(z), name)
    this.tex = null
    const part = this.parts[this.parts.length - 1]!
    const pos = part.geo.getAttribute('position')
    const uv = part.geo.getAttribute('uvm') as THREE.BufferAttribute
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i)
      const py = pos.getY(i)
      if (px < x0) x0 = px
      if (px > x1) x1 = px
      if (py < y0) y0 = py
      if (py > y1) y1 = py
    }
    const dx = Math.max(1e-4, x1 - x0)
    const dy = Math.max(1e-4, y1 - y0)
    for (let i = 0; i < pos.count; i++) {
      let u = (pos.getX(i) - x0) / dx
      const v = (pos.getY(i) - y0) / dy
      if (face < 0) u = 1 - u
      uv.setXY(i, (cell + 0.02 + u * 0.96) / LIVERY_CELLS, 0.02 + v * 0.96)
    }
  }

  /** The same sign on both sides. */
  liveryBoth(cell: number, w: number, h: number, x: number, y: number, z: number, name = '') {
    this.livery(cell, w, h, x, y, z, 1, name)
    this.livery(cell, w, h, x, y, z, -1, name)
  }

  chassisRail(L: number, W: number, y: number, x = 0) {
    for (const s of [1, -1]) this.box(LIVERY.chassis, L, 0.22, 0.12, x, y, s * W * 0.32)
  }
}

/**
 * Points (along, up) of a cable hung between (0, 0) and (len, rise) that sags
 * `sag` metres below the straight chord at mid-span: y = a·cosh((u-m)/a) + c.
 */
export function catenaryPoints(len: number, rise: number, sag: number, n = 16): [number, number][] {
  const out: [number, number][] = []
  if (!(sag > 1e-4) || !(len > 1e-4)) {
    for (let i = 0; i <= n; i++) out.push([(len * i) / n, (rise * i) / n])
    return out
  }
  // a from the level-span sag: a(cosh(L/2a) - 1) = sag (bisection, monotone in a)
  let lo = 1e-3
  let hi = 1e4
  for (let i = 0; i < 60; i++) {
    const a = (lo + hi) / 2
    if (a * (Math.cosh(len / 2 / a) - 1) > sag) lo = a
    else hi = a
  }
  const a = (lo + hi) / 2
  const base = a * Math.cosh(len / 2 / a)
  for (let i = 0; i <= n; i++) {
    const u = (len * i) / n
    // level catenary plus the straight chord to the raised end
    out.push([u, a * Math.cosh((u - len / 2) / a) - base + (rise * u) / len])
  }
  return out
}

type Builder = (k: Kit, L: number, H: number, W: number) => void

const truckR = 0.5
/** Fuel hose length paid out at full extension, metres. */
export const HOSE_M = 5
/** GPU / lav / water service hose or cable paid out at full extension, metres. */
export const CABLE_M = 4
/** Fuel grounding cable length at full extension, metres. */
export const GROUND_M = 3.2
/** Fuel nozzle climbs to the under-wing coupling (18% span, 3.6-9 m out), metres above the reel outlet. */
export const FUEL_RISE = 0.5
/** GPU plug climbs to the lower-nose power socket (aircraft pass 5). */
export const GPU_RISE = 1.0
/** Lav / water couplings sit on the lower aft fuselage. */
export const SERVICE_RISE = 0.6
const gseR = 0.3

/** Metres of dark bay between the fuel cab's rear face and the tank nose. */
export const FUEL_REEL_BAY_M = 2.6
const FUEL_CAB_LEN_M = 2.3
const FUEL_TAIL_GAP_M = 0.28

/** Cab rear, tank capsule and hose-bay centre for the fuel tanker. Shared with the fill socket. */
export function fuelTankLayout(L: number, H: number, W: number) {
  const r = 0.5
  const cabRear = L / 2 - FUEL_CAB_LEN_M
  const reelBay = FUEL_REEL_BAY_M
  const tl = cabRear + L / 2 - FUEL_TAIL_GAP_M - reelBay
  const tx = -L / 2 + FUEL_TAIL_GAP_M + tl / 2
  const tr = Math.min(W * 0.46, (H - r - 0.4) / 2)
  const tankNose = tx + tl / 2
  return { r, cabRear, reelBay, tl, tx, tr, ty: r + 0.4 + tr, tankNose, reelX: tankNose + reelBay / 2 }
}

const BUILDERS: Record<VehicleModel, Builder> = {
  fuel_tanker(k, L, H, W) {
    const r = truckR
    k.axle(L * 0.33, r, W, 'wheels_front')
    k.axle(-L * 0.18, r, W, 'wheels_rear', true)
    k.axle(-L * 0.32, r, W, 'wheels_rear', true)
    k.chassisRail(L * 0.96, W, r + 0.15)
    const lay = fuelTankLayout(L, H, W)
    const { reelBay, tl, tx, tr, ty, tankNose, reelX } = lay
    k.cab(L, W, r + 0.2, 2.3, FUEL_CAB_LEN_M, LIVERY.white, { part: 'cab', rake: 0.42 })
    k.fleetNo(L / 2 - 1.1, r + 0.85, W)
    // Door placard. A box, not a Mesh with the arguments swapped.
    k.box('#b42318', 0.02, 0.22, 0.22, L / 2 - 1.15, r + 1.15, W / 2 + 0.02, 'cab')
    const reelY = r + 1.15
    const reelZ = W * 0.45 + 0.22
    k.add(new THREE.CapsuleGeometry(tr, tl - tr * 2, 6, 16).rotateZ(Math.PI / 2), LIVERY.white, tx, ty, 0, 'tank')
    for (const f of [-0.34, 0.02, 0.34]) {
      const band = new THREE.TorusGeometry(tr + 0.02, 0.028, 5, 20)
      band.rotateZ(Math.PI / 2)
      k.add(band, k.accent, tx + f * tl, ty, 0, 'tank')
    }
    k.liveryBoth(0, Math.min(tl * 0.42, 3.2), Math.min(tr * 0.85, 1.15), tx + tl * 0.06, ty, tr + 0.04, 'tank')
    k.sideStripe(tx, tl * 0.9, ty - tr * 0.35, tr * 2, k.accent, 0.18, 'tank')
    k.sideStripe(tx, tl * 0.9, ty + tr * 0.1, tr * 2, LIVERY.gseYellow, 0.08, 'tank')
    // Fenders over the tandem. The axle arches stay; these are the painted skirts.
    const fax = (-L * 0.18 - L * 0.32) / 2
    for (const s of [1, -1]) {
      k.box(LIVERY.white, 2.05, 0.2, 0.38, fax, r * 2 + 0.12, s * (W / 2 - 0.04), 'tank')
      // Front wheels sit under the cab. A white skirt here read as a second cab.
      k.box(LIVERY.chassis, 1.15, 0.16, 0.32, L * 0.33, r * 2 + 0.06, s * (W / 2 - 0.06), 'cab')
    }
    // top walkway + rail + manholes
    k.box(LIVERY.diamond, tl * 0.7, 0.05, 0.6, tx, ty + tr, 0, 'tank')
    for (const s of [1, -1]) k.box(LIVERY.steel, tl * 0.7, 0.04, 0.04, tx, ty + tr + 0.45, s * 0.3, 'tank')
    for (const f of [-0.25, 0, 0.25]) k.cyl(LIVERY.steel, 0.22, 0.08, tx + f * tl, ty + tr + 0.06, 0, undefined, 'tank')
    // Rear access ladder, clear of the tail cap. Rungs lie on Z (rotateX); rails stand on Y.
    const lx = -L / 2 + 0.12
    const lz = 0.82
    k.cyl(LIVERY.steel, 0.04, 2.55, lx, 1.85, lz - 0.18, undefined, 'tank', 8)
    k.cyl(LIVERY.steel, 0.04, 2.55, lx, 1.85, lz + 0.18, undefined, 'tank', 8)
    for (let i = 0; i < 8; i++) k.cyl(LIVERY.steel, 0.022, 0.4, lx, 0.7 + i * 0.3, lz, 'z', 'tank', 8)
    // Dark bay the full gap, so the white tank cannot read as a second cab.
    k.box(LIVERY.chassis, reelBay * 0.78, 1.55, W * 0.88, reelX, r + 0.95, 0)
    k.cyl(LIVERY.chassis, tr * 0.55, 0.12, tankNose - 0.02, ty, 0, 'x', 'tank')
    k.box('#2a3036', 1.05, 1.05, 0.06, reelX, r + 1.05, W * 0.38)
    k.box(LIVERY.chassis, 0.85, 0.62, 0.04, reelX, r + 1.05, W * 0.45 + 0.02)
    // Torus lies in XY (hole along Z) so the coil faces the side. Do not yaw it edge-on.
    k.add(new THREE.TorusGeometry(0.34, 0.06, 8, 18), LIVERY.gseYellow, reelX, reelY, reelZ, 'hose_reel')
    k.cyl(LIVERY.gseYellow, 0.22, 0.22, reelX, reelY, reelZ, 'z', 'hose_reel', 14)
    k.cyl(LIVERY.hose, 0.16, 0.24, reelX, reelY, reelZ, 'z', 'hose_reel', 12)
    // hose paid out sideways from the reel (Round B scales it along Z)
    k.sagLine(LIVERY.hose, 0.13, reelX, reelY - 0.2, reelZ, HOSE_M, FUEL_RISE, HOSE_M * 0.2, 'hose', 8)
    k.box(LIVERY.steel, 0.25, 0.2, 0.3, reelX, reelY - 0.2 + FUEL_RISE, reelZ + HOSE_M, 'hose') // nozzle
    k.cyl(LIVERY.black, 0.08, 0.18, reelX, reelY - 0.2 + FUEL_RISE, reelZ + HOSE_M + 0.12, 'z', 'hose', 8) // nozzle tip
    // grounding reel + cable to the landing gear (Round E scales along Z)
    const gx = reelX - 0.15
    k.cyl(LIVERY.gseYellow, 0.16, 0.22, gx, r + 0.55, W * 0.32, 'z')
    k.sagLine(LIVERY.black, 0.045, gx, r + 0.25, W / 2, GROUND_M, 0, 0.6, 'grounding', 5)
    k.box(LIVERY.steel, 0.18, 0.12, 0.22, gx, r + 0.25, W / 2 + GROUND_M, 'grounding') // alligator clamp
    // hi-vis reflective band on tank
    k.box(LIVERY.gseYellow, tl * 0.55, 0.12, tr * 2 + 0.02, tx, ty - tr * 0.55, 0, 'tank')
    k.box(LIVERY.black, tl * 0.55, 0.06, tr * 2 + 0.025, tx, ty - tr * 0.55 - 0.09, 0, 'tank')
    k.box(LIVERY.chassis, 1.8, 0.5, W * 1.0, tx, r + 0.25, 0)
    k.box(LIVERY.chassis, 0.1, 0.38, W * 0.78, -L / 2 + 0.16, r * 0.7, 0) // underride
    k.box('#b42318', 0.04, 0.32, 0.32, -L / 2 + 0.08, r + 1.15, 0) // rear placard
    k.chevrons(-L / 2, r * 0.4, 0.5, W)
    k.tail(-L / 2, r + 0.5, W)
  },

  hydrant_cart(k, L, H, W) {
    const r = 0.42
    k.axle(L * 0.3, r, W, 'wheels_front')
    k.axle(-L * 0.3, r, W, 'wheels_rear')
    k.chassisRail(L * 0.95, W, r + 0.1)
    const back = k.cab(L, W, r + 0.15, 1.9, 1.8, LIVERY.white)
    const dl = back + L / 2 - 0.2
    const dx = -L / 2 + dl / 2 + 0.1
    k.box(LIVERY.white, dl, 0.8, W * 0.98, dx, r + 0.65, 0)
    k.sideStripe(dx, dl, r + 0.4, W * 0.98)
    k.box(LIVERY.diamond, dl * 0.8, 0.08, W * 0.9, dx, r + 1.15, 0, 'lift_platform')
    for (const s of [1, -1]) k.box(LIVERY.gseYellow, dl * 0.8, 0.05, 0.05, dx, r + 2.0, s * W * 0.43, 'lift_platform')
    for (const s of [1, -1]) for (const f of [-0.4, 0.4]) k.box(LIVERY.gseYellow, 0.05, 0.85, 0.05, dx + f * dl * 0.8, r + 1.6, s * W * 0.43, 'lift_platform')
    k.cyl(LIVERY.gseYellow, 0.32, 0.4, dx - dl * 0.15, r + 1.45, 0, 'z', 'hose_reel')
    k.cyl(LIVERY.hose, 0.26, 0.42, dx - dl * 0.15, r + 1.45, 0, 'z', 'hose_reel')
    k.sagLine(LIVERY.hose, 0.13, dx - dl * 0.15, r + 0.5, W / 2, HOSE_M, 0, 0.35, 'hose', 8)
    k.box(LIVERY.steel, 0.3, 0.3, 0.3, dx - dl * 0.15, r + 0.5, W / 2 + HOSE_M, 'hose') // pit coupler
    k.chevrons(-L / 2, r * 0.5, 0.5, W)
    k.tail(-L / 2, r + 0.6, W)
    void H
  },

  baggage_train(k, L, H, W) {
    const r = gseR
    // tractor at the front (3 m), two carts behind
    const tL = 2.9
    const tx = L / 2 - tL / 2
    k.axle(tx + 0.85, r, W, 'wheels_front')
    k.axle(tx - 0.85, r, W, 'wheels_rear')
    k.rbox(LIVERY.gseYellow, tL, 0.55, W, tx, r + 0.2, 0, 0.08)
    k.rbox(LIVERY.gseYellow, 1.0, 0.45, W * 0.9, tx + 0.85, r + 0.68, 0, 0.1) // rounded hood
    k.cyl(LIVERY.black, 0.16, 0.04, tx + 0.55, r + 0.92, 0, 'z') // steering wheel
    k.box('#f7f3a8', tL * 0.7, 0.08, W + 0.02, tx, r + 0.48, 0) // hi-vis
    k.box(LIVERY.black, 0.1, 0.3, W * 1.02, L / 2, r + 0.05, 0)
    k.box(LIVERY.black, 0.5, 0.5, 0.5, tx - 0.4, r + 0.75, 0) // seat
    for (const s of [1, -1]) for (const f of [0.25, -1.1]) k.box(LIVERY.black, 0.06, 1.0, 0.06, tx + f, r + 1.0, s * (W / 2 - 0.08))
    k.box(LIVERY.gseYellow, 1.5, 0.06, W, tx - 0.42, H - 0.06, 0) // canopy
    k.liveryBoth(LIVERY_CELL.bags, 1.15, 0.34, tx - 0.15, r + 0.52, W / 2 + 0.04)
    k.box(LIVERY.glass, 0.04, 0.55, W * 0.85, tx + 0.28, r + 1.2, 0)
    k.beacon(tx - 0.42, H - 0.03)
    for (const s of [1, -1]) k.head(0.03, 0.12, 0.2, L / 2 + 0.01, r + 0.62, s * (W / 2 - 0.2), '', true)
    k.chevrons(tx - tL / 2, r - 0.05, 0.3, W, 4)
    const cL = 2.6
    for (const [i, name] of [[0, 'cart_1'], [1, 'cart_2']] as const) {
      const cx = tx - tL / 2 - 0.35 - cL / 2 - i * (cL + 0.35)
      cart(k, cx, cL, W * 0.96, H - 0.15, name)
      k.box(LIVERY.steel, 0.35, 0.05, 0.05, cx + cL / 2 + 0.17, r, 0, name) // drawbar
    }
  },

  baggage_cart(k, L, H, W) {
    cart(k, 0, L, W, H, '')
    k.liveryBoth(LIVERY_CELL.bags, 1.25, 0.36, 0, 0.95, W / 2 + 0.03)
  },

  belt_loader(k, L, H, W) {
    const r = gseR
    k.axle(L * 0.3, r, W, 'wheels_front')
    k.axle(-L * 0.3, r, W, 'wheels_rear')
    k.rbox(LIVERY.white, L * 0.9, 0.5, W, 0, r + 0.15, 0, 0.06)
    k.sideStripe(0, L * 0.9, r + 0.1, W, LIVERY.black, 0.08)
    // hi-vis reflective tape along chassis
    k.box('#f7f3a8', L * 0.7, 0.08, W + 0.03, 0, r + 0.42, 0)
    k.liveryBoth(2, 2.4, 0.85, L * 0.22, r + 0.55, W / 2 + 0.03)
    // rounded side cab at mid-left
    k.rbox(LIVERY.white, 1.4, 0.9, 0.9, -L * 0.05, r + 0.85, -W / 2 + 0.45, 0.1)
    k.box(LIVERY.glass, 1.2, 0.5, 0.92, -L * 0.05, r + 1.25, -W / 2 + 0.45)
    k.box(LIVERY.chassis, 0.05, 0.72, 0.46, -L * 0.05 + 0.62, r + 1.05, -W / 2 + 0.45) // cab door
    k.rbox(LIVERY.white, 1.5, 0.06, 1.0, -L * 0.05, r + 1.55, -W / 2 + 0.45, 0.03)
    k.beacon(-L * 0.05, r + 1.58, -W / 2 + 0.45)
    // inclined belt with side rails (rises to the front)
    const bl = L * 1.0
    const { pitch, by } = beltGeom(L, H)
    // hydraulic lift rams
    for (const f of [0.18, -0.12]) for (const s of [1, -1]) {
      k.cyl(LIVERY.steel, 0.06, 0.7, f * L, r + 0.65, W * 0.15 + s * 0.3, undefined, '', 8)
      k.cyl(LIVERY.chassis, 0.04, 0.45, f * L, r + 0.95, W * 0.15 + s * 0.3, undefined, '', 6)
    }
    // Open conveyor truss. The rubber belt stays on the same centre and pitch as beltGeom.
    for (const s of [1, -1]) k.slab(LIVERY.chassis, bl * 0.96, 0.1, 0.08, 0, by - 0.18, W * 0.15 + s * 0.34, pitch, 'belt')
    for (let i = 0; i < 6; i++) {
      const f = (i / 5 - 0.5) * bl * 0.84
      const rung = new THREE.BoxGeometry(0.07, 0.12, 0.64)
      rung.translate(f, -0.16, 0)
      rung.rotateZ(pitch)
      k.add(rung, LIVERY.chassis, 0, by, W * 0.15, 'belt')
    }
    k.slab(LIVERY.rubber, bl * 0.98, 0.12, 0.62, 0, by, W * 0.15, pitch, 'belt')
    k.box(LIVERY.diamond, 0.7, 0.06, 0.45, -L * 0.05, r + 0.48, -W / 2 + 0.2) // operator step
    // belt rollers along the boom (read as moving conveyor)
    for (let i = 0; i < 7; i++) {
      const f = (i / 6 - 0.5) * bl * 0.9
      const g = new THREE.CylinderGeometry(0.07, 0.07, 0.72, 8)
      g.rotateX(Math.PI / 2)
      g.translate(f, 0.05, 0)
      g.rotateZ(pitch)
      k.add(g, LIVERY.hub, 0, by, W * 0.15, 'belt')
    }
    for (const s of [1, -1]) k.slab(LIVERY.steel, bl * 0.98, 0.3, 0.08, 0, by + 0.12, W * 0.15 + s * 0.42, pitch, 'belt')
    // bags riding the belt (Round B slides them up the slope)
    const bagHex = ['#6a5340', '#2f4a6a', '#8c2f2f', '#3e5a3a', '#55595f']
    for (let i = 0; i < 5; i++) {
      const f = -0.38 + i * 0.2
      const g = new THREE.BoxGeometry(0.55, 0.38, 0.42)
      g.translate(f * bl, 0.28, 0)
      g.rotateZ(pitch)
      k.add(g, bagHex[i], 0, by, W * 0.15, 'belt_bags')
    }
    k.box(LIVERY.black, 0.08, 0.2, 0.9, L / 2 - 0.05, H - 0.12, W * 0.15, 'belt') // bumper pad
    k.chevrons(-L / 2 + L * 0.05, r - 0.1, 0.4, W, 4)
    k.tail(-L / 2 + L * 0.05, r + 0.35, W)
  },

  catering_hilift(k, L, H, W) {
    const r = 0.45
    k.axle(L * 0.33, r, W, 'wheels_front')
    k.axle(-L * 0.28, r, W, 'wheels_rear', true)
    k.chassisRail(L * 0.96, W, r + 0.12)
    const back = k.cab(L, W, r + 0.2, 2.2, 2.0, LIVERY.white, { rake: 0.3 })
    k.fleetNo(L / 2 - 1.0, r + 0.8, W)
    const bl = back + L / 2 - 0.15
    const bx = -L / 2 + bl / 2
    // scissor (stowed): crossed X beams + mid pins (Round E thicker, reads when rising)
    const sy = r + 0.55
    for (const s of [1, -1]) {
      k.slab(LIVERY.chassis, bl * 0.82, 0.14, 0.12, bx, sy, s * W * 0.38, 0.18, 'scissor')
      k.slab(LIVERY.chassis, bl * 0.82, 0.14, 0.12, bx, sy, s * W * 0.38, -0.18, 'scissor')
      k.slab(LIVERY.steel, bl * 0.7, 0.1, 0.08, bx, sy + 0.35, s * W * 0.38, 0.28, 'scissor')
      k.slab(LIVERY.steel, bl * 0.7, 0.1, 0.08, bx, sy + 0.35, s * W * 0.38, -0.28, 'scissor')
      k.cyl(LIVERY.gseYellow, 0.08, 0.14, bx, sy + 0.18, s * W * 0.38, 'z', 'scissor', 8)
    }
    k.box('#f7f3a8', bl * 0.9, 0.1, W + 0.03, bx, r + 0.45, 0) // hi-vis skirt
    const by0 = r + 0.75
    const bh = H - by0
    k.box(LIVERY.white, bl, bh, W, bx, by0 + bh / 2, 0, 'box')
    for (let i = 0; i < 5; i++) {
      const fx = bx - bl / 2 + (bl * (i + 0.5)) / 5
      k.box(LIVERY.steel, 0.045, bh * 0.9, W + 0.03, fx, by0 + bh / 2, 0, 'box')
    }
    k.liveryBoth(1, Math.min(bl * 0.55, 3.4), Math.min(bh * 0.42, 1.35), bx - bl * 0.08, by0 + bh * 0.62, W / 2 + 0.03, 'box')
    k.box(k.accent, bl * 1.002, 0.3, W * 1.005, bx, by0 + bh * 0.25, 0, 'box')
    k.rbox(LIVERY.white, bl * 0.96, 0.16, W * 0.92, bx, H - 0.02, 0, 0.06, 'box')
    k.box(LIVERY.steel, 0.4, 0.14, 0.3, bx + bl * 0.2, H + 0.06, 0, 'box') // roof vent
    k.box(LIVERY.steel, 0.06, bh * 0.82, W * 0.72, -L / 2 + 0.12, by0 + bh * 0.48, 0, 'box') // rear door
    k.box('#c5ccd2', 0.02, bh * 0.7, W * 0.55, -L / 2 + 0.16, by0 + bh * 0.5, 0, 'box')
    // front deck hinged at the box floor; Round B/C folds it up for driving
    const hx = back - 0.15
    k.box(LIVERY.diamond, 1.3, 0.1, W * 0.9, hx + 0.65, by0 + 0.05, 0, 'deck')
    k.box(LIVERY.gseYellow, 0.1, 0.14, W * 0.86, hx + 1.22, by0 + 0.14, 0, 'deck') // toe plate at the lip
    for (const s of [1, -1]) {
      k.box(LIVERY.gseYellow, 1.3, 0.05, 0.05, hx + 0.65, by0 + 1.05, s * W * 0.43, 'deck')
      for (const f of [0.15, 1.2]) k.box(LIVERY.gseYellow, 0.05, 1.0, 0.05, hx + f, by0 + 0.55, s * W * 0.43, 'deck')
    }
    k.chevrons(-L / 2 + 0.13, r * 0.3, 0.5, W)
    k.tail(-L / 2 + 0.13, r + 0.4, W)
  },

  arff(k, L, H, W) {
    const r = 0.62
    k.axle(L * 0.32, r, W, 'wheels_front')
    k.axle(-L * 0.12, r, W, 'wheels_rear')
    k.axle(-L * 0.32, r, W, 'wheels_rear')
    const red = LIVERY.arffRed
    const back = k.cab(L, W, r + 0.25, 2.4, 3.0, red, { beacon: false, rake: 0.18 })
    // wrap-around light bar on cab roof
    k.box(LIVERY.black, 0.4, 0.14, W * 0.85, L / 2 - 1.4, r + 2.73, 0)
    for (let i = 0; i < 6; i++) k.box(i % 2 ? LIVERY.blue : LIVERY.tail, 0.32, 0.12, W * 0.13, L / 2 - 1.4, r + 2.86, -W * 0.36 + i * W * 0.144, 'lightbar', true)
    const bl = back + L / 2 - 0.1
    const bx = -L / 2 + bl / 2 + 0.05
    k.box(red, bl, H - r - 0.3, W, bx, (H + r + 0.3) / 2, 0)
    k.sideStripe(bx, bl, r + 0.8, W, LIVERY.gseYellow, 0.18)
    k.sideStripe(L / 2 - 1.5, 3.0, r + 0.8, W, LIVERY.gseYellow, 0.18)
    k.liveryBoth(LIVERY_CELL.fire, 2.4, 0.68, bx, r + 2.15, W / 2 + 0.06)
    for (let i = 0; i < 4; i++) {
      const lx = bx - bl / 2 + bl * (i + 0.5) / 4
      for (const s of [1, -1]) k.box('#a81c18', bl / 4 - 0.12, 1.2, 0.03, lx, r + 1.6, s * (W / 2 + 0.01), 'locker_doors')
    }
    k.box(LIVERY.diamond, bl * 0.9, 0.06, W * 0.9, bx, H + 0.02, 0)
    for (const x of [L * 0.32, -L * 0.22]) {
      for (const s of [1, -1]) k.box(red, x > 0 ? 1.35 : 2.5, 0.2, 0.36, x, r * 2 + 0.08, s * (W / 2 - 0.02))
    }
    // roof monitor: slew ring and yoke stay on the (back+0.2) pivot; the barrel still ends at the foam socket
    k.cyl(LIVERY.steel, 0.46, 0.12, back + 0.2, H + 0.06, 0, undefined, 'roof_turret')
    k.cyl(LIVERY.steel, 0.26, 0.28, back + 0.2, H + 0.24, 0, undefined, 'roof_turret')
    k.box(LIVERY.steel, 0.22, 0.22, 0.4, back + 0.48, H + 0.4, 0, 'roof_turret')
    k.cyl(LIVERY.white, 0.09, 1.4, back + 0.9, H + 0.4, 0, 'x', 'roof_turret')
    spray(k, back + 1.6, H + 0.4, 0, '#eef6ff', 'foam')
    k.cyl(LIVERY.steel, 0.14, 0.2, L / 2 + 0.2, r + 0.45, 0, undefined, 'bumper_turret')
    k.cyl(LIVERY.white, 0.06, 0.6, L / 2 + 0.45, r + 0.55, 0, 'x', 'bumper_turret')
    for (const s of [1, -1]) k.beacon(-L / 2 + 0.3, H + 0.02, s * (W / 2 - 0.2), 'lightbar')
    k.box(LIVERY.diamond, 0.55, 0.08, W * 0.45, L / 2 + 0.06, r + 0.2, 0) // bumper step
    k.chevrons(-L / 2 + 0.05, r * 0.5, 0.6, W, 8)
    k.tail(-L / 2 + 0.05, r + 0.6, W)
  },

  deice(k, L, H, W) {
    const r = 0.5
    k.axle(L * 0.33, r, W, 'wheels_front')
    k.axle(-L * 0.25, r, W, 'wheels_rear', true)
    k.chassisRail(L * 0.96, W, r + 0.15)
    const back = k.cab(L, W, r + 0.2, 2.2, 2.1, LIVERY.white, { rake: 0.36 })
    const tl = (back + L / 2) * 0.6
    const tx = -L / 2 + tl / 2 + 0.1
    const tr = Math.min(W * 0.4, 0.72)
    const tankY = r + 0.55 + tr
    k.add(new THREE.CapsuleGeometry(tr, Math.max(0.3, tl - tr * 2), 4, 14).rotateZ(Math.PI / 2), LIVERY.white, tx, tankY, 0)
    k.box('#9ec4de', 0.03, tr * 0.55, 0.14, tx + tl * 0.15, tankY, tr + 0.02) // sight glass
    k.liveryBoth(LIVERY_CELL.deice, 2.15, 0.6, tx, tankY + tr * 0.15, tr + 0.04)
    k.sideStripe(tx, tl * 0.85, tankY - tr * 0.35, tr * 2, k.accent, 0.16)
    k.sideStripe(tx, tl * 0.85, tankY + tr * 0.05, tr * 2, '#3fa8d6', 0.08)
    // turntable + telescoping boom stowed forward. Centres match the unfold pivot (1.9, 1.65).
    const px = back - 0.6
    k.cyl(LIVERY.steel, 0.62, 0.12, px, r + 0.42, 0, undefined, 'boom')
    k.cyl(LIVERY.steel, 0.48, 0.22, px, r + 0.58, 0, undefined, 'boom')
    k.box(LIVERY.gseYellow, 0.7, 0.85, 0.7, px, r + 1.15, 0, 'boom')
    k.cyl(LIVERY.gseYellow, 0.15, 4.6, px - 0.6, H - 0.55, 0, 'x', 'boom', 10)
    k.cyl(LIVERY.steel, 0.18, 0.36, px + 1.1, H - 0.38, 0, 'z', 'boom', 10)
    k.cyl(LIVERY.gseYellow, 0.1, 3.6, px + 1.1, H - 0.2, 0, 'x', 'boom', 10)
    const bx = L / 2 - 0.6
    const by = H - 0.4
    k.box(LIVERY.steel, 1.0, 0.08, 1.05, bx, by - 0.36, 0, 'basket')
    k.box(LIVERY.glass, 0.9, 0.32, 0.9, bx, by - 0.08, 0, 'basket')
    for (const s of [1, -1]) {
      k.box(LIVERY.gseYellow, 1.0, 0.04, 0.04, bx, by + 0.28, s * 0.48, 'basket')
      k.box(LIVERY.gseYellow, 0.04, 0.04, 1.0, bx - 0.48, by + 0.28, s * 0.02, 'basket')
      k.box(LIVERY.gseYellow, 0.04, 0.68, 0.04, bx - 0.46, by - 0.02, s * 0.48, 'basket')
      k.box(LIVERY.gseYellow, 0.04, 0.68, 0.04, bx + 0.46, by - 0.02, s * 0.48, 'basket')
    }
    k.box(LIVERY.chassis, 0.1, 0.1, 0.45, L / 2 - 0.12, H - 0.65, 0, 'basket') // nozzle
    spray(k, L / 2, H - 0.65, 0, '#e9b54a', 'spray') // type I glycol is orange
    k.chevrons(-L / 2 + 0.1, r * 0.4, 0.5, W)
    k.tail(-L / 2 + 0.1, r + 0.5, W)
  },

  apron_bus(k, L, H, W) {
    const r = 0.42
    k.axle(L * 0.36, r, W, 'wheels_front', false, 0.02)
    k.axle(-L * 0.36, r, W, 'wheels_rear', false, 0.02)
    const fl = 0.35
    const bh = H - fl
    k.rbox(LIVERY.white, L * 0.98, bh, W * 0.96, 0, fl + bh / 2, 0, 0.36)
    k.box(LIVERY.chassis, L * 1.002, 0.3, W * 1.004, 0, fl + 0.15, 0) // skirt
    k.box(LIVERY.glass, L * 0.94, bh * 0.52, W * 1.008, 0, fl + bh * 0.6, 0) // panoramic glazing
    for (let i = -6; i <= 6; i++) k.box(LIVERY.white, 0.1, bh * 0.52, W * 1.01, (i * L) / 14, fl + bh * 0.6, 0)
    const nose = new THREE.BoxGeometry(0.05, bh * 0.62, W * 0.82)
    nose.rotateZ(-0.22)
    k.add(nose, LIVERY.glass, L / 2 - 0.2, fl + bh * 0.5, 0)
    k.box('#14181c', 0.04, 0.28, W * 0.48, L / 2 + 0.02, fl + bh * 0.8, 0) // destination
    k.box('#f3e7a2', 0.02, 0.14, W * 0.34, L / 2 + 0.045, fl + bh * 0.8, 0)
    k.box(LIVERY.glass, 0.04, bh * 0.55, W * 0.8, -L / 2 - 0.01, fl + bh * 0.48, 0)
    k.box(k.accent, L * 1.002, 0.25, W * 1.01, 0, fl + bh * 0.2, 0)
    k.liveryBoth(4, 2.4, 0.55, L * 0.15, fl + 0.78, W / 2 + 0.045)
    // three double doors both sides
    for (const f of [-0.3, 0, 0.3]) for (const s of [1, -1]) k.box(LIVERY.glass, 1.4, bh * 0.82, 0.03, f * L, fl + bh * 0.45, s * (W / 2 + 0.01), 'doors')
    k.box(LIVERY.chassis, L * 0.6, 0.35, W * 0.6, 0, H + 0.17, 0) // roof AC pod
    k.beacon(L * 0.3, H + 0.34)
    for (const s of [1, -1]) {
      k.head(0.03, 0.15, 0.4, L / 2 + 0.02, fl + 0.45, s * (W / 2 - 0.35), '', true)
      k.box(LIVERY.black, 0.06, 0.35, 0.16, L / 2 + 0.15, H - 0.7, s * (W / 2 + 0.12))
    }
    k.tail(-L / 2 - 0.01, fl + 0.5, W)
  },

  coach(k, L, H, W) {
    const r = 0.5
    k.axle(L * 0.33, r, W, 'wheels_front')
    k.axle(-L * 0.24, r, W, 'wheels_rear', true)
    k.axle(-L * 0.34, r, W, 'wheels_rear')
    const fl = 0.45
    const bh = H - fl
    k.rbox(LIVERY.white, L * 0.98, bh, W * 0.96, 0, fl + bh / 2, 0, 0.32)
    k.box(LIVERY.chassis, L * 1.002, 0.5, W * 1.004, 0, fl + 0.25, 0)
    k.box(LIVERY.glass, L * 0.9, bh * 0.36, W * 1.008, -L * 0.03, fl + bh * 0.68, 0)
    for (let i = -5; i <= 5; i++) k.box(LIVERY.white, 0.09, bh * 0.36, W * 1.01, -L * 0.03 + (i * L) / 12, fl + bh * 0.68, 0)
    const screen = new THREE.BoxGeometry(0.06, bh * 0.68, W * 0.88)
    screen.rotateZ(-0.3)
    k.add(screen, LIVERY.glass, L / 2 - 0.28, fl + bh * 0.52, 0)
    k.box('#14181c', 0.04, 0.26, W * 0.46, L / 2 + 0.02, fl + bh * 0.82, 0)
    k.box('#f3e7a2', 0.02, 0.12, W * 0.32, L / 2 + 0.045, fl + bh * 0.82, 0)
    k.box(k.accent, L * 1.002, 0.4, W * 1.01, 0, fl + bh * 0.35, 0)
    for (let i = 0; i < 4; i++) k.box(LIVERY.steel, L * 0.12, 0.6, 0.02, -L * 0.2 + i * L * 0.13, fl + 0.55, W / 2 + 0.01) // luggage bays
    k.box(LIVERY.glass, 0.9, bh * 0.85, 0.03, L / 2 - 0.7, fl + bh * 0.45, -W / 2 - 0.01, 'doors')
    for (const s of [1, -1]) {
      k.head(0.03, 0.15, 0.45, L / 2 + 0.02, fl + 0.45, s * (W / 2 - 0.35), '', true)
      k.box(LIVERY.black, 0.4, 0.06, 0.06, L / 2 + 0.15, H - 0.5, s * (W / 2 + 0.05))
      k.box(LIVERY.black, 0.08, 0.5, 0.18, L / 2 + 0.35, H - 0.8, s * (W / 2 + 0.05))
    }
    k.box(LIVERY.white, L * 0.38, 0.2, W * 0.4, -L * 0.04, H + 0.08, 0) // roof pod, clear of the apron bus
    k.tail(-L / 2 - 0.01, fl + 0.6, W)
  },

  box_truck(k, L, H, W) {
    const r = 0.48
    k.axle(L * 0.32, r, W, 'wheels_front')
    k.axle(-L * 0.25, r, W, 'wheels_rear', true)
    k.chassisRail(L * 0.96, W, r + 0.12)
    const back = k.cab(L, W, r + 0.2, 2.2, 2.0, LIVERY.white)
    k.fleetNo(L / 2 - 1.0, r + 0.8, W)
    const bl = back + L / 2 - 0.25
    const bx = -L / 2 + bl / 2 + 0.05
    const by0 = r + 0.5
    k.box(LIVERY.white, bl, H - by0, W, bx, (H + by0) / 2, 0)
    k.box(k.accent, bl * 1.002, 0.5, W * 1.005, bx, by0 + 0.6, 0)
    k.box(LIVERY.steel, 0.03, H - by0 - 0.2, W * 0.9, -L / 2 + 0.03, (H + by0) / 2, 0, 'rollup_door')
    k.box(LIVERY.diamond, 0.08, 0.06, W * 0.95, -L / 2 + 0.02, by0 - 0.04, 0, 'tail_lift')
    k.chevrons(-L / 2 + 0.05, r * 0.3, 0.35, W)
    k.tail(-L / 2 + 0.03, r + 0.4, W)
  },

  van(k, L, H, W) {
    const r = 0.36
    k.axle(L * 0.33, r, W, 'wheels_front')
    k.axle(-L * 0.3, r, W, 'wheels_rear')
    k.box(LIVERY.white, L * 0.98, H - r - 0.1, W, -L * 0.01, (H + r + 0.1) / 2, 0)
    k.box(LIVERY.white, 0.9, 0.7, W * 0.96, L / 2 - 0.45, r + 0.55, 0) // nose
    k.box(LIVERY.glass, 0.6, 0.65, W * 0.9, L / 2 - 0.85, H - 0.55, 0)
    k.box(LIVERY.glass, 0.9, 0.55, W * 1.005, L / 2 - 1.35, H - 0.55, 0)
    k.sideStripe(-L * 0.1, L * 0.7, r + 0.7, W, k.accent, 0.18)
    k.liveryBoth(LIVERY_CELL.clean, 1.55, 0.44, -L * 0.08, r + 1.2, W / 2 + 0.04)
    for (const s of [1, -1]) {
      k.head(0.03, 0.12, 0.3, L / 2 + 0.01, r + 0.65, s * (W / 2 - 0.3), '', true)
      k.box(LIVERY.black, 0.06, 0.24, 0.12, L / 2 - 1.0, H - 0.7, s * (W / 2 + 0.1))
    }
    k.beacon(L * 0.1, H)
    k.tail(-L / 2 - 0.01, r + 0.7, W)
  },

  /** Patrol sedan. Navy body, roof light bar, door placard. Not the cleaning van. */
  police(k, L, H, W) {
    const r = 0.32
    const navy = '#1d3f73'
    const navyDeep = '#16325c'
    k.axle(L * 0.31, r, W, 'wheels_front')
    k.axle(-L * 0.3, r, W, 'wheels_rear')
    k.rbox(navy, L * 0.92, 0.42, W * 0.9, 0, r + 0.2, 0, 0.07)
    k.rbox(navy, L * 0.34, 0.16, W * 0.86, L * 0.26, r + 0.42, 0, 0.05)
    k.rbox(navyDeep, L * 0.4, 0.48, W * 0.84, -L * 0.02, r + 0.68, 0, 0.07)
    k.box(LIVERY.glass, L * 0.34, 0.28, W * 0.86, -L * 0.02, r + 0.72, 0)
    k.box(LIVERY.glass, 0.04, 0.26, W * 0.72, L * 0.16, r + 0.7, 0)
    k.box(LIVERY.glass, 0.04, 0.22, W * 0.7, -L * 0.22, r + 0.68, 0)
    k.box(navy, L * 0.2, 0.22, W * 0.86, -L * 0.36, r + 0.42, 0)
    k.box(LIVERY.white, L * 0.7, 0.06, W * 0.92, 0, r + 0.28, 0)
    k.liveryBoth(LIVERY_CELL.police, 1.15, 0.34, -L * 0.02, r + 0.48, W * 0.45 + 0.03)
    k.box(LIVERY.black, 0.85, 0.08, W * 0.5, -L * 0.02, H - 0.12, 0, 'lightbar')
    for (const [dx, hex] of [[-0.28, LIVERY.blue], [-0.1, LIVERY.tail], [0.1, LIVERY.blue], [0.28, LIVERY.tail]] as const) {
      k.box(hex, 0.16, 0.1, W * 0.42, -L * 0.02 + dx, H - 0.05, 0, 'lightbar', true)
    }
    k.box(LIVERY.steel, 0.1, 0.14, W * 0.72, L / 2 - 0.04, r + 0.16, 0)
    for (const s of [1, -1]) {
      k.head(0.04, 0.1, 0.22, L / 2 + 0.01, r + 0.38, s * (W / 2 - 0.32), '', true)
      k.box(LIVERY.amber, 0.04, 0.08, 0.1, L / 2 + 0.01, r + 0.38, s * (W / 2 - 0.12), '', true)
      k.box(LIVERY.black, 0.05, 0.08, 0.16, L * 0.22, r + 0.78, s * (W / 2 + 0.08))
    }
    k.tail(-L / 2 - 0.01, r + 0.38, W * 0.9)
  },

  towbar_tug(k, L, H, W) {
    const r = 0.42
    k.axle(L * 0.3, r, W, 'wheels_front', false, 0.02)
    k.axle(-L * 0.3, r, W, 'wheels_rear', false, 0.02)
    k.box(LIVERY.gseYellow, L, 0.75, W * 0.92, 0, r + 0.2, 0)
    k.box(LIVERY.black, L * 1.02, 0.25, W * 0.94, 0, r - 0.1, 0) // bumpers
    k.box(LIVERY.diamond, L * 0.7, 0.04, W * 0.8, -L * 0.1, r + 0.6, 0)
    // low cab offset to one side
    k.box(LIVERY.gseYellow, 1.4, 0.55, 1.2, L * 0.15, r + 0.85, -W * 0.18)
    k.box(LIVERY.glass, 1.3, 0.42, 1.22, L * 0.15, r + 1.18, -W * 0.18)
    k.box(LIVERY.gseYellow, 1.5, 0.06, 1.3, L * 0.15, H - 0.03, -W * 0.18)
    k.beacon(L * 0.15, H, -W * 0.18)
    k.chevrons(L / 2 + 0.03, r - 0.05, 0.3, W * 0.9, 6)
    k.chevrons(-L / 2, r - 0.05, 0.3, W * 0.9, 6)
    for (const s of [1, -1]) k.head(0.03, 0.12, 0.25, L / 2 + 0.05, r + 0.4, s * (W / 2 - 0.35), '', true)
    k.tail(-L / 2, r + 0.4, W * 0.9)
    k.box('#f7f3a8', L * 0.8, 0.08, W * 0.94, 0, r + 0.55, 0) // hi-vis
    // articulated towbar with hitch eye (Round E)
    k.cyl(LIVERY.steel, 0.055, 2.15, L / 2 + 0.95, r + 0.05, 0, 'x', 'towbar', 8)
    k.cyl(LIVERY.chassis, 0.1, 0.08, L / 2 + 2.0, r + 0.05, 0, 'x', 'towbar', 8)
    const eye = new THREE.TorusGeometry(0.13, 0.028, 6, 14)
    eye.rotateY(Math.PI / 2)
    k.add(eye, LIVERY.gseYellow, L / 2 + 2.05, r + 0.05, 0, 'towbar')
    // roll cage over the offset cab
    for (const [dx, dz] of [[-0.62, -0.48], [0.62, -0.48], [-0.62, 0.48], [0.62, 0.48]] as const) {
      k.box(LIVERY.black, 0.05, 0.72, 0.05, L * 0.15 + dx, r + 0.95, -W * 0.18 + dz)
    }
    k.box(LIVERY.black, 1.3, 0.05, 0.05, L * 0.15, H - 0.02, -W * 0.18 - 0.48)
    k.box(LIVERY.black, 1.3, 0.05, 0.05, L * 0.15, H - 0.02, -W * 0.18 + 0.48)
    k.box(LIVERY.black, 0.55, 0.4, W * 0.62, -L / 2 + 0.4, r + 0.55, 0) // counterweight
  },

  towbarless_tug(k, L, H, W) {
    const r = 0.45
    k.axle(L * 0.33, r, W, 'wheels_front', false, 0.02)
    k.axle(-L * 0.3, r, W, 'wheels_rear', false, 0.02)
    // U-shaped chassis, open at the rear to take the nose gear
    k.box('#d5d8dc', L * 0.45, 0.85, W * 0.95, L * 0.27, r + 0.15, 0)
    for (const s of [1, -1]) k.box('#d5d8dc', L * 0.55, 0.85, W * 0.3, -L * 0.22, r + 0.15, s * W * 0.33)
    k.liveryBoth(3, 2.15, 0.62, -L * 0.18, r + 0.48, W * 0.5 + 0.02)
    k.box(LIVERY.black, 0.12, 0.3, W * 0.97, L / 2, r - 0.05, 0)
    k.box(LIVERY.diamond, L * 0.4, 0.04, W * 0.85, L * 0.27, r + 0.59, 0)
    // cradle / clamp in the U
    k.box(LIVERY.steel, L * 0.32, 0.12, W * 0.32, -L * 0.25, r - 0.15, 0, 'cradle')
    for (const s of [1, -1]) {
      k.box(LIVERY.black, 0.55, 0.42, 0.1, -L * 0.25, r + 0.12, s * W * 0.16, 'cradle')
      k.box(LIVERY.gseYellow, 0.18, 0.16, 0.12, -L * 0.25, r + 0.28, s * W * 0.16, 'cradle')
    }
    k.box(LIVERY.gseYellow, 0.08, 0.08, W * 0.55, -L / 2 + 0.2, r + 0.72, 0)
    // twin low cabs (front corner)
    k.box(LIVERY.glass, 1.2, 0.45, 1.0, L * 0.32, r + 0.85, -W * 0.28)
    k.box('#d5d8dc', 1.3, 0.06, 1.1, L * 0.32, H - 0.03, -W * 0.28)
    k.box(LIVERY.glass, 1.0, 0.38, 0.85, L * 0.26, r + 0.72, W * 0.22)
    k.box('#d5d8dc', 1.1, 0.05, 0.95, L * 0.26, r + 0.94, W * 0.22)
    for (const dx of [-0.55, 0.55]) k.box(LIVERY.black, 0.05, 0.55, 0.05, L * 0.32 + dx, r + 0.7, -W * 0.28)
    k.beacon(L * 0.32, H, -W * 0.28)
    k.box('#f7f3a8', L * 0.35, 0.1, W * 0.96, L * 0.27, r + 0.7, 0) // hi-vis nose
    k.chevrons(L / 2 + 0.06, r - 0.1, 0.35, W * 0.95, 8)
    for (const s of [1, -1]) {
      k.head(0.03, 0.12, 0.3, L / 2 + 0.07, r + 0.35, s * (W / 2 - 0.4), '', true)
      k.box(LIVERY.tail, 0.03, 0.14, 0.2, -L / 2 - 0.01 + L * 0.05, r + 0.35, s * (W / 2 - 0.2), '', true)
    }
  },

  gpu(k, L, H, W) {
    const r = 0.3
    k.axle(L * 0.28, r, W, 'wheels_front', false, 0.02)
    k.axle(-L * 0.28, r, W, 'wheels_rear', false, 0.02)
    k.box(LIVERY.chassis, L * 0.95, 0.18, W * 0.8, 0, r + 0.05, 0)
    k.rbox(LIVERY.white, L * 0.86, H - r - 0.2, W * 0.95, -L * 0.03, (H + r + 0.2) / 2, 0, 0.08)
    k.box(k.accent, L * 0.862, 0.18, W * 0.955, -L * 0.03, r + 0.35, 0)
    k.box('#f7f3a8', L * 0.7, 0.08, W * 0.96, -L * 0.03, r + 0.55, 0) // hi-vis
    k.liveryBoth(LIVERY_CELL.power, 1.45, 0.42, -L * 0.08, r + 0.95, W * 0.48 + 0.04)
    for (const s of [1, -1]) for (let i = 0; i < 6; i++) k.box(LIVERY.chassis, 0.04, 0.5, 0.02, -L * 0.3 + i * 0.12, H - 0.5, s * W * 0.476)
    for (const s of [1, -1]) k.cyl(LIVERY.steel, 0.4, 0.08, L * 0.18, H + 0.15, s * 0.22, 'z') // reel cheeks, not spun
    k.cyl(LIVERY.gseYellow, 0.3, 0.3, L * 0.18, H + 0.15, 0, 'z', 'cable_reel')
    k.cyl(LIVERY.black, 0.24, 0.32, L * 0.18, H + 0.15, 0, 'z', 'cable_reel')
    // power cable paid out to the aircraft (Round E scales along Z)
    k.sagLine(LIVERY.black, 0.05, L * 0.18, r + 0.35, W / 2, CABLE_M, GPU_RISE, CABLE_M * 0.22, 'cable', 6)
    k.box(LIVERY.steel, 0.2, 0.14, 0.25, L * 0.18, r + 0.35 + GPU_RISE, W / 2 + CABLE_M, 'cable') // plug into the nose socket
    k.box(LIVERY.gseYellow, 0.12, 0.08, 0.12, L * 0.18, r + 0.45 + GPU_RISE, W / 2 + CABLE_M + 0.05, 'cable')
    k.cyl(LIVERY.steel, 0.04, 0.7, L / 2 - 0.05, r + 0.04, 0, 'x') // tow tongue, kept inside the footprint
    k.chevrons(-L / 2 + L * 0.07 - 0.03, r + 0.2, 0.25, W * 0.95, 4)
    k.box(LIVERY.amber, 0.12, 0.08, 0.12, -L * 0.3, H + 0.04, 0, '', true)
    k.cyl(LIVERY.chassis, 0.07, 0.28, -L * 0.22, H + 0.12, W * 0.18, undefined) // exhaust stack
    k.box('#1c242c', 0.04, 0.42, 0.36, L / 2 - 0.04, r + 0.72, 0) // control panel
  },

  stairs(k, L, H, W) {
    const r = 0.42
    k.axle(L * 0.33, r, W, 'wheels_front')
    k.axle(-L * 0.3, r, W, 'wheels_rear')
    k.chassisRail(L * 0.96, W, r + 0.12)
    const back = k.cab(L, W, r + 0.2, 1.9, 1.7, LIVERY.white, { rake: 0.32 })
    const sl = back + L / 2 - 0.2
    const sx = -L / 2 + sl / 2 + 0.1
    const pitch = Math.atan2(H - 0.8 - (r + 0.6), sl * 0.95)
    const sy = (r + 0.6 + H - 0.8) / 2
    k.slab(LIVERY.diamond, sl, 0.14, W * 0.7, sx, sy, 0, -pitch, 'stair')
    for (let i = 0; i < 12; i++) {
      const f = (i + 0.5) / 12 - 0.5
      k.box(LIVERY.steel, 0.24, 0.05, W * 0.7, sx + f * sl * Math.cos(pitch), sy - f * sl * Math.sin(pitch) + 0.1, 0, 'stair')
    }
    for (const s of [1, -1]) {
      k.slab(LIVERY.white, sl, 0.7, 0.06, sx, sy + 0.4, s * W * 0.36, -pitch, 'stair')
      k.slab(LIVERY.gseYellow, sl, 0.05, 0.05, sx, sy + 0.75, s * W * 0.36, -pitch, 'stair') // handrail
    }
    // top platform + canopy at the rear (high end)
    k.box(LIVERY.diamond, 1.2, 0.1, W * 0.8, -L / 2 + 0.7, H - 0.8, 0, 'stair')
    for (const s of [1, -1]) {
      k.box(LIVERY.white, 0.06, 0.8, 0.06, -L / 2 + 0.2, H - 0.4, s * W * 0.38, 'canopy')
      k.box(LIVERY.gseYellow, 0.06, 0.06, W * 0.76, -L / 2 + 0.2, H - 0.05, 0, 'canopy')
    }
    k.box(k.accent, 1.3, 0.08, W * 0.85, -L / 2 + 0.7, H, 0, 'canopy')
    k.box(LIVERY.gseYellow, 0.04, 0.72, W * 0.62, -L / 2 + 0.18, H - 0.42, 0, 'canopy')
    k.box('#f7f3a8', sl * 0.6, 0.08, W + 0.02, sx, r + 0.5, 0) // hi-vis
    k.liveryBoth(LIVERY_CELL.stairs, 1.2, 0.36, L / 2 - 1.0, r + 0.95, W / 2 + 0.04)
    k.chevrons(-L / 2 + 0.1, r * 0.4, 0.4, W)
    k.tail(-L / 2 + 0.1, r + 0.4, W)
  },

  k_loader(k, L, H, W) {
    const r = 0.36
    for (const f of [0.35, 0.12, -0.12, -0.35]) k.axle(f * L, r, W, f > 0 ? 'wheels_front' : 'wheels_rear', false, 0.02)
    k.box(LIVERY.gseYellow, L, 0.5, W, 0, r + 0.15, 0)
    k.sideStripe(0, L, r, W, LIVERY.black, 0.1)
    k.liveryBoth(LIVERY_CELL.loader, 2.05, 0.58, -L * 0.02, r + 0.55, W / 2 + 0.04)
    // roller platforms
    const pl = L * 0.44
    for (const [x, name, y] of [[L / 2 - 0.95 - pl / 2, 'front_platform', r + 1.2], [-L * 0.27, 'rear_platform', r + 0.65]] as const) {
      k.box(LIVERY.chassis, pl * 0.98, 0.3, W * 0.9, x, y - 0.22, 0, name) // deck frame
      k.box(LIVERY.diamond, pl, 0.24, W * 0.96, x, y, 0, name)
      for (let i = 0; i < 8; i++) k.cyl(LIVERY.steel, 0.07, W * 0.9, x - pl / 2 + pl * (i + 0.5) / 8, y + 0.14, 0, 'z', name, 6)
      for (const s of [1, -1]) k.box(LIVERY.gseYellow, pl, 0.22, 0.12, x, y + 0.24, s * W * 0.47, name)
      if (name === 'rear_platform') {
        k.box(PROP_LOOK.uld, pl * 0.62, 0.16, W * 0.62, x, y + 0.22, 0, name)
        k.box(PROP_LOOK.palletNet, pl * 0.6, 0.03, W * 0.6, x, y + 0.32, 0, name)
      }
      if (name === 'front_platform') {
        for (const s of [1, -1]) {
          k.slab(LIVERY.chassis, pl * 0.9, 0.1, 0.1, x, r + 0.7, s * W * 0.4, 0.15, name)
          k.box(LIVERY.steel, 0.1, 0.95, 0.1, x, y - 0.5, s * W * 0.36, name)
        }
        k.box(LIVERY.gseYellow, 0.1, 0.26, W * 0.9, x + pl / 2 - 0.04, y + 0.26, 0, name) // deck lip
      }
    }
    // operator cab on the front-left corner
    k.box(LIVERY.gseYellow, 0.9, 0.9, 0.9, L / 2 - 0.45, H - 0.45, -W / 2 + 0.45)
    k.box(LIVERY.glass, 0.92, 0.5, 0.92, L / 2 - 0.45, H - 0.35, -W / 2 + 0.45)
    k.beacon(L / 2 - 0.45, H, -W / 2 + 0.45)
    k.chevrons(-L / 2, r - 0.1, 0.4, W, 8)
    k.tail(-L / 2, r + 0.3, W)
  },

  uld_dolly(k, L, H, W) {
    const r = 0.2
    k.axle(L * 0.3, r, W, 'wheels_front', false, 0.02)
    k.axle(-L * 0.3, r, W, 'wheels_rear', false, 0.02)
    k.box(LIVERY.chassis, L * 0.95, 0.12, W * 0.9, 0, r + 0.15, 0)
    k.box(LIVERY.steel, L * 0.95, 0.06, W * 0.95, 0, H - 0.08, 0, 'rollers')
    k.liveryBoth(LIVERY_CELL.dolly, 1.05, 0.3, 0, 0.4, W * 0.48 + 0.03)
    for (let i = 0; i < 10; i++) k.cyl(LIVERY.hub, 0.04, W * 0.9, -L * 0.45 + (L * 0.9 * (i + 0.5)) / 10, H - 0.04, 0, 'z', 'rollers', 6)
    for (const s of [1, -1]) k.box(LIVERY.gseYellow, 0.08, 0.2, 0.08, -L / 2 + 0.1, H + 0.05, s * W * 0.44, 'rollers')
    k.box(LIVERY.steel, 1.0, 0.05, 0.05, L / 2 + 0.1 - 0.5, r + 0.1, 0)
    // LD3 on the deck. Named so the dolly envelope stays the roller height.
    const deck = H
    const cl = L * 0.72
    const cw = W * 0.82
    const ch = 1.05
    k.box(PROP_LOOK.uld, cl, ch * 0.55, cw, 0, deck + ch * 0.62, 0, 'cargo')
    const slope = new THREE.BoxGeometry(cl * 0.98, 0.06, cw * 0.5)
    slope.rotateX(0.6)
    k.add(slope, PROP_LOOK.uld, 0, deck + ch * 0.28, cw * 0.18, 'cargo')
    k.box(PROP_LOOK.uldPanel, cl * 0.22, ch * 0.28, 0.02, cl * 0.22, deck + ch * 0.72, cw / 2 + 0.01, 'cargo')
    k.box(LIVERY.chassis, cl * 0.9, 0.05, 0.05, 0, deck + 0.06, cw * 0.4, 'cargo')
  },

  /** Blue honey-wagon: waste tank, hose reel, hi-vis. */
  lavatory_truck(k, L, H, W) {
    const r = 0.42
    k.axle(L * 0.32, r, W, 'wheels_front')
    k.axle(-L * 0.28, r, W, 'wheels_rear')
    k.chassisRail(L * 0.94, W, r + 0.12)
    const back = k.cab(L, W, r + 0.18, 2.0, 1.9, LIVERY.white)
    k.fleetNo(L / 2 - 0.95, r + 0.8, W)
    const tl = back + L / 2 - 0.25
    const tx = -L / 2 + tl / 2 + 0.1
    // horizontal waste tank (blue)
    const blue = '#2a6aa8'
    k.add(new THREE.CapsuleGeometry(W * 0.4, tl - W * 0.8, 5, 14).rotateZ(Math.PI / 2), blue, tx, r + 1.15, 0)
    k.liveryBoth(LIVERY_CELL.lav, 2.05, 0.58, tx, r + 1.45, W * 0.42 + 0.04)
    k.sideStripe(tx, tl * 0.85, r + 0.85, W * 0.82, LIVERY.gseYellow, 0.14)
    k.box('#f7f3a8', tl * 0.6, 0.1, W * 0.82 + 0.02, tx, r + 0.7, 0)
    // pump cabinet + hose at rear
    k.box(LIVERY.steel, 0.7, 1.0, W * 0.9, -L / 2 + 0.45, r + 0.7, 0)
    k.cyl(LIVERY.gseYellow, 0.28, 0.4, -L / 2 + 0.45, r + 1.55, 0, 'z', 'hose_reel')
    k.cyl(LIVERY.hose, 0.22, 0.42, -L / 2 + 0.45, r + 1.55, 0, 'z', 'hose_reel')
    k.sagLine('#1a5080', 0.1, -L / 2 + 0.45, r + 0.9, W / 2, CABLE_M, SERVICE_RISE, CABLE_M * 0.2, 'hose', 8)
    k.box(LIVERY.steel, 0.22, 0.18, 0.28, -L / 2 + 0.45, r + 0.9 + SERVICE_RISE, W / 2 + CABLE_M, 'hose')
    k.chevrons(-L / 2, r * 0.4, 0.45, W)
    k.tail(-L / 2, r + 0.5, W)
    void H
  },

  /** Potable water tanker: white tank, blue stripe, hose to the aircraft. */
  water_truck(k, L, H, W) {
    const r = 0.42
    k.axle(L * 0.32, r, W, 'wheels_front')
    k.axle(-L * 0.28, r, W, 'wheels_rear')
    k.chassisRail(L * 0.94, W, r + 0.12)
    const back = k.cab(L, W, r + 0.18, 2.0, 1.9, LIVERY.white)
    k.fleetNo(L / 2 - 0.95, r + 0.8, W)
    const tl = back + L / 2 - 0.25
    const tx = -L / 2 + tl / 2 + 0.1
    k.add(new THREE.CapsuleGeometry(W * 0.38, tl - W * 0.76, 5, 14).rotateZ(Math.PI / 2), LIVERY.white, tx, r + 1.1, 0)
    k.liveryBoth(LIVERY_CELL.water, 1.95, 0.55, tx, r + 1.35, W * 0.4 + 0.04)
    k.sideStripe(tx, tl * 0.85, r + 0.9, W * 0.78, '#3fa8d6', 0.2)
    k.box('#f7f3a8', tl * 0.55, 0.1, W * 0.78 + 0.02, tx, r + 0.68, 0)
    // fill hatch on top
    k.cyl(LIVERY.steel, 0.2, 0.08, tx, r + 1.1 + W * 0.38 + 0.04, 0, undefined)
    k.box(LIVERY.steel, 0.65, 0.9, W * 0.88, -L / 2 + 0.42, r + 0.65, 0)
    k.cyl(LIVERY.gseYellow, 0.26, 0.38, -L / 2 + 0.42, r + 1.45, 0, 'z', 'hose_reel')
    k.cyl(LIVERY.hose, 0.2, 0.4, -L / 2 + 0.42, r + 1.45, 0, 'z', 'hose_reel')
    k.sagLine('#3fa8d6', 0.09, -L / 2 + 0.42, r + 0.85, W / 2, CABLE_M, SERVICE_RISE, CABLE_M * 0.2, 'hose', 8)
    k.box(LIVERY.steel, 0.2, 0.16, 0.24, -L / 2 + 0.42, r + 0.85 + SERVICE_RISE, W / 2 + CABLE_M, 'hose')
    k.chevrons(-L / 2, r * 0.4, 0.45, W)
    k.tail(-L / 2, r + 0.5, W)
    void H
  },
}

/** Belt incline and centre height for the belt loader (shared with the Round B pivot). */
export function beltGeom(L: number, H: number) {
  const r = gseR
  const lowY = r + 0.6
  const highY = H - 0.1
  const pitch = Math.atan2(highY - lowY, L * 0.9)
  return { pitch, by: (lowY + highY) / 2, lowX: -L * 0.45, lowY }
}

/** Hinge of the catering front deck (x at the box front, y at the box floor). */
export function cateringHinge(L: number) {
  return { x: L / 2 - 2.0 - 0.15, y: 0.45 + 0.75 }
}

/** Particle cone: ~36 small blobs along +X from the nozzle, widening. */
function spray(k: Kit, x: number, y: number, z: number, hex: string, name: string) {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 36; i++) {
    const d = 0.3 + (i / 36) * 4.2
    const spread = 0.12 + d * 0.22
    const s = 0.08 + d * 0.035
    k.add(new THREE.IcosahedronGeometry(s, 0), hex, x + d, y - d * d * 0.05 + (rnd() - 0.5) * spread, z + (rnd() - 0.5) * spread, name)
  }
}

/** Baggage cart: deck, frame posts, roof, side curtain, two axles. */
function cart(k: Kit, cx: number, cL: number, W: number, H: number, name: string) {
  const r = 0.2
  k.axle(cx + cL * 0.3, r, W, name || 'wheels_front', false, 0.02)
  k.axle(cx - cL * 0.3, r, W, name || 'wheels_rear', false, 0.02)
  k.box(LIVERY.chassis, cL, 0.1, W, cx, r + 0.2, 0, name)
  for (const fx of [-0.48, 0.48]) for (const s of [1, -1]) k.box(LIVERY.steel, 0.05, H - r - 0.25, 0.05, cx + fx * cL, (H + r + 0.25) / 2, s * (W / 2 - 0.03), name)
  k.box(LIVERY.steel, cL, 0.05, W, cx, H - 0.03, 0, name)
  // Open cage: three rails a side, not a solid curtain. The part stays named curtain.
  for (const t of [0.28, 0.52, 0.76]) {
    const y = r + 0.32 + (H - r - 0.4) * t
    k.box(LIVERY.steel, cL * 0.9, 0.045, 0.045, cx, y, -W / 2 + 0.04, name || 'curtain')
    k.box(LIVERY.steel, cL * 0.9, 0.045, 0.045, cx, y, W / 2 - 0.04, name || 'curtain')
  }
  const curtainName = name || 'curtain'
  const clothH = (H - r) * 0.36
  k.box(PROP_LOOK.curtain, cL * 0.86, clothH, 0.02, cx, r + 0.28 + clothH / 2, W / 2 - 0.02, curtainName)
  k.box(PROP_LOOK.curtain, cL * 0.86, clothH, 0.02, cx, r + 0.28 + clothH / 2, -(W / 2 - 0.02), curtainName)
  k.box(PROP_LOOK.curtainTape, cL * 0.86, 0.035, 0.025, cx, r + 0.3, W / 2, curtainName)
  k.box(PROP_LOOK.curtainTape, cL * 0.86, 0.035, 0.025, cx, r + 0.3, -W / 2, curtainName)
  if (!name) k.box(LIVERY.steel, 0.22, 0.05, 0.05, cx + cL / 2 + 0.08, r + 0.28, 0)
  // bags
  const bags = ['#6a5340', '#2f4a6a', '#8c2f2f', '#3e5a3a', '#55595f']
  for (let i = 0; i < 5; i++) k.box(bags[i], cL * 0.17, 0.32, W * 0.5, cx - cL * 0.4 + i * cL * 0.2, r + 0.72, W * 0.08, name)
}

/**
 * Far LOD: three boxes (body, cab, wheels). No bevels, no animated parts.
 * The close rig keeps every socket and part name; this shell only stands in at distance.
 */
export function buildVehicleFarParts(model: VehicleModel, accent: string): VPart[] {
  const [L, H, W] = MODEL_SIZE[model]
  const k = new Kit(accent)
  k.add(new THREE.BoxGeometry(L * 0.9, H * 0.55, W * 0.88), LIVERY.white, 0, H * 0.46, 0)
  k.add(new THREE.BoxGeometry(L * 0.24, H * 0.32, W * 0.8), accent, L * 0.3, H * 0.52, 0)
  k.add(new THREE.BoxGeometry(L * 0.62, Math.min(0.45, H * 0.22), W * 0.98), LIVERY.tyre, 0, Math.min(0.22, H * 0.12), 0)
  return k.parts
}

/** Build every primitive for one model. Caller owns and disposes the result. */
export function buildVehicleParts(model: VehicleModel, accent: string): VPart[] {
  const [L, H, W] = MODEL_SIZE[model]
  const kit = new Kit(accent)
  BUILDERS[model](kit, L, H, W)
  return kit.parts
}

export const ALL_MODELS = Object.keys(MODEL_SIZE) as VehicleModel[]

const centres = new Map<VehicleModel, Map<string, readonly [number, number, number]>>()

/** Bounding-box centre of a named part in model metres (cached). Used as a spin pivot. */
export function partCentre(model: VehicleModel, part: string): readonly [number, number, number] {
  let byPart = centres.get(model)
  if (!byPart) centres.set(model, (byPart = new Map()))
  const hit = byPart.get(part)
  if (hit) return hit
  const box = new THREE.Box3()
  const tmp = new THREE.Box3()
  for (const p of buildVehicleParts(model, '#ffffff')) {
    if (p.name === part) {
      p.geo.computeBoundingBox()
      box.union(tmp.copy(p.geo.boundingBox!))
    }
    p.geo.dispose()
  }
  const c = box.isEmpty() ? ([0, 0, 0] as const) : ([(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2] as const)
  byPart.set(part, c)
  return c
}

const anchorCache = new Map<VehicleModel, Map<string, readonly [number, number, number]>>()

/** Reel-end anchor of a hanging hose / cable part (null when the part is not a sag line). */
export function lineAnchor(model: VehicleModel, part: string): readonly [number, number, number] | null {
  let m = anchorCache.get(model)
  if (!m) {
    const [L, H, W] = MODEL_SIZE[model]
    const kit = new Kit('#ffffff')
    BUILDERS[model](kit, L, H, W)
    for (const p of kit.parts) p.geo.dispose()
    anchorCache.set(model, (m = kit.anchors))
  }
  return m.get(part) ?? null
}
