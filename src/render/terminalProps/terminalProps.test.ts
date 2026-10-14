import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildTerminalExterior, buildTerminalHall, buildTerminalProps, TERMINAL_ITEM_TO_PROP, TERMINAL_PROP_TYPES, TERMINAL_PROPS, terminalProp } from './index'
import { MATERIALS } from './materials'

describe('terminal props registry', () => {
  it('builds every type with real-world sizes and known materials', () => {
    for (const t of TERMINAL_PROP_TYPES) {
      const e = TERMINAL_PROPS[t]()
      expect(e.parts.length, t).toBeGreaterThanOrEqual(3)
      expect(e.size.w, t).toBeGreaterThan(0.1)
      expect(e.size.w, t).toBeLessThan(30)
      expect(e.size.h, t).toBeLessThan(6)
      for (const p of e.parts) expect(MATERIALS[p.mat], `${t}:${p.mat}`).toBeDefined()
    }
  })
  it('maps item ids to registered types', () => {
    for (const v of Object.values(TERMINAL_ITEM_TO_PROP)) expect(TERMINAL_PROP_TYPES).toContain(v)
  })
  it('batches many placements into few instanced draws', () => {
    const places = Array.from({ length: 40 }, (_, i) => ({ type: 'gate_seating' as const, x: i * 10, z: 0 }))
    const g = buildTerminalProps(places)
    const parts = terminalProp('gate_seating').parts.length
    const count = g.children.reduce((s, c) => s + (c as THREE.InstancedMesh).count, 0)
    expect(count).toBe(parts * 40)
    expect(g.children.length).toBeLessThan(30)
  })
  it('builds hall shell and exterior', () => {
    expect(buildTerminalHall({ width: 60, depth: 36, height: 9 }).children.length).toBeGreaterThan(8)
    expect(buildTerminalExterior({ width: 60, depth: 36, height: 9 }).children.length).toBeGreaterThan(8)
  })
})
