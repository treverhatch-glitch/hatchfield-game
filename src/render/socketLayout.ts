/**
 * Local socket positions in metres. Animation and docking read these names;
 * a new mesh keeps the names and only moves the points.
 *
 * Vehicles: +X forward, +Y up, +Z to the right. Crew faces +Z, feet at y = 0.
 * Aircraft: +X nose, +Y up, +Z port.
 */
import type { ModelSpec } from './aircraft/specs'
import { doorBoxes } from './aircraft/stands'
import { beltGeom, catenaryPoints, cateringHinge, lineAnchor, MODEL_SIZE, type VehicleModel } from './vehicleModels'

export type SocketTable = Readonly<Record<string, readonly [number, number, number]>>

const tables = new Map<VehicleModel, SocketTable>()

/** Named points on one vehicle, in model metres. `dock` is the nose reference. */
export function vehicleSocketTable(model: VehicleModel): SocketTable {
  const hit = tables.get(model)
  if (hit) return hit
  const [L, H] = MODEL_SIZE[model]
  const sockets: Record<string, readonly [number, number, number]> = {
    dock: [L / 2, 0.2, 0],
  }
  const hose = lineAnchor(model, 'hose')
  if (hose) sockets.hose_reel_out = [hose[0], hose[1], hose[2]]
  if (model === 'belt_loader') {
    const g = beltGeom(L, H)
    const run = L * 0.9
    sockets.belt_tip = [g.lowX + Math.cos(g.pitch) * run, g.lowY + Math.sin(g.pitch) * run, 0]
  }
  if (model === 'catering_hilift') {
    const h = cateringHinge(L)
    sockets.catering_lip = [h.x, h.y + 2.4, 0]
  }
  if (model === 'stairs') sockets.stairs_top = [-L / 2 + 0.7, H - 0.8, 0]
  if (model === 'towbarless_tug') sockets.tug_hitch = [-L * 0.25, 0.3, 0]
  if (model === 'towbar_tug') sockets.tug_hitch = [L / 2 + 2.05, 0.47, 0]
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
  const pax = boxes.find((b) => (b.door.kind === 'pax' || b.door.kind === 'crew') && b.door.side !== 0)
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
  return {
    plane_fuel_port: [wingX, Math.max(1.2, wingY - 0.25), Math.max(spec.rx + 1.2, spec.spanM * 0.18)],
    plane_cargo_door_fwd: at(cargo, [nose - spec.lengthM * 0.35, centerY, spec.rx]),
    catering_door: at(service, side),
    plane_pax_door: at(pax, side),
    plane_nose_gear: [noseX, Math.max(0.35, spec.gear * 0.22), 0],
  }
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
