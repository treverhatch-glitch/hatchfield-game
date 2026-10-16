/**
 * Service stops for the legacy bowser and the bag / belt truck.
 *
 * The path still ends on the stand cell. The draw stop is this spot: the
 * tanker's hose ends on `plane_fuel_port`, and the bag truck's side (or the
 * belt tip) faces `plane_cargo_door_fwd`. A small airframe parks the bowser
 * further forward and more angled, clear of the low wing. A large airframe
 * keeps the bowser beside the port. The two sockets are reserved, so the
 * trucks do not share a point.
 */
import { AIRCRAFT_VISUAL_SCALE, METERS_PER_CELL, getAircraftSpec, type ModelSpec } from '../render/aircraft/specs.ts'
import { aircraftSocketTable, vehicleSocket } from '../render/socketLayout.ts'
import { beltGeom, HOSE_M, MODEL_SIZE, type VehicleModel } from '../render/vehicleModels.ts'
import { SERVICE_SPOT } from './serviceSpotData.ts'

export type SpotSize = 'small' | 'large'
export type SpotSocket = 'plane_fuel_port' | 'plane_cargo_door_fwd'

export interface SpotOrigin {
  /** Aircraft position in cells. */
  x: number
  y: number
  /** Radians, CCW from +column. Same frame as a flight heading. */
  heading: number
}

export interface ServiceSpot {
  x: number
  y: number
  heading: number
  socket: SpotSocket
  size: SpotSize
  /** Truck origin in drawn metres, aircraft frame. +x nose, +z port. */
  localX: number
  localZ: number
  /** Truck heading relative to the aircraft. */
  rel: number
  yaw: number
  /** Extra belt pitch at full deploy, radians. Zero on trucks that do not rise. */
  deck: number
  /** Metres the belt slides forward at full deploy so the tip stays on the door. */
  slide: number
}

interface LocalPose {
  cx: number
  cz: number
  theta: number
  yaw: number
}

interface TruckBox {
  model: VehicleModel
  length: number
  width: number
  height: number
}

const SCALE = AIRCRAFT_VISUAL_SCALE

function sizeOf(spec: ModelSpec): SpotSize {
  return spec.spanM <= SERVICE_SPOT.smallSpanM ? 'small' : 'large'
}

function axes(theta: number) {
  return {
    fx: Math.cos(theta),
    fz: Math.sin(theta),
    rx: -Math.sin(theta),
    rz: Math.cos(theta),
  }
}

function toCraft(pose: LocalPose, lx: number, lz: number) {
  const a = axes(pose.theta)
  return { x: pose.cx + lx * a.fx + lz * a.rx, z: pose.cz + lx * a.fz + lz * a.rz }
}

function poseFromAim(at: { x: number; z: number }, aimX: number, aimZ: number, theta: number, yaw: number): LocalPose {
  const a = axes(theta)
  return {
    cx: at.x - (aimX * a.fx + aimZ * a.rx),
    cz: at.z - (aimX * a.fz + aimZ * a.rz),
    theta,
    yaw,
  }
}

function drawnSocket(spec: ModelSpec, name: string): { x: number; y: number; z: number } | null {
  const local = aircraftSocketTable(spec)[name]
  if (!local) return null
  return { x: local[0] * SCALE, y: local[1] * SCALE, z: local[2] * SCALE }
}

function boxOf(model: VehicleModel): TruckBox {
  const [length, height, width] = MODEL_SIZE[model]
  return { model, length, width, height }
}

function sideOf(z: number): number {
  return z < 0 ? -1 : 1
}

/** Hose / nose direction that points inboard, swung `yaw` radians toward the tail. */
function inwardDir(side: number, yaw: number) {
  const x = -Math.sin(yaw)
  const z = -side * Math.cos(yaw)
  const len = Math.hypot(x, z) || 1
  return { x: x / len, z: z / len }
}

function thetaForRight(dir: { x: number; z: number }): number {
  return Math.atan2(-dir.x, dir.z)
}

function thetaForNose(dir: { x: number; z: number }): number {
  return Math.atan2(dir.z, dir.x)
}

