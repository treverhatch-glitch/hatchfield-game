/**
 * Roster and catalog fleets, resolved to the airframes the sim actually flies.
 * Seat bands, stand class, and runway cells come from those airframes.
 * Rendering does not live here.
 */
import { REAL_AIRFRAMES, type IcaoCode } from '../render/aircraft/realworld.ts'
import { SIZE_TIERS } from '../scale/data.ts'
import { sizeTierOf, tierOpen } from '../scale/logic.ts'
import { AIRFRAMES, standClassFor, type Airframe } from './airframes.ts'
import { HEAVY_RUNWAY_LEN, RESEARCH_NODES, standClassLabel, standClassRank } from './catalog.ts'
import type { ResearchId, StandClass } from './types.ts'

export interface FieldFit {
  runway: number
  helipad: boolean
  fieldLevel: number
  research: readonly ResearchId[]
  standClasses: readonly StandClass[]
}

export function isHeloAirframe(af: Airframe): boolean {
  return af.kind.startsWith('helo') || icaoOf(af.id) === 'H'
}

export function icaoOf(airframeId: string): IcaoCode | null {
  return REAL_AIRFRAMES[airframeId]?.icao ?? null
}

/** Smallest S/M/L stand that accepts this code. Helicopters are not stands. */
export function standClassForIcao(icao: IcaoCode): StandClass | null {
  if (icao === 'H') return null
  if (icao === 'A' || icao === 'B') return 'S'
  if (icao === 'C') return 'M'
  return 'L'
}

/** Stand the metal actually parks on. ICAO wins; kind is the fallback. */
export function airframeStandClass(af: Airframe): StandClass | null {
  if (isHeloAirframe(af)) return null
  const icao = icaoOf(af.id)
  if (icao) return standClassForIcao(icao)
  return standClassFor(af.kind)
}

export function resolvedAirframes(ids: readonly string[] | undefined): Airframe[] {
  if (!ids) return []
  const out: Airframe[] = []
  for (const id of ids) {
    const af = AIRFRAMES[id]
    if (af && !out.some((row) => row.id === af.id)) out.push(af)
  }
  return out
}

/** Passenger seat band of the fleet. Freighters and tankers with no seats stay at 0. */
export function fleetSeatBand(frames: readonly Airframe[]): { paxMin: number; paxMax: number } {
  const pax = frames.filter((af) => af.paxMax > 0)
  if (!pax.length) return { paxMin: 0, paxMax: 0 }
  return {
    paxMin: Math.min(...pax.map((af) => af.paxMin)),
    paxMax: Math.max(...pax.map((af) => af.paxMax)),
  }
}

export function fleetStandClass(frames: readonly Airframe[]): StandClass | null {
  let best: StandClass | null = null
  for (const af of frames) {
    const cls = airframeStandClass(af)
    if (!cls) continue
    if (!best || standClassRank(cls) > standClassRank(best)) best = cls
  }
  return best
}

export function fleetRunwayCells(frames: readonly Airframe[]): number {
  const fixed = frames.filter((af) => !isHeloAirframe(af))
  if (!fixed.length) return 0
  return Math.max(...fixed.map((af) => af.minRunway))
}

/** Heavy-runway stamp only when every fixed-wing type needs that strip. */
export function fleetNeedsHeavyRunway(frames: readonly Airframe[]): boolean {
  const fixed = frames.filter((af) => !isHeloAirframe(af))
  return fixed.length > 0 && fixed.every((af) => af.minRunway >= HEAVY_RUNWAY_LEN)
}

/** Airlines card and letter share this line. */
export function fleetCardLine(frames: readonly Airframe[]): string {
  if (!frames.length) return 'Fleet not listed'
  const names = frames.map((af) => af.name).join(' / ')
  const band = fleetSeatBand(frames)
  const seats = band.paxMax > 0 ? `${band.paxMin}–${band.paxMax} seats` : 'no passengers'
  if (frames.every((af) => isHeloAirframe(af))) return `${names} · ${seats} · Helipad`
  const cls = fleetStandClass(frames)
  const stand = cls ? `${standClassLabel(cls)}+` : 'Stand'
  return `${names} · ${seats} · ${stand} · ${fleetRunwayCells(frames)}c strip`
}

function researchName(id: ResearchId): string {
  return RESEARCH_NODES.find((node) => node.id === id)?.name ?? id
}

function standAvailable(need: StandClass, have: readonly StandClass[]): boolean {
  return have.some((cls) => standClassRank(cls) >= standClassRank(need))
}

/**
 * Why this type cannot operate here. Null when the strip, stand or pad,
 * field level, and research can take it. Pillar staffing is not a gate.
 */
export function airframeGap(af: Airframe, field: FieldFit): string | null {
  if (isHeloAirframe(af)) {
    if (!field.helipad) return 'Helipad'
  } else {
    if (af.minRunway > 0 && field.runway < af.minRunway) return `${af.minRunway}c strip`
    const need = airframeStandClass(af)
    if (need && !standAvailable(need, field.standClasses)) return `${standClassLabel(need)}+`
  }
  const tier = SIZE_TIERS[sizeTierOf(af.id)]
  if (field.fieldLevel < tier.fieldLevel) return `Field Lv${tier.fieldLevel}`
  if (tier.research && !field.research.includes(tier.research)) return researchName(tier.research)
  if (af.research && !field.research.includes(af.research)) return researchName(af.research)
  if (!tierOpen(af.id, field.fieldLevel, [...field.research])) return `Field Lv${tier.fieldLevel}`
  return null
}

/** Gap for the easiest type, or null when at least one type can operate. */
export function easiestGap(frames: readonly Airframe[], field: FieldFit): string | null {
  if (!frames.length) return 'fleet not listed'
  const ranked = [...frames].sort((a, b) => a.minRunway - b.minRunway || a.id.localeCompare(b.id))
  let first: string | null = null
  for (const af of ranked) {
    const gap = airframeGap(af, field)
    if (!gap) return null
    if (!first) first = gap
  }
  return first
}
