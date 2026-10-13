import { AIRLINES, NEGOTIATION, SERVICE_IDS, ULCC_IDS } from './data.ts'
import { derivePersonality } from './personality.ts'
import { clamp, createRng, hashSeed, normal, type Rng } from './rng.ts'
import type {
  ActiveModifier,
  AirlineProfile,
  DepositTier,
  NegotiationContext,
  NegotiationResult,
  OfferTerms,
  ReplyKind,
  RivalAirport,
  RivalCard,
  ServiceId,
  Session,
  SignedDeal,
  SpendHidden,
  StandingDelta,
  StandingModifierName,
} from './types.ts'
import {
  breakEvenSpend,
  cloneTerms,
  dailyPax,
  dollarsFor,
  effectiveRatio,
  feeRevenue,
  generosity,
  askGap,
  termsAtRatio,
} from './valuation.ts'

export interface LineRow {
  service: ServiceId
  label: string
  current: number
  askPct: number
  theirsPct: number
  ask: number
  theirs: number
}

export interface PanelModel {
  airlineId: string
  airlineName: string
  pitch: string | null
  ulcc: boolean
  round: number
  maxRounds: number
  mood: number
  face: string
  patience: number
  capacity: NegotiationContext['capacity']
  rows: LineRow[]
  freebies: { id: string; label: string; on: boolean }[]
  deposit: DepositTier
  termMonths: number
  termOptions: readonly number[]
  margin: number
  marginLow: number
  marginHigh: number
  advisor: string | null
  research: { cost: number; band: string; bought: boolean }[]
  actualSpend: number | null
  note: string
  open: boolean
}

interface SaveShape {
  seed: number
  rngState: number
  day: number
  nextId: number
  rival: RivalAirport
  modifiers: StandingDelta[]
  bars: Record<string, number>
  session: Session | null
  panelOpen: boolean
  signed: SignedDeal[]
  research: Record<string, number>
  lastBump: number
  extra: AirlineProfile[]
}

const emptyResult = (note: string): NegotiationResult => ({
  reply: null,
  outcome: 'open',
  deltas: [],
  cashDelta: 0,
  note,
})

export class NegotiationDesk {
  private rng: Rng
  private seed: number
  day = 0
  private nextId = 1
  rival: RivalAirport
  private modifiers: StandingDelta[] = []
  private bars: Record<string, number> = {}
  session: Session | null = null
  panelOpen = false
  private signed: SignedDeal[] = []
  /** airlineId → bandPct already purchased. The finer band replaces a coarse one. */
  private research = new Map<string, number>()
  private spendCache = new Map<string, SpendHidden>()
  private lastBump = 0
  private extra: AirlineProfile[] = []

  constructor(seed = 1) {
    this.seed = seed >>> 0 || 1
    this.rng = createRng(this.seed)
    this.rival = {
      name: NEGOTIATION.rival.name,
      growthScore: NEGOTIATION.rival.growthScore,
      revenuePerDay: 0,
      airlines: [],
    }
  }

  profile(id: string): AirlineProfile | undefined {
    return this.extra.find((a) => a.id === id) ?? AIRLINES.find((a) => a.id === id)
  }

  /** Trunk carriers that are not in the negotiation roster. */
  register(profile: AirlineProfile): void {
    if (!this.profile(profile.id)) this.extra.push(profile)
  }

  personality(id: string) {
    const profile = this.profile(id)
    if (!profile) throw new Error(`unknown airline ${id}`)
    return derivePersonality(profile)
  }

  isUlcc(id: string): boolean {
    return ULCC_IDS.includes(id)
  }

  barred(id: string): boolean {
    const until = this.bars[id]
    return until != null && this.day < until
  }

  hiddenSpend(id: string): SpendHidden {
    const cached = this.spendCache.get(id)
    if (cached) return cached
    const rng = createRng(hashSeed(this.seed, `spend:${id}`))
    const mult = rng.float(NEGOTIATION.spend.meanMin, NEGOTIATION.spend.meanMax)
    const mean = NEGOTIATION.spend.average * mult
    const actual = Math.max(0.05, normal(rng, mean, mean * NEGOTIATION.spend.sdRatio))
    const spend = { mean, actual }
    this.spendCache.set(id, spend)
    return spend
  }

