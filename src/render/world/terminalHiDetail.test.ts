import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { propParts } from './kit'
import { buildHiDetailProps, HI_DETAIL_KIND, hiDetailOn, hiDetailOwns, lowPolyFootprint } from './terminalHiDetail'
import { TERMINAL_PROP_TYPES } from '../terminalProps'
import type { Prop } from './plan'

describe('terminal hi-detail props', () => {
  it('only High and Ultra swap in detailed models', () => {
    expect(hiDetailOn('high')).toBe(true)
    expect(hiDetailOn('ultra')).toBe(true)
    expect(hiDetailOn('med')).toBe(false)
    expect(hiDetailOn('low')).toBe(false)
    expect(hiDetailOwns('xray', false)).toBe(false)
    expect(hiDetailOwns('xray', true)).toBe(true)
    expect(hiDetailOwns('awning', true)).toBe(true)
    // desks stay low-poly for per-room cutaway culling
    expect(hiDetailOwns('counter', true)).toBe(false)
    expect(hiDetailOwns('podium', true)).toBe(false)
    expect(hiDetailOwns('light', true)).toBe(false)
  })
  it('maps to registered types and fits inside the low-poly footprint', () => {
    for (const t of Object.values(HI_DETAIL_KIND)) expect(TERMINAL_PROP_TYPES).toContain(t)
    const parts = propParts()
    const props: Prop[] = [...Object.keys(HI_DETAIL_KIND), 'podium'].map((kind, i) => ({ kind, x: i * 5, z: 0, yaw: 0 }) as Prop)
    const g = buildHiDetailProps(props, parts, 0.45, 0.1)
    expect(g.children.length).toBeGreaterThan(5)
    const box = new THREE.Box3().setFromObject(g)
    expect(box.isEmpty()).toBe(false)
    // the low-poly footprint drives the fit scale
    const f = lowPolyFootprint('xray', parts.xray)
    expect(f.w).toBeGreaterThan(0.3)
  })
})
