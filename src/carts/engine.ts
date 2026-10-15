import { CART_TUNING, type CartTuning } from './config.ts'
import type { CartSocket } from './sockets.ts'

/**
 * Point-to-point bag carts and catering trucks.
 *
 * A leg is one vehicle between two named sockets. It paths, waits in a queue
 * when the bay is full, then docks. How much moves is limited by how many
 * carts are free and how many bays are in use. Nothing here draws a mesh.
 */

export type CartLeg = 'drop_to_sort' | 'sort_to_loader' | 'loader_to_claim' | 'kitchen_to_door'

export type CartSiteRole = 'checkin' | 'sort' | 'claim' | 'kitchen' | 'stand'

export interface CartSite {
  id: string
  role: CartSiteRole
  /** Metres. The building or stand origin. Sockets are not offsets from here. */
  x: number
  y: number
  /** Named mesh sockets in world metres. A missing name means that leg cannot start. */
  sockets?: readonly CartSocket[]
}

export interface CartPose {
  id: string
  kind: 'bag_cart' | 'catering_truck'
  leg: CartLeg
  phase: 'path' | 'queue' | 'dock'
  x: number
  y: number
  heading: number
  /** 0 at the start of the phase, 1 at the end. */
  u: number
  queueIndex: number
  fromSocket: string
  toSocket: string
  /** Socket on the vehicle that meets the station socket. */
  vehicleSocket: string
  /** Station socket the vehicle is locked to. Null while it is still rolling. */
  lockedTo: string | null
  load: number
  standId: string
}

interface Point {
  x: number
  y: number
}

interface Shipment {
  id: string
  kind: 'outbound' | 'inbound' | 'catering'
  standId: string
  units: number
  stage: number
  moved: number
  reserved: number
  done: boolean
}

interface Trip {
  shipmentId: string
  leg: CartLeg
  units: number
  fromName: string
  toName: string
  from: Point
  to: Point
  vehicleSocket: string
  fromBay: string
  toBay: string
  standId: string
}

type Phase = 'idle' | 'path' | 'queue' | 'dock'

interface Vehicle {
  id: string
  kind: 'bag_cart' | 'catering_truck'
  trip: Trip | null
  /** Which end of the leg the vehicle is aiming at. */
  aim: 'from' | 'to'
  phase: Phase
  x: number
  y: number
  heading: number
  u: number
  queueIndex: number
  queueOrder: number
  dockLeft: number
  bay: string | null
}

const OUTBOUND: CartLeg[] = ['drop_to_sort', 'sort_to_loader']
const INBOUND: CartLeg[] = ['loader_to_claim']
const CATERING: CartLeg[] = ['kitchen_to_door']

function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback
}

function flightOf(shipmentId: string): string {
  if (shipmentId.startsWith('in:') || shipmentId.startsWith('cat:')) return shipmentId.slice(shipmentId.indexOf(':') + 1)
  return shipmentId
}

function bayCount(n: number): number {
  const v = Math.floor(finite(n, 1))
  return v < 1 ? 1 : v
}

export class CartYard {
  private readonly config: CartTuning
  private sites: CartSite[] = []
  private readonly shipments: Shipment[] = []
  private readonly vehicles: Vehicle[] = []
  private readonly handoffs: { shipmentId: string; socket: string; vehicleSocket: string }[] = []
  private readonly occupants = new Map<string, number>()
  private nextVehicle = 1
  private nextOrder = 1
  private bagFleet = 0
  private cateringFleet = 0
  /** Done shipments already folded into the delivered totals. */
  private readonly deliveredUnits = { outbound: 0, inbound: 0, catering: 0 }
  /** Shipment ids that were done on the previous tick. One tick of grace keeps socketsOf readable. */
  private readonly finished = new Set<string>()
  /** Sockets where a cart has finished its dock. Kept until the flight leaves. */
  private readonly arrived = new Map<string, Set<string>>()

  constructor(tuning: CartTuning = CART_TUNING) {
    this.config = {
      ...tuning,
      bays: { ...tuning.bays },
    }
  }

