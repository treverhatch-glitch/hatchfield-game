// Hall and pax crowd. Bodies, uniforms, poses and LOD come from src/people
// (one InstancedMesh per part); this file maps sim agents onto it and keeps
// the thought-bubble layer.
import * as THREE from 'three'
import { PEOPLE_CAPACITY, PEOPLE_LOD } from '../../people/config'
import { PeopleRenderer, type PeopleAgent } from '../../people/renderer'
import type { PersonLook } from '../../people/types'
import { lookFor, personPose, poseFor, type Role } from './roles'
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
  /** set true once checked bags were dropped at check-in */
  bagsDropped?: boolean
  /** optional walk speed m/s, scales stride rate */
  speed?: number
}
export interface CrowdOptions {
  /** Instances per body part mesh; one person uses several parts. */
  capacity?: number
  /** World units per metre. Positions are in world units; bodies and bubbles scale with it. */
  unitsPerMeter?: number
  /** Metre distances: full -> simple body, simple body -> block. */
  lod?: [number, number]
  /** Metres past which nobody is drawn. */
  cull?: number
  camera?: THREE.Camera
}
export interface CrowdStats { visible: number; lod: [number, number, number]; culled: number; thoughts: number; drawCalls: number }

const CHECKED_DONE = /checked_in|dropped|security|airside|gate|board|seat|depart|reclaim_done|exit/
const WALK_SPEED = 1.25

export interface Crowd {
  readonly group: THREE.Group
  update(agents: CrowdAgent[], dtSec?: number, lite?: boolean): CrowdStats
  setCamera(cam: THREE.Camera): void
  showThought(id: string | number, t: Thought): THREE.Sprite
  hideThought(id: string | number): void
  readonly stats: CrowdStats
  dispose(): void
}

export function createCrowd(scene: THREE.Object3D, opts: CrowdOptions = {}): Crowd {
  const upm = opts.unitsPerMeter ?? 1
  const lod = { ...PEOPLE_LOD, nearDistance: opts.lod?.[0] ?? PEOPLE_LOD.nearDistance, midDistance: opts.lod?.[1] ?? PEOPLE_LOD.midDistance, farDistance: opts.cull ?? PEOPLE_LOD.farDistance }
  const renderer = new PeopleRenderer(scene, { capacity: opts.capacity ?? PEOPLE_CAPACITY, unitsPerMeter: upm, lod })
  const thoughts = new ThoughtLayer(upm)
  renderer.group.add(thoughts.group)
  let camera = opts.camera ?? null
  let time = 0

  const looks = new Map<string, { look: PersonLook; checked: boolean }>()
  const positions = new Map<string, THREE.Vector3>()
  const stats: CrowdStats = { visible: 0, lod: [0, 0, 0], culled: 0, thoughts: 0, drawCalls: 0 }
  const out: PeopleAgent[] = []

  function update(agents: CrowdAgent[], dt = 1 / 60, lite = false): CrowdStats {
    time += dt
    out.length = 0
    const seen = new Set<string>()
    for (const a of agents) {
      const id = String(a.id); seen.add(id)
      const x = Array.isArray(a.pos) ? a.pos[0] : a.pos.x
      const y = Array.isArray(a.pos) ? a.pos[1] : a.pos.y ?? 0
      const z = Array.isArray(a.pos) ? a.pos[2] : a.pos.z
      let pp = positions.get(id)
      if (!pp) positions.set(id, (pp = new THREE.Vector3(x, y, z)))
      const moving = (pp.x - x) ** 2 + (pp.z - z) ** 2 > 1e-6
      pp.set(x, y, z)
      const checked = (a.bagIds?.length ?? 0) > 0 && !a.bagsDropped && !CHECKED_DONE.test((a.state ?? '').toLowerCase())
      let entry = looks.get(id)
      if (!entry || entry.checked !== checked) { entry = { look: lookFor(id, a.role, checked), checked }; looks.set(id, entry) }
      const pose = poseFor(a.role, a.state, moving)
      out.push({
        id, look: entry.look, x, y, z, yaw: a.heading,
        pose: personPose(pose, entry.look),
        speed: pose === 'walk' ? (a.speed ?? WALK_SPEED) : 0,
      })
    }
    const s = renderer.update(out, camera, dt, lite)
    for (const id of positions.keys()) if (!seen.has(id)) { positions.delete(id); looks.delete(id) }
    thoughts.sync(time, (id) => positions.get(id))
    stats.lod = [s.near, s.mid, s.far]
    stats.visible = s.near + s.mid + s.far
    stats.culled = s.hidden
    stats.thoughts = thoughts.count
    stats.drawCalls = renderer.group.children.filter((c) => c instanceof THREE.InstancedMesh && c.count > 0).length + thoughts.count
    return stats
  }

  return {
    group: renderer.group, stats, update,
    setCamera: (c) => { camera = c },
    showThought: (id, t) => thoughts.show(String(id), t, time),
    hideThought: (id) => thoughts.hide(String(id)),
    dispose() { thoughts.dispose(); renderer.dispose() },
  }
}
