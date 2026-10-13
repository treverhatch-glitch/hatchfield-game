import { AIRLINES } from '../game/catalog.ts'
import { RIVAL, RIVAL_CODE, RIVAL_NAME } from './config.ts'
import {
  clamp,
  courtChance,
  courtCost,
  dailyIncome,
  dailyUpkeep,
  demandSplit,
  expandCost,
  feeBlend,
  finite,
  poachChance,
  round2,
} from './demand.ts'
import { createRivalRng, type RivalRng } from './rng.ts'
import type {
  CourtOffer,
  CourtQuote,
  CourtResult,
  DayResult,
  FeeLevels,
  PlayerSnapshot,
  RivalCarrier,
  RivalCompareRow,
  RivalCourtRow,
  RivalMove,
  RivalPanelModel,
  RivalState,
  Walkaway,
} from './types.ts'

function copyCarrier(c: RivalCarrier): RivalCarrier {
  return { ...c }
}

function homeRoster(): RivalCarrier[] {
  const roster: RivalCarrier[] = []
  for (const home of RIVAL.home) {
    const airline = AIRLINES[home.id]
    if (!airline) continue
    roster.push({
      id: airline.id,
      name: airline.name,
      tier: airline.tier,
      kind: airline.kind,
      sinceDay: 0,
      loyalty: home.loyalty,
    })
  }
  return roster
}

function freshFees(): FeeLevels {
  return { ...RIVAL.fees }
}

export function createRivalState(seed = 1): RivalState {
  const rng = createRivalRng(seed)
  return {
    version: 1,
    name: RIVAL_NAME,
    day: 0,
    rng: rng.state(),
    reputation: RIVAL.startReputation,
    service: RIVAL.startService,
    capacity: RIVAL.startCapacity,
    treasury: RIVAL.startTreasury,
    fees: freshFees(),
    roster: homeRoster(),
    moves: [
      {
        day: 0,
        kind: 'info',
        text: `${RIVAL_NAME} is open across the catchment with Bushline Local and UPPS Freight.`,
        announce: false,
        tone: 'ok',
      },
    ],
    lastPoachDay: -RIVAL.poachCooldownDays,
    lastExpandDay: -RIVAL.expandCooldownDays,
  }
}

/**
 * Headless competitor. One `advanceDay` is one game-day (180 sim-seconds).
 * The host supplies the player's tariff, service, stands and roster.
 * Bellwater never reaches into the sim.
 */
export class RivalAirport {
  private state: RivalState
  private rng: RivalRng

  private constructor(state: RivalState) {
    this.state = state
    this.rng = createRivalRng(state.rng)
  }

  static create(seed = 1): RivalAirport {
    return new RivalAirport(createRivalState(seed))
  }

