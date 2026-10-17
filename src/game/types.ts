import type { InboundState } from '../inbound/types.ts'
import type { EconomyState } from '../economy/types.ts'
import type { CouncilState } from '../council/types.ts'
import type { Tier3Save } from '../tier3/types.ts'
import type { Tier3PlusId } from '../tier3plus/types.ts'
import type { PremiumState } from '../premium/types.ts'
import type { TycoonState } from '../tycoon/types.ts'
import type { PlaytestYearSave } from '../reports/book.ts'
import type { StaffHousingSave } from '../staffhousing/types.ts'
import type { BuildLayout, InteriorEdit } from '../terminalbuild/types.ts'
import type { ResearchState } from '../research/types.ts'
import type { Wave3State } from '../wave3/types.ts'
import type { SpotInbound, SpotOffer } from '../fuel/offerData.ts'
import type { CarbonSave } from '../sustainability/carbon.ts'

export const SIZE = 32
export const SAVE_KEY = 'apron-save-v25'

export type Tile =
  | 'grass'
  | 'runway'
  | 'taxi'
  | 'stand'
  | 'terminal'
  | 'snack'
  | 'bags'
  /** Painted bag belt — links hall ↔ bag sort ↔ stands. */
  | 'belt'
  | 'fuel'
  | 'fire'
  | 'police'
  | 'cargo'
  /** City-edge vehicle screen — cargo trucks / contractors pass here. */
  | 'guard'
  | 'road'
  | 'tower'
  | 'hangar'
  | 'helipad'
  | 'hotel'
  | 'park_s'
  | 'park_l'
  | 'park_g'
  | 'park_u'
  | 'deice'
  | 'bus'
  /** Extra drop-off lane beside the public road. Adds curb stalls. */
  | 'curb_lane'
  /** Taxi queue off the passenger curb. Adds curb stalls. */
  | 'taxi_rank'
  | 'rail'
  /** Apron terminal-bus depot — ferries remote-stand pax. */
  | 'termbus'
  /** Guideway between terminals. Pods run while the link is open. */
  | 'mover'
  /** Airside buses for connecting passengers. */
  | 'xferbus'
  /** Covered bridge between terminal halls. */
  | 'skywalk'
  /** Moving walkway on the apron. Passengers on it move faster. */
  | 'travelator'
  /** Catering production for the ground fleet. */
  | 'kitchen'
  /** Where fuel, galley, bag, and bus trucks stage. */
  | 'depot'
  /** Late-game heavy-check hangar. Aircraft occupy a bay and tie up a stand. */
  | 'mro'
  /** Late-game freighter night wave. */
  | 'nighthub'
  /** Fuel-supply rail. Delivery starts only when this reaches the map edge. */
  | 'fuel_rail'
  /** Unloads a fuel train into the tank farm. */
  | 'oil'
  /** Fuel pipeline. Flow starts only when this reaches the map edge. */
  | 'fuel_pipe'
  /** Receipt manifold. Pipeline flow needs this on the pipe, beside the farm. */
  | 'manifold'
  /** Barge berth. Only on the river edge of a riverside plot. */
  | 'berth'
  /** Late-game airport hotel (transfer and crew nights). */
  | 'late_hotel'
  /** Late-game rail link station. Demand bonus once the build finishes. */
  | 'late_rail'
  /** Sustainable aviation fuel blending plant. */
  | 'saf'
  /** Tier III prestige landmark. Which one is read from the late site on the cell. */
  | 'late_landmark'
  /** Cargo hub II or the cold store. Which one is read from the late site on the cell. */
  | 'late_cargo'
  /** Raised public viewing deck with visible plane-spotter crowds. */
  | 'spotters_deck'

/** How a hall guest reached (or will leave) the airport. */
export type ArriveMode =
  | 'dropoff'
  | 'car_short'
  | 'car_long'
  | 'bus'
  | 'rail'
  | 'hotel'

export type RunwayClass = 'short' | 'regional' | 'heavy'
/** Car park term — set when stamping a park tile. */
export type ParkTerm = 'short' | 'long'
/** Outside hotel grade — inn / business / resort. */
export type HotelClass = 'inn' | 'business' | 'resort'
/** Stand size class — S regional / M narrow / L wide+freight+mil. */
export type StandClass = 'S' | 'M' | 'L'
/**
 * Stand gate link — jetway stands are expensive and attach to a nearby hall.
 * Remote stands use terminal buses (if built) or walking pax on the apron.
 */
export type StandAccess = 'remote' | 'jetway'
/** How pax move between a stand and the terminal this turn. */
export type StandPaxMode = 'jetway' | 'bus' | 'walk'

