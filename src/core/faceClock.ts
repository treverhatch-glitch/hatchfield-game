/**
 * The clock the player reads. One sim day is 180 seconds, drawn as a 24-hour
 * face. HUD, timetable, and the sky all use this. The economy night window
 * (`simClockToHour`) stays on its own warped clock.
 */
export const FACE_DAY_SECONDS = 180

export function faceHour(clock: number, dayLength = FACE_DAY_SECONDS): number {
  const span = dayLength > 0 ? dayLength : FACE_DAY_SECONDS
  const tod = ((clock % span) + span) % span
  return (tod / span) * 24
}

export function faceDayIndex(clock: number, dayLength = FACE_DAY_SECONDS): number {
  const span = dayLength > 0 ? dayLength : FACE_DAY_SECONDS
  return Math.floor(clock / span) + 1
}

/** "HH:MM" on the 24h face. */
export function faceClockLabel(clock: number, dayLength = FACE_DAY_SECONDS): string {
  const span = dayLength > 0 ? dayLength : FACE_DAY_SECONDS
  const tod = ((clock % span) + span) % span
  const mins = Math.floor((tod / span) * 24 * 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "Day N · HH:MM". */
export function formatFaceDate(clock: number, dayLength = FACE_DAY_SECONDS): string {
  return `Day ${faceDayIndex(clock, dayLength)} · ${faceClockLabel(clock, dayLength)}`
}

/** Sim seconds whose face hour is `hour` on economy day `day` (0-based). */
export function clockForFaceHour(day: number, hour: number, dayLength = FACE_DAY_SECONDS): number {
  const span = dayLength > 0 ? dayLength : FACE_DAY_SECONDS
  const h = ((hour % 24) + 24) % 24
  const safeDay = Number.isFinite(day) ? Math.max(0, Math.floor(day)) : 0
  return safeDay * span + (h / 24) * span
}
