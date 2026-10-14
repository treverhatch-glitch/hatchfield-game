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
  /** Window panes along one side at mid LOD, before the deck multiplier. */
  windowCount: 12,
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

/** Sky dome extras. */
export const SKY_LOOK = {
  /** Warm halo around the sun direction. */
  sunGlow: 0.32,
  sunGlowPower: 18,
  /** Pale haze band hugging the horizon. */
  horizonHaze: 0.22,
} as const
