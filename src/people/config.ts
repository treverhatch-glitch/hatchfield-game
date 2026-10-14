/** Tunables for the people module. Meters, seconds, radians. */

export const PEOPLE_LOD = {
  /** Within this range: full body with accessories. */
  nearDistance: 28,
  /** Within this range: simple body, no accessories. Past it: single block. */
  midDistance: 85,
  /** Past this range nobody is drawn. */
  farDistance: 260,
  /** Per-level instance budgets; the closest people win the better level. */
  nearCap: 400,
  midCap: 1200,
} as const

/** Hard instance capacity per part mesh. */
export const PEOPLE_CAPACITY = 4096

export const SKIN_TONES = [0xf6d5b8, 0xe8b88f, 0xd09a6c, 0xb67a4d, 0x8d5a38, 0x5e3a25] as const
export const HAIR_COLORS = [0x15110e, 0x3b2616, 0x6b4423, 0xa8742f, 0xd8b66a, 0x8a8a8a, 0xb23a1e] as const
export const SHIRT_COLORS = [
  0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x14b8a6, 0x3b82f6, 0x8b5cf6, 0xec4899, 0xf5f5f4, 0x737373, 0x78350f, 0x0ea5e9,
] as const
export const TROUSER_COLORS = [0x1e293b, 0x334155, 0x1d4ed8, 0x57534e, 0x0f172a, 0xa8a29e, 0x3f6212, 0x7c2d12] as const
export const BAG_COLORS = [0x1f2937, 0x7f1d1d, 0x1e3a8a, 0x065f46, 0x6b21a8, 0x9a3412, 0xb91c1c] as const

/** Share of passengers carrying each thing (rolls are independent). */
export const PAX_RATES = {
  backpack: 0.3,
  hat: 0.14,
  roller: 0.34,
  duffel: 0.12,
  cart: 0.05,
  longHair: 0.4,
  bald: 0.06,
  stroller: 0.03,
  /** Share of passengers (when no age is forced) who are elderly. */
  elder: 0.08,
} as const

export const BODY = {
  /** Kids and teens are scaled copies of adults. */
  kidScale: 0.62,
  teenScale: 0.86,
  elderScale: 0.96,
  heightSpread: 0.07,
  /** Build: slim to stocky. */
  widthSpread: 0.2,
  /** Head size relative to an adult: children keep big heads. */
  headScale: { adult: 1, elder: 1, teen: 1.08, kid: 1.3 },
  /** Forward stoop in radians. */
  elderStoop: 0.2,
} as const

export const ELDER_HAIR = [0xe5e5e5, 0xbdbdbd, 0x8a8a8a] as const

/** Strides per second derive from ground speed, clamped. */
export const WALK = {
  strideLengthM: 1.3,
  minRate: 0.4,
  maxRate: 3.2,
  legSwing: 0.6,
  armSwing: 0.5,
} as const

/** Ground-crew work motions. Rates are cycles per second; angles radians; drops metres. */
export const WORK_POSE = {
  /** One bag from hip height to the belt and back. */
  liftRate: 0.55,
  liftLow: 0.35,
  liftHigh: 2.05,
  /** Small hand movements while kneeling at a coupling or chock. */
  kneelRate: 0.5,
  kneelDrop: 0.42,
  /** Arms held forward while carrying. */
  carryArms: 0.75,
  /** Sideways raise of the wing walker's wand arm. */
  signalRaise: 1.45,
  /** Seconds to blend from one pose into the next. */
  blendSec: 0.3,
} as const

/** Family members stay inside these radii of the lead. */
export const GROUP = {
  kidLeashM: 1.6,
  adultLeashM: 2.6,
} as const