export type Tool =
  | 'pan'
  | 'runway_short'
  | 'runway'
  | 'runway_heavy'
  | 'helipad'
  | 'taxi'
  | 'stand_s'
  | 'stand'
  | 'stand_l'
  | 'stand_light'
  | 'stand_narrow'
  | 'stand_heavy'
  | 'terminal'
  | 'premade'
  | 'snack'
  | 'bags'
  | 'belt'
  | 'fuel'
  | 'fire'
  | 'police'
  | 'cargo'
  | 'guard'
  | 'road'
  | 'tower'
  | 'hangar'
  | 'hotel_inn'
  | 'hotel_biz'
  | 'hotel_resort'
  | 'park_s'
  | 'park_l'
  | 'park_g'
  | 'park_u'
  | 'deice'
  | 'bus'
  | 'curb_lane'
  | 'taxi_rank'
  | 'term_bus'
  | 'people_mover'
  | 'xfer_bus'
  | 'hub_skywalk'
  | 'rail'
  | 'kitchen'
  | 'depot'
  | 'mro'
  | 'nighthub'
  | 'stand_w'
  | 'hangar_w'
  | 'hangar_j'
  | 'fuel_rail'
  | 'oil'
  | 'fuel_pipe'
  | 'manifold'
  | 'berth'
  | 'travelator'
  | 'skywalk'
  | 'mover'
  | 'airport_hotel'
  | 'rail_link'
  | 'saf_blending'
  | 'observation_tower'
  | 'aviation_museum'
  | 'sky_garden'
  | 'art_concourse'
  | 'grand_arrivals_hall'
  | 'quiet_hall'
  | 'cargo_hub_ii'
  | 'cold_store'
  | 'spotters_deck'
  | 'clear'

export type Speed = 0 | 1 | 3 | 5
export type Difficulty = 'easy' | 'standard'
export type SiteKind = 'city' | 'factory'
/** New Game campaign bias — does not hard-lock the other path. */
export type StartFocus = 'pax' | 'cargo' | 'hybrid'

/** Dev / trial: spend never fails and cash stays topped up. */
export const SANDBOX_CASH = 9_999_999
export type FuelBrand = 'apex' | 'kiln'
export type CaterBrand = 'skybite' | 'galleyprime'
/** Premade ids or `proc-xxxx` regional fillers. */
export type AirlineId = string
export type AirlinePersona =
  | 'budget'
  | 'business'
  | 'luxury'
  | 'cargo_night'
  | 'military_gov'

/** Carrier size ladder — 1 commuter → 5 mega-global (CS-style unlock ladder). */
export type AirlineTier = 1 | 2 | 3 | 4 | 5

/** How the carrier makes money — cross-cuts size tiers. */
export type AirlineBizModel = 'charter' | 'lcc' | 'full_service' | 'cargo'
/** Ops budget lines — 0–100% of full allocation. */
export type BudgetKey = 'maintenance' | 'security' | 'cleaning' | 'fire' | 'ambulance'
export type Weather = 'clear' | 'rain' | 'fog' | 'storm'

export type Phase =
  | 'hold'
  | 'approach'
  | 'landing'
  | 'taxi_in'
  | 'deboard'
  | 'servicing'
  | 'mx_taxi'
  | 'mx_bay'
  | 'mx_return'
  | 'board'
  | 'pushback'
  | 'parked'
  | 'taxi_out'
  | 'takeoff'
  | 'gone'

export type RoomId =
  | 'checkin'
  | 'security'
  | 'gate'
  | 'bagclaim'
  | 'food'
  | 'souvenir'
  | 'bagdrop'
  | 'lounge'
  | 'bathroom'
  | 'golf'
  | 'waterfall'
  | 'gaming'
  | 'dayhotel'
  | 'spa'
  | 'pool'
  | 'rdesk'
  | 'rboard'
  | 'rmachine'

export type Vec = { c: number; r: number }

export interface LandSite {
  id: SiteKind
  name: string
  blurb: string
  cost: number
  paxMult: number
  cargoMult: number
}

export interface AirlineReq {
  stands: number
  fuelContract: boolean
  fuelFarm: boolean
  fire: boolean
  police: boolean
  terminal: boolean
  security: number
  bags: boolean
  snack: boolean
  catering: boolean
  cargo: boolean
  road: boolean
  tower: boolean
  heavyRunway: boolean
}

export interface Airline {
  id: AirlineId
  name: string
  color: string
  stripe: string
  kind: 'pax' | 'cargo'
  persona: AirlinePersona
  /** Size tier 1–5 (commuter → mega). Gates offers via field level. */
  tier: AirlineTier
  /** Business model axis (LCC / full-service / cargo / charter). */
  bizModel: AirlineBizModel
  /** Typical metal for the Airlines panel. */
  fleetBlurb: string
  landing: number
  catering: number
  bags: number
  paxMin: number
  paxMax: number
  /** Soft gate — they ignore you below this reputation. */
  minRep: number
  req: AirlineReq
  blurb: string
  /** Wants layover-hub deals when hall amenities exist. */
  likesLayovers: boolean
  /** How fast heat drops on bad hall outcomes (higher = thinner skin). */
  heatSensitivity: number
  procedural?: boolean
}

/** Bank product — bigger principal = higher fee, slower tick, lower rate. */
export interface LoanProduct {
  id: string
  label: string
  blurb: string
  principal: number
  fee: number
  /** Fraction of balance charged each interest tick (floor also applies). */
  rate: number
  /** Floor cash interest per tick. */
  interestFloor: number
  /** Sim-seconds between loan ticks (interest + principal installment). */
  every: number
  /** Game days to repay the amount opened in equal principal installments. */
  termDays: number
  /** Field level required to see / take this product. */
  minFieldLevel: number
  /** Soft reputation gate. */
  minRep: number
}

/** High-heat perk unlocked per carrier — persona picks the flavor. */
export type AirlineRewardId =
  | 'brand_lounge'
  | 'budget_perk'
  | 'biz_priority'
  | 'cargo_night'

