import type { AircraftKind, ResearchId } from './types'

/** Real-world-flavored metal. minRunway is apron cells of continuous strip needed. */
export interface Airframe {
  id: string
  name: string
  kind: AircraftKind
  minRunway: number
  paxMin: number
  paxMax: number
  /** Visual scale in the 3D apron. */
  scale: number
  landingMult: number
  blurb: string
  /** Locked until this research node is bought. */
  research?: ResearchId
}

export const AIRFRAMES: Record<string, Airframe> = {
  crj700: {
    id: 'crj700',
    name: 'CRJ-700',
    kind: 'regional',
    minRunway: 8,
    paxMin: 60,
    paxMax: 78,
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
    paxMax: 290,
    scale: 1.55,
    landingMult: 1.4,
    blurb: 'Widebody — heavy strip required.',
  },
  a359: {
    id: 'a359',
    name: 'Airbus A350-900',
    kind: 'widebody',
    minRunway: 18,
    paxMin: 300,
    paxMax: 350,
    scale: 1.62,
    landingMult: 1.5,
    blurb: 'Long-haul widebody — heavy strip.',
  },
  atr72: {
    id: 'atr72',
    name: 'ATR 72-600',
    kind: 'regional',
    minRunway: 8,
    paxMin: 68,
    paxMax: 78,
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
    scale: 1.35,
    landingMult: 1.15,
    blurb: 'Mid freighter — wants long pavement.',
  },
  b748f: {
    id: 'b748f',
    name: 'Boeing 747-8F',
    kind: 'freighter',
    minRunway: 20,
    paxMin: 0,
    paxMax: 0,
    scale: 1.78,
    landingMult: 1.55,
    blurb: 'Queen of freighters — heavy strip only.',
  },
  c130: {
    id: 'c130',
    name: 'Lockheed C-130H',
    kind: 'military',
    minRunway: 12,
    paxMin: 0,
    paxMax: 0,
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
    scale: 1.58,
    landingMult: 1.6,
    blurb: 'Strategic airlifter — fat landing fee.',
  },
  kc135: {
    id: 'kc135',
    name: 'Boeing KC-135R',
    kind: 'military',
    minRunway: 18,
    paxMin: 0,
    paxMax: 0,
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
    scale: 1.88,
    landingMult: 1.75,
    blurb: 'Strategic airlifter — Guard host + Military ramp research.',
    research: 'mil_ramp',
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

export function airframesForKind(kind: AircraftKind): Airframe[] {
  return Object.values(AIRFRAMES).filter((a) => a.kind === kind)
}

export function pickAirframe(
  kind: AircraftKind,
  longestRunway: number,
  unlocked: ResearchId[] = [],
): Airframe | null {
  const pool = airframesForKind(kind).filter(
    (a) =>
      (a.minRunway === 0 || longestRunway >= a.minRunway) &&
      researchOk(a, unlocked),
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
): Airframe | null {
  const order: AircraftKind[] = cargo
    ? [preferred, 'freighter']
    : [preferred, 'narrowbody', 'regional', 'widebody']
  const seen = new Set<AircraftKind>()
  for (const k of order) {
    if (seen.has(k)) continue
    seen.add(k)
    const af = pickAirframe(k, longestRunway, unlocked)
    if (af) return af
  }
  return null
}
