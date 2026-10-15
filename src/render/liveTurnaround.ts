/**
 * Live stand turnaround. The game scene calls this; the HTML socket demos do not.
 * Crew placement is turnaroundCrew. The hose and the belt lock through attachments.
 * Bags ride the belt on the handoff resample, from the loader foot to the hold.
 */
import * as THREE from 'three'
import { aircraftWorldPerMeter, WORLD_PER_METER } from './aircraft/specs.ts'
import { PeopleRenderer, type PeopleAgent } from '../people/renderer.ts'
import { aircraftSocketRig, lockTo } from './attachments.ts'
import { resample } from './handoff.ts'
import { hoseSpan, vehicleSocketTable } from './socketLayout.ts'
import { standCrew, vehicleCrew, type CrewVehicle, type StandFrame } from './turnaroundCrew.ts'
import { vehicleModel } from './vehicleModels.ts'

const NEAR_M = 36
const ARRIVAL_CREW_SEC = 30
const BAGS = 3

export interface TurnaroundStand {
  id: string
  airframeId: string
  /** Aircraft origin in world units. */
  x: number
  y: number
  z: number
  /** Sim heading. 0 points +X. */
  heading: number
  /** Seconds since the final taxi-in began. */
  t: number
  /** Deboard, service, board, or parked: the hose and the belt may run. */
  servicing: boolean
  nose: number
  noseGear: number
  semiSpan: number
  tail: number
}

export interface TurnaroundTruck {
  id: string
  kind: string
  x: number
  y: number
  z: number
  yaw: number
  ext: number
  moving: boolean
}

export interface TurnaroundDraw {
  crew: number
  hoses: number
  bags: number
}

const _pa = new THREE.Vector3()
const _pb = new THREE.Vector3()

function yawOf(heading: number): number {
  return -heading
}

function near(stand: TurnaroundStand, truck: TurnaroundTruck): boolean {
  const reach = NEAR_M * WORLD_PER_METER
  return Math.hypot(truck.x - stand.x, truck.z - stand.z) <= reach
}

function isFuel(kind: string): boolean {
  return kind === 'fuel' || kind === 'fuel_truck' || kind === 'heavy_fuel_truck' || kind === 'hydrant' || kind === 'hydrant_cart' || kind === 'hydrant_dispenser'
}

function isBelt(kind: string): boolean {
  return kind === 'belt_loader'
}

/** World point of a model-local socket. Yaw matches Object3D.rotation.y. */
export function socketWorld(
  x: number,
  y: number,
  z: number,
  yaw: number,
  scale: number,
  local: readonly [number, number, number],
): THREE.Vector3 {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const lx = local[0] * scale
  const ly = local[1] * scale
  const lz = local[2] * scale
  return new THREE.Vector3(x + lx * c + lz * s, y + ly, z + -lx * s + lz * c)
}

function poseRig(rig: THREE.Object3D, x: number, y: number, z: number, yaw: number, scale: number) {
  rig.position.set(x, y, z)
  rig.rotation.set(0, yaw, 0)
  rig.scale.setScalar(scale)
  rig.updateMatrixWorld(true)
}

export class LiveTurnaround {
  readonly group = new THREE.Group()
  private readonly people: PeopleRenderer
  private readonly hoses = new Map<string, THREE.Mesh>()
  private readonly bags = new Map<string, THREE.Mesh>()
  private readonly aircraft = new Map<string, THREE.Group>()
  private readonly hoseMat = new THREE.MeshLambertMaterial({ color: '#1e2226' })
  private readonly bagMat = new THREE.MeshLambertMaterial({ color: '#8c2f2f' })
  private readonly nozzleMat = new THREE.MeshLambertMaterial({ color: '#4a5158' })
  private readonly bagGeo = new THREE.BoxGeometry(0.72 * WORLD_PER_METER, 0.48 * WORLD_PER_METER, 0.34 * WORLD_PER_METER)