/** R&D unlocks — CEO-style progression spine. */
export type ResearchId =
  | 'night_bank'
  | 'deice'
  | 'stand_class'
  | 'widebody_ops'
  | 'heavy_pack'
  | 'mil_ramp'
  | 'hydrant_fuel'
  | 'rail_fuel'
  | 'pipeline_fuel'
  | 'tank_farm_ii'
  | 'tank_farm_iii'
  | 'bag_sorter'
  | 'bag_bhs'
  | 'self_service'
  | 'ct_lanes'
  | 'egates'
  | 'travelator'
  | 'skywalk'
  | 'people_mover'
  | 'transfer_centre'
  | 'rfid_bag_line'
  | 'mro_hangar'
  | 'cargo_night_hub'

export interface LayoverOffer {
  airline: AirlineId
  age: number
  /** Flat fee paid up front when signed. */
  fee: number
  /** Sim-seconds the bank of transfer pax stays. */
  duration: number
  /** How many transfer guests to drip into the hall. */
  transferPax: number
  /** Sim-seconds left before the letter expires. */
  deadline: number
}

export interface LayoverContract {
  airline: AirlineId
  endsAt: number
  remaining: number
  spawned: number
  transferPax: number
  happySum: number
  samples: number
  fee: number
}

/** Hub-ladder letter. Older saves omit `tier` and mean Hub. */
export interface HubOffer {
  airline: AirlineId
  age: number
  fee: number
  /** Sim-seconds left before the letter expires. */
  deadline: number
  tier?: 'focus' | 'base' | 'hub' | 'primary'
}

export interface HubContract {
  airline: AirlineId
  signedAt: number
}

/** Independent GA parking request — not a signed airline. */
export interface ParkingOffer {
  id: string
  callsign: string
  airframeId: string
  fee: number
  /** Sim-seconds they will stay once accepted. */
  staySec: number
  age: number
  deadline: number
}

export interface FuelContract {
  id: FuelBrand
  name: string
  sign: number
  wholesale: number
  pump: number
}

export interface CaterContract {
  id: CaterBrand
  name: string
  sign: number
  /** Multiplier on airline catering fee when the truck completes. */
  payoutMult: number
  blurb: string
}

export interface BuildDef {
  tool: Exclude<Tool, 'pan' | 'clear' | 'runway' | 'premade'>
  tile: Tile
  name: string
  cost: number
  blurb: string
  /** Hidden until the field reaches this level. The starter kit stamps tiles directly. */
  minFieldLevel?: number
  /** Project that must be bought before the stamp is offered. */
  research?: ResearchId
  /** Operating cost per game day. Legacy tick rates are multiplied by six. */
  upkeepPerDay?: number
}

export interface RoomDef {
  id: RoomId
  name: string
  cost: number
  blurb: string
}

export type ScheduleStatus =
  | 'scheduled'
  | 'delayed'
  | 'inbound'
  | 'done'
  | 'cancelled'

/** Runway timetable entry — auto-filled or player-placed. */
export interface ScheduleSlot {
  id: string
  airline: AirlineId
  flightNo: string
  /** Sim-clock ETA for approach push. */
  eta: number
  status: ScheduleStatus
  delaySec: number
  delayReason: string | null
  /** Player-placed vs tower auto bank. */
  manual: boolean
  flightId: string | null
  /** Planner v2 — preferred stand; null = tower picks. */
  standPref?: Vec | null
  /** Preferred runway strip index (0-based); null = tower picks. */
  runwayPref?: number | null
  /** Airframe the planner named for this slot. Spawn keeps it when the field can take it. */
  airframeId?: string | null
  /**
   * Assigned baggage claim (1-based) planned when the inbound slot is banked.
   * Only arrivals use claims — cargo slots leave this null.
   */
  claimLane?: number | null
}

export interface ContractOffer {
  airline: AirlineId
  age: number
  /** Sim-seconds left before the letter expires unread. */
  deadline: number
}

/** CEO-style airline ask after the first turn — concrete field goals with a clock. */
export type FieldTaskKind =
  | 'bathroom'
  | 'food'
  | 'fire'
  | 'desk'
  | 'police'
  | 'hangar'
  | 'janitor'
  | 'cargo'
  | 'helipad'
  | 'hotel'
  | 'park'
  | 'desk_extra'

export interface FieldTask {
  id: string
  airline: AirlineId
  kind: FieldTaskKind
  title: string
  blurb: string
  bonus: number
  /** Sim clock when the ask expires. */
  deadline: number
  age: number
}

/** Cargo volume window — stage intake units before the clock dies. */
export interface CargoVolumeJob {
  id: string
  airline: AirlineId
  /** Units that must clear city intake (warehouse deliveries). */
  targetUnits: number
  delivered: number
  fee: number
  /** Absolute sim clock deadline. */
  deadline: number
  age: number
}

/** Airline line-maintenance contract offer (hangar work for their jets). */
export interface MxOffer {
  airline: AirlineId
  age: number
  /** Per-turnaround payout when you service their craft. */
  payout: number
  /** Sim-seconds left before the letter expires. */
  deadline: number
}

export type Budgets = Record<BudgetKey, number>

export interface SignedContract {
  airline: AirlineId
  day: number
}

