import type { TurnBand } from './scheduleConfig'

const WORD: Record<TurnBand, string> = {
  regional: 'Hopper',
  narrow: 'Narrowjet',
  wide: 'Widejet',
  heavy: 'Heavyjet',
}

/** Real type codes and the S7 designator. Matched inside names such as "A320neo". */
const REAL_TYPE = /A3\d{2}|A220|B7[3478]\d|737|747|757|767|777|787|E17[05]|E195|ATR|CRJ|BN-2|DHC|\bS7\b/i

/**
 * Timeline metal name. Seat count is rounded so the label is a size, not a type code.
 */
export function fictionalMetal(band: TurnBand, seats = 0): string {
  const word = WORD[band]
  if (!(seats > 0)) return word
  const rounded = Math.max(10, Math.round(seats / 10) * 10)
  return `${word} ${rounded}`
}

/** What the block prints. A real type name from the sim is replaced. */
export function timelineAircraft(aircraft: string | null | undefined, band: TurnBand, seats = 0): string {
  const raw = aircraft?.trim() ?? ''
  if (!raw || raw === 'TBA' || REAL_TYPE.test(raw)) return fictionalMetal(band, seats)
  return raw
}

/** Ink on a solid airline fill. Light liveries get dark type. */
export function blockInk(color: string): string {
  const hex = color.trim().replace('#', '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#f8fafc'
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 170 ? '#1a1d24' : '#f8fafc'
}
