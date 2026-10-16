/**
 * Bag and bridge sockets on a layout, in apron metres.
 * A bridge socket exists only where a `gate_bridge` door is cut in the facade.
 * S1 uses `gate_apron` until the player buys a bridge, so it publishes bag sockets only.
 */
import { SIZE } from '../game/types.ts'
import { layoutTileM } from './config.ts'
import { edgeTiles, outsideDoors } from './grid.ts'
import type { BuildLayout, Port } from './types.ts'

/** Real metres per apron cell. The same 22 m the apron uses. */
export const APRON_CELL_M = 22

export interface TerminalSocket {
  id: string
  kind: 'bag_out' | 'bag_in' | 'gate_bridge'
  /** `terminal:<hallId>:bag_out:<id>` for bag ports. Bridge sockets use the door. */
  socket: string
  /** Apron metres. */
  x: number
  z: number
}

function cellX(c: number): number {
  return (c - (SIZE - 1) / 2) * APRON_CELL_M
}

function cellZ(r: number): number {
  return (r - (SIZE - 1) / 2) * APRON_CELL_M
}

/**
 * World metres for bag ports and facade bridge doors.
 * The layout's north edge (y = 0) is the west face of the stamp.
 * Layout +x runs south along that face. Layout +y runs east, toward the curb.
 */
export function terminalSockets(
  layout: BuildLayout,
  origin: { c: number; r: number },
  hallId = 'starter',
): TerminalSocket[] {
  const tileM = layoutTileM(layout)
  const west = cellX(origin.c) - APRON_CELL_M / 2
  const north = cellZ(origin.r) - APRON_CELL_M / 2
  const out: TerminalSocket[] = []
  const place = (alongX: number, depthY: number): { x: number; z: number } => ({
    x: west + depthY * tileM,
    z: north + alongX * tileM,
  })
  for (const p of layout.ports ?? []) {
    const at = portPoint(p, tileM)
    const world = place(at.along, at.depth)
    out.push({
      id: p.id,
      kind: p.kind,
      socket: p.socket || `terminal:${hallId}:${p.kind}:${p.id}`,
      x: world.x,
      z: world.z,
    })
  }
  for (const { door, tile } of outsideDoors(layout, ['gate_bridge'])) {
    const along = door.dir === 'S' ? door.x + 0.5 : tile.x + 0.5
    const depth = door.dir === 'E' ? door.y + 0.5 : 0
    const world = place(along, depth)
    const id = `${door.x},${door.y},${door.dir}`
    out.push({
      id,
      kind: 'gate_bridge',
      socket: `terminal:${hallId}:gate_bridge:${id}`,
      x: world.x,
      z: world.z,
    })
  }
  return out
}

function portPoint(p: Port, tileM: number): { along: number; depth: number } {
  const [a, b] = edgeTiles(p.edge)
  const inside = a.x >= 0 && a.y >= 0 ? a : b
  if (p.edge.dir === 'E' && p.edge.x < 0) return { along: inside.y + 0.5, depth: 0 }
  if (p.edge.dir === 'S' && p.edge.y < 0) return { along: inside.x + 0.5, depth: 0 }
  return { along: inside.x + 0.5, depth: inside.y * tileM > 0 ? inside.y : 0 }
}
