/**
 * UV layout for airline livery PNGs.
 *
 * Art lives at `public/textures/liveries/<airline>/` and is listed in
 * `manifest.json`. Until a file is listed and loads, the shell keeps its
 * procedural vertex colours. Opaque texels replace that paint; transparent
 * texels leave it alone. Shipped plates are JPEGs. Their pixel size follows
 * the texture-quality setting; the UVs below stay 0–1 either way.
 *
 * Image axes (Three flips Y, so the top of the PNG is V = 1):
 *
 * fuselage.jpg — 4:1 side elevation at the crop's own width
 *   U 0 → 1 = nose → tail on the port side (−Z). Starboard (+Z) flips U so a
 *   left-to-right wordmark reads outward on both sides.
 *   V 0 → 1 = belly → crown. The nose tip sits near V 0.5, the crown at V 1.
 *   Horizontal bands still meet at the belly. The cheatline sweep reverses
 *   on the starboard side because that is the same flip that unmirrors text.
 *
 * tail.png — 512×512 (fin, viewed from the side)
 *   U 0 → 1 = leading edge → trailing edge on the port face.
 *   Starboard (+Z) flips U, same rule as the fuselage, so a title reads outward.
 *   V 0 → 1 = root → tip.
 *
 * engine.png — 512×128 (cowling unwrap, 4:1)
 *   U 0 → 1 wraps the barrel. The seam is at the bottom of the nacelle.
 *   V 0 → 1 = intake → exhaust. A horizontal stripe in the PNG is a band
 *   around the cowling. The intake lip, nozzle and pylon stay procedural metal.
 */

export const LIVERY_ART = {
  fuselage: { w: 1024, h: 256 },
  tail: { w: 512, h: 512 },
  engine: { w: 512, h: 128 },
} as const

/** Attribute `liverySlot` on the merged shell. 3 = no livery map. */
export const LIVERY_SLOT = {
  fuselage: 0,
  tail: 1,
  engine: 2,
  none: 3,
} as const

export type LiveryMapKind = keyof typeof LIVERY_SLOT

export interface LiveryBox {
  /** Group-space X of U = 0 (nose, or fin leading edge). */
  x0: number
  /** Group-space X of U = 1 (tail, or fin trailing edge). */
  x1: number
  /** Group-space Y of V = 0 (belly, or fin root). */
  y0: number
  /** Group-space Y of V = 1 (crown, or fin tip). */
  y1: number
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Side-elevation UV from a point already in the aircraft group (meters). */
export function projectedUv(x: number, y: number, box: LiveryBox, mode?: LiveryMapKind): [number, number] {
  let du = box.x0 - box.x1
  let dv = box.y1 - box.y0
  if (mode === 'tail') {
    const maxD = Math.max(Math.abs(du), Math.abs(dv))
    du = du < 0 ? -maxD : maxD
    dv = dv < 0 ? -maxD : maxD
  }
  const u = Math.abs(du) < 1e-4 ? 0 : (box.x0 - x) / du
  const v = Math.abs(dv) < 1e-4 ? 0 : (y - box.y0) / dv
  return [clamp01(u), clamp01(v)]
}

/**
 * Port (−Z) keeps nose-to-tail U. Starboard (+Z) flips U so lettering drawn
 * left to right on the plate reads outward from either side.
 */
export function outwardUv(x: number, y: number, z: number, box: LiveryBox, mode?: LiveryMapKind): [number, number] {
  const [u, v] = projectedUv(x, y, box, mode)
  return z > 0 ? [1 - u, v] : [u, v]
}

/**
 * Cowling unwrap from a unit cylinder along Y (radius 1, length 1),
 * before the nacelle is turned onto +X. Local −Y is the intake.
 * Seam (U = 0) is local −X, which lands on the bottom after the nacelle roll.
 */
export function engineUv(x: number, y: number, z: number): [number, number] {
  let around = (Math.atan2(z, x) + Math.PI) / (Math.PI * 2)
  if (around >= 1) around = 0
  return [around, clamp01(y + 0.5)]
}
