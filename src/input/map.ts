/**
 * Live action map. Hold actions are sampled each frame. Press actions fire
 * once. A capture takes the next key, wheel notch, or gamepad button.
 */
import {
  ACTIONS,
  type ActionId,
  type Binding,
  isActionId,
} from './actions.ts'
import {
  readBindings,
  rebind,
  resetAction,
  resetAll,
  saveBindings,
  type BindingTable,
} from './bindings.ts'
import {
  actionPadValue,
  buttonDownFlags,
  newlyPressedButton,
  padButtonsDown,
  type PadSnap,
} from './gamepad.ts'

type PressFn = (id: ActionId) => void

interface Capture {
  onBind: (binding: Binding) => void
  onCancel: () => void
}

export class InputMap {
  table: BindingTable
  private keys = new Set<string>()
  private presses = new Set<PressFn>()
  private capture: Capture | null = null
  private attached = false
  private padSnap: PadSnap | null = null
  private padPrev: boolean[] = []
  private padDown = new Set<ActionId>()
  private raf = 0
  private version = 0
  private subs = new Set<() => void>()

  constructor(table?: BindingTable) {
    this.table = table ?? readBindings()
  }

  subscribe = (fn: () => void): (() => void) => {
    this.subs.add(fn)
    return () => this.subs.delete(fn)
  }

  getSnapshot = (): number => this.version

  get capturing(): boolean {
    return this.capture != null
  }

  /** 0..1 for a hold action, from the keyboard and the first gamepad. */
  analog(id: ActionId): number {
    const bindings = this.table[id] ?? []
    let best = 0
    for (const binding of bindings) {
      if (binding.device === 'key' && this.keys.has(binding.code)) best = 1
    }
    if (this.padSnap) best = Math.max(best, actionPadValue(bindings, this.padSnap))
    return best
  }

  /** True when the wheel notch is still bound to zoom. */
  wheelMatches(deltaY: number): boolean {
    if (!deltaY || this.capture) return false
    const dir = deltaY < 0 ? 'in' : 'out'
    const id: ActionId = dir === 'in' ? 'camera.zoomIn' : 'camera.zoomOut'
    return (this.table[id] ?? []).some((binding) => binding.device === 'wheel' && binding.dir === dir)
  }

  onPress(fn: PressFn): () => void {
    this.presses.add(fn)
    return () => this.presses.delete(fn)
  }

  captureNext(onBind: (binding: Binding) => void, onCancel: () => void): void {
    this.capture = { onBind, onCancel }
    this.bump()
  }

  cancelCapture(): void {
    const pending = this.capture
    this.capture = null
    pending?.onCancel()
    this.bump()
  }

  rebindAction(id: ActionId, binding: Binding): ActionId[] {
    const result = rebind(this.table, id, binding)
    this.table = result.table
    saveBindings(this.table)
    this.bump()
    return result.stole
  }

  resetOne(id: ActionId): ActionId[] {
    const result = resetAction(this.table, id)
    this.table = result.table
    saveBindings(this.table)
    this.bump()
    return result.stole
  }

  resetEverything(): void {
    this.table = resetAll()
    saveBindings(this.table)
    this.bump()
  }

  attach(): void {
    if (this.attached || typeof window === 'undefined') return
    this.attached = true
    window.addEventListener('keydown', this.onKeyDown, true)
    window.addEventListener('keyup', this.onKeyUp, true)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('wheel', this.onWheel, { capture: true, passive: false })
    const loop = () => {
      this.pollGamepad()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  detach(): void {
    if (!this.attached || typeof window === 'undefined') return
    this.attached = false
    window.removeEventListener('keydown', this.onKeyDown, true)
    window.removeEventListener('keyup', this.onKeyUp, true)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('wheel', this.onWheel, true)
    cancelAnimationFrame(this.raf)
    this.keys.clear()
    this.padSnap = null
    this.padDown.clear()
  }

  private bump() {
    this.version += 1
    for (const fn of this.subs) fn()
  }

  private emit(id: ActionId) {
    if (this.capture) return
    for (const fn of this.presses) fn(id)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const tag = (e.target as HTMLElement | null)?.tagName
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    if (typing && !this.capture) return

    if (this.capture) {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') {
        this.cancelCapture()
        return
      }
      const pending = this.capture
      this.capture = null
      pending.onBind({ device: 'key', code: e.code })
      this.bump()
      return
    }

    let used = false
    for (const action of ACTIONS) {
      if (!isActionId(action.id)) continue
      const hit = (this.table[action.id] ?? []).some((binding) => binding.device === 'key' && binding.code === e.code)
      if (!hit) continue
      used = true
      if (action.hold) this.keys.add(e.code)
      else if (!e.repeat) this.emit(action.id)
    }
    if (used && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault()
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
  }

  private onBlur = () => {
    this.keys.clear()
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.capture || !e.deltaY) return
    e.preventDefault()
    e.stopPropagation()
    const pending = this.capture
    this.capture = null
    pending.onBind({ device: 'wheel', dir: e.deltaY < 0 ? 'in' : 'out' })
    this.bump()
  }

  private pollGamepad() {
    const pads = readPads()
    let snap: PadSnap | null = null
    for (const pad of pads) {
      if (!pad) continue
      snap = {
        axes: pad.axes,
        buttons: pad.buttons.map((button) => ({ pressed: button.pressed, value: button.value })),
      }
      break
    }
    this.padSnap = snap
    if (!snap) {
      this.padPrev = []
      this.padDown.clear()
      return
    }
    if (this.capture) {
      const index = newlyPressedButton(this.padPrev, snap)
      this.padPrev = buttonDownFlags(snap)
      if (index != null) {
        const pending = this.capture
        this.capture = null
        pending.onBind({ device: 'pad', control: 'button', index })
        this.bump()
      }
      return
    }
    this.padPrev = buttonDownFlags(snap)
    const down = padButtonsDown(this.table, snap)
    const next = new Set<ActionId>()
    for (const id of down) {
      next.add(id)
      if (!this.padDown.has(id)) this.emit(id)
    }
    this.padDown = next
  }
}

function readPads(): Array<{ axes: readonly number[]; buttons: ReadonlyArray<{ pressed: boolean; value: number }> } | null> {
  try {
    const nav = typeof navigator === 'undefined' ? null : navigator
    if (!nav || typeof nav.getGamepads !== 'function') return []
    return nav.getGamepads()
  } catch {
    return []
  }
}

export const inputMap = new InputMap()
