import { describe, expect, it } from 'vitest'
import { split1f } from '../terminalbuild/starter/split1f.ts'
import { buildNavGrid } from './grid.ts'
import { boardingTargets } from './facilities.ts'
import { BOARD, boardRoute, deplaneDelay } from './stages.ts'

describe('boarding method', () => {
  it('gives stairs, bus and bridge a different door and a different duration', () => {
    const layout = split1f()
    layout.doors = [...layout.doors, { x: 40, y: -1, dir: 'S', kind: 'gate_bridge' }]
    const grid = buildNavGrid(layout, layout.tileM ?? 1)
    const room = layout.rooms.find((r) => r.kind === 'gate')!.id
    const stairs = boardingTargets(grid, room, 'stairs')
    const bus = boardingTargets(grid, room, 'bus')
    const bridge = boardingTargets(grid, room, 'bridge')
    expect(stairs.length).toBeGreaterThan(0)
    expect(bus.length).toBeGreaterThan(0)
    expect(bridge.length).toBeGreaterThan(0)
    expect(bus.some((c) => !stairs.includes(c))).toBe(true)
    expect(bridge.some((c) => !stairs.includes(c))).toBe(true)
    expect(boardRoute('stairs').durationSec).toBe(BOARD.stairsSec)
    expect(boardRoute('bus').durationSec).toBe(BOARD.busSec)
    expect(boardRoute('bridge').durationSec).toBe(BOARD.bridgeSec)
    expect(boardRoute('stairs').door).toBe('gate_apron')
    expect(boardRoute('bus').door).toBe('gate_apron')
    expect(boardRoute('bridge').door).toBe('gate_bridge')
    expect(deplaneDelay('bus', 0)).toBe(BOARD.busSec)
    expect(deplaneDelay('bus', BOARD.busCapacity)).toBe(BOARD.busSec * 2)
    expect(deplaneDelay('stairs', BOARD.busCapacity)).toBe(BOARD.stairsSec)
  })
})
