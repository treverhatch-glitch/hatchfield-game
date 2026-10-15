/**
 * Apron belt tile. The deck runs from the cell centre out to every side that
 * joins another belt cell, so a bend or a north-south run is still one belt.
 * The deck is a raised box: a lit top, darker sides, bags on the top.
 * At a bend the inner rails meet in an L. They do not run through each other.
 */
import * as THREE from 'three'
import { CELL } from './aircraft/specs'
import type { BeltArms } from './beltRuns'

/** Top of the belt deck, world units. About 0.8 m. Bags rest here. */
export const BELT_SURFACE_Y = 0.36
const DECK_THICK = 0.16
const ROLLER_Y = 0.05
const RAIL_H = 0.07
const RAIL_Y = BELT_SURFACE_Y + RAIL_H / 2
const WIDTH = CELL * 0.42
const RAIL_OFF = CELL * 0.14
/** Neighbouring arms overlap past the cell edge so the seam cannot read as a gap. */
const REACH = CELL * 0.5 + 0.25
/** Corner square. A straight-through rail starts here so it stays off the other arm. */
const JOINT = WIDTH / 2

/** How far an arm runs from the cell centre. A bend starts at the joint; a straight run starts at the centre. */
export function beltArmRange(bend: boolean): { from: number; to: number } {
  return { from: bend ? JOINT : 0, to: REACH }
}

const SIDES: readonly { arm: keyof BeltArms; x: number; z: number }[] = [
  { arm: 'e', x: 1, z: 0 },
  { arm: 'w', x: -1, z: 0 },
  { arm: 's', x: 0, z: 1 },
  { arm: 'n', x: 0, z: -1 },
]

/** Sides the deck reaches. A dead end runs the full cell; a lone cell runs east-west. */
export function deckSides(arms: BeltArms | undefined): (keyof BeltArms)[] {
  const out = SIDES.filter((s) => arms?.[s.arm]).map((s) => s.arm)
  if (out.length === 0) return ['e', 'w']
  if (out.length === 1) {
    const opposite = { e: 'w', w: 'e', n: 's', s: 'n' } as const
    out.push(opposite[out[0]])
  }
  return out
}

/** Local Z of the rail that turns into the other arm. Null on a straight run. */
function innerRailZ(arm: (typeof SIDES)[number], sides: (keyof BeltArms)[]): number | null {
  const theta = Math.atan2(-arm.z, arm.x)
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  for (const other of SIDES) {
    if (!sides.includes(other.arm) || other.arm === arm.arm) continue
    if (other.x === arm.x || other.z === arm.z) continue
    const localZ = other.x * s + other.z * c
    if (Math.abs(localZ) < 0.5) continue
    return Math.sign(localZ) * RAIL_OFF
  }
  return null
}

export function addBeltDeck(g: THREE.Group, arms: BeltArms | undefined) {
  const sideMat = new THREE.MeshStandardMaterial({ color: '#1c2328', roughness: 0.86, metalness: 0.02 })
  const topMat = new THREE.MeshStandardMaterial({
    color: '#e4eef3',
    emissive: '#8ea4b0',
    emissiveIntensity: 0.55,
    roughness: 0.38,
    metalness: 0.08,
  })
  const deckMats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]
  const railMat = new THREE.MeshStandardMaterial({ color: '#c9a227', emissive: '#5a4810', emissiveIntensity: 0.25, roughness: 0.45 })
  const rollerMat = new THREE.MeshStandardMaterial({ color: '#5a6a78', metalness: 0.35, roughness: 0.4 })
  const sides = deckSides(arms)
  const bend = sides.some((s) => s === 'n' || s === 's') && sides.some((s) => s === 'e' || s === 'w')
  const span = beltArmRange(bend)
  const len = span.to - span.from
  const mid = (span.from + span.to) / 2
  const deckY = BELT_SURFACE_Y - DECK_THICK / 2
  const deckGeo = new THREE.BoxGeometry(len, DECK_THICK, WIDTH)
  const rollerGeo = new THREE.BoxGeometry(len, 0.05, CELL * 0.18)
  let armIndex = 0
  for (const side of SIDES) {
    if (!sides.includes(side.arm)) continue
    const arm = new THREE.Group()
    arm.rotation.y = Math.atan2(-side.z, side.x)
    const deck = new THREE.Mesh(deckGeo, deckMats)
    deck.name = 'belt-deck'
    // A millimetre of stagger so the overlap has one winner and does not z-fight to a crack.
    deck.position.set(mid, deckY + armIndex * 0.001, 0)
    deck.castShadow = true
    deck.receiveShadow = true
    arm.add(deck)
    const innerZ = bend ? innerRailZ(side, sides) : null
    for (const z of [-RAIL_OFF, RAIL_OFF]) {
      const inner = innerZ !== null && Math.sign(z) === Math.sign(innerZ)
      const from = inner ? RAIL_OFF : span.from
      const railLen = span.to - from
      const rail = new THREE.Mesh(new THREE.BoxGeometry(railLen, RAIL_H, 0.06), railMat)
      rail.name = 'belt-rail'
      rail.position.set((from + span.to) / 2, RAIL_Y, z)
      rail.castShadow = true
      arm.add(rail)
    }
    const roller = new THREE.Mesh(rollerGeo, rollerMat)
    roller.name = 'belt-roller'
    roller.position.set(mid, ROLLER_Y, 0)
    arm.add(roller)
    g.add(arm)
    armIndex += 1
  }
  if (bend) {
    const joint = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, DECK_THICK, WIDTH), deckMats)
    joint.name = 'belt-deck'
    joint.position.y = deckY + 0.004
    joint.castShadow = true
    joint.receiveShadow = true
    g.add(joint)
  }
}
