import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { buildAircraft, createWindowMesh } from './build'
import { getAircraftQuality, lodWeights } from './lod'
import { bakeGeometry, bakeGroup } from './merge'
import { bindLiveryUniforms, resolveLiveryAirline } from './liveryTex'
import { liveryKey, releaseAircraft, sharedGeo, vertexMaterials } from './pool'
import { getAircraftSpec, type Livery } from './specs'

export interface ParkedPlane {
  id: string
  airframeId: string
  livery: Livery
  /** World matrix, including the meter-to-world scale. */
  matrix: THREE.Matrix4
}

interface Batch {
  mid: THREE.InstancedMesh
  low: THREE.InstancedMesh
  windows: THREE.InstancedMesh | null
  capacity: number
}

const _cam = new THREE.Vector3()
const _pos = new THREE.Vector3()

function shellGeometry(airframeId: string, livery: Livery, tier: 'low' | 'mid'): THREE.BufferGeometry {
  const spec = getAircraftSpec(airframeId)
  const key = `parked:${tier}:${spec.id}:${liveryKey(livery)}`
  return sharedGeo(key, () => {
    const built = buildAircraft(spec, tier, livery)
    const geometry = bakeGroup(built.group)
    releaseAircraft(built.group)
    return geometry
  })
}

function windowGeometry(airframeId: string, livery: Livery): THREE.BufferGeometry | null {
  const spec = getAircraftSpec(airframeId)
  if (!spec.windows || spec.family === 'helo') return null
  return sharedGeo(`windows:${spec.id}`, () => {
    const mesh = createWindowMesh(spec, livery)
    if (!mesh) return new THREE.BufferGeometry()
    const hex = (mesh.userData.paint as string) || '#1a3c52'
    const parts: THREE.BufferGeometry[] = []
    const instance = new THREE.Matrix4()
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, instance)
      parts.push(bakeGeometry(mesh.geometry, instance, hex))
    }
    mesh.dispose()
    const merged = mergeGeometries(parts)
    for (const part of parts) part.dispose()
    if (!merged) return new THREE.BufferGeometry()
    merged.computeBoundingSphere()
    return merged
  })
}

function makeInstances(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  capacity: number,
  airline: string | undefined,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, material, capacity)
  mesh.count = 0
  mesh.visible = false
  mesh.frustumCulled = true
  mesh.userData.airline = airline
  mesh.onBeforeRender = () => {
    const mat = mesh.material
    if (Array.isArray(mat)) return
    bindLiveryUniforms(mat, resolveLiveryAirline(mesh.userData.airline as string | undefined))
  }
  return mesh
}

/**
 * Identical parked airframes share one instanced shell per type and livery.
 * A single parked plane stays a normal aircraft so props can spin.
 */
export class ParkedFleet {
  readonly root = new THREE.Group()
  private batches = new Map<string, Batch>()

  constructor() {
    this.root.name = 'parked-fleet'
  }

  sync(planes: ParkedPlane[], camera: THREE.Camera) {
    const groups = new Map<string, ParkedPlane[]>()
    for (const plane of planes) {
      const key = `${plane.airframeId}|${liveryKey(plane.livery)}`
      const list = groups.get(key)
      if (list) list.push(plane)
      else groups.set(key, [plane])
    }
    const seen = new Set<string>()
    for (const [key, list] of groups) {
      seen.add(key)
      this.write(key, list, camera)
    }
    for (const [key, batch] of this.batches) {
      if (seen.has(key)) continue
      batch.mid.count = 0
      batch.low.count = 0
      batch.mid.visible = false
      batch.low.visible = false
      if (batch.windows) {
        batch.windows.count = 0
        batch.windows.visible = false
      }
    }
  }

  dispose() {
    for (const batch of this.batches.values()) {
      batch.mid.dispose()
      batch.low.dispose()
      batch.windows?.dispose()
    }
    this.batches.clear()
    this.root.clear()
  }

  private write(key: string, list: ParkedPlane[], camera: THREE.Camera) {
    const sample = list[0]
    let batch = this.batches.get(key)
    if (!batch || list.length > batch.capacity) {
      if (batch) {
        this.root.remove(batch.mid, batch.low)
        batch.mid.dispose()
        batch.low.dispose()
        if (batch.windows) {
          this.root.remove(batch.windows)
          batch.windows.dispose()
        }
      }
      const capacity = Math.max(4, list.length)
      const airline = sample.livery.airline
      const mid = makeInstances(
        shellGeometry(sample.airframeId, sample.livery, 'mid'),
        vertexMaterials('mid').opaque,
        capacity,
        airline,
      )
      const low = makeInstances(
        shellGeometry(sample.airframeId, sample.livery, 'low'),
        vertexMaterials('low').opaque,
        capacity,
        airline,
      )
      mid.castShadow = true
      const windowsGeo = windowGeometry(sample.airframeId, sample.livery)
      const windows =
        windowsGeo && windowsGeo.getAttribute('position')
          ? makeInstances(windowsGeo, vertexMaterials('mid').opaque, capacity, airline)
          : null
      this.root.add(mid, low)
      if (windows) this.root.add(windows)
      batch = { mid, low, windows, capacity }
      this.batches.set(key, batch)
    }

    _cam.setFromMatrixPosition(camera.matrixWorld)
    const zoom = (camera as THREE.PerspectiveCamera).zoom || 1
    let midCount = 0
    let lowCount = 0
    let windowCount = 0
    const midIds: string[] = []
    const lowIds: string[] = []
    const windowIds: string[] = []
    const showWindows = getAircraftQuality() === 'high'
    for (const plane of list) {
      _pos.setFromMatrixPosition(plane.matrix)
      const weights = lodWeights(_cam.distanceTo(_pos) / zoom)
      if (weights.low >= 0.98) {
        batch.low.setMatrixAt(lowCount, plane.matrix)
        lowIds.push(plane.id)
        lowCount += 1
      } else {
        batch.mid.setMatrixAt(midCount, plane.matrix)
        midIds.push(plane.id)
        midCount += 1
        if (batch.windows && showWindows && weights.high > 0.5) {
          batch.windows.setMatrixAt(windowCount, plane.matrix)
          windowIds.push(plane.id)
          windowCount += 1
        }
      }
    }
    batch.mid.userData.flightIds = midIds
    batch.low.userData.flightIds = lowIds
    if (batch.windows) batch.windows.userData.flightIds = windowIds
    commit(batch.mid, midCount)
    commit(batch.low, lowCount)
    if (batch.windows) commit(batch.windows, windowCount)
  }
}

function commit(mesh: THREE.InstancedMesh, count: number) {
  mesh.count = count
  mesh.visible = count > 0
  mesh.instanceMatrix.needsUpdate = true
  if (count > 0) mesh.computeBoundingSphere()
}
