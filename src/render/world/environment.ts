/** Sky dome, outer landscape (fields, trees, fence), near grass detail ring, rain. */
import * as THREE from 'three'
import { SIZE } from '../../game/types'
import { PROP_LOOK, SKY_LOOK } from '../look'
import { WORLD_PER_METER } from '../aircraft/specs'
import { propTexture } from './propArt'
import { discardDark, landingTexture, spritePlane, SPRITE_GRID } from './landingArt'
import { SKY_PHOTOS, type SkyPhotoBlend, type SkyPhotoId } from './dayNight'
import { instanced, trs } from './kit'
import { hash2, rng } from './raster'
import { CELL, tileAt, worldToCell, type WorldView } from './view'

export const PLOT_HALF = (SIZE * CELL) / 2

export class SkyDome {
  readonly mesh: THREE.Mesh
  private mat: THREE.ShaderMaterial
  /** Stand-in sampler until a panorama arrives (and on Low, where none load). */
  private blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  private photos = new Map<SkyPhotoId, THREE.Texture>()
  private photosOn = false
  constructor() {
    this.blank.needsUpdate = true
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
        photoA: { value: this.blank as THREE.Texture },
        photoB: { value: this.blank as THREE.Texture },
        horizonA: { value: 0.3 },
        horizonB: { value: 0.3 },
        photoMix: { value: 0 },
        photoAmount: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
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
        uniform sampler2D photoA;
        uniform sampler2D photoB;
        uniform float horizonA;
        uniform float horizonB;
        uniform float photoMix;
        uniform float photoAmount;
        varying vec3 vDir;
        float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        // Panoramas are not 360° wide. Mirror once, then blend the fold so the join does not read as a seam.
        vec3 sampleSky(sampler2D tex, vec3 d, float hz) {
          float az = (atan(d.z, d.x) + 3.14159265) / 3.14159265;
          float u = 1.0 - abs(1.0 - az);
          float e = clamp(asin(clamp(d.y, -1.0, 1.0)) / 1.5707963, 0.0, 1.0);
          float v = hz + (1.0 - hz) * e;
          vec3 col = texture2D(tex, vec2(u, v)).rgb;
          float seam = smoothstep(0.14, 0.0, u);
          vec3 side = texture2D(tex, vec2(0.2, v)).rgb;
          return mix(col, side, seam * 0.85);
        }
        void main() {
          vec3 d = normalize(vDir);
          float t = clamp(vDir.y * 1.6, 0.0, 1.0);
          vec3 c = mix(horizon, top, pow(t, 0.7));
          if (photoAmount > 0.0) {
            vec3 p = mix(sampleSky(photoA, d, horizonA), sampleSky(photoB, d, horizonB), photoMix);
            // Below the horizon the procedural haze takes over; the ground and fog cover it anyway.
            c = mix(c, p, photoAmount * smoothstep(-0.02, 0.05, d.y));
          }
          // Pale haze hugging the horizon, then a soft halo around the sun.
          // A white band over the night photo reads as grey smog, so it thins out after dark.
          c = mix(c, vec3(1.0), haze * (1.0 - 0.8 * photoAmount * stars) * (1.0 - smoothstep(0.0, 0.18, abs(vDir.y))));
          float sun = max(dot(d, sunDir), 0.0);
          float disc = pow(sun, glowPower);
          float halo = 0.25 * pow(sun, 3.0);
          // After dusk the same direction is the moon: a tighter, cooler disc.
          float moon = pow(sun, glowPower * 2.2);
          c += sunColor * glow * (1.0 - 0.55 * photoAmount) * (disc + halo) * (1.0 - stars);
          c += sunColor * glow * 0.85 * moon * stars;
          vec3 cell = floor(vDir * 220.0);
          // The night panorama brings its own stars.
          float s = step(0.9965, h(cell)) * stars * (1.0 - photoAmount) * smoothstep(0.08, 0.4, vDir.y);
          gl_FragColor = vec4(c + vec3(s), 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(440, 24, 12), this.mat)
    this.mesh.renderOrder = -10
    this.mesh.frustumCulled = false
    this.mesh.name = 'world-sky'
  }
  set(top: number, horizon: number, stars: number, sunDir?: { x: number; y: number; z: number }, sunColor?: number) {
    this.mat.uniforms.top.value.setHex(top)
    this.mat.uniforms.horizon.value.setHex(horizon)
    this.mat.uniforms.stars.value = stars
    if (sunDir) this.mat.uniforms.sunDir.value.set(sunDir.x, sunDir.y, sunDir.z)
    if (sunColor != null) this.mat.uniforms.sunColor.value.setHex(sunColor)
  }
  /** Medium and High turn the panoramas on; the first call loads them. Low never fetches the JPEGs. */
  setPhotos(on: boolean) {
    this.photosOn = on
    if (!on || this.photos.size || typeof document === 'undefined') return
    const loader = new THREE.TextureLoader()
    for (const id of Object.keys(SKY_PHOTOS) as SkyPhotoId[]) {
      loader.load(SKY_PHOTOS[id].url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        // No mipmaps: the azimuth wrap would pick the smallest level along a one-pixel seam.
        tex.generateMipmaps = false
        tex.minFilter = THREE.LinearFilter
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        tex.needsUpdate = true
        this.photos.set(id, tex)
      })
    }
  }
  /** Crossfade the dome toward `blend`. Holds the procedural sky until both photos are loaded. */
  setPhoto(blend: SkyPhotoBlend, amount: number) {
    const u = this.mat.uniforms
    const a = this.photos.get(blend.a)
    const b = this.photos.get(blend.b)
    if (!this.photosOn || !a || !b) {
      u.photoAmount.value = 0
      return
    }
    u.photoA.value = a
    u.photoB.value = b
    u.horizonA.value = SKY_PHOTOS[blend.a].horizon
    u.horizonB.value = SKY_PHOTOS[blend.b].horizon
    u.photoMix.value = blend.t
    u.photoAmount.value = Math.max(0, Math.min(1, amount))
  }
  photoAmount(): number {
    return this.mat.uniforms.photoAmount.value
  }
  follow(cam: THREE.Vector3) {
    this.mesh.position.copy(cam)
  }
  dispose() {
    this.mesh.geometry.dispose()
    this.mat.dispose()
    this.blank.dispose()
    for (const tex of this.photos.values()) tex.dispose()
    this.photos.clear()
  }
}

