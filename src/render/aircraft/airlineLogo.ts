/**
 * Square marks for the tail decal and the Airlines card.
 * Gemini and the five base carriers live under /assets/airline-logos.
 * Grok's five marks are the pack 4 logos, aliased onto the same paths.
 * A missing file is a null URL so the card can fall back to a colour chip.
 */
import { ROSTER } from '../../airlines/roster'
import { TEXTURE_QUALITY_KEY, parseTextureQuality, type TextureQuality } from './liveryFiles'

/** Catalog id → logo file stem. */
const GROK_LOGO: Record<string, string> = {
  bushline: 'bushline_local',
  bushline_local: 'bushline_local',
  zoomjet: 'zoomjet',
  crown: 'crown_pacific',
  crown_pacific: 'crown_pacific',
  siam_breeze: 'siam_breeze',
  northstar_cargo: 'northstar_cargo',
}

const ROSTER_LOGO = new Set(ROSTER.map((airline) => airline.id))

export function readLogoQuality(): TextureQuality {
  try {
    return parseTextureQuality(globalThis.localStorage?.getItem(TEXTURE_QUALITY_KEY))
  } catch {
    return 'high'
  }
}

/** Quality-stepped logo, or null when this carrier has no mark on disk. */
export function airlineLogoUrl(id: string, quality: TextureQuality = readLogoQuality()): string | null {
  const stem = GROK_LOGO[id] ?? (ROSTER_LOGO.has(id) ? id : null)
  if (!stem) return null
  if (quality === 'high') return `/assets/airline-logos/${stem}.jpg`
  return `/assets/airline-logos/${quality}/${stem}.jpg`
}
