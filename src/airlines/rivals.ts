/**
 * Explicit rival pairs and alliances. Diplomacy still computes its own
 * rivals for the hub grant. This list is the one hub offers warn about.
 */
export const ROSTER_ALLIANCES: readonly (readonly string[])[] = [
  ['gulf_pearl', 'seoul_star'],
  ['aurora_nordic', 'baltic_breeze', 'fjord_atlantic'],
  ['royal_sakura', 'lotus_air'],
  ['himalaya_air', 'indus_airways'],
  ['rio_sol', 'andaman_hop'],
  ['saharan_freight', 'volga_cargo'],
  ['medevac_one', 'skyline_rescue'],
  ['monarch_holidays', 'pacific_isles'],
  ['air_flag_1', 'celtic_isle'],
]

export const ROSTER_RIVAL_PAIRS: readonly (readonly [string, string])[] = [
  ['gulf_pearl', 'zephyr_go'],
  ['gulf_pearl', 'tango_air'],
  ['gulf_pearl', 'aurora_nordic'],
  ['brisa', 'zephyr_go'],
  ['brisa', 'tango_air'],
  ['brisa', 'air_lowcost_1'],
  ['aurora_nordic', 'air_flag_1'],
  ['seoul_star', 'royal_sakura'],
  ['atlas_cargo', 'polar_freight'],
  ['atlas_cargo', 'ironclad_cargo'],
  ['polar_freight', 'air_cargo_1'],
  ['harbor_heli', 'island_heli'],
  ['suncharter', 'coral_coast'],
  ['cityhopper', 'alpine_swift'],
  ['kiwi_wings', 'pampas_air'],
  ['mekong_express', 'pampas_air'],
  ['rotorlink', 'island_heli'],
]

export function allianceOf(airlineId: string): readonly string[] {
  const group = ROSTER_ALLIANCES.find((row) => row.includes(airlineId))
  return group ? group.filter((id) => id !== airlineId) : []
}

/** Fierce pairs take a harder hub hit. Allies stay in ROSTER_ALLIANCES and are spared. */
export const FIERCE_PAIRS: readonly (readonly [string, string])[] = [
  ['gulf_pearl', 'aurora_nordic'],
  ['atlas_cargo', 'polar_freight'],
  ['brisa', 'zephyr_go'],
]

export type PairIntensity = 'ally' | 'fierce' | 'rival' | 'none'

export function pairIntensity(a: string, b: string): PairIntensity {
  if (allianceOf(a).includes(b) || allianceOf(b).includes(a)) return 'ally'
  const fierce = FIERCE_PAIRS.some(([left, right]) => (left === a && right === b) || (left === b && right === a))
  if (fierce) return 'fierce'
  if (rivalsOfRoster(a).includes(b)) return 'rival'
  return 'none'
}

export function rivalsOfRoster(airlineId: string): readonly string[] {
  const allies = new Set(allianceOf(airlineId))
  const out: string[] = []
  for (const [a, b] of ROSTER_RIVAL_PAIRS) {
    const other = a === airlineId ? b : b === airlineId ? a : null
    if (other && !allies.has(other) && !out.includes(other)) out.push(other)
  }
  return out
}
