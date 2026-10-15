import type { Difficulty, FieldTaskKind, RoomId, SiteKind, Speed, StartFocus, Tool, Vec } from '../game/types.ts'

/** What a player command returned. Failures become "couldn't do" lines. */
export interface CommandResult {
  ok: boolean
  command: string
  detail: string
}

/** Read-only board, the same facts the HUD is showing. */
export interface AirportView {
  day: number
  clock: number
  cash: number
  speed: Speed
  hasLand: boolean
  kitAvailable: boolean
  kitCost: number
  runway: number
  /** Slots pushed later than requested today because the strip was already taken. */
  runwayDeferred: number
  /** Same count across the whole run. Resets only on a new game. */
  runwayDeferredTotal: number
  /** Cash to stamp the regional strip. */
  runwayCost: number
  /** A strip is already under construction, so it is not stamped again. */
  runwayBuilding: boolean
  stands: number
  terminals: number
  snacks: number
  rooms: Partial<Record<RoomId, number>>
  shopUnits: number
  leasedShops: number
  openShopBids: number
  signed: string[]
  offer: { name: string; met: boolean; missing: string[]; deadline: number; needsHelipad?: boolean } | null
  helipads: number
  /** A helipad is already under construction, so the letter stays open. */
  helipadBuilding: boolean
  helipadCost: number
  loanBalance: number
  loans: { id: string; label: string; principal: number }[]
  fieldLevel: number
  /** Prestige stars after field level 10. */
  prestigeStars: number
  fieldRating: number
  /** Mean hall happiness, 0–100. Null when the hall is empty. */
  satisfaction: number | null
  guestCount: number
  janitors: number
  mechanics: number
  researchPoints: number
  /** Whole points from the day-1 operations trickle. Rooms wait until this is at least 1. */
  wave3Points: number
  nextResearch: { id: string; name: string } | null
  /** Cities-style tree. Points are separate from the operations trickle. */
  treePoints: number
  treeUnlocked: string[]
  /** Cheapest node the field can buy right now. Null when nothing is affordable. */
  nextTree: { id: string; name: string; cost: number } | null
  deskStaff: number
  checkinStaffed: boolean
  securityStaffed: boolean
  deskHireCost: number
  checkinWaiting: number
  securityWaiting: number
  /** Demand against the tighter of the lane and the curb. Above 1 the curb is over. */
  curbPressure: number
  curbQueue: number
  curbDelaySec: number
  lanes: number
  busBays: number
  curbLanes: number
  taxiRanks: number
  yearReportPending: boolean
  flightsDone: number
  activeFlights: number
  /** Signed fuel term id. Null while the field is still on spot. */
  fuelTerm: string | null
  /** Cash to sign the first term (Apex Local). */
  fuelSignCost: number
  /** Open phone spot card. Null when the rack is quiet. */
  spotOffer: { flightNo: string; secondsLeft: number } | null
  /** Airfield sheet reads "Over the runway". */
  runwayOver: boolean
  /** Occupied stands plus aircraft holding with no stand, divided by stands. */
  standPressure: number
  /** Medium stand stamp. */
  standCost: number
  /** One researcher, after staff-hire scaling. */
  researcherCost: number
  researchers: number
  /** The open airline field ask, when one Build or Decline can answer it. */
  fieldAsk: {
    kind: FieldTaskKind
    title: string
    cost: number
    bonus: number
    secondsLeft: number
    canBuild: boolean
  } | null
}

export interface Probe {
  clock: number
  day: number
  cash: number
  speed: Speed
  hasLand: boolean
  flightsDone: number
  activeFlights: number
  fieldRating: number
  guestCount: number
  guestHappiness: number | null
  /** First aircraft that has touched down, if one is on the field right now. */
  landed: { id: string; flightNo: string; phase: string } | null
  stuck: { id: string; detail: string }[]
  /** Newest watchdog resolutions, so a stall can name the step that cleared it. */
  recoveries: { id: string; step: string }[]
  /** Watchdog steps that wrote a coordinate. The ladder leaves this at 0. */
  jumps: number
}

/**
 * Commands a human can issue from the title screen, build tray, letters, and hall.
 * Bots talk only to this surface.
 */