/** What the metal is for — drives size, fees, and whether the hall cares. */
export type AircraftKind =
  | 'regional'
  | 'narrowbody'
  | 'widebody'
  | 'freighter'
  | 'helo_med'
  | 'helo_exec'
  | 'military'
  | 'air_ambulance'

export interface Flight {
  id: string
  /**
   * Render-only: sim clock (seconds) of this airframe's last maintenance or repaint here.
   * Resets the drawn wear to factory fresh (render/aircraft/airframeWear.ts). Not read by the sim.
   * TODO(maintenance/repaint): set when such an event exists; unset means "at tier baseline".
   */
  lastServicedClock?: number
  airline: AirlineId
  flightNo: string
  /** Real airframe id from airframes catalog (e.g. b738). */
  airframeId: string
  /** Display name cached at spawn (Boeing 737-800). */
  airframeName: string
  pax: number
  cargo: boolean
  /** Jets use runway+stand; helos use a helipad as stand. */
  craft: 'jet' | 'helo'
  kind: AircraftKind
  phase: Phase
  stand: Vec | null
  x: number
  y: number
  z: number
  heading: number
  path: Vec[]
  seg: number
  t: number
  holdAngle: number
  posted: {
    landing: boolean
    bags: boolean
    /** Outbound bags loaded at board. */
    bagsLoad: boolean
    fuel: boolean
    catering: boolean
    bagDrop: boolean
    /** Line MX mechanic visited from hangar. */
    mx: boolean
    /** Glycol / de-ice service completed this turn. */
    deiced: boolean
  }
  waitingOn: {
    bags: boolean
    bagsLoad: boolean
    fuel: boolean
    catering: boolean
    /** Line MX en route from hangar (does not hard-block turn). */
    mx: boolean
    /** Storm/fog de-ice truck en route before pushback. */
    deice: boolean
    paxOut: number
    paxIn: number
  }
  phaseTime: number
  ledger: { label: string; amount: number }[]
  /** Moments this flight already rolled a crash check for. */
  crashRolls?: { landing?: boolean; takeoff?: boolean }
  /** Go-arounds flown on this arrival (ground control). Diverts at the cap. */
  goArounds?: number
  /** Linked timetable slot when spawned from the schedule. */
  scheduleId?: string | null
  /** Sim-clock scheduled departure. Show-up is keyed to this, not to boarding. */
  std?: number
  boardingSlow?: boolean
  /** Board `phaseTime` when the doors closed and the jet bridge began to retract. */
  bridgeShutAt?: number | null
  /** GA: clock when leave was requested; must depart by parkLeaveBy. */
  parkLeaveRequestedAt?: number | null
  /** GA parking — must depart by this clock or fine. */
  parkLeaveBy?: number | null
  /** Independent general aviation (not a signed airline). */
  ga?: boolean
  /** Parking fee already collected on accept. */
  parkFee?: number
  /** Planned park duration before they request departure. */
  parkStaySec?: number
  /** Soft next city / route label for hover inspect. */
  destination?: string
  /** 0–1 fuel state (hover bars). */
  fuelLevel?: number
  /** 0–1 catering / cabin service state (hover bars). */
  caterLevel?: number
  /** Hangar tile reserved for line MX bay visit. */
  hangarBay?: Vec | null
  /** Sim clock when hangar MX finishes. */
  mxEndsAt?: number | null
  /** Total hangar MX dwell (for progress bar). */
  mxDuration?: number
  /** Payout waiting when hangar MX completes. */
  mxPay?: number
  /** Airline MX contract wants a hangar visit this turn. */
  mxPending?: boolean
  /**
   * Stand id when the ground-logistics module owns this turnaround.
   * Pushback waits until that turnaround is finished.
   */
  groundTurn?: string | null
  /** Set while an empty farm is holding this departure on the stand. */
  fuelHeld?: boolean
  /** Sim-clock when the empty-farm hold started. Past the slot, the flight is cancelled. */
  fuelHeldSince?: number
  /** Passenger and slot fees already returned because the departure was fuel-dry. */
  unflownRefunded?: number
  /** One-shot emergency host (divert / tanker) occupying a banked gate. */
  emergencyHost?: boolean
  hostKind?: EmergencyKind
  /** Aggregate checked-bag units for this turn (PaxTag mix) — not per-suitcase agents. */
  bagUnits?: number
  /**
   * Living bag pipeline stage (Manor Lords-style timed handoffs).
   * Inbound only uses claimLane; outbound uses check-in deposit → load.
   */
  bagStage?: BagFlowStage
  /** Assigned baggage claim carousel (1-based). Inbound only. */
  claimLane?: number | null
  /** Outbound units deposited at check-in so far. */
  bagsDeposited?: number
  /** Outbound units that made it onto the aircraft. */
  bagsLoaded?: number
  /** Outbound units left behind when the flight was released short. */
  bagsOffloaded?: number
  /** Inbound units that did not fit the claim hall. */
  claimLeft?: number
  /** Inbound visit that owns this arrival. The stand stays occupied until release. */
  inboundVisitId?: string
  /** Sim clock when this inbound visit frees the stand. */
  inboundReleaseAt?: number
  /** A–F once the ground turn finishes. Empty while the turn is still open. */
  turnGrade?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  turnGradeNote?: string
}

