/**
 * Building materials from src/build/materialTargets: wall, roof, trim and door
 * colours and roughness per building type, with the Gemini photo maps on
 * Medium and up. Materials are made per mesh (the tile layer disposes them on
 * rebuild); the photo textures are shared by the registry and never disposed here.
 * UVs are rewritten in metres so photos tile at real scale on any box or tank.
 */
import * as THREE from 'three'
import { MATERIAL_TARGETS, SKIN_TILE_M, YARD_TEXTURE, type BuildingTargetId } from '../../build/materialTargets'
import { artTexture, photoTexturesEnabled, type ArtTextureId } from './textureRegistry'
import { exteriorTexture, type ExteriorArtId } from './exteriorArt'
import { landingTexture } from './landingArt'
import type { QualityLevel } from './quality'

export type SkinPart = 'wall' | 'roof' | 'trim' | 'door'

/** Map tile -> building material target. Every building tile drawn by World.building is listed. */
export const TILE_TARGET: Partial<Record<string, BuildingTargetId>> = {
  terminal: 'terminal',
  bags: 'baggage_hall',
  fuel: 'fuel_farm',
  oil: 'fuel_farm',
  saf: 'fuel_farm',
  fire: 'fire_station',
  cargo: 'cargo_terminal',
  nighthub: 'warehouse',
  tower: 'control_tower',
  hangar: 'hangar',
  mro: 'maintenance_shed',
  depot: 'ground_services',
  police: 'police_station',
  guard: 'guard_booth',
  snack: 'kiosk',
  kitchen: 'catering_kitchen',
  bus: 'transit_station',
  curb_lane: 'transit_station',
  taxi_rank: 'transit_station',
  termbus: 'transit_station',
  rail: 'transit_station',
  xferbus: 'transit_station',
  late_rail: 'transit_station',
  park_s: 'parking_garage',
  park_l: 'parking_garage',
  park_g: 'parking_garage',
  park_u: 'parking_garage',
  hotel: 'hotel',
  late_hotel: 'hotel',
  deice: 'deice_pad',
}

/** Full-res plates for the playtest exteriors. Graphics tier does not resize them. */
const EXTERIOR: Partial<Record<BuildingTargetId, Partial<Record<SkinPart, ExteriorArtId>>>> = {
  terminal: { wall: 'curtain', roof: 'membrane' },
  hangar: { wall: 'cladding', roof: 'membrane', door: 'cladding' },
  fuel_farm: { wall: 'tank', roof: 'tank' },
  fire_station: { wall: 'masonry', roof: 'membrane', door: 'bay' },
  control_tower: { wall: 'shaft', roof: 'membrane' },
}

const state = { photos: true, anisotropy: 4 }

/** Follow the graphics preset: Low keeps flat colours. */
export function setBuildingSkinQuality(level: QualityLevel, anisotropy: number) {
  state.photos = photoTexturesEnabled(level)
  state.anisotropy = anisotropy
}

export function buildingSkinPhotos(): boolean {
  return state.photos
}

function photo(id: ArtTextureId | null): THREE.Texture | null {
  return id && state.photos ? artTexture(id, state.anisotropy) : null
}

function exteriorMap(target: BuildingTargetId, part: SkinPart): THREE.Texture | null {
  if (part === 'wall' && state.photos) {
    if (target === 'terminal') return landingTexture('terminal_facade', state.anisotropy) ?? exteriorTexture('curtain', state.anisotropy)
    if (target === 'hotel') return landingTexture('hotel_facade', state.anisotropy)
  }
  const id = EXTERIOR[target]?.[part]
  return id ? exteriorTexture(id, state.anisotropy) : null
}

/**
 * A wall, roof, trim or door material for a building type. Walls and roofs
 * carry the photo map (it multiplies the target colour); trim and doors stay flat.
 */
export function skinMaterial(target: BuildingTargetId, part: SkinPart, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const t = MATERIAL_TARGETS[target]
  const roughness = part === 'roof' ? t.roofRoughness : part === 'wall' ? t.wallRoughness : 0.5
  const map = exteriorMap(target, part) ?? (part === 'wall' ? photo(t.wallTexture) : part === 'roof' ? photo(t.roofTexture) : null)
  // A photo multiplies the colour, so ease the target toward white to keep the same overall tone.
  const color = extra.color ?? t[part]
  const m = new THREE.MeshStandardMaterial({ roughness, map, ...extra, color: map ? tint(String(color instanceof THREE.Color ? `#${color.getHexString()}` : color), 0.35) : color })
  m.name = `skin:${target}:${part}`
  return m
}

/** A target colour eased toward white, for use as a multiplier over a photo or raster map. */
export function tint(hex: string, toWhite = 0.5): THREE.Color {
  return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), toWhite)
}

/** Gravel or dirt yard material for pads around industrial buildings. */
export function yardMaterial(kind: keyof typeof YARD_TEXTURE): THREE.MeshLambertMaterial {
  const y = YARD_TEXTURE[kind]
  const m = new THREE.MeshLambertMaterial({ color: y.color, map: photo(y.texture) })
  m.name = `yard:${kind}`
  return m
}

/** A photo-mapped flat material (conveyor belt, chevrons) with a fallback colour. */
export function photoMaterial(id: ArtTextureId, color: string, extra: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color, map: photo(id), ...extra })
  m.name = `photo:${id}`
  return m
}

/**
 * Box-projected UVs in metres: each vertex takes the two coordinates across
 * its dominant normal axis, so a photo repeats every `tileM` metres on any face.
 */
export function metreUv(geo: THREE.BufferGeometry, tileM: number, worldPerMeter = 1): THREE.BufferGeometry {
  const pos = geo.getAttribute('position')
  let nor = geo.getAttribute('normal')
  if (!nor) {
    geo.computeVertexNormals()
    nor = geo.getAttribute('normal')
  }
  const k = 1 / (tileM * worldPerMeter)
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i))
    const ay = Math.abs(nor.getY(i))
    const az = Math.abs(nor.getZ(i))
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    let u: number
    let v: number
    if (ay >= ax && ay >= az) {
      u = x
      v = z
    } else if (ax >= az) {
      u = z
      v = y
    } else {
      u = x
      v = y
    }
    uv[i * 2] = u * k
    uv[i * 2 + 1] = v * k
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

/** Cylinder UVs in metres: around the shell and up its height, no seam at 45 degrees. */
export function tankUv(geo: THREE.CylinderGeometry, tileM: number, worldPerMeter = 1): THREE.CylinderGeometry {
  const { radiusTop, radiusBottom, height } = geo.parameters
  const r = (radiusTop + radiusBottom) / 2
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const around = (2 * Math.PI * r) / (tileM * worldPerMeter)
  const up = height / (tileM * worldPerMeter)
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(nor.getY(i)) > 0.9) {
      // Caps: planar, in metres.
      uv.setXY(i, pos.getX(i) / (tileM * worldPerMeter), pos.getZ(i) / (tileM * worldPerMeter))
    } else uv.setXY(i, uv.getX(i) * around, uv.getY(i) * up)
  }
  uv.needsUpdate = true
  return geo
}

/** Shorthand: a box with metre UVs. */
export function skinBox(w: number, h: number, d: number, tileM: number = SKIN_TILE_M.wall, worldPerMeter = 1): THREE.BoxGeometry {
  return metreUv(new THREE.BoxGeometry(w, h, d), tileM, worldPerMeter) as THREE.BoxGeometry
}
