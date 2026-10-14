/**
 * Round-7 polish pass, run on every vehicle building after `enrich`:
 *  - ground decals per service bay: painted bay box at the real vehicle size,
 *    a stop bar, a bay number and an oil/tyre stain where trucks stand;
 *  - bay signage: a lit number board on the facade the bay faces;
 *  - night lighting: one flood per bay registered in `userData.lamps` (LotLamps
 *    turns those into real lights) plus a small emissive fixture;
 *  - facade variety: corrugated seams + a darker weathering band on large plain walls,
 *    and roof HVAC with louvres on big flat roofs (skipped where plant already sits).
 * Everything is deterministic per model id and stays out of the bays (see bays.test).
 */
import * as THREE from 'three'
import { SERVICE_POINTS } from '../servicePoints'
import { FLEET_M, LARGEST, fromM, lotScale } from '../fleet'
import { M, box, mat, sign } from './kit'

const STAIN = () => mat('#2b2a28', { rough: 1, opacity: 0.35 })
const LINE = () => mat('#f2f2ee', { rough: 0.7 })
const BAYLINE = () => mat('#f2bf1f', { rough: 0.6 })

function flat(g: THREE.Object3D, w: number, d: number, m: THREE.Material, x: number, z: number, yaw: number, y = 0.128): THREE.Mesh {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m)
  p.rotation.set(-Math.PI / 2, 0, yaw)
  p.position.set(x, y, z)
  p.receiveShadow = true
  g.add(p)
  return p
}

/** Bay decals, number boards and floods for every service point of a model id. */
export function bayDressing(g: THREE.Group, id: string): number {
  const tile = (id.startsWith('hangar') ? 'hangar' : id) as keyof typeof SERVICE_POINTS
  const spec = SERVICE_POINTS[tile]
  if (!spec || tile === 'hangar' || tile === 'mro') return 0
  const s = lotScale(tile)
  const [L, H, W] = FLEET_M[LARGEST[spec.serves[0]]]
  const hl = fromM(L / 2 + 0.5, s)
  const hw = fromM(W / 2 + 0.6, s)
  const t = fromM(0.15, s)
  const lamps = (g.userData.lamps ??= []) as number[][]
  const head = 0.12 + fromM(H + 2.5, s) * (s / (0.55 + 0.45 * s))
  spec.points.forEach((p, i) => {
    const fx = Math.sin(p.heading)
    const fz = Math.cos(p.heading)
    // Box outline: two long sides + far end, open toward the approach.
    const yaw = Math.atan2(fx, fz)
    for (const side of [-1, 1]) {
      const sx = p.x + -fz * hw * side
      const sz = p.z + fx * hw * side
      flat(g, t, hl * 2, BAYLINE(), sx, sz, yaw)
    }
    flat(g, hw * 2, t, BAYLINE(), p.x + fx * hl, p.z + fz * hl, yaw)
    flat(g, hw * 1.6, t * 2.2, LINE(), p.x + fx * (hl - t * 3), p.z + fz * (hl - t * 3), yaw, 0.129) // stop bar
    // Stain where the engine / hose end stands, and tyre polish along the wheel tracks.
    flat(g, hw * 0.9, hl * 0.6, STAIN(), p.x + fx * hl * 0.3, p.z + fz * hl * 0.3, yaw, 0.127)
    // Bay number painted at the open end.
    const n = sign(g, `${i + 1}`, '#3a3d40', '#f2f2ee', hw * 0.9, hw * 0.9, p.x - fx * (hl - hw * 0.6), 0.131, p.z - fz * (hl - hw * 0.6))
    n.rotation.set(-Math.PI / 2, 0, yaw + Math.PI)
    // Flood: a light over the bay end, registered for LotLamps at night.
    lamps.push([p.x + fx * hl * 0.6, head, p.z + fz * hl * 0.6])
  })
  return spec.points.length
}

/** Plain big walls get seams + weathering; big flat roofs get HVAC. Deterministic per id. */
export function facadePolish(g: THREE.Group, id: string): number {
  g.updateMatrixWorld(true)
  const walls: { m: THREE.Mesh; b: THREE.Box3 }[] = []
  const roofs: THREE.Box3[] = []
  const plant: THREE.Box3[] = []
  for (const o of g.children) {
    const m = o as THREE.Mesh
    if (!m.isMesh || m.userData.anim || !(m.geometry instanceof THREE.BoxGeometry)) continue
    const b = new THREE.Box3().setFromObject(m)
    const sz = b.getSize(new THREE.Vector3())
    if (sz.y > 1.4 && sz.x > 2.5 && sz.z > 1.5 && b.min.y < 0.2) walls.push({ m, b })
    else if (sz.y < 1.2 && sz.x < 1.4 && sz.z < 1.4 && b.min.y > 1.5) plant.push(b)
  }
  for (const w of walls) roofs.push(w.b)
  let added = 0
  const seam = mat('#3c4248', { rough: 0.5, metal: 0.4 })
  const band = mat('#4a4640', { rough: 0.95, opacity: 0.28 })
  for (const { b } of walls) {
    const sz = b.getSize(new THREE.Vector3())
    // Vertical panel seams on the back face (the front already carries doors/glazing).
    const n = Math.min(14, Math.floor(sz.x / 0.55))
    for (let i = 1; i < n; i++) {
      box(g, 0.025, sz.y * 0.82, 0.02, seam, b.min.x + (sz.x / n) * i, b.min.y + sz.y * 0.06, b.min.z - 0.012)
      added++
    }
    // Rain-wash weathering band under the eave, all four sides.
    box(g, sz.x + 0.02, sz.y * 0.18, sz.z + 0.02, band, (b.min.x + b.max.x) / 2, b.max.y - sz.y * 0.2, (b.min.z + b.max.z) / 2)
    added++
  }
  // HVAC on the largest flat roof when it has no plant yet.
  const big = roofs.sort((a, b) => b.getSize(new THREE.Vector3()).x * b.getSize(new THREE.Vector3()).z - a.getSize(new THREE.Vector3()).x * a.getSize(new THREE.Vector3()).z)[0]
  if (big && !plant.some((p) => p.intersectsBox(big.clone().expandByScalar(0.3)))) {
    const top = big.max.y
    const cx = (big.min.x + big.max.x) / 2
    const cz = (big.min.z + big.max.z) / 2
    let h = 0
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    for (let k = 0; k < 3; k++) {
      const x = cx + ((k - 1) * (big.max.x - big.min.x)) / 4
      const z = cz + (((h >> k) & 1) ? 0.3 : -0.3)
      box(g, 0.7, 0.42, 0.55, mat('#c9ced3', { rough: 0.45, metal: 0.55 }), x, top, z)
      for (let j = 0; j < 4; j++) box(g, 0.02, 0.3, 0.5, M.darkSteel(), x - 0.27 + j * 0.18, top + 0.06, z)
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 14), mat('#2a2d31', { metal: 0.5 }))
      fan.position.set(x, top + 0.44, z)
      g.add(fan)
      added += 6
    }
  }
  return added
}
