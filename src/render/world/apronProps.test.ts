import { describe, expect, it } from 'vitest'
import { blankView, rect } from './fixtures'
import { curbFurniture } from './apronProps'
import { elevatedLightGeo, insetLightGeo, makeWindsock } from './airfield'
import { buildVehicleParts } from '../vehicleModels'
import * as THREE from 'three'

describe('apron props', () => {
  it('puts benches and bins on the landside of a terminal', () => {
    const view = blankView([...rect(4, 4, 3, 2, 'terminal'), ...rect(4, 6, 3, 1, 'stand')])
    const dress = curbFurniture(view)
    expect(dress.benches.length).toBeGreaterThan(0)
    expect(dress.bins.length).toBeGreaterThan(0)
    expect(dress.benches.length + dress.bins.length).toBeGreaterThan(2)
  })

  it('builds an elevated can, a flush inset light, and a banded windsock with a beacon', () => {
    const elevated = elevatedLightGeo()
    elevated.computeBoundingBox()
    const inset = insetLightGeo()
    inset.computeBoundingBox()
    expect(elevated.boundingBox!.max.y).toBeGreaterThan(inset.boundingBox!.max.y * 4)
    const geos: THREE.BufferGeometry[] = []
    const mats: THREE.Material[] = []
    const sock = makeWindsock(geos, mats)
    const cloth = sock.getObjectByName('sock-cloth')
    expect(cloth).toBeTruthy()
    const colors = (cloth as THREE.Mesh).geometry.getAttribute('color')
    expect(colors.count).toBeGreaterThan(20)
    let orange = 0
    let white = 0
    for (let i = 0; i < colors.count; i++) {
      if (colors.getX(i) > 0.8 && colors.getY(i) < 0.6) orange++
      if (colors.getX(i) > 0.8 && colors.getY(i) > 0.8) white++
    }
    expect(orange).toBeGreaterThan(0)
    expect(white).toBeGreaterThan(0)
    expect(sock.getObjectByName('beacon-lamp')).toBeTruthy()
    elevated.dispose()
    inset.dispose()
    for (const g of geos) g.dispose()
    for (const m of mats) m.dispose()
  })

  it('puts an LD3 on the dolly and a pallet on the loader', () => {
    const dolly = buildVehicleParts('uld_dolly', '#ffffff')
    expect(dolly.some((p) => p.name === 'cargo')).toBe(true)
    const loader = buildVehicleParts('k_loader', '#ffffff')
    const rear = loader.filter((p) => p.name === 'rear_platform')
    expect(rear.length).toBeGreaterThan(4)
    for (const p of [...dolly, ...loader]) p.geo.dispose()
  })
})
