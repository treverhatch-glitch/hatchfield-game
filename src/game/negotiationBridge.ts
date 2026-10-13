import { createNegotiation, NegotiationDesk } from '../negotiation/engine.ts'
import type { PanelModel } from '../negotiation/engine.ts'
import { liveDailyMargin, negotiatedLineFactor, quoteUnit, type LiveTurnQuote } from '../negotiation/liveFees.ts'
import type {
  AirlineProfile,
  CapacityLight,
  DepositTier,
  NegotiationResult,
  OfferTerms,
  RivalCard,
  ServiceId,
  StandingDelta,
  TraitId,
} from '../negotiation/types.ts'
import type { Airline } from './types.ts'
import { AIRLINES as CATALOG } from './catalog.ts'

export interface NegotiationHost {
  day(): number
  standing(id: string): number
  rating(): number
  capacity(): CapacityLight
  applyStanding(deltas: StandingDelta[]): void
  addMoney(amount: number, reason: string): void
  notify(message: string, tone: 'ok' | 'good' | 'bad'): void
  ensureCarrier(profile: AirlineProfile): void
  /** Live fee card for one turn, before the negotiated percent. */
  liveQuote(id: string): LiveTurnQuote
}

/**
 * Trunk contract letters open a negotiation. Standing deltas go back out
 * through the host, which applies them on the diplomacy adapter.
 */
export class NegotiationBridge {
  readonly desk: NegotiationDesk
  private host: NegotiationHost

  constructor(host: NegotiationHost, seed = 1) {
    this.host = host
    this.desk = createNegotiation(seed)
  }

  /** Attach a session to a trunk offer. A pax letter may be replaced by an ULCC pitch. */
  present(airline: Airline): string {
    if (airline.kind === 'pax') {
      const ulcc = this.desk.maybeUlcc()
      if (ulcc) {
        this.desk.open(ulcc.id, this.context(ulcc.id))
        return ulcc.id
      }
    }
    const known = this.desk.profile(airline.id)
    if (!known) this.desk.register(profileFromTrunk(airline))
    this.desk.open(airline.id, this.context(airline.id))
    return airline.id
  }

  openNamed(id: string): void {
    const known = this.desk.profile(id)
    if (!known) {
      const catalog = CATALOG[id]
      if (!catalog) return
      this.desk.register(profileFromTrunk(catalog))
    }
    const profile = this.desk.profile(id)
    if (profile?.ulcc) this.host.ensureCarrier(profile)
    this.desk.open(id, this.context(id))
  }

  panel(): PanelModel | null {
    const model = this.desk.panel()
    const session = this.desk.session
    if (!model || !session) return model
    const quote = this.host.liveQuote(session.airlineId)
    const spend = this.desk.spendBand(session.airlineId)
    const traffic = this.desk.trafficFactor()
    return {
      ...model,
      rows: model.rows.map((row) => {
        const current = quoteUnit(quote, row.service)
        return {
          ...row,
          current,
          ask: current * (1 + session.ask.feePct[row.service] / 100),
          theirs: current * (1 + session.theirs.feePct[row.service] / 100),
        }
      }),
      margin: liveDailyMargin(quote, session.ask, spend.mid, traffic),
      marginLow: liveDailyMargin(quote, session.ask, spend.low, traffic),
      marginHigh: liveDailyMargin(quote, session.ask, spend.high, traffic),
    }
  }

  signedTerms(id: string): OfferTerms | null {
    return this.desk.dealFor(id)?.terms ?? null
  }

  /** 1 when this carrier has no signed deal. */
  lineFactor(id: string, service: ServiceId): number {
    const terms = this.signedTerms(id)
    return terms ? negotiatedLineFactor(terms, service) : 1
  }

  rivalCard(): RivalCard | null {
    return this.desk.rivalCard()
  }

  advisorLine(): string | null {
    return this.desk.advisorLine()
  }

  trafficFactor(): number {
    return this.desk.trafficFactor()
  }

  feeFactor(id: string): number {
    return this.desk.feeFactor(id)
  }

  barred(id: string): boolean {
    return this.desk.barred(id)
  }

  accept(): NegotiationResult {
    return this.apply(this.desk.accept())
  }

  counter(): NegotiationResult {
    return this.apply(this.desk.counter())
  }

  walk(): NegotiationResult {
    return this.apply(this.desk.playerWalk())
  }

  setFee(service: ServiceId, pct: number): void {
    this.desk.setFee(service, pct)
  }

  setDeposit(tier: DepositTier): void {
    this.desk.setDeposit(tier)
  }

  setTerm(months: number): void {
    this.desk.setTerm(months)
  }

  toggleFreebie(id: string): void {
    this.desk.toggleFreebie(id)
  }

  buyResearch(cost: number): NegotiationResult | null {
    const id = this.desk.session?.airlineId
    if (!id) return null
    return this.apply(this.desk.buyResearch(id, cost))
  }

  /** ULCC retail once the two-week spend report is in. The sim already books fees. */
  rollDay(): number {
    return this.desk.advanceDay('live')
  }

  openPanel(): void {
    this.desk.openPanel()
  }

  closePanel(): void {
    this.desk.closePanel()
  }

  save(): string {
    return this.desk.save()
  }

  load(json: string): void {
    this.desk.load(json)
  }

  private apply(result: NegotiationResult): NegotiationResult {
    if (result.deltas.length) this.host.applyStanding(result.deltas)
    // The deposit itself is collected by the live commercial ledger. Marketing
    // and research are the only cash this bridge posts. Standing stays on the
    // diplomacy adapter via applyStanding.
    if (result.outcome === 'signed') {
      const id = this.desk.session?.airlineId
      const marketing = id ? (this.desk.dealFor(id)?.terms.freebies.marketingFund ?? 0) : 0
      if (marketing > 0) this.host.addMoney(-marketing, 'Marketing fund')
    } else if (result.cashDelta) {
      this.host.addMoney(result.cashDelta, result.note || 'negotiation')
    }
    if (result.note) {
      const tone = result.outcome === 'walked' ? 'bad' : result.outcome === 'signed' ? 'good' : 'ok'
      this.host.notify(result.note, tone)
    }
    return result
  }

  private context(id: string) {
    return {
      capacity: this.host.capacity(),
      rating: this.host.rating(),
      standing: this.host.standing(id),
    }
  }
}

function profileFromTrunk(airline: Airline): AirlineProfile {
  const traits: TraitId[] =
    airline.kind === 'cargo'
      ? ['hardball']
      : airline.persona === 'luxury'
        ? ['lavish', 'proud']
        : airline.persona === 'business'
          ? ['punctual', 'proud']
          : ['frugal', 'patient']
  const seats = Math.max(40, Math.round((airline.paxMin + airline.paxMax) / 2) || 80)
  return {
    id: airline.id,
    name: airline.name,
    traits,
    agenda: airline.bizModel === 'lcc' ? 'cost_cutter' : null,
    interests: airline.kind === 'cargo' ? ['cargo', 'cost', 'punctuality'] : ['punctuality', 'cost', 'capacity'],
    seats,
    flightsPerDay: airline.tier >= 4 ? 3 : 4,
    handlingPerDay: Math.round(airline.landing * 0.35),
    posted: {
      landing: airline.landing,
      pax: airline.kind === 'cargo' ? 0 : 10,
      bags: airline.bags > 0 ? Math.max(1, airline.bags / 40) : 0,
      fuel: 6,
      catering: airline.catering > 0 ? Math.max(1, airline.catering / 80) : 0,
      parking: 300,
    },
    ulcc: false,
    pitch: null,
  }
}
