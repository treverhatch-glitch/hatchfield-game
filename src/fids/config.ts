/** Tunables for the split-flap board and wayfinding signs. Logic reads this file. */

/** Characters on one flap row. The texture is drawn for this many rows. */
export const BOARD_ROW_COUNT = 8

/** Seconds for one glyph to fall to the next leaf. */
export const FLIP_SEC = 0.05

/** Canvas size. Long edge stays at 2K so the board reads up close. */
export const BOARD_W = 2048
export const BOARD_H = 1152
export const SIGN_W = 2048
export const SIGN_H = 1024

/** Split-flap alphabet, in the order a leaf advances. */
export const GLYPHS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:·.-'

export const COLUMNS = [
  { key: 'flight', label: 'FLIGHT', width: 8 },
  { key: 'airline', label: 'AIRLINE', width: 16 },
  { key: 'destination', label: 'DESTINATION', width: 14 },
  { key: 'time', label: 'TIME', width: 5 },
  { key: 'gate', label: 'GATE', width: 12 },
  { key: 'status', label: 'STATUS', width: 8 },
] as const

export type ColumnKey = (typeof COLUMNS)[number]['key']

/** Physical sizes in metres. The terminal scales these into world units. */
export const BOARD_METERS = { w: 5.4, h: 2.5, y: 2.15, gap: 0.35 }
export const SIGN_METERS = { w: 2.4, h: 1.15, y: 2.35, post: 0.12 }
