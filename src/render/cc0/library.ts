/**
 * CC0 model library: free public-domain glTF models (Innerscene, Grab3D, Quaternius)
 * packed into public/assets/cc0/ (meshopt + WebP, see scripts/cc0/pack.mjs).
 *
 * preloadCc0() starts right after the app mounts and streams the models in the background
 * (no upfront wait). When every file is in, cc0Generation() ticks once; the world folds
 * that into its rebuild keys so static layers (trees, terminal furniture, cargo shed)
 * swap to the models, while per-frame layers (vehicles, buses, people) pick them up on
 * their next frame. Once loaded, cc0Kit(id) hands
 * synchronous builders a "kit": the model baked into metres (+X forward, +Z the
 * model's right/front axis as noted per kit, ground at y = 0, centred on its footprint),
 * one geometry per material so callers can draw any number of copies with one
 * InstancedMesh per material. Until (or unless) a kit loads, every caller keeps its
 * procedural mesh, so tests and ?cc0=0 still draw the old look.
 */
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { sharedMat } from '../aircraft/pool'

export interface KitSpec {
  /** File stem under public/assets/cc0/. */
  file: string
  /** Yaw (radians) applied before baking so the model's length / front lines up with ours. */
  yaw?: number
  /** Keep only primitives whose material name matches. */
  include?: RegExp
  /** Drop primitives whose material name matches. */
  exclude?: RegExp
  /** Keep only triangles whose centroid x (model metres, after yaw) lies in [min, max]. */
  clipX?: [number, number]
  /** Keep the model's own height above ground (parts that hang in the air, like belts). */
  keepY?: boolean
  /** Scale X so the kit is exactly 1 m long (stretchable belts). */
  unitX?: boolean
  /** Bake material colours into vertex colours and draw as one PBR mesh (untextured foliage). */
  vertexColor?: boolean
  /** Material-name regex source -> replacement colour (texture dropped). */
  recolor?: Record<string, string>
  /** Material-name regex source -> colour multiplied over the kept texture (fabric dyes). */
  tint?: Record<string, string>
  /** Material-name regex source -> emissive strength (lenses, warning lights). */
  glow?: Record<string, number>
}

export const CC0_KITS = {
  city_bus: { file: 'city-bus', recolor: { '^paint$': '#1f6b4a' }, glow: { lens: 0.45 } },
  apron_bus: { file: 'city-bus', recolor: { '^paint$': '#e9ecea' }, glow: { lens: 0.45 } },
  fire_engine: { file: 'fire-engine', glow: { 'blue optical|red optical|amber optical': 0.55, 'clear optical': 0.35 } },
  tree_oak: { file: 'tree-oak', vertexColor: true },
  tree_maple: { file: 'tree-maple', vertexColor: true },
  tree_linden: { file: 'tree-linden', vertexColor: true },
  tree_oak_round: { file: 'tree-oak-round' },
  tree_palm: { file: 'tree-palm' },
  shrub: { file: 'shrub', vertexColor: true },
  // The source is two posts joined by a belt: keep the first post alone, and the belt with its
  // black edging as a 1 m strip we stretch post to post.
  queue_post: { file: 'queue-post', include: /steel/i, clipX: [-0.3, 0.3] },
  queue_belt: { file: 'queue-post', include: /belt|black/i, unitX: true, keepY: true, recolor: { belt: '#2c5f9e' } },
  // Fabric dyed to our gate palette (seatBlue / seatGrey) so lounges keep their colour.
  tandem_seats: { file: 'tandem-seats', tint: { 'textile|upholstery': '#5b98dc' } },
  tandem_seats_grey: { file: 'tandem-seats', tint: { 'textile|upholstery': '#9aa3ad' } },
  // Screen lit in our check-in blue so the kiosk reads as a live self-service unit.
  checkin_kiosk: { file: 'checkin-kiosk', recolor: { 'dark original interface': '#2f74c4' }, glow: { 'interface': 0.6 } },
  e_gate: { file: 'e-gate' },
  warehouse: { file: 'warehouse' },
} satisfies Record<string, KitSpec>

export type Cc0KitId = keyof typeof CC0_KITS

