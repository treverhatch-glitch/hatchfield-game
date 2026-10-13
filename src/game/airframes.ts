import { tierOpen } from '../scale/logic'
import type { AircraftKind, ResearchId, StandClass } from './types'

/** Real-world-flavored metal. minRunway is apron cells of continuous strip needed. */
export interface Airframe {
  id: string
  name: string
  kind: AircraftKind
  minRunway: number
  paxMin: number
  paxMax: number
  /**
   * Typical seats. Published two-class / standard layouts, rounded.
   * 0 for freighters and types that don't carry passengers here.
   */
  seats: number
  /**
   * Belly bag-unit cap (~1 unit per 0.12 m³). 0 when the type has no pax hold.
   * Figures are rounded public ballparks for balance, not a certified sheet.
   */
  bagVolume: number
  /** Cargo hold in tonnes, rounded. Freighters use payload; pax types a small belly figure. */
  cargoHold: number
  /** Usable fuel in tonnes, rounded. */
  fuelLoad: number
  /** Visual scale in the 3D apron. */
  scale: number
  landingMult: number
  blurb: string
  /** Locked until this research node is bought. */
  research?: ResearchId
}

export const AIRFRAMES: Record<string, Airframe> = {
  bn2: {
    id: 'bn2',
    name: 'BN-2 Islander',
    kind: 'regional',
    minRunway: 6,
    paxMin: 6,
    paxMax: 9,
    seats: 9,
    bagVolume: 4,
    cargoHold: 0.2,
    fuelLoad: 0.4,
    scale: 0.36,
    landingMult: 0.55,
    blurb: 'Nine-seat commuter — Bushline’s short-strip twin.',
  },
  dhc6: {
    id: 'dhc6',
    name: 'DHC-6 Twin Otter',
    kind: 'regional',
    minRunway: 6,
    paxMin: 9,
    paxMax: 19,
    seats: 19,
    bagVolume: 8,
    cargoHold: 0.4,
    fuelLoad: 0.9,
    scale: 0.48,
    landingMult: 0.7,
    blurb: 'Nineteen-seat commuter — the Twin Otter Bushline sells.',
  },
  crj700: {
    id: 'crj700',
    name: 'CRJ-700',
    kind: 'regional',
    minRunway: 8,
    paxMin: 60,
    paxMax: 78,
    seats: 70,
    bagVolume: 50,
    cargoHold: 2,
    fuelLoad: 8.8,
    scale: 0.78,
    landingMult: 0.8,
    blurb: 'Regional jet — short strip friendly.',
  },
  e175: {
    id: 'e175',
    name: 'Embraer E175',
    kind: 'regional',
    minRunway: 10,
    paxMin: 76,
    paxMax: 88,
    seats: 78,
    bagVolume: 58,
    cargoHold: 2,
    fuelLoad: 9.3,
    scale: 0.84,
    landingMult: 0.85,
    blurb: 'Workhorse regional.',
  },
  a320neo: {
    id: 'a320neo',
    name: 'Airbus A320neo',
    kind: 'narrowbody',
    minRunway: 12,
    paxMin: 150,
    paxMax: 180,
    seats: 180,
    bagVolume: 130,
    cargoHold: 3,
    fuelLoad: 19,
    scale: 1.08,
    landingMult: 1,
    blurb: 'Single-aisle mainline — needs regional strip+.',
  },
  b738: {
    id: 'b738',
    name: 'Boeing 737-800',
    kind: 'narrowbody',
    minRunway: 12,
    paxMin: 160,
    paxMax: 189,
    seats: 189,
    bagVolume: 145,
    cargoHold: 4,
    fuelLoad: 20.8,
    scale: 1.12,
    landingMult: 1.05,
    blurb: 'Everywhere jet — needs regional strip+.',
  },
  a321: {
    id: 'a321',
    name: 'Airbus A321',
    kind: 'narrowbody',
    minRunway: 14,
    paxMin: 180,
    paxMax: 220,
    seats: 220,
    bagVolume: 165,
    cargoHold: 5,
    fuelLoad: 24,
    scale: 1.22,
    landingMult: 1.12,
    blurb: 'Stretched narrowbody — full regional strip.',
  },
  b789: {
    id: 'b789',
    name: 'Boeing 787-9',
    kind: 'widebody',
    minRunway: 18,
    paxMin: 250,
    paxMax: 296,
    seats: 296,
    bagVolume: 240,
    cargoHold: 16,
    fuelLoad: 101,
    scale: 1.55,
    landingMult: 1.4,
    blurb: 'Widebody — heavy strip required.',
    research: 'widebody_ops',
  },
  b77w: {
    id: 'b77w',
    name: 'Boeing 777-300ER',
    kind: 'widebody',
    minRunway: 18,
    paxMin: 300,
    paxMax: 396,
    seats: 396,
    bagVolume: 320,
    cargoHold: 20,
    fuelLoad: 145,
    scale: 1.7,
    landingMult: 1.55,
    blurb: '777-class widebody — widebody ops and a heavy strip.',
    research: 'widebody_ops',
  },
  a359: {
    id: 'a359',
    name: 'Airbus A350-900',
    kind: 'widebody',
    minRunway: 18,
    paxMin: 300,
    paxMax: 350,
    seats: 325,
    bagVolume: 270,
    cargoHold: 18,
    fuelLoad: 108,
    scale: 1.62,
    landingMult: 1.5,
    blurb: 'Long-haul widebody — heavy strip.',
    research: 'widebody_ops',
  },
  atr72: {
    id: 'atr72',
    name: 'ATR 72-600',
    kind: 'regional',
    minRunway: 8,
    paxMin: 68,
    paxMax: 78,
    seats: 72,
    bagVolume: 46,
    cargoHold: 1,
    fuelLoad: 5,
    scale: 0.7,
    landingMult: 0.78,
    blurb: 'Turboprop regional — loves short strips.',
  },
  b752f: {
    id: 'b752f',
    name: 'Boeing 757-200F',
    kind: 'freighter',
    minRunway: 14,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 30,
    fuelLoad: 43,
    scale: 1.18,
    landingMult: 1.08,
    blurb: 'Hot-and-high freighter — regional strip OK.',
  },
  b763f: {
    id: 'b763f',
    name: 'Boeing 767-300F',
    kind: 'freighter',
    minRunway: 16,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 52,
    fuelLoad: 73,
    scale: 1.35,
    landingMult: 1.15,
    blurb: 'Mid freighter — wants long pavement.',
    research: 'widebody_ops',
  },
  b748f: {
    id: 'b748f',
    name: 'Boeing 747-8F',
    kind: 'freighter',
    minRunway: 20,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 137,
    fuelLoad: 183,
    scale: 1.78,
    landingMult: 1.55,
    blurb: 'Queen of freighters — heavy strip only.',
    research: 'heavy_pack',
  },
  c130: {
    id: 'c130',
    name: 'Lockheed C-130H',
    kind: 'military',
    minRunway: 12,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 20,
    fuelLoad: 19,
    scale: 1.18,
    landingMult: 1.2,
    blurb: 'Guard transport — Boise-style hangar transient.',
  },
  c17: {
    id: 'c17',
    name: 'Boeing C-17A Globemaster III',
    kind: 'military',
    minRunway: 16,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 77,
    fuelLoad: 108,
    scale: 1.58,
    landingMult: 1.6,
    blurb: 'Strategic airlifter — fat landing fee.',
    research: 'widebody_ops',
  },
  kc135: {
    id: 'kc135',
    name: 'Boeing KC-135R',
    kind: 'military',
    minRunway: 18,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 0,
    fuelLoad: 90,
    scale: 1.42,
    landingMult: 1.45,
    blurb: 'Tanker — wants heavy pavement.',
  },
  f15: {
    id: 'f15',
    name: 'McDonnell Douglas F-15C',
    kind: 'military',
    minRunway: 10,
    paxMin: 0,
    paxMax: 0,
    seats: 1,
    bagVolume: 0,
    cargoHold: 0,
    fuelLoad: 6,
    scale: 0.55,
    landingMult: 0.95,
    blurb: 'Fighter drag / diversion — quick turn, olive paint.',
  },
  citation: {
    id: 'citation',
    name: 'Cessna Citation Latitude',
    kind: 'air_ambulance',
    minRunway: 8,
    paxMin: 2,
    paxMax: 4,
    seats: 9,
    bagVolume: 6,
    cargoHold: 0,
    fuelLoad: 3,
    scale: 0.58,
    landingMult: 0.7,
    blurb: 'Fixed-wing medevac — short strip OK.',
  },
  pc12: {
    id: 'pc12',
    name: 'Pilatus PC-12',
    kind: 'air_ambulance',
    minRunway: 8,
    paxMin: 2,
    paxMax: 6,
    seats: 9,
    bagVolume: 5,
    cargoHold: 0,
    fuelLoad: 1.2,
    scale: 0.62,
    landingMult: 0.72,
    blurb: 'STOL air ambulance — short strip hero.',
  },
  /** Aerial firefighter — emergency refuel / MX asks (quick-turn like medevac). */
  cl415: {
    id: 'cl415',
    name: 'Canadair CL-415',
    kind: 'air_ambulance',
    minRunway: 10,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 6,
    fuelLoad: 5,
    scale: 1.05,
    landingMult: 1.15,
    blurb: 'Super Scooper — firefighting tanker, thirsty for Jet-A.',
  },
  at802: {
    id: 'at802',
    name: 'Air Tractor AT-802F',
    kind: 'air_ambulance',
    minRunway: 8,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 3,
    fuelLoad: 1.4,
    scale: 0.72,
    landingMult: 0.85,
    blurb: 'Single-engine air tanker — short strip SEAT.',
  },
  aw139: {
    id: 'aw139',
    name: 'Leonardo AW139',
    kind: 'helo_med',
    minRunway: 0,
    paxMin: 2,
    paxMax: 4,
    seats: 15,
    bagVolume: 0,
    cargoHold: 0,
    fuelLoad: 1.2,
    scale: 0.88,
    landingMult: 1,
    blurb: 'Medevac rotary — helipad only.',
  },
  s76: {
    id: 's76',
    name: 'Sikorsky S-76',
    kind: 'helo_exec',
    minRunway: 0,
    paxMin: 4,
    paxMax: 8,
    seats: 12,
    bagVolume: 0,
    cargoHold: 0,
    fuelLoad: 1,
    scale: 0.82,
    landingMult: 1,
    blurb: 'Executive rotary — helipad only.',
  },
  a380: {
    id: 'a380',
    name: 'Airbus A380-800',
    kind: 'widebody',
    minRunway: 20,
    paxMin: 400,
    paxMax: 525,
    seats: 525,
    bagVolume: 400,
    cargoHold: 12,
    fuelLoad: 254,
    scale: 2.05,
    landingMult: 1.95,
    blurb: 'Superjumbo — Heavy metal pack + heavy strip.',
    research: 'heavy_pack',
  },
  an124: {
    id: 'an124',
    name: 'Antonov An-124 Ruslan',
    kind: 'freighter',
    minRunway: 20,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 150,
    fuelLoad: 230,
    scale: 1.95,
    landingMult: 1.85,
    blurb: 'Outsize freighter — Heavy metal pack + heavy strip.',
    research: 'heavy_pack',
  },
  c5: {
    id: 'c5',
    name: 'Lockheed C-5M Super Galaxy',
    kind: 'military',
    minRunway: 20,
    paxMin: 0,
    paxMax: 0,
    seats: 0,
    bagVolume: 0,
    cargoHold: 127,
    fuelLoad: 150,
    scale: 1.88,
    landingMult: 1.75,
    blurb: 'Strategic airlifter — Guard host + Military ramp research.',
    research: 'mil_ramp',
  },
  a223: {
    id: 'a223',
    name: 'Airbus A220-300',
    kind: 'regional',
    minRunway: 16,
    paxMin: 120,
    paxMax: 150,
    seats: 140,
    bagVolume: 100,
    cargoHold: 3,
    fuelLoad: 17.5,
    scale: 0.98,
    landingMult: 0.9,
    blurb: 'Modern efficient small jet — quiet regional mainline.',
  },
  e195e2: {
    id: 'e195e2',
    name: 'Embraer E195-E2',
    kind: 'regional',
    minRunway: 16,
    paxMin: 110,
    paxMax: 146,
    seats: 132,
    bagVolume: 90,
    cargoHold: 2,
    fuelLoad: 13,
    scale: 0.92,
    landingMult: 0.88,
    blurb: 'Stretched crossover jet — high-capacity regional.',
  },
  b38m: {
    id: 'b38m',
    name: 'Boeing 737 MAX 8',
    kind: 'narrowbody',
    minRunway: 16,
    paxMin: 150,
    paxMax: 189,
    seats: 178,
    bagVolume: 140,
    cargoHold: 4,
    fuelLoad: 21,
    scale: 1.12,
    landingMult: 1.05,
    blurb: 'Next-gen narrowbody workhorse — efficient mainline.',
  },
  a21xlr: {
    id: 'a21xlr',
    name: 'Airbus A321XLR',
    kind: 'narrowbody',
    minRunway: 16,
    paxMin: 180,
    paxMax: 220,
    seats: 200,
    bagVolume: 160,
    cargoHold: 5,
    fuelLoad: 32,
    scale: 1.22,
    landingMult: 1.12,
    blurb: 'Extra long range narrowbody — transatlantic reach.',
  },
}

