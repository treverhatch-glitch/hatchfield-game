/**
 * Grok texture pack 1. Files are the full 960² JPEGs. High quality uses them
 * as stored. Med and low draw a smaller copy from the texture-quality setting.
 */
import * as THREE from 'three'
import { WORLD_PER_METER } from '../aircraft/specs'
import type { QualityLevel } from '../world/quality'

export const PACK1_DIR = '/assets/pack1'

export const PACK1_FILES = {
  wall: 'tex_wall_panel_cream_v1.jpg',
  glass: 'tex_glass_curtainwall_v1.jpg',
  oak: 'tex_wood_oak_v1.jpg',
  steel: 'tex_steel_brushed_v1.jpg',
  rubber: 'tex_floor_rubber_studded_v1.jpg',
  shopWood: 'tex_wood_shop_v1.jpg',
  fabric: 'tex_fabric_seat_v1.jpg',
  carpet: 'tex_carpet_gate_navy.jpg',
} as const

/** How many real metres one copy of the tile covers. */
export const PACK1_REPEAT_M = {
  wall: 4.8,
  glass: 4.2,
  oak: 0.85,
  steel: 0.45,
  rubber: 1.1,
  shopWood: 1.6,
  fabric: 0.32,
  carpet: 1.8,
} as const

export type Pack1File = keyof typeof PACK1_FILES

/** Null means keep the file's own pixels. */
export function pack1Edge(level: QualityLevel): number | null {
  if (level === 'high') return null
  if (level === 'med') return 256
  return 128
}

export function pack1Url(file: Pack1File, root = PACK1_DIR): string {
  const base = root.endsWith('/') ? root.slice(0, -1) : root
  return `${base}/${PACK1_FILES[file]}`
}

/** Apron world units for one tile. The hall shell is already in metres. */
export function packWorldRepeat(meters: number): number {
  return meters * WORLD_PER_METER
}

/**
 * Tile from the mesh position so a scaled wall does not stretch one copy
 * across its whole face. Instanced beams use the instance scale.
 */
export function tileByPosition(mat: THREE.Material, repeat: number) {
  const units = repeat > 0 ? repeat : 1
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
       #ifdef USE_MAP
         vec3 tilePos = position;
         #ifdef USE_INSTANCING
           tilePos = vec3(
             dot(position, instanceMatrix[0].xyz),
             dot(position, instanceMatrix[1].xyz),
             dot(position, instanceMatrix[2].xyz)
           );
         #endif
         vec3 n = abs(normal);
         vec2 tileUv = n.y >= n.x && n.y >= n.z ? tilePos.xz : (n.x >= n.z ? tilePos.zy : tilePos.xy);
         vMapUv = tileUv / ${units.toFixed(5)};
       #endif`,
    )
  }
  mat.customProgramCacheKey = () => `pack1-tile-${units.toFixed(5)}`
}
