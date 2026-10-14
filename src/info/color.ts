import { BAY_LEGEND, FUEL_FILL, HEAT, POWER_RATIO, QUEUE_WAIT_SEC } from './config.ts'

/** Wait heat for one check-in desk or security lane. */
export function waitColor(waitSec: number): string {
  if (!Number.isFinite(waitSec) || waitSec < QUEUE_WAIT_SEC.mid) return HEAT.low
  if (waitSec < QUEUE_WAIT_SEC.high) return HEAT.mid
  return HEAT.high
}

/** Stand colour: idle, an aircraft on the stand, or vehicles queued at its bays. */
export function bayColor(occupied: boolean, queued: number): string {
  if (queued > 0) return HEAT.high
  if (occupied) return HEAT.mid
  return HEAT.low
}

export function bayLabel(occupied: boolean, queued: number): string {
  if (queued > 0) return BAY_LEGEND[2].label
  if (occupied) return BAY_LEGEND[1].label
  return BAY_LEGEND[0].label
}

/** One site-wide load against the plant capacity. */
export function powerColor(demand: number, capacity: number): string {
  if (!(capacity > 0)) return demand > 0 ? HEAT.high : HEAT.low
  const ratio = demand / capacity
  if (ratio < POWER_RATIO.mid) return HEAT.low
  if (ratio < POWER_RATIO.high) return HEAT.mid
  return HEAT.high
}

/** Farm fill. A low tank is the hot colour. */
export function fuelColor(litres: number, capacity: number): string {
  if (!(capacity > 0)) return HEAT.high
  const fill = litres / capacity
  if (fill < FUEL_FILL.low) return HEAT.high
  if (fill < FUEL_FILL.mid) return HEAT.mid
  return HEAT.low
}