/** Short / regional / heavy tier from continuous cell count. */
export function stripTier(cells: number): 'none' | 'short' | 'regional' | 'heavy' {
  if (cells <= 0) return 'none'
  if (cells >= 18) return 'heavy'
  if (cells >= 12) return 'regional'
  if (cells >= 8) return 'short'
  return 'none'
}

function researchOk(a: Airframe, unlocked: ResearchId[] = []): boolean {
  return !a.research || unlocked.includes(a.research)
}

export function jetAirframesFitting(
  longestRunway: number,
  unlocked: ResearchId[] = [],
): Airframe[] {
  return Object.values(AIRFRAMES).filter(
    (a) =>
      a.minRunway > 0 &&
      longestRunway >= a.minRunway &&
      researchOk(a, unlocked),
  )
}

export function jetAirframesBlocked(
  longestRunway: number,
  unlocked: ResearchId[] = [],
): Airframe[] {
  return Object.values(AIRFRAMES).filter(
    (a) =>
      a.minRunway > 0 &&
      (longestRunway < a.minRunway || !researchOk(a, unlocked)),
  )
}

/** Minimum stand class the metal needs (S ≤ M ≤ L). */
export function standClassFor(kind: AircraftKind): StandClass {
  if (
    kind === 'regional' ||
    kind === 'helo_med' ||
    kind === 'helo_exec' ||
    kind === 'air_ambulance'
  ) {
    return 'S'
  }
  if (kind === 'narrowbody') return 'M'
  return 'L'
}