export interface PlayerCommands {
  setSandbox(on: boolean): CommandResult
  beginNew(difficulty: Difficulty): CommandResult
  setFocus(focus: StartFocus): CommandResult
  buyLand(kind: SiteKind): CommandResult
  buildStarterKit(): CommandResult
  signFuelTerm(): CommandResult
  chooseFreehand(): CommandResult
  setSpeed(speed: Speed): CommandResult
  setTool(tool: Tool): CommandResult
  setView(view: 'apron' | 'hall'): CommandResult
  /** Mouse-over ghost. Null means the stamp looks legal. */
  preview(tool: Tool, cell: Vec): string | null
  clickTile(cell: Vec): CommandResult
  /** Paid taxi from a new runway site to the apron, so the strip can be used. */
  connectRunway(): CommandResult
  /** Grass a player might click, pavement-adjacent cells first. */
  candidates(): Vec[]
  buyRoom(id: RoomId): CommandResult
  acceptContract(): CommandResult
  snoozeContract(): CommandResult
  walkContract(): CommandResult
  takeLoan(productId: string): CommandResult
  buyParcel(): CommandResult
  hireJanitor(): CommandResult
  hireMechanic(): CommandResult
  buyResearch(id: string): CommandResult
  /** Cities-style research tree under Growth. Costs research points, not cash. */
  buyTree(id: string): CommandResult
  /** Hire one desk agent. Bodies cover check-in, security, and the gate. */
  hireDesk(): CommandResult
  /** Pay the open field ask's stamp or hire. */
  buildFieldAsk(): CommandResult
  /** Retire the open field ask. A small Standing nick, no fine. */
  declineFieldAsk(): CommandResult
  /** One bus bay, then a taxi rank, then a curb lane. */
  relieveCurb(): CommandResult
  acceptBestShopBid(): CommandResult
  /** End-of-run books: cash categories, relations, queues, and the tree. */
  books(): SystemsBooks
  /** Read-only snapshot of the three research pools. Does not buy or tick. */
  researchPools(): ResearchPools
  /** Order the open Apex spot tanker. Refuses when no card is up. */
  acceptSpot(): CommandResult
  /** Hire one researcher. The hall has to exist. */
  hireResearcher(): CommandResult
  dismissYearReport(): CommandResult
  tick(dt: number): void
  view(): AirportView
  probe(): Probe
  /** Hub-tier letters already sent. A decline still counts. */
  hubOffersSent(): number
  /** Signed carriers and the gate that is still open. */
  hubLadderNote(): string
  /** Cheap board read for fuel holds, the spot card, and the news tape. */
  pulse(): FieldPulse
  /** Highest hub-checklist tier among signed carriers. */
  hubReached(): { tier: string; rank: number }
  /** End-of-run counts that live on the ledger and the connection tally. */
  tallyOps(): LedgerOps
}

export type Intent =
  | { do: 'buyLand'; kind: SiteKind }
  | { do: 'starterKit' }
  | { do: 'freehand' }
  | { do: 'accept' }
  | { do: 'snooze' }
  | { do: 'walk' }
  | { do: 'loan'; id: string }
  | { do: 'stamp'; tool: Tool }
  | { do: 'click'; tool: Tool; cell: Vec }
  | { do: 'room'; id: RoomId }
  | { do: 'lease' }
  | { do: 'janitor' }
  | { do: 'mechanic' }
  | { do: 'research'; id: string }
  | { do: 'tree'; id: string }
  | { do: 'desk' }
  | { do: 'fieldBuild' }
  | { do: 'fieldDecline' }
  | { do: 'curb' }
  | { do: 'parcel' }
  | { do: 'speed'; speed: Speed }
  | { do: 'dismissYear' }
  | { do: 'fuelTerm' }
  | { do: 'spotAccept' }
  | { do: 'researcher' }
  | { do: 'nothing' }

export interface PersonaMemory {
  builtOnDay: number
  stampsToday: number
  /** Sim day the persona last bought a research-tree node. -1 if never. */
  treeOnDay: number
}

export interface PersonaDecision {
  intents: Intent[]
  memory: PersonaMemory
}

export interface StuckRecord {
  id: string
  detail: string
  /** Watchdog resolution while the stall was open, or `none` when the phase just ended. */
  step: string
  firstClock: number
  lastClock: number
  recoveredClock: number | null
}

