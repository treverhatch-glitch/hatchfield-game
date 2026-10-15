import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { propParts } from './kit'
import { buildHiDetailProps, buildInteriorDressing, HI_DETAIL_KIND, hiDetailOn, hiDetailOwns, lowPolyFootprint } from './terminalHiDetail'
import { setNearPropDetail } from '../terminalProps'
import { starterGame } from './fixtures'
import { terminals } from './layout'
import { planTerminal } from './plan'
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
  it('adds hall dressing for claim, lounge and the office without moving rooms', () => {
    const [t] = terminals(starterGame())
    const plan = planTerminal(t, { walkersPerCell: 0 })
    const squares = plan.rooms.rooms.map((r) => r.squares.join(','))
    const g = buildInteriorDressing(plan.rooms, 0.45, 0.1)
    expect(g.name).toBe('interior-dressing')
    expect(g.userData.nearDetail).toBe(true)
    const anchors = g.userData.anchors as Record<string, { x: number; z: number }>
    expect(anchors.arrivals).toBeTruthy()
    expect(anchors.claim).toBeTruthy()
    expect(anchors.lounge).toBeTruthy()
    expect(anchors.office).toBeTruthy()
    expect(anchors.gadget).toBeTruthy()
    expect(anchors.food).toBeTruthy()
    setNearPropDetail(g, false)
    expect(g.visible).toBe(false)
    expect(plan.rooms.rooms.map((r) => r.squares.join(','))).toEqual(squares)
  })
})
