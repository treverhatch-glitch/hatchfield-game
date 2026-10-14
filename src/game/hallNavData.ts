/** Tunables for the live passenger walk in the Terminal view (src/game/hallNav.ts). */
import type { EquipKind } from '../terminalbuild/types.ts'
import type { ItemDef } from './terminal.ts'

export const HALL_NAV_TUNING = {
  /**
   * PaxNav seconds per sim clock second at 1x. PaxNav walks and serves in real
   * seconds (1.3 m/s, 75 s check-in); a game day is 180 clock seconds. 30 keeps
   * walkers near the old hall guests' pace (a clock second is 8 game minutes,
   * so any readable walk is already fast-forward against the timetable).
   */
  navSecPerClockSec: 30,
  /**
   * Nav seconds of departure lead per clock second left to STD. Larger than
   * the walk scale because the sim's show-up window (3 game hours = 22.5 clock s)
   * is far shorter than a real one once walking is readable: 120 turns a
   * leisure show-up into 45 nav minutes, time for security and a toilet or
   * shop stop before boarding opens (30 nav min out). Only real queues make
   * anyone miss.
   */
  departLeadScale: 120,
  /** Departure lead, clock seconds, for a walker with no flight yet (day-one walkers, unbound slots). */
  unknownLeadClockSec: 20,
  /** Seed for each hall's walker rolls (bags, needs, curb door). */
  seed: 204,
}

/** Arriving passengers on the hall's nav grid (src/game/hallArrivals.ts). Nav seconds, metres. */
export const HALL_ARRIVAL_TUNING = {
  /** Seed for arrival rolls (jet bridge cell, bags, needs, pace). */
  seed: 207,
  /** Share of arrivals with a checked bag to collect at the claim belt. */
  bagShare: 0.65,
  /** Chance an arrival stops at each before heading out. */
  needShare: { toilet: 0.2, shop: 0.1 },
  /** Nav seconds an arrival waits at the belt for a bag, min and max. */
  claimWaitSec: [120, 360] as const,
  /** Claim-hall cells within this many cells of a belt count as a spot to wait at. */
  claimReachCells: 2,
}

/** Prefab kit that stands on the claim hall: solid (walk round it), and the belts people wait beside. */
export const PREFAB_CLAIM_KIT = {
  solid: ['claim_carousel', 'bag_system'] as readonly string[],
  belts: ['claim_carousel'] as readonly string[],
}

/** Terminal-view walker drawing (src/render/hallNavCrowd.ts). Never changes who is in the sim. */
export const HALL_CROWD_TUNING = {
  /** Most walkers drawn in one frame; the nearest to the camera win. 0 = no cap. */
  maxVisible: 600,
  /** Walkers farther than this from the camera, metres, are not drawn. */
  drawDistM: 140,
  /** Past this distance, metres, walkers drop the head and bag and draw as a body only. */
  lodDistM: 55,
  /** Frustum test radius around a walker, metres. */
  cullRadiusM: 1.2,
}

/**
 * Prefab kit room -> build kit it stands for when a prefab hall is read as a
 * build layout. One piece per server, as far as the item's cell has room.
 */
export const PREFAB_ROOM_KIT: Partial<Record<NonNullable<ItemDef['room']>, EquipKind>> = {
  checkin: 'checkin_desk',
  bagdrop: 'checkin_desk',
  security: 'security_lane',
  gate: 'gate_desk',
  bathroom: 'toilet',
  food: 'shop_counter',
  souvenir: 'shop_counter',
}
