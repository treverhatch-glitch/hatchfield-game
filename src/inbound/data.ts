/**
 * Tunables for inbound offers. Fees and fines live in fees.ts (catalog).
 * Needs profiles are the service-fulfilment hooks: ARFF, ambulance, stand,
 * fuel, hotel / pax care, and the security corridor.
 */
import type { AirframeInfo, FlightKind, FlightLine, ServiceKind } from '../contracts/types.ts'
import { timeWindow } from '../contracts/contracts.ts'
import type { GeneralKind, PriorityKind, RequestKind, ServiceNeeds } from './types.ts'

export const DECISION_SEC = 60

/** Arrival at or after 16:00 counts as a night circuit (the field's night third). */
export const NIGHT_START_MIN = 16 * 60

export const CITY_APPROVAL_START = 80
export const REPUTATION_START = 50
export const APPROVAL_RECOVERY_PER_DAY = 1
export const NOISE_DECAY_PER_DAY = 1
export const NOISE_PER_NIGHT = 3
export const APPROVAL_PER_NIGHT = 4
/** Night flying once the city is already this unhappy posts a breach fine. */
export const NOISE_BREACH_AT = 35
export const NOISE_BREACH_FINE = 1_500
export const REP_FAIL = -7
export const GUARD_STANDING_CLEAN_WEEK = 2
export const GUARD_STANDING_PER_MISS = -2

/** Security clearance licence. Separate from the Guard agreement. */
export const CLEARANCE_LICENCE_COST = 12_000

export const UPLIFT_LITRES = 8_000

export function litres(pct: number): number {
  return Math.round((UPLIFT_LITRES * pct) / 100)
}

export function blankNeeds(partial: Partial<ServiceNeeds> = {}): ServiceNeeds {
  return {
    arff: false,
    ambulance: false,
    securityCorridor: false,
    catering: false,
    cleaning: false,
    gpu: false,
    customs: false,
    pad: 'none',
    fuelLitres: 0,
    hotelRooms: 0,
    hangarBays: 0,
    runwayMetres: 0,
    ...partial,
  }
}

export interface RequestProfile {
  kind: RequestKind
  priority: boolean
  title: string
  blurb: string
  needs: ServiceNeeds
  etaSec: number
  stayDays: { min: number; max: number }
  fee:
    | 'divert_band'
    | 'divert_max'
    | 'ambulance'
    | 'tanker'
    | 'tanker_mx'
    | 'military'
    | 'ga_band'
    | 'storage'
}

const jet = (partial: Partial<ServiceNeeds>): ServiceNeeds =>
  blankNeeds({ arff: true, runwayMetres: 1600, ...partial })

