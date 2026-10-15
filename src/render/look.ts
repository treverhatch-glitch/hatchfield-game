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

/**
 * Apron prop colours sampled from the Gemini orthographic sheets
 * (jet bridge, carts, ULDs, fence, lights, benches, windsock, stand hatch).
 * sRGB hex. Sizes stay in the builders; these are only the paints.
 */
export const PROP_LOOK = {
  /** Corrugated tunnel skin. */
  bridge: '#c5c9ce',
  /** Rubber bellows and the drive bogie. */
  bellows: '#2c3138',
  /** Yellow cab stripe along the tunnel skirt. */
  bridgeStripe: '#f0c020',
  /** Galvanised chain-link and posts. */
  chainlink: '#b7bec4',
  /** Barbed strands above the mesh. */
  wire: '#8e969e',
  /** Roll-up cart curtain. */
  curtain: '#d8d2c4',
  /** Hi-vis tape on the cart rail. */
  curtainTape: '#f2bf1f',
  /** LD3 aluminium. */
  uld: '#c5ccd1',
  /** Fictional green ULD panel. No stencil text. */
  uldPanel: '#7dba78',
  /** Pallet net. */
  palletNet: '#3d4a38',
  /** Bench slats, stained timber. */
  benchWood: '#8a5a32',
  /** Bench frame. */
  benchSteel: '#8d949c',
  /** Litter bin shell. */
  bin: '#d5d8dc',
  /** Bin lid band. */
  binBand: '#2f6fbe',
  /** Windsock cloth. */
  sockOrange: '#ff6a1a',
  sockWhite: '#f4f6f8',
  /** Rotating aerodrome beacon. */
  beaconRed: '#d01218',
  beaconGlass: '#9fd4d4',
  /** Stand safety hatch. */
  hatchRed: '#c42828',
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
  /** Metres one copy of the runway-paint plate covers. */
  paintTile: 1.6,
  /**
   * Multiply on the full-res ground plates. Roads stay a touch darker than
   * taxi tarmac so the landside strip still reads. White leaves the plate alone.
   */
  surfaceTint: {
    grass: 0xffffff,
    runway: 0xffffff,
    taxi: 0xffffff,
    apron: 0xffffff,
    road: 0xc2beb6,
    pad: 0xd8dadc,
  },
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
  hemiGroundNight: 0x1e2a22,
  /** Ambient lift. Kept small so the sun still owns the shading. */
  ambientDay: 0.08,
  /** Night apron stays readable. Black keys hid the field at midnight. */
  ambientNight: 0.18,
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

/**
 * Sun disc on the sky dome. Field lights stay on a wider window (`lightsFactor`),
 * so dawn can show a low sun while the runway is still lit.
 */
export const SUN_DISC = {
  /** Stars fade out across this morning span. */
  dawnStart: 5.2,
  dawnEnd: 6.8,
  /** Stars come back after the sun has left the horizon. */
  duskStart: 19.2,
  duskEnd: 20.6,
} as const

/** Tuned sun key over a cooler hemisphere. Noon is sun-led; night is a dim moon. */
export const DAYLIGHT_KEYS: readonly DaylightKey[] = [
  { h: 0, top: 0x1a2844, horizon: 0x3a4e72, sun: 0xb7c6e4, sunI: 0.32, hemi: 0x3a4e72, hemiI: 0.36, exposure: 0.9 },
  { h: 5, top: 0x243456, horizon: 0x4a5e82, sun: 0xc4d2ea, sunI: 0.36, hemi: 0x445880, hemiI: 0.4, exposure: 0.92 },
  { h: 6.5, top: 0x4a4e86, horizon: 0xff8a4e, sun: 0xff8c48, sunI: 1.45, hemi: 0xc4a090, hemiI: 0.62, exposure: 1.04 },
  { h: 8, top: 0x5b98d4, horizon: 0xf2d2aa, sun: 0xffe2b8, sunI: 2.75, hemi: 0xc6daf0, hemiI: 0.82, exposure: 0.98 },
  { h: 11, top: 0x3a7ec4, horizon: 0xd4e6f4, sun: 0xfff0c4, sunI: 3.4, hemi: 0xc5daf4, hemiI: 0.86, exposure: 1.0 },
  { h: 16, top: 0x3a7ec4, horizon: 0xd0e2f0, sun: 0xffebbc, sunI: 3.25, hemi: 0xc5daf4, hemiI: 0.84, exposure: 1.0 },
  { h: 18.2, top: 0x6a5a98, horizon: 0xff9450, sun: 0xff7a38, sunI: 2.05, hemi: 0xd0a898, hemiI: 0.7, exposure: 0.98 },
  { h: 19.3, top: 0x3a3058, horizon: 0xe06848, sun: 0xff7040, sunI: 0.85, hemi: 0xa08090, hemiI: 0.5, exposure: 1.06 },
  { h: 20.5, top: 0x243456, horizon: 0x4a5e82, sun: 0xc4d2ea, sunI: 0.36, hemi: 0x445880, hemiI: 0.4, exposure: 0.92 },
  { h: 24, top: 0x1a2844, horizon: 0x3a4e72, sun: 0xb7c6e4, sunI: 0.32, hemi: 0x3a4e72, hemiI: 0.36, exposure: 0.9 },
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
