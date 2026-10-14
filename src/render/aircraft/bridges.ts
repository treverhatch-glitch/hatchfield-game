import * as THREE from 'three'
import { sharedMat, unitBox, unitCylinder } from './pool'
import { aircraftWorldPerMeter, getAircraftSpec } from './specs'
import { bridgeStops } from './stands'

function mat(color: string): THREE.Material {
  return sharedMat(`bridge:${color}`, () => new THREE.MeshLambertMaterial({ color }))
}

/**
 * Jet bridges in aircraft space (nose +X, port +Z), scaled into the world.
 * Cab floor sits on the doorway sill from the pack door station.
 * The terminal agent should add this group only while the aircraft is parked at a jetway.
 */
/** `side` is +1 on the port doors and -1 when the terminal sits to starboard. */
export function createBridges(airframeId: string, side: 1 | -1 = 1): THREE.Group {
  const spec = getAircraftSpec(airframeId)
  const root = new THREE.Group()
  root.name = 'bridges'
  root.userData.side = side
  root.scale.setScalar(aircraftWorldPerMeter())
  const glass = mat('#7ec3e8')
  const shell = mat('#d5dde4')
  const steel = mat('#5c6b78')
  for (const stop of bridgeStops(spec)) {
    const skin = spec.rx + 0.2
    const cab = new THREE.Mesh(unitBox(), glass)
    cab.name = stop.upper ? 'bridge-upper' : 'bridge'
    cab.scale.set(stop.cabW, stop.cabH, 1.6)
    cab.position.set(stop.x, stop.cabY, side * (skin + 0.8))
    root.add(cab)
    const tunnel = new THREE.Mesh(unitBox(), shell)
    tunnel.name = 'bridge-tunnel'
    tunnel.scale.set(stop.cabW * 0.86, stop.cabH * 0.78, stop.tunnelM)
    const anchor = side * (skin + 1.6)
    tunnel.position.set(stop.x, stop.cabY, anchor + side * (stop.tunnelM / 2))
    tunnel.userData.restScaleZ = stop.tunnelM
    tunnel.userData.anchor = anchor
    tunnel.userData.side = side
    root.add(tunnel)
    const footZ = side * (skin + 1.6 + stop.tunnelM)
    const column = new THREE.Mesh(unitCylinder(6), steel)
    column.name = 'bridge-column'
    column.scale.set(0.28, Math.max(0.4, stop.sillM), 0.28)
    column.position.set(stop.x, stop.sillM / 2, footZ)
    column.userData.anchor = anchor
    column.userData.restScaleZ = stop.tunnelM
    column.userData.side = side
    root.add(column)
  }
  return root
}
