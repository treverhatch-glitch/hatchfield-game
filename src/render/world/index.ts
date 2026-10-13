/**
 * Hatchfield world render layer (Slice E). See docs/GRAPHICS.md for wiring.
 *
 *   const wr = initWorldRender(world.scene, 'med', { renderer: world.renderer, sun: world.sun })
 *   // each frame, after World.rebuildTiles(game):
 *   wr.hideLegacyTiles(world.tilesGroup, game)
 *   wr.update(game, world.camera, dt)
 */
import type * as THREE from 'three'
import type { QualityLevel } from './quality'
import { WorldRenderer, type WorldRenderOptions } from './render'

export { QUALITY, parseQuality, suggestQuality, type QualityLevel, type QualityPreset } from './quality'
export { REPLACED_TILES, WorldRenderer, type RendererLike, type WorldRenderOptions, type WorldRenderStats } from './render'
export { simClockToHour, skyState, type SkyState } from './daylight'
export type { WorldView } from './view'
export {
  HALL_NODE_ROOM,
  NAV_SQ,
  PUBLIC_ROOMS,
  ROOM_LABEL,
  STERILE_ROOMS,
  canStep,
  navPath,
  pointInRoom,
  roomAt,
  roomEdges,
  squareAt,
  type Door,
  type Room,
  type RoomKind,
  type RoomPlan,
  type Wall,
} from './rooms'

export type WorldRender = WorldRenderer

export function initWorldRender(
  scene: THREE.Scene,
  quality: QualityLevel = 'med',
  opts: WorldRenderOptions = {},
): WorldRender {
  return new WorldRenderer(scene, quality, opts)
}
