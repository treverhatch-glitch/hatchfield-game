import { processFlightEvents } from '../airlines/logic.ts'
import type { AirlineState, ContractTerms } from '../airlines/types.ts'
import { DEFAULT_AIRLINES } from '../airlines/data.ts'
import { createDiplomacyAdapter, toAirlinesFlightEvent } from '../diplomacy/adapter.ts'
import type { DiplomacyAdapter, DiplomacyAdapterHost } from '../diplomacy/adapter.ts'
import { CARGO_TERMS, TIER_CONTRACT_TERMS } from '../diplomacy/constants.ts'
import type { AirlineCard, AirlineRelation, CounterLineKey, Grade, Proposal, ProposalResponse } from '../diplomacy/types.ts'

/**
 * One sim-second is eight game minutes. Diplomacy advances in game minutes,
 * and one of its days is 1440 of those minutes — one sim day (180s).
 */
export const GAME_MINUTES_PER_SIM_SECOND = 8

/** Game field levels are 1–5. Diplomacy tiers unlock at field levels 1, 3, 5, 7 and 9. */
export function diplomacyFieldLevel(gameLevel: number): number {
  const table = [0, 1, 3, 5, 7, 9]
  const level = Math.max(1, Math.min(5, Math.round(gameLevel)))
  return table[level] ?? 1
}

export interface DepartureGradeInput {
  flightId: string
  airlineId: string
  delayMinutes: number
  bagFault: boolean
  paxMood: number
  standFit: boolean
}

export interface DepartureGrade {
  grade: Grade | null
  /** src/airlines satisfaction hit zero and the parallel contract ended. */
  ended: boolean
}

interface RampNote {
  delayMinutes: number
  bagLate: boolean
}

interface SavedBridge {
  diplomacy: string
  airlines: AirlineState
  onTime: boolean[]
}

function freshAirlines(): AirlineState {
  return {
    availableAirlines: DEFAULT_AIRLINES,
    unlockedAirlines: [],
    contractOffers: [],
    activeContracts: [],
    cooldowns: {},
    penaltyTiers: {},
    elapsedMinutes: 0,
    events: [],
  }
}

function contractIdFor(airlineId: string): string {
  return `dip-${airlineId}`
}

/**
 * Host-facing wrapper around createDiplomacyAdapter.
 * The module never reaches into the sim; this file is the only bridge.
 */
export class DiplomacyBridge {
  readonly adapter: DiplomacyAdapter
  private airlines: AirlineState = freshAirlines()
  private onTime: boolean[] = []
  private graded = new Set<string>()
  private ramp = new Map<string, RampNote>()

  constructor(host: DiplomacyAdapterHost, seed: number, restore?: string) {
    this.adapter = createDiplomacyAdapter(host, { seed })
    if (restore) this.load(restore)
  }

  day(): number {
    return this.adapter.engine.state.day
  }

  tick(gameMinutes: number): void {
    if (gameMinutes <= 0) return
    this.airlines = { ...this.airlines, elapsedMinutes: this.airlines.elapsedMinutes + gameMinutes }
    this.adapter.tick(gameMinutes)
  }

  relation(airlineId: string): AirlineRelation | undefined {
    return this.adapter.engine.relation(airlineId)
  }

  signedIds(): string[] {
    return this.adapter.engine.signedAirlineIds()
  }

  /** Trunk already signed this carrier. Grades stick once a contract exists. */
  mirrorSigned(airlineId: string): void {
    const rel = this.relation(airlineId)
    if (!rel || rel.status === 'signed' || rel.status === 'former') return
    const terms = rel.kind === 'cargo' ? { ...CARGO_TERMS } : { ...TIER_CONTRACT_TERMS[rel.tier] }
    const day = this.day()
    const years = rel.tier >= 4 ? 2 : 1
    rel.status = 'signed'
    rel.metDay ??= day
    rel.contract = {
      terms,
      signedDay: day,
      termEndDay: day + years * this.adapter.engine.state.config.yearDays,
      discountPct: 0,
      discountEndDay: day,
      peakSlotsPerWeek: Math.ceil(terms.slotsPerWeek * 0.4),
      seasonFlights: 0,
      seasonExcused: 0,
      baseGranted: false,
    }
    rel.flightsEma = terms.slotsPerWeek / 7
    this.ensureAirlinesContract(airlineId, terms)
  }

  noteLeft(airlineId: string): void {
    const rel = this.relation(airlineId)
    if (!rel || rel.status !== 'signed') return
    rel.status = 'former'
    rel.contract = null
    rel.exitedDay = this.day()
    rel.exitReason = 'standing'
    this.airlines = {
      ...this.airlines,
      activeContracts: this.airlines.activeContracts.filter((c) => c.airlineId !== airlineId),
    }
  }

  /** Logistics turnaround finished. The departure grade uses this delay. */
  noteRamp(flightId: string, delayMinutes: number, bagLate: boolean): void {
    const prev = this.ramp.get(flightId)
    this.ramp.set(flightId, {
      delayMinutes: Math.max(prev?.delayMinutes ?? 0, delayMinutes),
      bagLate: Boolean(prev?.bagLate || bagLate),
    })
  }

