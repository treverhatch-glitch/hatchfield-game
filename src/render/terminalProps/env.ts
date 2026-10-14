/**
 * Desktop-tier environment for terminal views: PMREM room environment for
 * glass/metal/clearcoat reflections, plus renderer settings tuned for an
 * RTX 4070 class GPU (4K shadow map, soft shadows, ACES, physical lights).
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export function setupTerminalEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, intensity = 0.45): THREE.Texture {
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.85
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const pm = new THREE.PMREMGenerator(renderer)
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
  pm.dispose()
  scene.environment = env
  ;(scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = intensity
  return env
}
