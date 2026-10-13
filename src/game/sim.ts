import {
  AIRLINES,
  airlineList,
  BAG_DROP_PAY,
  BELT_COST,
  BUDGET_BASE,
  BULLDOZE_REFUND,
  BUILDINGS,
  CATER,
  CLEANING_FEE,
  CARGO_INTAKE_FEE,
  CARGO_WAREHOUSE_CAP,
  CARGO_VOLUME_COOL,
  CARGO_VOLUME_FAIL_FINE,
  CARGO_VOLUME_FEE_MAX,
  CARGO_VOLUME_FEE_MIN,
  createProcAirline,
  DEFAULT_BUDGETS,
  DEICE_FEE,
  DEICE_PAD_COST,
  FUEL,
  AIR_AMBULANCE_FEE,
  HALL_SCRUB_COST,
  ABANDON_ACC_SECONDS,
  ABANDON_FINE,
  HEAT_ABANDON_THRESHOLD,
  HEAT_BAN_THRESHOLD,
  HEAT_REWARD_THRESHOLD,
  HEAT_WARN_THRESHOLD,
  HELO_LANDING,
  DIVERT_FEE_MAX,
  DIVERT_FEE_MIN,
  EMERGENCY_REFUSE_FINE,
  FIELD_TASK_COOL,
  FIELD_TASK_DEADLINE,
  FIELD_TASK_DEFS,
  FIELD_TASK_FAIL_FINE,
  FIELD_TASK_HEAT_FAIL,
  FIELD_TASK_HEAT_OK,
  GA_LEAVE_WINDOW,
  GA_OVERSTAY_FINE,
  GA_PARK_DAY_RATE,
  GA_PARK_FEE_MAX,
  GA_PARK_FEE_MIN,
  GA_PARK_RATE_COOL,
  GA_PARK_STAY_MAX,
  GA_PARK_STAY_MIN,
  HUB_BAN_THRESHOLD,
  HUB_FEE_MAX,
  HUB_FEE_MIN,
  HUB_HEAT_NEED,
  HUB_LAYOVER_WINS,
  RESEARCH_NODES,
  rewardForPersona,
  REWARD_DETAIL,
  REWARD_LABEL,
  RP_PER_50_PAX,
  RP_PER_FLIGHT,
  TANKER_FEE,
  TANKER_MX_FEE,
  EMERGENCY_FAIL_FINE,
  LAND,
  LAYOVER_BAN_FINE,
  LAYOVER_BAN_SECONDS,
  LAYOVER_FEE_MAX,
  LAYOVER_FEE_MIN,
  LOADS_PER_BUY,
  MIL_AGREE_COST,
  MIL_LANDING,
  THREAT_SCRAMBLE_COST,
  IPO_FOUNDER_SHARES,
  IPO_LISTING_FEE,
  IPO_MIN_CASH,
  IPO_MIN_FLIGHTS,
  IPO_MIN_REP,
  IPO_SHARES,
  LOAN_FEE,
  LOAN_PRINCIPAL,
  LOAN_PRODUCTS,
  FIELD_LEVEL_XP,
  fieldLevelFromXp,
  normalizeAirline,
  AIRLINE_TIER_META,
  MECHANIC_HIRE,
  MIN_RUNWAY,
  PARCEL_COST,
  JETWAY_RANGE,
  MIL_RAMP_RANGE,
  PREMADE_TERMINAL_COST,
  RAIL_CITY_COST,
  HOTEL_COST,
  HOTEL_COST_L2,
  HOTEL_META_EXPENSE,
  HOTEL_CLASS_EXPENSE,
  HOTEL_CLASS_FEE,
  BUS_CURB_COST,
  BUS_EXPENSE,
  BUS_FARE,
  CARPARK_SHORT_COST,
  CARPARK_LONG_COST,
  CARPARK_META_EXPENSE_SHORT,
  CARPARK_META_EXPENSE_LONG,
  HALL_AMENITY_EXPENSE,
  HOTEL_NIGHT_FEE,
  PARK_EXPENSE,
  PARK_USE_FEE,
  PARK_LONG_FEE,
  PARK_SHORT_FEE,
  RAIL_EXPENSE,
  RAIL_FARE,
  RAIL_STATION_COST,
  JANITOR_HIRE,
  RESEARCHER_HIRE,
  DESK_STAFF_HIRE,
  RP_RATE_BARE,
  RP_RATE_BOARD,
  RP_RATE_DESK,
  RP_RATE_MACHINE,
  ROOMS,
  HEAVY_RUNWAY_COST,
  HEAVY_RUNWAY_LEN,
  HEAVY_RUNWAY_WID,
  SHORT_RUNWAY_COST,
  SHORT_RUNWAY_LEN,
  SHORT_RUNWAY_WID,
  RUNWAY_PREFAB_COST,
  RUNWAY_PREFAB_LEN,
  RUNWAY_PREFAB_WID,
  STAND_JETWAY_MULT,
  standClassRank,
  STARTER_KIT_COST,
  START_CASH,
  TERMBUS_COST,
  TERMINAL_COST,
} from './catalog'
import { getAircraftSpec } from '../render/aircraft/specs'
import { standAccepts, standLetter, wingDiscsClash } from '../render/aircraft/stands'
import { legRoute, pointAlong, polylineLength } from './hallRoute.ts'
import { planTerminal, terminalPlanSeed } from '../render/world/plan.ts'
import { terminals } from '../render/world/layout.ts'
import type { RoomPlan } from '../render/world/rooms.ts'
import {
  hallPath,
  isAirside,
  openForGuest,
  reachableNeed,
  openNodesFromRooms,
  bagUnitsForTag,
  estimateFlightBagUnits,
  rollPaxTag,
  spawnHallGuest,
  strongestNeed,
  tagPrice,
  tagSpendsUp,
  type ArriveMode,
  type HallGuest,
  type HallNode,
  type HallStaff,
  type PaxTag,
  type SpendKind,
  type StaffPost,
} from './guests'
import { adviseHall, type Advice } from './advisor.ts'
import { buildSeconds } from './construction.ts'
import { buildLogisticsConfig, delayFix, FUEL_OUTAGE_SLOT_SEC, groundCauseLine } from './logisticsBridge.ts'
import { CateringBridge, cateringCue } from './cateringBridge.ts'
import { CargoBridge } from './cargoBridge.ts'
import { getAudio, soundForEvent } from '../audio/index.ts'
import {
  createDiplomacyBridge,
  GAME_MINUTES_PER_SIM_SECOND,
  type DiplomacyBridge,
} from './diplomacyBridge.ts'
import { createLogisticsAdapter, needsFor } from '../logistics/index.ts'
import type { LogisticsAdapter, LogisticsSim, TurnaroundResult } from '../logistics/index.ts'
import { bagWorkDuration, describeBagStage } from './bags'
import {
  advanceBagTags,
  advanceScreen,
  checkedPieceCount,
  freshBook,
  keepPrefabBags,
  makeBagTag,
  markClaimLate,
  ownerClaimReady,
  type BagBook,
  type BagTag,
  type LuggageMotion,
} from './luggage'
import {
  blankZones,
  ceilingsFor,
  itemDef,
  DEPARTURE_SPREAD_SEC,
  laneStats,
  lookaheadDepth,
  needsMaintenance,
  overCapMultiplier,
  UNSTAFFED_LANE,
  prefabZones,
  schemeItems,
  schemeLabel,
  schemeSigns,
  schemeZones,
  slowedService,
  type ItemId,
  type PlacedItem,
  type ZoneId,
} from './terminal.ts'
import {
  NODE_ZONE,
  nodeComfort,
  outletExtraStock,
  pickOutlet,
  placementCheck,
  refundFor,
  seatsByZone,
  type PlacementCheck,
} from './terminalKit.ts'
import { KIT_TUNING, SEAT_NODES } from './terminalKitData.ts'
import { AmbienceMixer } from '../audio/ambience.ts'
import { PRESETS } from '../branding/presets.ts'
import type { BrandingSave } from '../branding/types.ts'
import { deserializeBranding, serializeBranding, suggestCode } from '../branding/validate.ts'
import { Bank, moneyDirection, payrollForGameDay, type MoneyCategory } from '../core/bank.ts'
import { SIM_MINUTES_PER_GAME_DAY, SIM_MINUTES_PER_REAL_SECOND, SimClock } from '../core/clock.ts'
import {
  createEconomyAdapter,
  type EconomyAdapter,
} from '../economy/adapter.ts'
import type { EconomySnapshot, EconomyState } from '../economy/types.ts'
import { audit, FlowGraph, registerTerminal, type TerminalZone } from '../flow/index.ts'
import {
  budgetLineCost,
  cityLevy,
  fieldOpsMultiplier,
  loanInterestDue,
  loansAvailable,
  nextLoanBalance,
  payrollAmount,
} from './economy'
import {
  AIRFRAMES,
  craftRoleLabel,
  jetAirframesBlocked,
  jetAirframesFitting,
  bagUnitsForAirframe,
  fuelDwellSeconds,
  paxForAirframe,
  pickAirframe,
  pickAirframeWithFallback,
  standClassFor,
  stripTier,
  turnaroundScale,
} from './airframes'
import { hasLeftMap, inboundApproach } from './flightpath'
import {
  advancePaxItinerary,
  spawnArrivalPax,
  spawnDeparturePax,
} from './pax'
import {
  astar,
  farmBesidePavement,
  hasBeltNetwork,
  inBounds,
  nearestPath,
  runwayStrips,
  standBeltLinked,
  tilesOf,
  walkableFor,
} from './path'
import { SANDBOX_CASH, SAVE_KEY, SIZE, type AirlineId, type AirlineTier } from './types'
import type {
  AircraftKind,
  Airline,
  AirlineRewardId,
  BagFlowStage,
  BudgetKey,
  Budgets,
  CargoVolumeJob,
  CaterBrand,
  ContractOffer,
  Difficulty,
  EmergencyKind,
  FieldTask,
  BuildSite,
  FieldTaskKind,
  Flight,
  FuelBrand,
  GameSnapshot,
  HotelClass,
  HubOffer,
  LayoverContract,
  LayoverOffer,
  MarketMission,
  ParkingOffer,
  ParkTerm,
  MxOffer,
  News,
  PendingEmergency,
  PendingThreat,
  Person,
  Phase,
  ResearchId,
  RoomId,
  RunwayClass,
  ScheduleSlot,
  ScheduleStatus,
  SiteKind,
  Speed,
  StartFocus,
  StandAccess,
  StandClass,
  StandPaxMode,
  TerminalFit,
  Tile,
  Tool,
  Truck,
  TruckMission,
  Vec,
  Weather,
} from './types'

function emptyTiles(): Tile[][] {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => 'grass' as Tile),
  )
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Per-tick seat pool and comfort cache for one hall. */
interface HallKitState {
  items: PlacedItem[]
  zones: (string | null)[][]
  seatsLeft: Map<ZoneId, number>
  comfort: Map<HallNode, number>
}

const emptyRooms = (): Record<RoomId, number> => ({
  checkin: 0,
  security: 0,
  gate: 0,
  bagclaim: 0,
  food: 0,
  souvenir: 0,
  bagdrop: 0,
  lounge: 0,
  bathroom: 0,
  golf: 0,
  waterfall: 0,
  gaming: 0,
  dayhotel: 0,
  spa: 0,
  pool: 0,
  rdesk: 0,
  rboard: 0,
  rmachine: 0,
})

function emptyFit(origin: Vec, premade: boolean, rooms?: Partial<Record<RoomId, number>>): TerminalFit {
  const r = { ...emptyRooms(), ...(rooms ?? {}) }
  const claimRooms = Math.max(1, r.bagclaim || (premade ? 1 : 0))
  return decorateFit({
    origin,
    premade,
    rooms: r,
    wearBath: 0,
    wearSec: 0,
    claimRate: premade ? 0.72 + claimRooms * 0.08 : 0.9 + claimRooms * 0.12,
  })
}

/** Prefab bundle, painted floors, and the ceilings those imply. */
function decorateFit(fit: TerminalFit): TerminalFit {
  if (fit.premade) {
    if (fit.tier == null) fit.tier = 1
    const tier = (fit.tier ?? 1) as 1 | 2 | 3
    if (fit.signs == null) fit.signs = schemeSigns(tier)
    if (!fit.zones?.length) fit.zones = schemeZones(tier)
    if (!fit.items?.length) fit.items = schemeItems(tier)
    if (fit.redesigned == null) fit.redesigned = false
  } else {
    if (fit.tier == null) fit.tier = 1
    if (fit.signs == null) fit.signs = 0
    if (!fit.zones?.length) fit.zones = blankZones()
    if (!fit.items) fit.items = []
    if (fit.redesigned == null) fit.redesigned = false
  }
  return applyCeilings(fit)
}

function applyCeilings(fit: TerminalFit): TerminalFit {
  const c = ceilingsFor({
    premade: fit.premade,
    redesigned: fit.redesigned,
    tier: fit.tier,
    items: (fit.items ?? []) as PlacedItem[],
    roomsSecurity: fit.rooms.security,
  })
  fit.capGuests = c.paxCap
  fit.bagAllowance = c.bagAllowance
  fit.secPerMin = c.secPerMin
  return fit
}

function emptyPosted(): Flight['posted'] {
  return {
    landing: false,
    bags: false,
    bagsLoad: false,
    fuel: false,
    catering: false,
    bagDrop: false,
    mx: false,
    deiced: false,
  }
}

function emptyWaiting(partial?: Partial<Flight['waitingOn']>): Flight['waitingOn'] {
  return {
    bags: false,
    bagsLoad: false,
    fuel: false,
    catering: false,
    mx: false,
    deice: false,
    paxOut: 0,
    paxIn: 0,
    ...partial,
  }
}

const ROUTE_CITIES = [
  'Boise',
  'Seattle',
  'Denver',
  'Phoenix',
  'Salt Lake',
  'Portland',
  'Las Vegas',
  'Chicago',
  'Dallas',
  'Oakland',
  'Spokane',
  'Reno',
]

export type ApronInspect =
  | {
      kind: 'flight'
      flightId: string
      callsign: string
      airline: string
      model: string
      destination: string
      activity: string
      next: string
      fuel: number
      catering: number
      gate: string
      mx?: string
    }
  | {
      kind: 'hangar'
      title: string
      occupant: string
      model: string
      remaining: number
      total: number
      blurb: string
    }

function defaultBranding(): BrandingSave {
  const preset = PRESETS[0]
  const code = suggestCode('Hatchfield')
  return {
    airportName: 'Hatchfield',
    code,
    logo: { ...preset.spec, airportName: 'Hatchfield', code },
    presetId: preset.id,
  }
}

const FINANCING_CATEGORIES = new Set([
  'loan_proceeds',
  'ipo_proceeds',
  'share_sales',
  'share_purchases',
  'refunds',
])

export class Game {
  tiles: Tile[][] = emptyTiles()
  fits: TerminalFit[] = []
  cash: number = START_CASH.easy
  difficulty: Difficulty = 'easy'
  site: SiteKind | null = null
  clock = 0
  speed: Speed = 1
  tool: Tool = 'pan'
  facing: 'h' | 'v' = 'h'
  runwayStart: Vec | null = null
  hover: Vec | null = null
  /** Apron hover target for inspect card (flight id or hangar key). */
  hoverInspect: ApronInspect | null = null
  /** Bumps when apron tiles / stamp metadata change — World skips mesh rebuilds otherwise. */
  mapRev = 0
  fuelBrand: FuelBrand | null = null
  fuelLoads = 0
  /** Burger servings on the counter. Sales stop at zero. */
  foodShelf = 0
  /** Souvenirs on the counter. Sales stop at zero. */
  shopShelf = 0
  /** Food sales through placed outlets (café, fast food, sit-down). */
  foodCourtRevenue = 0
  /** Unique suffix for placed hall item ids. */
  hallItemSeq = 0
  /** Unpaid counter sales, kept for the audit. */
  lostSpend = 0
  /** Checked bags that disappeared. Prefab halls keep this at zero. */
  bagsLost = 0
  /** Late bags and missed connections. Prefab halls stay at zero under normal load. */
  bagsMishandled = 0
  /** 0–1 parade clock for belts and carousels. */
  bagPhase = 0
  /** Screenshot latch so the hall can show the whole chain at once. */
  private bagShow: LuggageMotion | null = null
  private bagBooks = new Map<string, BagBook>()
  private bagTags: BagTag[] = []
  shelfCool = 0
  /** Open info-view submenu. Hotspots stay drawn either way. */
  infoOpen: string | null = null
  private fuelHoldNoted = new Set<string>()
  caterBrand: CaterBrand | null = null
  mealSold = false
  signed: AirlineId[] = []
  offer: ContractOffer | null = null
  offerCool = 12
  mxOffer: MxOffer | null = null
  mxOfferCool = 30
  mxSigned: AirlineId[] = []
  threatCool = 40
  pendingThreat: PendingThreat | null = null
  pendingEmergency: PendingEmergency | null = null
  emergencyCool = 70
  securityIncidents = 0
  reputation = 40
  loanBalance = 0
  loanProductId: string | null = null
  loanPrincipal = 0
  loanOpened = 0
  /** Airport XP — unlocks airline tiers (Field Lv 1–5). */
  fieldXp = 0
  parcels = 1
  railLinked = false
  hotelLevel = 0
  carParkShort = false
  carParkLong = false
  /** Stamped park tiles: "c,r" → short/long. */
  parkTerms: Record<string, ParkTerm> = {}
  /** Term used when stamping the next park tile. */
  parkTerm: ParkTerm = 'short'
  /** Stamped hotel tiles: "c,r" → inn / business / resort. */
  hotelClass: Record<string, HotelClass> = {}
  /** Stand tile "c,r" → S/M/L. Missing defaults to M. */
  standClass: Record<string, StandClass> = {}
  /** Stand key → remote bay vs jetway-attached gate. */
  standAccess: Record<string, StandAccess> = {}
  /** Build toggle — next stand stamp is jetway (expensive) or remote. */
  standAccessMode: StandAccess = 'remote'
  janitors = 0
  janitorCool = 0
  researchers = 0
  researcherCool = 0
  deskStaff = 0
  deskStaffCool = 0
  hallStaff: HallStaff[] = []
  /** Recent landside touchpoints (exits / day rooms / park cues) for usage meters. */
  landsideUses = 0
  /** Passenger landside fees collected since last payroll window (HUD). */
  landsideFeeWindow = 0
  /** Planner filter: null = all banks; 0..n-1 = that strip; -1 = tower-auto only. */
  plannerRwFilter: number | null = null
  /** Accumulated sim-seconds lost to apron congestion (news when > threshold). */
  congWasteAcc = 0
  congNewsCool = 0
  /** Peak live congestion count near moving traffic (HUD jam line). */
  congPeak = 0
  /** Freight units staged at the cargo shed (city truck intake). */
  cargoWarehouse = 0
  /** Cooldown between city cargo truck spawns. */
  cityCargoCool = 8
  /** New Game focus — biases starter kit + early letters. */
  startFocus: StartFocus = 'pax'
  /** Dev sandbox — unlimited money (default ON for trial builds). */
  sandbox = true
  /** Active cargo volume window letter. */
  cargoVolume: CargoVolumeJob | null = null
  cargoVolumeCool = 40
  interestCool = 60
  /** Throttle loan interest news so the ticker doesn't flood. */
  loanNewsCool = 0
  public = false
  sharePrice = 0
  sharesOwned = 0
  sharesFloat = 0
  ipoPrice = 0
  marketCool = 8
  analystCool = 55
  mission: MarketMission | null = null
  revenueWindow = 0
  budgets: Budgets = { ...DEFAULT_BUDGETS }
  mechanics = 0
  runwayCondition = 100
  weather: Weather = 'clear'
  weatherCool = 45
  payrollCool = 30
  /** Completed game days already billed. Payroll and the city levy close once per day. */
  payrollDay = 0
  /** Sim-clock of the last city levy. Kept so older saves do not bill a backlog. */
  levyMark = 0
  /** Categorized journal. Player cash stays on `cash`; the day close reads this book. */
  bank = new Bank(0)
  simClock = new SimClock()
  private economy: EconomyAdapter | null = null
  private economyState: EconomyState | null = null
  private economyView: EconomySnapshot | null = null
  branding: BrandingSave = defaultBranding()
  private ambience: AmbienceMixer | null = null
  crashCool = 8
  fireIncidentCool = 60
  milAgreement = false
  milCool = 55
  ambuCool = 70
  extraAirlines: Airline[] = []
  airlineHeat: Record<string, number> = {}
  airlineBanUntil: Record<string, number> = {}
  /** One-time persona perk unlocked at high heat. */
  airlineReward: Record<string, AirlineRewardId> = {}
  /** Warned once before abandon clock starts biting. */
  airlineWarned: Record<string, boolean> = {}
  /** Accrued sim-seconds under abandon heat threshold. */
  airlineLowAcc: Record<string, number> = {}
  researchPoints = 0
  researchUnlocked: ResearchId[] = []
  layoverOffer: LayoverOffer | null = null
  layoverOfferCool = 50
  layover: LayoverContract | null = null
  layoverSpawnAcc = 0
  /** Successful layover clears per airline — gates Hub tier. */
  layoverWins: Record<string, number> = {}
  hubOffer: HubOffer | null = null
  hubOfferCool = 80
  hubAirlines: AirlineId[] = []
  parkingOffer: ParkingOffer | null = null
  parkingCool = 65
  /** Day-rate cool for independent parked GA. */
  parkRateCool = 0
  schedule: ScheduleSlot[] = []
  scheduleAuto = true
  schedulePlanCool = 8
  /** Rate-limit hall miss headlines: key → clock ready. */
  hallMissCool: Record<string, number> = {}
  flights: Flight[] = []
  trucks: Truck[] = []
  people: Person[] = []
  hallGuests: HallGuest[] = []
  /** Room plans for the current map, shared with the terminal renderer (same seed). */
  private terminalPlans: {
    rev: number
    entries: { key: string; cells: { c: number; r: number }[]; plan: RoomPlan }[]
  } | null = null
  news: News[] = []
  selectedFlight: string | null = null
  selectedTile: Vec | null = null
  selectedGuest: string | null = null
  /** Bumps when the hall layout changes so the HUD repaints. */
  hallRev = 0
  private secSeq = 1
  view: 'apron' | 'hall' = 'apron'
  spawnCool = 8
  heloCool = 22
  flightSeq = 100
  flightsDone = 0
  paxServed = 0
  revenue = 0
  /** Positive payment lines kept after a turn leaves the field. */
  settledPayments: { flightNo: string; label: string; amount: number }[] = []
  /** Layout notes. Empty on a healthy prefab until the hall is over capacity. */
  advice: Advice[] = []
  advisorCells: { c: number; r: number }[] = []
  /** Apron tiles highlighted by a ground-services note (fuel farm, kitchen, depot). */
  apronFocus: { c: number; r: number }[] = []
  /** Ground-logistics ledger. Posted into cash as it happens. */
  groundBooks = {
    fuelSales: 0,
    cateringFees: 0,
    fuelPurchase: 0,
    mealProduction: 0,
    vehicleUpkeep: 0,
    shopSales: 0,
    shopLost: 0,
    cargoRevenue: 0,
    cargoPenalties: 0,
  }
  private ground: (LogisticsAdapter & { sim: LogisticsSim; completed: TurnaroundResult[] }) | null = null
  private groundRev = -1
  private groundAnnounced = false
  private groundNotes: Advice[] = []
  private groundNoteKey = ''
  private cargoNotes: Advice[] = []
  /** Recent sound names, for the apron audio cues. */
  soundCues: string[] = []
  private catering: CateringBridge | null = null
  private cargo: CargoBridge | null = null
  /** Airline letters, standing, and turnaround grades. Null until the clock runs. */
  private diplomacy: DiplomacyBridge | null = null
  diplomacySeed = 1
  /** Passenger-flow overlay. Hidden until the player opts in. */
  showFlows = false
  /** True once a wave exceeds this hall's queue or passenger cap. */
  hallOverloaded = false
  missedFlights = 0
  private queueDelayFlight = new Set<string>()
  sites: BuildSite[] = []
  /** Session tally of craft roles that landed — for the fleet strip. */
  craftSeen: Partial<Record<AircraftKind, number>> = {}
  listeners = new Set<() => void>()
  saveTimer = 0
  uiAcc = 0
  patrolCool = 0
  mechanicCool = 0
  /** First-session coach card dismissed (or auto-cleared after first takeoff). */
  coachDismissed = false
  private firstTakeoffNoted = false
  /** Active airline field ask (CEO-style task clock). */
  fieldTask: FieldTask | null = null
  fieldTaskCool = 28
  /** Night curfew news / slip rate-limit. */
  nightCurfewCool = 0
  /** Rate-limit cascade headlines so the ticker stays readable. */
  cascadeNewsCool = 0
  /** While storming, pulse a bank slip so weather stays legible. */
  stormPulseCool = 0
  /** One point per in-game hour (7.5s). Charts read this; not saved. */
  econHist: {
    t: number
    cash: number
    income: number
    expense: number
    pax: number
    cargo: number
  }[] = []
  econHour = 0
  hourIncome = 0
  hourExpense = 0
  dayPax = 0
  dayCargo = 0
  dayMark = 0
  /** Cash earned in the latest finished hour. */
  incomePerHour = 0
  /** Pax / cargo cleared on the last finished day (180s). */
  paxPerDay = 0
  cargoPerDay = 0

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit() {
    for (const fn of this.listeners) fn()
  }

  beginNew(difficulty: Difficulty) {
    this.difficulty = difficulty
    this.cash = this.sandbox ? SANDBOX_CASH : START_CASH[difficulty]
    this.site = null
    this.tiles = emptyTiles()
    this.fits = []
    this.clock = 0
    this.speed = 0
    this.tool = 'pan'
    this.facing = 'h'
    this.fuelBrand = null
    this.fuelLoads = 0
    this.foodShelf = 0
    this.shopShelf = 0
    this.foodCourtRevenue = 0
    this.lostSpend = 0
    this.bagsLost = 0
    this.bagsMishandled = 0
    this.bagPhase = 0
    this.bagShow = null
    this.bagBooks.clear()
    this.bagTags = []
    this.shelfCool = 0
    this.infoOpen = null
    this.fuelHoldNoted.clear()
    this.caterBrand = null
    this.mealSold = false
    this.signed = []
    this.offer = null
    this.offerCool = 8
    this.mxOffer = null
    this.mxOfferCool = 30
    this.mxSigned = []
    this.threatCool = 45
    this.pendingThreat = null
    this.pendingEmergency = null
    this.emergencyCool = 70
    this.congWasteAcc = 0
    this.congNewsCool = 0
    this.congPeak = 0
    this.cargoWarehouse = 0
    this.cityCargoCool = 8
    this.startFocus = 'pax'
    this.cargoVolume = null
    this.cargoVolumeCool = 40
    this.loanNewsCool = 0
    this.securityIncidents = 0
    this.reputation = 40
    this.loanBalance = 0
    this.loanProductId = null
    this.loanPrincipal = 0
    this.loanOpened = 0
    this.fieldXp = 0
    this.parcels = 1
    this.railLinked = false
    this.hotelLevel = 0
    this.carParkShort = false
    this.carParkLong = false
    this.parkTerms = {}
    this.parkTerm = 'short'
    this.hotelClass = {}
    this.standClass = {}
    this.standAccess = {}
    this.standAccessMode = 'remote'
    this.janitors = 0
    this.janitorCool = 0
    this.researchers = 0
    this.researcherCool = 0
    this.deskStaff = 0
    this.deskStaffCool = 0
    this.hallStaff = []
    this.landsideUses = 0
    this.landsideFeeWindow = 0
    this.interestCool = 60
    this.public = false
    this.sharePrice = 0
    this.sharesOwned = 0
    this.sharesFloat = 0
    this.ipoPrice = 0
    this.marketCool = 8
    this.analystCool = 55
    this.mission = null
    this.revenueWindow = 0
    this.budgets = { ...DEFAULT_BUDGETS }
    this.mechanics = 0
    this.runwayCondition = 100
    this.weather = 'clear'
    this.weatherCool = 45
    this.payrollCool = 30
    this.payrollDay = 0
    this.levyMark = 0
    this.bank = new Bank(0)
    this.simClock = new SimClock()
    this.economy = null
    this.economyState = null
    this.economyView = null
    this.branding = defaultBranding()
    this.ambience?.stopAll(0)
    this.ambience = null
    this.crashCool = 8
    this.fireIncidentCool = 60
    this.milAgreement = false
    this.milCool = 55
    this.ambuCool = 70
    this.extraAirlines = []
    this.airlineHeat = {}
    this.airlineBanUntil = {}
    this.airlineReward = {}
    this.airlineWarned = {}
    this.airlineLowAcc = {}
    this.researchPoints = 0
    this.researchUnlocked = []
    this.layoverOffer = null
    this.layoverOfferCool = 50
    this.layover = null
    this.layoverSpawnAcc = 0
    this.layoverWins = {}
    this.hubOffer = null
    this.hubOfferCool = 80
    this.hubAirlines = []
    this.parkingOffer = null
    this.parkingCool = 65
    this.parkRateCool = 0
    this.schedule = []
    this.scheduleAuto = true
    this.schedulePlanCool = 8
    this.hallMissCool = {}
    this.flights = []
    this.trucks = []
    this.people = []
    this.hallGuests = []
    this.news = []
    this.selectedFlight = null
    this.selectedTile = null
    this.selectedGuest = null
    this.view = 'apron'
    this.spawnCool = 10
    this.heloCool = 22
    this.flightSeq = 100
    this.flightsDone = 0
    this.paxServed = 0
    this.revenue = 0
    this.settledPayments = []
    this.advice = []
    this.advisorCells = []
    this.apronFocus = []
    this.groundBooks = {
      fuelSales: 0,
      cateringFees: 0,
      fuelPurchase: 0,
      mealProduction: 0,
      vehicleUpkeep: 0,
      shopSales: 0,
      shopLost: 0,
      cargoRevenue: 0,
      cargoPenalties: 0,
    }
    this.ground = null
    this.groundRev = -1
    this.groundAnnounced = false
    this.groundNotes = []
    this.groundNoteKey = ''
    this.cargoNotes = []
    this.soundCues = []
    this.catering = null
    this.cargo = null
    this.diplomacy = null
    this.diplomacySeed = 1
    this.hallOverloaded = false
    this.missedFlights = 0
    this.queueDelayFlight = new Set()
    this.sites = []
    this.craftSeen = {}
    this.mechanicCool = 0
    this.coachDismissed = false
    this.firstTakeoffNoted = false
    this.fieldTask = null
    this.fieldTaskCool = 28
    this.nightCurfewCool = 0
    this.cascadeNewsCool = 0
    this.stormPulseCool = 0
    this.econHist = []
    this.econHour = 0
    this.hourIncome = 0
    this.hourExpense = 0
    this.dayPax = 0
    this.dayCargo = 0
    this.dayMark = 0
    this.incomePerHour = 0
    this.paxPerDay = 0
    this.cargoPerDay = 0
    // Drop the previous field so a refresh on the route screen cannot resume it.
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* node / private mode */
    }
    try {
      sessionStorage.setItem(
        'hatchfield-pending',
        JSON.stringify({ sandbox: this.sandbox, difficulty: this.difficulty }),
      )
    } catch {
      /* node / private mode */
    }
  }

  /** Morning checklist — hides once dismissed or after the first takeoff. */
  coachSteps(): { id: string; label: string; done: boolean }[] {
    const hasStrip = runwayStrips(this.tiles, MIN_RUNWAY).length > 0
    const hasStand = tilesOf(this.tiles, 'stand').length > 0
    const fieldUp = hasStrip && hasStand
    const signed = this.signed.length > 0
    const inbound = this.flights.some(
      (f) =>
        (f.craft ?? 'jet') === 'jet' &&
        !['gone', 'takeoff'].includes(f.phase),
    )
    const turned = this.flightsDone >= 1
    const cargoFocus = this.startFocus === 'cargo'
    const hasGuard = tilesOf(this.tiles, 'guard').length > 0
    const hasShed = tilesOf(this.tiles, 'cargo').length > 0
    return [
      {
        id: 'field',
        label: fieldUp
          ? cargoFocus
            ? 'Cargo field stamped (strip + stand)'
            : 'Field stamped (strip + stand)'
          : cargoFocus
            ? 'Stamp Cargo starter kit (shed + guard + stand)'
            : 'Stamp Starter kit (or your own strip + stand)',
        done: fieldUp,
      },
      ...(cargoFocus
        ? [
            {
              id: 'pipeline',
              label:
                hasGuard && hasShed
                  ? 'Guard → shed pipeline live'
                  : 'Need guard post + cargo shed on the road',
              done: hasGuard && hasShed,
            },
          ]
        : []),
      {
        id: 'sign',
        label: signed
          ? `Signed ${this.signed.length} airline(s)`
          : cargoFocus
            ? 'Sign UPPS / cargo when they call'
            : 'Sign an airline when they call',
        done: signed,
      },
      {
        id: 'inbound',
        label: inbound || turned
          ? cargoFocus
            ? 'Freighter on the field'
            : 'Jet on the field'
          : cargoFocus
            ? 'Wait for the first freighter (try 3x)'
            : 'Wait for the first inbound (try 3x)',
        done: inbound || turned,
      },
      {
        id: 'turn',
        label: turned
          ? 'First takeoff in the book'
          : cargoFocus
            ? 'Uplift freight — warehouse → freighter → airborne'
            : 'Turn a flight — trucks + pax, then airborne',
        done: turned,
      },
    ]
  }

  showCoach(): boolean {
    if (this.coachDismissed || !this.site) return false
    if (this.flightsDone >= 1) return false
    return true
  }

  dismissCoach() {
    this.coachDismissed = true
    this.emit()
  }

  fieldTaskMet(kind: FieldTaskKind): boolean {
    const fit = this.activeHall()
    const rooms = fit?.rooms
    switch (kind) {
      case 'bathroom':
        return (rooms?.bathroom ?? 0) > 0
      case 'food':
        return (rooms?.food ?? 0) > 0 || tilesOf(this.tiles, 'snack').length > 0
      case 'fire':
        return tilesOf(this.tiles, 'fire').length > 0
      case 'desk':
        return this.deskStaff >= 1
      case 'police':
        return tilesOf(this.tiles, 'police').length > 0
      case 'hangar':
        return tilesOf(this.tiles, 'hangar').length > 0
      case 'janitor':
        return this.janitors >= 1
      case 'cargo':
        return tilesOf(this.tiles, 'cargo').length > 0
      case 'helipad':
        return tilesOf(this.tiles, 'helipad').length > 0
      case 'hotel':
        return this.hotelLevel > 0 || tilesOf(this.tiles, 'hotel').length > 0
      case 'park':
        return (
          this.carParkShort ||
          this.carParkLong ||
          tilesOf(this.tiles, 'park_s').length > 0 ||
          tilesOf(this.tiles, 'park_l').length > 0 ||
          tilesOf(this.tiles, 'park_g').length > 0 ||
          tilesOf(this.tiles, 'park_u').length > 0
        )
      case 'desk_extra':
        return this.deskStaff >= 2
      default:
        return false
    }
  }

  considerFieldTasks() {
    if (this.fieldTask || this.fieldTaskCool > 0) return
    if (this.signed.length < 1 || this.flightsDone < 1) return
    const pool = this.signed.filter((id) => !this.isBanned(id))
    if (!pool.length) return
    const airlineId = pick(pool)
    const a = this.airline(airlineId)
    const open = FIELD_TASK_DEFS.filter((d) => !this.fieldTaskMet(d.kind))
    if (!open.length) return
    const preferred = open.filter((d) => d.personas?.includes(a.persona))
    const pickDef = preferred.length && Math.random() < 0.7 ? pick(preferred) : pick(open)
    this.fieldTask = {
      id: uid('task'),
      airline: airlineId,
      kind: pickDef.kind,
      title: pickDef.title,
      blurb: pickDef.blurb,
      bonus: pickDef.bonus,
      deadline: this.clock + FIELD_TASK_DEADLINE,
      age: 0,
    }
    this.pushNews(
      `${a.name} field ask: ${pickDef.title} — ${Math.round(FIELD_TASK_DEADLINE)}s on the clock.`,
      'ok',
    )
    this.emit()
  }

  tickFieldTask(dt: number) {
    this.fieldTaskCool = Math.max(0, this.fieldTaskCool - dt)
    if (!this.fieldTask) {
      this.considerFieldTasks()
      return
    }
    const t = this.fieldTask
    t.age += dt
    if (this.fieldTaskMet(t.kind)) {
      const a = this.airline(t.airline)
      this.cash += t.bonus
      this.revenue += t.bonus
      this.noteIncome(t.bonus, 'task_rewards')
      this.adjustHeat(t.airline, FIELD_TASK_HEAT_OK)
      this.reputation = Math.min(100, this.reputation + 2)
      this.pushNews(
        `${a.name} ask done — ${t.title}. Bonus ${moneyLeft(t.bonus)}.`,
        'good',
      )
      this.fieldTask = null
      this.fieldTaskCool = FIELD_TASK_COOL
      this.emit()
      return
    }
    if (this.clock >= t.deadline) {
      const a = this.airline(t.airline)
      this.charge(FIELD_TASK_FAIL_FINE)
      this.adjustHeat(t.airline, FIELD_TASK_HEAT_FAIL)
      this.reputation = Math.max(0, this.reputation - 1.5)
      this.pushNews(
        `${a.name} ask failed — ${t.title}. Fine ${moneyLeft(FIELD_TASK_FAIL_FINE)}.`,
        'bad',
      )
      this.fieldTask = null
      this.fieldTaskCool = FIELD_TASK_COOL + 12
      this.emit()
    }
  }

  /** Seconds left on the active field ask, if any. */
  fieldTaskLeft(): number {
    if (!this.fieldTask) return 0
    return Math.max(0, this.fieldTask.deadline - this.clock)
  }

  cargoVolumeLeft(): number {
    if (!this.cargoVolume) return 0
    return Math.max(0, this.cargoVolume.deadline - this.clock)
  }

  creditCargoVolume(units: number) {
    if (!this.cargoVolume || units <= 0) return
    this.cargoVolume.delivered += units
    if (this.cargoVolume.delivered >= this.cargoVolume.targetUnits) {
      const j = this.cargoVolume
      const a = this.airline(j.airline)
      this.earn(j.fee, `${a.name} volume window`)
      this.adjustHeat(j.airline, 6)
      this.grantFieldXp(10 + Math.round(j.targetUnits / 12), 'cargo volume')
      this.pushNews(
        `${a.name} volume clear — ${j.delivered}/${j.targetUnits}u. +${moneyLeft(j.fee)} · On-time up.`,
        'good',
      )
      this.cargoVolume = null
      this.cargoVolumeCool = CARGO_VOLUME_COOL
      this.emit()
    }
  }

  considerCargoVolume() {
    if (this.cargoVolume || this.cargoVolumeCool > 0) return
    if (!tilesOf(this.tiles, 'cargo').length || !tilesOf(this.tiles, 'guard').length) return
    const pool = this.signed.filter(
      (id) => this.airline(id).kind === 'cargo' && !this.isBanned(id),
    )
    if (!pool.length) return
    // Cargo / hybrid starts get volume asks earlier.
    if (this.startFocus === 'pax' && this.flightsDone < 2 && Math.random() > 0.35) return
    const airline = pick(pool)
    const a = this.airline(airline)
    const target =
      this.startFocus === 'cargo'
        ? 48 + Math.floor(Math.random() * 36)
        : 36 + Math.floor(Math.random() * 28)
    const fee = Math.round(
      CARGO_VOLUME_FEE_MIN +
        Math.random() * (CARGO_VOLUME_FEE_MAX - CARGO_VOLUME_FEE_MIN),
    )
    const window = 55 + Math.random() * 35
    this.cargoVolume = {
      id: uid('vol'),
      airline,
      targetUnits: target,
      delivered: 0,
      fee,
      deadline: this.clock + window,
      age: 0,
    }
    this.pushNews(
      `${a.name} volume window — stage ${target}u through the shed in ~${Math.round(window)}s for ${moneyLeft(fee)}.`,
      'ok',
    )
    this.emit()
  }

  tickCargoVolume(dt: number) {
    this.cargoVolumeCool = Math.max(0, this.cargoVolumeCool - dt)
    if (!this.cargoVolume) {
      this.considerCargoVolume()
      return
    }
    this.cargoVolume.age += dt
    if (this.clock >= this.cargoVolume.deadline) {
      const j = this.cargoVolume
      const a = this.airline(j.airline)
      this.charge(CARGO_VOLUME_FAIL_FINE)
      this.adjustHeat(j.airline, -5)
      this.pushNews(
        `${a.name} volume missed — ${j.delivered}/${j.targetUnits}u. Fine ${moneyLeft(CARGO_VOLUME_FAIL_FINE)} · On-time dips.`,
        'bad',
      )
      this.cargoVolume = null
      this.cargoVolumeCool = CARGO_VOLUME_COOL + 20
      this.emit()
    }
  }

  noteCraft(kind: AircraftKind) {
    this.craftSeen[kind] = (this.craftSeen[kind] ?? 0) + 1
  }

  fleetMixLine(): string {
    const roles: { label: string; kinds: AircraftKind[] }[] = [
      { label: 'Pax', kinds: ['regional', 'narrowbody', 'widebody'] },
      { label: 'Cargo', kinds: ['freighter'] },
      { label: 'Emergency', kinds: ['helo_med', 'air_ambulance'] },
      { label: 'Exec', kinds: ['helo_exec'] },
      { label: 'Military', kinds: ['military'] },
    ]
    const parts = roles
      .map((r) => {
        const n = r.kinds.reduce((s, k) => s + (this.craftSeen[k] ?? 0), 0)
        return n > 0 ? `${r.label} ${n}` : null
      })
      .filter(Boolean)
    return parts.length ? parts.join(' · ') : 'No metal yet'
  }

  roleLabel(kind: AircraftKind): string {
    return craftRoleLabel(kind)
  }

  /** Premade + live procedural regionals. */
  allAirlines(): Airline[] {
    return [...airlineList(), ...this.extraAirlines]
  }

  airline(id: AirlineId): Airline {
    if (id === 'ga') {
      return normalizeAirline({
        id: 'ga',
        name: 'General Aviation',
        color: '#9aa7b0',
        stripe: '#c5d0d8',
        kind: 'pax',
        persona: 'business',
        tier: 1,
        bizModel: 'charter',
        fleetBlurb: 'Light singles / twins',
        landing: 2200,
        catering: 0,
        bags: 0,
        paxMin: 2,
        paxMax: 8,
        minRep: 0,
        req: {
          stands: 1,
          fuelContract: false,
          fuelFarm: false,
          fire: false,
          police: false,
          terminal: false,
          security: 0,
          bags: false,
          snack: false,
          catering: false,
          cargo: false,
          road: false,
          tower: false,
          heavyRunway: false,
        },
        blurb: 'Independent transient parking — not a signed carrier.',
        likesLayovers: false,
        heatSensitivity: 1,
      })
    }
    const raw =
      AIRLINES[id] ??
      this.extraAirlines.find((a) => a.id === id) ??
      AIRLINES.northline
    return normalizeAirline(raw)
  }

  fieldLevel(): AirlineTier {
    return fieldLevelFromXp(this.fieldXp)
  }

  /** Diplomacy day, 0 until the clock has run. */
  diplomacyDay(): number {
    return this.diplomacy?.day() ?? 0
  }

  private ensureDiplomacy(): DiplomacyBridge {
    if (!this.diplomacy) {
      this.diplomacy = createDiplomacyBridge(
        {
          addMoney: (amount, category) => this.postDiplomacyMoney(amount, category),
          getCash: () => this.cash,
          getContext: () => this.diplomacyContext(),
          notify: (message, severity) => {
            const tone = severity === 'bad' || severity === 'warn' ? 'bad' : severity === 'good' ? 'good' : 'ok'
            this.pushNews(message, tone)
          },
          applyReputation: (delta) => {
            this.reputation = Math.max(0, Math.min(100, this.reputation + delta))
          },
          onHostileAction: (action) => {
            this.pushNews(action.text, 'bad')
          },
        },
        this.diplomacySeed,
      )
    }
    return this.diplomacy
  }

  private postDiplomacyMoney(amount: number, _category: string) {
    if (amount > 0) {
      this.cash += amount
      this.revenue += amount
      this.noteIncome(amount, 'host_fees')
      return
    }
    if (amount < 0) {
      this.noteExpense(-amount)
      if (!this.sandbox) this.cash += amount
    }
  }

  private diplomacyContext() {
    const stands = tilesOf(this.tiles, 'stand')
    const classes = stands.map((s) => this.standClassAt(s))
    const occupied = this.flights.filter((f) => f.phase !== 'gone' && f.stand).length
    let food = 0
    let lounge = 0
    let family = 0
    let prestige = 0
    for (const fit of this.fits) {
      food += fit.rooms.food ?? 0
      lounge += fit.rooms.lounge ?? 0
      family += (fit.rooms.bathroom ?? 0) + (fit.rooms.dayhotel ?? 0) + (fit.rooms.gaming ?? 0)
      prestige += (fit.rooms.lounge ?? 0) + (fit.rooms.spa ?? 0) + (fit.rooms.golf ?? 0)
    }
    const onTime = this.diplomacy?.onTimePct() ?? 88
    const feeIndex = this.diplomacy?.adapter.engine.state.feeIndex ?? 1
    return {
      fieldLevel: this.fieldLevel(),
      metrics: {
        onTimePct: onTime,
        feeIndex,
        cafes: food,
        loungeSeats: lounge * 24,
        standCount: stands.length,
        standUtilization: stands.length ? occupied / stands.length : 0,
        heavyStands: classes.filter((c) => c === 'L').length,
        electricTugs: 0,
        solarCoveragePct: 0,
        familyAmenities: family,
        prestigeItems: prestige,
        exclusivePier: 0,
        nightSlots: this.hasResearch('night_bank') ? 1 : 0,
        coldChainRooms: 0,
        cargoFacilities: tilesOf(this.tiles, 'cargo').length,
        incentiveDealActive: 0,
        hubDepartures: this.hubAirlines.length,
        maintenanceLevel: tilesOf(this.tiles, 'hangar').length + (this.mechanics > 0 ? 1 : 0),
      },
      airport: {
        runwayLengthMeters: this.longestRunway() * 150,
        hasSmallStands: classes.some((c) => c === 'S' || c === 'M'),
        hasMediumStands: classes.some((c) => c === 'M' || c === 'L'),
        hasHeavyStands: classes.some((c) => c === 'L'),
        terminalRating: this.fieldLevel(),
        hasFuelService: tilesOf(this.tiles, 'fuel').length > 0,
        hasCateringService: Boolean(this.caterBrand) || tilesOf(this.tiles, 'kitchen').length > 0,
        hasMaintenanceService: tilesOf(this.tiles, 'hangar').length > 0,
        hasHeavyVehicles: tilesOf(this.tiles, 'depot').length > 0,
        onTimePercentage: onTime,
        totalFlightsHandled: this.flightsDone,
      },
    }
  }

  private tickDiplomacy(step: number) {
    const d = this.ensureDiplomacy()
    for (const id of this.signed) d.mirrorSigned(id)
    d.tick(step * GAME_MINUTES_PER_SIM_SECOND)
  }

  private diplomacyFeeFactor(airlineId: string): number {
    return this.diplomacy?.feeFactor(airlineId) ?? 1
  }

  private diplomacyCapacity(airlineId: string): number {
    return this.diplomacy?.capacityFactor(airlineId) ?? 1
  }

  private rampPace(airframeId: string, cargo: boolean, airlineId: string): number {
    const slow = this.diplomacy?.slowFactor(airlineId) ?? 1
    return turnaroundScale(AIRFRAMES[airframeId], cargo) * slow
  }

  private gradeDiplomacyTurn(f: Flight) {
    if (f.kind === 'military' || f.kind === 'air_ambulance') return
    const slot = f.scheduleId ? this.schedule.find((s) => s.id === f.scheduleId) : undefined
    const guests = this.hallGuests.filter((g) => g.flightId === f.id && !g.dead)
    const mood = guests.length
      ? guests.reduce((sum, g) => sum + g.happiness, 0) / guests.length / 100
      : 0.75
    const bagFault = this.bagTags.some((t) => t.flightId === f.id && t.fault)
    const result = this.ensureDiplomacy().gradeFlight({
      flightId: f.id,
      airlineId: f.airline,
      delayMinutes: (slot?.delaySec ?? 0) * GAME_MINUTES_PER_SIM_SECOND,
      bagFault,
      paxMood: mood,
      standFit: Boolean(f.stand),
    })
    if (result.ended) {
      this.pushNews(`${this.airline(f.airline).name} walked on the contract — satisfaction hit the floor.`, 'bad')
    }
  }

  private noteDiplomacyCancel(airlineId: string, excused: boolean) {
    this.diplomacy?.cancelFlight(airlineId, excused)
  }

  diplomacyRoster(): { id: string; name: string; band: string; standing: number }[] {
    if (!this.diplomacy) return []
    const cards = this.diplomacy.cards()
    const signed = cards.filter((c) => c.status === 'signed')
    const rest = cards.filter((c) => c.status !== 'signed')
    return [...signed, ...rest].slice(0, 4).map((c) => ({
      id: c.id,
      name: c.name,
      band: c.band.word,
      standing: c.standing,
    }))
  }

  diplomacyLetters(): { id: string; airline: string; text: string }[] {
    if (!this.diplomacy) return []
    return this.diplomacy.proposals().slice(0, 3).map((p) => {
      const rel = this.diplomacy?.relation(p.airlineId)
      return { id: p.id, airline: rel?.name ?? p.airlineId, text: p.text }
    })
  }

  answerDiplomacy(proposalId: string, response: 'accept' | 'decline') {
    const d = this.ensureDiplomacy()
    const before = new Set(d.signedIds())
    const result = d.respond(proposalId, response)
    if (result.ok && response === 'accept') {
      for (const id of d.signedIds()) {
        if (!before.has(id)) this.adoptDiplomacyCarrier(id)
      }
    }
    if (!result.ok) this.pushNews(result.message, 'bad')
    this.emit()
  }

  private adoptDiplomacyCarrier(id: string) {
    const rel = this.ensureDiplomacy().relation(id)
    if (!rel) return
    if (!AIRLINES[id] && !this.extraAirlines.some((a) => a.id === id)) {
      const template = rel.kind === 'cargo' ? AIRLINES.upps : rel.tier <= 2 ? AIRLINES.northline : AIRLINES.harbor
      this.extraAirlines.push(
        normalizeAirline({
          ...template,
          id: rel.id,
          name: rel.name,
          color: rel.livery[0],
          stripe: rel.livery[1],
          tier: rel.tier,
          kind: rel.kind === 'cargo' ? 'cargo' : 'pax',
          procedural: true,
        }),
      )
    }
    if (this.signed.includes(id)) return
    this.signed.push(id)
    if (this.airlineHeat[id] == null) this.airlineHeat[id] = 70
    this.seedScheduleForAirline(id, 3)
    this.pushNews(`${rel.name} signed. Flights hit the timetable.`, 'good')
  }

  /** Mean Standing across signed carriers. Null when nobody has signed. */
  avgStanding(): number | null {
    if (!this.signed.length) return null
    let sum = 0
    for (const id of this.signed) sum += this.standingOf(id)
    return sum / this.signed.length
  }

  fieldXpToNext(): { level: AirlineTier; xp: number; need: number; pct: number } {
    const level = this.fieldLevel()
    if (level >= 5) {
      return { level: 5, xp: this.fieldXp, need: FIELD_LEVEL_XP[5], pct: 1 }
    }
    const next = (level + 1) as AirlineTier
    const floor = FIELD_LEVEL_XP[level]
    const need = FIELD_LEVEL_XP[next]
    const pct = need <= floor ? 1 : Math.min(1, (this.fieldXp - floor) / (need - floor))
    return { level, xp: this.fieldXp, need, pct }
  }

  grantFieldXp(amount: number, why?: string) {
    if (amount <= 0) return
    const before = this.fieldLevel()
    this.fieldXp += amount
    const after = this.fieldLevel()
    if (after > before) {
      this.pushNews(
        `Field Level ${after} — ${AIRLINE_TIER_META[after].label} carriers will start calling.`,
        'good',
      )
    } else if (why && amount >= 12) {
      /* quiet drip — big chunks can mention */
      void why
    }
  }

  /**
   * Can this field host an offer from this carrier's tier?
   * Lv1 opens T1+T2 (commuter + regional starter lane). Higher levels open +1 each.
   */
  tierUnlocked(tier: AirlineTier): boolean {
    const lv = this.fieldLevel()
    const openThrough = Math.min(5, (lv + 1) as AirlineTier) as AirlineTier
    if (tier <= openThrough) return true
    // Peek one more tier when reputation is strong.
    return tier === openThrough + 1 && this.reputation >= 55 + tier * 4
  }

  loanProduct(id: string | null | undefined) {
    return LOAN_PRODUCTS.find((p) => p.id === id) ?? null
  }

  availableLoans() {
    return loansAvailable(LOAN_PRODUCTS, this.fieldLevel(), this.reputation, this.sandbox)
  }

  takeLoanProduct(productId: string) {
    if (this.loanBalance > 0) {
      this.pushNews('Pay off the open loan first.', 'bad')
      this.emit()
      return
    }
    const p = this.loanProduct(productId)
    if (!p) {
      this.pushNews('Unknown loan product.', 'bad')
      this.emit()
      return
    }
    if (!this.sandbox && (this.fieldLevel() < p.minFieldLevel || this.reputation < p.minRep)) {
      this.pushNews(
        `${p.label} locked — need Field Lv${p.minFieldLevel}+ and rep ${p.minRep}+.`,
        'bad',
      )
      this.emit()
      return
    }
    this.loanProductId = p.id
    this.loanPrincipal = p.principal
    this.loanOpened = p.principal + p.fee
    this.loanBalance = this.loanOpened
    this.cash += p.principal
    this.interestCool = p.every
    this.loanNewsCool = 0
    this.pushNews(
      `${p.label}: bank wired ${moneyLeft(p.principal)} (fee ${moneyLeft(p.fee)}). Owe ${moneyLeft(this.loanBalance)}.`,
      'ok',
    )
    this.emit()
  }

  heatOf(id: AirlineId): number {
    return this.airlineHeat[id] ?? 70
  }

  /** Player-facing alias — airline Standing (same 0–100 meter as heatOf). */
  standingOf(id: AirlineId): number {
    return this.heatOf(id)
  }

  isBanned(id: AirlineId): boolean {
    return (this.airlineBanUntil[id] ?? 0) > this.clock
  }

  banRemaining(id: AirlineId): number {
    return Math.max(0, (this.airlineBanUntil[id] ?? 0) - this.clock)
  }

  adjustHeat(id: AirlineId, delta: number) {
    const a = this.airline(id)
    let h = this.heatOf(id)
    if (delta < 0) h += delta * a.heatSensitivity
    else h += delta
    // Soft floor outside an active layover — schedule cascades shouldn't zero a carrier overnight.
    const floor = this.layover?.airline === id ? 0 : 15
    this.airlineHeat[id] = clamp(h, floor, 100)
    if (
      this.airlineHeat[id] <= this.banThreshold(id) &&
      this.layover?.airline === id &&
      !this.isBanned(id)
    ) {
      this.banAirline(id, 'layover Standing crashed')
    }
  }

  /** One hall-miss headline per flight / destination window. */
  hallMissNews(key: string, text: string) {
    if ((this.hallMissCool[key] ?? 0) > this.clock) return
    this.hallMissCool[key] = this.clock + 14
    this.pushNews(text, 'bad')
  }

  isHub(id: AirlineId): boolean {
    return this.hubAirlines.includes(id)
  }

  banThreshold(id: AirlineId): number {
    return this.isHub(id) ? HUB_BAN_THRESHOLD : HEAT_BAN_THRESHOLD
  }

  banAirline(id: AirlineId, reason: string) {
    if (this.isBanned(id)) return
    const a = this.airline(id)
    const wasHub = this.isHub(id)
    const banSecs = wasHub ? LAYOVER_BAN_SECONDS + 40 : LAYOVER_BAN_SECONDS
    const fine = wasHub ? LAYOVER_BAN_FINE + 4000 : LAYOVER_BAN_FINE
    this.airlineBanUntil[id] = this.clock + banSecs
    this.airlineHeat[id] = Math.min(this.heatOf(id), this.banThreshold(id) - 2)
    this.charge(fine)
    if (this.layover?.airline === id) this.layover = null
    if (this.layoverOffer?.airline === id) this.layoverOffer = null
    if (this.hubOffer?.airline === id) this.hubOffer = null
    if (wasHub) {
      this.hubAirlines = this.hubAirlines.filter((x) => x !== id)
      this.pushNews(`${a.name} pulled the Hub plaque after the ban.`, 'bad')
    }
    this.pushNews(
      `${a.name} banned you for ${banSecs}s (${reason}). Fine ${moneyLeft(fine)}.`,
      'bad',
    )
    this.reputation = Math.max(0, this.reputation - (wasHub ? 10 : 6))
  }

  /**
   * AT3-readable Field Rating 0–100.
   * Blend of reputation, avg airline heat, hall wear inverse, security budget.
   */
  fieldRating(): number {
    const rep = this.reputation
    const heats = this.signed.map((id) => this.heatOf(id))
    const avgHeat = heats.length
      ? heats.reduce((s, h) => s + h, 0) / heats.length
      : 55
    const wear = this.avgWear()
    const wearScore = 100 - (wear.bath * 0.55 + wear.sec * 0.45)
    const secScore = this.budgets.security
    const incidents = Math.min(20, this.securityIncidents)
    const raw =
      rep * 0.34 +
      avgHeat * 0.32 +
      wearScore * 0.2 +
      secScore * 0.14 -
      incidents * 1.2
    return clamp(Math.round(raw), 0, 100)
  }

  fieldRatingLabel(): string {
    const r = this.fieldRating()
    if (r >= 85) return 'Hub grade'
    if (r >= 70) return 'Solid'
    if (r >= 55) return 'Serviceable'
    if (r >= 40) return 'Thin'
    return 'At risk'
  }

  rewardOf(id: AirlineId): AirlineRewardId | null {
    return this.airlineReward[id] ?? null
  }

  hasReward(id: AirlineId, kind: AirlineRewardId): boolean {
    return this.airlineReward[id] === kind
  }

  /** Any signed carrier holding this perk. */
  anyReward(kind: AirlineRewardId): boolean {
    return this.signed.some((id) => this.airlineReward[id] === kind)
  }

  grantReward(id: AirlineId) {
    if (this.airlineReward[id]) return
    const a = this.airline(id)
    const reward = rewardForPersona(a.persona)
    this.airlineReward[id] = reward
    // Persona-flavored unlocks — physical hall / bank payoffs.
    if (reward === 'brand_lounge') {
      const fit = this.activeHall() ?? this.fits[0]
      if (fit) fit.rooms.lounge = Math.max(fit.rooms.lounge ?? 0, 1) + 1
      this.pushNews(
        `${a.name} First-class lounge open — their premium pax get the branded calm.`,
        'good',
      )
    } else if (reward === 'budget_perk') {
      const fit = this.activeHall() ?? this.fits[0]
      if (fit && (fit.rooms.food ?? 0) < 1) fit.rooms.food = 1
      this.pushNews(
        `${a.name} snack franchise live — budget pax overpay for fries in their colors.`,
        'good',
      )
    } else if (reward === 'biz_priority') {
      this.seedScheduleForAirline(id, 2)
      this.pushNews(
        `${a.name} priority slots — denser bank + richer landing fees.`,
        'good',
      )
    } else if (reward === 'cargo_night') {
      this.pushNews(
        `${a.name} night waiver — freighter handling pays up after dark.`,
        'good',
      )
    }
    this.pushNews(
      `${a.name} unlocked ${REWARD_LABEL[reward]} (Standing ${HEAT_REWARD_THRESHOLD}+). ${REWARD_DETAIL[reward]}`,
      'good',
    )
    this.reputation = Math.min(100, this.reputation + 2)
  }

  /** Airlines currently under a warn flag. */
  warnedAirlines(): AirlineId[] {
    return this.signed.filter((id) => this.airlineWarned[id] && !this.isBanned(id))
  }

  /** Carrier walks after sustained dead heat — fine + drop contract + strip perk. */
  abandonAirline(id: AirlineId, reason: string) {
    if (!this.signed.includes(id)) return
    const a = this.airline(id)
    const lost = this.airlineReward[id] ?? null
    this.signed = this.signed.filter((x) => x !== id)
    this.diplomacy?.noteLeft(id)
    this.mxSigned = this.mxSigned.filter((x) => x !== id)
    this.hubAirlines = this.hubAirlines.filter((x) => x !== id)
    delete this.airlineReward[id]
    delete this.airlineWarned[id]
    delete this.airlineLowAcc[id]
    this.airlineHeat[id] = Math.min(this.heatOf(id), HEAT_ABANDON_THRESHOLD)
    this.charge(ABANDON_FINE)
    // Reverse persona unlocks — empty lounge / franchise leaves a scar.
    if (lost === 'brand_lounge') {
      const fit = this.activeHall() ?? this.fits[0]
      if (fit && (fit.rooms.lounge ?? 0) > 0) {
        fit.rooms.lounge = Math.max(0, (fit.rooms.lounge ?? 0) - 1)
      }
      this.pushNews(
        `${a.name} pulled their first-class lounge — premium tips dry up.`,
        'bad',
      )
    } else if (lost === 'budget_perk') {
      this.pushNews(
        `${a.name} franchise signs come down — snack spend cools.`,
        'bad',
      )
    } else if (lost === 'biz_priority') {
      this.pushNews(
        `${a.name} priority slots voided — bank thins.`,
        'bad',
      )
    } else if (lost === 'cargo_night') {
      this.pushNews(
        `${a.name} night waiver revoked — freighter premiums gone.`,
        'bad',
      )
    }
    if (this.layover?.airline === id) this.layover = null
    if (this.layoverOffer?.airline === id) this.layoverOffer = null
    if (this.hubOffer?.airline === id) this.hubOffer = null
    if (this.offer?.airline === id) this.offer = null
    if (this.mxOffer?.airline === id) this.mxOffer = null
    for (const s of this.schedule) {
      if (
        s.airline === id &&
        (s.status === 'scheduled' || s.status === 'delayed')
      ) {
        s.status = 'cancelled'
        s.delayReason = 'carrier abandoned'
      }
    }
    // Contagion — other signed carriers cool a notch.
    for (const other of this.signed) {
      this.adjustHeat(other, -4)
    }
    const perkBit = lost ? ` Lost ${REWARD_LABEL[lost]}.` : ''
    this.pushNews(
      `${a.name} abandoned the field (${reason}). Fine ${moneyLeft(ABANDON_FINE)}.${perkBit}`,
      'bad',
    )
    this.reputation = Math.max(0, this.reputation - (lost ? 11 : 8))
  }

  landingFeeMult(airlineId: AirlineId): number {
    const r = this.rewardOf(airlineId)
    if (r === 'biz_priority') return 1.14
    if (r === 'cargo_night') return 1.2
    return 1
  }

  hasResearch(id: ResearchId): boolean {
    return this.researchUnlocked.includes(id)
  }

  /** Sim day cycle ~180s; night is the last third. */
  isNight(): boolean {
    return this.clock % 180 >= 120
  }

  canBuyResearch(id: ResearchId): { ok: boolean; why: string } {
    const node = RESEARCH_NODES.find((n) => n.id === id)
    if (!node) return { ok: false, why: 'Unknown project.' }
    if (this.hasResearch(id)) return { ok: false, why: 'Already unlocked.' }
    if (node.requires && !this.hasResearch(node.requires)) {
      const need = RESEARCH_NODES.find((n) => n.id === node.requires)
      return { ok: false, why: `Need ${need?.name ?? node.requires} first.` }
    }
    if (this.researchPoints < node.cost) {
      return {
        ok: false,
        why: `Need ${node.cost} RP (have ${Math.floor(this.researchPoints)}).`,
      }
    }
    return { ok: true, why: '' }
  }

  buyResearch(id: ResearchId) {
    const gate = this.canBuyResearch(id)
    const node = RESEARCH_NODES.find((n) => n.id === id)
    if (!node) return
    if (!gate.ok) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    this.researchPoints -= node.cost
    this.researchUnlocked.push(id)
    this.pushNews(`R&D unlocked: ${node.name} — ${node.blurb}`, 'good')
    this.reputation = Math.min(100, this.reputation + 1)
    this.emit()
  }

  /** Award RP when a jet/helo finishes takeoff. */
  grantResearchForFlight(f: Flight) {
    let rp = RP_PER_FLIGHT
    if (f.pax > 0) rp += Math.floor(f.pax / 50) * RP_PER_50_PAX
    if (f.kind === 'freighter' && this.hasResearch('night_bank') && this.isNight()) {
      rp += 1
    }
    this.researchPoints += rp
  }

  pickAircraftKind(airlineId: AirlineId): AircraftKind {
    const a = this.airline(airlineId)
    if (a.kind === 'cargo') return 'freighter'
    // Summit / EXFED-class — heavy strip + heavy_pack opens widebody (A380 in the pool).
    if (a.req.heavyRunway && this.hasHeavyRunway()) return 'widebody'
    if (a.persona === 'budget' || a.id === 'northline' || a.procedural) {
      return Math.random() < 0.6 ? 'regional' : 'narrowbody'
    }
    if (a.persona === 'business' || a.id === 'harbor') {
      return Math.random() < 0.45 ? 'regional' : 'narrowbody'
    }
    return 'narrowbody'
  }

  /**
   * Stands on the Guard / cargo side — near a hangar, not glued to a pax jetway.
   * Military metal should not steal T1·G2 from Northline.
   */
  milCapableStands(): Vec[] {
    const hangars = tilesOf(this.tiles, 'hangar')
    if (!hangars.length) return []
    return tilesOf(this.tiles, 'stand').filter((s) => {
      const nearHangar = hangars.some(
        (h) => Math.abs(h.c - s.c) + Math.abs(h.r - s.r) <= MIL_RAMP_RANGE,
      )
      if (!nearHangar) return false
      const hall = this.jetwayHall(s)
      if (hall) {
        const dHall =
          Math.abs(hall.origin.c - s.c) + Math.abs(hall.origin.r - s.r)
        // Keep mil hardstands off the close-in pax gate ring.
        if (dHall <= Math.min(5, JETWAY_RANGE - 2)) return false
      }
      return Boolean(this.pathStandToRunway(s))
    })
  }

  milRampLine(): string {
    const n = this.milCapableStands().length
    const cargo = tilesOf(this.tiles, 'cargo').length > 0
    const heavy = this.hasHeavyRunway()
    const pack = this.hasResearch('mil_ramp')
    if (!n) return 'No mil ramp — hangar-side hardstand + taxi to strip'
    return `Mil ramp ${n} pad${n === 1 ? '' : 's'}${cargo ? ' · cargo' : ' · need cargo'}${
      heavy ? ' · heavy strip' : ''
    }${pack ? ' · C-5 unlocked' : ''}`
  }

  assignMilStand(): Vec | null {
    const freeKeys = new Set(this.freeStands().map((s) => `${s.c},${s.r}`))
    const pool = this.milCapableStands().filter((s) => freeKeys.has(`${s.c},${s.r}`))
    if (!pool.length) return null
    // Prefer stands closest to hangar.
    const hangars = tilesOf(this.tiles, 'hangar')
    pool.sort((a, b) => {
      const da = Math.min(
        ...hangars.map((h) => Math.abs(h.c - a.c) + Math.abs(h.r - a.r)),
      )
      const db = Math.min(
        ...hangars.map((h) => Math.abs(h.c - b.c) + Math.abs(h.r - b.r)),
      )
      return da - db
    })
    return pool[0]
  }

  aircraftLabel(kind: AircraftKind): string {
    const map: Record<AircraftKind, string> = {
      regional: 'Regional',
      narrowbody: 'Narrowbody',
      widebody: 'Widebody',
      freighter: 'Freighter',
      helo_med: 'Medevac helo',
      helo_exec: 'Exec helo',
      military: 'Military',
      air_ambulance: 'Air ambulance',
    }
    return map[kind]
  }

  canHostMilitary(): { ok: boolean; why: string } {
    if (this.milAgreement) return { ok: false, why: 'Guard agreement already active.' }
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return { ok: false, why: 'Need a runway.' }
    if (!tilesOf(this.tiles, 'hangar').length) return { ok: false, why: 'Need a hangar.' }
    if (!tilesOf(this.tiles, 'tower').length) return { ok: false, why: 'Need a control tower.' }
    if (!tilesOf(this.tiles, 'police').length) return { ok: false, why: 'Need police on field.' }
    if (!tilesOf(this.tiles, 'cargo').length) {
      return { ok: false, why: 'Need a cargo shed for Guard logistics.' }
    }
    if (!this.milCapableStands().length) {
      return {
        ok: false,
        why: `Need a hangar-side hardstand (≤${MIL_RAMP_RANGE}c, not a close pax jetway) with taxi to the strip.`,
      }
    }
    if (this.reputation < 48) return { ok: false, why: 'Need reputation 48+.' }
    if (this.cash < MIL_AGREE_COST) return { ok: false, why: `Need ${moneyLeft(MIL_AGREE_COST)}.` }
    return {
      ok: true,
      why: this.hasResearch('mil_ramp')
        ? 'Ready — Guard host + C-5M when the heavy strip is live.'
        : 'Ready for Guard transit (C-130 / C-17 / KC-135 / F-15). Research Military ramp for C-5M.',
    }
  }

  signMilitaryAgreement() {
    const gate = this.canHostMilitary()
    if (!gate.ok) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    if (!this.spend(MIL_AGREE_COST, 'military host agreement')) return
    this.milAgreement = true
    this.milCool = 20
    this.reputation = Math.min(100, this.reputation + 5)
    this.pushNews(
      this.hasResearch('mil_ramp')
        ? 'Guard host signed — mil ramp live. C-130 through C-5M can use hangar-side pads.'
        : 'Guard host signed — mil ramp live. C-130 / C-17 / KC-135 / F-15 for now; research Military ramp for C-5M.',
      'good',
    )
    this.emit()
  }

  buyLand(kind: SiteKind): boolean {
    const land = LAND[kind]
    if (this.cash < land.cost) {
      this.pushNews(`Cannot afford ${land.name}.`, 'bad')
      this.emit()
      return false
    }
    this.cash -= land.cost
    this.site = kind
    this.tiles = emptyTiles()
    this.seedAccessStub()
    this.speed = 1
    this.parcels = 1
    this.railLinked = false
    this.hotelLevel = 0
    this.carParkShort = false
    this.carParkLong = false
    this.parkTerms = {}
    this.hotelClass = {}
    this.standClass = {}
    this.standAccess = {}
    this.standAccessMode = 'remote'
    this.janitors = 0
    this.researchers = 0
    this.researcherCool = 0
    this.deskStaff = 0
    this.deskStaffCool = 0
    this.hallStaff = []
    const focusBit =
      this.startFocus === 'cargo'
        ? 'Cargo focus — Starter kit builds shed + guard, no hall.'
        : this.startFocus === 'hybrid'
          ? 'Hybrid focus — hall + freight road.'
          : 'Passenger focus — Northline-ready hall kit.'
    this.pushNews(
      `${land.name} purchased. ${focusBit} ${moneyLeft(this.cash)} left. Stamp Starter kit ($${STARTER_KIT_COST.toLocaleString()}) or build freehand.`,
      'ok',
    )
    this.bumpMap()
    this.persist()
    this.emit()
    return true
  }

  seedAccessStub() {
    // City edge hint — short road stub from north edge so players see the connection idea.
    for (let r = 0; r < 3; r++) this.tiles[r][Math.floor(SIZE / 2)] = 'road'
  }

  /** One-click AT3 field — flavor follows startFocus (pax / cargo / hybrid). */
  buildStarterKit() {
    if (!this.site) {
      this.pushNews('Buy land first.', 'bad')
      return
    }
    if (runwayStrips(this.tiles, MIN_RUNWAY).length) {
      this.pushNews('Field already has a runway — kit is for empty plots.', 'bad')
      return
    }
    if (!this.spend(STARTER_KIT_COST, 'starter kit')) return

    if (this.startFocus === 'cargo') {
      this.buildCargoStarterKit()
      return
    }

    this.facing = 'h'
    // Five cells south of the stands: a code-F wing at the visual scale clears the strip.
    for (const p of this.prefabRunway({ c: 8, r: 26 })) this.tiles[p.r][p.c] = 'runway'
    this.tiles[21][8] = 'fuel'
    this.tiles[21][9] = 'road'
    this.tiles[21][10] = 'bags'
    this.tiles[17][14] = 'snack'
    this.tiles[20][8] = 'fire'
    this.tiles[17][11] = 'tower'
    // Road from north city edge down to the hall
    const roadC = 16
    for (let r = 0; r <= 18; r++) this.tiles[r][roadC] = 'road'
    // Curb three cells north of the stands, clear of a code-F nose.
    for (let c = 8; c <= 22; c++) this.tiles[18][c] = 'road'
    // Nose spurs so a mechanic can leave a stand. The wing rows stay grass.
    for (let r = 19; r <= 20; r++) this.tiles[r][9] = 'road'
    this.tiles[20][12] = 'road'
    this.tiles[19][13] = 'road'
    this.tiles[20][13] = 'road'
    for (let r = 19; r <= 20; r++) this.tiles[r][20] = 'road'
    // Guard post on the city approach — screens inbound cargo trucks.
    this.tiles[3][roadC] = 'guard'
    // Cargo shed on a road stub (city trucks → guard → shed).
    this.tiles[10][roadC + 1] = 'road'
    this.tiles[10][roadC + 2] = 'cargo'
    // Taxi link so freighter GSE can reach the shed. It stops at the curb.
    for (let r = 11; r <= 17; r++) this.tiles[r][roadC + 2] = 'taxi'
    // Premade hall touching the curb + road (c15–17, r19–21)
    const origin = { c: 15, r: 19 }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) this.tiles[origin.r + r][origin.c + c] = 'terminal'
    }
    // Stands AFTER hall so they are not overwritten by the 3×3 terminal stamp.
    this.tiles[21][12] = 'stand'
    this.tiles[21][20] = 'stand'
    this.standClass['12,21'] = 'M'
    this.standClass['20,21'] = 'M'
    this.standAccess['12,21'] = 'jetway'
    this.standAccess['20,21'] = 'jetway'
    // Each stand has its own lead-in. A through-taxi on the next row sits inside a parked wing.
    for (const c of [12, 20]) {
      for (let r = 22; r <= 25; r++) this.tiles[r][c] = 'taxi'
    }
    // Bag belt: makeup (bags@10) ↔ stands @12/@20 ↔ hall terminals @15–17
    this.tiles[21][11] = 'belt'
    this.tiles[21][13] = 'belt'
    this.tiles[21][14] = 'belt'
    this.tiles[21][18] = 'belt'
    this.tiles[21][19] = 'belt'
    this.fits = [
      emptyFit(origin, true, {
        checkin: 2,
        security: 2,
        gate: 2,
        bagclaim: 1,
        food: 1,
        souvenir: 1,
        bagdrop: 1,
        lounge: 1,
        bathroom: 2,
      }),
    ]
    this.fuelBrand = 'apex'
    this.fuelLoads = 4
    this.foodShelf = this.shelfCap('food')
    this.shopShelf = this.shelfCap('shop')
    this.caterBrand = 'skybite'
    this.mechanics = 1
    this.spawnMechanicPawn()
    // One desk body so the first bank doesn't miss gates on an empty counter.
    this.deskStaff = 1
    this.assignHallStaff()
    // Airport is live — first airline call comes quick; later ones stay slow.
    // Threats and emergency asks are not held back. A thin lane or an empty farm shows up on its own.
    this.offerCool = 3
    this.spawnCool = 6
    this.pushNews(
      this.startFocus === 'hybrid'
        ? 'Hybrid kit down — hall + guard/cargo road. Day pax, night freight.'
        : 'Starter kit down — guard post + cargo shed on the city road, lounge, mechanic + desk. Northline should call.',
      'good',
    )
    this.bumpMap()
    this.persist()
    this.emit()
  }

  /** Cargo-first kit — freighter ready, no pax hall required. */
  private buildCargoStarterKit() {
    this.facing = 'h'
    for (const p of this.prefabRunway({ c: 8, r: 26 })) this.tiles[p.r][p.c] = 'runway'
    this.tiles[21][8] = 'fuel'
    this.tiles[20][8] = 'fire'
    this.tiles[20][10] = 'police'
    this.tiles[17][12] = 'tower'
    const roadC = 14
    for (let r = 0; r <= 21; r++) this.tiles[r][roadC] = 'road'
    this.tiles[3][roadC] = 'guard'
    this.tiles[12][roadC + 1] = 'road'
    this.tiles[12][roadC + 2] = 'cargo'
    for (let r = 13; r <= 20; r++) this.tiles[r][roadC + 2] = 'taxi'
    for (let c = 9; c <= 15; c++) this.tiles[21][c] = 'road'
    this.tiles[21][16] = 'stand'
    this.standClass['16,21'] = 'M'
    this.standAccess['16,21'] = 'remote'
    for (let r = 22; r <= 25; r++) this.tiles[r][16] = 'taxi'
    this.fits = []
    this.fuelBrand = 'apex'
    this.fuelLoads = 5
    this.caterBrand = null
    this.mechanics = 1
    this.spawnMechanicPawn()
    this.deskStaff = 0
    this.hallStaff = []
    this.offerCool = 2
    this.spawnCool = 5
    this.cargoVolumeCool = 18
    this.pushNews(
      'Cargo kit down — strip, freighter stand, guard → shed pipeline. No pax hall. UPPS should call.',
      'good',
    )
    this.bumpMap()
    this.persist()
    this.emit()
  }

  /** Legacy single-button loan → bridge product. */
  takeLoan() {
    this.takeLoanProduct('bridge')
  }

  repayLoan() {
    if (this.loanBalance <= 0) return
    if (!this.spend(this.loanBalance, 'loan payoff')) return
    this.loanBalance = 0
    this.loanProductId = null
    this.loanPrincipal = 0
    this.loanOpened = 0
    this.reputation = Math.min(100, this.reputation + 3)
    this.grantFieldXp(8, 'loan clear')
    this.pushNews('Loan cleared.', 'good')
    this.emit()
  }

  buyParcel() {
    if (!this.site) return
    if (this.parcels >= 4) {
      this.pushNews('No more parcels on this map sketch.', 'bad')
      return
    }
    // CS-style: more land needs field level (parcel 2 → Lv2, etc.).
    const needLv = Math.min(5, this.parcels) as AirlineTier
    if (this.fieldLevel() < needLv) {
      this.pushNews(
        `Parcel ${this.parcels + 1} locked — reach Field Level ${needLv} first.`,
        'bad',
      )
      this.emit()
      return
    }
    if (!this.spend(PARCEL_COST * this.parcels, 'land parcel')) return
    this.parcels += 1
    this.grantFieldXp(10, 'parcel')
    // Paint a strip of buildable grass marker as road fringe on the east
    const edge = 6 + this.parcels * 4
    for (let r = 4; r < SIZE - 4; r++) {
      if (edge < SIZE && this.tiles[r][edge] === 'grass') {
        /* parcel unlock is soft — more cash runway later; for now reputation + news */
      }
    }
    this.reputation = Math.min(100, this.reputation + 2)
    this.pushNews(`Parcel ${this.parcels} bought. Room to grow the apron.`, 'good')
    this.emit()
  }

  investRail() {
    if (!this.site) return
    if (this.railLinked) {
      this.pushNews('City rail already reaches the fence.', 'ok')
      return
    }
    if (!this.spend(RAIL_CITY_COST, 'city rail investment')) return
    this.railLinked = true
    // City builds to the west edge; player sees a stub.
    for (let c = 0; c < 4; c++) this.tiles[Math.floor(SIZE / 2)][c] = 'road'
    this.reputation = Math.min(100, this.reputation + 5)
    this.bumpMap()
    this.pushNews(
      'City laid rail to the west fence. Connect roads from there — passengers arrive easier.',
      'good',
    )
    this.emit()
  }

  buyHotel() {
    if (!this.site) return
    if (this.hotelLevel >= 2) {
      this.pushNews('Hotel already at two wings.', 'ok')
      this.emit()
      return
    }
    const cost = this.hotelLevel === 0 ? HOTEL_COST : HOTEL_COST_L2
    if (!this.spend(cost, this.hotelLevel === 0 ? 'airport hotel' : 'hotel wing 2')) return
    this.hotelLevel += 1
    this.reputation = Math.min(100, this.reputation + 3)
    this.pushNews(
      this.hotelLevel === 1
        ? 'Airport hotel open — overnight pax + landside income.'
        : 'Second hotel wing — more beds, more walk-up traffic.',
      'good',
    )
    this.emit()
  }

  buyCarPark(kind: 'short' | 'long') {
    if (!this.site) return
    if (kind === 'short') {
      if (this.carParkShort) {
        this.pushNews('Short-term car park already open.', 'ok')
        this.emit()
        return
      }
      if (!this.spend(CARPARK_SHORT_COST, 'short-term car park')) return
      this.carParkShort = true
      this.pushNews('Short-term car park open — kiss-and-fly money.', 'good')
    } else {
      if (this.carParkLong) {
        this.pushNews('Long-term car park already open.', 'ok')
        this.emit()
        return
      }
      if (!this.spend(CARPARK_LONG_COST, 'long-term car park')) return
      this.carParkLong = true
      this.reputation = Math.min(100, this.reputation + 1)
      this.pushNews('Long-stay car park open — weekenders leave cars for days.', 'good')
    }
    this.emit()
  }

  setParkTerm(term: ParkTerm) {
    this.parkTerm = term
    this.emit()
  }

  setStandAccessMode(mode: StandAccess) {
    this.standAccessMode = mode
    this.emit()
  }

  standAccessAt(stand: Vec | null): StandAccess {
    if (!stand) return 'remote'
    const k = `${stand.c},${stand.r}`
    if (this.standAccess[k]) return this.standAccess[k]
    // Grandfather older saves: proximity used to mean jetway.
    if (!this.fits.length) return 'remote'
    let bestD = JETWAY_RANGE + 1
    for (const f of this.fits) {
      const d = Math.abs(f.origin.c - stand.c) + Math.abs(f.origin.r - stand.r)
      if (d < bestD) bestD = d
    }
    return bestD <= JETWAY_RANGE ? 'jetway' : 'remote'
  }

  /** How this stand moves pax this turn — jetway / terminal bus / walk. */
  standPaxMode(stand: Vec | null): StandPaxMode {
    if (!stand) return 'walk'
    if (this.jetwayHall(stand)) return 'jetway'
    const depots = tilesOf(this.tiles, 'termbus')
    if (depots.length) {
      const path = nearestPath(this.tiles, depots[0], [stand], 'truck')
      if (path && path.length >= 2) return 'bus'
    }
    return 'walk'
  }

  /** True when short-term parking exists (meta buy or stamped short lots). */
  hasShortParking(): boolean {
    if (this.carParkShort) return true
    return (['park_s', 'park_l', 'park_g', 'park_u'] as const).some((k) =>
      tilesOf(this.tiles, k).some((p) => (this.parkTerms[`${p.c},${p.r}`] ?? 'short') === 'short'),
    )
  }

  /** True when long-term parking exists (meta buy or stamped long lots). */
  hasLongParking(): boolean {
    if (this.carParkLong) return true
    return (['park_s', 'park_l', 'park_g', 'park_u'] as const).some((k) =>
      tilesOf(this.tiles, k).some((p) => this.parkTerms[`${p.c},${p.r}`] === 'long'),
    )
  }

  hasHotelBeds(): boolean {
    return this.hotelLevel > 0 || tilesOf(this.tiles, 'hotel').length > 0
  }

  hasBusCurb(): boolean {
    return tilesOf(this.tiles, 'bus').length > 0
  }

  hasRailStation(): boolean {
    return this.railLinked && tilesOf(this.tiles, 'rail').length > 0
  }

  /** Mode available on the field right now. */
  modeAvailable(mode: ArriveMode): boolean {
    switch (mode) {
      case 'dropoff':
        return tilesOf(this.tiles, 'road').length > 0
      case 'car_short':
        return this.hasShortParking()
      case 'car_long':
        return this.hasLongParking()
      case 'bus':
        return this.hasBusCurb()
      case 'rail':
        return this.hasRailStation()
      case 'hotel':
        return this.hasHotelBeds()
    }
  }

  /**
   * Persona-weighted preferred landside mode, then fallback if infra missing.
   * Luxury → hotel/long park; business → rail/short; budget → bus/long.
   */
  pickGuestMode(
    tag: PaxTag,
    persona: Airline['persona'],
    _job: 'depart' | 'arrive',
  ): { prefer: ArriveMode; actual: ArriveMode } {
    const pool: ArriveMode[] =
      persona === 'luxury' || tag === 'premium'
        ? ['hotel', 'car_long', 'rail', 'dropoff', 'car_short']
        : persona === 'business' || tag === 'business'
          ? ['rail', 'car_short', 'dropoff', 'hotel', 'bus']
          : persona === 'cargo_night' || persona === 'military_gov'
            ? ['dropoff', 'car_short', 'bus']
            : tag === 'family'
              ? ['car_long', 'bus', 'dropoff', 'car_short', 'rail']
              : ['bus', 'car_long', 'dropoff', 'rail', 'car_short']
    const prefer = pool[Math.floor(Math.random() * Math.min(3, pool.length))]
    if (this.modeAvailable(prefer)) return { prefer, actual: prefer }
    for (const m of pool) {
      if (this.modeAvailable(m)) return { prefer, actual: m }
    }
    return { prefer, actual: 'dropoff' }
  }

  applyGuestLandside(g: HallGuest, job: 'depart' | 'arrive') {
    const mode = g.arriveMode ?? 'dropoff'
    const missed = g.preferMode && g.preferMode !== mode
    if (missed) {
      g.happiness -= g.tag === 'premium' ? 10 : 6
      g.patience -= 8
      const leave = job === 'arrive'
      g.thought =
        g.preferMode === 'bus'
          ? leave
            ? 'No bus home — expensive taxi'
            : 'No bus curb — paid for a drop-off'
          : g.preferMode === 'rail'
            ? leave
              ? 'No rail out — scrambled exit'
              : 'No rail station — scrambled landside'
            : g.preferMode === 'hotel'
              ? leave
                ? 'No hotel overnight — wiped'
                : 'No hotel beds — exhausted already'
              : g.preferMode === 'car_short'
                ? leave
                  ? 'No short-term pickup lot'
                  : 'No short-term lot — circling'
                : g.preferMode === 'car_long'
                  ? leave
                    ? 'No long-term lot for the car'
                    : 'No long-term lot — awkward drop-off'
                  : 'Landside scramble'
    }
    let fee = 0
    let spendKind: SpendKind | null = null
    if (mode === 'car_short' && this.modeAvailable('car_short')) {
      fee = this.parkUseFee('short')
      spendKind = 'landside'
    } else if (mode === 'car_long' && this.modeAvailable('car_long')) {
      fee = this.parkUseFee('long')
      spendKind = 'landside'
    } else if (mode === 'hotel' && this.modeAvailable('hotel')) {
      fee = this.hotelUseFee(g.tag)
      spendKind = 'nap'
    } else if (mode === 'bus' && this.modeAvailable('bus')) {
      fee = BUS_FARE
      spendKind = 'landside'
    } else if (mode === 'rail' && this.modeAvailable('rail')) {
      fee = RAIL_FARE
      spendKind = 'landside'
    }
    // Drop-off / missing infra — no fee. Prefs + wallet gate the rest (RCT).
    if (fee > 0 && spendKind) {
      const buy = this.tryGuestPay(g, fee, spendKind, false)
      if (!buy.ok) {
        if (buy.why === 'broke' || buy.why === 'too expensive') {
          g.happiness -= 2
          g.thought =
            mode === 'hotel'
              ? buy.why === 'broke'
                ? 'Hotel too rich for my wallet'
                : 'Skipped hotel — saving cash'
              : buy.why === 'broke'
                ? 'Landside fee — broke'
                : 'Skipped landside fee — not worth it'
        } else if (!missed) {
          g.thought = 'Skipped landside spend'
        }
      } else {
        this.noteLandsideUse(mode === 'hotel' || mode === 'car_long' ? 2 : 1)
        if (mode === 'hotel') g.needs.energy = Math.max(0, g.needs.energy - 25)
        if (!missed) {
          g.happiness += 3
          g.thought =
            mode === 'hotel'
              ? `Hotel stay (−$${fee})`
              : mode === 'bus'
                ? `Bus in (−$${fee})`
                : mode === 'rail'
                  ? `Rail in (−$${fee})`
                  : mode === 'car_long'
                    ? `Long park (−$${fee})`
                    : mode === 'car_short'
                      ? `Short park (−$${fee})`
                      : g.thought
        }
      }
    }
  }

  /** Best matching park fee for term — stamped lots first, else meta flat. */
  parkUseFee(term: ParkTerm): number {
    let best = 0
    for (const kind of ['park_g', 'park_u', 'park_l', 'park_s'] as const) {
      for (const p of tilesOf(this.tiles, kind)) {
        if ((this.parkTerms[`${p.c},${p.r}`] ?? 'short') !== term) continue
        best = Math.max(best, PARK_USE_FEE[kind][term])
      }
    }
    if (best > 0) return best
    if (term === 'short' && this.carParkShort) return PARK_SHORT_FEE
    if (term === 'long' && this.carParkLong) return PARK_LONG_FEE
    return term === 'short' ? PARK_SHORT_FEE : PARK_LONG_FEE
  }

  /** Hotel night fee — premium/business prefer resort beds when present. */
  hotelUseFee(tag: PaxTag): number {
    const classes = tilesOf(this.tiles, 'hotel').map(
      (p) => this.hotelClass[`${p.c},${p.r}`] ?? 'business',
    )
    if (classes.length) {
      if (tagSpendsUp(tag) && classes.includes('resort')) return HOTEL_CLASS_FEE.resort
      if (tag === 'family' && classes.includes('inn')) return HOTEL_CLASS_FEE.inn
      if (classes.includes('business')) return HOTEL_CLASS_FEE.business
      if (classes.includes('inn')) return HOTEL_CLASS_FEE.inn
      if (classes.includes('resort')) return HOTEL_CLASS_FEE.resort
    }
    if (this.hotelLevel > 0) return HOTEL_NIGHT_FEE
    return HOTEL_CLASS_FEE.business
  }

  /** Site pax mult with hotel / rail / car park / bus landside boosts. */
  landsidePaxMult(): number {
    const base = this.site ? LAND[this.site].paxMult : 1
    let m = base
    if (this.railLinked) m *= 1.06
    if (this.hasRailStation()) m *= 1.1
    if (this.hasBusCurb()) m *= 1.05
    if (this.hotelLevel >= 1) m *= 1.06
    if (this.hotelLevel >= 2) m *= 1.05
    if (this.carParkShort || this.hasShortParking()) m *= 1.03
    if (this.carParkLong || this.hasLongParking()) m *= 1.04
    const hotels = tilesOf(this.tiles, 'hotel').length
    if (hotels) m *= 1 + Math.min(0.18, hotels * 0.05)
    const parks =
      tilesOf(this.tiles, 'park_s').length +
      tilesOf(this.tiles, 'park_l').length +
      tilesOf(this.tiles, 'park_g').length +
      tilesOf(this.tiles, 'park_u').length
    if (parks) m *= 1 + Math.min(0.16, parks * 0.03)
    // Thin landside — city pax stay home.
    if (!this.hasBusCurb() && !this.hasRailStation() && !this.hasShortParking() && !this.hasHotelBeds()) {
      m *= 0.92
    }
    return m
  }

  /**
   * Fixed landside + hall-amenity operating expense / payroll tick.
   * Billed in full whether used or idle — empty stamps bleed cash.
   */
  landsideUpkeep(): number {
    let n = HOTEL_META_EXPENSE[clamp(this.hotelLevel, 0, 2)] ?? 0
    if (this.carParkShort) n += CARPARK_META_EXPENSE_SHORT
    if (this.carParkLong) n += CARPARK_META_EXPENSE_LONG
    for (const p of tilesOf(this.tiles, 'hotel')) {
      const cls = this.hotelClass[`${p.c},${p.r}`] ?? 'business'
      n += HOTEL_CLASS_EXPENSE[cls]
    }
    for (const kind of ['park_s', 'park_l', 'park_g', 'park_u'] as const) {
      for (const p of tilesOf(this.tiles, kind)) {
        const term = this.parkTerms[`${p.c},${p.r}`] ?? 'short'
        n += PARK_EXPENSE[kind][term]
      }
    }
    n += tilesOf(this.tiles, 'bus').length * BUS_EXPENSE
    if (this.hasRailStation()) n += tilesOf(this.tiles, 'rail').length * RAIL_EXPENSE
    // Hall amenities — furnished but empty still costs lights/staff.
    for (const fit of this.fits) {
      for (const [room, rate] of Object.entries(HALL_AMENITY_EXPENSE) as Array<
        [keyof typeof HALL_AMENITY_EXPENSE, number]
      >) {
        const count = fit.rooms[room] ?? 0
        if (count > 0) n += rate * Math.min(3, count)
      }
      n += ceilingsFor({
        premade: fit.premade,
        redesigned: fit.redesigned,
        tier: fit.tier,
        items: (fit.items ?? []) as PlacedItem[],
        roomsSecurity: fit.rooms.security,
      }).upkeepDay / 6
    }
    return Math.round(n)
  }

  /** @deprecated alias — expense is the only "potential" now. */
  landsidePotential(): number {
    return this.landsideUpkeep()
  }

  /** Beds / stalls capacity for usage meters (HUD). */
  landsideCapacity(): number {
    let beds = this.hotelLevel > 0 ? 6 : 0
    for (const p of tilesOf(this.tiles, 'hotel')) {
      const cls = this.hotelClass[`${p.c},${p.r}`] ?? 'business'
      beds += cls === 'inn' ? 5 : cls === 'resort' ? 12 : 8
    }
    return Math.max(
      1,
      beds +
        tilesOf(this.tiles, 'park_s').length * 3 +
        tilesOf(this.tiles, 'park_l').length * 5 +
        tilesOf(this.tiles, 'park_g').length * 7 +
        tilesOf(this.tiles, 'park_u').length * 6 +
        tilesOf(this.tiles, 'bus').length * 4 +
        (this.hasRailStation() ? tilesOf(this.tiles, 'rail').length * 6 : 0) +
        (this.carParkShort || this.carParkLong ? 4 : 0),
    )
  }

  /**
   * Passenger fees collected this payroll window — not sticker income.
   * Place alone pays $0; pax using hotels/lots/bus/rail fill this.
   */
  landsideIncome(): number {
    return Math.round(this.landsideFeeWindow)
  }

  /** 0–1+ fill rate for HUD (uses / capacity). */
  landsideUsageRate(): number {
    return clamp(this.landsideUses / this.landsideCapacity(), 0, 1.5)
  }

  noteLandsideUse(n = 1) {
    this.landsideUses += n
  }

  runwayStripCount(): number {
    return runwayStrips(this.tiles, MIN_RUNWAY).length
  }

  canIpo(): { ok: boolean; why: string } {
    if (this.public) return { ok: false, why: 'Already listed.' }
    if (this.flightsDone < IPO_MIN_FLIGHTS) {
      return { ok: false, why: `Need ${IPO_MIN_FLIGHTS} completed turns first.` }
    }
    if (this.reputation < IPO_MIN_REP) {
      return { ok: false, why: `Need reputation ${IPO_MIN_REP}+.` }
    }
    if (this.cash < IPO_MIN_CASH + IPO_LISTING_FEE) {
      return { ok: false, why: `Need ~${moneyLeft(IPO_MIN_CASH + IPO_LISTING_FEE)} on hand.` }
    }
    if (this.signed.length < 1) return { ok: false, why: 'Sign at least one airline.' }
    return { ok: true, why: 'Ready to list.' }
  }

  fairSharePrice(): number {
    const heavy = this.hasHeavyRunway() ? 5 : 0
    const pad = tilesOf(this.tiles, 'helipad').length ? 1.5 : 0
    const wearHit = this.maxWear() * 0.04
    const pavement = (this.runwayCondition - 50) * 0.04
    const mxDesk = this.mxSigned.length * 2 + this.mechanics * 0.8
    const base =
      8 +
      this.reputation * 0.35 +
      this.signed.length * 4 +
      this.flightsDone * 0.4 +
      (this.railLinked ? 3 : 0) +
      this.parcels * 1.5 +
      heavy +
      pad +
      pavement +
      mxDesk -
      wearHit -
      this.securityIncidents * 2.5 -
      (this.loanBalance > 0 ? 4 : 0)
    return Math.max(2, Math.round(base * 100) / 100)
  }

  hasHeavyRunway(): boolean {
    return runwayStrips(this.tiles, HEAVY_RUNWAY_LEN).length > 0
  }

  /** Longest continuous runway strip in cells — gates real airframes. */
  longestRunway(): number {
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    if (!strips.length) return 0
    return Math.max(...strips.map((s) => s.length))
  }

  stripTierLabel(): string {
    const t = stripTier(this.longestRunway())
    if (t === 'none') return 'No strip'
    if (t === 'short') return 'Short'
    if (t === 'regional') return 'Regional'
    return 'Heavy'
  }

  /** What real named metal this strip can / can't take. */
  stripCapabilityLine(): string {
    const n = this.longestRunway()
    if (n <= 0) return 'Stamp a strip — short / regional / heavy'
    const ok = jetAirframesFitting(n, this.researchUnlocked)
    const no = jetAirframesBlocked(n, this.researchUnlocked)
    const okNames = ok
      .slice()
      .sort((a, b) => a.minRunway - b.minRunway)
      .slice(0, 4)
      .map((a) => a.name)
    const noNames = no
      .slice()
      .sort((a, b) => a.minRunway - b.minRunway)
      .slice(0, 3)
      .map((a) => a.name)
    if (!no.length) {
      return `${this.stripTierLabel()} ${n}c · takes everything (incl. 747-8F / A350)`
    }
    return `${this.stripTierLabel()} ${n}c · OK: ${okNames.join(', ')}${
      ok.length > 4 ? '…' : ''
    } · blocked: ${noNames.join(', ')}${no.length > 3 ? '…' : ''}`
  }

  maxWear(): number {
    let m = 0
    for (const f of this.fits) {
      m = Math.max(m, f.wearBath ?? 0, f.wearSec ?? 0)
    }
    return m
  }

  avgWear(): { bath: number; sec: number } {
    if (!this.fits.length) return { bath: 0, sec: 0 }
    let bath = 0
    let sec = 0
    for (const f of this.fits) {
      bath += f.wearBath ?? 0
      sec += f.wearSec ?? 0
    }
    return { bath: bath / this.fits.length, sec: sec / this.fits.length }
  }

  goPublic() {
    const gate = this.canIpo()
    if (!gate.ok) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    if (!this.spend(IPO_LISTING_FEE, 'IPO listing')) return
    const price = this.fairSharePrice()
    const float = IPO_SHARES - IPO_FOUNDER_SHARES
    const raise = Math.round(float * price)
    this.public = true
    this.sharePrice = price
    this.ipoPrice = price
    this.sharesOwned = IPO_FOUNDER_SHARES
    this.sharesFloat = float
    this.cash += raise
    this.reputation = Math.min(100, this.reputation + 6)
    this.pushNews(
      `HATCH lists at $${price.toFixed(2)}. Raised ${moneyLeft(raise)}. You keep ${IPO_FOUNDER_SHARES} shares — the street owns the rest. Protect security or the ticker dies.`,
      'good',
    )
    this.startMission('earnings_beat')
    this.emit()
  }

  buyShares(n = 10) {
    if (!this.public) {
      this.pushNews('IPO first.', 'bad')
      return
    }
    const qty = Math.min(n, this.sharesFloat)
    if (qty <= 0) {
      this.pushNews('No float left to buy.', 'bad')
      return
    }
    const cost = Math.round(qty * this.sharePrice)
    if (!this.spend(cost, 'share buyback')) return
    this.sharesOwned += qty
    this.sharesFloat -= qty
    this.sharePrice = Math.round((this.sharePrice * 1.02) * 100) / 100
    this.pushNews(`Bought ${qty} shares @ $${this.sharePrice.toFixed(2)}.`, 'ok')
    this.emit()
  }

  sellShares(n = 10) {
    if (!this.public) return
    const qty = Math.min(n, this.sharesOwned)
    if (qty <= 0) {
      this.pushNews('No shares to sell.', 'bad')
      return
    }
    const gain = Math.round(qty * this.sharePrice)
    this.sharesOwned -= qty
    this.sharesFloat += qty
    this.cash += gain
    this.sharePrice = Math.max(2, Math.round((this.sharePrice * 0.97) * 100) / 100)
    this.pushNews(`Sold ${qty} shares for ${moneyLeft(gain)}.`, 'ok')
    this.emit()
  }

  startMission(id: MarketMission['id']) {
    const table: Record<MarketMission['id'], Omit<MarketMission, 'id' | 'progress'>> = {
      secure_the_line: {
        title: 'Secure the line',
        blurb: 'Board wants security level 3 before the next earnings call.',
        deadline: 120,
        goal: 'security3',
        target: 3,
        rewardCash: 8000,
        rewardRep: 5,
      },
      earnings_beat: {
        title: 'Beat the street',
        blurb: 'Post $25,000 more revenue while listed — or the stock drifts.',
        deadline: 150,
        goal: 'revenueBurst',
        target: 25000,
        rewardCash: 5000,
        rewardRep: 4,
      },
      calm_the_board: {
        title: 'Calm the board',
        blurb: 'Push reputation back to 60 after the scare.',
        deadline: 100,
        goal: 'rep60',
        target: 60,
        rewardCash: 6000,
        rewardRep: 6,
      },
      restore_trust: {
        title: 'Restore trust',
        blurb: 'Zero new security incidents for a stretch. Prove the hall is clean.',
        deadline: 90,
        goal: 'noIncident',
        target: 90,
        rewardCash: 10000,
        rewardRep: 8,
      },
      heavy_ready: {
        title: 'Widebody ready',
        blurb: 'Stamp a heavy strip (20×3) so Summit / EXFED can land — street wants scale.',
        deadline: 160,
        goal: 'heavyRunway',
        target: 1,
        rewardCash: 12000,
        rewardRep: 6,
      },
      scrub_the_hall: {
        title: 'Scrub the hall',
        blurb: 'Budget crowds trashed WC and lanes. Scrub wear so cleanliness hits 80+.',
        deadline: 100,
        goal: 'lowWear',
        target: 80,
        rewardCash: 7000,
        rewardRep: 5,
      },
    }
    const m = table[id]
    this.mission = { id, progress: 0, ...m }
    this.revenueWindow = this.revenue
    this.pushNews(`Market mission: ${m.title}. ${m.blurb}`, 'ok')
  }

  shockStock(reason: string, mult: number, fine: number) {
    if (!this.public) {
      this.charge(fine)
      this.pushNews(reason, 'bad')
      return
    }
    const before = this.sharePrice
    this.sharePrice = Math.max(1.5, Math.round(this.sharePrice * mult * 100) / 100)
    this.charge(fine)
    this.reputation = Math.max(0, this.reputation - 10)
    const paper = Math.round((this.sharePrice - before) * this.sharesOwned)
    this.pushNews(
      `${reason} HATCH $${before.toFixed(2)} → $${this.sharePrice.toFixed(2)} (${paper < 0 ? '' : '+'}${moneyLeft(paper)} on your stake). Fine ${moneyLeft(fine)}.`,
      'bad',
    )
    this.startMission(mult < 0.7 ? 'restore_trust' : 'secure_the_line')
  }

  tickMarket(dt: number) {
    if (!this.public) return
    this.marketCool -= dt
    // Gentle drift toward fair value
    if (this.marketCool <= 0) {
      this.marketCool = 6 + Math.random() * 4
      const fair = this.fairSharePrice()
      this.sharePrice = Math.round((this.sharePrice * 0.85 + fair * 0.15) * 100) / 100
      // Random retail flow
      if (Math.random() < 0.35 && this.sharesFloat > 5) {
        const n = 3 + Math.floor(Math.random() * 8)
        const buy = Math.random() < 0.55
        if (buy) {
          const qty = Math.min(n, this.sharesFloat)
          this.sharesFloat -= qty
          // street buys from float — price up, founder stake unchanged
          this.sharePrice = Math.round((this.sharePrice * 1.015) * 100) / 100
        } else if (this.sharesOwned > IPO_FOUNDER_SHARES * 0.3) {
          /* ignore — only founder sells manually */
          this.sharePrice = Math.max(2, Math.round((this.sharePrice * 0.99) * 100) / 100)
        }
      }
    }

    this.tickAnalyst(dt)

    if (!this.mission) return
    const m = this.mission
    m.deadline -= dt
    if (m.goal === 'security3') m.progress = this.securityLevel()
    if (m.goal === 'revenueBurst') m.progress = Math.max(0, this.revenue - this.revenueWindow)
    if (m.goal === 'rep60') m.progress = this.reputation
    if (m.goal === 'noIncident') m.progress += dt
    if (m.goal === 'heavyRunway') m.progress = this.hasHeavyRunway() ? 1 : 0
    if (m.goal === 'lowWear') m.progress = Math.max(0, 100 - this.maxWear())

    if (m.progress >= m.target) {
      this.cash += m.rewardCash
      this.noteIncome(m.rewardCash, 'task_rewards')
      this.reputation = Math.min(100, this.reputation + m.rewardRep)
      this.sharePrice = Math.round((this.sharePrice * 1.08) * 100) / 100
      this.pushNews(
        `Mission cleared: ${m.title}. +${moneyLeft(m.rewardCash)}, stock pops to $${this.sharePrice.toFixed(2)}.`,
        'good',
      )
      this.mission = null
      return
    }
    if (m.deadline <= 0) {
      this.sharePrice = Math.max(1.5, Math.round((this.sharePrice * 0.88) * 100) / 100)
      this.reputation = Math.max(0, this.reputation - 4)
      this.pushNews(`Mission failed: ${m.title}. Stock slips to $${this.sharePrice.toFixed(2)}.`, 'bad')
      this.mission = null
    }
  }

  /** Public-market flavor crises beyond security bombs. */
  tickAnalyst(dt: number) {
    if (!this.public) return
    this.analystCool -= dt
    if (this.analystCool > 0) return
    this.analystCool = 45 + Math.random() * 50
    if (this.mission) return

    const wear = this.maxWear()
    const roll = Math.random()

    if (wear >= 55 && roll < 0.35) {
      this.shockStock(
        'TRAVEL BLOG EXPOSÉ — filthy restrooms and sticky security lanes go viral.',
        0.72,
        6500,
      )
      this.startMission('scrub_the_hall')
      return
    }
    if (!this.hasHeavyRunway() && this.signed.some((id) => this.airline(id).kind === 'pax') && roll < 0.28) {
      this.sharePrice = Math.max(2, Math.round((this.sharePrice * 0.93) * 100) / 100)
      this.pushNews(
        `Analyst note: “Regional strip caps growth.” HATCH $${this.sharePrice.toFixed(2)}. Stamp a heavy runway.`,
        'bad',
      )
      this.startMission('heavy_ready')
      return
    }
    if (this.reputation < 45 && roll < 0.3) {
      this.shockStock('Downgrade — soft reputation, soft ticket.', 0.88, 4000)
      this.startMission('calm_the_board')
      return
    }
    if (this.fuelLoads <= 1 && this.fuelBrand && roll < 0.25) {
      const spike = 3500 + Math.floor(Math.random() * 2500)
      this.charge(spike)
      this.sharePrice = Math.max(2, Math.round((this.sharePrice * 0.94) * 100) / 100)
      this.pushNews(
        `Jet-A spike hits the tape. Spot buy ${moneyLeft(spike)}. HATCH $${this.sharePrice.toFixed(2)}.`,
        'bad',
      )
      return
    }
    if (roll < 0.18) {
      // Short rumor — paper cut, no mission
      this.sharePrice = Math.max(2, Math.round((this.sharePrice * 0.96) * 100) / 100)
      this.pushNews(
        `Short seller rumor on the wire. HATCH dips to $${this.sharePrice.toFixed(2)}.`,
        'bad',
      )
      return
    }
    if (roll < 0.3 && this.railLinked && this.reputation >= 60) {
      this.sharePrice = Math.round((this.sharePrice * 1.04) * 100) / 100
      this.pushNews(
        `Upgrade: “Rail + clean ops.” HATCH $${this.sharePrice.toFixed(2)}.`,
        'good',
      )
    }
  }

  persist() {
    if (!this.site) return
    const snap: GameSnapshot = {
      tiles: this.tiles,
      terminalFits: this.fits,
      cash: this.cash,
      branding: serializeBranding(this.branding),
      difficulty: this.difficulty,
      site: this.site,
      clock: this.clock,
      speed: this.speed,
      fuelBrand: this.fuelBrand,
      fuelLoads: this.fuelLoads,
      foodShelf: this.foodShelf,
      shopShelf: this.shopShelf,
      lostSpend: this.lostSpend,
      bagsLost: this.bagsLost,
      bagsMishandled: this.bagsMishandled,
      caterBrand: this.caterBrand,
      mealSold: this.mealSold,
      signed: this.signed,
      flightsDone: this.flightsDone,
      paxServed: this.paxServed,
      revenue: this.revenue,
      securityIncidents: this.securityIncidents,
      reputation: this.reputation,
      loanBalance: this.loanBalance,
      loanProductId: this.loanProductId,
      loanPrincipal: this.loanPrincipal,
      loanOpened: this.loanOpened,
      fieldXp: this.fieldXp,
      parcels: this.parcels,
      railLinked: this.railLinked,
      hotelLevel: this.hotelLevel,
      carParkShort: this.carParkShort,
      carParkLong: this.carParkLong,
      parkTerms: this.parkTerms,
      hotelClass: this.hotelClass,
      standClass: this.standClass,
      standAccess: this.standAccess,
      janitors: this.janitors,
      researchers: this.researchers,
      deskStaff: this.deskStaff,
      public: this.public,
      sharePrice: this.sharePrice,
      sharesOwned: this.sharesOwned,
      sharesFloat: this.sharesFloat,
      budgets: this.budgets,
      mechanics: this.mechanics,
      mxSigned: this.mxSigned,
      runwayCondition: this.runwayCondition,
      weather: this.weather,
      milAgreement: this.milAgreement,
      extraAirlines: this.extraAirlines,
      airlineHeat: this.airlineHeat,
      airlineBanUntil: this.airlineBanUntil,
      layover: this.layover,
      schedule: this.schedule.filter((s) => s.status === 'scheduled' || s.status === 'delayed'),
      scheduleAuto: this.scheduleAuto,
      airlineReward: this.airlineReward,
      airlineWarned: this.airlineWarned,
      researchPoints: this.researchPoints,
      researchUnlocked: this.researchUnlocked,
      hubAirlines: this.hubAirlines,
      layoverWins: this.layoverWins,
      coachDismissed: this.coachDismissed,
      fieldTask: this.fieldTask,
      cargoWarehouse: this.cargoWarehouse,
      cargoVolume: this.cargoVolume,
      startFocus: this.startFocus,
      sandbox: this.sandbox,
      sites: this.sites,
      diplomacy: this.diplomacy?.save(),
      diplomacySeed: this.diplomacySeed,
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snap))
    } catch {
      /* ignore */
    }
  }

  static hasSave(): boolean {
    return Boolean(localStorage.getItem(SAVE_KEY))
  }

  load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    try {
      const s = JSON.parse(raw) as GameSnapshot
      this.tiles = s.tiles
      this.fits = (s.terminalFits ?? []).map((f) => {
        const rooms = { ...emptyRooms(), ...(f.rooms ?? {}) }
        const claimRooms = Math.max(1, rooms.bagclaim || (f.premade ? 1 : 0))
        return decorateFit({
          ...f,
          rooms,
          wearBath: f.wearBath ?? 0,
          wearSec: f.wearSec ?? 0,
          claimRate:
            f.claimRate ?? (f.premade ? 0.72 + claimRooms * 0.08 : 0.9 + claimRooms * 0.12),
        })
      })
      this.cash = s.cash
      this.branding = (typeof s.branding === 'string' && deserializeBranding(s.branding)) || defaultBranding()
      this.difficulty = s.difficulty
      this.site = s.site
      this.clock = s.clock
      this.payrollDay = Math.floor(Math.max(0, s.clock) / 180)
      this.levyMark = s.clock
      this.bank = new Bank(0)
      this.simClock = new SimClock({ simMinutes: Math.max(0, s.clock) * SIM_MINUTES_PER_REAL_SECOND })
      this.economy = null
      this.economyState = null
      this.economyView = null
      this.speed = 0
      this.fuelBrand = s.fuelBrand
      this.fuelLoads = s.fuelLoads
      this.foodShelf = s.foodShelf ?? this.shelfCap('food')
      this.shopShelf = s.shopShelf ?? this.shelfCap('shop')
      this.lostSpend = s.lostSpend ?? 0
      this.bagsLost = s.bagsLost ?? 0
      this.bagsMishandled = s.bagsMishandled ?? 0
      this.bagBooks.clear()
      this.bagTags = []
      this.bagShow = null
      this.caterBrand = s.caterBrand ?? null
      this.mealSold = s.mealSold
      this.signed = s.signed ?? []
      this.flightsDone = s.flightsDone
      this.paxServed = s.paxServed
      this.revenue = s.revenue
      this.securityIncidents = s.securityIncidents ?? 0
      this.reputation = s.reputation ?? 40
      this.loanBalance = s.loanBalance ?? 0
      this.loanProductId = s.loanProductId ?? (this.loanBalance > 0 ? 'bridge' : null)
      this.loanPrincipal = s.loanPrincipal ?? (this.loanBalance > 0 ? LOAN_PRINCIPAL : 0)
      this.loanOpened =
        s.loanOpened ??
        (this.loanBalance > 0 ? LOAN_PRINCIPAL + LOAN_FEE : 0)
      this.fieldXp = s.fieldXp ?? Math.min(700, this.flightsDone * 8 + this.signed.length * 20)
      this.extraAirlines = (s.extraAirlines ?? []).map((a) => normalizeAirline(a as Airline))
      this.parcels = s.parcels ?? 1
      this.railLinked = s.railLinked ?? false
      this.hotelLevel = s.hotelLevel ?? 0
      this.carParkShort = s.carParkShort ?? false
      this.carParkLong = s.carParkLong ?? false
      this.parkTerms = s.parkTerms ?? {}
      this.hotelClass = s.hotelClass ?? {}
      // Migrate bare hotel tiles from older saves → business grade.
      for (const p of tilesOf(this.tiles, 'hotel')) {
        const k = `${p.c},${p.r}`
        if (!this.hotelClass[k]) this.hotelClass[k] = 'business'
      }
      this.standClass = s.standClass ?? {}
      this.standAccess = s.standAccess ?? {}
      this.standAccessMode = 'remote'
      this.janitors = s.janitors ?? 0
      this.researchers = s.researchers ?? 0
      this.deskStaff = s.deskStaff ?? 0
      this.hallStaff = []
      this.public = s.public ?? false
      this.sharePrice = s.sharePrice ?? 0
      this.sharesOwned = s.sharesOwned ?? 0
      this.sharesFloat = s.sharesFloat ?? 0
      this.ipoPrice = this.sharePrice
      this.budgets = { ...DEFAULT_BUDGETS, ...(s.budgets ?? {}) }
      this.mechanics = s.mechanics ?? 0
      this.mxSigned = s.mxSigned ?? []
      this.runwayCondition = s.runwayCondition ?? 100
      this.weather = s.weather ?? 'clear'
      this.milAgreement = s.milAgreement ?? false
      this.airlineHeat = s.airlineHeat ?? {}
      this.airlineBanUntil = s.airlineBanUntil ?? {}
      this.airlineReward = s.airlineReward ?? {}
      this.airlineWarned = s.airlineWarned ?? {}
      this.airlineLowAcc = {}
      this.researchPoints = s.researchPoints ?? 0
      this.researchUnlocked = s.researchUnlocked ?? []
      this.hubAirlines = s.hubAirlines ?? []
      this.layoverWins = s.layoverWins ?? {}
      this.coachDismissed = s.coachDismissed ?? this.flightsDone >= 1
      this.firstTakeoffNoted = this.flightsDone >= 1
      this.fieldTask = s.fieldTask ?? null
      this.fieldTaskCool = this.fieldTask ? 0 : 18
      this.nightCurfewCool = 0
      this.hubOffer = null
      this.hubOfferCool = 40
      this.layover = s.layover ?? null
      this.layoverOffer = null
      this.layoverOfferCool = 20
      this.layoverSpawnAcc = 0
      this.schedule = (s.schedule ?? []).map((slot) => ({
        ...slot,
        status: slot.status === 'inbound' ? 'scheduled' : slot.status,
        flightId: null,
      }))
      this.scheduleAuto = s.scheduleAuto ?? true
      this.schedulePlanCool = 6
      this.cargoWarehouse = s.cargoWarehouse ?? 0
      this.cityCargoCool = 6
      this.startFocus = s.startFocus ?? (s.site === 'factory' ? 'cargo' : 'pax')
      this.sandbox = s.sandbox ?? true
      this.sites = s.sites ?? []
      this.diplomacy = null
      this.diplomacySeed = s.diplomacySeed ?? 1
      if (s.diplomacy) this.ensureDiplomacy().load(s.diplomacy)
      this.cargoVolume = s.cargoVolume ?? null
      this.cargoVolumeCool = this.cargoVolume ? 0 : 25
      this.loanNewsCool = 0
      this.mission = null
      this.mxOffer = null
      this.pendingThreat = null
      this.pendingEmergency = null
      this.emergencyCool = 45
      this.analystCool = 40
      this.flights = []
      this.trucks = []
      this.people = []
      this.hallGuests = []
      this.offer = null
      this.view = 'apron'
      this.bumpMap()
      this.pushNews('Field restored. Clock paused.', 'ok')
      this.emit()
      return Boolean(this.site)
    } catch {
      return false
    }
  }

  pushNews(text: string, tone: News['tone']) {
    this.news.unshift({ id: uid('n'), text, tone, age: 0 })
    this.news = this.news.slice(0, 10)
  }

  tile(v: Vec): Tile | null {
    if (!inBounds(v.c, v.r)) return null
    return this.tiles[v.r][v.c]
  }

  /** Call after any apron tile or stand/park/hotel class stamp changes. */
  bumpMap() {
    this.mapRev += 1
  }

  spend(amount: number, label: string): boolean {
    if (this.sandbox) {
      if (this.cash < SANDBOX_CASH * 0.5) this.cash = SANDBOX_CASH
      return true
    }
    if (this.cash < amount) {
      this.pushNews(`Need ${label} — short ${Math.round(amount - this.cash)}.`, 'bad')
      this.emit()
      return false
    }
    this.cash -= amount
    return true
  }

  /** Fines / interest — may go into debt, but floors so the tape can't spiral forever. */
  charge(amount: number) {
    if (this.sandbox) return
    this.noteExpense(amount)
    this.cash -= amount
    if (this.cash < -25_000) this.cash = -25_000
  }

  noteIncome(amount: number, category: MoneyCategory = 'landing_fees') {
    if (!(amount > 0)) return
    this.hourIncome += amount
    this.postJournal(category, amount, this.simMinutes())
  }

  /** Sim minutes on the shared clock. One field second is eight game minutes. */
  simMinutes(): number {
    return Math.max(0, this.clock) * SIM_MINUTES_PER_REAL_SECOND
  }

  /**
   * Measures the open hall as a flow graph. Passengers stay on the hall graph;
   * this audit does not mark anyone lost or any bag mishandled.
   */
  flowAudit() {
    const graph = new FlowGraph()
    const rooms = this.fits[0]?.rooms
    const zones: TerminalZone[] = [
      { id: 'curb', kind: 'curb', servers: 2, ratePerServer: 30, queueCapacity: 40 },
      { id: 'checkin', kind: 'checkin', servers: Math.max(1, rooms?.checkin ?? 1), ratePerServer: 1.5, queueCapacity: 30 },
      { id: 'security', kind: 'security', servers: Math.max(1, rooms?.security ?? 1), ratePerServer: 20, queueCapacity: 40 },
      { id: 'gate', kind: 'gate', servers: Math.max(1, rooms?.gate ?? 1), ratePerServer: 12, queueCapacity: 80 },
      { id: 'claim', kind: 'claim', servers: Math.max(1, rooms?.bagclaim ?? 1), ratePerServer: 10, queueCapacity: 40 },
      { id: 'exit', kind: 'exit', servers: 2, ratePerServer: 30, queueCapacity: 20 },
    ]
    registerTerminal(graph, zones)
    graph.tick(1)
    return audit(graph)
  }

  private tickAmbience(dt: number) {
    if (typeof window === 'undefined' || !(dt > 0)) return
    const parked = this.flights.filter((f) => f.phase === 'parked' || f.phase === 'board' || f.phase === 'deboard').length
    this.ensureAmbience().update(
      {
        checkinOccupancy: Math.min(1, this.hallGuests.length / 40),
        walkingWithBagsOccupancy: Math.min(1, this.people.length / 40),
        securityLanesOpen: Math.max(1, this.fits[0]?.rooms.security ?? 0),
        securityThroughputPerMin: this.securityQueueCount(),
        apusRunning: parked,
        gpusConnected: this.flights.filter((f) => f.phase === 'parked').length,
        beltLoadersRunning: this.trucks.filter((t) => t.kind === 'bags').length,
        fuelPumpsRunning: this.trucks.filter((t) => t.kind === 'fuel').length,
        outdoorMix: this.view === 'hall' ? 0.1 : 0.85,
      },
      dt,
    )
  }

  private ensureAmbience(): AmbienceMixer {
    if (!this.ambience) {
      const audio = getAudio()
      this.ambience = new AmbienceMixer({
        playSfx: (id, options) => audio.playSfx(id, options),
      })
    }
    return this.ambience
  }

  /** Latest economy snapshot for the HUD. Null until the first tick. */
  economySnapshot(): EconomySnapshot | null {
    return this.economyView
  }

  private groundIncomeCategory(category: string): MoneyCategory {
    if (category === 'fuel_sales') return 'fuel_sales'
    if (category === 'catering_fees') return 'catering_fees'
    if (category === 'shop_sales') return 'retail_sales'
    if (category === 'cargo_airport_revenue') return 'cargo_fees'
    if (category === 'baggage_fees') return 'baggage_fees'
    return 'landing_fees'
  }

  private postJournal(category: MoneyCategory, magnitude: number, simMinutes: number) {
    if (!(magnitude > 0) || !Number.isFinite(magnitude)) return
    const signed = moneyDirection(category) === 'income' ? magnitude : -magnitude
    this.bank.post(category, signed, { simMinutes: Math.max(0, simMinutes), source: 'sim' })
  }

  noteExpense(amount: number) {
    if (amount > 0) this.hourExpense += amount
  }

  /** Pax and freight cleared when a turnaround finishes — feeds the day charts. */
  noteTurn(f: Flight) {
    if (!(f.cargo || f.kind === 'freighter')) this.dayPax += Math.max(0, f.pax)
    if (f.cargo || f.kind === 'freighter') {
      const hold = AIRFRAMES[f.airframeId]?.cargoHold
      this.dayCargo += hold && hold > 0 ? hold : Math.max(8, f.pax || 16)
    }
  }

  /** Hourly book for the economy charts. One in-game hour is 7.5 sim-seconds. */
  sampleEconomy(step: number) {
    const hour = 7.5
    const day = 180
    this.econHour += step
    let paxSnap = this.dayPax
    let cargoSnap = this.dayCargo
    if (this.clock - this.dayMark >= day) {
      this.paxPerDay = this.dayPax
      this.cargoPerDay = this.dayCargo
      paxSnap = this.paxPerDay
      cargoSnap = this.cargoPerDay
      this.dayPax = 0
      this.dayCargo = 0
      this.dayMark = this.clock
    }
    if (this.econHour < hour) return
    this.incomePerHour = Math.round(this.hourIncome)
    this.econHist.push({
      t: this.clock,
      cash: Math.round(this.cash),
      income: Math.round(this.hourIncome),
      expense: Math.round(this.hourExpense),
      pax: paxSnap,
      cargo: cargoSnap,
    })
    if (this.econHist.length > 96) this.econHist.shift()
    this.hourIncome = 0
    this.hourExpense = 0
    // Keep the leftover so one long tick does not invent an empty hour that reads $0/hr.
    this.econHour -= hour
    if (this.econHour >= hour) this.econHour = hour - 0.001
  }

  /**
   * Hourly figure for the HUD. A single quiet hour must not hide earnings
   * already in the book, and an open hour shows as soon as cash is earned.
   */
  incomeRate(): number {
    const recent = this.econHist.slice(-6).map((row) => row.income)
    if (this.econHour > 0 || this.hourIncome > 0) recent.push(Math.round(this.hourIncome))
    if (!recent.length) return this.incomePerHour
    const earned = recent.filter((n) => n > 0)
    const pool = earned.length ? earned : recent
    return Math.round(pool.reduce((sum, n) => sum + n, 0) / pool.length)
  }

  earn(amount: number, label: string, flight?: Flight) {
    this.cash += amount
    this.revenue += amount
    this.noteIncome(amount)
    if (flight) flight.ledger.push({ label, amount })
    this.pushNews(`${label}  +$${amount.toLocaleString('en-US')}`, 'good')
  }

  setTool(tool: Tool) {
    // Outdoor stamps only work on the apron — kick you outside smoothly.
    if (
      this.view === 'hall' &&
      tool !== 'pan' &&
      tool !== 'premade' &&
      tool !== 'terminal'
    ) {
      this.view = 'apron'
    }
    this.tool = tool
    this.runwayStart = null
    this.emit()
  }

  rotatePiece() {
    this.facing = this.facing === 'h' ? 'v' : 'h'
    this.emit()
  }

  setSpeed(speed: Speed) {
    this.speed = speed
    // Fast-forward: drop hover inspect so the detail card never pops up at 5x.
    if (speed >= 5) {
      this.hoverInspect = null
    }
    this.emit()
  }

  /** Detail cards / hover inspect stay off during 5x fast-forward. */
  inspectEnabled(): boolean {
    return this.speed < 5
  }

  setView(view: 'apron' | 'hall') {
    if (view === 'hall' && !this.fits.length) {
      this.pushNews('Stamp a Premade hall or empty Shell outside first.', 'bad')
      this.emit()
      return
    }
    const prev = this.view
    this.view = view
    if (view === 'hall') {
      this.tool = 'pan'
      if (prev !== 'hall') {
        this.pushNews(
          'Inside the terminal — prefab ceilings are on the card. Paint a zone or upgrade the shell. Esc / Apron to leave.',
          'ok',
        )
      }
    } else if (prev !== 'apron') {
      this.pushNews('Back on the apron — build runways, stands, and outside kit here.', 'ok')
    }
    this.emit()
  }

  /** Pan-click a terminal tile to walk inside. */
  enterHallAt(tile: Vec) {
    this.selectedTile = tile
    if (!this.fits.length) {
      this.pushNews('No furnished hall yet — stamp Premade or a Shell.', 'bad')
      this.emit()
      return
    }
    this.setView('hall')
  }

  exitHall() {
    if (this.view === 'hall') this.setView('apron')
  }

  selectGuest(id: string | null) {
    this.selectedGuest = id
    this.emit()
  }

  activeHall(): TerminalFit | null {
    if (this.fits.length === 0) return null
    const origin = this.selectedTerminalOrigin()
    if (origin) {
      const fit = this.fits.find((f) => f.origin.c === origin.c && f.origin.r === origin.r)
      if (fit) return fit
    }
    return this.fits[0]
  }

  hallKey(fit: TerminalFit): string {
    return `${fit.origin.c},${fit.origin.r}`
  }

  /** T1 / T2 labels in stamp order. */
  hallLabel(fit: TerminalFit): string {
    const i = this.fits.findIndex(
      (f) => f.origin.c === fit.origin.c && f.origin.r === fit.origin.r,
    )
    return `T${i >= 0 ? i + 1 : 1}`
  }

  fitByKey(key: string | undefined | null): TerminalFit | null {
    if (!key) return null
    return this.fits.find((f) => this.hallKey(f) === key) ?? null
  }

  hallOpenFor(fit: TerminalFit | null): Set<HallNode> {
    if (!fit) return new Set()
    return openNodesFromRooms(fit.rooms)
  }

  /** Claim belt clear speed — premade ceilings + overcrowding slow bags. */
  claimClearRate(fit: TerminalFit | null): number {
    const base = fit?.claimRate ?? 1
    const cap = fit?.capGuests ?? 40
    const key = fit ? this.hallKey(fit) : null
    const pop = key
      ? this.hallGuests.filter((g) => !g.dead && g.hallId === key).length
      : this.hallGuests.length
    const crowd = pop > cap ? 1 / (1 + (pop - cap) * 0.08) : 1
    const allow = fit?.bagAllowance ?? 9999
    let bagMul = 1
    if (allow > 0) {
      for (const f of this.flights) {
        if (f.cargo || !f.bagUnits || f.bagUnits <= allow) continue
        bagMul = Math.min(bagMul, allow / f.bagUnits)
      }
    }
    return 12 * base * crowd * bagMul
  }

  /** How many claim carousels a hall offers (inbound scheduling pool). */
  claimLaneCount(fit: TerminalFit | null): number {
    if (!fit) return 1
    return Math.max(1, fit.rooms.bagclaim || (fit.premade ? 1 : 0))
  }

  /**
   * Pick the least-loaded claim carousel, counting live arrivals + banked slots.
   * Only inbound pax need claim planning — cargo / GA skip.
   */
  pickClaimLane(excludeFlightId?: string | null, excludeSlotId?: string | null): number {
    const fit = this.activeHall() ?? this.fits[0] ?? null
    const n = this.claimLaneCount(fit)
    const loads = Array.from({ length: n }, () => 0)
    for (const other of this.flights) {
      if (other.id === excludeFlightId || other.cargo || other.ga || !other.claimLane) continue
      if (other.phase === 'gone' || other.phase === 'takeoff') continue
      const i = other.claimLane - 1
      if (i >= 0 && i < n) loads[i] += other.bagUnits ?? other.pax
    }
    for (const s of this.schedule) {
      if (s.id === excludeSlotId || !s.claimLane) continue
      if (s.status !== 'scheduled' && s.status !== 'delayed' && s.status !== 'inbound') continue
      if (this.airline(s.airline).kind === 'cargo') continue
      const i = s.claimLane - 1
      if (i >= 0 && i < n) loads[i] += 40
    }
    let best = 0
    for (let i = 1; i < n; i++) if (loads[i] < loads[best]) best = i
    return best + 1
  }

  /**
   * Assign a banked timetable slot its claim lane when the plane is scheduled.
   * Inbound-only — cargo slots stay null.
   */
  assignSlotClaimLane(slot: ScheduleSlot) {
    if (this.airline(slot.airline).kind === 'cargo') {
      slot.claimLane = null
      return
    }
    if (slot.claimLane != null && slot.claimLane > 0) return
    slot.claimLane = this.pickClaimLane(slot.flightId, slot.id)
  }

  /**
   * Assign an inbound flight to a baggage claim (uses slot plan if already banked).
   * Only arrivals need claim planning — load-balance across carousels.
   */
  assignClaimLane(f: Flight) {
    if (f.cargo || f.ga || (f.craft ?? 'jet') !== 'jet') return
    if (f.claimLane != null && f.claimLane > 0) {
      if (f.bagStage === 'idle' || !f.bagStage) f.bagStage = 'inflight'
      return
    }
    const slot = f.scheduleId
      ? this.schedule.find((s) => s.id === f.scheduleId)
      : null
    if (slot?.claimLane != null && slot.claimLane > 0) {
      f.claimLane = slot.claimLane
    } else {
      f.claimLane = this.pickClaimLane(f.id, slot?.id ?? null)
      if (slot) slot.claimLane = f.claimLane
    }
    if (f.bagStage === 'idle' || !f.bagStage) f.bagStage = 'inflight'
    if (Math.random() < 0.55) {
      this.pushNews(
        `${f.flightNo} → baggage claim ${f.claimLane} (${f.bagUnits ?? 0} bag units).`,
        'ok',
      )
    }
  }

  setBagStage(f: Flight, stage: BagFlowStage) {
    f.bagStage = stage
  }

  /** Deposited bags cover the flight's checked-bag count. */
  private outboundBagsFull(f: Flight): boolean {
    if (f.cargo) return true
    const need = f.bagUnits ?? 0
    if (need <= 0) return true
    return (f.bagsDeposited ?? 0) + 0.51 >= need
  }

  /**
   * A full cart is loaded. A short cart holds the departure until the board
   * window ends, then the missing bags are offloaded instead of counted as loaded.
   */
  private settleOutboundBags(f: Flight, releasing: boolean): boolean {
    if (f.cargo) return true
    const need = f.bagUnits ?? 0
    if (need <= 0) return true
    const have = f.bagsDeposited ?? 0
    const book = this.ensureBagBook(f)
    if (this.outboundBagsFull(f)) {
      f.bagsLoaded = have
      f.bagsOffloaded = 0
      book.offloaded = 0
      book.loaded = Math.max(book.loaded, have)
      f.posted.bagsLoad = true
      f.waitingOn.bagsLoad = false
      this.setBagStage(f, 'inflight')
      this.noteOutboundBagFee(f)
      this.markOutboundTags(f)
      return true
    }
    if (!releasing) {
      f.waitingOn.bagsLoad = true
      f.posted.bagsLoad = false
      f.bagsLoaded = have
      book.loaded = have
      if (f.bagStage === 'inflight' || f.bagStage === 'complete') this.setBagStage(f, 'load_aircraft')
      return false
    }
    const short = Math.max(0, need - have)
    const already = f.bagsOffloaded ?? 0
    f.bagsLoaded = have
    f.bagsOffloaded = short
    book.offloaded = short
    book.loaded = have
    f.posted.bagsLoad = false
    f.waitingOn.bagsLoad = false
    if (
      !f.bagStage ||
      f.bagStage === 'idle' ||
      f.bagStage === 'pax_deposit' ||
      f.bagStage === 'hold_screen' ||
      f.bagStage === 'inflight' ||
      f.bagStage === 'complete'
    ) {
      this.setBagStage(f, 'load_aircraft')
    }
    this.noteOutboundBagFee(f)
    this.markOutboundTags(f)
    if (already + 0.51 < short) {
      this.adjustHeat(f.airline, -1.6)
      this.pushNews(
        `${f.flightNo} left ${Math.round(short)} bags behind — offloaded, not loaded.`,
        'bad',
      )
    }
    return true
  }

  private noteOutboundBagFee(f: Flight) {
    if (f.cargo) return
    if (f.ledger.some((line) => line.label.includes('outbound bags'))) return
    const airline = this.airline(f.airline)
    const need = f.bagUnits ?? 0
    const have = f.bagsDeposited ?? 0
    const frac = need > 0 ? Math.min(1, have / need) : 1
    const amount = Math.round(airline.bags * 0.55 * frac)
    if (amount > 0) this.earn(amount, `${f.flightNo} outbound bags`, f)
  }

  /** Tags exist only for bags a passenger actually dropped. */
  private markOutboundTags(f: Flight) {
    for (const tag of this.bagTags) {
      if (tag.kind === 'out' && tag.flightId === f.id && !tag.fault) tag.loaded = true
    }
  }

  bagBook(id: string): BagBook | undefined {
    return this.bagBooks.get(id)
  }

  private ensureBagBook(f: Flight): BagBook {
    let book = this.bagBooks.get(f.id)
    if (!book) {
      book = freshBook(f.id, f.bagUnits ?? 0)
      this.bagBooks.set(f.id, book)
    }
    if ((f.bagUnits ?? 0) > book.units) book.units = f.bagUnits ?? 0
    return book
  }

  private noteBagDrop(f: Flight, units: number, ownerId?: string, paxTag?: PaxTag) {
    const book = this.ensureBagBook(f)
    book.dropped += units
    book.units = Math.max(book.units, f.bagUnits ?? 0, book.dropped)
    f.bagsDeposited = book.dropped
    if ((f.bagUnits ?? 0) < book.units) f.bagUnits = book.units
    if (ownerId && paxTag) this.issueBagTags(ownerId, f.id, paxTag, null, 'out')
  }

  /** Checked-bag records for one passenger. */
  bagTagsFor(ownerId: string): BagTag[] {
    return this.bagTags.filter((t) => t.ownerPassengerId === ownerId)
  }

  /** Bags sitting on the lost-bag desk. Capped so the picture stays a handful of meshes. */
  bagDeskPile(): number {
    return Math.min(
      4,
      this.bagTags.filter((t) => t.fault && !t.picked).length,
    )
  }

  private issueBagTags(
    ownerId: string,
    flightId: string,
    paxTag: PaxTag,
    connectFlightId: string | null,
    kind: BagTag['kind'],
  ) {
    if (this.bagTags.some((t) => t.ownerPassengerId === ownerId && t.kind === kind)) return
    const pieces = checkedPieceCount(paxTag)
    for (let i = 0; i < pieces; i++) {
      this.bagTags.push(makeBagTag(ownerId, flightId, i, connectFlightId, kind))
    }
  }

  /** Onward flight still on the ground, or an open connection id. */
  private pickConnectFlight(airlineId: AirlineId): string {
    const onward = this.flights.find(
      (f) =>
        f.airline === airlineId &&
        !f.cargo &&
        f.phase !== 'gone' &&
        f.phase !== 'takeoff' &&
        f.phase !== 'taxi_out' &&
        f.phase !== 'pushback',
    )
    return onward?.id ?? `connect:${airlineId}`
  }

  private flightDeparted(id: string): boolean {
    if (id.startsWith('connect:')) return false
    const f = this.flights.find((x) => x.id === id)
    if (!f) return true
    return (
      f.phase === 'pushback' ||
      f.phase === 'taxi_out' ||
      f.phase === 'takeoff' ||
      f.phase === 'gone'
    )
  }

  private bagClock() {
    const prefab = this.fits.some((f) => f.premade && !f.redesigned)
    return {
      prefab,
      normal: !this.hallOverloaded,
      departed: (id: string) => this.flightDeparted(id),
      stage: (id: string) => this.flights.find((f) => f.id === id)?.bagStage,
    }
  }

  private pickUpOwnBags(g: HallGuest, fl: Flight) {
    let pieces = 0
    for (const tag of this.bagTags) {
      if (tag.ownerPassengerId !== g.id || tag.kind !== 'in') continue
      tag.onClaim = true
      tag.picked = true
      pieces += 1
    }
    const book = this.ensureBagBook(fl)
    const cap = Math.max(book.units, book.dropped, pieces, 1)
    book.claimed = Math.min(cap, book.claimed + Math.max(1, pieces))
  }

  private mishandleGuest(ownerId: string, fault: 'late' | 'missed_connection') {
    const g = this.hallGuests.find((x) => x.id === ownerId && !x.dead)
    if (!g || g.bagFault) return
    g.bagFault = fault
    g.atBagDesk = true
    g.deskTime = 0
    g.happiness = Math.max(0, g.happiness - 8)
    g.node = 'claim'
    g.path = []
    g.seg = 0
    g.t = 0
    g.thought =
      fault === 'missed_connection'
        ? 'Lost-bag desk — my bag missed the connection'
        : 'Lost-bag desk — my bag is late'
  }

  /** Teaching halls never lose a bag. A redesigned hall can. */
  prefabFlight(f: Flight): boolean {
    const fit = (f.stand && this.roomsAt(f.stand)) || this.activeHall() || this.fits[0]
    return Boolean(fit?.premade && !fit.redesigned)
  }

  /** A bag building or any belt tile can screen hold bags. */
  bagHallReady(): boolean {
    return tilesOf(this.tiles, 'bags').length > 0 || hasBeltNetwork(this.tiles)
  }

  luggageMotion(): LuggageMotion {
    if (this.bagShow) return { ...this.bagShow, phase: this.bagPhase }
    let belt = false
    let screen = false
    let carousel = false
    let sort = false
    for (const f of this.flights) {
      if (f.cargo || f.phase === 'gone') continue
      const stage = f.bagStage
      if (
        stage === 'pax_deposit' ||
        stage === 'hold_screen' ||
        stage === 'outbound_sort' ||
        stage === 'inbound_sort' ||
        stage === 'deliver_claim'
      ) {
        belt = true
      }
      if (stage === 'pax_deposit' || stage === 'hold_screen') screen = true
      if (
        stage === 'outbound_sort' ||
        stage === 'inbound_sort' ||
        stage === 'load_aircraft' ||
        stage === 'unload_aircraft'
      ) {
        sort = true
      }
      if (stage === 'deliver_claim' || stage === 'on_claim' || stage === 'complete') {
        carousel = true
      }
    }
    return { belt, screen, carousel, sort, phase: this.bagPhase }
  }

  private tickLuggage(dt: number) {
    this.bagPhase = (this.bagPhase + dt * 0.35) % 1
    for (const f of this.flights) {
      if (f.cargo || f.phase === 'gone' || f.craft === 'helo') continue
      if (!f.bagStage && !(f.bagUnits && f.bagUnits > 0) && !(f.bagsDeposited && f.bagsDeposited > 0)) {
        continue
      }
      const book = this.ensureBagBook(f)
      if ((f.bagsDeposited ?? 0) > book.dropped) {
        book.dropped = f.bagsDeposited ?? 0
        book.units = Math.max(book.units, book.dropped)
      }
      const prefab = this.prefabFlight(f)
      if (f.bagStage === 'hold_screen') {
        const before = book.lost
        const result = advanceScreen(book, dt, { prefab, hallReady: this.bagHallReady() })
        if (result === 'pass') this.setBagStage(f, 'outbound_sort')
        else if (result === 'lose') {
          if (!prefab) this.bagsLost += book.lost - before
          this.setBagStage(f, 'outbound_sort')
        }
      }
      if (prefab) keepPrefabBags(book, f.bagStage)
    }
    const clock = this.bagClock()
    const fresh = advanceBagTags(this.bagTags, dt, clock)
    if (fresh > 0) {
      this.bagsMishandled += fresh
      for (const tag of this.bagTags) {
        if (tag.fault) this.mishandleGuest(tag.ownerPassengerId, tag.fault)
      }
    }
    this.bagTags = this.bagTags.filter((tag) => {
      if (!tag.picked && !tag.fault) return true
      const owner = this.hallGuests.find((g) => g.id === tag.ownerPassengerId)
      return !owner?.dead
    })
  }

  /** Seconds of visible load/unload/process work from bag units. */
  /** Pax, bags, and arrival fuel from the airframe's published-ish figures. */
  flightLoad(
    af: (typeof AIRFRAMES)[string],
    persona: 'budget' | 'business' | 'luxury' | 'cargo_night' | 'military_gov',
    cargo: boolean,
  ): { pax: number; bagUnits: number; fuelLevel: number } {
    const freighter = cargo || af.kind === 'freighter'
    const pax = freighter ? 0 : paxForAirframe(af)
    const bagUnits = freighter
      ? 0
      : bagUnitsForAirframe(af, estimateFlightBagUnits(persona, pax))
    return { pax, bagUnits, fuelLevel: 0.28 + Math.random() * 0.18 }
  }

  /** Off-map start so the jet flies the approach instead of popping onto the strip. */
  armApproach(route: Vec[]): { x: number; y: number; z: number; path: Vec[] } {
    const path = inboundApproach(route)
    const start = path[0] ?? route[0]
    return { x: start.c, y: start.r, z: 16, path }
  }

  bagWorkSeconds(f: Flight, kind: 'ramp' | 'sort' | 'deposit'): number {
    const u = f.bagUnits ?? estimateFlightBagUnits(this.airline(f.airline).persona, f.pax)
    return bagWorkDuration(u, kind)
  }

  bagStageLabel(f: Flight): string {
    return describeBagStage(f.bagStage, f.claimLane, f.bagsDeposited, f.bagUnits)
  }

  /** Warehouse fill 0–1 for HUD. */
  cargoWarehouseFill(): number {
    return clamp(this.cargoWarehouse / CARGO_WAREHOUSE_CAP, 0, 1.2)
  }

  /** Road cells on the map edge — city truck spawn points. */
  cityEdgeRoads(): Vec[] {
    const out: Vec[] = []
    for (let c = 0; c < SIZE; c++) {
      if (this.tiles[0][c] === 'road') out.push({ c, r: 0 })
      if (this.tiles[SIZE - 1][c] === 'road') out.push({ c, r: SIZE - 1 })
    }
    for (let r = 1; r < SIZE - 1; r++) {
      if (this.tiles[r][0] === 'road') out.push({ c: 0, r })
      if (this.tiles[r][SIZE - 1] === 'road') out.push({ c: SIZE - 1, r })
    }
    return out
  }

  /**
   * Living logistics: city cargo trucks spawn off-map → guard → shed.
   * Missing / thin guard = queue, deny, or On-time nick.
   */
  tickCityCargo(dt: number) {
    this.cityCargoCool = Math.max(0, this.cityCargoCool - dt)
    const sheds = tilesOf(this.tiles, 'cargo')
    if (!sheds.length) return
    const edges = this.cityEdgeRoads()
    if (!edges.length) return

    const live = this.trucks.filter((t) => t.kind === 'citycargo').length
    const guards = tilesOf(this.tiles, 'guard')
    const maxLive = Math.max(1, 1 + guards.length)
    if (live >= maxLive) return
    if (this.cityCargoCool > 0) return
    // Demand: cargo signed, warehouse room, or a freighter inbound/on stand.
    const cargoSigned = this.signed.some((id) => this.airline(id).kind === 'cargo')
    const freighterBusy = this.flights.some(
      (f) =>
        f.cargo &&
        f.phase !== 'gone' &&
        f.phase !== 'takeoff' &&
        f.phase !== 'hold',
    )
    const wantStock = this.cargoWarehouse < CARGO_WAREHOUSE_CAP * 0.85
    if (!cargoSigned && !freighterBusy && !wantStock) return
    if (!wantStock && !freighterBusy) return

    // No guard — rare sneak-through with incident, else deny at the edge.
    if (!guards.length) {
      this.cityCargoCool = 14 + Math.random() * 10
      if (Math.random() < 0.45) {
        this.securityIncidents += 1
        for (const id of this.signed) {
          if (this.airline(id).kind === 'cargo') this.adjustHeat(id, -2.2)
        }
        this.pushNews(
          'City cargo truck denied — no guard post on the road. On-time dips; stamp a Guard.',
          'bad',
        )
      } else if (Math.random() < 0.35) {
        // Sneak in without screen — short path straight to shed, incident risk.
        const edge = pick(edges)
        const path = nearestPath(this.tiles, edge, sheds, 'truck')
        if (path && path.length > 1) {
          this.trucks.push({
            id: uid('city'),
            kind: 'citycargo',
            flightId: null,
            x: edge.c,
            y: edge.r,
            path,
            seg: 0,
            t: 0,
            returning: false,
            dwell: 0,
            preDwell: 0,
            patrol: false,
            mission: 'city_shed',
            home: sheds[0],
            cargoUnits: 10 + Math.floor(Math.random() * 14),
          })
          this.securityIncidents += 1
          this.pushNews(
            'Unscreened city truck rolled to the shed — security nick. Build a Guard post.',
            'bad',
          )
        }
      }
      return
    }

    const edge = pick(edges)
    const guard = guards[0]
    const toGuard = nearestPath(this.tiles, edge, [guard], 'truck')
    if (!toGuard || toGuard.length < 2) {
      this.cityCargoCool = 8
      return
    }
    // Queue pressure when many trucks + one post.
    const queue = this.trucks.filter(
      (t) => t.kind === 'citycargo' && t.mission === 'city_guard',
    ).length
    const units = 12 + Math.floor(Math.random() * 16)
    this.trucks.push({
      id: uid('city'),
      kind: 'citycargo',
      flightId: null,
      x: edge.c,
      y: edge.r,
      path: toGuard,
      seg: 0,
      t: 0,
      returning: false,
      dwell: 0,
      preDwell: queue > 0 ? 0.8 + queue * 0.7 : 0,
      patrol: false,
      mission: 'city_guard',
      home: sheds[0],
      cargoUnits: units,
    })
    this.cityCargoCool = 9 + Math.random() * 8 + queue * 3
    if (Math.random() < 0.4) {
      this.pushNews(
        `City cargo truck inbound — ${units} units via guard → shed.`,
        'ok',
      )
    }
  }

  finishCityCargo(t: Truck) {
    if (t.kind !== 'citycargo') return
    if (t.mission === 'city_guard') {
      // Screened — roll to shed.
      const sheds = tilesOf(this.tiles, 'cargo')
      const from = { c: Math.round(t.x), r: Math.round(t.y) }
      const path = sheds.length
        ? nearestPath(this.tiles, from, sheds, 'truck')
        : null
      if (path && path.length > 1) {
        t.mission = 'city_shed'
        t.path = path
        t.seg = 0
        t.t = 0
        t.returning = false
        t.dwell = 0
        t.home = sheds[0]
      } else {
        t.dwell = -99
      }
      return
    }
    if (t.mission === 'city_shed') {
      const units = t.cargoUnits ?? 12
      const room = Math.max(0, CARGO_WAREHOUSE_CAP - this.cargoWarehouse)
      const accepted = Math.min(units, room)
      this.cargoWarehouse += accepted
      if (accepted > 0) {
        this.earn(
          Math.round(CARGO_INTAKE_FEE * (0.7 + accepted / 28)),
          `City cargo intake (${accepted}u)`,
        )
        this.creditCargoVolume(accepted)
      }
      if (accepted < units) {
        this.pushNews(
          `Warehouse full — ${units - accepted}u turned away. Expand capacity or uplift sooner.`,
          'bad',
        )
        for (const id of this.signed) {
          if (this.airline(id).kind === 'cargo') this.adjustHeat(id, -1.2)
        }
      } else if (Math.random() < 0.5) {
        this.pushNews(
          `Warehouse ${Math.round(this.cargoWarehouseFill() * 100)}% — ${accepted}u staged for freighters.`,
          'ok',
        )
      }
      t.cargoUnits = 0
      // Depart back to city edge.
      const edges = this.cityEdgeRoads()
      const from = { c: Math.round(t.x), r: Math.round(t.y) }
      const leave = edges.length
        ? nearestPath(this.tiles, from, edges, 'truck')
        : null
      if (leave && leave.length > 1) {
        t.mission = 'city_depart'
        t.path = leave
        t.seg = 0
        t.t = 0
        t.returning = true
        t.dwell = 0
      } else {
        t.dwell = -99
      }
      return
    }
    if (t.mission === 'city_depart') {
      t.dwell = -99
    }
  }

  hallOpen(): Set<HallNode> {
    return this.hallOpenFor(this.activeHall())
  }

  /** Open graph for a guest's home hall (falls back to active / first). */
  openForGuest(g: HallGuest): Set<HallNode> {
    const fit = this.fitByKey(g.hallId) ?? this.activeHall() ?? this.fits[0] ?? null
    return this.hallOpenFor(fit)
  }

  /**
   * Nearest hall within jetway range of a jetway-equipped stand.
   * Remote bays never auto-link — they need terminal buses or walking pax.
   */
  jetwayHall(stand: Vec | null): TerminalFit | null {
    if (!stand || !this.fits.length) return null
    if (this.standAccessAt(stand) !== 'jetway') return null
    let best: TerminalFit | null = null
    let bestD = JETWAY_RANGE + 1
    for (const f of this.fits) {
      const d = Math.abs(f.origin.c - stand.c) + Math.abs(f.origin.r - stand.r)
      if (d < bestD) {
        bestD = d
        best = f
      }
    }
    return bestD <= JETWAY_RANGE ? best : null
  }

  standsForHall(fit: TerminalFit): Vec[] {
    return tilesOf(this.tiles, 'stand').filter((s) => {
      const h = this.jetwayHall(s)
      return h != null && h.origin.c === fit.origin.c && h.origin.r === fit.origin.r
    })
  }

  jetwayCount(): number {
    return tilesOf(this.tiles, 'stand').filter((s) => this.jetwayHall(s)).length
  }

  occupiedAtHall(fit: TerminalFit): number {
    const keys = new Set(this.standsForHall(fit).map((s) => `${s.c},${s.r}`))
    return this.flights.filter(
      (f) =>
        (f.craft ?? 'jet') === 'jet' &&
        f.stand &&
        keys.has(`${f.stand.c},${f.stand.r}`) &&
        f.phase !== 'gone' &&
        f.phase !== 'takeoff',
    ).length
  }

  campusLine(): string {
    if (!this.fits.length) return 'No terminal'
    const halls = this.fits.map((f) => this.hallLabel(f)).join(' · ')
    const jw = this.jetwayCount()
    const remote = tilesOf(this.tiles, 'stand').length - jw
    return `${this.fits.length} hall${this.fits.length > 1 ? 's' : ''} (${halls}) · ${jw} jetway${jw === 1 ? '' : 's'}${remote > 0 ? ` · ${remote} remote` : ''}`
  }

  /** A departing passenger has reached the doors and can walk to check-in. */
  private openDepartingGuest(g: HallGuest, open: Set<HallNode>) {
    g.node = 'entrance'
    g.clearedSec = false
    if (open.has('checkin')) this.routeGuest(g, 'checkin', open)
    else if (open.has('security')) this.routeGuest(g, 'security', open)
    else g.thought = 'No security lane — stuck before security'
    if (g.thought !== 'No security lane — stuck before security') {
      g.thought = 'Rolling a bag to check-in'
    }
  }

  /** Focus a campus hall (from HUD chips or pan-click). */
  selectHall(fit: TerminalFit) {
    this.selectedTile = { ...fit.origin }
    this.setView('hall')
  }

  seedHallForFlight(f: Flight, job: 'depart' | 'arrive') {
    if (f.cargo || !this.fits.length) return
    const fit = this.roomsAt(f.stand) ?? this.activeHall() ?? this.fits[0]
    if (!fit) return
    const open = this.hallOpenFor(fit)
    if (!open.size) return
    const hallId = this.hallKey(fit)
    const mode = this.standPaxMode(f.stand)
    // Jetway turns are quick — more bodies linger and spend. Walkers are rushed.
    const count = Math.max(
      6,
      Math.min(18, Math.round(f.pax / (mode === 'jetway' ? 5.5 : mode === 'bus' ? 6.5 : 7.5))),
    )
    const a = this.airline(f.airline)
    for (let i = 0; i < count; i++) {
      const tag: PaxTag = rollPaxTag(a.persona)
      const g = spawnHallGuest(f.id, job, tag, { airlineId: f.airline, hallId })
      const modes = this.pickGuestMode(tag, a.persona, job)
      g.preferMode = modes.prefer
      g.arriveMode = modes.actual
      // Heavy bags = more claim work (premium/family); budgets travel light.
      if (job === 'arrive') {
        g.needs.bags = Math.min(99, 40 + bagUnitsForTag(tag) * 22)
      }
      if (mode === 'jetway') {
        g.needs.boarding = Math.min(99, g.needs.boarding + 18)
        g.needs.shop = Math.min(99, g.needs.shop + 14)
        g.needs.play = Math.min(99, g.needs.play + 10)
        g.needs.hunger = Math.min(99, g.needs.hunger + 8)
      } else if (mode === 'walk') {
        g.needs.boarding = Math.max(6, g.needs.boarding - 14)
      } else if (mode === 'bus') {
        g.needs.boarding = Math.min(99, g.needs.boarding + 6)
        g.needs.shop = Math.min(99, g.needs.shop + 6)
      }
      // Kick them onto a clear first leg so you see the flow immediately.
      if (job === 'arrive') {
        g.node = 'gate'
        g.thought =
          mode === 'jetway'
            ? 'Jetway in — time to spend before bags'
            : mode === 'bus'
              ? 'Bus from the remote stand — into the hall'
              : 'Long walk from the stand — need bags'
        if (open.has('claim')) this.routeGuest(g, 'claim', open)
        else if (open.has('exit')) this.routeGuest(g, 'exit', open)
        g.hasChecked = false
        g.carryOn = true
      } else {
        g.node = 'entrance'
        g.clearedSec = false
        g.hasChecked = true
        g.carryOn = true
        this.applyGuestLandside(g, 'depart')
        const prefabRelease = Boolean(fit.premade && !fit.redesigned)
        if (prefabRelease) {
          g.releaseAt = this.clock + Math.random() * DEPARTURE_SPREAD_SEC
          g.thought = 'On the way to the doors'
        } else this.openDepartingGuest(g, open)
      }
      this.hallGuests.push(g)
    }
  }

  /**
   * Benches and decorations. A waiting guest takes a free seat and rests;
   * decorations near the guest's zone lift the mood a little each second.
   */
  applyHallKit(g: HallGuest, dt: number, cache: Map<string, HallKitState>) {
    const fit = this.fitByKey(g.hallId) ?? this.activeHall()
    if (!fit) return
    const key = this.hallKey(fit)
    let state = cache.get(key)
    if (!state) {
      const items = (fit.items ?? []) as PlacedItem[]
      const zones = fit.zones ?? []
      state = { items, zones, seatsLeft: seatsByZone(zones, items), comfort: new Map() }
      cache.set(key, state)
    }
    const walking = g.path.length > 0 && g.seg < g.path.length - 1
    const zone = NODE_ZONE[g.node]
    const free = zone ? (state.seatsLeft.get(zone) ?? 0) : 0
    g.seated = false
    if (!walking && zone && free > 0 && (SEAT_NODES as readonly HallNode[]).includes(g.node)) {
      state.seatsLeft.set(zone, free - 1)
      g.seated = true
      g.needs.energy = Math.max(0, g.needs.energy - dt * KIT_TUNING.seatRestPerSec)
      if (g.happiness < 100) {
        g.happiness = Math.min(100, g.happiness + dt * KIT_TUNING.seatJoyPerSec)
      }
    }
    let comfort = state.comfort.get(g.node)
    if (comfort == null) {
      comfort = nodeComfort(state.zones, state.items, g.node)
      state.comfort.set(g.node, comfort)
    }
    if (comfort > 0 && g.happiness < 100) {
      g.happiness = Math.min(100, g.happiness + dt * comfort * KIT_TUNING.comfortJoyPerSec)
    }
  }

  guestAirlineId(g: HallGuest): AirlineId | null {
    if (g.airlineId) return g.airlineId
    if (g.flightId.startsWith('layover:')) return g.flightId.slice('layover:'.length)
    const f = this.flights.find((x) => x.id === g.flightId)
    return f?.airline ?? null
  }

  tickHall(dt: number) {
    if (!this.fits.length) {
      this.hallGuests = []
      return
    }
    const anyOpen = this.fits.some((f) => this.hallOpenFor(f).size > 0)
    if (!anyOpen) {
      this.hallGuests = []
      return
    }
    const kit = new Map<string, HallKitState>()
    for (const g of this.hallGuests) {
      if (g.dead) continue
      if (g.releaseAt != null && this.clock < g.releaseAt) continue
      const open = this.openForGuest(g)
      if (!open.size) continue
      if (g.releaseAt != null) {
        g.releaseAt = undefined
        this.openDepartingGuest(g, open)
      }
      // Needs drift — budget/family fill hunger faster; wear makes WC less satisfying.
      const drain =
        g.tag === 'budget' ? 1.25 : g.tag === 'family' ? 1.1 : g.tag === 'business' ? 0.9 : 0.85
      const wearBoost = 1 + this.maxWear() / 200
      g.needs.hunger = Math.min(100, g.needs.hunger + dt * 1.8 * drain)
      g.needs.bladder = Math.min(100, g.needs.bladder + dt * 1.4 * drain * wearBoost)
      g.needs.energy = Math.min(100, g.needs.energy + dt * 1.1)
      g.needs.shop = Math.min(100, g.needs.shop + dt * 0.6)
      g.needs.play = Math.min(
        100,
        g.needs.play + dt * (g.tag === 'family' ? 1.25 : tagSpendsUp(g.tag) ? 1.05 : 0.7),
      )
      if (g.job === 'depart') g.needs.boarding = Math.max(0, g.needs.boarding - dt * 0.42)
      this.applyHallKit(g, dt, kit)
      // Finish check-in bag deposit dwell (outbound picture).
      if (
        g.job === 'depart' &&
        g.node === 'checkin' &&
        !g.bagsDropped &&
        g.bagDepositLeft != null &&
        g.bagDepositLeft > 0
      ) {
        g.bagDepositLeft -= dt
        if (g.bagDepositLeft <= 0) {
          g.bagsDropped = true
          g.bagDepositLeft = 0
          g.hasChecked = false
          const fl = this.flights.find((x) => x.id === g.flightId)
          if (fl && !fl.cargo) {
            this.noteBagDrop(fl, bagUnitsForTag(g.tag), g.id, g.tag)
            const need = fl.bagUnits ?? 1
            const early =
              !fl.bagStage ||
              fl.bagStage === 'idle' ||
              fl.bagStage === 'pax_deposit' ||
              fl.bagStage === 'hold_screen'
            if ((fl.bagsDeposited ?? 0) >= need * 0.55 && early) {
              fl.bagStage = 'hold_screen'
            }
          }
          const openDesk = this.openForGuest(g)
          if (openDesk.has('security')) this.routeGuest(g, 'security', openDesk)
          g.thought = 'Bags accepted — walking to security'
        } else {
          continue
        }
      }
      if (g.job === 'arrive' && g.node === 'claim' && !g.transfer) {
        const fl = this.flights.find((x) => x.id === g.flightId)
        if (!fl) {
          const fit = this.fitByKey(g.hallId) ?? this.activeHall() ?? this.fits[0] ?? null
          const rate = this.claimClearRate(fit)
          g.needs.bags = Math.max(0, g.needs.bags - dt * rate)
          if (g.needs.bags > 0) {
            g.thought = 'Waiting at the carousel'
            continue
          }
          if (!g.hasChecked) {
            g.hasChecked = true
            g.thought = 'Got my bag'
          }
        } else if (g.atBagDesk) {
          g.deskTime = (g.deskTime ?? 0) + dt
          g.thought =
            g.bagFault === 'missed_connection'
              ? 'Lost-bag desk — my bag missed the connection'
              : 'Lost-bag desk — my bag is late'
          if ((g.deskTime ?? 0) < 4) continue
          this.pickUpOwnBags(g, fl)
          g.atBagDesk = false
          g.hasChecked = true
          g.needs.bags = 0
          g.thought = 'Got my bag'
          fl.bagStage = 'complete'
        } else if (fl.bagStage !== 'on_claim' && fl.bagStage !== 'complete') {
          this.issueBagTags(g.id, fl.id, g.tag, null, 'in')
          g.claimWait = (g.claimWait ?? 0) + dt
          g.thought =
            fl.bagStage === 'unload_aircraft' || fl.bagStage === 'inbound_sort'
              ? `Waiting — bags processing for claim ${fl.claimLane ?? '?'}`
              : fl.bagStage === 'deliver_claim'
                ? `Waiting — bags rolling to claim ${fl.claimLane ?? '?'}`
                : 'Waiting for my bag off the aircraft…'
          const late = markClaimLate(this.bagTags, g.id, g.claimWait, {
            prefab: this.prefabFlight(fl),
            normal: !this.hallOverloaded,
          })
          if (late.length) {
            this.bagsMishandled += late.length
            this.mishandleGuest(g.id, 'late')
          }
          continue
        } else {
          this.issueBagTags(g.id, fl.id, g.tag, null, 'in')
          if (!ownerClaimReady(this.bagTags, g.id)) {
            g.claimWait = (g.claimWait ?? 0) + dt
            g.thought = 'Waiting for my bag'
            const late = markClaimLate(this.bagTags, g.id, g.claimWait, {
              prefab: this.prefabFlight(fl),
              normal: !this.hallOverloaded,
            })
            if (late.length) {
              this.bagsMishandled += late.length
              this.mishandleGuest(g.id, 'late')
            }
            continue
          }
          if (!g.hasChecked) {
            this.pickUpOwnBags(g, fl)
            g.hasChecked = true
            g.needs.bags = 0
            g.thought = 'Got my bag'
          }
          fl.bagStage = 'complete'
        }
      }

      if (g.job === 'depart' && g.node === 'security' && !g.clearedSec) {
        g.path = []
        g.seg = 0
        g.t = 0
        g.route = undefined
        this.tickSecurityLane(g, dt, open)
        continue
      }

      if (g.path.length && g.seg < g.path.length - 1) {
        if (g.route == null) this.armGuestRoute(g)
        g.t += dt * 1.35
        let held = false
        while (g.t >= 1 && g.seg < g.path.length - 1) {
          const finished = g.route
          g.t -= 1
          g.seg += 1
          g.node = g.path[g.seg]
          if (finished && finished.length) {
            const end = finished[finished.length - 1]
            g.wx = end.x
            g.wz = end.z
          }
          if (g.node === 'security' && g.job === 'depart' && !g.clearedSec) {
            g.path = []
            g.seg = 0
            g.t = 0
            g.route = undefined
            g.routeDist = 0
            held = true
            break
          }
          const screened = g.clearedSec
          if (g.node === 'security') g.clearedSec = true
          this.secureBreach(g)
          // A cleared departure walking back across the checkpoint keeps their path.
          // serveNode used to start a new route here, so the line never left the node.
          if (!(g.node === 'security' && screened && g.job === 'depart')) this.serveNode(g, open)
          if (g.seg < g.path.length - 1) this.armGuestRoute(g)
          else {
            g.route = undefined
            g.routeDist = 0
          }
        }
        if (held) {
          this.tickSecurityLane(g, 0, open)
          continue
        }
        this.sampleGuestRoute(g)
        continue
      }

      // Decision point — pick strongest need and search a short path (RCT-capped).
      const need = strongestNeed(g)
      if (!need) {
        if (g.transfer) {
          // Transfers use boarding as connection clock — linger until it runs down.
          g.needs.boarding = Math.max(0, g.needs.boarding - dt * 0.35)
          if (g.needs.boarding > 8) {
            const linger = (
              [
                'food',
                'shop',
                'lounge',
                'dayhotel',
                'spa',
                'pool',
                'bathroom',
                'gaming',
                'waterfall',
                'golf',
              ] as const
            ).find((n) => open.has(n))
            if (linger && g.node !== linger) this.routeGuest(g, linger, open)
            else g.thought = 'Killing time until the connection'
          } else if (open.has('gate')) {
            this.routeGuest(g, 'gate', open)
            if (g.node === 'gate' && g.needs.boarding <= 0) {
              g.dead = true
              const aid = this.guestAirlineId(g)
              if (aid) this.adjustHeat(aid, g.happiness >= 55 ? 2.5 : -2)
            }
          }
        } else if (g.job === 'depart' && open.has('gate')) {
          this.routeGuest(g, 'gate', open)
        } else if (g.job === 'arrive' && g.needs.bags < 15) {
          this.routeGuest(g, 'exit', open)
        } else {
          g.thought = 'Wandering…'
        }
        continue
      }
      const dest = reachableNeed(need, g.job, open)
      if (!dest) {
        g.happiness -= dt * 0.4
        g.thought = 'Waiting for a way through'
        if (g.job === 'depart' && open.has('gate')) this.routeGuest(g, 'gate', open)
        else if (g.job === 'arrive' && open.has('exit')) this.routeGuest(g, 'exit', open)
        continue
      }
      if (g.node === dest) this.serveNode(g, open)
      else this.routeGuest(g, dest, open)

      if (g.job === 'depart' && g.needs.boarding <= 0 && g.node !== 'gate') {
        g.happiness -= 30
        g.dead = true
        this.reputation = Math.max(0, this.reputation - 0.8)
        const aid = this.guestAirlineId(g)
        if (aid) this.adjustHeat(aid, g.transfer ? -2.5 : -1.3)
        this.hallMissNews(
          `gate-${g.flightId}`,
          `Missed gate on ${g.flightId.slice(0, 10)} — pax boiling, Standing dips.`,
        )
        this.missedFlights += 1
      }
    }
    // Sample layover happiness into the active contract.
    if (this.layover) {
      const transfers = this.hallGuests.filter(
        (g) => g.transfer && g.airlineId === this.layover!.airline && !g.dead,
      )
      if (transfers.length) {
        let sum = 0
        for (const g of transfers) sum += g.happiness
        this.layover.happySum += sum / transfers.length
        this.layover.samples += 1
      }
    }
    this.hallGuests = this.hallGuests.filter((g) => !g.dead)
    const fit = this.activeHall() ?? this.fits[0]
    const present = this.hallGuests.filter((g) => g.releaseAt == null || g.releaseAt <= this.clock).length
    if (fit && present > (fit.capGuests ?? 40)) this.markHallOverloaded()
  }

  routeGuest(g: HallGuest, dest: HallNode, open: Set<HallNode>) {
    // Uncleared departures only see the curb side plus the security lane.
    const view = openForGuest(open, g.clearedSec)
    const fit = this.fitByKey(g.hallId) ?? this.activeHall()
    const prefab = Boolean(fit?.premade && !fit?.redesigned)
    let target = dest
    if (!g.clearedSec && isAirside(dest)) {
      if (view.has('security')) {
        target = 'security'
        g.thought = 'Need to clear security first'
      } else if (prefab) {
        g.lost = false
        g.thought = 'No security lane — waiting'
        g.happiness -= 0.4
        return
      } else {
        g.lost = true
        g.thought = 'Lost — no security lane, gate is locked'
        g.happiness -= 1.2
        g.patience -= 2
        return
      }
    }
    const signs = (fit?.signs ?? 0) + (g.node === 'info' ? 1 : 0)
    const depth = lookaheadDepth(signs)
    // Once screened, stay airside. The checkpoint is not a shortcut between the gate and the food.
    const avoidLane =
      g.clearedSec &&
      g.node !== 'security' &&
      target !== 'security' &&
      isAirside(g.node) &&
      isAirside(target)
    const walkView = avoidLane ? new Set([...view].filter((n) => n !== 'security')) : view
    let path = hallPath(g.node, target, walkView, depth)
    if ((!path || path.length < 2) && avoidLane) path = hallPath(g.node, target, view, depth)
    if ((!path || path.length < 2) && prefab) path = hallPath(g.node, target, view, 12)
    if (!path || path.length < 2) {
      if (prefab) {
        g.lost = false
        g.thought = 'Waiting for a clear path'
        g.happiness -= 0.15
        return
      }
      g.lost = true
      if (!g.clearedSec && isAirside(dest)) {
        g.thought = 'Blocked at the secure line'
        g.happiness -= 0.8
      } else {
        g.thought = 'Lost in the hall'
        g.happiness -= 0.5
      }
      return
    }
    g.lost = false
    g.path = path
    g.seg = 0
    g.t = 0
    g.route = undefined
    this.armGuestRoute(g)
    if (!g.thought.startsWith('Need to clear')) {
      g.thought = `Heading to ${target}`
    }
  }

  /**
   * Room plan for a hall, matching `world.wr.roomPlans()` (same layout seed, no decorative crowd).
   * Rebuilt when the map changes. Headless tests use this; the client draws the same plan.
   */
  roomPlanForHall(hallId?: string | null): RoomPlan | null {
    if (this.terminalPlans?.rev !== this.mapRev) {
      const entries = terminals(this).map((t, index) => ({
        key: `${t.cluster.minC},${t.cluster.minR}`,
        cells: t.cluster.cells,
        plan: planTerminal(t, { density: 1, walkersPerCell: 0, seed: terminalPlanSeed(index) }).rooms,
      }))
      this.terminalPlans = { rev: this.mapRev, entries }
    }
    const entries = this.terminalPlans?.entries ?? []
    const fit = this.fitByKey(hallId)
    if (fit) {
      const key = this.hallKey(fit)
      const hit = entries.find(
        (e) => e.key === key || e.cells.some((p) => p.c === fit.origin.c && p.r === fit.origin.r),
      )
      if (hit) return hit.plan
    }
    if (hallId) {
      const hit = entries.find((e) => e.key === hallId)
      if (hit) return hit.plan
    }
    return entries[0]?.plan ?? null
  }

  /** Strict doorway path for the edge the guest is about to walk. A null path does not mark them lost. */
  armGuestRoute(g: HallGuest) {
    const next = g.path[g.seg + 1]
    if (!next) {
      g.route = undefined
      g.routeDist = 0
      return
    }
    const plan = this.roomPlanForHall(g.hallId)
    if (!plan) {
      g.route = []
      g.routeDist = 0
      return
    }
    const route = legRoute(plan, g, next)
    g.route = route ?? []
    g.routeDist = 0
    if (route && route.length && (g.wx == null || g.wz == null)) {
      g.wx = route[0].x
      g.wz = route[0].z
    }
  }

  /** `g.t` stays 0..1 for queues. World position is that fraction along the doorway polyline. */
  private sampleGuestRoute(g: HallGuest) {
    const route = g.route
    if (!route || route.length < 2) return
    const at = pointAlong(route, g.t)
    g.wx = at.x
    g.wz = at.z
    g.wyaw = at.yaw
    g.routeDist = Math.min(1, Math.max(0, g.t)) * polylineLength(route)
  }

  /**
   * One prefab lane serves `servers` people at a time. Everyone else waits.
   * Past the comfort cap the line gets slower and angrier, flights slip,
   * and the advisor asks for an upgrade. Nobody is marked lost.
   */
  tickSecurityLane(g: HallGuest, dt: number, open: Set<HallNode>) {
    const fit = this.fitByKey(g.hallId) ?? this.activeHall() ?? this.fits[0]
    const lane = laneStats({
      premade: fit?.premade ?? false,
      redesigned: fit?.redesigned,
      tier: fit?.tier,
      items: (fit?.items ?? []) as PlacedItem[],
      roomsSecurity: fit?.rooms.security ?? 0,
    })
    if (g.queueSeq == null) g.queueSeq = this.secSeq++
    const peers = this.hallGuests.filter(
      (o) =>
        !o.dead &&
        o.hallId === g.hallId &&
        o.job === 'depart' &&
        o.node === 'security' &&
        !o.clearedSec,
    )
    const wear = Math.max(
      fit?.wearSec ?? 0,
      ...(fit?.items ?? [])
        .filter((i) => String(i.def).startsWith('security'))
        .map((i) => i.wear),
    )
    let svc = slowedService(lane.serviceSec, wear)
    if (!this.staffedPost('security')) svc *= UNSTAFFED_LANE
    const cap = fit?.capGuests ?? 40
    if (peers.length > cap) svc *= overCapMultiplier(peers.length, cap)

    if ((g.serviceLeft ?? 0) > 0) {
      g.serviceLeft = (g.serviceLeft ?? 0) - dt
      g.lost = false
      g.thought = needsMaintenance(wear) ? 'Worn lane — needs a scrub' : 'At the scanner'
      if ((g.serviceLeft ?? 0) <= 0) {
        g.serviceLeft = 0
        g.clearedSec = true
        if (fit) {
          this.bumpWear('sec', lane.wearPerUse)
          const laneItem = fit.items?.find((i) => String(i.def).startsWith('security'))
          if (laneItem) laneItem.wear = Math.min(100, laneItem.wear + lane.wearPerUse)
        }
        g.thought = 'Cleared security — the gates are open'
        if (g.needs.bladder > 62 && open.has('bathroom')) this.routeGuest(g, 'bathroom', open)
        else if (g.needs.hunger > 58 && open.has('food')) this.routeGuest(g, 'food', open)
        else if (g.needs.shop > 70 && open.has('shop')) this.routeGuest(g, 'shop', open)
        else if (open.has('gate')) this.routeGuest(g, 'gate', open)
      }
      return
    }

    if (lane.servers <= 0) {
      const prefab = Boolean(fit?.premade && !fit?.redesigned)
      if (prefab) {
        g.lost = false
        g.thought = 'Lane closed — waiting'
        g.happiness -= dt * 1.2
        return
      }
      g.lost = true
      g.thought = 'Lost — no security lane'
      g.happiness -= dt * 2
      return
    }

    const serving = peers.filter((o) => (o.serviceLeft ?? 0) > 0).length
    const idle = peers
      .filter((o) => (o.serviceLeft ?? 0) <= 0)
      .sort((a, b) => (a.queueSeq ?? 0) - (b.queueSeq ?? 0))
    const idx = idle.findIndex((o) => o.id === g.id)
    const slots = Math.max(0, lane.servers - serving)
    if (idx >= 0 && idx < slots) {
      g.serviceLeft = svc
      g.lost = false
      g.thought = 'Stepping into the lane'
      return
    }
    const overComfort = idx >= lane.queueCap + slots || peers.length > cap
    if (overComfort) this.markHallOverloaded()
    if (idx >= lane.queueCap + slots) {
      g.lost = false
      g.thought = 'Long security line — the hall is over capacity'
      g.happiness -= dt * 2.4
      g.patience -= dt * 1.1
      this.delayGuestFlight(g)
      return
    }
    g.lost = false
    g.thought = `Security queue — ${Math.max(1, idx - slots + 1)} ahead`
    g.happiness -= dt * (peers.length > cap ? 1.4 : 0.7)
  }

  /** Once per flight: slip the slot and nick Standing when the line is too long. */
  delayGuestFlight(g: HallGuest) {
    if (!g.flightId || this.queueDelayFlight.has(g.flightId)) return
    this.queueDelayFlight.add(g.flightId)
    const slot = this.schedule.find(
      (s) => s.flightId === g.flightId && s.status !== 'done' && s.status !== 'cancelled',
    )
    if (slot) this.delaySlot(slot, 10, 'Security queue')
    else if (g.airlineId) this.adjustHeat(g.airlineId as AirlineId, -0.45)
  }

  markHallOverloaded() {
    if (this.hallOverloaded) return
    this.hallOverloaded = true
    this.reputation = Math.max(0, this.reputation - 1)
    for (const id of this.signed) this.adjustHeat(id, -1.2)
    this.pushNews(
      'Hall over capacity — long queues, delays, and missed flights. Upgrade the prefab, expand the lanes, or design your own terminal.',
      'bad',
    )
    this.refreshAdvice()
  }

  refreshAdvice() {
    const fit = this.activeHall() ?? this.fits[0]
    if (!fit) {
      this.advice = [...this.groundNotes, ...this.cargoNotes]
      return
    }
    const hall = adviseHall(
      {
        premade: fit.premade,
        redesigned: fit.redesigned,
        tier: fit.tier,
        signs: fit.signs,
        capGuests: fit.capGuests,
        secPerMin: fit.secPerMin,
        zones: fit.zones as ZoneId[][],
        rooms: {
          checkin: fit.rooms.checkin,
          security: fit.rooms.security,
          gate: fit.rooms.gate,
          bagclaim: fit.rooms.bagclaim,
          food: fit.rooms.food,
          souvenir: fit.rooms.souvenir,
          bathroom: fit.rooms.bathroom,
        },
      },
      this.hallOpenFor(fit),
      this.schedule,
      this.hallOverloaded,
    )
    this.advice = [...hall, ...this.groundNotes, ...this.cargoNotes]
    if (this.advisorCells.length) {
      const still = hall.find((a) =>
        a.cells.some((c) => this.advisorCells.some((h) => h.c === c.c && h.r === c.r)),
      )
      if (!still) this.advisorCells = []
    }
    if (this.apronFocus.length) {
      const still = [...this.groundNotes, ...this.cargoNotes].find((a) =>
        a.cells.some((c) => this.apronFocus.some((h) => h.c === c.c && h.r === c.r)),
      )
      if (!still) this.apronFocus = []
    }
  }

  focusAdvice(id: string | null) {
    if (!id) {
      this.advisorCells = []
      this.apronFocus = []
      this.emit()
      return
    }
    const hit = this.advice.find((a) => a.id === id)
    if (hit?.scope === 'apron') {
      const same =
        hit.cells.length === this.apronFocus.length &&
        hit.cells.every((c, i) => c.c === this.apronFocus[i]?.c && c.r === this.apronFocus[i]?.r)
      this.apronFocus = same ? [] : hit.cells
      this.advisorCells = []
      this.emit()
      return
    }
    this.apronFocus = []
    const same =
      hit &&
      hit.cells.length === this.advisorCells.length &&
      hit.cells.every((c, i) => c.c === this.advisorCells[i]?.c && c.r === this.advisorCells[i]?.r)
    this.advisorCells = hit && !same ? hit.cells : []
    this.emit()
  }

  toggleFlows() {
    this.showFlows = !this.showFlows
    this.emit()
  }

  /** Service vehicles on the apron. Empty until a vehicle depot and a fuel farm exist. */
  servicePoses() {
    return this.ensureGround()?.sim.poses() ?? []
  }

  /** Fuel, meals, and how many trucks are out. Null before the depot is built. */
  groundSnapshot() {
    return this.ensureGround()?.snapshot() ?? null
  }

  /** True once the module has released this stand. Flights without a ground turn are clear. */
  groundClear(f: Flight): boolean {
    if (!f.groundTurn) return true
    return this.ground?.isReadyToDepart(f.groundTurn) ?? true
  }

  /** Servings a full shelf holds. Empty rooms hold nothing. */
  shelfCap(kind: 'food' | 'shop'): number {
    let rooms = 0
    let extra = 0
    for (const fit of this.fits) {
      rooms += kind === 'food' ? (fit.rooms.food ?? 0) : (fit.rooms.souvenir ?? 0)
      if (kind === 'food') extra += outletExtraStock((fit.items ?? []) as PlacedItem[])
    }
    return rooms * (kind === 'food' ? 8 : 6) + extra
  }

  /** This airframe uplifts fuel. A zero-fuel type is free to leave. */
  departureNeedsFuel(f: Flight): boolean {
    try {
      return needsFor(f.airframeId).fuelLitres > 0
    } catch {
      const load = AIRFRAMES[f.airframeId]?.fuelLoad
      return load == null ? true : load > 0
    }
  }

  /** Farm, contract, or bowser loads can still put fuel on a wing. */
  fuelOnHand(): boolean {
    const snap = this.groundSnapshot()
    if (snap) return snap.fuelLitres >= 1
    return (
      tilesOf(this.tiles, 'fuel').length > 0 && this.fuelBrand != null && this.fuelLoads >= 1
    )
  }

  /** Empty farm or no contract. Low stock is a delay, not a ground. */
  fuelOutage(f: Flight): boolean {
    if (!this.departureNeedsFuel(f) || f.posted.fuel) return false
    if (!this.fuelOnHand()) return true
    return this.catering?.fuel.isGrounded(f.id) ?? false
  }

  /**
   * Pushback gate. An empty farm holds the aircraft.
   * Any other ramp gap may release once the safety timer runs out, with a Standing hit.
   */
  rampCall(f: Flight, timedOut: boolean): 'hold' | 'ready' | 'short' {
    if (this.departureNeedsFuel(f) && !f.posted.fuel) {
      if (!this.fuelOnHand()) {
        f.fuelHeld = true
        if (f.fuelHeldSince == null) f.fuelHeldSince = this.clock
        this.noteFuelGround(f)
        if (this.clock - f.fuelHeldSince >= FUEL_OUTAGE_SLOT_SEC) this.cancelForFuel(f)
        return 'hold'
      }
      if (f.fuelHeld) {
        f.fuelHeld = false
        f.fuelHeldSince = undefined
        f.phaseTime = 0
        this.fuelHoldNoted.delete(f.id)
        this.ensureLegacyFuel(f)
        this.pushNews(`${f.flightNo} has fuel again. Pushback waits on the bowser.`, 'ok')
        return 'hold'
      }
      this.ensureLegacyFuel(f)
      if (!timedOut) return 'hold'
      return 'short'
    }
    if (f.fuelHeld) {
      f.fuelHeld = false
      f.fuelHeldSince = undefined
      this.fuelHoldNoted.delete(f.id)
    }
    if (this.groundClear(f)) return 'ready'
    if (!timedOut) return 'hold'
    return 'short'
  }

  private noteFuelGround(f: Flight) {
    if (this.fuelHoldNoted.has(f.id)) return
    this.fuelHoldNoted.add(f.id)
    this.adjustHeat(f.airline, -1.6)
    if (f.scheduleId) {
      const slot = this.schedule.find((s) => s.id === f.scheduleId)
      if (slot && slot.status !== 'done' && slot.status !== 'cancelled') {
        this.delaySlot(slot, 12, 'Fuel farm empty')
      }
    }
    this.pushNews(
      `${f.flightNo} grounded — no fuel on the farm. It stays until a load arrives.`,
      'bad',
    )
  }

  /** The empty-farm hold outlasted the departure slot. The flight does not leave. */
  private cancelForFuel(f: Flight) {
    if (f.phase === 'gone') return
    f.phase = 'gone'
    f.fuelHeld = false
    this.fuelHoldNoted.delete(f.id)
    const slot = f.scheduleId ? this.schedule.find((s) => s.id === f.scheduleId) : undefined
    if (slot && slot.status !== 'done' && slot.status !== 'cancelled' && slot.status !== 'inbound') {
      slot.status = 'cancelled'
      this.adjustHeat(slot.airline, slot.manual ? -2.2 : -4.2)
      this.schedule = this.schedule.filter((x) => x.status !== 'cancelled' && x.status !== 'done')
    } else {
      this.adjustHeat(f.airline, -4.2)
    }
    this.pushNews(
      `${f.flightNo} cancelled — no fuel before the departure slot. Standing ${Math.round(this.standingOf(f.airline))}.`,
      'bad',
    )
    this.noteDiplomacyCancel(f.airline, false)
    this.noteCargoCancel(f)
  }

  /** Legacy bowser, once the farm has a load again. The depot module fuels its own turns. */
  private ensureLegacyFuel(f: Flight) {
    if (f.groundTurn || f.posted.fuel || !f.stand || !this.fuelOnHand()) return
    if (this.trucks.some((t) => t.flightId === f.id && t.kind === 'fuel')) return
    const farms = tilesOf(this.tiles, 'fuel').filter((p) => farmBesidePavement(this.tiles, p))
    if (!farms.length) return
    const path = nearestPath(this.tiles, farms[0], [f.stand], 'truck')
    if (!path) return
    f.waitingOn.fuel = true
    this.spawnTruck('fuel', f, path, 'fuel', farms[0])
  }

  /** Hotspot markers. Counts stay in infoLines until the player opens one. */
  infoHotspots(): { id: string; label: string }[] {
    const spots: { id: string; label: string }[] = []
    if (this.fits.length) {
      spots.push({ id: 'queue', label: 'Security' })
      spots.push({ id: 'lost', label: 'Lost passengers' })
      spots.push({ id: 'bags', label: 'Bags' })
      spots.push({ id: 'retail', label: 'Shops' })
    }
    if (tilesOf(this.tiles, 'fuel').length) spots.push({ id: 'fuel', label: 'Fuel farm' })
    else if (!this.fits.length && tilesOf(this.tiles, 'bags').length) {
      spots.push({ id: 'bags', label: 'Bags' })
    }
    return spots
  }

  infoLines(id: string): string[] {
    if (id === 'queue') {
      const q = this.securityQueueCount()
      return [`${q} waiting at security`]
    }
    if (id === 'lost') return [`${this.lostPaxCount()} lost in the hall`]
    if (id === 'bags') {
      const moving = this.flights.filter(
        (f) =>
          !f.cargo &&
          f.phase !== 'gone' &&
          (f.waitingOn.bags || f.waitingOn.bagsLoad || f.boardingSlow),
      ).length
      const reasons = this.schedule.filter((s) => /bag|belt|claim/i.test(s.delayReason ?? '')).length
      return [
        `${moving} turns still waiting on bags`,
        `${reasons} bag delays on the board`,
        `${this.bagsLost} bags lost`,
        `${this.bagsMishandled} mishandled`,
      ]
    }
    if (id === 'fuel') {
      const snap = this.groundSnapshot()
      const grounded = this.flights.filter((f) => f.phase !== 'gone' && this.fuelOutage(f)).length
      const stock = snap
        ? `${Math.round(snap.fuelLitres).toLocaleString('en-US')} L in the farm`
        : `${this.fuelLoads} bowser loads on the farm`
      return [stock, `${grounded} departures grounded for fuel`]
    }
    if (id === 'retail') {
      return [
        `${this.foodShelf} burger servings on the shelf`,
        `${this.shopShelf} souvenirs on the shelf`,
        `$${Math.round(this.lostSpend).toLocaleString('en-US')} lost spend`,
      ]
    }
    return []
  }

  toggleInfo(id: string) {
    this.infoOpen = this.infoOpen === id ? null : id
    this.emit()
  }

  /** One serving back on each shelf that still has a room. A crowd can outrun this. */
  private tickShelves(dt: number) {
    const foodCap = this.shelfCap('food')
    const shopCap = this.shelfCap('shop')
    if (this.foodShelf > foodCap) this.foodShelf = foodCap
    if (this.shopShelf > shopCap) this.shopShelf = shopCap
    this.shelfCool -= dt
    if (this.shelfCool > 0) return
    this.shelfCool = 14
    if (this.foodShelf < foodCap) this.foodShelf += 1
    if (this.shopShelf < shopCap) this.shopShelf += 1
  }

  /** Empty counter: mild mood hit, no cash, a wish, then they leave the queue. */
  private walkOffEmptyShelf(g: HallGuest, pay: number, thought: string, open: Set<HallNode>) {
    if (g.node === 'food') g.needs.hunger = Math.min(g.needs.hunger, 18)
    else g.needs.shop = Math.min(g.needs.shop, 18)
    const bought = this.ensureCatering().stockout(g.id, g.node === 'food' ? 'food' : 'shop')
    const delta = bought.ok ? -1 : bought.happinessDelta
    const wish = bought.ok ? thought : bought.thought
    const lost = bought.ok ? pay : bought.lostSale
    g.happiness += delta
    this.lostSpend += lost
    thought = wish
    const dest: HallNode =
      g.job === 'depart' && open.has('gate')
        ? 'gate'
        : g.job === 'arrive' && open.has('exit')
          ? 'exit'
          : open.has('info')
            ? 'info'
            : g.node
    if (dest !== g.node) this.routeGuest(g, dest, open)
    g.thought = thought
  }

  private ensureGround() {
    const rev = this.mapRev
    if (this.ground && this.groundRev === rev) return this.ground
    if (!this.ground && this.groundRev === rev) return null
    if (this.ground && this.ground.sim.openTurnarounds > 0 && this.groundRev !== rev) return this.ground
    const prev = this.ground?.snapshot()
    const config = buildLogisticsConfig(
      this.tiles,
      this.standAccess,
      tilesOf(this.tiles, 'termbus').length > 0,
    )
    if (!config) {
      this.ground = null
      this.groundRev = rev
      if (this.groundNotes.length) {
        this.groundNotes = []
        this.groundNoteKey = ''
        this.refreshAdvice()
      }
      return null
    }
    if (prev) {
      config.fuelFarm.initialLitres = Math.min(config.fuelFarm.capacityLitres, Math.max(0, prev.fuelLitres))
      config.kitchen.initialMeals = Math.min(config.kitchen.capacityMeals, Math.max(0, prev.meals))
    }
    const first = !this.groundAnnounced
    this.ground = createLogisticsAdapter(
      {
        addMoney: (amount, category) => this.postGroundMoney(amount, category),
        playSound: (cue) => {
          this.noteSound(soundForEvent({ type: cue }, 'logistics'))
        },
        notify: (message, severity) => {
          this.pushNews(message, severity === 'warn' ? 'bad' : 'ok')
        },
        onCargoToArea: (standId, kg) => {
          const inbound = this.ground?.sim.turnaroundAt(standId)?.cargoIn ?? kg
          this.ensureCargo().inbound(standId, kg, inbound)
        },
      },
      config,
    )
    this.groundRev = rev
    if (first) {
      this.groundAnnounced = true
      this.pushNews('Vehicle depot online. Service trucks run the turnarounds from here.', 'good')
    }
    return this.ground
  }

  private postGroundMoney(amount: number, category: string) {
    const book = this.groundBooks
    if (category === 'fuel_sales') book.fuelSales += amount
    else if (category === 'catering_fees') book.cateringFees += amount
    else if (category === 'fuel_purchase') book.fuelPurchase += amount
    else if (category === 'meal_production') book.mealProduction += amount
    else if (category === 'vehicle_upkeep') book.vehicleUpkeep += amount
    else if (category === 'shop_sales') book.shopSales += amount
    else if (category === 'cargo_airport_revenue') book.cargoRevenue += amount
    else if (category === 'cargo_penalty') book.cargoPenalties += amount
    if (amount > 0) {
      this.cash += amount
      this.revenue += amount
      this.noteIncome(amount, this.groundIncomeCategory(category))
      return
    }
    if (amount < 0) {
      this.noteExpense(-amount)
      this.postJournal(this.groundExpenseCategory(category), -amount, this.simMinutes())
      if (!this.sandbox) this.cash += amount
    }
  }

  private groundExpenseCategory(category: string): MoneyCategory {
    if (category === 'fuel_purchase') return 'fuel_purchase'
    if (category === 'meal_production') return 'meal_production'
    if (category === 'vehicle_upkeep') return 'vehicle_upkeep'
    if (category === 'cargo_penalty') return 'penalties'
    return 'building_upkeep'
  }

  private ensureCatering(): CateringBridge {
    return (this.catering ??= new CateringBridge())
  }

  private ensureCargo(): CargoBridge {
    return (this.cargo ??= new CargoBridge({
      postMoney: (amount, category) => this.postGroundMoney(amount, category),
      loaders: () => {
        const sim = this.ground?.sim
        if (!sim) return null
        return {
          reserve: (request) => sim.reserveLoader(request.flightId, request.preferred, request.allowUldFallback),
          release: (id) => sim.releaseLoader(id),
        }
      },
      cue: (name) => this.noteSound(name),
      notify: (message, severity) => this.pushNews(message, severity === 'warn' ? 'bad' : 'ok'),
      onNotes: () => {
        this.cargoNotes = this.cargo?.notes ?? []
        this.refreshAdvice()
      },
      standCell: (standId) => {
        const [c, r] = standId.split(',').map(Number)
        return Number.isFinite(c) && Number.isFinite(r) ? { c, r } : null
      },
    }))
  }

  /** Galley for a parked departure. Null until the truck is booked. */
  galleyFor(flightId: string) {
    return this.catering?.engine.galley(flightId) ?? null
  }

  /** Cargo books. Null until the first parked flight asks for a load. */
  cargoSnapshot() {
    return this.cargo?.adapter.snapshot() ?? null
  }

  /** Loader type held for this flight, if the cargo module reserved one. */
  loaderHold(flightId: string): string | null {
    return this.ground?.sim.vehicles.find((v) => v.heldFor === flightId)?.type ?? null
  }

  /** True once the ramp has a cargo-load service on this stand. */
  cargoLoadArmed(standId: string): boolean {
    const services = this.ground?.sim.turnaroundAt(standId)?.services
    return services?.cargo_load !== undefined
  }

  /** Crew and scissor-lift poses for the catering trucks. */
  cateringPoses() {
    const kitchen = tilesOf(this.tiles, 'kitchen')[0] ?? tilesOf(this.tiles, 'depot')[0] ?? null
    return this.catering?.poses(kitchen) ?? []
  }

  private noteSound(name: string | null) {
    if (!name) return
    this.soundCues.push(name)
    if (this.soundCues.length > 24) this.soundCues.shift()
    if (typeof window === 'undefined') return
    try {
      getAudio().playEvent(name)
    } catch {
      // Headless tests have no audio device.
    }
  }

  private noteCargoDepart(f: Flight) {
    this.cargo?.departed(f.id)
  }

  private noteCargoCancel(f: Flight) {
    this.cargo?.cancel(f.id)
  }

  /** Book galleys, feed the fuel check, and post shop money into the one ledger. */
  private tickCatering(step: number) {
    if (!(step > 0)) return
    const cat = this.ensureCatering()
    const now = this.clock * GAME_MINUTES_PER_SIM_SECOND
    const litres = this.groundSnapshot()?.fuelLitres ?? (this.fuelOnHand() ? 1_000_000 : 0)
    const demands = this.flights
      .filter((f) => f.phase !== 'gone' && this.departureNeedsFuel(f) && !f.posted.fuel)
      .map((f) => ({
        flightId: f.id,
        litres: this.fuelNeedLitres(f),
        departAt: f.fuelHeldSince ?? this.clock,
      }))
    cat.fuel.evaluate(now, litres, demands)
    cat.fuel.events.splice(0)
    const ground = this.ground
    if (ground) {
      for (const f of this.flights) {
        if (!f.groundTurn || f.phase === 'gone') continue
        ground.sim.setFuelHold(f.groundTurn, cat.fuel.isGrounded(f.id))
      }
    }
    cat.engine.tick(now)
    for (const event of cat.engine.drainEvents()) {
      this.noteSound(cateringCue(event))
      if (event.type === 'catering_done') {
        const flight = this.flights.find((f) => f.id === event.flightId)
        if (flight?.groundTurn) {
          flight.caterLevel = 1
          flight.waitingOn.catering = false
          this.ground?.sim.releaseExternalCatering(flight.groundTurn)
        }
      }
    }
    for (const f of this.flights) {
      if (!f.groundTurn || f.phase === 'gone' || f.posted.catering) continue
      if (!cat.engine.isCateringDone(f.id)) continue
      f.caterLevel = 1
      f.waitingOn.catering = false
      this.ground?.sim.releaseExternalCatering(f.groundTurn)
    }
    const gained = cat.engine.revenue - cat.postedRevenue
    if (gained > 0) {
      cat.postedRevenue = cat.engine.revenue
      this.postGroundMoney(gained, 'shop_sales')
    }
    const lost = cat.engine.lostRevenue - cat.postedLost
    if (lost > 0) {
      cat.postedLost = cat.engine.lostRevenue
      this.groundBooks.shopLost += lost
    }
  }

  private fuelNeedLitres(f: Flight): number {
    try {
      return needsFor(f.airframeId).fuelLitres
    } catch {
      return 8_000
    }
  }

  /** Cargo terminal clock matches the ramp: one sim-second is eight game minutes. */
  private tickCargo(step: number) {
    if (!(step > 0)) return
    const cargo = this.ensureCargo()
    cargo.adapter.tick(step * GAME_MINUTES_PER_SIM_SECOND)
    this.cargoNotes = cargo.notes
  }

  /** One game hour is 7.5 sim-seconds, so a sim-second is eight game minutes. */
  private tickGround(step: number) {
    const g = this.ensureGround()
    if (!g) return
    const before = g.completed.length
    g.tick(step * (60 / 7.5))
    if (g.completed.length > before) this.consumeGround(g, before)
    this.syncGroundNotes()
  }

  private consumeGround(
    g: LogisticsAdapter & { sim: LogisticsSim; completed: TurnaroundResult[] },
    before: number,
  ) {
    for (const result of g.completed.slice(before)) {
      const flight = this.flights.find((f) => f.groundTurn === result.standId && f.phase !== 'gone')
      if (flight) {
        flight.posted.fuel = true
        flight.fuelLevel = 1
        flight.waitingOn.fuel = false
        flight.posted.catering = true
        flight.caterLevel = 1
        flight.waitingOn.catering = false
        this.ensureDiplomacy().noteRamp(flight.id, result.delayMinutes, result.causes.includes('late_bags'))
      }
      if (result.delayMinutes <= 1) continue
      const mins = Math.round(result.delayMinutes)
      const why = result.causes[0] ? groundCauseLine(result.causes[0]) : 'The ramp ran past the planned pushback.'
      const id = `delay-${result.standId.replace(',', '-')}`
      const [c, r] = result.standId.split(',').map(Number)
      const delays = this.groundNotes.filter((n) => n.id.startsWith('delay-') && n.id !== id).slice(-3)
      this.groundNotes = [...this.groundNotes.filter((n) => !n.id.startsWith('delay-')), ...delays]
      this.groundNotes.push({
        id,
        title: `Turnaround late, ${mins} min`,
        detail: result.causes.map((cause) => groundCauseLine(cause)).join('. ') || why,
        fix: delayFix(result.causes),
        cells: Number.isFinite(c) && Number.isFinite(r) ? [{ c, r }] : [],
        scope: 'apron',
      })
      if (flight) {
        this.adjustHeat(flight.airline, -1.2)
        if (flight.scheduleId) {
          const slot = this.schedule.find((s) => s.id === flight.scheduleId)
          if (slot && slot.status !== 'done' && slot.status !== 'cancelled') {
            this.delaySlot(slot, Math.min(18, Math.max(6, result.delayMinutes / 8)), why)
          }
        }
      }
    }
  }

  private syncGroundNotes() {
    const g = this.ground
    if (!g) return
    const snap = g.snapshot()
    const cfg = g.sim.config
    const farm = tilesOf(this.tiles, 'fuel')[0]
    const kitchen = tilesOf(this.tiles, 'kitchen')[0]
    const depot = tilesOf(this.tiles, 'depot')[0]
    const stock: Advice[] = []
    if (snap.fuelLitres < cfg.fuelFarm.lowStockLitres && farm) {
      stock.push({
        id: 'low-fuel',
        title: 'Fuel farm running low',
        detail: `${Math.round(snap.fuelLitres).toLocaleString('en-US')} L left in the farm.`,
        fix: 'A tanker rolls when the farm drops under the line. The purchase posts to the books.',
        cells: [farm],
        scope: 'apron',
      })
    }
    if (snap.meals < cfg.kitchen.lowStockMeals) {
      stock.push({
        id: 'low-meals',
        title: 'Catering kitchen running low',
        detail: kitchen
          ? `${snap.meals} meals left in the kitchen.`
          : 'No catering kitchen is on the field, so the galley trucks have nothing to load.',
        fix: kitchen
          ? 'The kitchen keeps cooking. Give it time before the next full bank.'
          : 'Place a catering kitchen beside the service road.',
        cells: kitchen ? [kitchen] : depot ? [depot] : [],
        scope: 'apron',
      })
    }
    const delays = this.groundNotes.filter((n) => n.id.startsWith('delay-')).slice(-4)
    const next = [...stock, ...delays]
    const key = next.map((n) => n.id).join('|')
    this.groundNotes = next
    if (key !== this.groundNoteKey) {
      this.groundNoteKey = key
      this.refreshAdvice()
      return
    }
    for (const note of next) {
      const i = this.advice.findIndex((a) => a.id === note.id)
      if (i >= 0) this.advice[i] = note
    }
  }

  /**
   * Hand a blocked-in aircraft to the ground module.
   * Hall passengers stay on the terminal graph, so a prefab still loses nobody.
   */
  private armGroundTurn(f: Flight): boolean {
    if (!f.stand || f.groundTurn) return Boolean(f.groundTurn)
    const g = this.ensureGround()
    if (!g) return false
    const standId = `${f.stand.c},${f.stand.r}`
    if (!g.sim.config.stands.some((s) => s.id === standId)) return false
    let needs: ReturnType<typeof needsFor>
    try {
      needs = needsFor(f.airframeId)
    } catch {
      return false
    }
    const scheduled = needs.sizeClass === 'L' ? 90 : needs.sizeClass === 'M' ? 55 : 40
    const pax = f.cargo || f.kind === 'freighter' || f.kind === 'military' ? 0 : f.pax
    if (pax > 0) {
      const longHaul = needs.sizeClass === 'L' || f.kind === 'widebody'
      this.ensureCatering().orderFor(
        f.id,
        standId,
        needs.seats,
        pax,
        longHaul,
        this.clock * GAME_MINUTES_PER_SIM_SECOND + Math.max(scheduled, 40),
      )
    }
    const bagUnits = this.bagTags.filter((t) => t.flightId === f.id).length || Math.round(pax * needs.bagsPerPax)
    const hold = AIRFRAMES[f.airframeId]?.cargoHold ?? 0
    const plan = this.ensureCargo().prepare(f.id, f.airframeId, standId, hold, bagUnits)
    try {
      g.onAircraftParked(standId, f.airframeId, scheduled, {
        kind: 'turn',
        departingPax: pax,
        arrivingPax: pax,
        deferCatering: pax > 0,
        flightId: f.id,
        outboundCargoKg: Math.round(plan.tonnes * 1000),
      })
    } catch {
      this.noteCargoCancel(f)
      return false
    }
    f.groundTurn = standId
    return true
  }

  securityQueueCount(): number {
    return this.hallGuests.filter(
      (g) =>
        !g.dead &&
        g.job === 'depart' &&
        g.node === 'security' &&
        !g.clearedSec &&
        (g.serviceLeft ?? 0) <= 0,
    ).length
  }

  lostPaxCount(): number {
    return this.hallGuests.filter((g) => !g.dead && g.lost).length
  }

  /** Drop a departure wave at the doors so the lane can be watched. */
  demoHallCrowd(n = 8) {
    const fit = this.activeHall() ?? this.fits[0]
    if (!fit) return 0
    const open = this.hallOpenFor(fit)
    const hallId = this.hallKey(fit)
    for (let i = 0; i < n; i++) {
      const g = spawnHallGuest(`demo-${this.secSeq}-${i}`, 'depart', i % 2 ? 'family' : 'budget', {
        hallId,
      })
      g.node = 'entrance'
      g.clearedSec = false
      g.needs.hunger = 12
      g.needs.bladder = 10
      g.needs.shop = 8
      g.needs.play = 8
      g.needs.energy = 15
      g.needs.boarding = 70
      this.routeGuest(g, 'checkin', open)
      this.hallGuests.push(g)
    }
    this.emit()
    return this.hallGuests.length
  }

  /**
   * Line the hall up for a still: check-in with bags, the scanner and belt,
   * a sort pile, and a claim carousel with people waiting and one pickup.
   * Pairs with a loaded bag cart on the apron.
   */
  demoBagParade() {
    const fit = this.activeHall() ?? this.fits[0]
    if (!fit) return 0
    const hallId = this.hallKey(fit)
    this.hallGuests = this.hallGuests.filter((g) => !g.id.startsWith('parade-'))
    const tags: Array<'premium' | 'family' | 'business' | 'budget'> = [
      'premium',
      'family',
      'business',
      'budget',
    ]
    for (let i = 0; i < 7; i++) {
      const g = spawnHallGuest(`parade-d-${i}`, 'depart', tags[i % 4], {
        hallId,
        airlineId: 'northline',
      })
      g.node = 'checkin'
      g.path = []
      g.seg = 0
      g.t = 0
      g.clearedSec = false
      g.hasChecked = true
      g.carryOn = true
      g.bagsDropped = false
      g.bagDepositLeft = 8
      g.needs.hunger = 4
      g.needs.boarding = 80
      g.thought = i % 2 === 0 ? 'Dropping bags at check-in…' : 'Rolling a bag to check-in'
      this.hallGuests.push(g)
    }
    for (let i = 0; i < 3; i++) {
      const g = spawnHallGuest(`parade-s-${i}`, 'depart', 'budget', {
        hallId,
        airlineId: 'northline',
      })
      g.node = 'security'
      g.path = []
      g.clearedSec = false
      g.hasChecked = false
      g.carryOn = true
      g.bagsDropped = true
      g.thought = 'Bags accepted — walking to security'
      this.hallGuests.push(g)
    }
    for (let i = 0; i < 6; i++) {
      const g = spawnHallGuest(`parade-a-${i}`, 'arrive', i % 2 ? 'family' : 'premium', {
        hallId,
        airlineId: 'northline',
      })
      g.node = 'claim'
      g.path = []
      g.clearedSec = true
      g.hasChecked = i === 0
      g.carryOn = true
      g.needs.bags = i === 0 ? 0 : 60
      g.needs.hunger = 4
      g.thought = i === 0 ? 'Got my bag' : 'Waiting for bags off the aircraft…'
      this.hallGuests.push(g)
    }
    this.bagShow = { belt: true, screen: true, carousel: true, sort: true, phase: 0.35 }
    this.bagPhase = 0.35
    const bags = tilesOf(this.tiles, 'bags')[0]
    this.trucks = this.trucks.filter((t) => t.id !== 'parade-cart')
    if (bags) {
      const cart: Truck = {
        id: 'parade-cart',
        kind: 'bags',
        flightId: null,
        x: bags.c + 0.35,
        y: bags.r + 0.15,
        path: [
          { c: bags.c, r: bags.r },
          { c: bags.c + 1, r: bags.r },
        ],
        seg: 0,
        t: 0.15,
        returning: false,
        dwell: 30,
        preDwell: 30,
        patrol: false,
        mission: 'load',
        home: bags,
        cargoUnits: 22,
      }
      this.trucks.push(cart)
    }
    this.emit()
    return this.hallGuests.filter((g) => g.id.startsWith('parade-')).length
  }

  upgradeHall() {
    const fit = this.activeHall()
    if (!fit) {
      this.pushNews('Stamp a terminal first.', 'bad')
      this.emit()
      return
    }
    if (!fit.premade || fit.redesigned) {
      this.pushNews('Custom hall — raise the ceilings by placing bigger items.', 'bad')
      this.emit()
      return
    }
    const tier = (fit.tier ?? 1) as 1 | 2 | 3
    if (tier >= 3) {
      this.pushNews('Prefab is already the top tier.', 'ok')
      this.emit()
      return
    }
    const next = (tier + 1) as 2 | 3
    const cost = next === 2 ? 22000 : 48000
    if (!this.spend(cost, `prefab tier ${next}`)) return
    fit.tier = next
    fit.zones = schemeZones(next)
    fit.items = schemeItems(next)
    fit.signs = schemeSigns(next)
    if (next === 2) {
      fit.rooms.security = Math.max(fit.rooms.security, 3)
      fit.rooms.gate = Math.max(fit.rooms.gate, 3)
      fit.rooms.bathroom = Math.max(fit.rooms.bathroom, 3)
      fit.rooms.food = Math.max(fit.rooms.food, 2)
    } else {
      fit.rooms.security = Math.max(fit.rooms.security, 4)
      fit.rooms.gate = Math.max(fit.rooms.gate, 4)
      fit.rooms.bathroom = Math.max(fit.rooms.bathroom, 4)
      fit.rooms.food = Math.max(fit.rooms.food, 2)
      fit.rooms.souvenir = Math.max(fit.rooms.souvenir, 2)
    }
    applyCeilings(fit)
    this.foodShelf = Math.max(this.foodShelf, Math.min(this.shelfCap('food'), this.foodShelf + 8))
    this.shopShelf = Math.max(this.shopShelf, Math.min(this.shelfCap('shop'), this.shopShelf + 6))
    this.hallOverloaded = false
    this.hallRev++
    this.refreshAdvice()
    this.pushNews(
      `${schemeLabel(next)} — ${fit.capGuests} passengers, security ${Math.round(fit.secPerMin ?? 0)}/min, bags ${fit.bagAllowance}. Upkeep is higher.`,
      'good',
    )
    this.emit()
  }

  paintHallCell(c: number, r: number, zone: ZoneId) {
    const fit = this.activeHall()
    if (!fit) return
    if (!fit.zones?.length) fit.zones = fit.premade ? prefabZones() : blankZones()
    const row = fit.zones[r]
    if (!row || c < 0 || c >= row.length) return
    if (row[c] === zone) return
    const wasPrefab = fit.premade && !fit.redesigned
    row[c] = zone
    if (wasPrefab) {
      fit.redesigned = true
      applyCeilings(fit)
      this.pushNews(
        `Custom layout — the prefab discount is gone. Upkeep is now $${Math.round(
          ceilingsFor({
            premade: fit.premade,
            redesigned: true,
            tier: fit.tier,
            items: (fit.items ?? []) as PlacedItem[],
            roomsSecurity: fit.rooms.security,
          }).upkeepDay,
        )}/day.`,
        'ok',
      )
    }
    this.hallRev++
    this.refreshAdvice()
    this.emit()
  }

  placeHallItem(id: ItemId) {
    const fit = this.activeHall()
    if (!fit) {
      this.pushNews('Open a hall first.', 'bad')
      this.emit()
      return
    }
    const def = itemDef(id)
    if (!def) return
    if (this.fieldLevel() < def.minFieldLevel) {
      this.pushNews(`${def.name} needs Field level ${def.minFieldLevel}.`, 'bad')
      this.emit()
      return
    }
    if (!fit.zones?.length) fit.zones = fit.premade ? prefabZones() : blankZones()
    const items = (fit.items ?? []) as PlacedItem[]
    // Ignore cash here so a broke player still hears "not enough cash" from spend().
    const room = { fieldLevel: this.fieldLevel(), cash: Infinity }
    let cell: { c: number; r: number } | null = null
    for (let r = 0; r < fit.zones.length && !cell; r++) {
      for (let c = 0; c < fit.zones[r].length; c++) {
        if (placementCheck(fit.zones, items, def, c, r, room).ok) {
          cell = { c, r }
          break
        }
      }
    }
    if (!cell) {
      this.pushNews(`Paint a ${def.zones.join(' / ')} cell before placing ${def.name}.`, 'bad')
      this.emit()
      return
    }
    this.commitHallItem(id, cell.c, cell.r, 0)
  }

  /** Ghost check for the hall build bar. Same rules as the click. */
  hallPlacement(id: ItemId, c: number, r: number): PlacementCheck {
    const fit = this.activeHall()
    const def = itemDef(id)
    if (!fit || !def) return { ok: false, reason: 'Open a hall first', cost: def?.cost ?? 0 }
    const zones = fit.zones?.length ? fit.zones : fit.premade ? prefabZones() : blankZones()
    return placementCheck(zones, (fit.items ?? []) as PlacedItem[], def, c, r, {
      fieldLevel: this.fieldLevel(),
      cash: this.cash,
      sandbox: this.sandbox,
    })
  }

  /** Place one item on a chosen cell, snapped, with a quarter-turn rotation. */
  placeHallItemAt(id: ItemId, c: number, r: number, rot = 0): boolean {
    const check = this.hallPlacement(id, c, r)
    if (!check.ok) {
      this.pushNews(`${itemDef(id)?.name ?? 'Item'}: ${check.reason}.`, 'bad')
      this.emit()
      return false
    }
    return this.commitHallItem(id, c, r, rot)
  }

  private commitHallItem(id: ItemId, c: number, r: number, rot: number): boolean {
    const fit = this.activeHall()
    const def = itemDef(id)
    if (!fit || !def) return false
    if (!fit.zones?.length) fit.zones = fit.premade ? prefabZones() : blankZones()
    if (!this.spend(def.cost, def.name)) return false
    fit.items = fit.items ?? []
    this.hallItemSeq += 1
    fit.items.push({
      id: `it-${id}-${c}-${r}-${this.hallItemSeq}`,
      def: id,
      c,
      r,
      wear: 0,
      rot: ((Math.round(rot) % 4) + 4) % 4,
    })
    if (def.room) fit.rooms[def.room] += 1
    if (def.room === 'food') this.foodShelf += 8
    if (def.signs) fit.signs = (fit.signs ?? 0) + def.signs
    applyCeilings(fit)
    this.hallRev++
    this.pushNews(
      `${def.name} placed — $${def.upkeep}/day upkeep${def.perk ? `. ${def.perk}.` : '.'}`,
      'ok',
    )
    this.refreshAdvice()
    this.emit()
    return true
  }

  /** Bulldoze a placed hall item for a partial refund. Prefab bundle pieces stay. */
  removeHallItem(itemId: string): boolean {
    const fit = this.activeHall()
    const list = fit?.items ?? []
    const i = list.findIndex((it) => it.id === itemId)
    if (!fit || i < 0) return false
    const it = list[i]
    const def = itemDef(it.def)
    if (it.bundle || !def) {
      this.pushNews('Part of the prefab bundle — it stays with the hall.', 'bad')
      this.emit()
      return false
    }
    list.splice(i, 1)
    if (def.room) fit.rooms[def.room] = Math.max(0, fit.rooms[def.room] - 1)
    if (def.signs) fit.signs = Math.max(0, (fit.signs ?? 0) - def.signs)
    const refund = refundFor(def)
    this.cash += refund
    applyCeilings(fit)
    this.hallRev++
    this.pushNews(`${def.name} removed — refunded $${refund.toLocaleString('en-US')}.`, 'ok')
    this.refreshAdvice()
    this.emit()
    return true
  }

  /**
   * RCT-style purchase — prefs + wallet + price sensitivity gate the spend.
   * Desperate needs (hunger/energy) can override weak prefs, not empty wallets.
   */
  tryGuestPay(
    g: HallGuest,
    pay: number,
    kind: SpendKind,
    desperate = false,
  ): { ok: boolean; why?: string } {
    if (pay <= 0) return { ok: true }
    const pref = g.prefs[kind] ?? 0
    if (!desperate && pref < 0.28) {
      return { ok: false, why: 'not interested' }
    }
    if (g.wallet < pay) {
      return { ok: false, why: 'broke' }
    }
    // Won't blow most of the wallet on a weak preference (RCT "too expensive").
    const maxShare = desperate ? 0.55 + pref * 0.4 : 0.22 + pref * 0.55
    if (pay > g.wallet * maxShare + 0.01) {
      return { ok: false, why: 'too expensive' }
    }
    g.wallet -= pay
    g.spent += pay
    this.cash += pay
    this.revenue += pay
    this.noteIncome(pay, 'retail_sales')
    // Passenger spend covers amenity / landside expense in the payroll window.
    this.landsideFeeWindow += pay
    return { ok: true }
  }

  /** Uncleared body on airside — eject + fine + heat. */
  secureBreach(g: HallGuest) {
    if (g.clearedSec || !isAirside(g.node)) return
    const open = this.hallOpen()
    g.path = []
    g.seg = 0
    g.t = 0
    g.node = open.has('security') ? 'security' : 'entrance'
    g.happiness -= 12
    g.thought = 'Security pulled me — breach'
    this.securityIncidents += 1
    this.charge(1800)
    this.reputation = Math.max(0, this.reputation - 2)
    const aid = this.guestAirlineId(g)
    if (aid) this.adjustHeat(aid, -3)
    this.pushNews(
      `Secure-zone breach — fine $1,800. Uncleared pax cannot walk airside.`,
      'bad',
    )
  }

  serveNode(g: HallGuest, open: Set<HallNode>) {
    const n = g.node
    if (n === 'info') {
      g.patience = Math.min(100, g.patience + 8)
      g.happiness += 2
      g.lost = false
      g.thought = 'Got directions'
      // Info desk extends lookahead once — like an RCT park map.
      const need = strongestNeed(g)
      if (need) {
        const dest = reachableNeed(need, g.job, open)
        if (dest) this.routeGuest(g, dest, open)
      }
    }
    if (n === 'checkin' && g.job === 'depart') {
      if (!this.staffedPost('checkin')) {
        g.thought = 'Empty check-in — waiting on a clerk'
        g.happiness -= 1.5
        g.needs.boarding = Math.max(0, g.needs.boarding - 1.5)
        return
      }
      // Manor Lords deposit: hold at desk while bags go on the belt.
      if (!g.bagsDropped) {
        if (g.bagDepositLeft == null) {
          const units = bagUnitsForTag(g.tag)
          g.bagDepositLeft = clamp(0.55 + units * 0.55, 0.55, 2.8)
          const fl = this.flights.find((x) => x.id === g.flightId)
          if (fl) {
            fl.bagStage = 'pax_deposit'
            fl.bagsDeposited = fl.bagsDeposited ?? 0
          }
        }
        g.thought =
          bagUnitsForTag(g.tag) >= 2
            ? 'Depositing heavy bags — wait for the belt…'
            : 'Dropping bags at check-in…'
        return
      }
      g.thought = 'Checked in — bags on the belt · next security'
      g.happiness += 1
      if (open.has('security')) this.routeGuest(g, 'security', open)
      else {
        g.thought = 'No security lane — cannot reach the gate'
        g.happiness -= 2
      }
    }
    if (n === 'security' && g.job !== 'depart') {
      g.clearedSec = true
    }
    if (n === 'gate' && g.job === 'depart') {
      if (!this.staffedPost('gate')) {
        g.thought = 'Boarding desk empty — holding'
        g.happiness -= 1
        g.needs.boarding = Math.max(0, g.needs.boarding - 1)
      } else if (!g.thought.includes('Cleared')) {
        g.thought = 'Gate agent ready — boarding'
        g.happiness += 1
      }
    }
    if (n === 'bathroom') {
      const wear = this.bumpWear(
        'bath',
        g.tag === 'budget' ? 2.8 : g.tag === 'family' ? 1.8 : 0.7,
      )
      const relief = wear >= 60 ? 30 : wear >= 35 ? 42 : 55
      g.needs.bladder = Math.max(0, g.needs.bladder - relief)
      g.happiness += wear >= 60 ? -2 : 4
      g.thought = wear >= 60 ? 'WC was rough' : 'Relief'
    }
    if (n === 'food') {
      let pay = tagPrice(g.tag, 12, 18, 24, 32)
      let happy = 6
      let brand = false
      const homeFit = this.fitByKey(g.hallId) ?? this.activeHall()
      const outlet = pickOutlet((homeFit?.items ?? []) as PlacedItem[], g.tag)
      if (outlet) {
        pay = Math.round(pay * outlet.spec.priceMult)
        happy = outlet.spec.joy
      }
      if (g.airlineId && this.hasReward(g.airlineId, 'budget_perk')) {
        pay = Math.round(pay * 1.55)
        happy += 2
        brand = true
      }
      if (this.foodShelf < 1) {
        this.walkOffEmptyShelf(g, pay, 'wish they had burgers', open)
      } else {
      const buy = this.tryGuestPay(g, pay, 'food', g.needs.hunger >= 70)
      if (!buy.ok) {
        g.needs.hunger = Math.max(0, g.needs.hunger - 12)
        g.happiness -= buy.why === 'broke' ? 3 : 1
        g.thought =
          buy.why === 'broke'
            ? 'Hungry but broke'
            : buy.why === 'too expensive'
              ? 'Meal too pricey for my wallet'
              : 'Skipped the counter — not hungry for that'
      } else {
        g.needs.hunger = Math.max(0, g.needs.hunger - (outlet?.spec.hunger ?? 50))
        if (outlet) {
          g.needs.energy = Math.max(0, g.needs.energy - outlet.spec.energy)
          outlet.item.revenue = (outlet.item.revenue ?? 0) + pay
          this.foodCourtRevenue += pay
        }
        this.foodShelf -= 1
        this.mealSold = true
        g.happiness += happy
        g.thought = brand
          ? `${this.airline(g.airlineId!).name} franchise meal (−$${pay})`
          : outlet
            ? `${itemDef(outlet.item.def)?.name ?? 'Ate'} (−$${pay})`
            : `Ate (−$${pay})`
      }
      }
    }
    if (n === 'shop') {
      const pay = tagPrice(g.tag, 14, 24, 36, 48)
      if (this.shopShelf < 1) {
        this.walkOffEmptyShelf(g, pay, 'wish they had a souvenir', open)
      } else {
      const buy = this.tryGuestPay(g, pay, 'shop', g.needs.shop >= 75)
      if (!buy.ok) {
        g.needs.shop = Math.max(0, g.needs.shop - 20)
        g.happiness -= buy.why === 'broke' ? 2 : 0
        g.thought =
          buy.why === 'broke'
            ? 'Wanted a gift — wallet empty'
            : buy.why === 'too expensive'
              ? 'Souvenir — not blowing the trip fund'
              : 'Browsed, did not buy'
      } else {
        g.needs.shop = Math.max(0, g.needs.shop - 60)
        this.shopShelf -= 1
        g.happiness += 5
        g.thought = `Bought a souvenir (−$${pay})`
      }
      }
    }
    if (n === 'lounge' && tagSpendsUp(g.tag)) {
      g.needs.energy = Math.max(0, g.needs.energy - 45)
      let happy = 8
      let pay = 0
      if (g.airlineId && this.hasReward(g.airlineId, 'brand_lounge')) {
        pay = tagPrice(g.tag, 40, 45, 55, 65)
        const buy = this.tryGuestPay(g, pay, 'lounge', g.needs.energy >= 60)
        if (buy.ok) {
          happy += 10
          g.thought = `${this.airline(g.airlineId).name} first-class lounge (−$${pay})`
          this.adjustHeat(g.airlineId, 0.2)
        } else {
          g.thought =
            buy.why === 'broke' || buy.why === 'too expensive'
              ? 'Lounge fee too rich'
              : 'Skipped the branded lounge'
          happy = 3
        }
      } else {
        g.thought = 'Lounge calm'
      }
      g.happiness += happy
    }
    if (n === 'dayhotel') {
      const pay = g.transfer
        ? tagPrice(g.tag, 40, 52, 65, 78)
        : tagPrice(g.tag, 22, 32, 44, 55)
      const buy = this.tryGuestPay(g, pay, 'nap', g.transfer || g.needs.energy >= 70)
      if (!buy.ok) {
        g.needs.energy = Math.max(0, g.needs.energy - 10)
        g.happiness -= buy.why === 'broke' ? 2 : 0
        g.thought =
          buy.why === 'broke' || buy.why === 'too expensive'
            ? 'Day room too expensive'
            : 'Skipped the day room'
      } else {
        g.needs.energy = Math.max(0, g.needs.energy - 55)
        g.needs.boarding = Math.min(99, g.needs.boarding + 8)
        g.happiness += g.transfer ? 12 : 7
        g.thought = g.transfer
          ? `Day room nap (−$${pay}) — layover gold`
          : `Rented a day room (−$${pay})`
        this.noteLandsideUse(2)
        if (g.transfer && g.airlineId) this.adjustHeat(g.airlineId, 0.15)
      }
    }
    if (n === 'golf') {
      const pay = tagPrice(g.tag, 22, 32, 45, 58)
      const buy = this.tryGuestPay(g, pay, 'play', g.needs.play >= 70)
      if (!buy.ok) {
        g.needs.play = Math.max(0, g.needs.play - 15)
        g.thought =
          buy.why === 'broke' || buy.why === 'too expensive'
            ? 'Golf bay — no cash'
            : 'Skipped golf'
      } else {
        g.needs.play = Math.max(0, g.needs.play - 70)
        g.needs.energy = Math.max(0, g.needs.energy - 20)
        g.happiness += 10
        g.thought = `Indoor golf (−$${pay})`
      }
    }
    if (n === 'waterfall') {
      const pay = tagPrice(g.tag, 10, 16, 28, 38)
      const buy = this.tryGuestPay(g, pay, 'play', g.needs.play >= 65)
      if (!buy.ok) {
        g.needs.play = Math.max(0, g.needs.play - 12)
        g.needs.energy = Math.max(0, g.needs.energy - 8)
        g.thought = 'Looked at the falls for free'
        g.happiness += 2
      } else {
        g.needs.play = Math.max(0, g.needs.play - 55)
        g.needs.energy = Math.max(0, g.needs.energy - 25)
        g.happiness += 9
        g.thought = `Falls tip (−$${pay})`
      }
    }
    if (n === 'gaming') {
      const pay = tagPrice(g.tag, 16, 24, 34, 44)
      const buy = this.tryGuestPay(g, pay, 'play', g.needs.play >= 70)
      if (!buy.ok) {
        g.needs.play = Math.max(0, g.needs.play - 15)
        g.thought =
          buy.why === 'broke' || buy.why === 'too expensive'
            ? 'Games — wallet dry'
            : 'Skipped the den'
      } else {
        g.needs.play = Math.max(0, g.needs.play - 65)
        g.happiness += 7
        g.thought = `Gaming den (−$${pay})`
      }
    }
    if (n === 'spa') {
      const pay = g.transfer
        ? tagPrice(g.tag, 48, 58, 72, 85)
        : tagPrice(g.tag, 28, 40, 52, 62)
      const buy = this.tryGuestPay(g, pay, 'lounge', g.needs.energy >= 65 || g.transfer)
      if (!buy.ok) {
        g.needs.energy = Math.max(0, g.needs.energy - 12)
        g.thought =
          buy.why === 'broke' || buy.why === 'too expensive'
            ? 'Massage chairs — too rich'
            : 'Skipped the spa'
        g.happiness -= buy.why === 'broke' ? 1 : 0
      } else {
        g.needs.energy = Math.max(0, g.needs.energy - 50)
        g.needs.boarding = Math.min(99, g.needs.boarding + 5)
        g.happiness += tagSpendsUp(g.tag) ? 12 : 8
        g.thought = `Massage spa (−$${pay})`
        if (g.airlineId && tagSpendsUp(g.tag)) this.adjustHeat(g.airlineId, 0.12)
      }
    }
    if (n === 'pool') {
      const pay = g.transfer
        ? tagPrice(g.tag, 28, 38, 48, 58)
        : tagPrice(g.tag, 16, 24, 34, 44)
      const buy = this.tryGuestPay(g, pay, 'play', g.needs.play >= 60 || g.transfer)
      if (!buy.ok) {
        g.needs.play = Math.max(0, g.needs.play - 12)
        g.needs.energy = Math.max(0, g.needs.energy - 6)
        g.thought = buy.why === 'broke' ? 'Pool — no cash' : 'Skipped the pool'
      } else {
        g.needs.play = Math.max(0, g.needs.play - 55)
        g.needs.energy = Math.max(0, g.needs.energy - 30)
        g.happiness += 9
        g.thought = `Airside pool (−$${pay})`
      }
    }
    if (n === 'gate' && g.job === 'depart') {
      g.thought = 'At the gate'
      g.needs.boarding = Math.max(g.needs.boarding, 8)
      if (g.needs.hunger < 40 && g.needs.bladder < 40) {
        g.dead = true
        this.paxServed += 1
        this.reputation = Math.min(100, this.reputation + 0.4)
      }
    }
    if (n === 'claim' && g.job === 'arrive') {
      if (g.needs.bags > 0) {
        g.path = []
        g.seg = 0
        g.t = 0
        g.thought = 'Waiting at the carousel'
        return
      }
      g.hasChecked = true
      g.thought = 'Got my bag'
      if (g.needs.hunger > 50 && open.has('food')) this.routeGuest(g, 'food', open)
      else if (g.needs.shop > 45 && open.has('shop')) this.routeGuest(g, 'shop', open)
      else if (open.has('exit')) this.routeGuest(g, 'exit', open)
    }
    if (n === 'food' && g.job === 'arrive') {
      if (open.has('exit')) this.routeGuest(g, 'exit', open)
    }
    if (n === 'shop' && g.job === 'arrive') {
      if (open.has('exit')) this.routeGuest(g, 'exit', open)
    }
    if (n === 'exit' && g.job === 'arrive') {
      // Pick leave mode (hotel overnight / long park / bus / rail) as they exit.
      const aid = this.guestAirlineId(g)
      const persona = aid ? this.airline(aid).persona : 'budget'
      const modes = this.pickGuestMode(g.tag, persona, 'arrive')
      g.preferMode = modes.prefer
      g.arriveMode = modes.actual
      this.applyGuestLandside(g, 'arrive')
      if (!g.thought.startsWith('No ') && !g.thought.includes('Hotel') && !g.thought.includes('park')) {
        g.thought = 'Left the airport'
      }
      g.dead = true
      this.paxServed += 1
      this.reputation = Math.min(
        100,
        this.reputation + (g.happiness >= 55 ? 0.35 : 0.1),
      )
    }
  }

  signFuel(brand: FuelBrand) {
    if (this.fuelBrand === brand) return
    const c = FUEL[brand]
    if (!this.spend(c.sign, `${c.name} contract`)) return
    this.fuelBrand = brand
    this.pushNews(`Signed ${c.name}. Buy loads for the trucks.`, 'ok')
    this.emit()
  }

  buyLoads() {
    if (!this.fuelBrand) {
      this.pushNews('Sign a fuel carrier first.', 'bad')
      return
    }
    const c = FUEL[this.fuelBrand]
    const cost = c.wholesale * LOADS_PER_BUY
    if (!this.spend(cost, 'fuel loads')) return
    this.fuelLoads += LOADS_PER_BUY
    this.pushNews(`Four loads on the farm. ${this.fuelLoads} ready.`, 'ok')
    this.emit()
  }

  signCater(brand: CaterBrand) {
    if (this.caterBrand === brand) return
    const c = CATER[brand]
    if (!this.spend(c.sign, `${c.name} contract`)) return
    this.caterBrand = brand
    this.pushNews(`Signed ${c.name}. Snack bar trucks can bill airlines now.`, 'ok')
    this.emit()
  }

  /** True when a body is working that desk (not on break). */
  staffedPost(post: StaffPost): boolean {
    return this.hallStaff.some((s) => s.node === post && s.stage === 0)
  }

  securityLevel(): number {
    let n = 0
    for (const f of this.fits) {
      n += f.rooms.security
      // Worn lanes soft-cap effective screening.
      if ((f.wearSec ?? 0) >= 70) n -= 1
      else if ((f.wearSec ?? 0) >= 40) n -= 0.5
    }
    if (tilesOf(this.tiles, 'police').length) n += 1
    // Bodies at the lane beat empty desks.
    if (this.staffedPost('security')) n += 0.75
    else if (this.deskStaff < 1 && n > 0) n -= 0.5
    // Underfunded security staff can't staff the lanes they built.
    const staff = this.budgets.security / 100
    if (staff < 0.35) n -= 1
    else if (staff < 0.6) n -= 0.5
    return Math.max(0, Math.floor(n))
  }

  readiness() {
    return {
      stands: tilesOf(this.tiles, 'stand').length,
      fuelContract: Boolean(this.fuelBrand),
      fuelFarm: tilesOf(this.tiles, 'fuel').length > 0,
      fire: tilesOf(this.tiles, 'fire').length > 0,
      police: tilesOf(this.tiles, 'police').length > 0,
      terminal: tilesOf(this.tiles, 'terminal').length > 0,
      security: this.securityLevel(),
      bags: tilesOf(this.tiles, 'bags').length > 0,
      snack: tilesOf(this.tiles, 'snack').length > 0,
      catering: Boolean(this.caterBrand) && tilesOf(this.tiles, 'snack').length > 0,
      cargo: tilesOf(this.tiles, 'cargo').length > 0,
      road: tilesOf(this.tiles, 'road').length >= 3,
      runway: runwayStrips(this.tiles, MIN_RUNWAY).length > 0,
      heavyRunway: this.hasHeavyRunway(),
      helipad: tilesOf(this.tiles, 'helipad').length > 0,
      tower: tilesOf(this.tiles, 'tower').length > 0,
      hangar: tilesOf(this.tiles, 'hangar').length > 0,
      wearBath: this.avgWear().bath,
      wearSec: this.avgWear().sec,
    }
  }

  meetsReq(id: AirlineId): boolean {
    const a = this.airline(id)
    const r = this.readiness()
    if (!r.runway) return false
    if (a.req.heavyRunway && !r.heavyRunway) return false
    if (this.reputation < a.minRep) return false
    const q = a.req
    return (
      r.stands >= q.stands &&
      (!q.fuelContract || r.fuelContract) &&
      (!q.fuelFarm || r.fuelFarm) &&
      (!q.fire || r.fire) &&
      (!q.police || r.police) &&
      (!q.terminal || r.terminal) &&
      r.security >= q.security &&
      (!q.bags || r.bags) &&
      (!q.snack || r.snack) &&
      (!q.catering || r.catering) &&
      (!q.cargo || r.cargo) &&
      (!q.road || r.road) &&
      (!q.tower || r.tower)
    )
  }

  missingReq(id: AirlineId): string[] {
    const a = this.airline(id)
    const r = this.readiness()
    const miss: string[] = []
    if (this.reputation < a.minRep) miss.push(`rep ${a.minRep}+`)
    if (!r.runway) miss.push('runway')
    if (a.req.heavyRunway && !r.heavyRunway) miss.push('heavy runway')
    if (r.stands < a.req.stands) miss.push(`${a.req.stands} stands`)
    if (a.req.fuelContract && !r.fuelContract) miss.push('fuel contract')
    if (a.req.fuelFarm && !r.fuelFarm) miss.push('fuel farm')
    if (a.req.fire && !r.fire) miss.push('fire station')
    if (a.req.police && !r.police) miss.push('police')
    if (a.req.terminal && !r.terminal) miss.push('terminal')
    if (r.security < a.req.security) miss.push(`security ×${a.req.security}`)
    if (a.req.bags && !r.bags) miss.push('bag sort')
    if (a.req.snack && !r.snack) miss.push('snack bar')
    if (a.req.catering && !r.catering) miss.push('catering contract')
    if (a.req.cargo && !r.cargo) miss.push('cargo shed')
    if (a.req.road && !r.road) miss.push('access road')
    if (a.req.tower && !r.tower) miss.push('control tower')
    return miss
  }

  /** Contract checklist — met and missing, player-facing labels. */
  reqReport(id: AirlineId): { label: string; met: boolean }[] {
    const a = this.airline(id)
    const r = this.readiness()
    const rows: { label: string; met: boolean }[] = [
      { label: `Reputation ${a.minRep}+`, met: this.reputation >= a.minRep },
      { label: 'Runway', met: r.runway },
    ]
    if (a.req.heavyRunway) rows.push({ label: 'Heavy runway', met: r.heavyRunway })
    rows.push({
      label: a.req.stands === 1 ? '1 stand' : `${a.req.stands} stands`,
      met: r.stands >= a.req.stands,
    })
    if (a.req.fuelContract) rows.push({ label: 'Fuel contract', met: r.fuelContract })
    if (a.req.fuelFarm) rows.push({ label: 'Fuel farm', met: r.fuelFarm })
    if (a.req.fire) rows.push({ label: 'Fire station', met: r.fire })
    if (a.req.police) rows.push({ label: 'Police post', met: r.police })
    if (a.req.terminal) rows.push({ label: 'Terminal', met: r.terminal })
    if (a.req.security > 0) {
      rows.push({
        label: a.req.security === 1 ? 'Security lane' : `Security ×${a.req.security}`,
        met: r.security >= a.req.security,
      })
    }
    if (a.req.bags) rows.push({ label: 'Bag sort', met: r.bags })
    if (a.req.snack) rows.push({ label: 'Snack bar', met: r.snack })
    if (a.req.catering) rows.push({ label: 'Catering contract', met: r.catering })
    if (a.req.cargo) rows.push({ label: 'Cargo shed', met: r.cargo })
    if (a.req.road) rows.push({ label: 'Access road', met: r.road })
    if (a.req.tower) rows.push({ label: 'Control tower', met: r.tower })
    return rows
  }

  considerOffers() {
    if (this.offer || this.offerCool > 0) return
    const site = this.site ? LAND[this.site] : null
    // Light procedural regionals — keep the phone from always being the same six faces.
    if (
      this.signed.length >= 1 &&
      this.extraAirlines.filter((a) => a.procedural).length < 5 &&
      Math.random() < 0.4
    ) {
      const used = this.allAirlines().map((a) => a.name)
      const proc = createProcAirline(used)
      if (!this.extraAirlines.some((a) => a.id === proc.id)) this.extraAirlines.push(proc)
    }
    const procSigned = this.signed.filter((id) => this.airline(id).procedural).length
    const candidates = this.allAirlines().filter((a) => {
      if (this.signed.includes(a.id)) return false
      if (this.isBanned(a.id)) return false
      if (a.procedural && procSigned >= 3) return false
      if (!this.tierUnlocked(a.tier)) return false
      if (!this.meetsReq(a.id)) return false
      // Start focus biases early letters (never hard-locks the other path).
      if (this.startFocus === 'cargo' && a.kind !== 'cargo' && this.signed.length < 1) {
        return false
      }
      if (this.startFocus === 'pax' && a.kind === 'cargo' && this.signed.length < 1) {
        return Math.random() < 0.12
      }
      if (a.kind === 'cargo' && site && site.cargoMult < 0.9 && Math.random() > 0.35) {
        if (this.startFocus !== 'cargo' && this.startFocus !== 'hybrid') return false
      }
      if (a.kind === 'pax' && this.landsidePaxMult() < 0.9 && Math.random() > 0.35) {
        if (this.startFocus === 'cargo') return false
      }
      return true
    })
    if (!candidates.length) return
    // Prefer lower tier first, then cheaper landing; sprinkle procs after one major.
    candidates.sort((a, b) => {
      if (this.startFocus === 'cargo' || this.startFocus === 'hybrid') {
        if (a.kind === 'cargo' && b.kind !== 'cargo') return -1
        if (b.kind === 'cargo' && a.kind !== 'cargo') return 1
      }
      if (a.tier !== b.tier) return a.tier - b.tier
      if (Boolean(a.procedural) !== Boolean(b.procedural)) return a.procedural ? 1 : -1
      return a.landing - b.landing
    })
    const procs = candidates.filter((c) => c.procedural)
    const cargoFirst = candidates.filter((c) => c.kind === 'cargo')
    const pickA =
      this.startFocus === 'cargo' && cargoFirst.length && this.signed.length < 2
        ? cargoFirst[0]
        : this.signed.length >= 1 && procs.length && Math.random() < 0.4
          ? pick(procs)
          : candidates[0]
    this.offer = { airline: pickA.id, age: 0, deadline: 36 }
    const tag = pickA.procedural ? ' (regional)' : ''
    this.pushNews(
      `${pickA.name}${tag} sent a contract letter — open it on the left before it expires.`,
      'good',
    )
  }

  acceptOffer() {
    if (!this.offer) return
    const id = this.offer.airline
    const a = this.airline(id)
    this.signed.push(id)
    if (this.airlineHeat[id] == null) this.airlineHeat[id] = 70
    this.offer = null
    // First carrier lands fast; later contracts space out so the field can breathe.
    this.offerCool = this.signed.length <= 1 ? 55 + Math.random() * 25 : 85 + Math.random() * 40
    this.spawnCool = Math.min(this.spawnCool, 4)
    this.reputation = Math.min(100, this.reputation + (a.procedural ? 5 : 8))
    this.grantFieldXp(12 + a.tier * 4, 'contract')
    this.seedScheduleForAirline(id, 3)
    this.pushNews(
      `${a.name} (T${a.tier}) signed${a.procedural ? ' · filler' : ''}. Flights hit the timetable.`,
      'good',
    )
    this.emit()
  }

  setScheduleAuto(on: boolean) {
    this.scheduleAuto = on
    this.pushNews(
      on ? 'Tower auto-banking slots again.' : 'Auto schedule off — you own the bank.',
      'ok',
    )
    this.emit()
  }

  openSchedule(): ScheduleSlot[] {
    // Prune orphan inbound slots whose flight already left.
    for (const s of this.schedule) {
      if (s.status === 'inbound' && s.flightId && !this.flights.some((f) => f.id === s.flightId)) {
        s.status = 'done'
      }
    }
    return this.schedule
      .filter((s) => s.status === 'scheduled' || s.status === 'delayed' || s.status === 'inbound')
      .slice()
      .sort((a, b) => a.eta - b.eta)
  }

  seedScheduleForAirline(airlineId: AirlineId, count: number) {
    if (this.isBanned(airlineId)) return
    const a = this.airline(airlineId)
    let t = this.clock + 12 + Math.random() * 10
    const last = this.schedule
      .filter((s) => s.status === 'scheduled' || s.status === 'delayed')
      .sort((x, y) => y.eta - x.eta)[0]
    if (last) t = Math.max(t, last.eta + 16)
    const hub = this.isHub(airlineId)
    const scaled = Math.max(1, Math.round(count * this.diplomacyCapacity(airlineId)))
    const spacing = a.kind === 'cargo'
      ? 22 + Math.random() * 12
      : hub
        ? 12 + Math.random() * 8
        : 18 + Math.random() * 10
    const n = hub ? scaled + 1 : scaled
    for (let i = 0; i < n; i++) {
      this.flightSeq += 1
      const slot: ScheduleSlot = {
        id: uid('slot'),
        airline: airlineId,
        flightNo: `${a.name.slice(0, 2).toUpperCase()}${this.flightSeq}`,
        eta: t + i * spacing,
        status: 'scheduled',
        delaySec: 0,
        delayReason: null,
        manual: false,
        flightId: null,
        standPref: null,
        // Spread auto bank across every stamped strip.
        runwayPref: this.pickBalancedRunway(),
        claimLane: null,
      }
      this.assignSlotClaimLane(slot)
      this.schedule.push(slot)
    }
  }

  /** Player places a slot ~N seconds out for a signed airline. */
  addManualSlot(airlineId: AirlineId, inSeconds = 20) {
    if (!this.signed.includes(airlineId)) {
      this.pushNews('Sign that airline first.', 'bad')
      this.emit()
      return
    }
    if (this.isBanned(airlineId)) {
      this.pushNews(`${this.airline(airlineId).name} is banned — no slots.`, 'bad')
      this.emit()
      return
    }
    const open = this.openSchedule().length
    const cap = this.scheduleCap()
    if (open >= cap) {
      this.pushNews(`Timetable full (${cap}). Cancel or wait.`, 'bad')
      this.emit()
      return
    }
    const a = this.airline(airlineId)
    this.flightSeq += 1
    const eta = this.clock + Math.max(8, inSeconds)
    const rw = this.pickBalancedRunway()
    const slot: ScheduleSlot = {
      id: uid('slot'),
      airline: airlineId,
      flightNo: `${a.name.slice(0, 2).toUpperCase()}${this.flightSeq}`,
      eta,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: null,
      standPref: null,
      runwayPref: rw,
      claimLane: null,
    }
    this.assignSlotClaimLane(slot)
    this.schedule.push(slot)
    this.pushNews(
      `Manual slot ${a.name} ${this.flightSeq} in ${Math.round(eta - this.clock)}s${
        rw != null ? ` · ${this.runwayLabel(rw)}` : ''
      }${slot.claimLane ? ` · claim ${slot.claimLane}` : ''}.`,
      'good',
    )
    this.emit()
  }

  cancelSlot(slotId: string) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || s.status === 'inbound' || s.status === 'done') return
    s.status = 'cancelled'
    // Scrubbing a slot to clear backlog hurts — more if it was an airline-banked flight.
    this.adjustHeat(s.airline, s.manual ? -2.2 : -4.2)
    this.pushNews(
      `Cancelled ${s.flightNo} — ${this.airline(s.airline).name} Standing ${Math.round(this.standingOf(s.airline))}. Bank clears, relations don't.`,
      'bad',
    )
    this.schedule = this.schedule.filter((x) => x.status !== 'cancelled' && x.status !== 'done')
    this.noteDiplomacyCancel(s.airline, /weather|storm|fog/i.test(s.delayReason ?? ''))
    this.emit()
  }

  /** Push a slot later; ripples the bank behind it — costs heat on bumped carriers. */
  bumpSlot(slotId: string, bySec = 18) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    const cascaded = this.delaySlot(s, bySec, 'Tower rearrange', true)
    this.adjustHeat(s.airline, -1.2)
    this.pushNews(
      cascaded > 0
        ? `Bumped ${s.flightNo} — ${cascaded} later slot${cascaded > 1 ? 's' : ''} slid. Airlines notice.`
        : `Bumped ${s.flightNo} +${bySec}s. Standing dips.`,
      'bad',
    )
    this.emit()
  }

  /** Pull a slot earlier (planner craft) — can heat the airline you jump ahead of. */
  pullSlot(slotId: string, bySec = 12) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    const floor = this.clock + 6
    const next = Math.max(floor, s.eta - bySec)
    if (next >= s.eta - 0.5) {
      this.pushNews(`${s.flightNo} already as early as the tower allows.`, 'ok')
      this.emit()
      return
    }
    const jumped = this.openSchedule().filter(
      (x) => x.id !== s.id && x.eta >= next && x.eta < s.eta,
    )
    s.eta = next
    s.delayReason = 'Tower pull-forward'
    if (s.status === 'delayed' && s.delaySec > 0) {
      s.delaySec = Math.max(0, s.delaySec - bySec)
      if (s.delaySec <= 0) s.status = 'scheduled'
    }
    for (const x of jumped.slice(0, 3)) {
      this.adjustHeat(x.airline, -0.8)
    }
    this.pushNews(
      jumped.length
        ? `Pulled ${s.flightNo} ahead of ${jumped.length} — queue Standing dips.`
        : `Pulled ${s.flightNo} — ETA ${Math.round(s.eta - this.clock)}s.`,
      jumped.length ? 'bad' : 'ok',
    )
    this.emit()
  }

  /** Cycle preferred stand: auto → G1 → G2… → auto. */
  cycleSlotStand(slotId: string) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    const stands = tilesOf(this.tiles, 'stand')
    if (!stands.length) {
      this.pushNews('No stands stamped.', 'bad')
      this.emit()
      return
    }
    const key = (v: Vec) => `${v.c},${v.r}`
    const cur = s.standPref ? key(s.standPref) : null
    const idx = cur ? stands.findIndex((st) => key(st) === cur) : -1
    const nextIdx = idx + 1
    if (nextIdx >= stands.length) {
      s.standPref = null
      this.pushNews(`${s.flightNo} stand → tower auto.`, 'ok')
    } else {
      s.standPref = { ...stands[nextIdx] }
      this.pushNews(
        `${s.flightNo} stand → ${this.gateLabel(s.standPref)}.`,
        'ok',
      )
    }
    this.emit()
  }

  /** Pin a slot to a specific stand (or null = tower auto). Planner drag target. */
  setSlotStandPref(slotId: string, stand: Vec | null) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    if (stand) {
      const hit = tilesOf(this.tiles, 'stand').find(
        (st) => st.c === stand.c && st.r === stand.r,
      )
      if (!hit) {
        this.pushNews('That stand is gone.', 'bad')
        this.emit()
        return
      }
      s.standPref = { ...hit }
      this.pushNews(`${s.flightNo} stand → ${this.gateLabel(s.standPref)}.`, 'ok')
    } else {
      s.standPref = null
      this.pushNews(`${s.flightNo} stand → tower auto.`, 'ok')
    }
    this.emit()
  }

  /** Nudge ETA by delta seconds (floor 6s ahead). Planner drag polish. */
  nudgeSlotEta(slotId: string, deltaSec: number) {
    if (deltaSec < 0) this.pullSlot(slotId, Math.abs(deltaSec))
    else if (deltaSec > 0) this.bumpSlot(slotId, deltaSec)
  }

  /** Cycle preferred runway strip across every stamped strip. */
  cycleSlotRunway(slotId: string) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    if (strips.length < 1) {
      this.pushNews('Stamp a strip before assigning runways.', 'ok')
      this.emit()
      return
    }
    const cur = s.runwayPref ?? -1
    const next = cur + 1
    if (next >= strips.length) {
      s.runwayPref = null
      this.pushNews(`${s.flightNo} runway → tower auto.`, 'ok')
    } else {
      s.runwayPref = next
      this.pushNews(
        `${s.flightNo} runway → RW${next + 1} (${strips[next].length}c).`,
        'ok',
      )
    }
    this.emit()
  }

  runwayLabel(pref: number | null | undefined): string {
    if (pref == null) return 'auto'
    return `RW${pref + 1}`
  }

  /** Day-strip window: slots in the next `horizon` sim-seconds. */
  plannerStrip(horizon = 120): {
    horizon: number
    slots: {
      id: string
      flightNo: string
      airline: AirlineId
      t: number
      status: ScheduleStatus
      stand: string
      runway: string
      stolen: boolean
    }[]
    /** Live emergency hosts painted as stolen capacity on the strip. */
    hosts: {
      id: string
      flightNo: string
      kind: EmergencyKind
      stand: string
    }[]
  } {
    const open = this.openSchedule()
    const hosts = this.flights
      .filter(
        (f) =>
          f.emergencyHost &&
          f.phase !== 'gone' &&
          f.phase !== 'takeoff' &&
          f.stand,
      )
      .map((f) => ({
        id: f.id,
        flightNo: f.flightNo,
        kind: (f.hostKind ?? 'divert') as EmergencyKind,
        stand: this.gateLabel(f.stand),
      }))
    return {
      horizon,
      slots: open
        .filter((s) => s.eta <= this.clock + horizon)
        .map((s) => ({
          id: s.id,
          flightNo: s.flightNo,
          airline: s.airline,
          t: Math.max(0, s.eta - this.clock),
          status: s.status,
          stand: s.standPref ? this.gateLabel(s.standPref) : 'auto',
          runway: this.runwayLabel(s.runwayPref),
          stolen:
            /gate|stand|backlog|pavement/i.test(s.delayReason ?? '') &&
            hosts.length > 0 &&
            s.delaySec > 0,
        })),
      hosts,
    }
  }

  /** Active emergency hosts occupying stands (Planner + letters). */
  stolenHosts(): Flight[] {
    return this.flights.filter(
      (f) =>
        f.emergencyHost &&
        f.phase !== 'gone' &&
        f.phase !== 'takeoff' &&
        Boolean(f.stand),
    )
  }

  /** HUD one-liner when apron jam is biting. */
  apronJamLine(): string | null {
    if (this.congPeak < 2 && this.congWasteAcc < 3) return null
    if (this.congPeak >= 3) return `Apron jam ×${this.congPeak} — walks and taxi crawling`
    if (this.congWasteAcc >= 3) return `Traffic neck costing ~${Math.round(this.congWasteAcc)}s`
    return null
  }

  /**
   * First contiguous night band inside the planner horizon (sim day = 180s, night ≥120).
   * Used to paint the night column on the day strip.
   */
  plannerNightBand(horizon = 120): { from: number; to: number } | null {
    let from: number | null = null
    let to = 0
    for (let t = 0; t <= horizon; t++) {
      const night = (this.clock + t) % 180 >= 120
      if (night) {
        if (from == null) from = t
        to = t
      } else if (from != null) {
        break
      }
    }
    if (from == null) return null
    return { from, to }
  }

  /**
   * Delay a slot and cascade later ETAs that would collide.
   * Returns how many downstream slots were pushed (airline heat already applied).
   */
  delaySlot(
    slot: ScheduleSlot,
    sec: number,
    reason: string,
    playerRearrange = false,
  ): number {
    const add = Math.min(22, Math.max(6, sec))
    slot.eta += add
    slot.delaySec = Math.min(120, slot.delaySec + add)
    slot.status = 'delayed'
    slot.delayReason = reason
    // Ripple later slots that would collide — capped so the bank doesn't explode.
    const later = this.schedule
      .filter(
        (x) =>
          x.id !== slot.id &&
          (x.status === 'scheduled' || x.status === 'delayed') &&
          x.eta >= slot.eta - add &&
          x.eta < slot.eta + 40,
      )
      .sort((a, b) => a.eta - b.eta)
      .slice(0, 5)
    let cursor = slot.eta + 14
    let cascaded = 0
    for (const x of later) {
      if (x.eta < cursor) {
        const push = Math.min(18, cursor - x.eta)
        x.eta += push
        x.delaySec = Math.min(120, x.delaySec + push)
        x.status = 'delayed'
        x.delayReason = 'Cascade from earlier delay'
        // Player rearrange hurts relations more than weather acts of god.
        this.adjustHeat(x.airline, playerRearrange ? -1.1 : -0.35)
        cascaded += 1
        cursor = x.eta + 14
      } else {
        cursor = Math.max(cursor, x.eta + 14)
      }
    }
    // Runway backlog is ops pressure, not an airline insult — lighter heat nick.
    const backlog = reason === 'Runway backlog' || reason === 'Pavement busy'
    this.adjustHeat(
      slot.airline,
      playerRearrange ? -0.6 : backlog ? -0.25 : -0.45,
    )
    if (cascaded >= 2 && !playerRearrange && this.cascadeNewsCool <= 0) {
      this.pushNews(
        `Schedule cascade — ${cascaded} flights slid after ${slot.flightNo}.`,
        'bad',
      )
      this.cascadeNewsCool = 22
    }
    return cascaded
  }

  tickSchedule(dt: number) {
    this.schedulePlanCool = Math.max(0, this.schedulePlanCool - dt)
    this.nightCurfewCool = Math.max(0, this.nightCurfewCool - dt)
    this.cascadeNewsCool = Math.max(0, this.cascadeNewsCool - dt)
    this.stormPulseCool = Math.max(0, this.stormPulseCool - dt)
    // Storm pulse — even with de-ice, the bank should feel the weather once a beat.
    if (this.weather === 'storm' && this.stormPulseCool <= 0) {
      const soon = this.openSchedule().find(
        (s) =>
          (s.status === 'scheduled' || s.status === 'delayed') &&
          s.eta - this.clock < 45,
      )
      if (soon) {
        const slip = this.hasResearch('deice') ? 7 + Math.random() * 6 : 12 + Math.random() * 14
        this.delaySlot(soon, slip, 'Storm / dest weather')
        this.stormPulseCool = this.hasResearch('deice') ? 38 : 24
        this.pushNews(
          this.hasResearch('deice')
            ? `${soon.flightNo} storm slip ${Math.round(soon.delaySec)}s — de-ice pads holding the worst of it.`
            : `${soon.flightNo} delayed ${Math.round(soon.delaySec)}s — storm bank. Research De-ice ops.`,
          'bad',
        )
      } else {
        this.stormPulseCool = 12
      }
    }
    // Soft night curfew — pax slip after dark until Night bank is researched.
    if (
      this.isNight() &&
      !this.hasResearch('night_bank') &&
      this.nightCurfewCool <= 0 &&
      Math.random() < dt * 0.055
    ) {
      const soon = this.openSchedule().find((s) => {
        if (s.eta - this.clock > 40) return false
        if (s.status !== 'scheduled' && s.status !== 'delayed') return false
        return this.airline(s.airline).kind === 'pax'
      })
      if (soon) {
        this.delaySlot(soon, 14 + Math.random() * 12, 'Night curfew')
        this.nightCurfewCool = 28
        this.adjustHeat(soon.airline, -0.35)
        this.pushNews(
          `${soon.flightNo} held for night curfew — research Night bank to open the bank after dark.`,
          'bad',
        )
      }
    }
    // Fog slips (storms use the pulse above so the ticker stays readable).
    const fogOdds = dt * 0.02
    if (this.weather === 'fog' && Math.random() < fogOdds) {
      const soon = this.openSchedule().find((s) => s.eta - this.clock < 40)
      if (soon && soon.status === 'scheduled') {
        this.delaySlot(soon, 8 + Math.random() * 10, 'Fog / dest weather')
        this.pushNews(
          `${soon.flightNo} slipped in fog — bank may need a bump.`,
          'bad',
        )
      }
    }
    // Auto-fill timetable — deeper banks when more strips are stamped.
    if (this.scheduleAuto && this.schedulePlanCool <= 0 && this.signed.length) {
      this.schedulePlanCool = 18
      const open = this.openSchedule()
      const want = Math.min(this.scheduleCap() - 2, 4 + this.runwayStripCount() * 2)
      if (open.length < want) {
        const pool = this.signed.filter((id) => !this.isBanned(id))
        if (pool.length) {
          // Bias toward cargo if freighters are starving vs pax bank.
          const cargo = pool.filter((id) => this.airline(id).kind === 'cargo')
          const paxSeen = (this.craftSeen.regional ?? 0) + (this.craftSeen.narrowbody ?? 0)
          const freightSeen = this.craftSeen.freighter ?? 0
          const nightCargo =
            this.hasResearch('night_bank') && this.isNight() && cargo.length
          const pickId =
            nightCargo && Math.random() < 0.7
              ? pick(cargo)
              : cargo.length && freightSeen * 3 < paxSeen && Math.random() < 0.55
                ? pick(cargo)
                : pick(pool)
          const batch = this.runwayStripCount() >= 3 ? 3 : 2
          this.seedScheduleForAirline(pickId, batch)
        }
      }
    }
    // Drop finished noise.
    if (this.schedule.length > 40) {
      this.schedule = this.schedule.filter(
        (s) => s.status === 'scheduled' || s.status === 'delayed' || s.status === 'inbound',
      )
    }
  }

  nextDueSlot(): ScheduleSlot | null {
    const due = this.openSchedule().filter(
      (s) =>
        (s.status === 'scheduled' || s.status === 'delayed') &&
        s.eta <= this.clock + 1.5,
    )
    return due[0] ?? null
  }

  /** Set the contract aside — no Standing hit, they write again soon. */
  snoozeOffer() {
    if (!this.offer) return
    const a = this.airline(this.offer.airline)
    this.offer = null
    this.offerCool = 18
    this.pushNews(`${a.name} letter set aside. They'll write again shortly.`, 'ok')
    this.emit()
  }

  declineOffer() {
    if (!this.offer) return
    const id = this.offer.airline
    const a = this.airline(id)
    this.offer = null
    this.offerCool = 70
    this.adjustHeat(id, -2)
    this.pushNews(`${a.name} hung up. They may call again later.`, 'ok')
    this.emit()
  }

  /** Letter timed out without a decision — soft cool, no heat hit. */
  expireOffer() {
    if (!this.offer) return
    const a = this.airline(this.offer.airline)
    this.offer = null
    this.offerCool = 55
    this.pushNews(`${a.name} contract letter expired unread.`, 'ok')
    this.emit()
  }

  hallReadyForLayover(): boolean {
    const fit = this.activeHall()
    if (!fit) return false
    const food = fit.rooms.food > 0 || tilesOf(this.tiles, 'snack').length > 0
    const shop = fit.rooms.souvenir > 0
    const amenity =
      (fit.rooms.lounge ?? 0) +
        (fit.rooms.golf ?? 0) +
        (fit.rooms.waterfall ?? 0) +
        (fit.rooms.gaming ?? 0) +
        (fit.rooms.spa ?? 0) +
        (fit.rooms.pool ?? 0) >
      0
    return food && (shop || amenity)
  }

  considerLayoverOffers() {
    if (this.layover || this.layoverOffer || this.layoverOfferCool > 0) return
    if (!this.hallReadyForLayover()) return
    const pool = this.signed.filter((id) => {
      const a = this.airline(id)
      return a.kind === 'pax' && a.likesLayovers && !this.isBanned(id) && this.heatOf(id) >= 40
    })
    if (!pool.length) return
    const id = pick(pool)
    const a = this.airline(id)
    const fee = Math.round(
      LAYOVER_FEE_MIN + Math.random() * (LAYOVER_FEE_MAX - LAYOVER_FEE_MIN),
    )
    const duration = 55 + Math.floor(Math.random() * 40)
    const transferPax = 18 + Math.floor(Math.random() * 22) + (a.persona === 'business' ? 8 : 0)
    this.layoverOffer = { airline: id, age: 0, fee, duration, transferPax, deadline: 40 }
    this.pushNews(
      `${a.name} sent a layover letter — $${fee.toLocaleString()} up front, ${transferPax} transfers for ~${duration}s.`,
      'good',
    )
  }

  acceptLayover() {
    if (!this.layoverOffer) return
    const o = this.layoverOffer
    const a = this.airline(o.airline)
    this.earn(o.fee, `${a.name} layover fee`)
    this.layover = {
      airline: o.airline,
      endsAt: this.clock + o.duration,
      remaining: o.duration,
      spawned: 0,
      transferPax: o.transferPax,
      happySum: 0,
      samples: 0,
      fee: o.fee,
    }
    this.layoverOffer = null
    this.layoverOfferCool = 70
    this.layoverSpawnAcc = 0
    this.pushNews(
      `${a.name} layover live — transfers dumping into the hall. Standing ${Math.round(this.standingOf(o.airline))}.`,
      'good',
    )
    this.emit()
  }

  declineLayover() {
    if (!this.layoverOffer) return
    const id = this.layoverOffer.airline
    const a = this.airline(id)
    this.layoverOffer = null
    this.layoverOfferCool = 55
    this.adjustHeat(id, -1.5)
    this.pushNews(`${a.name} layover talk died.`, 'ok')
    this.emit()
  }

  expireLayover() {
    if (!this.layoverOffer) return
    const a = this.airline(this.layoverOffer.airline)
    this.layoverOffer = null
    this.layoverOfferCool = 45
    this.pushNews(`${a.name} layover letter expired.`, 'ok')
    this.emit()
  }

  tickLayover(dt: number) {
    this.layoverOfferCool = Math.max(0, this.layoverOfferCool - dt)
    if (this.layoverOffer) {
      this.layoverOffer.age += dt
      this.layoverOffer.deadline -= dt
      if (this.layoverOffer.deadline <= 0) {
        this.expireLayover()
        return
      }
    }
    this.considerLayoverOffers()
    if (!this.layover) return
    const L = this.layover
    L.remaining = Math.max(0, L.endsAt - this.clock)
    const a = this.airline(L.airline)

    // Soft heat recovery / decay from hall load during the bank.
    const transfers = this.hallGuests.filter((g) => g.transfer && g.airlineId === L.airline)
    if (transfers.length >= 10) this.adjustHeat(L.airline, -0.15 * dt)
    else if (transfers.length && L.samples > 0) {
      const avg = L.happySum / L.samples
      if (avg >= 62) this.adjustHeat(L.airline, 0.12 * dt)
      else if (avg < 45) this.adjustHeat(L.airline, -0.25 * dt)
    }

    // Drip transfer pax into the hall.
    if (L.spawned < L.transferPax && this.fits.length) {
      this.layoverSpawnAcc += dt
      const every = 2.2
      while (this.layoverSpawnAcc >= every && L.spawned < L.transferPax) {
        this.layoverSpawnAcc -= every
        this.spawnTransferGuest(L.airline)
        L.spawned += 1
      }
    }

    if (this.clock >= L.endsAt) {
      const avg = L.samples > 0 ? L.happySum / L.samples : 55
      const heat = this.heatOf(L.airline)
      this.layover = null
      if (avg < 48 || heat < this.banThreshold(L.airline) + 5) {
        this.banAirline(L.airline, avg < 48 ? 'miserable transfers' : 'thin Standing')
      } else {
        this.adjustHeat(L.airline, 8)
        this.reputation = Math.min(100, this.reputation + 3)
        this.layoverWins[L.airline] = (this.layoverWins[L.airline] ?? 0) + 1
        this.pushNews(
          `${a.name} layover cleared — avg happiness ${Math.round(avg)}. They'll be back.`,
          'good',
        )
        this.considerHubOffer(L.airline)
      }
    }
  }

  considerHubOffer(airlineId: AirlineId) {
    if (this.hubOffer || this.isHub(airlineId) || this.isBanned(airlineId)) return
    if (this.hubOfferCool > 0) return
    if ((this.layoverWins[airlineId] ?? 0) < HUB_LAYOVER_WINS) return
    if (this.heatOf(airlineId) < HUB_HEAT_NEED) return
    if (!this.signed.includes(airlineId)) return
    const a = this.airline(airlineId)
    if (a.kind === 'cargo' || a.persona === 'military_gov') return
    const fee =
      HUB_FEE_MIN + Math.floor(Math.random() * (HUB_FEE_MAX - HUB_FEE_MIN))
    this.hubOffer = { airline: airlineId, age: 0, fee, deadline: 45 }
    this.pushNews(
      `${a.name} sent a Hub plaque letter — denser slots + brand lounge for ${moneyLeft(fee)}.`,
      'good',
    )
  }

  acceptHub() {
    if (!this.hubOffer) return
    const o = this.hubOffer
    const a = this.airline(o.airline)
    if (!this.spend(o.fee, `${a.name} Hub plaque`)) {
      this.emit()
      return
    }
    this.hubAirlines.push(o.airline)
    this.hubOffer = null
    this.hubOfferCool = 90
    // Brand lounge room on the active hall.
    const fit = this.activeHall() ?? this.fits[0]
    if (fit) {
      fit.rooms.lounge = (fit.rooms.lounge ?? 0) + 1
    }
    this.seedScheduleForAirline(o.airline, 4)
    this.grantReward(o.airline)
    this.reputation = Math.min(100, this.reputation + 5)
    this.pushNews(
      `${a.name} is a Hub carrier — denser bank, brand lounge live. Don't blow the next layover.`,
      'good',
    )
    this.emit()
  }

  declineHub() {
    if (!this.hubOffer) return
    const id = this.hubOffer.airline
    const a = this.airline(id)
    this.hubOffer = null
    this.hubOfferCool = 70
    this.adjustHeat(id, -2)
    this.pushNews(`${a.name} Hub talk cooled off.`, 'ok')
    this.emit()
  }

  expireHub() {
    if (!this.hubOffer) return
    const a = this.airline(this.hubOffer.airline)
    this.hubOffer = null
    this.hubOfferCool = 55
    this.pushNews(`${a.name} Hub letter expired.`, 'ok')
    this.emit()
  }

  tickHub(dt: number) {
    this.hubOfferCool = Math.max(0, this.hubOfferCool - dt)
    if (this.hubOffer) {
      this.hubOffer.age += dt
      this.hubOffer.deadline -= dt
      if (this.hubOffer.deadline <= 0) this.expireHub()
    }
  }

  tickParking(dt: number) {
    // Independent GA parking — day-rate, leave request, auto/manual release, overstay.
    this.parkRateCool = Math.max(0, this.parkRateCool - dt)
    let dayCharged = false
    for (const f of this.flights) {
      if (f.phase !== 'parked' || !f.ga) continue

      // Soft day-rate while occupying a stand.
      if (!dayCharged && this.parkRateCool <= 0) {
        this.earn(GA_PARK_DAY_RATE, `${f.flightNo} parking day-rate`, f)
        this.parkRateCool = GA_PARK_RATE_COOL
        dayCharged = true
      }

      // After planned stay, pilot requests departure → 20h ops leave window.
      const stayNeed = f.parkStaySec ?? GA_PARK_STAY_MIN
      if (f.parkLeaveRequestedAt == null && f.phaseTime >= stayNeed) {
        f.parkLeaveRequestedAt = this.clock
        f.parkLeaveBy = this.clock + GA_LEAVE_WINDOW
        this.pushNews(
          `${f.flightNo} requests departure — ${Math.round(GA_LEAVE_WINDOW)}s (~20h) to leave or overstay fine. Auto tower ${
            this.scheduleAuto ? 'ON' : 'OFF'
          }.`,
          'ok',
        )
        this.emit()
      }

      if (f.parkLeaveRequestedAt == null || !f.parkLeaveBy) continue
      const left = f.parkLeaveBy - this.clock
      // Auto-schedule: release when leave requested and pavement free.
      if (this.scheduleAuto && f.phaseTime > 4) {
        if (this.releaseGa(f.id, true)) continue
      }
      // Manual players get a nudge near the deadline.
      if (!this.scheduleAuto && left <= 18 && left > 0 && Math.random() < dt * 0.08) {
        this.pushNews(
          `${f.flightNo} leave window closing (${Math.ceil(left)}s) — Release parking or enable auto schedule.`,
          'bad',
        )
      }
      if (this.clock >= f.parkLeaveBy) {
        if (!this.releaseGa(f.id, true)) {
          this.charge(GA_OVERSTAY_FINE)
          this.reputation = Math.max(0, this.reputation - 3)
          this.pushNews(
            `${f.flightNo} overstayed parking — fine ${moneyLeft(GA_OVERSTAY_FINE)}. Stand blocked.`,
            'bad',
          )
          f.parkLeaveBy = this.clock + 28
        }
      }
    }

    if (this.parkingOffer) {
      this.parkingOffer.age += dt
      this.parkingOffer.deadline -= dt
      if (this.parkingOffer.deadline <= 0) {
        this.pushNews(`${this.parkingOffer.callsign} took parking elsewhere.`, 'ok')
        this.parkingOffer = null
        this.parkingCool = 40
      }
      return
    }
    if (
      this.pendingThreat ||
      this.pendingEmergency ||
      this.hubOffer ||
      this.layoverOffer
    ) {
      return
    }
    this.parkingCool -= dt
    if (this.parkingCool > 0 || !this.site) return
    this.parkingCool = 50 + Math.random() * 40
    if (!this.freeStands().length) return
    if (Math.random() > 0.45) return

    const frames = ['citation', 'pc12', 'crj700', 'atr72'].filter((id) => AIRFRAMES[id])
    const afId = pick(frames)
    const af = AIRFRAMES[afId]
    if (this.longestRunway() < af.minRunway) return
    this.flightSeq += 1
    const fee =
      GA_PARK_FEE_MIN +
      Math.floor(Math.random() * (GA_PARK_FEE_MAX - GA_PARK_FEE_MIN))
    const stay =
      GA_PARK_STAY_MIN +
      Math.floor(Math.random() * (GA_PARK_STAY_MAX - GA_PARK_STAY_MIN))
    this.parkingOffer = {
      id: uid('park'),
      callsign: `N${100 + (this.flightSeq % 800)}${String.fromCharCode(65 + (this.flightSeq % 26))}`,
      airframeId: afId,
      fee,
      staySec: stay,
      age: 0,
      deadline: 24,
    }
    this.pushNews(
      `Independent parking ask — ${this.parkingOffer.callsign} (${af.name}) · fee ${moneyLeft(fee)} · ~${stay}s then leave request.`,
      'good',
    )
    this.emit()
  }

  acceptParking() {
    const o = this.parkingOffer
    if (!o) return
    const af = AIRFRAMES[o.airframeId]
    if (!af) return
    const stand = this.assignStand(null, undefined, undefined, af.id)
    const route = stand ? this.landingRoute(stand) : null
    if (!stand || !route) {
      this.pushNews('No free stand for GA parking.', 'bad')
      this.emit()
      return
    }
    this.earn(o.fee, `${o.callsign} parking fee`)
    const inbound = this.armApproach(route)
    const load = this.flightLoad(af, 'business', false)
    const f: Flight = {
      id: uid('ga'),
      airline: 'ga',
      flightNo: o.callsign,
      airframeId: af.id,
      airframeName: af.name,
      pax: load.pax,
      cargo: false,
      craft: 'jet',
      kind: af.kind,
      phase: 'approach',
      stand,
      x: inbound.x,
      y: inbound.y,
      z: inbound.z,
      heading: 0,
      path: inbound.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting({
        fuel: Boolean(this.fuelBrand && this.fuelLoads > 0),
      }),
      phaseTime: 0,
      ledger: [],
      scheduleId: null,
      ga: true,
      parkFee: o.fee,
      parkStaySec: o.staySec,
      parkLeaveRequestedAt: null,
      parkLeaveBy: null,
      bagUnits: estimateFlightBagUnits('budget', Math.max(1, af.paxMin)),
    }
    this.flights.push(f)
    this.noteCraft(af.kind)
    this.parkingOffer = null
    this.parkingCool = 55
    this.pushNews(
      `${o.callsign} inbound — independent parking (not a carrier). Fee posted; they'll request leave after ~${o.staySec}s.`,
      'good',
    )
    this.emit()
  }

  declineParking() {
    if (!this.parkingOffer) return
    this.pushNews(`${this.parkingOffer.callsign} waved off.`, 'ok')
    this.parkingOffer = null
    this.parkingCool = 35
    this.emit()
  }

  /** Push a parked GA to taxi out. Returns false if pavement busy. */
  releaseGa(flightId: string, quiet = false): boolean {
    const f = this.flights.find((x) => x.id === flightId)
    if (!f || f.phase !== 'parked' || !f.ga) return false
    if (this.groundBusy()) {
      if (!quiet) {
        this.pushNews(`${f.flightNo} waiting for pavement to leave.`, 'ok')
        this.emit()
      }
      return false
    }
    const out = this.departurePath(f)
    if (!out) {
      if (!quiet) {
        this.pushNews(`${f.flightNo} can't find a push path.`, 'bad')
        this.emit()
      }
      return false
    }
    f.path = out
    f.seg = 0
    f.t = 0
    if (!f.cargo) this.settleOutboundBags(f, true)
    f.phase = 'taxi_out'
    f.phaseTime = 0
    f.parkLeaveBy = null
    f.parkLeaveRequestedAt = null
    if (!quiet) {
      this.pushNews(`${f.flightNo} released from parking.`, 'ok')
      this.emit()
    }
    return true
  }

  spawnTransferGuest(airlineId: AirlineId) {
    const fit = this.activeHall() ?? this.fits[0]
    const open = this.hallOpenFor(fit)
    if (!open.size || !fit) return
    const a = this.airline(airlineId)
    const tag: PaxTag = rollPaxTag(a.persona)
    const g = spawnHallGuest(`layover:${airlineId}`, 'arrive', tag, {
      transfer: true,
      airlineId,
      hallId: this.hallKey(fit),
    })
    g.node = 'gate'
    // Through-checked bags — pax stay airside; bags transfer off claim.
    g.needs.bags = 0
    g.connectFlightId = this.pickConnectFlight(airlineId)
    this.issueBagTags(g.id, g.flightId, tag, g.connectFlightId, 'transfer')
    g.thought = `${a.name} transfer — bags through-checked, kill time in the hall`
    g.needs.boarding = 35 + Math.random() * 40
    if (open.has('food')) this.routeGuest(g, 'food', open)
    else if (open.has('shop')) this.routeGuest(g, 'shop', open)
    else if (open.has('dayhotel')) this.routeGuest(g, 'dayhotel', open)
    else if (open.has('lounge')) this.routeGuest(g, 'lounge', open)
    else if (open.has('claim')) {
      // Fallback only — claim as transfer path means thin transfer infra.
      this.routeGuest(g, 'claim', open)
      g.thought = `${a.name} transfer — recheck bags (no through path)`
      g.needs.bags = Math.min(99, 55 + bagUnitsForTag(tag) * 18)
      this.adjustHeat(airlineId, -1.4)
      if (Math.random() < 0.4) {
        this.pushNews(
          `${a.name} transfer bags forced to claim — Standing dips. Build transfer capacity.`,
          'bad',
        )
      }
    }
    this.hallGuests.push(g)
    // Transfers scuff the hall faster.
    if (Math.random() < 0.35) this.bumpWear('bath', 0.4)
    if (Math.random() < 0.2) this.bumpWear('sec', 0.25)
  }

  /** Soft heat drift, rewards, warnings, abandon, ban expiry. */
  tickAirlineRelations(dt: number) {
    for (const id of [...this.signed]) {
      if (this.isBanned(id)) continue
      // Slow recovery toward 70 when not in crisis.
      const h = this.heatOf(id)
      if (h < 70) this.airlineHeat[id] = Math.min(70, h + dt * 0.14)
      else if (h > 78) this.airlineHeat[id] = Math.max(70, h - dt * 0.04)

      const heat = this.heatOf(id)
      if (heat >= HEAT_REWARD_THRESHOLD && !this.airlineReward[id]) {
        this.grantReward(id)
      }

      // Outside layover bans: warn → accumulate → abandon.
      if (this.layover?.airline === id) {
        this.airlineLowAcc[id] = 0
        continue
      }
      if (heat <= HEAT_WARN_THRESHOLD && !this.airlineWarned[id]) {
        this.airlineWarned[id] = true
        const a = this.airline(id)
        const perk = this.airlineReward[id]
        const atRisk = perk
          ? ` ${REWARD_LABEL[perk]} at risk.`
          : ` Keep Standing above ${HEAT_REWARD_THRESHOLD} to unlock ${REWARD_LABEL[rewardForPersona(a.persona)]}.`
        this.pushNews(
          `${a.name} warning — Standing ${Math.round(heat)}. Fix the hall before ${HEAT_ABANDON_THRESHOLD}.${atRisk}`,
          'bad',
        )
      }
      if (heat <= HEAT_ABANDON_THRESHOLD) {
        this.airlineLowAcc[id] = (this.airlineLowAcc[id] ?? 0) + dt
        if ((this.airlineLowAcc[id] ?? 0) >= ABANDON_ACC_SECONDS) {
          this.abandonAirline(id, 'dead Standing')
        }
      } else if (heat > HEAT_WARN_THRESHOLD + 8) {
        this.airlineLowAcc[id] = Math.max(0, (this.airlineLowAcc[id] ?? 0) - dt * 0.6)
        if (heat >= 55) this.airlineWarned[id] = false
      }
    }
    for (const id of Object.keys(this.airlineBanUntil)) {
      const until = this.airlineBanUntil[id]
      if (until > 0 && until <= this.clock && until > this.clock - dt) {
        this.airlineHeat[id] = 45
        this.pushNews(`${this.airline(id).name} ban lifted — they're watching the hall.`, 'ok')
      }
    }
  }

  buyRoom(id: RoomId) {
    const origin = this.selectedTerminalOrigin()
    if (!origin) {
      this.pushNews('Select a terminal hall first.', 'bad')
      return
    }
    const def = ROOMS.find((r) => r.id === id)
    if (!def) return
    if (!this.spend(def.cost, def.name)) return
    let fit = this.fits.find((f) => f.origin.c === origin.c && f.origin.r === origin.r)
    if (!fit) {
      fit = emptyFit(origin, false)
      this.fits.push(fit)
    }
    fit.rooms[id] += 1
    this.pushNews(`Furnished ${def.name}.`, 'ok')
    this.refreshAdvice()
    this.emit()
  }

  /** Budget traffic scuffs WC / security. Returns average wear after bump. */
  bumpWear(kind: 'bath' | 'sec', amount: number): number {
    if (!this.fits.length) return 0
    let sum = 0
    for (const f of this.fits) {
      if (kind === 'bath') f.wearBath = Math.min(100, (f.wearBath ?? 0) + amount)
      else f.wearSec = Math.min(100, (f.wearSec ?? 0) + amount)
      sum += kind === 'bath' ? f.wearBath : f.wearSec
    }
    return sum / this.fits.length
  }

  scrubHall() {
    if (!this.fits.length) {
      this.pushNews('No hall to scrub.', 'bad')
      return
    }
    if (this.maxWear() < 5) {
      this.pushNews('Hall is already clean enough.', 'ok')
      this.emit()
      return
    }
    // Cleaning budget softens the sticker — full crew does more per dollar.
    const cleanPct = this.budgets.cleaning / 100
    const cost = Math.round(HALL_SCRUB_COST * (1.35 - cleanPct * 0.35))
    if (!this.spend(cost, 'hall scrub')) return
    const cut = 30 + cleanPct * 25
    for (const f of this.fits) {
      f.wearBath = Math.max(0, (f.wearBath ?? 0) - cut)
      f.wearSec = Math.max(0, (f.wearSec ?? 0) - cut * 0.9)
      for (const it of f.items ?? []) it.wear = Math.max(0, it.wear - cut * 0.9)
    }
    this.reputation = Math.min(100, this.reputation + 2)
    this.pushNews(
      cleanPct < 0.4
        ? 'Thin cleaning crew scrubbed — still sticky in places.'
        : 'Crew scrubbed WC and security lanes.',
      cleanPct < 0.4 ? 'ok' : 'good',
    )
    this.emit()
  }

  setBudget(key: BudgetKey, pct: number) {
    this.budgets[key] = clamp(Math.round(pct), 0, 100)
    this.emit()
  }

  /**
   * Busy fields cost more to run — signed carriers, extra stands, and turn volume
   * scale ops payroll so mid/late game stays a money puzzle (capped).
   */
  fieldOpsMult(): number {
    return fieldOpsMultiplier(
      this.signed.length,
      tilesOf(this.tiles, 'stand').length,
      this.flightsDone,
    )
  }

  payrollPreview(): number {
    const lines = (Object.keys(BUDGET_BASE) as BudgetKey[]).map((key) => this.lineCost(key))
    return payrollAmount(lines, this.fieldOpsMult())
  }

  hireJanitor() {
    if (this.janitors >= 6) {
      this.pushNews('Janitor crew maxed (6).', 'bad')
      this.emit()
      return
    }
    if (!this.spend(JANITOR_HIRE, 'hire janitor')) return
    this.janitors += 1
    this.spawnJanitorPawn()
    this.pushNews(
      `Hired janitor #${this.janitors}. They scrub WC/security when cleaning budget is funded.`,
      'good',
    )
    this.emit()
  }

  spawnJanitorPawn() {
    const origin = this.fits[0]?.origin
    if (!origin) return
    this.people.push({
      id: uid('jan'),
      flightId: '',
      x: origin.c + 0.5,
      y: origin.r + 0.5,
      path: [],
      seg: 0,
      t: 0,
      color: '#5a8a6a',
      job: 'janitor',
      itinerary: [],
      label: 'Janitor',
      wantBag: false,
      wantFood: false,
      wantGift: false,
      stage: 0,
      paidFood: false,
      paidGift: false,
    })
  }

  tickJanitors(dt: number) {
    this.janitorCool -= dt
    const clean = this.budgets.cleaning / 100
    if (this.janitors < 1 || clean < 0.2 || !this.fits.length) return
    if (this.janitorCool > 0) return
    this.janitorCool = 8
    const live = this.people.filter((p) => p.job === 'janitor').length
    if (live < this.janitors) this.spawnJanitorPawn()
    const cut = (1.8 + this.janitors * 0.9) * clean
    for (const f of this.fits) {
      f.wearBath = Math.max(0, (f.wearBath ?? 0) - cut)
      f.wearSec = Math.max(0, (f.wearSec ?? 0) - cut * 0.75)
    }
    // Wander janitors toward hall origin.
    for (const p of this.people) {
      if (p.job !== 'janitor') continue
      const fit = this.fits[0]
      if (!fit) continue
      const tx = fit.origin.c + Math.random() * 2
      const ty = fit.origin.r + Math.random() * 2
      p.x = lerp(p.x, tx, 1 - Math.pow(0.15, dt))
      p.y = lerp(p.y, ty, 1 - Math.pow(0.15, dt))
    }
  }

  /** Lab gear counts across all halls. */
  labGear(): { desks: number; boards: number; machines: number } {
    let desks = 0
    let boards = 0
    let machines = 0
    for (const f of this.fits) {
      desks += f.rooms.rdesk ?? 0
      boards += f.rooms.rboard ?? 0
      machines += f.rooms.rmachine ?? 0
    }
    return { desks, boards, machines }
  }

  /** RP/sec when every researcher is working the current lab. */
  researchRate(): number {
    if (this.researchers < 1) return 0
    const { desks, boards, machines } = this.labGear()
    const stations = Math.max(1, desks + boards + machines)
    const workingCap = Math.min(this.researchers, Math.max(1, desks || (stations > 0 ? 1 : 0)))
    if (desks + boards + machines < 1) {
      return this.researchers * RP_RATE_BARE
    }
    const gear =
      Math.min(desks, workingCap) * RP_RATE_DESK +
      Math.min(boards, workingCap) * RP_RATE_BOARD +
      Math.min(machines, workingCap) * RP_RATE_MACHINE
    // Extra warm bodies beyond gear still drip a little.
    const overflow = Math.max(0, this.researchers - workingCap) * RP_RATE_BARE
    return gear + overflow
  }

  hireResearcher() {
    if (this.researchers >= 6) {
      this.pushNews('Research crew maxed (6).', 'bad')
      this.emit()
      return
    }
    if (!this.fits.length) {
      this.pushNews('Stamp a hall before hiring researchers.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(RESEARCHER_HIRE, 'hire researcher')) return
    this.researchers += 1
    this.spawnResearcherPawn()
    const { desks } = this.labGear()
    this.pushNews(
      desks < 1
        ? `Hired researcher #${this.researchers}. Furnish a Research desk or they barely bank RP.`
        : `Hired researcher #${this.researchers}. They walk desk → board → lab bench.`,
      'good',
    )
    this.emit()
  }

  spawnResearcherPawn() {
    const origin = this.fits[0]?.origin
    if (!origin) return
    const { desks } = this.labGear()
    this.people.push({
      id: uid('rnd'),
      flightId: '',
      x: origin.c + 0.35,
      y: origin.r + 0.25,
      path: [],
      seg: 0,
      t: 0,
      color: '#7a9ec8',
      job: 'researcher',
      itinerary: [],
      label: desks > 0 ? 'Researcher · desk' : 'Researcher · idle',
      wantBag: false,
      wantFood: false,
      wantGift: false,
      // 0 desk · 1 board · 2 machine · 3 break · 4 home (off-shift)
      stage: 0,
      paidFood: false,
      paidGift: false,
      dutySec: 10 + Math.random() * 8,
    })
  }

  /** Live researcher roster — working vs break vs off-shift. */
  labCrewStatus(): { working: number; break: number; home: number; total: number } {
    const staff = this.people.filter((p) => p.job === 'researcher')
    let working = 0
    let onBreak = 0
    let home = 0
    for (const p of staff) {
      if (p.stage === 3) onBreak += 1
      else if (p.stage === 4) home += 1
      else working += 1
    }
    return { working, break: onBreak, home, total: staff.length }
  }

  /** Pick next researcher duty. Soft home = off-shift exit, not CEO bus commute. */
  private assignResearcherDuty(p: Person, desks: number, boards: number, machines: number) {
    const night = this.isNight()
    // Coming back from break/home → always work first.
    if (p.stage === 3 || p.stage === 4) {
      const opts: number[] = []
      if (desks > 0) opts.push(0)
      if (boards > 0) opts.push(1)
      if (machines > 0) opts.push(2)
      if (!opts.length) {
        p.stage = 0
        p.label = 'Researcher · idle'
        p.dutySec = 12 + Math.random() * 6
        return
      }
      p.stage = opts[Math.floor(Math.random() * opts.length)]
      p.label =
        p.stage === 0
          ? 'Researcher · desk'
          : p.stage === 1
            ? 'Researcher · board'
            : 'Researcher · lab'
      p.dutySec = 14 + Math.random() * 10
      return
    }
    // Chance to leave the lab — higher at night; home lasts longer than break.
    const leaveRoll = Math.random()
    const homeOdds = night ? 0.22 : 0.1
    const breakOdds = night ? 0.16 : 0.2
    if (leaveRoll < homeOdds) {
      p.stage = 4
      p.label = 'Researcher · home'
      p.dutySec = (night ? 36 : 26) + Math.random() * 14
      return
    }
    if (leaveRoll < homeOdds + breakOdds) {
      p.stage = 3
      p.label = 'Researcher · break'
      p.dutySec = 8 + Math.random() * 8
      return
    }
    const opts: number[] = []
    if (desks > 0) opts.push(0)
    if (boards > 0) opts.push(1)
    if (machines > 0) opts.push(2)
    if (!opts.length) {
      p.stage = 0
      p.label = 'Researcher · idle'
      p.dutySec = 10 + Math.random() * 6
      return
    }
    p.stage = opts[Math.floor(Math.random() * opts.length)]
    p.label =
      p.stage === 0
        ? 'Researcher · desk'
        : p.stage === 1
          ? 'Researcher · board'
          : 'Researcher · lab'
    p.dutySec = 12 + Math.random() * 10
  }

  tickResearchers(dt: number) {
    if (this.researchers < 1) return
    const live = this.people.filter((p) => p.job === 'researcher').length
    if (live < this.researchers && this.fits.length) this.spawnResearcherPawn()

    const { desks, boards, machines } = this.labGear()
    const fit = this.activeHall() ?? this.fits[0]
    const open = fit ? openNodesFromRooms(fit.rooms) : new Set<HallNode>()
    let working = 0
    for (const p of this.people) {
      if (p.job !== 'researcher') continue
      p.dutySec = (p.dutySec ?? 0) - dt
      if (p.dutySec <= 0) {
        this.assignResearcherDuty(p, desks, boards, machines)
      }
      if (p.stage <= 2) working += 1

      if (!fit) continue
      // Walk targets: lab stations on the hall footprint; break → food/WC; home → road exit.
      let ox = fit.origin.c
      let oy = fit.origin.r
      if (p.stage === 0) {
        ox += 0.25
        oy += 0.2
      } else if (p.stage === 1) {
        ox += 0.9
        oy += 0.15
      } else if (p.stage === 2) {
        ox += 1.55
        oy += 0.35
      } else if (p.stage === 3) {
        if (open.has('food')) {
          ox += 1.4
          oy += 1.5
        } else if (open.has('bathroom')) {
          ox += 0.6
          oy += 1.8
        } else {
          ox += 2.0
          oy += 1.4
        }
      } else {
        // Off-shift — leave via landside road, not a bus-stop sim.
        ox = Math.max(0, fit.origin.c - 2.5)
        oy = Math.max(0, fit.origin.r - 1.5)
      }
      const jitter = p.id.charCodeAt(4) % 5
      const tx = ox + (jitter * 0.08)
      const ty = oy + ((jitter % 3) * 0.08)
      p.x = lerp(p.x, tx, 1 - Math.pow(0.1, dt))
      p.y = lerp(p.y, ty, 1 - Math.pow(0.1, dt))
    }

    const rate = this.researchRate()
    const staff = this.people.filter((p) => p.job === 'researcher')
    const workFrac = staff.length ? working / staff.length : 0
    // Night lab is quieter — half drip; off-shift bodies don't bank RP.
    const night = this.isNight() ? 0.55 : 1
    this.researchPoints += rate * workFrac * night * dt

    if (
      staff.length >= 2 &&
      workFrac < 0.35 &&
      Math.random() < dt * 0.04
    ) {
      this.pushNews('Lab quiet — researchers on break or off-shift.', 'ok')
    }
  }

  hireDeskStaff() {
    if (this.deskStaff >= 8) {
      this.pushNews('Desk crew maxed (8).', 'bad')
      this.emit()
      return
    }
    if (!this.fits.length) {
      this.pushNews('Stamp a hall before hiring desk staff.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(DESK_STAFF_HIRE, 'hire desk staff')) return
    this.deskStaff += 1
    this.assignHallStaff()
    this.pushNews(
      `Hired desk agent #${this.deskStaff}. Bodies cover check-in, security, and gate.`,
      'good',
    )
    this.emit()
  }

  assignHallStaff() {
    const open = this.hallOpen()
    const posts: StaffPost[] = []
    if (open.has('checkin')) posts.push('checkin')
    if (open.has('security')) posts.push('security')
    if (open.has('gate')) posts.push('gate')
    if (!posts.length) {
      this.hallStaff = []
      return
    }
    // Keep existing bodies; resize to deskStaff.
    while (this.hallStaff.length < this.deskStaff) {
      const node = posts[this.hallStaff.length % posts.length]
      this.hallStaff.push({
        id: uid('desk'),
        node,
        label:
          node === 'checkin'
            ? 'Clerk'
            : node === 'security'
              ? 'Screener'
              : 'Gate agent',
        color: node === 'security' ? '#c9a227' : node === 'gate' ? '#6a9ec8' : '#8aaf7a',
        stage: 0,
      })
    }
    if (this.hallStaff.length > this.deskStaff) {
      this.hallStaff.length = this.deskStaff
    }
    // Rebalance coverage — prefer empty posts.
    const covered = new Set(this.hallStaff.filter((s) => s.stage === 0).map((s) => s.node))
    for (const s of this.hallStaff) {
      if (s.stage !== 0) continue
      if (!posts.includes(s.node)) {
        s.node = posts[0]
        s.label =
          s.node === 'checkin' ? 'Clerk' : s.node === 'security' ? 'Screener' : 'Gate agent'
      }
    }
    for (const post of posts) {
      if (covered.has(post)) continue
      const free = this.hallStaff.find((s) => s.stage === 0 && covered.has(s.node) &&
        this.hallStaff.filter((x) => x.node === s.node && x.stage === 0).length > 1)
      if (free) {
        free.node = post
        free.label =
          post === 'checkin' ? 'Clerk' : post === 'security' ? 'Screener' : 'Gate agent'
        covered.add(post)
      }
    }
  }

  tickDeskStaff(dt: number) {
    if (this.deskStaff < 1) {
      this.hallStaff = []
      return
    }
    this.deskStaffCool -= dt
    this.assignHallStaff()
    if (this.deskStaffCool > 0) return
    this.deskStaffCool = 14
    for (const s of this.hallStaff) {
      if (s.stage === 1) {
        s.stage = 0
        continue
      }
      if (Math.random() < 0.16) {
        s.stage = 1
        s.label = `${s.label.split(' ·')[0]} · break`
      }
    }
    // Rotate working staff across posts so one hire still covers over time.
    const open = this.hallOpen()
    const posts: StaffPost[] = []
    if (open.has('checkin')) posts.push('checkin')
    if (open.has('security')) posts.push('security')
    if (open.has('gate')) posts.push('gate')
    if (posts.length < 2) return
    for (const s of this.hallStaff) {
      if (s.stage !== 0) continue
      if (Math.random() < 0.35) {
        const next = posts[Math.floor(Math.random() * posts.length)]
        s.node = next
        s.label =
          next === 'checkin' ? 'Clerk' : next === 'security' ? 'Screener' : 'Gate agent'
        s.color = next === 'security' ? '#c9a227' : next === 'gate' ? '#6a9ec8' : '#8aaf7a'
      }
    }
  }

  lineCost(key: BudgetKey): number {
    const gear = key === 'maintenance' ? this.labGear() : { desks: 0, boards: 0, machines: 0 }
    return budgetLineCost({
      key,
      budgetPct: this.budgets[key],
      mechanics: this.mechanics,
      hangars: tilesOf(this.tiles, 'hangar').length,
      researchers: this.researchers,
      desks: gear.desks,
      boards: gear.boards,
      machines: gear.machines,
      securityPosts:
        tilesOf(this.tiles, 'police').length + this.fits.reduce((n, f) => n + f.rooms.security, 0),
      deskStaff: this.deskStaff,
      cleanRooms: this.fits.reduce((n, f) => n + f.rooms.bathroom + f.rooms.food, 0),
      janitors: this.janitors,
      fireStations: tilesOf(this.tiles, 'fire').length,
      signed: this.signed.length,
      helipads: tilesOf(this.tiles, 'helipad').length,
    })
  }

  hireMechanic() {
    if (this.mechanics >= 8) {
      this.pushNews('Shop is full — 8 mechanics max for this field.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(MECHANIC_HIRE, 'hire mechanic')) return
    this.mechanics += 1
    this.spawnMechanicPawn()
    this.pushNews(
      `Hired mechanic #${this.mechanics}. They walk the strip and hangar when maintenance budget is funded.`,
      'good',
    )
    this.emit()
  }

  fireMechanic() {
    if (this.mechanics <= 0) return
    this.mechanics -= 1
    const mech = this.people.find((p) => p.job === 'mechanic')
    if (mech) mech.stage = 99
    this.pushNews(`Laid off a mechanic. ${this.mechanics} left on payroll.`, 'ok')
    this.emit()
  }

  spawnMechanicPawn() {
    const hangars = tilesOf(this.tiles, 'hangar')
    const strips = runwayStrips(this.tiles, MIN_RUNWAY).flat()
    const start = hangars[0] ?? strips[0] ?? tilesOf(this.tiles, 'stand')[0]
    if (!start) return
    const goal = strips.length ? pick(strips) : hangars[0] ?? start
    const path = astar(this.tiles, start, goal, 'mechanic') ?? [start]
    this.people.push({
      id: uid('mx'),
      flightId: '',
      x: start.c,
      y: start.r,
      path,
      seg: 0,
      t: 0,
      color: '#6b5b3a',
      job: 'mechanic',
      itinerary: [],
      label: 'Mechanic',
      wantBag: false,
      wantFood: false,
      wantGift: false,
      stage: 0,
      paidFood: false,
      paidGift: false,
    })
  }

  considerMxOffers() {
    if (this.mxOffer || this.mxOfferCool > 0) return
    if (!tilesOf(this.tiles, 'hangar').length || this.mechanics < 1) return
    if (this.budgets.maintenance < 35) return
    const candidates = this.signed.filter((id) => !this.mxSigned.includes(id))
    if (!candidates.length) return
    const id = pick(candidates)
    const a = this.airline(id)
    const payout = Math.round(a.landing * (a.kind === 'cargo' ? 0.22 : 0.18) + this.mechanics * 120)
    this.mxOffer = { airline: id, age: 0, payout, deadline: 32 }
    this.pushNews(
      `${a.name} sent an MX letter — $${payout.toLocaleString()} per hangar turnaround.`,
      'good',
    )
  }

  acceptMxOffer() {
    if (!this.mxOffer) return
    const id = this.mxOffer.airline
    this.mxSigned.push(id)
    this.mxOffer = null
    this.mxOfferCool = 40
    this.pushNews(`${this.airline(id).name} MX signed. Their jets will pay shop fees on stand.`, 'good')
    this.emit()
  }

  declineMxOffer() {
    if (!this.mxOffer) return
    const id = this.mxOffer.airline
    this.mxOffer = null
    this.mxOfferCool = 55
    this.pushNews(`${this.airline(id).name} MX talk died. They may call again.`, 'ok')
    this.emit()
  }

  expireMxOffer() {
    if (!this.mxOffer) return
    const a = this.airline(this.mxOffer.airline)
    this.mxOffer = null
    this.mxOfferCool = 45
    this.pushNews(`${a.name} MX letter expired.`, 'ok')
    this.emit()
  }

  weatherLabel(): string {
    return (
      {
        clear: 'Clear',
        rain: 'Rain',
        fog: 'Fog',
        storm: 'Storm',
      } as const
    )[this.weather]
  }

  weatherCrashMult(): number {
    const deice = this.hasResearch('deice') ? 0.72 : 1
    if (this.weather === 'storm') return 2.4 * deice
    if (this.weather === 'fog') return 1.7 * (this.hasResearch('deice') ? 0.85 : 1)
    if (this.weather === 'rain') return 1.35 * deice
    return 1
  }

  /** Chance (0–1) a jet has a serious pavement incident this check. */
  crashChance(): number {
    const cond = this.runwayCondition / 100
    const mx = this.budgets.maintenance / 100
    const staff = clamp(this.mechanics / 3, 0, 1)
    const neglect = (1 - cond) * (1.15 - mx * 0.55) * (1.1 - staff * 0.35)
    return clamp(neglect * 0.045 * this.weatherCrashMult(), 0, 0.35)
  }

  tickWeather(dt: number) {
    this.weatherCool -= dt
    if (this.weatherCool > 0) return
    this.weatherCool = 35 + Math.random() * 40
    const roll = Math.random()
    const next: Weather =
      roll < 0.55 ? 'clear' : roll < 0.75 ? 'rain' : roll < 0.9 ? 'fog' : 'storm'
    if (next !== this.weather) {
      this.weather = next
      if (next === 'storm') {
        this.stormPulseCool = 0
        this.pushNews(
          this.hasResearch('deice')
            ? 'Storm cell over the field — de-ice pads online; expect soft slips, not a washout.'
            : 'Storm cell over the field — wet strip, high crash risk if pavement is soft. Research De-ice ops.',
          'bad',
        )
      } else if (next === 'clear' && this.runwayCondition < 50) {
        this.pushNews('Skies clear, but the runway still needs work.', 'ok')
      } else if (next !== 'clear') {
        this.pushNews(`Weather: ${this.weatherLabel()}.`, 'ok')
      }
    }
  }

  tickPayroll(_dt: number) {
    const day = Math.floor(Math.max(0, this.clock) / 180)
    if (day <= this.payrollDay) return
    const from = this.payrollDay
    this.payrollDay = day
    for (let completed = from; completed < day; completed++) this.closeOperatingDay(completed)
  }

  /**
   * One game day: staffing floor or the income share, then the 0.5% city levy.
   * Landside upkeep is the old six payroll-tick slices, billed once.
   */
  private closeOperatingDay(completedDay: number) {
    const ledger = this.bank.ledgerForGameDay(completedDay)
    let income = 0
    for (const [category, amount] of Object.entries(ledger.byCategory)) {
      if (FINANCING_CATEGORIES.has(category) || !(amount && amount > 0)) continue
      income += amount
    }
    const phase = this.clock <= 600 ? 'early' : 'midgame'
    const minimum = this.payrollPreview()
    const bill = payrollForGameDay(income, phase, minimum)
    const fees = this.landsideIncome()
    const upkeep = this.landsideUpkeep() * 6
    if (upkeep > 0) this.charge(upkeep)
    const netLand = fees - upkeep
    const useRate = this.landsideUsageRate()
    this.landsideUses = Math.max(0, Math.floor(this.landsideUses * 0.45 ** 6))
    this.landsideFeeWindow = 0
    const stamp = (completedDay + 1) * SIM_MINUTES_PER_GAME_DAY - 1
    if (bill <= 0) {
      if (upkeep > 0 || fees > 0) {
        this.pushNews(
          `Landside ${netLand >= 0 ? '+' : ''}${moneyLeft(netLand)} (pax fees ${moneyLeft(fees)} − expense ${moneyLeft(upkeep)} · fill ${Math.round(useRate * 100)}%).`,
          netLand >= 0 ? 'ok' : 'bad',
        )
      }
      return
    }
    this.levyMark = this.clock
    if (this.cash >= bill) {
      this.noteExpense(bill)
      this.cash -= bill
      this.postJournal('payroll', bill, stamp)
      const levy = cityLevy(this.cash, this.sandbox)
      if (levy > 0) {
        this.noteExpense(levy)
        this.cash -= levy
        this.postJournal('city_levy', levy, stamp)
      }
      this.pushNews(
        `Ops payroll ${moneyLeft(bill)}${
          fees || upkeep
            ? ` · landside ${netLand >= 0 ? '+' : ''}${moneyLeft(netLand)} (fees − expense)`
            : ''
        }${levy ? ` · city levy ${moneyLeft(levy)}` : ''} (day's income × staff floor).`,
        netLand < 0 && upkeep > 0 ? 'bad' : 'ok',
      )
      return
    }
    const paid = Math.max(0, this.cash)
    this.noteExpense(paid)
    this.cash = 0
    if (paid > 0) this.postJournal('payroll', paid, stamp)
    this.reputation = Math.max(0, this.reputation - 4)
    if (this.budgets.maintenance > 20) this.budgets.maintenance = Math.max(20, this.budgets.maintenance - 10)
    if (this.budgets.security > 20) this.budgets.security = Math.max(20, this.budgets.security - 10)
    this.pushNews(
      paid > 0
        ? `Payroll short — paid ${moneyLeft(paid)} of ${moneyLeft(bill)}. Sliders cut, reputation dips.`
        : `Payroll missed entirely (${moneyLeft(bill)} due). Crews walking. Reputation dips.`,
      'bad',
    )
  }

  private ensureEconomy(): EconomyAdapter {
    if (!this.economy) {
      this.economy = createEconomyAdapter(
        {
          getFieldLevel: () => this.fieldLevel(),
          isAirportOperational: () => this.flightsDone > 0 || this.signed.length > 0,
          getAbsoluteDay: () => Math.floor(this.clock / 180),
          getStaffPools: () => ({
            maintenance_tech: { hired: this.mechanics, wagePerDay: 0 },
            researcher: { hired: this.researchers, wagePerDay: 0 },
            terminal_staff: { hired: this.deskStaff, wagePerDay: 0 },
          }),
          getStaffBuildings: () => [],
          getResearchRooms: () =>
            this.researchers > 0
              ? [{ id: 'field-lab', desks: this.researchers, powerDemand: 35, active: true }]
              : [],
          getPowerLoads: () => [],
          getChains: () => [],
          getTransitTier: () => (this.hasRailStation() ? 'rail' : this.hasBusCurb() ? 'bus' : 'road'),
          getHousingTier: () => 0,
          getPowerPlantTier: () => 1,
          saveEconomyState: (state) => {
            this.economyState = state
          },
          onEconomySnapshot: (snapshot) => {
            this.economyView = snapshot
          },
        },
        { initialState: this.economyState ?? undefined },
      )
    }
    return this.economy
  }

  tickMaintenance(dt: number) {
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    if (!strips.length) return
    const mx = this.budgets.maintenance / 100
    const staff = this.mechanics
    // Traffic wears pavement; storms chew it faster.
    const liveJets = this.flights.filter(
      (f) => (f.craft ?? 'jet') === 'jet' && f.phase !== 'gone' && f.phase !== 'hold',
    ).length
    const decay =
      dt *
      (0.35 + liveJets * 0.25 + (this.weather === 'storm' ? 0.55 : this.weather === 'rain' ? 0.25 : 0)) *
      (1.4 - mx * 0.6)
    this.runwayCondition = clamp(this.runwayCondition - decay, 0, 100)

    // Funded mechanics repair.
    if (staff > 0 && mx > 0.05) {
      const repair = dt * (0.55 + staff * 0.45) * mx * (tilesOf(this.tiles, 'hangar').length ? 1.25 : 1)
      this.runwayCondition = clamp(this.runwayCondition + repair, 0, 100)
    } else if (mx < 0.2 && Math.random() < dt * 0.04) {
      this.pushNews('Pavement soft — rubber and cracks. Hire mechanics or fund maintenance.', 'bad')
    }

    // Cleaning budget slowly fights hall wear; starved cleaning grows it.
    const clean = this.budgets.cleaning / 100
    for (const f of this.fits) {
      if (clean >= 0.7) {
        f.wearBath = Math.max(0, (f.wearBath ?? 0) - dt * 0.8)
        f.wearSec = Math.max(0, (f.wearSec ?? 0) - dt * 0.6)
      } else if (clean < 0.35) {
        f.wearBath = Math.min(100, (f.wearBath ?? 0) + dt * (0.9 - clean))
        f.wearSec = Math.min(100, (f.wearSec ?? 0) + dt * (0.7 - clean * 0.5))
      }
    }

    // Mechanic pawns wander when funded
    this.mechanicCool -= dt
    if (this.mechanicCool <= 0 && staff > 0 && mx >= 0.25) {
      this.mechanicCool = 14
      const live = this.people.filter((p) => p.job === 'mechanic').length
      if (live < staff) this.spawnMechanicPawn()
      for (const p of this.people) {
        if (p.job !== 'mechanic' || p.path.length > 1) continue
        const goals = [
          ...runwayStrips(this.tiles, MIN_RUNWAY).flat(),
          ...tilesOf(this.tiles, 'hangar'),
          ...tilesOf(this.tiles, 'stand'),
        ]
        if (!goals.length) continue
        const g = pick(goals)
        const path = astar(
          this.tiles,
          { c: Math.round(p.x), r: Math.round(p.y) },
          g,
          'mechanic',
        )
        if (path) {
          p.path = path
          p.seg = 0
          p.t = 0
        }
      }
    }
  }

  tickFireRisk(dt: number) {
    this.fireIncidentCool -= dt
    if (this.fireIncidentCool > 0) return
    this.fireIncidentCool = 50 + Math.random() * 40
    if (!tilesOf(this.tiles, 'fuel').length && !this.flights.length) return
    const firePct = this.budgets.fire / 100
    const stations = tilesOf(this.tiles, 'fire').length
    const risk = clamp(0.22 - stations * 0.08 - firePct * 0.15, 0.02, 0.28)
    if (Math.random() > risk) return
    if (firePct >= 0.65 && stations > 0) {
      this.pushNews('ARFF drilled a hot brake — crews ready, no damage.', 'ok')
      return
    }
    const fine = Math.round(5000 + (1 - firePct) * 12000)
    this.charge(fine)
    this.reputation = Math.max(0, this.reputation - (firePct < 0.3 ? 8 : 4))
    if (this.public) {
      this.sharePrice = Math.max(1.5, Math.round((this.sharePrice * (0.9 + firePct * 0.05)) * 100) / 100)
    }
    this.pushNews(
      firePct < 0.25
        ? `APRON FIRE — skeleton ARFF. Fine ${moneyLeft(fine)}. Fund fire crews.`
        : `Hot brake incident. Thin fire budget cost ${moneyLeft(fine)}.`,
      'bad',
    )
  }

  checkCrash(f: Flight, moment: 'landing' | 'takeoff') {
    if ((f.craft ?? 'jet') !== 'jet') return false
    if (this.crashCool > 0) return false
    const chance = this.crashChance() * (moment === 'landing' ? 1 : 0.85)
    if (Math.random() > chance) return false
    this.crashCool = 25
    this.crashFlight(f, moment)
    return true
  }

  crashFlight(f: Flight, moment: 'landing' | 'takeoff') {
    const amb = this.budgets.ambulance / 100
    const fire = this.budgets.fire / 100
    const baseFine = 18000 + Math.round((100 - this.runwayCondition) * 220)
    const mitigate = 0.45 + amb * 0.3 + fire * 0.25
    const fine = Math.round(baseFine * (1.4 - mitigate * 0.5))
    this.charge(fine)
    this.reputation = Math.max(0, this.reputation - (amb < 0.3 ? 14 : 8))
    this.runwayCondition = clamp(this.runwayCondition - 12, 0, 100)
    this.securityIncidents += 1
    if (this.mission?.goal === 'noIncident') this.mission.progress = 0
    f.phase = 'gone'
    this.noteCargoCancel(f)
    f.waitingOn.paxOut = 0
    f.waitingOn.paxIn = 0
    this.people = this.people.filter((p) => p.flightId !== f.id)
    this.hallGuests = this.hallGuests.filter((g) => g.flightId !== f.id)
    const weatherBit =
      this.weather === 'clear' ? '' : ` ${this.weatherLabel()} + soft pavement.`
    if (this.public) {
      this.shockStock(
        `CRASH on ${moment}${weatherBit} Runway ${Math.round(this.runwayCondition)}%.`,
        amb < 0.35 ? 0.5 : 0.62,
        fine,
      )
    } else {
      this.pushNews(
        `CRASH on ${moment}.${weatherBit} Fine ${moneyLeft(fine)}. Ambulances ${Math.round(amb * 100)}% · fire ${Math.round(fire * 100)}%.`,
        'bad',
      )
    }
    if (amb < 0.2) {
      this.pushNews('No medics on call — city hospital bill piles on. Fund ambulances.', 'bad')
      this.charge(4000)
    } else if (amb >= 0.8) {
      this.reputation = Math.min(100, this.reputation + 2)
      this.pushNews('Ambulance crews pulled survivors fast — softens the headline.', 'ok')
    }
  }

  selectedTerminalOrigin(): Vec | null {
    const t = this.selectedTile
    if (!t || this.tile(t) !== 'terminal') return null
    for (const d of [
      { c: 0, r: 0 },
      { c: -1, r: 0 },
      { c: 0, r: -1 },
      { c: -1, r: -1 },
      { c: -2, r: 0 },
      { c: 0, r: -2 },
      { c: -2, r: -1 },
      { c: -1, r: -2 },
    ]) {
      const o = { c: t.c + d.c, r: t.r + d.r }
      if (this.tile(o) === 'terminal') {
        const fit = this.fits.find((f) => f.origin.c === o.c && f.origin.r === o.r)
        if (fit) return o
      }
    }
    for (const f of this.fits) {
      if (Math.abs(f.origin.c - t.c) <= 2 && Math.abs(f.origin.r - t.r) <= 2) return f.origin
    }
    return t
  }

  /** Guard against StrictMode / double pointer listeners placing twice. */
  private lastPlaceAt = 0
  private lastPlaceKey = ''

  clickTile(v: Vec) {
    if (!inBounds(v.c, v.r)) return
    this.selectedTile = v
    this.selectedFlight = this.nearestFlight(v)?.id ?? this.selectedFlight

    if (this.tool === 'pan') {
      const tile = this.tile(v)
      if (tile === 'fuel') this.toggleInfo('fuel')
      else if (tile === 'bags') this.toggleInfo('bags')
      if (tile === 'terminal') {
        this.enterHallAt(v)
        return
      }
      const f = this.nearestFlight(v)
      if (f) this.selectedFlight = f.id
      this.emit()
      return
    }
    // One click → one stamp (dedupe duplicate pointer listeners / StrictMode).
    const placeKey = `${this.tool}:${v.c},${v.r}`
    const now = performance.now()
    if (placeKey === this.lastPlaceKey && now - this.lastPlaceAt < 120) return
    this.lastPlaceKey = placeKey
    this.lastPlaceAt = now

    if (this.tool === 'clear') {
      this.clearTile(v)
      return
    }
    if (this.tool === 'runway_short') {
      this.placeRunway(v, 'short')
      return
    }
    if (this.tool === 'runway') {
      this.placeRunway(v, 'regional')
      return
    }
    if (this.tool === 'runway_heavy') {
      this.placeRunway(v, 'heavy')
      return
    }
    if (this.tool === 'terminal') {
      this.placeTerminal(v)
      return
    }
    if (this.tool === 'premade') {
      this.placePremade(v)
      return
    }
    this.placeSingle(v)
  }

  setHover(v: Vec | null) {
    this.hover = v
    if (!v || !this.inspectEnabled()) {
      this.hoverInspect = null
      return
    }
    this.hoverInspect = this.inspectAt(v)
  }

  inspectAt(v: Vec): ApronInspect | null {
    const flight = this.nearestFlight(v, 2.2)
    if (flight) return this.inspectFlight(flight)
    if (this.tile(v) === 'hangar') return this.inspectHangar(v)
    // Nearby hangar tile (footprint feel).
    for (const d of [
      { c: 0, r: 0 },
      { c: 1, r: 0 },
      { c: 0, r: 1 },
      { c: -1, r: 0 },
      { c: 0, r: -1 },
    ]) {
      const p = { c: v.c + d.c, r: v.r + d.r }
      if (inBounds(p.c, p.r) && this.tile(p) === 'hangar') return this.inspectHangar(p)
    }
    return null
  }

  inspectFlight(f: Flight): ApronInspect {
    const a = this.airline(f.airline)
    const { fuel, catering } = this.serviceBars(f)
    return {
      kind: 'flight',
      flightId: f.id,
      callsign: f.flightNo,
      airline: f.ga ? 'Independent GA' : a.name,
      model: f.airframeName || this.aircraftLabel(f.kind),
      destination: f.destination || '—',
      activity: this.flightActivity(f),
      next: this.flightNext(f),
      fuel,
      catering,
      gate: f.stand ? this.gateLabel(f.stand) : '—',
      mx: f.mxPending
        ? 'Hangar MX booked'
        : f.phase === 'mx_bay' || f.phase === 'mx_taxi' || f.phase === 'mx_return'
          ? 'In hangar MX loop'
          : f.posted.mx
            ? 'Line MX done'
            : undefined,
    }
  }

  inspectHangar(h: Vec): ApronInspect {
    const occ = this.hangarOccupant(h)
    if (!occ) {
      return {
        kind: 'hangar',
        title: 'Hangar bay',
        occupant: 'Empty',
        model: '—',
        remaining: 0,
        total: 0,
        blurb: this.mechanics
          ? `${this.mechanics} mechanic${this.mechanics === 1 ? '' : 's'} on staff · waiting for MX traffic`
          : 'No mechanics hired — MX contracts will skip.',
      }
    }
    const left = Math.max(0, (occ.mxEndsAt ?? this.clock) - this.clock)
    const total = Math.max(1, occ.mxDuration ?? this.hangarMxDuration())
    return {
      kind: 'hangar',
      title: 'Hangar bay',
      occupant: occ.flightNo,
      model: occ.airframeName || this.aircraftLabel(occ.kind),
      remaining: left,
      total,
      blurb:
        occ.phase === 'mx_bay'
          ? `Line MX in progress · ${Math.ceil(left)}s left`
          : occ.phase === 'mx_taxi'
            ? 'Taxiing in for maintenance'
            : occ.phase === 'mx_return'
              ? 'Wrapping up — returning to stand'
              : this.flightActivity(occ),
    }
  }

  hangarOccupant(h: Vec): Flight | null {
    for (const f of this.flights) {
      if (!f.hangarBay) continue
      if (f.hangarBay.c !== h.c || f.hangarBay.r !== h.r) continue
      if (f.phase === 'mx_taxi' || f.phase === 'mx_bay' || f.phase === 'mx_return') return f
    }
    return null
  }

  freeHangarBay(): Vec | null {
    const hangars = tilesOf(this.tiles, 'hangar')
    for (const h of hangars) {
      if (!this.hangarOccupant(h)) return h
    }
    return null
  }

  serviceBars(f: Flight): { fuel: number; catering: number } {
    let fuel = f.fuelLevel ?? 0.4
    if (f.posted.fuel) fuel = 1
    else if (f.waitingOn.fuel) fuel = Math.max(fuel, Math.min(0.92, 0.35 + f.phaseTime * 0.04))

    let catering = f.caterLevel ?? 0.25
    if (f.cargo || f.kind === 'military' || f.craft === 'helo') catering = 1
    else if (f.posted.catering) catering = 1
    else if (f.waitingOn.catering) catering = Math.max(catering, Math.min(0.92, 0.2 + f.phaseTime * 0.05))

    return {
      fuel: Math.round(clamp(fuel, 0, 1) * 100),
      catering: Math.round(clamp(catering, 0, 1) * 100),
    }
  }

  flightActivity(f: Flight): string {
    const gate = f.stand ? this.gateLabel(f.stand) : 'gate'
    const hangar = f.hangarBay ? `hangar ${f.hangarBay.c},${f.hangarBay.r}` : 'hangar'
    switch (f.phase) {
      case 'hold':
        return 'Holding for a gate'
      case 'approach':
        return `On approach → ${gate}${f.claimLane ? ` · claim ${f.claimLane}` : ''}`
      case 'landing':
        return `Landing → taxi to ${gate}`
      case 'taxi_in':
        return `Taxiing in to ${gate}`
      case 'deboard': {
        if (f.cargo) return 'Unloading freight'
        const bag = this.bagStageLabel(f)
        const mode = f.stand ? this.standPaxMode(f.stand) : 'walk'
        const base =
          mode === 'jetway'
            ? 'Deplaning via jetway (no apron walk)'
            : mode === 'bus'
              ? 'Deplaning — terminal bus ferry'
              : 'Deplaning — walking the apron'
        return bag ? `${base} · ${bag}` : base
      }
      case 'servicing': {
        const bag = this.bagStageLabel(f)
        return bag
          ? `Turnaround · ${bag}`
          : 'Turnaround on stand (fuel / bags / catering)'
      }
      case 'mx_taxi':
        return `Taxiing to ${hangar} for maintenance`
      case 'mx_bay':
        return `In hangar — MX · ${Math.ceil(Math.max(0, (f.mxEndsAt ?? this.clock) - this.clock))}s left`
      case 'mx_return':
        return `Leaving hangar → back to ${gate}`
      case 'board': {
        if (f.cargo) return 'Loading freight'
        const bag = this.bagStageLabel(f)
        const mode = f.stand ? this.standPaxMode(f.stand) : 'walk'
        const base =
          mode === 'jetway'
            ? 'Boarding via jetway'
            : mode === 'bus'
              ? 'Boarding — waiting on terminal bus'
              : 'Boarding — pax walking from hall'
        return bag ? `${base} · ${bag}` : base
      }
      case 'pushback':
        return 'Pushback from stand'
      case 'parked':
        return f.parkLeaveRequestedAt ? 'Parked — leave window open' : 'Parked at stand'
      case 'taxi_out':
        return 'Taxiing out to the strip'
      case 'takeoff':
        return f.destination ? `Departing to ${f.destination}` : 'Departing'
      default:
        return f.phase
    }
  }

  flightNext(f: Flight): string {
    switch (f.phase) {
      case 'hold':
        return 'Next: approach when a stand opens'
      case 'approach':
        return 'Next: landing · taxi to stand'
      case 'landing':
      case 'taxi_in':
        return 'Next: deplane · turnaround'
      case 'deboard':
        return 'Next: fuel / bags / catering on stand'
      case 'servicing':
        if (f.mxPending && !f.posted.mx) return 'Next: taxi to hangar for line MX'
        if (f.ga) return 'Next: park / leave window'
        if (f.cargo || f.kind === 'military' || f.kind === 'air_ambulance')
          return 'Next: pushback · departure'
        return 'Next: board · pushback'
      case 'mx_taxi':
        return 'Next: hangar bay maintenance'
      case 'mx_bay':
        return `Next: return to ${f.stand ? this.gateLabel(f.stand) : 'stand'} · board`
      case 'mx_return':
        return 'Next: board passengers'
      case 'board':
        return f.destination ? `Next: pushback · depart to ${f.destination}` : 'Next: pushback · depart'
      case 'pushback':
        return 'Next: taxi to runway'
      case 'parked':
        return 'Next: release / taxi out'
      case 'taxi_out':
        return f.destination ? `Next: takeoff to ${f.destination}` : 'Next: takeoff'
      case 'takeoff':
        return f.destination ? `En route to ${f.destination}` : 'Airborne'
      default:
        return '—'
    }
  }

  /** Duration of hangar bay MX — more mechanics = faster. */
  hangarMxDuration(): number {
    return Math.max(8, 20 - this.mechanics * 2.2)
  }

  startHangarMx(f: Flight): boolean {
    if (!f.stand || f.posted.mx || f.phase === 'mx_taxi' || f.phase === 'mx_bay') return false
    const bay = this.freeHangarBay()
    if (!bay) return false
    const path = nearestPath(this.tiles, f.stand, [bay], 'jet')
    if (!path || path.length < 2) {
      // Pavement gap — fall back to mechanic walk to the stand.
      if (f.mxPay) this.dispatchLineMx(f, f.mxPay)
      f.mxPending = false
      return false
    }
    f.hangarBay = bay
    f.path = path
    f.seg = 0
    f.t = 0
    f.phase = 'mx_taxi'
    f.phaseTime = 0
    f.waitingOn.mx = true
    f.mxPending = false
    this.pushNews(`${f.flightNo} taxiing to hangar for line MX.`, 'ok')
    return true
  }

  nearestFlight(v: Vec, maxDist = 1.8): Flight | undefined {
    let best: Flight | undefined
    let dist = maxDist
    for (const f of this.flights) {
      if (f.phase === 'gone') continue
      const d = Math.hypot(f.x - v.c, f.y - v.r)
      if (d < dist) {
        dist = d
        best = f
      }
    }
    return best
  }

  refundFor(tile: Tile, at?: Vec): number {
    if (tile === 'grass') return 0
    if (tile === 'runway') {
      // Blend regional + heavy unit cost so bulldozing either class is fair-ish.
      const unit =
        (RUNWAY_PREFAB_COST / (RUNWAY_PREFAB_LEN * RUNWAY_PREFAB_WID) +
          HEAVY_RUNWAY_COST / (HEAVY_RUNWAY_LEN * HEAVY_RUNWAY_WID)) /
        2
      return Math.round(unit * BULLDOZE_REFUND)
    }
    if (tile === 'terminal') return Math.round(TERMINAL_COST * BULLDOZE_REFUND * 0.25)
    if (tile === 'hotel' && at) {
      const cls = this.hotelClass[`${at.c},${at.r}`] ?? 'business'
      const tool =
        cls === 'inn' ? 'hotel_inn' : cls === 'resort' ? 'hotel_resort' : 'hotel_biz'
      const b = BUILDINGS.find((x) => x.tool === tool)
      return b ? Math.round(b.cost * BULLDOZE_REFUND) : 0
    }
    const b = BUILDINGS.find((x) => x.tile === tile)
    return b ? Math.round(b.cost * BULLDOZE_REFUND) : 0
  }

  occupiedByOps(v: Vec): boolean {
    return this.flights.some(
      (f) =>
        f.stand &&
        f.stand.c === v.c &&
        f.stand.r === v.r &&
        f.phase !== 'gone' &&
        f.phase !== 'hold' &&
        f.phase !== 'approach',
    )
  }

  siteAt(v: Vec): BuildSite | undefined {
    return this.sites.find((s) => s.cells.some((c) => c.c === v.c && c.r === v.r))
  }

  cellsBlocked(cells: Vec[]): boolean {
    return cells.some((p) => this.siteAt(p))
  }

  enqueueBuild(site: Omit<BuildSite, 'id' | 'elapsed' | 'duration' | 'warned' | 'vanArrived' | 'delivered' | 'crewSpawned'> & Partial<BuildSite>) {
    const full: BuildSite = {
      id: uid('site'),
      elapsed: 0,
      duration: buildSeconds(site.cells.length),
      warned: false,
      vanArrived: false,
      delivered: false,
      crewSpawned: false,
      ...site,
      cells: site.cells.map((c) => ({ ...c })),
    }
    this.sites.push(full)
    this.pushNews(
      `${full.name} is a construction site — a contractor is driving in. About ${Math.round(full.duration)}s.`,
      'ok',
    )
    this.emit()
  }

  cancelSite(id: string) {
    const site = this.sites.find((s) => s.id === id)
    if (!site) return
    const refund = Math.round(site.cost * BULLDOZE_REFUND)
    this.cash += refund
    this.sites = this.sites.filter((s) => s.id !== id)
    this.trucks = this.trucks.filter((t) => t.flightId !== id)
    this.pushNews(`Construction cancelled — refunded $${refund.toLocaleString('en-US')}.`, 'ok')
    this.emit()
  }

  buildApproach(site: BuildSite): Vec | null {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    for (const cell of site.cells) {
      for (const [dc, dr] of dirs) {
        const p = { c: cell.c + dc, r: cell.r + dr }
        if (!inBounds(p.c, p.r)) continue
        if (site.cells.some((c) => c.c === p.c && c.r === p.r)) continue
        const tile = this.tile(p)
        if (tile && walkableFor('truck', tile)) return p
      }
    }
    return null
  }

  ensureBuildCrew(site: BuildSite) {
    if (site.crewSpawned) return
    site.crewSpawned = true
    const edges = this.cityEdgeRoads()
    const approach = this.buildApproach(site)
    if (!edges.length || !approach) return
    const edge = edges[0]
    const guard = tilesOf(this.tiles, 'guard')[0]
    const off = {
      c: edge.c === 0 ? -2 : edge.c === SIZE - 1 ? SIZE + 1 : edge.c,
      r: edge.r === 0 ? -2 : edge.r === SIZE - 1 ? SIZE + 1 : edge.r,
    }
    let path: Vec[] | null = null
    if (guard) {
      const toGuard = nearestPath(this.tiles, edge, [guard], 'truck')
      const toSite = nearestPath(this.tiles, guard, [approach], 'truck')
      if (toGuard && toSite && toGuard.length > 1 && toSite.length > 1) {
        path = [off, ...toGuard, ...toSite.slice(1)]
      }
    }
    if (!path) {
      const direct = nearestPath(this.tiles, edge, [approach], 'truck')
      if (direct && direct.length > 1) path = [off, ...direct]
    }
    if (!path) return
    const roll = (kind: 'contractor' | 'delivery', wait: number) => {
      this.trucks.push({
        id: uid(kind),
        kind,
        flightId: site.id,
        x: off.c,
        y: off.r,
        path: path!.map((p) => ({ ...p })),
        seg: 0,
        t: 0,
        returning: false,
        dwell: 0,
        preDwell: wait,
        patrol: false,
        mission: guard ? 'build_guard' : 'build_site',
        home: approach,
        cargoUnits: kind === 'delivery' ? 8 : 0,
      })
    }
    roll('contractor', 0)
    roll('delivery', 1.4)
  }

  tickBuildTruck(t: Truck, step: number) {
    if (t.preDwell > 0) {
      t.preDwell -= step
      return
    }
    if (t.dwell > 0) {
      t.dwell -= step
      if (t.dwell > 0) return
      const site = this.sites.find((s) => s.id === t.flightId)
      if (t.mission === 'build_guard') {
        t.mission = 'build_site'
        if (t.home) {
          const from = { c: Math.round(t.x), r: Math.round(t.y) }
          const next = nearestPath(this.tiles, from, [t.home], 'truck')
          if (next && next.length > 1) {
            t.path = next
            t.seg = 0
            t.t = 0
            return
          }
        }
      }
      if (t.mission === 'build_site') {
        if (site) {
          if (t.kind === 'contractor') site.vanArrived = true
          if (t.kind === 'delivery') site.delivered = true
        }
        t.mission = 'build_out'
        t.returning = true
        t.path = [...t.path].reverse()
        t.seg = 0
        t.t = 0
        return
      }
      t.dwell = -99
      return
    }
    const arrived = this.followPath(t, t.kind === 'contractor' ? 2.4 : 2, step)
    if (!arrived) return
    if (t.mission === 'build_out') {
      t.dwell = -99
      return
    }
    t.dwell = t.mission === 'build_guard' ? 0.7 : t.kind === 'delivery' ? 1.5 : 1.1
  }

  tickConstruction(step: number) {
    for (const site of this.sites) {
      site.elapsed += step
      this.ensureBuildCrew(site)
      if (site.elapsed > site.duration * 0.25 && !site.vanArrived && !site.warned) {
        site.warned = true
        site.duration += 1.5
        this.pushNews(
          `${site.name} — contractor still on the road. The build slips a moment and keeps going.`,
          'ok',
        )
      }
      if (site.elapsed >= site.duration) this.finishSite(site)
    }
    this.sites = this.sites.filter((s) => s.elapsed < s.duration)
  }

  finishSite(site: BuildSite) {
    if (site.kind === 'single') {
      const v = site.cells[0]
      if (!v) return
      this.tiles[v.r][v.c] = site.tile
      const key = `${v.c},${v.r}`
      if (site.parkTerm) this.parkTerms[key] = site.parkTerm
      if (site.hotelClass) this.hotelClass[key] = site.hotelClass
      if (site.standClass) this.standClass[key] = site.standClass
      if (site.standAccess) this.standAccess[key] = site.standAccess
      this.pushNews(site.news ?? `${site.name} open.`, 'good')
    } else if (site.kind === 'runway') {
      for (const p of site.cells) this.tiles[p.r][p.c] = 'runway'
      this.pushNews(site.news ?? `${site.name} open.`, 'good')
    } else if (site.kind === 'terminal' || site.kind === 'premade') {
      const origin = site.origin ?? site.cells[0]
      for (const p of site.cells) this.tiles[p.r][p.c] = 'terminal'
      if (site.kind === 'premade') {
        this.fits.push(
          emptyFit(origin, true, {
            checkin: 2,
            security: 2,
            gate: 2,
            bagclaim: 1,
            food: 1,
            souvenir: 1,
            bagdrop: 1,
            lounge: 1,
            bathroom: 2,
          }),
        )
      } else {
        this.fits.push(emptyFit(origin, false))
      }
      this.selectedTile = origin
      const n = this.fits.length
      const label = this.hallLabel(this.fits[n - 1])
      this.pushNews(
        site.kind === 'premade'
          ? n >= 2
            ? `${label} premade online — multi-terminal campus.`
            : 'Premade terminal online — check-in, security, gates, claim, food.'
          : n >= 2
            ? `${label} shell up — campus now ${n} halls.`
            : 'Empty shell up. Furnish security or airlines will stay away.',
        'good',
      )
    }
    this.bumpMap()
    this.ensureGround()
    this.emit()
  }

  clearTile(v: Vec) {
    const building = this.siteAt(v)
    if (building) {
      this.cancelSite(building.id)
      return
    }
    const cur = this.tile(v)
    if (!cur || cur === 'grass') return
    if (this.occupiedByOps(v)) {
      this.pushNews('Cannot clear a live stand.', 'bad')
      this.emit()
      return
    }
    if (cur === 'terminal') {
      const origin = this.selectedTerminalOrigin()
      if (origin) {
        const fit = this.fits.find((f) => f.origin.c === origin.c && f.origin.r === origin.r)
        const w = fit?.premade ? 3 : 2
        const h = fit?.premade ? 3 : 2
        for (let r = 0; r < h; r++) {
          for (let c = 0; c < w; c++) {
            const p = { c: origin.c + c, r: origin.r + r }
            if (this.tile(p) === 'terminal') this.tiles[p.r][p.c] = 'grass'
          }
        }
        this.fits = this.fits.filter(
          (f) => !(f.origin.c === origin.c && f.origin.r === origin.r),
        )
        this.cash += Math.round(
          (fit?.premade ? PREMADE_TERMINAL_COST : TERMINAL_COST) * BULLDOZE_REFUND,
        )
      }
    } else {
      this.cash += this.refundFor(cur, v)
      this.tiles[v.r][v.c] = 'grass'
      delete this.parkTerms[`${v.c},${v.r}`]
      delete this.hotelClass[`${v.c},${v.r}`]
      delete this.standClass[`${v.c},${v.r}`]
      delete this.standAccess[`${v.c},${v.r}`]
    }
    this.bumpMap()
    this.ensureGround()
    this.emit()
  }

  prefabRunway(origin: Vec, klass: RunwayClass = 'regional'): Vec[] {
    const len =
      klass === 'heavy'
        ? HEAVY_RUNWAY_LEN
        : klass === 'short'
          ? SHORT_RUNWAY_LEN
          : RUNWAY_PREFAB_LEN
    const wid =
      klass === 'heavy'
        ? HEAVY_RUNWAY_WID
        : klass === 'short'
          ? SHORT_RUNWAY_WID
          : RUNWAY_PREFAB_WID
    const cells: Vec[] = []
    if (this.facing === 'h') {
      for (let r = 0; r < wid; r++) {
        for (let c = 0; c < len; c++) {
          cells.push({ c: origin.c + c, r: origin.r + r })
        }
      }
    } else {
      for (let c = 0; c < wid; c++) {
        for (let r = 0; r < len; r++) {
          cells.push({ c: origin.c + c, r: origin.r + r })
        }
      }
    }
    return cells
  }

  placeRunway(v: Vec, klass: RunwayClass = 'regional') {
    const cells = this.prefabRunway(v, klass)
    if (
      cells.some((p) => !inBounds(p.c, p.r) || this.tile(p) !== 'grass') ||
      this.cellsBlocked(cells)
    ) {
      const tip =
        klass === 'heavy'
          ? 'Need a clear plot for the heavy strip (20×3). Rotate if it hangs off.'
          : klass === 'short'
            ? 'Need a clear plot for the short strip (10×2). Regionals only.'
            : 'Need a clear plot for the runway. Hit Rotate if it hangs off.'
      this.pushNews(tip, 'bad')
      this.emit()
      return
    }
    const cost =
      klass === 'heavy'
        ? HEAVY_RUNWAY_COST
        : klass === 'short'
          ? SHORT_RUNWAY_COST
          : RUNWAY_PREFAB_COST
    const label =
      klass === 'heavy' ? 'heavy runway' : klass === 'short' ? 'short runway' : 'runway'
    if (!this.spend(cost, label)) {
      this.emit()
      return
    }
    const news =
      klass === 'heavy'
        ? 'Heavy strip open — widebodies and 747Fs can land.'
        : klass === 'short'
          ? 'Short strip open — CRJ / E-Jets / Citations only. Long metal will refuse.'
          : 'Regional runway open — A320 / 737 class OK.'
    this.enqueueBuild({
      kind: 'runway',
      cells,
      tile: 'runway',
      cost,
      name: label,
      news,
      runwayClass: klass,
      origin: v,
    })
  }

  placeTerminal(v: Vec) {
    const cells = [
      v,
      { c: v.c + 1, r: v.r },
      { c: v.c, r: v.r + 1 },
      { c: v.c + 1, r: v.r + 1 },
    ]
    if (cells.some((p) => this.tile(p) !== 'grass') || this.cellsBlocked(cells)) {
      this.pushNews('Need a clear 2×2 for the shell.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(TERMINAL_COST, 'terminal shell')) {
      this.emit()
      return
    }
    this.enqueueBuild({
      kind: 'terminal',
      cells,
      tile: 'terminal',
      cost: TERMINAL_COST,
      name: 'terminal shell',
      origin: v,
    })
  }

  placePremade(v: Vec) {
    const cells: Vec[] = []
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) cells.push({ c: v.c + c, r: v.r + r })
    }
    if (cells.some((p) => !inBounds(p.c, p.r) || this.tile(p) !== 'grass') || this.cellsBlocked(cells)) {
      this.pushNews('Need a clear 3×3 for the premade hall.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(PREMADE_TERMINAL_COST, 'premade terminal')) {
      this.emit()
      return
    }
    this.enqueueBuild({
      kind: 'premade',
      cells,
      tile: 'terminal',
      cost: PREMADE_TERMINAL_COST,
      name: 'premade terminal',
      origin: v,
    })
  }

  placeSingle(v: Vec) {
    const building = BUILDINGS.find((b) => b.tool === this.tool)
    if (!building) return
    if (building.minFieldLevel && this.fieldLevel() < building.minFieldLevel) {
      this.pushNews(`${building.name} needs Field level ${building.minFieldLevel}.`, 'bad')
      this.emit()
      return
    }
    if (this.tile(v) !== 'grass' || this.siteAt(v)) {
      this.pushNews(this.siteAt(v) ? 'Already a construction site.' : 'Needs grass.', 'bad')
      this.emit()
      return
    }
    if (building.tile === 'fuel' && !farmBesidePavement(this.tiles, v)) {
      this.pushNews('Park the farm beside taxi, stand, runway, or road.', 'bad')
      this.emit()
      return
    }
    if ((building.tile === 'kitchen' || building.tile === 'depot') && !farmBesidePavement(this.tiles, v)) {
      this.pushNews(`${building.name} needs a road, taxiway, or stand beside it.`, 'bad')
      this.emit()
      return
    }
    if (building.tile === 'guard') {
      const nearRoad = [
        { c: v.c + 1, r: v.r },
        { c: v.c - 1, r: v.r },
        { c: v.c, r: v.r + 1 },
        { c: v.c, r: v.r - 1 },
      ].some((p) => inBounds(p.c, p.r) && this.tile(p) === 'road')
      if (!nearRoad) {
        this.pushNews('Guard post needs a road edge (city approach).', 'bad')
        this.emit()
        return
      }
    }
    if (building.tile === 'deice' && !farmBesidePavement(this.tiles, v)) {
      this.pushNews('De-ice pad needs taxi / stand / runway edge.', 'bad')
      this.emit()
      return
    }
    if (this.tool === 'stand_l' && !this.hasResearch('stand_class')) {
      this.pushNews('Stand L locked — research Stand classes first.', 'bad')
      this.emit()
      return
    }
    if (building.tile === 'deice' && !this.hasResearch('deice')) {
      this.pushNews('De-ice pad locked — research De-ice ops first.', 'bad')
      this.emit()
      return
    }
    const isLandside =
      building.tile === 'hotel' ||
      building.tile === 'park_s' ||
      building.tile === 'park_l' ||
      building.tile === 'park_g' ||
      building.tile === 'park_u' ||
      building.tile === 'bus' ||
      building.tile === 'rail'
    if (isLandside) {
      const nearRoad = [
        { c: v.c + 1, r: v.r },
        { c: v.c - 1, r: v.r },
        { c: v.c, r: v.r + 1 },
        { c: v.c, r: v.r - 1 },
      ].some((p) => inBounds(p.c, p.r) && this.tile(p) === 'road')
      if (!nearRoad) {
        this.pushNews('Landside stamps need a road edge.', 'bad')
        this.emit()
        return
      }
    }
    if (building.tile === 'rail' && !this.railLinked) {
      this.pushNews('Rail station locked — invest in City rail first.', 'bad')
      this.emit()
      return
    }
    const jetwayStand =
      building.tile === 'stand' && this.standAccessMode === 'jetway'
    const stampCost = jetwayStand
      ? Math.round(building.cost * STAND_JETWAY_MULT)
      : building.cost
    if (!this.spend(stampCost, jetwayStand ? `${building.name} + jetway` : building.name)) {
      this.emit()
      return
    }
    const standCls: StandClass =
      this.tool === 'stand_s' ? 'S' : this.tool === 'stand_l' ? 'L' : 'M'
    const hotelCls: HotelClass =
      this.tool === 'hotel_inn' ? 'inn' : this.tool === 'hotel_resort' ? 'resort' : 'business'
    let news = `${building.name} open.`
    if (
      building.tile === 'park_s' ||
      building.tile === 'park_l' ||
      building.tile === 'park_g' ||
      building.tile === 'park_u'
    ) {
      news = `${building.name} (${this.parkTerm}-term) open.`
    } else if (building.tile === 'stand' && this.standAccessMode === 'jetway') {
      news = `${building.name} + jetway open.`
    } else if (building.tile === 'stand') {
      news = `${building.name} remote bay open.`
    } else if (building.tile === 'guard') {
      news = 'Guard post online — city cargo trucks will screen here before the shed.'
    } else if (building.tile === 'cargo') {
      news = 'Cargo shed online — city trucks need a guard post on the road to deliver cleanly.'
    } else if (building.tile === 'termbus') {
      news = `Terminal bus depot online ($${TERMBUS_COST.toLocaleString()}). Remote stands can ferry instead of walking.`
    } else if (building.tile === 'deice') {
      news = `De-ice pad online ($${DEICE_PAD_COST.toLocaleString()}). Glycol trucks roll in storm/fog.`
    } else if (building.tile === 'bus') {
      news = `Bus curb online ($${BUS_CURB_COST.toLocaleString()}). Budget pax can ride in.`
    } else if (building.tile === 'rail') {
      news = `Rail station open ($${RAIL_STATION_COST.toLocaleString()}). Business pax prefer the train.`
    } else if (building.tile === 'hangar') {
      news = 'Hangar up.'
    } else if (building.tile === 'belt') {
      news = `Bag belt open ($${BELT_COST.toLocaleString()}). Link hall, sort, and stand.`
    } else if (building.tile === 'kitchen') {
      news = 'Catering kitchen open. Meals cook here for the galley trucks.'
    } else if (building.tile === 'depot') {
      news = 'Vehicle depot open. Fuel, galley, bag, and bus trucks stage here.'
    }
    this.enqueueBuild({
      kind: 'single',
      cells: [v],
      tile: building.tile,
      cost: stampCost,
      name: building.name,
      news,
      tool: this.tool,
      standClass: building.tile === 'stand' ? standCls : undefined,
      standAccess: building.tile === 'stand' ? this.standAccessMode : undefined,
      hotelClass: building.tile === 'hotel' ? hotelCls : undefined,
      parkTerm:
        building.tile === 'park_s' ||
        building.tile === 'park_l' ||
        building.tile === 'park_g' ||
        building.tile === 'park_u'
          ? this.parkTerm
          : undefined,
      origin: v,
    })
  }

  standClassAt(stand: Vec | null): StandClass {
    if (!stand) return 'M'
    return this.standClass[`${stand.c},${stand.r}`] ?? 'M'
  }

  standFitsClass(stand: Vec, need: StandClass): boolean {
    return standClassRank(this.standClassAt(stand)) >= standClassRank(need)
  }

  /**
   * ICAO fit: S/M/L map to B/C/F. Helicopters are not sent through that map.
   * The wingspan disc must also miss other parked aircraft and the terminal.
   */
  standFitsAirframe(stand: Vec, airframeId: string): boolean {
    const spec = getAircraftSpec(airframeId)
    if (spec.icao === 'H') return false
    if (!standAccepts(standLetter(this.standClassAt(stand)), spec.icao)) return false
    const others = this.flights
      .filter(
        (f) =>
          f.stand &&
          (f.craft ?? 'jet') === 'jet' &&
          f.phase !== 'gone' &&
          f.phase !== 'takeoff' &&
          !(f.stand.c === stand.c && f.stand.r === stand.r),
      )
      .map((f) => ({
        c: f.stand!.c,
        r: f.stand!.r,
        spanM: getAircraftSpec(f.airframeId || 'b738').spanM,
      }))
    const blocks: { c: number; r: number }[] = []
    for (let r = 0; r < this.tiles.length; r++) {
      const row = this.tiles[r]
      if (!row) continue
      for (let c = 0; c < row.length; c++) {
        if (row[c] === 'terminal') blocks.push({ c, r })
      }
    }
    return !wingDiscsClash(stand, spec.spanM, others, blocks)
  }

  ghostCells(hover: Vec | null): Vec[] {
    if (!hover) return []
    if (this.tool === 'runway_short') return this.prefabRunway(hover, 'short')
    if (this.tool === 'runway') return this.prefabRunway(hover, 'regional')
    if (this.tool === 'runway_heavy') return this.prefabRunway(hover, 'heavy')
    if (this.tool === 'terminal') {
      return [
        hover,
        { c: hover.c + 1, r: hover.r },
        { c: hover.c, r: hover.r + 1 },
        { c: hover.c + 1, r: hover.r + 1 },
      ]
    }
    if (this.tool === 'premade') {
      const cells: Vec[] = []
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) cells.push({ c: hover.c + c, r: hover.r + r })
      }
      return cells
    }
    return [hover]
  }

  ghostRunway(hover: Vec): Vec[] {
    return this.ghostCells(hover)
  }

  groundBusy(): boolean {
    return this.flights.some(
      (f) =>
        (f.craft ?? 'jet') === 'jet' &&
        (['landing', 'taxi_in', 'pushback', 'taxi_out', 'takeoff'] as Phase[]).includes(
          f.phase,
        ),
    )
  }

  freeStands(): Vec[] {
    const stands = tilesOf(this.tiles, 'stand')
    const used = new Set(
      this.flights
        .filter(
          (f) =>
            (f.craft ?? 'jet') === 'jet' &&
            f.stand &&
            f.phase !== 'gone' &&
            f.phase !== 'takeoff',
        )
        .map((f) => `${f.stand!.c},${f.stand!.r}`),
    )
    return stands.filter((s) => {
      if (used.has(`${s.c},${s.r}`)) return false
      return Boolean(this.pathStandToRunway(s))
    })
  }

  /**
   * Prefer jetway-linked stands, load-balance across halls, then nearest hall.
   * Multi-terminal lite — second hall pulls its own bank of gates.
   * Optional `need` filters by stand S/M/L class.
   */
  assignStand(
    pref?: Vec | null,
    need?: StandClass,
    airlineId?: AirlineId,
    airframeId?: string,
  ): Vec | null {
    let free = this.freeStands()
    if (airframeId) free = free.filter((s) => this.standFitsAirframe(s, airframeId))
    else if (need) free = free.filter((s) => this.standFitsClass(s, need))
    if (airlineId) {
      const refuse = this.diplomacy?.refusedGates(airlineId) ?? 0
      if (refuse > 0) free = free.slice(refuse)
    }
    if (!free.length) return null
    if (pref) {
      const hit = free.find((s) => s.c === pref.c && s.r === pref.r)
      if (hit) return hit
    }
    if (!this.fits.length) {
      const terms = tilesOf(this.tiles, 'terminal')
      if (!terms.length) return free[0]
      free.sort((a, b) => {
        const da = Math.min(...terms.map((t) => Math.abs(t.c - a.c) + Math.abs(t.r - a.r)))
        const db = Math.min(...terms.map((t) => Math.abs(t.c - b.c) + Math.abs(t.r - b.r)))
        return da - db
      })
      return free[0]
    }
    const beltOn = hasBeltNetwork(this.tiles)
    const scored = free.map((s) => {
      const hall = this.jetwayHall(s)
      const load = hall ? this.occupiedAtHall(hall) : 99
      const d = hall
        ? Math.abs(hall.origin.c - s.c) + Math.abs(hall.origin.r - s.r)
        : 99
      const belt = !beltOn || standBeltLinked(this.tiles, s)
      return { s, jet: hall != null, belt, load, d }
    })
    scored.sort((a, b) => {
      if (a.jet !== b.jet) return a.jet ? -1 : 1
      if (a.belt !== b.belt) return a.belt ? -1 : 1
      if (a.load !== b.load) return a.load - b.load
      return a.d - b.d
    })
    return scored[0].s
  }

  /** Gate label — T1·G2·M·JW when jetway-linked, else G#·class·bus/walk. */
  gateLabel(stand: Vec | null): string {
    if (!stand) return '—'
    const cls = this.standClassAt(stand)
    const hall = this.jetwayHall(stand)
    if (hall) {
      const local = this.standsForHall(hall)
      const idx = local.findIndex((s) => s.c === stand.c && s.r === stand.r)
      return `${this.hallLabel(hall)}·G${idx >= 0 ? idx + 1 : '?'}·${cls}·JW`
    }
    const stands = tilesOf(this.tiles, 'stand')
    const idx = stands.findIndex((s) => s.c === stand.c && s.r === stand.r)
    const mode = this.standPaxMode(stand)
    const suffix = mode === 'bus' ? 'bus' : this.standAccessAt(stand) === 'jetway' ? 'JW?' : 'walk'
    return idx >= 0 ? `G${idx + 1}·${cls}·${suffix}` : `${stand.c},${stand.r}·${cls}`
  }

  holdingCount(): number {
    return this.flights.filter(
      (f) => (f.craft ?? 'jet') === 'jet' && f.phase === 'hold',
    ).length
  }

  /** Open timetable slots scale with stamped strips (not a hard 2-RW world). */
  scheduleCap(): number {
    const strips = Math.max(1, this.runwayStripCount())
    return Math.min(28, 10 + strips * 4)
  }

  maxInbound(): number {
    // Tower unlocks parallel approaches; each stamped strip adds a bank.
    // No hard 2-strip ceiling — more asphalt = more simultaneous inbound.
    const tower = tilesOf(this.tiles, 'tower').length > 0
    if (!tower) return 1
    const strips = this.runwayStripCount()
    let n = 1 + Math.min(6, Math.max(1, strips))
    if (this.hasResearch('stand_class')) n += 1
    // Extra terminal campuses — one more simultaneous approach each (cap 2).
    if (this.fits.length >= 2) n += Math.min(2, this.fits.length - 1)
    return Math.min(10, n)
  }

  /** Least-busy strip index for auto bank; null if only one strip. */
  pickBalancedRunway(): number | null {
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    if (strips.length < 2) return null
    const load = strips.map(() => 0)
    for (const s of this.openSchedule()) {
      const pref = s.runwayPref
      if (pref != null && pref >= 0 && pref < load.length) load[pref] += 1
      else {
        // Unassigned count as soft load on every strip (tower will pick).
        for (let i = 0; i < load.length; i++) load[i] += 0.35
      }
    }
    for (const f of this.flights) {
      if (f.phase === 'gone' || f.craft === 'helo') continue
      // Prefer strip their landing path used if we stored pref on schedule.
      const slot = f.scheduleId
        ? this.schedule.find((x) => x.id === f.scheduleId)
        : null
      const pref = slot?.runwayPref
      if (pref != null && pref >= 0 && pref < load.length) load[pref] += 1.2
    }
    let best = 0
    for (let i = 1; i < load.length; i++) {
      if (load[i] < load[best]) best = i
    }
    return best
  }

  /** Open slots filtered by runway bank (`null` = all; `-1` = auto-only). */
  scheduleForRunway(rw: number | null): ScheduleSlot[] {
    const open = this.openSchedule()
    if (rw == null) return open
    if (rw === -1) return open.filter((s) => s.runwayPref == null)
    return open.filter((s) => s.runwayPref === rw)
  }

  setPlannerRwFilter(rw: number | null) {
    this.plannerRwFilter = rw
    this.emit()
  }

  freePads(): Vec[] {
    const pads = tilesOf(this.tiles, 'helipad')
    const used = new Set(
      this.flights
        .filter(
          (f) =>
            f.craft === 'helo' && f.stand && f.phase !== 'gone' && f.phase !== 'takeoff',
        )
        .map((f) => `${f.stand!.c},${f.stand!.r}`),
    )
    return pads.filter((p) => !used.has(`${p.c},${p.r}`))
  }

  /**
   * Taxi path stand → a runway strip.
   * Multi-runway: honor pref when that strip is reachable; otherwise fall back to the
   * nearest reachable strip so a second terminal / far pad isn't soft-locked.
   */
  pathStandToRunway(stand: Vec, runwayPref?: number | null): Vec[] | null {
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    if (!strips.length) return null
    const pathTo = (idx: number) => nearestPath(this.tiles, stand, strips[idx], 'jet')
    if (runwayPref != null && strips[runwayPref]) {
      const pref = pathTo(runwayPref)
      if (pref) return pref
    }
    let best: Vec[] | null = null
    for (let i = 0; i < strips.length; i++) {
      if (runwayPref != null && i === runwayPref) continue
      const p = pathTo(i)
      if (p && (!best || p.length < best.length)) best = p
    }
    // Last resort — any cell on any strip (same as legacy flatten).
    return best ?? nearestPath(this.tiles, stand, strips.flat(), 'jet')
  }

  landingRoute(stand: Vec, runwayPref?: number | null): Vec[] | null {
    const toRunway = this.pathStandToRunway(stand, runwayPref)
    if (!toRunway || toRunway.length < 2) return null
    const entry = toRunway[toRunway.length - 1]
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    const strip = strips.find((s) => s.some((p) => p.c === entry.c && p.r === entry.r))
    if (!strip) return null
    const idx = strip.findIndex((p) => p.c === entry.c && p.r === entry.r)
    const fromStart = strip.slice(0, idx + 1)
    const fromEnd = [...strip].reverse().slice(0, strip.length - idx)
    const approach = fromStart.length >= fromEnd.length ? fromStart : fromEnd
    const taxi = [...toRunway].reverse()
    const merged = [...approach]
    for (const p of taxi) {
      const last = merged[merged.length - 1]
      if (!last || last.c !== p.c || last.r !== p.r) merged.push(p)
    }
    return merged
  }

  /** How many stands can still reach at least one strip — campus health check. */
  connectedStandCount(): number {
    return tilesOf(this.tiles, 'stand').filter((s) => this.pathStandToRunway(s)).length
  }

  campusPathLine(): string {
    const strips = this.runwayStripCount()
    const stands = tilesOf(this.tiles, 'stand').length
    const linked = this.connectedStandCount()
    const halls = this.fits.length
    const orphan = stands - linked
    return `${halls}T · ${strips} RW · ${linked}/${stands} stands linked${
      orphan > 0 ? ` · ${orphan} orphan` : ''
    }`
  }

  trySpawn() {
    if (!this.signed.length) return
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    if (!tilesOf(this.tiles, 'stand').length) return

    const inbound = this.flights.filter((f) =>
      (['hold', 'approach', 'landing', 'taxi_in'] as Phase[]).includes(f.phase),
    )

    // Prefer the timetable. If nothing is due, only seed when auto and bank empty.
    const slot = this.nextDueSlot()
    // Spawn cool must not leave due slots rotting past ETA (bank soft-lock).
    if (this.spawnCool > 0) {
      if (slot && slot.eta < this.clock - 6) {
        this.delaySlot(slot, 6 + Math.random() * 5, 'Tower sequencing')
      }
      return
    }
    if (!slot) {
      if (!this.scheduleAuto) return
      const open = this.openSchedule().filter((s) => s.status !== 'inbound')
      if (open.length > 0) return // wait for ETA
      const active = this.signed.filter((id) => !this.isBanned(id))
      if (active.length) this.seedScheduleForAirline(pick(active), 2)
      return
    }
    if (this.isBanned(slot.airline)) {
      slot.status = 'cancelled'
      this.pushNews(`${slot.flightNo} scrubbed — airline banned.`, 'bad')
      return
    }

    // At inbound capacity or pavement jammed — slip the due slot instead of soft-locking the bank.
    if (inbound.length >= this.maxInbound() || (this.groundBusy() && !this.assignStand())) {
      const hosts = this.stolenHosts()
      const reason = hosts.length ? 'Gate stolen (emergency)' : 'Runway backlog'
      this.delaySlot(slot, 10 + Math.random() * 8, reason)
      if (hosts.length) {
        this.pushNews(
          `${slot.flightNo} slipped — ${hosts[0].flightNo} still holds ${this.gateLabel(hosts[0].stand)} (emergency host).`,
          'bad',
        )
      } else if (Math.random() < 0.45) {
        this.pushNews(
          `${slot.flightNo} slipped — runway backlog. Cascade may hit later slots.`,
          'bad',
        )
      }
      this.spawnCool = 5
      return
    }

    const airlineId = slot.airline
    const def = this.airline(airlineId)
    const preferred = this.pickAircraftKind(airlineId)
    const af = pickAirframeWithFallback(
      preferred,
      this.longestRunway(),
      def.kind === 'cargo',
      this.researchUnlocked,
    )
    if (!af) {
      this.delaySlot(slot, 20, 'Strip too short')
      this.pushNews(
        `${slot.flightNo} delayed — strip ${this.longestRunway()}c can't take their metal.`,
        'bad',
      )
      this.spawnCool = 8
      return
    }
    if (slot.runwayPref == null) slot.runwayPref = this.pickBalancedRunway()
    // If pavement is busy, slip the slot instead of parking a hold that
    // reserves a stand forever (that deadlocked releaseHold).
    if (this.groundBusy()) {
      this.delaySlot(slot, 8 + Math.random() * 6, 'Pavement busy')
      this.spawnCool = 4
      return
    }
    const needCls = standClassFor(af.kind)
    const stand = this.assignStand(slot.standPref ?? null, needCls, airlineId, af.id)
    const route = stand ? this.landingRoute(stand, slot.runwayPref) : null
    if (!stand || !route) {
      const anyFree = this.freeStands().length > 0
      const hosts = this.stolenHosts()
      const reason =
        !anyFree && hosts.length
          ? 'Gate stolen (emergency)'
          : anyFree
            ? 'Stand class short'
            : 'No gate / path'
      this.delaySlot(slot, 10 + Math.random() * 8, reason)
      if (!anyFree && hosts.length) {
        this.pushNews(
          `${slot.flightNo} holding — emergency ${hosts[0].flightNo} stole ${this.gateLabel(hosts[0].stand)}.`,
          'bad',
        )
      } else if (anyFree) {
        this.pushNews(
          `${slot.flightNo} needs Stand ${needCls}+ — class or path missing.`,
          'bad',
        )
      }
      this.spawnCool = 5
      return
    }
    const approach = this.armApproach(route)
    const load = this.flightLoad(af, def.persona, def.kind === 'cargo')
    const gate = this.gateLabel(stand)
    const f: Flight = {
      id: uid('flt'),
      airline: airlineId,
      flightNo: slot.flightNo,
      airframeId: af.id,
      airframeName: af.name,
      pax: load.pax,
      cargo: def.kind === 'cargo',
      craft: 'jet',
      kind: af.kind,
      phase: 'approach',
      stand,
      x: approach.x,
      y: approach.y,
      z: approach.z,
      heading: 0,
      path: approach.path,
      seg: 0,
      t: 0,
      holdAngle: Math.random() * Math.PI * 2,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
      scheduleId: slot.id,
      boardingSlow: Math.random() < 0.18,
      destination: pick(ROUTE_CITIES),
      fuelLevel: load.fuelLevel,
      caterLevel: def.kind === 'cargo' ? 1 : 0.18 + Math.random() * 0.2,
      hangarBay: null,
      mxEndsAt: null,
      mxPending: false,
      bagUnits: load.bagUnits,
      bagStage: def.kind === 'cargo' ? 'idle' : 'inflight',
      bagsDeposited: 0,
      claimLane: slot.claimLane ?? null,
    }
    this.flights.push(f)
    if (!f.cargo) this.assignClaimLane(f)
    this.noteCraft(af.kind)
    slot.status = 'inbound'
    slot.flightId = f.id
    this.spawnCool = tilesOf(this.tiles, 'tower').length ? 10 : 14
    this.selectedFlight = this.selectedFlight ?? f.id
    const role = craftRoleLabel(af.kind)
    const late = slot.delaySec > 0 ? ` (${Math.round(slot.delaySec)}s late)` : ''
    this.pushNews(
      `${def.name} ${f.flightNo}${late} · ${role} ${af.name} → ${gate}.`,
      slot.delaySec > 0 ? 'bad' : 'ok',
    )
  }

  trySpawnHelo() {
    this.heloCool = Math.max(0, this.heloCool)
    if (this.heloCool > 0) return
    const pads = this.freePads()
    if (!pads.length) return
    // Fire station is the AT3-style “you’re serious about rotary” gate.
    if (!tilesOf(this.tiles, 'fire').length) return
    if (this.flights.some((f) => f.craft === 'helo' && f.phase !== 'gone')) return
    // Starved ambulance budget — medevac and exec both cool their heels.
    if (this.budgets.ambulance < 20) {
      if (Math.random() < 0.08) {
        this.pushNews('Choppers overflew — no medics on the pad budget.', 'bad')
      }
      this.heloCool = 20
      return
    }

    const pad = pads[0]
    const medevac = Math.random() < 0.45
    if (medevac && this.budgets.ambulance < 45) {
      // Executives still come; medevac wants real ambulance cover.
      this.heloCool = 12
      return
    }
    const airlineId: AirlineId = this.signed[0] ?? 'harbor'
    this.flightSeq += 1
    const call = medevac ? `MED${this.flightSeq}` : `EXE${this.flightSeq}`
    const af = medevac ? AIRFRAMES.aw139 : AIRFRAMES.s76
    const f: Flight = {
      id: uid('helo'),
      airline: airlineId,
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: af.paxMin + Math.floor(Math.random() * (af.paxMax - af.paxMin + 1)),
      cargo: false,
      craft: 'helo',
      kind: af.kind,
      phase: 'approach',
      stand: pad,
      x: pad.c + 5.5,
      y: pad.r - 4.5,
      z: 11,
      heading: Math.atan2(pad.r - (pad.r - 4.5), pad.c - (pad.c + 5.5)),
      path: [pad],
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
    }
    this.flights.push(f)
    this.noteCraft(af.kind)
    this.heloCool = 75 + Math.random() * 40
    this.selectedFlight = this.selectedFlight ?? f.id
    this.pushNews(
      medevac
        ? `${call} · Emergency ${af.name} medevac → pad ${pad.c},${pad.r}.`
        : `${call} · Executive ${af.name} inbound.`,
      'ok',
    )
  }

  tickHelo(f: Flight, step: number) {
    if (!f.stand) {
      f.phase = 'gone'
      this.noteCargoCancel(f)
      return
    }
    const pad = f.stand
    if (f.phase === 'approach' || f.phase === 'landing' || f.phase === 'taxi_in') {
      // Straight-in hover to the pad.
      const dx = pad.c - f.x
      const dy = pad.r - f.y
      const dist = Math.hypot(dx, dy)
      f.heading = Math.atan2(dy, dx)
      const speed = 1.9
      if (dist > 0.12) {
        f.x += (dx / dist) * Math.min(dist, speed * step)
        f.y += (dy / dist) * Math.min(dist, speed * step)
      }
      f.z = lerp(f.z, dist < 0.8 ? 0.35 : 2.2, 1 - Math.pow(0.08, step))
      if (dist < 0.2 && f.z < 0.55) {
        f.phase = 'servicing'
        f.phaseTime = 0
        f.z = 0.28
        if (!f.posted.landing) {
          f.posted.landing = true
          this.earn(HELO_LANDING, `${f.flightNo} pad fee`, f)
          this.reputation = Math.min(100, this.reputation + 1)
        }
      } else if (f.phase === 'approach' && f.phaseTime > 1.2) {
        f.phase = 'landing'
      }
      return
    }
    if (f.phase === 'servicing' || f.phase === 'deboard' || f.phase === 'board') {
      f.phase = 'servicing'
      if (this.fuelOutage(f)) {
        f.fuelHeld = true
        if (f.fuelHeldSince == null) f.fuelHeldSince = this.clock
        this.noteFuelGround(f)
        if (this.clock - f.fuelHeldSince >= FUEL_OUTAGE_SLOT_SEC) this.cancelForFuel(f)
        return
      }
      if (f.fuelHeld) {
        f.fuelHeld = false
        f.phaseTime = 0
        this.fuelHoldNoted.delete(f.id)
        return
      }
      if (f.phaseTime > 7) {
        f.phase = 'takeoff'
        f.phaseTime = 0
        f.heading = Math.random() * Math.PI * 2
      }
      return
    }
    if (f.phase === 'takeoff') {
      f.z += step * 2.8
      f.x += Math.cos(f.heading) * step * 2.1
      f.y += Math.sin(f.heading) * step * 2.1
      if (f.phaseTime > 5 || f.z > 12) {
        f.phase = 'gone'
        this.flightsDone += 1
        this.paxServed += f.pax
        this.noteTurn(f)
        this.grantResearchForFlight(f)
        if (f.kind !== 'military' && f.kind !== 'air_ambulance') {
          this.grantFieldXp(6 + Math.min(8, Math.floor(f.pax / 40)), 'turnaround')
        }
        this.gradeDiplomacyTurn(f)
        this.noteCargoDepart(f)
        this.pushNews(`${f.flightNo} lifted off the pad.`, 'good')
      }
    }
  }

  releaseHold() {
    const hasTower = tilesOf(this.tiles, 'tower').length > 0
    if (this.groundBusy() && !hasTower) return
    // Tower: allow a held jet to commit if no landing/takeoff in progress.
    if (
      hasTower &&
      this.flights.some((f) =>
        (['landing', 'takeoff'] as Phase[]).includes(f.phase),
      )
    ) {
      return
    }
    if (!hasTower && this.groundBusy()) return
    // Prefer holds that already reserved a stand — those were deadlocking
    // assignStand() because freeStands() treated the reservation as occupied.
    const held = this.flights.filter(
      (x) => x.phase === 'hold' && (x.craft ?? 'jet') === 'jet',
    )
    const f = held.find((x) => x.stand) ?? held[0]
    if (!f) return
    const slot = f.scheduleId
      ? this.schedule.find((s) => s.id === f.scheduleId)
      : null
    const stand = f.stand ?? this.assignStand(slot?.standPref ?? null, undefined, f.airline, f.airframeId)
    if (!stand) return
    const route =
      this.landingRoute(stand, slot?.runwayPref ?? null) ??
      this.landingRoute(stand, null)
    if (!route) {
      // Bad pref path — drop reservation so another hold can try.
      if (f.phaseTime > 40) {
        f.stand = null
        f.path = []
      }
      return
    }
    const inbound = this.armApproach(route)
    f.stand = stand
    f.path = inbound.path
    f.seg = 0
    f.t = 0
    f.phase = 'approach'
    f.phaseTime = 0
    f.z = inbound.z
    f.x = inbound.x
    f.y = inbound.y
    if (Math.random() < 0.4) {
      this.pushNews(
        `${f.flightNo} cleared to ${this.gateLabel(stand)}${hasTower ? ' (tower)' : ''}.`,
        'ok',
      )
    }
  }

  /** Abort ancient holds so reserved gates and inbound slots free up. */
  tickHoldWatchdog(dt: number) {
    for (const f of this.flights) {
      if (f.phase !== 'hold' || (f.craft ?? 'jet') !== 'jet') continue
      if (f.phaseTime < 95) continue
      // Divert — free the stand, scrub the slot, ding heat.
      if (f.stand) f.stand = null
      f.path = []
      f.phase = 'gone'
      f.phaseTime = 0
      this.noteCargoCancel(f)
      if (f.scheduleId) {
        const slot = this.schedule.find((s) => s.id === f.scheduleId)
        if (slot) {
          slot.status = 'cancelled'
          slot.delayReason = 'hold timeout'
        }
      }
      this.adjustHeat(f.airline, -4)
      this.reputation = Math.max(0, this.reputation - 1)
      this.noteDiplomacyCancel(f.airline, false)
      this.pushNews(
        `${f.flightNo} diverted after long hold — gate freed, Standing dips.`,
        'bad',
      )
    }
    void dt
  }

  /** Nearby jets / trucks / apron walkers slow everyone — bad layouts jam. */
  congestionAt(x: number, y: number, selfId?: string): number {
    let n = 0
    const R = 1.15
    for (const f of this.flights) {
      if (f.id === selfId || f.phase === 'gone' || f.phase === 'hold') continue
      if (
        (f.craft ?? 'jet') === 'jet' &&
        (f.phase === 'taxi_in' ||
          f.phase === 'taxi_out' ||
          f.phase === 'pushback' ||
          f.phase === 'mx_taxi' ||
          f.phase === 'mx_return' ||
          f.phase === 'landing')
      ) {
        if (Math.hypot(f.x - x, f.y - y) < R) n++
      }
    }
    for (const t of this.trucks) {
      if (t.id === selfId) continue
      if (Math.hypot(t.x - x, t.y - y) < R) n++
    }
    for (const p of this.people) {
      if (p.id === selfId) continue
      if (p.job !== 'arrive' && p.job !== 'board' && p.job !== 'mechanic') continue
      if (Math.hypot(p.x - x, p.y - y) < R) n++
    }
    return n
  }

  followPath(
    ent: {
      id?: string
      x: number
      y: number
      heading?: number
      path: Vec[]
      seg: number
      t: number
    },
    speed: number,
    dt: number,
  ): boolean {
    if (!ent.path.length) return true
    if (ent.seg >= ent.path.length - 1) {
      const last = ent.path[ent.path.length - 1]
      ent.x = last.c
      ent.y = last.r
      return true
    }
    const cong = this.congestionAt(ent.x, ent.y, ent.id)
    if (cong > this.congPeak) this.congPeak = cong
    const factor = 1 / (1 + Math.max(0, cong) * 0.65)
    // Waste ≈ extra time vs clear pavement — feeds readable jam news (E2).
    if (cong >= 2) {
      this.congWasteAcc += dt * (1 / factor - 1)
    }
    const a = ent.path[ent.seg]
    const b = ent.path[ent.seg + 1]
    const dist = Math.abs(b.c - a.c) + Math.abs(b.r - a.r) || 1
    ent.t += (speed * factor * dt) / dist
    while (ent.t >= 1 && ent.seg < ent.path.length - 1) {
      ent.t -= 1
      ent.seg += 1
      if (ent.seg >= ent.path.length - 1) {
        const last = ent.path[ent.path.length - 1]
        ent.x = last.c
        ent.y = last.r
        return true
      }
    }
    const a2 = ent.path[Math.min(ent.seg, ent.path.length - 1)]
    const b2 = ent.path[Math.min(ent.seg + 1, ent.path.length - 1)]
    ent.x = lerp(a2.c, b2.c, clamp(ent.t, 0, 1))
    ent.y = lerp(a2.r, b2.r, clamp(ent.t, 0, 1))
    ent.heading = Math.atan2(b2.r - a2.r, b2.c - a2.c)
    return false
  }

  roomsAt(stand: Vec | null): TerminalFit | null {
    if (!this.fits.length) return null
    if (!stand) return this.fits[0]
    let best = this.fits[0]
    let bestD = 99
    for (const f of this.fits) {
      const d = Math.abs(f.origin.c - stand.c) + Math.abs(f.origin.r - stand.r)
      if (d < bestD) {
        best = f
        bestD = d
      }
    }
    return best
  }

  beginServicing(f: Flight) {
    if (!f.stand) return
    this.armGroundTurn(f)
    const airline = this.airline(f.airline)
    if (!f.posted.landing) {
      f.posted.landing = true
      if (f.kind === 'military') {
        const mult = AIRFRAMES[f.airframeId]?.landingMult ?? 1
        this.earn(Math.round(MIL_LANDING * mult), `${f.flightNo} ${f.airframeName} landing`, f)
      } else if (f.kind === 'air_ambulance') {
        this.earn(AIR_AMBULANCE_FEE, `${f.flightNo} ${f.airframeName}`, f)
      } else {
        const mult =
          (AIRFRAMES[f.airframeId]?.landingMult ?? 1) *
          this.landingFeeMult(f.airline) *
          this.diplomacyFeeFactor(f.airline)
        this.earn(Math.round(airline.landing * mult), `${f.flightNo} landing (${f.airframeName})`, f)
      }
      if (
        (f.craft ?? 'jet') === 'jet' &&
        f.kind !== 'military' &&
        f.kind !== 'air_ambulance' &&
        this.mxSigned.includes(f.airline) &&
        tilesOf(this.tiles, 'hangar').length &&
        this.mechanics > 0 &&
        this.budgets.maintenance >= 40
      ) {
        const pay = Math.round(
          airline.landing * (airline.kind === 'cargo' ? 0.22 : 0.18) + this.mechanics * 120,
        )
        // Plane will taxi to hangar after stand services — not a sidewalk mechanic.
        f.mxPending = true
        f.mxPay = pay
      } else if (
        this.mxSigned.includes(f.airline) &&
        (this.mechanics < 1 || this.budgets.maintenance < 40)
      ) {
        this.pushNews(
          `${airline.name} MX skipped — need funded mechanics in the hangar.`,
          'bad',
        )
      }
    }

    if (f.kind === 'military' || f.kind === 'air_ambulance') {
      // Quick turn — fuel only if farm exists; no hall / bags circus.
      const farmsQuick = tilesOf(this.tiles, 'fuel').filter((p) =>
        farmBesidePavement(this.tiles, p),
      )
      if (
        !f.groundTurn &&
        this.fuelBrand &&
        this.fuelLoads > 0 &&
        farmsQuick.length &&
        nearestPath(this.tiles, farmsQuick[0], [f.stand], 'truck')
      ) {
        const p = nearestPath(this.tiles, farmsQuick[0], [f.stand], 'truck')
        if (p) {
          f.waitingOn.fuel = true
          this.spawnTruck('fuel', f, p, 'fuel', farmsQuick[0])
        }
      }
      return
    }

    if (f.cargo) {
      const shed = tilesOf(this.tiles, 'cargo')
      if (shed.length && f.stand) {
        const cargoPath = nearestPath(this.tiles, shed[0], [f.stand], 'truck')
        if (cargoPath) {
          // Shed → freighter uplift needs staged warehouse stock (city trucks fill it).
          const need = clamp(18 + Math.floor(f.pax / 8), 18, 48)
          if (this.cargoWarehouse < need * 0.35) {
            f.waitingOn.bags = true
            this.adjustHeat(f.airline, -2.4)
            this.pushNews(
              `${f.flightNo} late uplift — warehouse thin (${this.cargoWarehouse}u). City trucks / guard pipeline.`,
              'bad',
            )
          }
          f.waitingOn.bags = true
          this.spawnTruck('bags', f, cargoPath, 'unload', shed[0])
          const tr = this.trucks[this.trucks.length - 1]
          if (tr?.kind === 'bags') {
            const take = Math.min(this.cargoWarehouse, need)
            this.cargoWarehouse = Math.max(0, this.cargoWarehouse - take)
            tr.cargoUnits = take > 0 ? take : 6
            tr.preDwell = take > 0 ? 1.2 + take * 0.04 : 2.8
          }
        }
      }
    }

    const bagBuild = tilesOf(this.tiles, 'bags')
    const snackBuild = tilesOf(this.tiles, 'snack')
    const farms = tilesOf(this.tiles, 'fuel').filter((p) =>
      farmBesidePavement(this.tiles, p),
    )
    const fit = this.roomsAt(f.stand)

    if (!f.cargo) {
      // Arrival unload: shed → plane → claim/sort at shed → continue or park.
      if (bagBuild.length > 0 && f.stand) {
        this.noteBagBeltIssue(f)
        const bagPath = nearestPath(this.tiles, bagBuild[0], [f.stand], 'truck')
        if (bagPath) {
          f.waitingOn.bags = true
          this.spawnTruck('bags', f, bagPath, 'unload', bagBuild[0])
        }
      }
      const snackPath =
        this.caterBrand && snackBuild.length > 0 && f.stand
          ? nearestPath(this.tiles, snackBuild[0], [f.stand], 'truck')
          : null
      if (!f.groundTurn && snackPath) {
        f.waitingOn.catering = true
        this.spawnTruck('catering', f, snackPath, 'cater', snackBuild[0])
      }
      // Cabin clean — AT/CEO turnaround service. Posts only after the jet is on stand.
      if (!f.posted.catering) {
        /* cleaning is timed during servicing, paid once below */
      }
    }

    if (
      !f.groundTurn &&
      this.fuelBrand &&
      this.fuelLoads > 0 &&
      farms.length &&
      nearestPath(this.tiles, farms[0], [f.stand], 'truck')
    ) {
      const p = nearestPath(this.tiles, farms[0], [f.stand], 'truck')
      if (p) {
        f.waitingOn.fuel = true
        this.spawnTruck('fuel', f, p, 'fuel', farms[0])
      }
    }

    if (f.cargo) return

    this.seedHallForFlight(f, 'arrive')
    const mode = this.standPaxMode(f.stand)
    if (mode === 'jetway') {
      // Jetway — no apron walkers; deboard timer only.
      f.waitingOn.paxOut = 0
    } else if (mode === 'bus' && this.dispatchTermBus(f, 'arrive')) {
      f.waitingOn.paxOut = 1
    } else {
      const visual = Math.max(8, Math.min(18, Math.round(f.pax / 6)))
      f.waitingOn.paxOut = visual
      this.people.push(...spawnArrivalPax(this.tiles, f.id, f.stand, fit, visual))
      if (mode !== 'walk') {
        this.pushNews(
          `${f.flightNo} walking remote stand — bus depot missing or blocked.`,
          'ok',
        )
      }
    }
  }

  trySpawnMilitary() {
    if (!this.milAgreement) return
    this.milCool = Math.max(0, this.milCool)
    if (this.milCool > 0) return
    if (this.groundBusy()) return
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    // Prefer dedicated mil ramp; never steal a busy pax jetway if a hardstand exists.
    const stand = this.assignMilStand()
    if (!stand) {
      this.milCool = 18
      if (Math.random() < 0.35) {
        this.pushNews(
          'Guard holding — mil ramp busy or missing hangar-side hardstand.',
          'ok',
        )
      }
      return
    }
    const route = this.landingRoute(stand)
    if (!route) {
      this.milCool = 15
      return
    }
    let af = pickAirframe('military', this.longestRunway(), this.researchUnlocked)
    if (!af) {
      this.milCool = 25
      return
    }
    // C-5 needs heavy strip even with mil_ramp research.
    if (af.id === 'c5' && !this.hasHeavyRunway()) {
      const lighter = pickAirframe(
        'military',
        this.longestRunway(),
        this.researchUnlocked.filter((id) => id !== 'mil_ramp'),
      )
      if (!lighter) {
        this.milCool = 30
        return
      }
      af = lighter
    }
    let gate = stand
    let path = route
    if (!this.standFitsAirframe(gate, af.id)) {
      const alt = this.assignStand(null, undefined, undefined, af.id)
      const altRoute = alt ? this.landingRoute(alt) : null
      if (!alt || !altRoute) {
        this.milCool = 20
        return
      }
      gate = alt
      path = altRoute
    }
    this.spawnMilitaryFlight(af, gate, path)
  }

  private spawnMilitaryFlight(
    af: (typeof AIRFRAMES)[string],
    stand: Vec,
    route: Vec[],
  ) {
    this.flightSeq += 1
    const prefix =
      af.id === 'f15'
        ? 'VIPER'
        : af.id === 'kc135'
          ? 'ANG'
          : af.id === 'c17'
            ? 'REACH'
            : af.id === 'c5'
              ? 'REACH'
              : 'RDR'
    const call = `${prefix}${this.flightSeq}`
    const fighter = af.id === 'f15'
    const inbound = this.armApproach(route)
    const f: Flight = {
      id: uid('mil'),
      airline: this.signed[0] ?? 'harbor',
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: 0,
      cargo: !fighter,
      craft: 'jet',
      kind: 'military',
      phase: 'approach',
      stand,
      x: inbound.x,
      y: inbound.y,
      z: inbound.z,
      heading: 0,
      path: inbound.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
    }
    this.flights.push(f)
    this.noteCraft('military')
    this.milCool = fighter ? 70 + Math.random() * 35 : 100 + Math.random() * 50
    this.selectedFlight = this.selectedFlight ?? f.id
    const gate = this.gateLabel(stand)
    this.pushNews(
      fighter
        ? `${call} · ${af.name} fighter drag inbound (Guard host).`
        : `${call} · ${af.name} military transit → ${gate} (mil ramp).`,
      'ok',
    )
  }

  trySpawnAirAmbulance() {
    this.ambuCool = Math.max(0, this.ambuCool)
    if (this.ambuCool > 0) return
    if (this.budgets.ambulance < 50) return
    if (!tilesOf(this.tiles, 'fire').length) return
    if (this.groundBusy()) return
    const af = pickAirframe(
      'air_ambulance',
      this.longestRunway(),
      this.researchUnlocked,
    )
    if (!af) {
      this.ambuCool = 30
      return
    }
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    const stand = this.assignStand(null, undefined, undefined, af.id)
    if (!stand) return
    const route = this.landingRoute(stand)
    if (!route) return
    this.flightSeq += 1
    const call = `LIF${this.flightSeq}`
    const inbound = this.armApproach(route)
    const f: Flight = {
      id: uid('amb'),
      airline: this.signed[0] ?? 'harbor',
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: this.flightLoad(af, 'business', false).pax,
      cargo: false,
      craft: 'jet',
      kind: 'air_ambulance',
      phase: 'approach',
      stand,
      x: inbound.x,
      y: inbound.y,
      z: inbound.z,
      heading: 0,
      path: inbound.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
    }
    this.flights.push(f)
    this.noteCraft('air_ambulance')
    this.ambuCool = 130 + Math.random() * 70
    this.pushNews(
      `${call} · Emergency ${af.name} air ambulance → ${this.gateLabel(stand)}.`,
      'ok',
    )
  }

  spawnTruck(
    kind: Truck['kind'],
    f: Flight | null,
    path: Vec[],
    mission?: TruckMission,
    home?: Vec | null,
  ) {
    const start = path[0]
    const resolved: TruckMission =
      mission ??
      (kind === 'bags'
        ? 'unload'
        : kind === 'fuel'
          ? 'fuel'
          : kind === 'catering'
            ? 'cater'
            : kind === 'deice'
              ? 'deice'
              : 'patrol')
    // Real ops: makeup load at shed / bottom-load at farm / glycol fill at pad before rolling.
    // Bag makeup/unload prep scales with bag units (visible work time).
    let pre =
      resolved === 'load'
        ? 1.7
        : resolved === 'fuel'
          ? 1.3
          : resolved === 'fuel_reload'
            ? 1.6
            : resolved === 'deice'
              ? 1.1
              : 0
    let cargoUnits = 0
    if (kind === 'bags' && f && !f.cargo) {
      if (resolved === 'load' || resolved === 'pickup') {
        pre = this.bagWorkSeconds(f, 'sort')
        cargoUnits = f.bagsDeposited ?? f.bagUnits ?? 0
        this.setBagStage(f, resolved === 'load' ? 'load_aircraft' : 'outbound_sort')
      } else if (resolved === 'unload') {
        this.assignClaimLane(f)
        this.setBagStage(f, 'unload_aircraft')
      }
    }
    this.trucks.push({
      id: uid('trk'),
      kind,
      flightId: f?.id ?? null,
      x: start.c,
      y: start.r,
      path,
      seg: 0,
      t: 0,
      returning: false,
      dwell: 0,
      preDwell: pre,
      patrol: !f,
      mission: resolved === 'fuel_reload' ? 'fuel' : resolved,
      home: home ?? (path.length ? path[0] : null),
      cargoUnits,
    })
  }

  /** Storm/fog + De-ice ops research + stamped pad → glycol truck before pushback. */
  needsDeiceService(f: Flight): boolean {
    if ((f.craft ?? 'jet') !== 'jet') return false
    if (f.posted.deiced) return false
    if (!this.hasResearch('deice')) return false
    if (this.weather !== 'storm' && this.weather !== 'fog') return false
    if (!tilesOf(this.tiles, 'deice').length) return false
    return true
  }

  /**
   * Dispatch de-ice truck from pad → stand. Returns true when clear to push
   * (not needed, already sprayed, or force-timeout caller).
   */
  ensureDeice(f: Flight): boolean {
    if (!this.needsDeiceService(f)) {
      f.waitingOn.deice = false
      return true
    }
    if (f.posted.deiced) {
      f.waitingOn.deice = false
      return true
    }
    const enroute = this.trucks.some(
      (t) => t.kind === 'deice' && t.flightId === f.id && !t.returning,
    )
    if (enroute) {
      f.waitingOn.deice = true
      return false
    }
    const pads = tilesOf(this.tiles, 'deice')
    if (!f.stand || !pads.length) {
      f.waitingOn.deice = false
      return true
    }
    const path = nearestPath(this.tiles, pads[0], [f.stand], 'truck')
    if (!path || path.length < 2) {
      f.waitingOn.deice = true
      return false
    }
    f.waitingOn.deice = true
    this.spawnTruck('deice', f, path, 'deice', pads[0])
    if (Math.random() < 0.55) {
      this.pushNews(`${f.flightNo} holding for de-ice.`, 'ok')
    }
    return false
  }

  finishTruck(t: Truck) {
    if (!t.flightId) return
    const f = this.flights.find((x) => x.id === t.flightId)
    if (!f) return
    const airline = this.airline(f.airline)
    if (t.kind === 'bags') {
      if (t.mission === 'load') {
        if (!f.posted.bagsLoad) {
          t.cargoUnits = 0
          this.settleOutboundBags(f, false)
        }
      } else if (t.mission === 'unload' && !f.posted.bags) {
        // Aircraft unload complete — pay; then sort → assigned claim.
        f.posted.bags = true
        f.waitingOn.bags = false
        this.setBagStage(f, 'inbound_sort')
        this.assignClaimLane(f)
        t.cargoUnits = f.bagUnits ?? 0
        if (!f.cargo) {
          const units = f.bagUnits ?? estimateFlightBagUnits(airline.persona, f.pax)
          const mult = clamp(0.75 + units / 180, 0.75, 1.55)
          this.earn(Math.round(airline.bags * mult), `${f.flightNo} bag handling`, f)
          const fit = this.roomsAt(f.stand)
          if (fit) {
            const rooms = Math.max(fit.premade ? 1 : 0, fit.rooms.bagclaim ?? 0)
            const claimCap = rooms * (fit.premade ? 55 : 80)
            const overflow = Math.max(0, units - claimCap)
            if (overflow > 0.5) {
              const book = this.ensureBagBook(f)
              book.claimLeft = overflow
              f.claimLeft = overflow
              this.adjustHeat(f.airline, -1.8)
              this.pushNews(
                `${f.flightNo} claim jammed — ${Math.round(overflow)} of ${Math.round(units)} bag units offloaded. The hall holds ${Math.round(claimCap)}.`,
                'bad',
              )
            }
          }
        } else {
          let cargoMult = this.hasReward(f.airline, 'cargo_night') ? 1.28 : 1
          if (this.hasResearch('night_bank') && this.isNight()) cargoMult *= 1.35
          this.earn(
            Math.round(airline.landing * 0.35 * cargoMult),
            `${f.flightNo} cargo handling`,
            f,
          )
        }
        const fit = this.roomsAt(f.stand)
        if (
          !f.cargo &&
          fit &&
          fit.rooms.bagdrop > 0 &&
          tilesOf(this.tiles, 'bags').length &&
          !f.posted.bagDrop
        ) {
          f.posted.bagDrop = true
          this.earn(BAG_DROP_PAY, `${f.flightNo} bag drop`, f)
        }
      } else if (t.mission === 'sort_inbound' && !f.cargo) {
        this.setBagStage(f, 'deliver_claim')
        this.pushNews(
          `${f.flightNo} bags sorted → claim ${f.claimLane ?? 1}.`,
          'ok',
        )
      } else if (t.mission === 'to_claim' && !f.cargo) {
        this.setBagStage(f, 'on_claim')
        t.cargoUnits = 0
        this.pushNews(
          `${f.flightNo} bags on claim ${f.claimLane ?? 1}.`,
          'ok',
        )
      } else if (t.mission === 'pickup' && !f.cargo) {
        this.setBagStage(f, 'outbound_sort')
        t.cargoUnits = f.bagsDeposited ?? f.bagUnits ?? 0
      }
    }
    if (t.kind === 'fuel' && t.mission === 'fuel' && !f.posted.fuel && this.fuelBrand && this.fuelLoads > 0) {
      f.posted.fuel = true
      f.fuelLevel = 1
      f.waitingOn.fuel = false
      this.fuelLoads -= 1
      this.earn(FUEL[this.fuelBrand].pump, `${f.flightNo} fuel`, f)
    }
    if (t.kind === 'catering' && !f.posted.catering && this.caterBrand) {
      f.posted.catering = true
      f.caterLevel = 1
      f.waitingOn.catering = false
      const pay = Math.round(airline.catering * CATER[this.caterBrand].payoutMult)
      this.earn(pay, `${f.flightNo} catering (${CATER[this.caterBrand].name})`, f)
      this.mealSold = true
      this.reputation = Math.min(100, this.reputation + 1)
    }
    if (t.kind === 'deice' && t.mission === 'deice' && !f.posted.deiced) {
      f.posted.deiced = true
      f.waitingOn.deice = false
      this.earn(DEICE_FEE, `${f.flightNo} de-ice`, f)
      this.pushNews(`${f.flightNo} de-iced — clear to push.`, 'good')
    }
  }

  /**
   * After claim delivery / home return — assign next bags job.
   * Outbound loads always pickup at the shed first (makeup); unloads can go direct.
   */
  retargetBagsTruck(t: Truck): boolean {
    if (t.kind !== 'bags' || !t.home) return false
    const busy = new Set(
      this.trucks
        .filter((x) => x.kind === 'bags' && x.id !== t.id && x.flightId)
        .map((x) => x.flightId!),
    )
    const next = this.flights.find((f) => {
      if (!f.stand || busy.has(f.id)) return false
      if (f.phase === 'servicing' && f.waitingOn.bags && !f.posted.bags) return true
      if (f.phase === 'board' && f.waitingOn.bagsLoad && !f.posted.bagsLoad) return true
      return false
    })
    if (!next?.stand) return false
    const from = { c: Math.round(t.x), r: Math.round(t.y) }
    const atHome =
      Math.abs(from.c - t.home.c) + Math.abs(from.r - t.home.r) <= 1

    if (next.phase === 'board') {
      // Makeup: must load carts at the shed before rolling to the stand.
      if (!atHome) {
        const homePath = nearestPath(this.tiles, from, [t.home], 'truck')
        if (!homePath || homePath.length < 2) return false
        t.flightId = next.id
        t.mission = 'pickup'
        t.path = homePath
        t.seg = 0
        t.t = 0
        t.returning = true
        t.dwell = 0
        t.preDwell = 0
        return true
      }
      const path = nearestPath(this.tiles, t.home, [next.stand], 'truck')
      if (!path || path.length < 2) return false
      t.flightId = next.id
      t.mission = 'load'
      t.path = path
      t.seg = 0
      t.t = 0
      t.returning = false
      t.dwell = 0
      t.preDwell = 1.7
      return true
    }

    const path = nearestPath(this.tiles, from, [next.stand], 'truck')
    if (!path || path.length < 2) return false
    t.flightId = next.id
    t.mission = 'unload'
    t.path = path
    t.seg = 0
    t.t = 0
    t.returning = false
    t.dwell = 0
    t.preDwell = 0
    return true
  }

  /**
   * Fuel bowser: continue to next jet if farm stock remains (partial tank),
   * else deadhead to farm for bottom-load reload.
   */
  retargetFuelTruck(t: Truck): boolean {
    if (t.kind !== 'fuel' || !t.home || this.fuelLoads < 1) return false
    const busy = new Set(
      this.trucks
        .filter((x) => x.kind === 'fuel' && x.id !== t.id && x.flightId)
        .map((x) => x.flightId!),
    )
    const next = this.flights.find(
      (f) =>
        f.stand &&
        !busy.has(f.id) &&
        f.phase === 'servicing' &&
        f.waitingOn.fuel &&
        !f.posted.fuel,
    )
    if (!next?.stand) return false
    const from = { c: Math.round(t.x), r: Math.round(t.y) }
    const atFarm =
      Math.abs(from.c - t.home.c) + Math.abs(from.r - t.home.r) <= 1

    // After a delivery, prefer farm reload then roll (real bowser cycle).
    if (!atFarm && t.mission === 'fuel_reload') {
      const homePath = nearestPath(this.tiles, from, [t.home], 'truck')
      if (!homePath || homePath.length < 2) return false
      t.flightId = next.id
      t.mission = 'fuel_reload'
      t.path = homePath
      t.seg = 0
      t.t = 0
      t.returning = true
      t.dwell = 0
      t.preDwell = 0
      return true
    }
    if (atFarm || t.mission === 'fuel_reload') {
      const path = nearestPath(this.tiles, t.home, [next.stand], 'truck')
      if (!path || path.length < 2) return false
      t.flightId = next.id
      t.mission = 'fuel'
      t.path = path
      t.seg = 0
      t.t = 0
      t.returning = false
      t.dwell = 0
      t.preDwell = 1.4
      return true
    }
    // Still have product — continue apron-to-apron (hydrant-style multi-stop).
    const path = nearestPath(this.tiles, from, [next.stand], 'truck')
    if (!path || path.length < 2) return false
    t.flightId = next.id
    t.mission = 'fuel'
    t.path = path
    t.seg = 0
    t.t = 0
    t.returning = false
    t.dwell = 0
    t.preDwell = 0
    return true
  }

  beginBoarding(f: Flight) {
    if (!f.stand || f.cargo) return
    const fit = this.roomsAt(f.stand)
    this.seedHallForFlight(f, 'depart')
    const mode = this.standPaxMode(f.stand)
    if (mode === 'jetway') {
      f.waitingOn.paxIn = 0
    } else if (mode === 'bus' && this.dispatchTermBus(f, 'depart')) {
      f.waitingOn.paxIn = 1
    } else {
      const visual = Math.max(8, Math.min(18, Math.round(f.pax / 6)))
      f.waitingOn.paxIn = visual
      this.people.push(...spawnDeparturePax(this.tiles, f.id, f.stand, fit, visual))
    }
    // Outbound bags: shed makeup pickup → plane deposit.
    const bagBuild = tilesOf(this.tiles, 'bags')
    if (bagBuild.length && !f.posted.bagsLoad) {
      this.noteBagBeltIssue(f)
      const path = nearestPath(this.tiles, bagBuild[0], [f.stand], 'truck')
      if (path) {
        f.waitingOn.bagsLoad = true
        this.spawnTruck('bags', f, path, 'load', bagBuild[0])
      }
    }
  }

  /**
   * Belt lite — once any belt exists, stands need makeup↔stand↔hall connectivity.
   * Broken chain: slower board + heat nick + news (trucks still roll for picture).
   */
  noteBagBeltIssue(f: Flight) {
    if (!f.stand || f.cargo) return
    if (!hasBeltNetwork(this.tiles)) return
    if (standBeltLinked(this.tiles, f.stand)) return
    f.boardingSlow = true
    this.adjustHeat(f.airline, -2.2)
    if (Math.random() < 0.55) {
      this.pushNews(
        `${f.flightNo} bags late — belt broken between hall, sort, and stand.`,
        'bad',
      )
    }
  }

  /** Terminal bus ferry for remote stands — depot ↔ stand. */
  dispatchTermBus(f: Flight, leg: 'arrive' | 'depart'): boolean {
    if (!f.stand) return false
    const depots = tilesOf(this.tiles, 'termbus')
    if (!depots.length) return false
    const home = depots[0]
    const path = nearestPath(this.tiles, home, [f.stand], 'truck')
    if (!path || path.length < 2) return false
    this.trucks.push({
      id: uid('tbus'),
      kind: 'termbus',
      flightId: f.id,
      x: home.c,
      y: home.r,
      path,
      seg: 0,
      t: 0,
      returning: false,
      dwell: 0,
      preDwell: leg === 'depart' ? 1.2 : 0.4,
      patrol: false,
      mission: leg === 'arrive' ? 'ferry_arr' : 'ferry_dep',
      home,
    })
    return true
  }

  /** Line MX: mechanic walks hangar → stand → hangar (real GSE delivery). */
  dispatchLineMx(f: Flight, payout: number) {
    if (!f.stand || f.posted.mx || f.waitingOn.mx) return
    const hangars = tilesOf(this.tiles, 'hangar')
    if (!hangars.length || this.mechanics < 1) return
    const path =
      nearestPath(this.tiles, hangars[0], [f.stand], 'mechanic') ??
      nearestPath(this.tiles, hangars[0], [f.stand], 'truck')
    if (!path || path.length < 2) {
      // No path — pay at hangar (remote line check radio).
      this.earn(payout, `${f.flightNo} line MX`, f)
      f.posted.mx = true
      return
    }
    f.waitingOn.mx = true
    this.people.push({
      id: uid('mx'),
      flightId: f.id,
      x: hangars[0].c,
      y: hangars[0].r,
      path,
      seg: 0,
      t: 0,
      color: '#7a9bb8',
      job: 'mechanic',
      itinerary: [],
      label: 'Line MX',
      wantBag: false,
      wantFood: false,
      wantGift: false,
      stage: 0,
      paidFood: false,
      paidGift: false,
      mxPay: payout,
    })
  }

  departurePath(f: Flight): Vec[] | null {
    if (!f.stand) return null
    const inbound = this.landingRoute(f.stand)
    if (!inbound) return null
    return [...inbound].reverse()
  }

  tickPatrols(dt: number) {
    this.patrolCool -= dt
    const posts = tilesOf(this.tiles, 'police')
    if (!posts.length) return
    const live = this.people.filter((p) => p.job === 'patrol').length
    if (live >= 2 || this.patrolCool > 0) return
    this.patrolCool = 18
    const start = posts[0]
    const goals = [
      ...tilesOf(this.tiles, 'terminal'),
      ...tilesOf(this.tiles, 'stand'),
      ...tilesOf(this.tiles, 'road'),
    ]
    const goal = goals.length ? pick(goals) : start
    const path = astar(this.tiles, start, goal, 'person') ?? [start]
    this.people.push({
      id: uid('cop'),
      flightId: '',
      x: start.c,
      y: start.r,
      path,
      seg: 0,
      t: 0,
      color: '#1e3a5f',
      job: 'patrol',
      itinerary: [],
      label: 'Patrol',
      wantBag: false,
      wantFood: false,
      wantGift: false,
      stage: 0,
      paidFood: false,
      paidGift: false,
    })
  }

  tickThreats(dt: number) {
    if (this.pendingThreat) {
      this.pendingThreat.age += dt
      this.pendingThreat.deadline -= dt
      if (this.pendingThreat.deadline <= 0) this.resolveThreat('ignore')
      return
    }
    this.threatCool -= dt
    if (this.threatCool > 0) return
    if (!this.signed.length || !this.flights.some((f) => !f.cargo && f.phase !== 'gone')) {
      this.threatCool = 16
      return
    }
    const sec = this.securityLevel()
    const police = tilesOf(this.tiles, 'police').length
    const wearSec = this.avgWear().sec
    const staffGap = 1 - this.budgets.security / 100
    const hasSecRoom = this.fits.some((f) => (f.rooms.security ?? 0) > 0)
    const airsideOpen = this.fits.some((f) => {
      const r = f.rooms
      return (r.food ?? 0) + (r.gate ?? 0) + (r.lounge ?? 0) + (r.souvenir ?? 0) > 0
    })
    const exposed = !hasSecRoom || this.budgets.security < 35
    // A gap the player left is checked again soon. A staffed lane is not held for the first hour.
    this.threatCool = exposed ? 10 + Math.random() * 8 : 32 + Math.random() * 12
    // Player shell with airside rooms but no security choke = smuggling / weapons risk.
    const openAirGap = airsideOpen && !hasSecRoom ? 0.38 : 0
    const risk = clamp(
      0.42 -
        sec * 0.12 -
        police * 0.08 +
        wearSec * 0.002 +
        staffGap * 0.22 +
        openAirGap,
      0.04,
      0.78,
    )
    if (Math.random() > risk) return
    const hard = !hasSecRoom || sec < 2 || this.budgets.security < 35
    this.pendingThreat = {
      id: uid('thr'),
      severity: hard ? 'hard' : 'soft',
      blurb: !hasSecRoom
        ? 'No security choke — weapons / smuggling path to airside. Scramble or own the headline.'
        : hard
          ? 'Hard alarm — possible threat past a weak lane. Scramble police or eat the headline.'
          : 'Suspicious bag on an outbound. Scramble screeners or hope the tape stays quiet.',
      age: 0,
      deadline: hard ? 18 : 24,
    }
    this.pushNews(`THREAT ALERT — decide now. ${this.pendingThreat.blurb}`, 'bad')
    this.emit()
  }

  /** What the field is missing for this emergency ask (null = can host). */
  emergencyHostGap(e: PendingEmergency): string | null {
    const n = e.needs
    if (n.minRunway > 0 && this.longestRunway() < n.minRunway) {
      return `strip only ${this.longestRunway()}c (need ${n.minRunway}c)`
    }
    if (!runwayStrips(this.tiles, Math.max(MIN_RUNWAY, n.minRunway || MIN_RUNWAY)).length) {
      return 'no usable runway'
    }
    if (n.stand && !this.freeStands().length) return 'no free stand'
    if (n.fire && !tilesOf(this.tiles, 'fire').length) return 'no ARFF / fire station'
    if (n.fuel) {
      if (!tilesOf(this.tiles, 'fuel').length) return 'no fuel farm'
      if (!this.fuelBrand && !this.groundSnapshot()) return 'no fuel contract'
      if (!this.fuelOnHand()) return 'fuel farm empty'
    }
    if (n.hangar && !tilesOf(this.tiles, 'hangar').length) return 'no hangar'
    if (n.hangar && this.mechanics < 1) return 'no mechanics for line MX'
    if (this.groundBusy() && !this.freeStands().length) return 'pavement jammed'
    return null
  }

  canHostEmergency(e: PendingEmergency): boolean {
    return this.emergencyHostGap(e) == null
  }

  emergencyNeedsLine(e: PendingEmergency): string {
    const bits: string[] = []
    if (e.needs.stand) bits.push('stand')
    if (e.needs.fire) bits.push('ARFF')
    if (e.needs.fuel) bits.push('fuel')
    if (e.needs.hangar) bits.push('hangar')
    if (e.needs.minRunway > 0) bits.push(`${e.needs.minRunway}c strip`)
    return bits.length ? bits.join(' · ') : 'clear pad'
  }

  private failEmergencyHost(e: PendingEmergency, why: string) {
    this.charge(EMERGENCY_FAIL_FINE)
    this.reputation = Math.max(0, this.reputation - 7)
    this.runwayCondition = Math.max(20, this.runwayCondition - 3)
    // Chaos — next fire risk sooner; carriers lose trust across the board.
    this.fireIncidentCool = Math.min(this.fireIncidentCool, 12)
    for (const id of this.signed) this.adjustHeat(id, -2.8)
    if (e.kind === 'divert' && e.airline) this.adjustHeat(e.airline, -7)
    if (this.public) {
      this.shockStock(
        `Failed emergency host — ${why}.`,
        this.public ? 0.78 : 1,
        Math.round(EMERGENCY_FAIL_FINE * 0.4),
      )
    } else {
      this.pushNews(
        `FAILED HOST — ${why}. Fine ${moneyLeft(EMERGENCY_FAIL_FINE)}; carriers cool on us.`,
        'bad',
      )
    }
  }

  /** One-shot divert landing — not a banked timetable slot. */
  private spawnEmergencyDivert(airline: AirlineId): boolean {
    if (this.isBanned(airline)) return false
    if (this.groundBusy() && !this.assignStand()) return false
    const preferred = this.pickAircraftKind(airline)
    const af = pickAirframeWithFallback(
      preferred,
      this.longestRunway(),
      this.airline(airline).kind === 'cargo',
      this.researchUnlocked,
    )
    if (!af) return false
    const stand = this.assignStand(null, undefined, airline, af.id)
    const route = stand ? this.landingRoute(stand) : null
    if (!stand || !route) return false
    this.flightSeq += 1
    const a = this.airline(airline)
    const call = `${a.name.slice(0, 2).toUpperCase()}D${this.flightSeq}`
    const inbound = this.armApproach(route)
    const load = this.flightLoad(af, a.persona, a.kind === 'cargo' || af.kind === 'freighter')
    const f: Flight = {
      id: uid('div'),
      airline,
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: load.pax,
      cargo: a.kind === 'cargo' || af.kind === 'freighter',
      craft: 'jet',
      kind: af.kind,
      phase: 'approach',
      stand,
      x: inbound.x,
      y: inbound.y,
      z: inbound.z,
      heading: 0,
      path: inbound.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
      bagUnits: load.bagUnits,
      bagStage: a.kind === 'cargo' ? 'idle' : 'inflight',
      bagsDeposited: 0,
      claimLane: null,
    }
    f.emergencyHost = true
    f.hostKind = 'divert'
    this.flights.push(f)
    if (!f.cargo) this.assignClaimLane(f)
    this.noteCraft(af.kind)
    this.selectedFlight = this.selectedFlight ?? f.id
    this.pushNews(
      `DIVERT ${call} · ${af.name} inbound now → ${this.gateLabel(stand)}${
        f.claimLane ? ` · claim ${f.claimLane}` : ''
      } (stolen bank slot).`,
      'ok',
    )
    return true
  }

  /** Pick CL-415 / AT-802 when the strip fits; fall back to medevac metal. */
  private pickAirtankerFrame() {
    const rw = this.longestRunway()
    const pool = [AIRFRAMES.cl415, AIRFRAMES.at802, AIRFRAMES.c130].filter(
      (a) => a && rw >= a.minRunway,
    )
    if (pool.length) return pick(pool)
    return (
      pickAirframe('air_ambulance', rw, this.researchUnlocked) ??
      AIRFRAMES.at802 ??
      AIRFRAMES.citation
    )
  }

  /** Firefighting plane — refuel-only or refuel + hangar MX. */
  private spawnEmergencyTanker(mx: boolean): boolean {
    if (this.groundBusy() && !this.assignStand()) return false
    const af = this.pickAirtankerFrame()
    if (!af) return false
    const stand = this.assignStand(null, undefined, undefined, af.id)
    const route = stand ? this.landingRoute(stand) : null
    if (!stand || !route) return false
    this.flightSeq += 1
    const call = mx ? `ATMX${this.flightSeq}` : `TANK${this.flightSeq}`
    const inbound = this.armApproach(route)
    const f: Flight = {
      id: uid('tnk'),
      airline: this.signed[0] ?? 'harbor',
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: 0,
      cargo: false,
      craft: 'jet',
      kind: 'air_ambulance',
      phase: 'approach',
      stand,
      x: inbound.x,
      y: inbound.y,
      z: inbound.z,
      heading: 0,
      path: inbound.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
      emergencyHost: true,
      hostKind: mx ? 'tanker_mx' : 'tanker',
    }
    this.flights.push(f)
    this.noteCraft('air_ambulance')
    this.selectedFlight = this.selectedFlight ?? f.id
    this.runwayCondition = Math.min(100, this.runwayCondition + (mx ? 5 : 3))
    this.fireIncidentCool = Math.max(this.fireIncidentCool, mx ? 60 : 45)
    // Hot-turn bonus on accept — bowser pay lands when the truck finishes.
    if (mx && this.mechanics > 0 && tilesOf(this.tiles, 'hangar').length) {
      const mxPay = 1200 + this.mechanics * 220
      this.earn(mxPay, `${call} airtanker line MX`)
    }
    this.pushNews(
      mx
        ? `${call} · ${af.name} inbound for refuel + MX → ${this.gateLabel(stand)} (stolen bank slot).`
        : `${call} · ${af.name} firefighting plane inbound for refuel only → ${this.gateLabel(stand)} (stolen bank slot).`,
      'ok',
    )
    return true
  }

  tickEmergencies(dt: number) {
    if (this.pendingEmergency) {
      this.pendingEmergency.age += dt
      this.pendingEmergency.deadline -= dt
      if (this.pendingEmergency.deadline <= 0) this.resolveEmergency('refuse')
      return
    }
    if (this.pendingThreat) return
    this.emergencyCool -= dt
    if (this.emergencyCool > 0 || !this.site) return

    const stormy = this.weather === 'storm' || this.weather === 'fog'
    const storm = this.weather === 'storm'
    const dry = this.weather === 'clear' // wildfire-season feel — airtankers thirsty
    const fireThin = this.budgets.fire < 45
    const hasFuel = this.fuelOnHand()
    const hasHangar = tilesOf(this.tiles, 'hangar').length > 0
    const exposed = !hasFuel || fireThin || tilesOf(this.tiles, 'fire').length === 0
    // Storms stack divert asks; dry clear days stack firefighting planes.
    // A missing farm or a thin fire crew is not hidden behind a first-hour timer.
    this.emergencyCool = exposed
      ? 12 + Math.random() * 8
      : stormy
        ? 22 + Math.random() * 10
        : 34 + Math.random() * 12

    const roll = Math.random()
    const pDivert =
      (storm ? 0.42 : this.weather === 'fog' ? 0.38 : 0.06) +
      (this.signed.length ? 0 : -1)
    // Firefighting planes: dry clear + storms (lightning starts) + thin ARFF.
    const pTanker =
      (dry ? 0.32 : storm ? 0.24 : fireThin ? 0.18 : 0.05) +
      (hasFuel ? 0.08 : -0.12) +
      (tilesOf(this.tiles, 'fire').length ? 0 : -0.1)
    const pTankerMx =
      (dry ? 0.2 : storm ? 0.14 : 0.04) +
      (hasHangar ? 0.1 : -0.12) +
      (hasFuel ? 0.06 : -0.1) +
      (fireThin ? 0.05 : 0)

    let kind: EmergencyKind | null = null
    // Weighted pick among kinds that rolled; weather can stack multiple hits.
    const hits: { k: EmergencyKind; w: number }[] = []
    if (this.signed.some((id) => !this.isBanned(id)) && roll < pDivert) {
      hits.push({ k: 'divert', w: pDivert })
    }
    if (roll < pTanker + 0.12 && pTanker > 0) hits.push({ k: 'tanker', w: Math.max(0.01, pTanker) })
    if (roll < pTankerMx + 0.08 && pTankerMx > 0) {
      hits.push({ k: 'tanker_mx', w: Math.max(0.01, pTankerMx) })
    }
    // Pure random spark — even calm days get occasional firefighting traffic.
    if (!hits.length && Math.random() < (stormy || dry ? 0.35 : 0.08)) {
      const pool: EmergencyKind[] = ['tanker']
      if (this.signed.some((id) => !this.isBanned(id))) pool.push('divert')
      if (hasHangar) pool.push('tanker_mx')
      kind = pick(pool)
    } else if (hits.length) {
      const sum = hits.reduce((s, h) => s + h.w, 0)
      let r = Math.random() * sum
      kind = hits[hits.length - 1].k
      for (const h of hits) {
        r -= h.w
        if (r <= 0) {
          kind = h.k
          break
        }
      }
    }
    if (!kind) return

    const deadline = storm ? 16 : stormy || dry ? 18 : 22
    if (kind === 'divert') {
      const pool = this.signed.filter((id) => !this.isBanned(id))
      const airline = pool.length ? pick(pool) : null
      if (!airline) return
      const fee =
        DIVERT_FEE_MIN + Math.floor(Math.random() * (DIVERT_FEE_MAX - DIVERT_FEE_MIN))
      const name = this.airline(airline).name
      const minRw = Math.max(MIN_RUNWAY, Math.min(14, this.longestRunway() || MIN_RUNWAY))
      const needs = {
        stand: true,
        fire: true,
        fuel: false,
        hangar: false,
        minRunway: minRw,
      }
      const weatherBit =
        this.weather === 'storm'
          ? 'Storm closed their dest'
          : this.weather === 'fog'
            ? 'Fog diverted them off the airway'
            : 'Weather / ATC divert'
      this.pendingEmergency = {
        id: uid('emg'),
        kind: 'divert',
        blurb: `${name} divert inbound — ${weatherBit.toLowerCase()}. One-time landing for ${moneyLeft(fee)}. Need stand + ARFF.`,
        fee,
        age: 0,
        deadline,
        airline,
        needs,
      }
    } else if (kind === 'tanker_mx') {
      this.pendingEmergency = {
        id: uid('emg'),
        kind: 'tanker_mx',
        blurb: dry
          ? 'Firefighting plane off the fire line — needs Jet-A top-off AND a hangar bay for line MX. Refuel + maintenance ask.'
          : 'Aerial tanker wants a quick turn: refuel at the farm, then hangar MX before the next drop. Host or the region talks.',
        fee: TANKER_MX_FEE,
        age: 0,
        deadline: deadline + 2,
        airline: null,
        needs: {
          stand: true,
          fire: true,
          fuel: true,
          hangar: true,
          minRunway: MIN_RUNWAY,
        },
      }
    } else {
      this.pendingEmergency = {
        id: uid('emg'),
        kind: 'tanker',
        blurb: dry
          ? 'Firefighting plane low on fuel — wants a one-time landing for a bowser top-off only, then back to the line.'
          : 'Aerial firefighter inbound for refuel only. Need stand, ARFF, and a live fuel farm — refuse and the drop gets delayed.',
        fee: TANKER_FEE,
        age: 0,
        deadline,
        airline: null,
        needs: {
          stand: true,
          fire: true,
          fuel: true,
          hangar: false,
          minRunway: MIN_RUNWAY,
        },
      }
    }

    const label =
      this.pendingEmergency.kind === 'divert'
        ? 'EMERGENCY ASK — weather divert wants a one-time landing.'
        : this.pendingEmergency.kind === 'tanker_mx'
          ? 'EMERGENCY ASK — firefighting plane wants refuel + MX.'
          : 'EMERGENCY ASK — firefighting plane wants refuel only.'
    this.pushNews(label, 'bad')
    this.emit()
  }

  resolveEmergency(choice: 'accept' | 'refuse') {
    const e = this.pendingEmergency
    if (!e) return
    this.pendingEmergency = null
    this.emergencyCool = 55 + Math.random() * 45

    if (choice === 'accept') {
      const gap = this.emergencyHostGap(e)
      if (gap) {
        this.failEmergencyHost(e, gap)
        this.emit()
        return
      }

      // Spawn the one-time landing first — fee only if metal actually arrives.
      let spawned = false
      if (e.kind === 'divert' && e.airline) {
        spawned = this.spawnEmergencyDivert(e.airline)
      } else if (e.kind === 'tanker_mx') {
        spawned = this.spawnEmergencyTanker(true)
      } else {
        spawned = this.spawnEmergencyTanker(false)
      }

      if (!spawned) {
        this.failEmergencyHost(e, 'could not clear a landing path')
        this.emit()
        return
      }

      const feeLabel =
        e.kind === 'divert'
          ? 'Divert host fee'
          : e.kind === 'tanker_mx'
            ? 'Airtanker refuel+MX fee'
            : 'Airtanker refuel fee'
      this.earn(e.fee, feeLabel)
      this.reputation = Math.min(100, this.reputation + (e.kind === 'tanker_mx' ? 3 : 2))
      if (e.kind === 'divert' && e.airline) {
        this.adjustHeat(e.airline, 7)
        for (const id of this.signed) {
          if (id !== e.airline) this.adjustHeat(id, 0.6)
        }
        this.pushNews(
          `Hosted ${this.airline(e.airline).name} divert — +${moneyLeft(e.fee)}. One-time landing inbound.`,
          'good',
        )
      } else {
        for (const id of this.signed) this.adjustHeat(id, 1.2)
        this.pushNews(
          e.kind === 'tanker_mx'
            ? `Firefighting plane hosted for refuel + MX — +${moneyLeft(e.fee)}. Region notices.`
            : `Firefighting plane hosted for refuel — +${moneyLeft(e.fee)}. Bowser rolling.`,
          'good',
        )
      }
      this.emit()
      return
    }

    // Refuse / timeout — cleaner than a failed host, still hurts.
    this.charge(EMERGENCY_REFUSE_FINE)
    this.reputation = Math.max(0, this.reputation - 4)
    if (e.kind === 'divert' && e.airline) {
      this.adjustHeat(e.airline, -8)
      for (const id of this.signed) {
        if (id !== e.airline) this.adjustHeat(id, -1.4)
      }
      this.pushNews(
        `Refused divert — ${this.airline(e.airline).name} furious. Fine ${moneyLeft(EMERGENCY_REFUSE_FINE)}.`,
        'bad',
      )
    } else {
      for (const id of this.signed) this.adjustHeat(id, -1.8)
      this.pushNews(
        e.kind === 'tanker_mx'
          ? `Refused firefighting plane (refuel+MX). Fine ${moneyLeft(EMERGENCY_REFUSE_FINE)} — region cools.`
          : `Refused firefighting plane refuel. Fine ${moneyLeft(EMERGENCY_REFUSE_FINE)} — carriers notice.`,
        'bad',
      )
    }
    this.emit()
  }

  resolveThreat(choice: 'scramble' | 'ignore') {
    const t = this.pendingThreat
    if (!t) return
    this.pendingThreat = null
    this.threatCool = 55 + Math.random() * 30
    const sec = this.securityLevel()
    const police = tilesOf(this.tiles, 'police').length
    const staff = this.budgets.security / 100

    if (choice === 'scramble') {
      if (!this.spend(THREAT_SCRAMBLE_COST, 'threat scramble')) {
        this.pushNews('Could not fund scramble — treated as ignore.', 'bad')
        choice = 'ignore'
      } else {
        const success =
          Math.random() < clamp(0.35 + sec * 0.12 + police * 0.15 + staff * 0.25, 0.2, 0.92)
        if (success) {
          this.reputation = Math.min(100, this.reputation + 3)
          if (this.public) {
            this.sharePrice = Math.round((this.sharePrice * 1.02) * 100) / 100
          }
          this.pushNews(
            'Scramble held — bag cleared, cameras love a clean intercept.',
            'good',
          )
          this.emit()
          return
        }
        this.pushNews('Scramble late — something still slipped. Damage control.', 'bad')
      }
    }

    this.securityIncidents += 1
    if (this.mission?.goal === 'noIncident') this.mission.progress = 0
    const fine =
      this.public
        ? t.severity === 'hard'
          ? 18000
          : 9000
        : t.severity === 'hard'
          ? 4000
          : 2500
    if (t.severity === 'hard') {
      this.shockStock(
        'SECURITY FAILURE — threat reached a departure.',
        this.public ? 0.55 : 1,
        fine,
      )
    } else {
      this.shockStock(
        'Suspicious bag story hits the wire.',
        this.public ? 0.82 : 1,
        fine,
      )
    }
    this.emit()
  }

  tick(dt: number) {
    if (!this.site || this.speed === 0) return
    const step = dt * this.speed
    this.clock += step
    this.simClock.advanceRealSeconds(dt, this.speed)
    this.ensureEconomy().tick(step * SIM_MINUTES_PER_REAL_SECOND)
    this.tickAmbience(dt)
    this.sampleEconomy(step)
    this.spawnCool = Math.max(0, this.spawnCool - step)
    this.offerCool = Math.max(0, this.offerCool - step)
    this.congNewsCool = Math.max(0, this.congNewsCool - step)
    this.tickCityCargo(step)
    this.tickConstruction(step)
    this.tickCatering(step)
    this.tickGround(step)
    this.tickCargo(step)
    this.tickDiplomacy(step)
    this.tickShelves(step)
    // Peak decays so the HUD jam line clears when traffic thins.
    this.congPeak = Math.max(0, this.congPeak - step * 0.35)
    if (this.congWasteAcc >= 8 && this.congNewsCool <= 0) {
      const lost = Math.round(this.congWasteAcc)
      this.pushNews(
        `Apron jam — traffic neck cost ~${lost}s. Widen taxi or move remote stands onto jetway/bus.`,
        'bad',
      )
      this.congWasteAcc = 0
      this.congNewsCool = 40
    } else if (this.congWasteAcc > 0 && this.congPeak < 1.2) {
      this.congWasteAcc = Math.max(0, this.congWasteAcc - step * 0.5)
    }
    this.saveTimer += step
    if (this.saveTimer > 8) {
      this.saveTimer = 0
      this.persist()
    }
    for (const n of this.news) n.age += step
    if (this.offer) {
      this.offer.age += step
      this.offer.deadline -= step
      if (this.offer.deadline <= 0) this.expireOffer()
    }

    this.loanNewsCool = Math.max(0, this.loanNewsCool - step)
    if (this.loanBalance > 0 && !this.sandbox) {
      this.interestCool -= step
      if (this.interestCool <= 0) {
        const prod =
          this.loanProduct(this.loanProductId) ??
          LOAN_PRODUCTS.find((p) => p.id === 'bridge')!
        this.interestCool = Math.max(12, prod.every)
        const opened =
          this.loanOpened > 0 ? this.loanOpened : prod.principal + prod.fee
        const tick = loanInterestDue(this.loanBalance, prod.rate, prod.interestFloor)
        if (this.cash >= tick) {
          // Paid in full — balance does NOT capitalize (was snowballing every tick).
          this.noteExpense(tick)
          this.cash -= tick
          if (this.loanNewsCool <= 0) {
            this.pushNews(
              `${prod.label} interest ${moneyLeft(tick)}. Owed ${moneyLeft(this.loanBalance)}.`,
              'ok',
            )
            this.loanNewsCool = Math.max(40, prod.every * 0.85)
          }
        } else {
          const paid = Math.max(0, this.cash)
          this.noteExpense(paid)
          this.cash = 0
          const short = tick - paid
          // Only unpaid shortfall capitalizes — hard-capped.
          this.loanBalance = nextLoanBalance(this.loanBalance, short, opened)
          this.reputation = Math.max(0, this.reputation - 1.5)
          if (this.loanNewsCool <= 0) {
            this.pushNews(
              `${prod.label} interest short ${moneyLeft(short)} — debt ${moneyLeft(this.loanBalance)}.`,
              'bad',
            )
            this.loanNewsCool = 25
          }
        }
      }
    } else if (this.sandbox && this.loanBalance > 0) {
      // Sandbox: loan is bookkeeping only — no interest freak-out.
      this.interestCool = 9999
    }
    // City rail soft-boosts pax demand via reputation drip.
    if (this.railLinked && Math.random() < step * 0.02) {
      this.reputation = Math.min(100, this.reputation + 0.05)
    }

    this.considerOffers()
    this.mxOfferCool = Math.max(0, this.mxOfferCool - step)
    if (this.mxOffer) {
      this.mxOffer.age += step
      this.mxOffer.deadline -= step
      if (this.mxOffer.deadline <= 0) this.expireMxOffer()
    }
    this.considerMxOffers()
    this.tickFieldTask(step)
    this.tickCargoVolume(step)
    this.tickLayover(step)
    this.tickHub(step)
    this.tickParking(step)
    this.tickJanitors(step)
    this.tickResearchers(step)
    this.tickDeskStaff(step)
    this.tickAirlineRelations(step)
    this.tickSchedule(step)
    this.trySpawn()
    this.heloCool = Math.max(0, this.heloCool - step)
    this.milCool = Math.max(0, this.milCool - step)
    this.ambuCool = Math.max(0, this.ambuCool - step)
    this.trySpawnHelo()
    this.trySpawnMilitary()
    this.trySpawnAirAmbulance()
    this.releaseHold()
    this.tickHoldWatchdog(step)
    this.tickPatrols(step)
    this.tickThreats(step)
    this.tickEmergencies(step)
    this.tickMarket(step)
    this.tickHall(step)
    this.tickLuggage(step)
    this.tickWeather(step)
    this.tickPayroll(step)
    this.tickMaintenance(step)
    this.tickFireRisk(step)
    this.crashCool = Math.max(0, this.crashCool - step)

    for (const f of this.flights) {
      if (f.phase === 'gone') continue
      f.phaseTime += step
      if (f.craft === 'helo') {
        this.tickHelo(f, step)
        continue
      }
      if (f.phase === 'hold') {
        f.holdAngle += step * 0.35
        f.x = SIZE / 2 + Math.cos(f.holdAngle) * 9
        f.y = -2.5 + Math.sin(f.holdAngle) * 1.6
        f.z = 9
        f.heading = f.holdAngle + Math.PI / 2
      } else if (f.phase === 'approach') {
        const threshold =
          f.path.find((p) => inBounds(Math.round(p.c), Math.round(p.r))) ??
          f.path[f.path.length - 1]
        const dist = threshold ? Math.hypot(f.x - threshold.c, f.y - threshold.r) : 0
        const glide = clamp(0.35 + dist * 0.7, 0.35, 22)
        f.z = lerp(f.z, glide, 1 - Math.pow(0.18, step))
        const arrived = this.followPath(f, 1.85, step)
        const onField = inBounds(Math.round(f.x), Math.round(f.y))
        if (arrived || (onField && f.phaseTime > 10) || f.phaseTime > 36) {
          f.phase = 'landing'
          f.phaseTime = 0
          f.z = Math.min(f.z, 1.4)
        }
      } else if (f.phase === 'landing') {
        f.z = lerp(f.z, 0.15, 1 - Math.pow(0.05, step))
        if (this.checkCrash(f, 'landing')) continue
        const arrived = this.followPath(f, 1.35, step)
        const onStand = f.stand && Math.hypot(f.x - f.stand.c, f.y - f.stand.r) < 0.35
        if (onStand || arrived) {
          f.phase = 'taxi_in'
          f.phaseTime = 0
        }
      } else if (f.phase === 'taxi_in') {
        f.z = 0.12
        if (this.followPath(f, 1.1, step)) {
          f.phase = 'deboard'
          f.phaseTime = 0
          this.beginServicing(f)
        }
      } else if (f.phase === 'deboard') {
        const mode = f.stand ? this.standPaxMode(f.stand) : 'walk'
        const pace = this.rampPace(f.airframeId, Boolean(f.cargo || f.kind === 'freighter'), f.airline)
        const deboardReady =
          f.cargo ||
          (mode === 'jetway' && f.phaseTime > 3.2 * pace) ||
          (mode === 'bus' &&
            ((f.waitingOn.paxOut <= 0 && f.phaseTime > 4.5 * pace) || f.phaseTime > 18 * pace)) ||
          (mode === 'walk' &&
            ((f.phaseTime > 6 * pace && f.waitingOn.paxOut <= 2) || f.phaseTime > 16 * pace))
        if (deboardReady) {
          f.phase = 'servicing'
          f.phaseTime = 0
        }
      } else if (f.phase === 'servicing') {
        const special =
          f.kind === 'military' || f.kind === 'air_ambulance' || f.kind === 'freighter'
        if (
          !special &&
          f.phaseTime > 2.5 &&
          !f.ledger.some((r) => r.label.includes('cleaning'))
        ) {
          this.earn(CLEANING_FEE, `${f.flightNo} cabin cleaning`, f)
        }
        const waiting =
          (f.waitingOn.bags && !f.posted.bags) ||
          (f.waitingOn.fuel && !f.posted.fuel) ||
          (f.waitingOn.catering && !f.posted.catering)
        const pace = this.rampPace(f.airframeId, Boolean(f.cargo || f.kind === 'freighter'), f.airline)
        if ((!waiting && f.phaseTime > 4 * pace) || f.phaseTime > Math.min(36, 22 * pace)) {
          f.waitingOn.bags = false
          f.waitingOn.fuel = false
          f.waitingOn.catering = false
          if (f.mxPending && !f.posted.mx && this.startHangarMx(f)) {
            // Handled — plane rolling to hangar bay.
          } else if (f.ga) {
            f.phase = 'parked'
            f.phaseTime = 0
            this.pushNews(
              `${f.flightNo} parked at ${this.gateLabel(f.stand)} — leave by ${Math.max(0, Math.round((f.parkLeaveBy ?? this.clock) - this.clock))}s.`,
              'ok',
            )
          } else if (f.cargo || f.kind === 'military' || f.kind === 'air_ambulance') {
            const deiceOk =
              (f.phaseTime > 3 ? this.ensureDeice(f) : !this.needsDeiceService(f)) ||
              f.phaseTime > 28
            const ramp = this.rampCall(f, f.phaseTime > 80)
            if (deiceOk && ramp !== 'hold' && (!this.groundBusy() || f.phaseTime > 24)) {
              if (ramp === 'short') {
                this.adjustHeat(f.airline, -1.2)
                this.pushNews(
                  `${f.flightNo} pushed with the ramp unfinished. Standing dips.`,
                  'bad',
                )
              }
              if (!f.posted.deiced && this.needsDeiceService(f)) {
                f.waitingOn.deice = false
                this.adjustHeat(f.airline, -1.2)
                this.pushNews(
                  `${f.flightNo} pushed without glycol — Standing dips.`,
                  'bad',
                )
              }
              f.phase = 'pushback'
              f.phaseTime = 0
              if (f.stand) {
                f.path = [
                  f.stand,
                  {
                    c: f.stand.c - 0.7,
                    r: f.stand.r,
                  },
                ]
                f.seg = 0
                f.t = 0
              }
            }
          } else {
            f.phase = 'board'
            f.phaseTime = 0
            this.beginBoarding(f)
          }
        }
      } else if (f.phase === 'mx_taxi') {
        f.z = 0.12
        if (this.followPath(f, 1.05, step) || f.phaseTime > 40) {
          const bay = f.hangarBay
          if (bay) {
            f.x = bay.c
            f.y = bay.r
          }
          f.phase = 'mx_bay'
          f.phaseTime = 0
          f.mxDuration = this.hangarMxDuration()
          f.mxEndsAt = this.clock + f.mxDuration
          this.pushNews(
            `${f.flightNo} in hangar bay — MX ~${Math.ceil(f.mxDuration)}s.`,
            'ok',
          )
        }
      } else if (f.phase === 'mx_bay') {
        f.z = 0.1
        if (this.clock >= (f.mxEndsAt ?? this.clock) || f.phaseTime > 36) {
          const pay = f.mxPay ?? 0
          if (pay > 0) this.earn(pay, `${f.flightNo} hangar line MX`, f)
          f.posted.mx = true
          f.waitingOn.mx = false
          f.mxPay = 0
          f.mxEndsAt = null
          if (f.stand) {
            const back =
              nearestPath(this.tiles, f.hangarBay ?? { c: f.x, r: f.y }, [f.stand], 'jet') ?? [
                f.stand,
              ]
            f.path = back
            f.seg = 0
            f.t = 0
            f.phase = 'mx_return'
            f.phaseTime = 0
          } else {
            f.phase = 'board'
            f.phaseTime = 0
            this.beginBoarding(f)
          }
        }
      } else if (f.phase === 'mx_return') {
        f.z = 0.12
        if (this.followPath(f, 1.05, step) || f.phaseTime > 40) {
          if (f.stand) {
            f.x = f.stand.c
            f.y = f.stand.r
          }
          f.hangarBay = null
          if (f.cargo || f.kind === 'military' || f.kind === 'air_ambulance') {
            const ramp = this.rampCall(f, f.phaseTime >= 90)
            if (ramp === 'hold') {
              /* Fuel outage, or the ramp is still inside its window. */
            } else {
              if (ramp === 'short') {
                this.adjustHeat(f.airline, -1.2)
                this.pushNews(
                  `${f.flightNo} pushed with the ramp unfinished. Standing dips.`,
                  'bad',
                )
              }
              f.phase = 'pushback'
              f.phaseTime = 0
              if (f.stand) {
                f.path = [f.stand, { c: f.stand.c - 0.7, r: f.stand.r }]
                f.seg = 0
                f.t = 0
              }
            }
          } else {
            f.phase = 'board'
            f.phaseTime = 0
            this.beginBoarding(f)
          }
        }
      } else if (f.phase === 'parked') {
        // Occupies stand until releaseGa / auto leave in tickParking.
      } else if (f.phase === 'board') {
        const mode = f.stand ? this.standPaxMode(f.stand) : 'walk'
        const pace = this.rampPace(f.airframeId, Boolean(f.cargo || f.kind === 'freighter'), f.airline)
        const boardLimit =
          (mode === 'jetway'
            ? f.boardingSlow
              ? 11
              : 7.5
            : mode === 'bus'
              ? f.boardingSlow
                ? 18
                : 13
              : f.boardingSlow
                ? 24
                : 17) * pace + (this.diplomacy?.extraDelaySec(f.airline) ?? 0)
        const bagsReady = !f.waitingOn.bagsLoad || f.posted.bagsLoad
        const minBoard =
          (mode === 'jetway' ? (f.boardingSlow ? 5 : 3.2) : f.boardingSlow ? 9 : 5) * pace
        const boardReady =
          f.waitingOn.paxIn <= 0 && bagsReady && f.phaseTime > minBoard
        if (f.boardingSlow && f.phaseTime > 8 && f.phaseTime < 8.4) {
          const next = this.openSchedule().find(
            (s) => s.id !== f.scheduleId && (s.status === 'scheduled' || s.status === 'delayed'),
          )
          if (next) {
            this.delaySlot(next, 12 + Math.random() * 10, 'Slow boarding upstream')
            this.pushNews(
              `${f.flightNo} slow boarding — ${next.flightNo} and the bank slide.`,
              'bad',
            )
          } else {
            this.adjustHeat(f.airline, -2)
            this.pushNews(`${f.flightNo} slow boarding — Standing dips.`, 'bad')
          }
          f.boardingSlow = false
        }
        if (f.phaseTime > 3) this.ensureDeice(f)
        if (boardReady || f.phaseTime > boardLimit) {
          const deiceOk =
            this.ensureDeice(f) || f.phaseTime > boardLimit + 14
          // Pushback beat — tug-out before the taxi bank clears.
          const ramp = this.rampCall(f, f.phaseTime > boardLimit + 80)
          if (deiceOk && ramp !== 'hold' && (!this.groundBusy() || f.phaseTime > boardLimit + 4)) {
            if (ramp === 'short') {
              this.adjustHeat(f.airline, -1.2)
              this.pushNews(
                `${f.flightNo} pushed with the ramp unfinished. Standing dips.`,
                'bad',
              )
            }
            if (!f.posted.deiced && this.needsDeiceService(f)) {
              f.waitingOn.deice = false
              this.adjustHeat(f.airline, -1.5)
              this.pushNews(
                `${f.flightNo} pushed without glycol — Standing dips.`,
                'bad',
              )
            }
            this.settleOutboundBags(f, true)
            f.phase = 'pushback'
            f.phaseTime = 0
            if (f.stand) {
              // Nudge off the nose — visual push, then real taxi path.
              const back = {
                c: f.stand.c - Math.cos(f.heading || 0) * 0.8,
                r: f.stand.r - Math.sin(f.heading || 0) * 0.8,
              }
              f.path = [f.stand, back]
              f.seg = 0
              f.t = 0
            }
            if (Math.random() < 0.35) {
              this.pushNews(`${f.flightNo} pushback — clear the alley.`, 'ok')
            }
          } else if (f.phaseTime > boardLimit + 6 && deiceOk) {
            const next = this.openSchedule()[0]
            if (next && Math.random() < step * 0.35) {
              this.delaySlot(next, 8, 'Departure blocked')
            }
          }
        }
      } else if (f.phase === 'pushback') {
        // Short shove off the stand, then join the outbound taxi.
        this.followPath(f, 0.55, step)
        if (f.phaseTime > 2.8) {
          const out = this.departurePath(f)
          if (out && !this.groundBusy()) {
            f.path = out
            f.seg = 0
            f.t = 0
            if (!f.cargo) this.settleOutboundBags(f, true)
            f.phase = 'taxi_out'
            f.phaseTime = 0
          } else if (f.phaseTime > 8) {
            // Force clear — don't soft-lock the gate on pushback.
            if (out) {
              f.path = out
              f.seg = 0
              f.t = 0
            }
            if (!f.cargo) this.settleOutboundBags(f, true)
            f.phase = 'taxi_out'
            f.phaseTime = 0
          }
        }
      } else if (f.phase === 'taxi_out') {
        if (this.followPath(f, 1.2, step)) {
          f.phase = 'takeoff'
          f.phaseTime = 0
        }
      } else if (f.phase === 'takeoff') {
        if (f.phaseTime < 1.2 && this.checkCrash(f, 'takeoff')) continue
        f.z += step * 0.9
        f.x += Math.cos(f.heading) * step * 2.6
        f.y += Math.sin(f.heading) * step * 2.6
        if ((hasLeftMap(f.x, f.y, SIZE) && f.z > 6) || f.phaseTime > 26) {
          f.phase = 'gone'
          this.flightsDone += 1
          this.paxServed += f.pax
          this.noteTurn(f)
          this.grantResearchForFlight(f)
          if (f.kind !== 'military' && f.kind !== 'air_ambulance') {
            this.grantFieldXp(6 + Math.min(8, Math.floor(f.pax / 40)), 'turnaround')
          }
          if (!this.firstTakeoffNoted && f.kind !== 'military' && f.kind !== 'air_ambulance') {
            this.firstTakeoffNoted = true
            this.coachDismissed = true
            this.reputation = Math.min(100, this.reputation + 2)
            this.pushNews(
              `First turn in the book — ${f.flightNo} airborne. Field Rating ${this.fieldRating()}. Airlines will start asking for upgrades; hangar-side pads unlock Guard.`,
              'good',
            )
          }
          if (f.kind !== 'military' && f.kind !== 'air_ambulance') {
            this.adjustHeat(f.airline, 1.8)
          }
          // Night bank: freighter money vs city noise on pax carriers.
          if (
            f.kind === 'freighter' &&
            this.hasResearch('night_bank') &&
            this.isNight()
          ) {
            for (const id of this.signed) {
              const a = this.airline(id)
              if (a.persona === 'luxury' || a.persona === 'business') {
                this.adjustHeat(id, -0.35)
              }
            }
          }
          if (f.scheduleId) {
            const slot = this.schedule.find((s) => s.id === f.scheduleId)
            if (slot) slot.status = 'done'
          }
          this.gradeDiplomacyTurn(f)
          this.noteCargoDepart(f)
          this.pushNews(`${f.flightNo} airborne.`, 'ok')
          this.spawnCool = Math.min(this.spawnCool, 8)
        }
      }
    }
    this.flights = this.flights.filter((f) => {
      if (f.phase !== 'gone') return true
      for (const line of f.ledger) {
        if (line.amount > 0) {
          this.settledPayments.push({
            flightNo: f.flightNo,
            label: line.label,
            amount: line.amount,
          })
        }
      }
      if (this.settledPayments.length > 64) {
        this.settledPayments.splice(0, this.settledPayments.length - 64)
      }
      return false
    })

    for (const t of this.trucks) {
      if (t.kind === 'contractor' || t.kind === 'delivery') {
        this.tickBuildTruck(t, step)
        continue
      }
      // Makeup / farm bottom-load before rolling.
      if (t.preDwell > 0) {
        t.preDwell -= step
        continue
      }
      if (t.dwell > 0) {
        t.dwell -= step
        if (t.dwell <= 0 && t.kind === 'bags' && t.mission === 'to_claim' && t.returning) {
          // Finished inbound sort dwell — inject onto assigned claim.
          this.finishTruck(t)
          if (this.retargetBagsTruck(t)) continue
          t.dwell = -99
          continue
        }
        if (t.dwell <= 0 && t.kind === 'citycargo') {
          this.finishCityCargo(t)
          continue
        }
        if (t.dwell <= 0 && !t.returning) {
          this.finishTruck(t)
          const from = { c: Math.round(t.x), r: Math.round(t.y) }
          if (t.kind === 'termbus') {
            t.returning = true
            if (t.home) {
              const homePath = nearestPath(this.tiles, from, [t.home], 'truck')
              t.path = homePath && homePath.length > 1 ? homePath : [...t.path].reverse()
            } else {
              t.path = [...t.path].reverse()
            }
            t.seg = 0
            t.t = 0
            continue
          }
          // Arrival bags: plane → shed sort (process dwell) → claim inject.
          if (t.kind === 'bags' && t.mission === 'unload' && t.home) {
            const fl = t.flightId ? this.flights.find((x) => x.id === t.flightId) : null
            const claimPath = nearestPath(this.tiles, from, [t.home], 'truck')
            t.mission = 'sort_inbound'
            t.returning = true
            t.path = claimPath && claimPath.length > 1 ? claimPath : [...t.path].reverse()
            t.seg = 0
            t.t = 0
            if (fl) this.setBagStage(fl, 'inbound_sort')
            continue
          }
          // Fuel: mark reload needed, deadhead to farm (or continue if stock left).
          if (t.kind === 'fuel') {
            if (this.fuelLoads >= 1 && Math.random() < 0.45 && this.retargetFuelTruck(t)) {
              continue
            }
            t.mission = 'fuel_reload'
            t.returning = true
            if (t.home) {
              const homePath = nearestPath(this.tiles, from, [t.home], 'truck')
              t.path = homePath && homePath.length > 1 ? homePath : [...t.path].reverse()
            } else {
              t.path = [...t.path].reverse()
            }
            t.seg = 0
            t.t = 0
            continue
          }
          // Load / cater — continue or return home.
          if (t.kind === 'bags' && t.mission === 'load' && this.retargetBagsTruck(t)) {
            continue
          }
          t.returning = true
          if (t.home) {
            const homePath = nearestPath(this.tiles, from, [t.home], 'truck')
            t.path = homePath && homePath.length > 1 ? homePath : [...t.path].reverse()
          } else {
            t.path = [...t.path].reverse()
          }
          t.seg = 0
          t.t = 0
        }
        continue
      }
      const done = this.followPath(
        t,
        t.kind === 'termbus' ? 1.55 : t.kind === 'citycargo' ? 1.35 : 1.8,
        step,
      )
      if (done && !t.returning) {
        // Service dwell at the aircraft (fuel = bond + pump; deice = spray).
        if (t.kind === 'citycargo') {
          if (t.mission === 'city_guard') {
            // Visible screen time at the post (Manor Lords handoff).
            t.dwell = 1.4 + Math.min(2.2, (t.cargoUnits ?? 12) * 0.04)
          } else if (t.mission === 'city_shed') {
            t.dwell = 1.6 + Math.min(2.5, (t.cargoUnits ?? 12) * 0.05)
          } else {
            t.dwell = 1.2
          }
        } else if (t.kind === 'termbus') {
          const fl = t.flightId ? this.flights.find((x) => x.id === t.flightId) : null
          if (fl) {
            if (t.mission === 'ferry_arr') fl.waitingOn.paxOut = 0
            if (t.mission === 'ferry_dep') fl.waitingOn.paxIn = 0
          }
          t.dwell = 1.8
        } else if (t.kind === 'bags') {
          const fl = t.flightId ? this.flights.find((x) => x.id === t.flightId) : null
          if (t.mission === 'unload') {
            if (fl && !fl.cargo) this.setBagStage(fl, 'unload_aircraft')
            t.dwell = fl
              ? fl.cargo
                ? clamp(1.6 + (t.cargoUnits ?? 12) * 0.05, 1.6, 5)
                : this.bagWorkSeconds(fl, 'ramp')
              : 2.4
            if (fl && !fl.cargo) t.cargoUnits = fl.bagUnits ?? 8
          } else if (t.mission === 'load') {
            if (fl) this.setBagStage(fl, 'load_aircraft')
            t.dwell = fl ? this.bagWorkSeconds(fl, 'ramp') : 2.6
            t.cargoUnits = fl?.bagsDeposited ?? fl?.bagUnits ?? 8
          } else {
            t.dwell = 2.2
          }
        } else {
          t.dwell =
            t.kind === 'fuel'
              ? fuelDwellSeconds(
                  AIRFRAMES[
                    this.flights.find((x) => x.id === t.flightId)?.airframeId ?? ''
                  ],
                )
              : t.kind === 'deice'
                ? 3.2
                : 2.2
        }
      } else if (done && t.returning) {
        if (t.kind === 'citycargo') {
          this.finishCityCargo(t)
          continue
        }
        // Arrived home / claim / farm.
        if (t.kind === 'bags' && t.mission === 'sort_inbound') {
          // Visible process time at makeup before claim belt inject.
          const fl = t.flightId ? this.flights.find((x) => x.id === t.flightId) : null
          this.finishTruck(t) // stage → deliver_claim news
          t.dwell = fl ? this.bagWorkSeconds(fl, 'sort') : 1.6
          t.mission = 'to_claim'
          t.returning = true
          continue
        }
        if (t.kind === 'bags' && t.mission === 'to_claim') {
          this.finishTruck(t) // inject onto assigned claim
          if (this.retargetBagsTruck(t)) continue
          t.dwell = -99
          continue
        }
        if (t.kind === 'bags' && t.mission === 'pickup') {
          const fl = t.flightId ? this.flights.find((x) => x.id === t.flightId) : null
          if (fl) this.setBagStage(fl, 'load_aircraft')
          // Makeup carts staged — roll to the outbound stand.
          if (this.retargetBagsTruck(t)) continue
          t.dwell = -99
          continue
        }
        if (t.kind === 'bags') {
          if (this.retargetBagsTruck(t)) continue
          t.dwell = -99
          continue
        }
        if (t.kind === 'fuel') {
          // Bottom-load at farm, then continue if work remains.
          t.preDwell = 1.5
          t.mission = 'fuel_reload'
          if (this.fuelLoads >= 1 && this.retargetFuelTruck(t)) continue
          t.dwell = -99
          continue
        }
        t.dwell = -99
      }
    }
    this.trucks = this.trucks.filter((t) => t.dwell !== -99)

    for (const p of this.people) {
      if (p.t < 0) {
        p.t += step
        continue
      }
      const done = this.followPath(
        p,
        p.job === 'patrol' || p.job === 'mechanic' ? 1.0 : 1.15,
        step,
      )
      if (!done) continue
      if (p.job === 'patrol') {
        p.stage = 99
        continue
      }
      if (p.job === 'mechanic') {
        // Line MX visit: pay at stand, then walk home to hangar.
        if (p.mxPay != null && p.flightId) {
          const f = this.flights.find((x) => x.id === p.flightId)
          if (f && !f.posted.mx) {
            this.earn(p.mxPay, `${f.flightNo} line MX`, f)
            f.posted.mx = true
            f.waitingOn.mx = false
          }
          p.mxPay = undefined
          const hangars = tilesOf(this.tiles, 'hangar')
          if (hangars.length) {
            const home = nearestPath(
              this.tiles,
              { c: Math.round(p.x), r: Math.round(p.y) },
              hangars,
              'mechanic',
            )
            if (home && home.length > 1) {
              p.path = home
              p.seg = 0
              p.t = 0
              p.flightId = ''
              p.label = 'mx-home'
              continue
            }
          }
          p.stage = 99
          continue
        }
        // Finished MX return — despawn at hangar. Idle pavement walkers linger.
        if (p.label === 'mx-home') {
          p.stage = 99
          continue
        }
        p.path = [{ c: Math.round(p.x), r: Math.round(p.y) }]
        p.seg = 0
        p.t = 0
        continue
      }
      const f = this.flights.find((x) => x.id === p.flightId)
      const fit = this.roomsAt(f?.stand ?? null)
      const result = advancePaxItinerary(p, this.tiles, f?.stand ?? null, fit, (amount, kind) => {
        this.cash += amount
        this.revenue += amount
        this.noteIncome(amount, 'retail_sales')
        if (kind === 'food') this.mealSold = true
      })
      if (result === 'done') {
        p.stage = 99
        if (f) {
          if (p.job === 'arrive') f.waitingOn.paxOut = Math.max(0, f.waitingOn.paxOut - 1)
          if (p.job === 'board') f.waitingOn.paxIn = Math.max(0, f.waitingOn.paxIn - 1)
        }
      }
    }
    this.people = this.people.filter((p) => p.stage < 99)

    // UI refresh — keep React off the hot path (was 0.12s sim ≈ 25 Hud renders/s at 3x).
    // At 5x, require more sim-time between emits so HUD stays ~2–3 Hz real-time.
    this.uiAcc += step
    const uiEvery = this.speed >= 5 ? 1.6 : this.speed >= 3 ? 0.7 : 0.4
    if (this.uiAcc > uiEvery) {
      this.uiAcc = 0
      this.emit()
    }
  }

  /** True when any hall has a security room (choke present). */
  hasSecurityChoke(): boolean {
    return this.fits.some((f) => (f.rooms.security ?? 0) > 0)
  }
}

function moneyLeft(n: number): string {
  return `$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Day length is the 180s cycle. Clock reads as a 24h face inside that day. */
export function formatSimDate(seconds: number): string {
  const day = Math.floor(seconds / 180) + 1
  const tod = ((seconds % 180) + 180) % 180
  const mins = Math.floor((tod / 180) * 24 * 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `Day ${day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
