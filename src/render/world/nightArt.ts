/**
 * Night plates from the landing pack: window glow, apron flood pools, nav billboards.
 * Files stay at 2048. Nothing here resamples them.
 */
import * as THREE from 'three'
import { landingTexture } from './landingArt'

/**
 * Buildings whose walls read as windows at night. Tanks, pads, and the bag
 * sort stay dark: that hall is warehouse cladding, and the window mask
 * drew a stripe across it.
 */
const WINDOW_WALLS = new Set([
  'terminal',
  'hotel',
  'control_tower',
  'fire_station',
  'cargo_terminal',
  'hangar',
  'police_station',
  'guard_booth',
  'kiosk',
  'catering_kitchen',
  'transit_station',
  'warehouse',
  'parking_garage',
  'maintenance_shed',
  'ground_services',
])

const glowMats: WeakRef<THREE.Material & { emissiveIntensity: number }>[] = []
let glowUv1: THREE.Texture | null = null

/** Shared window mask. Channel 1 is a clone so skinned walls can use uv1. */
export function windowGlowTexture(channel: 0 | 1 = 0): THREE.Texture | null {
  const base = landingTexture('window_glow')
  if (!base) return null
  if (channel === 0) return base
  if (!glowUv1) {
    glowUv1 = base.clone()
    glowUv1.channel = 1
    glowUv1.needsUpdate = true
  }
  return glowUv1
}

export function windowGlowTarget(target: string): boolean {
  return WINDOW_WALLS.has(target)
}

/** Remember a material so the night factor can drive its emissive mask. */
export function trackWindowGlow(mat: THREE.Material & { emissiveIntensity: number }) {
  glowMats.push(new WeakRef(mat))
}

/** One copy of the window mask on a pane that already has 0–1 UVs. */
export function paintWindow(mat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial) {
  const glow = windowGlowTexture(0)
  if (!glow) return
  mat.emissiveMap = glow
  mat.emissive = new THREE.Color(0xffffff)
  mat.emissiveIntensity = 0
  trackWindowGlow(mat)
}

/** `night` is 0 by day and 1 when the terminal windows are fully on. */
export function setWindowGlow(night: number) {
  const k = Math.max(0, Math.min(1, night)) * 1.15
  let i = 0
  while (i < glowMats.length) {
    const mat = glowMats[i].deref()
    if (!mat) {
      glowMats.splice(i, 1)
      continue
    }
    mat.emissiveIntensity = k
    i++
  }
}

/**
 * The flood plate's falloff reaches the frame. Fade the disk so the pool
 * does not end in a hard square. `uv` is 0–1 across the decal.
 */
export function floodEdgeFade(u: number, v: number): number {
  const d = Math.hypot(u - 0.5, v - 0.5)
  if (d >= 0.5) return 0
  if (d <= 0.32) return 1
  const t = (0.5 - d) / (0.5 - 0.32)
  return t * t * (3 - 2 * t)
}

/** Fragment snippet. Matches `floodEdgeFade` at the centre, the rim, and the corner. */
export const FLOOD_FADE_GLSL = `
  float floodD = length(vMapUv - 0.5);
  float floodEdge = smoothstep(0.5, 0.32, floodD);
  diffuseColor.a *= floodEdge;
`

export function fadeFloodPool(mat: THREE.Material) {
  const previous = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    previous?.call(mat, shader, renderer)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>${FLOOD_FADE_GLSL}`,
    )
  }
  mat.customProgramCacheKey = () => 'landing-flood-fade'
}

/**
 * Nav sheet is 2×2. Row 0 is the bottom of the image (Three's v).
 * Red port, green starboard, white strobe, red beacon.
 */
export const NAV_CELLS = {
  navRed: { col: 0, row: 1 },
  navGreen: { col: 1, row: 1 },
  navWhite: { col: 0, row: 0 },
  beacon: { col: 1, row: 0 },
} as const

export type NavCell = keyof typeof NAV_CELLS

const navMats = new Map<NavCell, THREE.SpriteMaterial>()

function navMap(cell: NavCell): THREE.Texture | null {
  const base = landingTexture('nav_light_sprites')
  if (!base) return null
  const map = base.clone()
  const { col, row } = NAV_CELLS[cell]
  map.repeat.set(0.5, 0.5)
  map.offset.set(col * 0.5, row * 0.5)
  map.wrapS = THREE.ClampToEdgeWrapping
  map.wrapT = THREE.ClampToEdgeWrapping
  map.needsUpdate = true
  return map
}

/** Billboard for one lamp. Null in Node, where the plate is not decoded. */
export function navLightSprite(cell: NavCell): THREE.Sprite | null {
  if (typeof document === 'undefined') return null
  let mat = navMats.get(cell)
  if (!mat) {
    const map = navMap(cell)
    if (!map) return null
    mat = new THREE.SpriteMaterial({
      map,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      fog: false,
    })
    navMats.set(cell, mat)
  }
  const sprite = new THREE.Sprite(mat)
  sprite.name = 'nav-billboard'
  sprite.scale.setScalar(8)
  sprite.userData.glow = true
  sprite.raycast = () => {}
  return sprite
}
