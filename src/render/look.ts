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
  fuselageSides: { low: 5, mid: 16 },
  /** Window panes along one side at mid LOD, before the deck multiplier. */
  windowCount: 12,
  /** Painted shell material. */
  /** Glossy clear-coated livery: low roughness picks up the sky and sun from the env map. */
  paint: { metalness: 0.1, roughness: 0.24 },
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
  /** Baggage cart bed and bag boxes on the tug train. */
  cart: '#3e4650',
  bag: '#6a5340',
  hose: '#22262b',
} as const

/** Procedural ground palette (sRGB hex). */
export const GROUND_LOOK = {
  grassDark: 0x5a6a46,
  grassMid: 0x7d8a5e,
  grassDry: 0xaaa277,
  grassBladeLight: 0x8a9864,
  grassBladeDark: 0x43553c,
  /** Mowing bands across the infield (two per texture tile, about 8 m wide), as a ± brightness swing. */
  mowStripe: 0.07,
  /** How much of the season's grass tint reaches the plot (0 = none, 1 = full). */
  seasonTint: 0.45,
  /** Worn brown patches mixed into the grass texture. */
  grassWorn: 0x8d7d58,
  taxiAsphalt: 0x56595e,
  runwayAsphalt: 0x4a4d52,
  /** Landside roads: darker and browner than taxi asphalt. */
  roadAsphalt: 0x3c3f44,
  concrete: 0xb9bcbf,
  /** Slabs along each edge of one concrete texture tile. */
  slabCount: 3,
  joint: 0x5a5e62,
  /** Raised kerb along an open road edge, in world units. */
  kerb: 0xc8cbcf,
  kerbH: 0.08,
  kerbW: 0.2,
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
  { h: 0, top: 0x0a1430, horizon: 0x1b2a4a, sun: 0x8ea6d8, sunI: 0.18, hemi: 0x30406a, hemiI: 0.32, exposure: 1.15 },
  { h: 5, top: 0x0f1c3c, horizon: 0x2c3658, sun: 0x8ea6d8, sunI: 0.16, hemi: 0x34446c, hemiI: 0.34, exposure: 1.15 },
  { h: 6.5, top: 0x3c5a92, horizon: 0xe49a6c, sun: 0xffb27a, sunI: 1.35, hemi: 0x9aa8c8, hemiI: 0.62, exposure: 1.05 },
  { h: 8, top: 0x5b98d4, horizon: 0xf2d2aa, sun: 0xffe2b8, sunI: 2.75, hemi: 0xc6daf0, hemiI: 0.82, exposure: 0.98 },
  { h: 11, top: 0x3a7ec4, horizon: 0xd4e6f4, sun: 0xfff0c4, sunI: 3.4, hemi: 0xc5daf4, hemiI: 0.86, exposure: 1.0 },
  { h: 16, top: 0x3a7ec4, horizon: 0xd0e2f0, sun: 0xffebbc, sunI: 3.25, hemi: 0xc5daf4, hemiI: 0.84, exposure: 1.0 },
  { h: 18.2, top: 0x5a84c0, horizon: 0xf2b276, sun: 0xffb06a, sunI: 2.15, hemi: 0xc8bcb4, hemiI: 0.72, exposure: 0.98 },
  { h: 19.3, top: 0x2c3c70, horizon: 0xd2745a, sun: 0xff8a5a, sunI: 0.8, hemi: 0x8a7aa0, hemiI: 0.52, exposure: 1.08 },
  { h: 20.5, top: 0x0e1a3a, horizon: 0x2a3458, sun: 0x8ea6d8, sunI: 0.18, hemi: 0x34446c, hemiI: 0.34, exposure: 1.15 },
  { h: 24, top: 0x0a1430, horizon: 0x1b2a4a, sun: 0x8ea6d8, sunI: 0.18, hemi: 0x30406a, hemiI: 0.32, exposure: 1.15 },
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
