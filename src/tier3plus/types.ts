/** Late buildings from the Tier III / Prestige table. Pure data — no sim types. */

export type Tier3PlusId = 'airport_hotel' | 'rail_link' | 'saf_blending' | 'spotters_deck'

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
  /** Only one of this building may be placed. */
  unique?: boolean
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

export interface SpottersDeckBuilding extends BuildingBase {
  id: 'spotters_deck'
  kind: 'spotters'
  /** Gate receipts earned once per game day. */
  dailyIncome: number
  /** Prestige amenities exposed to airline diplomacy. Does not grant field XP. */
  prestigeItems: number
  /** Decorative visitors shown on the raised deck. */
  crowdSize: number
}

export type Tier3PlusBuilding = HotelBuilding | RailBuilding | SafBuilding | SpottersDeckBuilding

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
