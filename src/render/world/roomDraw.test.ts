import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { starterGame } from './fixtures'
import { terminals } from './layout'
import { hiddenRooms, roomSpheres, type RoomSphere } from './roomDraw'
import { makeTerminalShared, TerminalBuilding, FLOOR_Y, WALL_H } from './terminal'
import { makeTextures } from './textures'

function frustumOf(cam: THREE.PerspectiveCamera): THREE.Frustum {
  cam.updateMatrixWorld()
  return new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
  )
}

function building() {
  const game = starterGame()
  const info = terminals(game)[0]
  const textures = makeTextures(32, 1)
  const shared = makeTerminalShared(textures)
  const built = new TerminalBuilding(info, shared, { density: 1, walkersPerCell: 0, index: 0 })
  return { built, shared, textures, info }
}

describe('room draw budget', () => {
  it('keeps a room outside the frustum without blanking the terminal', () => {
    const rooms: RoomSphere[] = [
      { id: 0, x: 0, y: 1, z: 0, radius: 2 },
      { id: 1, x: 40, y: 1, z: 0, radius: 2 },
    ]
    const cam = new THREE.PerspectiveCamera(20, 1, 0.1, 12)
    cam.position.set(0, 2, 6)
    cam.lookAt(0, 1, 0)
    const hidden = hiddenRooms(rooms, new THREE.Matrix4(), frustumOf(cam))
    expect(hidden.has(1)).toBe(true)
    expect(hidden.has(0)).toBe(false)

    const away = new THREE.PerspectiveCamera(20, 1, 0.1, 4)
    away.position.set(0, 2, 80)
    away.lookAt(0, 2, 81)
    expect(hiddenRooms(rooms, new THREE.Matrix4(), frustumOf(away)).size).toBe(0)
  })

  it('merges the walls and instances signs and desks', () => {
    const { built, shared, textures } = building()
    const root = built.root
    const signs = ['shell-signs', 'room-sign'].map((name) => root.getObjectByName(name) as THREE.InstancedMesh)
    expect(signs.every((mesh) => mesh instanceof THREE.InstancedMesh)).toBe(true)
    const signInstances = signs.reduce((n, mesh) => n + mesh.count, 0)
    expect(signInstances).toBeGreaterThan(signs.length)

    const desks = root.children
      .flatMap((group) => group.children)
      .filter((obj) => obj.name === 'props-desks') as THREE.InstancedMesh[]
    expect(desks.length).toBe(0)

    expect(root.getObjectByName('room-walls')).toBeInstanceOf(THREE.InstancedMesh)
    expect(root.getObjectByName('room-glass')).toBeInstanceOf(THREE.InstancedMesh)
    expect(root.getObjectByName('room-walls-static')).toBeInstanceOf(THREE.Mesh)
    expect(root.getObjectByName('room-glass-static')).toBeInstanceOf(THREE.Mesh)
    expect(root.getObjectByName('room-walls-static')?.visible).toBe(true)
    expect(root.getObjectByName('room-walls')?.visible).toBe(false)

    const spheres = roomSpheres(built.rooms, FLOOR_Y + WALL_H * 0.5)
    const room = spheres[0]
    const cam = new THREE.PerspectiveCamera(12, 1, 0.1, room.radius + 6)
    cam.position.set(room.x, room.y + 1, room.z + room.radius + 2)
    cam.lookAt(room.x, room.y, room.z)
    built.update(cam.position, 1, 1, 0, { x: built.center.x, z: built.center.z }, false, cam)
    const budget = built.drawBudget()
    expect(budget.signMeshes).toBeLessThanOrEqual(2)
    expect(budget.staticWalls).toBe(1)
    expect(budget.staticGlass).toBe(1)
    expect(budget.hiddenRooms).toBeGreaterThan(0)
    expect(budget.hiddenRooms).toBeLessThan(built.rooms.rooms.length)
    expect(budget.deskInstances).toBe(0)
    expect(budget.signInstances).toBeLessThan(signInstances)

    built.dispose()
    shared.beam.dispose()
    textures.dispose()
  })
})