export const CC0_PEOPLE = [
  'worker',
  'casual',
  'businessman',
  'adventurer',
  'woman-a',
  'woman-b',
  'suit',
  'punk',
  'woman-casual',
  'woman-dress',
  'woman-tank',
] as const
export type Cc0PersonId = (typeof CC0_PEOPLE)[number]

export interface Cc0Part {
  geometry: THREE.BufferGeometry
  material: THREE.Material
}
export interface Cc0Kit {
  id: Cc0KitId
  parts: Cc0Part[]
  /** Baked size in metres: x length, y height, z width. */
  size: THREE.Vector3
  tris: number
}

const kits = new Map<Cc0KitId, Cc0Kit>()
/** Extra posed vehicles a capture rig adds through window.__cc0 (?playtest=1); empty in play. */
export const CC0_DEBUG_VEHICLES: Record<string, unknown>[] = []
const people = new Map<Cc0PersonId, GLTF>()
let ready: Promise<void> | null = null

/** CC0 models are on by default in the browser; `?cc0=0` keeps the procedural look for A/B checks. */
export function cc0Enabled(): boolean {
  if (typeof window === 'undefined' || typeof location === 'undefined') return false
  return new URLSearchParams(location.search).get('cc0') !== '0'
}

export function cc0Kit(id: Cc0KitId): Cc0Kit | null {
  return kits.get(id) ?? null
}

export function cc0PersonGltf(id: Cc0PersonId): GLTF | null {
  return people.get(id) ?? null
}

let generation = 0

/** 0 until the background load finishes, then 1. Fold into rebuild keys of static layers. */
export function cc0Generation(): number {
  return generation
}

export function cc0KitsLoaded(): number {
  return kits.size
}

function assetUrl(file: string): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
  return `${base}assets/cc0/${file}.glb`
}

/** Plain float copy of the attributes we draw (meshopt / quantized data is normalized ints). */
function floatGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const a = src.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined
    if (!a) continue
    const s = a.itemSize
    const out = new Float32Array(a.count * s)
    for (let i = 0; i < a.count; i++) {
      out[i * s] = a.getX(i)
      if (s > 1) out[i * s + 1] = a.getY(i)
      if (s > 2) out[i * s + 2] = a.getZ(i)
      if (s > 3) out[i * s + 3] = a.getW(i)
    }
    g.setAttribute(name, new THREE.BufferAttribute(out, s))
  }
  if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>))
  return g
}

function tuneMaterial(src: THREE.Material, spec: KitSpec, key: string): THREE.Material {
  const m = (src as THREE.MeshStandardMaterial).clone()
  const name = src.name || ''
  for (const [re, hex] of Object.entries(spec.recolor ?? {})) {
    if (new RegExp(re, 'i').test(name)) {
      m.map = null
      m.color.set(hex)
    }
  }
  for (const [re, hex] of Object.entries(spec.tint ?? {})) {
    if (new RegExp(re, 'i').test(name)) m.color.set(hex)
  }
  for (const [re, k] of Object.entries(spec.glow ?? {})) {
    if (new RegExp(re, 'i').test(name) && m.emissive) {
      m.emissive.copy(m.color)
      if (m.map) m.emissiveMap = m.map
      m.emissiveIntensity = k
    }
  }
  if (m.map) {
    m.map.anisotropy = 8
    m.map.colorSpace = THREE.SRGBColorSpace
  }
  if (m.transparent) {
    m.depthWrite = false
  }
  m.name = `cc0:${key}:${name}`
  // Shares the outdoor reflection probe and its night dimming with the aircraft.
  return sharedMat(m.name, () => m)
}

/** Triangles whose centroid x is inside [lo, hi], as a non-indexed geometry. */
function clipTriangles(src: THREE.BufferGeometry, lo: number, hi: number): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src
  const pos = g.getAttribute('position')
  const keep: number[] = []
  for (let t = 0; t < pos.count / 3; t++) {
    const cx = (pos.getX(t * 3) + pos.getX(t * 3 + 1) + pos.getX(t * 3 + 2)) / 3
    if (cx >= lo && cx <= hi) keep.push(t)
  }
  const out = new THREE.BufferGeometry()
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute
    const n = a.itemSize
    const arr = new Float32Array(keep.length * 3 * n)
    keep.forEach((t, i) => arr.set((a.array as Float32Array).subarray(t * 3 * n, t * 3 * n + 3 * n), i * 3 * n))
    out.setAttribute(name, new THREE.BufferAttribute(arr, n))
  }
  return out
}