function wingBox(spec: ModelSpec, gap: number) {
  const wingX = spec.lengthM * (0.5 - spec.wingAt) * SCALE
  const le = wingX + (spec.rootChord / 2) * SCALE + gap
  const sweep = Math.tan((spec.sweep * Math.PI) / 180) * (spec.spanM / 2) * SCALE
  const te = wingX - (spec.rootChord / 2) * SCALE - sweep - gap
  const inner = Math.max(0, spec.rx * SCALE - gap)
  const outer = (spec.spanM / 2) * SCALE + gap
  return { le, te, inner, outer }
}

function inFuselage(x: number, z: number, spec: ModelSpec, gap: number): boolean {
  const half = (spec.lengthM / 2) * SCALE
  const rad = spec.rx * SCALE + gap
  const ax = Math.abs(x)
  if (ax > half + gap) return false
  const body = Math.max(0, half - rad)
  if (ax <= body) return Math.abs(z) <= rad
  const dx = ax - body
  return dx * dx + z * z <= rad * rad
}

function inWing(x: number, z: number, spec: ModelSpec, gap: number): boolean {
  const wing = wingBox(spec, gap)
  const zAbs = Math.abs(z)
  return x >= wing.te && x <= wing.le && zAbs >= wing.inner && zAbs <= wing.outer
}

/** Underside of the drawn wing, metres. A truck roof under this misses the wing. */
function wingUnderside(spec: ModelSpec): number {
  const centerY = spec.gear + spec.ry
  const wingY = spec.wingHigh ? centerY + spec.ry * 0.7 : centerY - spec.ry * 0.28
  return Math.max(1.2, wingY - 0.25) * SCALE
}

function roofBlocked(spec: ModelSpec, truckH: number): boolean {
  return truckH + 0.15 > wingUnderside(spec)
}

function inTruck(px: number, pz: number, pose: LocalPose, truck: TruckBox, gap: number): boolean {
  const a = axes(pose.theta)
  const dx = px - pose.cx
  const dz = pz - pose.cz
  const lx = dx * a.fx + dz * a.fz
  const lz = dx * a.rx + dz * a.rz
  return Math.abs(lx) <= truck.length / 2 + gap && Math.abs(lz) <= truck.width / 2 + gap
}

function rectOverlap(a: LocalPose, aBox: TruckBox, b: LocalPose, bL: number, bW: number, gap: number): boolean {
  const aa = axes(a.theta)
  const ba = axes(b.theta)
  const dirs = [
    { x: aa.fx, z: aa.fz },
    { x: aa.rx, z: aa.rz },
    { x: ba.fx, z: ba.fz },
    { x: ba.rx, z: ba.rz },
  ]
  const dx = b.cx - a.cx
  const dz = b.cz - a.cz
  const reach = (pose: LocalPose, len: number, wid: number, ax: { x: number; z: number }) => {
    const p = axes(pose.theta)
    return Math.abs(p.fx * ax.x + p.fz * ax.z) * (len / 2) + Math.abs(p.rx * ax.x + p.rz * ax.z) * (wid / 2)
  }
  for (const ax of dirs) {
    const dist = Math.abs(dx * ax.x + dz * ax.z)
    if (dist > reach(a, aBox.length, aBox.width, ax) + reach(b, bL, bW, ax) + gap) return false
  }
  return true
}

function bodyHits(pose: LocalPose, spec: ModelSpec, truck: TruckBox): boolean {
  const gap = SERVICE_SPOT.skinGapM
  const corners = [
    [-0.5, -0.5],
    [-0.5, 0.5],
    [0.5, -0.5],
    [0.5, 0.5],
  ] as const
  for (const [u, v] of corners) {
    const p = toCraft(pose, u * truck.length, v * truck.width)
    if (inFuselage(p.x, p.z, spec, gap)) return true
    if (roofBlocked(spec, truck.height) && inWing(p.x, p.z, spec, gap)) return true
  }
  const half = (spec.lengthM / 2) * SCALE
  const rad = spec.rx * SCALE
  for (let x = -half; x <= half; x += 1.4) {
    for (const z of [0, rad * 0.55, -rad * 0.55]) {
      if (inTruck(x, z, pose, truck, gap)) return true
    }
  }
  if (!roofBlocked(spec, truck.height)) return false
  const wing = wingBox(spec, 0)
  const wingPose = (sign: number): LocalPose => ({
    cx: (wing.te + wing.le) / 2,
    cz: sign * (wing.inner + wing.outer) / 2,
    theta: 0,
    yaw: 0,
  })
  const wingL = Math.max(0.5, wing.le - wing.te)
  const wingW = Math.max(0.5, wing.outer - wing.inner)
  return rectOverlap(pose, truck, wingPose(1), wingL, wingW, gap) || rectOverlap(pose, truck, wingPose(-1), wingL, wingW, gap)
}