  researchBand(id: string, cost: number) {
    const tier =
      cost >= NEGOTIATION.research.fine.cost ? NEGOTIATION.research.fine : NEGOTIATION.research.coarse
    const spend = this.hiddenSpend(id)
    return {
      cost: tier.cost,
      bandPct: tier.bandPct,
      low: spend.mean * (1 - tier.bandPct),
      high: spend.mean * (1 + tier.bandPct),
      mean: spend.mean,
    }
  }

  buyResearch(id: string, cost: number): NegotiationResult {
    const band = this.researchBand(id, cost)
    const owned = this.research.get(id) ?? 1
    if (owned <= band.bandPct) return emptyResult('Research already on the books.')
    this.research.set(id, band.bandPct)
    return {
      reply: null,
      outcome: this.session?.status === 'open' ? 'open' : 'open',
      deltas: [],
      cashDelta: -band.cost,
      note: `Market research ±${Math.round(band.bandPct * 100)}% on spend per passenger.`,
    }
  }

  /** Trunk letters sometimes arrive as an ULCC pitch. Null keeps the trunk carrier. */
  maybeUlcc(): AirlineProfile | null {
    if (this.signed.some((d) => this.isUlcc(d.airlineId))) return null
    if (this.rng.next() > NEGOTIATION.ulccOfferChance) return null
    const open = AIRLINES.filter((a) => a.ulcc && !this.barred(a.id) && !this.signed.some((d) => d.airlineId === a.id))
    if (!open.length) return null
    const index = Math.floor(this.rng.next() * open.length)
    return open[index] ?? null
  }

  open(id: string, context: NegotiationContext): Session {
    const profile = this.profile(id)
    if (!profile) throw new Error(`unknown airline ${id}`)
    const personality = derivePersonality(profile)
    const opening = profile.ulcc
      ? this.rng.float(NEGOTIATION.ulccOpenMin, NEGOTIATION.ulccOpenMax)
      : clamp(personality.targetCost * (1 - personality.greed * 0.12), 0.35, personality.targetCost)
    const theirs = termsAtRatio(opening)
    const session: Session = {
      id: this.mint('offer'),
      airlineId: id,
      round: 1,
      counters: 0,
      mood: NEGOTIATION.moodStart,
      status: 'open',
      ask: cloneTerms(theirs),
      theirs,
      context: { ...context },
      lastReply: null,
      note: profile.pitch ?? `${profile.name} opened at ${Math.round(opening * 100)}% of the posted fees.`,
    }
    this.session = session
    this.panelOpen = true
    return session
  }

  setFee(service: ServiceId, pct: number): void {
    if (!this.session || this.session.status !== 'open') return
    this.session.ask.feePct[service] = clamp(pct, -80, 80)
  }

  setRatio(ratio: number): void {
    if (!this.session || this.session.status !== 'open') return
    const pct = (ratio - 1) * 100
    for (const id of SERVICE_IDS) this.session.ask.feePct[id] = pct
  }

  setDeposit(tier: DepositTier): void {
    if (!this.session || this.session.status !== 'open') return
    this.session.ask.deposit = tier
  }

  setTerm(months: number): void {
    if (!this.session || this.session.status !== 'open') return
    this.session.ask.termMonths = months
  }

  toggleFreebie(id: string): void {
    const session = this.session
    if (!session || session.status !== 'open') return
    const free = session.ask.freebies
    if (id === 'parking') free.parkingHours = cycle(NEGOTIATION.parkingHours, free.parkingHours)
    else if (id === 'fuel') free.fuelDiscountPct = cycle(NEGOTIATION.fuelDiscounts, free.fuelDiscountPct)
    else if (id === 'marketing') free.marketingFund = cycle(NEGOTIATION.marketingFunds, free.marketingFund)
    else if (id === 'priority') free.priorityGates = !free.priorityGates
    else if (id === 'contact') free.contactGates = !free.contactGates
    else if (id === 'lounge') free.loungeAccess = !free.loungeAccess
    else if (id === 'lead') free.waivedLeadTime = !free.waivedLeadTime
  }

