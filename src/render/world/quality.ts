import * as THREE from 'three'

export type QualityLevel = 'low' | 'med' | 'high'

export interface QualityPreset {
  level: QualityLevel
  /** 0 disables shadows entirely. */
  shadowMapSize: number
  shadowType: THREE.ShadowMapType
  /** PCF filter radius (soft edges on high). */
  shadowRadius: number
  /** Max render pixel ratio. Below 1 renders under native resolution (software GL). */
  pixelRatioCap: number
  /**
   * 4× MSAA on the apron canvas. Fixed when the WebGL context is created, so it follows the
   * preset picked at boot. Off on low: SwiftShader rasterises every sample on the CPU.
   */
  msaa: boolean
  /** Re-render the shadow map every N frames (1 = every frame). */
  shadowEvery: number
  /** Texture side for tiling ground textures. */
  textureSize: number
  anisotropy: number
  /** Multiplies every LOD switch distance. */
  lodScale: number
  /** Grass tufts in the near detail ring around the camera focus. */
  grassTufts: number
  /** Trees scattered outside the plot. */
  trees: number
  /** Rain / snow streaks near the camera. */
  precipitation: number
  /** Interior props per terminal cell (1 = full kit). */
  propDensity: number
  /** Apron ground light pools at night. */
  lightPools: boolean
  /**
   * Decorative walkers inside terminals at the nearest LOD.
   * Sim guests already walk the doorways, so this stays 0 and the two crowds do not stack.
   */
  walkersPerCell: number
  /** SVG ground, glass, signage and tail art. Off on the auto low preset. */
  extraTextures: boolean
  /** Vertex-animated passengers. The cheap instanced hall crowd stays on when this is off. */
  animatedPeople: boolean
  /** Thought-bubble sprites over a handful of guests. */
  thoughtBubbles: boolean
  /** Local avoidance, queue lines and doorway tokens. Visual only — the sim path is unchanged. */
  crowdDetail: boolean
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: {
    level: 'low',
    shadowMapSize: 0,
    shadowType: THREE.BasicShadowMap,
    shadowRadius: 1,
    pixelRatioCap: 0.8,
    msaa: false,
    shadowEvery: 1,
    textureSize: 128,
    anisotropy: 2,
    lodScale: 0.6,
    grassTufts: 0,
    trees: 140,
    precipitation: 300,
    propDensity: 1,
    lightPools: false,
    walkersPerCell: 0,
    extraTextures: false,
    animatedPeople: false,
    thoughtBubbles: false,
    crowdDetail: false,
  },
  med: {
    level: 'med',
    shadowMapSize: 1024,
    shadowType: THREE.PCFShadowMap,
    shadowRadius: 1,
    pixelRatioCap: 1.25,
    msaa: true,
    shadowEvery: 2,
    textureSize: 256,
    anisotropy: 4,
    lodScale: 1,
    grassTufts: 1800,
    trees: 320,
    precipitation: 900,
    propDensity: 1,
    lightPools: true,
    walkersPerCell: 0,
    extraTextures: true,
    animatedPeople: true,
    thoughtBubbles: true,
    crowdDetail: true,
  },
  high: {
    level: 'high',
    shadowMapSize: 2048,
    // PCFSoftShadowMap was removed in three r18x; PCF + a blur radius is the soft option.
    shadowType: THREE.PCFShadowMap,
    shadowRadius: 2.5,
    pixelRatioCap: 2,
    msaa: true,
    shadowEvery: 1,
    textureSize: 512,
    anisotropy: 8,
    lodScale: 1.4,
    grassTufts: 4200,
    trees: 640,
    precipitation: 2000,
    propDensity: 1,
    lightPools: true,
    walkersPerCell: 0,
    extraTextures: true,
    animatedPeople: true,
    thoughtBubbles: true,
    crowdDetail: true,
  },
}

export function parseQuality(v: unknown, fallback: QualityLevel = 'med'): QualityLevel {
  if (v === 'low' || v === 'med' || v === 'high') return v
  if (v === 'medium') return 'med'
  return fallback
}

/** Rough guess for first boot: software GL or tiny screens start low. */
export function suggestQuality(info: {
  renderer?: string
  deviceMemory?: number
  hardwareConcurrency?: number
}): QualityLevel {
  const r = (info.renderer ?? '').toLowerCase()
  if (r.includes('swiftshader') || r.includes('llvmpipe') || r.includes('software')) return 'low'
  if ((info.deviceMemory ?? 8) <= 2 || (info.hardwareConcurrency ?? 8) <= 2) return 'low'
  if ((info.deviceMemory ?? 8) >= 8 && (info.hardwareConcurrency ?? 8) >= 8) return 'high'
  return 'med'
}
