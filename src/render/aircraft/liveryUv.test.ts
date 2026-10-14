import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createAircraft, disposeAircraftLibrary, releaseAircraft } from './factory'
import { LIVERY_ART, engineUv, projectedUv } from './liveryUv'

describe('airline livery UVs', () => {
  it('publishes the art sizes the strips are drawn to', () => {
    expect(LIVERY_ART.fuselage.w / LIVERY_ART.fuselage.h).toBeCloseTo(4)
    expect(LIVERY_ART.engine.w / LIVERY_ART.engine.h).toBeCloseTo(4)
    expect(LIVERY_ART.tail.w).toBe(LIVERY_ART.tail.h)
  })

  it('puts the nose at U 0 and the crown at V 1', () => {
    const box = { x0: 20, x1: -20, y0: 0, y1: 4 }
    const nose = projectedUv(20, 2, box)
    const tail = projectedUv(-20, 2, box)
    const crown = projectedUv(0, 4, box)
    const belly = projectedUv(0, 0, box)
    expect(nose[0]).toBeCloseTo(0)
    expect(tail[0]).toBeCloseTo(1)
    expect(crown[1]).toBeCloseTo(1)
    expect(belly[1]).toBeCloseTo(0)
  })

  it('wraps the cowling with the seam on local -X and the intake at V 0', () => {
    const seam = engineUv(-1, 0, 0)
    const intake = engineUv(0, -0.5, 1)
    const exhaust = engineUv(0, 0.5, 1)
    expect(seam[0]).toBeCloseTo(0)
    expect(intake[1]).toBeCloseTo(0)
    expect(exhaust[1]).toBeCloseTo(1)
    expect(engineUv(0, 0, 1)[0]).toBeGreaterThan(0.2)
    expect(engineUv(0, 0, 1)[0]).toBeLessThan(0.8)
  })

  it('bakes fuselage, tail, and engine slots onto the shell', () => {
    const aircraft = createAircraft('b738', { body: '#2f6f9a', stripe: '#e8eef5', airline: 'northline' })
    const shell = aircraft.getObjectByName('lod-mid')!.getObjectByName('airframe') as THREE.Mesh
    const slots = shell.geometry.getAttribute('liverySlot')
    const uvs = shell.geometry.getAttribute('liveryUv')
    expect(slots).toBeDefined()
    expect(uvs.itemSize).toBe(2)
    const seen = new Set<number>()
    for (let i = 0; i < slots.count; i += 12) seen.add(slots.getX(i))
    expect(seen.has(0)).toBe(true)
    expect(seen.has(1)).toBe(true)
    const nacelles = aircraft.getObjectByName('lod-mid')!.getObjectByName('nacelles') as THREE.Mesh
    const eng = nacelles.geometry.getAttribute('liverySlot')
    let engines = 0
    for (let i = 0; i < eng.count; i += 8) if (eng.getX(i) === 2) engines++
    expect(engines).toBeGreaterThan(0)
    expect(shell.userData.airline).toBe('northline')
    const paint = shell.material as THREE.Material
    expect(paint.userData.liveryInstalled).toBeUndefined()
    releaseAircraft(aircraft)
    disposeAircraftLibrary()
  })
})
