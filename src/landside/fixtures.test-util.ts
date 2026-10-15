import { stampStarterKit } from '../game/starterLayout.ts'
import { SIZE, type Tile } from '../game/types.ts'
import type { Cell, LandsideField } from './types.ts'

/** The passenger starter kit's road, guard and hall, as the landside sees them. */
export function starterField(patch: Partial<LandsideField> = {}): LandsideField {
  const tiles: Tile[][] = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 'grass' as Tile))
  stampStarterKit(tiles, 'pax')
  const roads: Cell[] = []
  const connectors: Cell[] = []
  const terminals: Cell[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const tile = tiles[r][c]
      if (tile === 'road') roads.push({ c, r })
      else if (tile === 'guard') connectors.push({ c, r })
      else if (tile === 'terminal') terminals.push({ c, r })
    }
  }
  return { roads, connectors, terminals, busBays: [], parks: [], rail: false, paxPerDay: 0, departures: 2, ...patch }
}
