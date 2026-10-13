/**
 * PLAYTEST B5 — Bellwater price war.
 *
 * PR #64 (the full Bellwater airport) is not on trunk. This module is the
 * war loop plus a minimal stub: Bellwater's posted tariff, letters it poached,
 * and a bump when negotiation walkaways are already on their roster.
 * When #64 merges, keep this war and feed it that roster. Do not replace it
 * with a second airport sim.
 */
import { PRICE_WAR, type PriceWarTune } from './pricewar.data.ts'

export type WarChoice = 'match' | 'hold' | 'promote'

export interface SoftOffer {
  id: string
  name: string
}

export interface PriceWarInput {
  /** Airlines that walked a negotiation and now fly Bellwater. */
  walkedAirlineIds: readonly string[]
  /** Player posted fee index. 1 is list price. */
  postedFeeIndex: number
  /** Unsigned contract letter Bellwater may poach. */
  softOffer: SoftOffer | null
}

export interface PriceWarEvent {
  started: boolean
  warId: number
  resolved: boolean
  poachedOfferId: string | null
  poachedOfferName: string | null
  note: string
  tone: 'ok' | 'good' | 'bad'
}

export interface WarQuote {
  ok: boolean
  cost: number
  reason: string
}

export interface WarAction {
  id: WarChoice
  label: string
  hint: string
  cost: number
}

export interface PriceWarCardModel {
  name: string
  headline: string
  detail: string
  pending: boolean
  choice: WarChoice | null
  intensity: number
  walked: number
  playerFee: number
  rivalFee: number
  /** 0–100 walk-in kept by this war alone, before other rival cuts. */
  walkInPct: number
  daysLeft: number
  poachedName: string | null
  capPct: number
  actions: WarAction[]
}

interface PendingWar {
  id: number
  startedDay: number
  intensity: number
  walked: number
  playerFee: number
  rivalFee: number
  poachedOfferId: string | null
  poachedOfferName: string | null
}

interface ActiveEffect {
  choice: WarChoice
  untilDay: number
  intensity: number
  walked: number
  margin: number
  walkInLoss: number
  playerFee: number
  rivalFee: number
  poachedOfferName: string | null
}

interface PriceWarState {
  version: 1
  day: number
  rng: number
  nextEligibleDay: number
  wars: number
  /** Bellwater's posted fee index. */
  feeIndex: number
  /** Soft offers already pulled. */
  poached: string[]
  pending: PendingWar | null
  effect: ActiveEffect | null
}

interface Rng {
  next(): number
  state(): number
}

/** Mulberry32. `state()` is a valid seed for the next draw. */
export function createPriceWarRng(seed: number): Rng {
  let s = seed >>> 0
  if (s === 0) s = 1
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0
      let t = Math.imul(s ^ (s >>> 15), s | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    state: () => s,
  }
}

export function mergeTune(partial?: Partial<PriceWarTune>): PriceWarTune {
  return { ...PRICE_WAR, ...partial }
}

export function walkedCount(ids: readonly string[]): number {
  const seen = new Set<string>()
  for (const id of ids) if (id) seen.add(id)
  return seen.size
}

export function warIntensity(walked: number, tune: PriceWarTune = PRICE_WAR): number {
  const n = Math.max(0, walked)
  return Math.min(tune.intensityCap, 1 + n * tune.intensityPerWalked)
}

export function startChance(walked: number, tune: PriceWarTune = PRICE_WAR): number {
  const n = Math.max(0, walked)
  return Math.min(tune.startChanceCap, tune.startChance + n * tune.walkedChance)
}

/** Share of walk-in this response gives Bellwater. Already inside the cap. */
export function responseWalkInLoss(
  choice: WarChoice | 'pending',
  intensity: number,
  tune: PriceWarTune = PRICE_WAR,
): number {
  if (choice === 'match') return Math.min(tune.walkInLossCap, Math.max(0, tune.matchLoss))
  if (choice === 'promote') return Math.min(tune.walkInLossCap, Math.max(0, tune.promoteLoss))
  const extra = Math.max(0, intensity - 1) * tune.holdLossPerIntensity
  return Math.min(tune.walkInLossCap, Math.max(0, tune.holdLoss + extra))
}

export function undercutFee(playerFee: number, intensity: number, tune: PriceWarTune = PRICE_WAR): number {
  const fee = playerFee > 0 && Number.isFinite(playerFee) ? playerFee : tune.defaultPlayerFee
  const cut = tune.undercutGap * Math.max(0, intensity)
  return Math.max(tune.feeFloor, fee * (1 - cut))
}

/**
 * Walk-in multiplier after every rival effect.
 * Negotiation walkaways and the price war add their losses, then stop at the cap.
 */
export function composeRivalWalkIn(
  negotiationFactor: number,
  warFactor: number,
  cap = PRICE_WAR.walkInLossCap,
): number {
  const negotiationLoss = Math.max(0, 1 - clamp01(negotiationFactor))
  const warLoss = Math.max(0, 1 - clamp01(warFactor))
  const ceiling = Math.min(1, Math.max(0, cap))
  return 1 - Math.min(ceiling, negotiationLoss + warLoss)
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(1, Math.max(0, n))
}

