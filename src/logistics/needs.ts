import { AIRFRAMES, standClassFor, type Airframe } from '../game/airframes'
import type { AircraftKind } from '../game/types'
import type { ServiceKind, SizeClass, TurnaroundNeeds } from './types'

/** Jet A-1 density, kg per litre. */
export const FUEL_DENSITY = 0.8
/** Share of usable fuel uplifted at a typical turnaround. */
export const UPLIFT_FRACTION = 0.6
/** Belly cargo on a passenger flight, as a share of the hold. Freighters use their own factor. */
export const PAX_CARGO_FACTOR = 0.3
export const FREIGHTER_CARGO_FACTOR = 0.8

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

/** Checked bags per passenger: longer sectors, more bags. */
const BAGS_PER_PAX: Record<AircraftKind, number> = {
  regional: 0.7,
  narrowbody: 0.9,
  widebody: 1.3,
  freighter: 0,
  military: 0,
  air_ambulance: 0.5,
  helo_med: 0,
  helo_exec: 0,
}

const BASE_MINUTES: Record<SizeClass, { catering: number; cleaning: number; gpu: number; pushback: number }> = {
  S: { catering: 6, cleaning: 6, gpu: 20, pushback: 3 },
  M: { catering: 12, cleaning: 12, gpu: 35, pushback: 5 },
  L: { catering: 25, cleaning: 25, gpu: 60, pushback: 8 },
}

function isHelo(kind: AircraftKind): boolean {
  return kind === 'helo_med' || kind === 'helo_exec'
}

/** Service plan for one airframe. Derived from the airframe table so new ids pick up needs automatically. */
export function needsForAirframe(af: Airframe): TurnaroundNeeds {
  const sizeClass = standClassFor(af.kind)
  const fuelLitres = Math.round((af.fuelLoad * 1000 * UPLIFT_FRACTION) / FUEL_DENSITY)
  const carriesPax = af.seats > 0 && af.kind !== 'freighter' && af.kind !== 'military'
  const meals = carriesPax ? Math.round(af.seats * MEALS_PER_SEAT[af.kind]) : 0
  const bagsPerPax = carriesPax ? BAGS_PER_PAX[af.kind] : 0
  const factor = af.kind === 'freighter' ? FREIGHTER_CARGO_FACTOR : PAX_CARGO_FACTOR
  const cargoKg = isHelo(af.kind) ? 0 : Math.round(af.cargoHold * 1000 * factor)
  const holdWork = cargoKg > 0 || bagsPerPax > 0
  const loader = !holdWork ? null : sizeClass === 'L' ? 'uld_loader' : 'belt_loader'
  const base = BASE_MINUTES[sizeClass]
  const services: ServiceKind[] = []
  if (carriesPax) services.push('deplane')
  if (bagsPerPax > 0) services.push('bag_unload')
  if (cargoKg > 0) services.push('cargo_unload')
  if (loader) services.push('loader')
  if (fuelLitres > 0) services.push('fuel')
  if (meals > 0) services.push('catering')
  if (carriesPax) services.push('cleaning')
  if (!isHelo(af.kind)) services.push('gpu')
  if (carriesPax) services.push('boarding')
  if (bagsPerPax > 0) services.push('bag_load')
  if (cargoKg > 0) services.push('cargo_load')
  services.push('door_close')
  if (!isHelo(af.kind)) services.push('pushback')
  const superHeavy = ['a380', 'b748f', 'an124', 'c5'].includes(af.id)
  return {
    superHeavy,
    upperDeck: af.id === 'a380',
    fuelPoints: sizeClass === 'L' ? 2 : 1,
    maxBridgeDoors: af.id === 'a380' ? 3 : sizeClass === 'L' ? 2 : 1,
    airframeId: af.id,
    sizeClass,
    seats: af.seats,
    carriesPax,
    bagsPerPax,
    cargoKg,
    loader,
    fuelLitres,
    meals,
    cateringMinutes: base.catering,
    cleaningMinutes: base.cleaning,
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
