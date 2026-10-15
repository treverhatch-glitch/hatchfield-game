import type { LandmarkId } from './types.ts'

/**
 * Door take and siting rules for the prestige landmarks. The footfall, cost, upkeep,
 * rating and demand numbers come from src/content/buildings_tier3.ts; this file holds
 * only what that table does not say. None of them cover their own upkeep at the door.
 */
export const LANDMARK_TICKET_USD: Readonly<Record<LandmarkId, number>> = {
  observation_tower: 12,
  aviation_museum: 9,
  sky_garden: 10,
  art_concourse: 8,
  grand_arrivals_hall: 6,
  quiet_hall: 0,
}

/** The tower is tall. It keeps this far from any runway tile. */
export const LANDMARK_RUNWAY_CLEAR_M: Readonly<Partial<Record<LandmarkId, number>>> = {
  observation_tower: 110,
}

/** Daily rating cap. Landmarks lift the field rating; they cannot carry it. */
export const LANDMARK_RATING_CAP_POINTS = 8