function segmentHits(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  spec: ModelSpec,
  exempt: { x: number; z: number } | null,
): boolean {
  const gap = SERVICE_SPOT.skinGapM
  const lower = wingUnderside(spec)
  const thick = Math.max(0.45, spec.rootChord * 0.14) * SCALE
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const x = from.x + (to.x - from.x) * t
    const z = from.z + (to.z - from.z) * t
    const y = from.y + (to.y - from.y) * t
    const along = exempt ? Math.hypot(x - exempt.x, z - exempt.z) : Infinity
    if (along > 0.85 && inFuselage(x, z, spec, gap * 0.35)) return true
    if (along > 1.05 && inWing(x, z, spec, 0) && y > lower - 0.08 && y < lower + thick) return true
  }
  return false
}

function hoseEnds(pose: LocalPose, truck: TruckBox): { reel: { x: number; y: number; z: number }; nozzle: { x: number; y: number; z: number } } | null {
  const reel = vehicleSocket(truck.model, 'hose_reel_out')
  if (!reel) return null
  const atReel = toCraft(pose, reel[0], reel[2])
  const atNozzle = toCraft(pose, reel[0], reel[2] + HOSE_M)
  return {
    reel: { x: atReel.x, y: reel[1], z: atReel.z },
    nozzle: { x: atNozzle.x, y: reel[1] + 0.5, z: atNozzle.z },
  }
}

function hoseHits(pose: LocalPose, spec: ModelSpec, truck: TruckBox, port: { x: number; y: number; z: number }): boolean {
  const ends = hoseEnds(pose, truck)
  if (!ends) return false
  const model = segmentHits(ends.reel, ends.nozzle, spec, port)
  const live = segmentHits(ends.reel, { x: port.x, y: port.y, z: port.z }, spec, port)
  return model || live
}

function fuelPose(port: { x: number; y: number; z: number }, truck: TruckBox, yaw: number): LocalPose {
  const side = sideOf(port.z)
  const dir = inwardDir(side, yaw)
  const theta = thetaForRight(dir)
  const reel = vehicleSocket(truck.model, 'hose_reel_out') ?? [0, 1.2, truck.width * 0.4]
  const aimX = reel[0]
  const aimZ = reel[2] + HOSE_M
  return poseFromAim(port, aimX, aimZ, theta, yaw)
}

/**
 * Small airframes: the bowser sits forward of the wing, hose aimed at the port.
 * Locking the 5 m nozzle on the port swings the tail into the fuselage, so the
 * search keeps the body clear and picks the aim that lands the nozzle closest.
 */
function solveSmallFuel(spec: ModelSpec, port: { x: number; y: number; z: number }, truck: TruckBox): LocalPose {
  const side = sideOf(port.z)
  const le = wingBox(spec, SERVICE_SPOT.skinGapM).le
  const minOut = spec.rx * SCALE + truck.width / 2 + SERVICE_SPOT.skinGapM + 0.4
  let best: { pose: LocalPose; miss: number } | null = null
  for (let yaw = SERVICE_SPOT.fuel.smallYaw; yaw <= 1.15; yaw += 0.07) {
    const dir = inwardDir(side, yaw)
    const theta = thetaForRight(dir)
    for (let fore = 0; fore <= 7; fore += 0.7) {
      for (let out = 0; out <= 5; out += 0.55) {
        const pose: LocalPose = {
          cx: le + truck.length / 2 + fore,
          cz: side * (minOut + out),
          theta,
          yaw,
        }
        if (bodyHits(pose, spec, truck) || hoseHits(pose, spec, truck, port)) continue
        const ends = hoseEnds(pose, truck)
        const miss = ends ? Math.hypot(ends.nozzle.x - port.x, ends.nozzle.z - port.z) : 99
        if (!best || miss < best.miss - 0.05) best = { pose, miss }
      }
    }
  }
  return best?.pose ?? fuelPose(port, truck, SERVICE_SPOT.fuel.smallYaw)
}

