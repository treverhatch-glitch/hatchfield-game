/**
 * Soft sun shadows (Trever: plane shadows get lightly blurred edges and ends and stay visible,
 * at every zoom, day and night).
 *
 * three r18x PCF takes 5 rotated Vogel taps. Past a few texels of radius that turns a wide
 * penumbra into grain, so the radius had to stay small and shadows read crisp. This swaps the
 * 5-tap sum for a 16-tap Vogel disk (each tap is still a hardware 2×2 compare), and the world
 * renderer sizes the radius per frame so the penumbra is a fixed width on the apron instead of
 * shrinking to a hard line as the camera zooms in and the shadow map tightens.
 */
import * as THREE from 'three'

export const SOFT_SHADOW = {
  /** Vogel taps per shadow lookup. */
  samples: 16,
  /** Smallest penumbra on the ground, world units (≈ 0.2 m). */
  minPenumbra: 0.1,
  /** Penumbra grows with camera distance so it still reads a few pixels soft from far out. */
  perDist: 0.0022,
  /** Hard cap in shadow-map texels. */
  maxTexels: 28,
} as const

const FIVE_TAP = /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0, 5, phi \) \* radius, shadowCoord\.z \) \) \+[\s\S]*?\) \* 0\.2;/

let patched = false

/** Patch the shared PCF chunk once. Returns true when the 16-tap kernel is in place. */
export function installSoftShadows(): boolean {
  if (patched) return true
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment
  if (!FIVE_TAP.test(chunk)) return chunk.includes('SOFT_SHADOW_TAPS')
  const n = SOFT_SHADOW.samples
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk.replace(
    FIVE_TAP,
    `shadow = 0.0;
				// SOFT_SHADOW_TAPS
				for ( int i = 0; i < ${n}; i ++ ) {
					shadow += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, ${n}, phi ) * radius, shadowCoord.z ) );
				}
				shadow *= ${(1 / n).toFixed(6)};`,
  )
  patched = true
  return true
}

/**
 * PCF radius in shadow-map texels for this frame: a constant-width penumbra on the ground
 * (never below the preset's own radius, so no tier gets sharper than before).
 */
export function softShadowRadius(camDist: number, half: number, mapSize: number, presetRadius: number): number {
  const texel = (half * 2) / Math.max(1, mapSize)
  const penumbra = Math.max(SOFT_SHADOW.minPenumbra, camDist * SOFT_SHADOW.perDist)
  return Math.min(SOFT_SHADOW.maxTexels, Math.max(presetRadius, penumbra / texel))
}

installSoftShadows()
