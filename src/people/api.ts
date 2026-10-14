/**
 * Static meshes for one person. Terminal work can drop these into a scene
 * without owning an instanced renderer; crowds should use PeopleRenderer.
 */
import * as THREE from 'three'
import { emitPerson, partGeometry } from './parts.ts'
import { samplePose } from './pose.ts'
import type { CrewKind, PersonLook, PersonPose } from './types.ts'
import { crewLook, passengerLook, type CrewOptions, type PassengerOptions } from './variants.ts'

export interface PersonMeshOptions {
  pose?: PersonPose
  /** Walk phase in cycles. */
  phase?: number
  /** Ground speed in m/s used for stride amplitude. */
  speed?: number
  /** Detail level: 0 full, 1 simple, 2 block. */
  lod?: 0 | 1 | 2
  /** World units per metre. */
  scale?: number
}

const materials = new Map<number, THREE.MeshLambertMaterial>()

function materialFor(hex: number): THREE.MeshLambertMaterial {
  let m = materials.get(hex)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: hex, vertexColors: true })
    materials.set(hex, m)
  }
  return m
}

export function createPersonMesh(look: PersonLook, opts: PersonMeshOptions = {}): THREE.Group {
  const group = new THREE.Group()
  group.name = look.crew ? `crew-${look.crew}` : 'passenger'
  group.userData.look = look
  const joints = samplePose(opts.pose ?? 'idle', opts.phase ?? look.phase, opts.speed ?? 1.2)
  emitPerson(look, opts.lod ?? 0, joints, 0, 0, 0, 0, opts.scale ?? 1, (def, matrix, hex) => {
    const mesh = new THREE.Mesh(partGeometry(def), materialFor(hex))
    mesh.name = def.id
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(matrix)
    group.add(mesh)
  })
  return group
}

export function createPassengerMesh(seed: string | number, opts: PersonMeshOptions & PassengerOptions = {}): THREE.Group {
  return createPersonMesh(passengerLook(seed, opts), opts)
}

export function createCrewMesh(kind: CrewKind, seed: string | number, opts: PersonMeshOptions & CrewOptions = {}): THREE.Group {
  return createPersonMesh(crewLook(kind, seed, opts), opts)
}
