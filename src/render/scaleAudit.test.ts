import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { PeopleRenderer } from '../people/renderer.ts'
import type { PersonLook } from '../people/types.ts'
import { crewLook, passengerLook } from '../people/variants.ts'
import { WORLD_PER_METER } from './aircraft/specs.ts'
import { fittingSpec } from '../terminalbuild/fittings.ts'
import { split1f } from '../terminalbuild/starter/split1f.ts'
import { buildFittingMeshes, fittingPropType } from './interior/fittings.ts'
import { buildLayoutShell } from './interior/shell.ts'
import {
  CAPSULE_SCALE_MAX,
  CAPSULE_SCALE_MIN,
  capsuleStandingM,
} from './hallNavCrowd.ts'
import { terminalProp, type TerminalPropType } from './terminalProps/index.ts'

/**
 * Full bounding height of each prop the hall kit actually draws.
 * These are the builder tops (header, board, shop shell), not the counter-only
 * rows in the catalog. A shrink below 1 would fall out of the band.
 */
const HALL_PROP_HEIGHT_M: Record<string, [number, number]> = {
  checkin_pair: [3.5, 3.9],
  security_lane: [2.6, 3.0],
  security_lane_ct: [2.2, 2.7],
  body_scanner: [2.2, 2.6],
  seat_row: [0.85, 1.15],
  gate_podium: [2.8, 3.3],
  restroom_block: [2.8, 3.2],
  baggage_carousel: [3.7, 4.2],
  bag_drop_kiosk: [2.3, 2.7],
  passport_booth: [3.7, 4.1],
  shop_coffee: [3.8, 4.2],
  shop_fastfood: [3.8, 4.2],
  shop_gadget: [3.0, 3.4],
  food_court: [2.9, 3.3],
  wayfinding_sign: [4.3, 4.9],
  departures_board: [4.1, 4.6],
  departures_wall: [4.0, 4.5],
  gate_pylon: [4.0, 4.5],
  kiosk_bank: [2.9, 3.4],
  planter: [1.9, 2.2],
  bin: [0.9, 1.15],
}

/** Real footprints (whole rig, width × depth) for the service kit that must not be shrunk. */
const HALL_REAL_FOOTPRINT_M: Record<string, { w: [number, number]; d: [number, number] }> = {
  checkin_pair: { w: [6.2, 7.2], d: [5.3, 6.3] },
  security_lane: { w: [13.5, 15], d: [5.7, 6.7] },
  security_lane_ct: { w: [15.5, 17], d: [6.9, 7.9] },
  body_scanner: { w: [2.2, 2.7], d: [1.5, 1.95] },
  bag_drop_kiosk: { w: [1.7, 2.1], d: [1.65, 2.05] },
  baggage_carousel: { w: [14.5, 16], d: [4.1, 5] },
  passport_booth: { w: [3.9, 4.6], d: [2.9, 3.6] },
  shop_coffee: { w: [8.1, 9.2], d: [6.6, 7.5] },
  shop_fastfood: { w: [8.1, 9.2], d: [6.6, 7.5] },
  shop_gadget: { w: [7.1, 8], d: [5.4, 6.3] },
  food_court: { w: [8.8, 9.8], d: [7, 8] },
}

function standingM(look: PersonLook): number {
  const root = new THREE.Group()
  const people = new PeopleRenderer(root)
  people.update([{ id: 'p', look, x: 0, y: 0, z: 0, yaw: 0, pose: 'idle', speed: 0 }], null, 0)
  const head = people.mesh('head')
  if (!head || head.count < 1) {
    people.dispose()
    throw new Error('head mesh was not drawn')
  }
  head.geometry.computeBoundingBox()
  const box = head.geometry.boundingBox
  if (!box) {
    people.dispose()
    throw new Error('head has no bounds')
  }
  const m = new THREE.Matrix4()
  head.getMatrixAt(0, m)
  const top = new THREE.Vector3(0, box.max.y, 0).applyMatrix4(m).y
  people.dispose()
  return top
}

