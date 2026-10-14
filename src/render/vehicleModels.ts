/**
 * Round A service-vehicle models. One builder per vehicle model, real sizes in
 * metres (+X forward, +Y up, Z across, ground at y = 0, centred on the footprint).
 *
 * A builder emits coloured primitives tagged with a part name. Static parts
 * merge into one shell per model; named parts ("boom", "belt", "scissor"...)
 * stay separate so Round B can pose them. Emissive parts (lights, beacons,
 * light bars) are tagged `lit` and drawn unlit so they read as glowing.
 */
import * as THREE from 'three'

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

/** Sim / render kind -> model. Unknown kinds draw as a van. */
export function vehicleModel(kind: string): VehicleModel {
  switch (kind) {
    case 'fuel':
    case 'fuel_truck':
      return 'fuel_tanker'
    case 'hydrant':
    case 'hydrant_cart':
      return 'hydrant_cart'
    case 'bags':
    case 'baggage_tug':
      return 'baggage_train'
    case 'cart':
      return 'baggage_cart'
    case 'belt_loader':
      return 'belt_loader'
    case 'catering':
    case 'catering_truck':
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
      return 'towbarless_tug'
    case 'gpu':
      return 'gpu'
    case 'stairs':
      return 'stairs'
    case 'cargo':
    case 'uld_loader':
      return 'k_loader'
    case 'dolly':
    case 'uld_dolly':
      return 'uld_dolly'
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
  tail: '#e0281e',
  amber: '#ffa514',
  blue: '#2a6cff',
} as const

export interface VPart {
  /** '' = static shell. Anything else is a named moving part for Round B. */
  name: string
  lit: boolean
  geo: THREE.BufferGeometry
}

/** Named moving parts each model exposes, for Round B rigs and tests. */
export const MODEL_PARTS: Record<VehicleModel, readonly string[]> = {
  fuel_tanker: ['wheels_front', 'wheels_rear', 'beacon', 'hose_reel'],
  hydrant_cart: ['wheels_front', 'wheels_rear', 'beacon', 'lift_platform', 'hose_reel'],
  baggage_train: ['wheels_front', 'wheels_rear', 'beacon', 'cart_1', 'cart_2'],
  baggage_cart: ['wheels_front', 'wheels_rear', 'curtain'],
  belt_loader: ['wheels_front', 'wheels_rear', 'beacon', 'belt'],
  catering_hilift: ['wheels_front', 'wheels_rear', 'beacon', 'scissor', 'box', 'deck'],
  arff: ['wheels_front', 'wheels_rear', 'lightbar', 'roof_turret', 'bumper_turret', 'locker_doors'],
  deice: ['wheels_front', 'wheels_rear', 'beacon', 'boom', 'basket'],
  apron_bus: ['wheels_front', 'wheels_rear', 'beacon', 'doors'],
  coach: ['wheels_front', 'wheels_rear', 'doors'],
  box_truck: ['wheels_front', 'wheels_rear', 'rollup_door', 'tail_lift'],
  van: ['wheels_front', 'wheels_rear', 'beacon'],
  towbar_tug: ['wheels_front', 'wheels_rear', 'beacon', 'towbar'],
  towbarless_tug: ['wheels_front', 'wheels_rear', 'beacon', 'cradle'],
  gpu: ['wheels_front', 'wheels_rear', 'cable_reel'],
  stairs: ['wheels_front', 'wheels_rear', 'beacon', 'stair', 'canopy'],
  k_loader: ['wheels_front', 'wheels_rear', 'beacon', 'front_platform', 'rear_platform'],
  uld_dolly: ['wheels_front', 'wheels_rear', 'rollers'],
}

const _c = new THREE.Color()

class Kit {
  readonly parts: VPart[] = []
  readonly accent: string
  constructor(accent: string) {
    this.accent = accent
  }

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
    this.parts.push({ name, lit, geo: flat })
  }

  box(hex: string, w: number, h: number, d: number, x: number, y: number, z: number, name = '', lit = false) {
    this.add(new THREE.BoxGeometry(w, h, d), hex, x, y, z, name, lit)
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

  /** One axle: two tyres, hubs and a tread ring. Doubles for rear truck axles. */
  axle(x: number, r: number, W: number, name: string, dual = false, inset = 0.06) {
    const tw = r * 0.62
    for (const s of [1, -1]) {
      const z = s * (W / 2 - tw / 2 - inset)
      this.cyl(LIVERY.tyre, r, tw, x, r, z, 'z', name, 14)
      this.cyl(LIVERY.hub, r * 0.52, tw * 1.04, x, r, z, 'z', name, 10)
      this.cyl(LIVERY.chassis, r * 0.18, tw * 1.1, x, r, z, 'z', name, 6)
      if (dual) this.cyl(LIVERY.tyre, r, tw * 0.9, x, r, z - s * tw * 0.98, 'z', name, 14)
    }
    this.box(LIVERY.chassis, 0.14, 0.14, W - tw * 2, x, r, 0, name)
  }

  /** Forward-control truck cab at the +X end. Returns the cab rear X. */
  cab(L: number, W: number, base: number, h: number, len: number, hex: string, opts: { beacon?: boolean } = {}) {
    const x0 = L / 2 - len / 2
    const top = base + h
    this.box(hex, len, h * 0.5, W, x0, base + h * 0.25, 0) // lower cab
    this.box(hex, len * 0.86, h * 0.08, W * 0.98, x0 - len * 0.06, top - h * 0.04, 0) // roof
    // glazing band with pillars
    const gy = base + h * 0.7
    const gh = h * 0.38
    this.box(LIVERY.glass, 0.05, gh, W * 0.86, L / 2 - 0.02, gy, 0)
    this.box(LIVERY.glass, len * 0.72, gh, W * 1.005, x0 + len * 0.04, gy, 0)
    for (const s of [1, -1]) {
      this.box(hex, 0.09, gh, 0.09, L / 2 - 0.04, gy, s * (W / 2 - 0.05)) // A pillar
      this.box(hex, 0.12, gh, W * 1.01, x0 - len * 0.34, gy, 0) // B pillar band
      // mirror arm + head
      this.box(LIVERY.black, 0.05, 0.05, 0.28, L / 2 - 0.2, gy + gh * 0.2, s * (W / 2 + 0.14))
      this.box(LIVERY.black, 0.07, 0.36, 0.18, L / 2 - 0.2, gy, s * (W / 2 + 0.3))
      // headlights + indicators
      this.box(LIVERY.head, 0.04, 0.16, 0.34, L / 2 + 0.01, base + 0.32, s * (W / 2 - 0.3), '', true)
      this.box(LIVERY.amber, 0.04, 0.1, 0.14, L / 2 + 0.01, base + 0.32, s * (W / 2 - 0.08), '', true)
    }
    this.box(LIVERY.black, 0.08, 0.26, W * 1.02, L / 2 + 0.02, base + 0.08, 0) // bumper
    this.box(LIVERY.chassis, 0.03, h * 0.16, W * 0.5, L / 2 + 0.01, base + h * 0.42, 0) // grille
    if (opts.beacon !== false) this.beacon(x0 - len * 0.1, top + 0.02)
    return L / 2 - len
  }

  beacon(x: number, y: number, z = 0, name = 'beacon') {
    this.cyl(LIVERY.black, 0.1, 0.05, x, y + 0.025, z, undefined, name, 10)
    this.cyl(LIVERY.amber, 0.08, 0.16, x, y + 0.13, z, undefined, name, 10, true)
  }

  tail(x: number, y: number, W: number) {
    for (const s of [1, -1]) {
      this.box(LIVERY.tail, 0.04, 0.16, 0.24, x - 0.01, y, s * (W / 2 - 0.2), '', true)
      this.box(LIVERY.amber, 0.04, 0.1, 0.12, x - 0.01, y + 0.15, s * (W / 2 - 0.2), '', true)
    }
  }

  /** Yellow/black chevrons across the rear face at x (facing -X). */
  chevrons(x: number, y0: number, h: number, W: number, n = 6) {
    const bw = W / n
    for (let i = 0; i < n; i++) this.box(i % 2 ? LIVERY.black : LIVERY.gseYellow, 0.03, h, bw, x - 0.015, y0 + h / 2, -W / 2 + bw * (i + 0.5))
  }

  /** Hazard stripe along both sides. */
  sideStripe(x: number, len: number, y: number, W: number, hex = this.accent, h = 0.14) {
    this.box(hex, len, h, W + 0.02, x, y, 0)
  }

  /** Fleet number plate block on each door (reads as a dark tag). */
  fleetNo(x: number, y: number, W: number) {
    for (const s of [1, -1]) this.box(LIVERY.black, 0.4, 0.18, 0.02, x, y, s * (W / 2 + 0.012))
  }

  chassisRail(L: number, W: number, y: number, x = 0) {
    for (const s of [1, -1]) this.box(LIVERY.chassis, L, 0.22, 0.12, x, y, s * W * 0.32)
  }
}

type Builder = (k: Kit, L: number, H: number, W: number) => void

const truckR = 0.5
const gseR = 0.3

const BUILDERS: Record<VehicleModel, Builder> = {
  fuel_tanker(k, L, H, W) {
    const r = truckR
    k.axle(L * 0.33, r, W, 'wheels_front')
    k.axle(-L * 0.18, r, W, 'wheels_rear', true)
    k.axle(-L * 0.32, r, W, 'wheels_rear', true)
    k.chassisRail(L * 0.96, W, r + 0.15)
    const back = k.cab(L, W, r + 0.2, 2.3, 2.3, LIVERY.white)
    k.fleetNo(L / 2 - 1.1, r + 0.85, W)
    const tl = back - (-L / 2) - 0.4
    const tx = -L / 2 + tl / 2 + 0.1
    const tr = Math.min(W * 0.46, (H - r - 0.4) / 2)
    const ty = r + 0.4 + tr
    k.add(new THREE.CapsuleGeometry(tr, tl - tr * 2, 6, 16).rotateZ(Math.PI / 2), LIVERY.white, tx, ty, 0)
    k.sideStripe(tx, tl * 0.9, ty - tr * 0.35, tr * 2, k.accent, 0.18)
    k.sideStripe(tx, tl * 0.9, ty + tr * 0.1, tr * 2, LIVERY.gseYellow, 0.08)
    // top walkway + rail + manholes
    k.box(LIVERY.diamond, tl * 0.7, 0.05, 0.6, tx, ty + tr, 0)
    for (const s of [1, -1]) k.box(LIVERY.steel, tl * 0.7, 0.04, 0.04, tx, ty + tr + 0.45, s * 0.3)
    for (const f of [-0.25, 0, 0.25]) k.cyl(LIVERY.steel, 0.22, 0.08, tx + f * tl, ty + tr + 0.06, 0, undefined)
    // pump cabinet + hose reel at rear, side lockers
    k.box(LIVERY.steel, 0.9, 1.1, W * 0.96, -L / 2 + 0.55, r + 0.75, 0)
    k.cyl(LIVERY.gseYellow, 0.38, 0.5, -L / 2 + 0.55, r + 1.7, 0, 'z', 'hose_reel')
    k.cyl(LIVERY.hose, 0.3, 0.52, -L / 2 + 0.55, r + 1.7, 0, 'z', 'hose_reel')
    k.box(LIVERY.chassis, 1.8, 0.5, W * 1.0, tx, r + 0.25, 0)
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
    k.box(LIVERY.gseYellow, tL, 0.55, W, tx, r + 0.2, 0)
    k.box(LIVERY.gseYellow, 1.0, 0.45, W * 0.9, tx + 0.85, r + 0.68, 0) // hood
    k.box(LIVERY.black, 0.1, 0.3, W * 1.02, L / 2, r + 0.05, 0)
    k.box(LIVERY.black, 0.5, 0.5, 0.5, tx - 0.4, r + 0.75, 0) // seat
    for (const s of [1, -1]) for (const f of [0.25, -1.1]) k.box(LIVERY.black, 0.06, 1.0, 0.06, tx + f, r + 1.0, s * (W / 2 - 0.08))
    k.box(LIVERY.gseYellow, 1.5, 0.06, W, tx - 0.42, H - 0.06, 0) // canopy
    k.box(LIVERY.glass, 0.04, 0.55, W * 0.85, tx + 0.28, r + 1.2, 0)
    k.beacon(tx - 0.42, H - 0.03)
    for (const s of [1, -1]) k.box(LIVERY.head, 0.03, 0.12, 0.2, L / 2 + 0.01, r + 0.62, s * (W / 2 - 0.2), '', true)
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
  },

  belt_loader(k, L, H, W) {
    const r = gseR
    k.axle(L * 0.3, r, W, 'wheels_front')
    k.axle(-L * 0.3, r, W, 'wheels_rear')
    k.box(LIVERY.gseYellow, L * 0.9, 0.5, W, 0, r + 0.15, 0)
    k.sideStripe(0, L * 0.9, r + 0.1, W, LIVERY.black, 0.08)
    // side cab at mid-left
    k.box(LIVERY.gseYellow, 1.4, 0.9, 0.9, -L * 0.05, r + 0.85, -W / 2 + 0.45)
    k.box(LIVERY.glass, 1.2, 0.5, 0.92, -L * 0.05, r + 1.25, -W / 2 + 0.45)
    k.box(LIVERY.gseYellow, 1.5, 0.06, 1.0, -L * 0.05, r + 1.55, -W / 2 + 0.45)
    k.beacon(-L * 0.05, r + 1.58, -W / 2 + 0.45)
    // inclined belt with side rails (rises to the front)
    const bl = L * 1.0
    const pitch = Math.atan2(H - (r + 0.9), bl * 0.9)
    const by = (r + 0.85 + H - 0.1) / 2
    k.slab(LIVERY.rubber, bl * 0.98, 0.08, 0.7, 0, by, W * 0.15, pitch, 'belt')
    for (const s of [1, -1]) k.slab(LIVERY.steel, bl * 0.98, 0.16, 0.05, 0, by + 0.08, W * 0.15 + s * 0.38, pitch, 'belt')
    k.box(LIVERY.black, 0.08, 0.2, 0.9, L / 2 - 0.05, H - 0.12, W * 0.15, 'belt') // bumper pad
    k.chevrons(-L / 2 + L * 0.05, r - 0.1, 0.4, W, 4)
    k.tail(-L / 2 + L * 0.05, r + 0.35, W)
  },

  catering_hilift(k, L, H, W) {
    const r = 0.45
    k.axle(L * 0.33, r, W, 'wheels_front')
    k.axle(-L * 0.28, r, W, 'wheels_rear', true)
    k.chassisRail(L * 0.96, W, r + 0.12)
    const back = k.cab(L, W, r + 0.2, 2.2, 2.0, LIVERY.white)
    k.fleetNo(L / 2 - 1.0, r + 0.8, W)
    const bl = back + L / 2 - 0.15
    const bx = -L / 2 + bl / 2
    // scissor (stowed): crossed beams between chassis and box
    const sy = r + 0.55
    for (const s of [1, -1]) {
      k.slab(LIVERY.chassis, bl * 0.8, 0.12, 0.1, bx, sy, s * W * 0.38, 0.12, 'scissor')
      k.slab(LIVERY.chassis, bl * 0.8, 0.12, 0.1, bx, sy, s * W * 0.38, -0.12, 'scissor')
    }
    const by0 = r + 0.75
    const bh = H - by0
    k.box(LIVERY.white, bl, bh, W, bx, by0 + bh / 2, 0, 'box')
    k.box(k.accent, bl * 1.002, 0.3, W * 1.005, bx, by0 + bh * 0.25, 0, 'box')
    k.box(LIVERY.steel, bl * 1.004, 0.05, W * 1.01, bx, H - 0.03, 0, 'box')
    k.box(LIVERY.steel, 0.04, bh * 0.85, W * 0.7, -L / 2 + 0.15 - 0.02, by0 + bh * 0.48, 0, 'box') // rear door
    // folding front deck over the cab
    k.box(LIVERY.diamond, 1.3, 0.08, W * 0.9, back + 0.5, H - 0.6, 0, 'deck')
    for (const s of [1, -1]) k.box(LIVERY.gseYellow, 1.3, 0.05, 0.05, back + 0.5, H - 0.1, s * W * 0.43, 'deck')
    k.chevrons(-L / 2 + 0.13, r * 0.3, 0.5, W)
    k.tail(-L / 2 + 0.13, r + 0.4, W)
  },

  arff(k, L, H, W) {
    const r = 0.62
    k.axle(L * 0.32, r, W, 'wheels_front')
    k.axle(-L * 0.12, r, W, 'wheels_rear')
    k.axle(-L * 0.32, r, W, 'wheels_rear')
    const red = LIVERY.arffRed
    const back = k.cab(L, W, r + 0.25, 2.4, 3.0, red, { beacon: false })
    // wrap-around light bar on cab roof
    k.box(LIVERY.black, 0.4, 0.14, W * 0.85, L / 2 - 1.4, r + 2.73, 0)
    for (let i = 0; i < 6; i++) k.box(i % 2 ? LIVERY.blue : LIVERY.tail, 0.32, 0.12, W * 0.13, L / 2 - 1.4, r + 2.86, -W * 0.36 + i * W * 0.144, 'lightbar', true)
    const bl = back + L / 2 - 0.1
    const bx = -L / 2 + bl / 2 + 0.05
    k.box(red, bl, H - r - 0.3, W, bx, (H + r + 0.3) / 2, 0)
    k.sideStripe(bx, bl, r + 0.8, W, LIVERY.gseYellow, 0.18)
    k.sideStripe(L / 2 - 1.5, 3.0, r + 0.8, W, LIVERY.gseYellow, 0.18)
    for (let i = 0; i < 4; i++) {
      const lx = bx - bl / 2 + bl * (i + 0.5) / 4
      for (const s of [1, -1]) k.box('#a81c18', bl / 4 - 0.12, 1.2, 0.03, lx, r + 1.6, s * (W / 2 + 0.01), 'locker_doors')
    }
    k.box(LIVERY.diamond, bl * 0.9, 0.06, W * 0.9, bx, H + 0.02, 0)
    // roof turret + bumper turret
    k.cyl(LIVERY.steel, 0.28, 0.3, back + 0.2, H + 0.18, 0, undefined, 'roof_turret')
    k.cyl(LIVERY.white, 0.09, 1.4, back + 0.9, H + 0.4, 0, 'x', 'roof_turret')
    k.cyl(LIVERY.steel, 0.14, 0.2, L / 2 + 0.2, r + 0.45, 0, undefined, 'bumper_turret')
    k.cyl(LIVERY.white, 0.06, 0.6, L / 2 + 0.45, r + 0.55, 0, 'x', 'bumper_turret')
    for (const s of [1, -1]) k.beacon(-L / 2 + 0.3, H + 0.02, s * (W / 2 - 0.2), 'lightbar')
    k.chevrons(-L / 2 + 0.05, r * 0.5, 0.6, W, 8)
    k.tail(-L / 2 + 0.05, r + 0.6, W)
  },

  deice(k, L, H, W) {
    const r = 0.5
    k.axle(L * 0.33, r, W, 'wheels_front')
    k.axle(-L * 0.25, r, W, 'wheels_rear', true)
    k.chassisRail(L * 0.96, W, r + 0.15)
    const back = k.cab(L, W, r + 0.2, 2.2, 2.1, LIVERY.white)
    const tl = (back + L / 2) * 0.6
    const tx = -L / 2 + tl / 2 + 0.1
    k.box(LIVERY.white, tl, 1.5, W * 0.96, tx, r + 1.15, 0) // fluid tank
    k.sideStripe(tx, tl, r + 0.75, W * 0.96, k.accent, 0.2)
    k.sideStripe(tx, tl, r + 1.0, W * 0.96, '#3fa8d6', 0.08)
    // turntable + folded boom lying forward over the cab, basket at the tip
    const px = back - 0.6
    k.cyl(LIVERY.steel, 0.55, 0.3, px, r + 0.55, 0, undefined, 'boom')
    k.box(LIVERY.gseYellow, 0.8, 1.0, 0.8, px, r + 1.15, 0, 'boom')
    k.slab(LIVERY.gseYellow, 4.6, 0.3, 0.32, px - 0.6, H - 0.55, 0, 0, 'boom')
    k.slab(LIVERY.gseYellow, 3.6, 0.24, 0.26, px + 1.1, H - 0.2, 0, 0, 'boom')
    k.box(LIVERY.white, 1.0, 0.8, 1.1, L / 2 - 0.6, H - 0.4, 0, 'basket')
    k.box(LIVERY.glass, 1.02, 0.4, 1.12, L / 2 - 0.6, H - 0.3, 0, 'basket')
    k.box(LIVERY.chassis, 0.1, 0.1, 0.6, L / 2 - 0.05, H - 0.65, 0, 'basket') // nozzle
    k.chevrons(-L / 2 + 0.1, r * 0.4, 0.5, W)
    k.tail(-L / 2 + 0.1, r + 0.5, W)
  },

  apron_bus(k, L, H, W) {
    const r = 0.42
    k.axle(L * 0.36, r, W, 'wheels_front', false, 0.02)
    k.axle(-L * 0.36, r, W, 'wheels_rear', false, 0.02)
    const fl = 0.35
    const bh = H - fl
    k.box(LIVERY.white, L, bh, W, 0, fl + bh / 2, 0)
    k.box(LIVERY.chassis, L * 1.002, 0.3, W * 1.004, 0, fl + 0.15, 0) // skirt
    k.box(LIVERY.glass, L * 0.94, bh * 0.52, W * 1.008, 0, fl + bh * 0.6, 0) // panoramic glazing
    for (let i = -6; i <= 6; i++) k.box(LIVERY.white, 0.1, bh * 0.52, W * 1.01, (i * L) / 14, fl + bh * 0.6, 0)
    k.box(LIVERY.glass, 0.04, bh * 0.7, W * 0.9, L / 2 + 0.01, fl + bh * 0.5, 0)
    k.box(LIVERY.glass, 0.04, bh * 0.7, W * 0.9, -L / 2 - 0.01, fl + bh * 0.5, 0)
    k.box(k.accent, L * 1.002, 0.25, W * 1.01, 0, fl + bh * 0.2, 0)
    // three double doors both sides
    for (const f of [-0.3, 0, 0.3]) for (const s of [1, -1]) k.box(LIVERY.glass, 1.4, bh * 0.82, 0.03, f * L, fl + bh * 0.45, s * (W / 2 + 0.01), 'doors')
    k.box(LIVERY.chassis, L * 0.6, 0.35, W * 0.6, 0, H + 0.17, 0) // roof AC pod
    k.beacon(L * 0.3, H + 0.34)
    for (const s of [1, -1]) {
      k.box(LIVERY.head, 0.03, 0.15, 0.4, L / 2 + 0.02, fl + 0.45, s * (W / 2 - 0.35), '', true)
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
    k.box(LIVERY.white, L, bh, W, 0, fl + bh / 2, 0)
    k.box(LIVERY.chassis, L * 1.002, 0.5, W * 1.004, 0, fl + 0.25, 0)
    k.box(LIVERY.glass, L * 0.9, bh * 0.36, W * 1.008, -L * 0.03, fl + bh * 0.68, 0)
    for (let i = -5; i <= 5; i++) k.box(LIVERY.white, 0.09, bh * 0.36, W * 1.01, -L * 0.03 + (i * L) / 12, fl + bh * 0.68, 0)
    k.box(LIVERY.glass, 0.06, bh * 0.72, W * 0.94, L / 2 + 0.01, fl + bh * 0.55, 0) // big windscreen
    k.box(k.accent, L * 1.002, 0.4, W * 1.01, 0, fl + bh * 0.35, 0)
    for (let i = 0; i < 4; i++) k.box(LIVERY.steel, L * 0.12, 0.6, 0.02, -L * 0.2 + i * L * 0.13, fl + 0.55, W / 2 + 0.01) // luggage bays
    k.box(LIVERY.glass, 0.9, bh * 0.85, 0.03, L / 2 - 0.7, fl + bh * 0.45, -W / 2 - 0.01, 'doors')
    for (const s of [1, -1]) {
      k.box(LIVERY.head, 0.03, 0.15, 0.45, L / 2 + 0.02, fl + 0.45, s * (W / 2 - 0.35), '', true)
      k.box(LIVERY.black, 0.4, 0.06, 0.06, L / 2 + 0.15, H - 0.5, s * (W / 2 + 0.05))
      k.box(LIVERY.black, 0.08, 0.5, 0.18, L / 2 + 0.35, H - 0.8, s * (W / 2 + 0.05))
    }
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
    for (const s of [1, -1]) {
      k.box(LIVERY.head, 0.03, 0.12, 0.3, L / 2 + 0.01, r + 0.65, s * (W / 2 - 0.3), '', true)
      k.box(LIVERY.black, 0.06, 0.24, 0.12, L / 2 - 1.0, H - 0.7, s * (W / 2 + 0.1))
    }
    k.beacon(L * 0.1, H)
    k.tail(-L / 2 - 0.01, r + 0.7, W)
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
    for (const s of [1, -1]) k.box(LIVERY.head, 0.03, 0.12, 0.25, L / 2 + 0.05, r + 0.4, s * (W / 2 - 0.35), '', true)
    k.tail(-L / 2, r + 0.4, W * 0.9)
    k.box(LIVERY.steel, 1.4, 0.1, 0.1, L / 2 + 0.6 - 0.75, r - 0.05, 0, 'towbar')
  },

  towbarless_tug(k, L, H, W) {
    const r = 0.45
    k.axle(L * 0.33, r, W, 'wheels_front', false, 0.02)
    k.axle(-L * 0.3, r, W, 'wheels_rear', false, 0.02)
    // U-shaped chassis, open at the rear to take the nose gear
    k.box(LIVERY.gseYellow, L * 0.45, 0.85, W * 0.95, L * 0.27, r + 0.15, 0)
    for (const s of [1, -1]) k.box(LIVERY.gseYellow, L * 0.55, 0.85, W * 0.3, -L * 0.22, r + 0.15, s * W * 0.33)
    k.box(LIVERY.black, 0.12, 0.3, W * 0.97, L / 2, r - 0.05, 0)
    k.box(LIVERY.diamond, L * 0.4, 0.04, W * 0.85, L * 0.27, r + 0.59, 0)
    // cradle / clamp in the U
    k.box(LIVERY.steel, L * 0.32, 0.12, W * 0.32, -L * 0.25, r - 0.15, 0, 'cradle')
    for (const s of [1, -1]) k.box(LIVERY.black, 0.4, 0.3, 0.12, -L * 0.25, r + 0.05, s * W * 0.15, 'cradle')
    // twin low cabs (front corner)
    k.box(LIVERY.glass, 1.2, 0.45, 1.0, L * 0.32, r + 0.85, -W * 0.28)
    k.box(LIVERY.gseYellow, 1.3, 0.06, 1.1, L * 0.32, H - 0.03, -W * 0.28)
    k.beacon(L * 0.32, H, -W * 0.28)
    k.chevrons(L / 2 + 0.06, r - 0.1, 0.35, W * 0.95, 8)
    for (const s of [1, -1]) {
      k.box(LIVERY.head, 0.03, 0.12, 0.3, L / 2 + 0.07, r + 0.35, s * (W / 2 - 0.4), '', true)
      k.box(LIVERY.tail, 0.03, 0.14, 0.2, -L / 2 - 0.01 + L * 0.05, r + 0.35, s * (W / 2 - 0.2), '', true)
    }
  },

  gpu(k, L, H, W) {
    const r = 0.3
    k.axle(L * 0.28, r, W, 'wheels_front', false, 0.02)
    k.axle(-L * 0.28, r, W, 'wheels_rear', false, 0.02)
    k.box(LIVERY.chassis, L * 0.95, 0.18, W * 0.8, 0, r + 0.05, 0)
    k.box(LIVERY.white, L * 0.86, H - r - 0.2, W * 0.95, -L * 0.03, (H + r + 0.2) / 2, 0)
    k.box(k.accent, L * 0.862, 0.18, W * 0.955, -L * 0.03, r + 0.35, 0)
    for (let i = 0; i < 6; i++) k.box(LIVERY.chassis, 0.04, 0.5, 0.02, -L * 0.3 + i * 0.12, H - 0.5, W * 0.476) // louvres
    k.cyl(LIVERY.gseYellow, 0.3, 0.3, L * 0.18, H + 0.15, 0, 'z', 'cable_reel')
    k.cyl(LIVERY.black, 0.24, 0.32, L * 0.18, H + 0.15, 0, 'z', 'cable_reel')
    k.box(LIVERY.steel, 0.9, 0.05, 0.05, L / 2 - 0.1, r, 0) // towbar
    k.chevrons(-L / 2 + L * 0.07 - 0.03, r + 0.2, 0.25, W * 0.95, 4)
    k.box(LIVERY.amber, 0.12, 0.08, 0.12, -L * 0.3, H + 0.04, 0, '', true)
  },

  stairs(k, L, H, W) {
    const r = 0.42
    k.axle(L * 0.33, r, W, 'wheels_front')
    k.axle(-L * 0.3, r, W, 'wheels_rear')
    k.chassisRail(L * 0.96, W, r + 0.12)
    const back = k.cab(L, W, r + 0.2, 1.9, 1.7, LIVERY.white)
    const sl = back + L / 2 - 0.2
    const sx = -L / 2 + sl / 2 + 0.1
    const pitch = Math.atan2(H - 0.8 - (r + 0.6), sl * 0.95)
    const sy = (r + 0.6 + H - 0.8) / 2
    k.slab(LIVERY.diamond, sl, 0.14, W * 0.7, sx, sy, 0, -pitch, 'stair')
    for (let i = 0; i < 12; i++) {
      const f = (i + 0.5) / 12 - 0.5
      k.box(LIVERY.steel, 0.24, 0.05, W * 0.7, sx + f * sl * Math.cos(pitch), sy - f * sl * Math.sin(pitch) + 0.1, 0, 'stair')
    }
    for (const s of [1, -1]) k.slab(LIVERY.white, sl, 0.7, 0.06, sx, sy + 0.4, s * W * 0.36, -pitch, 'stair')
    // top platform + canopy at the rear (high end)
    k.box(LIVERY.diamond, 1.2, 0.1, W * 0.8, -L / 2 + 0.7, H - 0.8, 0, 'stair')
    for (const s of [1, -1]) k.box(LIVERY.white, 0.06, 0.8, 0.06, -L / 2 + 0.2, H - 0.4, s * W * 0.38, 'canopy')
    k.box(k.accent, 1.3, 0.08, W * 0.85, -L / 2 + 0.7, H, 0, 'canopy')
    k.chevrons(-L / 2 + 0.1, r * 0.4, 0.4, W)
    k.tail(-L / 2 + 0.1, r + 0.4, W)
  },

  k_loader(k, L, H, W) {
    const r = 0.36
    for (const f of [0.35, 0.12, -0.12, -0.35]) k.axle(f * L, r, W, f > 0 ? 'wheels_front' : 'wheels_rear', false, 0.02)
    k.box(LIVERY.gseYellow, L, 0.5, W, 0, r + 0.15, 0)
    k.sideStripe(0, L, r, W, LIVERY.black, 0.1)
    // roller platforms
    const pl = L * 0.44
    for (const [x, name, y] of [[L * 0.27, 'front_platform', r + 1.2], [-L * 0.24, 'rear_platform', r + 0.65]] as const) {
      k.box(LIVERY.diamond, pl, 0.16, W * 0.96, x, y, 0, name)
      for (let i = 0; i < 8; i++) k.cyl(LIVERY.steel, 0.05, W * 0.9, x - pl / 2 + pl * (i + 0.5) / 8, y + 0.1, 0, 'z', name, 6)
      for (const s of [1, -1]) k.box(LIVERY.gseYellow, pl, 0.12, 0.08, x, y + 0.18, s * W * 0.47, name)
      if (name === 'front_platform') for (const s of [1, -1]) k.slab(LIVERY.chassis, pl * 0.9, 0.1, 0.1, x, r + 0.7, s * W * 0.4, 0.15, name)
    }
    // operator cab on the front-left corner
    k.box(LIVERY.gseYellow, 0.9, 0.9, 0.9, L / 2 - 0.45, H - 0.45, -W / 2 + 0.45, 'front_platform')
    k.box(LIVERY.glass, 0.92, 0.5, 0.92, L / 2 - 0.45, H - 0.35, -W / 2 + 0.45, 'front_platform')
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
    for (let i = 0; i < 10; i++) k.cyl(LIVERY.hub, 0.04, W * 0.9, -L * 0.45 + (L * 0.9 * (i + 0.5)) / 10, H - 0.04, 0, 'z', 'rollers', 6)
    for (const s of [1, -1]) k.box(LIVERY.gseYellow, 0.08, 0.2, 0.08, -L / 2 + 0.1, H + 0.05, s * W * 0.44, 'rollers')
    k.box(LIVERY.steel, 1.0, 0.05, 0.05, L / 2 + 0.1 - 0.5, r + 0.1, 0)
  },
}

/** Baggage cart: deck, frame posts, roof, side curtain, two axles. */
function cart(k: Kit, cx: number, cL: number, W: number, H: number, name: string) {
  const r = 0.2
  k.axle(cx + cL * 0.3, r, W, name || 'wheels_front', false, 0.02)
  k.axle(cx - cL * 0.3, r, W, name || 'wheels_rear', false, 0.02)
  k.box(LIVERY.chassis, cL, 0.1, W, cx, r + 0.2, 0, name)
  for (const fx of [-0.48, 0.48]) for (const s of [1, -1]) k.box(LIVERY.steel, 0.05, H - r - 0.25, 0.05, cx + fx * cL, (H + r + 0.25) / 2, s * (W / 2 - 0.03), name)
  k.box(LIVERY.steel, cL, 0.05, W, cx, H - 0.03, 0, name)
  k.box('#2f4a6a', cL * 0.96, (H - r - 0.3) * 0.8, 0.03, cx, r + 0.3 + (H - r - 0.3) * 0.4, -W / 2 + 0.02, name || 'curtain')
  // bags
  const bags = ['#6a5340', '#2f4a6a', '#8c2f2f', '#3e5a3a', '#55595f']
  for (let i = 0; i < 5; i++) k.box(bags[i], cL * 0.17, 0.42, W * 0.55, cx - cL * 0.4 + i * cL * 0.2, r + 0.46, W * 0.1, name)
}

/** Build every primitive for one model. Caller owns and disposes the result. */
export function buildVehicleParts(model: VehicleModel, accent: string): VPart[] {
  const [L, H, W] = MODEL_SIZE[model]
  const kit = new Kit(accent)
  BUILDERS[model](kit, L, H, W)
  return kit.parts
}

export const ALL_MODELS = Object.keys(MODEL_SIZE) as VehicleModel[]
