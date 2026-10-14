import type { Difficulty, RoomId, SiteKind, Speed, StartFocus, Tool, Vec } from '../game/types.ts'

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
  stands: number
  terminals: number
  snacks: number
  rooms: Partial<Record<RoomId, number>>
  shopUnits: number
  leasedShops: number
  openShopBids: number
  signed: string[]
  offer: { name: string; met: boolean; missing: string[]; deadline: number } | null
  loanBalance: number
  loans: { id: string; label: string; principal: number }[]
  fieldLevel: number
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
  yearReportPending: boolean
  flightsDone: number
  activeFlights: number
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
  /** Coordinate jumps the watchdog used. A player-visible run stays at 0. */
  teleports: number
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
  chooseFreehand(): CommandResult
  setSpeed(speed: Speed): CommandResult
  setTool(tool: Tool): CommandResult
  setView(view: 'apron' | 'hall'): CommandResult
  /** Mouse-over ghost. Null means the stamp looks legal. */
  preview(tool: Tool, cell: Vec): string | null
  clickTile(cell: Vec): CommandResult
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
  acceptBestShopBid(): CommandResult
  dismissYearReport(): CommandResult
  tick(dt: number): void
  view(): AirportView
  probe(): Probe
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
  | { do: 'parcel' }
  | { do: 'speed'; speed: Speed }
  | { do: 'dismissYear' }
  | { do: 'nothing' }

export interface PersonaMemory {
  builtOnDay: number
  stampsToday: number
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
