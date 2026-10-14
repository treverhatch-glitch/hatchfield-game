/**
 * Real-world overall dimensions (meters) and the shape cues the builder needs.
 * Length, span, height, wheelbase, and doors come from the verified pack in
 * realworld.ts. One world scale: meters × WORLD_PER_METER for buildings,
 * people, vehicles, and pavement. Aircraft multiply by AIRCRAFT_VISUAL_SCALE
 * on top of that so they read larger, and the stand limit box uses the same factor.
 */

import type { IcaoCode, RealDoor } from './realworld'
import { REAL_AIRFRAMES } from './realworld'

/** World units per real meter. Shared by the apron, the terminal, and the aircraft. */
export const WORLD_PER_METER = 0.45

/**
 * Aircraft only. 1.2 keeps a 737 recognisable beside a 1.75 m person.
 * Stand limit lines use the same factor so the painted box stays around the
 * drawn wings. Wing-disc clearance stays in real meters.
 */
export const AIRCRAFT_VISUAL_SCALE = 1.2

export function aircraftWorldPerMeter(): number {
  return WORLD_PER_METER * AIRCRAFT_VISUAL_SCALE
}

/**
 * One cell is an ICAO code-E taxiway (23 m). Two cells is a code-4 runway
 * width (45 m). Three cells is about a code-F strip (60 m). Length stays in
 * cells, so the strip is a compressed picture of a real runway.
 */
export const METERS_PER_CELL = 22

export const CELL = METERS_PER_CELL * WORLD_PER_METER

/** Code-C wingtip-to-obstacle clearance, meters. Applied on top of the visual span. */
export const WING_GAP_M = 4.5

/**
 * Painted stand limit, real meters, before AIRCRAFT_VISUAL_SCALE.
 * Width is across the wings. Depth is nose to tail.
 * Width already holds the ICAO wingtip clearance (code A/B 3 m, C 4.5 m, D–F 7.5 m)
 * outside the code's span limit, and depth fits the longest type in that class
 * with nose and tail room.
 *
 * Code C is the 36 m span class: 36 + 4.5 + 4.5 = 45 m wide, 52 m deep (A321 is 44.5 m).
 * Code E is the 65 m class: 65 + 7.5 + 7.5 = 80 m wide, 82 m deep (777-300ER is 73.9 m).
 * Code F is the 80 m class: 80 + 7.5 + 7.5 = 95 m wide, 88 m deep (A380 is 72.7 × 79.8).
 */
export const STAND_ENVELOPE: Record<
  IcaoCode,
  { widthM: number; depthM: number; clearanceM: number }
> = {
  A: { widthM: 21, depthM: 28, clearanceM: 3 },
  B: { widthM: 30, depthM: 42, clearanceM: 3 },
  C: { widthM: 45, depthM: 52, clearanceM: 4.5 },
  D: { widthM: 67, depthM: 70, clearanceM: 7.5 },
  E: { widthM: 80, depthM: 82, clearanceM: 7.5 },
  F: { widthM: 95, depthM: 88, clearanceM: 7.5 },
  H: { widthM: 20, depthM: 20, clearanceM: 3 },
}

export type FuselageFamily = 'tube' | 'rearjet' | 'point' | 'prop' | 'helo'
export type WingletKind = 'none' | 'fence' | 'blended' | 'raked'
export type TailKind = 'conventional' | 't' | 'twin'
export type EngineMount = 'wing' | 'rear' | 'nose' | 'tail'
export type EngineKind = 'turbofan' | 'turboprop' | 'turbojet' | 'none'

export interface EngineSpec {
  count: 0 | 1 | 2 | 4
  kind: EngineKind
  mount: EngineMount
  /** Nacelle radius, meters. */
  radius: number
  /** Nacelle length, meters. */
  length: number
}

