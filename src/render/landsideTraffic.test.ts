import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SIZE } from '../game/types.ts'
import { LandsideTraffic } from '../landside/engine.ts'
import { starterField } from '../landside/fixtures.test-util.ts'
import { CELL } from './aircraft/specs.ts'
import { LandsideLayer } from './landsideTraffic.ts'

function worldOf(c: number, r: number): THREE.Vector3 {
  return new THREE.Vector3((c - (SIZE - 1) / 2) * CELL, 0, (r - (SIZE - 1) / 2) * CELL)
}

function instanced(layer: LandsideLayer): THREE.InstancedMesh[] {
  return layer.group.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)
}

describe('landside layer', () => {
  it('draws a long queue in a fixed handful of instanced meshes', () => {
    const sim = new LandsideTraffic()
    const field = starterField({ departures: 14, paxPerDay: 2400, busBays: [{ c: 18, r: 8 }] })
    let view = sim.snapshot()
    for (let t = 0; t < 2400; t++) view = sim.tick(0.25, field)
    expect(view.vehicles.length).toBeGreaterThan(16)
    const layer = new LandsideLayer()
    layer.sync(view, false, null)
    const meshes = instanced(layer)
    // Body, cabin and taxi sign per kind, plus the people.
    expect(meshes.length).toBeLessThanOrEqual(8)
    const drawn = meshes.filter((mesh) => mesh.visible)
    const bodies = drawn.filter((mesh) => mesh.instanceColor && mesh.castShadow && mesh.geometry.type === 'BoxGeometry')
    expect(bodies.reduce((n, mesh) => n + mesh.count, 0)).toBe(view.vehicles.length)
    const got: THREE.Vector3[] = []
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    const matrix = new THREE.Matrix4()
    for (const mesh of bodies) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix)
        matrix.decompose(pos, quat, scl)
        got.push(pos.clone())
      }
    }
    for (const vehicle of view.vehicles) {
      const at = worldOf(vehicle.c, vehicle.r)
      expect(got.some((p) => p.distanceTo(at) < 0.02), vehicle.id).toBe(true)
    }
    layer.dispose()
    expect(instanced(layer)).toHaveLength(0)
  })
})
