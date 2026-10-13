import { createRng, type Rng } from '../features/shared/rng.ts'
import {
  explainAsh,
  explainHealth,
  explainHub,
  explainPrice,
  explainSoftware,
  explainState,
  explainStrike,
  FIX,
  FOCUS,
  TITLE,
} from './catalog.ts'
import {
  ASH_COUNT_MAX,
  ASH_COUNT_MIN,
  ASH_HOTEL_ROOMS,
  CASH_ABS_MAX,
  COOLDOWN_DAYS,
  DEFAULT_POOLS,
  DISRUPTION_DAY_SEC,
  DISRUPTION_IDS,
  EVENT_WEIGHT,
  RECOVERY_COST,
} from './data.ts'
import { weatherDivertAsk } from './diversion.ts'
import { rivalFeeIndex, rivalName } from './rival.ts'
import {
  dailyChance,
  durationDays,
  eligible,
  feePressure,
  levelOf,
  manualCheckIn,
  screeningLoad,
  severityOf,
  strikeScale,
} from './scale.ts'
import type {
  ActiveDisruption,
  CashPosting,
  DisruptionEffect,
  DisruptionHost,
  DisruptionId,
  DisruptionModifiers,
  DisruptionWorld,
  FeedItem,
  FlightBank,
  RecoveryResult,
  StaffPoolId,
} from './types.ts'

export interface DisruptionSave {
  version: 1
  draws: number
  rolledDay: number
  lastFired: [DisruptionId, number][]
  active: ActiveDisruption | null
  feed: FeedItem[]
  modifiers: DisruptionModifiers
  ledger: CashPosting[]
}

const FEED_CAP = 24
const LEDGER_CAP = 40

export function identityModifiers(): DisruptionModifiers {
  return {
    checkInMultiplier: 1,
    screeningMultiplier: 1,
    secureZone: false,
    runwayWindows: [],
    staffScale: {},
    feeMultiplier: 1,
    hotelShortRooms: 0,
  }
}

export function finiteAmount(n: number): number {
  if (!Number.isFinite(n)) return 0
  const rounded = Math.round(n)
  if (!Number.isFinite(rounded)) return 0
  return Math.max(-CASH_ABS_MAX, Math.min(CASH_ABS_MAX, rounded))
}

function blankEffect(): DisruptionEffect {
  return {
    diversions: 0,
    hosted: 0,
    onward: 0,
    hotelShortRooms: 0,
    runwayWindows: [],
    checkInMultiplier: 1,
    staffPool: null,
    staffScale: 1,
    bankId: null,
    bankLabel: '',
    flightIds: [],
    delaySec: 0,
    screeningMultiplier: 1,
    feeMultiplier: 1,
    rivalName: '',
  }
}

function finiteClock(world: DisruptionWorld): number {
  return Number.isFinite(world.clock) ? Math.max(0, world.clock) : 0
}

export class DisruptionEngine {
  private rng: Rng
  private draws = 0
  private rolledDay = -1
  private seq = 0
  private lastFired = new Map<DisruptionId, number>()
  private active: ActiveDisruption | null = null
  private feed: FeedItem[] = []
  private mods: DisruptionModifiers = identityModifiers()
  private ledger: CashPosting[] = []

  constructor(seed: number) {
    this.rng = createRng(seed)
  }

  /** Replay the seeded draws so a save continues the same sequence. */
  load(raw: string, seed: number): void {
    let parsed: DisruptionSave | null = null
    try {
      parsed = JSON.parse(raw) as DisruptionSave
    } catch {
      parsed = null
    }
    if (!parsed || parsed.version !== 1 || !Number.isFinite(parsed.draws)) return
    this.rng = createRng(seed)
    this.draws = 0
    const n = Math.max(0, Math.min(100_000, Math.floor(parsed.draws)))
    for (let i = 0; i < n; i++) this.pull()
    this.rolledDay = Number.isFinite(parsed.rolledDay) ? parsed.rolledDay : -1
    this.lastFired = new Map(Array.isArray(parsed.lastFired) ? parsed.lastFired : [])
    this.active = parsed.active ?? null
    this.feed = Array.isArray(parsed.feed) ? parsed.feed.slice(-FEED_CAP) : []
    this.mods = parsed.modifiers ?? identityModifiers()
    this.ledger = Array.isArray(parsed.ledger) ? parsed.ledger.slice(-LEDGER_CAP) : []
    this.seq = this.feed.reduce((max, item) => {
      const num = Number(item.id.replace(/\D/g, ''))
      return Number.isFinite(num) ? Math.max(max, num) : max
    }, 0)
  }

