import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildTerminalExterior, buildTerminalHall, buildTerminalProps, MOVING_TRAYS, TERMINAL_ITEM_TO_PROP, TERMINAL_PROP_TYPES, TERMINAL_PROPS, terminalProp, trayPositions } from './index'
import { MATERIALS } from './materials'

describe('terminal props registry', () => {
  it('builds every type with real-world sizes and known materials', () => {
    for (const t of TERMINAL_PROP_TYPES) {
      const e = TERMINAL_PROPS[t]()
      expect(e.parts.length, t).toBeGreaterThanOrEqual(3)
      expect(e.size.w, t).toBeGreaterThan(0.1)
      expect(e.size.w, t).toBeLessThan(30)
      expect(e.size.h, t).toBeLessThan(t === 'jet_bridge' ? 8 : 6)
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
  it('pass 2 props: jet bridge reaches ~18 m, kiosks are kiosk-sized', () => {
    const jb = terminalProp('jet_bridge').size
    expect(jb.d).toBeGreaterThan(16)
    expect(jb.d).toBeLessThan(22)
    expect(terminalProp('self_checkin_kiosk').size.h).toBeLessThan(2.1)
    expect(TERMINAL_ITEM_TO_PROP.jet_bridge).toBe('jet_bridge')
  })
  it('hall accepts carpet zones and quality tiers', () => {
    const hi = buildTerminalHall({ width: 60, depth: 36, height: 9, quality: 'high', carpets: [{ x: 10, z: 8, w: 12, d: 8 }] })
    const lo = buildTerminalHall({ width: 60, depth: 36, height: 9, quality: 'low' })
    expect(hi.getObjectByName('carpets')).toBeDefined()
    expect(hi.getObjectByName('acousticCeiling')).toBeDefined()
    expect(hi.children.length).toBeGreaterThan(lo.children.length)
  })
  it('builds hall shell and exterior', () => {
    expect(buildTerminalHall({ width: 60, depth: 36, height: 9 }).children.length).toBeGreaterThan(8)
    expect(buildTerminalExterior({ width: 60, depth: 36, height: 9 }).children.length).toBeGreaterThan(8)
  })
  it('round 4: security lanes carry animated trays that stay on the rollers', () => {
    for (const tracks of Object.values(MOVING_TRAYS)) {
      for (const t of tracks ?? []) {
        const lo = Math.min(t.x0, t.x1), hi = Math.max(t.x0, t.x1)
        for (const time of [0, 1.7, 33, 999]) for (const x of trayPositions(t, time)) {
          expect(x).toBeGreaterThanOrEqual(lo - 1e-6)
          expect(x).toBeLessThanOrEqual(hi + 1e-6)
        }
      }
    }
    const g = buildTerminalProps([{ type: 'security_lane', x: 0, z: 0 }])
    expect(g.getObjectByName('movingTrays')).toBeDefined()
    expect(buildTerminalProps([{ type: 'gate_seating', x: 0, z: 0 }]).getObjectByName('movingTrays')).toBeUndefined()
  })
  it('round 4: check-in desks have staff and security lanes have officers', () => {
    expect(terminalProp('checkin_row').parts.some((p) => p.mat === 'skin' || p.mat === 'skinDark')).toBe(true)
    for (const t of ['security_lane', 'security_lane_ct'] as const) expect(terminalProp(t).parts.filter((p) => p.mat === 'vestYellow').length, t).toBeGreaterThanOrEqual(3)
  })
  it('round 4: hall has recessed doors on quality high only', () => {
    expect(buildTerminalHall({ width: 60, depth: 36, height: 9, quality: 'high' }).getObjectByName('recessedDoors')).toBeDefined()
    expect(buildTerminalHall({ width: 60, depth: 36, height: 9, quality: 'low' }).getObjectByName('recessedDoors')).toBeUndefined()
  })
})
