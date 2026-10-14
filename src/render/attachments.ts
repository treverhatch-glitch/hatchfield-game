/**
 * Empty socket objects and the locks that read their world positions.
 * Nothing here stores a dock offset: a lock copies one socket onto another,
 * and the hose is a catenary between the reel socket and the nozzle.
 */
import * as THREE from 'three'
import { buildAircraft } from './aircraft/build'
import { getAircraftSpec, type Livery } from './aircraft/specs'
import { poseFor, standAnchors, type AnchorSpec } from '../logistics/serviceFlow'
import { LOCK_TOLERANCE_M, STAND_AIRFRAME, STEP_LOCKS, TURN_STEPS, VEHICLE_DOCKS, type StandSize, type TurnStep } from '../logistics/socketTurn'
import { aircraftSocketTable, CREW_SOCKETS, hoseSpan } from './socketLayout'
import { mountSockets } from './socketMount'
import { disposeVehicleRig, vehicleRig } from './vehicles'

const _pa = new THREE.Vector3()
const _pb = new THREE.Vector3()

export function crewRig(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'crew'
  mountSockets(g, CREW_SOCKETS)
  return g
}

export function aircraftSocketRig(airframeId: string): THREE.Group {
  const g = new THREE.Group()
  g.name = 'aircraft'
  g.userData.airframeId = airframeId
  mountSockets(g, aircraftSocketTable(getAircraftSpec(airframeId)))
  return g
}

/** Parent `prop` to `socket` and zero its local transform so they share a world position. */
export function lockTo(prop: THREE.Object3D, socket: THREE.Object3D) {
  socket.add(prop)
  prop.position.set(0, 0, 0)
  prop.rotation.set(0, 0, 0)
  prop.updateMatrixWorld(true)
}

export function worldGap(a: THREE.Object3D, b: THREE.Object3D): number {
  a.getWorldPosition(_pa)
  b.getWorldPosition(_pb)
  return _pa.distanceTo(_pb)
}

/** Slide a vehicle, keeping its heading, until `socketName` sits on `target`. */
export function parkSocket(vehicle: THREE.Object3D, socketName: string, target: THREE.Object3D) {
  const socket = vehicle.getObjectByName(socketName)
  if (!socket) throw new Error(`missing socket ${socketName}`)
  vehicle.updateMatrixWorld(true)
  target.getWorldPosition(_pb)
  const offset = socket.position.clone().applyQuaternion(vehicle.quaternion)
  vehicle.position.copy(_pb).sub(offset)
  vehicle.updateMatrixWorld(true)
}

function need(root: THREE.Object3D, name: string): THREE.Object3D {
  const o = root.getObjectByName(name)
  if (!o) throw new Error(`missing socket ${name}`)
  return o
}

function place(vehicle: THREE.Object3D, anchor: AnchorSpec, phase: 'approach' | 'align' | 'service' | 'depart', u: number) {
  const pose = poseFor(anchor, phase, u, 0, 0)
  vehicle.rotation.set(0, -pose.heading, 0)
  vehicle.position.set(pose.localX, 0, pose.localY)
  vehicle.updateMatrixWorld(true)
}

export interface TurnReport {
  steps: string[]
  maxLockGap: number
  loose: string[]
  /** Fuel truck distance from its service stop while fueling, metres. */
  fuelStopGap: number
  /** How far the fuel truck still is from that stop during approach. */
  approachGap: number
  hoseMinY: number
  /** Belt tip leaves the cargo door again on depart. */
  departedGap: number
}

/**
 * One full turn on a stand, using socket world positions only.
 * The returned root still holds the rigs; dispose it with disposeTurnaround.
 */