/** Human-readable role for HUD / news. */
export function craftRoleLabel(kind: AircraftKind): string {
  switch (kind) {
    case 'regional':
    case 'narrowbody':
    case 'widebody':
      return 'Passenger'
    case 'freighter':
      return 'Cargo'
    case 'helo_med':
    case 'air_ambulance':
      return 'Emergency'
    case 'helo_exec':
      return 'Executive'
    case 'military':
      return 'Military'
    default:
      return 'Aircraft'
  }
}

/** Load factor inside the sim's pax band, using the type's seat count. */
export function paxForAirframe(af: Airframe, rng: () => number = Math.random): number {
  if (af.seats <= 0 || af.paxMax <= 0) return 0
  const factor = 0.62 + rng() * 0.33
  const raw = Math.round(af.seats * factor)
  return Math.max(af.paxMin, Math.min(af.paxMax, raw))
}

/** Cap an estimated bag load at the type's hold. */
export function bagUnitsForAirframe(af: Airframe, estimate: number): number {
  if (af.bagVolume <= 0 || estimate <= 0) return 0
  return Math.max(1, Math.min(af.bagVolume, estimate))
}

/** Freight on board, as a fraction of the published hold. */
export function cargoUnitsForAirframe(af: Airframe, rng: () => number = Math.random): number {
  if (af.cargoHold <= 0) return 0
  return Math.max(1, Math.round(af.cargoHold * (0.55 + rng() * 0.4)))
}

