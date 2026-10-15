import { icaoRank, standAccepts, type IcaoCode } from '../render/aircraft/stands.ts'
import { ASPHALT_AIRFRAMES, GRASS_AIRFRAMES, RUNG_LETTER } from './catalog.ts'
import type { StandRung, StandSize } from './types.ts'

const GRASS = new Set<string>(GRASS_AIRFRAMES)
const ASPHALT = new Set<string>(ASPHALT_AIRFRAMES)

export function letterOf(size: StandSize, rung: StandRung): IcaoCode {
  return RUNG_LETTER[size][rung]
}

/**
 * Who may park. A smaller aircraft may use a larger pad.
 * Grass and asphalt narrow the list inside the letter.
 * Helicopters stay on the pad.
 */
export function standAllows(size: StandSize, rung: StandRung, airframeId: string, icao: IcaoCode): boolean {
  if (icao === 'H') return false
  const letter = letterOf(size, rung)
  if (!standAccepts(letter, icao)) return false
  if (size === 'light' && rung === 0) return GRASS.has(airframeId)
  if (size === 'narrow' && rung === 0 && icaoRank(icao) >= icaoRank('C')) return ASPHALT.has(airframeId)
  return true
}