describe('hall scale audit v1', () => {
  it('keeps capsule walkers and staff in the adult height band', () => {
    expect(capsuleStandingM(CAPSULE_SCALE_MIN)).toBeGreaterThanOrEqual(1.55)
    expect(capsuleStandingM(CAPSULE_SCALE_MAX)).toBeLessThanOrEqual(1.95)
    expect(capsuleStandingM(1)).toBeCloseTo(1.7, 5)

    for (let i = 0; i < 24; i++) {
      const adult = standingM(passengerLook(`wp1-adult-${i}`))
      expect(adult, `passenger ${i} is ${adult.toFixed(3)} m`).toBeGreaterThanOrEqual(1.55)
      expect(adult).toBeLessThanOrEqual(1.95)
    }
    for (const kind of ['checkin', 'security', 'cabin', 'maintenance'] as const) {
      const h = standingM(crewLook(kind, 'wp1-crew'))
      expect(h, `${kind} is ${h.toFixed(3)} m`).toBeGreaterThanOrEqual(1.55)
      expect(h).toBeLessThanOrEqual(1.95)
    }
    const shop = standingM(passengerLook('wp1-retail', { age: 'adult', outfit: 'casual' }))
    expect(shop).toBeGreaterThanOrEqual(1.55)
    expect(shop).toBeLessThanOrEqual(1.95)
  })

  it('keeps children in the child band and does not force them in the hall crowd', () => {
    for (let i = 0; i < 12; i++) {
      const kid = standingM(passengerLook(`wp1-kid-${i}`, { age: 'kid' }))
      expect(kid, `kid ${i} is ${kid.toFixed(3)} m`).toBeGreaterThanOrEqual(1.0)
      expect(kid).toBeLessThanOrEqual(1.4)
    }
    const crowd = readFileSync(new URL('./hallNavCrowd.ts', import.meta.url), 'utf8')
    const lookFor = crowd.slice(crowd.indexOf('private lookFor'), crowd.indexOf('dispose()'))
    expect(lookFor).not.toContain("age: 'kid'")
    const fx = readFileSync(new URL('./hallService.ts', import.meta.url), 'utf8')
    expect(fx).not.toContain('unitsPerMeter:')
  })

  it('draws every hall prop at its real height and scale 1', () => {
    for (const [type, band] of Object.entries(HALL_PROP_HEIGHT_M)) {
      const h = terminalProp(type as TerminalPropType).size.h
      expect(h, `${type} is ${h.toFixed(3)} m`).toBeGreaterThanOrEqual(band[0])
      expect(h, `${type} is ${h.toFixed(3)} m`).toBeLessThanOrEqual(band[1])
    }
    const group = buildFittingMeshes(split1f())
    group.name = 'hall-root'
    group.traverse((obj) => {
      expect(obj.scale.x, obj.name).toBeCloseTo(1, 5)
      expect(obj.scale.y, obj.name).toBeCloseTo(1, 5)
      expect(obj.scale.z, obj.name).toBeCloseTo(1, 5)
    })
    const hall = readFileSync(new URL('./interior/InteriorView.ts', import.meta.url), 'utf8')
    const scales = [...hall.matchAll(/\.scale\.set(?:Scalar)?\(([^)]*)\)/g)].map((m) => m[1].replace(/\s/g, ''))
    for (const args of scales) {
      const unit = args === '1,1,1' || args === '1'
      const sprite = args === '1.6,0.8,1'
      expect(unit || sprite, args).toBe(true)
    }
    expect(hall).toContain('this.scene.add(this.queueGroup)')
    expect(hall).not.toContain('hallRoot.add(this.queueGroup)')
  })

  it('keeps the PR #125 real-size service kit at its authored footprint', () => {
    for (const [type, band] of Object.entries(HALL_REAL_FOOTPRINT_M)) {
      const { w, d } = terminalProp(type as TerminalPropType).size
      expect(w, `${type} width ${w.toFixed(2)} m`).toBeGreaterThanOrEqual(band.w[0])
      expect(w, `${type} width ${w.toFixed(2)} m`).toBeLessThanOrEqual(band.w[1])
      expect(d, `${type} depth ${d.toFixed(2)} m`).toBeGreaterThanOrEqual(band.d[0])
      expect(d, `${type} depth ${d.toFixed(2)} m`).toBeLessThanOrEqual(band.d[1])
    }
  })
})

describe('hall scale audit v2', () => {
  it('keeps catalog footprints within 5% of the builders that were measured', () => {
    const rows = ['bag_drop', 'claim_carousel', 'passport_booth'] as const
    for (const kind of rows) {
      const spec = fittingSpec(kind)
      const type = fittingPropType(kind)
      expect(type, kind).toBeTruthy()
      const box = terminalProp(type!).size
      expect(Math.abs(spec.w - box.w) / box.w, kind).toBeLessThanOrEqual(0.05)
      expect(Math.abs(spec.d - box.d) / box.d, kind).toBeLessThanOrEqual(0.05)
    }
  })

  it('scales only terminal-root in the airport terminal, and the hall shell stays at 1', () => {
    const hall = new THREE.Group()
    hall.name = 'hall-root'
    hall.add(buildLayoutShell(split1f()))
    hall.traverse((obj) => {
      expect(obj.scale.x, obj.name).toBeCloseTo(1, 5)
      expect(obj.scale.y, obj.name).toBeCloseTo(1, 5)
      expect(obj.scale.z, obj.name).toBeCloseTo(1, 5)
    })
    const src = readFileSync(new URL('./world/terminal.ts', import.meta.url), 'utf8')
    expect(src).toContain("metres.name = 'terminal-root'")
    expect(src).toContain('metres.scale.setScalar(WORLD_PER_METER)')
    const root = new THREE.Group()
    root.name = 'terminal-0'
    const metres = new THREE.Group()
    metres.name = 'terminal-root'
    metres.scale.setScalar(WORLD_PER_METER)
    root.add(new THREE.Group(), metres)
    const scaled: string[] = []
    root.traverse((obj) => {
      const unit = Math.abs(obj.scale.x - 1) < 1e-6 && Math.abs(obj.scale.y - 1) < 1e-6 && Math.abs(obj.scale.z - 1) < 1e-6
      if (!unit) scaled.push(obj.name)
    })
    expect(scaled).toEqual(['terminal-root'])
    expect(metres.scale.x).toBeCloseTo(WORLD_PER_METER, 5)
  })
})
