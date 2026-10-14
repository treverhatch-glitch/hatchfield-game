/** Pavement is not a building. Clicking it closes the panel. */
const NOT_A_BUILDING = new Set(['grass', 'runway', 'taxi'])

export function isBuildingTile(tile: string): boolean {
  return !NOT_A_BUILDING.has(tile)
}
