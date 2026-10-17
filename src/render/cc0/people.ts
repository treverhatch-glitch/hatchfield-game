/**
 * CC0 rigged people (Quaternius, public domain) drawn as instanced vertex-animation meshes.
 *
 * Each character's walk / idle / sit (and, for the ramp worker, an "interact" reach) is
 * skinned once on the CPU into a small float texture (one row block per frame). A shared
 * Lambert material reads the frame per instance, so a whole crowd of one character is a
 * single draw call with full animation, and the sim and the people LOD code are untouched:
 * PeopleRenderer just hands eligible agents here instead of emitting procedural parts.
 *
 * Who is eligible is a pure function of the look (never of the current pose), so a person
 * never swaps model when they sit down or stop: kids, bag carriers and most crew keep the
 * procedural body (it carries their bags, strollers, uniforms and tools).
 */
import * as THREE from 'three'
import { sharedMat } from '../aircraft/pool'
import type { AnimationClip } from 'three'
import type { PersonLook, PersonPose } from '../../people/types'
import { CC0_PEOPLE, cc0PersonGltf, type Cc0PersonId } from './library'

const TEX_W = 1024
const FRAMES = { walk: 16, idle: 8, sit: 1, act: 12 } as const
type Clip = keyof typeof FRAMES

/** Characters per passenger sheet (looks without a sheet use the whole passenger list). */
const BY_SHEET: Record<string, readonly Cc0PersonId[]> = {
  pax_business: ['businessman', 'suit', 'woman-dress', 'woman-b'],
  pax_tourist: ['casual', 'woman-casual', 'woman-tank', 'punk', 'woman-a'],
  pax_family: ['woman-a', 'woman-b', 'woman-dress', 'casual', 'woman-casual'],
  pax_backpacker: ['adventurer', 'punk', 'woman-tank'],
}
const PAX: readonly Cc0PersonId[] = ['casual', 'businessman', 'woman-a', 'woman-b', 'suit', 'punk', 'woman-casual', 'woman-dress', 'woman-tank']

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * The CC0 character for this person, or null to keep the procedural body. Depends only on
 * the id and look, so the choice is stable for the person's whole visit.
 */
export function cc0PersonFor(id: string, look: PersonLook): Cc0PersonId | null {
  if (look.age !== 'adult' && look.age !== 'teen') return null
  // Suitcases, carts and strollers are modelled on the procedural body, so those stay; a
  // briefcase is dropped in favour of the business characters.
  if (look.carry !== 'none' && look.carry !== 'briefcase') return null
  if (look.crew) return look.crew === 'ground' && !look.wands ? 'worker' : null
  if (look.backpack) return 'adventurer'
  if (look.carry === 'briefcase') return BY_SHEET.pax_business[hash(id) % BY_SHEET.pax_business.length]
  const list = (look.sheet && BY_SHEET[look.sheet]) || PAX
  return list[hash(id) % list.length]
}

/** Clip a pose plays on a CC0 body. */
export function cc0ClipFor(pose: PersonPose, hasAct: boolean): Clip {
  switch (pose) {
    case 'walk':
    case 'signal':
      return 'walk'
    case 'seated':
      return 'sit'
    case 'reach':
    case 'lift':
    case 'carry':
    case 'push':
    case 'kneel':
    case 'bagPull':
      return hasAct ? 'act' : 'idle'
    default:
      return 'idle'
  }
}

interface Baked {
  geometry: THREE.BufferGeometry
  pos: THREE.DataTexture
  nrm: THREE.DataTexture
  rows: number
  clips: Record<Clip, { start: number; count: number }>
  hasAct: boolean
  tris: number
}

const baked = new Map<Cc0PersonId, Baked | null>()

function findClip(clips: AnimationClip[], re: RegExp): AnimationClip | null {
  return clips.find((c) => re.test(c.name)) ?? null
}

const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _pq = new THREE.Quaternion()
const X = new THREE.Vector3(1, 0, 0)

/** Seated pose built from the idle pose: thighs forward, shins down (Quaternius rigs have no sit clip). */
function foldLegs(root: THREE.Object3D) {
  for (const side of ['L', 'R']) {
    const thigh = root.getObjectByName(`UpperLeg${side === 'L' ? 'L' : 'R'}`) ?? root.getObjectByName(`UpperLeg.${side}`)
    const shin = root.getObjectByName(`LowerLeg.${side}`) ?? root.getObjectByName(`LowerLeg${side}`)
    for (const [bone, angle] of [
      [thigh, -Math.PI * 0.47],
      [shin, Math.PI * 0.47],
    ] as const) {
      if (!bone || !bone.parent) continue
      root.updateMatrixWorld(true)
      bone.parent.getWorldQuaternion(_pq)
      bone.getWorldQuaternion(_q)
      _q.premultiply(new THREE.Quaternion().setFromAxisAngle(X, angle))
      bone.quaternion.copy(_pq.invert().multiply(_q))
    }
  }
  root.updateMatrixWorld(true)
}

