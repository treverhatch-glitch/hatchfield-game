import * as THREE from 'three'
import { bridgeSocketTable } from '../socketLayout'
import { mountSockets } from '../socketMount'
import { sharedMat, unitBox, unitCylinder } from './pool'
import { aircraftWorldPerMeter, getAircraftSpec } from './specs'
import { bridgeStops } from './stands'

function mat(color: string): THREE.Material {
  return sharedMat(`bridge:${color}`, () => new THREE.MeshLambertMaterial({ color }))
}

/**
 * Jet bridges in aircraft space (nose +X, port +Z), scaled into the world.
 * The rotunda and the column sit at the terminal end of the tunnel.
 * The cab meets the doorway only when the bridge is fully extended.
 * `side` is +1 on the port doors and -1 when the terminal sits to starboard.
 * `doors` limits how many stops are built. Omit it to draw every door the airframe has.
 */
export function createBridges(airframeId: string, side: 1 | -1 = 1, doors?: number): THREE.Group {
  const spec = getAircraftSpec(airframeId)
  const root = new THREE.Group()
  root.name = 'bridges'
  root.userData.side = side
  const stops = bridgeStops(spec)
  const shown = doors == null ? stops : stops.slice(0, Math.max(0, Math.floor(doors)))
  root.userData.doors = doors ?? stops.length
  root.scale.setScalar(aircraftWorldPerMeter())
  const glass = mat('#7ec3e8')
  const shell = mat('#d5dde4')
  const steel = mat('#5c6b78')
  for (const stop of shown) {
    const skin = spec.rx + 0.2
    const doorZ = side * (skin + 0.8)
    const pivotZ = side * (skin + 1.6 + stop.tunnelM)
    const cab = new THREE.Mesh(unitBox(), glass)
    cab.name = stop.upper ? 'bridge-upper' : 'bridge'
    cab.scale.set(stop.cabW, stop.cabH, 1.6)
    cab.position.set(stop.x, stop.cabY, doorZ)
    cab.userData.pivotZ = pivotZ
    cab.userData.doorZ = doorZ
    cab.userData.side = side
    root.add(cab)
    const tunnel = new THREE.Mesh(unitBox(), shell)
    tunnel.name = 'bridge-tunnel'
    tunnel.scale.set(stop.cabW * 0.86, stop.cabH * 0.78, stop.tunnelM)
    tunnel.position.set(stop.x, stop.cabY, pivotZ - side * (stop.tunnelM / 2))
    tunnel.userData.restScaleZ = stop.tunnelM
    tunnel.userData.pivotZ = pivotZ
    tunnel.userData.side = side
    root.add(tunnel)
    const column = new THREE.Mesh(unitCylinder(6), steel)
    column.name = 'bridge-column'
    column.scale.set(0.28, Math.max(0.4, stop.sillM), 0.28)
    column.position.set(stop.x, stop.sillM / 2, pivotZ)
    column.userData.pivotZ = pivotZ
    column.userData.side = side
    root.add(column)
    const rotunda = new THREE.Mesh(unitCylinder(10), steel)
    rotunda.name = 'bridge-rotunda'
    rotunda.scale.set(0.9, Math.max(0.4, stop.sillM), 0.9)
    rotunda.position.set(stop.x, stop.sillM / 2, pivotZ)
    rotunda.userData.pivotZ = pivotZ
    rotunda.userData.side = side
    root.add(rotunda)
  }
  const sockets = bridgeSocketTable(spec, side)
  if (Object.keys(sockets).length) mountSockets(root, sockets)
  return root
}

/**
 * Extend from the terminal pivot toward the door.
 * 0 parks the cab on the rotunda. 1 docks it on the doorway.
 * The column and the rotunda do not move.
 */
export function applyBridge(root: THREE.Object3D, extend: number) {
  const u = Math.min(1, Math.max(0, extend))
  root.traverse((obj) => {
    const pivot = obj.userData.pivotZ
    if (typeof pivot !== 'number') return
    const side = obj.userData.side === -1 ? -1 : 1
    if (obj.name === 'bridge' || obj.name === 'bridge-upper') {
      const door = obj.userData.doorZ
      if (typeof door !== 'number') return
      obj.position.z = pivot + (door - pivot) * u
      return
    }
    if (obj.name === 'bridge-tunnel') {
      const rest = obj.userData.restScaleZ
      if (typeof rest !== 'number') return
      obj.visible = u > 0.04
      obj.scale.z = rest * Math.max(0.02, u)
      obj.position.z = pivot - side * (obj.scale.z / 2)
      return
    }
    if (obj.name === 'bridge-column' || obj.name === 'bridge-rotunda') {
      obj.position.z = pivot
    }
  })
}
