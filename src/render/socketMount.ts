/** Empty named sockets. Parents keep their own scale; positions are model metres. */
import * as THREE from 'three'
import type { SocketTable } from './socketLayout'

export function mountSockets(parent: THREE.Object3D, table: SocketTable, groupName = 'sockets'): THREE.Group {
  const existing = parent.getObjectByName(groupName)
  if (existing) existing.removeFromParent()
  const g = new THREE.Group()
  g.name = groupName
  for (const [name, p] of Object.entries(table)) {
    const socket = new THREE.Object3D()
    socket.name = name
    socket.position.set(p[0], p[1], p[2])
    g.add(socket)
  }
  parent.add(g)
  return g
}
