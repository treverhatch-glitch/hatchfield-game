/**
 * Ground crew as one InstancedMesh per body part, plus a dot mesh for the
 * middle distance. Limb poses are instance rotations. Far crew are not drawn.
 */
import * as THREE from 'three'
import type { CrewPerson, CrewProp, CrewScene } from '../../ramp/present.ts'
import type { CrewPose, CrewRole } from '../../ramp/crewConfig.ts'
import { WORLD_PER_METER } from '../aircraft/specs.ts'
import { assignCrewLod, type CrewTier } from './lod.ts'

export interface CrewDrawStats {
  full: number
  dots: number
  hidden: number
  props: number
}

interface PartDef {
  name: string
  w: number
  h: number
  d: number
  pivot: [number, number, number]
  hang: number
  color: (role: CrewRole) => number
}

const HI_VIS = 0xf5c400
const HI_VIS_B = 0xf97316
const NAVY = 0x1e293b
const SKIN = 0xd7a57a

const PARTS: PartDef[] = [
  { name: 'torso', w: 0.4, h: 0.56, d: 0.22, pivot: [0, 1.18, 0], hang: 0, color: (role) => (role === 'driver' ? HI_VIS : HI_VIS_B) },
  { name: 'head', w: 0.22, h: 0.24, d: 0.22, pivot: [0, 1.62, 0], hang: 0, color: () => SKIN },
  { name: 'armL', w: 0.1, h: 0.5, d: 0.1, pivot: [-0.26, 1.4, 0], hang: 0.25, color: (role) => (role === 'driver' ? HI_VIS : HI_VIS_B) },
  { name: 'armR', w: 0.1, h: 0.5, d: 0.1, pivot: [0.26, 1.4, 0], hang: 0.25, color: (role) => (role === 'driver' ? HI_VIS : HI_VIS_B) },
  { name: 'legL', w: 0.12, h: 0.78, d: 0.12, pivot: [-0.1, 0.86, 0], hang: 0.39, color: () => NAVY },
  { name: 'legR', w: 0.12, h: 0.78, d: 0.12, pivot: [0.1, 0.86, 0], hang: 0.39, color: () => NAVY },
]

const PROP_COLOR: Record<CrewProp['kind'], number> = {
  hose: 0x1f2937,
  bar: 0xf5c400,
  belt: 0x4b5563,
  bag: 0x6a4328,
  cart: 0xd8dee6,
}

const _yaw = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)
const _pos = new THREE.Vector3()
const _scale = new THREE.Vector3(WORLD_PER_METER, WORLD_PER_METER, WORLD_PER_METER)
const _person = new THREE.Matrix4()
const _pivot = new THREE.Matrix4()
const _spin = new THREE.Matrix4()
const _drop = new THREE.Matrix4()
const _local = new THREE.Matrix4()
const _final = new THREE.Matrix4()
const _color = new THREE.Color()
const _cam = new THREE.Vector3()

function limbAngle(part: string, pose: CrewPose, phase: number): number {
  const swing = Math.sin(phase)
  if (pose === 'walk') {
    if (part === 'legL') return swing * 0.55
    if (part === 'legR') return -swing * 0.55
    if (part === 'armL') return -swing * 0.45
    if (part === 'armR') return swing * 0.45
  }
  if (pose === 'reach') {
    if (part === 'armL' || part === 'armR') return 1.15
  }
  if (pose === 'seated') {
    if (part === 'legL' || part === 'legR') return 1.25
    if (part === 'armL' || part === 'armR') return 0.35
  }
  return 0
}

export class CrewFigures {
  readonly group = new THREE.Group()
  readonly stats: CrewDrawStats = { full: 0, dots: 0, hidden: 0, props: 0 }
  private readonly parts: { mesh: THREE.InstancedMesh; def: PartDef }[]
  private readonly dots: THREE.InstancedMesh
  private readonly props: THREE.InstancedMesh
  private readonly bars: THREE.InstancedMesh
  private readonly phases = new Map<string, number>()
  private readonly mat: THREE.MeshLambertMaterial

