import * as THREE from 'three'
import { SKY_LOOK } from '../render/look'

let loader: THREE.TextureLoader | null = null
let texDawn: THREE.Texture | null = null
let texNoon: THREE.Texture | null = null
let texDusk: THREE.Texture | null = null
let texNight: THREE.Texture | null = null

// Only load textures in the browser environment
if (typeof document !== 'undefined') {
  loader = new THREE.TextureLoader()
  const loadSky = (path: string) => {
    const tex = loader!.load(path)
    tex.colorSpace = THREE.SRGBColorSpace
    // Use mirrored repeat so the seam at the back blends better if not perfectly wrapped
    tex.wrapS = THREE.MirroredRepeatWrapping
    return tex
  }
  texDawn = loadSky('/art/refs/pack6/skies/sky_dawn.jpg')
  texNoon = loadSky('/art/refs/pack6/skies/sky_noon.jpg')
  texDusk = loadSky('/art/refs/pack6/skies/sky_dusk.jpg')
  texNight = loadSky('/art/refs/pack6/skies/sky_night.jpg')
}

export class SkyDome {
  readonly mesh: THREE.Mesh
  private mat: THREE.ShaderMaterial
  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color(0x4f93d6) },
        horizon: { value: new THREE.Color(0xc4ddf0) },
        stars: { value: 0 },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color(0xfff1d8) },
        glow: { value: SKY_LOOK.sunGlow },
        glowPower: { value: SKY_LOOK.sunGlowPower },
        haze: { value: SKY_LOOK.horizonHaze },
        texA: { value: null },
        texB: { value: null },
        blend: { value: 0.0 },
        useTex: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        varying vec2 vUv;
        void main() {
          vDir = normalize(position);
          // Spherical mapping for UVs
          vec3 dir = normalize(position);
          float u = 0.5 + atan(dir.z, dir.x) / (2.0 * 3.14159265);
          float v = 0.5 - asin(dir.y) / 3.14159265;
          vUv = vec2(u, v);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 horizon;
        uniform float stars;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        uniform float glow;
        uniform float glowPower;
        uniform float haze;
        uniform sampler2D texA;
        uniform sampler2D texB;
        uniform float blend;
        uniform float useTex;
<<<<<<< Updated upstream

=======

>>>>>>> Stashed changes
        varying vec3 vDir;
        varying vec2 vUv;
        float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main() {
          float t = clamp(vDir.y * 1.6, 0.0, 1.0);
          vec3 procC = mix(horizon, top, pow(t, 0.7));
          procC = mix(procC, vec3(1.0), haze * (1.0 - smoothstep(0.0, 0.18, abs(vDir.y))));
<<<<<<< Updated upstream

          vec4 colorA = texture2D(texA, vUv);
          vec4 colorB = texture2D(texB, vUv);
          vec3 texC = mix(colorA.rgb, colorB.rgb, blend);

          vec3 c = mix(procC, texC, useTex);

=======

          vec4 colorA = texture2D(texA, vUv);
          vec4 colorB = texture2D(texB, vUv);
          vec3 texC = mix(colorA.rgb, colorB.rgb, blend);

          vec3 c = mix(procC, texC, useTex);

>>>>>>> Stashed changes
          float sun = max(dot(normalize(vDir), sunDir), 0.0);
          c += sunColor * glow * (pow(sun, glowPower) + 0.25 * pow(sun, 3.0)) * (1.0 - stars);
          vec3 cell = floor(vDir * 220.0);
          float s = step(0.9965, h(cell)) * stars * smoothstep(0.08, 0.4, vDir.y);
          gl_FragColor = vec4(c + vec3(s), 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(440, 48, 24), this.mat)
    // Rotate so the sun path lines up decently with the texture highlights
    this.mesh.rotation.y = -Math.PI / 2
    this.mesh.renderOrder = -10
    this.mesh.frustumCulled = false
    this.mesh.name = 'world-sky'
  }
  set(top: number, horizon: number, stars: number, sunDir?: { x: number; y: number; z: number }, sunColor?: number, hour?: number) {
    this.mat.uniforms.top.value.setHex(top)
    this.mat.uniforms.horizon.value.setHex(horizon)
    this.mat.uniforms.stars.value = stars
    if (sunDir) this.mat.uniforms.sunDir.value.set(sunDir.x, sunDir.y, sunDir.z)
    if (sunColor != null) this.mat.uniforms.sunColor.value.setHex(sunColor)
<<<<<<< Updated upstream

=======

>>>>>>> Stashed changes
    if (hour !== undefined && texDawn && texNoon && texDusk && texNight) {
      this.mat.uniforms.useTex.value = 1.0
      const h = ((hour % 24) + 24) % 24
      // Sequence: dawn (6) -> noon (12) -> dusk (19) -> night (23/0)
      if (h >= 6 && h < 12) {
        this.mat.uniforms.texA.value = texDawn
        this.mat.uniforms.texB.value = texNoon
        this.mat.uniforms.blend.value = (h - 6) / 6
      } else if (h >= 12 && h < 19) {
        this.mat.uniforms.texA.value = texNoon
        this.mat.uniforms.texB.value = texDusk
        this.mat.uniforms.blend.value = (h - 12) / 7
      } else if (h >= 19 && h <= 24) {
        this.mat.uniforms.texA.value = texDusk
        this.mat.uniforms.texB.value = texNight
        this.mat.uniforms.blend.value = (h - 19) / 5
      } else {
        this.mat.uniforms.texA.value = texNight
        this.mat.uniforms.texB.value = texDawn
        this.mat.uniforms.blend.value = h / 6
      }
    } else {
      this.mat.uniforms.useTex.value = 0.0
    }
  }
  follow(cam: THREE.Vector3) {
    this.mesh.position.copy(cam)
  }
  dispose() {
    this.mesh.geometry.dispose()
    this.mat.dispose()
  }
}
