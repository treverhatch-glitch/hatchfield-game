import { describe, expect, it } from 'vitest'
import { defaultBindings } from './bindings.ts'
import { actionPadValue, newlyPressedButton, padAxisValue, padButtonsDown, type PadSnap } from './gamepad.ts'

function snap(axes: number[], pressed: number[] = []): PadSnap {
  const buttons = Array.from({ length: 16 }, (_, index) => ({
    pressed: pressed.includes(index),
    value: pressed.includes(index) ? 1 : 0,
  }))
  return { axes, buttons }
}

describe('gamepad actions', () => {
  it('ignores the stick deadzone and keeps the sign', () => {
    const left = { device: 'pad' as const, control: 'axis' as const, index: 0, sign: -1 as const }
    expect(padAxisValue(left, snap([0.1, 0, 0, 0]))).toBe(0)
    expect(padAxisValue(left, snap([-1, 0, 0, 0]))).toBeCloseTo(1)
    expect(padAxisValue(left, snap([1, 0, 0, 0]))).toBe(0)
  })

  it('maps the left stick to pan and the triggers to zoom', () => {
    const table = defaultBindings()
    const held = snap([0, -1, 0, 0])
    expect(actionPadValue(table['camera.panForward'], held)).toBeCloseTo(1)
    expect(actionPadValue(table['camera.panBack'], held)).toBe(0)
    const zoom = snap([0, 0, 0, 0], [7])
    expect(actionPadValue(table['camera.zoomIn'], zoom)).toBe(1)
  })

  it('edges press actions and reports a new button for rebinding', () => {
    const table = defaultBindings()
    const down = snap([0, 0, 0, 0], [9])
    expect(padButtonsDown(table, down)).toEqual(['ui.menu'])
    expect(newlyPressedButton([false, false], down)).toBe(9)
    expect(newlyPressedButton(Array.from({ length: 16 }, (_, i) => i === 9), down)).toBeNull()
  })
})