export interface CouldNot {
  command: string
  detail: string
  count: number
}

export interface CashPoint {
  day: number
  cash: number
}

export interface SatisfactionPoint {
  day: number
  guests: number
  /** Null when nobody was in the hall. */
  avg: number | null
  fieldRating: number
}

export interface SlowTick {
  ms: number
  day: number
  clock: number
  flights: number
  guests: number
}

/** One sim day of the systems the latest main added. */
export interface DaySystems {
  day: number
  checkinWaiting: number
  securityWaiting: number
  curbPressure: number
  curbQueue: number
  lanes: number
  busBays: number
  treePoints: number
  treeNodes: number
  deskStaff: number
  fieldRating: number
  guests: number
  /** Whole points still in each pool when the day began. */
  deskPoints: number
  wave3Points: number
  /** Whole points plus fractional carry plus the cost of nodes already bought. */
  deskEarned: number
  wave3Earned: number
  treeEarned: number
  researchers: number
  labDesks: number
  labBoards: number
  labMachines: number
  /** RP/sec the old desk adds from researchers standing at lab furniture. */
  deskLabRate: number
  /** RP/sec the Wave 3 pool adds from lab furniture, not the operations trickle. */
  wave3RoomRate: number
  /** RP/sec the Growth tree adds from lab furniture, not its own trickle. */
  treeRoomRate: number
  /** Signed carriers at Preferred or better when this day opened. */
  relationTier2: number
  /** Signed carriers at Trusted or better when this day opened. */
  relationTier3: number
  /** Highest relationship score when this day opened. */
  relationBest: number
  /** Field level when this day opened. */
  fieldLevel: number
  /** Prestige stars when this day opened. */
  prestigeStars: number
  /** Turns completed when this day opened. */
  flightsDone: number
  runway: number
  stands: number
  /** Airfield sheet said "Over the runway" when this day opened. */
  runwayOver: boolean
}

export interface SystemsPeaks {
  happiness: number | null
  guests: number
  checkinWaiting: number
  securityWaiting: number
  curbPressure: number
  curbQueue: number
}

export interface RelationRead {
  id: string
  name: string
  score: number
  band: string
  tier: number
  label: string
  onTime: number
  delayed: number
  kept: number
  missed: number
  fines: number
  /** Why this carrier has not flown, when the player can see it. */
  blocked: string | null
}

export interface SystemsBooks {
  sinks: { category: string; amount: number }[]
  /** Penalty posts booked at the full field-ask fine. */
  fieldAskFines: number
  penaltyTotal: number
  /** Penalty cash split by what booked it. Amounts are negative expenses. */
  penaltyBreakdown: {
    missedConnections: number
    delays: number
    refunds: number
    other: number
  }
  /** Paid fine lines, grouped by category and ledger label. Amounts are negative. */
  penaltySources: { category: string; label: string; amount: number; count: number }[]
  /** Connections judged this run, by why they made or missed. */
  connections: {
    made: number
    belowMct: number
    paxLate: number
    bagLate: number
    divert: number
    judged: number
    delayMin: number
    availableMin: number
    bagMin: number
  }
  relations: RelationRead[]
  treePoints: number
  treeUnlocked: string[]
  wave3Points: number
  deskStaff: number
  checkinStaffed: boolean
  securityStaffed: boolean
  checkinWaiting: number
  securityWaiting: number
  checkinLines: string[]
  securityLines: string[]
  curbPressure: number
  curbQueue: number
  curbDelaySec: number
  lanes: number
  busBays: number
  curbLanes: number
  taxiRanks: number
}

export interface ResearchNodeRead {
  id: string
  name: string
  cost: number
}

/** The three research currencies on current main, read from the live sim. */
export interface ResearchPools {
  deskPoints: number
  deskCarry: number
  deskEarned: number
  wave3Points: number
  wave3Carry: number
  wave3Earned: number
  treePoints: number
  treeCarry: number
  treeEarned: number
  researchers: number
  desks: number
  boards: number
  machines: number
  deskLabRate: number
  deskOpsRate: number
  wave3RoomRate: number
  wave3OpsRate: number
  treeRoomRate: number
  treeOpsRate: number
  deskUnlocked: ResearchNodeRead[]
  wave3Unlocked: ResearchNodeRead[]
  treeUnlocked: ResearchNodeRead[]
}

