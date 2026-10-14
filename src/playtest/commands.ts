/**
 * Player command API. Every method delegates to the Game call the HUD already uses.
 * Bot modules import this file and nothing from the renderer.
 */
import { MIN_RUNWAY, RESEARCH_NODES, STARTER_KIT_COST, FIELD_TASK_FAIL_FINE, DESK_STAFF_HIRE } from '../game/catalog.ts'
import { runwayStrips, tilesOf } from '../game/path.ts'
import { Game } from '../game/sim.ts'
import { ALERT_TUNING, STUCK_PHASES } from '../game/alertsData.ts'
import type { Difficulty, RoomId, SiteKind, Speed, StartFocus, Tool, Vec } from '../game/types.ts'
import { SIZE } from '../game/types.ts'
import { OPS_RP_PER_SEC } from '../research/config.ts'
import { nodeCost, nodeState, roomRate as treeRoomRate } from '../research/logic.ts'
import { RESEARCH_NODES as TREE_NODES, nodeById } from '../research/nodes.ts'
import { queueAtNode } from '../terminalplay/queues.ts'
import { OPS_TRICKLE_PER_SEC } from '../wave3/config.ts'
import { roomRate as wave3RoomRate, techNode } from '../wave3/research.ts'
import type { AirportView, CommandResult, PlayerCommands, Probe, ResearchPools, SystemsBooks } from './types.ts'

const LANDED = new Set([
  'landing',
  'taxi_in',
  'deboard',
  'servicing',
  'board',
  'pushback',
  'taxi_out',
  'takeoff',
  'parked',
  'gone',
  'mx_taxi',
  'mx_bay',
  'mx_return',
])

const GRASS = new Set(['grass'])

