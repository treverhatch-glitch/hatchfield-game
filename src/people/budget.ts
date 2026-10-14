/**
 * Draw-call and triangle accounting for a PeopleRenderer, used by the budget
 * test and the demo HUD. Counts what the GPU is asked to draw this frame.
 */
import * as THREE from 'three'
import type { PeopleRenderer } from './renderer.ts'

export interface PeopleBudget {
  draws: number
  triangles: number
}

/** Triangles per drawn part mesh, for finding what a budget is spent on. */
export function budgetByPart(renderer: PeopleRenderer): Record<string, number> {
  const out: Record<string, number> = {}
  for (const child of renderer.group.children) {
    const mesh = child as THREE.InstancedMesh
    if (!mesh.isInstancedMesh || mesh.count === 0) continue
    const geo = mesh.geometry
    out[mesh.name.replace('people-', '')] = (mesh.count * (geo.index ? geo.index.count : geo.getAttribute('position').count)) / 3
  }
  return out
}

export function measureBudget(renderer: PeopleRenderer): PeopleBudget {
  let draws = 0
  let triangles = 0
  for (const child of renderer.group.children) {
    const mesh = child as THREE.InstancedMesh
    if (!mesh.isInstancedMesh || mesh.count === 0) continue
    const geo = mesh.geometry
    draws++
    triangles += (mesh.count * (geo.index ? geo.index.count : geo.getAttribute('position').count)) / 3
  }
  return { draws, triangles }
}