  save(): string {
    const payload: DisruptionSave = {
      version: 1,
      draws: this.draws,
      rolledDay: this.rolledDay,
      lastFired: [...this.lastFired.entries()],
      active: this.active,
      feed: this.feed.slice(-FEED_CAP),
      modifiers: this.mods,
      ledger: this.ledger.slice(-LEDGER_CAP),
    }
    return JSON.stringify(payload)
  }

  get modifiers(): DisruptionModifiers {
    return this.mods
  }

  activeDisruption(): ActiveDisruption | null {
    return this.active
  }

  postings(): readonly CashPosting[] {
    return this.ledger
  }

  feedHistory(): readonly FeedItem[] {
    return this.feed
  }

  /** Engine history. The player-facing card is the alert stack. */
  visible(): FeedItem[] {
    return this.feed.filter((item) => item.status === 'live' || item.status === 'minimised' || item.status === 'ignored')
  }

  stamp(): string {
    return `${this.active?.id ?? ''}|${this.feed.map((item) => `${item.id}:${item.status}`).join(',')}`
  }

  checkInMultiplier(): number {
    const n = this.mods.checkInMultiplier
    if (!Number.isFinite(n) || n < 1) return 1
    return Math.min(4, n)
  }

  screeningMultiplier(): number {
    const n = this.mods.screeningMultiplier
    if (!Number.isFinite(n) || n < 1) return 1
    return Math.min(3, n)
  }

  feeMultiplier(): number {
    const n = this.mods.feeMultiplier
    if (!Number.isFinite(n) || n <= 0) return 1
    return Math.min(1, Math.max(0.55, n))
  }

  secureZone(): boolean {
    return this.mods.secureZone
  }

  staffScale(pool: StaffPoolId): number {
    const n = this.mods.staffScale[pool]
    if (n == null || !Number.isFinite(n)) return 1
    return Math.min(1, Math.max(0.4, n))
  }

  runwayClosed(clock: number): boolean {
    if (!Number.isFinite(clock)) return false
    return this.mods.runwayWindows.some((window) => clock >= window.start && clock < window.end)
  }

  /**
   * Move the clock. Rolls at most one new event on a new day.
   * An event that has reached its end clears before the next roll.
   */
  advance(world: DisruptionWorld, host: DisruptionHost): ActiveDisruption | null {
    const clock = finiteClock(world)
    if (this.active && clock >= this.active.endsAt) this.finish(host)
    const day = Math.floor(clock / DISRUPTION_DAY_SEC)
    if (day === this.rolledDay) return null
    this.rolledDay = day
    return this.roll(day, world, host)
  }

  /** Start one event now. Refuses anything before mid-game. */
  trigger(kind: DisruptionId, world: DisruptionWorld, host: DisruptionHost): ActiveDisruption | null {
    if (levelOf(world) < 3) return null
    if (this.active) this.finish(host)
    return this.start(kind, world, Math.floor(finiteClock(world) / DISRUPTION_DAY_SEC), host)
  }

  recover(id: string, host: DisruptionHost): RecoveryResult {
    const event = this.active
    if (!event || event.id !== id) {
      return { ok: false, cost: 0, explanation: 'That crisis has already passed.' }
    }
    const cost = finiteAmount(event.recoveryCost)
    if (cost > 0) this.post(host, -cost, `${event.title} fix`)
    if (event.kind === 'hub-meltdown' && event.effect.flightIds.length) host.rebookBank(event.effect.flightIds)
    const explanation = event.suggestedFix
    this.mark(event.id, 'recovered')
    this.mods = identityModifiers()
    this.active = null
    host.news(`${event.title} is under control. ${explanation}`, 'good')
    return { ok: true, cost, explanation }
  }

  ignore(id: string): boolean {
    return this.mark(id, 'ignored')
  }