  constructor(parent: THREE.Object3D) {
    this.group.name = 'live-turnaround'
    parent.add(this.group)
    this.people = new PeopleRenderer(this.group, { capacity: 128, unitsPerMeter: WORLD_PER_METER })
  }

  sync(
    stands: readonly TurnaroundStand[],
    trucks: readonly TurnaroundTruck[],
    clock: number,
    camera: THREE.Camera | null,
    dt: number,
    lite = false,
  ): TurnaroundDraw {
    const agents: PeopleAgent[] = []
    const usedHoses = new Set<string>()
    const usedBags = new Set<string>()
    const usedAircraft = new Set<string>()
    const taken = new Set<string>()
    let hoses = 0
    let bags = 0

    for (const stand of stands) {
      const frame: StandFrame = {
        x: stand.x,
        y: stand.y,
        z: stand.z,
        yaw: yawOf(stand.heading),
        nose: stand.nose,
        noseGear: stand.noseGear,
        semiSpan: stand.semiSpan,
        tail: stand.tail,
      }
      if (stand.t < ARRIVAL_CREW_SEC) {
        const local: PeopleAgent[] = []
        standCrew(frame, stand.t, local, WORLD_PER_METER)
        for (const agent of local) {
          agent.id = `${stand.id}:${agent.id}`
          agents.push(agent)
        }
      }

      const here = trucks.filter((truck) => near(stand, truck) && !taken.has(truck.id))
      for (const truck of here) {
        taken.add(truck.id)
        const crew: CrewVehicle = {
          id: `${stand.id}:${truck.id}`,
          kind: truck.kind,
          x: truck.x,
          y: truck.y,
          z: truck.z,
          yaw: truck.yaw,
          ext: truck.ext,
          moving: truck.moving,
        }
        vehicleCrew(crew, clock, agents, WORLD_PER_METER)
      }

      if (!stand.servicing) continue
      const craft = this.craftRig(stand)
      usedAircraft.add(stand.id)

      const fuel = here.find((truck) => isFuel(truck.kind) && truck.ext >= 0.45 && !truck.moving)
      const belt = here.find((truck) => isBelt(truck.kind) && truck.ext >= 0.45 && !truck.moving)
      if (fuel && this.spanHose(fuel, craft)) {
        usedHoses.add(fuel.id)
        hoses += 1
      }
      if (belt) bags += this.rideBags(belt, craft, clock, usedBags)
    }

    this.drop(this.hoses, usedHoses, (mesh) => mesh.geometry.dispose())
    this.drop(this.bags, usedBags, () => undefined)
    this.drop(this.aircraft, usedAircraft, () => undefined)
    this.people.update(agents, camera, dt, lite)
    return { crew: agents.length, hoses, bags }
  }

  dispose() {
    this.drop(this.hoses, new Set(), (mesh) => mesh.geometry.dispose())
    this.drop(this.bags, new Set(), () => undefined)
    this.drop(this.aircraft, new Set(), () => undefined)
    this.people.dispose()
    this.bagGeo.dispose()
    this.hoseMat.dispose()
    this.bagMat.dispose()
    this.nozzleMat.dispose()
    this.group.removeFromParent()
  }

  private craftRig(stand: TurnaroundStand): THREE.Group {
    let rig = this.aircraft.get(stand.id)
    if (!rig || rig.userData.airframeId !== stand.airframeId) {
      rig?.removeFromParent()
      rig = aircraftSocketRig(stand.airframeId)
      rig.userData.airframeId = stand.airframeId
      this.aircraft.set(stand.id, rig)
      this.group.add(rig)
    }
    poseRig(rig, stand.x, stand.y, stand.z, yawOf(stand.heading), aircraftWorldPerMeter())
    return rig
  }

