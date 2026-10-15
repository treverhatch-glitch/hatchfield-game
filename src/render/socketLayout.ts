/**
 * Local socket positions in metres. Animation and docking read these names;
 * a new mesh keeps the names and only moves the points.
 *
 * Vehicles: +X forward, +Y up, +Z to the right. Crew faces +Z, feet at y = 0.
 * Aircraft: +X nose, +Y up, +Z port.
 */
import { WORLD_PER_METER, type ModelSpec } from './aircraft/specs'
import { bridgeStops, doorBoxes } from './aircraft/stands'
import { beltGeom, CABLE_M, catenaryPoints, cateringHinge, GPU_RISE, lineAnchor, MODEL_SIZE, SERVICE_RISE, type VehicleModel } from './vehicleModels'

export type SocketTable = Readonly<Record<string, readonly [number, number, number]>>

const tables = new Map<VehicleModel, SocketTable>()

/**
 * Belt and catering points the turnaround reads. Pure numbers: building the
 * mesh here would burn Math.random inside Three's ids and desync a seeded run.
 */
export function apronCartSockets(model: 'belt_loader' | 'catering_hilift'): SocketTable {
  if (model === 'belt_loader') {
    const [L, H, W] = MODEL_SIZE[model]
    const g = beltGeom(L, H)
    const run = L * 0.9
    const z = W * 0.15
    return {
      belt_low: [g.lowX, g.lowY + 0.2, z],
      belt_tip: [g.lowX + Math.cos(g.pitch) * run, g.lowY + Math.sin(g.pitch) * run, z],
    }
  }
  const h = cateringHinge(MODEL_SIZE[model][0])
  return {
    catering_lip: [h.x, h.y + 2.4, 0],
    cart_slot: [h.x - 1.4, h.y + 0.45, 0],
  }
}

/** Named points on one vehicle, in model metres. `dock` is the nose reference. */
export function vehicleSocketTable(model: VehicleModel): SocketTable {
  const hit = tables.get(model)
  if (hit) return hit
  const [L, H, W] = MODEL_SIZE[model]
  const sockets: Record<string, readonly [number, number, number]> = {
    dock: [L / 2, 0.2, 0],
  }
  const hose = lineAnchor(model, 'hose')
  if (hose) sockets.hose_reel_out = [hose[0], hose[1], hose[2]]
  if (model === 'belt_loader' || model === 'catering_hilift') Object.assign(sockets, apronCartSockets(model))
  if (model === 'stairs') {
    sockets.stairs_top = [-L / 2 + 0.7, H - 0.8, 0]
    const r = 0.42
    const cabLen = 1.7
    const back = L / 2 - cabLen
    const sl = back + L / 2 - 0.2
    const sx = -L / 2 + sl / 2 + 0.1
    const rise = H - 0.8 - (r + 0.6)
    const run = sl * 0.95
    const hyp = Math.hypot(run, rise)
    const sy = (r + 0.6 + H - 0.8) / 2
    sockets.stairs_foot = [sx + (sl / 2) * (run / hyp), sy - (sl / 2) * (rise / hyp), 0]
  }
  if (model === 'towbarless_tug') sockets.tug_hitch = [-L * 0.25, 0.3, 0]
  if (model === 'towbar_tug') sockets.tug_hitch = [L / 2 + 2.05, 0.47, 0]
  if (model === 'baggage_cart') {
    sockets.cart_bed = [0, 0.66, 0]
    sockets.cart_hitch = [L / 2, 0.32, 0]
  }
  if (model === 'baggage_train') {
    const r = 0.3
    const tL = 2.9
    const tx = L / 2 - tL / 2
    const cL = 2.6
    const cx = tx - tL / 2 - 0.35 - cL / 2
    sockets.cart_bed = [cx, r + 0.46, 0]
    sockets.train_hitch = [tx - tL / 2, r + 0.15, 0]
  }
  if (model === 'uld_dolly') {
    sockets.dolly_deck = [0, H + 0.03, 0]
    sockets.dolly_hitch = [L / 2 + 0.15, 0.3, 0]
  }
  if (model === 'k_loader') {
    const r = 0.36
    const pl = L * 0.44
    const x = L / 2 - 0.95 - pl / 2
    sockets.loader_deck = [x, r + 1.2 + 0.14, 0]
  }
  if (model === 'lavatory_truck') {
    const r = 0.42
    sockets.lav_nozzle = [-L / 2 + 0.45, r + 0.9 + SERVICE_RISE, W / 2 + CABLE_M]
  }
  if (model === 'water_truck') {
    const r = 0.42
    sockets.water_nozzle = [-L / 2 + 0.42, r + 0.85 + SERVICE_RISE, W / 2 + CABLE_M]
  }
  if (model === 'gpu') {
    const r = 0.3
    sockets.cable_reel_out = [L * 0.18, r + 0.35, W / 2]
    sockets.gpu_plug = [L * 0.18, r + 0.35 + GPU_RISE, W / 2 + CABLE_M]
  }
  if (model === 'deice') sockets.deice_nozzle = [L / 2, H - 0.65, 0]
  if (model === 'arff') {
    const cabLen = 3
    const back = L / 2 - cabLen
    sockets.foam_nozzle = [back + 1.6, H + 0.4, 0]
  }
  if (model === 'police') {
    const r = 0.32
    sockets.patrol_door = [-L * 0.02, r + 0.55, W * 0.46]
  }
  if (model === 'van') {
    const r = 0.36
    sockets.clean_door = [-L * 0.05, r + 0.85, W / 2]
  }
  if (model === 'fuel_tanker') {
    const r = 0.5
    const cab = 2.3
    const back = L / 2 - cab
    const reelBay = 1.7
    const tailGap = 0.28
    const tl = back + L / 2 - tailGap - reelBay
    const tx = -L / 2 + tailGap + tl / 2
    const tr = Math.min(W * 0.46, (H - r - 0.4) / 2)
    sockets.truck_fill = [tx, r + 0.4 + tr, -(tr + 0.04)]
  }
  tables.set(model, sockets)
  return sockets
}