  dismiss(id: string): boolean {
    return this.mark(id, 'dismissed')
  }

  minimise(id: string): boolean {
    return this.mark(id, 'minimised')
  }

  expand(id: string): boolean {
    const item = this.feed.find((entry) => entry.id === id)
    if (!item || (item.status !== 'minimised' && item.status !== 'ignored')) return false
    item.status = 'live'
    return true
  }

  private roll(day: number, world: DisruptionWorld, host: DisruptionHost): ActiveDisruption | null {
    if (!eligible(world) || this.active) return null
    if (this.pull() >= dailyChance(world)) return null
    const open = DISRUPTION_IDS.filter((id) => {
      const last = this.lastFired.get(id)
      return last === undefined || day - last >= COOLDOWN_DAYS
    })
    if (!open.length) return null
    return this.start(this.pickWeighted(open), world, day, host)
  }

  private start(kind: DisruptionId, world: DisruptionWorld, day: number, host: DisruptionHost): ActiveDisruption {
    const severity = severityOf(levelOf(world))
    const startedAt = finiteClock(world)
    const effect = this.buildEffect(kind, world, severity, startedAt)
    const recoveryCost = kind === 'volcanic-ash' && effect.hotelShortRooms <= 0 ? 0 : RECOVERY_COST[kind]
    const event: ActiveDisruption = {
      id: `d${++this.seq}`,
      kind,
      day,
      startedAt,
      endsAt: startedAt + durationDays(kind, severity) * DISRUPTION_DAY_SEC,
      title: TITLE[kind],
      explanation: this.explain(kind, effect),
      suggestedFix: FIX[kind],
      focus: FOCUS[kind],
      effect,
      recoveryCost: finiteAmount(recoveryCost),
    }
    this.active = event
    this.lastFired.set(kind, day)
    this.mods = modifiersFrom(effect)
    this.feed.push({
      id: event.id,
      kind,
      title: event.title,
      explanation: event.explanation,
      suggestedFix: event.suggestedFix,
      focus: event.focus,
      status: 'live',
      day,
    })
    if (this.feed.length > FEED_CAP) this.feed.splice(0, this.feed.length - FEED_CAP)
    this.applyHost(event, world, host)
    host.news(`${event.title}. ${event.explanation} Fix: ${event.suggestedFix}`, 'bad')
    return event
  }

  private buildEffect(kind: DisruptionId, world: DisruptionWorld, severity: number, clock: number): DisruptionEffect {
    const effect = blankEffect()
    if (kind === 'volcanic-ash') {
      effect.diversions = ASH_COUNT_MIN + this.int(0, ASH_COUNT_MAX - ASH_COUNT_MIN + 1)
      return effect
    }
    if (kind === 'state-visit') {
      const count = 1 + (severity >= 0.5 ? 1 : 0)
      let cursor = clock
      for (let i = 0; i < count; i++) {
        const len = 12 + this.int(0, 8)
        effect.runwayWindows.push({ start: cursor, end: cursor + len })
        cursor += len + 40
      }
      return effect
    }
    if (kind === 'software-outage') {
      effect.checkInMultiplier = manualCheckIn(severity)
      return effect
    }
    if (kind === 'strike-day') {
      const pools = world.staffPools.length ? world.staffPools : DEFAULT_POOLS
      effect.staffPool = this.pick(pools)
      effect.staffScale = strikeScale(severity)
      if (effect.staffPool === 'desk') effect.checkInMultiplier = 1.5 + (1 - effect.staffScale)
      return effect
    }
    if (kind === 'hub-meltdown') {
      const bank = this.pickBank(world.banks)
      effect.bankId = bank.id
      effect.bankLabel = bank.label
      effect.flightIds = bank.flightIds.slice()
      effect.delaySec = Math.round(24 + severity * 20)
      return effect
    }
    if (kind === 'health-screening') {
      effect.screeningMultiplier = screeningLoad(severity)
      return effect
    }
    effect.feeMultiplier = feePressure(severity, rivalFeeIndex())
    effect.rivalName = rivalName()
    return effect
  }

