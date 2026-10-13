import { AIRFRAMES, standClassFor, type Airframe } from '../game/airframes'
import type { AircraftKind } from '../game/types'
import type { ServiceKind, SizeClass, TurnaroundNeeds } from './types'

/** Jet A-1 density, kg per litre. */
export const FUEL_DENSITY = 0.8
/** Share of usable fuel uplifted at a typical turnaround. */
export const UPLIFT_FRACTION = 0.6

const MEALS_PER_SEAT: Record<AircraftKind, number> = {
  regional: 0.5,
  narrowbody: 1,
  widebody: 2,
  freighter: 0,
  military: 0,
  air_ambulance: 0.5,
  helo_med: 0,
  helo_exec: 1,
}

const BASE_MINUTES: Record<SizeClass, { catering: number; baggage: number; gpu: number; pushback: number }> = {
  S: { catering: 6, baggage: 8, gpu: 20, pushback: 3 },
  M: { catering: 12, baggage: 15, gpu: 35, pushback: 5 },
  L: { catering: 25, baggage: 30, gpu: 60, pushback: 8 },
}

function isHelo(kind: AircraftKind): boolean {
  return kind === 'helo_med' || kind === 'helo_exec'
}

/** Service plan for one airframe. Derived from the airframe table so new ids pick up needs automatically. */
export function needsForAirframe(af: Airframe): TurnaroundNeeds {
  const sizeClass = standClassFor(af.kind)
  const fuelLitres = Math.round((af.fuelLoad * 1000 * UPLIFT_FRACTION) / FUEL_DENSITY)
  const meals = Math.round(af.seats * (MEALS_PER_SEAT[af.kind] ?? 0))
  const base = BASE_MINUTES[sizeClass]
  const services: ServiceKind[] = []
  if (fuelLitres > 0) services.push('fuel')
  if (meals > 0) services.push('catering')
  if (af.bagVolume > 0 || af.cargoHold > 0) services.push('baggage')
  if (!isHelo(af.kind)) services.push('gpu', 'pushback')
  return {
    airframeId: af.id,
    sizeClass,
    fuelLitres,
    meals,
    cateringMinutes: base.catering,
    baggageMinutes: base.baggage,
    gpuMinutes: base.gpu,
    pushbackMinutes: base.pushback,
    services,
  }
}

export function needsFor(airframeId: string): TurnaroundNeeds {
  const af = AIRFRAMES[airframeId]
  if (!af) throw new Error(`Unknown airframe: ${airframeId}`)
  return needsForAirframe(af)
}

export function allNeeds(): TurnaroundNeeds[] {
  return Object.values(AIRFRAMES).map(needsForAirframe)
}