function result(ok: boolean, command: string, detail: string): CommandResult {
  return { ok, command, detail }
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export function createPlayer(): PlayerCommands {
  return new GamePlayer()
}

class GamePlayer implements PlayerCommands {
  private readonly game = new Game()

  setSandbox(on: boolean): CommandResult {
    this.game.sandbox = on
    return result(true, 'setSandbox', on ? 'sandbox on' : 'sandbox off')
  }

  beginNew(difficulty: Difficulty): CommandResult {
    this.game.beginNew(difficulty)
    return result(true, 'beginNew', difficulty)
  }

  setFocus(focus: StartFocus): CommandResult {
    this.game.startFocus = focus
    return result(true, 'setFocus', focus)
  }

  buyLand(kind: SiteKind): CommandResult {
    const ok = this.game.buyLand(kind)
    return result(ok, 'buyLand', ok ? kind : this.latest('buy land failed'))
  }

  buildStarterKit(): CommandResult {
    const before = this.game.starterKitStamped
    this.game.buildStarterKit()
    const ok = this.game.starterKitStamped && !before
    return result(ok, 'buildStarterKit', ok ? 'starter kit stamped' : this.latest('starter kit did not stamp'))
  }

  chooseFreehand(): CommandResult {
    this.game.chooseFreehand()
    return result(true, 'chooseFreehand', this.latest('building freehand'))
  }

  setSpeed(speed: Speed): CommandResult {
    this.game.setSpeed(speed)
    return result(this.game.speed === speed, 'setSpeed', `${speed}x`)
  }

  setTool(tool: Tool): CommandResult {
    this.game.setTool(tool)
    return result(this.game.tool === tool, 'setTool', tool)
  }

  setView(view: 'apron' | 'hall'): CommandResult {
    this.game.setView(view)
    const ok = this.game.view === view
    return result(ok, 'setView', ok ? view : this.latest(`stayed on ${this.game.view}`))
  }

  preview(tool: Tool, cell: Vec): string | null {
    this.game.setTool(tool)
    this.game.setHover(cell)
    return this.game.placementGhostReason()
  }

  clickTile(cell: Vec): CommandResult {
    const before = this.mark()
    const newsId = this.game.news[0]?.id
    this.game.clickTile(cell)
    if (this.mark() !== before) {
      return result(true, 'clickTile', `${this.game.tool} @ ${cell.c},${cell.r}`)
    }
    const news = this.game.news[0]
    if (news && news.id !== newsId) {
      return result(news.tone !== 'bad', 'clickTile', news.text)
    }
    return result(false, 'clickTile', `${this.game.tool} @ ${cell.c},${cell.r} did nothing`)
  }

  candidates(): Vec[] {
    const near: Vec[] = []
    const far: Vec[] = []
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (this.game.tiles[r]?.[c] !== 'grass') continue
        const cell = { c, r }
        if (this.besideBuilt(cell)) near.push(cell)
        else far.push(cell)
      }
    }
    return near.length ? near : far
  }

  buyRoom(id: RoomId): CommandResult {
    if (this.game.view !== 'hall' || !this.game.selectedTerminalOrigin()) {
      const selected = this.selectTerminal()
      if (!selected.ok) return selected
    }
    const before = this.roomCount(id)
    this.game.buyRoom(id)
    const after = this.roomCount(id)
    if (after > before) return result(true, 'buyRoom', id)
    return result(false, 'buyRoom', this.latest(`could not furnish ${id}`))
  }

  acceptContract(): CommandResult {
    if (!this.game.offer) return result(false, 'acceptContract', 'no contract letter')
    const name = this.game.airline(this.game.offer.airline).name
    const signed = this.game.signed.length
    this.game.acceptNegotiation()
    const ok = this.game.signed.length > signed
    return result(ok, 'acceptContract', ok ? `signed ${name}` : this.latest(`${name} did not sign`))
  }

  snoozeContract(): CommandResult {
    if (!this.game.offer) return result(false, 'snoozeContract', 'no contract letter')
    const name = this.game.airline(this.game.offer.airline).name
    this.game.snoozeOffer()
    return result(this.game.offer == null, 'snoozeContract', name)
  }

  walkContract(): CommandResult {
    if (!this.game.offer) return result(false, 'walkContract', 'no contract letter')
    const name = this.game.airline(this.game.offer.airline).name
    this.game.walkNegotiation()
    return result(this.game.offer == null, 'walkContract', name)
  }

  takeLoan(productId: string): CommandResult {
    const before = this.game.loanBalance
    this.game.takeLoanProduct(productId)
    const ok = this.game.loanBalance > before
    return result(ok, 'takeLoan', ok ? productId : this.latest('loan refused'))
  }

  buyParcel(): CommandResult {
    const before = this.game.parcels
    const ok = this.game.buyParcel()
    return result(ok, 'buyParcel', ok ? `${before} → ${this.game.parcels}` : this.latest('no parcel'))
  }

  hireJanitor(): CommandResult {
    const before = this.game.janitors
    this.game.hireJanitor()
    const ok = this.game.janitors > before
    return result(ok, 'hireJanitor', ok ? `#${this.game.janitors}` : this.latest('janitor not hired'))
  }

  hireMechanic(): CommandResult {
    const before = this.game.mechanics
    this.game.hireMechanic()
    const ok = this.game.mechanics > before
    return result(ok, 'hireMechanic', ok ? `#${this.game.mechanics}` : this.latest('mechanic not hired'))
  }

  buyResearch(id: string): CommandResult {
    const node = RESEARCH_NODES.find((n) => n.id === id)
    if (!node) return result(false, 'buyResearch', `unknown ${id}`)
    const before = this.game.researchUnlocked.length
    this.game.buyResearch(node.id)
    const ok = this.game.researchUnlocked.length > before
    return result(ok, 'buyResearch', ok ? node.name : this.latest(this.game.canBuyResearch(node.id).why))
  }

  buyTree(id: string): CommandResult {
    const node = nodeById(id)
    if (!node) return result(false, 'buyTree', `unknown ${id}`)
    const before = this.game.researchTree.state.unlocked.length
    const ok = this.game.buyResearchNode(id)
    const after = this.game.researchTree.state.unlocked.length
    return result(ok && after > before, 'buyTree', ok ? node.name : this.latest('research tree refused'))
  }

  hireDesk(): CommandResult {
    const before = this.game.deskStaff
    this.game.hireDeskStaff()
    const ok = this.game.deskStaff > before
    return result(ok, 'hireDesk', ok ? `#${this.game.deskStaff}` : this.latest('desk agent not hired'))
  }

  relieveCurb(): CommandResult {
    const roads = tilesOf(this.game.tiles, 'road')
    if (!roads.length) return result(false, 'relieveCurb', 'no public road')
    const steps: { tool: Tool; have: number; label: string }[] = [
      { tool: 'bus', have: tilesOf(this.game.tiles, 'bus').length, label: 'bus bay' },
      { tool: 'taxi_rank', have: tilesOf(this.game.tiles, 'taxi_rank').length, label: 'taxi rank' },
      { tool: 'curb_lane', have: tilesOf(this.game.tiles, 'curb_lane').length, label: 'curb lane' },
    ]
    for (const step of steps) {
      if (step.have > 0) continue
      if (this.game.sites.some((site) => site.tool === step.tool)) {
        return result(true, 'relieveCurb', `${step.label} already under construction`)
      }
      const placed = this.stampBeside(roads, step.tool)
      if (placed) return placed
      return result(false, 'relieveCurb', `no grass on the road edge for a ${step.label}`)
    }
    return result(true, 'relieveCurb', 'curb already has a bay, a rank, and a lane')
  }

  acceptBestShopBid(): CommandResult {
    const board = this.game.tycoonView()
    let best: { unitId: string; bidId: string; rent: number; brand: string } | null = null
    for (const unit of board.units) {
      if (unit.lease) continue
      for (const bid of unit.bids) {
        if (!best || bid.dailyRent > best.rent) {
          best = { unitId: unit.id, bidId: bid.id, rent: bid.dailyRent, brand: bid.brand }
        }
      }
    }
    if (!best) return result(false, 'acceptShopBid', 'no open shop bid')
    this.game.acceptTenantBid(best.unitId, best.bidId)
    const leased = this.game.tycoonView().units.some((unit) => unit.id === best.unitId && unit.lease)
    return result(leased, 'acceptShopBid', leased ? best.brand : this.latest('bid not accepted'))
  }

  books(): SystemsBooks {
    const game = this.game
    const ledger = game.bank.ledger()
    const sinks = Object.entries(ledger.byCategory)
      .filter(([, amount]) => amount !== 0 && Number.isFinite(amount))
      .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
      .sort((a, b) => a.amount - b.amount)
    const fieldAskFines = ledger.entries.filter(
      (entry) => entry.category === 'penalties' && entry.amount === -FIELD_TASK_FAIL_FINE,
    ).length
    const penaltyTotal = Math.round(ledger.byCategory.penalties ?? 0)
    const ids = new Set<string>(game.signed)
    for (const id of Object.keys(game.wave3.state.relations.rows)) ids.add(id)
    const relations = [...ids]
      .map((id) => {
        const row = game.wave3.relation(id)
        return {
          id,
          name: game.airline(id).name,
          score: Math.round(row.score * 10) / 10,
          band: row.band,
          tier: row.tier,
          label: row.label,
        }
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    const curb = game.landsideView()
    return {
      sinks,
      fieldAskFines,
      penaltyTotal,
      relations,
      treePoints: game.researchTree.points(),
      treeUnlocked: game.researchTree.state.unlocked.slice(),
      wave3Points: game.wave3.points(),
      deskStaff: game.deskStaff,
      checkinStaffed: game.staffedPost('checkin'),
      securityStaffed: game.staffedPost('security'),
      checkinWaiting: queueAtNode(game.hallGuests, 'checkin'),
      securityWaiting: game.securityQueueCount(),
      checkinLines: game.servicePointLines('checkin'),
      securityLines: game.servicePointLines('security'),
      curbPressure: finite(curb.pressure),
      curbQueue: finite(curb.queue),
      curbDelaySec: finite(curb.delaySec),
      lanes: curb.lanes,
      busBays: curb.busBays,
      curbLanes: curb.curbLanes,
      taxiRanks: curb.taxiRanks,
    }
  }

  researchPools(): ResearchPools {
    const game = this.game
    const gear = game.labGear()
    const rooms = { desk: gear.desks, board: gear.boards, machine: gear.machines }
    const deskUnlocked = game.researchUnlocked.map((id) => {
      const node = RESEARCH_NODES.find((row) => row.id === id)
      return { id, name: node?.name ?? id, cost: node?.cost ?? 0 }
    })
    const wave3Unlocked = game.wave3.state.research.unlocked.map((id) => {
      const node = techNode(id)
      return { id, name: node?.name ?? id, cost: node?.cost ?? 0 }
    })
    const treeUnlocked = game.researchTree.state.unlocked.map((id) => {
      const node = nodeById(id)
      const cost = node ? nodeCost(game.researchTree.state, node) : 0
      return { id, name: node?.name ?? id, cost }
    })
    const spent = (rows: { cost: number }[]) => rows.reduce((sum, row) => sum + row.cost, 0)
    const deskCarry = 0
    const wave3Carry = game.wave3.state.research.carry
    const treeCarry = game.researchTree.state.carry
    return {
      deskPoints: round2(game.researchPoints),
      deskCarry,
      deskEarned: round2(game.researchPoints + spent(deskUnlocked)),
      wave3Points: game.wave3.points(),
      wave3Carry: round2(wave3Carry),
      wave3Earned: round2(game.wave3.points() + wave3Carry + spent(wave3Unlocked)),
      treePoints: game.researchTree.points(),
      treeCarry: round2(treeCarry),
      treeEarned: round2(game.researchTree.points() + treeCarry + spent(treeUnlocked)),
      researchers: game.researchers,
      desks: gear.desks,
      boards: gear.boards,
      machines: gear.machines,
      deskLabRate: round2(game.labResearchRate()),
      deskOpsRate: round2(game.opsResearchRate()),
      wave3RoomRate: round2(wave3RoomRate(rooms)),
      wave3OpsRate: OPS_TRICKLE_PER_SEC,
      treeRoomRate: round2(treeRoomRate(rooms)),
      treeOpsRate: game.site != null ? OPS_RP_PER_SEC : 0,
      deskUnlocked,
      wave3Unlocked,
      treeUnlocked,
    }
  }

  dismissYearReport(): CommandResult {
    if (!this.game.pendingYearReport()) return result(false, 'dismissYearReport', 'no year report')
    this.game.dismissYearReport()
    return result(true, 'dismissYearReport', 'closed')
  }

  tick(dt: number): void {
    this.game.tick(dt)
  }

  view(): AirportView {
    const game = this.game
    const rooms: Partial<Record<RoomId, number>> = {}
    for (const fit of game.fits) {
      for (const [id, count] of Object.entries(fit.rooms)) {
        const key = id as RoomId
        rooms[key] = (rooms[key] ?? 0) + count
      }
    }
    const guests = game.hallGuests.filter((guest) => !guest.preview)
    const happiness = guests.length
      ? guests.reduce((sum, guest) => sum + guest.happiness, 0) / guests.length
      : null
    const shops = this.game.tycoonView()
    const leasedShops = shops.units.filter((unit) => unit.lease).length
    const openShopBids = shops.units.reduce((sum, unit) => sum + (unit.lease ? 0 : unit.bids.length), 0)
    let nextResearch: { id: string; name: string } | null = null
    for (const node of RESEARCH_NODES) {
      if (game.canBuyResearch(node.id).ok) {
        nextResearch = { id: node.id, name: node.name }
        break
      }
    }
    let nextTree: AirportView['nextTree'] = null
    for (const node of TREE_NODES) {
      if (nodeState(game.researchTree.state, node, game.fieldLevel()) !== 'available') continue
      const cost = nodeCost(game.researchTree.state, node)
      if (game.researchTree.points() < cost) continue
      if (!nextTree || cost < nextTree.cost || (cost === nextTree.cost && node.id < nextTree.id)) {
        nextTree = { id: node.id, name: node.name, cost }
      }
    }
    const curb = game.landsideView()
    const offer = game.offer
      ? {
          name: game.airline(game.offer.airline).name,
          met: game.letterVerdict(game.offer.airline).met,
          missing: game.letterVerdict(game.offer.airline).missing,
          deadline: game.offer.deadline,
        }
      : null
    return {
      day: game.gameDay(),
      clock: game.clock,
      cash: game.cash,
      speed: game.speed,
      hasLand: game.site != null,
      kitAvailable: game.showStarterKit(),
      kitCost: STARTER_KIT_COST,
      runway: runwayStrips(game.tiles, MIN_RUNWAY).length,
      stands: tilesOf(game.tiles, 'stand').length,
      terminals: tilesOf(game.tiles, 'terminal').length,
      snacks: tilesOf(game.tiles, 'snack').length,
      rooms,
      shopUnits: (rooms.food ?? 0) + (rooms.souvenir ?? 0) + tilesOf(game.tiles, 'snack').length,
      leasedShops,
      openShopBids,
      signed: game.signed.slice(),
      offer,
      loanBalance: game.loanBalance,
      loans: game.availableLoans().map((loan) => ({
        id: loan.id,
        label: loan.label,
        principal: loan.principal,
      })),
      fieldLevel: game.fieldLevel(),
      fieldRating: game.fieldRating(),
      satisfaction: happiness,
      guestCount: guests.length,
      janitors: game.janitors,
      mechanics: game.mechanics,
      researchPoints: game.researchPoints,
      wave3Points: game.wave3.points(),
      nextResearch,
      treePoints: game.researchTree.points(),
      treeUnlocked: game.researchTree.state.unlocked.slice(),
      nextTree,
      deskStaff: game.deskStaff,
      checkinStaffed: game.staffedPost('checkin'),
      securityStaffed: game.staffedPost('security'),
      deskHireCost: game.staffHireCost(DESK_STAFF_HIRE),
      checkinWaiting: queueAtNode(game.hallGuests, 'checkin'),
      securityWaiting: game.securityQueueCount(),
      curbPressure: finite(curb.pressure),
      curbQueue: finite(curb.queue),
      curbDelaySec: finite(curb.delaySec),
      lanes: curb.lanes,
      busBays: curb.busBays,
      curbLanes: curb.curbLanes,
      taxiRanks: curb.taxiRanks,
      yearReportPending: game.pendingYearReport() != null,
      flightsDone: game.flightsDone,
      activeFlights: game.flights.length,
    }
  }

  probe(): Probe {
    const game = this.game
    const guests = game.hallGuests.filter((guest) => !guest.preview)
    const happiness = guests.length
      ? guests.reduce((sum, guest) => sum + guest.happiness, 0) / guests.length
      : null
    let landed: Probe['landed'] = null
    const stuck: Probe['stuck'] = []
    const stuckFlight = new Set<string>()
    for (const flight of game.flights) {
      if (!landed && LANDED.has(flight.phase)) {
        landed = { id: flight.id, flightNo: flight.flightNo, phase: flight.phase }
      }
      const jet = (flight.craft ?? 'jet') === 'jet'
      const ground =
        jet &&
        (STUCK_PHASES as readonly string[]).includes(flight.phase) &&
        flight.phaseTime > ALERT_TUNING.stuckSec
      const hold = flight.phase === 'hold' && flight.phaseTime > ALERT_TUNING.holdStuckSec
      if (ground || hold) {
        stuckFlight.add(flight.id)
        stuck.push({
          id: `flight:${flight.id}`,
          detail: `${flight.flightNo} ${flight.phase} for ${Math.round(flight.phaseTime)}s`,
        })
      }
    }
    for (const alert of game.alerts.active) {
      if (!alert.key.startsWith('cond:stuck:')) continue
      const id = alert.key.slice('cond:stuck:'.length)
      if (stuckFlight.has(id)) continue
      stuck.push({ id: alert.key, detail: alert.title })
    }
    for (const guest of guests) {
      if (!guest.thought.toLowerCase().includes('stuck')) continue
      stuck.push({ id: `guest:${guest.id}`, detail: guest.thought })
    }
    return {
      clock: game.clock,
      day: game.gameDay(),
      cash: game.cash,
      speed: game.speed,
      hasLand: game.site != null,
      flightsDone: game.flightsDone,
      activeFlights: game.flights.length,
      fieldRating: game.fieldRating(),
      guestCount: guests.length,
      guestHappiness: happiness,
      landed,
      stuck,
      recoveries: game.recoveryLog.slice(0, 12).map((entry) => ({
        id: entry.id,
        step: entry.reason,
      })),
      teleports: game.recoveryTeleports,
    }
  }

  /** A curb stamp sits on any grass cell that touches the public road. */
  private stampBeside(anchors: Vec[], tool: Tool): CommandResult | null {
    const ranked = [...anchors].sort((a, b) => this.sideRoads(a) - this.sideRoads(b) || a.r - b.r || a.c - b.c)
    for (const anchor of ranked) {
      const around = [
        { c: anchor.c + 1, r: anchor.r },
        { c: anchor.c - 1, r: anchor.r },
        { c: anchor.c, r: anchor.r + 1 },
        { c: anchor.c, r: anchor.r - 1 },
      ]
      for (const cell of around) {
        if (this.game.tile(cell) !== 'grass') continue
        if (this.game.sites.some((site) => site.cells.some((at) => at.c === cell.c && at.r === cell.r))) continue
        const ghost = this.preview(tool, cell)
        if (ghost) continue
        const clicked = this.clickTile(cell)
        if (clicked.ok) return result(true, 'relieveCurb', `${tool} @ ${cell.c},${cell.r}`)
      }
    }
    return null
  }

  private sideRoads(cell: Vec): number {
    const around = [
      { c: cell.c + 1, r: cell.r },
      { c: cell.c - 1, r: cell.r },
      { c: cell.c, r: cell.r + 1 },
      { c: cell.c, r: cell.r - 1 },
    ]
    return around.filter((next) => this.game.tile(next) === 'road').length
  }

  private selectTerminal(): CommandResult {
    const terminals = tilesOf(this.game.tiles, 'terminal')
    if (!terminals.length) return result(false, 'selectTerminal', 'no terminal on the field')
    this.game.setView('apron')
    this.game.setTool('pan')
    this.game.clickTile(terminals[0]!)
    if (this.game.view === 'hall' && this.game.selectedTerminalOrigin()) {
      return result(true, 'selectTerminal', `${terminals[0]!.c},${terminals[0]!.r}`)
    }
    return result(false, 'selectTerminal', this.latest('terminal click did not open the hall'))
  }

  private roomCount(id: RoomId): number {
    return this.game.fits.reduce((sum, fit) => sum + (fit.rooms[id] ?? 0), 0)
  }

  private besideBuilt(cell: Vec): boolean {
    const around = [
      { c: cell.c + 1, r: cell.r },
      { c: cell.c - 1, r: cell.r },
      { c: cell.c, r: cell.r + 1 },
      { c: cell.c, r: cell.r - 1 },
    ]
    return around.some((next) => {
      const tile = this.game.tile(next)
      return tile != null && !GRASS.has(tile)
    })
  }

  private latest(fallback: string): string {
    return this.game.news[0]?.text ?? fallback
  }

  private mark(): string {
    const game = this.game
    const rooms = game.fits.reduce(
      (sum, fit) => sum + Object.values(fit.rooms).reduce((inner, count) => inner + count, 0),
      0,
    )
    const tile = game.selectedTile
    return [
      game.cash,
      game.mapRev,
      game.sites.length,
      game.signed.join(','),
      game.loanBalance,
      game.view,
      rooms,
      game.janitors,
      game.mechanics,
      game.speed,
      game.offer?.airline ?? '',
      tile ? `${tile.c},${tile.r}` : '',
      game.researchUnlocked.length,
      game.starterKitStamped ? 1 : 0,
      game.site ?? '',
      game.parcels,
    ].join('|')
  }
}
