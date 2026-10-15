/**
 * Tier III buildings and prestige landmarks. Pure data: no sim wiring, no UI.
 * LATE_GAME_PLAN.md is not in the repo yet, so rows follow the lists in #123 / #126.
 * Hotel, rail link and SAF blending live in src/tier3plus/catalog.ts and are not repeated here.
 * Footprints are real meters. Money is dollars; upkeep is charged every game day.
 */

export interface Footprint {
  /** Meters along the building's long face. */
  widthM: number
  /** Meters front to back. */
  depthM: number
}

/** Numeric effects a building gives once open. Only the keys a row sets apply. */
export interface BuildingEffects {
  contactGates?: number
  remoteStands?: number
  securityLanes?: number
  parkingSpaces?: number
  hotelRooms?: number
  /** Litres of jet fuel stored on site. */
  fuelStorageLitres?: number
  cargoTonnesPerDay?: number
  /** Aircraft that can be de-iced at once. */
  deicingBays?: number
  /** Extra runway movements per hour the approach can sequence. */
  runwayMovementsPerHour?: number
  /** Added to passenger demand. 0.05 means +5%. */
  demandBonus?: number
  /** Added to the airport rating (0..1 scale). */
  ratingBonus?: number
  /** Non-flying visitors drawn to the airport each day. */
  touristFootfallPerDay?: number
}

interface BuildingBase {
  id: string
  name: string
  /** Field Level required before the building can be ordered. */
  unlockFL: number
  /** Construction cost in dollars. */
  cost: number
  /** Dollars charged per game day once open. Idle buildings still pay. */
  upkeepPerDay: number
  /** Game days from order to open. */
  buildDays: number
  footprint: Footprint
  /** Staff needed to run it at full output. */
  staff: number
  effects: BuildingEffects
  /** Why a player builds it. */
  purpose: string
  /** The downside that keeps it from being free money. */
  catch: string
}

export interface Tier3BuildingDef extends BuildingBase {
  tier: 3
}

export interface PrestigeLandmarkDef extends BuildingBase {
  tier: 'prestige'
  /** Prestige stars the player must already hold. 0 means Field Level alone unlocks it. */
  unlockPrestigeStars: number
  /** Prestige stars the landmark is worth (1..3). */
  prestigeStars: number
  /** City approval points granted (0..15). */
  cityApprovalBonus: number
  /** One per airport. */
  unique: true
}

export type LateBuildingDef = Tier3BuildingDef | PrestigeLandmarkDef

export const TIER3_BUILDINGS: readonly Tier3BuildingDef[] = [
  {
    id: 'pier_iii', tier: 3, name: 'Pier III', unlockFL: 7,
    cost: 420_000, upkeepPerDay: 6_500, buildDays: 12,
    footprint: { widthM: 300, depthM: 40 }, staff: 24,
    effects: { contactGates: 6 },
    purpose: 'Six more contact gates off the main terminal',
    catch: 'Far gates add walking time to every connection',
  },
  {
    id: 'multi_storey_garage', tier: 3, name: 'Multi-storey garage', unlockFL: 7,
    cost: 350_000, upkeepPerDay: 3_200, buildDays: 10,
    footprint: { widthM: 120, depthM: 80 }, staff: 8,
    effects: { parkingSpaces: 1_800 },
    purpose: 'Dense parking close to the curb',
    catch: 'Empty decks still need lighting and patrols',
  },
  {
    id: 'remote_screening', tier: 3, name: 'Remote screening', unlockFL: 7,
    cost: 280_000, upkeepPerDay: 4_800, buildDays: 6,
    footprint: { widthM: 60, depthM: 40 }, staff: 18,
    effects: { securityLanes: 4 },
    purpose: 'Screens pax away from the main checkpoint',
    catch: 'Needs its own staffed lanes all day',
  },
  {
    id: 'deicing_apron_ii', tier: 3, name: 'De-icing apron II', unlockFL: 7,
    cost: 310_000, upkeepPerDay: 3_900, buildDays: 8,
    footprint: { widthM: 180, depthM: 90 }, staff: 12,
    effects: { deicingBays: 4 },
    purpose: 'Four more de-icing bays for winter banks',
    catch: 'Glycol and crews cost money even in summer',
  },
  {
    id: 'business_hotel', tier: 3, name: 'Business hotel', unlockFL: 8,
    cost: 380_000, upkeepPerDay: 6_000, buildDays: 14,
    footprint: { widthM: 70, depthM: 30 }, staff: 40,
    effects: { hotelRooms: 220, ratingBonus: 0.01 },
    purpose: 'Premium rooms for crews and business travellers',
    catch: 'Weekend occupancy drops hard',
  },
  {
    id: 'fuel_farm_iii', tier: 3, name: 'Fuel farm III', unlockFL: 8,
    cost: 520_000, upkeepPerDay: 5_500, buildDays: 12,
    footprint: { widthM: 150, depthM: 100 }, staff: 10,
    effects: { fuelStorageLitres: 12_000_000 },
    purpose: 'Days of jet fuel for a widebody schedule',
    catch: 'Tank inspections and safety zone eat land',
  },
  {
    id: 'cargo_hub_ii', tier: 3, name: 'Cargo hub II', unlockFL: 8,
    cost: 220_000, upkeepPerDay: 8_000, buildDays: 16,
    footprint: { widthM: 220, depthM: 120 }, staff: 60,
    effects: { cargoTonnesPerDay: 900 },
    purpose: 'Freighter-scale sort and build-up',
    catch: 'Large crew to pay through slow cargo weeks',
  },
  {
    id: 'resort_hotel', tier: 3, name: 'Resort hotel', unlockFL: 9,
    cost: 760_000, upkeepPerDay: 11_000, buildDays: 20,
    footprint: { widthM: 160, depthM: 90 }, staff: 85,
    effects: { hotelRooms: 400, touristFootfallPerDay: 300, demandBonus: 0.03 },
    purpose: 'Leisure demand and destination stays',
    catch: 'Seasonal; off-season rooms sit empty',
  },
  {
    id: 'atc_approach_centre', tier: 3, name: 'ATC approach centre', unlockFL: 9,
    cost: 160_000, upkeepPerDay: 12_000, buildDays: 18,
    footprint: { widthM: 50, depthM: 40 }, staff: 30,
    effects: { runwayMovementsPerHour: 6 },
    purpose: 'Tighter approach spacing on busy banks',
    catch: 'Controllers are scarce and expensive',
  },
  {
    id: 'satellite_concourse', tier: 3, name: 'Satellite concourse', unlockFL: 10,
    cost: 2_400_000, upkeepPerDay: 28_000, buildDays: 30,
    footprint: { widthM: 420, depthM: 60 }, staff: 70,
    effects: { contactGates: 12, ratingBonus: 0.02 },
    purpose: 'Twelve widebody-ready gates in the middle of the apron',
    catch: 'Needs a people mover or pax miss connections',
  },
]

