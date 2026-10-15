/** Late buildings from the Tier III / Prestige table. Pure data — no sim types. */

export type LandmarkId =
  | 'observation_tower'
  | 'aviation_museum'
  | 'sky_garden'
  | 'art_concourse'
  | 'grand_arrivals_hall'
  | 'quiet_hall'

export type CargoLateId = 'cargo_hub_ii' | 'cold_store'

export type Tier3PlusId = 'airport_hotel' | 'rail_link' | 'saf_blending' | LandmarkId | CargoLateId

interface BuildingBase {
  id: Tier3PlusId
  name: string
  /** Field Level required before the building can be ordered. */
  fieldLevel: number
  /** Construction cost in dollars. */
  cost: number
  /** Dollars charged once per game day after the building opens. Idle buildings still pay this. */
  dailyUpkeep: number
  /** Game days from order to open. Zero opens on the day it is ordered. */
  buildDays: number
  /** Why a player builds it. */
  purpose: string
  /** The downside that keeps it from being free money. */
  catch: string
}

export interface HotelBuilding extends BuildingBase {
  id: 'airport_hotel'
  kind: 'hotel'
  rooms: number
  /** Dollars for one connecting passenger who stays the night. */
  transferNightRate: number
  /** Dollars for one crew member who stays the night. */
  crewNightRate: number
}

export interface RailBuilding extends BuildingBase {
  id: 'rail_link'
  kind: 'rail'
  /** Added to demand once the station is open. 0.2 means +20%. */
  demandBonus: number
}

export interface SafBuilding extends BuildingBase {
  id: 'saf_blending'
  kind: 'saf'
  /** Fuel-cost multiplier once blending is online. 1.08 means +8%. */
  fuelCostMultiplier: number
  /** Open plant meets green-airline fuel demand. */
  satisfiesGreen: boolean
}

/** Cargo hub II and the cold store. Both extend the night hub's freighter wave. */
export interface CargoLateBuilding extends BuildingBase {
  id: CargoLateId
  kind: 'cargo'
  /** Economy-wallet node that must be owned before the building can be ordered. */
  requiresTech: string | null
  /** Chilled rooms this building counts as. Zero for the hub. */
  coldRooms: number
}

/** Prestige landmark. Visitors pay at the door; the rest is rating and demand. One per airport. */
export interface LandmarkBuilding extends BuildingBase {
  id: LandmarkId
  kind: 'landmark'
  /** Prestige stars the player must already hold. 0 means Field Level alone unlocks it. */
  unlockPrestigeStars: number
  /** Non-flying visitors drawn each game day while open. */
  visitorsPerDay: number
  /** Dollars each visitor pays. Zero means the landmark earns nothing at the door. */
  ticketUsd: number
  /** Added to passenger demand once open. 0.02 means +2%. */
  demandBonus: number
  /** Added to the field rating on a 0..1 scale once open. 0.01 is one rating point. */
  ratingBonus: number
  /** Metres of clear ground to the nearest runway tile. Zero means no rule. */
  runwayClearM: number
}

export type Tier3PlusBuilding = HotelBuilding | RailBuilding | SafBuilding | LandmarkBuilding | CargoLateBuilding

/** A placed site. Open/building is derived from elapsed days and the catalog timer. */
export interface BuildSite {
  id: Tier3PlusId
  /** Game days of construction already applied. */
  elapsedDays: number
}

export interface BuildProgress extends BuildSite {
  phase: 'building' | 'open'
  /** 0 at order, 1 when open. */
  progress: number
  daysLeft: number
}

export interface HotelNight {
  /** Connecting passengers who need a bed tonight. */
  transfers: number
  /** Crew members who need a bed tonight. */
  crew: number
}

export interface PnLLine {
  id: Tier3PlusId
  name: string
  open: boolean
  income: number
  upkeep: number
  net: number
  occupiedRooms: number
  emptyRooms: number
  transferRooms: number
  crewRooms: number
  note: string
}

/** One game day of income and upkeep for the placed late buildings. */
export interface DailyPnL {
  lines: PnLLine[]
  income: number
  upkeep: number
  net: number
}

export interface PlacedBuilding {
  ok: true
  site: BuildSite
  cost: number
}

export interface PlaceRefusal {
  ok: false
  reason: string
}

export type PlaceResult = PlacedBuilding | PlaceRefusal
