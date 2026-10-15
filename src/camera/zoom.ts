/**
 * Orbit zoom that keeps the ground point under the cursor.
 * `before` is the ground hit at the old distance, `after` at the new one.
 * Shift the pivot by the difference so that point stays under the cursor.
 */
export function zoomToCursorShift(
  before: { x: number; z: number } | null,
  after: { x: number; z: number } | null,
): { x: number; z: number } {
  if (!before || !after) return { x: 0, z: 0 }
  return { x: before.x - after.x, z: before.z - after.z }
}
