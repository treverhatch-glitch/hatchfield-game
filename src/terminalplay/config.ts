/**
 * Terminal view paint thresholds. Queue formation itself belongs to the
 * pathing layer; this only says when a line already standing there looks long.
 */

export const PLAY_TUNING = {
  /** Waiting passengers that paint the in-world marker red. */
  bottleneckAt: 8,
} as const

export function isBottleneck(count: number): boolean {
  return count >= PLAY_TUNING.bottleneckAt
}