/** Pump time. A 737-class load stays near the old 3.6s dwell; heavies take longer. */
export function fuelDwellSeconds(af: Airframe | undefined): number {
  const tonnes = af?.fuelLoad ?? 20
  return Math.max(1.6, Math.min(9, 1.6 + (tonnes / 20) * 2.2))
}

/** Deboard / board / service stretch. Regionals stay close to 1; widebodies run longer. */
export function turnaroundScale(af: Airframe | undefined, cargo: boolean): number {
  if (!af) return 1
  if (cargo || af.kind === 'freighter') {
    return Math.max(0.85, Math.min(2.4, 0.8 + af.cargoHold / 80))
  }
  return Math.max(0.75, Math.min(2.1, 0.75 + af.seats / 160))
}

export function airframesForKind(kind: AircraftKind): Airframe[] {
  return Object.values(AIRFRAMES).filter((a) => a.kind === kind)
}

const PAX_KINDS = new Set<AircraftKind>(['regional', 'narrowbody', 'widebody'])

/** Passenger types whose seat band overlaps the contract. */
export function airframesForPaxBand(paxMin: number, paxMax: number): Airframe[] {
  const lo = Math.min(paxMin, paxMax)
  const hi = Math.max(paxMin, paxMax)
  if (!(hi > 0)) return []
  return Object.values(AIRFRAMES).filter((af) => {
    if (!PAX_KINDS.has(af.kind) || af.seats <= 0) return false
    const overlap = Math.min(af.paxMax, hi) - Math.max(af.paxMin, lo) + 1
    if (overlap > 0) return true
    return af.seats >= lo && af.seats <= Math.round(hi * 1.1)
  })
}