/**
 * Square ground with a square hole for the plot. The plot's own surfaces cover the
 * hole, so the software-GL fill cost isn't paid twice under every tile.
 */
export function frameGeometry(inner: number, outer: number, uvScale: number): THREE.BufferGeometry {
  const pts = [
    [-outer, -outer],
    [outer, -outer],
    [outer, outer],
    [-outer, outer],
    [-inner, -inner],
    [inner, -inner],
    [inner, inner],
    [-inner, inner],
  ]
  const pos: number[] = []
  const uv: number[] = []
  for (const [x, z] of pts) {
    pos.push(x, 0, z)
    uv.push(x * uvScale, z * uvScale)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pts.flatMap(() => [0, 1, 0]), 3))
  // Four trapezoids between the outer and inner squares, wound to face +y.
  g.setIndex([0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4])
  g.computeBoundingSphere()
  return g
}

export interface LandscapeTint {
  ground: number
  fields: readonly number[]
  trees: readonly number[]
}

const FARMLAND_GROUND = 0xb8c8a8
const FARMLAND_FIELDS = [0x8a9a4a, 0xa89a58, 0x5d7f3a, 0x7a8f4c, 0x9a8a5a]
const FARMLAND_TREES = [0x2f6a2e, 0x3d7a34, 0x4a8a3a, 0x2a5a30]

function addSprites(
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
  map: THREE.Texture,
  count: number,
  height: number,
  seed: number,
) {
  const mat = new THREE.MeshLambertMaterial({ map, color: 0xffffff, side: THREE.DoubleSide })
  discardDark(mat, 0.055)
  mats.push(mat)
  const folder = new THREE.Group()
  folder.name = seed === 99 ? 'world-trees' : 'world-bushes'
  const planes: THREE.PlaneGeometry[] = []
  for (let row = 0; row < SPRITE_GRID.rows; row++) {
    for (let col = 0; col < SPRITE_GRID.cols; col++) {
      const geo = spritePlane(col, row)
      planes.push(geo)
      geos.push(geo)
    }
  }
  const buckets: THREE.Matrix4[][] = planes.map(() => [])
  const rand = rng(seed)
  let guard = 0
  let n = 0
  while (n < count && guard++ < count * 20) {
    const a = rand() * Math.PI * 2
    const r = PLOT_HALF + 8 + Math.pow(rand(), 0.65) * 220
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (Math.abs(x) < PLOT_HALF + 6 && Math.abs(z) < PLOT_HALF + 6) continue
    const s = height * (0.75 + rand() * 0.55)
    const yaw = rand() * Math.PI
    const cell = Math.floor(rand() * planes.length)
    buckets[cell].push(trs(x, 0, z, yaw, s * 0.72, s, 1))
    buckets[cell].push(trs(x, 0, z, yaw + Math.PI / 2, s * 0.72, s, 1))
    n++
  }
  planes.forEach((geo, i) => {
    if (!buckets[i].length) return
    const mesh = instanced(geo, mat, buckets[i])
    mesh.castShadow = true
    folder.add(mesh)
  })
  group.add(folder)
}

