/**
 * Engine-agnostic sun / moon path and ground-shadow projection. Plain numbers in and out, no
 * renderer imports, so it ports to any engine. Axes: +y up, +x east, +z south (the game's world).
 *
 * `sunDirection(hour, season)` is the direction from the ground TOWARD the light. Day runs
 * 06:00–20:00 (east in the morning, high at midday, west at dusk); night hands over to the moon.
 * `season` tilts the arc: higher summer noon, lower winter noon. Omitting it gives the base arc.
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export interface Vec3 {
  x: number
  y: number
  z: number
}
export interface LightDir extends Vec3 {
  /** Radians above the horizon. */
  elevation: number
  source: 'sun' | 'moon'
}

/** Noon-height multiplier per season. Unknown or missing season keeps the base arc. */
export const SEASON_ELEVATION: Readonly<Record<Season, number>> = {
  spring: 1,
  summer: 1.12,
  autumn: 0.95,
  winter: 0.8,
}

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}
const wrapHour = (hour: number) => ((hour % 24) + 24) % 24
const seasonScale = (season?: string | null) => (season && season in SEASON_ELEVATION ? SEASON_ELEVATION[season as Season] : 1)

/** Moon arc 20:00 → 06:00, rising east, setting west, slightly north. */
export function moonDirection(hour: number): LightDir {
  const h = wrapHour(hour)
  const t = h >= 20 ? (h - 20) / 10 : (h + 4) / 10
  const a = t * Math.PI
  const elev = Math.max(0.22, Math.sin(a)) * 0.95
  const v = unit({ x: Math.cos(a) * Math.cos(elev), y: Math.sin(elev), z: -0.28 * Math.cos(elev) })
  return { ...v, elevation: Math.asin(v.y), source: 'moon' }
}

export function sunDirection(hour: number, season?: string | null): LightDir {
  const h = wrapHour(hour)
  if (!(h >= 6 && h <= 20)) return moonDirection(h)
  const a = ((h - 6) / 14) * Math.PI
  // Season scales the arc height; the floor keeps a low dawn/dusk sun just above the horizon.
  const elev = Math.min(1.45, Math.max(0.12, Math.sin(a)) * 1.05 * seasonScale(season))
  const v = unit({ x: Math.cos(a) * Math.cos(elev), y: Math.sin(elev), z: 0.35 * Math.cos(elev) })
  return { ...v, elevation: Math.asin(v.y), source: 'sun' }
}

export interface ShadowCast {
  /** Unit ground heading the shadow falls along (away from the light). */
  ux: number
  uz: number
  /** How far past its base an object of the given height throws its shadow. */
  castLength: number
  /** Ground slide of an airborne caster's shadow along the heading. */
  slide: number
}

/** Longest shadow, as a multiple of caster height, so a sunrise sun cannot paint the whole map. */
export const MAX_SHADOW_RATIO = 6

/**
 * Project a caster of `height` lifted `lift` above the ground. Low light gives long shadows,
 * overhead light gives short ones. `dir` points toward the light and need not be unit length.
 */
export function shadowCast(dir: Vec3, height: number, lift = 0): ShadowCast {
  const l = Math.hypot(dir.x, dir.y, dir.z) || 1
  const y = Math.max(0, dir.y / l)
  const g = Math.hypot(dir.x, dir.z) / l
  const ratio = Math.min(MAX_SHADOW_RATIO, y > 1e-6 ? g / y : MAX_SHADOW_RATIO)
  const ux = g > 1e-4 ? -dir.x / l / g : 0.6
  const uz = g > 1e-4 ? -dir.z / l / g : 0.8
  return { ux, uz, castLength: Math.max(0, height) * ratio, slide: Math.max(0, lift) * ratio }
}