export interface ResearchBuy {
  pool: 'desk' | 'wave3' | 'tree'
  day: number
  id: string
  name: string
  cost: number
}

/** Per-tick facts that do not belong on the full HUD snapshot. */
export interface FieldPulse {
  curbPressure: number
  fuelHeldIds: string[]
  news: { id: string; text: string }[]
  alerts: { key: string; title: string; detail: string }[]
  spotOffer: { flightNo: string } | null
}

/** Ledger and connection totals read once at the end of a run. */
export interface LedgerOps {
  goArounds: number
  missedConnectionCash: number
  connectionDiverts: number
  /** Fuel-purchase cash actually taken. Positive dollars. */
  fuelPurchase: number
  spotPurchase: number
  termPurchase: number
}

/**
 * How a persona treats fuel, the second strip, and the lab.
 * The tip policy matches the bots that signed a term and never hired.
 */
export interface PersonaPolicy {
  fuel: 'term' | 'spot-accept' | 'spot-ignore'
  expand: boolean
  researcher: boolean
}

/** Counts the rerun table reads off a finished headless run. */
export interface RunOps {
  flightsPerDay: number
  /** Inbound flights whose news line said they diverted. */
  flightDiverts: number
  /** Connecting passengers tagged divert. */
  connectionDiverts: number
  goArounds: number
  missedConnectionCash: number
  /** First sim day the curb pressure was observed above 1. */
  curbCrossDay: number | null
  curbPeak: number
  fuelGroundings: number
  firstGroundingDay: number | null
  /** Fuel copy on screen before the first grounding. The grounding line itself is not a warning. */
  groundingWarnings: string[]
  treeCompleteDay: number | null
  cashDay30: number | null
  cashDay60: number | null
  cashDay90: number | null
  preferredDay: number | null
  trustedDay: number | null
  hubTier: string
  hubTierDay: number | null
  fuelPurchase: number
  spotPurchase: number
  termPurchase: number
  fuelPurchasePerDay: number
  spotPurchasePerDay: number
}

export interface PersonaReport {
  persona: 'careful' | 'greedy' | 'chaotic'
  label: string
  daysRequested: number
  daysRan: number
  difficulty: Difficulty
  focus: StartFocus
  sandbox: false
  tickDt: number
  speed: Speed
  wallMs: number
  ticks: number
  timeToFirstLandingSec: number | null
  timeToFirstLandingDay: number | null
  firstLandingPhase: string | null
  firstLandingFlight: string | null
  cashStart: number
  cashEnd: number
  cashCurve: CashPoint[]
  stuck: StuckRecord[]
  recovered: StuckRecord[]
  consoleErrors: string[]
  softlocks: string[]
  satisfaction: SatisfactionPoint[]
  satisfactionAvg: number | null
  slowestTicks: SlowTick[]
  couldNot: CouldNot[]
  couldNotTotal: number
  built: {
    runway: number
    stands: number
    terminals: number
    snacks: number
    rooms: Partial<Record<RoomId, number>>
    shopUnits: number
    leasedShops: number
    signed: string[]
    flightsDone: number
  }
  notes: string[]
  days: DaySystems[]
  peaks: SystemsPeaks
  books: SystemsBooks
  nanFlags: string[]
  researchBuys: ResearchBuy[]
  research: ResearchPools
  ops: RunOps
}

export interface BrowserReport {
  ok: boolean
  skipped: boolean
  reason: string
  wallMs: number
  script: string[]
  screenshots: string[]
  timeToFirstLandingSec: number | null
  cashCurve: CashPoint[]
  stuck: { id: string; detail: string }[]
  recovered: string[]
  consoleErrors: string[]
  softlocks: string[]
  satisfaction: SatisfactionPoint[]
  satisfactionAvg: number | null
  slowestTicks: SlowTick[]
  couldNot: CouldNot[]
  clockEnd: number
  cashEnd: number | null
  notes: string[]
}

export interface PlaytestReport {
  generatedAt: string
  tuning: {
    tickDt: number
    actEverySec: number
    maxSpeed: number
    daySeconds: number
  }
  headless: PersonaReport[]
  browser: BrowserReport
}