  static restore(raw: string | RivalState | null | undefined): RivalAirport | null {
    if (raw == null) return null
    try {
      const parsed = typeof raw === 'string' ? (JSON.parse(raw) as RivalState) : raw
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.roster) || !parsed.fees) return null
      const state = createRivalState(1)
      state.day = Math.max(0, Math.floor(finite(parsed.day, 0)))
      state.rng = finite(parsed.rng, 1) >>> 0 || 1
      state.reputation = clamp(finite(parsed.reputation, RIVAL.startReputation), 0, 100)
      state.service = clamp(finite(parsed.service, RIVAL.startService), 0, 100)
      state.capacity = clamp(Math.round(finite(parsed.capacity, RIVAL.startCapacity)), 1, RIVAL.maxCapacity)
      state.treasury = finite(parsed.treasury, RIVAL.startTreasury)
      state.fees = {
        landing: clamp(finite(parsed.fees.landing, 1), RIVAL.feeFloor, RIVAL.feeCeiling),
        passenger: clamp(finite(parsed.fees.passenger, 1), RIVAL.feeFloor, RIVAL.feeCeiling),
        cargo: clamp(finite(parsed.fees.cargo, 1), RIVAL.feeFloor, RIVAL.feeCeiling),
      }
      state.roster = parsed.roster
        .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
        .slice(0, RIVAL.maxRoster)
        .map((c) => ({
          id: c.id,
          name: c.name,
          tier: Math.max(1, Math.round(finite(c.tier, 1))),
          kind: c.kind === 'cargo' ? 'cargo' : 'pax',
          sinceDay: Math.max(0, Math.floor(finite(c.sinceDay, 0))),
          loyalty: clamp(finite(c.loyalty, 50), 0, 100),
        }))
      state.moves = Array.isArray(parsed.moves) ? parsed.moves.slice(0, RIVAL.maxMoves) : state.moves
      state.lastPoachDay = finite(parsed.lastPoachDay, state.lastPoachDay)
      state.lastExpandDay = finite(parsed.lastExpandDay, state.lastExpandDay)
      state.name = RIVAL_NAME
      return new RivalAirport(state)
    } catch {
      return null
    }
  }

  serialize(): string {
    this.state.rng = this.rng.state()
    return JSON.stringify(this.state)
  }

  get day(): number {
    return this.state.day
  }

  rosterIds(): string[] {
    return this.state.roster.map((c) => c.id)
  }

  demand(player: Pick<PlayerSnapshot, 'feeIndex' | 'service' | 'capacity'>): ReturnType<typeof demandSplit> {
    return demandSplit(player, this.state)
  }

  /** A carrier the player just signed. Pulls them off Bellwater if they were based there. */
  releaseToPlayer(id: string, name: string): RivalMove | null {
    const idx = this.state.roster.findIndex((c) => c.id === id)
    if (idx < 0) return null
    this.state.roster.splice(idx, 1)
    const move: RivalMove = {
      day: this.state.day,
      kind: 'lost',
      text: `${name} left ${this.state.name} for your field.`,
      announce: true,
      tone: 'good',
    }
    this.note(move)
    return move
  }

  quoteCourt(id: string, offer: CourtOffer): CourtQuote {
    const carrier = this.state.roster.find((c) => c.id === id)
    if (!carrier) return { ok: false, cost: 0, chance: 0, reason: 'That carrier is not based at Bellwater.' }
    const cost = courtCost(carrier.tier)
    const chance = this.chanceFor(carrier, offer)
    return { ok: true, cost, chance, reason: '' }
  }

  /** Rolls the pitch. The host has already paid `quoteCourt().cost`. */
  commitCourt(id: string, offer: CourtOffer): CourtResult {
    const quote = this.quoteCourt(id, offer)
    if (!quote.ok) {
      return { ok: false, won: false, cost: 0, chance: 0, text: quote.reason, carrier: null }
    }
    const carrier = this.state.roster.find((c) => c.id === id)!
    const roll = this.rng.next()
    if (roll < quote.chance) {
      this.state.roster = this.state.roster.filter((c) => c.id !== id)
      const text = `${carrier.name} left ${this.state.name} for your tariff.`
      this.note({ day: this.state.day, kind: 'lost', text, announce: false, tone: 'good' })
      return { ok: true, won: true, cost: quote.cost, chance: quote.chance, text, carrier: copyCarrier(carrier) }
    }
    carrier.loyalty = clamp(carrier.loyalty + RIVAL.courtLoyaltyBump, 0, 100)
    const text = `${carrier.name} stayed at ${this.state.name}. The pitch cost ${money(quote.cost)} and they dug in.`
    this.note({ day: this.state.day, kind: 'info', text, announce: false, tone: 'bad' })
    return { ok: true, won: false, cost: quote.cost, chance: quote.chance, text, carrier: null }
  }

  advanceDay(player: PlayerSnapshot, walkaways: Walkaway[]): DayResult {
    this.state.day += 1
    const moves: RivalMove[] = []
    const poached: RivalCarrier[] = []
    const push = (move: RivalMove) => {
      moves.push(move)
      this.note(move)
    }

    this.pullSigned(player, push)
    this.courtWalkaways(walkaways, push)
    this.settleBooks()
    this.reactFees(player, push)
    this.grow(push)
    const demand = this.demand(player)
    this.drift(demand.rivalShare)
    this.tryPoach(player, demand, push, poached)

    return { day: this.state.day, moves, poached, demand }
  }

  panel(player: PlayerSnapshot): RivalPanelModel {
    const demand = this.demand(player)
    const blend = feeBlend(this.state.fees)
    const offer: CourtOffer = {
      feeIndex: player.feeIndex,
      service: player.service,
      capacity: player.capacity,
    }
    return {
      name: this.state.name,
      code: RIVAL_CODE,
      day: this.state.day,
      reputation: Math.round(this.state.reputation),
      service: Math.round(this.state.service),
      capacity: this.state.capacity,
      maxCapacity: RIVAL.maxCapacity,
      treasury: Math.round(this.state.treasury),
      dailyUpkeep: dailyUpkeep(this.state.capacity),
      fees: { ...this.state.fees },
      feeBlend: round2(blend),
      roster: this.state.roster.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        tier: c.tier,
        loyalty: Math.round(c.loyalty),
      })),
      moves: this.state.moves.slice(0, RIVAL.panelMoves).map((m) => ({
        day: m.day,
        text: m.text,
        tone: m.tone,
      })),
      comparison: comparisonRows(player, this.state, blend, demand),
      demand,
      court: this.state.roster.map((c) => this.courtRow(c, offer)),
    }
  }

  private courtRow(carrier: RivalCarrier, offer: CourtOffer): RivalCourtRow {
    const quote = this.quoteCourt(carrier.id, offer)
    return {
      id: carrier.id,
      name: carrier.name,
      kind: carrier.kind,
      tier: carrier.tier,
      cost: quote.cost,
      chance: quote.chance,
      ok: quote.ok,
      reason: quote.reason,
    }
  }

  private chanceFor(carrier: RivalCarrier, offer: CourtOffer): number {
    return courtChance({
      ...offer,
      loyalty: carrier.loyalty,
      rivalFee: feeBlend(this.state.fees),
      rivalService: this.state.service,
      rivalCapacity: this.state.capacity,
    })
  }

  private pullSigned(player: PlayerSnapshot, push: (move: RivalMove) => void) {
    for (const airline of player.airlines) {
      if (!this.state.roster.some((c) => c.id === airline.id)) continue
      this.state.roster = this.state.roster.filter((c) => c.id !== airline.id)
      push({
        day: this.state.day,
        kind: 'lost',
        text: `${airline.name} is flying your field, so ${this.state.name} dropped the base.`,
        announce: true,
        tone: 'good',
      })
    }
  }

  private courtWalkaways(walkaways: Walkaway[], push: (move: RivalMove) => void) {
    for (const left of walkaways) {
      if (this.state.roster.some((c) => c.id === left.id)) continue
      if (this.state.roster.length >= RIVAL.maxRoster) {
        push({
          day: this.state.day,
          kind: 'hold',
          text: `${this.state.name} wanted ${left.name} after they walked, but the roster is full.`,
          announce: false,
          tone: 'ok',
        })
        continue
      }
      this.state.roster.push({
        id: left.id,
        name: left.name,
        tier: left.tier,
        kind: left.kind,
        sinceDay: this.state.day,
        loyalty: 55,
      })
      const crowded = this.state.roster.length > this.state.capacity
      push({
        day: this.state.day,
        kind: 'court',
        text: crowded
          ? `${this.state.name} courted ${left.name} after they left you. The extra carrier crowds their stands.`
          : `${this.state.name} courted ${left.name} after they left you (${left.reason}).`,
        announce: true,
        tone: 'bad',
      })
    }
  }

  private settleBooks() {
    const income = dailyIncome(this.state.roster.length, this.state.fees)
    const upkeep = dailyUpkeep(this.state.capacity)
    this.state.treasury = Math.round(this.state.treasury + income - upkeep)
  }

  private reactFees(player: PlayerSnapshot, push: (move: RivalMove) => void) {
    const playerFee = clamp(finite(player.feeIndex, 1), 0.4, 2)
    const blend = feeBlend(this.state.fees)
    if (playerFee < blend - RIVAL.undercutGap) {
      const next = shiftFees(this.state.fees, -RIVAL.undercutStep)
      if (round2(feeBlend(next)) === round2(blend)) {
        push({
          day: this.state.day,
          kind: 'hold',
          text: `${this.state.name} is already at its fee floor (${RIVAL.feeFloor.toFixed(2)}×).`,
          announce: false,
          tone: 'ok',
        })
        return
      }
      const income = dailyIncome(this.state.roster.length, next)
      const upkeep = dailyUpkeep(this.state.capacity)
      if (income < upkeep && this.state.treasury < upkeep * RIVAL.solvencyDays) {
        push({
          day: this.state.day,
          kind: 'hold',
          text: `${this.state.name} held its tariff. Another cut would not cover stand upkeep.`,
          announce: false,
          tone: 'ok',
        })
        return
      }
      this.state.fees = next
      push({
        day: this.state.day,
        kind: 'undercut',
        text: `${this.state.name} cut fees to ${round2(feeBlend(next)).toFixed(2)}× to undercut your ${playerFee.toFixed(2)}× tariff.`,
        announce: true,
        tone: 'bad',
      })
      return
    }
    const util = this.state.capacity > 0 ? this.state.roster.length / this.state.capacity : 0
    if (playerFee > blend + RIVAL.raiseGap && util >= RIVAL.growUtilization) {
      const next = shiftFees(this.state.fees, RIVAL.raiseStep)
      if (feeBlend(next) === blend) return
      this.state.fees = next
      push({
        day: this.state.day,
        kind: 'raise',
        text: `${this.state.name} raised fees to ${round2(feeBlend(next)).toFixed(2)}×. Their stands are full and your tariff is higher.`,
        announce: true,
        tone: 'good',
      })
    }
  }

  private grow(push: (move: RivalMove) => void) {
    if (this.state.capacity >= RIVAL.maxCapacity) return
    const util = this.state.roster.length / this.state.capacity
    if (util < RIVAL.growUtilization) return
    if (this.state.day - this.state.lastExpandDay < RIVAL.expandCooldownDays) return
    const cost = expandCost(this.state.capacity)
    if (this.state.treasury < cost) return
    this.state.treasury -= cost
    this.state.capacity += 1
    this.state.lastExpandDay = this.state.day
    push({
      day: this.state.day,
      kind: 'expand',
      text: `${this.state.name} paid ${money(cost)} for another stand. Upkeep is now ${money(dailyUpkeep(this.state.capacity))} a day.`,
      announce: true,
      tone: 'ok',
    })
  }

  private drift(rivalShare: number) {
    const util = this.state.capacity > 0 ? this.state.roster.length / this.state.capacity : 0
    const serviceTarget = clamp(46 + (1 - util) * 16 + (this.state.reputation - 50) * 0.12, 28, 88)
    this.state.service = clamp(this.state.service + clamp(serviceTarget - this.state.service, -RIVAL.driftStep, RIVAL.driftStep), 0, 100)
    const repTarget = clamp(44 + rivalShare * 28 + (util > 0.5 ? 4 : -2), 22, 88)
    this.state.reputation = clamp(
      this.state.reputation + clamp(repTarget - this.state.reputation, -RIVAL.driftStep, RIVAL.driftStep),
      0,
      100,
    )
  }

  private tryPoach(
    player: PlayerSnapshot,
    demand: ReturnType<typeof demandSplit>,
    push: (move: RivalMove) => void,
    poached: RivalCarrier[],
  ) {
    if (this.state.day < RIVAL.poachMinDay) return
    if (this.state.day - this.state.lastPoachDay < RIVAL.poachCooldownDays) return
    if (this.state.roster.length >= this.state.capacity) return
    if (this.state.roster.length >= RIVAL.maxRoster) return
    const rivalFee = feeBlend(this.state.fees)
    const candidates = player.airlines
      .filter((a) => a.standing <= RIVAL.poachStandingMax)
      .filter((a) => !this.state.roster.some((c) => c.id === a.id))
      .sort((a, b) => a.standing - b.standing)
    const target = candidates[0]
    if (!target) return
    const chance = poachChance({
      standing: target.standing,
      playerFee: player.feeIndex,
      rivalFee,
      playerService: player.service,
      rivalService: this.state.service,
    })
    if (chance <= 0) return
    const roll = this.rng.next()
    if (roll >= chance) return
    const carrier: RivalCarrier = {
      id: target.id,
      name: target.name,
      tier: target.tier,
      kind: target.kind,
      sinceDay: this.state.day,
      loyalty: 62,
    }
    this.state.roster.push(carrier)
    this.state.lastPoachDay = this.state.day
    this.state.reputation = clamp(this.state.reputation + 2, 0, 100)
    poached.push(copyCarrier(carrier))
    const share = Math.round(demand.rivalShare * 100)
    push({
      day: this.state.day,
      kind: 'poach',
      text: `${this.state.name} poached ${target.name}. Their share of the catchment is ${share}%.`,
      announce: true,
      tone: 'bad',
    })
  }

  private note(move: RivalMove) {
    this.state.moves.unshift(move)
    if (this.state.moves.length > RIVAL.maxMoves) this.state.moves.length = RIVAL.maxMoves
  }
}

