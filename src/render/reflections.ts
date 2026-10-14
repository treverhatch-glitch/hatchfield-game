/**
 * Lazy reflection maps (re-land of #258 / 7e02baf).
 *
 * The building studio probe is one RoomEnvironment filtered with PMREM, shared by
 * terminal metal and glass. It is built the first time the High or Ultra building
 * setting is on. The pass roughly doubles boot shader work and the map is unused
 * on Low and Medium, so those presets never compile it.
 *
 * The aircraft sky probe is the same kind of boot cost. Low airframes are unlit,
 * so that probe waits until Medium or above. High-res stays the default: a desktop
 * GPU still boots on Ultra and gets both maps.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { QualityLevel } from './world/quality'

export function buildingReflectionsFor(level: QualityLevel): boolean {
  return level === 'high' || level === 'ultra'
}

/** Low aircraft shells are MeshBasicMaterial, so the sky probe would be unused. */
export function aircraftReflectionsFor(level: QualityLevel): boolean {
  return level !== 'low'
}

type BuildEnv = (renderer: THREE.WebGLRenderer) => THREE.Texture | null

let envTex: THREE.Texture | null = null
let built = false
let reflectionsOn = false
const tracked = new Set<THREE.MeshStandardMaterial>()

export function buildingReflectionsActive(): boolean {
  return reflectionsOn && envTex != null
}

/** Terminal prop materials pick up the studio map when High / Ultra is on. */
export function attachBuildingMaterial(mat: THREE.MeshStandardMaterial): void {
  tracked.add(mat)
  if (!buildingReflectionsActive() || mat.envMap === envTex) return
  mat.envMap = envTex
  mat.needsUpdate = true
}

function defaultBuild(renderer: THREE.WebGLRenderer): THREE.Texture | null {
  const pm = new THREE.PMREMGenerator(renderer)
  try {
    return pm.fromScene(new RoomEnvironment(), 0.04).texture
  } finally {
    pm.dispose()
  }
}

/** Build the studio map once. A headless renderer leaves it null and does not retry. */
export function ensureBuildingEnvironment(
  renderer: THREE.WebGLRenderer,
  build: BuildEnv = defaultBuild,
): THREE.Texture | null {
  if (built) return envTex
  built = true
  try {
    envTex = build(renderer)
  } catch {
    envTex = null
  }
  return envTex
}

export function setBuildingReflections(on: boolean): void {
  reflectionsOn = on
  const tex = on ? envTex : null
  for (const mat of tracked) {
    if (mat.envMap === tex) continue
    mat.envMap = tex
    mat.needsUpdate = true
  }
}

/**
 * High / Ultra builds the map on first use and assigns it. Low / Medium clear it
 * without ever running PMREM.
 */
export function prepareBuildingReflections(
  renderer: THREE.WebGLRenderer,
  level: QualityLevel,
  build?: BuildEnv,
): void {
  if (buildingReflectionsFor(level)) ensureBuildingEnvironment(renderer, build)
  setBuildingReflections(buildingReflectionsFor(level))
}

export function resetBuildingReflectionsForTests(): void {
  envTex = null
  built = false
  reflectionsOn = false
  tracked.clear()
}
