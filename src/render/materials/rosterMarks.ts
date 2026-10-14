/**
 * Desk and gate marks for every airline on the roster.
 * High draws a 512² canvas. Med and low use the texture-quality setting.
 * The five photographed logos stay on the pack-4 loader.
 */
import { ROSTER, type RosterAirline } from '../../airlines/roster'
import { DEFAULT_TEXTURE_QUALITY, TEXTURE_QUALITY_KEY, parseTextureQuality, type TextureQuality } from '../aircraft/liveryFiles'

export const ROSTER_MARK_EDGE: Record<TextureQuality, number> = {
  high: 512,
  med: 256,
  low: 128,
}

export function rosterMarkQuality(): TextureQuality {
  try {
    return parseTextureQuality(globalThis.localStorage?.getItem(TEXTURE_QUALITY_KEY))
  } catch {
    return DEFAULT_TEXTURE_QUALITY
  }
}

export function rosterMarkEdge(quality: TextureQuality = rosterMarkQuality()): number {
  return ROSTER_MARK_EDGE[quality]
}

function ink(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  if (!Number.isFinite(n)) return '#f7f8fa'
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return y > 170 ? '#1a1c1f' : '#f7f8fa'
}

/** Square mark: primary field, code, and name. Letters run left to right. */
export function drawRosterMark(ctx: CanvasRenderingContext2D, size: number, airline: RosterAirline) {
  ctx.fillStyle = airline.primary
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = ink(airline.primary)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(size * 0.34)}px sans-serif`
  ctx.fillText(airline.code, size / 2, size * 0.42)
  ctx.font = `600 ${Math.round(size * 0.11)}px sans-serif`
  ctx.fillText(airline.name.toUpperCase(), size / 2, size * 0.72, size * 0.88)
}

export { ROSTER }
