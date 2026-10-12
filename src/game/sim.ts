import {
  AIRLINES,
  BAG_DROP_PAY,
  BULLDOZE_REFUND,
  BUILDINGS,
  FUEL,
  LOADS_PER_BUY,
  MIN_RUNWAY,
  ROOMS,
  RUNWAY_TILE,
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
  Difficulty,
  Flight,
  FuelBrand,
  GameSnapshot,
  News,
  Person,
  Phase,
  RoomId,
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

const CITIES = [
  'Seattle',
  'Denver',
  'Austin',
  'Chicago',
  'Miami',
  'Portland',
  'Boston',
  'Nashville',
]

export class Game {
  tiles: Tile[][] = emptyTiles()
  fits: TerminalFit[] = []
  cash: number = START_CASH.easy
  difficulty: Difficulty = 'easy'
  clock = 0
  speed: Speed = 1
  tool: Tool = 'pan'
  runwayStart: Vec | null = null
  hover: Vec | null = null
  fuelBrand: FuelBrand | null = null
  fuelLoads = 0
  mealSold = false
  harborUnlocked = false
  flights: Flight[] = []
  trucks: Truck[] = []
  people: Person[] = []
  news: News[] = []
  selectedFlight: string | null = null
  selectedTile: Vec | null = null
  spawnCool = 4
  flightSeq = 100
  flightsDone = 0
  paxServed = 0
  revenue = 0
  listeners = new Set<() => void>()
  saveTimer = 0
  uiAcc = 0

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit() {
    for (const fn of this.listeners) fn()
  }

  constructor() {
    this.centerCameraHint()
  }

  centerCameraHint() {
    /* camera lives in the renderer */
  }

  newGame(difficulty: Difficulty) {
    this.tiles = emptyTiles()
    this.fits = []
    this.cash = START_CASH[difficulty]
    this.difficulty = difficulty
    this.clock = 0
    this.speed = 1
    this.tool = 'pan'
    this.runwayStart = null
    this.fuelBrand = null
    this.fuelLoads = 0
    this.mealSold = false
    this.harborUnlocked = false
    this.flights = []
    this.trucks = []
    this.people = []
    this.news = []
    this.selectedFlight = null
    this.selectedTile = null
    this.spawnCool = 6
    this.flightSeq = 100
    this.flightsDone = 0
    this.paxServed = 0
    this.revenue = 0
    this.pushNews(
      difficulty === 'easy'
        ? 'Grant landed. Lay a runway of 6+, a taxiway, and a stand. The jet only pays if it parks.'
        : 'Tight budget. One runway, one stand, one honest turnaround. Do not skip the pavement.',
      'ok',
    )
    this.persist()
    this.emit()
  }

  persist() {
    const snap: GameSnapshot = {
      tiles: this.tiles,
      terminalFits: this.fits,
      cash: this.cash,
      difficulty: this.difficulty,
      clock: this.clock,
      speed: this.speed,
      fuelBrand: this.fuelBrand,
      fuelLoads: this.fuelLoads,
      mealSold: this.mealSold,
      harborUnlocked: this.harborUnlocked,
      flightsDone: this.flightsDone,
      paxServed: this.paxServed,
      revenue: this.revenue,
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snap))
    } catch {
      /* ignore quota */
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
      this.clock = s.clock
      this.speed = 0
      this.fuelBrand = s.fuelBrand
      this.fuelLoads = s.fuelLoads
      this.mealSold = s.mealSold
      this.harborUnlocked = s.harborUnlocked
      this.flightsDone = s.flightsDone
      this.paxServed = s.paxServed
      this.revenue = s.revenue
      this.flights = []
      this.trucks = []
      this.people = []
      this.pushNews('Field restored. Clock paused — hit 1x when you are ready.', 'ok')
      this.emit()
      return true
    } catch {
      return false
    }
  }

  pushNews(text: string, tone: News['tone']) {
    this.news.unshift({ id: uid('n'), text, tone, age: 0 })
    this.news = this.news.slice(0, 8)
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

  setSpeed(speed: Speed) {
    this.speed = speed
    this.emit()
  }

  signFuel(brand: FuelBrand) {
    if (this.fuelBrand === brand) return
    const c = FUEL[brand]
    if (!this.spend(c.sign, `${c.name} contract`)) return
    this.fuelBrand = brand
    this.pushNews(`Signed ${c.name}. Buy loads, then the truck can roll.`, 'ok')
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
      fit = {
        origin,
        rooms: {
          checkin: 0,
          security: 0,
          gate: 0,
          bagclaim: 0,
          food: 0,
          souvenir: 0,
          bagdrop: 0,
        },
      }
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
    ]) {
      const o = { c: t.c + d.c, r: t.r + d.r }
      if (
        this.tile(o) === 'terminal' &&
        this.tile({ c: o.c + 1, r: o.r }) === 'terminal' &&
        this.tile({ c: o.c, r: o.r + 1 }) === 'terminal' &&
        this.tile({ c: o.c + 1, r: o.r + 1 }) === 'terminal'
      ) {
        return o
      }
    }
    return t
  }

  clickTile(v: Vec) {
    if (!inBounds(v.c, v.r)) return
    this.selectedTile = v
    this.selectedFlight = this.flightAt(v)?.id ?? this.selectedFlight

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

  flightAt(v: Vec): Flight | undefined {
    return this.nearestFlight(v)
  }

  refundFor(tile: Tile): number {
    if (tile === 'grass') return 0
    if (tile === 'runway') return Math.round(RUNWAY_TILE * BULLDOZE_REFUND)
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
        const cells = [
          origin,
          { c: origin.c + 1, r: origin.r },
          { c: origin.c, r: origin.r + 1 },
          { c: origin.c + 1, r: origin.r + 1 },
        ]
        for (const p of cells) {
          if (this.tile(p) === 'terminal') this.tiles[p.r][p.c] = 'grass'
        }
        this.fits = this.fits.filter(
          (f) => !(f.origin.c === origin.c && f.origin.r === origin.r),
        )
        this.cash += Math.round(TERMINAL_COST * BULLDOZE_REFUND)
      }
    } else {
      this.cash += this.refundFor(cur)
      this.tiles[v.r][v.c] = 'grass'
    }
    this.emit()
  }

  snapRunwayEnd(a: Vec, b: Vec): Vec {
    const dc = Math.abs(b.c - a.c)
    const dr = Math.abs(b.r - a.r)
    if (dc >= dr) return { c: b.c, r: a.r }
    return { c: a.c, r: b.r }
  }

  runwayStrip(a: Vec, b: Vec): Vec[] {
    const e = this.snapRunwayEnd(a, b)
    const cells: Vec[] = []
    if (e.r === a.r) {
      const c0 = Math.min(a.c, e.c)
      const c1 = Math.max(a.c, e.c)
      for (let c = c0; c <= c1; c++) cells.push({ c, r: a.r })
    } else {
      const r0 = Math.min(a.r, e.r)
      const r1 = Math.max(a.r, e.r)
      for (let r = r0; r <= r1; r++) cells.push({ c: a.c, r })
    }
    return cells.filter((p) => inBounds(p.c, p.r))
  }

  placeRunway(v: Vec) {
    if (!this.runwayStart) {
      if (this.tile(v) !== 'grass') {
        this.pushNews('Start the runway on grass.', 'bad')
        this.emit()
        return
      }
      this.runwayStart = v
      this.pushNews('Start set. Drag or click the far end — it snaps straight. Need 6 tiles.', 'ok')
      this.emit()
      return
    }
    const a = this.runwayStart
    const cells = this.runwayStrip(a, v)
    if (cells.length <= 1) {
      this.emit()
      return
    }
    if (cells.length < MIN_RUNWAY) {
      this.pushNews(
        `Need ${MIN_RUNWAY} tiles. That ghost is ${cells.length} — keep dragging the far end.`,
        'bad',
      )
      this.emit()
      return
    }
    if (cells.some((p) => this.tile(p) !== 'grass')) {
      this.pushNews('Strip is blocked. Move the far end or clear first.', 'bad')
      this.emit()
      return
    }
    const cost = cells.length * RUNWAY_TILE
    if (!this.spend(cost, 'runway')) {
      this.emit()
      return
    }
    for (const p of cells) this.tiles[p.r][p.c] = 'runway'
    this.runwayStart = null
    this.pushNews(`Runway down · ${cells.length} tiles.`, 'good')
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
      this.pushNews('Need a clear 2×2 for the hall.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(TERMINAL_COST, 'terminal')) {
      this.emit()
      return
    }
    for (const p of cells) this.tiles[p.r][p.c] = 'terminal'
    this.fits.push({
      origin: v,
      rooms: {
        checkin: 0,
        security: 0,
        gate: 0,
        bagclaim: 0,
        food: 0,
        souvenir: 0,
        bagdrop: 0,
      },
    })
    this.selectedTile = v
    this.emit()
  }

  placeSingle(v: Vec) {
    const tool = this.tool
    const building = BUILDINGS.find((b) => b.tool === tool)
    if (!building) return
    if (this.tile(v) !== 'grass') {
      this.pushNews('Needs grass.', 'bad')
      this.emit()
      return
    }
    if (building.tile === 'fuel' && !farmBesidePavement(this.tiles, v)) {
      this.pushNews('Park the farm beside taxi, stand, or runway.', 'bad')
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

  ghostRunway(hover: Vec): Vec[] {
    if (this.tool !== 'runway') return hover ? [hover] : []
    if (!this.runwayStart) return hover ? [hover] : []
    return this.runwayStrip(this.runwayStart, hover)
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

  nextAirline(): AirlineId {
    if (this.harborUnlocked && Math.random() > 0.45) return 'harbor'
    return 'northline'
  }

  trySpawn() {
    if (this.spawnCool > 0) return
    const inbound = this.flights.filter(
      (f) =>
        f.phase === 'hold' ||
        f.phase === 'approach' ||
        f.phase === 'landing' ||
        f.phase === 'taxi_in',
    )
    if (inbound.length >= 1) return
    const holding = this.flights.some((f) => f.phase === 'hold')
    const free = this.freeStands()
    if (!free.length && holding) return
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    if (!tilesOf(this.tiles, 'stand').length) return

    const airline = this.nextAirline()
    const def = AIRLINES[airline]
    this.flightSeq += 1
    const stand = free[0] ?? null
    const route = stand ? this.landingRoute(stand) : null
    const busy = this.groundBusy() || !stand || !route
    const start = route?.[0] ?? { c: 1, r: -3 }
    const f: Flight = {
      id: uid('flt'),
      airline,
      flightNo: `${airline === 'harbor' ? 'HA' : 'NL'}${this.flightSeq}`,
      pax: def.paxMin + Math.floor(Math.random() * (def.paxMax - def.paxMin)),
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
    this.spawnCool = 18
    this.pushNews(
      `${def.name} ${f.flightNo} inbound from ${pick(CITIES)}.` +
        (busy ? ' Holding — pavement or a stand is busy.' : ''),
      busy ? 'ok' : 'ok',
    )
    this.selectedFlight = this.selectedFlight ?? f.id
  }

  releaseHold() {
    if (this.groundBusy()) return
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

    const bagBuild = tilesOf(this.tiles, 'bags')
    const snackBuild = tilesOf(this.tiles, 'snack')
    const farms = tilesOf(this.tiles, 'fuel').filter((p) =>
      farmBesidePavement(this.tiles, p),
    )
    const fit = this.roomsAt(f.stand)

    const bagPath =
      bagBuild.length > 0 ? nearestPath(this.tiles, f.stand, bagBuild, 'truck') : null
    if (bagPath) {
      f.waitingOn.bags = true
      this.spawnTruck('bags', f, bagPath)
    }

    const canFuel =
      Boolean(this.fuelBrand) &&
      this.fuelLoads > 0 &&
      farms.length > 0 &&
      nearestPath(this.tiles, farms[0], [f.stand], 'truck')
    if (canFuel && farms.length) {
      const p = nearestPath(this.tiles, farms[0], [f.stand], 'truck')
      if (p) {
        f.waitingOn.fuel = true
        this.spawnTruck('fuel', f, p)
      }
    }

    const snackPath =
      snackBuild.length > 0 ? nearestPath(this.tiles, snackBuild[0], [f.stand], 'truck') : null
    if (snackPath) {
      f.waitingOn.catering = true
      this.spawnTruck('catering', f, snackPath)
    }

    const visual = Math.max(6, Math.round(f.pax / 10))
    f.waitingOn.paxOut = visual
    const hall = tilesOf(this.tiles, 'terminal')
    const bagGoal = bagBuild[0]
    const snackGoal = snackBuild[0]
    const claim = fit && fit.rooms.bagclaim > 0 ? hall[0] : null
    const foodHall = fit && fit.rooms.food > 0 ? hall[0] : null
    const gift = fit && fit.rooms.souvenir > 0 ? hall[0] : null

    for (let i = 0; i < visual; i++) {
      const wantBag = Math.random() < 0.75 && Boolean(bagGoal || claim)
      const wantFood = Math.random() < 0.55
      const wantGift = Math.random() < 0.35
      const stages: Vec[] = []
      if (wantBag && bagGoal) stages.push(bagGoal)
      else if (wantBag && claim) stages.push(claim)
      if (wantFood && snackGoal) stages.push(snackGoal)
      else if (wantFood && foodHall) stages.push(foodHall)
      if (wantGift && gift) stages.push(gift)
      if (!stages.length && hall[0]) stages.push(hall[0])
      const path = stages.length
        ? astar(this.tiles, f.stand, stages[0], 'person') ?? [f.stand]
        : [f.stand]
      this.people.push({
        id: uid('p'),
        flightId: f.id,
        x: f.stand.c + (Math.random() - 0.5) * 0.4,
        y: f.stand.r + (Math.random() - 0.5) * 0.4,
        path,
        seg: 0,
        t: 0,
        color: pick(['#d9c7a3', '#c4a574', '#8b6b4a', '#f0d9b5', '#6a4a32']),
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

  spawnTruck(kind: Truck['kind'], f: Flight, path: Vec[]) {
    const start = path[0]
    this.trucks.push({
      id: uid('trk'),
      kind,
      flightId: f.id,
      x: start.c,
      y: start.r,
      path,
      seg: 0,
      t: 0,
      returning: false,
      dwell: 0,
    })
  }

  finishTruck(t: Truck) {
    const f = this.flights.find((x) => x.id === t.flightId)
    if (!f) return
    const airline = AIRLINES[f.airline]
    if (t.kind === 'bags' && !f.posted.bags) {
      f.posted.bags = true
      f.waitingOn.bags = false
      this.earn(airline.bags, `${f.flightNo} bag handling`, f)
      const fit = this.roomsAt(f.stand)
      if (fit && fit.rooms.bagdrop > 0 && tilesOf(this.tiles, 'bags').length && !f.posted.bagDrop) {
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
    if (t.kind === 'catering' && !f.posted.catering) {
      f.posted.catering = true
      f.waitingOn.catering = false
      this.earn(airline.catering, `${f.flightNo} catering`, f)
      this.mealSold = true
    }
    this.maybeUnlockHarbor()
  }

  maybeUnlockHarbor() {
    if (this.harborUnlocked) return
    if (this.mealSold && tilesOf(this.tiles, 'stand').length >= 2) {
      this.harborUnlocked = true
      this.pushNews('Harbor Air noticed the meal service and the extra stand. They will request slots.', 'good')
    }
  }

  beginBoarding(f: Flight) {
    if (!f.stand) return
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
        color: pick(['#3a5a7a', '#5c4033', '#2d4739', '#7a4e2d']),
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

  tick(dt: number) {
    if (this.speed === 0) return
    const step = dt * this.speed
    this.clock += step
    this.spawnCool = Math.max(0, this.spawnCool - step)
    this.saveTimer += step
    if (this.saveTimer > 8) {
      this.saveTimer = 0
      this.persist()
    }
    for (const n of this.news) n.age += step

    this.trySpawn()
    this.releaseHold()

    for (const f of this.flights) {
      if (f.phase === 'gone') continue
      f.phaseTime += step
      if (f.phase === 'hold') {
        f.holdAngle += step * 0.35
        f.x = SIZE / 2 + Math.cos(f.holdAngle) * 7
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
        const arrived = this.followPath(f, 1.1, step)
        if (arrived) {
          f.phase = 'deboard'
          f.phaseTime = 0
          this.beginServicing(f)
        }
      } else if (f.phase === 'deboard') {
        if (f.phaseTime > 6 && f.waitingOn.paxOut <= 2) {
          f.phase = 'servicing'
          f.phaseTime = 0
        }
        if (f.phaseTime > 14) {
          f.phase = 'servicing'
          f.phaseTime = 0
        }
      } else if (f.phase === 'servicing') {
        const waiting =
          (f.waitingOn.bags && !f.posted.bags) ||
          (f.waitingOn.fuel && !f.posted.fuel) ||
          (f.waitingOn.catering && !f.posted.catering)
        if ((!waiting && f.phaseTime > 4) || f.phaseTime > 22) {
          if (f.waitingOn.bags && !f.posted.bags) f.waitingOn.bags = false
          if (f.waitingOn.fuel && !f.posted.fuel) f.waitingOn.fuel = false
          if (f.waitingOn.catering && !f.posted.catering) f.waitingOn.catering = false
          f.phase = 'board'
          f.phaseTime = 0
          this.beginBoarding(f)
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
        const arrived = this.followPath(f, 1.2, step)
        if (arrived) {
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
          this.pushNews(`${f.flightNo} airborne. Turnaround in the book.`, 'ok')
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
      if (done && !t.returning) {
        t.dwell = t.kind === 'fuel' ? 3.2 : 2.2
      } else if (done && t.returning) {
        t.dwell = -99
      }
    }
    this.trucks = this.trucks.filter((t) => t.dwell !== -99)

    for (const p of this.people) {
      if (p.t < 0) {
        p.t += step
        continue
      }
      const done = this.followPath(p, 1.25, step)
      if (!done) continue
      const f = this.flights.find((x) => x.id === p.flightId)
      if (p.job === 'board') {
        p.stage = 99
        if (f) f.waitingOn.paxIn = Math.max(0, f.waitingOn.paxIn - 1)
        continue
      }
      const tileHere = inBounds(Math.round(p.x), Math.round(p.y))
        ? this.tiles[Math.round(p.y)][Math.round(p.x)]
        : 'grass'
      if (tileHere === 'bags' && p.wantBag) p.wantBag = false
      if ((tileHere === 'snack' || tileHere === 'terminal') && p.wantFood && !p.paidFood) {
        p.paidFood = true
        p.wantFood = false
        this.cash += 14
        this.revenue += 14
        this.mealSold = true
        this.maybeUnlockHarbor()
      }
      if (tileHere === 'terminal' && p.wantGift && !p.paidGift) {
        const fit = this.roomsAt(f?.stand ?? null)
        if (fit && fit.rooms.souvenir > 0) {
          p.paidGift = true
          p.wantGift = false
          this.cash += 22
          this.revenue += 22
        } else {
          p.wantGift = false
        }
      }
      if (tileHere === 'terminal' && f) f.waitingOn.paxOut = Math.max(0, f.waitingOn.paxOut - 1)
      if (tileHere === 'snack' || tileHere === 'bags') {
        /* walk onward to terminal or vanish */
        const hall = tilesOf(this.tiles, 'terminal')
        if (hall.length && p.stage < 4) {
          const np = astar(
            this.tiles,
            { c: Math.round(p.x), r: Math.round(p.y) },
            hall[0],
            'person',
          )
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

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