/** Timed bag journey — aggregate units, not per-suitcase agents. */
export type BagFlowStage =
  | 'idle'
  | 'pax_deposit'
  | 'hold_screen'
  | 'outbound_sort'
  | 'load_aircraft'
  | 'inflight'
  | 'unload_aircraft'
  | 'inbound_sort'
  | 'deliver_claim'
  | 'on_claim'
  | 'complete'

/** Live security event the player must answer. */
export interface PendingThreat {
  id: string
  severity: 'soft' | 'hard'
  blurb: string
  age: number
  /** Seconds left before it auto-resolves as ignored. */
  deadline: number
}

/** Weather divert or firefighting-plane ask — accept for fee, refuse for heat. */
export type EmergencyKind = 'divert' | 'tanker' | 'tanker_mx'
/** tanker = airtanker refuel-only; tanker_mx = refuel + hangar line MX. */

export interface PendingEmergency {
  id: string
  kind: EmergencyKind
  blurb: string
  fee: number
  age: number
  deadline: number
  /** Airline flavor for divert (null = tanker / mutual aid). */
  airline: AirlineId | null
  /** What the field must have to host without failing. */
  needs: {
    stand: boolean
    fire: boolean
    fuel: boolean
    hangar: boolean
    /** Min continuous runway cells. */
    minRunway: number
  }
}

/**
 * Real apron GSE roles:
 * bags: unload (shed→plane) → to_claim (plane→shed/claim) → home/continue
 *       pickup (→shed makeup) → load (shed→plane) → home/continue
 * fuel: fuel_reload at farm → fuel (farm→plane) → reload or continue
 * mx:   hangar mechanic walk (people), not a truck
 */
export type TruckMission =
  | 'unload'
  | 'to_claim'
  | 'pickup'
  | 'load'
  | 'fuel'
  | 'fuel_reload'
  | 'deice'
  | 'cater'
  | 'patrol'
  | 'ferry_arr'
  | 'ferry_dep'
  /** Inbound bags processing at sort before claim inject. */
  | 'sort_inbound'
  /** City cargo: edge → guard screen. */
  | 'city_guard'
  /** City cargo: guard → shed deliver. */
  | 'city_shed'
  /** City cargo: leave field after delivery. */
  | 'city_depart'
  /** Contractor van: off-map → guard. */
  | 'build_guard'
  /** Contractor / delivery: guard → site, then unload. */
  | 'build_site'
  /** Leave the field after the drop. */
  | 'build_out'

export interface Truck {
  id: string
  kind:
    | 'fuel'
    | 'bags'
    | 'catering'
    | 'fire'
    | 'police'
    | 'deice'
    | 'termbus'
    | 'citycargo'
    | 'contractor'
    | 'delivery'
  flightId: string | null
  x: number
  y: number
  path: Vec[]
  seg: number
  t: number
  returning: boolean
  dwell: number
  /** Makeup / farm bottom-load before the truck rolls. */
  preDwell: number
  patrol: boolean
  /** Real-life role — bags unload vs load, etc. */
  mission: TruckMission
  /** Home shed / farm tile to return to. */
  home: Vec | null
  /** Visible load — bag units on this cart (Manor Lords crate feel). */
  cargoUnits?: number
  /** Carts in this tug's train. Omitted on trucks that are not bag tugs. */
  carts?: number
  /** Trips still owed, including the one in progress. */
  runsLeft?: number
  /** Heading home to pick up the next lap of the same flight. */
  repeatRun?: boolean
  /** Stand-service dwell this stop started with, in sim seconds. Crew steps fill it. */
  serviceFor?: number
}

export type PaxStop =
  | 'bags'
  | 'claim'
  | 'food'
  | 'shop'
  | 'exit'
  | 'checkin'
  | 'security'
  | 'gate'
  | 'plane'

export interface Person {
  id: string
  flightId: string
  x: number
  y: number
  path: Vec[]
  seg: number
  t: number
  color: string
  job: 'arrive' | 'board' | 'staff' | 'patrol' | 'mechanic' | 'janitor' | 'researcher'
  /** Ordered stops still ahead (plane→bags→food→exit or landside→gate→plane). */
  itinerary: PaxStop[]
  label: string
  wantBag: boolean
  wantFood: boolean
  wantGift: boolean
  stage: number
  paidFood: boolean
  paidGift: boolean
  /** Line MX payout posted when mechanic finishes at the stand. */
  mxPay?: number
  /** Seconds left on current researcher duty (desk/board/lab/break/home). */
  dutySec?: number
}

export interface News {
  id: string
  text: string
  tone: 'ok' | 'good' | 'bad'
  age: number
}

export type MarketMissionId =
  | 'secure_the_line'
  | 'earnings_beat'
  | 'calm_the_board'
  | 'restore_trust'
  | 'heavy_ready'
  | 'scrub_the_hall'

export interface MarketMission {
  id: MarketMissionId
  title: string
  blurb: string
  /** Sim-seconds left. */
  deadline: number
  /** What completes it. */
  goal: 'security3' | 'revenueBurst' | 'rep60' | 'noIncident' | 'heavyRunway' | 'lowWear'
  progress: number
  target: number
  rewardCash: number
  rewardRep: number
}

