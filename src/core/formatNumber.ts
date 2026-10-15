/** Whole numbers for goal, hub, and scenario panels. Float noise never reaches the player. */
export function formatPanelNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-US')
}
