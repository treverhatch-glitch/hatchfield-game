/**
 * Where airline livery JPEGs live, and which size the browser loads.
 * High-res is the default. The only downsample is this setting
 * (`hatchfield-texture-quality` = low | med | high).
 * Long-side caps match scripts/build-liveries.py.
 * `types` on each manifest row is the airframes that plate is painted for.
 */
import manifest from '../../../public/textures/liveries/manifest.json'
export type TextureQuality = 'low' | 'med' | 'high'

export const TEXTURE_QUALITY_KEY = 'hatchfield-texture-quality'
export const DEFAULT_TEXTURE_QUALITY: TextureQuality = 'high'

export const LIVERY_LONG_SIDE: Record<TextureQuality, number> = {
  low: 320,
  med: 640,
  high: 1280,
}

export type LiverySlotName = 'fuselage' | 'tail'

export function liveryFile(id: string, slot: LiverySlotName, quality: TextureQuality = DEFAULT_TEXTURE_QUALITY): string {
  if (quality === 'high') return `/textures/liveries/${id}/${slot}.jpg`
  return `/textures/liveries/${id}/${quality}/${slot}.jpg`
}

export function parseTextureQuality(value: unknown): TextureQuality {
  if (value === 'low' || value === 'med' || value === 'high') return value
  return DEFAULT_TEXTURE_QUALITY
}

interface ManifestRow {
  id: string
  airlines?: string[]
  types?: string[]
}

const LIVERY_ROWS = (manifest as { liveries?: ManifestRow[] }).liveries ?? []

/** True when this photographed plate belongs on `modelId`. Airlines with no type list stay unrestricted. */
export function jpegLiveryFits(airline: string, modelId: string): boolean {
  const row = LIVERY_ROWS.find((entry) => entry.id === airline || entry.airlines?.includes(airline))
  if (!row?.types?.length) return true
  return row.types.includes(modelId)
}
