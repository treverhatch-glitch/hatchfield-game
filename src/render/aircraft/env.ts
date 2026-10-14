import * as THREE from 'three'
import { setAircraftEnvMap } from './pool'

/**
 * Outdoor reflection probe for aircraft: blue sky dome, bright horizon band, apron-grey
 * ground and a hot sun disc, prefiltered with PMREM so roughness blurs it correctly.
 * Applied only to aircraft materials (paint, metal, gear), not to the whole scene.
 */
let installed: THREE.Texture | null = null

export function installAircraftEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (installed) return installed
  const scene = new THREE.Scene()
  const dome = new THREE.SphereGeometry(50, 32, 16)
  const pos = dome.getAttribute('position')
  const col = new Float32Array(pos.count * 3)
  const zenith = new THREE.Color('#3f74b8')
  const horizon = new THREE.Color('#dfe9f2')
  const ground = new THREE.Color('#5e605c')
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 50
    if (y >= 0) c.copy(horizon).lerp(zenith, Math.pow(y, 0.55))
    else c.copy(horizon).lerp(ground, Math.min(1, -y * 6))
    col.set([c.r, c.g, c.b], i * 3)
  }
  dome.setAttribute('color', new THREE.BufferAttribute(col, 3))
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })))
  const sun = new THREE.Mesh(new THREE.CircleGeometry(4, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) }))
  sun.position.set(25, 35, 15)
  sun.lookAt(0, 0, 0)
  scene.add(sun)
  const pmrem = new THREE.PMREMGenerator(renderer)
  installed = pmrem.fromScene(scene, 0.02).texture
  pmrem.dispose()
  dome.dispose()
  setAircraftEnvMap(installed)
  return installed
}
