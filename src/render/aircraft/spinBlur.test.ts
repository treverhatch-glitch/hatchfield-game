import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createAircraft, updateAircraft } from './factory'
import { CrossfadeLOD, spinBlurLevel } from './lod'
import { MOTION_IDLE } from './motion'
import { installSoftShadows, softShadowRadius } from '../world/softShadows'

const LIVERY = { body: '#2f6f9a', stripe: '#e8eef5' }

function lodOf(root: THREE.Object3D): CrossfadeLOD {
  let lod: CrossfadeLOD | null = root instanceof CrossfadeLOD ? root : null
  root.traverse((o) => { if (!lod && o instanceof CrossfadeLOD) lod = o })
  if (!lod) throw new Error('no LOD')
  return lod
}

function blurs(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  root.traverse((o) => { if (o.name === 'prop-blur' || o.name === 'rotor-blur') out.push(o as THREE.Mesh) })
  return out
}

function at(id: string, spool: number) {
  const root = createAircraft(id, LIVERY)
  const cam = new THREE.PerspectiveCamera(40, 1.5, 0.1, 5000)
  cam.position.set(20, 10, 30)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  root.updateMatrixWorld(true)
  updateAircraft(root, true, { ...MOTION_IDLE, spool })
  lodOf(root).update(cam)
  return root
}

describe('prop / rotor blur discs', () => {
  it('fade curve is exactly zero when stopped and full at take-off power', () => {
    expect(spinBlurLevel(0)).toBe(0)
    expect(spinBlurLevel(0.04)).toBe(0)
    expect(spinBlurLevel(0.35)).toBeGreaterThan(0)
    expect(spinBlurLevel(0.35)).toBeLessThan(spinBlurLevel(0.7))
    expect(spinBlurLevel(1)).toBe(1)
  })

  for (const id of ['atr72', 'q400', 'dhc6', 'aw139', 's76']) {
    it(`${id}: no disc (and no disc shadow) when parked; disc and soft shadow when spinning`, () => {
      const parked = at(id, 0)
      const pb = blurs(parked)
      expect(pb.length).toBeGreaterThan(0)
      for (const b of pb) {
        expect(b.visible && (b.material as THREE.Material).opacity > 0, b.name).toBe(false)
        expect(b.visible && b.castShadow, b.name).toBe(false)
      }
      const spinning = at(id, 1)
      for (const b of blurs(spinning)) {
        expect(b.visible, b.name).toBe(true)
        expect(b.castShadow, b.name).toBe(true)
        expect((b.material as THREE.Material).opacity, b.name).toBeGreaterThan(0.2)
      }
    })
  }
})

describe('soft plane shadows', () => {
  it('patches three’s PCF into the wide soft kernel', () => {
    expect(installSoftShadows()).toBe(true)
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('SOFT_SHADOW_TAPS')
  })

  it('keeps a soft edge when zoomed right in and never drops below the preset radius', () => {
    const close = softShadowRadius(12, 18, 4096, 6)
    expect(close).toBeGreaterThanOrEqual(6)
    // ≈ 0.1 world units (≈ 0.2 m) of penumbra at the tightest shadow fit.
    expect(close * (36 / 4096)).toBeGreaterThan(0.09)
    expect(softShadowRadius(400, 88, 4096, 6)).toBeLessThanOrEqual(28)
  })
})