export function vehicleSocket(model: VehicleModel, name: string): readonly [number, number, number] | undefined {
  return vehicleSocketTable(model)[name]
}

/** Right hand in a reach, matching the shared body (faces +Z). */
export const CREW_SOCKETS: SocketTable = {
  crew_hand_r: [0.25, 0.98, 0.42],
  crew_hand_l: [-0.25, 0.98, 0.42],
}

/**
 * Door, fuel and nose-gear sockets from the airframe's own stations.
 * Missing door kinds fall back to a point on the fuselage so the name still exists.
 */
export function aircraftSocketTable(spec: ModelSpec): SocketTable {
  const boxes = doorBoxes(spec)
  const pax =
    boxes.find((b) => (b.door.kind === 'pax' || b.door.kind === 'crew') && b.door.side > 0) ??
    boxes.find((b) => (b.door.kind === 'pax' || b.door.kind === 'crew') && b.door.side !== 0)
  const service = boxes.find((b) => b.door.kind === 'service' && b.door.side !== 0) ?? pax
  const cargo =
    boxes.find((b) => b.door.kind === 'cargo' && b.door.t <= 0.5) ??
    boxes.find((b) => b.door.kind === 'cargo' || b.door.kind === 'ramp')
  const nose = spec.lengthM / 2
  const tailX = -spec.lengthM / 2
  const inset = Math.min(2.4, spec.lengthM * 0.11)
  const noseX = spec.tailWheel ? tailX + Math.min(0.7, spec.lengthM * 0.04) + spec.wheelbaseM : nose - inset
  const centerY = spec.gear + spec.ry
  const wingX = spec.lengthM * (0.5 - spec.wingAt)
  const wingY = spec.wingHigh ? centerY + spec.ry * 0.7 : centerY - spec.ry * 0.28
  const at = (box: (typeof boxes)[number] | undefined, fallback: readonly [number, number, number]) =>
    box ? ([box.x, box.sillM + Math.min(1.1, box.h * 0.45), box.z] as const) : fallback
  const side: readonly [number, number, number] = [0, centerY, spec.rx + 0.2]
  const tuck = (p: readonly [number, number, number], depth: number, drop = 0): readonly [number, number, number] => {
    const s = Math.sign(p[2]) || 1
    return [p[0], Math.max(0.4, p[1] - drop), p[2] - s * depth]
  }
  const cargoPoint = at(cargo, [nose - spec.lengthM * 0.35, centerY, spec.rx])
  const servicePoint = at(service, side)
  const paxPoint = at(pax, side)
  const paxSill: readonly [number, number, number] = pax
    ? [pax.x, pax.sillM, pax.z]
    : [paxPoint[0], Math.max(0.4, paxPoint[1] - 1), paxPoint[2]]
  return {
    plane_fuel_port: [wingX, Math.max(1.2, wingY - 0.25), Math.max(spec.rx + 1.2, spec.spanM * 0.18)],
    plane_cargo_door_fwd: cargoPoint,
    plane_hold: tuck(cargoPoint, 0.65, 0.15),
    catering_door: servicePoint,
    galley_slot: tuck(servicePoint, 0.5, 0),
    plane_pax_door: paxPoint,
    plane_pax_sill: paxSill,
    plane_nose_gear: [noseX, Math.max(0.35, spec.gear * 0.22), 0],
    plane_lav_port: [-spec.lengthM * 0.28, Math.max(1.1, centerY - spec.ry * 0.45), -(spec.rx + 0.15)],
    plane_water_port: [-spec.lengthM * 0.18, Math.max(1.15, centerY - spec.ry * 0.4), -(spec.rx + 0.15)],
    plane_gpu_port: [nose - spec.lengthM * 0.12, Math.max(0.9, spec.gear * 0.55), spec.rx * 0.2],
  }
}

