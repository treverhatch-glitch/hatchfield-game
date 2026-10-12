import {
  AIRLINES,
  airlineList,
  BAG_DROP_PAY,
  BUDGET_BASE,
  BULLDOZE_REFUND,
  BUILDINGS,
  CATER,
  CLEANING_FEE,
  createProcAirline,
  DEFAULT_BUDGETS,
  FUEL,
  AIR_AMBULANCE_FEE,
  HALL_SCRUB_COST,
  HEAT_BAN_THRESHOLD,
  HELO_LANDING,
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
  LOAN_INTEREST,
  LOAN_PRINCIPAL,
  MECHANIC_HIRE,
  MECHANIC_WAGE,
  MIN_RUNWAY,
  PARCEL_COST,
  PREMADE_TERMINAL_COST,
  RAIL_CITY_COST,
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
  STARTER_KIT_COST,
  START_CASH,
  TERMINAL_COST,
} from './catalog'
import {
  hallPath,
  needToNode,
  openNodesFromRooms,
  spawnHallGuest,
  strongestNeed,
  type HallGuest,
  type HallNode,
  type PaxTag,
} from './guests'
import {
  AIRFRAMES,
  craftRoleLabel,
  jetAirframesBlocked,
  jetAirframesFitting,
  pickAirframe,
  pickAirframeWithFallback,
  stripTier,
} from './airframes'
import {
  advancePaxItinerary,
  spawnArrivalPax,
  spawnDeparturePax,
} from './pax'
import {
  astar,
  farmBesidePavement,
  inBounds,
  nearestPath,
  runwayStrips,
  tilesOf,
} from './path'
import { SAVE_KEY, SIZE, type AirlineId } from './types'
import type {
  AircraftKind,
  Airline,
  BudgetKey,
  Budgets,
  CaterBrand,
  ContractOffer,
  Difficulty,
  Flight,
  FuelBrand,
  GameSnapshot,
  LayoverContract,
  LayoverOffer,
  MarketMission,
  MxOffer,
  News,
  PendingThreat,
  Person,
  Phase,
  RoomId,
  RunwayClass,
  ScheduleSlot,
  SiteKind,
  Speed,
  TerminalFit,
  Tile,
  Tool,
  Truck,
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
})

