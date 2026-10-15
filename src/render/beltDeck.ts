/**
 * Apron belt tile. The deck runs from the cell centre out to every side that
 * joins another belt cell, so a bend or a north-south run is still one belt.
 */
import * as THREE from 'three'
import { SKIN_TILE_M } from '../build/materialTargets'
import { CELL, WORLD_PER_METER } from './aircraft/specs'
import type { BeltArms } from './beltRuns'
import { metreUv, photoMaterial } from './world/buildingSkin'

/** Top of the rollers above the tile group, world units. Bags rest here. */
export const BELT_SURFACE_Y = 0.12
const DECK_Y = 0.05
const ROLLER_Y = 0.09
const RAIL_Y = 0.1
const WIDTH = CELL * 0.42
const RAIL_OFF = CELL * 0.14

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
  const deckMat = photoMaterial('conveyor_belt', '#4a525a')
  const railMat = new THREE.MeshStandardMaterial({ color: '#c9a227', emissive: '#5a4810', emissiveIntensity: 0.25, roughness: 0.45 })
  const rollerMat = new THREE.MeshStandardMaterial({ color: '#5a6a78', metalness: 0.35, roughness: 0.4 })
  const half = CELL * 0.46
  const deckGeo = metreUv(new THREE.PlaneGeometry(half, WIDTH), SKIN_TILE_M.conveyor, WORLD_PER_METER)
  const rollerGeo = new THREE.BoxGeometry(half * 0.8, 0.06, CELL * 0.18)
  const sides = deckSides(arms)
  const bend = sides.some((s) => s === 'n' || s === 's') && sides.some((s) => s === 'e' || s === 'w')
  // On a bend the rails start at the joint so they do not cross the other arm's belt.
  const railFrom = bend ? RAIL_OFF : 0
  const railGeo = new THREE.BoxGeometry(half - railFrom, 0.08, 0.06)
  for (const side of SIDES) {
    if (!sides.includes(side.arm)) continue
    const arm = new THREE.Group()
    arm.rotation.y = Math.atan2(-side.z, side.x)
    const deck = new THREE.Mesh(deckGeo, deckMat)
    deck.rotation.x = -Math.PI / 2
    deck.position.set(half / 2, DECK_Y, 0)
    deck.receiveShadow = true
    const railX = (railFrom + half) / 2
    const railA = new THREE.Mesh(railGeo, railMat)
    railA.position.set(railX, RAIL_Y, -RAIL_OFF)
    const railB = new THREE.Mesh(railGeo, railMat)
    railB.position.set(railX, RAIL_Y, RAIL_OFF)
    const roller = new THREE.Mesh(rollerGeo, rollerMat)
    roller.position.set(half / 2, ROLLER_Y, 0)
    arm.add(deck, railA, railB, roller)
    g.add(arm)
  }
  if (bend) {
    const joint = new THREE.Mesh(metreUv(new THREE.PlaneGeometry(WIDTH, WIDTH), SKIN_TILE_M.conveyor, WORLD_PER_METER), deckMat)
    joint.rotation.x = -Math.PI / 2
    joint.position.y = DECK_Y + 0.002
    joint.receiveShadow = true
    g.add(joint)
  }
}