export const PRESTIGE_LANDMARKS: readonly PrestigeLandmarkDef[] = [
  {
    id: 'observation_tower', tier: 'prestige', name: 'Observation tower', unlockFL: 8, unlockPrestigeStars: 0,
    cost: 600_000, upkeepPerDay: 7_000, buildDays: 20,
    footprint: { widthM: 30, depthM: 30 }, staff: 14,
    effects: { ratingBonus: 0.01, touristFootfallPerDay: 400 },
    prestigeStars: 1, cityApprovalBonus: 6, unique: true,
    purpose: 'A skyline icon visitors pay to climb',
    catch: 'Needs an obstacle clearance from the runway',
  },
  {
    id: 'aviation_museum', tier: 'prestige', name: 'Aviation museum', unlockFL: 9, unlockPrestigeStars: 0,
    cost: 850_000, upkeepPerDay: 9_500, buildDays: 24,
    footprint: { widthM: 110, depthM: 70 }, staff: 22,
    effects: { ratingBonus: 0.01, touristFootfallPerDay: 600 },
    prestigeStars: 1, cityApprovalBonus: 8, unique: true,
    purpose: 'Heritage hangar that draws school trips',
    catch: 'Curators and climate control every day',
  },
  {
    id: 'sky_garden', tier: 'prestige', name: 'Sky garden', unlockFL: 10, unlockPrestigeStars: 0,
    cost: 1_100_000, upkeepPerDay: 12_000, buildDays: 26,
    footprint: { widthM: 80, depthM: 40 }, staff: 18,
    effects: { ratingBonus: 0.02, touristFootfallPerDay: 350 },
    prestigeStars: 2, cityApprovalBonus: 10, unique: true,
    purpose: 'Airside garden that calms long layovers',
    catch: 'Gardeners and irrigation never stop',
  },
  {
    id: 'art_concourse', tier: 'prestige', name: 'Art concourse', unlockFL: 10, unlockPrestigeStars: 1,
    cost: 1_300_000, upkeepPerDay: 13_500, buildDays: 22,
    footprint: { widthM: 200, depthM: 25 }, staff: 16,
    effects: { ratingBonus: 0.02, demandBonus: 0.01, touristFootfallPerDay: 250 },
    prestigeStars: 2, cityApprovalBonus: 9, unique: true,
    purpose: 'Rotating exhibitions along the airside walk',
    catch: 'Insurance and curation fees run high',
  },
  {
    id: 'grand_arrivals_hall', tier: 'prestige', name: 'Grand arrivals hall', unlockFL: 10, unlockPrestigeStars: 2,
    cost: 2_000_000, upkeepPerDay: 20_000, buildDays: 32,
    footprint: { widthM: 160, depthM: 80 }, staff: 30,
    effects: { ratingBonus: 0.03, demandBonus: 0.02, touristFootfallPerDay: 500 },
    prestigeStars: 3, cityApprovalBonus: 12, unique: true,
    purpose: 'A landmark first impression for every arrival',
    catch: 'Huge volume to heat, cool and clean',
  },
  {
    id: 'quiet_hall', tier: 'prestige', name: 'Quiet hall', unlockFL: 10, unlockPrestigeStars: 3,
    cost: 1_600_000, upkeepPerDay: 15_000, buildDays: 24,
    footprint: { widthM: 60, depthM: 40 }, staff: 10,
    effects: { ratingBonus: 0.02, touristFootfallPerDay: 150 },
    prestigeStars: 3, cityApprovalBonus: 15, unique: true,
    purpose: 'Multi-faith chapel and quiet room the city loves',
    catch: 'Earns nothing directly; pure upkeep',
  },
]

export const LATE_BUILDINGS: readonly LateBuildingDef[] = [...TIER3_BUILDINGS, ...PRESTIGE_LANDMARKS]
