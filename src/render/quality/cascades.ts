/**
 * Cascade split + texel-snapping math for a 3-cascade sun shadow. Pure functions, no three.js
 * scene access, so it is unit-testable without a GPU. NOT yet wired into World: the sun shadow
 * camera in `render/world.ts` is still a single map. Wiring needs a real-GPU check for seams.
 */
export interface CascadeConfig {
  cascades: number
  /** Farthest shadowed distance from the camera, in meters. */
  maxDistance: number
  /** 0 = linear splits, 1 = logarithmic. */
  lambda: number
  /** Shadow map side per cascade, in texels. */
  mapSize: number
}

export const CASCADE_TIERS: Record<'high' | 'ultra', CascadeConfig> = {
  high: { cascades: 3, maxDistance: 300, lambda: 0.6, mapSize: 2048 },
  ultra: { cascades: 3, maxDistance: 450, lambda: 0.6, mapSize: 4096 },
}

/** Far edge of each cascade, from camera `near`; the last entry equals `maxDistance`. */
export function cascadeSplits(near: number, cfg: CascadeConfig): number[] {
  const out: number[] = []
  for (let i = 1; i <= cfg.cascades; i++) {
    const t = i / cfg.cascades
    const log = near * Math.pow(cfg.maxDistance / near, t)
    const lin = near + (cfg.maxDistance - near) * t
    out.push(i === cfg.cascades ? cfg.maxDistance : cfg.lambda * log + (1 - cfg.lambda) * lin)
  }
  return out
}

/**
 * Snap a light-space coordinate to the shadow texel grid so panning the camera moves the map in
 * whole texels instead of shimmering. `extent` is the full width of the cascade in meters.
 */
export function snapToTexel(v: number, extent: number, mapSize: number): number {
  const texel = extent / mapSize
  return Math.round(v / texel) * texel
}
