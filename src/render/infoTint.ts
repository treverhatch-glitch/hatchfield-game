/**
 * Recolours apron cells for the active info view.
 * Traffic keeps the landside layer. This file never writes sim state.
 */
import * as THREE from 'three'
import { CELL } from './aircraft/specs.ts'
import { SIZE } from '../game/types.ts'
import type { TintCell } from '../info/types.ts'

function atCell(c: number, r: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3((c - (SIZE - 1) / 2) * CELL, y, (r - (SIZE - 1) / 2) * CELL)
}

export class InfoTint {
  readonly group = new THREE.Group()
  private tiles = new Map<string, THREE.Mesh>()
  private tileGeo: THREE.PlaneGeometry | null = null

  sync(cells: readonly TintCell[]): void {
    this.tileGeo ??= new THREE.PlaneGeometry(1, 1)
    const span = CELL * 0.86
    const seen = new Set<string>()
    for (const spot of cells) {
      seen.add(spot.id)
      let tile = this.tiles.get(spot.id)
      if (!tile) {
        tile = new THREE.Mesh(
          this.tileGeo,
          new THREE.MeshBasicMaterial({
            color: spot.color,
            transparent: true,
            opacity: spot.opacity,
            depthWrite: false,
          }),
        )
        tile.rotation.x = -Math.PI / 2
        tile.renderOrder = 2
        this.tiles.set(spot.id, tile)
        this.group.add(tile)
      }
      const mat = tile.material as THREE.MeshBasicMaterial
      mat.color.set(spot.color)
      mat.opacity = spot.opacity
      tile.position.copy(atCell(spot.c, spot.r, 0.24))
      tile.scale.set(span, span, 1)
      tile.visible = true
    }
    for (const [id, tile] of this.tiles) {
      if (!seen.has(id)) tile.visible = false
    }
  }

  dispose(): void {
    this.sync([])
    this.tileGeo?.dispose()
    this.tileGeo = null
    for (const tile of this.tiles.values()) {
      const mat = tile.material
      if (!Array.isArray(mat)) mat.dispose()
      this.group.remove(tile)
    }
    this.tiles.clear()
  }
}
