/**
 * Items move by handing off one named socket to the next.
 * A hop longer than HANDOFF_STEP_M is a teleport. Between locks the item
 * rides the straight segment, or a catenary for the fuel coupler.
 */
import * as THREE from 'three'
import { buildAircraft } from './aircraft/build'
import { getAircraftSpec, type Livery } from './aircraft/specs'
import {
  BAG_STEPS,
  CATERING_STEPS,
  FUEL_STEPS,
  HANDOFF_STEP_M,
  LOCK_TOLERANCE_M,
  PAX_STEPS,
  STAND_AIRFRAME,
  ULD_STEPS,
  type FlowName,
  type StandSize,
} from '../logistics/socketTurn'
import { lockTo, parkSocket, worldGap } from './attachments'
import {
  CAROUSEL_SOCKETS,
  FARM_SOCKETS,
  ITEM_SOCKETS,
  aircraftSocketTable,
  bridgeSocketTable,
  checkinRowSockets,
  hoseSpan,
} from './socketLayout'
import { mountSockets } from './socketMount'
import { disposeVehicleRig, vehicleRig } from './vehicles'

const _pa = new THREE.Vector3()
const _pb = new THREE.Vector3()
const _pc = new THREE.Vector3()

export interface FlowReport {
  steps: string[]
  maxLockGap: number
  maxJump: number
  loose: string[]
  minY: number
  /** World distance from the hold lock to the carousel lock. */
  holdToClaim: number
  docks: Record<string, number>
  /** Parent socket name at the end of the flow. */
  ended: string
}

export interface JourneyReport {
  bag: FlowReport
  uld: FlowReport
  catering: FlowReport
  pax: FlowReport
  fuel: FlowReport
}

function blank(): FlowReport {
  return { steps: [], maxLockGap: 0, maxJump: 0, loose: [], minY: Infinity, holdToClaim: 0, docks: {}, ended: '' }
}

function need(root: THREE.Object3D, name: string): THREE.Object3D {
  const o = root.getObjectByName(name)
  if (!o) throw new Error(`missing socket ${name}`)
  return o
}

function station(name: string, table: Record<string, readonly [number, number, number]>, x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.name = name
  g.position.set(x, 0, z)
  mountSockets(g, table)
  return g
}

function item(kind: keyof typeof ITEM_SOCKETS, color: string, size: readonly [number, number, number], sit = true): THREE.Group {
  const g = new THREE.Group()
  g.name = kind
  g.userData.prop = true
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshLambertMaterial({ color }))
  if (sit) mesh.position.y = size[1] / 2
  mesh.name = `${kind}_mesh`
  g.add(mesh)
  mountSockets(g, ITEM_SOCKETS[kind])
  return g
}

function restOf(prop: THREE.Object3D): THREE.Object3D {
  const named = prop.getObjectByName(
    prop.name === 'bag' ? 'bag_rest' : prop.name === 'uld' ? 'uld_lock' : prop.name === 'catering_cart' ? 'cart_deck' : prop.name === 'passenger' ? 'pax_feet' : 'coupler_jaw',
  )
  return named ?? prop
}

/** Points along a polyline, never more than `step` apart. Endpoints are kept. */
export function resample(points: readonly THREE.Vector3[], step: number): THREE.Vector3[] {
  if (points.length === 0) return []
  const out = [points[0].clone()]
  let remain = step
  for (let i = 1; i < points.length; i++) {
    let a = out[out.length - 1]
    const b = points[i]
    let seg = a.distanceTo(b)
    if (seg < 1e-8) continue
    while (seg >= remain - 1e-8) {
      const t = seg < 1e-8 ? 1 : remain / seg
      const p = a.clone().lerp(b, Math.min(1, t))
      out.push(p)
      a = p
      seg = a.distanceTo(b)
      remain = step
      if (seg < 1e-6) break
    }
    remain -= seg
  }
  const last = points[points.length - 1]
  if (out[out.length - 1].distanceTo(last) > 1e-4) out.push(last.clone())
  return out
}

/**
 * Every stand size: a bag goes check-in → hold → carousel, and the other
 * loads hand off their own sockets on the same apron.
 */
