import { afterAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { AIRFRAMES } from '../../game/airframes'
import { loftGeometry, wingGeometry } from './geom'
import { CrossfadeLOD } from './lod'
import {
  createAircraft,
  disposeAircraftLibrary,
  drawCount,
  getAircraftSpec,
  libraryStats,
  LOD_DIST,
  lodWeights,
  measureAircraft,
  MODEL_SPECS,
  releaseAircraft,
  triangleCount,
  updateAircraft,
  WORLD_PER_METER,
} from './factory'

const LIVERY = { body: '#2f6f9a', stripe: '#e8eef5' }
const OTHER = { body: '#6b1d1d', stripe: '#f0c040' }

function mid(root: THREE.Object3D): THREE.Object3D {
  const node = root.getObjectByName('lod-mid')
  if (!node) throw new Error('missing mid lod')
  return node
}

function high(root: THREE.Object3D): THREE.Object3D {
  const node = root.getObjectByName('lod-high')
  if (!node) throw new Error('missing high lod')
  return node
}

function engineCount(root: THREE.Object3D): number {
  const engines = mid(root).getObjectByName('engines') as THREE.InstancedMesh | undefined
  return engines?.count ?? 0
}

function names(root: THREE.Object3D): Set<string> {
  const found = new Set<string>()
  root.traverse((obj) => {
    if (obj.name) found.add(obj.name)
  })
  return found
}

function fuselageGeo(root: THREE.Object3D): THREE.BufferGeometry {
  const mesh = mid(root).getObjectByName('fuselage') as THREE.Mesh
  return mesh.geometry
}

afterAll(() => {
  disposeAircraftLibrary()
})

describe('aircraft model factory', () => {
  it('covers every airframe in the catalog', () => {
    for (const id of Object.keys(AIRFRAMES)) {
      expect(MODEL_SPECS[id], id).toBeDefined()
      expect(getAircraftSpec(id).id).toBe(id)
    }
    expect(getAircraftSpec('nope').id).toBe('b738')
  })

  it('sizes each type to its real length, span, and height', () => {
    const misses: string[] = []
    for (const spec of Object.values(MODEL_SPECS)) {
      const aircraft = createAircraft(spec.id, LIVERY)
      const size = measureAircraft(aircraft)
      const length = spec.lengthM * WORLD_PER_METER
      const span = spec.spanM * WORLD_PER_METER
      const height = spec.heightM * WORLD_PER_METER
      const check = (label: string, value: number, target: number, lo: number, hi: number) => {
        const ratio = value / target
        if (ratio < lo || ratio > hi) {
          misses.push(`${spec.id} ${label} ${value.toFixed(2)} vs ${target.toFixed(2)} (${ratio.toFixed(2)})`)
        }
      }
      check('length', size.length, length, 0.9, 1.12)
      check('span', size.span, span, 0.9, 1.12)
      check('height', size.height, height, 0.88, 1.12)
      if (!mid(aircraft).getObjectByName('gear')) misses.push(`${spec.id} missing gear`)
      releaseAircraft(aircraft)
    }
    expect(misses).toEqual([])
  })

  it('keeps real ordering between types', () => {
    const sizeOf = (id: string) => {
      const aircraft = createAircraft(id, LIVERY)
      const size = measureAircraft(aircraft)
      releaseAircraft(aircraft)
      return size
    }
    const atr = sizeOf('atr72')
    const a320 = sizeOf('a320neo')
    const a321 = sizeOf('a321')
    const b789 = sizeOf('b789')
    const a380 = sizeOf('a380')
    const b748 = sizeOf('b748f')
    const b738 = sizeOf('b738')
    const f15 = sizeOf('f15')
    const c130 = sizeOf('c130')
    expect(atr.length).toBeLessThan(a320.length)
    expect(a320.length).toBeLessThan(a321.length)
    expect(a321.length).toBeLessThan(b789.length)
    expect(b789.length).toBeLessThan(a380.length)
    // 747-8F is longer than the A380; the old uniform scale had that backwards.
    expect(b748.length).toBeGreaterThan(a380.length)
    expect(a380.span).toBeGreaterThan(b748.span)
    expect(b748.span).toBeGreaterThan(b738.span)
    expect(f15.length).toBeLessThan(atr.length)
    expect(c130.span).toBeGreaterThan(c130.length)
  })

  it('gives each configuration its own parts', () => {
    const narrow = createAircraft('b738', LIVERY)
    const freighter = createAircraft('b748f', LIVERY)
    const prop = createAircraft('atr72', LIVERY)
    const nose = createAircraft('pc12', LIVERY)
    const fighter = createAircraft('f15', LIVERY)
    const helo = createAircraft('aw139', LIVERY)
    const skid = createAircraft('s76', LIVERY)
    const rear = createAircraft('crj700', LIVERY)

    expect(engineCount(narrow)).toBe(2)
    expect(engineCount(freighter)).toBe(4)
    expect(engineCount(prop)).toBe(2)
    expect(engineCount(nose)).toBe(1)
    expect(engineCount(fighter)).toBe(2)
    expect(engineCount(helo)).toBe(0)
    expect(getAircraftSpec('b738').engines.mount).toBe('wing')
    expect(getAircraftSpec('crj700').engines.mount).toBe('rear')
    expect(getAircraftSpec('f15').tail).toBe('twin')
    expect(getAircraftSpec('atr72').wingHigh).toBe(true)
    expect(getAircraftSpec('b748f').hump).toBe(true)
    expect(getAircraftSpec('a380').decks).toBe(2)

    expect(names(mid(narrow)).has('prop')).toBe(false)
    expect(names(mid(prop)).has('prop')).toBe(true)
    expect(names(mid(nose)).has('prop')).toBe(true)
    expect(names(mid(helo)).has('rotor')).toBe(true)
    expect(names(mid(skid)).has('rotor')).toBe(true)
    expect(names(mid(freighter)).has('hump')).toBe(true)
    expect(names(mid(freighter)).has('cargo-door')).toBe(true)
    expect(names(mid(narrow)).has('cargo-door')).toBe(false)
    expect(names(mid(narrow)).has('window-band')).toBe(true)
    expect(names(high(narrow)).has('windows')).toBe(true)
    expect(names(high(narrow)).has('doors')).toBe(true)
    expect(names(high(narrow)).has('fan')).toBe(true)
    expect(names(high(freighter)).has('windows')).toBe(false)
    expect(names(mid(fighter)).has('cockpit')).toBe(true)

    const eng = mid(rear).getObjectByName('engines') as THREE.InstancedMesh
    const matrix = new THREE.Matrix4()
    eng.getMatrixAt(0, matrix)
    const pos = new THREE.Vector3().setFromMatrixPosition(matrix)
    expect(pos.x).toBeLessThan(0)
    expect(Math.abs(pos.z)).toBeGreaterThan(getAircraftSpec('crj700').rx)

    const wingEng = mid(narrow).getObjectByName('engines') as THREE.InstancedMesh
    wingEng.getMatrixAt(0, matrix)
    const wingPos = new THREE.Vector3().setFromMatrixPosition(matrix)
    expect(Math.abs(wingPos.z)).toBeGreaterThan(2)
    expect(wingPos.y).toBeLessThan(getAircraftSpec('b738').gear + getAircraftSpec('b738').ry)

    for (const aircraft of [narrow, freighter, prop, nose, fighter, helo, skid, rear]) {
      releaseAircraft(aircraft)
    }
  })

  it('paints airline body and stripe slots', () => {
    const aircraft = createAircraft('a321', LIVERY)
    const body = mid(aircraft).getObjectByName('fuselage') as THREE.Mesh
    const tail = mid(aircraft).getObjectByName('tail') as THREE.Mesh
    expect((body.material as THREE.MeshLambertMaterial).color.getHexString()).toBe('2f6f9a')
    expect((tail.material as THREE.MeshLambertMaterial).color.getHexString()).toBe('e8eef5')
    const other = createAircraft('a321', OTHER)
    const otherBody = mid(other).getObjectByName('fuselage') as THREE.Mesh
    expect((otherBody.material as THREE.MeshLambertMaterial).color.getHexString()).toBe('6b1d1d')
    expect(body.material).not.toBe(otherBody.material)
    releaseAircraft(aircraft)
    releaseAircraft(other)
  })

  it('shares geometries and materials across instances', () => {
    const a = createAircraft('b738', LIVERY)
    const b = createAircraft('b738', LIVERY)
    const bus = createAircraft('a320neo', LIVERY)
    const fighter = createAircraft('f15', LIVERY)
    expect(fuselageGeo(a)).toBe(fuselageGeo(b))
    expect(fuselageGeo(a)).toBe(fuselageGeo(bus))
    expect(fuselageGeo(a)).not.toBe(fuselageGeo(fighter))
    const wingA = mid(a).getObjectByName('wing') as THREE.Mesh
    const wingB = mid(b).getObjectByName('wing') as THREE.Mesh
    expect(wingA.geometry).toBe(wingB.geometry)
    const bodyA = mid(a).getObjectByName('fuselage') as THREE.Mesh
    const bodyB = mid(b).getObjectByName('fuselage') as THREE.Mesh
    expect(bodyA.material).toBe(bodyB.material)
    const windows = high(a).getObjectByName('windows') as THREE.InstancedMesh
    expect(windows.isInstancedMesh).toBe(true)
    expect(windows.count).toBeGreaterThan(10)
    releaseAircraft(a)
    releaseAircraft(b)
    releaseAircraft(bus)
    releaseAircraft(fighter)
  })

  it('release keeps the shared geometry usable', () => {
    const first = createAircraft('e175', LIVERY)
    const geo = fuselageGeo(first)
    const uuid = geo.uuid
    releaseAircraft(first)
    const second = createAircraft('e175', LIVERY)
    expect(fuselageGeo(second).uuid).toBe(uuid)
    expect(fuselageGeo(second).getAttribute('position').count).toBeGreaterThan(0)
    releaseAircraft(second)
  })

  it('puts nav, strobe, and beacon lamps on the mid mesh', () => {
    const aircraft = createAircraft('b789', LIVERY)
    const found = names(mid(aircraft))
    expect(found.has('nav-port')).toBe(true)
    expect(found.has('nav-starboard')).toBe(true)
    expect(found.has('nav-tail')).toBe(true)
    expect(found.has('strobe')).toBe(true)
    expect(found.has('beacon')).toBe(true)
    releaseAircraft(aircraft)
  })

  it('crossfades LOD weights without a hard step', () => {
    let prev = lodWeights(0)
    expect(prev.high).toBeGreaterThan(0.95)
    expect(prev.mid).toBeGreaterThan(0.95)
    expect(prev.low).toBeLessThan(0.05)
    for (let d = 0; d <= 160; d += 1) {
      const w = lodWeights(d)
      expect(w.high + w.low).toBeLessThanOrEqual(1.001)
      expect(w.mid + w.low).toBeCloseTo(1, 5)
      expect(Math.abs(w.high - prev.high)).toBeLessThan(0.08)
      expect(Math.abs(w.mid - prev.mid)).toBeLessThan(0.08)
      expect(Math.abs(w.low - prev.low)).toBeLessThan(0.08)
      prev = w
    }
    const zoomed = lodWeights(LOD_DIST.high - 4)
    const normal = lodWeights(88)
    const far = lodWeights(LOD_DIST.low + 8)
    expect(zoomed.high).toBeGreaterThan(0.95)
    expect(normal.high).toBeLessThan(0.05)
    expect(normal.mid).toBeGreaterThan(0.95)
    expect(normal.low).toBeLessThan(0.05)
    expect(far.low).toBeGreaterThan(0.95)
    expect(far.mid).toBeLessThan(0.05)
    expect(far.high).toBeLessThan(0.05)
  })

  it('switches visibility from the camera distance on first update', () => {
    const aircraft = createAircraft('a359', LIVERY)
    updateAircraft(aircraft, false)
    const lod = aircraft.getObjectByName('lod') as CrossfadeLOD
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 40, 140)
    camera.updateMatrixWorld()
    aircraft.updateMatrixWorld(true)
    lod.update(camera)
    expect(lod.buckets?.lowGroup.visible).toBe(true)
    expect(lod.buckets?.midGroup.visible).toBe(false)
    expect(lod.buckets?.highGroup.visible).toBe(false)
    const gear = mid(aircraft).getObjectByName('gear') as THREE.Group
    expect(gear.scale.y).toBeLessThan(0.05)

    const close = createAircraft('a359', LIVERY)
    const closeLod = close.getObjectByName('lod') as CrossfadeLOD
    camera.position.set(0, 12, 24)
    camera.updateMatrixWorld()
    close.updateMatrixWorld(true)
    closeLod.update(camera)
    expect(closeLod.buckets?.highGroup.visible).toBe(true)
    expect(closeLod.buckets?.midGroup.visible).toBe(true)
    expect(closeLod.buckets?.lowGroup.visible).toBe(false)
    releaseAircraft(aircraft)
    releaseAircraft(close)
  })

  it('stays cheap at distance and shares a small geometry pool', () => {
    const made: THREE.Group[] = []
    for (const spec of Object.values(MODEL_SPECS)) made.push(createAircraft(spec.id, LIVERY))
    const narrow = made.find((g) => g.userData.airframeId === 'b738')!
    const lowTris = triangleCount(narrow.getObjectByName('lod-low')!)
    const midTris = triangleCount(narrow.getObjectByName('lod-mid')!)
    const highTris = triangleCount(narrow.getObjectByName('lod-high')!)
    expect(lowTris).toBeLessThan(midTris)
    expect(lowTris).toBeLessThan(900)
    expect(midTris).toBeLessThan(3500)
    expect(highTris).toBeLessThan(2500)
    expect(drawCount(narrow.getObjectByName('lod-low')!)).toBeLessThan(24)
    expect(libraryStats().geometries).toBeLessThan(160)
    expect(libraryStats().materials).toBeLessThan(40)
    for (const aircraft of made) releaseAircraft(aircraft)
  })

  it('fuselage and wing normals face outward', () => {
    const loft = loftGeometry('tube', 8)
    const pos = loft.getAttribute('position')
    const nor = loft.getAttribute('normal')
    let dot = 0
    let n = 0
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const radial = y * y + z * z
      if (radial < 0.15) continue
      dot += nor.getY(i) * y + nor.getZ(i) * z
      n++
    }
    expect(dot / n).toBeGreaterThan(0.2)

    const wing = wingGeometry(36, 6, 1.6, 25, 6, 0.5)
    const wpos = wing.getAttribute('position')
    const wnor = wing.getAttribute('normal')
    let top = 0
    let topN = 0
    for (let i = 0; i < wpos.count; i++) {
      if (wpos.getY(i) < 0.2) continue
      top += wnor.getY(i)
      topN++
    }
    expect(top / topN).toBeGreaterThan(0.05)
  })
})
