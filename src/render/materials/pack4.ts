/**
 * Grok texture pack 4. Tiles stay at the file's own size on high quality.
 * Med and low draw a smaller copy, same rule as pack 1.
 */
import { pack1Edge } from './pack1'
import type { QualityLevel } from '../world/quality'

export const PACK4_DIR = '/assets/pack4'

export const PACK4_FILES = {
  terrazzo: 'tex_terrazzo.jpg',
  carpetGrey: 'tex_carpet_grey.jpg',
  ceiling: 'tex_ceiling_tiles.jpg',
  granite: 'tex_granite_dark.jpg',
} as const

/** Metres one copy of the tile covers. */
export const PACK4_REPEAT_M = {
  terrazzo: 1.2,
  carpetGrey: 1.6,
  ceiling: 2.4,
  granite: 0.7,
} as const

export type Pack4File = keyof typeof PACK4_FILES

/** Airline marks, in the order they were delivered. */
export const AIRLINE_LOGOS = [
  'logo_bushline_local.jpg',
  'logo_zoomjet.jpg',
  'logo_crown_pacific.jpg',
  'logo_siam_breeze.jpg',
  'logo_northstar_cargo.jpg',
] as const

export const BRAND_LOGO = 'logo_hatchfield.jpg'

export function pack4Edge(level: QualityLevel): number | null {
  return pack1Edge(level)
}

export function pack4Url(file: string, root = PACK4_DIR): string {
  const base = root.endsWith('/') ? root.slice(0, -1) : root
  return `${base}/${file}`
}

/** Halls take terrazzo. Gates and offices take the grey carpet. */
export const TERRAZZO_ROOMS = ['checkin', 'security', 'airside', 'shops', 'lab'] as const
export const CARPET_ROOMS = ['gate', 'office'] as const