function solveFuel(spec: ModelSpec, port: { x: number; y: number; z: number }, truck: TruckBox, size: SpotSize): LocalPose {
  if (size === 'small') return solveSmallFuel(spec, port, truck)
  const min = SERVICE_SPOT.fuel.largeYaw
  let last = fuelPose(port, truck, min)
  for (let yaw = min; yaw <= 0.95 + 1e-6; yaw += 0.04) {
    last = fuelPose(port, truck, yaw)
    if (!bodyHits(last, spec, truck) && !hoseHits(last, spec, truck, port)) return last
  }
  return last
}

function bagPose(door: { x: number; z: number }, truck: TruckBox, yaw: number, nose: boolean): LocalPose {
  const side = sideOf(door.z)
  const dir = inwardDir(side, yaw)
  const gap = SERVICE_SPOT.skinGapM
  const at = { x: door.x - dir.x * gap, z: door.z - dir.z * gap }
  if (nose) {
    const tip = vehicleSocket(truck.model, 'belt_tip') ?? [truck.length / 2, 1, 0]
    return poseFromAim(at, tip[0], tip[2], thetaForNose(dir), yaw)
  }
  return poseFromAim(at, 0, truck.width / 2, thetaForRight(dir), yaw)
}

function tooClose(a: LocalPose, aBox: TruckBox, b: LocalPose, bBox: TruckBox): boolean {
  const dist = Math.hypot(a.cx - b.cx, a.cz - b.cz)
  return dist < SERVICE_SPOT.minSeparationM || rectOverlap(a, aBox, b, bBox.length, bBox.width, SERVICE_SPOT.skinGapM)
}

function shoveClear(mover: LocalPose, moverBox: TruckBox, spec: ModelSpec, blocks: { pose: LocalPose; box: TruckBox }[]) {
  const doorSide = sideOf(mover.cz)
  for (let n = 0; n < 48; n++) {
    const hitBody = bodyHits(mover, spec, moverBox)
    const hitTruck = blocks.some((b) => tooClose(mover, moverBox, b.pose, b.box))
    if (!hitBody && !hitTruck) return
    const near = blocks.reduce((best, b) => {
      const d = Math.hypot(mover.cx - b.pose.cx, mover.cz - b.pose.cz)
      return d < best.d ? { d, pose: b.pose } : best
    }, { d: Infinity, pose: blocks[0]?.pose ?? mover })
    const dir = Math.sign(mover.cx - near.pose.cx) || -1
    mover.cx += dir * 0.45
    if (hitBody) mover.cz += doorSide * 0.3
  }
}

function publish(pose: LocalPose, origin: SpotOrigin, socket: SpotSocket, size: SpotSize, deck = 0, slide = 0): ServiceSpot {
  const h = origin.heading
  const fx = Math.cos(h)
  const fy = Math.sin(h)
  const rx = -Math.sin(h)
  const ry = Math.cos(h)
  return {
    x: origin.x + (pose.cx * fx + pose.cz * rx) / METERS_PER_CELL,
    y: origin.y + (pose.cx * fy + pose.cz * ry) / METERS_PER_CELL,
    heading: h + pose.theta,
    socket,
    size,
    localX: pose.cx,
    localZ: pose.cz,
    rel: pose.theta,
    yaw: pose.yaw,
    deck,
    slide,
  }
}

/** Belt tip after the deploy rotation, model metres. The built belt already sits at `beltGeom.pitch`. */
function beltTipLocal(rz: number): { x: number; y: number; z: number } {
  const [L, , W] = MODEL_SIZE.belt_loader
  const g = beltGeom(L, MODEL_SIZE.belt_loader[1])
  const run = L * 0.9
  const dx = Math.cos(g.pitch) * run
  const dy = Math.sin(g.pitch) * run
  const c = Math.cos(rz)
  const s = Math.sin(rz)
  return { x: g.lowX + dx * c - dy * s, y: g.lowY + dx * s + dy * c, z: W * 0.15 }
}

/** Extra pitch that lifts the belt tip to `height` metres in the drawn frame. */
function deckForHeight(height: number): number {
  const [L, H] = MODEL_SIZE.belt_loader
  const g = beltGeom(L, H)
  const run = L * 0.9
  const rise = Math.min(run * 0.9, Math.max(0.35, height - g.lowY))
  return Math.asin(rise / run) - g.pitch
}

