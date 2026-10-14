/**
 * Visual tunables for the apron look pass (issue 193): paint, liveries, vehicles,
 * ground palette and sky. Numbers only, so art passes never touch render logic.
 */

/** Aircraft paint. Colours are sRGB hex. */
export const AIRCRAFT_LOOK = {
  /** Upper fuselage on two-tone liveries ("eurowhite" crown). */
  crown: '#eef1f4',
  /** Wing and stabiliser skin: painted light grey on most airliners. */
  wing: '#b9bfc6',
  /** Nacelles, struts and other bare parts. */
  metal: '#8c949c',
  /** Crown / belly split on the unit fuselage loft (−1 belly … +1 crown). */
  crownLine: -0.02,
  /** Below this the belly takes the darker belly shade. */
  bellyLine: -0.72,
  /** Belly shade, as a multiple of the airline colour. */
  bellyShade: 0.78,
  /** Fuselage sides per LOD. Smooth normals hide the facets, so mid can stay modest. */
  fuselageSides: { low: 5, mid: 12 },
  /** Painted shell material. */
  paint: { metalness: 0.08, roughness: 0.38 },
} as const

/** Ground service vehicles. Lengths come from `vehicleMeters` in world.ts. */
export const VEHICLE_LOOK = {
  glass: '#22323e',
  tyre: '#1b1d20',
  hub: '#9aa2aa',
  chassis: '#2c3136',
  beacon: '#ffad1f',
  /** Hi-vis stripe along the lower body. */
  stripe: '#f2f4f2',
  /** Share of the length taken by the cab. */
  cabShare: 0.26,
  /** Wheel radius in meters. */
  wheelM: 0.42,
  material: { metalness: 0.12, roughness: 0.52 },
} as const

/** Procedural ground palette (sRGB hex). */
export const GROUND_LOOK = {
  grassDark: 0x5a6a46,
  grassMid: 0x7d8a5e,
  grassDry: 0xaaa277,
  grassBladeLight: 0x8a9864,
  grassBladeDark: 0x43553c,
  /** Mowing bands across the infield (two per texture tile, about 8 m wide), as a ± brightness swing. */
  mowStripe: 0.05,
  /** How much of the season's grass tint reaches the plot (0 = none, 1 = full). */
  seasonTint: 0.45,
  taxiAsphalt: 0x56595e,
  runwayAsphalt: 0x4a4d52,
  concrete: 0xb9bcbf,
} as const

/** Sky dome extras. The dome is a horizon → mid → zenith gradient plus this halo. */
export const SKY_LOOK = {
  /** Warm halo around the sun direction. */
  sunGlow: 0.46,
  /** Lower is a wider bloom around the sun disc. */
  sunGlowPower: 12,
  /** Pale haze band hugging the horizon. */
  horizonHaze: 0.3,
} as const

/**
 * Sun and hemisphere balance. Lambert divides diffuse by π, so a midday key near
 * 3.4 puts sunlit concrete at its real brightness over a cooler, weaker sky fill.
 * The curve itself lives in `DAYLIGHT_KEYS`.
 */
export const LIGHT_LOOK = {
  /** Ground bounce under the hemisphere, day and night. */
  hemiGroundDay: 0x6e8a4e,
  hemiGroundNight: 0x1a2418,
  /** Ambient lift. Kept small so the sun still owns the shading. */
  ambientDay: 0.08,
  ambientNight: 0.22,
  shadowBias: -0.00045,
  shadowNormalBias: 0.04,
} as const

/** One row of the sun path. Hours wrap with a duplicate at 24. */
export interface DaylightKey {
  h: number
  top: number
  horizon: number
  sun: number
  sunI: number
  hemi: number
  hemiI: number
  exposure: number
}

/** Tuned sun key over a cooler hemisphere. Noon is sun-led; night is a dim moon. */
export const DAYLIGHT_KEYS: readonly DaylightKey[] = [
  { h: 0, top: 0x060b1e, horizon: 0x111c33, sun: 0xa8c0ff, sunI: 0.12, hemi: 0x1a264a, hemiI: 0.28, exposure: 1.15 },
  { h: 5, top: 0x080f26, horizon: 0x19284d, sun: 0xa8c0ff, sunI: 0.12, hemi: 0x203058, hemiI: 0.30, exposure: 1.15 },
  { h: 6.5, top: 0x2a4474, horizon: 0xffa472, sun: 0xffce99, sunI: 1.45, hemi: 0x7c8ba8, hemiI: 0.58, exposure: 1.05 },
  { h: 8, top: 0x4883c4, horizon: 0xffdec4, sun: 0xffebcc, sunI: 2.85, hemi: 0xb4cae6, hemiI: 0.78, exposure: 0.98 },
  { h: 11, top: 0x4282cc, horizon: 0xe6f2fc, sun: 0xfff7e6, sunI: 3.6, hemi: 0xc0d8f8, hemiI: 0.90, exposure: 1.0 },
  { h: 16, top: 0x4282cc, horizon: 0xe0eef8, sun: 0xfff4d9, sunI: 3.45, hemi: 0xc0d8f8, hemiI: 0.88, exposure: 1.0 },
  { h: 18.2, top: 0x4b72aa, horizon: 0xffb784, sun: 0xffb87a, sunI: 2.25, hemi: 0xb8acb4, hemiI: 0.70, exposure: 0.98 },
  { h: 19.3, top: 0x223060, horizon: 0xda684a, sun: 0xff8f5a, sunI: 0.9, hemi: 0x7a6a90, hemiI: 0.50, exposure: 1.08 },
  { h: 20.5, top: 0x0a1430, horizon: 0x1a284d, sun: 0xa8c0ff, sunI: 0.14, hemi: 0x283864, hemiI: 0.32, exposure: 1.15 },
  { h: 24, top: 0x060b1e, horizon: 0x111c33, sun: 0xa8c0ff, sunI: 0.12, hemi: 0x1a264a, hemiI: 0.28, exposure: 1.15 },
]

/** Filmic grade applied after tone mapping, on Medium and High. */
export const GRADE_LOOK = {
  saturation: 1.08,
  contrast: 1.06,
  /**
   * Toe added back after the contrast pivot. Contrast around mid grey
   * would otherwise clip the night apron to black.
   */
  lift: 0.05,
  warmR: 1.03,
  warmB: 0.97,
} as const

/** Baked contact discs. One instanced draw on Medium and High. Low skips the fill. */
export const CONTACT_LOOK = {
  /** Centre darkening, 0–1. The rim fades to nothing. */
  strength: 0.32,
  power: 1.85,
  y: 0.035,
} as const

/** Additive light bloom. Low softens the existing glow sprite; Medium and High add a wider halo. */
export const BLOOM_LOOK = {
  /** Main glow falloff. Lower is a softer bloom inside the same point size. */
  glowPower: 1.65,
  haloPower: 1.05,
  haloSize: 2.35,
  haloOpacity: 0.4,
} as const

/** Terminal-view fill. Low leaves tone mapping off so the hall does not recompile a filmic shader. */
export const HALL_LIGHT = {
  hemiSky: '#f4f8ff',
  hemiGround: '#e7dcc8',
  hemi: 1.55,
  sun: '#fff4e4',
  sunI: 1.85,
  ambient: '#fff8f0',
  ambientI: 0.46,
  exposure: 1.18,
} as const
