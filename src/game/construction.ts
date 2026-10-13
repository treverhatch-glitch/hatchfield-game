/** Short build timers. One cell is a few seconds; a long strip caps at 12. */
export function buildSeconds(cells: number): number {
  const n = Math.max(1, cells)
  return Math.min(12, Math.max(4, 4 + n * 0.35))
}

export function cancelRefund(cost: number, rate = 0.4): number {
  return Math.round(cost * rate)
}
