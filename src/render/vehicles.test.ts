import { afterAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { disposeVehicleLibrary, vehicleGeometry, vehicleLibrarySize, vehicleMesh, vehicleShape } from './vehicles'

afterAll(() => disposeVehicleLibrary())

describe('ground vehicle meshes', () => {
  it('picks a silhouette per kind', () => {
    expect(vehicleShape('fuel_truck')).toBe('tanker')
    expect(vehicleShape('pax_bus')).toBe('bus')
    expect(vehicleShape('pushback_tug')).toBe('tug')
    expect(vehicleShape('citycargo')).toBe('truck')
  })

  it('is one draw that keeps the real footprint', () => {
    const size = [8, 3, 2.5] as const
    const mesh = vehicleMesh('fuel_truck', '#c9a227', size, 1)
    expect(mesh.isMesh).toBe(true)
    expect(mesh.name).toBe('body')
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!
    const span = new THREE.Vector3()
    box.getSize(span)
    expect(span.x).toBeGreaterThan(size[0] * 0.95)
    expect(span.x).toBeLessThan(size[0] * 1.05)
    expect(span.z).toBeLessThan(size[2] * 1.05)
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6)
    expect(box.max.y).toBeLessThan(size[1] + 0.3)
    expect(mesh.geometry.getAttribute('color')).toBeDefined()
  })

  it('shares geometry per kind and colour', () => {
    const before = vehicleLibrarySize()
    const a = vehicleGeometry('gpu', '#5b8c5a', [3.2, 1.6, 1.4])
    const b = vehicleGeometry('gpu', '#5b8c5a', [3.2, 1.6, 1.4])
    const c = vehicleGeometry('gpu', '#ffffff', [3.2, 1.6, 1.4])
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(vehicleLibrarySize()).toBe(before + 2)
    expect(vehicleMesh('gpu', '#5b8c5a', [3.2, 1.6, 1.4], 1).material).toBe(
      vehicleMesh('pax_bus', '#3d6a8a', [12, 3, 2.5], 1).material,
    )
  })
})