  setSites(sites: readonly CartSite[]): void {
    this.sites = []
    for (const site of sites) {
      if (!Number.isFinite(site.x) || !Number.isFinite(site.y)) continue
      const sockets = (site.sockets ?? []).filter((socket) => socket.name && Number.isFinite(socket.x) && Number.isFinite(socket.y))
      this.sites.push({ ...site, sockets })
    }
  }

  /** Idle vehicles are added or removed. A cart already on a leg keeps it. */
  setFleet(bagCarts: number, cateringTrucks: number): void {
    this.bagFleet = Math.max(0, Math.floor(finite(bagCarts)))
    this.cateringFleet = Math.max(0, Math.floor(finite(cateringTrucks)))
    this.resize('bag_cart', this.bagFleet)
    this.resize('catering_truck', this.cateringFleet)
  }

  postOutbound(id: string, units: number, standId: string): void {
    this.post(id, 'outbound', units, standId)
  }

  postInbound(id: string, units: number, standId: string): void {
    this.post(id, 'inbound', units, standId)
  }

  postCatering(id: string, units: number, standId: string): void {
    this.post(id, 'catering', units, standId)
  }

  /** Sockets a shipment has locked to, in order. */
  socketsOf(shipmentId: string): string[] {
    return this.handoffs.filter((row) => row.shipmentId === shipmentId).map((row) => row.socket)
  }

  /** True after the cart has finished its dock at this named socket. Locking on is not enough. */
  finishedAt(shipmentId: string, socket: string): boolean {
    return this.arrived.get(shipmentId)?.has(socket) ?? false
  }

  /** True while the shipment is on the yard. A dropped shipment is gone for good. */
  isOpen(shipmentId: string): boolean {
    return this.shipments.some((shipment) => shipment.id === shipmentId)
  }

  /** Shipments still on the yard, including one that finished and is waiting for retireDone. */
  openIds(): string[] {
    return this.shipments.map((shipment) => shipment.id)
  }

  /** True when every named socket that leg needs is on a site. */
  canAccept(kind: 'outbound' | 'inbound' | 'catering', standId: string): boolean {
    if (kind === 'catering') return Boolean(this.socketAt('kitchen', 'cart_slot') && this.socketAt('stand', 'catering_door', standId))
    if (kind === 'inbound') return Boolean(this.socketAt('stand', 'belt_low', standId) && this.socketAt('claim', 'claim_stop'))
    return Boolean(this.socketAt('checkin', 'desk_drop') && this.socketAt('sort', 'makeup_stop') && this.socketAt('stand', 'belt_low', standId))
  }

  /**
   * Drop shipments that are still undone once their flight has left or been cancelled.
   * A finished shipment stays put: retireDone folds it into the delivered total.
   */
  cancelGone(live: ReadonlySet<string>): void {
    for (let i = this.shipments.length - 1; i >= 0; i--) {
      const shipment = this.shipments[i]
      if (!shipment || shipment.done) continue
      if (live.has(flightOf(shipment.id))) continue
      this.dropUndone(shipment.id)
    }
    for (const id of [...this.arrived.keys()]) {
      if (!live.has(flightOf(id))) this.arrived.delete(id)
    }
  }

  delivered(kind: 'outbound' | 'inbound' | 'catering'): number {
    let n = this.deliveredUnits[kind]
    for (const shipment of this.shipments) {
      if (shipment.kind !== kind || !shipment.done) continue
      n += shipment.units
    }
    return n
  }

  snapshot(): CartPose[] {
    const out: CartPose[] = []
    for (const vehicle of this.vehicles) {
      const trip = vehicle.trip
      if (!trip || vehicle.phase === 'idle') continue
      const locked = vehicle.phase === 'dock' ? (vehicle.aim === 'from' ? trip.fromName : trip.toName) : null
      const loaded = vehicle.aim === 'to' || vehicle.phase === 'dock'
      out.push({
        id: vehicle.id,
        kind: vehicle.kind,
        leg: trip.leg,
        phase: vehicle.phase,
        x: vehicle.x,
        y: vehicle.y,
        heading: vehicle.heading,
        u: vehicle.u,
        queueIndex: vehicle.queueIndex,
        fromSocket: trip.fromName,
        toSocket: trip.toName,
        vehicleSocket: trip.vehicleSocket,
        lockedTo: locked,
        load: loaded ? trip.units : 0,
        standId: trip.standId,
      })
    }
    return out
  }