/** Cab mouth and terminal end of the first main-deck bridge, in airframe metres. */
export function bridgeSocketTable(spec: ModelSpec, side: 1 | -1 = 1): SocketTable {
  const stops = bridgeStops(spec)
  const main = stops.find((s) => !s.upper) ?? stops[0]
  if (!main) return {}
  const skin = spec.rx + 0.2
  const footZ = side * (skin + 1.6 + main.tunnelM)
  return {
    bridge_cab: [main.x, main.sillM + 0.02, side * (skin + 0.15)],
    bridge_hall: [main.x, main.sillM + 0.02, footZ],
  }
}

/** Single check-in desk. The drop is the weigh belt; belt_in is the injection end. */
export const DESK_SOCKETS: SocketTable = {
  desk_drop: [1.25, 0.52, -0.15],
  belt_in: [1.25, 0.55, -0.9],
}

/** Four-desk row. Collector belt runs behind the counters to the curtain. */
export function checkinRowSockets(n = 4): SocketTable {
  const pitch = 2.3
  const len = n * pitch + 0.6
  const deskX = (0 - (n - 1) / 2) * pitch
  const outX = len / 2 + 0.2
  return {
    desk_drop: [deskX + 1.25, 0.52, -0.15],
    belt_in: [deskX + 1.25, 0.5, -1.15],
    belt_out: [outX, 0.5, -1.15],
    makeup_stop: [outX + 1.7, 0.66, -1.15],
  }
}

/** Claim carousel. Feed is the back hood; the lip is the public straight run. */
export const CAROUSEL_SOCKETS: SocketTable = {
  carousel_feed: [-9 / 2 - 1.1, 0.55, 0],
  carousel_lip: [0, 0.62, -1.6],
  claim_stop: [0, 0.66, -3.3],
}

/** Apron-drive bridge prop: rotunda floor and the cab bellows. */
export const JET_BRIDGE_PROP_SOCKETS: SocketTable = {
  bridge_hall: [0, 3.6, 0.4],
  bridge_cab: [0, 3.25, 17.6],
}

/**
 * Fuel-farm tile, in the tile's own units (the tank outlet on the +X side).
 * farm_entry and farm_exit sit at opposite ends of the loading lane so a
 * tanker drives through the canopy and does not reverse out of the same gate.
 */
export const FUEL_TILE_SOCKETS: SocketTable = {
  farm_fill: [1.25, 0.55, 0],
  farm_entry: [0, 0.2, 0.25],
  farm_exit: [0, 0.2, 4.85],
}

/** Fuel farm in metres, for the handoff rig. The outlet is on the tank wall. */
export const FARM_SOCKETS: SocketTable = {
  farm_fill: [0, 1.45, 1.35],
  /** Under the loading canopy, mid-lane. World z ≈ 2.55. */
  farm_bay: [0, 1.6, 5.67],
  farm_entry: [0, 0.45, 0.56],
  farm_exit: [0, 0.45, 10.78],
}

/** Nose height of a docked ground vehicle, in the building's world units. */
const MASS3_DOCK_Y = 0.2 * WORLD_PER_METER

export interface Mass3Socket {
  /** Point the vehicle `dock` socket meets. Same space as the building mesh. */
  at: readonly [number, number, number]
  /** Null: the bay is drawn and named, and no ground vehicle docks there yet. */
  vehicle: VehicleModel | null
}

/**
 * Pass-3 airside and landside bays. Keys are `service-bay:*` ids.
 * A null vehicle is listed in docs/art/BUILDING_SOCKETS.md as defined with no vehicle yet.
 */
