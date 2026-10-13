// Instanced crowd renderer. One InstancedMesh per LOD tier + one per prop type,
// so 5,000 people cost ~8 draw calls. Limb animation runs in the vertex shader.
import * as THREE from 'three'
import { buildPersonGeometry, buildPropGeometry, type PropKind } from './geometry'
import { createPeopleMaterial } from './material'
import { lookFor, poseFor, POSE_CODE, type Look, type Role } from './roles'
import { ThoughtLayer, type Thought } from './thoughts'

export type Vec3Like = { x: number; y?: number; z: number } | [number, number, number]
export interface CrowdAgent {
  id: string | number
  role: Role
  pos: Vec3Like
  /** radians around +Y; 0 faces +Z, PI/2 faces +X */
  heading: number
  state?: string
  bagIds?: Array<string | number>
  /** set true once checked bags were dropped at check-in; hides the checked bag */
  bagsDropped?: boolean
  /** optional walk speed m/s, scales stride rate */
  speed?: number
}
export interface CrowdOptions {
  capacity?: number
  /** distance thresholds for LOD0->1 and LOD1->2; beyond `cull` people are not drawn */
  lod?: [number, number]
  cull?: number
  camera?: THREE.Camera
}
export interface CrowdStats { visible: number; lod: [number, number, number]; props: Record<PropKind, number>; culled: number; thoughts: number; drawCalls: number }

const CHECKED_DONE = /checked_in|dropped|security|airside|gate|board|seat|depart|reclaim_done|exit/
const PROPS: PropKind[] = ['backpack', 'rolling', 'checked', 'desk', 'cap']

export interface Crowd {
  readonly group: THREE.Group
  update(agents: CrowdAgent[], dtSec?: number): CrowdStats
  setCamera(cam: THREE.Camera): void
  showThought(id: string | number, t: Thought): THREE.Sprite
  hideThought(id: string | number): void
  readonly stats: CrowdStats
  dispose(): void
}