export function runJourneys(size: StandSize): { root: THREE.Group; report: JourneyReport } {
  const root = new THREE.Group()
  root.name = 'journey'
  const span = new THREE.Object3D()
  span.name = 'span'
  root.add(span)

  const aircraft = new THREE.Group()
  aircraft.name = 'aircraft'
  mountSockets(aircraft, aircraftSocketTable(getAircraftSpec(STAND_AIRFRAME[size])))
  root.add(aircraft)

  const door = need(aircraft, 'plane_cargo_door_fwd')
  const side = Math.sign(door.position.z) || 1
  const checkin = station('checkin', checkinRowSockets(), door.position.x - 28, door.position.z)
  const carousel = station('carousel', CAROUSEL_SOCKETS, door.position.x - 18, door.position.z + side * 16)
  const farm = station('farm', FARM_SOCKETS, door.position.x - 14, door.position.z - side * 14)
  root.add(checkin, carousel, farm)

  const loader = vehicleRig('belt_loader', '#d5d8dc')
  const cart = vehicleRig('cart', '#c4b7a6')
  const dolly = vehicleRig('dolly', '#8a939c')
  const lifter = vehicleRig('cargo', '#4a5568')
  const cater = vehicleRig('catering', '#e8eef5')
  const truck = vehicleRig('fuel', '#c9a227')
  loader.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
  lifter.rotation.y = loader.rotation.y
  cater.rotation.y = loader.rotation.y
  // Deck faces the hold. The dolly stops beside it; the ULD climbs the last metres.
  lifter.position.set(door.position.x - 1.2, 0, door.position.z + side * 5.5)
  for (const v of [loader, cart, dolly, lifter, cater, truck]) root.add(v)

  const bag = item('bag', '#6e2e2e', [0.72, 0.48, 0.34])
  const uld = item('uld', '#c5ccd3', [1.53, 1.4, 1.53])
  const meal = item('catering_cart', '#d8dee6', [0.55, 1.05, 0.75])
  const pax = item('passenger', '#1f4e79', [0.4, 1.72, 0.28])
  const coupler = item('coupler', '#4a5158', [0.22, 0.16, 0.28], false)
  root.add(bag, uld, meal, pax, coupler)

  const bridge = new THREE.Group()
  bridge.name = 'bridge'
  mountSockets(bridge, bridgeSocketTable(getAircraftSpec(STAND_AIRFRAME[size]), side > 0 ? 1 : -1))
  root.add(bridge)

  const report: JourneyReport = {
    bag: blank(),
    uld: blank(),
    catering: blank(),
    pax: blank(),
    fuel: blank(),
  }
  const props = [bag, uld, meal, pax, coupler]

  const note = (flow: FlowReport, prev: THREE.Vector3, next: THREE.Vector3) => {
    const jump = prev.distanceTo(next)
    if (jump > flow.maxJump) flow.maxJump = jump
    if (next.y < flow.minY) flow.minY = next.y
  }

  const lockGap = (flow: FlowReport, prop: THREE.Object3D, dest: THREE.Object3D) => {
    const gap = worldGap(restOf(prop), dest)
    if (gap > flow.maxLockGap) flow.maxLockGap = gap
    prop.getWorldPosition(_pc)
    if (_pc.y < flow.minY) flow.minY = _pc.y
  }

  const scanLoose = (flow: FlowReport, step: string) => {
    for (const prop of props) {
      if (!prop.userData.prop) continue
      prop.getWorldPosition(_pc)
      const held = !!prop.parent?.name && prop.parent.name !== 'journey' && prop.parent.name !== 'sockets'
      if (!held && _pc.y > LOCK_TOLERANCE_M) flow.loose.push(`${step}:${prop.name}`)
    }
  }

  const handoff = (flow: FlowReport, prop: THREE.Object3D, dest: THREE.Object3D, path?: THREE.Vector3[]) => {
    root.updateMatrixWorld(true)
    restOf(prop).getWorldPosition(_pa)
    dest.getWorldPosition(_pb)
    const poly = path && path.length >= 2 ? path : [_pa.clone(), _pb.clone()]
    poly[0] = _pa.clone()
    poly[poly.length - 1] = _pb.clone()
    const samples = resample(poly, HANDOFF_STEP_M)
    let prev = _pa.clone()
    for (const p of samples) {
      span.position.copy(p)
      span.add(prop)
      prop.position.set(0, 0, 0)
      prop.rotation.set(0, 0, 0)
      prop.updateMatrixWorld(true)
      restOf(prop).getWorldPosition(_pc)
      note(flow, prev, _pc)
      prev = _pc.clone()
    }
    lockTo(prop, dest)
    lockGap(flow, prop, dest)
  }

  const drive = (flow: FlowReport, vehicle: THREE.Object3D, target: THREE.Vector3, rider: THREE.Object3D) => {
    root.updateMatrixWorld(true)
    const start = vehicle.position.clone()
    const dist = start.distanceTo(target)
    const n = Math.max(1, Math.ceil(dist / HANDOFF_STEP_M))
    restOf(rider).getWorldPosition(_pa)
    let prev = _pa.clone()
    for (let i = 1; i <= n; i++) {
      vehicle.position.lerpVectors(start, target, i / n)
      vehicle.updateMatrixWorld(true)
      restOf(rider).getWorldPosition(_pc)
      note(flow, prev, _pc)
      prev = _pc.clone()
    }
    lockGap(flow, rider, rider.parent ?? rider)
  }

  const poseOf = (vehicle: THREE.Object3D, socketName: string, target: THREE.Object3D): THREE.Vector3 => {
    const pos = vehicle.position.clone()
    const rot = vehicle.rotation.clone()
    parkSocket(vehicle, socketName, target)
    const parked = vehicle.position.clone()
    vehicle.position.copy(pos)
    vehicle.rotation.copy(rot)
    vehicle.updateMatrixWorld(true)
    return parked
  }

  const levelStop = (name: string, near: THREE.Object3D, vehicle: THREE.Object3D, socketName: string, alongZ: number): THREE.Object3D => {
    const sock = need(vehicle, socketName)
    near.getWorldPosition(_pb)
    const stop = new THREE.Object3D()
    stop.name = name
    stop.position.set(_pb.x, sock.position.y, _pb.z + alongZ)
    root.add(stop)
    return stop
  }

  // Belt meets the cargo door. Cart, dolly and lifter stay on the ground.
  parkSocket(loader, 'belt_tip', door)
  const holdStop = levelStop('hold_stop', need(loader, 'belt_low'), cart, 'cart_bed', side * 2.4)
  const dollyStop = levelStop('dolly_stop', need(lifter, 'loader_deck'), dolly, 'dolly_deck', side * 3.2)

  const bagFlow = report.bag
  const stepBag = (id: (typeof BAG_STEPS)[number]) => {
    bagFlow.steps.push(id)
    return id
  }

  stepBag('check_in')
  lockTo(bag, need(checkin, 'desk_drop'))
  lockGap(bagFlow, bag, need(checkin, 'desk_drop'))

  stepBag('onto_belt')
  handoff(bagFlow, bag, need(checkin, 'belt_in'))
  stepBag('along_belt')
  handoff(bagFlow, bag, need(checkin, 'belt_out'))

  parkSocket(cart, 'cart_bed', need(checkin, 'makeup_stop'))
  stepBag('onto_cart')
  handoff(bagFlow, bag, need(cart, 'cart_bed'))
  bagFlow.docks.makeup = worldGap(need(cart, 'cart_bed'), need(checkin, 'makeup_stop'))

  const holdPose = poseOf(cart, 'cart_bed', holdStop)
  stepBag('cart_to_stand')
  drive(bagFlow, cart, holdPose, bag)
  bagFlow.docks.hold = worldGap(need(cart, 'cart_bed'), holdStop)

  stepBag('onto_loader')
  handoff(bagFlow, bag, need(loader, 'belt_low'))
  stepBag('up_to_hold')
  handoff(bagFlow, bag, need(loader, 'belt_tip'))
  bagFlow.docks.loader = worldGap(need(loader, 'belt_tip'), door)
  stepBag('in_hold')
  handoff(bagFlow, bag, need(aircraft, 'plane_hold'))
  bag.getWorldPosition(_pa)
  const heldAt = _pa.clone()

  stepBag('out_of_hold')
  handoff(bagFlow, bag, need(loader, 'belt_tip'))
  stepBag('down_loader')
  handoff(bagFlow, bag, need(loader, 'belt_low'))
  stepBag('onto_cart_return')
  handoff(bagFlow, bag, need(cart, 'cart_bed'))

  const claimPose = poseOf(cart, 'cart_bed', need(carousel, 'claim_stop'))
  stepBag('cart_to_claim')
  drive(bagFlow, cart, claimPose, bag)
  bagFlow.docks.claim = worldGap(need(cart, 'cart_bed'), need(carousel, 'claim_stop'))
  stepBag('onto_carousel')
  handoff(bagFlow, bag, need(carousel, 'carousel_lip'))
  bag.getWorldPosition(_pb)
  bagFlow.holdToClaim = heldAt.distanceTo(_pb)
  bagFlow.ended = bag.parent?.name ?? ''
  scanLoose(bagFlow, 'bag')

  // ULD rides the dolly, then the loader deck, then the same hold.
  const uldFlow = report.uld
  dolly.position.set(door.position.x - 6, 0, door.position.z + side * 8)
  uldFlow.steps.push('on_dolly')
  lockTo(uld, need(dolly, 'dolly_deck'))
  lockGap(uldFlow, uld, need(dolly, 'dolly_deck'))
  const dollyPose = poseOf(dolly, 'dolly_deck', dollyStop)
  uldFlow.steps.push('dolly_to_loader')
  drive(uldFlow, dolly, dollyPose, uld)
  uldFlow.docks.dolly = worldGap(need(dolly, 'dolly_deck'), dollyStop)
  uldFlow.steps.push('onto_loader')
  handoff(uldFlow, uld, need(lifter, 'loader_deck'))
  uldFlow.steps.push('into_hold')
  handoff(uldFlow, uld, need(aircraft, 'plane_hold'))
  uldFlow.ended = uld.parent?.name ?? ''
  scanLoose(uldFlow, 'uld')

  // Catering cart leaves the truck bed, crosses the lip, and enters the galley.
  const mealFlow = report.catering
  cater.position.set(door.position.x, 0, door.position.z + side * 8)
  parkSocket(cater, 'catering_lip', need(aircraft, 'catering_door'))
  if (cater.position.y < 0) cater.position.y = 0
  cater.updateMatrixWorld(true)
  mealFlow.steps.push('on_truck')
  lockTo(meal, need(cater, 'cart_slot'))
  lockGap(mealFlow, meal, need(cater, 'cart_slot'))
  mealFlow.steps.push('to_lip')
  handoff(mealFlow, meal, need(cater, 'catering_lip'))
  mealFlow.steps.push('into_galley')
  handoff(mealFlow, meal, need(aircraft, 'galley_slot'))
  mealFlow.ended = meal.parent?.name ?? ''
  scanLoose(mealFlow, 'catering')

  // Passengers walk the bridge floor onto the sill, then back out.
  const paxFlow = report.pax
  const sill = need(aircraft, 'plane_pax_sill')
  const threshold = new THREE.Object3D()
  threshold.name = 'pax_threshold'
  threshold.position.set(sill.position.x, sill.position.y, sill.position.z + side * 0.45)
  aircraft.add(threshold)
  if (bridge.getObjectByName('bridge_cab')) {
    parkSocket(bridge, 'bridge_cab', threshold)
    paxFlow.steps.push('board_hall')
    lockTo(pax, need(bridge, 'bridge_hall'))
    lockGap(paxFlow, pax, need(bridge, 'bridge_hall'))
    paxFlow.steps.push('board_cab')
    handoff(paxFlow, pax, need(bridge, 'bridge_cab'))
    paxFlow.steps.push('board_door')
    handoff(paxFlow, pax, sill)
    paxFlow.docks.bridge = worldGap(need(bridge, 'bridge_cab'), threshold)
    paxFlow.steps.push('deplane_door')
    lockGap(paxFlow, pax, sill)
    paxFlow.steps.push('deplane_cab')
    handoff(paxFlow, pax, need(bridge, 'bridge_cab'))
    paxFlow.steps.push('deplane_hall')
    handoff(paxFlow, pax, need(bridge, 'bridge_hall'))
  }
  paxFlow.ended = pax.parent?.name ?? ''
  scanLoose(paxFlow, 'pax')

  // Coupler leaves the farm outlet, rides a catenary onto the truck, and leaves with it.
  const fuelFlow = report.fuel
  const bay = new THREE.Object3D()
  bay.name = 'farm_bay'
  const fill = need(farm, 'farm_fill')
  fill.getWorldPosition(_pb)
  const inlet = need(truck, 'truck_fill')
  bay.position.set(_pb.x + 4.2, inlet.position.y, _pb.z)
  root.add(bay)
  fuelFlow.steps.push('to_farm')
  lockTo(coupler, fill)
  lockGap(fuelFlow, coupler, fill)
  const bayPose = poseOf(truck, 'truck_fill', bay)
  truck.position.copy(bayPose).add(new THREE.Vector3(-10, 0, 0))
  drive(fuelFlow, truck, bayPose, coupler)
  fuelFlow.docks.farm = worldGap(inlet, bay)
  fuelFlow.steps.push('fill')
  fill.getWorldPosition(_pa)
  inlet.getWorldPosition(_pb)
  const hose = hoseSpan([_pa.x, _pa.y, _pa.z], [_pb.x, _pb.y, _pb.z], 0.45, 16).map((p) => new THREE.Vector3(p[0], p[1], p[2]))
  handoff(fuelFlow, coupler, inlet, hose)
  fuelFlow.steps.push('leave_farm')
  const away = bayPose.clone().add(new THREE.Vector3(-8, 0, 0))
  drive(fuelFlow, truck, away, coupler)
  fuelFlow.ended = coupler.parent?.name ?? ''
  scanLoose(fuelFlow, 'fuel')

  return { root, report }
}

