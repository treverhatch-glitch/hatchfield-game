/**
 * Label for a planner "+" slot button.
 * The word "banned" appears only when the airline is actually banned.
 * A clock below zero with no ban (or a ban stored as 0) is not a ban.
 */
export function manualSlotLabel(name: string, banned: boolean): string {
  const short = name.slice(0, 12)
  return banned ? `${short} banned` : `+ ${short}`
}