export function runTurnaround(size: StandSize): { root: THREE.Group; report: TurnReport } {
  const airframe = STAND_AIRFRAME[size]
  const root = new THREE.Group()
  root.name = 'turnaround'
  const aircraft = aircraftSocketRig(airframe)
  root.add(aircraft)

  const fuel = vehicleRig('fuel', '#c9a227')
  const belt = vehicleRig('belt_loader', '#d5d8dc')
  const cater = vehicleRig('catering', '#e8eef5')
  const stairs = vehicleRig('stairs', '#f4f5f6')
  const tug = vehicleRig('pushback_tug', '#d5d8dc')
  const crew = crewRig()
  for (const v of [fuel, belt, cater, stairs, tug, crew]) root.add(v)

  const nozzle = new THREE.Object3D()
  nozzle.name = 'hose_nozzle'
  nozzle.userData.prop = true
  lockTo(nozzle, need(fuel, 'hose_reel_out'))

  const anchors = standAnchors(size, size)
  const byKind = (kind: string) => anchors.find((a) => a.kind === kind)!
  const pax = need(aircraft, 'plane_pax_door')
  const paxSide = Math.sign(pax.position.z) || 1
  const stairsAnchor: AnchorSpec = {
    id: `${size}:stairs`,
    kind: 'dock',
    ownerId: size,
    owner: 'stand',
    x: pax.position.x,
    y: pax.position.z + paxSide * 6,
    heading: paxSide > 0 ? -Math.PI / 2 : Math.PI / 2,
    bays: 1,
    ratePerBay: 1,
  }
  const vehicles: Record<string, { obj: THREE.Object3D; anchor: AnchorSpec }> = {
    fuel: { obj: fuel, anchor: byKind('fuel_hose') },
    belt: { obj: belt, anchor: byKind('baggage_hold') },
    cater: { obj: cater, anchor: byKind('catering_door') },
    stairs: { obj: stairs, anchor: stairsAnchor },
    tug: { obj: tug, anchor: byKind('pushback') },
  }

  // Stairs meet the door with the top platform, which is at the rear of the truck.
  const dockYaw: Partial<Record<string, number>> = {
    dock_stairs: paxSide > 0 ? -Math.PI / 2 : Math.PI / 2,
  }

  const report: TurnReport = {
    steps: [],
    maxLockGap: 0,
    loose: [],
    fuelStopGap: Infinity,
    approachGap: 0,
    hoseMinY: Infinity,
    departedGap: 0,
  }

  const fuelStop = poseFor(vehicles.fuel.anchor, 'service', 1, 0, 0)

  const apply = (step: TurnStep) => {
    report.steps.push(step)
    const phase = step === 'approach' ? 'approach' : step === 'align' ? 'align' : step === 'depart' ? 'depart' : 'service'
    const u = step === 'approach' ? 0 : 1
    for (const v of Object.values(vehicles)) place(v.obj, v.anchor, phase, u)

    if (step === 'carry_hose') {
      crew.position.copy(fuel.position)
      crew.rotation.copy(fuel.rotation)
      const reel = need(fuel, 'hose_reel_out')
      reel.getWorldPosition(_pa)
      crew.position.set(_pa.x + 0.4, 0, _pa.z + 0.6)
      crew.updateMatrixWorld(true)
    }

    const dock = (VEHICLE_DOCKS as readonly string[]).includes(step)
    if (dock && step !== 'depart') {
      const spec = STEP_LOCKS[step]!
      const truck = step === 'dock_belt' ? belt : step === 'dock_catering' ? cater : step === 'dock_stairs' ? stairs : tug
      if (dockYaw[step] !== undefined) {
        truck.rotation.y = dockYaw[step]!
        truck.updateMatrixWorld(true)
      }
      parkSocket(truck, spec.from, need(aircraft, spec.to))
    }

    const lock = STEP_LOCKS[step]
    if (lock && lock.from === 'hose_nozzle') lockTo(nozzle, need(step === 'carry_hose' ? crew : lock.to === 'plane_fuel_port' ? aircraft : fuel, lock.to))

    root.updateMatrixWorld(true)

    if (lock) {
      const from = lock.from === 'hose_nozzle' ? nozzle : need(root, lock.from)
      const gap = worldGap(from, need(root, lock.to))
      if (gap > report.maxLockGap) report.maxLockGap = gap
      if (lock.to === 'plane_fuel_port' || lock.to === 'crew_hand_r' || (lock.to === 'hose_reel_out' && step !== 'depart')) {
        const reel = need(fuel, 'hose_reel_out')
        reel.getWorldPosition(_pa)
        from.getWorldPosition(_pb)
        for (const p of hoseSpan([_pa.x, _pa.y, _pa.z], [_pb.x, _pb.y, _pb.z])) {
          if (p[1] < report.hoseMinY) report.hoseMinY = p[1]
        }
      }
    }

    if (step === 'approach') {
      report.approachGap = Math.hypot(fuel.position.x - fuelStop.localX, fuel.position.z - fuelStop.localY)
    }
    if (step === 'fuel') {
      report.fuelStopGap = Math.hypot(fuel.position.x - fuelStop.localX, fuel.position.z - fuelStop.localY)
    }
    if (step === 'depart') {
      report.departedGap = worldGap(need(belt, 'belt_tip'), need(aircraft, 'plane_cargo_door_fwd'))
    }

    root.traverse((o) => {
      if (!o.userData.prop) return
      o.getWorldPosition(_pa)
      const held = o.parent?.name && o.parent.name !== 'turnaround' && o.parent.name !== 'sockets'
      if (!held && _pa.y > LOCK_TOLERANCE_M) report.loose.push(`${step}:${o.name}`)
    })
  }

  for (const step of TURN_STEPS) apply(step)
  return { root, report }
}

