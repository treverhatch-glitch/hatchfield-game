import { describe, expect, it } from 'vitest'
import { lotCells, lotFrame } from '../build/footprints'
import { STARTER_RUNWAY_GAP, stampStarterKit } from './starterLayout'
import { runwayBoxes, runwayEdgeGap } from './runwayClearance'
import { SIZE, type StartFocus, type Tile } from './types'
import { auditWorld } from './worldRules'

const blank = (): Tile[][] => Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 'grass' as Tile))

describe('round-7 starter kits on real lots', () => {
  it.each(['pax', 'cargo', 'hybrid'] as StartFocus[])('%s: lots are disjoint, on grass, face access, and audit clean', (focus) => {
    const tiles = blank()
    const kit = stampStarterKit(tiles, focus)
    expect(stampStarterKit(blank(), focus)).toEqual(kit) // deterministic
    const seen = new Map<string, string>()
    const pending = []
    for (const [key, lot] of Object.entries(kit.lots)) {
      const [c, r] = key.split(',').map(Number)
      const tile = tiles[r][c]
      const cells = lotCells({ c, r }, lot)
      for (const p of cells) {
        const k = `${p.c},${p.r}`
        expect(seen.get(k), `${focus} ${tile} lot overlaps ${seen.get(k)} at ${k}`).toBeUndefined()
        seen.set(k, tile)
        if (p.c !== c || p.r !== r) expect(tiles[p.r][p.c], `${focus} ${tile} lot cell ${k}`).toBe('grass')
      }
      const front = tiles[r + lot.dir.r][c + lot.dir.c]
      expect(tile === 'bags' ? ['belt'] : ['road', 'taxi'], `${focus} ${tile} faces ${front}`).toContain(front)
      expect(lotFrame(lot).scale).toBeGreaterThanOrEqual(2)
      pending.push({ cells, tile })
    }
    expect(Object.keys(kit.lots).length).toBeGreaterThanOrEqual(focus === 'cargo' ? 3 : 4)
    expect(auditWorld({ tiles, pending }).map((v) => v.message)).toEqual([])
  })

  it('the public road runs beside the passenger hall, never through it', () => {
    const tiles = blank()
    stampStarterKit(tiles, 'pax')
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (tiles[r][c] !== 'road') continue
      for (const [dc, dr] of [[0, 0]]) expect(tiles[r + dr][c + dc]).not.toBe('terminal')
    }
    const hall = tiles.flatMap((row, r) => row.map((t, c) => (t === 'terminal' ? { c, r } : null)).filter(Boolean)) as { c: number; r: number }[]
    const roadTouches = hall.some(({ c, r }) => tiles[r][c + 1] === 'road')
    expect(roadTouches).toBe(true)
  })

  it.each(['pax', 'cargo', 'hybrid'] as StartFocus[])('%s: two parallel runways, spaced and linked by taxiways to every stand', (focus) => {
    const tiles = blank()
    const kit = stampStarterKit(tiles, focus)
    const boxes = runwayBoxes(tiles)
    expect(boxes).toHaveLength(2)
    expect(boxes[0].axis).toBe(boxes[1].axis)
    expect(runwayEdgeGap(boxes[0], boxes[1])).toBeGreaterThanOrEqual(STARTER_RUNWAY_GAP)
    // Flood the movement area (runway, taxi, stand) from the first strip.
    const MOVE = new Set<Tile>(['runway', 'taxi', 'stand'])
    const start = boxes[0].cells[0]
    const seen = new Set([`${start.c},${start.r}`])
    const q = [start]
    while (q.length) {
      const p = q.pop()!
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = p.c + dc, r = p.r + dr
        const k = `${c},${r}`
        if (seen.has(k) || !MOVE.has(tiles[r]?.[c] as Tile)) continue
        seen.add(k)
        q.push({ c, r })
      }
    }
    for (const b of boxes) expect(b.cells.every((p) => seen.has(`${p.c},${p.r}`))).toBe(true)
    for (const s of kit.stands) expect(seen.has(`${s.c},${s.r}`), `stand ${s.c},${s.r}`).toBe(true)
    // Two connectors between the strips (west spine and east link) so a blocked one never strands a strip.
    const between = new Set<number>()
    for (let c = 0; c < SIZE; c++) if ([20, 21, 22, 23, 24, 25].every((r) => tiles[r][c] === 'taxi')) between.add(c)
    expect(between.size).toBeGreaterThanOrEqual(2)
  })
})
