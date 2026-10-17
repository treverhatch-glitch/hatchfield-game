import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createAircraft, disposeAircraftLibrary, releaseAircraft } from './factory'
import { FIN_UV, LIVERY_ART, engineUv, finChordAt, outwardUv, projectedUv } from './liveryUv'
import { bakeGeometry } from './merge'

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

  it('flips starboard U so a left-to-right title reads outward', () => {
    const box = { x0: 20, x1: -20, y0: 0, y1: 4 }
    const port = outwardUv(10, 2, -1, box)
    const starboard = outwardUv(10, 2, 1, box)
    expect(port[0] + starboard[0]).toBeCloseTo(1)
    expect(port[1]).toBeCloseTo(starboard[1])
    expect(outwardUv(20, 2, -1, box)[0]).toBeCloseTo(0)
    expect(outwardUv(20, 2, 1, box)[0]).toBeCloseTo(1)
  })

  it('bakes the starboard flip onto fuselage UVs', () => {
    const baked = bakeGeometry(new THREE.BoxGeometry(2, 2, 2), new THREE.Matrix4(), undefined, {
      mode: 'fuselage',
      box: { x0: 1, x1: -1, y0: -1, y1: 1 },
    })
    const pos = baked.getAttribute('position')
    const uv = baked.getAttribute('liveryUv')
    let port = -1
    let star = -1
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i) - 1) > 1e-4 || Math.abs(pos.getY(i) - 1) > 1e-4) continue
      if (pos.getZ(i) < -0.5) port = uv.getX(i)
      if (pos.getZ(i) > 0.5) star = uv.getX(i)
    }
    expect(port).toBeCloseTo(0)
    expect(star).toBeCloseTo(1)
    baked.dispose()
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

describe('livery edges', () => {
  it('keeps procedural fins leading edge → trailing edge on both faces (mirror: false)', () => {
    const box = { x0: 2, x1: -2, y0: 0, y1: 4, mirror: false }
    const port = outwardUv(1.5, 2, -0.1, box)
    const starboard = outwardUv(1.5, 2, 0.1, box)
    expect(starboard[0]).toBeCloseTo(port[0])
    // Default (photographed plates) still flips so lettering reads outward.
    const flip = outwardUv(1.5, 2, 0.1, { x0: 2, x1: -2, y0: 0, y1: 4 })
    expect(flip[0] + port[0]).toBeCloseTo(1)
  })

  it('publishes the real fin outline in tail-plate UV', async () => {
    const { finGeometry } = await import('./geom')
    const geo = finGeometry('#ffffff', '#000000')
    const pos = geo.getAttribute('position')
    const box = { x0: 0.42, x1: -0.5, y0: 0, y1: 1 }
    let tipMin = 1
    let tipMax = 0
    for (let i = 0; i < pos.count; i++) {
      const [u, v] = projectedUv(pos.getX(i), pos.getY(i), box)
      if (v > 0.999) {
        tipMin = Math.min(tipMin, u)
        tipMax = Math.max(tipMax, u)
      }
      // Every fin vertex sits on or inside the published outline (no clamped, smeared texels).
      const [le, te] = finChordAt(v)
      expect(u).toBeGreaterThanOrEqual(le - 1e-6)
      expect(u).toBeLessThanOrEqual(te + 1e-6)
    }
    expect(tipMin).toBeCloseTo(FIN_UV.tipLead)
    expect(tipMax).toBeCloseTo(FIN_UV.tipTrail)
  })

  it('paints the rudder with the fin plate, aft on the trailing edge', () => {
    const plane = createAircraft('a320neo', { body: '#ffffff', stripe: '#1b8480', tail: '#1b8480' })
    const rudder = plane.getObjectByName('rudder') as THREE.Mesh
    const fin = plane.getObjectByName('lod-mid')!
    expect(rudder).toBeTruthy()
    const slot = rudder.geometry.getAttribute('liverySlot')
    const uv = rudder.geometry.getAttribute('liveryUv')
    expect(slot && uv).toBeTruthy()
    for (let i = 0; i < slot.count; i++) {
      expect(slot.getX(i)).toBe(1)
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0)
      expect(uv.getX(i)).toBeLessThanOrEqual(1)
    }
    // Rudder sits in the aft half of the fin chord (U > 0.5 on the port face).
    const pos = rudder.geometry.getAttribute('position')
    let mean = 0
    let n = 0
    for (let i = 0; i < uv.count; i++) {
      if (pos.getZ(i) >= 0) continue
      mean += uv.getX(i)
      n += 1
    }
    expect(n).toBeGreaterThan(0)
    expect(mean / n).toBeGreaterThan(0.5)
    expect(fin).toBeTruthy()
    releaseAircraft(plane)
    disposeAircraftLibrary()
  })
})