  gradeFlight(input: DepartureGradeInput): DepartureGrade {
    if (this.graded.has(input.flightId)) return { grade: null, ended: false }
    this.graded.add(input.flightId)
    const ramp = this.ramp.get(input.flightId)
    this.ramp.delete(input.flightId)
    const delayMinutes = Math.max(0, input.delayMinutes, ramp?.delayMinutes ?? 0) + this.extraDelayMinutes(input.airlineId)
    const bagFault = input.bagFault || Boolean(ramp?.bagLate)
    const grade = this.adapter.onTurnaroundComplete(input.airlineId, {
      delayMinutes,
      bagMinutes: bagFault ? 50 : 0,
      paxMood: Math.max(0, Math.min(1, input.paxMood)),
      standFit: input.standFit,
    })
    this.onTime.push(delayMinutes <= 15)
    if (this.onTime.length > 24) this.onTime.shift()
    if (!grade) return { grade: null, ended: false }
    return { grade, ended: this.recordAirlinesGrade(input.airlineId, grade, delayMinutes) }
  }

  cancelFlight(airlineId: string, excused: boolean): void {
    this.adapter.onFlightCancelled(airlineId, excused)
    if (!this.relation(airlineId) || this.relation(airlineId)?.status !== 'signed') return
    this.recordAirlinesGrade(airlineId, 'F', 0)
  }

  feeFactor(airlineId: string): number {
    const pct = this.adapter.engine.feeDiscountPct(airlineId)
    return Math.max(0, Math.min(1, 1 - pct / 100))
  }

  capacityFactor(airlineId: string): number {
    const rel = this.relation(airlineId)
    if (!rel || rel.status !== 'signed') return 1
    return rel.capacityFactor > 0 ? rel.capacityFactor : 1
  }

  slowFactor(airlineId: string): number {
    const fx = this.adapter.engine.operationalEffects()
    return fx.perAirline[airlineId]?.turnaroundSlowFactor ?? 1
  }

  extraDelayMinutes(airlineId: string): number {
    const fx = this.adapter.engine.operationalEffects()
    return fx.perAirline[airlineId]?.extraDelayMinutes ?? 0
  }

  /** Game minutes of a hostile slot change, as sim-seconds. */
  extraDelaySec(airlineId: string): number {
    return this.extraDelayMinutes(airlineId) / GAME_MINUTES_PER_SIM_SECOND
  }

  refusedGates(airlineId: string): number {
    const fx = this.adapter.engine.operationalEffects()
    return fx.perAirline[airlineId]?.refusedGates ?? 0
  }

  onTimePct(): number {
    if (!this.onTime.length) return 88
    const hits = this.onTime.filter(Boolean).length
    return Math.round((100 * hits) / this.onTime.length)
  }

  cards(): AirlineCard[] {
    return this.adapter.cards()
  }

  proposals(): Proposal[] {
    return this.adapter.engine.state.proposals
  }

  respond(proposalId: string, response: ProposalResponse, ticks?: CounterLineKey[]) {
    const result = this.adapter.respondToProposal(proposalId, response, 'money', ticks)
    if (result.ok && (response === 'accept' || response === 'support')) {
      for (const id of this.signedIds()) {
        const signed = this.relation(id)
        if (signed?.contract) this.ensureAirlinesContract(id, signed.contract.terms)
      }
    }
    return result
  }

  save(): string {
    const payload: SavedBridge = {
      diplomacy: this.adapter.save(),
      airlines: this.airlines,
      onTime: this.onTime,
    }
    return JSON.stringify(payload)
  }

  load(json: string): void {
    let diplomacy = json
    let airlines = freshAirlines()
    let onTime: boolean[] = []
    try {
      const parsed = JSON.parse(json) as Partial<SavedBridge> & { version?: number }
      if (parsed && typeof parsed.diplomacy === 'string') {
        diplomacy = parsed.diplomacy
        if (parsed.airlines) airlines = parsed.airlines
        if (Array.isArray(parsed.onTime)) onTime = parsed.onTime.filter((v) => typeof v === 'boolean')
      }
    } catch {
      diplomacy = json
    }
    this.adapter.load(diplomacy)
    this.airlines = airlines
    this.onTime = onTime
    this.graded.clear()
    this.ramp.clear()
  }

  private ensureAirlinesContract(airlineId: string, terms: ContractTerms): void {
    const id = contractIdFor(airlineId)
    if (this.airlines.activeContracts.some((c) => c.id === id)) return
    if ((this.airlines.cooldowns[airlineId] ?? 0) > this.airlines.elapsedMinutes) return
    this.airlines = {
      ...this.airlines,
      activeContracts: [
        ...this.airlines.activeContracts,
        {
          id,
          airlineId,
          terms: { ...terms },
          signedAtMinute: this.airlines.elapsedMinutes,
          satisfaction: 70,
          penaltyTier: this.airlines.penaltyTiers[airlineId] ?? 0,
        },
      ],
    }
  }

  private recordAirlinesGrade(airlineId: string, grade: Grade, delayMinutes: number): boolean {
    const id = contractIdFor(airlineId)
    if (!this.airlines.activeContracts.some((c) => c.id === id)) return false
    const before = this.airlines.activeContracts.length
    this.airlines = processFlightEvents(this.airlines, [
      toAirlinesFlightEvent(id, grade, delayMinutes),
    ])
    return this.airlines.activeContracts.length < before
  }
}

export function createDiplomacyBridge(host: DiplomacyAdapterHost, seed = 1, restore?: string): DiplomacyBridge {
  return new DiplomacyBridge(host, seed, restore)
}
