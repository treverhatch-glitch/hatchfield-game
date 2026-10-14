import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SERVICE_POINTS } from '../servicePoints'
import { buildModel } from './index'
import { planYard, vehicleRect } from './yard'
import { LotLamps } from '../../render/world/lotLamps'
import { getMaterialFx, mat, setMaterialFx } from './kit'
import { QUALITY } from '../../render/world/quality'

const TYPES = ['cargo', 'hangar', 'fuel', 'fire', 'kitchen', 'bags', 'deice', 'tower', 'bus'] as const

describe('round-5 yard clutter', () => {
  it('is deterministic per lot and differs between lots', () => {
    const a = planYard('cargo', '4,7', [])
    expect(planYard('cargo', '4,7', [])).toEqual(a)
    expect(planYard('cargo', '5,7', [])).not.toEqual(a)
  })

  it('every concept building gets a busy, instanced yard', () => {
    for (const t of TYPES) {
      const g = buildModel(t, { yardSeed: '3,3' })!
      let inst = 0
      g.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) inst += (o as THREE.InstancedMesh).count })
      expect(inst, t).toBeGreaterThan(t === 'bus' ? 4 : 10)
      expect(buildModel(t)!.getObjectByName('yard:cone:0'), `${t} icon stays clean`).toBeUndefined()
    }
  })

  it('stays clear of service points and lanes', () => {
    for (const t of ['cargo', 'fuel', 'bags', 'kitchen', 'deice', 'bus', 'hangar'] as const) {
      const spec = SERVICE_POINTS[t]!
      for (const p of planYard(t, '9,2', [])) {
        for (const s of spec.points) {
          const r = vehicleRect(s.x, s.z, s.heading)
          const inside = p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1
          expect(inside, `${t} ${p.kind} in ${s.id}`).toBe(false)
        }
        expect(Math.hypot(p.x - spec.approach.x, p.z - spec.approach.z)).toBeGreaterThan(0.9)
      }
    }
  })

  it('models record lamp heads for real night lights', () => {
    const g = buildModel('cargo', { yardSeed: '1,1' })!
    expect((g.userData.lamps as number[][]).length).toBeGreaterThanOrEqual(3)
    const root = new THREE.Group()
    root.add(g)
    const L = new LotLamps(QUALITY.high.lotLamps)
    L.collect(root)
    expect(L.count).toBeGreaterThanOrEqual(3)
    L.update(new THREE.Vector3(), 0)
    expect(L.group.children.every((l) => (l as THREE.PointLight).intensity === 0)).toBe(true)
    L.update(new THREE.Vector3(), 1)
    expect(L.group.children.filter((l) => (l as THREE.PointLight).intensity > 0).length).toBe(Math.min(L.count, L.budget))
    expect(QUALITY.low.lotLamps).toBe(0)
  })

  it('material fx toggle: on for High only by default, flips program key', () => {
    expect(QUALITY.high.materialFx).toBe(true)
    expect(QUALITY.low.materialFx).toBe(false)
    const m = mat('#123456')
    const on = getMaterialFx()
    setMaterialFx(!on)
    const k1 = m.customProgramCacheKey()
    setMaterialFx(on)
    expect(m.customProgramCacheKey()).not.toBe(k1)
  })
})
