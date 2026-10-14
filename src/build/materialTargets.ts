/**
 * Colour and material targets per building type. Single source for the roof, wall, trim and
 * door colours plus roughness and photo textures. Every apron building mesh reads these through
 * src/render/world/buildingSkin.ts (`TILE_TARGET` maps map tiles to a target), and the models in
 * src/build/models (on building-visuals) read the same values. Retune here, not in the models.
 * Depot, police, guard, MRO, night hub, hangar and parking colours follow the Oct 14 Gemini concepts.
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
  'police_station',
  'guard_booth',
  'kiosk',
  'catering_kitchen',
  'transit_station',
  'parking_garage',
  'hotel',
  'deice_pad',
] as const

export type BuildingTargetId = (typeof BUILDING_TARGET_IDS)[number]

export const MATERIAL_TARGETS: Record<BuildingTargetId, MaterialTarget> = {
  hangar: { roof: '#8e98a0', wall: '#d0d4d8', trim: '#2f5d8a', door: '#8a929a', wallRoughness: 0.55, roofRoughness: 0.45, wallTexture: 'hangar_cladding', roofTexture: 'roof_membrane' },
  fuel_farm: { roof: '#d7dbde', wall: '#e8ebed', trim: '#d1342c', door: '#5b6670', wallRoughness: 0.4, roofRoughness: 0.4, wallTexture: 'tank_steel', roofTexture: 'tank_steel' },
  cargo_terminal: { roof: '#7c8791', wall: '#b9c0c6', trim: '#e0a21b', door: '#3d4650', wallRoughness: 0.6, roofRoughness: 0.5, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
  fire_station: { roof: '#6b2a28', wall: '#d9d2c7', trim: '#c8262b', door: '#c8262b', wallRoughness: 0.7, roofRoughness: 0.6, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
  terminal: { roof: '#aab3ba', wall: '#dfe6eb', trim: '#1f3b57', door: '#4fa3c7', wallRoughness: 0.25, roofRoughness: 0.35, wallTexture: 'terminal_glass', roofTexture: 'roof_membrane' },
  control_tower: { roof: '#9aa5ad', wall: '#e6e9ec', trim: '#e8742a', door: '#33414d', wallRoughness: 0.3, roofRoughness: 0.4, wallTexture: 'terminal_glass', roofTexture: 'roof_membrane' },
  maintenance_shed: { roof: '#6a7278', wall: '#c8bca0', trim: '#3d6a8a', door: '#3a424c', wallRoughness: 0.65, roofRoughness: 0.55, wallTexture: 'hangar_cladding', roofTexture: 'roof_membrane' },
  baggage_hall: { roof: '#87929b', wall: '#c4cbd1', trim: '#e0a21b', door: '#3d4650', wallRoughness: 0.6, roofRoughness: 0.5, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
  ground_services: { roof: '#8a7c6c', wall: '#c6b8a0', trim: '#f2c200', door: '#4a4036', wallRoughness: 0.6, roofRoughness: 0.5, wallTexture: 'dock_floor', roofTexture: 'roof_membrane' },
  warehouse: { roof: '#3e3c38', wall: '#6a645c', trim: '#e0c878', door: '#3a3834', wallRoughness: 0.65, roofRoughness: 0.55, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
  police_station: { roof: '#2a3038', wall: '#3a4450', trim: '#d8e4f0', door: '#1c2430', wallRoughness: 0.6, roofRoughness: 0.55, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
  guard_booth: { roof: '#2e3430', wall: '#5e6858', trim: '#c9a227', door: '#2a3028', wallRoughness: 0.55, roofRoughness: 0.55, wallTexture: 'hangar_cladding', roofTexture: 'roof_membrane' },
  kiosk: { roof: '#b33a2a', wall: '#d9a441', trim: '#b33a2a', door: '#5b3a1a', wallRoughness: 0.55, roofRoughness: 0.5, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
  catering_kitchen: { roof: '#e8ddd0', wall: '#e07a3d', trim: '#f2d4b8', door: '#5b3a1a', wallRoughness: 0.5, roofRoughness: 0.45, wallTexture: 'warehouse_panels', roofTexture: 'roof_membrane' },
  transit_station: { roof: '#c9a227', wall: '#8a9aaa', trim: '#c9a227', door: '#2c3a46', wallRoughness: 0.4, roofRoughness: 0.45, wallTexture: 'terminal_glass', roofTexture: 'roof_membrane' },
  parking_garage: { roof: '#5a626a', wall: '#8a9098', trim: '#3a8fd4', door: '#1a2028', wallRoughness: 0.65, roofRoughness: 0.7, wallTexture: 'warehouse_panels', roofTexture: 'apron_concrete' },
  hotel: { roof: '#6a6e76', wall: '#d8d2c6', trim: '#2f5d8a', door: '#3a3f48', wallRoughness: 0.45, roofRoughness: 0.55, wallTexture: 'terminal_glass', roofTexture: 'roof_membrane' },
  deice_pad: { roof: '#e8eef4', wall: '#4aa8c8', trim: '#e8eef4', door: '#2a3a46', wallRoughness: 0.35, roofRoughness: 0.4, wallTexture: 'tank_steel', roofTexture: 'tank_steel' },
}

/** Hotel wall colour per grade; roughness and photo map come from the `hotel` target. */
export const HOTEL_WALL = { inn: '#c9b08a', business: '#c4b49a', resort: '#d8e0e8', airport: '#d8d2c4' } as const

/** Ground yards around industrial buildings: gravel, or dirt (gravel tinted brown) on building sites. */
export const YARD_TEXTURE = {
  gravel: { texture: 'gravel_yard', color: '#b8b4ac', tileM: 4 },
  dirt: { texture: 'gravel_yard', color: '#8a6e4c', tileM: 5 },
} as const satisfies Record<string, { texture: ArtTextureId; color: string; tileM: number }>

/**
 * Body colours taken from the Gemini parking concepts. Short/long-term accent
 * paint stays separate so the term still reads on the canopy and badge.
 */
export const PARK_PAINT = {
  park_s: { booth: '#e4e0d4', lot: '#4a5160' },
  park_l: { office: '#b8b2a6', lot: '#6a6860' },
  park_g: { lot: '#3a4550' },
  park_u: { portal: '#6e7884', mouth: '#161c28', lot: '#2a3038' },
} as const

/** Metres per photo repeat on walls, roofs and tanks. */
export const SKIN_TILE_M = { wall: 4, roof: 6, tank: 3, conveyor: 1.2, chevron: 1.5 } as const

export function materialTarget(id: BuildingTargetId): MaterialTarget {
  return MATERIAL_TARGETS[id]
}