function shiftFees(fees: FeeLevels, delta: number): FeeLevels {
  const step = (n: number) => clamp(round2(n + delta), RIVAL.feeFloor, RIVAL.feeCeiling)
  return { landing: step(fees.landing), passenger: step(fees.passenger), cargo: step(fees.cargo) }
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function comparisonRows(
  player: PlayerSnapshot,
  state: RivalState,
  blend: number,
  demand: ReturnType<typeof demandSplit>,
): RivalCompareRow[] {
  return [
    {
      label: 'Tariff',
      player: `${finite(player.feeIndex, 1).toFixed(2)}×`,
      rival: `${blend.toFixed(2)}×`,
      edge: edge(player.feeIndex, blend, false, 0.02),
    },
    row('Service', Math.round(player.service), Math.round(state.service), true, 2),
    row('Stands', player.capacity, state.capacity, true, 0.5),
    row('Reputation', Math.round(player.reputation), Math.round(state.reputation), true, 2),
    row('Demand', Math.round(demand.playerShare * 100), Math.round(demand.rivalShare * 100), true, 2, '%'),
  ]
}

function row(
  label: string,
  player: number,
  rival: number,
  higherIsBetter: boolean,
  epsilon: number,
  suffix = '',
): RivalCompareRow {
  return {
    label,
    player: `${player}${suffix}`,
    rival: `${rival}${suffix}`,
    edge: edge(player, rival, higherIsBetter, epsilon),
  }
}

function edge(player: number, rival: number, higherIsBetter: boolean, epsilon: number): RivalCompareRow['edge'] {
  if (Math.abs(player - rival) <= epsilon) return 'even'
  const playerWins = higherIsBetter ? player > rival : player < rival
  return playerWins ? 'you' : 'bellwater'
}