export const PROFILES: readonly RequestProfile[] = [
  {
    kind: 'weather_divert',
    priority: true,
    title: 'Weather divert',
    blurb: 'An airliner is off its destination and wants a one-time landing. Stand, ARFF, fuel and a hotel bus.',
    needs: jet({ pad: 'stand', fuelLitres: litres(25), hotelRooms: 8, catering: true, cleaning: true }),
    etaSec: 45,
    stayDays: { min: 1, max: 1 },
    fee: 'divert_band',
  },
  {
    kind: 'medical',
    priority: true,
    title: 'Medical diversion',
    blurb: 'A passenger needs an ambulance at the stand within the hour.',
    needs: jet({ pad: 'stand', ambulance: true, hotelRooms: 1, runwayMetres: 1400 }),
    etaSec: 30,
    stayDays: { min: 1, max: 1 },
    fee: 'ambulance',
  },
  {
    kind: 'fuel_low',
    priority: true,
    title: 'Fuel-low divert',
    blurb: 'Minimum fuel. They need the farm and a stand, then they are gone.',
    needs: jet({ pad: 'stand', fuelLitres: litres(70) }),
    etaSec: 25,
    stayDays: { min: 1, max: 1 },
    fee: 'divert_band',
  },
  {
    kind: 'technical',
    priority: true,
    title: 'Technical divert',
    blurb: 'An in-flight fault. They want a stand and a hangar bay for the night.',
    needs: jet({ pad: 'stand', hangarBays: 1, fuelLitres: litres(10) }),
    etaSec: 40,
    stayDays: { min: 1, max: 1 },
    fee: 'divert_band',
  },
  {
    kind: 'vip',
    priority: true,
    title: 'VIP / state visit',
    blurb: 'A state flight. Secure the stand and keep a corridor clear through the hall.',
    needs: jet({
      pad: 'stand',
      securityCorridor: true,
      hotelRooms: 4,
      catering: true,
      customs: true,
      fuelLitres: litres(20),
    }),
    etaSec: 90,
    stayDays: { min: 1, max: 1 },
    fee: 'divert_max',
  },
  {
    kind: 'medevac',
    priority: true,
    title: 'Medevac helicopter',
    blurb: 'Air ambulance inbound to the pad. Needs a helipad and a crew on the ambulance.',
    needs: blankNeeds({ pad: 'heli', ambulance: true, runwayMetres: 0 }),
    etaSec: 20,
    stayDays: { min: 1, max: 1 },
    fee: 'ambulance',
  },
  {
    kind: 'tanker',
    priority: true,
    title: 'Firefighting tanker',
    blurb: 'Airtanker wants a bowser top-off and ARFF cover, then back to the line.',
    needs: jet({ pad: 'stand', fuelLitres: litres(80), runwayMetres: 1200 }),
    etaSec: 35,
    stayDays: { min: 1, max: 1 },
    fee: 'tanker',
  },
  {
    kind: 'tanker_mx',
    priority: true,
    title: 'Firefighting tanker + MX',
    blurb: 'Airtanker wants fuel and a hangar bay for line maintenance before the next drop.',
    needs: jet({ pad: 'stand', fuelLitres: litres(80), hangarBays: 1, runwayMetres: 1200 }),
    etaSec: 35,
    stayDays: { min: 1, max: 1 },
    fee: 'tanker_mx',
  },
  {
    kind: 'military',
    priority: true,
    title: 'Military arrival',
    blurb: 'A Guard aircraft wants the apron for a single landing. Not a contract sortie.',
    needs: jet({ pad: 'guard', fuelLitres: litres(50), runwayMetres: 1800 }),
    etaSec: 50,
    stayDays: { min: 1, max: 1 },
    fee: 'military',
  },
  {
    kind: 'ga',
    priority: false,
    title: 'General aviation',
    blurb: 'A light aircraft wants transient parking. Remote pad, or a stand if that is all you have.',
    needs: blankNeeds({
      pad: 'remote',
      padFallback: 'stand',
      fuelLitres: litres(15),
      runwayMetres: 800,
    }),
    etaSec: 40,
    stayDays: { min: 1, max: 1 },
    fee: 'ga_band',
  },
  {
    kind: 'bizjet',
    priority: false,
    title: 'Business jet',
    blurb: 'A bizjet wants a stand, GPU, a crew room and catering.',
    needs: blankNeeds({
      pad: 'stand',
      padFallback: 'remote',
      fuelLitres: litres(30),
      gpu: true,
      catering: true,
      cleaning: true,
      hotelRooms: 1,
      runwayMetres: 1400,
    }),
    etaSec: 50,
    stayDays: { min: 1, max: 1 },
    fee: 'ga_band',
  },
  {
    kind: 'charter',
    priority: false,
    title: 'Charter',
    blurb: 'A charter wants the full turn: fuel, catering, cleaning, GPU, customs and a crew hotel.',
    needs: blankNeeds({
      pad: 'stand',
      fuelLitres: litres(40),
      catering: true,
      cleaning: true,
      gpu: true,
      customs: true,
      hotelRooms: 2,
      runwayMetres: 1600,
    }),
    etaSec: 60,
    stayDays: { min: 1, max: 2 },
    fee: 'ga_band',
  },
  {
    kind: 'ferry',
    priority: false,
    title: 'Ferry / positioning',
    blurb: 'An empty ferry flight. Fuel and a stand, no passengers and no catering.',
    needs: blankNeeds({
      pad: 'stand',
      padFallback: 'remote',
      fuelLitres: litres(50),
      gpu: true,
      runwayMetres: 1600,
    }),
    etaSec: 40,
    stayDays: { min: 1, max: 1 },
    fee: 'ga_band',
  },
  {
    kind: 'storage',
    priority: false,
    title: 'Long-term parking',
    blurb: 'An owner wants the aircraft parked for days on a remote stand or the grass. It blocks that pad.',
    needs: blankNeeds({
      pad: 'remote',
      padFallback: 'grass',
      runwayMetres: 800,
    }),
    etaSec: 80,
    stayDays: { min: 3, max: 30 },
    fee: 'storage',
  },
]