export const MASS3_SOCKETS: Record<string, Record<string, Mass3Socket>> = {
  hydrant: {
    dispenser: { at: [0, MASS3_DOCK_Y, 2.65], vehicle: 'hydrant_cart' },
  },
  kitchen: {
    '1': { at: [-1.55, MASS3_DOCK_Y, 3.2], vehicle: 'catering_hilift' },
    '2': { at: [1.55, MASS3_DOCK_Y, 3.2], vehicle: 'catering_hilift' },
  },
  bags: {
    '1': { at: [-2.15, MASS3_DOCK_Y, 3.25], vehicle: 'baggage_train' },
    '2': { at: [0, MASS3_DOCK_Y, 3.25], vehicle: 'baggage_train' },
    '3': { at: [2.15, MASS3_DOCK_Y, 3.25], vehicle: 'baggage_train' },
  },
  bus: {
    '1': { at: [-2.05, MASS3_DOCK_Y, 1.85], vehicle: 'coach' },
    '2': { at: [2.05, MASS3_DOCK_Y, 1.85], vehicle: 'coach' },
  },
  rail: {
    track1: { at: [0, MASS3_DOCK_Y, 1.15], vehicle: null },
    track2: { at: [0, MASS3_DOCK_Y, 2.55], vehicle: null },
  },
  helipad: {
    pad: { at: [0, MASS3_DOCK_Y, 0], vehicle: null },
    bowser: { at: [3.35, MASS3_DOCK_Y, 2.45], vehicle: 'fuel_tanker' },
  },
  hotel_inn: {
    drop: { at: [0, MASS3_DOCK_Y, 3.7], vehicle: 'coach' },
    service: { at: [4.35, MASS3_DOCK_Y, 0.15], vehicle: 'van' },
  },
  hotel_biz: {
    drop: { at: [0, MASS3_DOCK_Y, 3.7], vehicle: 'coach' },
    service: { at: [4.4, MASS3_DOCK_Y, 0.1], vehicle: 'van' },
  },
  hotel_resort: {
    drop: { at: [0, MASS3_DOCK_Y, 3.75], vehicle: 'coach' },
    service: { at: [-2.4, MASS3_DOCK_Y, -3.55], vehicle: 'van' },
  },
}

/** Socket table for one pass-3 building. Names match the bay ids. */
export function mass3SocketTable(building: string): SocketTable {
  const rows = MASS3_SOCKETS[building]
  const table: Record<string, readonly [number, number, number]> = {}
  if (!rows) return table
  for (const [id, row] of Object.entries(rows)) table[id] = row.at
  return table
}

/** Item lock points. The origin of each rig is this socket, so a lock sits the item on the station. */
export const ITEM_SOCKETS: Record<string, SocketTable> = {
  bag: { bag_rest: [0, 0, 0], bag_grip: [0, 0.32, 0.12] },
  uld: { uld_lock: [0, 0, 0] },
  catering_cart: { cart_deck: [0, 0, 0] },
  passenger: { pax_feet: [0, 0, 0] },
  coupler: { coupler_jaw: [0, 0, 0] },
}

/**
 * Staff side of a counter, where a stores cart unloads.
 * Prop frame: origin on the floor, passenger side +Z. Y is the counter lip.
 */
export const COUNTER_SOCKETS: Record<string, SocketTable> = {
  shop_fastfood: { counter_restock: [0, 0.92, -2.95] as const },
  shop_news: { counter_restock: [2.4, 0.92, -1.95] as const },
  shop_coffee: { counter_restock: [0.9, 0.92, -4.58] as const },
  shop_dutyfree: { counter_restock: [-3.35, 0.92, -1.4] as const },
}

/** Crate rest on a stores cart, and the nose lock. +X is forward. */
export const STORES_CART_SOCKETS: SocketTable = {
  cart_bed: [0.55, 0.82, 0] as const,
  dock: [1.15, 0.45, 0] as const,
}

export function stationSocketTable(type: string): SocketTable | null {
  if (type === 'checkin_row') return checkinRowSockets()
  if (type === 'checkin_desk') return DESK_SOCKETS
  if (type === 'baggage_carousel') return CAROUSEL_SOCKETS
  if (type === 'jet_bridge') return JET_BRIDGE_PROP_SOCKETS
  if (COUNTER_SOCKETS[type]) return COUNTER_SOCKETS[type]
  return null
}

/**
 * Hose samples from `a` (reel) to `b` (nozzle). Y follows a catenary so the
 * span hangs instead of floating as a straight rod. Endpoints are the sockets.
 */
export function hoseSpan(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  sag = 0.55,
  n = 12,
): [number, number, number][] {
  const dx = b[0] - a[0]
  const dz = b[2] - a[2]
  const flat = Math.hypot(dx, dz)
  const len = Math.max(flat, 0.05)
  const rise = b[1] - a[1]
  const drop = Math.min(sag, Math.max(0.05, Math.min(a[1], a[1] + rise) - 0.08))
  const pts = catenaryPoints(len, rise, drop, n)
  const ix = dx / len
  const iz = dz / len
  return pts.map(([s, y]) => [a[0] + ix * s, a[1] + y, a[2] + iz * s])
}