export function disposeTurnaround(root: THREE.Object3D) {
  disposeVehicleRig(root)
}

const PREVIEW_LIVERY: Livery = { body: '#f4f7fb', stripe: '#1f4e79', tail: '#1f4e79', airline: 'northline' }

/** Aircraft, tanker and a hose whose ends are the reel socket and the wing port. */
export function fuelLockScene(): { root: THREE.Group; look: THREE.Vector3; cam: THREE.Vector3 } {
  const spec = getAircraftSpec('b738')
  const root = new THREE.Group()
  const built = buildAircraft(spec, 'mid', PREVIEW_LIVERY)
  built.group.name = 'aircraft'
  mountSockets(built.group, aircraftSocketTable(spec))
  root.add(built.group)

  const fuel = vehicleRig('fuel', '#c9a227')
  const hoseMesh = fuel.getObjectByName('hose')
  if (hoseMesh) hoseMesh.visible = false
  root.add(fuel)

  const port = need(built.group, 'plane_fuel_port')
  port.getWorldPosition(_pb)
  // Park outboard of the port with the hose side (+Z) pointing inboard.
  fuel.rotation.y = Math.PI
  fuel.position.set(_pb.x - 1.5, 0, _pb.z + 5.5)
  fuel.updateMatrixWorld(true)

  const nozzle = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.12, 0.28),
    new THREE.MeshLambertMaterial({ color: '#4a5158' }),
  )
  nozzle.name = 'hose_nozzle'
  lockTo(nozzle, port)

  const reel = need(fuel, 'hose_reel_out')
  reel.getWorldPosition(_pa)
  nozzle.getWorldPosition(_pb)
  const pts = hoseSpan([_pa.x, _pa.y, _pa.z], [_pb.x, _pb.y, _pb.z], 0.7, 16).map((p) => new THREE.Vector3(p[0], p[1], p[2]))
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.055, 6, false),
    new THREE.MeshLambertMaterial({ color: '#1e2226' }),
  )
  tube.name = 'hose_span'
  root.add(tube)

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12),
    new THREE.MeshLambertMaterial({ color: '#c9a227' }),
  )
  cap.rotation.z = Math.PI / 2
  port.add(cap)
  cap.position.set(0, 0, 0.12)

  const look = _pb.clone()
  const cam = look.clone().add(new THREE.Vector3(3.2, 1.4, 2.4))
  return { root, look, cam }
}