export interface TerminalFit {
  origin: Vec
  rooms: Record<RoomId, number>
  premade: boolean
  /** 0–100 wear from budget traffic. High wear softens security and WC. */
  wearBath: number
  wearSec: number
  /**
   * Soft hall population ceiling (premade shells are lower).
   * Over → slower claim / security feel + Standing pressure.
   */
  capGuests?: number
  /** Claim clear rate multiplier baseline (premade ~0.75, custom can go higher). */
  claimRate?: number
  /** Prefab tier. 1 is the morning kit. Custom halls ignore this once redesigned. */
  tier?: 1 | 2 | 3
  /** Painted floor. Null cells are bare shell. */
  zones?: (string | null)[][]
  /**
   * Zone cells added outside the original hall when the apron shell grows.
   * Missing on older saves: the floor is still the 48×32 m box.
   */
  floorExtra?: {
    left: number
    right: number
    top: number
    bottom: number
    baseCols: number
    baseRows: number
  }
  items?: {
    id: string
    def: string
    c: number
    r: number
    wear: number
    bundle?: boolean
    rot?: number
    revenue?: number
    fill?: number
    /** Hall-metre centre of a true-footprint placement. */
    hx?: number
    hz?: number
    fw?: number
    fd?: number
  }[]
  /** Rubbish on the floor, one decal per piece. */
  litter?: { id: string; c: number; r: number; ox: number; oz: number }[]
  /** 0–100. Rises with restroom visits; janitors service it down. */
  restroomDirt?: number
  /** Wayfinding signs. Each one extends the pathfinding junction cap. */
  signs?: number
  bagAllowance?: number
  /** Security passengers per sim-minute. */
  secPerMin?: number
  /** Zone paint or a custom stamp. Ceilings come from placed items. */
  redesigned?: boolean
  /**
   * Version-2 terminal document (1 m tiles, fittings, belts).
   * When set, the walk and the hall picture read this instead of the prefab zones.
   */
  layout?: BuildLayout
  /** Built from scratch with walls, floors, and zones (src/terminalbuild). Prefab halls leave this unset. */
  build?: BuildLayout
  /**
   * Walls, doors, paint, and rooms the player added in Terminal view.
   * Merged onto the walk layout. Missing on older saves.
   */
  interior?: InteriorEdit
}

