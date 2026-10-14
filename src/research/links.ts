import { nodeById } from './nodes.ts'
import { CATEGORIES } from './config.ts'

/**
 * Build tray ids that deep-link into the tree. Starter stamps stay off this
 * list so the opening kit is not gated twice.
 */
export const BUILD_LINKS: Readonly<Record<string, string>> = {
  stand_w: 'airfield-3',
  stand_l: 'airfield-3',
  runway_heavy: 'airfield-4',
  tower: 'airfield-5',
  code_e: 'airfield-6',
  hangar_j: 'airfield-6',
  prefab_ii: 'terminal-2',
  travelator: 'terminal-3',
  jet_bridge: 'terminal-4',
  skywalk: 'terminal-5',
  mover: 'terminal-6',
  people_mover: 'terminal-6',
  kitchen: 'airside-2',
  depot: 'airside-3',
  hangar_w: 'airside-4',
  mro: 'airside-5',
  nighthub: 'airside-6',
  fuel_rail: 'airside-6',
  security_hall: 'safety-4',
  hotel_biz: 'landside-2',
  rail: 'landside-5',
  airport_hotel: 'landside-6',
  saf_blending: 'spec-green-1',
}

export interface BuildLink {
  nodeId: string
  /** "Large stands (Airfield T3)" */
  label: string
}

export function linkFor(buildId: string): BuildLink | null {
  const nodeId = BUILD_LINKS[buildId]
  if (!nodeId) return null
  const node = nodeById(nodeId)
  if (!node) return null
  const category = CATEGORIES.find((row) => row.id === node.category)
  return { nodeId, label: `${node.name} (${category?.label ?? node.category} T${node.tier})` }
}

export function researchRequirement(buildId: string): string | null {
  const link = linkFor(buildId)
  return link ? `Requires research: ${link.label}.` : null
}
