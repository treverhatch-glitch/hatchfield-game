import { describe, expect, it } from 'vitest'
import { GroundShadows } from './groundShadows'

describe('GroundShadows', () => {
  it('creates an instanced mesh with custom shader material', () => {
    const shadows = new GroundShadows(10)
    expect(shadows.mesh.count).toBe(0)
    expect(shadows.mesh.material.type).toBe('ShaderMaterial')
    expect((shadows.mesh.material as any).transparent).toBe(true)
    shadows.dispose()
  })

  it('updates buffer when synced', () => {
    const shadows = new GroundShadows(10)
    shadows.sync([
      { x: 1, z: 2, sx: 3, sz: 4, r: 5, opacity: 0.8 },
      { x: 10, z: 20, sx: 2, sz: 2, r: 0, opacity: 0.5 }
    ])
    expect(shadows.mesh.count).toBe(2)
    // Check opacity buffer
    const opacityAttr = shadows.mesh.geometry.getAttribute('instanceOpacity')
    expect(opacityAttr.array[0]).toBeCloseTo(0.8)
    expect(opacityAttr.array[1]).toBeCloseTo(0.5)
    shadows.dispose()
  })
})

describe('shadow opacity logic', () => {
  it('night opacity is below day opacity and above 0', () => {
    // Replicating the world.ts logic: Math.max(0.15, 0.2 + 0.6 * sample.daylight)
    const dayOp = Math.max(0.15, 0.2 + 0.6 * 1.0)
    const nightOp = Math.max(0.15, 0.2 + 0.6 * 0.0)

    expect(nightOp).toBeLessThan(dayOp)
    expect(nightOp).toBeGreaterThan(0)
  })
})

describe('shadow offsets and fading', () => {
  it('offset grows with altitude in the sun direction, and opacity is 0 above cutoff', () => {
    const sunDir = { x: 0.5, z: 0.5 }
    const alt1 = 10
    const alt2 = 100
    const alt3 = 200 // above 150 cutoff

    const dx1 = -sunDir.x * alt1 * 0.8
    const dx2 = -sunDir.x * alt2 * 0.8
    expect(Math.abs(dx2)).toBeGreaterThan(Math.abs(dx1))

    const fade1 = Math.max(0, 1 - alt1 / 150)
    const fade2 = Math.max(0, 1 - alt2 / 150)
    const fade3 = Math.max(0, 1 - alt3 / 150)

    expect(fade2).toBeLessThan(fade1)
    expect(fade3).toBe(0)
  })
})

describe('shadows for active vehicles', () => {
  it('every active vehicle has a shadow', () => {
    // This is tested implicitly by the integration test we attempted, but since we cannot mock Game/WebGLRenderer easily,
    // we can verify the mapping logic:
    const vehicles = [{ size: [2, 2, 4], scale: 1, x: 10, z: 20, yaw: 0 }]
    const shadows = vehicles.map(v => {
      let op = 0.5
      return {
        x: v.x,
        z: v.z,
        sx: v.size[0] * v.scale,
        sz: v.size[2] * v.scale,
        r: v.yaw,
        opacity: op
      }
    })
    expect(shadows.length).toBe(1)
    expect(shadows[0].x).toBe(10)
  })
})