function wingBandAt(spec: ModelSpec, zDrawn: number): { low: number; high: number } {
  const z = Math.abs(zDrawn) / SCALE
  const centerY = spec.gear + spec.ry
  const wingY = spec.wingHigh ? centerY + spec.ry * 0.7 : centerY - spec.ry * 0.28
  const under = wingY + Math.tan((spec.dihedral * Math.PI) / 180) * z - spec.thickness * 0.5
  const over = under + spec.thickness
  return { low: under * SCALE, high: over * SCALE }
}

/** Nacelle keep-out in drawn metres. The boom has to miss the pod, not only the wing sheet. */
function nacelleHit(spec: ModelSpec, x: number, y: number, z: number): boolean {
  const eng = spec.engines
  if (eng.mount !== 'wing') return false
  const rx = x / SCALE
  const ry = y / SCALE
  const rz = z / SCALE
  const semi = spec.spanM / 2
  const fracs = eng.count >= 4 ? [0.25, 0.52] : [spec.spanM >= 55 ? 0.34 : 0.3]
  const wingX = spec.lengthM * (0.5 - spec.wingAt)
  const centerY = spec.gear + spec.ry
  const wingY = spec.wingHigh ? centerY + spec.ry * 0.7 : centerY - spec.ry * 0.28
  const tanSweep = Math.tan((spec.sweep * Math.PI) / 180)
  const tanDih = Math.tan((spec.dihedral * Math.PI) / 180)
  for (const frac of fracs) {
    const ez = semi * frac
    const le = wingX + spec.rootChord / 2 - tanSweep * ez
    const cy = wingY + tanDih * ez - eng.radius * 1.3 - spec.thickness * 0.2
    const cx = le + eng.length * 0.12
    const x0 = cx - eng.length * 0.2
    const x1 = cx + eng.length * 0.75
    for (const sign of [1, -1]) {
      const clamped = Math.min(x1, Math.max(x0, rx))
      const horiz = Math.hypot(rx - clamped, rz - sign * ez)
      if (horiz < eng.radius + 0.7 && Math.abs(ry - cy) < eng.radius + 0.55) return true
    }
  }
  return false
}

/** Raised belt boom against the fuselage and the wing. The tip may meet the door. */
function boomHits(pose: LocalPose, spec: ModelSpec, tip: { x: number; y: number; z: number }, door: { x: number; z: number }): boolean {
  const [L, H] = MODEL_SIZE.belt_loader
  const g = beltGeom(L, H)
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const lx = g.lowX + (tip.x - g.lowX) * t
    const ly = g.lowY + (tip.y - g.lowY) * t
    for (const zOff of [-0.48, 0, 0.48]) {
      const p = toCraft(pose, lx, tip.z + zOff)
      const along = Math.hypot(p.x - door.x, p.z - door.z)
      if (along > 0.9 && inFuselage(p.x, p.z, spec, 0.2)) return true
      if (nacelleHit(spec, p.x, ly, p.z)) return true
      if (along > 1.15 && inWing(p.x, p.z, spec, 0.15)) {
        const band = wingBandAt(spec, p.z)
        if (ly > band.low - 0.15 && ly < band.high + 0.2) return true
      }
    }
  }
  return false
}

/**
 * Park the bumper just outside the skin. The belt then slides forward as it
 * rises so the tip meets the door without the chassis following it in.
 * Orbit until the chassis and the raised boom are clear of the wing, the
 * fuselage, and the bowser. Rectangle clearance, not a centre gap: on a
 * regional the fuel port and the cargo door are closer than 8 m.
 */
function solveBelt(
  spec: ModelSpec,
  door: { x: number; y: number; z: number },
  truck: TruckBox,
  blocks: { pose: LocalPose; box: TruckBox }[],
): { pose: LocalPose; deck: number; slide: number } {
  const deck = deckForHeight(door.y)
  const tip = beltTipLocal(deck)
  const reach = SERVICE_SPOT.skinGapM + 1.7
  const slide = truck.length / 2 + reach - tip.x
  const raised = { x: tip.x + slide, y: tip.y, z: tip.z }
  const side = sideOf(door.z)
  let fallback: { pose: LocalPose; deck: number; slide: number } | null = null
  for (let yaw = -1.2; yaw <= 2.4; yaw += 0.05) {
    const dir = inwardDir(side, yaw)
    const theta = thetaForNose(dir)
    // Raised tip meets the door. The chassis bumper stays `reach` metres outside.
    const pose = poseFromAim(door, truck.length / 2 + reach, tip.z, theta, yaw)
    const blocked = blocks.some((b) => rectOverlap(pose, truck, b.pose, b.box.length, b.box.width, SERVICE_SPOT.skinGapM))
    const body = bodyHits(pose, spec, truck)
    const boom = boomHits(pose, spec, raised, door)
    if (!body && !boom && !fallback) fallback = { pose, deck, slide }
    if (!body && !boom && !blocked) return { pose, deck, slide }
  }
  return fallback ?? { pose: bagPose(door, truck, SERVICE_SPOT.belt.smallYaw, true), deck, slide }
}