export interface LandscapeArt {
  farmland?: THREE.Texture | null
  water?: THREE.Texture | null
  trees?: THREE.Texture | null
  bushes?: THREE.Texture | null
}

/** Patchwork farmland + trees around the plot, and a perimeter fence. */
export function buildLandscape(
  grass: THREE.Texture,
  trees: number,
  tint?: LandscapeTint | null,
  art?: LandscapeArt | null,
): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group()
  group.name = 'world-landscape'
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []

  const groundGeo = frameGeometry(PLOT_HALF, 450, 1 / 6.4)
  const groundMap = art?.farmland ?? grass
  const groundMat = new THREE.MeshLambertMaterial({ map: groundMap, color: art?.farmland ? 0xffffff : (tint?.ground ?? FARMLAND_GROUND) })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.name = 'world-farmland'
  ground.position.y = -0.06
  ground.receiveShadow = true
  group.add(ground)
  geos.push(groundGeo)
  mats.push(groundMat)

  // Field patches: vertex-coloured quads in rings outside the plot.
  const rand = rng(99)
  const fieldCols = tint?.fields?.length ? tint.fields : FARMLAND_FIELDS
  const pos: number[] = []
  const col: number[] = []
  const c = new THREE.Color()
  const quad = (x: number, z: number, w: number, d: number, hex: number) => {
    c.setHex(hex)
    const ys = -0.04
    const pts = [
      [x - w / 2, z - d / 2],
      [x - w / 2, z + d / 2],
      [x + w / 2, z - d / 2],
      [x + w / 2, z - d / 2],
      [x - w / 2, z + d / 2],
      [x + w / 2, z + d / 2],
    ]
    for (const [px, pz] of pts) {
      pos.push(px, ys, pz)
      col.push(c.r, c.g, c.b)
    }
  }
  for (let gx = -6; gx < 6; gx++) {
    for (let gz = -6; gz < 6; gz++) {
      const x = gx * 48 + 24
      const z = gz * 48 + 24
      if (Math.abs(x) < PLOT_HALF + 30 && Math.abs(z) < PLOT_HALF + 30) continue
      if (rand() < 0.35) continue
      quad(x, z, 40 + rand() * 6, 40 + rand() * 6, fieldCols[Math.floor(rand() * fieldCols.length)])
    }
  }
  const fieldGeo = new THREE.BufferGeometry()
  fieldGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  fieldGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  fieldGeo.computeVertexNormals()
  const fieldMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: groundMap, polygonOffset: true, polygonOffsetFactor: -1 })
  const fields = new THREE.Mesh(fieldGeo, fieldMat)
  fields.name = 'world-fields'
  fields.receiveShadow = true
  group.add(fields)
  geos.push(fieldGeo)
  mats.push(fieldMat)

  // Trees: trunk + two-tone crowns, scattered in hedgerows outside the fence.
  const trunk = new THREE.CylinderGeometry(0.18, 0.26, 1.6, 5)
  trunk.translate(0, 0.8, 0)
  const crown = new THREE.IcosahedronGeometry(1.5, 0)
  crown.translate(0, 2.6, 0)
  const trunkM = new THREE.MeshLambertMaterial({ color: 0x5a4030 })
  const crownM = new THREE.MeshLambertMaterial({ color: 0xffffff })
  geos.push(trunk, crown)
  mats.push(trunkM, crownM)
  const tm: THREE.Matrix4[] = []
  const tc: number[] = []
  const greens = tint?.trees?.length ? tint.trees : FARMLAND_TREES
  let guard = 0
  while (tm.length < trees && guard++ < trees * 20) {
    const a = rand() * Math.PI * 2
    const r = PLOT_HALF + 10 + Math.pow(rand(), 0.7) * 230
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (Math.abs(x) < PLOT_HALF + 8 && Math.abs(z) < PLOT_HALF + 8) continue
    const s = 0.8 + rand() * 0.9
    tm.push(trs(x, 0, z, rand() * 6.28, s, s * (0.9 + rand() * 0.4), s))
    tc.push(greens[Math.floor(rand() * greens.length)])
  }
  if (tm.length && !art?.trees) {
    const tr = instanced(trunk, trunkM, tm)
    const cr = instanced(crown, crownM, tm, tc)
    tr.castShadow = true
    cr.castShadow = true
    group.add(tr, cr)
  }
  if (art?.trees) addSprites(group, geos, mats, art.trees, trees, 6.5, 99)
  if (art?.bushes) addSprites(group, geos, mats, art.bushes, Math.max(8, Math.round(trees * 0.45)), 2.4, 41)
  if (art?.water) {
    const riverGeo = new THREE.PlaneGeometry(240, 18, 1, 1)
    riverGeo.rotateX(-Math.PI / 2)
    const uv = riverGeo.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 1.5)
    const riverMat = new THREE.MeshLambertMaterial({ map: art.water, color: 0xffffff })
    const river = new THREE.Mesh(riverGeo, riverMat)
    river.name = 'world-river'
    river.position.set(0, -0.03, PLOT_HALF + 38)
    river.receiveShadow = true
    group.add(river)
    geos.push(riverGeo)
    mats.push(riverMat)
  }

  // Perimeter fence: posts, chain-link, and three barbed strands.
  const e = PLOT_HALF + 2.2
  const post = new THREE.BoxGeometry(0.08, 1.85, 0.08)
  post.translate(0, 0.925, 0)
  const postM = new THREE.MeshLambertMaterial({ color: PROP_LOOK.chainlink })
  const link = landingTexture('chainlink') ?? propTexture('chainlink')
  if (link) link.repeat.set(Math.max(1, Math.round((e * 2) / (3 * WORLD_PER_METER))), 1)
  const meshM = new THREE.MeshLambertMaterial({
    color: link ? 0xffffff : PROP_LOOK.chainlink,
    ...(link ? { map: link } : {}),
    transparent: !link,
    opacity: link ? 1 : 0.22,
    side: THREE.DoubleSide,
    depthWrite: Boolean(link),
  })
  if (link) discardDark(meshM, 0.12)
  geos.push(post)
  mats.push(postM, meshM)
  const pm: THREE.Matrix4[] = []
  for (let t = -e; t <= e; t += 3.1) {
    pm.push(trs(t, 0, -e), trs(t, 0, e), trs(-e, 0, t), trs(e, 0, t))
  }
  group.add(instanced(post, postM, pm))
  for (const [x, z, yaw] of [
    [0, -e, 0],
    [0, e, 0],
    [-e, 0, Math.PI / 2],
    [e, 0, Math.PI / 2],
  ] as const) {
    const g = new THREE.PlaneGeometry(e * 2, 1.4)
    geos.push(g)
    const m = new THREE.Mesh(g, meshM)
    m.position.set(x, 0.85, z)
    m.rotation.y = yaw
    group.add(m)
  }
  const wireGeo = new THREE.BoxGeometry(1, 1, 1)
  const wireM = new THREE.MeshLambertMaterial({ color: PROP_LOOK.wire })
  geos.push(wireGeo)
  mats.push(wireM)
  const wires: THREE.Matrix4[] = []
  for (const [x, z, yaw] of [
    [0, -e, 0],
    [0, e, 0],
    [-e, 0, Math.PI / 2],
    [e, 0, Math.PI / 2],
  ] as const) {
    for (let s = 0; s < 3; s++) wires.push(trs(x, 1.58 + s * 0.07, z, yaw, e * 2, 0.015, 0.015))
  }
  group.add(instanced(wireGeo, wireM, wires))
  return {
    group,
    dispose() {
      for (const g of geos) g.dispose()
      for (const m of mats) m.dispose()
      group.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose()
      })
    },
  }
}

