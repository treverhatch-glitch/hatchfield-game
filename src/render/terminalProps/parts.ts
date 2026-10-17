/**
 * Part model for terminal props. A prop is a list of primitive parts in metres,
 * origin at floor centre, front facing +Z. Parts are batched by
 * (primitive, material) into InstancedMeshes, so a hall full of props costs
 * one draw call per primitive/material pair, not per object.
 */
export type Prim = 'box' | 'rbox' | 'cyl' | 'cyl8' | 'sphere' | 'cone' | 'torus' | 'plane'

export interface Part {
  prim: Prim
  /** Width, height, depth in metres (cyl: diameter x height x diameter). */
  size: [number, number, number]
  /** Centre offset from the prop origin; y is height above the floor. */
  pos: [number, number, number]
  /** Material key from MATERIALS. */
  mat: string
  /** Euler rotation in radians (XYZ). */
  rot?: [number, number, number]
  /** Drawn only inside hall-camera range. Repeated trim, not the silhouette. */
  near?: boolean
  /**
   * CC0 model anchor: once that kit has loaded this part draws as the model (pos is the
   * floor point under it, rot[1] its yaw, size its per-axis scale). Never drawn as a primitive.
   */
  cc0?: string
  /** Procedural part that a loaded CC0 kit of this id replaces. */
  cc0Hide?: string
}

/** Floor anchor for a CC0 kit (see Part.cc0). Scale defaults to 1. */
export function cc0Anchor(kit: string, pos: Part['pos'], yaw = 0, scale: Part['size'] = [1, 1, 1]): Part {
  return { prim: 'box', size: scale, pos, mat: 'chrome', rot: [0, yaw, 0], cc0: kit }
}

/** Tag procedural parts as replaced by a CC0 kit once it loads. */
export function cc0Hides(kit: string, parts: Part[]): Part[] {
  return parts.map((p) => (p.cc0 ? p : { ...p, cc0Hide: kit }))
}

export const part = (
  prim: Prim,
  size: Part['size'],
  pos: Part['pos'],
  mat: string,
  rot?: Part['rot'],
): Part => (rot ? { prim, size, pos, mat, rot } : { prim, size, pos, mat })

export const box = (s: Part['size'], p: Part['pos'], m: string, r?: Part['rot']) => part('box', s, p, m, r)
/** Bevelled box: soft rounded edges (unit RoundedBox scaled to size). */
export const rb = (s: Part['size'], p: Part['pos'], m: string, r?: Part['rot']) => part('rbox', s, p, m, r)
export const cyl = (s: Part['size'], p: Part['pos'], m: string, r?: Part['rot']) => part('cyl', s, p, m, r)

/** Trim that only draws inside hall-camera range. */
export function markNear(parts: Part[]): Part[] {
  return parts.map((p) => ({ ...p, near: true }))
}

/** Move a group of parts by an offset and an optional yaw around the group origin. */
export function place(parts: Part[], dx: number, dz: number, yaw = 0, dy = 0): Part[] {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return parts.map((q) => {
    const [x, y, z] = q.pos
    const nx = x * c + z * s
    const nz = -x * s + z * c
    const r = q.rot ?? [0, 0, 0]
    return { ...q, pos: [nx + dx, y + dy, nz + dz], rot: [r[0], r[1] + yaw, r[2]] }
  })
}

/** Repeat a group of parts n times along X with a pitch, centred on 0. */
export function rowX(parts: Part[], n: number, pitch: number): Part[] {
  const out: Part[] = []
  for (let i = 0; i < n; i++) out.push(...place(parts, (i - (n - 1) / 2) * pitch, 0))
  return out
}

/** Axis-aligned footprint (w, d) of a part list, for placement and tests. */
export function footprint(parts: Part[]): { w: number; d: number; h: number } {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, h = 0
  for (const q of parts) {
    if (q.cc0) continue
    const yaw = q.rot?.[1] ?? 0
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw))
    const hw = (q.size[0] * c + q.size[2] * s) / 2
    const hd = (q.size[0] * s + q.size[2] * c) / 2
    x0 = Math.min(x0, q.pos[0] - hw); x1 = Math.max(x1, q.pos[0] + hw)
    z0 = Math.min(z0, q.pos[2] - hd); z1 = Math.max(z1, q.pos[2] + hd)
    h = Math.max(h, q.pos[1] + q.size[1] / 2)
  }
  return { w: x1 - x0, d: z1 - z0, h }
}
