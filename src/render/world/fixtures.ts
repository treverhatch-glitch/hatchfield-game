import { Game } from '../../game/sim'
import { SIZE, type Tile } from '../../game/types'
import type { WorldView } from './view'

/** The real pax starter kit (runway, taxi spine, 3×3 hall, two jetway stands). */
export function starterGame(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

/** Blank grass map with painted tiles, for small layout tests. */
export function blankView(paint: [number, number, Tile][] = [], extra: Partial<WorldView> = {}): WorldView {
  const tiles: Tile[][] = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 'grass' as Tile))
  for (const [c, r, t] of paint) tiles[r][c] = t
  return { tiles, mapRev: 1, ...extra }
}

export function rect(c0: number, r0: number, w: number, h: number, t: Tile): [number, number, Tile][] {
  const out: [number, number, Tile][] = []
  for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) out.push([c, r, t])
  return out
}