  private readonly cap: number

  constructor(parent: THREE.Object3D, capacity = 96) {
    this.cap = capacity
    this.group.name = 'ground-crew'
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff })
    this.parts = PARTS.map((def) => {
      const geo = new THREE.BoxGeometry(def.w, def.h, def.d)
      const mesh = new THREE.InstancedMesh(geo, this.mat, capacity)
      mesh.name = `crew-${def.name}`
      mesh.frustumCulled = false
      mesh.count = 0
      mesh.castShadow = false
      mesh.receiveShadow = false
      this.group.add(mesh)
      return { mesh, def }
    })
    const dotGeo = new THREE.BoxGeometry(0.42, 0.9, 0.42)
    dotGeo.translate(0, 0.7, 0)
    this.dots = new THREE.InstancedMesh(dotGeo, this.mat, capacity)
    this.dots.name = 'crew-dot'
    this.dots.frustumCulled = false
    this.dots.count = 0
    this.group.add(this.dots)
    const propGeo = new THREE.BoxGeometry(1, 0.08, 0.08)
    this.props = new THREE.InstancedMesh(propGeo, this.mat, capacity)
    this.props.name = 'crew-prop'
    this.props.frustumCulled = false
    this.props.count = 0
    this.group.add(this.props)
    const barGeo = new THREE.BoxGeometry(0.16, 1, 0.08)
    barGeo.translate(0, 0.5, 0)
    this.bars = new THREE.InstancedMesh(barGeo, this.mat, capacity)
    this.bars.name = 'crew-bar'
    this.bars.frustumCulled = false
    this.bars.count = 0
    this.group.add(this.bars)
    parent.add(this.group)
  }

  update(
    scene: CrewScene,
    camera: THREE.Camera,
    dt: number,
    lite: boolean,
    toWorld: (c: number, r: number, y: number) => THREE.Vector3,
  ): CrewDrawStats {
    _scale.set(WORLD_PER_METER, WORLD_PER_METER, WORLD_PER_METER)
    camera.getWorldPosition(_cam)
    const points = scene.people.map((person) => {
      const at = toWorld(person.c, person.r, person.alt * WORLD_PER_METER)
      return { id: person.id, x: at.x, y: at.y, z: at.z, person }
    })
    const picks = assignCrewLod(points, _cam, lite)
    const tier = new Map<string, CrewTier>(picks.map((pick) => [pick.id, pick.tier]))
    const seen = new Set<string>()
    let full = 0
    let dots = 0
    let hidden = 0
    const counts = PARTS.map(() => 0)
    for (const row of points) {
      seen.add(row.id)
      const which = tier.get(row.id) ?? 'hide'
      if (which === 'hide') {
        hidden++
        continue
      }
      let phase = this.phases.get(row.id) ?? 0
      if (row.person.pose === 'walk') phase += Math.max(0, dt) * 7
      this.phases.set(row.id, phase)
      _pos.set(row.x, row.y, row.z)
      _yaw.setFromAxisAngle(_up, -row.person.heading)
      _person.compose(_pos, _yaw, _scale)
      if (which === 'dot') {
        this.dots.setMatrixAt(dots, _person)
        this.dots.setColorAt(dots, _color.setHex(row.person.role === 'driver' ? HI_VIS : HI_VIS_B))
        dots++
        continue
      }
      for (let p = 0; p < this.parts.length; p++) {
        const slot = this.parts[p]
        const i = counts[p]++
        this.writePart(slot.mesh, slot.def, i, row.person, phase)
      }
      full++
    }
    for (const id of this.phases.keys()) if (!seen.has(id)) this.phases.delete(id)
    for (let p = 0; p < this.parts.length; p++) {
      const mesh = this.parts[p].mesh
      mesh.count = counts[p]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    this.dots.count = dots
    this.dots.instanceMatrix.needsUpdate = true
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true
    const propCount = this.writeProps(scene, toWorld, camera, lite)
    this.stats.full = full
    this.stats.dots = dots
    this.stats.hidden = hidden
    this.stats.props = propCount
    return this.stats
  }

  private writePart(mesh: THREE.InstancedMesh, def: PartDef, index: number, person: CrewPerson, phase: number) {
    const angle = limbAngle(def.name, person.pose, phase)
    _pivot.makeTranslation(def.pivot[0], def.pivot[1], def.pivot[2])
    _spin.makeRotationZ(angle)
    _drop.makeTranslation(0, -def.hang, 0)
    _local.multiplyMatrices(_spin, _drop)
    _local.premultiply(_pivot)
    _final.multiplyMatrices(_person, _local)
    mesh.setMatrixAt(index, _final)
    mesh.setColorAt(index, _color.setHex(def.color(person.role)))
  }

  private writeProps(
    scene: CrewScene,
    toWorld: (c: number, r: number, y: number) => THREE.Vector3,
    camera: THREE.Camera,
    lite: boolean,
  ): number {
    camera.getWorldPosition(_cam)
    let n = 0
    let bars = 0
    for (const prop of scene.props) {
      const at = toWorld(prop.c, prop.r, prop.alt * WORLD_PER_METER)
      const distance = Math.hypot(at.x - _cam.x, at.y - _cam.y, at.z - _cam.z)
      if (lite || distance > 38) continue
      if (prop.kind === 'bar') {
        if (bars + 2 > this.cap) continue
        _pos.set(at.x, at.y, at.z)
        _yaw.identity()
        _scale.set(WORLD_PER_METER * 2.4, WORLD_PER_METER * Math.max(0.05, prop.length), WORLD_PER_METER * 2.2)
        _person.compose(_pos, _yaw, _scale)
        this.bars.setMatrixAt(bars, _person)
        this.bars.setColorAt(bars, _color.setHex(0x3f3f46))
        bars++
        const fill = Math.max(0.04, prop.fill)
        _scale.set(WORLD_PER_METER, WORLD_PER_METER * prop.length * fill, WORLD_PER_METER * 0.9)
        _person.compose(_pos, _yaw, _scale)
        this.bars.setMatrixAt(bars, _person)
        this.bars.setColorAt(bars, _color.setHex(0xf5c400))
        bars++
        continue
      }
      if (n >= this.cap) continue
      const long = prop.kind === 'bag' || prop.kind === 'cart' ? prop.length : Math.max(0.15, prop.length)
      const tall = prop.kind === 'bag' ? 0.4 : prop.kind === 'cart' ? 0.7 : prop.kind === 'hose' || prop.kind === 'belt' ? 0.18 : 0.08
      const wide = prop.kind === 'bag' ? 0.32 : prop.kind === 'belt' ? 0.55 : prop.kind === 'cart' ? 0.55 : prop.kind === 'hose' ? 0.18 : 0.08
      _pos.set(at.x, at.y, at.z)
      _yaw.setFromAxisAngle(_up, -prop.heading)
      _scale.set(WORLD_PER_METER * long, WORLD_PER_METER * tall, WORLD_PER_METER * wide)
      _person.compose(_pos, _yaw, _scale)
      this.props.setMatrixAt(n, _person)
      const hex = prop.kind === 'bag' ? (prop.fill > 0.6 ? 0x2f4a6a : 0x6a4328) : PROP_COLOR[prop.kind]
      this.props.setColorAt(n, _color.setHex(hex))
      n++
    }
    this.props.count = n
    this.props.instanceMatrix.needsUpdate = true
    if (this.props.instanceColor) this.props.instanceColor.needsUpdate = true
    this.bars.count = bars
    this.bars.instanceMatrix.needsUpdate = true
    if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true
    return n + bars
  }

  dispose() {
    this.group.removeFromParent()
    this.mat.dispose()
    for (const slot of this.parts) {
      slot.mesh.geometry.dispose()
      slot.mesh.dispose()
    }
    this.dots.geometry.dispose()
    this.dots.dispose()
    this.props.geometry.dispose()
    this.props.dispose()
    this.bars.geometry.dispose()
    this.bars.dispose()
    this.phases.clear()
  }
}
