/**
 * Airport day clock. One sim day is 180 seconds, drawn as a 24-hour face,
 * matching the HUD clock so the board and the chrome agree.
 */
export const SIM_DAY_SEC = 180

export function boardClock(seconds: number): string {
  const tod = ((seconds % SIM_DAY_SEC) + SIM_DAY_SEC) % SIM_DAY_SEC
  const mins = Math.floor((tod / SIM_DAY_SEC) * 24 * 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
