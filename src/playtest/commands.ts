/**
 * Player command API. Every method delegates to the Game call the HUD already uses.
 * Bot modules import this file and nothing from the renderer.
 */
import type { MoneyCategory } from '../core/bank.ts'
import {
  MIN_RUNWAY,
  RESEARCH_NODES,
  STARTER_KIT_COST,
  FIELD_TASK_FAIL_FINE,
  DESK_STAFF_HIRE,
  HELIPAD_COST,
  RESEARCHER_HIRE,
  RUNWAY_PREFAB_COST,
  STAND_COST,
  DEPOT_COST,
} from '../game/catalog.ts'
import { UNLOCK_LEVEL } from '../progression/unlocks.ts'
import { runwayStrips, tilesOf } from '../game/path.ts'
import { Game } from '../game/sim.ts'
import { ALERT_TUNING, STUCK_PHASES } from '../game/alertsData.ts'
import type { Difficulty, RoomId, SiteKind, Speed, StartFocus, Tool, Vec } from '../game/types.ts'
import { SIZE } from '../game/types.ts'
import { OPS_RP_PER_SEC } from '../research/config.ts'
import { nodeCost, nodeState, roomRate as treeRoomRate } from '../research/logic.ts'
import { RESEARCH_NODES as TREE_NODES, nodeById } from '../research/nodes.ts'
import { FUEL_CONTRACTS } from '../scale/data.ts'
import { queueAtNode } from '../terminalplay/queues.ts'
import { techNode } from '../wave3/research.ts'
import type {
  AirportView,
  CommandResult,
  FieldPulse,
  LedgerOps,
  PlayerCommands,
  Probe,
  ResearchPools,
  SystemsBooks,
} from './types.ts'

const FINE_CATEGORIES = [
  'penalties',
  'security_shock',
  'task_miss',
  'emergency_refuse',
  'inbound_fine',
  'missed_connection',
  'cargo_miss',
  'crash_fine',
] as const satisfies readonly MoneyCategory[]

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

/** Occupied bays plus aircraft holding without a stand, over the stand count. */
function standPressure(game: Game): number {
  const stands = game.bayView().stands
  if (!stands.length) return 0
  const occupied = stands.filter((stand) => stand.occupied).length
  const holding = game.flights.filter((flight) => flight.phase === 'hold' && !flight.stand).length
  return (occupied + holding) / stands.length
}