  private spanHose(truck: TurnaroundTruck, craft: THREE.Group): boolean {
    const port = craft.getObjectByName('plane_fuel_port')
    if (!port) return false
    const modelReel = socketLocal(truck.kind, 'hose_reel_out')
    if (!modelReel) return false
    _pa.copy(socketWorld(truck.x, truck.y, truck.z, truck.yaw, WORLD_PER_METER, modelReel))
    let nozzle = port.getObjectByName('hose_nozzle')
    if (!nozzle) {
      nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.12), this.nozzleMat)
      nozzle.name = 'hose_nozzle'
      lockTo(nozzle, port)
    }
    nozzle.getWorldPosition(_pb)
    const pts = hoseSpan([_pa.x, _pa.y, _pa.z], [_pb.x, _pb.y, _pb.z], 0.55, 14).map(
      (p) => new THREE.Vector3(p[0], p[1], p[2]),
    )
    if (pts.length < 2) return false
    const key = truck.id
    let mesh = this.hoses.get(key)
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.045 * WORLD_PER_METER, 5, false)
    if (!mesh) {
      mesh = new THREE.Mesh(geo, this.hoseMat)
      mesh.name = `hose:${key}`
      mesh.castShadow = true
      this.hoses.set(key, mesh)
      this.group.add(mesh)
    } else {
      mesh.geometry.dispose()
      mesh.geometry = geo
    }
    return true
  }

  private rideBags(
    truck: TurnaroundTruck,
    craft: THREE.Group,
    clock: number,
    keep: Set<string>,
  ): number {
    const tipSocket = socketLocal(truck.kind, 'belt_low')
    const highSocket = socketLocal(truck.kind, 'belt_tip')
    let a: THREE.Vector3
    let b: THREE.Vector3
    if (tipSocket) a = socketWorld(truck.x, truck.y, truck.z, truck.yaw, WORLD_PER_METER, tipSocket)
    else return 0
    const door = craft.getObjectByName('plane_cargo_door_fwd')
    if (door) b = door.getWorldPosition(new THREE.Vector3())
    else if (highSocket) b = socketWorld(truck.x, truck.y, truck.z, truck.yaw, WORLD_PER_METER, highSocket)
    else return 0
    const path = resample([a, b], 0.35 * WORLD_PER_METER)
    if (path.length < 2) return 0
    for (let i = 0; i < BAGS; i++) {
      const key = `${truck.id}:${i}`
      keep.add(key)
      let mesh = this.bags.get(key)
      if (!mesh) {
        mesh = new THREE.Mesh(this.bagGeo, this.bagMat)
        mesh.name = `bag:${key}`
        mesh.castShadow = true
        this.bags.set(key, mesh)
        this.group.add(mesh)
      }
      const u = ((clock * 0.15 + i / BAGS) % 1 + 1) % 1
      mesh.position.copy(samplePath(path, u))
    }
    return BAGS
  }

  private drop<T extends THREE.Object3D>(map: Map<string, T>, keep: Set<string>, release: (obj: T) => void) {
    for (const [key, obj] of map) {
      if (keep.has(key)) continue
      release(obj)
      obj.removeFromParent()
      map.delete(key)
    }
  }
}

function socketLocal(kind: string, name: string): readonly [number, number, number] | null {
  const table = vehicleSocketTable(vehicleModel(kind))
  return table[name] ?? null
}

function samplePath(path: readonly THREE.Vector3[], u: number): THREE.Vector3 {
  if (path.length === 1) return path[0].clone()
  const spans: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const d = path[i].distanceTo(path[i - 1])
    spans.push(d)
    total += d
  }
  let remain = u * total
  for (let i = 0; i < spans.length; i++) {
    const d = spans[i]
    if (remain <= d || i === spans.length - 1) {
      const t = d < 1e-6 ? 0 : remain / d
      return path[i].clone().lerp(path[i + 1], Math.min(1, Math.max(0, t)))
    }
    remain -= d
  }
  return path[path.length - 1].clone()
}
