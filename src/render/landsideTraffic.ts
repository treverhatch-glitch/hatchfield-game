/**
 * Draws the landside snapshot: vehicles on the public-road lanes, people
 * stepping out, and a capacity tint while the curb panel is open.
 * Vehicles and people are instanced, a few draw calls however long the queue.
 * The sim never imports this file.
 */
import * as THREE from 'three'
import { CELL, WORLD_PER_METER } from './aircraft/specs.ts'
import { LANDSIDE, pressureColor, type LandsideView, type VehicleKind } from '../landside/index.ts'
import { SIZE } from '../game/types.ts'
import { cc0Kit, KitFleet } from './cc0/library.ts'

/** Same ground mapping as the apron: cell column is +X, cell row is +Z. */
function atCell(c: number, r: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3((c - (SIZE - 1) / 2) * CELL, y, (r - (SIZE - 1) / 2) * CELL)
}

const HEIGHT_M: Record<VehicleKind, number> = { car: 1.45, taxi: 1.45, bus: 3.1 }
const KIND_COLOR: Partial<Record<VehicleKind, string>> = { taxi: '#f0c14a', bus: '#1f6b4a' }
const CAR_COLORS = ['#3d6ea8', '#c45c4a', '#d8d2c4', '#2c3338', '#6a4a7a']
const PEOPLE_COLORS = ['#e6d3b3', '#c48a62']
const KINDS: VehicleKind[] = ['car', 'taxi', 'bus']

function hash(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** One instanced part. Grows by doubling; geometry and material live as long as the pool. */
class Pool {
  mesh: THREE.InstancedMesh
  private capacity = 16
  private readonly parent: THREE.Group
  private readonly geometry: THREE.BufferGeometry
  private readonly material: THREE.Material
  private readonly tinted: boolean
  private readonly shadow: boolean

  constructor(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, tinted: boolean, shadow: boolean) {
    this.parent = parent
    this.geometry = geometry
    this.material = material
    this.tinted = tinted
    this.shadow = shadow
    this.mesh = this.build()
  }

  private build(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    if (this.tinted) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3)
    mesh.castShadow = this.shadow
    mesh.frustumCulled = false
    mesh.count = 0
    mesh.visible = false
    this.parent.add(mesh)
    return mesh
  }

  reserve(n: number): void {
    if (n <= this.capacity) return
    while (this.capacity < n) this.capacity *= 2
    this.parent.remove(this.mesh)
    this.mesh.dispose()
    this.mesh = this.build()
  }

  commit(n: number): void {
    this.mesh.count = n
    this.mesh.visible = n > 0
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  dispose(): void {
    this.parent.remove(this.mesh)
    this.mesh.dispose()
    this.geometry.dispose()
    this.material.dispose()
  }
}

interface Fleet {
  body: Pool
  cabin: Pool
  sign: Pool | null
}

/**
 * Local +X is the nose. The glass cabin sits aft of centre and the front face
 * of the body is a dark grille, so a lane-change yaw is a turned hood rather
 * than a box sliding sideways.
 */
function paintNose(geometry: THREE.BufferGeometry, length: number): THREE.BufferGeometry {
  const pos = geometry.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const nose = pos.getX(i) > length * 0.28 ? 0.16 : 1
    colors[i * 3] = nose
    colors[i * 3 + 1] = nose
    colors[i * 3 + 2] = nose
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function fleetFor(parent: THREE.Group, kind: VehicleKind): Fleet {
  const { lengthM: length, widthM: width } = LANDSIDE.bodies[kind]
  const height = HEIGHT_M[kind]
  const bus = kind === 'bus'
  const body = paintNose(
    new THREE.BoxGeometry(length, height * 0.42, width).translate(0, height * 0.24, 0),
    length,
  )
  // Cars: glass over the rear half, long hood in front. Buses: glass runs to a short bumper.
  const cabinLen = length * (bus ? 0.72 : 0.4)
  const cabinX = bus ? length * 0.08 : -length * 0.26
  const cabin = new THREE.BoxGeometry(cabinLen, height * 0.48, width * 0.86).translate(cabinX, height * 0.66, 0)
  return {
    body: new Pool(parent, body, new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }), true, true),
    cabin: new Pool(parent, cabin, new THREE.MeshLambertMaterial({ color: '#9ec4d4' }), false, false),
    sign:
      kind === 'taxi'
        ? new Pool(
            parent,
            new THREE.BoxGeometry(0.5, 0.14, 0.28).translate(cabinX, height * 0.96, 0),
            new THREE.MeshLambertMaterial({ color: '#1a1a1a' }),
            false,
            false,
          )
        : null,
  }
}

export class LandsideLayer {
  readonly group = new THREE.Group()
  private fleets = new Map<VehicleKind, Fleet>()
  private people: Pool | null = null
  private tiles = new Map<string, THREE.Mesh>()
  private tileGeo: THREE.PlaneGeometry | null = null
  private readonly matrix = new THREE.Matrix4()
  private readonly turn = new THREE.Quaternion()
  private readonly up = new THREE.Vector3(0, 1, 0)
  private readonly scale = new THREE.Vector3(WORLD_PER_METER, WORLD_PER_METER, WORLD_PER_METER)
  private readonly color = new THREE.Color()
  /** City buses drawn with the CC0 12 m low-floor bus once it has loaded (uniform scale to our 12 m). */
  private busKit: KitFleet | null = null

