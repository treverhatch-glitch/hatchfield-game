/** Plan-view vector in metres. `z` matches the renderer's ground axis. */
export interface Vec2 {
  x: number
  z: number
}

/** A wall segment pedestrians cannot cross (room edges from PR #17's plan). */
export interface Wall {
  ax: number
  az: number
  bx: number
  bz: number
}

/**
 * A doorway: the segment spanning the opening. Throughput is capped at
 * `width * flowPerMeter` people per second (Fruin / SFPE ~1.3 p/m/s), so a
 * narrow door the player draws becomes a real choke point.
 */
export interface Door {
  id: string
  ax: number
  az: number
  bx: number
  bz: number
  /** Default 1.3 people per metre of clear width per second. */
  flowPerMeter?: number
}

/**
 * One leg of a route: a waypoint, optionally the far side of a door.
 * Feed it the node points from PR #17's navPath room routes.
 */
export interface Waypoint extends Vec2 {
  /** Set when reaching this waypoint means walking through this door. */
  doorId?: string
}

export const AgentState = {
  Walking: 0,
  /** Holding a slot in a queue line. */
  Queued: 1,
  /** Waiting at a door for a throughput token. */
  DoorWait: 2,
  Arrived: 3,
} as const
export type AgentState = (typeof AgentState)[keyof typeof AgentState]
