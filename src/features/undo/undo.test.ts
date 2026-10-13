import { describe, expect, it } from 'vitest'
import { UndoStack, type UndoCommand, type UndoEconomyAdapter } from './undo.ts'

interface S { tiles: string[] }
const place = (t: string, cost = 0): UndoCommand<S> => ({
  label: `place ${t}`, cost,
  apply: (s) => { s.tiles.push(t) },
  revert: (s) => { s.tiles.splice(s.tiles.lastIndexOf(t), 1) },
})
const wallet = () => {
  const w = { cash: 1000, log: [] as string[] }
  const econ: UndoEconomyAdapter = {
    charge: (a, l) => { w.cash -= a; w.log.push(`-${a} ${l}`) },
    refund: (a, l) => { w.cash += a; w.log.push(`+${a} ${l}`) },
  }
  return { w, econ }
}

describe('UndoStack', () => {
  it('undoes and redoes in order', () => {
    const s: S = { tiles: [] }
    const u = new UndoStack(s)
    u.execute(place('a')); u.execute(place('b'))
    u.undo(); expect(s.tiles).toEqual(['a'])
    u.redo(); expect(s.tiles).toEqual(['a', 'b'])
    u.undo(); u.execute(place('c'))
    expect(u.canRedo()).toBe(false)
    expect(s.tiles).toEqual(['a', 'c'])
  })
  it('groups commands into one step, with nesting', () => {
    const s: S = { tiles: [] }
    const u = new UndoStack(s)
    u.beginGroup('paint'); u.execute(place('x')); u.beginGroup('inner'); u.execute(place('y')); u.endGroup()
    expect(u.canUndo()).toBe(false)
    u.endGroup()
    expect(u.size().undo).toBe(1)
    expect(u.peekUndoLabel()).toBe('paint')
    u.undo(); expect(s.tiles).toEqual([])
    expect(() => u.endGroup()).toThrow()
  })
  it('respects the limit', () => {
    const s: S = { tiles: [] }
    const u = new UndoStack(s, undefined, { limit: 2 })
    u.execute(place('a')); u.execute(place('b')); u.execute(place('c'))
    u.undo(); u.undo(); expect(u.undo()).toBeNull()
    expect(s.tiles).toEqual(['a'])
  })
  it('refunds cost on undo and recharges on redo', () => {
    const { w, econ } = wallet()
    const u = new UndoStack<S>({ tiles: [] }, econ, { refundRate: 0.5 })
    u.execute(place('gate', 200))
    expect(w.cash).toBe(800)
    expect(u.undo()).toBe(100); expect(w.cash).toBe(900)
    expect(u.redo()).toBe(100); expect(w.cash).toBe(800)
  })
  it('stops refunding after the refund window', () => {
    const { w, econ } = wallet()
    const u = new UndoStack<S>({ tiles: [] }, econ, { refundWindow: 60 })
    u.execute(place('a', 100), 0)
    expect(u.undo(61)).toBe(0)
    expect(w.cash).toBe(900)
    expect(u.redo(70)).toBe(0)
  })
})