function emptyEvent(): PriceWarEvent {
  return {
    started: false,
    warId: 0,
    resolved: false,
    poachedOfferId: null,
    poachedOfferName: null,
    note: '',
    tone: 'ok',
  }
}

export class PriceWar {
  private readonly tune: PriceWarTune
  private rng: Rng
  private state: PriceWarState

  private constructor(tune: PriceWarTune, rng: Rng, state: PriceWarState) {
    this.tune = tune
    this.rng = rng
    this.state = state
  }

  static create(seed: number, partial?: Partial<PriceWarTune>): PriceWar {
    const tune = mergeTune(partial)
    const rng = createPriceWarRng(seed)
    const state: PriceWarState = {
      version: 1,
      day: 0,
      rng: rng.state(),
      nextEligibleDay: tune.minDay,
      wars: 0,
      feeIndex: tune.startFee,
      poached: [],
      pending: null,
      effect: null,
    }
    return new PriceWar(tune, rng, state)
  }

  static restore(raw: unknown, partial?: Partial<PriceWarTune>): PriceWar | null {
    if (typeof raw !== 'string' || !raw) return null
    try {
      const state = JSON.parse(raw) as PriceWarState
      if (!state || state.version !== 1 || typeof state.rng !== 'number' || typeof state.day !== 'number') return null
      if (!Array.isArray(state.poached)) state.poached = []
      const tune = mergeTune(partial)
      return new PriceWar(tune, createPriceWarRng(state.rng), state)
    } catch {
      return null
    }
  }

  get day(): number {
    return this.state.day
  }

  /** Bellwater stub: posted tariff and letters they have taken. */
  stub(): { name: string; feeIndex: number; poached: string[] } {
    return {
      name: this.tune.rivalName,
      feeIndex: this.state.feeIndex,
      poached: [...this.state.poached],
    }
  }

  advanceDay(input: PriceWarInput): PriceWarEvent {
    this.state.day += 1
    const day = this.state.day
    const event = emptyEvent()

    if (this.state.effect && day >= this.state.effect.untilDay) this.state.effect = null

    if (this.state.pending) {
      const age = day - this.state.pending.startedDay
      if (age >= this.tune.responseWindowDays) {
        const pending = this.state.pending
        this.apply('hold', pending)
        event.resolved = true
        event.warId = pending.id
        event.note = 'You let the price war ride. Bellwater kept the walk-in share.'
        event.tone = 'bad'
      }
    }

    if (!this.state.pending && !this.state.effect && day >= this.tune.minDay && day >= this.state.nextEligibleDay) {
      const walked = walkedCount(input.walkedAirlineIds)
      if (this.rng.next() < startChance(walked, this.tune)) {
        const intensity = warIntensity(walked, this.tune)
        const playerFee =
          input.postedFeeIndex > 0 && Number.isFinite(input.postedFeeIndex)
            ? input.postedFeeIndex
            : this.tune.defaultPlayerFee
        const rivalFee = undercutFee(playerFee, intensity, this.tune)
        const poached = this.rollPoach(input.softOffer, intensity)
        this.state.wars += 1
        this.state.feeIndex = rivalFee
        this.state.pending = {
          id: this.state.wars,
          startedDay: day,
          intensity,
          walked,
          playerFee,
          rivalFee,
          poachedOfferId: poached?.id ?? null,
          poachedOfferName: poached?.name ?? null,
        }
        event.started = true
        event.warId = this.state.wars
        event.poachedOfferId = poached?.id ?? null
        event.poachedOfferName = poached?.name ?? null
        event.tone = 'bad'
        event.note = poached
          ? `${this.tune.rivalName} undercut your fees and pulled ${poached.name}'s letter.`
          : `${this.tune.rivalName} undercut your posted fees and is taking walk-in traffic.`
      }
    }

    this.state.rng = this.rng.state()
    return event
  }

  quote(choice: WarChoice): WarQuote {
    if (!this.state.pending) return { ok: false, cost: 0, reason: 'Bellwater is not in a price war.' }
    if (choice === 'promote') return { ok: true, cost: this.tune.promoteCost, reason: '' }
    return { ok: true, cost: 0, reason: '' }
  }

  pendingId(): number {
    return this.state.pending?.id ?? 0
  }

  commit(choice: WarChoice): { ok: boolean; note: string; cost: number } {
    const pending = this.state.pending
    if (!pending) return { ok: false, note: 'Bellwater is not in a price war.', cost: 0 }
    const cost = choice === 'promote' ? this.tune.promoteCost : 0
    this.apply(choice, pending)
    const note =
      choice === 'match'
        ? `You matched ${this.tune.rivalName}. Fees are cut for ${this.tune.matchDays} days and walk-in traffic comes back.`
        : choice === 'promote'
          ? `Counter-promotion is up. Walk-in recovers for ${this.tune.promoteDays} days.`
          : `You held the tariff. ${this.tune.rivalName} keeps the walk-in share for ${this.tune.holdDays} days.`
    return { ok: true, note, cost }
  }