export interface ModelSpec {
  id: string
  lengthM: number
  spanM: number
  heightM: number
  family: FuselageFamily
  /** Horizontal fuselage radius, meters. */
  rx: number
  /** Vertical fuselage radius, meters. */
  ry: number
  /** Belly clearance above the wheels, meters. */
  gear: number
  /** Wing-root fraction from nose (0) to tail (1). */
  wingAt: number
  wingHigh: boolean
  rootChord: number
  tipChord: number
  /** Sweep back, degrees. */
  sweep: number
  /** Positive dihedral, degrees. Negative is anhedral. */
  dihedral: number
  thickness: number
  winglet: WingletKind
  tail: TailKind
  tailSpan: number
  engines: EngineSpec
  windows: boolean
  decks: 1 | 2
  hump: boolean
  cargoDoor: boolean
  noseVisor: boolean
  boom: boolean
  sponsons: boolean
  floats: boolean
  hopper: boolean
  skids: boolean
  tailWheel: boolean
  bodyGear: boolean
  /** Extra main-gear wheels on the close LOD. */
  bogie: boolean
  /** Main-rotor radius, meters. 0 for fixed wing. */
  rotor: number
  blades: number
  fenestron: boolean
  /** Nose-gear to main-gear distance, meters. Tailwheel types measure main to tail. */
  wheelbaseM: number
  /** ICAO code letter. H is a helicopter. */
  icao: IcaoCode
  /** Door stations from the verified pack. Drawn on the close LOD. */
  doors: RealDoor[]
}

export interface Livery {
  /** Airline fuselage color. */
  body: string
  /** Cheatline color. Also the tail color when `tail` is omitted. */
  stripe: string
  /** Tail and winglet color. */
  tail?: string
  /** Two-letter tail mark. Resolved from the airline when omitted. */
  mark?: string
  /**
   * `twotone` (default): white crown over the airline-colour belly, grey wings.
   * `solid`: the whole airframe in `body` (military, medevac, freighters).
   */
  scheme?: 'twotone' | 'solid'
  /**
   * Catalog airline id (`bushline`, `crown`, …). When set, the shell looks up
   * `public/textures/liveries/manifest.json` and samples that airline's
   * fuselage and tail JPEGs. Engines use the manifest's solid colour.
   * Missing art keeps the procedural colours.
   */
  airline?: string
}

type Core = Pick<ModelSpec, 'id' | 'lengthM' | 'spanM' | 'heightM'>

function spec(partial: Core & Partial<Omit<ModelSpec, keyof Core>>): ModelSpec {
  const lengthM = partial.lengthM
  const spanM = partial.spanM
  const built: ModelSpec = {
    family: 'tube',
    rx: 1.9,
    ry: 1.95,
    gear: 2.3,
    wingAt: 0.42,
    wingHigh: false,
    rootChord: lengthM * 0.17,
    tipChord: lengthM * 0.045,
    sweep: 25,
    dihedral: 5,
    thickness: 0.42,
    winglet: 'fence',
    tail: 'conventional',
    tailSpan: spanM * 0.34,
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 0.95, length: 3.2 },
    windows: true,
    decks: 1,
    hump: false,
    cargoDoor: false,
    noseVisor: false,
    boom: false,
    sponsons: false,
    floats: false,
    hopper: false,
    skids: false,
    tailWheel: false,
    bodyGear: false,
    bogie: false,
    rotor: 0,
    blades: 0,
    fenestron: false,
    wheelbaseM: lengthM * 0.38,
    icao: 'C',
    doors: [],
    ...partial,
  }
  const real = REAL_AIRFRAMES[partial.id]
  if (!real) return built
  return {
    ...built,
    lengthM: real.lengthM,
    spanM: real.spanM,
    heightM: real.heightM,
    wheelbaseM: real.wheelbaseM,
    icao: real.icao,
    doors: real.doors,
  }
}