  private syncCc0Buses(list: LandsideView['vehicles']): boolean {
    const kit = cc0Kit('city_bus')
    if (!kit) return false
    if (!this.busKit) {
      this.busKit = new KitFleet(kit)
      this.busKit.group.name = 'landside-bus-cc0'
      this.group.add(this.busKit.group)
    }
    const s = (LANDSIDE.bodies.bus.lengthM / kit.size.x) * WORLD_PER_METER
    const frames = list.map((vehicle) => {
      this.turn.setFromAxisAngle(this.up, -vehicle.heading)
      return new THREE.Matrix4().compose(atCell(vehicle.c, vehicle.r, 0), this.turn, new THREE.Vector3(s, s, s))
    })
    this.busKit.sync(frames)
    return true
  }

  sync(view: LandsideView, open: boolean, focus: string | null): void {
    for (const kind of KINDS) {
      const list = view.vehicles.filter((vehicle) => vehicle.kind === kind)
      if (kind === 'bus' && this.syncCc0Buses(list)) continue
      let fleet = this.fleets.get(kind)
      if (!fleet && !list.length) continue
      if (!fleet) {
        fleet = fleetFor(this.group, kind)
        this.fleets.set(kind, fleet)
      }
      const parts = [fleet.body, fleet.cabin, fleet.sign].filter((part): part is Pool => part != null)
      for (const part of parts) part.reserve(list.length)
      list.forEach((vehicle, i) => {
        this.turn.setFromAxisAngle(this.up, -vehicle.heading)
        this.matrix.compose(atCell(vehicle.c, vehicle.r, 0), this.turn, this.scale)
        for (const part of parts) part.mesh.setMatrixAt(i, this.matrix)
        this.color.set(KIND_COLOR[kind] ?? CAR_COLORS[hash(vehicle.id) % CAR_COLORS.length])
        fleet.body.mesh.setColorAt(i, this.color)
      })
      for (const part of parts) part.commit(list.length)
      fleet.body.mesh.name = `landside-${kind}-body`
      fleet.cabin.mesh.name = `landside-${kind}-cabin`
      if (fleet.sign) fleet.sign.mesh.name = `landside-${kind}-sign`
    }

    if (view.passengers.length && !this.people) {
      this.people = new Pool(
        this.group,
        new THREE.CapsuleGeometry(0.22, 1.15, 3, 6).translate(0, 0.95, 0),
        new THREE.MeshLambertMaterial({ color: '#ffffff' }),
        true,
        true,
      )
    }
    if (this.people) {
      const people = this.people
      people.reserve(view.passengers.length)
      view.passengers.forEach((person, i) => {
        this.turn.setFromAxisAngle(this.up, -person.heading)
        this.matrix.compose(atCell(person.c, person.r, 0), this.turn, this.scale)
        people.mesh.setMatrixAt(i, this.matrix)
        people.mesh.setColorAt(i, this.color.set(PEOPLE_COLORS[hash(person.id) % PEOPLE_COLORS.length]))
      })
      people.commit(view.passengers.length)
      people.mesh.name = 'landside-person'
    }

    this.syncOverlay(view, open, focus)
  }

  private syncOverlay(view: LandsideView, open: boolean, focus: string | null): void {
    if (!open) {
      for (const tile of this.tiles.values()) tile.visible = false
      return
    }
    this.tileGeo ??= new THREE.PlaneGeometry(1, 1)
    const cell = 22 * WORLD_PER_METER * 0.86
    const seen = new Set<string>()
    for (const segment of view.segments) {
      seen.add(segment.id)
      let tile = this.tiles.get(segment.id)
      if (!tile) {
        tile = new THREE.Mesh(
          this.tileGeo,
          new THREE.MeshBasicMaterial({
            color: pressureColor(segment.ratio),
            transparent: true,
            opacity: 0.38,
            depthWrite: false,
          }),
        )
        tile.rotation.x = -Math.PI / 2
        tile.renderOrder = 2
        this.tiles.set(segment.id, tile)
        this.group.add(tile)
      }
      const mat = tile.material as THREE.MeshBasicMaterial
      mat.color.set(pressureColor(segment.ratio))
      mat.opacity = segment.id === focus ? 0.72 : 0.38
      const pos = atCell(segment.c, segment.r, 0.22)
      tile.position.copy(pos)
      tile.scale.set(cell, cell, 1)
      tile.visible = true
    }
    for (const [id, tile] of this.tiles) {
      if (!seen.has(id)) tile.visible = false
    }
  }

  dispose(): void {
    this.sync(
      {
        segments: [],
        vehicles: [],
        passengers: [],
        lanes: 0,
        laneFlowPerMin: 0,
        roadFlowPerMin: 0,
        curbStalls: 0,
        curbBusy: 0,
        curbFlowPerMin: 0,
        parkSpaces: 0,
        busBays: 0,
        curbLanes: 0,
        taxiRanks: 0,
        rail: false,
        arrivalsPerMin: 0,
        modes: { car: 0, taxi: 0, bus: 0, rail: 0 },
        queue: 0,
        delaySec: 0,
        pressure: 0,
        satisfactionDelta: 0,
        missedCheckIns: 0,
        missShare: 0,
        news: '',
        fixes: [],
        focusId: null,
      },
      false,
      null,
    )
    for (const fleet of this.fleets.values()) {
      fleet.body.dispose()
      fleet.cabin.dispose()
      fleet.sign?.dispose()
    }
    this.fleets.clear()
    this.busKit?.dispose()
    this.busKit = null
    this.people?.dispose()
    this.people = null
    for (const tile of this.tiles.values()) {
      this.group.remove(tile)
      ;(tile.material as THREE.Material).dispose()
    }
    this.tiles.clear()
    this.tileGeo?.dispose()
    this.tileGeo = null
    this.group.removeFromParent()
  }
}