const _c = new THREE.Color()
const NOOP = () => {}

function bakeKit(id: Cc0KitId, gltf: GLTF): Cc0Kit {
  const spec: KitSpec = CC0_KITS[id]
  const root = gltf.scene.clone(true)
  const holder = new THREE.Group()
  holder.add(root)
  holder.rotation.y = spec.yaw ?? 0
  holder.updateMatrixWorld(true)
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const mat = mats[0]
    const name = mat.name || ''
    if (spec.include && !spec.include.test(name)) return
    if (spec.exclude && spec.exclude.test(name)) return
    let g = floatGeometry(mesh.geometry)
    g.applyMatrix4(mesh.matrixWorld)
    if (spec.clipX) g = clipTriangles(g, spec.clipX[0], spec.clipX[1])
    if (spec.vertexColor) {
      _c.copy((mat as THREE.MeshStandardMaterial).color ?? _c.set(0xffffff))
      const n = g.getAttribute('position').count
      const col = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3)
      g.setAttribute('color', new THREE.BufferAttribute(col, 3))
      g.deleteAttribute('uv')
    }
    const list = byMat.get(mat) ?? []
    list.push(g)
    byMat.set(mat, list)
  })
  const parts: Cc0Part[] = []
  if (spec.vertexColor) {
    const all = [...byMat.values()].flat().map((g) => (g.index ? g : g))
    for (const g of all) if (!g.getAttribute('normal')) g.computeVertexNormals()
    const merged = mergeGeometries(all, false)
    if (merged) {
      const mat = sharedMat(`cc0:${id}:vc`, () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, name: `cc0:${id}:vc` }))
      parts.push({ geometry: merged, material: mat })
    }
  } else {
    for (const [mat, list] of byMat) {
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false)
      const material = tuneMaterial(mat, spec, id)
      if (merged) parts.push({ geometry: merged, material })
      else for (const g of list) parts.push({ geometry: g, material })
    }
  }
  const box = new THREE.Box3()
  for (const p of parts) {
    p.geometry.computeBoundingBox()
    box.union(p.geometry.boundingBox!)
  }
  const c = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const shift = new THREE.Matrix4().makeTranslation(-c.x, spec.keepY ? 0 : -box.min.y, -c.z)
  if (spec.unitX && size.x > 0) shift.premultiply(new THREE.Matrix4().makeScale(1 / size.x, 1, 1))
  let tris = 0
  for (const p of parts) {
    p.geometry.applyMatrix4(shift)
    p.geometry.computeBoundingBox()
    p.geometry.computeBoundingSphere()
    p.geometry.name = `cc0:${id}`
    tris += (p.geometry.index ? p.geometry.index.count : p.geometry.getAttribute('position').count) / 3
  }
  if (spec.unitX) size.x = 1
  // Kit data lives for the whole session and is shared by every copy; several scene
  // teardown paths dispose whatever they find, so the kit's own dispose is a no-op.
  for (const p of parts) {
    p.geometry.dispose = NOOP
    p.material.dispose = NOOP
  }
  return { id, parts, size, tris: Math.round(tris) }
}

// Capture / playtest hook: kit stats and extra posed vehicles for screenshots (?playtest=1 only).
// Installed even with ?cc0=0 so before/after captures can pose the same vehicles.
if (typeof window !== 'undefined' && typeof location !== 'undefined' && new URLSearchParams(location.search).get('playtest') === '1') {
  ;(window as unknown as { __cc0: unknown }).__cc0 = {
    kits: () => [...kits.values()].map((k) => ({ id: k.id, tris: k.tris, parts: k.parts.length, size: k.size.toArray().map((v) => +v.toFixed(2)) })),
    people: () => [...people.keys()],
    generation: () => generation,
    addVehicle: (v: Record<string, unknown>) => CC0_DEBUG_VEHICLES.push(v),
    clearVehicles: () => (CC0_DEBUG_VEHICLES.length = 0),
  }
}

