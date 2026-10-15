/**
 * Apron belt tile. The deck runs from the cell centre out to every side that
 * joins another belt cell, so a bend or a north-south run is still one belt.
 * The deck is the surface bags ride. It stays a flat lit grey: the conveyor
 * photo averages near black and read as a hole between the shorter rollers.
 */
import * as THREE from 'three'
import { CELL } from './aircraft/specs'
import type { BeltArms } from './beltRuns'

/** Top of the belt deck, world units. Bags rest here. */
export const BELT_SURFACE_Y = 0.12
const ROLLER_Y = 0.04
const RAIL_Y = BELT_SURFACE_Y + 0.05
const WIDTH = CELL * 0.42
const RAIL_OFF = CELL * 0.14
/** Neighbouring arms overlap past the cell edge so the seam cannot read as a gap. */
const REACH = CELL * 0.5 + 0.25
/** Corner square. A bend arm starts here so its rails stay off the other arm. */
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

export function addBeltDeck(g: THREE.Group, arms: BeltArms | undefined) {
  const deckMat = new THREE.MeshStandardMaterial({ color: '#8e9aa3', roughness: 0.55, metalness: 0.08 })
  const railMat = new THREE.MeshStandardMaterial({ color: '#c9a227', emissive: '#5a4810', emissiveIntensity: 0.25, roughness: 0.45 })
  const rollerMat = new THREE.MeshStandardMaterial({ color: '#5a6a78', metalness: 0.35, roughness: 0.4 })
  const sides = deckSides(arms)
  const bend = sides.some((s) => s === 'n' || s === 's') && sides.some((s) => s === 'e' || s === 'w')
  const span = beltArmRange(bend)
  const len = span.to - span.from
  const mid = (span.from + span.to) / 2
  const deckGeo = new THREE.PlaneGeometry(len, WIDTH)
  const rollerGeo = new THREE.BoxGeometry(len, 0.05, CELL * 0.18)
  const railGeo = new THREE.BoxGeometry(len, 0.08, 0.06)
  let armIndex = 0
  for (const side of SIDES) {
    if (!sides.includes(side.arm)) continue
    const arm = new THREE.Group()
    arm.rotation.y = Math.atan2(-side.z, side.x)
    const deck = new THREE.Mesh(deckGeo, deckMat)
    deck.name = 'belt-deck'
    deck.rotation.x = -Math.PI / 2
    // A millimetre of stagger so the overlap has one winner and does not z-fight to a crack.
    deck.position.set(mid, BELT_SURFACE_Y + armIndex * 0.001, 0)
    deck.receiveShadow = true
    const railA = new THREE.Mesh(railGeo, railMat)
    railA.name = 'belt-rail'
    railA.position.set(mid, RAIL_Y, -RAIL_OFF)
    const railB = new THREE.Mesh(railGeo, railMat)
    railB.name = 'belt-rail'
    railB.position.set(mid, RAIL_Y, RAIL_OFF)
    const roller = new THREE.Mesh(rollerGeo, rollerMat)
    roller.position.set(mid, ROLLER_Y, 0)
    arm.add(deck, railA, railB, roller)
    g.add(arm)
    armIndex += 1
  }
  if (bend) {
    const joint = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, WIDTH), deckMat)
    joint.name = 'belt-deck'
    joint.rotation.x = -Math.PI / 2
    joint.position.y = BELT_SURFACE_Y + 0.004
    joint.receiveShadow = true
    g.add(joint)
  }
}
