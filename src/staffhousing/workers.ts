import { WALKERS } from './data.ts'
import type { HousingBuilding, WalkerPose } from './types.ts'
import { detAtan2 } from '../game/detMath.ts'

/**
 * A short sample of crew walking from their house to the hall.
 * The loop is a ping-pong along the straight stroll, so the picture stays readable.
 */
export function walkerPoses(
  buildings: readonly HousingBuilding[],
  work: { c: number; r: number },
  simSeconds: number,
): WalkerPose[] {
  if (!buildings.length || !(simSeconds >= 0)) return buildings.length ? posesAt(buildings, work, 0) : []
  return posesAt(buildings, work, simSeconds)
}

function posesAt(
  buildings: readonly HousingBuilding[],
  work: { c: number; r: number },
  simSeconds: number,
): WalkerPose[] {
  const slots: { building: HousingBuilding; lane: number }[] = []
  for (const building of buildings) {
    const lanes = building.tier === 'village' ? 2 : 1
    for (let lane = 0; lane < lanes && slots.length < WALKERS.sample; lane++) slots.push({ building, lane })
  }
  let extra = 0
  while (slots.length < WALKERS.sample && buildings[0]) {
    slots.push({ building: buildings[0], lane: 8 + extra })
    extra++
  }
  const trip = WALKERS.tripSec
  return slots.map((slot, index) => {
    const offset = index * 0.27 * trip
    const span = trip * 2
    const cycle = ((simSeconds + offset) % span + span) % span
    const going = cycle <= trip
    const t = going ? cycle / trip : (span - cycle) / trip
    const from = slot.building.anchor
    const x = from.c + (work.c - from.c) * t
    const y = from.r + (work.r - from.r) * t
    const heading = detAtan2(going ? work.r - from.r : from.r - work.r, going ? work.c - from.c : from.c - work.c)
    return { id: `${slot.building.id}-w${index}`, tier: slot.building.tier, x, y, heading }
  })
}
