export const SIZE = 32
export const SAVE_KEY = 'apron-save-v21'

export type Tile =
  | 'grass'
  | 'runway'
  | 'taxi'
  | 'stand'
  | 'terminal'
  | 'snack'
  | 'bags'
  | 'fuel'
  | 'fire'
  | 'police'
  | 'cargo'
  | 'road'
  | 'tower'
  | 'hangar'
  | 'helipad'
  | 'hotel'
  | 'park_s'
  | 'park_l'
  | 'park_g'
  | 'park_u'

export type RunwayClass = 'short' | 'regional' | 'heavy'
/** Car park term — set when stamping a park tile. */
export type ParkTerm = 'short' | 'long'

export type Tool =
  | 'pan'
  | 'runway_short'
  | 'runway'
  | 'runway_heavy'
  | 'helipad'
  | 'taxi'
  | 'stand'
  | 'terminal'
  | 'premade'
  | 'snack'
  | 'bags'
  | 'fuel'
  | 'fire'
  | 'police'
  | 'cargo'
  | 'road'
  | 'tower'
  | 'hangar'
  | 'hotel'
  | 'park_s'
  | 'park_l'
  | 'park_g'
  | 'park_u'
  | 'clear'

export type Speed = 0 | 1 | 3
export type Difficulty = 'easy' | 'standard'
export type SiteKind = 'city' | 'factory'
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
  | 'board'
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
  | 'heavy_pack'

export interface LayoverOffer {
  airline: AirlineId
  age: number
  /** Flat fee paid up front when signed. */
  fee: number
  /** Sim-seconds the bank of transfer pax stays. */
  duration: number
  /** How many transfer guests to drip into the hall. */
  transferPax: number
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

/** Hub-tier deal — denser slots + brand lounge, harsher failure. */
export interface HubOffer {
  airline: AirlineId
  age: number
  fee: number
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
}

export interface ContractOffer {
  airline: AirlineId
  age: number
}

/** Airline line-maintenance contract offer (hangar work for their jets). */
export interface MxOffer {
  airline: AirlineId
  age: number
  /** Per-turnaround payout when you service their craft. */
  payout: number
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
    fuel: boolean
    catering: boolean
    bagDrop: boolean
  }
  waitingOn: {
    bags: boolean
    fuel: boolean
    catering: boolean
    paxOut: number
    paxIn: number
  }
  phaseTime: number
  ledger: { label: string; amount: number }[]
  /** Linked timetable slot when spawned from the schedule. */
  scheduleId?: string | null
  boardingSlow?: boolean
  /** GA parking — must depart by this clock or fine. */
  parkLeaveBy?: number | null
  /** Independent general aviation (not a signed airline). */
  ga?: boolean
}

/** Live security event the player must answer. */
export interface PendingThreat {
  id: string
  severity: 'soft' | 'hard'
  blurb: string
  age: number
  /** Seconds left before it auto-resolves as ignored. */
  deadline: number
}

/** Weather / ARFF ask — accept for fee, refuse for heat. */
export type EmergencyKind = 'divert' | 'tanker'

export interface PendingEmergency {
  id: string
  kind: EmergencyKind
  blurb: string
  fee: number
  age: number
  deadline: number
  /** Airline flavor for divert (null = tanker / mutual aid). */
  airline: AirlineId | null
}

export interface Truck {
  id: string
  kind: 'fuel' | 'bags' | 'catering' | 'fire' | 'police'
  flightId: string | null
  x: number
  y: number
  path: Vec[]
  seg: number
  t: number
  returning: boolean
  dwell: number
  patrol: boolean
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
}

export interface GameSnapshot {
  tiles: Tile[][]
  terminalFits: TerminalFit[]
  cash: number
  difficulty: Difficulty
  site: SiteKind | null
  clock: number
  speed: Speed
  fuelBrand: FuelBrand | null
  fuelLoads: number
  caterBrand: CaterBrand | null
  mealSold: boolean
  signed: AirlineId[]
  flightsDone: number
  paxServed: number
  revenue: number
  securityIncidents: number
  reputation: number
  loanBalance: number
  parcels: number
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
  hubAirlines?: AirlineId[]
  layoverWins?: Record<string, number>
  hotelLevel?: number
  carParkShort?: boolean
  carParkLong?: boolean
  /** Park tile key "c,r" → short/long term. */
  parkTerms?: Record<string, ParkTerm>
  janitors?: number
  researchers?: number
  deskStaff?: number
}
