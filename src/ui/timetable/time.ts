import type { IcaoCode, TtWindow } from './types'

/** Sim seconds → "HH:MM" on the 24h face of a day of `dayLength` seconds. */
export function clockLabel(t: number, dayLength = 180): string {
  const tod = ((t % dayLength) + dayLength) % dayLength
  const mins = Math.floor((tod / dayLength) * 1440)
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

export function dayIndex(t: number, dayLength = 180): number {
  return Math.floor(t / dayLength) + 1
}

/** Sim seconds per in-game hour. */
export function hourSecs(dayLength = 180): number {
  return dayLength / 24
}

/** Sim duration → in-game "1h 20m" / "35m". */
export function durationLabel(sec: number, dayLength = 180): string {
  const mins = Math.round((Math.abs(sec) / dayLength) * 1440)
  const sign = sec < 0 ? '−' : ''
  if (mins < 60) return `${sign}${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${sign}${h}h ${m}m` : `${sign}${h}h`
}

export function clampToWindow(t: number, w: TtWindow | null, floor = -Infinity): number {
  const lo = Math.max(floor, w ? w.start : -Infinity)
  const hi = w ? w.end : Infinity
  if (hi < lo) return lo
  return Math.min(hi, Math.max(lo, t))
}

const RANK: Record<IcaoCode, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 }
export function icaoRank(c: IcaoCode): number {
  return RANK[c]
}
export function standFits(stand: IcaoCode, need: IcaoCode): boolean {
  return RANK[stand] >= RANK[need]
}
export const ICAO_ORDER: IcaoCode[] = ['A', 'B', 'C', 'D', 'E', 'F']
export const ICAO_LABEL: Record<IcaoCode, string> = {
  A: 'Code A · light',
  B: 'Code B · bizjet',
  C: 'Code C · regional & narrowbody',
  D: 'Code D · small widebody',
  E: 'Code E · widebody',
  F: 'Code F · A380 / 747-8',
}
