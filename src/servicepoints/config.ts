/**
 * Tunables for check-in desks and security lanes as service points.
 * Times are seconds on the clock the caller uses (nav seconds in the walk,
 * clock seconds in the pace model). Nothing here is a price or a wage.
 */

export const SERVICE_POINT_TUNING = {
  /**
   * Wait shown for a line at a point with nobody working it.
   * Long enough that the info panel and the floor marker call it a bottleneck.
   */
  unstaffedWaitSec: 1200,
  /** Serve animation: handoff cycles per second while a passenger is at the point. */
  serveCycleHz: 1.6,
  /** Forward lean at the top of the handoff, radians. */
  serveLean: 0.42,
  /** How far the hand reaches toward the desk, metres. */
  serveReachM: 0.32,
  /**
   * Sim seconds a desk body spends walking back from a break or across to
   * another post. They do not serve until they arrive. A new hire is placed
   * on the post. Not a wage.
   */
  postWalkSec: 4,
  /**
   * A self-serve kiosk takes this share of a staffed check-in desk's service
   * time. Bag drops run themselves and stay at desk speed. Not a wage.
   */
  kioskServiceShare: 0.45,
} as const