  tick(dt: number): void {
    const step = finite(dt)
    if (!(step > 0)) return
    this.retireDone()
    this.dispatch()
    for (const vehicle of this.vehicles) {
      if (vehicle.phase === 'idle') continue
      this.consume(vehicle, step)
    }
    this.dispatch()
  }

  /**
   * Drop a shipment the tick after it finishes. The delivered total keeps the
   * units, and the socket list stays through the tick that observed it.
   */
  private retireDone(): void {
    const drop: string[] = []
    for (let i = this.shipments.length - 1; i >= 0; i--) {
      const shipment = this.shipments[i]
      if (!shipment || !shipment.done) continue
      if (!this.finished.has(shipment.id)) {
        this.finished.add(shipment.id)
        continue
      }
      this.deliveredUnits[shipment.kind] += shipment.units
      this.finished.delete(shipment.id)
      drop.push(shipment.id)
      this.shipments.splice(i, 1)
    }
    if (!drop.length) return
    const gone = new Set(drop)
    for (let i = this.handoffs.length - 1; i >= 0; i--) {
      if (gone.has(this.handoffs[i]?.shipmentId ?? '')) this.handoffs.splice(i, 1)
    }
  }

  private post(id: string, kind: Shipment['kind'], units: number, standId: string): void {
    const amount = Math.max(0, Math.round(finite(units)))
    if (!id || amount <= 0 || this.shipments.some((row) => row.id === id)) return
    this.shipments.push({
      id,
      kind,
      standId,
      units: amount,
      stage: 0,
      moved: 0,
      reserved: 0,
      done: false,
    })
  }

  private legsOf(kind: Shipment['kind']): CartLeg[] {
    if (kind === 'inbound') return INBOUND
    if (kind === 'catering') return CATERING
    return OUTBOUND
  }

  private resize(kind: Vehicle['kind'], want: number): void {
    const owned = this.vehicles.filter((vehicle) => vehicle.kind === kind)
    while (owned.length > want) {
      const idle = owned.findIndex((vehicle) => vehicle.phase === 'idle')
      if (idle < 0) break
      const removed = owned.splice(idle, 1)[0]
      const at = this.vehicles.indexOf(removed)
      if (at >= 0) this.vehicles.splice(at, 1)
    }
    const park = this.parkFor(kind)
    while (owned.length < want) {
      const vehicle: Vehicle = {
        id: kind === 'bag_cart' ? `bag-${this.nextVehicle++}` : `cat-${this.nextVehicle++}`,
        kind,
        trip: null,
        aim: 'from',
        phase: 'idle',
        x: park.x,
        y: park.y,
        heading: 0,
        u: 0,
        queueIndex: 0,
        queueOrder: 0,
        dockLeft: 0,
        bay: null,
      }
      this.vehicles.push(vehicle)
      owned.push(vehicle)
    }
  }

  private parkFor(kind: Vehicle['kind']): Point {
    if (kind === 'catering_truck') return this.socketAt('kitchen', 'cart_slot') ?? { x: 0, y: 0 }
    return this.socketAt('sort', 'makeup_stop') ?? { x: 0, y: 0 }
  }

  /** World point of a named mesh socket. No tile-centre fallback. */
  private socketAt(role: CartSiteRole, name: string, standId?: string): Point | null {
    const site =
      role === 'stand'
        ? this.sites.find((row) => row.role === 'stand' && row.id === standId)
        : this.sites.find((row) => row.role === role)
    const hit = site?.sockets?.find((socket) => socket.name === name)
    if (!hit) return null
    return { x: hit.x, y: hit.y }
  }