/** Load every CC0 model once, in the background. Resolves (never rejects); missing files keep the procedural look. */
export function preloadCc0(): Promise<void> {
  if (ready) return ready
  if (!cc0Enabled()) return (ready = Promise.resolve())
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const files = new Map<string, Promise<GLTF | null>>()
  const fetchFile = (file: string) => {
    let p = files.get(file)
    if (!p) {
      p = loader.loadAsync(assetUrl(file)).catch((e) => {
        console.warn('[cc0] could not load', file, e)
        return null
      })
      files.set(file, p)
    }
    return p
  }
  const jobs: Promise<unknown>[] = []
  for (const id of Object.keys(CC0_KITS) as Cc0KitId[]) {
    jobs.push(
      fetchFile(CC0_KITS[id].file).then((g) => {
        if (g) kits.set(id, bakeKit(id, g))
      }),
    )
  }
  for (const id of CC0_PEOPLE) {
    jobs.push(
      fetchFile(`person-${id}`).then((g) => {
        if (g) people.set(id, g)
      }),
    )
  }
  const all = Promise.all(jobs).then(() => {
    if (kits.size || people.size) generation = 1
  })
  ready = all.catch((e) => console.warn('[cc0] preload failed', e))
  return ready
}

const _m = new THREE.Matrix4()

/** Static copies of a kit: one InstancedMesh per material, bounding sphere set so the group culls. */
export function kitInstances(
  kit: Cc0Kit,
  matrices: readonly THREE.Matrix4[],
  opts: { castShadow?: boolean; receiveShadow?: boolean; name?: string } = {},
): THREE.Group {
  const group = new THREE.Group()
  group.name = opts.name ?? `cc0:${kit.id}`
  if (!matrices.length) return group
  for (const p of kit.parts) {
    const mesh = new THREE.InstancedMesh(p.geometry, p.material, matrices.length)
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.castShadow = (opts.castShadow ?? true) && !p.material.transparent
    mesh.receiveShadow = opts.receiveShadow ?? true
    mesh.name = `${group.name}:${p.material.name}`
    mesh.userData.shared = true
    group.add(mesh)
  }
  return group
}

/** Moving copies of a kit (vehicles): grows by doubling, one InstancedMesh per material. */
export class KitFleet {
  readonly group = new THREE.Group()
  private meshes: THREE.InstancedMesh[] = []
  private cap = 0
  readonly kit: Cc0Kit
  private readonly castShadow: boolean
  constructor(kit: Cc0Kit, castShadow = true) {
    this.kit = kit
    this.castShadow = castShadow
    this.group.name = `cc0-fleet:${kit.id}`
  }
  private grow(n: number) {
    if (n <= this.cap) return
    this.cap = Math.max(8, 1 << Math.ceil(Math.log2(n)))
    for (const m of this.meshes) {
      m.removeFromParent()
      m.dispose()
    }
    this.meshes = this.kit.parts.map((p) => {
      const mesh = new THREE.InstancedMesh(p.geometry, p.material, this.cap)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.castShadow = this.castShadow && !p.material.transparent
      mesh.receiveShadow = true
      mesh.count = 0
      mesh.name = `cc0-fleet:${this.kit.id}:${p.material.name}`
      mesh.userData.shared = true
      this.group.add(mesh)
      return mesh
    })
  }
  /** Write all copies. `fit` maps kit metres onto the caller's model space (per-axis scale). */
  sync(world: readonly THREE.Matrix4[], fit?: THREE.Matrix4) {
    this.grow(world.length)
    for (const mesh of this.meshes) {
      world.forEach((w, i) => mesh.setMatrixAt(i, fit ? _m.multiplyMatrices(w, fit) : w))
      mesh.count = world.length
      mesh.instanceMatrix.needsUpdate = true
    }
  }
  dispose() {
    for (const m of this.meshes) m.dispose()
    this.meshes = []
    this.group.clear()
  }
}

/** Per-axis scale that maps a kit onto length x height x width metres. */
export function fitMatrix(kit: Cc0Kit, l: number, h: number, w: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeScale(l / kit.size.x, h / kit.size.y, w / kit.size.z)
}
