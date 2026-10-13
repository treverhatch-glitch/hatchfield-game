/**
 * How many offers a day rolls.
 * Priority asks stay inside 0–2 and rise with field level.
 * General traffic is 1–3 early and 6–10 late, and moves with the fee multiplier.
 * Rolling an offer never occupies a stand.
 */
import { GENERAL_KINDS, PRIORITY_KINDS } from './data.ts'
import { nextFloat, pickWeighted, rollInt } from './rng.ts'
import type { GeneralKind, InboundState, InboundWorld, PriorityKind } from './types.ts'

export function clampLevel(fieldLevel: number): number {
  if (fieldLevel < 1) return 1
  if (fieldLevel > 10) return 10
  return fieldLevel
}

/** Inclusive band of walk-in offers at the default fee. */
export function generalBand(fieldLevel: number): { min: number; max: number } {
  const t = (clampLevel(fieldLevel) - 1) / 9
  let min = Math.round(1 + t * 5)
  let max = Math.round(3 + t * 7)
  if (max < min) max = min
  return { min, max }
}

/**
 * Fees under the default draw more walk-ins.
 * Fees above 1.3× default cut them. The band itself is unchanged at 1×.
 */
export function applyFeeElasticity(quota: number, feeMultiplier: number): number {
  const fee = Math.max(0, feeMultiplier)
  let scaled = quota
  if (fee < 1) scaled = quota * (1 + (1 - fee) * 0.35)
  else if (fee > 1.3) scaled = quota * (1.3 / fee)
  return Math.max(0, Math.round(scaled))
}

export function rollEmergencyCount(fieldLevel: number, draw: () => number): number {
  const t = (clampLevel(fieldLevel) - 1) / 9
  const p2 = 0.05 + 0.35 * t
  const p1 = 0.25 + 0.2 * t
  const r = draw()
  if (r < p2) return 2
  if (r < p2 + p1) return 1
  return 0
}

export function priorityWeight(kind: PriorityKind, world: InboundWorld, guardAgreement: boolean): number {
  const level = clampLevel(world.fieldLevel)
  const weather = world.weather
  switch (kind) {
    case 'weather_divert':
      if (weather === 'storm') return 5
      if (weather === 'fog') return 4
      if (weather === 'snow') return 3
      return 1
    case 'medical':
      return weather === 'storm' || weather === 'snow' ? 2 : 1
    case 'fuel_low':
      return 1.2
    case 'technical':
      return 1
    case 'vip':
      return level >= 4 ? 1.6 : 0.35
    case 'medevac':
      return 1
    case 'tanker':
      if (weather === 'clear') return 3
      if (weather === 'storm') return 2
      return 1
    case 'tanker_mx':
      return 0.8
    case 'military':
      if (!guardAgreement) return 0
      return level >= 3 ? 1.4 : 0.6
    default:
      return 0
  }
}

export function generalWeight(kind: GeneralKind, world: InboundWorld): number {
  const level = clampLevel(world.fieldLevel)
  if (kind === 'storage') return level >= 6 ? 1.4 : 0.7
  if (kind === 'charter') return level >= 5 ? 1.2 : 0.8
  return 1
}

export function rollPriorityKind(state: InboundState, world: InboundWorld): PriorityKind | null {
  return pickWeighted(state, PRIORITY_KINDS, (kind) => priorityWeight(kind, world, state.licence.guardAgreement))
}

export function rollGeneralKind(state: InboundState, world: InboundWorld): GeneralKind | null {
  return pickWeighted(state, GENERAL_KINDS, (kind) => generalWeight(kind, world))
}

export function rollEmergencyFor(state: InboundState, world: InboundWorld): number {
  return rollEmergencyCount(world.fieldLevel, () => nextFloat(state))
}

export function rollGeneralFor(state: InboundState, world: InboundWorld): number {
  const band = generalBand(world.fieldLevel)
  const raw = rollInt(state, band.min, band.max)
  return applyFeeElasticity(raw, world.feeMultiplier)
}