export interface GameSnapshot {
  tiles: Tile[][]
  terminalFits: TerminalFit[]
  /**
   * Set by the schema 5 → 6 migration. The loader adds `amount` to cash,
   * announces `note` once, and does not copy the field onto the game.
   */
  terminalRebuild?: { label: 'Terminal rebuild refund'; amount: number; note: string }
  cash: number
  /** Serialized airport name and logo. Missing on older saves. */
  branding?: string
  difficulty: Difficulty
  site: SiteKind | null
  clock: number
  speed: Speed
  fuelBrand: FuelBrand | null
  fuelLoads: number
  /** Burger servings left on the hall shelf. */
  foodShelf?: number
  /** Souvenirs left on the hall shelf. */
  shopShelf?: number
  /** Ticket value of sales missed because a shelf was empty. */
  lostSpend?: number
  /** Checked bags that left the system. Prefab halls stay at zero. */
  bagsLost?: number
  /** Late bags and missed connections. */
  bagsMishandled?: number
  caterBrand: CaterBrand | null
  mealSold: boolean
  signed: AirlineId[]
  flightsDone: number
  paxServed: number
  revenue: number
  securityIncidents: number
  reputation: number
  loanBalance: number
  /** Active loan product id (multi-loan catalog). */
  loanProductId?: string | null
  /** Principal wired at open — for interest floor math. */
  loanPrincipal?: number
  /** Principal + fee at open — hard cap base for capitalization. */
  loanOpened?: number
  /** Airport XP toward field level (airline tier unlocks). */
  fieldXp?: number
  /** Specialization paths chosen at FL6 / FL8 / FL10. Order is purchase order. */
  specPaths?: string[]
  /** Bought specialization-tree node ids. Missing on older saves. */
  specNodes?: string[]
  /** Progression stamps that are not apron tiles (halls, hydrant, landmarks). */
  progressionBuilt?: string[]
  /** Control-tower cell keys fitted with the late-game Tower III add-on. */
  towerIII?: string[]
  parcels: number
  /** Expansion plots bought after the starter site. Missing on older saves. */
  ownedPlots?: { id: string; assessed: number }[]
  /** Staff housing on expansion plots. Missing on older saves. */
  staffHousing?: StaffHousingSave
  /** Outsourced pavement crew. Missing on older saves. */
  maintenanceContract?: boolean
  railLinked: boolean
  public: boolean
  sharePrice: number
  sharesOwned: number
  sharesFloat: number
  budgets?: Budgets
  mechanics?: number
  mxSigned?: AirlineId[]
  runwayCondition?: number
  weather?: Weather
  milAgreement?: boolean
  extraAirlines?: Airline[]
  airlineHeat?: Record<string, number>
  airlineBanUntil?: Record<string, number>
  layover?: LayoverContract | null
  schedule?: ScheduleSlot[]
  scheduleAuto?: boolean
  airlineReward?: Record<string, AirlineRewardId>
  airlineWarned?: Record<string, boolean>
  researchPoints?: number
  researchUnlocked?: ResearchId[]
  /** True once desk and Wave 3 progress have been folded into the Growth tree. */
  researchUnified?: boolean
  /** Wave 3 relationship scores. Research points on this block are legacy. */
  wave3?: Wave3State
  /** Growth-tree research points and owned nodes. The only research wallet. */
  researchTree?: ResearchState
  /** Wear on the people mover and the airside transfer bus. */
  linkWear?: { mover: number; bus: number }
  /** True when that link is stopped after a breakdown. */
  linkDown?: { mover: boolean; bus: boolean }
  /** Gates named by the last people-mover breakdown. */
  strandedGates?: string[]
  /** Plain-language reason the link is stopped. */
  linkExplanation?: string
  /** Hub-priced link stamps, keyed by cell. Pier links are not in this map. */
  hubLinksBuilt?: Record<string, 'people_mover' | 'xferbus' | 'skywalk'>
  /** Size-pillar purchases: fuel contract, tank, fleet, bags, and passenger kit. */
  pillar?: {
    contractId: string | null
    tankTier: 1 | 2 | 3
    litres: number
    supply: 'road' | 'rail' | 'pipeline' | 'barge'
    /** Game minutes left on a pipeline quality hold. Missing on older saves. */
    pipelineHoldMinutes?: number
    /** Game minutes of open flow before the next hold. Missing on older saves. */
    pipelineCoolMinutes?: number
    /** Game minutes already waited on a barge parcel. Missing on older saves. */
    bargeMinutes?: number
    roadMinutes: number
    spotOffer?: SpotOffer | null
    spotInbound?: SpotInbound | null
    termUpliftLitres?: number
    spotCool?: number
    /** Fuel-supplier standing. Missing on older saves. */
    supplierStanding?: Record<string, number>
    /** Spot index fraction. Missing on older saves. */
    fuelIndex?: number
    fleet: Record<string, number>
    bagSystem: 'carts' | 'sorter' | 'bhs'
    desks: number
    kiosks: number
    bagDrops: number
    scannerLanes: number
    eGates: number
  }
  /** Connecting passengers who missed the onward flight. */
  missedConnections?: number
  hubAirlines?: AirlineId[]
  /** Accepted hub tier per carrier. Missing on older saves. */
  hubTiers?: Record<string, string>
  /** Dedicated lounge, gate, hangar, fuel, pad, and ramp counts. Missing on older saves. */
  hubDedicated?: Record<
    string,
    {
      overnight?: number
      lounges?: number
      hangars?: number
      fuel?: number
      pier?: number
      ramp?: number
      pads?: number
    }
  >
  /** Hub-tier letters already sent. Missing on older saves. */
  hubOffered?: Record<string, string[]>
  /** Game day the stored tier started. */
  hubTierSince?: Record<string, number>
  /** Dedicated turnaround vehicles. */
  hubVehicleLeases?: { id: string; role: string; type: string; airlineId: string; primary: string; secondary: string }[]
  /** Game day a rival will consider a new contract again. */
  hubRivalRefuse?: Record<string, number>
  /** Game day a rival may be seeded again. */
  hubRivalQuiet?: Record<string, number>
  /** Phone notes for a move to Bellwater. */
  hubRivalPhone?: { id: string; name: string; text: string }[]
  hubNudges?: { airlineId: string; step: string; text: string }[]
  hubNudgeSilenced?: { airlineId: string; step: string }[]
  hubNudgeLast?: Record<string, number>
  hubFerryDay?: Record<string, number>
  /** Lounge, gate, and hangar leases by building id. Missing on older saves. */
  hubLeases?: { id: string; kind: string; airlineId: string }[]
  /** Day a stored tier falls if a gating lease stays released. */
  hubLeaseWarnings?: Record<string, { tier: string; untilDay: number }>
  layoverWins?: Record<string, number>
  hotelLevel?: number
  carParkShort?: boolean
  carParkLong?: boolean
  /** Park tile key "c,r" → short/long term. */
  parkTerms?: Record<string, ParkTerm>
  /** Hotel tile key "c,r" → inn / business / resort. */
  hotelClass?: Record<string, HotelClass>
  /** Stand tile key "c,r" → S/M/L class. */
  standClass?: Record<string, StandClass>
  /** Stand tile key "c,r" → remote hardstand vs jetway gate. */
  standAccess?: Record<string, StandAccess>
  /** Stand tile key "c,r" that has a hydrant pit. Missing on older saves. */
  standPits?: Record<string, true>
  /** Stand key → small / wide / jumbo. Missing L stands stay jumbo for older saves. */
  standScale?: Record<string, 'small' | 'wide' | 'jumbo'>
  /** Stand key → light / narrow / heavy. Missing on older saves; load fills it from class. */
  standSize?: Record<string, 'light' | 'narrow' | 'heavy'>
  /** Stand key → surface rung 0..2. Missing on older saves. */
  standRung?: Record<string, 0 | 1 | 2>
  /** Host key "stand:c,r" → fittings. A pit is not a fitting. Attachments toggle it with Game.setHydrantPit; fuel still reads standPits. */
  fittings?: Record<string, { id: string; granted?: 'legacy' }[]>
  /** Hangar key → bay size. Missing hangars stay small. */
  hangarScale?: Record<string, 'small' | 'wide' | 'jumbo'>
  janitors?: number
  researchers?: number
  deskStaff?: number
  /** First-hour coach dismissed (or auto-cleared after first takeoff). */
  coachDismissed?: boolean
  /** Hint switches (All hints enabled + muted kinds). Missing on older saves. */
  hintPrefs?: { allEnabled: boolean; muted: string[] }
  /** Sun cycle recorded at save time. Load ignores it and keeps the settings switch. */
  dayNightCycle?: boolean
  /** Tip chips (stuck-state notes, once each). Missing on older saves — chips start on. */
  tipChips?: { enabled: boolean; spent: string[]; open: string[] }
  /** First-session "open the build tray" step. Missing on older saves. */
  buildTrayOpened?: boolean
  fieldTask?: FieldTask | null
  /** Letter keys the player dismissed. Missing on older saves. */
  ackedLetters?: string[]
  /** Opening kit budget released so the player can build the field by hand. */
  starterFreehand?: boolean
  /** Set once the starter kit is paid for, so the button stays hidden after a reload. */
  starterKitStamped?: boolean
  /** Freight staged at the cargo shed (city truck intake). */
  cargoWarehouse?: number
  /** Live volume letter — must survive a refresh or the contract vanishes. */
  cargoVolume?: CargoVolumeJob | null
  startFocus?: StartFocus
  /** Climate picked on the new-game cards. Missing saves stay on the temperate belt. */
  mapId?: 'temperate' | 'tropical' | 'desert'
  /** Progress toward the three goals for `mapId`. */
  mapChallenges?: Record<string, number>
  sandbox?: boolean
  /** In-progress construction. Grass stays until the timer finishes. */
  sites?: BuildSite[]
  /** Tier III hangar and night-hub save. Missing on older saves. */
  tier3?: Tier3Save
  /** Bought power capacity. Missing saves stay on the Tier I city feed. */
  powerPlantTier?: 1 | 2 | 3
  /** Diplomacy V2 save (adapter state plus airline satisfaction). */
  diplomacy?: string
  diplomacySeed?: number
  /** Published fee index. Missing saves stay on the baseline schedule. */
  publishedFeeIndex?: number
  /** Negotiation desk (offers, rival, ULCC research). */
  negotiation?: string
  /** Bellwater price war (PLAYTEST B5). */
  priceWar?: string
  /** Inbound offers, visits, and Guard contracts. */
  inbound?: InboundState
  /** Player fee card. Missing on older saves — the live defaults apply. */
  fees?: Record<string, number>
  depositTier?: 'big' | 'standard' | 'small' | 'none'
  deposits?: Record<
    string,
    {
      contractId: string
      tier: 'big' | 'standard' | 'small' | 'none'
      held: number
      status: 'held' | 'refunded' | 'forfeited' | 'none'
      termEndDay: number
    }
  >
  commercialLead?: Record<string, { signDay: number; leadDays: number; opened: boolean }>
  feeStandingApplied?: number
  /** Premium check-in, fast-track lanes, and the VIP room. */
  premium?: PremiumState
  /** Check-in desks locked to one airline. Missing on older saves. */
  dedicatedDesks?: { deskId: string; airlineId: AirlineId; mode?: 'preferred' | 'dedicated' }[]
  /** Security lanes named to one airline. Missing on older saves. */
  dedicatedLanes?: { laneId: string; airlineId: string }[]
  /** Allocator desk and lane leases. Missing on older saves; desks and lanes above are the dedicated rows. */
  deskLeases?: { pointId: string; kind: string; airlineId: string; mode: string }[]
  /** Shop leases, ad campaigns, and awards. Missing on older saves. */
  tycoon?: TycoonState
  /** Late-game regional requests, standing, and recorded council votes. */
  council?: CouncilState
  /** Bellwater Intl rival sim. */
  rival?: string
  /** Late-game disruption engine. Missing on older saves. The alert stack shows the card. */
  disruptions?: string
  /** Year-end disruption, hub, and award counters. Missing on older saves. */
  playtestYear?: PlaytestYearSave
  /** Placed late buildings (hotel, rail link, SAF, landmarks, cargo, spotters). Missing on older saves. */
  economy?: EconomyState
  tier3Sites?: { id: Tier3PlusId; c: number; r: number; elapsedDays: number }[]
  /** Missed-connection guests waiting on the airport hotel. */
  missedHotelNights?: number
  /** Crew waiting on the airport hotel. */
  crewHotelNights?: number
  /** Achievement tracking state. */
  achievements?: any
  /** Opt-in scenario. Missing on older saves, and on a game that never started one. */
  scenario?: {
    id: string
    startedDay: number
    status: 'running' | 'met' | 'missed'
    progress: number
    profitDays: number
  }
  /** Carbon day book, offsets, and Green Pioneer run. Missing on older saves. */
  carbon?: CarbonSave
}

/** A placed building that is still a construction site. */
export interface BuildSite {
  id: string
  kind: 'single' | 'runway' | 'terminal' | 'premade' | 'expand'
  cells: Vec[]
  tile: Tile
  cost: number
  name: string
  elapsed: number
  duration: number
  warned: boolean
  vanArrived: boolean
  delivered: boolean
  crewSpawned: boolean
  news?: string
  tool?: string
  standClass?: StandClass
  standAccess?: StandAccess
  standScale?: 'small' | 'wide' | 'jumbo'
  standSize?: 'light' | 'narrow' | 'heavy'
  standRung?: 0 | 1 | 2
  standLetter?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  hangarScale?: 'small' | 'wide' | 'jumbo'
  hotelClass?: HotelClass
  parkTerm?: ParkTerm
  runwayClass?: RunwayClass
  origin?: Vec
}
