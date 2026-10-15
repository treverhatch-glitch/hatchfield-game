import type { MapViewId } from './types.ts'

/** These already have a map pill. More must not list them again. */
const PILL_IDS = new Set<string>(['fuel', 'power'] as const satisfies readonly MapViewId[])

export interface InfoSpot {
  id: string
  label: string
}

/** Hotspot labels that are not already Traffic, Queues, Bays, Power, or Fuel. */
export function moreInfoSpots(spots: readonly InfoSpot[]): InfoSpot[] {
  return spots.filter((spot) => !PILL_IDS.has(spot.id))
}

let open = false
const listeners = new Set<() => void>()

function publish(next: boolean) {
  if (open === next) return
  open = next
  for (const fn of listeners) fn()
}

export function moreMenuSnapshot(): boolean {
  return open
}

export function subscribeMoreMenu(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function setMoreMenu(next: boolean) {
  publish(next)
}

export function toggleMoreMenu() {
  publish(!open)
}

export function resetMoreMenu() {
  publish(false)
}