function beltFoot(pose: LocalPose): { x: number; z: number } {
  const [L, H, W] = MODEL_SIZE.belt_loader
  const g = beltGeom(L, H)
  return toCraft(pose, g.lowX, W * 0.15)
}

/** Fuel bowser, bag train, and belt loader. Each socket is its own stop. */
export function reservedSpots(airframeId: string, origin: SpotOrigin): { fuel: ServiceSpot; bags: ServiceSpot; belt: ServiceSpot } {
  const spec = getAircraftSpec(airframeId || 'b738')
  const size = sizeOf(spec)
  const port = drawnSocket(spec, 'plane_fuel_port') ?? { x: 0, y: 2, z: spec.spanM * 0.2 * SCALE }
  const door = drawnSocket(spec, 'plane_cargo_door_fwd') ?? drawnSocket(spec, 'plane_hold') ?? { x: spec.lengthM * 0.15 * SCALE, y: 1.5, z: spec.rx * SCALE }
  const fuelTruck = boxOf('fuel_tanker')
  const bagTruck = boxOf('baggage_train')
  const beltTruck = boxOf('belt_loader')
  const fuel = solveFuel(spec, port, fuelTruck, size)
  const raised = solveBelt(spec, door, beltTruck, [{ pose: fuel, box: fuelTruck }])
  const bags = solveBagsAtFoot(spec, beltFoot(raised.pose), bagTruck, raised.pose, beltTruck, fuel, fuelTruck)
  return {
    fuel: publish(fuel, origin, 'plane_fuel_port', size),
    bags: publish(bags, origin, 'plane_cargo_door_fwd', size),
    belt: publish(raised.pose, origin, 'plane_cargo_door_fwd', size, raised.deck, raised.slide),
  }
}

/** Bag train beside the belt foot. It stays off the fuel bowser and off the loader. */
function solveBagsAtFoot(
  spec: ModelSpec,
  foot: { x: number; z: number },
  truck: TruckBox,
  belt: LocalPose,
  beltBox: TruckBox,
  fuel: LocalPose,
  fuelBox: TruckBox,
): LocalPose {
  let best = bagPose(foot, truck, SERVICE_SPOT.bags.largeYaw, false)
  for (let yaw = 0.05; yaw <= 1.25; yaw += 0.05) {
    const pose = bagPose(foot, truck, yaw, false)
    if (bodyHits(pose, spec, truck)) continue
    if (rectOverlap(pose, truck, belt, beltBox.length, beltBox.width, SERVICE_SPOT.skinGapM)) continue
    if (tooClose(pose, truck, fuel, fuelBox)) continue
    return pose
  }
  shoveClear(best, truck, spec, [
    { pose: belt, box: beltBox },
    { pose: fuel, box: fuelBox },
  ])
  return best
}

export interface SpotAudit {
  size: SpotSize
  clear: boolean
  body: boolean
  hose: boolean
  yaw: number
  localX: number
  localZ: number
  /** Metres from the truck origin to the socket it serves. */
  socketDist: number
  /** Metres from this truck origin to the other two. */
  gaps: number[]
  /** Metres from the raised belt tip to the cargo door. 0 for other trucks. */
  tipApart: number
  deck: number
}

