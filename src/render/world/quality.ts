import * as THREE from 'three'

export type QualityLevel = 'low' | 'med' | 'high' | 'ultra'

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
  /**
   * Shadow box as a fraction of camera distance, then clamped so the map
   * covers the view instead of the whole airfield.
   */
  shadowReach: number
  /** Second, wider glow on airfield lights. Low keeps the single soft sprite. */
  lightBloom: boolean
  /** Baked contact discs under terminals and stands. Off on Low. */
  contactShadows: boolean
  /** Filmic grade in the material shader. Off on Low: no extra fragment work. */
  colorGrade: boolean
  /** Pack 6 sky panoramas on the dome. Low keeps the procedural gradient and never loads them. */
  skyPhotos: boolean
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: {
    level: 'low',
    shadowMapSize: 1024,
    shadowType: THREE.PCFShadowMap,
    shadowRadius: 2,
    // Every tier draws the full art set. Shadow size still steps up so a
    // software-GL machine can open the view; it does not drop textures, trees, or props.
    pixelRatioCap: 1,
    msaa: true,
    shadowEvery: 1,
    textureSize: 512,
    anisotropy: 8,
    lodScale: 4,
    grassTufts: 4200,
    trees: 640,
    precipitation: 1200,
    propDensity: 1,
    lightPools: true,
    walkersPerCell: 0,
    extraTextures: true,
    animatedPeople: true,
    thoughtBubbles: true,
    crowdDetail: true,
    shadowReach: 0.7,
    lightBloom: true,
    contactShadows: true,
    colorGrade: true,
    skyPhotos: true,
  },
  med: {
    level: 'med',
    shadowMapSize: 2048,
    shadowType: THREE.PCFShadowMap,
    shadowRadius: 3,
    pixelRatioCap: 1.5,
    msaa: true,
    shadowEvery: 1,
    textureSize: 1024,
    anisotropy: 12,
    lodScale: 6,
    grassTufts: 5200,
    trees: 900,
    precipitation: 1800,
    propDensity: 1,
    lightPools: true,
    walkersPerCell: 0,
    extraTextures: true,
    animatedPeople: true,
    thoughtBubbles: true,
    crowdDetail: true,
    shadowReach: 0.75,
    lightBloom: true,
    contactShadows: true,
    colorGrade: true,
    skyPhotos: true,
  },
  high: {
    level: 'high',
    shadowMapSize: 4096,
    // PCFSoftShadowMap was removed in three r18x; PCF + a blur radius is the soft option.
    shadowType: THREE.PCFShadowMap,
    shadowRadius: 4,
    pixelRatioCap: 2,
    msaa: true,
    shadowEvery: 1,
    textureSize: 2048,
    anisotropy: 16,
    lodScale: 8,
    grassTufts: 6800,
    trees: 1100,
    precipitation: 2400,
    propDensity: 1,
    lightPools: true,
    walkersPerCell: 0,
    extraTextures: true,
    animatedPeople: true,
    thoughtBubbles: true,
    crowdDetail: true,
    shadowReach: 0.8,
    lightBloom: true,
    contactShadows: true,
    colorGrade: true,
    skyPhotos: true,
  },
  // Same art as High, with the largest shadow map and the farthest detail hold.
  ultra: {
    level: 'ultra',
    shadowMapSize: 8192,
    shadowType: THREE.PCFShadowMap,
    shadowRadius: 5,
    pixelRatioCap: 2,
    msaa: true,
    shadowEvery: 1,
    textureSize: 4096,
    anisotropy: 16,
    lodScale: 12,
    grassTufts: 8400,
    trees: 1400,
    precipitation: 3200,
    propDensity: 1,
    lightPools: true,
    walkersPerCell: 0,
    extraTextures: true,
    animatedPeople: true,
    thoughtBubbles: true,
    crowdDetail: true,
    shadowReach: 0.85,
    lightBloom: true,
    contactShadows: true,
    colorGrade: true,
    skyPhotos: true,
  },
}

/** Ultra shares High's art and LOD ladders; modules keyed on three levels use this. */
export function baseLevel(level: QualityLevel): 'low' | 'med' | 'high' {
  return level === 'ultra' ? 'high' : level
}

export const QUALITY_LABEL: Record<QualityLevel, string> = {
  low: 'Low',
  med: 'Medium',
  high: 'High',
  ultra: 'Ultra',
}

export function parseQuality(v: unknown, fallback: QualityLevel = 'med'): QualityLevel {
  if (v === 'low' || v === 'med' || v === 'high' || v === 'ultra') return v
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
  const strong = (info.deviceMemory ?? 8) >= 8 && (info.hardwareConcurrency ?? 8) >= 8
  // Desktop discrete GPUs start on Ultra; integrated and mobile parts stay on High.
  if (strong && /nvidia|geforce|rtx|gtx|radeon rx|radeon pro|arc a\d/.test(r)) return 'ultra'
  if (strong) return 'high'
  return 'med'
}
