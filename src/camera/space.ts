import type { FieldLayout, Vec3 } from './types.ts'

/** Apron cell → world metres, matching `toWorld` in the field renderer. */
export function cellToWorld(c: number, r: number, y: number, layout: FieldLayout): Vec3 {
  const origin = (layout.size - 1) / 2
  return {
    x: (c - origin) * layout.cell,
    y,
    z: (r - origin) * layout.cell,
  }
}

/**
 * Sim heading (0 = world +X) → chase heading used by the follow math (0 = world +Z).
 */
export function simHeadingToChase(simHeading: number): number {
  return Math.PI / 2 - simHeading
}

/** Heading from a truck or passenger path, same atan2 the apron meshes use. */
export function travelHeading(
  x: number,
  y: number,
  path: readonly { c: number; r: number }[],
  seg: number,
): number {
  if (path.length < 2) return 0
  const next = path[Math.min(seg + 1, path.length - 1)]
  if (!next) return 0
  return Math.atan2(next.r - y, next.c - x)
}

/** Photo-mode hour, clamped to a full day on the slider. */
export function clampHour(hour: number): number {
  if (!Number.isFinite(hour)) return 12
  return Math.min(24, Math.max(0, hour))
}

/** `14.5` → `14:30`. The slider's right end reads `24:00`. */
export function formatHour(hour: number): string {
  const h = clampHour(hour)
  if (h >= 24) return '24:00'
  const hh = Math.floor(h)
  let mm = Math.round((h - hh) * 60)
  let hourHand = hh
  if (mm === 60) {
    mm = 0
    hourHand += 1
  }
  if (hourHand >= 24) return '24:00'
  return `${String(hourHand).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