  /** This war's walk-in multiplier. 1 when Bellwater is quiet. */
  walkInFactor(): number {
    if (this.state.pending) {
      return 1 - responseWalkInLoss('pending', this.state.pending.intensity, this.tune)
    }
    if (this.state.effect) return 1 - this.state.effect.walkInLoss
    return 1
  }

  /** 1, or the match cut while that response is in force. */
  marginFactor(): number {
    return this.state.effect?.margin ?? 1
  }

  card(): PriceWarCardModel | null {
    const tune = this.tune
    const pending = this.state.pending
    const effect = this.state.effect
    if (!pending && !effect) return null
    const intensity = pending?.intensity ?? effect?.intensity ?? 1
    const walked = pending?.walked ?? effect?.walked ?? 0
    const playerFee = pending?.playerFee ?? effect?.playerFee ?? tune.defaultPlayerFee
    const rivalFee = pending?.rivalFee ?? effect?.rivalFee ?? this.state.feeIndex
    const poachedName = pending?.poachedOfferName ?? effect?.poachedOfferName ?? null
    const loss = pending
      ? responseWalkInLoss('pending', intensity, tune)
      : (effect?.walkInLoss ?? 0)
    const daysLeft = pending
      ? Math.max(0, tune.responseWindowDays - (this.state.day - pending.startedDay))
      : Math.max(0, (effect?.untilDay ?? this.state.day) - this.state.day)
    const choice = effect?.choice ?? null
    const walkedBit =
      walked > 0
        ? ` ${walked} carrier${walked === 1 ? '' : 's'} already at Bellwater, so the undercut is a little deeper.`
        : ''
    const headline = pending
      ? `${tune.rivalName} started a price war`
      : choice === 'match'
        ? `Matching ${tune.rivalName}`
        : choice === 'promote'
          ? 'Counter-promotion is running'
          : `${tune.rivalName} is keeping your walk-in share`
    const detail = pending
      ? `Their tariff is ${rivalFee.toFixed(2)} against your ${playerFee.toFixed(2)}. Walk-in is down until you answer.${walkedBit}`
      : choice === 'match'
        ? `Airport fees are at ${Math.round(tune.matchMargin * 100)}% for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}. Walk-in is coming back.`
        : choice === 'promote'
          ? `Marketing is pulling walk-in back for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}.`
          : `Holding the tariff. They keep about ${Math.round(loss * 100)}% of walk-in for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}.`
    return {
      name: tune.rivalName,
      headline,
      detail,
      pending: Boolean(pending),
      choice,
      intensity,
      walked,
      playerFee,
      rivalFee,
      walkInPct: Math.round((1 - loss) * 100),
      daysLeft,
      poachedName,
      capPct: Math.round(tune.walkInLossCap * 100),
      actions: pending
        ? [
            {
              id: 'match',
              label: 'Match rates',
              hint: `Fees ×${tune.matchMargin} for ${tune.matchDays} days. Walk-in recovers.`,
              cost: 0,
            },
            {
              id: 'hold',
              label: 'Hold steady',
              hint: `They keep the walk-in share for ${tune.holdDays} days.`,
              cost: 0,
            },
            {
              id: 'promote',
              label: 'Counter-promote',
              hint: `$${tune.promoteCost.toLocaleString('en-US')} marketing. Walk-in recovers for ${tune.promoteDays} days.`,
              cost: tune.promoteCost,
            },
          ]
        : [],
    }
  }

  serialize(): string {
    this.state.rng = this.rng.state()
    return JSON.stringify(this.state)
  }

  private rollPoach(offer: SoftOffer | null, intensity: number): SoftOffer | null {
    if (!offer || this.state.poached.includes(offer.id)) return null
    const chance = Math.min(this.tune.poachChanceCap, this.tune.poachChance * Math.max(0, intensity))
    if (this.rng.next() >= chance) return null
    this.state.poached.push(offer.id)
    return offer
  }

  private apply(choice: WarChoice, pending: PendingWar) {
    const days = choice === 'match' ? this.tune.matchDays : choice === 'promote' ? this.tune.promoteDays : this.tune.holdDays
    this.state.effect = {
      choice,
      untilDay: this.state.day + days,
      intensity: pending.intensity,
      walked: pending.walked,
      margin: choice === 'match' ? this.tune.matchMargin : 1,
      walkInLoss: responseWalkInLoss(choice, pending.intensity, this.tune),
      playerFee: pending.playerFee,
      rivalFee: pending.rivalFee,
      poachedOfferName: pending.poachedOfferName,
    }
    this.state.pending = null
    this.state.feeIndex = pending.rivalFee
    this.state.nextEligibleDay = this.state.effect.untilDay + this.tune.cooldownDays
  }
}
