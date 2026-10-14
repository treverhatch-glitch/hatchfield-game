import { describe, expect, it } from 'vitest'
import { lotCells, lotFrame } from '../build/footprints'
import { stampStarterKit } from './starterLayout'
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
})