/**
 * Metal this carrier is allowed to send. A named fleet wins. Otherwise the
 * seat band. Never substitutes a 737 for a 19-seat contract.
 */
export function contractedAirframes(
  fleetIds: readonly string[] | undefined,
  paxMin: number,
  paxMax: number,
): Airframe[] {
  if (fleetIds && fleetIds.length) {
    const listed = fleetIds
      .map((id) => AIRFRAMES[id])
      .filter((af): af is Airframe => Boolean(af))
    if (listed.length) return listed
  }
  return airframesForPaxBand(paxMin, paxMax)
}

export function pickAirframe(
  kind: AircraftKind,
  longestRunway: number,
  unlocked: ResearchId[] = [],
  fieldLevel?: number,
  accepts?: (id: string) => boolean,
): Airframe | null {
  const pool = airframesForKind(kind).filter(
    (a) =>
      (a.minRunway === 0 || longestRunway >= a.minRunway) &&
      researchOk(a, unlocked) &&
      (fieldLevel == null || tierOpen(a.id, fieldLevel, unlocked)) &&
      (!accepts || accepts(a.id)),
  )
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Prefer `kind`, then step down to anything that fits the strip (no helos/mil). */
export function pickAirframeWithFallback(
  preferred: AircraftKind,
  longestRunway: number,
  cargo: boolean,
  unlocked: ResearchId[] = [],
  fieldLevel?: number,
  accepts?: (id: string) => boolean,
): Airframe | null {
  const order: AircraftKind[] = cargo
    ? [preferred, 'freighter']
    : [preferred, 'narrowbody', 'regional', 'widebody']
  const seen = new Set<AircraftKind>()
  for (const k of order) {
    if (seen.has(k)) continue
    seen.add(k)
    const af = pickAirframe(k, longestRunway, unlocked, fieldLevel, accepts)
    if (af) return af
  }
  return null
}
