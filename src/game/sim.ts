import {
  AIRLINES,
  airlineList,
  BAG_DROP_PAY,
  BULLDOZE_REFUND,
  BUILDINGS,
  CATER,
  CLEANING_FEE,
  FUEL,
  LAND,
  LOADS_PER_BUY,
  MIN_RUNWAY,
  PREMADE_TERMINAL_COST,
  ROOMS,
  RUNWAY_PREFAB_COST,
  RUNWAY_PREFAB_LEN,
  RUNWAY_PREFAB_WID,
  START_CASH,
  TERMINAL_COST,
} from './catalog'
import {
  astar,
  farmBesidePavement,
  inBounds,
  nearestPath,
  neighbors,
  runwayStrips,
  tilesOf,
} from './path'
import { SAVE_KEY, SIZE, type AirlineId } from './types'
import type {
  CaterBrand,
  ContractOffer,
  Difficulty,
  Flight,
  FuelBrand,
  GameSnapshot,
  News,
  Person,
  Phase,
  RoomId,
  SiteKind,
  Speed,
  TerminalFit,
  Tile,
  Tool,
  Truck,
  Vec,
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
})

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
  threatCool = 40
  securityIncidents = 0
  reputation = 40
  flights: Flight[] = []
  trucks: Truck[] = []
  people: Person[] = []
  news: News[] = []
  selectedFlight: string | null = null
  selectedTile: Vec | null = null
  spawnCool = 8
  flightSeq = 100
  flightsDone = 0
  paxServed = 0
  revenue = 0
  listeners = new Set<() => void>()
  saveTimer = 0
  uiAcc = 0
  patrolCool = 0

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
    this.threatCool = 45
    this.securityIncidents = 0
    this.reputation = 40
    this.flights = []
    this.trucks = []
    this.people = []
    this.news = []
    this.selectedFlight = null
    this.selectedTile = null
    this.spawnCool = 10
    this.flightSeq = 100
    this.flightsDone = 0
    this.paxServed = 0
    this.revenue = 0
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
    this.pushNews(
      `${land.name} purchased. ${moneyLeft(this.cash)} left. Enter build mode — stamp a runway, services, then wait for airlines.`,
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
      this.fits = s.terminalFits ?? []
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
      this.flights = []
      this.trucks = []
      this.people = []
      this.offer = null
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

  earn(amount: number, label: string, flight?: Flight) {
    this.cash += amount
    this.revenue += amount
    if (flight) flight.ledger.push({ label, amount })
    this.pushNews(`${label}  +$${amount.toLocaleString('en-US')}`, 'good')
  }

  setTool(tool: Tool) {
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
    for (const f of this.fits) n += f.rooms.security
    if (tilesOf(this.tiles, 'police').length) n += 1
    return n
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
      tower: tilesOf(this.tiles, 'tower').length > 0,
      hangar: tilesOf(this.tiles, 'hangar').length > 0,
    }
  }

  meetsReq(id: AirlineId): boolean {
    const a = AIRLINES[id]
    const r = this.readiness()
    if (!r.runway) return false
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
    const a = AIRLINES[id]
    const r = this.readiness()
    const miss: string[] = []
    if (!r.runway) miss.push('runway')
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
    const candidates = airlineList().filter((a) => {
      if (this.signed.includes(a.id)) return false
      if (!this.meetsReq(a.id)) return false
      if (a.kind === 'cargo' && site && site.cargoMult < 0.9 && Math.random() > 0.35) return false
      if (a.kind === 'pax' && site && site.paxMult < 0.9 && Math.random() > 0.35) return false
      return true
    })
    if (!candidates.length) return
    // Prefer cheaper first airline
    candidates.sort((a, b) => a.landing - b.landing)
    const pickA = candidates[0]
    this.offer = { airline: pickA.id, age: 0 }
    this.pushNews(`${pickA.name} is on the phone — they want a contract.`, 'good')
  }

  acceptOffer() {
    if (!this.offer) return
    const id = this.offer.airline
    this.signed.push(id)
    this.offer = null
    this.offerCool = 25
    this.spawnCool = Math.min(this.spawnCool, 4)
    this.reputation = Math.min(100, this.reputation + 8)
    this.pushNews(`${AIRLINES[id].name} signed. Flights will schedule.`, 'good')
    this.emit()
  }

  declineOffer() {
    if (!this.offer) return
    const id = this.offer.airline
    this.offer = null
    this.offerCool = 40
    this.pushNews(`${AIRLINES[id].name} hung up. They may call again later.`, 'ok')
    this.emit()
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
      fit = { origin, rooms: emptyRooms(), premade: false }
      this.fits.push(fit)
    }
    fit.rooms[id] += 1
    this.pushNews(`Furnished ${def.name}.`, 'ok')
    this.emit()
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
      const f = this.nearestFlight(v)
      if (f) this.selectedFlight = f.id
      this.emit()
      return
    }
    if (this.tool === 'clear') {
      this.clearTile(v)
      return
    }
    if (this.tool === 'runway') {
      this.placeRunway(v)
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
      return Math.round(
        (RUNWAY_PREFAB_COST / (RUNWAY_PREFAB_LEN * RUNWAY_PREFAB_WID)) * BULLDOZE_REFUND,
      )
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

  prefabRunway(origin: Vec): Vec[] {
    const cells: Vec[] = []
    if (this.facing === 'h') {
      for (let r = 0; r < RUNWAY_PREFAB_WID; r++) {
        for (let c = 0; c < RUNWAY_PREFAB_LEN; c++) {
          cells.push({ c: origin.c + c, r: origin.r + r })
        }
      }
    } else {
      for (let c = 0; c < RUNWAY_PREFAB_WID; c++) {
        for (let r = 0; r < RUNWAY_PREFAB_LEN; r++) {
          cells.push({ c: origin.c + c, r: origin.r + r })
        }
      }
    }
    return cells
  }

  placeRunway(v: Vec) {
    const cells = this.prefabRunway(v)
    if (cells.some((p) => !inBounds(p.c, p.r) || this.tile(p) !== 'grass')) {
      this.pushNews('Need a clear plot for the runway. Hit Rotate if it hangs off.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(RUNWAY_PREFAB_COST, 'runway')) {
      this.emit()
      return
    }
    for (const p of cells) this.tiles[p.r][p.c] = 'runway'
    this.pushNews('Regional runway stamped.', 'good')
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
    this.fits.push({ origin: v, rooms: emptyRooms(), premade: false })
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
    this.fits.push({
      origin: v,
      premade: true,
      rooms: {
        checkin: 2,
        security: 2,
        gate: 2,
        bagclaim: 1,
        food: 1,
        souvenir: 1,
        bagdrop: 1,
        lounge: 1,
        bathroom: 2,
      },
    })
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
    if (this.tool === 'runway') return this.prefabRunway(hover)
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
    return this.flights.some((f) =>
      (['landing', 'taxi_in', 'taxi_out', 'takeoff'] as Phase[]).includes(f.phase),
    )
  }

  freeStands(): Vec[] {
    const stands = tilesOf(this.tiles, 'stand')
    const used = new Set(
      this.flights
        .filter((f) => f.stand && f.phase !== 'gone' && f.phase !== 'takeoff')
        .map((f) => `${f.stand!.c},${f.stand!.r}`),
    )
    return stands.filter((s) => {
      if (used.has(`${s.c},${s.r}`)) return false
      return Boolean(this.pathStandToRunway(s))
    })
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
    const inbound = this.flights.filter((f) =>
      (['hold', 'approach', 'landing', 'taxi_in'] as Phase[]).includes(f.phase),
    )
    if (inbound.length >= 1) return
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    if (!tilesOf(this.tiles, 'stand').length) return

    const site = this.site ? LAND[this.site] : null
    const pool = this.signed.filter((id) => {
      const a = AIRLINES[id]
      if (!site) return true
      if (a.kind === 'cargo') return Math.random() < 0.45 * site.cargoMult
      return Math.random() < 0.55 * site.paxMult
    })
    const airlineId = pick(pool.length ? pool : this.signed)
    const def = AIRLINES[airlineId]
    const free = this.freeStands()
    const stand = free[0] ?? null
    const route = stand ? this.landingRoute(stand) : null
    const busy = this.groundBusy() || !stand || !route
    const start = route?.[0] ?? { c: 1, r: -3 }
    this.flightSeq += 1
    const f: Flight = {
      id: uid('flt'),
      airline: airlineId,
      flightNo: `${def.name.slice(0, 2).toUpperCase()}${this.flightSeq}`,
      pax: def.kind === 'cargo' ? 0 : def.paxMin + Math.floor(Math.random() * (def.paxMax - def.paxMin + 1)),
      cargo: def.kind === 'cargo',
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
    }
    this.flights.push(f)
    this.spawnCool = 16
    this.selectedFlight = this.selectedFlight ?? f.id
    this.pushNews(
      `${def.name} ${f.flightNo} inbound` + (busy ? ' — holding for pavement.' : '.'),
      'ok',
    )
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
    const f = this.flights.find((x) => x.phase === 'hold')
    if (!f) return
    const free = this.freeStands()
    if (!free.length) return
    const stand = free[0]
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
    const airline = AIRLINES[f.airline]
    if (!f.posted.landing) {
      f.posted.landing = true
      this.earn(airline.landing, `${f.flightNo} landing fee`, f)
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

    const visual = Math.max(6, Math.round(f.pax / 10))
    f.waitingOn.paxOut = visual
    const hall = tilesOf(this.tiles, 'terminal')
    const bagGoal = bagBuild[0]
    const snackGoal = snackBuild[0]
    const claim = fit && fit.rooms.bagclaim > 0 ? hall[0] : null

    for (let i = 0; i < visual; i++) {
      const wantBag = Math.random() < 0.75 && Boolean(bagGoal || claim)
      const wantFood = Math.random() < 0.55
      const wantGift = Math.random() < 0.35
      const goal = wantBag && bagGoal ? bagGoal : snackGoal ?? claim ?? hall[0] ?? f.stand
      const path = astar(this.tiles, f.stand, goal, 'person') ?? [f.stand]
      this.people.push({
        id: uid('p'),
        flightId: f.id,
        x: f.stand.c,
        y: f.stand.r,
        path,
        seg: 0,
        t: 0,
        color: pick(['#d9c7a3', '#c4a574', '#8b6b4a', '#f0d9b5']),
        job: 'arrive',
        wantBag,
        wantFood,
        wantGift,
        stage: 0,
        paidFood: false,
        paidGift: false,
      })
    }
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
    const airline = AIRLINES[f.airline]
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
    const visual = Math.max(5, Math.round(f.pax / 12))
    f.waitingOn.paxIn = visual
    const hall = tilesOf(this.tiles, 'terminal')
    const start = hall[0] ?? neighbors(f.stand.c, f.stand.r)[0] ?? f.stand
    for (let i = 0; i < visual; i++) {
      const path = astar(this.tiles, start, f.stand, 'person') ?? [start, f.stand]
      this.people.push({
        id: uid('p'),
        flightId: f.id,
        x: start.c,
        y: start.r,
        path,
        seg: 0,
        t: Math.random() * -0.4,
        color: pick(['#3a5a7a', '#5c4033', '#2d4739']),
        job: 'board',
        wantBag: false,
        wantFood: false,
        wantGift: false,
        stage: 0,
        paidFood: false,
        paidGift: false,
      })
    }
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
      wantBag: false,
      wantFood: false,
      wantGift: false,
      stage: 0,
      paidFood: false,
      paidGift: false,
    })
  }

  tickThreats(dt: number) {
    this.threatCool -= dt
    if (this.threatCool > 0) return
    this.threatCool = 50 + Math.random() * 40
    if (!this.signed.length || !this.flights.some((f) => !f.cargo && f.phase !== 'gone')) return
    const sec = this.securityLevel()
    const police = tilesOf(this.tiles, 'police').length
    // Risk rises when flights run with weak screening.
    const risk = clamp(0.55 - sec * 0.12 - police * 0.08, 0.05, 0.55)
    if (Math.random() > risk) return
    this.securityIncidents += 1
    const fine = 4000 + sec * 0
    this.cash -= fine
    this.reputation = Math.max(0, this.reputation - (sec < 2 ? 12 : 4))
    this.pushNews(
      sec < 2
        ? `Security breach — undeclared threat on a departure. Fine ${moneyLeft(fine)}. Build screening and police.`
        : `Suspicious bag intercepted. Ops delay and ${moneyLeft(fine)} in overtime.`,
      'bad',
    )
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

    this.considerOffers()
    this.trySpawn()
    this.releaseHold()
    this.tickPatrols(step)
    this.tickThreats(step)

    for (const f of this.flights) {
      if (f.phase === 'gone') continue
      f.phaseTime += step
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
        if (f.phaseTime > 2.5 && !f.ledger.some((r) => r.label.includes('cleaning'))) {
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
          if (f.cargo) {
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
        if ((f.waitingOn.paxIn <= 0 && f.phaseTime > 5) || f.phaseTime > 16) {
          const out = this.departurePath(f)
          if (out && !this.groundBusy()) {
            f.path = out
            f.seg = 0
            f.t = 0
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
        f.z += step * 3.2
        f.x += Math.cos(f.heading) * step * 2.4
        f.y += Math.sin(f.heading) * step * 2.4
        if (f.phaseTime > 6 || f.z > 14) {
          f.phase = 'gone'
          this.flightsDone += 1
          this.paxServed += f.pax
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
      const done = this.followPath(p, p.job === 'patrol' ? 1.0 : 1.25, step)
      if (!done) continue
      if (p.job === 'patrol') {
        p.stage = 99
        continue
      }
      const f = this.flights.find((x) => x.id === p.flightId)
      if (p.job === 'board') {
        p.stage = 99
        if (f) f.waitingOn.paxIn = Math.max(0, f.waitingOn.paxIn - 1)
        continue
      }
      const tc = Math.round(p.x)
      const tr = Math.round(p.y)
      const tileHere = inBounds(tc, tr) ? this.tiles[tr][tc] : 'grass'
      if (tileHere === 'bags' && p.wantBag) p.wantBag = false
      if ((tileHere === 'snack' || tileHere === 'terminal') && p.wantFood && !p.paidFood) {
        p.paidFood = true
        p.wantFood = false
        this.cash += 14
        this.revenue += 14
        this.mealSold = true
      }
      if (tileHere === 'terminal' && p.wantGift && !p.paidGift) {
        const fit = this.roomsAt(f?.stand ?? null)
        if (fit && fit.rooms.souvenir > 0) {
          p.paidGift = true
          this.cash += 22
          this.revenue += 22
        }
        p.wantGift = false
      }
      if (tileHere === 'terminal' && f) f.waitingOn.paxOut = Math.max(0, f.waitingOn.paxOut - 1)
      if (tileHere === 'snack' || tileHere === 'bags') {
        const hall = tilesOf(this.tiles, 'terminal')
        if (hall.length && p.stage < 4) {
          const np = astar(this.tiles, { c: tc, r: tr }, hall[0], 'person')
          if (np) {
            p.path = np
            p.seg = 0
            p.t = 0
            p.stage += 1
            continue
          }
        }
      }
      p.stage = 99
      if (f && p.job === 'arrive') f.waitingOn.paxOut = Math.max(0, f.waitingOn.paxOut - 1)
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
