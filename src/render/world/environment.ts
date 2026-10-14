/** Sky dome, outer landscape (fields, trees, fence), near grass detail ring, rain. */
import * as THREE from 'three'
import { SIZE } from '../../game/types'
import { SKY_LOOK } from '../look'
import { instanced, trs } from './kit'
import { hash2, rng } from './raster'
import { CELL, tileAt, worldToCell, type WorldView } from './view'

export const PLOT_HALF = (SIZE * CELL) / 2

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
        varying vec3 vDir;
        float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main() {
          float t = clamp(vDir.y * 1.6, 0.0, 1.0);
          vec3 c = mix(horizon, top, pow(t, 0.7));
          // Pale haze hugging the horizon, then a soft halo around the sun.
          c = mix(c, vec3(1.0), haze * (1.0 - smoothstep(0.0, 0.18, abs(vDir.y))));
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
  follow(cam: THREE.Vector3) {
    this.mesh.position.copy(cam)
  }
  dispose() {
    this.mesh.geometry.dispose()
    this.mat.dispose()
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

/** Patchwork farmland + trees around the plot, and a perimeter fence. */
export function buildLandscape(
  grass: THREE.Texture,
  trees: number,
  tint?: LandscapeTint | null,
): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group()
  group.name = 'world-landscape'
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []

  const groundGeo = frameGeometry(PLOT_HALF, 450, 1 / 6.4)
  const groundMat = new THREE.MeshLambertMaterial({ map: grass, color: tint?.ground ?? FARMLAND_GROUND })
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
  const fieldMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: grass, polygonOffset: true, polygonOffsetFactor: -1 })
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
  if (tm.length) {
    const tr = instanced(trunk, trunkM, tm)
    const cr = instanced(crown, crownM, tm, tc)
    tr.castShadow = true
    cr.castShadow = true
    group.add(tr, cr)
  }

  // Perimeter fence: posts + a faint mesh band.
  const e = PLOT_HALF + 2.2
  const post = new THREE.BoxGeometry(0.08, 1.6, 0.08)
  post.translate(0, 0.8, 0)
  const postM = new THREE.MeshLambertMaterial({ color: 0x9aa2aa })
  const meshM = new THREE.MeshBasicMaterial({ color: 0xc8d0d8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
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
export class Rain {
  readonly lines: THREE.LineSegments
  private pos: Float32Array
  private vel: Float32Array
  private mat: THREE.LineBasicMaterial
  private n: number
  constructor(n: number) {
    this.n = Math.max(1, n)
    this.pos = new Float32Array(this.n * 6)
    this.vel = new Float32Array(this.n)
    const rand = rng(5)
    for (let i = 0; i < this.n; i++) {
      const x = (rand() - 0.5) * 80
      const y = rand() * 40
      const z = (rand() - 0.5) * 80
      this.pos.set([x, y, z, x + 0.1, y + 0.9, z + 0.05], i * 6)
      this.vel[i] = 26 + rand() * 10
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.mat = new THREE.LineBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0.45, depthWrite: false })
    this.lines = new THREE.LineSegments(g, this.mat)
    this.lines.frustumCulled = false
    this.lines.visible = false
    this.lines.name = 'world-rain'
  }
  update(dt: number, amount: number, fx: number, fz: number) {
    this.lines.visible = amount > 0.01
    if (!this.lines.visible) return
    this.mat.opacity = 0.25 + amount * 0.3
    this.lines.position.set(fx, 0, fz)
    const p = this.pos
    const draw = Math.floor(this.n * amount)
    for (let i = 0; i < draw; i++) {
      const o = i * 6
      const dy = this.vel[i] * dt
      p[o + 1] -= dy
      p[o + 4] -= dy
      if (p[o + 1] < 0) {
        p[o + 1] += 40
        p[o + 4] += 40
      }
    }
    this.lines.geometry.setDrawRange(0, draw * 2)
    ;(this.lines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  }
  dispose() {
    this.lines.geometry.dispose()
    this.mat.dispose()
  }
}