  /** Pull an undone shipment off the yard and free any cart that was carrying it. */
  private dropUndone(id: string): void {
    const at = this.shipments.findIndex((shipment) => shipment.id === id)
    const shipment = at >= 0 ? this.shipments[at] : undefined
    if (!shipment || shipment.done) return
    this.shipments.splice(at, 1)
    this.finished.delete(id)
    this.arrived.delete(id)
    for (let i = this.handoffs.length - 1; i >= 0; i--) {
      if (this.handoffs[i]?.shipmentId === id) this.handoffs.splice(i, 1)
    }
    for (const vehicle of this.vehicles) {
      if (vehicle.trip?.shipmentId !== id) continue
      const bay = vehicle.bay ?? (vehicle.phase === 'queue' ? this.bayOf(vehicle) : '')
      this.releaseBay(vehicle)
      vehicle.trip = null
      vehicle.phase = 'idle'
      vehicle.aim = 'from'
      vehicle.u = 0
      vehicle.queueIndex = 0
      vehicle.dockLeft = 0
      const park = this.parkFor(vehicle.kind)
      vehicle.x = park.x
      vehicle.y = park.y
      if (bay) this.reindex(bay)
    }
  }

  private markFinished(vehicle: Vehicle): void {
    const trip = vehicle.trip
    if (!trip) return
    const socket = vehicle.aim === 'from' ? trip.fromName : trip.toName
    let done = this.arrived.get(trip.shipmentId)
    if (!done) {
      done = new Set()
      this.arrived.set(trip.shipmentId, done)
    }
    done.add(socket)
  }

  private dispatch(): void {
    const stranded: string[] = []
    for (const shipment of this.shipments) {
      if (shipment.done) continue
      const legs = this.legsOf(shipment.kind)
      if (shipment.stage >= legs.length) {
        shipment.done = true
        continue
      }
      const room = shipment.units - shipment.moved - shipment.reserved
      if (room <= 0) continue
      const kind = shipment.kind === 'catering' ? 'catering_truck' : 'bag_cart'
      const cap = kind === 'catering_truck' ? this.config.cateringLoadsPerTruck : this.config.bagUnitsPerCart
      const vehicle = this.vehicles.find((row) => row.kind === kind && row.phase === 'idle')
      if (!vehicle || cap <= 0) continue
      const trip = this.makeTrip(shipment, legs[shipment.stage], Math.min(room, cap))
      if (!trip) {
        // A socket this leg needs was bulldozed. Nothing is in flight, so no cart can ever finish it.
        if (shipment.reserved <= 0) stranded.push(shipment.id)
        continue
      }
      shipment.reserved += trip.units
      vehicle.trip = trip
      vehicle.aim = 'from'
      vehicle.phase = 'path'
      vehicle.u = 0
      vehicle.queueIndex = 0
      vehicle.dockLeft = 0
      const goal = trip.from
      const dx = goal.x - vehicle.x
      const dy = goal.y - vehicle.y
      if (Math.hypot(dx, dy) > 0.05) vehicle.heading = Math.atan2(dy, dx)
    }
    for (const id of stranded) this.dropUndone(id)
  }