function bake(id: Cc0PersonId): Baked | null {
  const gltf = cc0PersonGltf(id)
  if (!gltf) return null
  const root = gltf.scene
  const clips = gltf.animations
  const walk = findClip(clips, /walk$/i)
  const idle = findClip(clips, /\|(idle|man_idle|female_idle)$/i)
  if (!walk || !idle) return null
  const sitClip = findClip(clips, /sitting$/i)
  const act = id === 'worker' ? findClip(clips, /interact$/i) : null
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) meshes.push(m)
  })
  let V = 0
  for (const m of meshes) V += m.geometry.getAttribute('position').count
  const index: number[] = []
  const color = new Float32Array(V * 3)
  const vid = new Float32Array(V)
  let off = 0
  for (const m of meshes) {
    const g = m.geometry
    const n = g.getAttribute('position').count
    const c = ((Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1)
    for (let i = 0; i < n; i++) {
      color.set([c.r, c.g, c.b], (off + i) * 3)
      vid[off + i] = off + i
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) index.push(g.index.getX(i) + off)
    else for (let i = 0; i < n; i++) index.push(off + i)
    off += n
  }
  const rows = Math.ceil(V / TEX_W)
  const plan: { clip: Clip; src: AnimationClip | null; n: number }[] = [
    { clip: 'walk', src: walk, n: FRAMES.walk },
    { clip: 'idle', src: idle, n: FRAMES.idle },
    { clip: 'sit', src: sitClip ?? idle, n: FRAMES.sit },
  ]
  if (act) plan.push({ clip: 'act', src: act, n: FRAMES.act })
  const total = plan.reduce((s, p) => s + p.n, 0)
  const H = total * rows
  const posData = new Uint16Array(TEX_W * H * 4)
  const nrmData = new Uint8Array(TEX_W * H * 4)
  const mixer = new THREE.AnimationMixer(root)
  const frame = new Float32Array(V * 3)
  const tmp = new THREE.BufferGeometry()
  tmp.setIndex(index)
  const posAttr = new THREE.BufferAttribute(frame, 3)
  tmp.setAttribute('position', posAttr)
  let norm: { s: number; cx: number; cz: number; y0: number } | null = null
  const clipsOut = {} as Record<Clip, { start: number; count: number }>
  let f = 0
  const sample = (src: AnimationClip, t: number, fold: boolean) => {
    mixer.stopAllAction()
    const action = mixer.clipAction(src)
    action.reset().play()
    mixer.setTime(t)
    root.updateMatrixWorld(true)
    if (fold) foldLegs(root)
    let o = 0
    for (const m of meshes) {
      const sk = m as THREE.SkinnedMesh
      if (sk.isSkinnedMesh) sk.skeleton.update()
      const n = m.geometry.getAttribute('position').count
      for (let i = 0; i < n; i++) {
        m.getVertexPosition(i, _v)
        _v.applyMatrix4(m.matrixWorld)
        frame[(o + i) * 3] = _v.x
        frame[(o + i) * 3 + 1] = _v.y
        frame[(o + i) * 3 + 2] = _v.z
      }
      o += n
    }
  }
  const writeFrame = (feetToFloor: boolean) => {
    if (!norm) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity
      for (let i = 0; i < V; i++) {
        const x = frame[i * 3], y = frame[i * 3 + 1], z = frame[i * 3 + 2]
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z)
      }
      norm = { s: 1 / Math.max(1e-3, y1 - y0), cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, y0 }
    }
    let lift = norm.y0
    if (feetToFloor) {
      lift = Infinity
      for (let i = 0; i < V; i++) lift = Math.min(lift, frame[i * 3 + 1])
    }
    for (let i = 0; i < V; i++) {
      frame[i * 3] = (frame[i * 3] - norm.cx) * norm.s
      frame[i * 3 + 1] = (frame[i * 3 + 1] - lift) * norm.s
      frame[i * 3 + 2] = (frame[i * 3 + 2] - norm.cz) * norm.s
    }
    posAttr.needsUpdate = true
    tmp.computeVertexNormals()
    const nrm = tmp.getAttribute('normal')
    for (let i = 0; i < V; i++) {
      const row = f * rows + Math.floor(i / TEX_W)
      const k = (row * TEX_W + (i % TEX_W)) * 4
      posData[k] = THREE.DataUtils.toHalfFloat(frame[i * 3])
      posData[k + 1] = THREE.DataUtils.toHalfFloat(frame[i * 3 + 1])
      posData[k + 2] = THREE.DataUtils.toHalfFloat(frame[i * 3 + 2])
      posData[k + 3] = THREE.DataUtils.toHalfFloat(1)
      nrmData[k] = Math.round((nrm.getX(i) * 0.5 + 0.5) * 255)
      nrmData[k + 1] = Math.round((nrm.getY(i) * 0.5 + 0.5) * 255)
      nrmData[k + 2] = Math.round((nrm.getZ(i) * 0.5 + 0.5) * 255)
      nrmData[k + 3] = 255
    }
    f++
  }
  // Normalise on the first idle frame (standing height -> 1 m, feet at 0, centred).
  sample(idle, 0, false)
  writeFrame(false)
  f = 0
  for (const p of plan) {
    clipsOut[p.clip] = { start: f, count: p.n }
    const src = p.src!
    for (let i = 0; i < p.n; i++) {
      if (p.clip === 'sit') {
        sample(src, sitClip ? src.duration * 0.6 : 0, !sitClip)
        writeFrame(true)
      } else {
        sample(src, (i / p.n) * src.duration, false)
        writeFrame(false)
      }
    }
  }
  mixer.stopAllAction()
  const geometry = new THREE.BufferGeometry()
  const rest = new Float32Array(V * 3)
  geometry.setAttribute('position', new THREE.BufferAttribute(rest, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(V * 3).fill(0), 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3))
  geometry.setAttribute('vid', new THREE.BufferAttribute(vid, 1))
  geometry.setIndex(index)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 1)
  geometry.name = `cc0-person:${id}`
  const pos = new THREE.DataTexture(posData, TEX_W, H, THREE.RGBAFormat, THREE.HalfFloatType)
  const nrm = new THREE.DataTexture(nrmData, TEX_W, H, THREE.RGBAFormat, THREE.UnsignedByteType)
  for (const t of [pos, nrm]) {
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.needsUpdate = true
  }
  return { geometry, pos, nrm, rows, clips: clipsOut, hasAct: !!act, tris: index.length / 3 }
}

