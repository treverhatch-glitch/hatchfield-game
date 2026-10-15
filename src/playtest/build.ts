import type { Tool } from '../game/types.ts'
import type { CommandResult, PlayerCommands } from './types.ts'

const HARD_STOP = /short |hold \$|needs field|need field|locked|already a construction|starter kit/i

/**
 * Move the ghost the way a player does, then click the first cell that looks legal.
 * One failure is recorded when nothing on the board will take the stamp.
 */
export function tryStamp(
  api: PlayerCommands,
  tool: Tool,
  rng: () => number,
): CommandResult {
  api.setView('apron')
  api.setTool(tool)
  const pool = api.candidates().slice()
  const tries = pool.length
  let last = 'no grass'
  for (let n = 0; n < tries; n++) {
    const index = Math.floor(rng() * pool.length)
    const cell = pool.splice(index, 1)[0]
    if (!cell) break
    const ghost = api.preview(tool, cell)
    if (ghost) {
      last = ghost
      continue
    }
    const clicked = api.clickTile(cell)
    if (clicked.ok) {
      if (tool === 'runway' || tool === 'runway_short' || tool === 'runway_heavy') api.connectRunway()
      return { ok: true, command: 'stamp', detail: `${tool} @ ${cell.c},${cell.r}` }
    }
    last = clicked.detail
    if (HARD_STOP.test(clicked.detail)) break
  }
  return { ok: false, command: 'stamp', detail: `${tool}: ${last}` }
}