  private makeTrip(shipment: Shipment, leg: CartLeg, units: number): Trip | null {
    const standId = shipment.standId
    if (leg === 'drop_to_sort') {
      const from = this.socketAt('checkin', 'desk_drop')
      const to = this.socketAt('sort', 'makeup_stop')
      if (!from || !to) return null
      return {
        shipmentId: shipment.id,
        leg,
        units,
        fromName: 'desk_drop',
        toName: 'makeup_stop',
        from,
        to,
        vehicleSocket: 'cart_bed',
        fromBay: 'drop',
        toBay: 'sort',
        standId,
      }
    }
    if (leg === 'sort_to_loader') {
      const from = this.socketAt('sort', 'makeup_stop')
      const to = this.socketAt('stand', 'belt_low', standId)
      if (!from || !to) return null
      return {
        shipmentId: shipment.id,
        leg,
        units,
        fromName: 'makeup_stop',
        toName: 'belt_low',
        from,
        to,
        vehicleSocket: 'cart_bed',
        fromBay: 'sort',
        toBay: `loader:${standId}`,
        standId,
      }
    }
    if (leg === 'loader_to_claim') {
      const from = this.socketAt('stand', 'belt_low', standId)
      const to = this.socketAt('claim', 'claim_stop')
      if (!from || !to) return null
      return {
        shipmentId: shipment.id,
        leg,
        units,
        fromName: 'belt_low',
        toName: 'claim_stop',
        from,
        to,
        vehicleSocket: 'cart_bed',
        fromBay: `loader:${standId}`,
        toBay: 'claim',
        standId,
      }
    }
    const from = this.socketAt('kitchen', 'cart_slot')
    const to = this.socketAt('stand', 'catering_door', standId)
    if (!from || !to) return null
    return {
      shipmentId: shipment.id,
      leg: 'kitchen_to_door',
      units,
      fromName: 'cart_slot',
      toName: 'catering_door',
      from,
      to,
      vehicleSocket: 'catering_lip',
      fromBay: 'kitchen',
      toBay: `door:${standId}`,
      standId,
    }
  }

  private consume(vehicle: Vehicle, dt: number): void {
    let left = dt
    for (let guard = 0; left > 1e-6 && guard < 8; guard++) {
      const trip = vehicle.trip
      if (!trip || vehicle.phase === 'idle') return
      if (vehicle.phase === 'path') {
        const goal = vehicle.aim === 'from' ? trip.from : trip.to
        const dx = goal.x - vehicle.x
        const dy = goal.y - vehicle.y
        const dist = Math.hypot(dx, dy)
        const speed = Math.max(0.1, this.config.speedMps)
        if (dist <= 0.05) {
          vehicle.x = goal.x
          vehicle.y = goal.y
          this.arrive(vehicle)
          continue
        }
        const need = dist / speed
        const step = Math.min(left, need)
        const moved = speed * step
        vehicle.x += (dx / dist) * moved
        vehicle.y += (dy / dist) * moved
        vehicle.heading = Math.atan2(dy, dx)
        vehicle.u = Math.min(1, moved / dist)
        left -= step
        if (step + 1e-6 < need) return
        vehicle.x = goal.x
        vehicle.y = goal.y
        this.arrive(vehicle)
        continue
      }
      if (vehicle.phase === 'queue') {
        const slot = this.queuePoint(vehicle)
        const dx = slot.x - vehicle.x
        const dy = slot.y - vehicle.y
        const dist = Math.hypot(dx, dy)
        const speed = Math.max(0.1, this.config.speedMps)
        if (dist > 0.05) {
          const need = dist / speed
          const step = Math.min(left, need)
          vehicle.x += (dx / dist) * speed * step
          vehicle.y += (dy / dist) * speed * step
          vehicle.heading = Math.atan2(dy, dx)
          left -= step
          if (step + 1e-6 < need) return
        }
        this.reindex(this.bayOf(vehicle))
        if (!this.takeBay(vehicle)) return
        this.reindex(this.bayOf(vehicle))
        vehicle.phase = 'dock'
        vehicle.dockLeft = Math.max(0.05, this.config.dockSec)
        vehicle.u = 0
        vehicle.queueIndex = 0
        this.noteLock(vehicle)
        continue
      }
      if (vehicle.dockLeft > left) {
        vehicle.dockLeft -= left
        const span = Math.max(0.05, this.config.dockSec)
        vehicle.u = 1 - vehicle.dockLeft / span
        return
      }
      left -= Math.max(0, vehicle.dockLeft)
      vehicle.dockLeft = 0
      vehicle.u = 1
      this.finishDock(vehicle)
    }
  }