export function disposeJourney(root: THREE.Object3D) {
  disposeVehicleRig(root)
}

const PREVIEW_LIVERY: Livery = { body: '#f4f7fb', stripe: '#1f4e79', tail: '#1f4e79', airline: 'northline' }

/** Belt loader docked, one suitcase sitting on the belt at the cargo door. */
export function bagHoldScene(): { root: THREE.Group; look: THREE.Vector3; cam: THREE.Vector3 } {
  const spec = getAircraftSpec('b738')
  const root = new THREE.Group()
  const built = buildAircraft(spec, 'mid', PREVIEW_LIVERY)
  built.group.name = 'aircraft'
  mountSockets(built.group, aircraftSocketTable(spec))
  root.add(built.group)

  const loader = vehicleRig('belt_loader', '#d5d8dc')
  root.add(loader)
  const door = need(built.group, 'plane_cargo_door_fwd')
  const side = Math.sign(door.getWorldPosition(_pb).z || door.position.z) || 1
  loader.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
  parkSocket(loader, 'belt_tip', door)

  const bag = item('bag', '#8c2f2f', [0.74, 0.5, 0.36])
  lockTo(bag, need(loader, 'belt_tip'))
  root.add(bag)

  const cart = vehicleRig('cart', '#c4b7a6')
  const low = need(loader, 'belt_low')
  low.getWorldPosition(_pa)
  cart.position.set(_pa.x, 0, _pa.z + side * 2.6)
  cart.rotation.y = loader.rotation.y
  root.add(cart)

  bag.getWorldPosition(_pb)
  const look = _pb.clone()
  const cam = look.clone().add(new THREE.Vector3(side * 2.4, 1.35, 2.6))
  return { root, look, cam }
}

export const FLOW_STEPS: Record<FlowName, readonly string[]> = {
  bag: BAG_STEPS,
  uld: ULD_STEPS,
  catering: CATERING_STEPS,
  pax: PAX_STEPS,
  fuel: FUEL_STEPS,
}
