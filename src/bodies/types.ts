/**
 * One body list for everything that moves on shared ground.
 * Positions are metres on the site grid: x = column × 22, y = row × 22,
 * so a cell centre sits on a whole multiple of 22. Heading is atan2(dRow, dCol).
 */

export type BodyKind = 'car' | 'taxi' | 'bus' | 'truck' | 'tug' | 'aircraft' | 'crew' | 'building'

export interface Body {
  /** Unique across every source: `${owner}:${local id}`. */
  id: string
  /** The system that moves this body, e.g. `landside`. */
  owner: string
  kind: BodyKind
  x: number
  y: number
  heading: number
  halfLength: number
  halfWidth: number
  /** Metres per second along the heading. Zero when stopped or static. */
  speed: number
}

/** A system that owns bodies. The list reads it; it never writes back. */
export interface BodySource {
  readonly bodyOwner: string
  bodies(): readonly Body[]
}

export interface BodyOverlap {
  a: Body
  b: Body
  /** Penetration depth, metres. */
  depth: number
}
