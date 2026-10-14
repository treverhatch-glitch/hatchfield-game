/**
 * Draws the landside snapshot: cars on the approach, people stepping out,
 * and a capacity tint while the curb panel is open.
 * The sim never imports this file.
 */
import * as THREE from 'three'
import { CELL, WORLD_PER_METER } from './aircraft/specs.ts'
import { pressureColor, type LandsideView, type VehicleKind } from '../landside/index.ts'
import { SIZE } from '../game/types.ts'

/** Same ground mapping as the apron: cell column is +X, cell row is +Z. */
function atCell(c: number, r: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3((c - (SIZE - 1) / 2) * CELL, y, (r - (SIZE - 1) / 2) * CELL)
}

const CAR: Record<VehicleKind, { length: number; width: number; height: number; color: string }> = {
  car: { length: 4.6, width: 1.8, height: 1.45, color: '#3d6ea8' },
  taxi: { length: 4.6, width: 1.8, height: 1.45, color: '#f0c14a' },
  bus: { length: 12, width: 2.5, height: 3.1, color: '#1f6b4a' },
}

const CAR_COLORS = ['#3d6ea8', '#c45c4a', '#d8d2c4', '#2c3338', '#6a4a7a']

function carBody(kind: VehicleKind, color: string): THREE.Group {
  const spec = CAR[kind]
  const group = new THREE.Group()
  group.scale.setScalar(WORLD_PER_METER)
  const paint = new THREE.MeshLambertMaterial({ color })
  const glass = new THREE.MeshLambertMaterial({ color: '#9ec4d4' })
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.length, spec.height * 0.45, spec.width), paint)
  body.position.set(0, spec.height * 0.28, 0)
  body.castShadow = true
  group.add(body)
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(spec.length * (kind === 'bus' ? 0.86 : 0.48), spec.height * 0.42, spec.width * 0.88),
    glass,
  )
  cabin.position.set(kind === 'bus' ? 0 : -spec.length * 0.06, spec.height * 0.68, 0)
  group.add(cabin)
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.16, 0.22),
      new THREE.MeshLambertMaterial({ color: '#1a1a1a' }),
    )
    sign.position.set(0, spec.height * 0.95, 0)
    group.add(sign)
  }
  return group
}

function personMesh(color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22 * WORLD_PER_METER, 1.15 * WORLD_PER_METER, 3, 6),
    new THREE.MeshLambertMaterial({ color }),
  )
  mesh.castShadow = true
  return mesh
}

export class LandsideLayer {
  readonly group = new THREE.Group()
  private cars = new Map<string, THREE.Group>()
  private people = new Map<string, THREE.Mesh>()
  private tiles = new Map<string, THREE.Mesh>()
  private tileGeo: THREE.PlaneGeometry | null = null

  sync(view: LandsideView, open: boolean, focus: string | null): void {
    const seenCars = new Set<string>()
    for (const vehicle of view.vehicles) {
      seenCars.add(vehicle.id)
      let mesh = this.cars.get(vehicle.id)
      if (!mesh) {
        const color =
          vehicle.kind === 'car'
            ? CAR_COLORS[this.cars.size % CAR_COLORS.length]
            : CAR[vehicle.kind].color
        mesh = carBody(vehicle.kind, color)
        mesh.name = vehicle.id
        this.cars.set(vehicle.id, mesh)
        this.group.add(mesh)
      }
      const pos = atCell(vehicle.c, vehicle.r, 0)
      mesh.position.copy(pos)
      mesh.rotation.y = -vehicle.heading
      mesh.visible = true
    }
    for (const [id, mesh] of this.cars) {
      if (seenCars.has(id)) continue
      this.group.remove(mesh)
      mesh.traverse((obj) => {
        const m = obj as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material
        if (Array.isArray(mat)) mat.forEach((item) => item.dispose())
        else mat?.dispose()
      })
      this.cars.delete(id)
    }

    const seenPeople = new Set<string>()
    for (const person of view.passengers) {
      seenPeople.add(person.id)
      let mesh = this.people.get(person.id)
      if (!mesh) {
        mesh = personMesh(person.id.length % 2 ? '#e6d3b3' : '#c48a62')
        this.people.set(person.id, mesh)
        this.group.add(mesh)
      }
      const pos = atCell(person.c, person.r, 0.95 * WORLD_PER_METER)
      mesh.position.copy(pos)
      mesh.rotation.y = -person.heading
    }
    for (const [id, mesh] of this.people) {
      if (seenPeople.has(id)) continue
      this.group.remove(mesh)
      mesh.geometry.dispose()
      const mat = mesh.material
      if (!Array.isArray(mat)) mat.dispose()
      this.people.delete(id)
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
        rail: false,
        arrivalsPerMin: 0,
        modes: { car: 0, taxi: 0, bus: 0, rail: 0 },
        queue: 0,
        delaySec: 0,
        pressure: 0,
        satisfactionDelta: 0,
        news: '',
        fixes: [],
        focusId: null,
      },
      false,
      null,
    )
    this.tileGeo?.dispose()
    this.tileGeo = null
    this.group.removeFromParent()
  }
}
