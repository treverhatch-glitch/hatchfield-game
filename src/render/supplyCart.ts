/**
 * Stores carts in the hall. Poses come from the sim. The mesh steps at most
 * 40 cm a frame, and the crate rides `cart_bed` until the unload, then it
 * walks onto `counter_restock`.
 */
import * as THREE from 'three'
import { PREFAB_SOCKETS, RESTOCK_STEP_M, type SupplyCartPose } from '../catering/supplyPath'
import { buildTerminalProps, type PropPlacement } from './terminalProps'
import { COUNTER_SOCKETS, STORES_CART_SOCKETS } from './socketLayout'
import { mountSockets } from './socketMount'

const _target = new THREE.Vector3()
const _crate = new THREE.Vector3()
const _local = new THREE.Vector3()

/** Where the prefab food and shop counters sit so `counter_restock` meets the socket. */
export function prefabCounterPlacements(): PropPlacement[] {
  const food = COUNTER_SOCKETS.shop_fastfood.counter_restock
  const shop = COUNTER_SOCKETS.shop_news.counter_restock
  return [
    {
      type: 'shop_fastfood',
      x: PREFAB_SOCKETS.food_counter_restock.x - food[0],
      z: PREFAB_SOCKETS.food_counter_restock.z - food[2],
      y: 0,
    },
    {
      type: 'shop_news',
      x: PREFAB_SOCKETS.shop_counter_restock.x - shop[0],
      z: PREFAB_SOCKETS.shop_counter_restock.z - shop[2],
      y: 0,
    },
  ]
}

function cartMesh(): { root: THREE.Group; crate: THREE.Mesh } {
  const root = new THREE.Group()
  root.name = 'stores_cart'
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 0.92),
    new THREE.MeshLambertMaterial({ color: '#f0c020' }),
  )
  body.position.set(0.1, 0.58, 0)
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.08, 0.78),
    new THREE.MeshLambertMaterial({ color: '#8a8f96' }),
  )
  bed.position.set(0.35, 0.96, 0)
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.55, 0.86),
    new THREE.MeshLambertMaterial({ color: '#c4553a' }),
  )
  nose.position.set(1.05, 0.62, 0)
  root.add(body, bed, nose)
  for (const [x, z] of [
    [0.55, 0.38],
    [0.55, -0.38],
    [-0.45, 0.38],
    [-0.45, -0.38],
  ] as const) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.1, 10),
      new THREE.MeshLambertMaterial({ color: '#2a2c30' }),
    )
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(x, 0.16, z)
    root.add(wheel)
  }
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.36, 0.42),
    new THREE.MeshLambertMaterial({ color: '#c48a3a' }),
  )
  crate.name = 'stores_crate'
  crate.position.set(0.55, 1.16, 0)
  root.add(crate)
  mountSockets(root, STORES_CART_SOCKETS)
  return { root, crate }
}

interface CartEntry {
  root: THREE.Group
  crate: THREE.Mesh
  at: THREE.Vector3
}

/** Back-of-house dock plus one mesh per runner. */
export class SupplyCartLayer {
  readonly group = new THREE.Group()
  readonly counters: THREE.Group
  private carts = new Map<string, CartEntry>()

  constructor() {
    this.group.name = 'supply-carts'
    const dock = new THREE.Group()
    dock.name = 'stores_dock'
    dock.position.set(PREFAB_SOCKETS.stores_dock.x, PREFAB_SOCKETS.stores_dock.y, PREFAB_SOCKETS.stores_dock.z)
    mountSockets(dock, { stores_dock: [0, 0, 0] })
    this.group.add(dock)
    this.counters = buildTerminalProps(prefabCounterPlacements(), { shadows: false })
    this.counters.name = 'hall-counters'
  }

  sync(poses: readonly SupplyCartPose[]): void {
    const seen = new Set<string>()
    for (const pose of poses) {
      seen.add(pose.id)
      let entry = this.carts.get(pose.id)
      if (!entry) {
        const built = cartMesh()
        built.root.position.set(pose.x, pose.y, pose.z)
        this.group.add(built.root)
        entry = { root: built.root, crate: built.crate, at: new THREE.Vector3(pose.x, pose.y, pose.z) }
        this.carts.set(pose.id, entry)
      }
      _target.set(pose.x, pose.y, pose.z)
      const hop = entry.at.distanceTo(_target)
      if (hop > RESTOCK_STEP_M) entry.at.lerp(_target, RESTOCK_STEP_M / hop)
      else entry.at.copy(_target)
      entry.root.position.copy(entry.at)
      entry.root.rotation.y = pose.yaw - Math.PI / 2
      if (pose.unloadU <= 0) {
        entry.crate.position.set(0.55, 1.16, 0)
      } else {
        entry.root.updateMatrixWorld()
        _crate.set(pose.crateX, pose.crateY, pose.crateZ)
        entry.crate.position.copy(entry.root.worldToLocal(_local.copy(_crate)))
      }
    }
    for (const [id, entry] of this.carts) {
      if (seen.has(id)) continue
      entry.root.removeFromParent()
      this.carts.delete(id)
    }
  }
}
