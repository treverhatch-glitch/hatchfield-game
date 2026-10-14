/**
 * Default Hall camera. Tuned so the whole room stays inside a 16:9 and a 4:3
 * frame, and the shell fills that frame instead of sitting in a fog margin.
 */
import * as THREE from 'three'
import { HALL_D, HALL_W } from '../game/terminal'

export const HALL_CAMERA = {
  yaw: 0.45,
  pitch: 0.55,
  dist: 46,
  fov: 58,
  /** Shell wall height included in the framing box. */
  wall: 3.15,
}

export function hallCamera(aspect: number, pose = HALL_CAMERA): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(pose.fov, aspect, 0.1, 400)
  const x = Math.sin(pose.yaw) * Math.cos(pose.pitch) * pose.dist
  const y = Math.sin(pose.pitch) * pose.dist
  const z = Math.cos(pose.yaw) * Math.cos(pose.pitch) * pose.dist
  cam.position.set(x, y, z)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld()
  return cam
}

/** Largest absolute NDC coordinate of the room AABB. 1 is the frame edge. */
export function hallRoomEdge(aspect: number, pose = HALL_CAMERA): number {
  const cam = hallCamera(aspect, pose)
  let edge = 0
  for (const x of [-HALL_W / 2, HALL_W / 2]) {
    for (const y of [0, pose.wall]) {
      for (const z of [-HALL_D / 2, HALL_D / 2]) {
        const p = new THREE.Vector3(x, y, z).project(cam)
        edge = Math.max(edge, Math.abs(p.x), Math.abs(p.y))
      }
    }
  }
  return edge
}