  counter(): NegotiationResult {
    const session = this.session
    if (!session || session.status !== 'open') return emptyResult('No open offer.')
    const profile = this.require(session.airlineId)
    const personality = derivePersonality(profile)
    const effective = effectiveRatio(profile, session.ask, personality, session.context)
    this.applyMood(session, effective, personality)
    const deltas = this.roundDeltas(session, profile, effective, personality)
    let reply = this.decide(session, effective, personality)
    if (reply === 'counter') {
      this.moveTowardTarget(session, personality)
      session.counters += 1
      session.round += 1
      session.lastReply = 'counter'
      session.note = `${profile.name} countered — ${Math.round(NEGOTIATION.counterMoveMin * 100)}–${Math.round(NEGOTIATION.counterMoveMax * 100)}% of the way to their target.`
      return { reply, outcome: 'open', deltas, cashDelta: 0, note: session.note }
    }
    return this.finish(session, profile, reply, deltas, cloneTerms(session.ask))
  }

  accept(): NegotiationResult {
    const session = this.session
    if (!session || session.status !== 'open') return emptyResult('No open offer.')
    const profile = this.require(session.airlineId)
    const personality = derivePersonality(profile)
    const terms = cloneTerms(session.theirs)
    const effective = effectiveRatio(profile, terms, personality, session.context)
    const reply: ReplyKind = effective > personality.reservation ? 'walk' : effective > personality.targetCost ? 'accept_with_grudge' : 'accept'
    const deltas = this.roundDeltas(session, profile, effective, personality)
    return this.finish(session, profile, reply, deltas, terms)
  }

  playerWalk(): NegotiationResult {
    const session = this.session
    if (!session || session.status !== 'open') return emptyResult('No open offer.')
    session.status = 'player_walk'
    session.note = 'You walked. The letter is closed.'
    session.lastReply = null
    return { reply: 'player_walk', outcome: 'player_walk', deltas: [], cashDelta: 0, note: session.note }
  }

  closePanel(): void {
    this.panelOpen = false
  }

  openPanel(): void {
    if (this.session) this.panelOpen = true
  }

  /**
   * One game day. Live mode returns ULCC retail once the spend report is in.
   * Bot mode also books walk-in traffic, overhead, and fee margin.
   */
  advanceDay(mode: 'live' | 'bot' = 'live'): number {
    this.day += 1
    let cash = 0
    if (mode === 'bot') {
      cash += NEGOTIATION.economics.walkInPerDay * this.trafficFactor() - NEGOTIATION.economics.overheadPerDay
    }
    for (const deal of this.signed) {
      deal.operatedDays += 1
      if (mode === 'bot') {
        const profile = this.require(deal.airlineId)
        cash += feeRevenue(profile, deal.terms) - profile.handlingPerDay
        cash -= deal.terms.freebies.marketingFund / Math.max(30, deal.terms.termMonths * 30)
      }
      if (this.isUlcc(deal.airlineId) && deal.operatedDays >= NEGOTIATION.reportAfterDays) {
        const profile = this.require(deal.airlineId)
        cash += this.hiddenSpend(deal.airlineId).actual * dailyPax(profile) * NEGOTIATION.economics.retailTake
      }
    }
    return cash
  }

  trafficFactor(): number {
    const cut = Math.min(
      NEGOTIATION.rival.trafficCutCap,
      this.rival.airlines.length * NEGOTIATION.rival.trafficCutPerAirline,
    )
    return 1 - cut
  }

  /** Latest signed deal for this carrier. */
  dealFor(id: string): SignedDeal | undefined {
    for (let i = this.signed.length - 1; i >= 0; i -= 1) {
      if (this.signed[i]?.airlineId === id) return this.signed[i]
    }
    return undefined
  }

  /** Retail-spend band the offer sheet uses for its margin range. */
  spendBand(id: string): { low: number; mid: number; high: number } {
    return this.spendPoint(this.require(id))
  }

  /**
   * Mean fee multiplier for a signed carrier. 1 when there is no deal.
   * Live billing uses each line on its own; this average is the desk summary.
   */
  feeFactor(id: string): number {
    const deal = this.dealFor(id)
    if (!deal) return 1
    let sum = 0
    for (const service of SERVICE_IDS) sum += 1 + (deal.terms.feePct[service] ?? 0) / 100
    return Math.max(0.05, sum / SERVICE_IDS.length)
  }

