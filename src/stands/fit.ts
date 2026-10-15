import { icaoRank, standAccepts, type IcaoCode } from '../render/aircraft/stands.ts'
import { ASPHALT_AIRFRAMES, GRASS_AIRFRAMES, RUNG_LETTER } from './catalog.ts'
import type { StandRung, StandSize } from './types.ts'

const GRASS = new Set<string>(GRASS_AIRFRAMES)
const ASPHALT = new Set<string>(ASPHALT_AIRFRAMES)

export function letterOf(size: StandSize, rung: StandRung): IcaoCode {
  return RUNG_LETTER[size][rung]
}

/**
 * Why this aircraft cannot use the pad. Null when it can.
 * A smaller aircraft may use a larger pad.
 * Grass and asphalt narrow the list inside the letter.
 * Helicopters stay on the pad.
 */
export function standAllowReason(
  size: StandSize,
  rung: StandRung,
  airframeId: string,
  icao: IcaoCode,
): string | null {
  if (icao === 'H') return 'Helicopters use a helipad.'
  const letter = letterOf(size, rung)
  if (!standAccepts(letter, icao)) return `Code ${icao} does not fit a code ${letter} stand.`
  if (size === 'light' && rung === 0 && !GRASS.has(airframeId)) {
    return 'Grass only takes the bush list. This aircraft needs pavement.'
  }
  if (size === 'narrow' && rung === 0 && icaoRank(icao) >= icaoRank('C') && !ASPHALT.has(airframeId)) {
    return 'Asphalt only takes the regional list. This aircraft needs concrete.'
  }
  return null
}

/** Who may park. Same answer as `standAllowReason`. */
export function standAllows(size: StandSize, rung: StandRung, airframeId: string, icao: IcaoCode): boolean {
  return standAllowReason(size, rung, airframeId, icao) == null
}
