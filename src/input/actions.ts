/**
 * Named actions and their default bindings. Keys use KeyboardEvent.code.
 * Gamepad indexes follow the Standard Gamepad map.
 */

export type ActionGroup = 'Camera' | 'Speed' | 'Tools' | 'Menu' | 'Views' | 'System'

export type KeyBinding = { device: 'key'; code: string }
export type WheelBinding = { device: 'wheel'; dir: 'in' | 'out' }
export type PadButtonBinding = { device: 'pad'; control: 'button'; index: number }
export type PadAxisBinding = { device: 'pad'; control: 'axis'; index: number; sign: 1 | -1 }

export type Binding = KeyBinding | WheelBinding | PadButtonBinding | PadAxisBinding

export interface ActionDef {
  id: string
  label: string
  group: ActionGroup
  /** Hold actions are sampled every frame. Press actions fire once. */
  hold: boolean
  defaults: Binding[]
}

const key = (code: string): KeyBinding => ({ device: 'key', code })
const wheel = (dir: 'in' | 'out'): WheelBinding => ({ device: 'wheel', dir })
const button = (index: number): PadButtonBinding => ({ device: 'pad', control: 'button', index })
const axis = (index: number, sign: 1 | -1): PadAxisBinding => ({ device: 'pad', control: 'axis', index, sign })

export const ACTIONS: readonly ActionDef[] = [
  { id: 'camera.panForward', label: 'Pan forward', group: 'Camera', hold: true, defaults: [key('KeyW'), key('ArrowUp'), axis(1, -1)] },
  { id: 'camera.panBack', label: 'Pan back', group: 'Camera', hold: true, defaults: [key('KeyS'), key('ArrowDown'), axis(1, 1)] },
  { id: 'camera.panLeft', label: 'Pan left', group: 'Camera', hold: true, defaults: [key('KeyA'), key('ArrowLeft'), axis(0, -1)] },
  { id: 'camera.panRight', label: 'Pan right', group: 'Camera', hold: true, defaults: [key('KeyD'), key('ArrowRight'), axis(0, 1)] },
  { id: 'camera.rotateLeft', label: 'Rotate left', group: 'Camera', hold: true, defaults: [key('KeyQ'), axis(2, -1)] },
  { id: 'camera.rotateRight', label: 'Rotate right', group: 'Camera', hold: true, defaults: [key('KeyE'), axis(2, 1)] },
  { id: 'camera.zoomIn', label: 'Zoom in', group: 'Camera', hold: true, defaults: [wheel('in'), key('Equal'), axis(3, -1), button(7)] },
  { id: 'camera.zoomOut', label: 'Zoom out', group: 'Camera', hold: true, defaults: [wheel('out'), key('Minus'), axis(3, 1), button(6)] },
  { id: 'speed.pause', label: 'Pause clock', group: 'Speed', hold: false, defaults: [key('Space')] },
  { id: 'speed.1', label: 'Speed 1×', group: 'Speed', hold: false, defaults: [key('Digit1')] },
  { id: 'speed.3', label: 'Speed 3×', group: 'Speed', hold: false, defaults: [key('Digit2')] },
  { id: 'speed.5', label: 'Speed 5×', group: 'Speed', hold: false, defaults: [key('Digit3')] },
  { id: 'tool.rotate', label: 'Rotate piece', group: 'Tools', hold: false, defaults: [key('KeyR')] },
  { id: 'ui.back', label: 'Cancel tool or menu', group: 'Menu', hold: false, defaults: [key('Escape'), button(1)] },
  { id: 'ui.menu', label: 'Open menu', group: 'Menu', hold: false, defaults: [button(9)] },
  { id: 'ui.select', label: 'Select', group: 'Menu', hold: false, defaults: [button(0)] },
  { id: 'view.hall', label: 'Terminal view', group: 'Views', hold: false, defaults: [key('KeyH')] },
  { id: 'view.photo', label: 'Photo mode', group: 'Views', hold: false, defaults: [key('KeyP')] },
  { id: 'view.airlines', label: 'Airlines desk', group: 'Views', hold: false, defaults: [key('KeyL')] },
  { id: 'view.flows', label: 'Flow overlay', group: 'Views', hold: false, defaults: [key('KeyF')] },
  { id: 'system.graphics', label: 'Graphics quality', group: 'System', hold: false, defaults: [key('F8')] },
]

export type ActionId = (typeof ACTIONS)[number]['id']

const BY_ID = new Map(ACTIONS.map((action) => [action.id, action]))

export function actionDef(id: string): ActionDef | undefined {
  return BY_ID.get(id)
}

export function isActionId(id: string): id is ActionId {
  return BY_ID.has(id)
}

export const ACTION_GROUPS: ActionGroup[] = ['Camera', 'Speed', 'Tools', 'Menu', 'Views', 'System']

const KEY_NAMES: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Equal: '+',
  Minus: '−',
  F8: 'F8',
}

const PAD_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right']

const PAD_AXES: [string, string][] = [
  ['Left stick left', 'Left stick right'],
  ['Left stick up', 'Left stick down'],
  ['Right stick left', 'Right stick right'],
  ['Right stick up', 'Right stick down'],
]

export function keyLabel(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`
  return code
}

export function bindingLabel(binding: Binding): string {
  if (binding.device === 'key') return keyLabel(binding.code)
  if (binding.device === 'wheel') return binding.dir === 'in' ? 'Wheel up' : 'Wheel down'
  if (binding.control === 'button') return PAD_BUTTONS[binding.index] ?? `Button ${binding.index}`
  const pair = PAD_AXES[binding.index]
  if (!pair) return `Axis ${binding.index} ${binding.sign > 0 ? '+' : '−'}`
  return binding.sign < 0 ? pair[0] : pair[1]
}

export function bindingKey(binding: Binding): string {
  if (binding.device === 'key') return `key:${binding.code}`
  if (binding.device === 'wheel') return `wheel:${binding.dir}`
  if (binding.control === 'button') return `pad:b:${binding.index}`
  return `pad:a:${binding.index}:${binding.sign}`
}

export function sameBinding(a: Binding, b: Binding): boolean {
  return bindingKey(a) === bindingKey(b)
}