export function createCrowd(scene: THREE.Object3D, opts: CrowdOptions = {}): Crowd {
  const cap = opts.capacity ?? 6000
  const [lod1, lod2] = opts.lod ?? [35, 110]
  const cull = opts.cull ?? 400
  let camera = opts.camera
  const time = { value: 0 }
  const group = new THREE.Group(); group.name = 'people'
  const mat = createPeopleMaterial(time)

  const tiers = ([0, 1, 2] as const).map((t) => {
    const g = buildPersonGeometry(t)
    const iAnim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4)
    const iColA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
    const iColB = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
    const iShape = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
    for (const a of [iAnim, iColA, iColB, iShape]) a.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('iAnim', iAnim); g.setAttribute('iColA', iColA); g.setAttribute('iColB', iColB); g.setAttribute('iShape', iShape)
    const mesh = new THREE.InstancedMesh(g, mat, cap)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false; mesh.count = 0; mesh.name = `people-lod${t}`
    group.add(mesh)
    return { mesh, iAnim, iColA, iColB, iShape }
  })
  const propMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const props = Object.fromEntries(PROPS.map((k) => {
    const m = new THREE.InstancedMesh(buildPropGeometry(k), propMat, cap)
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; m.name = `people-prop-${k}`
    m.setColorAt(0, new THREE.Color(1, 1, 1)); m.instanceColor!.setUsage(THREE.DynamicDrawUsage)
    group.add(m); return [k, m]
  })) as Record<PropKind, THREE.InstancedMesh>
  const thoughts = new ThoughtLayer(); group.add(thoughts.group)
  scene.add(group)

  const looks = new Map<string, Look>()
  const positions = new Map<string, THREE.Vector3>()
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1)
  const p = new THREE.Vector3(), camPos = new THREE.Vector3(), col = new THREE.Color()
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere(new THREE.Vector3(), 1.2)
  const BAG_COLS = [0x1f2937, 0x7f1d1d, 0x1e3a8a, 0x065f46, 0x6b21a8, 0x9a3412]
  const stats: CrowdStats = { visible: 0, lod: [0, 0, 0], props: { backpack: 0, rolling: 0, checked: 0, desk: 0, cap: 0 }, culled: 0, thoughts: 0, drawCalls: 0 }

  function addProp(k: PropKind, colorHex: number) {
    const m = props[k], i = stats.props[k]++
    m.setMatrixAt(i, m4); m.setColorAt(i, col.setHex(colorHex))
  }

  function update(agents: CrowdAgent[], dt = 1 / 60): CrowdStats {
    time.value += dt
    stats.lod = [0, 0, 0]; stats.culled = 0; for (const k of PROPS) stats.props[k] = 0
    let haveCam = false
    if (camera) {
      camera.updateMatrixWorld(); camera.getWorldPosition(camPos)
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv); haveCam = true
    }
    const seen = new Set<string>()
    for (const a of agents) {
      const id = String(a.id); seen.add(id)
      let look = looks.get(id)
      if (!look) { look = lookFor(id, a.role); looks.set(id, look) }
      if (Array.isArray(a.pos)) p.set(a.pos[0], a.pos[1], a.pos[2]); else p.set(a.pos.x, a.pos.y ?? 0, a.pos.z)
      let pp = positions.get(id); if (!pp) positions.set(id, (pp = new THREE.Vector3()))
      const moving = pp.distanceToSquared(p) > 1e-6; pp.copy(p)
      let tier = 0
      if (haveCam) {
        const d = camPos.distanceTo(p)
        sphere.center.copy(p).setY(p.y + 0.9)
        if (d > cull || !frustum.intersectsSphere(sphere)) { stats.culled++; continue }
        tier = d < lod1 ? 0 : d < lod2 ? 1 : 2
      }
      const T = tiers[tier], i = stats.lod[tier]++
      q.setFromAxisAngle(up, a.heading); m4.compose(p, q, one)
      T.mesh.setMatrixAt(i, m4)
      const pose = poseFor(a.role, a.state, moving)
      const pulling = pose === 'walk' && a.role === 'passenger' && look.carry === 'rolling'
      T.iAnim.setXYZW(i, look.phase, pose === 'walk' ? (a.speed ? a.speed * 1.35 : 1.8) : 0.6, POSE_CODE[pose], pulling ? 1 : 0)
      T.iColA.setXYZ(i, ...look.top); T.iColB.setXYZ(i, ...look.bottom); T.iShape.setXYZ(i, look.width, look.height, look.skin)
      if (tier === 2) continue
      // props share the person's transform (seated people drop props on the floor/desk)
      const seated = pose === 'seated' || pose === 'working'
      if (a.role === 'passenger') {
        if (look.carry === 'backpack' && !seated) addProp('backpack', 0x334155)
        if (look.carry === 'rolling') addProp('rolling', BAG_COLS[hashBag(id) % BAG_COLS.length])
        const hasChecked = (a.bagIds?.length ?? 0) > 0 && !a.bagsDropped && !CHECKED_DONE.test((a.state ?? '').toLowerCase())
        if (hasChecked) addProp('checked', BAG_COLS[(hashBag(id) + 3) % BAG_COLS.length])
      } else {
        if (look.cap) addProp('cap', 0x0f172a)
        if (a.role === 'researcher' && seated) addProp('desk', 0xe5e7eb)
      }
    }
    for (const t of tiers) {
      t.mesh.count = stats.lod[tiers.indexOf(t)]
      t.mesh.instanceMatrix.needsUpdate = true
      for (const at of [t.iAnim, t.iColA, t.iColB, t.iShape]) { at.needsUpdate = true; at.addUpdateRange(0, t.mesh.count * at.itemSize) }
    }
    for (const k of PROPS) { const m = props[k]; m.count = stats.props[k]; m.instanceMatrix.needsUpdate = true; m.instanceColor!.needsUpdate = true }
    for (const id of positions.keys()) if (!seen.has(id)) { positions.delete(id); looks.delete(id) }
    thoughts.sync(time.value, (id) => positions.get(id))
    stats.visible = stats.lod[0] + stats.lod[1] + stats.lod[2]
    stats.thoughts = thoughts.count
    stats.drawCalls = tiers.filter((t) => t.mesh.count).length + PROPS.filter((k) => props[k].count).length + thoughts.count
    return stats
  }
  function hashBag(id: string) { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h) }

  return {
    group, stats, update,
    setCamera: (c) => { camera = c },
    showThought: (id, t) => thoughts.show(String(id), t, time.value),
    hideThought: (id) => thoughts.hide(String(id)),
    dispose() {
      scene.remove(group); thoughts.dispose(); mat.dispose(); propMat.dispose()
      for (const t of tiers) { t.mesh.geometry.dispose(); t.mesh.dispose() }
      for (const k of PROPS) { props[k].geometry.dispose(); props[k].dispose() }
    },
  }
}
