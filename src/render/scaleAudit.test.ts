import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { PeopleRenderer } from '../people/renderer.ts'
import type { PersonLook } from '../people/types.ts'
import { crewLook, passengerLook } from '../people/variants.ts'
import { buildHallDetail, HALL_ITEM_PROP, HALL_REAL_SIZE, hallDetailPlacements } from './hallKitDetail.ts'
import { layoutItems } from './hallKitMeshes.ts'
import {
  CAPSULE_SCALE_MAX,
  CAPSULE_SCALE_MIN,
  capsuleStandingM,
} from './hallNavCrowd.ts'
import { terminalProp, type TerminalPropType } from './terminalProps/index.ts'
import { schemeItems, type PlacedItem } from '../game/terminal.ts'

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
    const drawn = new Set(Object.values(HALL_ITEM_PROP))
    for (const type of drawn) {
      const band = HALL_PROP_HEIGHT_M[type]
      expect(band, type).toBeTruthy()
      const h = terminalProp(type as TerminalPropType).size.h
      expect(h, `${type} is ${h.toFixed(3)} m`).toBeGreaterThanOrEqual(band[0])
      expect(h, `${type} is ${h.toFixed(3)} m`).toBeLessThanOrEqual(band[1])
    }
    const items = schemeItems(1).map((item) => ({ ...item }))
    const laid = layoutItems(items, 8, 5)
    const { group } = buildHallDetail(laid, 8, 5)
    group.name = 'hall-root'
    group.traverse((obj) => {
      expect(obj.scale.x, obj.name).toBeCloseTo(1, 5)
      expect(obj.scale.y, obj.name).toBeCloseTo(1, 5)
      expect(obj.scale.z, obj.name).toBeCloseTo(1, 5)
    })
    const hall = readFileSync(new URL('./hallWorld.ts', import.meta.url), 'utf8')
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
    for (const type of HALL_REAL_SIZE) {
      const band = HALL_REAL_FOOTPRINT_M[type]
      expect(band, type).toBeTruthy()
      const { w, d } = terminalProp(type).size
      expect(w, `${type} width ${w.toFixed(2)} m`).toBeGreaterThanOrEqual(band.w[0])
      expect(w, `${type} width ${w.toFixed(2)} m`).toBeLessThanOrEqual(band.w[1])
      expect(d, `${type} depth ${d.toFixed(2)} m`).toBeGreaterThanOrEqual(band.d[0])
      expect(d, `${type} depth ${d.toFixed(2)} m`).toBeLessThanOrEqual(band.d[1])
    }
    const placements = hallDetailPlacements(
      [...HALL_REAL_SIZE].map((type, i) => {
        const def = Object.keys(HALL_ITEM_PROP).find((id) => HALL_ITEM_PROP[id] === type) ?? type
        return { item: { id: `r${i}`, def, c: 0, r: 0, wear: 0, rot: 0 } as PlacedItem, x: i * 20, z: 0 }
      }),
      8,
      5,
    )
    for (const p of placements) expect(p.scale, p.type).toBe(1)
  })
})
