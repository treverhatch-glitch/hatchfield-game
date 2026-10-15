/**
 * P1 landing plates in public/art/textures/landing.
 * Files stay at the size they were generated. Nothing here resamples them.
 */
import * as THREE from 'three'

export const LANDING_DIR = 'art/textures/landing'

export const LANDING_FILES = {
  runway_paint: 'textures/runway_paint.jpeg',
  threshold_metal: 'textures/threshold_metal.jpeg',
  wet_asphalt: 'textures/wet_asphalt.jpeg',
  hotel_facade: 'textures/hotel_facade.jpeg',
  terminal_facade: 'textures/terminal_facade.jpeg',
  queue_tape: 'textures/queue_tape.jpeg',
  carousel_belt: 'textures/carousel_belt.jpeg',
  chainlink: 'textures/chainlink.jpeg',
  grass_spring: 'terrain/grass_spring.jpeg',
  grass_autumn: 'terrain/grass_autumn.jpeg',
  farmland: 'terrain/farmland.jpeg',
  dirt_shoulder: 'terrain/dirt_shoulder.jpeg',
  snow_apron: 'terrain/snow_apron.jpeg',
  snow_asphalt: 'terrain/snow_asphalt.jpeg',
  snow_grass: 'terrain/snow_grass.jpeg',
  water_river: 'terrain/water_river.jpeg',
  tree_sprites: 'terrain/tree_sprites.jpeg',
  bush_sprites: 'terrain/bush_sprites.jpeg',
  sky_dawn: 'sky/dawn.jpeg',
  sky_noon: 'sky/noon.jpeg',
  sky_dusk: 'sky/dusk.jpeg',
  sky_night: 'sky/night.jpeg',
  sky_overcast: 'sky/overcast.jpeg',
  sky_storm: 'sky/storm.jpeg',
  hdri_hint_noon: 'lighting/hdri_hint_noon.jpeg',
  window_glow: 'lighting/window_glow.jpeg',
  apron_flood_glow: 'lighting/apron_flood_glow.jpeg',
  nav_light_sprites: 'lighting/nav_light_sprites.jpeg',
} as const

export type LandingId = keyof typeof LANDING_FILES

/** Measured native frames. The loader never scales below these. */
export const LANDING_NATIVE: Record<LandingId, { w: number; h: number }> = {
  runway_paint: { w: 2048, h: 2048 },
  threshold_metal: { w: 2752, h: 1536 },
  wet_asphalt: { w: 2048, h: 2048 },
  hotel_facade: { w: 2048, h: 2048 },
  terminal_facade: { w: 2048, h: 2048 },
  queue_tape: { w: 2752, h: 450 },
  carousel_belt: { w: 2048, h: 2048 },
  chainlink: { w: 2048, h: 2048 },
  grass_spring: { w: 2048, h: 2048 },
  grass_autumn: { w: 2048, h: 2048 },
  farmland: { w: 2048, h: 2048 },
  dirt_shoulder: { w: 2048, h: 2048 },
  snow_apron: { w: 2048, h: 2048 },
  snow_asphalt: { w: 2048, h: 2048 },
  snow_grass: { w: 2048, h: 2048 },
  water_river: { w: 2048, h: 2048 },
  tree_sprites: { w: 2752, h: 1536 },
  bush_sprites: { w: 2752, h: 1536 },
  sky_dawn: { w: 2912, h: 1440 },
  sky_noon: { w: 2912, h: 1440 },
  sky_dusk: { w: 2912, h: 1440 },
  sky_night: { w: 2912, h: 1440 },
  sky_overcast: { w: 2912, h: 1440 },
  sky_storm: { w: 2912, h: 1440 },
  hdri_hint_noon: { w: 2912, h: 1440 },
  window_glow: { w: 2048, h: 2048 },
  apron_flood_glow: { w: 2048, h: 2048 },
  nav_light_sprites: { w: 2048, h: 2048 },
}

