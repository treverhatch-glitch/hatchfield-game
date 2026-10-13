import { describe, expect, it } from 'vitest'
import { FOLLOW_PRESETS, chasePose, damp, dampAngle, dist, flybyPath, followStep, lookAngles, orbitPose, samplePath, shakeOffset, v3, type CameraState } from './camera.ts'

describe('camera', () => {
  it('damping is frame-rate independent', () => {
    let a = 0
    for (let i = 0; i < 60; i++) a = damp(a, 10, 0.5, 1 / 60)
    let b = 0
    for (let i = 0; i < 6; i++) b = damp(b, 10, 0.5, 1 / 6)
    expect(a).toBeCloseTo(b, 6)
    expect(damp(0, 10, 0.5, 0.5)).toBeCloseTo(5)
  })
  it('dampAngle takes the short way round', () => {
    expect(dampAngle(3, -3, 0, 1)).toBeCloseTo(3 + (2 * Math.PI - 6))
  })
  it('chase pose sits behind and above the target', () => {
    const p = chasePose({ position: v3(0, 0, 0), heading: 0 }, FOLLOW_PRESETS.plane)
    expect(p.position.z).toBeCloseTo(-60)
    expect(p.position.y).toBe(18)
    const lp = chasePose({ position: v3(0, 0, 0), heading: 0, velocity: v3(0, 0, 10) }, FOLLOW_PRESETS.plane)
    expect(lp.aim.z).toBe(15)
  })
  it('follow converges on the ideal pose and respects min height', () => {
    const t = { position: v3(100, 0, 50), heading: Math.PI / 2 }
    let cam: CameraState = { position: v3(0, 0.1, 0), aim: v3() }
    for (let i = 0; i < 600; i++) {
      cam = followStep(cam, t, FOLLOW_PRESETS.passenger, 1 / 60)
      expect(cam.position.y).toBeGreaterThanOrEqual(FOLLOW_PRESETS.passenger.minHeight)
    }
    expect(dist(cam.position, chasePose(t, FOLLOW_PRESETS.passenger).position)).toBeLessThan(0.01)
  })
  it('orbit keeps a constant radius', () => {
    const o = { center: v3(5, 0, 5), radius: 30, height: 10, speed: 0.3 }
    for (const t of [0, 1, 7.3]) {
      const p = orbitPose(o, t).position
      expect(Math.hypot(p.x - 5, p.z - 5)).toBeCloseTo(30)
    }
  })
  it('lookAngles matches three.js -Z forward', () => {
    expect(lookAngles(v3(), v3(0, 0, -1)).yaw).toBeCloseTo(0)
    expect(lookAngles(v3(), v3(1, 0, 0)).yaw).toBeCloseTo(-Math.PI / 2)
    expect(lookAngles(v3(), v3(0, 1, -1)).pitch).toBeCloseTo(Math.PI / 4)
  })
  it('cinematic path hits keys exactly and clamps', () => {
    const keys = flybyPath(v3(0, 0, 0), 0, 10)
    for (const k of keys) expect(dist(samplePath(keys, k.time).position, k.position)).toBeLessThan(1e-9)
    expect(samplePath(keys, -5).position).toEqual(keys[0].position)
    expect(samplePath(keys, 99).position).toEqual(keys[3].position)
    const mid = samplePath(keys, 5).position
    expect(Number.isFinite(mid.x + mid.y + mid.z)).toBe(true)
    expect(() => samplePath([], 0)).toThrow()
  })
  it('shake is deterministic and off with reduced motion', () => {
    expect(shakeOffset(1.234, 0.5)).toEqual(shakeOffset(1.234, 0.5))
    expect(shakeOffset(1.234, 0.5, true)).toEqual(v3())
  })
})
