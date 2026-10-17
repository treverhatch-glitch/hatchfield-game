/**
 * Ground crew: detailed bodies come from src/people (instanced per part),
 * plus a dot mesh for the middle distance. Far crew are not drawn.
 */
import * as THREE from 'three'
import type { CrewProp, CrewScene } from '../../ramp/present.ts'
import type { CrewRole, CrewService } from '../../ramp/crewConfig.ts'
import { crewAgent } from '../../people/crewAdapter.ts'
import { PeopleRenderer, type PeopleAgent } from '../../people/renderer.ts'
import { WORLD_PER_METER } from '../aircraft/specs.ts'
import { assignCrewLod, type CrewTier } from './lod.ts'
import { LINE_LOOK } from '../../ramp/crewConfig.ts'

export interface CrewDrawStats {
  full: number
  dots: number
  hidden: number
  props: number
}

const HI_VIS = 0xf5c400
const HI_VIS_B = 0xf97316
const WALKER = 0x16a34a
const PAX = 0x2563eb

function vest(role: CrewRole, service: CrewService): number {
  if (role === 'pax') return PAX
  if (role === 'walker') return WALKER
  if (service === 'fuel') return 0xe53e3e
  if (role === 'driver') return HI_VIS
  return HI_VIS_B
}

const PROP_COLOR: Record<CrewProp['kind'], number> = {
  hose: 0x1f2937,
  cable: 0x111111,
  chock: 0xf5c400,
  cone: 0xf97316,
  bar: 0xf5c400,
  belt: 0x4b5563,
  bag: 0x6a4328,
  cart: 0xd8dee6,
  lift: 0xe7edf2,
  stairs: 0xc5ced6,
}

export const BAG_HEX = [0x2f4a6a, 0x6a4328, 0x7f1d1d, 0x1f2937, 0x065f46, 0x9a3412] as const

/** Suitcases keep one colour from cart to hold; bin bags are black. */
function bagColor(id: string): number {
  if (id.endsWith(':binbag')) return 0x18181b
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return BAG_HEX[Math.abs(h) % BAG_HEX.length]
}

const _yaw = new THREE.Quaternion()
const _tilt = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)
const _fwdAxis = new THREE.Vector3(0, 0, 1)
const _pos = new THREE.Vector3()
const _scale = new THREE.Vector3(WORLD_PER_METER, WORLD_PER_METER, WORLD_PER_METER)
const _person = new THREE.Matrix4()
const _color = new THREE.Color()
const _cam = new THREE.Vector3()

export class CrewFigures {
  readonly group = new THREE.Group()
  readonly stats: CrewDrawStats = { full: 0, dots: 0, hidden: 0, props: 0 }
  private readonly people: PeopleRenderer
  private readonly dots: THREE.InstancedMesh
  private readonly stripes: THREE.InstancedMesh
  private readonly props: THREE.InstancedMesh
  private readonly bars: THREE.InstancedMesh
  private readonly mat: THREE.MeshLambertMaterial

  private readonly cap: number

  constructor(parent: THREE.Object3D, capacity = 96) {
    this.cap = capacity
    this.group.name = 'ground-crew'
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff })
    this.people = new PeopleRenderer(this.group, { capacity, unitsPerMeter: WORLD_PER_METER })
    const dotGeo = new THREE.BoxGeometry(0.42, 0.9, 0.42)
    dotGeo.translate(0, 0.7, 0)
    this.dots = new THREE.InstancedMesh(dotGeo, this.mat, capacity)
    this.dots.name = 'crew-dot'
    this.dots.frustumCulled = false
    this.dots.count = 0
    this.group.add(this.dots)

    const stripeGeo = new THREE.BoxGeometry(0.43, 0.05, 0.43)
    stripeGeo.translate(0, 0.7, 0)
    this.stripes = new THREE.InstancedMesh(stripeGeo, this.mat, capacity)
    this.stripes.name = 'crew-stripe'
    this.stripes.frustumCulled = false
    this.stripes.count = 0
    this.group.add(this.stripes)

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
    const agents: PeopleAgent[] = []
    let dots = 0
    let hidden = 0
    for (const row of points) {
      const which = tier.get(row.id) ?? 'hide'
      if (which === 'hide') {
        hidden++
        continue
      }
      if (which === 'full') {
        agents.push(crewAgent(row.person, row))
        continue
      }
      _pos.set(row.x, row.y, row.z)
      _yaw.setFromAxisAngle(_up, -row.person.heading)
      _person.compose(_pos, _yaw, _scale)
      this.dots.setMatrixAt(dots, _person)
      this.dots.setColorAt(dots, _color.setHex(vest(row.person.role, row.person.service)))
      this.stripes.setMatrixAt(dots, _person)
      this.stripes.setColorAt(dots, _color.setHex(0xcccccc))
      dots++
    }
    this.people.update(agents, camera, dt, lite)
    const full = agents.length
    this.dots.count = dots
    this.dots.instanceMatrix.needsUpdate = true
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true
    this.stripes.count = dots
    this.stripes.instanceMatrix.needsUpdate = true
    if (this.stripes.instanceColor) this.stripes.instanceColor.needsUpdate = true
    const propCount = this.writeProps(scene, toWorld, camera, lite)
    this.stats.full = full
    this.stats.dots = dots
    this.stats.hidden = hidden
    this.stats.props = propCount
    return this.stats
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
      const line = prop.kind === 'hose' ? LINE_LOOK.hoseWidth : prop.kind === 'cable' ? LINE_LOOK.cableWidth : 0
      // Hose and cable segments overlap a little so the sagging run reads as one line.
      const small = prop.kind === 'cone' ? 0.3 : prop.kind === 'chock' ? 0.22 : 0
      const long = small ? (prop.kind === 'chock' ? prop.length : small) : prop.kind === 'bag' || prop.kind === 'cart' || prop.kind === 'lift' ? prop.length : prop.kind === 'stairs' ? 1.1 : line ? prop.length + line : Math.max(0.15, prop.length)
      const tall = prop.kind === 'cone' ? 0.7 : prop.kind === 'chock' ? 0.2 : prop.kind === 'bag' ? 0.4 : prop.kind === 'cart' ? 0.7 : prop.kind === 'lift' ? 0.18 : prop.kind === 'stairs' ? prop.length : line ? line : prop.kind === 'belt' ? 0.18 : 0.08
      const wide = small ? small : prop.kind === 'bag' ? 0.32 : prop.kind === 'belt' ? 0.55 : prop.kind === 'cart' ? 0.55 : prop.kind === 'lift' ? 1.3 : prop.kind === 'stairs' ? 2.4 : line ? line : 0.08
      // Prop boxes are centred; a cone stands on the apron.
      _pos.set(at.x, at.y + (prop.kind === 'cone' ? tall / 2 : 0) * WORLD_PER_METER, at.z)
      _yaw.setFromAxisAngle(_up, -prop.heading)
      if (prop.pitch) _yaw.multiply(_tilt.setFromAxisAngle(_fwdAxis, prop.pitch))
      _scale.set(WORLD_PER_METER * long, WORLD_PER_METER * tall, WORLD_PER_METER * wide)
      _person.compose(_pos, _yaw, _scale)
      this.props.setMatrixAt(n, _person)
      const hex = prop.kind === 'bag' ? bagColor(prop.id) : PROP_COLOR[prop.kind]
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
    this.people.dispose()
    this.dots.geometry.dispose()
    this.dots.dispose()
    this.stripes.geometry.dispose()
    this.stripes.dispose()
    this.props.geometry.dispose()
    this.props.dispose()
    this.bars.geometry.dispose()
    this.bars.dispose()
  }
}
