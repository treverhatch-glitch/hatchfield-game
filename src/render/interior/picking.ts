/**
 * Hall picking. A service point (`lane-0`, a fitting id) beats a placed
 * `item:` id when one click hits both. The nearest centre wins inside a class.
 */
import type * as THREE from 'three'

export function pickedFacilityId(hits: readonly { id: string; fromCenter: number }[]): string | null {
  let metric: { id: string; fromCenter: number } | null = null
  let item: { id: string; fromCenter: number } | null = null
  for (const hit of hits) {
    if (!hit.id) continue
    const fitting = hit.id.startsWith('item:')
    const best = fitting ? item : metric
    if (best && hit.fromCenter >= best.fromCenter) continue
    if (fitting) item = hit
    else metric = hit
  }
  return metric?.id ?? item?.id ?? null
}

/** Walk parents until a mesh names the fitting or service point it belongs to. */
export function facilityIdOf(obj: THREE.Object3D | null): string | null {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    const id = cur.userData.facilityId
    if (typeof id === 'string' && id) return id
    cur = cur.parent
  }
  return null
}

/**
 * First facility under the ray. Service volumes and pick boxes both qualify.
 * Ranked so a live lane wins over a fitting box when the ray hits both.
 */
export function pickFacilityId(
  ray: THREE.Raycaster,
  objects: readonly THREE.Object3D[],
  scratch: THREE.Vector3,
): string | null {
  if (!objects.length) return null
  const hits = ray.intersectObjects(objects as THREE.Object3D[], true)
  const ranked: { id: string; fromCenter: number }[] = []
  for (const hit of hits) {
    const id = facilityIdOf(hit.object)
    if (!id) continue
    const origin = hit.object.getWorldPosition(scratch)
    ranked.push({ id, fromCenter: hit.point.distanceToSquared(origin) })
  }
  return pickedFacilityId(ranked)
}