/** One entry per airframe id in the sim catalog. */
export const MODEL_SPECS: Record<string, ModelSpec> = {
  bn2: spec({
    id: 'bn2',
    lengthM: 10.86,
    spanM: 14.94,
    heightM: 4.18,
    family: 'prop',
    rx: 0.72,
    ry: 0.82,
    gear: 0.9,
    wingAt: 0.42,
    wingHigh: true,
    rootChord: 1.6,
    tipChord: 1.05,
    sweep: 0,
    dihedral: 2,
    thickness: 0.22,
    winglet: 'none',
    tail: 'conventional',
    tailSpan: 4.6,
    engines: { count: 2, kind: 'turboprop', mount: 'wing', radius: 0.28, length: 1.2 },
    blades: 2,
  }),
  dhc6: spec({
    id: 'dhc6',
    lengthM: 15.77,
    spanM: 19.81,
    heightM: 5.94,
    family: 'prop',
    rx: 0.9,
    ry: 1.05,
    gear: 1.15,
    wingAt: 0.4,
    wingHigh: true,
    rootChord: 2.1,
    tipChord: 1.15,
    sweep: 0,
    dihedral: 3,
    thickness: 0.26,
    winglet: 'none',
    tail: 'conventional',
    tailSpan: 6.2,
    engines: { count: 2, kind: 'turboprop', mount: 'wing', radius: 0.38, length: 1.6 },
    blades: 3,
  }),
  crj700: spec({
    id: 'crj700',
    lengthM: 32.51,
    spanM: 23.24,
    heightM: 7.57,
    family: 'rearjet',
    rx: 1.32,
    ry: 1.35,
    gear: 1.55,
    wingAt: 0.46,
    rootChord: 4.2,
    tipChord: 1.15,
    sweep: 26,
    thickness: 0.32,
    winglet: 'fence',
    tail: 't',
    tailSpan: 8.2,
    engines: { count: 2, kind: 'turbofan', mount: 'rear', radius: 0.62, length: 2.4 },
  }),
  e175: spec({
    id: 'e175',
    lengthM: 31.68,
    spanM: 28.65,
    heightM: 9.73,
    family: 'rearjet',
    rx: 1.48,
    ry: 1.52,
    gear: 1.85,
    wingAt: 0.48,
    rootChord: 4.6,
    tipChord: 1.25,
    sweep: 24,
    thickness: 0.34,
    winglet: 'blended',
    tail: 'conventional',
    tailSpan: 10,
    engines: { count: 2, kind: 'turbofan', mount: 'rear', radius: 0.72, length: 2.7 },
  }),
  a223: spec({
    id: 'a223',
    lengthM: 38.7,
    spanM: 35.1,
    heightM: 11.5,
    rx: 1.85,
    ry: 1.9,
    gear: 2.1,
    rootChord: 5.8,
    tipChord: 1.45,
    sweep: 25,
    winglet: 'blended',
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 1.05, length: 3.3 },
  }),
  e195e2: spec({
    id: 'e195e2',
    lengthM: 41.5,
    spanM: 35.12,
    heightM: 10.9,
    rx: 1.5,
    ry: 1.55,
    gear: 1.9,
    wingAt: 0.48,
    rootChord: 5.2,
    tipChord: 1.3,
    sweep: 24,
    winglet: 'blended',
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 0.92, length: 3.0 },
  }),
  a320neo: spec({
    id: 'a320neo',
    lengthM: 37.57,
    spanM: 35.8,
    heightM: 11.76,
    rx: 1.97,
    ry: 2.02,
    gear: 2.15,
    rootChord: 6.2,
    tipChord: 1.55,
    sweep: 25,
    winglet: 'blended',
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 1.15, length: 3.5 },
  }),
  b738: spec({
    id: 'b738',
    lengthM: 39.47,
    spanM: 35.79,
    heightM: 12.55,
    rx: 1.88,
    ry: 1.93,
    gear: 2.05,
    rootChord: 6.4,
    tipChord: 1.5,
    sweep: 25,
    dihedral: 6,
    winglet: 'blended',
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 0.98, length: 3.3 },
  }),
  a321: spec({
    id: 'a321',
    lengthM: 44.51,
    spanM: 35.8,
    heightM: 11.76,
    rx: 1.97,
    ry: 2.02,
    gear: 2.2,
    rootChord: 6.2,
    tipChord: 1.55,
    sweep: 25,
    winglet: 'fence',
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 1.05, length: 3.4 },
  }),
  b38m: spec({
    id: 'b38m',
    lengthM: 39.52,
    spanM: 35.9,
    heightM: 12.3,
    rx: 1.88,
    ry: 1.93,
    gear: 2.05,
    rootChord: 6.4,
    tipChord: 1.5,
    sweep: 25,
    dihedral: 6,
    winglet: 'blended',
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 1.02, length: 3.4 },
  }),
  a21xlr: spec({
    id: 'a21xlr',
    lengthM: 44.51,
    spanM: 35.8,
    heightM: 11.76,
    rx: 1.97,
    ry: 2.02,
    gear: 2.2,
    rootChord: 6.2,
    tipChord: 1.55,
    sweep: 25,
    winglet: 'fence',
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 1.05, length: 3.4 },
  }),
  b789: spec({
    id: 'b789',
    lengthM: 62.81,
    spanM: 60.12,
    heightM: 17.02,
    rx: 2.88,
    ry: 2.98,
    gear: 3.15,
    rootChord: 11.2,
    tipChord: 2.4,
    sweep: 32,
    thickness: 0.62,
    winglet: 'raked',
    tailSpan: 20,
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 1.55, length: 4.5 },
    bogie: true,
  }),
  b77w: spec({
    id: 'b77w',
    lengthM: 73.86,
    spanM: 64.8,
    heightM: 18.5,
    rx: 3.1,
    ry: 3.2,
    gear: 3.4,
    rootChord: 12.6,
    tipChord: 2.6,
    sweep: 32,
    thickness: 0.68,
    winglet: 'raked',
    tailSpan: 21.5,
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 1.68, length: 5.2 },
    bogie: true,
  }),
  a359: spec({
    id: 'a359',
    lengthM: 66.8,
    spanM: 64.75,
    heightM: 17.05,
    rx: 2.98,
    ry: 3.08,
    gear: 3.3,
    rootChord: 12.4,
    tipChord: 2.7,
    sweep: 32,
    thickness: 0.66,
    winglet: 'blended',
    tailSpan: 21,
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 1.62, length: 4.7 },
    bogie: true,
  }),
  atr72: spec({
    id: 'atr72',
    lengthM: 27.17,
    spanM: 27.05,
    heightM: 7.65,
    family: 'prop',
    rx: 1.28,
    ry: 1.38,
    gear: 1.45,
    wingAt: 0.44,
    wingHigh: true,
    rootChord: 2.6,
    tipChord: 1.45,
    sweep: 2,
    dihedral: 2,
    thickness: 0.32,
    winglet: 'none',
    tail: 't',
    tailSpan: 8,
    engines: { count: 2, kind: 'turboprop', mount: 'wing', radius: 0.48, length: 2.5 },
    blades: 6,
  }),
  b752f: spec({
    id: 'b752f',
    lengthM: 47.32,
    spanM: 38.05,
    heightM: 13.56,
    rx: 1.88,
    ry: 1.96,
    gear: 2.35,
    rootChord: 8.2,
    tipChord: 1.8,
    sweep: 25,
    winglet: 'none',
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 1.08, length: 3.7 },
    windows: false,
    cargoDoor: true,
    bogie: true,
  }),
  b763f: spec({
    id: 'b763f',
    lengthM: 54.94,
    spanM: 47.57,
    heightM: 15.85,
    rx: 2.5,
    ry: 2.7,
    gear: 2.9,
    rootChord: 10.2,
    tipChord: 2.2,
    sweep: 31,
    thickness: 0.55,
    winglet: 'none',
    engines: { count: 2, kind: 'turbofan', mount: 'wing', radius: 1.28, length: 4.1 },
    windows: false,
    cargoDoor: true,
    bogie: true,
  }),
  b748f: spec({
    id: 'b748f',
    lengthM: 76.25,
    spanM: 68.4,
    heightM: 19.35,
    rx: 3.22,
    ry: 3.35,
    gear: 3.7,
    rootChord: 14.5,
    tipChord: 3.4,
    sweep: 37,
    dihedral: 7,
    thickness: 0.72,
    winglet: 'raked',
    tailSpan: 22,
    engines: { count: 4, kind: 'turbofan', mount: 'wing', radius: 1.22, length: 4.3 },
    windows: false,
    hump: true,
    cargoDoor: true,
    bodyGear: true,
    bogie: true,
  }),
  c130: spec({
    id: 'c130',
    lengthM: 29.79,
    spanM: 40.41,
    heightM: 11.84,
    family: 'prop',
    rx: 2.15,
    ry: 2.25,
    gear: 2.55,
    wingAt: 0.46,
    wingHigh: true,
    rootChord: 4.8,
    tipChord: 2.2,
    sweep: 0,
    dihedral: 2,
    thickness: 0.42,
    winglet: 'none',
    tail: 'conventional',
    tailSpan: 16,
    engines: { count: 4, kind: 'turboprop', mount: 'wing', radius: 0.62, length: 3.1 },
    windows: false,
    cargoDoor: true,
    sponsons: true,
    blades: 4,
  }),
  c17: spec({
    id: 'c17',
    lengthM: 53.04,
    spanM: 51.74,
    heightM: 16.79,
    rx: 2.75,
    ry: 2.95,
    gear: 3.15,
    wingAt: 0.48,
    wingHigh: true,
    rootChord: 10.5,
    tipChord: 2.6,
    sweep: 25,
    dihedral: 3,
    thickness: 0.6,
    winglet: 'fence',
    tail: 't',
    tailSpan: 18,
    engines: { count: 4, kind: 'turbofan', mount: 'wing', radius: 1.32, length: 4.2 },
    windows: false,
    cargoDoor: true,
    bogie: true,
  }),
  kc135: spec({
    id: 'kc135',
    lengthM: 41.53,
    spanM: 39.88,
    heightM: 12.7,
    rx: 1.88,
    ry: 1.96,
    gear: 2.25,
    rootChord: 8.4,
    tipChord: 1.9,
    sweep: 35,
    thickness: 0.48,
    winglet: 'none',
    engines: { count: 4, kind: 'turbojet', mount: 'wing', radius: 0.72, length: 3.2 },
    windows: false,
    boom: true,
    bogie: true,
  }),
  f15: spec({
    id: 'f15',
    lengthM: 19.43,
    spanM: 13.05,
    heightM: 5.64,
    family: 'point',
    rx: 0.95,
    ry: 0.72,
    gear: 1.15,
    wingAt: 0.55,
    rootChord: 5.1,
    tipChord: 1.15,
    sweep: 38,
    dihedral: 0,
    thickness: 0.22,
    winglet: 'none',
    tail: 'twin',
    tailSpan: 6.4,
    engines: { count: 2, kind: 'turbojet', mount: 'tail', radius: 0.48, length: 2.6 },
    windows: false,
  }),
  citation: spec({
    id: 'citation',
    lengthM: 18.97,
    spanM: 22.04,
    heightM: 6.38,
    family: 'rearjet',
    rx: 0.86,
    ry: 0.9,
    gear: 1.25,
    wingAt: 0.48,
    rootChord: 2.6,
    tipChord: 0.95,
    sweep: 12,
    dihedral: 3,
    thickness: 0.22,
    winglet: 'fence',
    tail: 't',
    tailSpan: 6.4,
    engines: { count: 2, kind: 'turbofan', mount: 'rear', radius: 0.42, length: 1.7 },
  }),
  pc12: spec({
    id: 'pc12',
    lengthM: 14.4,
    spanM: 16.28,
    heightM: 4.26,
    family: 'prop',
    rx: 0.82,
    ry: 0.92,
    gear: 1.05,
    wingAt: 0.42,
    rootChord: 1.85,
    tipChord: 1.05,
    sweep: 0,
    dihedral: 2,
    thickness: 0.22,
    winglet: 'none',
    tail: 't',
    tailSpan: 5.4,
    engines: { count: 1, kind: 'turboprop', mount: 'nose', radius: 0.38, length: 1.3 },
    blades: 4,
  }),
  cl415: spec({
    id: 'cl415',
    lengthM: 19.82,
    spanM: 28.6,
    heightM: 8.98,
    family: 'prop',
    rx: 1.35,
    ry: 1.45,
    gear: 1.7,
    wingAt: 0.46,
    wingHigh: true,
    rootChord: 3.1,
    tipChord: 1.6,
    sweep: 0,
    dihedral: 1,
    thickness: 0.34,
    winglet: 'none',
    tail: 't',
    tailSpan: 9,
    engines: { count: 2, kind: 'turboprop', mount: 'wing', radius: 0.5, length: 2.4 },
    windows: false,
    floats: true,
    blades: 4,
  }),
  at802: spec({
    id: 'at802',
    lengthM: 10.95,
    spanM: 18.06,
    heightM: 3.89,
    family: 'prop',
    rx: 0.72,
    ry: 0.78,
    gear: 1.15,
    wingAt: 0.4,
    rootChord: 2.15,
    tipChord: 1.15,
    sweep: 0,
    dihedral: 2,
    thickness: 0.22,
    winglet: 'none',
    tail: 'conventional',
    tailSpan: 5.6,
    engines: { count: 1, kind: 'turboprop', mount: 'nose', radius: 0.42, length: 1.4 },
    windows: false,
    hopper: true,
    tailWheel: true,
    blades: 4,
  }),
  aw139: spec({
    id: 'aw139',
    lengthM: 16.66,
    spanM: 13.8,
    heightM: 4.98,
    family: 'helo',
    rx: 1.35,
    ry: 1.48,
    gear: 0.85,
    wingAt: 0.4,
    rootChord: 1,
    tipChord: 1,
    sweep: 0,
    dihedral: 0,
    thickness: 0.2,
    winglet: 'none',
    tail: 'conventional',
    tailSpan: 2.2,
    engines: { count: 0, kind: 'none', mount: 'wing', radius: 0, length: 0 },
    windows: false,
    rotor: 6.9,
    blades: 5,
    fenestron: true,
  }),
  s76: spec({
    id: 's76',
    lengthM: 16.0,
    spanM: 13.41,
    heightM: 4.42,
    family: 'helo',
    rx: 1.15,
    ry: 1.28,
    gear: 0.7,
    wingAt: 0.4,
    rootChord: 1,
    tipChord: 1,
    sweep: 0,
    dihedral: 0,
    thickness: 0.18,
    winglet: 'none',
    tail: 'conventional',
    tailSpan: 2,
    engines: { count: 0, kind: 'none', mount: 'wing', radius: 0, length: 0 },
    windows: false,
    skids: true,
    rotor: 6.7,
    blades: 4,
    fenestron: false,
  }),
  a380: spec({
    id: 'a380',
    lengthM: 72.72,
    spanM: 79.75,
    heightM: 24.09,
    rx: 3.57,
    ry: 4.2,
    gear: 4.6,
    wingAt: 0.4,
    rootChord: 16.5,
    tipChord: 3.6,
    sweep: 33,
    dihedral: 5,
    thickness: 0.9,
    winglet: 'fence',
    tailSpan: 28,
    engines: { count: 4, kind: 'turbofan', mount: 'wing', radius: 1.68, length: 4.9 },
    decks: 2,
    bodyGear: true,
    bogie: true,
  }),
  an124: spec({
    id: 'an124',
    lengthM: 69.1,
    spanM: 73.3,
    heightM: 21.08,
    rx: 3.45,
    ry: 3.65,
    gear: 4.3,
    wingAt: 0.46,
    wingHigh: true,
    rootChord: 13.5,
    tipChord: 3.8,
    sweep: 22,
    dihedral: -4,
    thickness: 0.85,
    winglet: 'none',
    tail: 'conventional',
    tailSpan: 24,
    engines: { count: 4, kind: 'turbofan', mount: 'wing', radius: 1.45, length: 4.6 },
    windows: false,
    cargoDoor: true,
    noseVisor: true,
    bodyGear: true,
    bogie: true,
  }),
  c5: spec({
    id: 'c5',
    lengthM: 75.31,
    spanM: 67.89,
    heightM: 19.84,
    rx: 3.5,
    ry: 3.85,
    gear: 3.9,
    wingAt: 0.48,
    wingHigh: true,
    rootChord: 13.2,
    tipChord: 3.6,
    sweep: 25,
    dihedral: -5,
    thickness: 0.82,
    winglet: 'none',
    tail: 't',
    tailSpan: 22,
    engines: { count: 4, kind: 'turbofan', mount: 'wing', radius: 1.4, length: 4.5 },
    windows: false,
    cargoDoor: true,
    noseVisor: true,
    bodyGear: true,
    bogie: true,
  }),
}

const FALLBACK = 'b738'

export function getAircraftSpec(airframeId: string): ModelSpec {
  return MODEL_SPECS[airframeId] ?? MODEL_SPECS[FALLBACK]
}
