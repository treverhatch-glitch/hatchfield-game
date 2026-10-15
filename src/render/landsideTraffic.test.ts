import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { LandsideTraffic } from '../landside/engine.ts'
import { starterField } from '../landside/fixtures.test-util.ts'
import { LandsideLayer } from './landsideTraffic.ts'

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
    layer.dispose()
    expect(instanced(layer)).toHaveLength(0)
  })
})
