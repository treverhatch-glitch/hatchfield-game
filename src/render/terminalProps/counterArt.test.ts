import { existsSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { PREFAB_SOCKETS } from '../../catering/supplyPath'
import { buildTerminalProps } from './index'
import { COUNTER_ORIGINALS, counterOriginalUrl } from './counterArt'
import { prefabCounterPlacements } from '../supplyCart'

describe('counter concept sheets', () => {
  it('keeps the full-resolution originals', () => {
    for (const kind of Object.keys(COUNTER_ORIGINALS) as (keyof typeof COUNTER_ORIGINALS)[]) {
      const path = `public/${counterOriginalUrl(kind)}`
      expect(existsSync(path), path).toBe(true)
      expect(statSync(path).size).toBeGreaterThan(10_000)
    }
  })

  it('puts counter_restock on the prefab food and shop sockets', () => {
    const group = buildTerminalProps(prefabCounterPlacements())
    group.updateMatrixWorld(true)
    const worlds: THREE.Vector3[] = []
    group.traverse((obj) => {
      if (obj.name === 'counter_restock') worlds.push(obj.getWorldPosition(new THREE.Vector3()))
    })
    expect(worlds).toHaveLength(2)
    const food = new THREE.Vector3(
      PREFAB_SOCKETS.food_counter_restock.x,
      PREFAB_SOCKETS.food_counter_restock.y,
      PREFAB_SOCKETS.food_counter_restock.z,
    )
    const shop = new THREE.Vector3(
      PREFAB_SOCKETS.shop_counter_restock.x,
      PREFAB_SOCKETS.shop_counter_restock.y,
      PREFAB_SOCKETS.shop_counter_restock.z,
    )
    expect(worlds.some((v) => v.distanceTo(food) < 0.02)).toBe(true)
    expect(worlds.some((v) => v.distanceTo(shop) < 0.02)).toBe(true)
  })
})