  rivalCard(): RivalCard | null {
    if (!this.rival.airlines.length) return null
    return {
      name: this.rival.name,
      growthScore: this.rival.growthScore,
      revenuePerDay: this.rival.revenuePerDay,
      airlines: [...this.rival.airlines],
      headline: formatBump(this.lastBump || NEGOTIATION.rival.revenuePerAirline),
      trafficFactor: this.trafficFactor(),
    }
  }

  modifierNow(airlineId: string, name: StandingModifierName): number {
    return this.liveModifiers(airlineId)
      .filter((m) => m.modifier === name)
      .reduce((sum, m) => sum + m.value * m.remaining, 0)
  }

  liveModifiers(airlineId?: string): ActiveModifier[] {
    const list = airlineId ? this.modifiers.filter((m) => m.airlineId === airlineId) : this.modifiers
    return list
      .map((m) => ({ ...m, remaining: remaining(m, this.day) }))
      .filter((m) => m.remaining > 0)
  }

  actualSpendReport(id: string): number | null {
    const deal = this.signed.find((d) => d.airlineId === id)
    if (!deal || !this.isUlcc(id) || deal.operatedDays < NEGOTIATION.reportAfterDays) return null
    return this.hiddenSpend(id).actual
  }

  advisorLine(): string | null {
    const session = this.session
    if (!session || !this.isUlcc(session.airlineId)) return null
    const profile = this.require(session.airlineId)
    const spend = breakEvenSpend(profile, session.ask)
    return `Break-even spend $${spend.toFixed(2)} per passenger.`
  }

  panel(): PanelModel | null {
    const session = this.session
    if (!session || !this.panelOpen) return null
    const profile = this.require(session.airlineId)
    const personality = derivePersonality(profile)
    const band = this.marginBand(profile, session.ask)
    const free = session.ask.freebies
    return {
      airlineId: profile.id,
      airlineName: profile.name,
      pitch: profile.pitch,
      ulcc: profile.ulcc,
      round: session.round,
      maxRounds: personality.maxCounters,
      mood: session.mood,
      face: faceFor(session.mood),
      patience: personality.patience,
      capacity: session.context.capacity,
      rows: NEGOTIATION.services.map((service) => ({
        service: service.id,
        label: service.label,
        current: profile.posted[service.id],
        askPct: session.ask.feePct[service.id],
        theirsPct: session.theirs.feePct[service.id],
        ask: dollarsFor(profile.posted[service.id], session.ask.feePct[service.id]),
        theirs: dollarsFor(profile.posted[service.id], session.theirs.feePct[service.id]),
      })),
      freebies: [
        { id: 'parking', label: free.parkingHours ? `Parking ${free.parkingHours}h` : 'Free parking', on: free.parkingHours > 0 },
        { id: 'fuel', label: free.fuelDiscountPct ? `Fuel −${free.fuelDiscountPct}%` : 'Fuel discount', on: free.fuelDiscountPct > 0 },
        { id: 'priority', label: 'Priority gates', on: free.priorityGates },
        { id: 'contact', label: 'Contact gates', on: free.contactGates },
        { id: 'marketing', label: free.marketingFund ? `Marketing $${Math.round(free.marketingFund / 1000)}k` : 'Marketing fund', on: free.marketingFund > 0 },
        { id: 'lounge', label: 'Lounge access', on: free.loungeAccess },
        { id: 'lead', label: 'Waived lead time', on: free.waivedLeadTime },
      ],
      deposit: session.ask.deposit,
      termMonths: session.ask.termMonths,
      termOptions: NEGOTIATION.terms,
      margin: band.margin,
      marginLow: band.low,
      marginHigh: band.high,
      advisor: this.advisorLine(),
      research: profile.ulcc
        ? [NEGOTIATION.research.coarse, NEGOTIATION.research.fine].map((tier) => ({
            cost: tier.cost,
            band: `±${Math.round(tier.bandPct * 100)}%`,
            bought: (this.research.get(profile.id) ?? 1) <= tier.bandPct,
          }))
        : [],
      actualSpend: this.actualSpendReport(profile.id),
      note: session.note,
      open: session.status === 'open',
    }
  }

  save(): string {
    const payload: SaveShape = {
      seed: this.seed,
      rngState: this.rng.state(),
      day: this.day,
      nextId: this.nextId,
      rival: this.rival,
      modifiers: this.modifiers,
      bars: this.bars,
      session: this.session,
      panelOpen: this.panelOpen,
      signed: this.signed,
      research: Object.fromEntries(this.research),
      lastBump: this.lastBump,
      extra: this.extra,
    }
    return JSON.stringify(payload)
  }

