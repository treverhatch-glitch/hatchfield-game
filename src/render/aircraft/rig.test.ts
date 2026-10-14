import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createAircraft, updateAircraft } from './factory'
import { easeMotion, motionForPhase, MOTION_IDLE } from './motion'
import { poseRig, type RigSet } from './rig'
import type { LodBuckets } from './lod'

const LIVERY = { body: '#ffffff', stripe: '#c02020' }

function rigs(id: string): RigSet[] {
  const root = createAircraft(id, LIVERY)
  const lod = root.getObjectByName('lod') as unknown as { buckets: LodBuckets }
  return lod.buckets.rigs ?? []
}

describe('aircraft rig', () => {
  it('gives airliners flaps, slats, reversers and door leaves', () => {
    const kinds = new Set(rigs('b738').map((r) => r.kind))
    for (const k of ['flap', 'slat', 'reverser', 'door']) expect(kinds.has(k as never)).toBe(true)
  })

  it('gives the A380 more flap and slat segments than a 737', () => {
    const count = (id: string, kind: string) =>
      rigs(id).filter((r) => r.kind === kind).reduce((n, r) => n + r.parts.length, 0)
    expect(count('a380', 'flap')).toBeGreaterThan(count('b738', 'flap'))
    expect(count('a380', 'reverser')).toBe(4)
  })

  it('moves flap instances aft and down when deployed', () => {
    const flap = rigs('b738').find((r) => r.kind === 'flap')!
    const stowed = new THREE.Matrix4()
    const out = new THREE.Matrix4()
    flap.mesh.getMatrixAt(0, stowed)
    poseRig(flap, 1)
    flap.mesh.getMatrixAt(0, out)
    const a = new THREE.Vector3().setFromMatrixPosition(stowed)
    const b = new THREE.Vector3().setFromMatrixPosition(out)
    expect(b.x).toBeLessThan(a.x)
    expect(b.y).toBeLessThan(a.y)
  })

  it('maps phases to deployments', () => {
    expect(motionForPhase({ phase: 'approach', alt: 1 }).flaps).toBe(1)
    expect(motionForPhase({ phase: 'landing', alt: 0 }).reverse).toBe(1)
    expect(motionForPhase({ phase: 'deboard' }).doors).toBe(1)
    expect(motionForPhase({ phase: 'parked' }).spool).toBe(0)
    expect(motionForPhase({ phase: 'takeoff', alt: 10, gearDown: false }).flaps).toBe(0)
  })

  it('eases toward the target without overshoot', () => {
    const drawn = { ...MOTION_IDLE }
    const goal = motionForPhase({ phase: 'approach', alt: 1 })
    for (let i = 0; i < 400; i++) easeMotion(drawn, goal, 0.05)
    expect(drawn.flaps).toBeCloseTo(1, 2)
    expect(drawn.flaps).toBeLessThanOrEqual(1)
  })

  it('keeps the updateAircraft gear-only call working', () => {
    const root = createAircraft('a320neo', LIVERY)
    updateAircraft(root, false)
    expect(root.userData.gearDown).toBe(false)
    expect(root.userData.motion).toBeUndefined()
  })
})