/**
 * Near-camera grass tufts on a world-anchored jittered grid: tufts never swim when
 * the camera pans, and they shrink toward the ring edge so there's no hard pop.
 */
export class GrassRing {
  readonly mesh: THREE.InstancedMesh
  private geo: THREE.BufferGeometry
  private mat: THREE.MeshLambertMaterial
  private max: number
  private lastKey = ''
  radius = 26
  spacing = 0.9
  fade = 0

  constructor(max: number) {
    this.max = Math.max(1, max)
    this.geo = tuftGeometry()
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true })
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.max)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.name = 'world-grass-ring'
  }

  update(view: WorldView, fx: number, fz: number, camDist: number, dt: number, mapRev: number) {
    const target = camDist < 46 ? 1 : 0
    this.fade += Math.sign(target - this.fade) * Math.min(Math.abs(target - this.fade), dt * 3)
    this.mesh.visible = this.fade > 0.01 && this.max > 1
    if (!this.mesh.visible) return
    this.mat.opacity = this.fade
    this.mat.transparent = this.fade < 0.99
    // Spacing grows a little with zoom so the count stays bounded.
    const spacing = this.spacing * THREE.MathUtils.clamp(camDist / 24, 0.8, 1.6)
    const radius = Math.min(this.radius * THREE.MathUtils.clamp(camDist / 24, 0.8, 1.5), Math.sqrt(this.max / Math.PI) * spacing)
    const key = `${Math.round(fx / spacing)},${Math.round(fz / spacing)},${spacing.toFixed(2)},${mapRev}`
    if (key === this.lastKey) return
    this.lastKey = key
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    let n = 0
    const g0x = Math.floor((fx - radius) / spacing)
    const g1x = Math.ceil((fx + radius) / spacing)
    const g0z = Math.floor((fz - radius) / spacing)
    const g1z = Math.ceil((fz + radius) / spacing)
    for (let gz = g0z; gz <= g1z && n < this.max; gz++) {
      for (let gx = g0x; gx <= g1x && n < this.max; gx++) {
        const jx = (hash2(gx, gz, 3) - 0.5) * spacing
        const jz = (hash2(gx, gz, 5) - 0.5) * spacing
        const x = gx * spacing + jx
        const z = gz * spacing + jz
        const d = Math.hypot(x - fx, z - fz) / radius
        if (d > 1) continue
        const cell = worldToCell(x, z)
        const t = tileAt(view, cell.c, cell.r)
        const inside = Math.abs(x) < PLOT_HALF && Math.abs(z) < PLOT_HALF
        if (inside && t !== 'grass') continue
        // Keep tufts off the paving edge.
        if (inside) {
          const lx = x / CELL + (SIZE - 1) / 2 - cell.c
          const lz = z / CELL + (SIZE - 1) / 2 - cell.r
          const edge = 0.44
          if (Math.abs(lx) > edge || Math.abs(lz) > edge) {
            const nb = tileAt(view, cell.c + Math.sign(lx), cell.r + Math.sign(lz))
            if (nb !== 'grass') continue
          }
        }
        const k = (1 - d * d) * (0.7 + hash2(gx, gz, 9) * 0.6)
        q.setFromAxisAngle(up, hash2(gx, gz, 11) * Math.PI * 2)
        s.set(k, k * (0.8 + hash2(gx, gz, 13) * 0.6), k)
        p.set(x, 0, z)
        m.compose(p, q, s)
        this.mesh.setMatrixAt(n++, m)
      }
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.geo.dispose()
    this.mat.dispose()
    this.mesh.dispose()
  }
}

