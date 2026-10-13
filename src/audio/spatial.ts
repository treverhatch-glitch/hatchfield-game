export interface Vec3 { x: number; y: number; z: number }

export interface Rolloff {
  /** Distance (world units) at or below which volume is full. */
  refDistance: number;
  /** Distance beyond which the sound is silent. */
  maxDistance: number;
  /** Inverse rolloff factor (higher = falls off faster). */
  rolloff: number;
}

export const DEFAULT_ROLLOFF: Rolloff = { refDistance: 40, maxDistance: 1800, rolloff: 1 };

export function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Inverse-distance gain in [0,1] with a smooth fade to 0 near maxDistance. */
export function distanceGain(d: number, r: Rolloff = DEFAULT_ROLLOFF): number {
  if (!Number.isFinite(d) || d >= r.maxDistance) return 0;
  if (d <= r.refDistance) return 1;
  const inv = r.refDistance / (r.refDistance + r.rolloff * (d - r.refDistance));
  const fadeStart = r.maxDistance * 0.8;
  const fade = d <= fadeStart ? 1 : 1 - (d - fadeStart) / (r.maxDistance - fadeStart);
  return Math.max(0, Math.min(1, inv * fade));
}

/** Simple stereo pan in [-1,1] from listener right-vector projection. */
export function panFor(listener: Vec3, right: Vec3, source: Vec3): number {
  const dx = source.x - listener.x, dy = source.y - listener.y, dz = source.z - listener.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const p = (dx * right.x + dy * right.y + dz * right.z) / len;
  return Math.max(-1, Math.min(1, p));
}