const CLAMP: ReadonlySet<LandingId> = new Set([
  'tree_sprites',
  'bush_sprites',
  'sky_dawn',
  'sky_noon',
  'sky_dusk',
  'sky_night',
  'sky_overcast',
  'sky_storm',
  'hdri_hint_noon',
  'window_glow',
  'apron_flood_glow',
  'nav_light_sprites',
  'terminal_facade',
  'hotel_facade',
  'threshold_metal',
  'queue_tape',
])

/** Tree and bush sheets are a 2×2 grid on a black field. */
export const SPRITE_GRID = { cols: 2, rows: 2 } as const

export function landingArtUrl(id: LandingId, base = ''): string {
  const prefix = base && !base.endsWith('/') ? `${base}/` : base
  return `${prefix}${LANDING_DIR}/${LANDING_FILES[id]}`
}

/** Absolute URL the sky dome loads. The noon HDRI hint is not a dome plate. */
export function landingSkyUrl(id: 'sky_dawn' | 'sky_noon' | 'sky_dusk' | 'sky_night' | 'sky_overcast' | 'sky_storm'): string {
  return `/${LANDING_DIR}/${LANDING_FILES[id]}`
}

/**
 * Drawn size. The landing pack has no med/low downsample: the file's own edge is the edge.
 */
export function landingDrawEdge(fileEdge: number): number {
  return fileEdge
}

/** Grass plate for the season already on the sim clock. Summer reuses spring; there is no summer plate. */
export function seasonGrassId(seasonId: string, snow: number): LandingId {
  if (snow > 0.35 || seasonId === 'winter') return 'snow_grass'
  if (seasonId === 'autumn') return 'grass_autumn'
  return 'grass_spring'
}

export function seasonApronId(seasonId: string, snow: number): LandingId {
  if (snow > 0.35 || seasonId === 'winter') return 'snow_apron'
  return 'wet_asphalt'
}

export function seasonPavedId(seasonId: string, snow: number, wet: number): LandingId {
  if (snow > 0.35 || seasonId === 'winter') return 'snow_asphalt'
  if (wet > 0.15) return 'wet_asphalt'
  return 'runway_paint'
}

const cache = new Map<LandingId, THREE.Texture>()

function baseUrl(): string {
  return (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
}

/**
 * Shared plate at the file's own resolution, or null in Node.
 * Do not dispose it per mesh.
 */
export function landingTexture(id: LandingId, anisotropy = 8): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const hit = cache.get(id)
  if (hit) {
    hit.anisotropy = Math.max(hit.anisotropy, anisotropy)
    return hit
  }
  const loader = new THREE.TextureLoader()
  const tex = loader.load(landingArtUrl(id, baseUrl()))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.userData.landing = id
  const wrap = CLAMP.has(id) ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping
  tex.wrapS = wrap
  tex.wrapT = wrap
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = anisotropy
  cache.set(id, tex)
  return tex
}

export function disposeLandingTextures() {
  for (const tex of cache.values()) tex.dispose()
  cache.clear()
}

/** Drop near-black texels (sprite backdrops, chain-link holes) without resizing the plate. */
export function discardDark(mat: THREE.Material, cutoff = 0.06) {
  mat.customProgramCacheKey = () => `landing-dark-${cutoff}`
  const previous = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    previous?.call(mat, shader, renderer)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       if (dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) < ${cutoff.toFixed(3)}) discard;`,
    )
  }
}

/** One cell of a 2×2 sprite sheet, standing upright. */
export function spritePlane(col: number, row: number, cols = SPRITE_GRID.cols, rows = SPRITE_GRID.rows): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(1, 1)
  const uv = geo.getAttribute('uv')
  const u0 = col / cols
  const v0 = row / rows
  const du = 1 / cols
  const dv = 1 / rows
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv)
  uv.needsUpdate = true
  geo.translate(0, 0.5, 0)
  return geo
}
