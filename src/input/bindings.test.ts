import { describe, expect, it } from 'vitest'
import { bindingLabel } from './actions.ts'
import {
  CONTROLS_KEY,
  bindingsEqual,
  defaultBindings,
  loadBindings,
  rebind,
  resetAction,
  resetAll,
  saveBindings,
} from './bindings.ts'

describe('control bindings', () => {
  it('starts from the named defaults', () => {
    const table = defaultBindings()
    expect(bindingsEqual(table, 'camera.panForward')).toBe(true)
    expect(bindingLabel(table['camera.panForward'][0])).toBe('W')
    expect(bindingLabel(table['ui.back'][1])).toBe('B')
    expect(bindingLabel(table['system.graphics'][0])).toBe('F8')
    expect(bindingLabel(table['camera.zoomIn'][3])).toBe('RT')
  })

  it('steals a binding from the other action and can give it back', () => {
    const table = defaultBindings()
    const moved = rebind(table, 'view.flows', { device: 'key', code: 'KeyL' })
    expect(moved.stole).toEqual(['view.airlines'])
    expect(moved.table['view.flows']).toEqual([{ device: 'key', code: 'KeyL' }])
    expect(moved.table['view.airlines']).toEqual([])
    const back = resetAction(moved.table, 'view.airlines')
    expect(back.stole).toContain('view.flows')
    expect(bindingsEqual(back.table, 'view.airlines')).toBe(true)
    expect(back.table['view.flows']).toEqual([])
  })

  it('reset all restores sticks', () => {
    const moved = rebind(defaultBindings(), 'camera.panForward', { device: 'key', code: 'KeyI' })
    expect(moved.table['camera.panForward']).toHaveLength(1)
    expect(bindingsEqual(resetAll(), 'camera.panForward')).toBe(true)
  })

  it('loads a saved table and ignores junk', () => {
    expect(loadBindings('not json')['camera.panLeft'][0]).toEqual({ device: 'key', code: 'KeyA' })
    const raw = JSON.stringify({
      'view.photo': [{ device: 'key', code: 'KeyO' }],
      'nope': [{ device: 'key', code: 'KeyZ' }],
      'speed.pause': [{ device: 'bogus' }],
    })
    const loaded = loadBindings(raw)
    expect(loaded['view.photo']).toEqual([{ device: 'key', code: 'KeyO' }])
    expect(loaded['speed.pause']).toEqual([])
    expect(bindingsEqual(loaded, 'camera.panLeft')).toBe(true)
  })

  it('round-trips through storage', () => {
    const table = rebind(defaultBindings(), 'ui.menu', { device: 'pad', control: 'button', index: 8 }).table
    saveBindings(table)
    expect(loadBindings(localStorage.getItem(CONTROLS_KEY))['ui.menu']).toEqual([
      { device: 'pad', control: 'button', index: 8 },
    ])
  })
})
