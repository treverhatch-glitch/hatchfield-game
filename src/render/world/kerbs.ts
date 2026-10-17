/**
 * Raised kerb paint. Kept off `layout.ts` so the sim's terminal clusters
 * do not load the ground-look palette.
 */
import { GROUND_LOOK } from '../look'
import { DIRS, DIR_VEC } from './layout'
import { CELL, cellX, cellZ, tileAt, type WorldView } from './view'

export interface KerbSeg {
  x: number
  z: number
  w: number
  d: number
  sidewalk?: boolean
}

/** Raised kerb on every road edge that does not continue into another road cell. */
export function roadKerbs(view: WorldView): KerbSeg[] {
  const out: KerbSeg[] = []
  const width = GROUND_LOOK.kerbW
  for (let r = 0; r < view.tiles.length; r++) {
    for (let c = 0; c < view.tiles[r].length; c++) {
      if (view.tiles[r][c] !== 'road') continue
      const x = cellX(c)
      const z = cellZ(r)
      for (const d of DIRS) {
        const t = tileAt(view, c + DIR_VEC[d].dc, r + DIR_VEC[d].dr)
        if (t === 'road') continue
        const v = DIR_VEC[d]
        const along = CELL * 0.9
        out.push({
          x: x + v.dc * CELL * 0.46,
          z: z + v.dr * CELL * 0.46,
          w: v.dc ? width : along,
          d: v.dr ? width : along,
        })
        if (t === 'terminal') {
          const swInner = CELL * 0.46 + width / 2
          const swOuter = CELL * 0.5
          const swCenter = (swInner + swOuter) / 2
          const swWidth = swOuter - swInner
          out.push({
            x: x + v.dc * swCenter,
            z: z + v.dr * swCenter,
            w: v.dc ? swWidth : along,
            d: v.dr ? swWidth : along,
            sidewalk: true,
          })
        }
      }
    }
  }
  return out
}