  /** Ash asks the divert path one aircraft at a time, then counts the hotel gap. */
  private applyHost(event: ActiveDisruption, world: DisruptionWorld, host: DisruptionHost): void {
    if (event.kind === 'volcanic-ash') {
      let hosted = 0
      for (let i = 0; i < event.effect.diversions; i++) {
        const result = host.acceptWeatherDivert(weatherDivertAsk())
        if (result?.hosted) hosted += 1
      }
      const have = Number.isFinite(world.hotelRooms) ? Math.max(0, Math.floor(world.hotelRooms)) : 0
      const short = Math.max(0, hosted * ASH_HOTEL_ROOMS - have)
      event.effect.hosted = hosted
      event.effect.onward = event.effect.diversions - hosted
      event.effect.hotelShortRooms = short
      event.explanation = explainAsh(event.effect.diversions, hosted, event.effect.onward, short)
      const card = this.feed.find((item) => item.id === event.id)
      if (card) card.explanation = event.explanation
      event.recoveryCost = short > 0 ? finiteAmount(RECOVERY_COST['volcanic-ash']) : 0
      this.mods = modifiersFrom(event.effect)
      return
    }
    if (event.kind === 'hub-meltdown' && event.effect.flightIds.length) {
      host.delayBank(event.effect.flightIds, event.effect.delaySec, 'Storm wiped this bank')
    }
  }

  private explain(kind: DisruptionId, effect: DisruptionEffect): string {
    if (kind === 'volcanic-ash') return explainAsh(effect.diversions, 0, effect.diversions, 0)
    if (kind === 'state-visit') return explainState(effect.runwayWindows.length)
    if (kind === 'software-outage') return explainSoftware(effect.checkInMultiplier)
    if (kind === 'strike-day' && effect.staffPool) return explainStrike(effect.staffPool, effect.staffScale)
    if (kind === 'hub-meltdown') return explainHub(effect.bankLabel, effect.flightIds.length)
    if (kind === 'health-screening') return explainHealth(effect.screeningMultiplier)
    return explainPrice(effect.rivalName, effect.feeMultiplier)
  }

  private pickBank(banks: FlightBank[]): FlightBank {
    if (!banks.length) return { id: 'bank-empty', label: 'the next bank', flightIds: [] }
    return this.pick(banks)
  }

  private finish(host: DisruptionHost): void {
    const event = this.active
    if (!event) return
    this.mark(event.id, 'recovered')
    this.mods = identityModifiers()
    this.active = null
    host.news(`${event.title} has passed. The field is back to normal.`, 'ok')
  }

  private mark(id: string, status: FeedItem['status']): boolean {
    const item = this.feed.find((entry) => entry.id === id)
    if (!item || item.status === 'recovered') return false
    item.status = status
    return true
  }

  private post(host: DisruptionHost, amount: number, reason: string): void {
    const n = finiteAmount(amount)
    if (n === 0) return
    this.ledger.push({ amount: n, reason })
    if (this.ledger.length > LEDGER_CAP) this.ledger.splice(0, this.ledger.length - LEDGER_CAP)
    host.postCash(n, reason)
  }

  private pull(): number {
    this.draws += 1
    return this.rng.next()
  }

  private int(minInclusive: number, maxExclusive: number): number {
    return minInclusive + Math.floor(this.pull() * (maxExclusive - minInclusive))
  }

  private pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.pull() * items.length)]
  }

  private pickWeighted(options: readonly DisruptionId[]): DisruptionId {
    let total = 0
    for (const id of options) total += EVENT_WEIGHT[id]
    let roll = this.pull() * total
    for (const id of options) {
      roll -= EVENT_WEIGHT[id]
      if (roll < 0) return id
    }
    return options[options.length - 1]
  }
}

function modifiersFrom(effect: DisruptionEffect): DisruptionModifiers {
  const staffScale: DisruptionModifiers['staffScale'] = {}
  if (effect.staffPool) staffScale[effect.staffPool] = effect.staffScale
  return {
    checkInMultiplier: effect.checkInMultiplier,
    screeningMultiplier: effect.screeningMultiplier,
    secureZone: effect.runwayWindows.length > 0,
    runwayWindows: effect.runwayWindows.map((window) => ({ ...window })),
    staffScale,
    feeMultiplier: effect.feeMultiplier,
    hotelShortRooms: effect.hotelShortRooms,
  }
}
