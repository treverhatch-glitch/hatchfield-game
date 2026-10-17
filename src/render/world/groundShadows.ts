import * as THREE from 'three'
import { CONTACT_LOOK } from '../look'

export interface GroundShadowSpot {
  x: number
  z: number
  sx: number
  sz: number
  r: number
  opacity: number
}

function groundShadowTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4)
  const strength = CONTACT_LOOK.strength
  const power = CONTACT_LOOK.power
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
      const falloff = Math.pow(Math.max(0, 1 - d), power)
      const alpha = Math.round(strength * falloff * 255)
      const i = (y * size + x) * 4
      data[i] = 255 // white texture, alpha controls opacity
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = alpha
    }
  }
  const tex = new THREE.DataTexture(data, size, size)
  tex.colorSpace = THREE.NoColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

export class GroundShadows {
  readonly mesh: THREE.InstancedMesh
  private geo: THREE.BufferGeometry
  private mat: THREE.ShaderMaterial
  private tex: THREE.DataTexture
  private capacity: number
  private opacities: Float32Array
  private opacityAttr: THREE.InstancedBufferAttribute
  private dummy = new THREE.Object3D()

  constructor(capacity = 2048) {
    this.capacity = capacity
    this.geo = new THREE.PlaneGeometry(1, 1)
    this.geo.rotateX(-Math.PI / 2)
    this.tex = groundShadowTexture()

    this.opacities = new Float32Array(capacity)
    this.opacityAttr = new THREE.InstancedBufferAttribute(this.opacities, 1)
    this.geo.setAttribute('instanceOpacity', this.opacityAttr)

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: this.tex }
      },
      vertexShader: `
        attribute float instanceOpacity;
        varying vec2 vUv;
        varying float vOpacity;
        void main() {
          vUv = uv;
          vOpacity = instanceOpacity;
          vec4 mvPosition = instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        varying vec2 vUv;
        varying float vOpacity;
        void main() {
          float a = texture2D(map, vUv).a;
          gl_FragColor = vec4(0.0, 0.0, 0.0, a * vOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })

    this.mat.userData.noGrade = true
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, capacity)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3
    this.mesh.name = 'ground-shadows'
    this.mesh.receiveShadow = false
    this.mesh.castShadow = false
  }

  sync(spots: readonly GroundShadowSpot[]) {
    const n = Math.min(spots.length, this.capacity)
    const y = 0.04

    for (let i = 0; i < n; i++) {
      const s = spots[i]
      this.dummy.position.set(s.x, y, s.z)
      this.dummy.rotation.set(0, s.r, 0)
      this.dummy.scale.set(s.sx, 1, s.sz)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.opacities[i] = s.opacity
    }

    this.opacityAttr.needsUpdate = true
    this.mesh.count = n
    this.mesh.visible = n > 0
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.geo.dispose()
    this.mat.dispose()
    this.tex.dispose()
    this.mesh.dispose()
  }
}