function emptyFit(origin: Vec, premade: boolean, rooms?: Partial<Record<RoomId, number>>): TerminalFit {
  return {
    origin,
    premade,
    rooms: { ...emptyRooms(), ...(rooms ?? {}) },
    wearBath: 0,
    wearSec: 0,
  }
}

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
  fuelBrand: FuelBrand | null = null
  fuelLoads = 0
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
  securityIncidents = 0
  reputation = 40
  loanBalance = 0
  parcels = 1
  railLinked = false
  interestCool = 60
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
  crashCool = 8
  fireIncidentCool = 60
  milAgreement = false
  milCool = 55
  ambuCool = 70
  extraAirlines: Airline[] = []
  airlineHeat: Record<string, number> = {}
  airlineBanUntil: Record<string, number> = {}
  layoverOffer: LayoverOffer | null = null
  layoverOfferCool = 50
  layover: LayoverContract | null = null
  layoverSpawnAcc = 0
  schedule: ScheduleSlot[] = []
  scheduleAuto = true
  schedulePlanCool = 8
  flights: Flight[] = []
  trucks: Truck[] = []
  people: Person[] = []
  hallGuests: HallGuest[] = []
  news: News[] = []
  selectedFlight: string | null = null
  selectedTile: Vec | null = null
  selectedGuest: string | null = null
  view: 'apron' | 'hall' = 'apron'
  spawnCool = 8
  heloCool = 22
  flightSeq = 100
  flightsDone = 0
  paxServed = 0
  revenue = 0
  /** Session tally of craft roles that landed — for the fleet strip. */
  craftSeen: Partial<Record<AircraftKind, number>> = {}
  listeners = new Set<() => void>()
  saveTimer = 0
  uiAcc = 0
  patrolCool = 0
  mechanicCool = 0

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit() {
    for (const fn of this.listeners) fn()
  }

  beginNew(difficulty: Difficulty) {
    this.difficulty = difficulty
    this.cash = START_CASH[difficulty]
    this.site = null
    this.tiles = emptyTiles()
    this.fits = []
    this.clock = 0
    this.speed = 0
    this.tool = 'pan'
    this.facing = 'h'
    this.fuelBrand = null
    this.fuelLoads = 0
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
    this.securityIncidents = 0
    this.reputation = 40
    this.loanBalance = 0
    this.parcels = 1
    this.railLinked = false
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
    this.crashCool = 8
    this.fireIncidentCool = 60
    this.milAgreement = false
    this.milCool = 55
    this.ambuCool = 70
    this.extraAirlines = []
    this.airlineHeat = {}
    this.airlineBanUntil = {}
    this.layoverOffer = null
    this.layoverOfferCool = 50
    this.layover = null
    this.layoverSpawnAcc = 0
    this.schedule = []
    this.scheduleAuto = true
    this.schedulePlanCool = 8
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
    this.craftSeen = {}
    this.mechanicCool = 0
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
    return (
      AIRLINES[id] ??
      this.extraAirlines.find((a) => a.id === id) ??
      AIRLINES.northline
    )
  }

  heatOf(id: AirlineId): number {
    return this.airlineHeat[id] ?? 70
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
    this.airlineHeat[id] = clamp(h, 0, 100)
    if (
      this.airlineHeat[id] <= HEAT_BAN_THRESHOLD &&
      this.layover?.airline === id &&
      !this.isBanned(id)
    ) {
      this.banAirline(id, 'layover heat crashed')
    }
  }

  banAirline(id: AirlineId, reason: string) {
    if (this.isBanned(id)) return
    const a = this.airline(id)
    this.airlineBanUntil[id] = this.clock + LAYOVER_BAN_SECONDS
    this.airlineHeat[id] = Math.min(this.heatOf(id), HEAT_BAN_THRESHOLD - 2)
    this.charge(LAYOVER_BAN_FINE)
    if (this.layover?.airline === id) this.layover = null
    if (this.layoverOffer?.airline === id) this.layoverOffer = null
    this.pushNews(
      `${a.name} banned you for ${LAYOVER_BAN_SECONDS}s (${reason}). Fine ${moneyLeft(LAYOVER_BAN_FINE)}.`,
      'bad',
    )
    this.reputation = Math.max(0, this.reputation - 6)
  }

  pickAircraftKind(airlineId: AirlineId): AircraftKind {
    const a = this.airline(airlineId)
    if (a.kind === 'cargo') return 'freighter'
    if (a.req.heavyRunway && this.hasHeavyRunway()) return 'widebody'
    if (a.persona === 'budget' || a.id === 'northline' || a.procedural) {
      return Math.random() < 0.6 ? 'regional' : 'narrowbody'
    }
    if (a.persona === 'business' || a.id === 'harbor') {
      return Math.random() < 0.45 ? 'regional' : 'narrowbody'
    }
    return 'narrowbody'
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
    if (this.reputation < 48) return { ok: false, why: 'Need reputation 48+.' }
    if (this.cash < MIL_AGREE_COST) return { ok: false, why: `Need ${moneyLeft(MIL_AGREE_COST)}.` }
    return { ok: true, why: 'Ready to host Guard / military transit.' }
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
      'Guard host signed (Boise vibes) — C-130 / C-17 / KC-135 transit plus the odd F-15 drag.',
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
    this.pushNews(
      `${land.name} purchased. ${moneyLeft(this.cash)} left. Stamp pieces, or hit Starter kit for a Northline-ready field.`,
      'ok',
    )
    this.persist()
    this.emit()
    return true
  }

  seedAccessStub() {
    // City edge hint — short road stub from north edge so players see the connection idea.
    for (let r = 0; r < 3; r++) this.tiles[r][Math.floor(SIZE / 2)] = 'road'
  }

  /** One-click AT3 regional field that meets Northline’s checklist. */
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

    this.facing = 'h'
    for (const p of this.prefabRunway({ c: 8, r: 24 })) this.tiles[p.r][p.c] = 'runway'
    // Continuous taxi spine so pax can path plane → bags → hall → road
    for (let c = 8; c <= 22; c++) this.tiles[23][c] = 'taxi'
    for (let c = 8; c <= 22; c++) this.tiles[22][c] = 'taxi'
    this.tiles[21][8] = 'fuel'
    this.tiles[21][10] = 'bags'
    this.tiles[21][14] = 'snack'
    this.tiles[20][8] = 'fire'
    this.tiles[19][12] = 'tower'
    // Road from north city edge down to the hall
    const roadC = 16
    for (let r = 0; r <= 18; r++) this.tiles[r][roadC] = 'road'
    this.tiles[18][15] = 'road'
    this.tiles[18][17] = 'road'
    // Premade hall touching taxi + road (c15–17, r19–21)
    const origin = { c: 15, r: 19 }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) this.tiles[origin.r + r][origin.c + c] = 'terminal'
    }
    // Stands AFTER hall so they are not overwritten by the 3×3 terminal stamp.
    this.tiles[21][12] = 'stand'
    this.tiles[21][20] = 'stand'
    // Link hall to taxi + stands
    this.tiles[22][12] = 'taxi'
    this.tiles[22][15] = 'taxi'
    this.tiles[22][16] = 'taxi'
    this.tiles[22][17] = 'taxi'
    this.tiles[22][20] = 'taxi'
    this.fits = [
      emptyFit(origin, true, {
        checkin: 2,
        security: 2,
        gate: 2,
        bagclaim: 1,
        food: 1,
        souvenir: 1,
        bagdrop: 1,
        lounge: 0,
        bathroom: 2,
      }),
    ]
    this.fuelBrand = 'apex'
    this.fuelLoads = 4
    this.caterBrand = 'skybite'
    this.mechanics = 1
    this.spawnMechanicPawn()
    this.offerCool = 2
    this.spawnCool = 6
    this.pushNews(
      'Starter kit down — connected pavement, one mechanic on the strip. Northline should call.',
      'good',
    )
    this.emit()
  }

  takeLoan() {
    if (this.loanBalance > 0) {
      this.pushNews('Pay off the open loan first.', 'bad')
      return
    }
    this.loanBalance = LOAN_PRINCIPAL + LOAN_FEE
    this.cash += LOAN_PRINCIPAL
    this.interestCool = 60
    this.pushNews(
      `Bank wired ${moneyLeft(LOAN_PRINCIPAL)}. You owe ${moneyLeft(this.loanBalance)}. Interest ticks while it is open.`,
      'ok',
    )
    this.emit()
  }

  repayLoan() {
    if (this.loanBalance <= 0) return
    if (!this.spend(this.loanBalance, 'loan payoff')) return
    this.loanBalance = 0
    this.reputation = Math.min(100, this.reputation + 3)
    this.pushNews('Loan cleared.', 'good')
    this.emit()
  }

  buyParcel() {
    if (!this.site) return
    if (this.parcels >= 4) {
      this.pushNews('No more parcels on this map sketch.', 'bad')
      return
    }
    if (!this.spend(PARCEL_COST * this.parcels, 'land parcel')) return
    this.parcels += 1
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
    this.pushNews(
      'City laid rail to the west fence. Connect roads from there — passengers arrive easier.',
      'good',
    )
    this.emit()
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
    const ok = jetAirframesFitting(n)
    const no = jetAirframesBlocked(n)
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
      difficulty: this.difficulty,
      site: this.site,
      clock: this.clock,
      speed: this.speed,
      fuelBrand: this.fuelBrand,
      fuelLoads: this.fuelLoads,
      caterBrand: this.caterBrand,
      mealSold: this.mealSold,
      signed: this.signed,
      flightsDone: this.flightsDone,
      paxServed: this.paxServed,
      revenue: this.revenue,
      securityIncidents: this.securityIncidents,
      reputation: this.reputation,
      loanBalance: this.loanBalance,
      parcels: this.parcels,
      railLinked: this.railLinked,
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
      this.fits = (s.terminalFits ?? []).map((f) => ({
        ...f,
        rooms: { ...emptyRooms(), ...(f.rooms ?? {}) },
        wearBath: f.wearBath ?? 0,
        wearSec: f.wearSec ?? 0,
      }))
      this.cash = s.cash
      this.difficulty = s.difficulty
      this.site = s.site
      this.clock = s.clock
      this.speed = 0
      this.fuelBrand = s.fuelBrand
      this.fuelLoads = s.fuelLoads
      this.caterBrand = s.caterBrand ?? null
      this.mealSold = s.mealSold
      this.signed = s.signed ?? []
      this.flightsDone = s.flightsDone
      this.paxServed = s.paxServed
      this.revenue = s.revenue
      this.securityIncidents = s.securityIncidents ?? 0
      this.reputation = s.reputation ?? 40
      this.loanBalance = s.loanBalance ?? 0
      this.parcels = s.parcels ?? 1
      this.railLinked = s.railLinked ?? false
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
      this.extraAirlines = s.extraAirlines ?? []
      this.airlineHeat = s.airlineHeat ?? {}
      this.airlineBanUntil = s.airlineBanUntil ?? {}
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
      this.mission = null
      this.mxOffer = null
      this.pendingThreat = null
      this.analystCool = 40
      this.flights = []
      this.trucks = []
      this.people = []
      this.hallGuests = []
      this.offer = null
      this.view = 'apron'
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

  spend(amount: number, label: string): boolean {
    if (this.cash < amount) {
      this.pushNews(`Need ${label} — short ${Math.round(amount - this.cash)}.`, 'bad')
      return false
    }
    this.cash -= amount
    return true
  }

  /** Fines / interest — may go into debt, but floors so the tape can't spiral forever. */
  charge(amount: number) {
    this.cash -= amount
    if (this.cash < -25_000) this.cash = -25_000
  }

  earn(amount: number, label: string, flight?: Flight) {
    this.cash += amount
    this.revenue += amount
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
    this.emit()
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
          'Inside the terminal — landside doors → security → airside gates. Furnish in the side panel. Esc / Apron to leave.',
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

  hallOpen(): Set<HallNode> {
    const fit = this.activeHall()
    if (!fit) return new Set()
    return openNodesFromRooms(fit.rooms)
  }

  seedHallForFlight(f: Flight, job: 'depart' | 'arrive') {
    if (f.cargo || !this.fits.length) return
    const open = this.hallOpen()
    if (!open.size) return
    const count = Math.max(6, Math.min(16, Math.round(f.pax / 7)))
    const a = this.airline(f.airline)
    const premiumBias =
      a.persona === 'luxury' ? 0.65 : a.persona === 'business' ? 0.4 : 0.2
    for (let i = 0; i < count; i++) {
      const tag: PaxTag = Math.random() < premiumBias ? 'premium' : 'budget'
      const g = spawnHallGuest(f.id, job, tag, { airlineId: f.airline })
      // Kick them onto a clear first leg so you see the flow immediately.
      if (job === 'arrive') {
        g.node = 'gate'
        g.thought = 'Off the jet — need bags'
        if (open.has('claim')) this.routeGuest(g, 'claim', open)
        else if (open.has('exit')) this.routeGuest(g, 'exit', open)
      } else {
        g.node = 'entrance'
        g.thought = 'Inbound — find check-in'
        if (open.has('checkin')) this.routeGuest(g, 'checkin', open)
        else if (open.has('security')) this.routeGuest(g, 'security', open)
        else if (open.has('gate')) this.routeGuest(g, 'gate', open)
      }
      this.hallGuests.push(g)
    }
  }

  guestAirlineId(g: HallGuest): AirlineId | null {
    if (g.airlineId) return g.airlineId
    if (g.flightId.startsWith('layover:')) return g.flightId.slice('layover:'.length)
    const f = this.flights.find((x) => x.id === g.flightId)
    return f?.airline ?? null
  }

  tickHall(dt: number) {
    const open = this.hallOpen()
    if (!open.size) {
      this.hallGuests = []
      return
    }
    for (const g of this.hallGuests) {
      if (g.dead) continue
      // Needs drift — budget fills hunger/bladder faster; wear makes WC less satisfying.
      const drain = g.tag === 'budget' ? 1.25 : 0.85
      const wearBoost = 1 + this.maxWear() / 200
      g.needs.hunger = Math.min(100, g.needs.hunger + dt * 1.8 * drain)
      g.needs.bladder = Math.min(100, g.needs.bladder + dt * 1.4 * drain * wearBoost)
      g.needs.energy = Math.min(100, g.needs.energy + dt * 1.1)
      g.needs.shop = Math.min(100, g.needs.shop + dt * 0.6)
      g.needs.play = Math.min(100, g.needs.play + dt * (g.tag === 'premium' ? 1.1 : 0.7))
      if (g.job === 'depart') g.needs.boarding = Math.max(0, g.needs.boarding - dt * 0.42)
      if (g.job === 'arrive') g.needs.bags = Math.max(0, g.needs.bags - (g.node === 'claim' ? dt * 12 : 0))

      if (g.path.length && g.seg < g.path.length - 1) {
        g.t += dt * 1.35
        while (g.t >= 1 && g.seg < g.path.length - 1) {
          g.t -= 1
          g.seg += 1
          g.node = g.path[g.seg]
          this.serveNode(g, open)
        }
        continue
      }

      // Decision point — pick strongest need and search a short path (RCT-capped).
      const need = strongestNeed(g)
      if (!need) {
        if (g.transfer) {
          // Transfers use boarding as connection clock — linger until it runs down.
          g.needs.boarding = Math.max(0, g.needs.boarding - dt * 0.35)
          if (g.needs.boarding > 8) {
            const linger = (['food', 'shop', 'lounge', 'bathroom', 'gaming', 'waterfall'] as const).find(
              (n) => open.has(n),
            )
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
      const dest = needToNode(need, g.job)
      if (!open.has(dest)) {
        g.happiness -= dt * 4
        g.thought = `Can't find ${dest}`
        g.patience -= dt * 3
        if (g.patience <= 0) {
          g.dead = true
          this.reputation = Math.max(0, this.reputation - 2)
          const aid = this.guestAirlineId(g)
          if (aid) this.adjustHeat(aid, g.transfer ? -6 : -3.5)
          this.pushNews(`${g.name} left angry — missing ${dest}.`, 'bad')
        }
        continue
      }
      if (g.node === dest) this.serveNode(g, open)
      else this.routeGuest(g, dest, open)

      if (g.job === 'depart' && g.needs.boarding <= 0 && g.node !== 'gate') {
        g.happiness -= 30
        g.dead = true
        this.reputation = Math.max(0, this.reputation - 5)
        const aid = this.guestAirlineId(g)
        if (aid) this.adjustHeat(aid, g.transfer ? -8 : -5)
        this.pushNews(`${g.name} missed ${g.flightId.slice(0, 8)} — late to the gate.`, 'bad')
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
    // Cap population for sim health (Sawyer lesson).
    if (this.hallGuests.length > 80) this.hallGuests.length = 80
  }

  routeGuest(g: HallGuest, dest: HallNode, open: Set<HallNode>) {
    const path = hallPath(g.node, dest, open, g.tag === 'premium' ? 7 : 5)
    if (!path || path.length < 2) {
      g.thought = 'Lost in the hall'
      g.happiness -= 0.5
      return
    }
    g.path = path
    g.seg = 0
    g.t = 0
    g.thought = `Heading to ${dest}`
  }

  serveNode(g: HallGuest, open: Set<HallNode>) {
    const n = g.node
    if (n === 'info') {
      g.patience = Math.min(100, g.patience + 8)
      g.happiness += 2
      g.thought = 'Got directions'
      // Info desk extends lookahead once — like an RCT park map.
      const need = strongestNeed(g)
      if (need) {
        const dest = needToNode(need, g.job)
        const path = hallPath(g.node, dest, open, 8)
        if (path) {
          g.path = path
          g.seg = 0
          g.t = 0
        }
      }
    }
    if (n === 'checkin' && g.job === 'depart') {
      g.thought = 'Checked in — next security'
      if (open.has('security')) this.routeGuest(g, 'security', open)
      else if (open.has('gate')) this.routeGuest(g, 'gate', open)
    }
    if (n === 'security' && g.job === 'depart') {
      const wear = this.bumpWear('sec', g.tag === 'budget' ? 2.2 : 0.6)
      const slow = wear >= 50
      g.thought = slow
        ? 'Security lane sticky — slow clear'
        : 'Cleared security — walk to gate'
      g.happiness += slow ? -1 : 2
      if (g.needs.hunger > 55 && open.has('food')) this.routeGuest(g, 'food', open)
      else if (open.has('gate')) this.routeGuest(g, 'gate', open)
    }
    if (n === 'bathroom') {
      const wear = this.bumpWear('bath', g.tag === 'budget' ? 2.8 : 0.7)
      const relief = wear >= 60 ? 30 : wear >= 35 ? 42 : 55
      g.needs.bladder = Math.max(0, g.needs.bladder - relief)
      g.happiness += wear >= 60 ? -2 : 4
      g.thought = wear >= 60 ? 'WC was rough' : 'Relief'
    }
    if (n === 'food') {
      const pay = g.tag === 'premium' ? 28 : 14
      g.needs.hunger = Math.max(0, g.needs.hunger - 50)
      g.spent += pay
      this.cash += pay
      this.revenue += pay
      this.mealSold = true
      g.happiness += 6
      g.thought = `Ate (−$${pay})`
    }
    if (n === 'shop') {
      const pay = g.tag === 'premium' ? 42 : 18
      g.needs.shop = Math.max(0, g.needs.shop - 60)
      g.spent += pay
      this.cash += pay
      this.revenue += pay
      g.happiness += 5
      g.thought = `Bought a souvenir (−$${pay})`
    }
    if (n === 'lounge' && g.tag === 'premium') {
      g.needs.energy = Math.max(0, g.needs.energy - 45)
      g.happiness += 8
      g.thought = 'Lounge calm'
    }
    if (n === 'golf') {
      const pay = g.tag === 'premium' ? 55 : 28
      g.needs.play = Math.max(0, g.needs.play - 70)
      g.needs.energy = Math.max(0, g.needs.energy - 20)
      g.spent += pay
      this.cash += pay
      this.revenue += pay
      g.happiness += 10
      g.thought = `Indoor golf (−$${pay})`
    }
    if (n === 'waterfall') {
      const pay = g.tag === 'premium' ? 36 : 12
      g.needs.play = Math.max(0, g.needs.play - 55)
      g.needs.energy = Math.max(0, g.needs.energy - 25)
      g.spent += pay
      this.cash += pay
      this.revenue += pay
      g.happiness += 9
      g.thought = 'Watching the falls'
    }
    if (n === 'gaming') {
      const pay = g.tag === 'premium' ? 40 : 22
      g.needs.play = Math.max(0, g.needs.play - 65)
      g.spent += pay
      this.cash += pay
      this.revenue += pay
      g.happiness += 7
      g.thought = `Gaming den (−$${pay})`
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
      g.needs.bags = Math.max(0, g.needs.bags - 55)
      g.thought = 'Got bags — heading landside'
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
      g.thought = 'Left the airport'
      g.dead = true
      this.paxServed += 1
      this.reputation = Math.min(100, this.reputation + 0.3)
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

  securityLevel(): number {
    let n = 0
    for (const f of this.fits) {
      n += f.rooms.security
      // Worn lanes soft-cap effective screening.
      if ((f.wearSec ?? 0) >= 70) n -= 1
      else if ((f.wearSec ?? 0) >= 40) n -= 0.5
    }
    if (tilesOf(this.tiles, 'police').length) n += 1
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
      if (!this.meetsReq(a.id)) return false
      if (a.kind === 'cargo' && site && site.cargoMult < 0.9 && Math.random() > 0.35) return false
      if (a.kind === 'pax' && site && site.paxMult < 0.9 && Math.random() > 0.35) return false
      return true
    })
    if (!candidates.length) return
    // Prefer cheaper first airline; sprinkle procedurals after one major is signed.
    candidates.sort((a, b) => {
      if (Boolean(a.procedural) !== Boolean(b.procedural)) return a.procedural ? 1 : -1
      return a.landing - b.landing
    })
    const procs = candidates.filter((c) => c.procedural)
    const pickA =
      this.signed.length >= 1 && procs.length && Math.random() < 0.4
        ? pick(procs)
        : candidates[0]
    this.offer = { airline: pickA.id, age: 0 }
    const tag = pickA.procedural ? ' (regional)' : ''
    this.pushNews(`${pickA.name}${tag} is on the phone — they want a contract.`, 'good')
  }

  acceptOffer() {
    if (!this.offer) return
    const id = this.offer.airline
    const a = this.airline(id)
    this.signed.push(id)
    if (this.airlineHeat[id] == null) this.airlineHeat[id] = 70
    this.offer = null
    this.offerCool = 25
    this.spawnCool = Math.min(this.spawnCool, 4)
    this.reputation = Math.min(100, this.reputation + (a.procedural ? 5 : 8))
    this.seedScheduleForAirline(id, 3)
    this.pushNews(
      `${a.name} signed${a.procedural ? ' (filler regional)' : ''}. Flights hit the timetable.`,
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
    const spacing = a.kind === 'cargo' ? 22 + Math.random() * 12 : 18 + Math.random() * 10
    for (let i = 0; i < count; i++) {
      this.flightSeq += 1
      this.schedule.push({
        id: uid('slot'),
        airline: airlineId,
        flightNo: `${a.name.slice(0, 2).toUpperCase()}${this.flightSeq}`,
        eta: t + i * spacing,
        status: 'scheduled',
        delaySec: 0,
        delayReason: null,
        manual: false,
        flightId: null,
      })
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
    if (open >= 12) {
      this.pushNews('Timetable full (12). Cancel or wait.', 'bad')
      this.emit()
      return
    }
    const a = this.airline(airlineId)
    this.flightSeq += 1
    const eta = this.clock + Math.max(8, inSeconds)
    this.schedule.push({
      id: uid('slot'),
      airline: airlineId,
      flightNo: `${a.name.slice(0, 2).toUpperCase()}${this.flightSeq}`,
      eta,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: null,
    })
    this.pushNews(
      `Manual slot ${a.name} ${this.flightSeq} in ${Math.round(eta - this.clock)}s.`,
      'good',
    )
    this.emit()
  }

  cancelSlot(slotId: string) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || s.status === 'inbound' || s.status === 'done') return
    s.status = 'cancelled'
    this.adjustHeat(s.airline, s.manual ? -1.5 : -3.5)
    this.pushNews(
      `Cancelled ${s.flightNo} — ${this.airline(s.airline).name} heat ${Math.round(this.heatOf(s.airline))}.`,
      'bad',
    )
    this.schedule = this.schedule.filter((x) => x.status !== 'cancelled' && x.status !== 'done')
    this.emit()
  }

  /** Push a delayed slot later; ripples the bank behind it. */
  bumpSlot(slotId: string, bySec = 18) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    this.delaySlot(s, bySec, 'Tower rearrange')
    this.pushNews(
      `Bumped ${s.flightNo} +${bySec}s — later slots slide.`,
      'ok',
    )
    this.emit()
  }

  delaySlot(slot: ScheduleSlot, sec: number, reason: string) {
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
          x.eta < slot.eta + 36,
      )
      .sort((a, b) => a.eta - b.eta)
      .slice(0, 4)
    let cursor = slot.eta + 14
    for (const x of later) {
      if (x.eta < cursor) {
        const push = Math.min(18, cursor - x.eta)
        x.eta += push
        x.delaySec = Math.min(120, x.delaySec + push)
        x.status = 'delayed'
        x.delayReason = x.delayReason ?? 'Cascade from earlier delay'
        this.adjustHeat(x.airline, -0.35)
        cursor = x.eta + 14
      } else {
        cursor = Math.max(cursor, x.eta + 14)
      }
    }
    this.adjustHeat(slot.airline, -0.7)
  }

  tickSchedule(dt: number) {
    this.schedulePlanCool = Math.max(0, this.schedulePlanCool - dt)
    // Storm at destination / on field — random inbound delay.
    if (this.weather === 'storm' && Math.random() < dt * 0.04) {
      const soon = this.openSchedule().find((s) => s.eta - this.clock < 30)
      if (soon && soon.status === 'scheduled') {
        this.delaySlot(soon, 12 + Math.random() * 16, 'Storm / dest weather')
        this.pushNews(
          `${soon.flightNo} delayed ${Math.round(soon.delaySec)}s — storm bank.`,
          'bad',
        )
      }
    }
    // Auto-fill timetable so the bank stays ~4–8 deep when enabled.
    if (this.scheduleAuto && this.schedulePlanCool <= 0 && this.signed.length) {
      this.schedulePlanCool = 18
      const open = this.openSchedule()
      if (open.length < 5) {
        const pool = this.signed.filter((id) => !this.isBanned(id))
        if (pool.length) {
          // Bias toward cargo if freighters are starving vs pax bank.
          const cargo = pool.filter((id) => this.airline(id).kind === 'cargo')
          const paxSeen = (this.craftSeen.regional ?? 0) + (this.craftSeen.narrowbody ?? 0)
          const freightSeen = this.craftSeen.freighter ?? 0
          const pickId =
            cargo.length && freightSeen * 3 < paxSeen && Math.random() < 0.55
              ? pick(cargo)
              : pick(pool)
          this.seedScheduleForAirline(pickId, 2)
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

  declineOffer() {
    if (!this.offer) return
    const id = this.offer.airline
    const a = this.airline(id)
    this.offer = null
    this.offerCool = 40
    this.adjustHeat(id, -2)
    this.pushNews(`${a.name} hung up. They may call again later.`, 'ok')
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
        (fit.rooms.gaming ?? 0) >
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
    this.layoverOffer = { airline: id, age: 0, fee, duration, transferPax }
    this.pushNews(
      `${a.name} wants a layover bank — $${fee.toLocaleString()} up front, ${transferPax} transfers for ~${duration}s. Keep them happy or get banned.`,
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
      `${a.name} layover live — transfers dumping into the hall. Heat ${Math.round(this.heatOf(o.airline))}.`,
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

  tickLayover(dt: number) {
    this.layoverOfferCool = Math.max(0, this.layoverOfferCool - dt)
    if (this.layoverOffer) this.layoverOffer.age += dt
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
      if (avg < 48 || heat < HEAT_BAN_THRESHOLD + 5) {
        this.banAirline(L.airline, avg < 48 ? 'miserable transfers' : 'thin heat')
      } else {
        this.adjustHeat(L.airline, 8)
        this.reputation = Math.min(100, this.reputation + 3)
        this.pushNews(
          `${a.name} layover cleared — avg happiness ${Math.round(avg)}. They'll be back.`,
          'good',
        )
      }
    }
  }

  spawnTransferGuest(airlineId: AirlineId) {
    const open = this.hallOpen()
    if (!open.size) return
    const a = this.airline(airlineId)
    const tag: PaxTag =
      Math.random() < (a.persona === 'business' ? 0.45 : 0.2) ? 'premium' : 'budget'
    const g = spawnHallGuest(`layover:${airlineId}`, 'arrive', tag, {
      transfer: true,
      airlineId,
    })
    g.node = 'gate'
    g.thought = `${a.name} transfer — kill time in the hall`
    g.needs.boarding = 35 + Math.random() * 40
    if (open.has('food')) this.routeGuest(g, 'food', open)
    else if (open.has('shop')) this.routeGuest(g, 'shop', open)
    else if (open.has('lounge')) this.routeGuest(g, 'lounge', open)
    else if (open.has('claim')) this.routeGuest(g, 'claim', open)
    this.hallGuests.push(g)
    // Transfers scuff the hall faster.
    if (Math.random() < 0.35) this.bumpWear('bath', 0.4)
    if (Math.random() < 0.2) this.bumpWear('sec', 0.25)
  }

  /** Soft heat drift + ban expiry news. */
  tickAirlineRelations(dt: number) {
    for (const id of this.signed) {
      if (this.isBanned(id)) continue
      // Slow recovery toward 70 when not in crisis.
      const h = this.heatOf(id)
      if (h < 70) this.airlineHeat[id] = Math.min(70, h + dt * 0.14)
      else if (h > 78) this.airlineHeat[id] = Math.max(70, h - dt * 0.04)
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

  payrollPreview(): number {
    let total = 0
    for (const key of Object.keys(BUDGET_BASE) as BudgetKey[]) {
      total += this.lineCost(key)
    }
    return Math.round(total)
  }

  lineCost(key: BudgetKey): number {
    const pct = this.budgets[key] / 100
    let base = BUDGET_BASE[key] * pct
    if (key === 'maintenance') {
      base += this.mechanics * MECHANIC_WAGE * pct
      // Hangar on field adds a shop overhead even at low slider (tools still cost).
      if (tilesOf(this.tiles, 'hangar').length) base += 90 * Math.max(0.25, pct)
    }
    if (key === 'security') {
      const posts = tilesOf(this.tiles, 'police').length + this.fits.reduce((n, f) => n + f.rooms.security, 0)
      base *= 1 + posts * 0.12
    }
    if (key === 'cleaning') {
      const rooms = this.fits.reduce((n, f) => n + f.rooms.bathroom + f.rooms.food, 0)
      base *= 1 + rooms * 0.08
    }
    if (key === 'fire') {
      const stations = Math.max(1, tilesOf(this.tiles, 'fire').length)
      base *= stations
      if (!tilesOf(this.tiles, 'fire').length) base *= 0.35 // skeleton ARFF desk
    }
    if (key === 'ambulance') {
      if (!this.signed.length && !tilesOf(this.tiles, 'helipad').length) base *= 0.4
    }
    return base
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
    this.mxOffer = { airline: id, age: 0, payout }
    this.pushNews(
      `${a.name} wants a line-maintenance contract — $${payout.toLocaleString()} per turnaround in your hangar.`,
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
    if (this.weather === 'storm') return 2.4
    if (this.weather === 'fog') return 1.7
    if (this.weather === 'rain') return 1.35
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
        this.pushNews('Storm cell over the field — wet strip, high crash risk if pavement is soft.', 'bad')
      } else if (next === 'clear' && this.runwayCondition < 50) {
        this.pushNews('Skies clear, but the runway still needs work.', 'ok')
      } else if (next !== 'clear') {
        this.pushNews(`Weather: ${this.weatherLabel()}.`, 'ok')
      }
    }
  }

  tickPayroll(dt: number) {
    this.payrollCool -= dt
    if (this.payrollCool > 0) return
    this.payrollCool = 30
    const bill = this.payrollPreview()
    if (bill <= 0) return
    if (this.cash >= bill) {
      this.cash -= bill
      this.pushNews(`Ops payroll ${moneyLeft(bill)} (sliders × staff × shops).`, 'ok')
      return
    }
    // Partial pay — never drive cash below zero from payroll alone.
    const paid = Math.max(0, this.cash)
    this.cash = 0
    this.reputation = Math.max(0, this.reputation - 4)
    // Starved lines bite harder next cycle.
    if (this.budgets.maintenance > 20) this.budgets.maintenance = Math.max(20, this.budgets.maintenance - 10)
    if (this.budgets.security > 20) this.budgets.security = Math.max(20, this.budgets.security - 10)
    this.pushNews(
      paid > 0
        ? `Payroll short — paid ${moneyLeft(paid)} of ${moneyLeft(bill)}. Sliders cut, reputation dips.`
        : `Payroll missed entirely (${moneyLeft(bill)} due). Crews walking. Reputation dips.`,
      'bad',
    )
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

  clickTile(v: Vec) {
    if (!inBounds(v.c, v.r)) return
    this.selectedTile = v
    this.selectedFlight = this.nearestFlight(v)?.id ?? this.selectedFlight

    if (this.tool === 'pan') {
      if (this.tile(v) === 'terminal') {
        this.enterHallAt(v)
        return
      }
      const f = this.nearestFlight(v)
      if (f) this.selectedFlight = f.id
      this.emit()
      return
    }
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

  nearestFlight(v: Vec): Flight | undefined {
    let best: Flight | undefined
    let dist = 1.8
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

  refundFor(tile: Tile): number {
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

  clearTile(v: Vec) {
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
      this.cash += this.refundFor(cur)
      this.tiles[v.r][v.c] = 'grass'
    }
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
    if (cells.some((p) => !inBounds(p.c, p.r) || this.tile(p) !== 'grass')) {
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
    for (const p of cells) this.tiles[p.r][p.c] = 'runway'
    this.pushNews(
      klass === 'heavy'
        ? 'Heavy strip stamped — widebodies and 747Fs can land.'
        : klass === 'short'
          ? 'Short strip stamped — CRJ / E-Jets / Citations only. Long metal will refuse.'
          : 'Regional runway stamped — A320 / 737 class OK.',
      'good',
    )
    this.emit()
  }

  placeTerminal(v: Vec) {
    const cells = [
      v,
      { c: v.c + 1, r: v.r },
      { c: v.c, r: v.r + 1 },
      { c: v.c + 1, r: v.r + 1 },
    ]
    if (cells.some((p) => this.tile(p) !== 'grass')) {
      this.pushNews('Need a clear 2×2 for the shell.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(TERMINAL_COST, 'terminal shell')) {
      this.emit()
      return
    }
    for (const p of cells) this.tiles[p.r][p.c] = 'terminal'
    this.fits.push(emptyFit(v, false))
    this.selectedTile = v
    this.pushNews('Empty shell up. Furnish security or airlines will stay away.', 'ok')
    this.emit()
  }

  placePremade(v: Vec) {
    const cells: Vec[] = []
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) cells.push({ c: v.c + c, r: v.r + r })
    }
    if (cells.some((p) => !inBounds(p.c, p.r) || this.tile(p) !== 'grass')) {
      this.pushNews('Need a clear 3×3 for the premade hall.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(PREMADE_TERMINAL_COST, 'premade terminal')) {
      this.emit()
      return
    }
    for (const p of cells) this.tiles[p.r][p.c] = 'terminal'
    this.fits.push(
      emptyFit(v, true, {
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
    this.selectedTile = v
    this.pushNews('Premade terminal online — check-in, security, gates, claim, food.', 'good')
    this.emit()
  }

  placeSingle(v: Vec) {
    const building = BUILDINGS.find((b) => b.tool === this.tool)
    if (!building) return
    if (this.tile(v) !== 'grass') {
      this.pushNews('Needs grass.', 'bad')
      this.emit()
      return
    }
    if (building.tile === 'fuel' && !farmBesidePavement(this.tiles, v)) {
      this.pushNews('Park the farm beside taxi, stand, runway, or road.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(building.cost, building.name)) {
      this.emit()
      return
    }
    this.tiles[v.r][v.c] = building.tile
    this.emit()
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
        (['landing', 'taxi_in', 'taxi_out', 'takeoff'] as Phase[]).includes(f.phase),
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

  /** Prefer stands closest to a terminal hall — lite gate assignment. */
  assignStand(): Vec | null {
    const free = this.freeStands()
    if (!free.length) return null
    const halls = this.fits.map((f) => f.origin)
    const terms = halls.length ? halls : tilesOf(this.tiles, 'terminal')
    if (!terms.length) return free[0]
    free.sort((a, b) => {
      const da = Math.min(...terms.map((t) => Math.abs(t.c - a.c) + Math.abs(t.r - a.r)))
      const db = Math.min(...terms.map((t) => Math.abs(t.c - b.c) + Math.abs(t.r - b.r)))
      return da - db
    })
    return free[0]
  }

  /** Gate label from stand index — tower desk copy. */
  gateLabel(stand: Vec | null): string {
    if (!stand) return '—'
    const stands = tilesOf(this.tiles, 'stand')
    const idx = stands.findIndex((s) => s.c === stand.c && s.r === stand.r)
    return idx >= 0 ? `G${idx + 1}` : `${stand.c},${stand.r}`
  }

  holdingCount(): number {
    return this.flights.filter(
      (f) => (f.craft ?? 'jet') === 'jet' && f.phase === 'hold',
    ).length
  }

  maxInbound(): number {
    // Tower pays: two approaches at once; without it, one.
    return tilesOf(this.tiles, 'tower').length > 0 ? 2 : 1
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

  pathStandToRunway(stand: Vec): Vec[] | null {
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    const runwayCells = strips.flat()
    if (!runwayCells.length) return null
    return nearestPath(this.tiles, stand, runwayCells, 'jet')
  }

  landingRoute(stand: Vec): Vec[] | null {
    const toRunway = this.pathStandToRunway(stand)
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

  trySpawn() {
    if (this.spawnCool > 0 || !this.signed.length) return
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    if (!tilesOf(this.tiles, 'stand').length) return

    const inbound = this.flights.filter((f) =>
      (['hold', 'approach', 'landing', 'taxi_in'] as Phase[]).includes(f.phase),
    )

    // Prefer the timetable. If nothing is due, only seed when auto and bank empty.
    const slot = this.nextDueSlot()
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
      this.delaySlot(slot, 10 + Math.random() * 8, 'Runway backlog')
      if (Math.random() < 0.45) {
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
    const stand = this.assignStand()
    const route = stand ? this.landingRoute(stand) : null
    const busy = this.groundBusy() || !stand || !route
    const start = route?.[0] ?? { c: 1, r: -3 }
    const pax =
      af.paxMax <= 0
        ? 0
        : af.paxMin + Math.floor(Math.random() * (af.paxMax - af.paxMin + 1))
    const gate = this.gateLabel(stand)
    const f: Flight = {
      id: uid('flt'),
      airline: airlineId,
      flightNo: slot.flightNo,
      airframeId: af.id,
      airframeName: af.name,
      pax,
      cargo: def.kind === 'cargo',
      craft: 'jet',
      kind: af.kind,
      phase: busy ? 'hold' : 'approach',
      stand,
      x: start.c - 4,
      y: start.r - 2,
      z: 8,
      heading: 0,
      path: route ?? [],
      seg: 0,
      t: 0,
      holdAngle: Math.random() * Math.PI * 2,
      posted: {
        landing: false,
        bags: false,
        fuel: false,
        catering: false,
        bagDrop: false,
      },
      waitingOn: {
        bags: false,
        fuel: false,
        catering: false,
        paxOut: 0,
        paxIn: 0,
      },
      phaseTime: 0,
      ledger: [],
      scheduleId: slot.id,
      boardingSlow: Math.random() < 0.12,
    }
    this.flights.push(f)
    this.noteCraft(af.kind)
    slot.status = 'inbound'
    slot.flightId = f.id
    this.spawnCool = tilesOf(this.tiles, 'tower').length ? 10 : 14
    this.selectedFlight = this.selectedFlight ?? f.id
    const role = craftRoleLabel(af.kind)
    const late = slot.delaySec > 0 ? ` (${Math.round(slot.delaySec)}s late)` : ''
    this.pushNews(
      `${def.name} ${f.flightNo}${late} · ${role} ${af.name} → ${gate}` +
        (busy ? ' — holding for pavement.' : '.'),
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
      posted: {
        landing: false,
        bags: false,
        fuel: false,
        catering: false,
        bagDrop: false,
      },
      waitingOn: {
        bags: false,
        fuel: false,
        catering: false,
        paxOut: 0,
        paxIn: 0,
      },
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
    const f = this.flights.find((x) => x.phase === 'hold' && (x.craft ?? 'jet') === 'jet')
    if (!f) return
    const stand = this.assignStand()
    if (!stand) return
    const route = this.landingRoute(stand)
    if (!route) return
    f.stand = stand
    f.path = route
    f.seg = 0
    f.t = 0
    f.phase = 'approach'
    f.phaseTime = 0
    f.z = 8
    f.x = route[0].c - 3
    f.y = route[0].r - 2
    if (Math.random() < 0.4) {
      this.pushNews(
        `${f.flightNo} cleared to ${this.gateLabel(stand)}${hasTower ? ' (tower)' : ''}.`,
        'ok',
      )
    }
  }

  followPath(
    ent: { x: number; y: number; heading?: number; path: Vec[]; seg: number; t: number },
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
    const a = ent.path[ent.seg]
    const b = ent.path[ent.seg + 1]
    const dist = Math.abs(b.c - a.c) + Math.abs(b.r - a.r) || 1
    ent.t += (speed * dt) / dist
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
    const airline = this.airline(f.airline)
    if (!f.posted.landing) {
      f.posted.landing = true
      if (f.kind === 'military') {
        const mult = AIRFRAMES[f.airframeId]?.landingMult ?? 1
        this.earn(Math.round(MIL_LANDING * mult), `${f.flightNo} ${f.airframeName} landing`, f)
      } else if (f.kind === 'air_ambulance') {
        this.earn(AIR_AMBULANCE_FEE, `${f.flightNo} ${f.airframeName}`, f)
      } else {
        const mult = AIRFRAMES[f.airframeId]?.landingMult ?? 1
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
        this.earn(pay, `${f.flightNo} line MX`, f)
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
        this.fuelBrand &&
        this.fuelLoads > 0 &&
        farmsQuick.length &&
        nearestPath(this.tiles, farmsQuick[0], [f.stand], 'truck')
      ) {
        const p = nearestPath(this.tiles, farmsQuick[0], [f.stand], 'truck')
        if (p) {
          f.waitingOn.fuel = true
          this.spawnTruck('fuel', f, p)
        }
      }
      return
    }

    if (f.cargo) {
      const shed = tilesOf(this.tiles, 'cargo')
      if (shed.length && nearestPath(this.tiles, f.stand, shed, 'truck')) {
        f.waitingOn.bags = true
        this.spawnTruck('bags', f, nearestPath(this.tiles, f.stand, shed, 'truck')!)
      }
    }

    const bagBuild = tilesOf(this.tiles, 'bags')
    const snackBuild = tilesOf(this.tiles, 'snack')
    const farms = tilesOf(this.tiles, 'fuel').filter((p) =>
      farmBesidePavement(this.tiles, p),
    )
    const fit = this.roomsAt(f.stand)

    if (!f.cargo) {
      const bagPath =
        bagBuild.length > 0 ? nearestPath(this.tiles, f.stand, bagBuild, 'truck') : null
      if (bagPath) {
        f.waitingOn.bags = true
        this.spawnTruck('bags', f, bagPath)
      }
      const snackPath =
        this.caterBrand && snackBuild.length > 0
          ? nearestPath(this.tiles, snackBuild[0], [f.stand], 'truck')
          : null
      if (snackPath) {
        f.waitingOn.catering = true
        this.spawnTruck('catering', f, snackPath)
      }
      // Cabin clean — AT/CEO turnaround service. Posts only after the jet is on stand.
      if (!f.posted.catering) {
        /* cleaning is timed during servicing, paid once below */
      }
    }

    if (
      this.fuelBrand &&
      this.fuelLoads > 0 &&
      farms.length &&
      nearestPath(this.tiles, farms[0], [f.stand], 'truck')
    ) {
      const p = nearestPath(this.tiles, farms[0], [f.stand], 'truck')
      if (p) {
        f.waitingOn.fuel = true
        this.spawnTruck('fuel', f, p)
      }
    }

    if (f.cargo) return

    const visual = Math.max(8, Math.min(18, Math.round(f.pax / 6)))
    f.waitingOn.paxOut = visual
    this.people.push(...spawnArrivalPax(this.tiles, f.id, f.stand, fit, visual))
    this.seedHallForFlight(f, 'arrive')
  }

  trySpawnMilitary() {
    if (!this.milAgreement) return
    this.milCool = Math.max(0, this.milCool)
    if (this.milCool > 0) return
    if (this.groundBusy()) return
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    const stand = this.assignStand()
    if (!stand) return
    const route = this.landingRoute(stand)
    if (!route) return
    const af = pickAirframe('military', this.longestRunway())
    if (!af) {
      this.milCool = 25
      return
    }
    this.flightSeq += 1
    const prefix =
      af.id === 'f15'
        ? 'VIPER'
        : af.id === 'kc135'
          ? 'ANG'
          : af.id === 'c17'
            ? 'REACH'
            : 'RDR'
    const call = `${prefix}${this.flightSeq}`
    const fighter = af.id === 'f15'
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
      x: route[0].c - 4,
      y: route[0].r - 2,
      z: fighter ? 10 : 9,
      heading: 0,
      path: route,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: {
        landing: false,
        bags: false,
        fuel: false,
        catering: false,
        bagDrop: false,
      },
      waitingOn: {
        bags: false,
        fuel: false,
        catering: false,
        paxOut: 0,
        paxIn: 0,
      },
      phaseTime: 0,
      ledger: [],
    }
    this.flights.push(f)
    this.noteCraft('military')
    this.milCool = fighter ? 70 + Math.random() * 35 : 100 + Math.random() * 50
    this.selectedFlight = this.selectedFlight ?? f.id
    this.pushNews(
      fighter
        ? `${call} · ${af.name} fighter drag inbound (Guard host).`
        : `${call} · ${af.name} military transit → ${this.gateLabel(stand)}.`,
      'ok',
    )
  }

  trySpawnAirAmbulance() {
    this.ambuCool = Math.max(0, this.ambuCool)
    if (this.ambuCool > 0) return
    if (this.budgets.ambulance < 50) return
    if (!tilesOf(this.tiles, 'fire').length) return
    if (this.groundBusy()) return
    const af = pickAirframe('air_ambulance', this.longestRunway())
    if (!af) {
      this.ambuCool = 30
      return
    }
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    const stand = this.assignStand()
    if (!stand) return
    const route = this.landingRoute(stand)
    if (!route) return
    this.flightSeq += 1
    const call = `LIF${this.flightSeq}`
    const f: Flight = {
      id: uid('amb'),
      airline: this.signed[0] ?? 'harbor',
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: af.paxMin + Math.floor(Math.random() * (af.paxMax - af.paxMin + 1)),
      cargo: false,
      craft: 'jet',
      kind: 'air_ambulance',
      phase: 'approach',
      stand,
      x: route[0].c - 3,
      y: route[0].r - 2,
      z: 8,
      heading: 0,
      path: route,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: {
        landing: false,
        bags: false,
        fuel: false,
        catering: false,
        bagDrop: false,
      },
      waitingOn: {
        bags: false,
        fuel: false,
        catering: false,
        paxOut: 0,
        paxIn: 0,
      },
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

  spawnTruck(kind: Truck['kind'], f: Flight | null, path: Vec[]) {
    const start = path[0]
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
      patrol: !f,
    })
  }

  finishTruck(t: Truck) {
    if (!t.flightId) return
    const f = this.flights.find((x) => x.id === t.flightId)
    if (!f) return
    const airline = this.airline(f.airline)
    if (t.kind === 'bags' && !f.posted.bags) {
      f.posted.bags = true
      f.waitingOn.bags = false
      if (!f.cargo) this.earn(airline.bags, `${f.flightNo} bag handling`, f)
      else this.earn(Math.round(airline.landing * 0.35), `${f.flightNo} cargo handling`, f)
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
    }
    if (t.kind === 'fuel' && !f.posted.fuel && this.fuelBrand && this.fuelLoads > 0) {
      f.posted.fuel = true
      f.waitingOn.fuel = false
      this.fuelLoads -= 1
      this.earn(FUEL[this.fuelBrand].pump, `${f.flightNo} fuel`, f)
    }
    if (t.kind === 'catering' && !f.posted.catering && this.caterBrand) {
      f.posted.catering = true
      f.waitingOn.catering = false
      const pay = Math.round(airline.catering * CATER[this.caterBrand].payoutMult)
      this.earn(pay, `${f.flightNo} catering (${CATER[this.caterBrand].name})`, f)
      this.mealSold = true
      this.reputation = Math.min(100, this.reputation + 1)
    }
  }

  beginBoarding(f: Flight) {
    if (!f.stand || f.cargo) return
    const visual = Math.max(8, Math.min(18, Math.round(f.pax / 6)))
    f.waitingOn.paxIn = visual
    const fit = this.roomsAt(f.stand)
    this.people.push(...spawnDeparturePax(this.tiles, f.id, f.stand, fit, visual))
    this.seedHallForFlight(f, 'depart')
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
    this.threatCool = 50 + Math.random() * 40
    if (!this.signed.length || !this.flights.some((f) => !f.cargo && f.phase !== 'gone')) return
    const sec = this.securityLevel()
    const police = tilesOf(this.tiles, 'police').length
    const wearSec = this.avgWear().sec
    const staffGap = 1 - this.budgets.security / 100
    const risk = clamp(
      0.55 - sec * 0.12 - police * 0.08 + wearSec * 0.002 + staffGap * 0.22,
      0.05,
      0.72,
    )
    if (Math.random() > risk) return
    const hard = sec < 2 || this.budgets.security < 35
    this.pendingThreat = {
      id: uid('thr'),
      severity: hard ? 'hard' : 'soft',
      blurb: hard
        ? 'Hard alarm — possible threat past a weak lane. Scramble police or eat the headline.'
        : 'Suspicious bag on an outbound. Scramble screeners or hope the tape stays quiet.',
      age: 0,
      deadline: hard ? 18 : 24,
    }
    this.pushNews(`THREAT ALERT — decide now. ${this.pendingThreat.blurb}`, 'bad')
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
    this.spawnCool = Math.max(0, this.spawnCool - step)
    this.offerCool = Math.max(0, this.offerCool - step)
    this.saveTimer += step
    if (this.saveTimer > 8) {
      this.saveTimer = 0
      this.persist()
    }
    for (const n of this.news) n.age += step
    if (this.offer) this.offer.age += step

    if (this.loanBalance > 0) {
      this.interestCool -= step
      if (this.interestCool <= 0) {
        this.interestCool = 60
        this.loanBalance += LOAN_INTEREST
        this.charge(LOAN_INTEREST)
        this.pushNews(`Loan interest ${moneyLeft(LOAN_INTEREST)}. Owed ${moneyLeft(this.loanBalance)}.`, 'bad')
      }
    }
    // City rail soft-boosts pax demand via reputation drip.
    if (this.railLinked && Math.random() < step * 0.02) {
      this.reputation = Math.min(100, this.reputation + 0.05)
    }

    this.considerOffers()
    this.mxOfferCool = Math.max(0, this.mxOfferCool - step)
    if (this.mxOffer) this.mxOffer.age += step
    this.considerMxOffers()
    this.tickLayover(step)
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
    this.tickPatrols(step)
    this.tickThreats(step)
    this.tickMarket(step)
    this.tickHall(step)
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
        f.z = lerp(f.z, 1.2, 1 - Math.pow(0.12, step))
        const arrived = this.followPath(f, 1.6, step)
        if (arrived || f.phaseTime > 8) {
          f.phase = 'landing'
          f.phaseTime = 0
          f.z = 0.9
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
        if ((f.phaseTime > 6 && f.waitingOn.paxOut <= 2) || f.phaseTime > 14 || f.cargo) {
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
        if ((!waiting && f.phaseTime > 4) || f.phaseTime > 22) {
          f.waitingOn.bags = false
          f.waitingOn.fuel = false
          f.waitingOn.catering = false
          if (f.cargo || f.kind === 'military' || f.kind === 'air_ambulance') {
            const out = this.departurePath(f)
            if (out && !this.groundBusy()) {
              f.path = out
              f.seg = 0
              f.t = 0
              f.phase = 'taxi_out'
              f.phaseTime = 0
            }
          } else {
            f.phase = 'board'
            f.phaseTime = 0
            this.beginBoarding(f)
          }
        }
      } else if (f.phase === 'board') {
        const boardLimit = f.boardingSlow ? 22 : 16
        const boardReady =
          f.waitingOn.paxIn <= 0 && f.phaseTime > (f.boardingSlow ? 9 : 5)
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
            this.pushNews(`${f.flightNo} slow boarding — heat dips.`, 'bad')
          }
          f.boardingSlow = false
        }
        if (boardReady || f.phaseTime > boardLimit) {
          const out = this.departurePath(f)
          if (out && !this.groundBusy()) {
            f.path = out
            f.seg = 0
            f.t = 0
            f.phase = 'taxi_out'
            f.phaseTime = 0
          } else if (f.phaseTime > boardLimit + 6) {
            const next = this.openSchedule()[0]
            if (next && Math.random() < step * 0.35) {
              this.delaySlot(next, 8, 'Departure blocked')
            }
          }
        }
      } else if (f.phase === 'taxi_out') {
        if (this.followPath(f, 1.2, step)) {
          f.phase = 'takeoff'
          f.phaseTime = 0
        }
      } else if (f.phase === 'takeoff') {
        if (f.phaseTime < 1.2 && this.checkCrash(f, 'takeoff')) continue
        f.z += step * 3.2
        f.x += Math.cos(f.heading) * step * 2.4
        f.y += Math.sin(f.heading) * step * 2.4
        if (f.phaseTime > 6 || f.z > 14) {
          f.phase = 'gone'
          this.flightsDone += 1
          this.paxServed += f.pax
          if (f.kind !== 'military' && f.kind !== 'air_ambulance') {
            this.adjustHeat(f.airline, 1.8)
          }
          if (f.scheduleId) {
            const slot = this.schedule.find((s) => s.id === f.scheduleId)
            if (slot) slot.status = 'done'
          }
          this.pushNews(`${f.flightNo} airborne.`, 'ok')
          this.spawnCool = Math.min(this.spawnCool, 8)
        }
      }
    }
    this.flights = this.flights.filter((f) => f.phase !== 'gone')

    for (const t of this.trucks) {
      if (t.dwell > 0) {
        t.dwell -= step
        if (t.dwell <= 0 && !t.returning) {
          this.finishTruck(t)
          t.returning = true
          t.path = [...t.path].reverse()
          t.seg = 0
          t.t = 0
        }
        continue
      }
      const done = this.followPath(t, 1.8, step)
      if (done && !t.returning) t.dwell = t.kind === 'fuel' ? 3.2 : 2.2
      else if (done && t.returning) t.dwell = -99
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

    this.uiAcc += step
    if (this.uiAcc > 0.12) {
      this.uiAcc = 0
      this.emit()
    }
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
