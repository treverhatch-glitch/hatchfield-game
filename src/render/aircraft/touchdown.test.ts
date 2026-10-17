import { afterAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { Vec } from '../../game/types'
import { arrivalPose } from '../flightPose'
import { CrossfadeLOD } from './lod'
import { createAircraft, disposeAircraftLibrary, getAircraftSpec, WORLD_PER_METER } from './factory'
import { aircraftWorldPerMeter } from './index'
import { gearSettle, settleShape, smokeTexture, TOUCHDOWN, TyreSmoke } from './touchdown'

const LIVERY = { body: '#2f6f9a', stripe: '#e8eef5' }

afterAll(() => disposeAircraftLibrary())

function approachPath(): Vec[] {
  const path: Vec[] = []
  for (let i = 14; i >= 1; i--) path.push({ c: 8 - i, r: 26 })
  for (let c = 8; c <= 28; c++) path.push({ c, r: 26 })
  path.push({ c: 28, r: 24 })
  path.push({ c: 28, r: 18 })
  return path
}

describe('touchdown settle (visual only)', () => {
  it('starts at zero, squashes fast, rings down and is exactly zero after settleSec', () => {
    expect(settleShape(0)).toBe(0)
    expect(gearSettle(0, 3)).toEqual({ sinkM: 0, pitch: 0 })
    let peakT = 0
    let peak = 0
    let minAfter = 0
    for (let t = 0; t < TOUCHDOWN.settleSec; t += 0.005) {
      const s = settleShape(t)
      if (s > peak) {
        peak = s
        peakT = t
      }
      if (t > TOUCHDOWN.peakSec) minAfter = Math.min(minAfter, s)
      expect(Math.abs(s)).toBeLessThanOrEqual(1 + 1e-9)
    }
    expect(peak).toBeGreaterThan(0.98)
    expect(peakT).toBeGreaterThan(0.08)
    expect(peakT).toBeLessThan(0.3)
    // One visible rebound above ride height, but much softer than the squash.
    expect(minAfter).toBeLessThan(-0.15)
    expect(minAfter).toBeGreaterThan(-0.6)
    // Tail fades into rest with no snap at the cutoff.
    expect(Math.abs(settleShape(TOUCHDOWN.settleSec - 0.01))).toBeLessThan(0.01)
    expect(gearSettle(TOUCHDOWN.settleSec, 3)).toEqual({ sinkM: 0, pitch: 0 })
    expect(gearSettle(Number.NaN, 3)).toEqual({ sinkM: 0, pitch: 0 })
  })

  it('scales the squash with the gear and dips the nose while the mains load', () => {
    const small = gearSettle(TOUCHDOWN.peakSec, getAircraftSpec('dhc6').gear)
    const big = gearSettle(TOUCHDOWN.peakSec, getAircraftSpec('a380').gear)
    expect(big.sinkM).toBeGreaterThan(small.sinkM)
    expect(big.sinkM).toBeCloseTo(TOUCHDOWN.squashFrac * getAircraftSpec('a380').gear, 3)
    expect(big.pitch).toBeLessThan(0)
    expect(Math.abs(big.pitch)).toBeLessThan(1.5 * (Math.PI / 180))
  })

  it('arrival pose reports touchdown only once wheels are on the runway, without moving the jet', () => {
    const path = approachPath()
    const onRunway = (p: Vec) => p.c >= 8 && p.c <= 28 && Math.abs(p.r - 26) < 0.01
    let first: number | undefined
    let last = -1
    for (let x = 7; x < 20; x += 0.01) {
      const p = arrivalPose({ x, y: 26, heading: 0, path, airframeId: 'b738', initialBefore: 14, onRunway })
      if (p.alt > 0) expect(p.touchdown).toBeUndefined()
      if (p.touchdown != null) {
        expect(p.alt).toBe(0)
        if (first == null) first = p.touchdown
        expect(p.touchdown).toBeGreaterThanOrEqual(last)
        last = p.touchdown
      }
    }
    // Sampled at sim pace, the first rollout frame lands inside the latch window.
    expect(first).toBeDefined()
    expect(first!).toBeLessThan(TOUCHDOWN.latchCells)
  })

  it('shortens the main oleos by exactly the body sink so the tyres stay planted', () => {
    const root = createAircraft('b738', LIVERY)
    const lod = root.getObjectByName('lod') as CrossfadeLOD
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500)
    camera.position.set(0, 6, 16)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const legs: THREE.Object3D[] = []
    root.getObjectByName('lod-mid')!.traverse((o) => {
      if (o.name === 'gear-main') legs.push(o)
    })
    expect(legs.length).toBeGreaterThanOrEqual(2)
    for (const l of legs) expect(l.userData.legH).toBeGreaterThan(0)
    const footY = () => {
      root.updateMatrixWorld(true)
      const box = new THREE.Box3()
      for (const l of legs) box.expandByObject(l)
      return box.min.y
    }
    root.userData.squashM = 0
    lod.update(camera)
    const rest = footY()
    const spec = getAircraftSpec('b738')
    const sink = gearSettle(TOUCHDOWN.peakSec, spec.gear).sinkM
    root.userData.squashM = sink
    root.position.y = -sink * aircraftWorldPerMeter()
    lod.update(camera)
    for (const l of legs) expect(l.scale.y).toBeCloseTo(1 - sink / (l.userData.legH as number), 6)
    expect(Math.abs(footY() - rest)).toBeLessThan(0.02 * WORLD_PER_METER + 1e-4)
    // And back to full length when the settle is over.
    root.userData.squashM = 0
    root.position.y = 0
    lod.update(camera)
    for (const l of legs) expect(l.scale.y).toBe(1)
  })
})

