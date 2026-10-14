import { describe, expect, it } from 'vitest'
import type { PeopleAgent } from '../people/renderer.ts'
import { conePoints, standCrew, standTimeline, STAND_T, vehicleCrew } from './turnaroundCrew'

const frame = { x: 0, z: 0, yaw: 0, nose: 19, tail: -20, semiSpan: 17, noseGear: 14 }

describe('turnaround crew', () => {
  it('runs the arrival timeline: taxi, stop, chocks, cones', () => {
    expect(standTimeline(0).planeU).toBe(0)
    expect(standTimeline(0).marshal).toBe('guide')
    expect(standTimeline(STAND_T.taxi).planeU).toBe(1)
    expect(standTimeline(STAND_T.taxi + 0.5).marshal).toBe('stop')
    expect(standTimeline(STAND_T.chocksOn - 0.1).chocks).toBe(false)
    expect(standTimeline(STAND_T.chocksOn).chocks).toBe(true)
    expect(standTimeline(30).cones).toBe(4)
    expect(conePoints(frame)).toHaveLength(4)
  })

  it('marshaller waves wands at the plane while it taxis in', () => {
    const out: PeopleAgent[] = []
    standCrew(frame, 2, out)
    const m = out.find((a) => a.id === 'stand:marshal')!
    expect(m.pose).toBe('wave')
    expect(m.look.crew).toBe('marshaller')
    expect(m.look.wands).toBe(true)
    expect(m.x).toBeGreaterThan(frame.nose)
    expect(standCrew(frame, 20, []).some((a) => a.id === 'stand:marshal')).toBe(false)
  })

  it('chocks crew walk in and kneel at the nose gear', () => {
    const walking = standCrew(frame, (STAND_T.chocksWalk + STAND_T.chocksOn) / 2, []).filter((a) => a.id.startsWith('stand:chock'))
    expect(walking.every((a) => a.pose === 'walk')).toBe(true)
    const placed = standCrew(frame, STAND_T.chocksOn + 0.5, []).filter((a) => a.id.startsWith('stand:chock'))
    expect(placed.every((a) => a.pose === 'reach' && Math.abs(a.x - frame.noseGear) < 0.01)).toBe(true)
  })

  it('drivers sit in cabs; service crew appear only once deployed', () => {
    const moving = vehicleCrew({ id: 'b', kind: 'belt_loader', x: 0, z: 0, yaw: 0, ext: 0, moving: true }, 0, [])
    expect(moving.map((a) => a.pose)).toEqual(['seated'])
    const working = vehicleCrew({ id: 'b', kind: 'belt_loader', x: 0, z: 0, yaw: 0, ext: 1, moving: false }, 0, [])
    expect(working.map((a) => a.id)).toEqual(['b:driver', 'b:belt', 'b:hold'])
    const fuel = vehicleCrew({ id: 'f', kind: 'fuel', x: 0, z: 0, yaw: 0, ext: 1, moving: false }, 0, [])
    const fueler = fuel.find((a) => a.id === 'f:fueler')!
    expect(fueler.look.crew).toBe('fuel')
    expect(fueler.z).toBeGreaterThan(5)
    const cat = vehicleCrew({ id: 'c', kind: 'catering', x: 0, z: 0, yaw: 0, ext: 1, moving: false }, 0, [])
    expect(cat.find((a) => a.id === 'c:cater')!.y).toBeGreaterThan(3)
  })

  it('reuses one look per crew id (shared body + outfit data from src/people)', () => {
    const a = standCrew(frame, 2, [])[0]
    const b = standCrew(frame, 3, [])[0]
    expect(a.look).toBe(b.look)
  })
})