  private arrive(vehicle: Vehicle): void {
    vehicle.u = 1
    if (this.takeBay(vehicle)) {
      vehicle.phase = 'dock'
      vehicle.dockLeft = Math.max(0.05, this.config.dockSec)
      vehicle.u = 0
      vehicle.queueIndex = 0
      this.noteLock(vehicle)
      return
    }
    vehicle.phase = 'queue'
    vehicle.queueOrder = this.nextOrder++
    vehicle.u = 0
    this.reindex(this.bayOf(vehicle))
    const slot = this.queuePoint(vehicle)
    vehicle.x = slot.x
    vehicle.y = slot.y
  }

  private bayOf(vehicle: Vehicle): string {
    const trip = vehicle.trip
    if (!trip) return ''
    return vehicle.aim === 'from' ? trip.fromBay : trip.toBay
  }

  private capOf(bay: string): number {
    const bays = this.config.bays
    if (bay === 'drop') return bayCount(bays.drop)
    if (bay === 'sort') return bayCount(bays.sort)
    if (bay === 'claim') return bayCount(bays.claim)
    if (bay === 'kitchen') return bayCount(bays.kitchen)
    if (bay.startsWith('loader:')) return bayCount(bays.loader)
    if (bay.startsWith('door:')) return bayCount(bays.door)
    return 1
  }

  private takeBay(vehicle: Vehicle): boolean {
    const bay = this.bayOf(vehicle)
    const used = this.occupants.get(bay) ?? 0
    if (used >= this.capOf(bay)) return false
    this.occupants.set(bay, used + 1)
    vehicle.bay = bay
    return true
  }

  private releaseBay(vehicle: Vehicle): void {
    if (!vehicle.bay) return
    const used = this.occupants.get(vehicle.bay) ?? 0
    this.occupants.set(vehicle.bay, Math.max(0, used - 1))
    vehicle.bay = null
  }

  private noteLock(vehicle: Vehicle): void {
    const trip = vehicle.trip
    if (!trip) return
    const socket = vehicle.aim === 'from' ? trip.fromName : trip.toName
    this.handoffs.push({ shipmentId: trip.shipmentId, socket, vehicleSocket: trip.vehicleSocket })
  }

  private finishDock(vehicle: Vehicle): void {
    const trip = vehicle.trip
    this.markFinished(vehicle)
    this.releaseBay(vehicle)
    if (!trip) {
      vehicle.phase = 'idle'
      return
    }
    if (vehicle.aim === 'from') {
      vehicle.aim = 'to'
      vehicle.phase = 'path'
      vehicle.u = 0
      return
    }
    const shipment = this.shipments.find((row) => row.id === trip.shipmentId)
    if (shipment) {
      shipment.reserved = Math.max(0, shipment.reserved - trip.units)
      shipment.moved += trip.units
      if (shipment.moved >= shipment.units) {
        shipment.stage += 1
        shipment.moved = 0
        shipment.reserved = 0
        const legs = this.legsOf(shipment.kind)
        if (shipment.stage >= legs.length) shipment.done = true
      }
    }
    vehicle.trip = null
    vehicle.phase = 'idle'
    vehicle.u = 0
  }

  private queuePoint(vehicle: Vehicle): Point {
    const trip = vehicle.trip
    const goal = trip ? (vehicle.aim === 'from' ? trip.from : trip.to) : { x: vehicle.x, y: vehicle.y }
    const back = trip ? (vehicle.aim === 'from' ? trip.to : trip.from) : goal
    const dx = goal.x - back.x
    const dy = goal.y - back.y
    const len = Math.hypot(dx, dy) || 1
    const gap = Math.max(1, this.config.queueGapM) * Math.max(1, vehicle.queueIndex)
    return { x: goal.x - (dx / len) * gap, y: goal.y - (dy / len) * gap }
  }

  private reindex(bay: string): void {
    const waiting = this.vehicles
      .filter((vehicle) => vehicle.phase === 'queue' && this.bayOf(vehicle) === bay)
      .sort((a, b) => a.queueOrder - b.queueOrder)
    waiting.forEach((vehicle, index) => {
      vehicle.queueIndex = index + 1
    })
  }
}