  load(json: string): void {
    const saved = JSON.parse(json) as SaveShape
    this.seed = saved.seed
    this.rng = createRng(saved.seed)
    this.rng.load(saved.rngState)
    this.day = saved.day
    this.nextId = saved.nextId
    this.rival = saved.rival
    this.modifiers = saved.modifiers
    this.bars = saved.bars
    this.session = saved.session
    this.panelOpen = saved.panelOpen
    this.signed = saved.signed
    this.research = new Map(Object.entries(saved.research ?? {}))
    this.lastBump = saved.lastBump ?? 0
    this.extra = saved.extra ?? []
    this.spendCache.clear()
  }

  private marginBand(profile: AirlineProfile, terms: OfferTerms) {
    const traffic = this.trafficFactor()
    const point = (spend: number) => {
      const pax = dailyPax(profile)
      const retail = Math.max(0, spend) * pax * NEGOTIATION.economics.retailTake
      const marketing = terms.freebies.marketingFund / Math.max(30, terms.termMonths * 30)
      return (
        feeRevenue(profile, terms) +
        retail -
        profile.handlingPerDay -
        marketing +
        NEGOTIATION.economics.walkInPerDay * traffic -
        NEGOTIATION.economics.overheadPerDay
      )
    }
    const spend = this.spendPoint(profile)
    return { margin: point(spend.mid), low: point(spend.low), high: point(spend.high) }
  }

  private spendPoint(profile: AirlineProfile): { low: number; mid: number; high: number } {
    if (!profile.ulcc) {
      const mid = NEGOTIATION.spend.average
      const band = NEGOTIATION.economics.knownSpendBand
      return { low: mid * (1 - band), mid, high: mid * (1 + band) }
    }
    const hidden = this.hiddenSpend(profile.id)
    const reported = this.actualSpendReport(profile.id)
    if (reported != null) return { low: reported, mid: reported, high: reported }
    const owned = this.research.get(profile.id)
    const band = owned ?? NEGOTIATION.economics.unknownSpendBand
    return {
      low: hidden.mean * (1 - band),
      mid: hidden.mean,
      high: hidden.mean * (1 + band),
    }
  }

  private applyMood(session: Session, effective: number, personality: ReturnType<typeof derivePersonality>): void {
    const gap = askGap(effective, personality)
    session.mood = clamp(session.mood - (1 - personality.patience) * gap, 0, 1)
  }

  private decide(session: Session, effective: number, personality: ReturnType<typeof derivePersonality>): ReplyKind {
    if (effective > personality.reservation) return 'walk'
    if (effective <= personality.targetCost + 1e-6) return 'accept'
    if (session.counters >= personality.maxCounters) return 'accept_with_grudge'
    return 'counter'
  }

  private moveTowardTarget(session: Session, personality: ReturnType<typeof derivePersonality>): void {
    const span = NEGOTIATION.counterMoveMax - NEGOTIATION.counterMoveMin
    const pull = 1 - personality.bluff * NEGOTIATION.bluffPull
    const fraction = NEGOTIATION.counterMoveMin + this.rng.next() * span * pull
    const targetPct = (personality.targetCost - 1) * 100
    for (const id of SERVICE_IDS) {
      const ask = session.ask.feePct[id]
      session.theirs.feePct[id] = ask + (targetPct - ask) * fraction
    }
    session.theirs.deposit = session.ask.deposit
    session.theirs.termMonths = session.ask.termMonths
    session.theirs.freebies = { ...session.ask.freebies }
  }

  private roundDeltas(
    session: Session,
    profile: AirlineProfile,
    effective: number,
    personality: ReturnType<typeof derivePersonality>,
  ): StandingDelta[] {
    const deltas: StandingDelta[] = []
    if (effective > personality.targetCost + 1e-6) {
      const span = Math.max(NEGOTIATION.minSpread, personality.reservation - personality.targetCost)
      const severity = clamp((effective - personality.targetCost) / span, 0, 1)
      const mag = NEGOTIATION.overAskMin + (NEGOTIATION.overAskMax - NEGOTIATION.overAskMin) * severity
      deltas.push(this.modifier(profile.id, 'over_ask', 'Over-ask', -mag * personality.pride, NEGOTIATION.overAskDays))
    }
    const gift = generosity(session.ask.freebies)
    if (gift > 0) {
      const value = NEGOTIATION.freebieMin + (NEGOTIATION.freebieMax - NEGOTIATION.freebieMin) * gift
      deltas.push(this.modifier(profile.id, 'freebie', 'Freebies', value, NEGOTIATION.freebieDays))
    }
    return deltas
  }