function bakedFor(id: Cc0PersonId): Baked | null {
  if (!baked.has(id)) {
    let b: Baked | null = null
    try {
      b = bake(id)
    } catch (e) {
      console.warn('[cc0] could not bake person', id, e)
    }
    baked.set(id, b)
  }
  return baked.get(id) ?? null
}

/** True once at least one CC0 character has loaded (browser, cc0 on). */
export function cc0PeopleReady(): boolean {
  return CC0_PEOPLE.some((id) => cc0PersonGltf(id))
}

const VAT_DECL = /* glsl */ `
uniform highp sampler2D vatPos;
uniform highp sampler2D vatNrm;
uniform int vatRows;
attribute float vid;
attribute vec3 iAnim;
vec3 vatP(float f) { int v = int(vid + 0.5); ivec2 c = ivec2(v % ${TEX_W}, int(f + 0.5) * vatRows + v / ${TEX_W}); return texelFetch(vatPos, c, 0).xyz; }
vec3 vatN(float f) { int v = int(vid + 0.5); ivec2 c = ivec2(v % ${TEX_W}, int(f + 0.5) * vatRows + v / ${TEX_W}); return texelFetch(vatNrm, c, 0).xyz * 2.0 - 1.0; }
`

function vatMaterial(b: Baked): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.vatPos = { value: b.pos }
    shader.uniforms.vatNrm = { value: b.nrm }
    shader.uniforms.vatRows = { value: b.rows }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VAT_DECL}`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(mix(vatN(iAnim.x), vatN(iAnim.y), iAnim.z));')
      .replace('#include <begin_vertex>', 'vec3 transformed = mix(vatP(iAnim.x), vatP(iAnim.y), iAnim.z);')
  }
  m.customProgramCacheKey = () => `cc0-vat-${b.rows}`
  m.name = 'cc0-person-vat'
  return m
}

/** Shadow-pass twin: same VAT vertex fetch, so the people cast real sun shadows. */
function vatDepthMaterial(b: Baked): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.vatPos = { value: b.pos }
    shader.uniforms.vatNrm = { value: b.nrm }
    shader.uniforms.vatRows = { value: b.rows }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VAT_DECL}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = mix(vatP(iAnim.x), vatP(iAnim.y), iAnim.z);')
  }
  m.customProgramCacheKey = () => `cc0-vat-depth-${b.rows}`
  m.name = 'cc0-person-vat-depth'
  return m
}

const mats = new Map<Cc0PersonId, THREE.Material>()
const depthMats = new Map<Cc0PersonId, THREE.MeshDepthMaterial>()

interface Slot {
  mesh: THREE.InstancedMesh
  anim: THREE.InstancedBufferAttribute
  baked: Baked
  n: number
}

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _yq = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)

/** One PeopleRenderer's CC0 bodies: an instanced mesh per character, rewritten every frame. */
export class Cc0PeopleLayer {
  readonly group = new THREE.Group()
  private slots = new Map<Cc0PersonId, Slot>()
  private tris = 0

  constructor() {
    this.group.name = 'people-cc0'
  }

  begin() {
    for (const s of this.slots.values()) s.n = 0
    this.tris = 0
  }

  private slot(id: Cc0PersonId): Slot | null {
    const hit = this.slots.get(id)
    if (hit) return hit
    const b = bakedFor(id)
    if (!b) return null
    let mat = mats.get(id)
    if (!mat) {
      // Shared registry: picks up the outdoor reflection probe and night dimming like the vehicles.
      mat = sharedMat(`cc0-person-vat:${id}`, () => vatMaterial(b))
      mats.set(id, mat)
    }
    let depth = depthMats.get(id)
    if (!depth) {
      depth = vatDepthMaterial(b)
      depthMats.set(id, depth)
    }
    const s = this.makeSlot(b, mat, 32, depth)
    this.slots.set(id, s)
    return s
  }

  private makeSlot(b: Baked, mat: THREE.Material, cap: number, depth: THREE.Material): Slot {
    const geometry = b.geometry.clone()
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
    anim.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('iAnim', anim)
    const mesh = new THREE.InstancedMesh(geometry, mat, cap)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.customDepthMaterial = depth
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.count = 0
    mesh.name = `people-cc0:${b.geometry.name}`
    this.group.add(mesh)
    return { mesh, anim, baked: b, n: 0 }
  }

  /**
   * Draw one person. `phase` is the renderer's per-person cycle (0..1), `heightM` the
   * person's standing height in metres, `upm` world units per metre. False if unavailable.
   */
  push(id: Cc0PersonId, pose: PersonPose, phase: number, x: number, y: number, z: number, yaw: number, heightM: number, upm: number): boolean {
    let s = this.slot(id)
    if (!s) return false
    if (s.n >= s.mesh.instanceMatrix.count) {
      const old = s
      const cap = old.mesh.instanceMatrix.count * 2
      const next = this.makeSlot(old.baked, old.mesh.material as THREE.Material, cap, old.mesh.customDepthMaterial!)
      for (let i = 0; i < old.n; i++) {
        old.mesh.getMatrixAt(i, _m)
        next.mesh.setMatrixAt(i, _m)
        next.anim.setXYZ(i, old.anim.getX(i), old.anim.getY(i), old.anim.getZ(i))
      }
      next.n = old.n
      old.mesh.removeFromParent()
      old.mesh.geometry.dispose()
      old.mesh.dispose()
      this.slots.set(id, next)
      s = next
    }
    const clip = s.baked.clips[cc0ClipFor(pose, s.baked.hasAct)]
    const fpos = (((phase % 1) + 1) % 1) * clip.count
    const a = Math.floor(fpos) % clip.count
    const b = (a + 1) % clip.count
    s.anim.setXYZ(s.n, clip.start + a, clip.start + b, fpos - Math.floor(fpos))
    _yq.setFromAxisAngle(UP, yaw)
    _m.compose(_p.set(x, y, z), _yq, _s.setScalar(heightM * upm))
    s.mesh.setMatrixAt(s.n, _m)
    s.n++
    this.tris += s.baked.tris
    return true
  }

  end() {
    for (const s of this.slots.values()) {
      s.mesh.count = s.n
      s.mesh.instanceMatrix.needsUpdate = true
      s.anim.needsUpdate = true
    }
  }

  get triangles(): number {
    return this.tris
  }

  dispose() {
    for (const s of this.slots.values()) {
      s.mesh.geometry.dispose()
      s.mesh.dispose()
    }
    this.slots.clear()
    this.group.removeFromParent()
  }
}
