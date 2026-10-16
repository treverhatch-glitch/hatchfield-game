/**
 * Curb trips for real passengers. A departure is driven to the layby and
 * walks in. An arrival walks out and is picked up. Rail and hotel guests
 * never take a road vehicle. The capacity model does not read this.
 */
import { LANDSIDE } from './config.ts'
import type { VehicleKind } from './types.ts'

export interface CurbOrder {
  id: string
  kind: VehicleKind
  role: 'drop' | 'pick'
  guests: string[]
  flightId: string
  /** Start near the stall. The door is too close for a drive from the city. */
  hurry?: boolean
}

export interface CurbNotice {
  kind: 'alighted' | 'boarded' | 'picked'
  orderId: string
  guests: string[]
}

export interface CurbGuestRef {
  id: string
  flightId: string
  kind: VehicleKind
  role: 'drop' | 'pick'
  hurry: boolean
}

/** Own car, taxi, or bus. Rail and hotel stay off the road. */
export function curbKind(mode: string | undefined | null): VehicleKind | null {
  if (mode === 'car_short' || mode === 'car_long') return 'car'
  if (mode === 'dropoff') return 'taxi'
  if (mode === 'bus') return 'bus'
  return null
}

/** True when the door is too soon for a full drive in from the city. */
export function curbHurry(releaseAt: number | undefined, clock: number): boolean {
  if (releaseAt == null) return true
  return releaseAt - clock < LANDSIDE.curbHurrySec
}

/**
 * One vehicle per car or taxi. Buses share a vehicle, up to `busSize`
 * passengers of the same flight and the same role.
 */
export function groupCurbOrders(guests: readonly CurbGuestRef[], busSize: number): CurbOrder[] {
  const orders: CurbOrder[] = []
  const buses = new Map<string, CurbGuestRef[]>()
  for (const guest of guests) {
    if (guest.kind !== 'bus') {
      orders.push({
        id: `${guest.role}:${guest.id}`,
        kind: guest.kind,
        role: guest.role,
        guests: [guest.id],
        flightId: guest.flightId,
        hurry: guest.hurry,
      })
      continue
    }
    const key = `${guest.role}:${guest.flightId}`
    const list = buses.get(key)
    if (list) list.push(guest)
    else buses.set(key, [guest])
  }
  const size = Math.max(1, busSize)
  for (const [key, list] of buses) {
    for (let i = 0; i < list.length; i += size) {
      const chunk = list.slice(i, i + size)
      orders.push({
        id: `bus:${key}:${chunk[0].id}`,
        kind: 'bus',
        role: chunk[0].role,
        guests: chunk.map((guest) => guest.id),
        flightId: chunk[0].flightId,
        hurry: chunk.some((guest) => guest.hurry),
      })
    }
  }
  return orders
}