/** Five blades fanned around the origin, dark at the root, sunlit at the tip. */
export function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const base = new THREE.Color(0x24502a)
  const tip = new THREE.Color(0x8ab85a)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const lean = 0.08 + (i % 2) * 0.05
    const w = 0.05
    const h = 0.32 + (i % 3) * 0.06
    const cx = Math.cos(a)
    const cz = Math.sin(a)
    const px = -cz * w
    const pz = cx * w
    pos.push(px, 0, pz, -px, 0, -pz, cx * lean, h, cz * lean)
    col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

/** Rain streaks in a box that follows the camera focus. */
import { WeatherLayer } from '../weather/index'

/** Rain streaks in a box that follows the camera focus. */
export class Rain {
  readonly lines: THREE.Group
  private weatherLayer: WeatherLayer

  constructor(_n: number) {
    this.weatherLayer = new WeatherLayer()
    this.lines = this.weatherLayer.group
    this.lines.name = 'world-weather'
  }
  update(dt: number, amount: number, fx: number, fz: number) {
    this.weatherLayer.updateParticles(dt, 'none', 'clear', amount, fx, fz)
  }
  updateRich(dt: number, precipType: 'none' | 'snow' | 'freezing_rain' | 'rain', weather: string, amount: number, fx: number, fz: number) {
    this.weatherLayer.updateParticles(dt, precipType, weather, amount, fx, fz)
  }
  get cover() {
    return this.weatherLayer.cover
  }
  dispose() {
    this.weatherLayer.dispose()
  }
}
