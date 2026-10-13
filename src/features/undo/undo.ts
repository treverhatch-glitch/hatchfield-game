/**
 * Generic command-stack undo/redo. The sim supplies commands; this module
 * never touches game state directly.
 */
export interface UndoCommand<S> {
  label: string
  /** Money spent when applied (refunded on undo, re-charged on redo). */
  cost?: number
  apply(state: S): void
  revert(state: S): void
}

/** Adapter the sim implements so refunds flow through its own economy. */
export interface UndoEconomyAdapter {
  charge(amount: number, label: string): void
  refund(amount: number, label: string): void
}

export interface UndoOptions {
  /** Max entries kept on the undo stack (oldest dropped). */
  limit?: number
  /** Fraction of cost refunded on undo (1 = full). */
  refundRate?: number
  /** Entries older than this game time (ms since apply) refund nothing; undefined = always refund. */
  refundWindow?: number
}

interface Entry<S> {
  label: string
  commands: UndoCommand<S>[]
  appliedAt: number
  refunded: number
}

export class UndoStack<S> {
  private undoStack: Entry<S>[] = []
  private redoStack: Entry<S>[] = []
  private group: Entry<S> | null = null
  private groupDepth = 0
  private readonly limit: number
  private readonly refundRate: number
  private readonly refundWindow: number | undefined
  private readonly state: S
  private readonly economy: UndoEconomyAdapter | undefined

  constructor(state: S, economy?: UndoEconomyAdapter, opts: UndoOptions = {}) {
    this.state = state
    this.economy = economy
    this.limit = Math.max(1, opts.limit ?? 100)
    this.refundRate = opts.refundRate ?? 1
    this.refundWindow = opts.refundWindow
  }

  /** Applies a command now and records it. */
  execute(cmd: UndoCommand<S>, now = 0): void {
    cmd.apply(this.state)
    if (cmd.cost) this.economy?.charge(cmd.cost, cmd.label)
    this.redoStack = []
    if (this.group) {
      this.group.commands.push(cmd)
      return
    }
    this.pushEntry({ label: cmd.label, commands: [cmd], appliedAt: now, refunded: 0 })
  }

  /** Groups every execute() until endGroup() into one undo step (e.g. a drag-painted floor). */
  beginGroup(label: string, now = 0): void {
    if (this.groupDepth++ === 0) this.group = { label, commands: [], appliedAt: now, refunded: 0 }
  }

  endGroup(): void {
    if (this.groupDepth === 0) throw new Error('endGroup without beginGroup')
    if (--this.groupDepth > 0) return
    const g = this.group
    this.group = null
    if (g && g.commands.length > 0) this.pushEntry(g)
  }

  canUndo(): boolean {
    return this.undoStack.length > 0 && !this.group
  }

  canRedo(): boolean {
    return this.redoStack.length > 0 && !this.group
  }

  peekUndoLabel(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.label
  }

  peekRedoLabel(): string | undefined {
    return this.redoStack[this.redoStack.length - 1]?.label
  }

  /** Returns the refunded amount, or null if nothing to undo. */
  undo(now = 0): number | null {
    if (!this.canUndo()) return null
    const e = this.undoStack.pop()!
    for (let i = e.commands.length - 1; i >= 0; i--) e.commands[i].revert(this.state)
    const total = e.commands.reduce((s, c) => s + (c.cost ?? 0), 0)
    const inWindow = this.refundWindow === undefined || now - e.appliedAt <= this.refundWindow
    const refund = inWindow ? Math.round(total * this.refundRate) : 0
    if (refund > 0) this.economy?.refund(refund, e.label)
    e.refunded = refund
    this.redoStack.push(e)
    return refund
  }

  /** Re-applies; re-charges whatever was refunded. Returns the charged amount or null. */
  redo(now = 0): number | null {
    if (!this.canRedo()) return null
    const e = this.redoStack.pop()!
    for (const c of e.commands) c.apply(this.state)
    if (e.refunded > 0) this.economy?.charge(e.refunded, e.label)
    const charged = e.refunded
    e.refunded = 0
    e.appliedAt = now
    this.undoStack.push(e)
    return charged
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

  size(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length }
  }

  private pushEntry(e: Entry<S>): void {
    this.undoStack.push(e)
    while (this.undoStack.length > this.limit) this.undoStack.shift()
  }
}