const BY_KIND = new Map<RequestKind, RequestProfile>(PROFILES.map((p) => [p.kind, p]))

export function profile(kind: RequestKind): RequestProfile {
  const found = BY_KIND.get(kind)
  if (!found) throw new Error(`unknown inbound kind ${kind}`)
  return found
}

export const PRIORITY_KINDS: readonly PriorityKind[] = PROFILES.filter((p) => p.priority).map(
  (p) => p.kind as PriorityKind,
)

export const GENERAL_KINDS: readonly GeneralKind[] = PROFILES.filter((p) => !p.priority).map(
  (p) => p.kind as GeneralKind,
)

/** Military airframes passed into the #19 validator. Not in the civil default table. */
export const MILITARY_AIRFRAMES: Record<string, AirframeInfo> = {
  c130: { sizeClass: 'narrow', mtowTonnes: 70, seats: 92 },
  kc135: { sizeClass: 'narrow', mtowTonnes: 146, seats: 0 },
  c17: { sizeClass: 'wide', mtowTonnes: 265, seats: 0 },
  c5: { sizeClass: 'super', mtowTonnes: 381, seats: 0 },
}

export interface MilitaryTemplate {
  id: string
  name: string
  term: 1 | 2 | 4
  lines: FlightLine[]
  services: ServiceKind[]
}

function line(
  id: string,
  airframeId: string,
  days: number[],
  preferredMin: number,
  turnaroundMin: number,
): FlightLine {
  return {
    id,
    airframeId,
    kind: 'freighter' satisfies FlightKind,
    days,
    arrival: timeWindow(preferredMin),
    turnaroundTargetMin: turnaroundMin,
    origin: 'GUARD',
    destination: 'FIELD',
    flightNumber: id.toUpperCase(),
  }
}

export const MILITARY_TEMPLATES: readonly MilitaryTemplate[] = [
  {
    id: 'tanker_stop',
    name: 'Tanker stopover',
    term: 2,
    services: ['fuel', 'pushback', 'gpu_pca'],
    lines: [line('kc-day', 'kc135', [0, 3], 10 * 60, 50)],
  },
  {
    id: 'training',
    name: 'Training detachment',
    term: 2,
    services: ['fuel', 'pushback', 'gpu_pca', 'cleaning'],
    lines: [
      line('c130-day', 'c130', [1, 2, 4], 9 * 60, 50),
      line('c130-night', 'c130', [2, 4], 22 * 60, 50),
    ],
  },
  {
    id: 'humanitarian',
    name: 'Humanitarian airlift',
    term: 2,
    services: ['fuel', 'pushback', 'cargo'],
    lines: [line('c17-day', 'c17', [0, 2, 5], 11 * 60, 90)],
  },
  {
    id: 'airlift',
    name: 'Heavy airlift',
    term: 2,
    services: ['fuel', 'pushback', 'gpu_pca'],
    lines: [line('c5-day', 'c5', [1], 8 * 60, 120)],
  },
]

export function militaryTemplate(id: string): MilitaryTemplate {
  const found = MILITARY_TEMPLATES.find((t) => t.id === id)
  if (!found) throw new Error(`unknown military template ${id}`)
  return found
}