function auditOne(
  spec: ModelSpec,
  spot: ServiceSpot,
  model: VehicleModel,
  socketName: string,
  others: ServiceSpot[],
  hose: boolean,
): SpotAudit {
  const pose: LocalPose = { cx: spot.localX, cz: spot.localZ, theta: spot.rel, yaw: spot.yaw }
  const truck = boxOf(model)
  const socket = drawnSocket(spec, socketName) ?? { x: 0, y: 0, z: 0 }
  const tip = beltTipLocal(spot.deck)
  const raised = toCraft(pose, tip.x + spot.slide, tip.z)
  const body = bodyHits(pose, spec, truck)
  const boom = model === 'belt_loader' ? boomHits(pose, spec, { x: tip.x + spot.slide, y: tip.y, z: tip.z }, socket) : false
  const hoseHit = hose ? hoseHits(pose, spec, truck, socket) : false
  const tipApart = model === 'belt_loader' ? Math.hypot(raised.x - socket.x, raised.z - socket.z, tip.y - socket.y) : 0
  return {
    size: spot.size,
    clear: !body && !hoseHit && !boom,
    body: !body,
    hose: !hoseHit,
    yaw: spot.yaw,
    localX: spot.localX,
    localZ: spot.localZ,
    socketDist: Math.hypot(spot.localX - socket.x, spot.localZ - socket.z),
    gaps: others.map((o) => Math.hypot(spot.localX - o.localX, spot.localZ - o.localZ)),
    tipApart,
    deck: spot.deck,
  }
}

function spotPose(spot: ServiceSpot): LocalPose {
  return { cx: spot.localX, cz: spot.localZ, theta: spot.rel, yaw: spot.yaw }
}

function trucksOverlap(a: ServiceSpot, aModel: VehicleModel, b: ServiceSpot, bModel: VehicleModel): boolean {
  const box = boxOf(bModel)
  return rectOverlap(spotPose(a), boxOf(aModel), spotPose(b), box.length, box.width, 0.05)
}

/** Clearance of the three reserved stops for one airframe. Tests and the proof log read this. */
export function auditSpots(airframeId: string): { fuel: SpotAudit; bags: SpotAudit; belt: SpotAudit; portX: number; leadingX: number; vehiclesClear: boolean } {
  const spec = getAircraftSpec(airframeId || 'b738')
  const spots = reservedSpots(airframeId, { x: 0, y: 0, heading: 0 })
  const port = drawnSocket(spec, 'plane_fuel_port') ?? { x: 0, y: 0, z: 0 }
  const wingX = spec.lengthM * (0.5 - spec.wingAt) * SCALE
  const leadingX = wingX + (spec.rootChord / 2) * SCALE
  return {
    fuel: auditOne(spec, spots.fuel, 'fuel_tanker', 'plane_fuel_port', [spots.bags, spots.belt], true),
    bags: auditOne(spec, spots.bags, 'baggage_train', 'plane_cargo_door_fwd', [spots.fuel, spots.belt], false),
    belt: auditOne(spec, spots.belt, 'belt_loader', 'plane_cargo_door_fwd', [spots.fuel, spots.bags], false),
    portX: port.x,
    leadingX,
    vehiclesClear:
      !trucksOverlap(spots.fuel, 'fuel_tanker', spots.bags, 'baggage_train') &&
      !trucksOverlap(spots.fuel, 'fuel_tanker', spots.belt, 'belt_loader') &&
      !trucksOverlap(spots.bags, 'baggage_train', spots.belt, 'belt_loader'),
  }
}

/** 0 on the road, 1 parked on the socket. Shared by the legacy blend and the logistics dock. */
export function dockBlend(phase: string, u: number): number {
  const t = u <= 0 ? 0 : u >= 1 ? 1 : u
  if (phase === 'service') return 1
  if (phase === 'align') return 0.72 + 0.28 * t
  if (phase === 'approach') return t * 0.85
  if (phase === 'depart') return 1 - t
  return 0
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

const FUEL_TYPES = new Set(['fuel', 'fuel_truck', 'heavy_fuel_truck'])
const BAG_TYPES = new Set(['bags', 'baggage_tug', 'heavy_baggage_tug', 'baggage_train'])
const BELT_TYPES = new Set(['belt_loader'])

/** Which reserved stop a vehicle type uses. Null for catering, tugs, and the rest. */
export function spotForType(type: string | undefined): 'fuel' | 'bags' | 'belt' | null {
  if (!type) return null
  if (FUEL_TYPES.has(type)) return 'fuel'
  if (BELT_TYPES.has(type)) return 'belt'
  if (BAG_TYPES.has(type)) return 'bags'
  return null
}