describe('tyre smoke', () => {
  const wpm = 0.05
  const contacts = [new THREE.Vector3(0, 0.04, -0.3), new THREE.Vector3(0, 0.04, 0.3)]

  it('sheds puffs behind the wheels, billows, fades and frees every puff', () => {
    const smoke = new TyreSmoke(wpm, 64)
    for (let t = 0; t < TOUCHDOWN.smoke.emitSec; t += 1 / 60) smoke.emit('f1', contacts, 0, 1 / 60)
    const n = smoke.active
    expect(n).toBeGreaterThan(20)
    expect(n).toBeLessThanOrEqual(64)
    smoke.update(0.5, 1)
    const live = smoke.group.children.filter((c) => c.visible) as THREE.Sprite[]
    // Heading 0 travels +X, so smoke drifts to -X on average.
    const meanX = live.reduce((a, s) => a + s.position.x, 0) / live.length
    expect(meanX).toBeLessThan(0)
    for (const s of live) {
      expect(s.position.y).toBeGreaterThan(0.04)
      expect(s.scale.x).toBeGreaterThan(TOUCHDOWN.smoke.sizeStart * wpm)
      const m = s.material as THREE.SpriteMaterial
      expect(m.depthWrite).toBe(false)
      expect(s.castShadow).toBe(false)
      expect(m.opacity).toBeGreaterThan(0)
      expect(m.opacity).toBeLessThanOrEqual(TOUCHDOWN.smoke.opacity)
    }
    smoke.update(TOUCHDOWN.smoke.lifeMax + 0.01, 1)
    expect(smoke.active).toBe(0)
    expect(smoke.group.children.every((c) => !c.visible)).toBe(true)
    smoke.dispose()
  })

  it('freezes on pause, recycles when full, and dims at night', () => {
    const smoke = new TyreSmoke(wpm, 8)
    smoke.emit('f1', contacts, 0, 0)
    expect(smoke.active).toBe(0)
    smoke.emit('f1', contacts, 0, 1)
    expect(smoke.active).toBe(8)
    const before = (smoke.group.children[0] as THREE.Sprite).position.clone()
    smoke.update(0, 1)
    expect((smoke.group.children[0] as THREE.Sprite).position.equals(before)).toBe(true)
    smoke.update(0.1, 0)
    const night = ((smoke.group.children[0] as THREE.Sprite).material as THREE.SpriteMaterial).color
    smoke.update(0.1, 1)
    const day = ((smoke.group.children[0] as THREE.Sprite).material as THREE.SpriteMaterial).color
    expect(night).toBe(day) // same object, recoloured
    smoke.update(0, 0)
    expect(day.r).toBeLessThan(0.3)
    smoke.dispose()
  })

  it('builds a soft round puff texture', () => {
    const tex = smokeTexture() as THREE.DataTexture
    const { data, width } = tex.image as { data: Uint8Array; width: number }
    const centre = data[((width / 2) * width + width / 2) * 4 + 3]
    const corner = data[3]
    expect(centre).toBeGreaterThan(200)
    expect(corner).toBe(0)
  })
})
