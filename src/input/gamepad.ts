/**
 * Standard Gamepad snapshot → how hard each action is held, and which
 * press-actions just went down. Axes use a deadzone. Buttons report 0..1.
 */
import { ACTIONS, type ActionId, type Binding } from './actions.ts'
import type { BindingTable } from './bindings.ts'

export interface PadButton {
  pressed: boolean
  value: number
}

export interface PadSnap {
  axes: readonly number[]
  buttons: readonly PadButton[]
}

const DEAD = 0.18

export function padAxisValue(binding: Binding, snap: PadSnap): number {
  if (binding.device !== 'pad') return 0
  if (binding.control === 'button') {
    const button = snap.buttons[binding.index]
    if (!button) return 0
    if (button.value > 0) return Math.min(1, button.value)
    return button.pressed ? 1 : 0
  }
  const raw = snap.axes[binding.index] ?? 0
  const signed = raw * binding.sign
  if (signed <= DEAD) return 0
  return Math.min(1, (signed - DEAD) / (1 - DEAD))
}

export function actionPadValue(bindings: readonly Binding[], snap: PadSnap): number {
  let best = 0
  for (const binding of bindings) best = Math.max(best, padAxisValue(binding, snap))
  return best
}

/** Press actions whose gamepad button is down this snapshot. */
export function padButtonsDown(table: BindingTable, snap: PadSnap): ActionId[] {
  const down: ActionId[] = []
  for (const action of ACTIONS) {
    if (action.hold) continue
    const held = (table[action.id] ?? []).some((binding) => binding.device === 'pad' && binding.control === 'button' && padAxisValue(binding, snap) > 0.4)
    if (held) down.push(action.id)
  }
  return down
}

/** Newly pressed gamepad button, for rebinding. Null when nothing rose. */
export function newlyPressedButton(prev: readonly boolean[], snap: PadSnap): number | null {
  for (let i = 0; i < snap.buttons.length; i++) {
    const down = (snap.buttons[i]?.value ?? 0) > 0.4 || Boolean(snap.buttons[i]?.pressed)
    if (down && !prev[i]) return i
  }
  return null
}

export function buttonDownFlags(snap: PadSnap): boolean[] {
  return snap.buttons.map((button) => (button?.value ?? 0) > 0.4 || Boolean(button?.pressed))
}
