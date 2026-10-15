/**
 * Named mesh sockets in world metres.
 *
 * Model frame: +X forward, +Z right. Heading 0 faces world +X and turns CCW.
 * The cart engine never reads a tile-centre offset. Callers pass the point
 * `resolveSocket` took off the aircraft or service mesh.
 */

export interface CartSocket {
  name: string
  x: number
  y: number
}

export interface SocketOrigin {
  x: number
  y: number
  /** Radians, CCW from world +X. */
  heading?: number
}

export function resolveSocket(
  table: Readonly<Record<string, readonly [number, number, number] | undefined>>,
  name: string,
  origin: SocketOrigin,
): CartSocket | null {
  const local = table[name]
  if (!local) return null
  const along = local[0]
  const across = local[2]
  const heading = origin.heading ?? 0
  if (!Number.isFinite(along) || !Number.isFinite(across) || !Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(heading)) {
    return null
  }
  const fx = Math.cos(heading)
  const fy = Math.sin(heading)
  const rx = -Math.sin(heading)
  const ry = Math.cos(heading)
  return {
    name,
    x: origin.x + along * fx + across * rx,
    y: origin.y + along * fy + across * ry,
  }
}