  private finish(
    session: Session,
    profile: AirlineProfile,
    reply: ReplyKind,
    deltas: StandingDelta[],
    terms: OfferTerms,
  ): NegotiationResult {
    session.lastReply = reply
    if (reply === 'walk') {
      session.status = 'walked'
      session.note = `${profile.name} walked.`
      deltas.push(this.modifier(profile.id, 'walk', 'Walked away', NEGOTIATION.walkValue, NEGOTIATION.walkDays))
      this.bars[profile.id] = this.day + NEGOTIATION.walkBarDays
      this.joinRival(profile.id)
      return { reply, outcome: 'walked', deltas, cashDelta: 0, note: session.note }
    }
    if (reply === 'accept_with_grudge') {
      deltas.push(
        this.modifier(
          profile.id,
          NEGOTIATION.grudgeModifier,
          'Hard bargain',
          NEGOTIATION.grudgeValue,
          NEGOTIATION.grudgeDays,
        ),
      )
      session.status = 'grudge'
      session.note = `${profile.name} signed, and they will remember the squeeze.`
    } else {
      session.status = 'accepted'
      session.note = `${profile.name} signed.`
    }
    this.signed.push({
      airlineId: profile.id,
      terms,
      signedDay: this.day,
      operatedDays: 0,
      grudge: reply === 'accept_with_grudge',
    })
    const month = feeRevenue(profile, terms) * 30
    const deposit = NEGOTIATION.deposits.find((d) => d.id === terms.deposit)
    const cashDelta = month * (deposit?.cashFraction ?? 0) - terms.freebies.marketingFund
    return { reply, outcome: 'signed', deltas, cashDelta, note: session.note }
  }

  private joinRival(id: string): void {
    if (this.rival.airlines.includes(id)) return
    this.rival.airlines.push(id)
    this.rival.revenuePerDay += NEGOTIATION.rival.revenuePerAirline
    this.rival.growthScore += NEGOTIATION.rival.growthPerAirline
    this.lastBump = NEGOTIATION.rival.revenuePerAirline
  }

  private modifier(
    airlineId: string,
    name: StandingModifierName,
    label: string,
    value: number,
    durationDays: number,
  ): StandingDelta {
    const delta: StandingDelta = {
      id: this.mint('mod'),
      airlineId,
      modifier: name,
      label,
      value,
      durationDays,
      startDay: this.day,
    }
    this.modifiers.push(delta)
    return delta
  }

  private require(id: string): AirlineProfile {
    const profile = this.profile(id)
    if (!profile) throw new Error(`unknown airline ${id}`)
    return profile
  }

  private mint(prefix: string): string {
    const id = `${prefix}-${this.nextId}`
    this.nextId += 1
    return id
  }
}

function remaining(mod: StandingDelta, day: number): number {
  if (mod.durationDays <= 0) return 0
  return clamp(1 - (day - mod.startDay) / mod.durationDays, 0, 1)
}

function cycle(steps: readonly number[], current: number): number {
  const index = steps.indexOf(current)
  return steps[(index + 1) % steps.length] ?? steps[0]
}

export function faceFor(mood: number): string {
  const index = clamp(Math.round(mood * (NEGOTIATION.faces.length - 1)), 0, NEGOTIATION.faces.length - 1)
  return NEGOTIATION.faces[index] ?? NEGOTIATION.faces[2]
}

export function formatBump(amount: number): string {
  const sign = amount >= 0 ? '+' : '-'
  const abs = Math.abs(amount)
  if (abs >= 1000) {
    const k = abs / 1000
    const text = Number.isInteger(k) ? String(k) : k.toFixed(1)
    return `${sign}$${text}k/day`
  }
  return `${sign}$${Math.round(abs)}/day`
}

export function createNegotiation(seed = 1): NegotiationDesk {
  return new NegotiationDesk(seed)
}

export { termsAtRatio }
