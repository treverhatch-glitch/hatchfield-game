import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyBridge, createBridges } from '../aircraft/bridges.ts'
import { buildJetBridges, poseApronBridge } from './airfield.ts'
import { unitBeam } from './kit.ts'
import { dockedJetBridge, type JetBridge } from './layout.ts'

describe('jet bridge docking', () => {
  it('extends the aircraft bridge from the terminal pivot, not the door', () => {
    const group = createBridges('b738', 1, 1)
    const cab = group.getObjectByName('bridge')
    const column = group.getObjectByName('bridge-column')
    const rotunda = group.getObjectByName('bridge-rotunda')
    expect(cab).toBeTruthy()
    expect(column).toBeTruthy()
    expect(rotunda).toBeTruthy()
    applyBridge(group, 1)
    const doorZ = cab!.position.z
    const pivotZ = column!.position.z
    expect(Math.abs(pivotZ)).toBeGreaterThan(Math.abs(doorZ))
    expect(rotunda!.position.z).toBeCloseTo(pivotZ)
    applyBridge(group, 0)
    expect(column!.position.z).toBeCloseTo(pivotZ)
    expect(rotunda!.position.z).toBeCloseTo(pivotZ)
    expect(cab!.position.z).toBeCloseTo(pivotZ)
    expect(Math.abs(cab!.position.z)).toBeGreaterThan(Math.abs(doorZ))
  })

  it('keeps the apron rotunda on the terminal while the cab docks', () => {
    const bridge: JetBridge = {
      stand: { c: 11, r: 6 },
      terminal: { c: 14, r: 8 },
      side: 'w',
      root: { x: 0, z: 0 },
      cab: { x: 12, z: 0 },
      cabY: 3,
      cabH: 2,
      cabW: 1.6,
    }
    const beam = unitBeam()
    const built = buildJetBridges([bridge], beam)
    const apron = built.group.getObjectByName('apron-bridge')
    expect(apron).toBeTruthy()
    const pivot = apron!.getObjectByName('bridge-pivot')
    const cab = apron!.getObjectByName('bridge-cab')
    const rotunda = apron!.getObjectByName('bridge-rotunda')
    expect(pivot).toBeTruthy()
    expect(cab).toBeTruthy()
    expect(rotunda).toBeTruthy()
    poseApronBridge(apron!, 0)
    const shut = cab!.position.distanceTo(pivot!.position)
    const rotundaAt = rotunda!.position.clone()
    poseApronBridge(apron!, 1)
    const open = cab!.position.distanceTo(pivot!.position)
    expect(pivot!.position.x).toBeCloseTo(bridge.root.x)
    expect(pivot!.position.z).toBeCloseTo(bridge.root.z)
    expect(rotunda!.position.x).toBeCloseTo(rotundaAt.x)
    expect(rotunda!.position.z).toBeCloseTo(rotundaAt.z)
    expect(open).toBeGreaterThan(shut + 4)
    expect(dockedJetBridge(bridge, 1).cab.x).toBeCloseTo(bridge.cab.x)
    beam.dispose()
    for (const mat of built.mats) mat.dispose()
    for (const geo of built.group.userData.geos as THREE.BufferGeometry[]) geo.dispose()
  })
})
