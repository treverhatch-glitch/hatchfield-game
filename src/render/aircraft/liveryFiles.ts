/**
 * Where airline livery JPEGs live, and which size the browser loads.
 * High-res is the default. The only downsample is this setting
 * (`hatchfield-texture-quality` = low | med | high).
 * Long-side caps match scripts/build-liveries.py.
 */
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
