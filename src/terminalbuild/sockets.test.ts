import { describe, expect, it } from 'vitest'
import { PAX_TERMINAL } from '../game/starterLayout.ts'
import { split1f } from './starter/split1f.ts'
import { terminalSockets } from './sockets.ts'

describe('terminal sockets', () => {
  it('publishes bag ports and keeps bridge sockets on gate_bridge doors', () => {
    const layout = split1f()
    const sockets = terminalSockets(layout, PAX_TERMINAL, 'starter')
    const bagOut = sockets.find((s) => s.kind === 'bag_out')
    const bagIn = sockets.find((s) => s.kind === 'bag_in')
    expect(bagOut?.socket).toBe('terminal:starter:bag_out:bag-out')
    expect(bagIn?.socket).toBe('terminal:starter:bag_in:bag-in')
    expect(Number.isFinite(bagOut?.x)).toBe(true)
    expect(Number.isFinite(bagOut?.z)).toBe(true)
    expect(sockets.filter((s) => s.kind === 'gate_bridge')).toHaveLength(0)

    const withBridge = split1f()
    withBridge.doors.push({ x: 40, y: -1, dir: 'S', kind: 'gate_bridge' })
    const bridged = terminalSockets(withBridge, PAX_TERMINAL, 'starter')
    expect(bridged.filter((s) => s.kind === 'gate_bridge')).toHaveLength(1)
    expect(bridged.find((s) => s.kind === 'gate_bridge')?.socket).toContain('terminal:starter:gate_bridge:')
  })
})