function fieldAskView(game: Game): AirportView['fieldAsk'] {
  const task = game.fieldTask
  const offer = game.fieldAskOffer()
  if (!task || !offer) return null
  return {
    kind: task.kind,
    title: task.title,
    cost: offer.cost,
    bonus: offer.bonus,
    secondsLeft: Math.max(0, Math.ceil(game.fieldTaskLeft())),
    canBuild: offer.enabled,
  }
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

  signFuelTerm(): CommandResult {
    const before = this.game.contractId
    this.game.signScaleContract('apex_local')
    const ok = this.game.contractId === 'apex_local' && before !== 'apex_local'
    return result(ok, 'signFuelTerm', ok ? 'Apex Local' : this.latest('fuel term did not sign'))
  }

  acceptSpot(): CommandResult {
    if (!this.game.spotOffer) return result(false, 'acceptSpot', 'no spot card')
    const flight = this.game.spotOffer.flightNo
    const before = this.game.spotInbound
    this.game.acceptSpot()
    const ok = this.game.spotInbound != null && before == null
    return result(ok, 'acceptSpot', ok ? flight : this.latest('spot tanker did not order'))
  }

  hireResearcher(): CommandResult {
    const before = this.game.researchers
    this.game.hireResearcher()
    const ok = this.game.researchers > before
    return result(ok, 'hireResearcher', ok ? `#${this.game.researchers}` : this.latest('researcher not hired'))
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

  connectRunway(): CommandResult {
    const site = this.game.sites.find((row) => row.kind === 'runway')
    if (!site) return result(false, 'connectRunway', 'no runway site')
    const siteKeys = new Set(site.cells.map((cell) => `${cell.c},${cell.r}`))
    const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < SIZE && r < SIZE
    const tileAt = (c: number, r: number) => this.game.tiles[r][c]
    const pavement = (c: number, r: number) => {
      if (!inside(c, r) || siteKeys.has(`${c},${r}`)) return false
      const tile = tileAt(c, r)
      return tile === 'taxi' || tile === 'stand' || tile === 'runway' || tile === 'hangar'
    }
    const neigh = (c: number, r: number) =>
      [
        { c: c + 1, r },
        { c: c - 1, r },
        { c, r: r + 1 },
        { c, r: r - 1 },
      ].filter((cell) => inside(cell.c, cell.r))
    if (site.cells.some((cell) => neigh(cell.c, cell.r).some((next) => pavement(next.c, next.r)))) {
      return result(true, 'connectRunway', 'already linked')
    }
    const prev = new Map<string, string | null>()
    const queue: Vec[] = []
    for (const cell of site.cells) {
      for (const next of neigh(cell.c, cell.r)) {
        const key = `${next.c},${next.r}`
        if (prev.has(key) || siteKeys.has(key) || tileAt(next.c, next.r) !== 'grass') continue
        prev.set(key, null)
        queue.push(next)
      }
    }
    let goal: Vec | null = null
    while (queue.length) {
      const cur = queue.shift()
      if (!cur) break
      const key = `${cur.c},${cur.r}`
      let depth = 0
      let walk: string | null = key
      while (walk) {
        depth += 1
        walk = prev.get(walk) ?? null
      }
      if (neigh(cur.c, cur.r).some((next) => pavement(next.c, next.r))) {
        goal = cur
        break
      }
      if (depth >= 20) continue
      for (const next of neigh(cur.c, cur.r)) {
        const nextKey = `${next.c},${next.r}`
        if (prev.has(nextKey) || siteKeys.has(nextKey) || tileAt(next.c, next.r) !== 'grass') continue
        prev.set(nextKey, key)
        queue.push(next)
      }
    }
    if (!goal) return result(false, 'connectRunway', 'no taxi link')
    const path: Vec[] = []
    let walk: string | null = `${goal.c},${goal.r}`
    while (walk) {
      const [c, r] = walk.split(',').map(Number)
      path.push({ c, r })
      walk = prev.get(walk) ?? null
    }
    path.reverse()
    this.game.setTool('taxi')
    let laid = 0
    for (const cell of path) {
      const clicked = this.clickTile(cell)
      if (!clicked.ok) return result(laid > 0, 'connectRunway', clicked.detail)
      laid += 1
    }
    return result(true, 'connectRunway', `taxi x${laid}`)
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

  buildFieldAsk(): CommandResult {
    const task = this.game.fieldTask
    if (!task) return result(false, 'buildFieldAsk', 'no field ask')
    const offer = this.game.fieldAskOffer()
    if (!offer?.enabled) return result(false, 'buildFieldAsk', 'cannot build that ask')
    const cash = this.game.cash
    const sites = this.game.sites.length
    const desk = this.game.deskStaff
    const janitors = this.game.janitors
    this.game.buildFieldTask()
    const progressed =
      this.game.cash < cash ||
      this.game.sites.length > sites ||
      this.game.deskStaff > desk ||
      this.game.janitors > janitors ||
      this.game.fieldTask?.id !== task.id ||
      this.game.fieldTaskMet(task.kind)
    return result(progressed, 'buildFieldAsk', progressed ? task.title : this.latest('did not build'))
  }

  declineFieldAsk(): CommandResult {
    const task = this.game.fieldTask
    if (!task) return result(false, 'declineFieldAsk', 'no field ask')
    this.game.declineFieldTask()
    return result(this.game.fieldTask == null, 'declineFieldAsk', task.title)
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
      (entry) => entry.category === 'task_miss' && !entry.meta.unpaid && entry.amount === -FIELD_TASK_FAIL_FINE,
    ).length
    const penaltyTotal = Math.round(
      FINE_CATEGORIES.reduce((sum, category) => sum + (ledger.byCategory[category] ?? 0), 0),
    )
    const penaltyBreakdown = { missedConnections: 0, delays: 0, refunds: 0, other: 0 }
    for (const entry of ledger.entries) {
      if (entry.meta.unpaid || !(entry.amount < 0)) continue
      if (!(FINE_CATEGORIES as readonly string[]).includes(entry.category)) continue
      const label = entry.meta.label ?? ''
      if (entry.category === 'missed_connection') penaltyBreakdown.missedConnections += entry.amount
      else if (entry.category === 'penalties' && /refund/i.test(label)) penaltyBreakdown.refunds += entry.amount
      else if (entry.category === 'penalties' && /delay|go-around/i.test(label)) penaltyBreakdown.delays += entry.amount
      else penaltyBreakdown.other += entry.amount
    }
    for (const key of Object.keys(penaltyBreakdown) as (keyof typeof penaltyBreakdown)[]) {
      penaltyBreakdown[key] = Math.round(penaltyBreakdown[key])
    }
    const sourceMap = new Map<string, { category: string; label: string; amount: number; count: number }>()
    for (const entry of ledger.entries) {
      if (entry.meta.unpaid || !(entry.amount < 0)) continue
      if (!(FINE_CATEGORIES as readonly string[]).includes(entry.category)) continue
      const label = entry.meta.label?.trim() || '(unlabeled)'
      const key = `${entry.category}\0${label}`
      const row = sourceMap.get(key) ?? { category: entry.category, label, amount: 0, count: 0 }
      row.amount += entry.amount
      row.count += 1
      sourceMap.set(key, row)
    }
    const penaltySources = [...sourceMap.values()]
      .map((row) => ({ ...row, amount: Math.round(row.amount) }))
      .sort((a, b) => a.amount - b.amount || a.category.localeCompare(b.category))
    const tally = game.connectionTally
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
          onTime: row.counts.onTime,
          delayed: row.counts.delay,
          kept: row.counts.kept,
          missed: row.counts.missed,
          fines: row.counts.fine,
          blocked: game.carrierBlockLine(id),
        }
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    const curb = game.landsideView()
    return {
      sinks,
      fieldAskFines,
      penaltyTotal,
      penaltyBreakdown,
      penaltySources,
      connections: {
        made: tally.made,
        belowMct: tally.belowMct,
        paxLate: tally.paxLate,
        bagLate: tally.bagLate,
        divert: tally.divert,
        judged: tally.judged,
        delayMin: Math.round(tally.delayMin),
        availableMin: Math.round(tally.availableMin),
        bagMin: Math.round(tally.bagMin),
      },
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
    const treeCarry = game.researchTree.state.carry
    return {
      deskPoints: round2(game.researchPoints),
      deskCarry,
      deskEarned: round2(game.researchPoints + spent(deskUnlocked)),
      wave3Points: 0,
      wave3Carry: 0,
      wave3Earned: 0,
      treePoints: game.researchTree.points(),
      treeCarry: round2(treeCarry),
      treeEarned: round2(game.researchTree.points() + treeCarry + spent(treeUnlocked)),
      researchers: game.researchers,
      desks: gear.desks,
      boards: gear.boards,
      machines: gear.machines,
      deskLabRate: round2(game.labResearchRate()),
      deskOpsRate: round2(game.opsResearchRate()),
      wave3RoomRate: 0,
      wave3OpsRate: 0,
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
          needsHelipad: game.carrierNeedsPad(game.offer.airline) && tilesOf(game.tiles, 'helipad').length < 1,
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
      runwayDeferred: game.runwayDeferred,
      runwayDeferredTotal: game.runwayDeferredTotal,
      runwayCost: RUNWAY_PREFAB_COST,
      runwayBuilding: game.sites.some((site) => site.kind === 'runway'),
      stands: tilesOf(game.tiles, 'stand').length,
      terminals: tilesOf(game.tiles, 'terminal').length,
      snacks: tilesOf(game.tiles, 'snack').length,
      helipads: tilesOf(game.tiles, 'helipad').length,
      helipadBuilding: game.sites.some((site) => site.tile === 'helipad' || site.tool === 'helipad'),
      helipadCost: HELIPAD_COST,
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
      prestigeStars: game.prestigeStars(),
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
      fuelTerm: game.contractId,
      fuelSignCost: FUEL_CONTRACTS.find((row) => row.id === 'apex_local')?.sign ?? 0,
      spotOffer: game.spotOffer
        ? {
            flightNo: game.spotOffer.flightNo,
            secondsLeft: Math.max(0, Math.ceil(game.spotOffer.expiresAt - game.clock)),
          }
        : null,
      runwayOver: game.runwayLoad().overbooked,
      standPressure: standPressure(game),
      standCost: STAND_COST,
      researcherCost: game.staffHireCost(RESEARCHER_HIRE),
      researchers: game.researchers,
      fieldAsk: fieldAskView(game),
      cartWaits: game.cartWaitCount(),
      depotCost: DEPOT_COST,
      depotBuilding: game.sites.some((site) => site.tool === 'depot'),
      depotOpen: game.fieldLevel() >= (UNLOCK_LEVEL.depot ?? 2),
    }
  }

  pulse(): FieldPulse {
    const game = this.game
    return {
      curbPressure: finite(game.landsideView().pressure),
      fuelHeldIds: game.flights.filter((flight) => flight.fuelHeld).map((flight) => flight.id),
      news: game.news.map((item) => ({ id: item.id, text: item.text })),
      alerts: game.alerts.active.map((alert) => ({
        key: alert.key,
        title: alert.title,
        detail: alert.detail,
      })),
      spotOffer: game.spotOffer ? { flightNo: game.spotOffer.flightNo } : null,
    }
  }

  hubReached(): { tier: string; rank: number } {
    const order = ['station', 'focus', 'base', 'hub', 'primary']
    let tier = 'none'
    let rank = -1
    for (const id of this.game.signed) {
      const current = this.game.hubChecklistFor(id).current
      const next = order.indexOf(current)
      if (next > rank) {
        rank = next
        tier = current
      }
    }
    return { tier, rank }
  }

  tallyOps(): LedgerOps {
    const game = this.game
    const ledger = game.bank.ledger()
    let goArounds = 0
    let missedConnectionCash = 0
    let fuelPurchase = 0
    let spotPurchase = 0
    let termPurchase = 0
    for (const entry of ledger.entries) {
      if (entry.meta.unpaid || !(entry.amount < 0)) continue
      const label = entry.meta.label ?? ''
      if (/go-around/i.test(label)) goArounds += 1
      if (entry.category === 'missed_connection') missedConnectionCash += entry.amount
      if (entry.category !== 'fuel_purchase') continue
      const spent = Math.abs(entry.amount)
      fuelPurchase += spent
      if (/spot/i.test(label)) spotPurchase += spent
      else termPurchase += spent
    }
    return {
      goArounds,
      missedConnectionCash: Math.round(missedConnectionCash),
      connectionDiverts: game.connectionTally.divert,
      fuelPurchase: Math.round(fuelPurchase),
      spotPurchase: Math.round(spotPurchase),
      termPurchase: Math.round(termPurchase),
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
      jumps: game.recoveryJumps,
    }
  }

  hubOffersSent(): number {
    return Object.values(this.game.hubOffered).reduce((sum, tiers) => sum + tiers.length, 0)
  }

  hubLadderNote(): string {
    return this.game.signed
      .map((id) => {
        const rel = this.game.wave3.relation(id)
        const list = this.game.hubChecklistFor(id)
        const line = (key: string) => list.lines.find((row) => row.id === key)
        return [
          id,
          `score${Math.round(rel.score)}`,
          `tier${rel.tier}`,
          `kept${rel.counts.kept}`,
          `rel${line('relation')?.status ?? '-'}`,
          `ot${line('onTime')?.status ?? '-'}:${line('onTime')?.label ?? ''}`,
          `ten${line('tenure')?.status ?? '-'}`,
          `band${line('band')?.status ?? '-'}`,
          `next${list.next ?? '-'}`,
        ].join(':')
      })
      .join('|')
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
