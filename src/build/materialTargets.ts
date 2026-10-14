/**
 * Colour and material targets per building type. Single source for the roof, wall, trim and
 * door colours plus roughness, so the models in src/build/models (on building-visuals) read the
 * same values instead of scattering literals. Values are hand-matched to the Gemini building
 * concept renders; retune here, not in the models.
 */
import type { ArtTextureId } from '../render/world/textureRegistry'

export interface MaterialTarget {
  roof: string
  wall: string
  trim: string
  door: string
  /** PBR roughness 0 (mirror) to 1 (matte) for wall, roof. */
  wallRoughness: number
  roofRoughness: number
  wallTexture: ArtTextureId
  roofTexture: ArtTextureId
}

export const BUILDING_TARGET_IDS = [
  'hangar',
  'fuel_farm',
  'cargo_terminal',
  'fire_station',
  'terminal',
  'control_tower',
  'maintenance_shed',
  'baggage_hall',
  'ground_services',
  'warehouse',
] as const

export type BuildingTargetId = (typeof BUILDING_TARGET_IDS)[number]

export const MATERIAL_TARGETS: Record<BuildingTargetId, MaterialTarget> = {
  hangar: { roof: '#8d99a3', wall: '#c9d0d5', trim: '#2f5d8a', door: '#9aa5ad', wallRoughness: 0.55, roofRoughness: 0.45, wallTexture: 'hangar_cladding', roofTexture: 'roof_membrane' },
  fuel_farm: { roof: '#d7dbde', wall: '#e8ebed', trim: '#d1342c', door: '#5b6670', wallRoughness: 0.4, roofRoughness: 0.4, wallTexture: 'tank_steel', roofTexture: 'tank_steel' },
  cargo_terminal: { roof: '#7c8791', wall: '#b9c0c6', trim: '#e0a21b', door: '#3d4650', wallRoughness: 0.6, roofRoughness: 0.5, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
  fire_station: { roof: '#6b2a28', wall: '#d9d2c7', trim: '#c8262b', door: '#c8262b', wallRoughness: 0.7, roofRoughness: 0.6, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
  terminal: { roof: '#aab3ba', wall: '#dfe6eb', trim: '#1f3b57', door: '#4fa3c7', wallRoughness: 0.25, roofRoughness: 0.35, wallTexture: 'terminal_glass', roofTexture: 'roof_membrane' },
  control_tower: { roof: '#9aa5ad', wall: '#e6e9ec', trim: '#e8742a', door: '#33414d', wallRoughness: 0.3, roofRoughness: 0.4, wallTexture: 'terminal_glass', roofTexture: 'roof_membrane' },
  maintenance_shed: { roof: '#7a838b', wall: '#a9b2b9', trim: '#e0a21b', door: '#46535e', wallRoughness: 0.65, roofRoughness: 0.55, wallTexture: 'hangar_cladding', roofTexture: 'roof_membrane' },
  baggage_hall: { roof: '#87929b', wall: '#c4cbd1', trim: '#e0a21b', door: '#3d4650', wallRoughness: 0.6, roofRoughness: 0.5, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
  ground_services: { roof: '#848f98', wall: '#bfc6cc', trim: '#f2c200', door: '#4a5660', wallRoughness: 0.6, roofRoughness: 0.5, wallTexture: 'dock_floor', roofTexture: 'roof_membrane' },
  warehouse: { roof: '#7f8a93', wall: '#aeb6bd', trim: '#2f5d8a', door: '#56626c', wallRoughness: 0.65, roofRoughness: 0.55, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
}

export function materialTarget(id: BuildingTargetId): MaterialTarget {
  return MATERIAL_TARGETS[id]
}
