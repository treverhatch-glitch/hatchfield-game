import { SIM_MINUTES_PER_GAME_DAY } from '../core/clock.ts'
import type { MoneyCategory } from '../core/bank.ts'
import { decideStay, makeBids } from './bids.ts'
import {
  CAMPAIGNS,
  DAYS_PER_YEAR,
  LEASE_DAYS,
  MAX_CATCHUP_DAYS,
  MAX_DAILY_RENT,
  PRESTIGE_CAP,
  QUALITY_SPEND,
  RENEW_RENT_BUMP,
  SPEND_PER_PAX,
  type CampaignKind,
} from './config.ts'
import { createRng } from './rng.ts'
import { buildYearReport, evaluateAwards, operatingTotals } from './report.ts'
import type {
  Lease,
  RunningCampaign,
  TenantBid,
  TenantUnit,
  TycoonBooks,
  TycoonNote,
  TycoonPulse,
  TycoonState,
  TycoonView,
  YearBucket,
} from './types.ts'

function emptyBucket(): YearBucket {
  return { passengers: 0, satisfactionSum: 0, satisfactionN: 0, cleanlinessSum: 0, cleanlinessN: 0 }
}

function fresh(seed: number, processedDay: number): TycoonState {
  const rng = createRng(seed)
  return {
    seed,
    rngState: rng.getState(),
    seq: 1,
    processedDay,
    units: [],
    leases: [],
    bids: {},
    rerollDay: {},
    campaigns: [],
    prestige: 0,
    awards: [],
    bucket: emptyBucket(),
    pendingReport: null,
  }
}

function clamp01(n: number, hi = 100): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(hi, n))
}

export class TycoonEngine {
  private state: TycoonState

  constructor(seed = 1) {
    this.state = fresh(seed, -1)
  }

  snapshot(): TycoonState {
    return structuredClone(this.state)
  }

  /** Missing or broken saves start at `processedDay` so old fields do not replay a backlog. */
  restore(raw: unknown, processedDay: number) {
    if (!raw || typeof raw !== 'object') {
      this.state = fresh(1, processedDay)
      return
    }
    const s = raw as Partial<TycoonState>
    if (typeof s.processedDay !== 'number' || !Array.isArray(s.units) || !Array.isArray(s.leases)) {
      this.state = fresh(typeof s.seed === 'number' ? s.seed : 1, processedDay)
      return
    }
    const seed = typeof s.seed === 'number' ? s.seed : 1
    const base = fresh(seed, s.processedDay)
    this.state = {
      ...base,
      ...s,
      seed,
      rngState: typeof s.rngState === 'number' ? s.rngState : base.rngState,
      seq: typeof s.seq === 'number' ? s.seq : 1,
      units: s.units,
      leases: s.leases,
      bids: s.bids && typeof s.bids === 'object' ? s.bids : {},
      rerollDay: s.rerollDay && typeof s.rerollDay === 'object' ? s.rerollDay : {},
      campaigns: Array.isArray(s.campaigns) ? s.campaigns : [],
      prestige: typeof s.prestige === 'number' ? s.prestige : 0,
      awards: Array.isArray(s.awards) ? s.awards : [],
      bucket: s.bucket ?? emptyBucket(),
      pendingReport: s.pendingReport ?? null,
    }
  }

  reset(seed = 1) {
    this.state = fresh(seed, -1)
  }

  demandMultiplier(day: number): number {
    let boost = 0
    for (const run of this.activeCampaigns(day)) {
      boost += CAMPAIGNS.find((c) => c.kind === run.kind)?.demandBoost ?? 0
    }
    return 1 + boost
  }

  airlineInterest(day: number): number {
    let pull = 0
    for (const run of this.activeCampaigns(day)) {
      pull += CAMPAIGNS.find((c) => c.kind === run.kind)?.airlineInterest ?? 0
    }
    return pull
  }

  pendingReport() {
    return this.state.pendingReport
  }

  /** Civic votes and other late-game systems may add to the same capped prestige score. */
  addPrestige(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return
    this.state.prestige = Math.min(PRESTIGE_CAP, this.state.prestige + Math.round(amount))
  }

  view(day: number): TycoonView {
    const active = this.activeCampaigns(day)
    return {
      units: this.state.units.map((unit) => {
        const lease = this.leaseFor(unit.id)
        return {
          id: unit.id,
          kind: unit.kind,
          label: unit.label,
          bids: lease ? [] : (this.state.bids[unit.id] ?? []),
          lease,
          daysLeft: lease ? Math.max(0, lease.endDay - day) : null,
        }
      }),
      campaigns: CAMPAIGNS.map((card) => {
        const mine = active.find((c) => c.kind === card.kind)
        return {
          kind: card.kind,
          label: card.label,
          cost: card.cost,
          days: card.days,
          blurb: card.blurb,
          demandBoost: card.demandBoost,
          airlineInterest: card.airlineInterest,
          activeDaysLeft: mine ? mine.endDay - day : null,
          blocked: active.length > 0 && !mine,
        }
      }),
      demandMultiplier: this.demandMultiplier(day),
      airlineInterest: this.airlineInterest(day),
      prestige: this.state.prestige,
      awards: this.state.awards,
      report: this.state.pendingReport,
    }
  }

  syncUnits(units: readonly TenantUnit[]): TycoonNote[] {
    const notes: TycoonNote[] = []
    const keep = new Set(units.map((u) => u.id))
    for (const unit of [...this.state.units]) {
      if (keep.has(unit.id)) continue
      const lease = this.leaseFor(unit.id)
      this.state.units = this.state.units.filter((u) => u.id !== unit.id)
      this.state.leases = this.state.leases.filter((l) => l.unitId !== unit.id)
      delete this.state.bids[unit.id]
      delete this.state.rerollDay[unit.id]
      if (lease) notes.push({ text: `${lease.brand} left ${unit.label}. The unit closed.`, tone: 'ok' })
    }
    for (const unit of units) {
      const known = this.state.units.find((u) => u.id === unit.id)
      if (!known) {
        this.state.units.push({ ...unit })
        if (!this.leaseFor(unit.id)) {
          this.state.bids[unit.id] = this.openBids(unit)
          notes.push({ text: `${unit.label} is empty. Brands sent bids.`, tone: 'good' })
        }
        continue
      }
      known.label = unit.label
      known.kind = unit.kind
      if (!this.leaseFor(unit.id) && !(this.state.bids[unit.id]?.length)) {
        this.state.bids[unit.id] = this.openBids(unit)
        notes.push({ text: `${unit.label} is empty. Brands sent bids.`, tone: 'good' })
      }
    }
    return notes
  }

  acceptBid(unitId: string, bidId: string, day: number): TycoonNote[] {
    if (this.leaseFor(unitId)) return [{ text: 'That unit already has a tenant.', tone: 'bad' }]
    const bids = this.state.bids[unitId] ?? []
    const bid = bids.find((b) => b.id === bidId)
    const unit = this.state.units.find((u) => u.id === unitId)
    if (!bid || !unit) return [{ text: 'That bid is gone.', tone: 'bad' }]
    const lease: Lease = {
      id: this.nextId('lease'),
      unitId,
      brand: bid.brand,
      kind: bid.kind,
      dailyRent: bid.dailyRent,
      revenueShare: bid.revenueShare,
      quality: bid.quality,
      startDay: day,
      endDay: day + LEASE_DAYS,
      renewed: 0,
    }
    this.state.leases.push(lease)
    delete this.state.bids[unitId]
    const share = Math.round(bid.revenueShare * 100)
    return [
      {
        text: `${bid.brand} takes ${unit.label} — $${bid.dailyRent}/day and ${share}% of sales, ${LEASE_DAYS} days.`,
        tone: 'good',
      },
    ]
  }

  rerollBids(unitId: string, day: number): TycoonNote[] {
    if (this.leaseFor(unitId)) return [{ text: 'A tenant is already in.', tone: 'bad' }]
    const unit = this.state.units.find((u) => u.id === unitId)
    if (!unit) return [{ text: 'That unit is gone.', tone: 'bad' }]
    if ((this.state.rerollDay[unitId] ?? -1) >= day) {
      return [{ text: `${unit.label} can ask for new bids tomorrow.`, tone: 'ok' }]
    }
    this.state.rerollDay[unitId] = day
    this.state.bids[unitId] = this.openBids(unit)
    return [{ text: `New bids in for ${unit.label}.`, tone: 'ok' }]
  }

  startCampaign(books: TycoonBooks, kind: CampaignKind, day: number, simMinutes: number): TycoonNote[] {
    const card = CAMPAIGNS.find((c) => c.kind === kind)
    if (!card) return [{ text: 'Unknown campaign.', tone: 'bad' }]
    if (this.activeCampaigns(day).length) {
      return [{ text: 'A campaign is already running. Wait it out.', tone: 'bad' }]
    }
    const paid = this.pay(books, 'advertising', -card.cost, simMinutes, `${card.label} campaign`)
    if (!paid) return [{ text: `Need $${card.cost.toLocaleString('en-US')} for the ${card.label.toLowerCase()} campaign.`, tone: 'bad' }]
    const run: RunningCampaign = {
      id: this.nextId('ad'),
      kind,
      startDay: day,
      endDay: day + card.days,
      cost: card.cost,
    }
    this.state.campaigns.push(run)
    return [
      {
        text: `${card.label} campaign is up for ${card.days} days (−$${card.cost.toLocaleString('en-US')}).`,
        tone: 'good',
      },
    ]
  }

  dismissReport() {
    this.state.pendingReport = null
  }

  /**
   * Close every finished game day up to, but not including, `currentDay`.
   * Rent, revenue share, renewals, and the year card post here.
   */
  catchUp(books: TycoonBooks, currentDay: number, pulse: (day: number) => TycoonPulse): TycoonNote[] {
    const first = this.state.processedDay + 1
    const last = currentDay - 1
    if (last < first) return []
    if (last - first + 1 > MAX_CATCHUP_DAYS) {
      this.state.processedDay = last
      return []
    }
    const notes: TycoonNote[] = []
    for (let day = first; day <= last; day++) notes.push(...this.closeDay(books, day, pulse(day)))
    this.state.processedDay = last
    this.pruneCampaigns(currentDay)
    return notes
  }

  private closeDay(books: TycoonBooks, day: number, raw: TycoonPulse): TycoonNote[] {
    const notes: TycoonNote[] = []
    const pulse: TycoonPulse = {
      passengers: Math.max(0, Math.round(raw.passengers) || 0),
      satisfaction: clamp01(raw.satisfaction),
      cleanliness: clamp01(raw.cleanliness),
    }
    const stamp = (day + 1) * SIM_MINUTES_PER_GAME_DAY - 1
    for (const lease of this.state.leases) {
      if (day < lease.startDay || day >= lease.endDay) continue
      this.pay(books, 'contract_fees', lease.dailyRent, stamp, `${lease.brand} rent`)
      const sales = pulse.passengers * SPEND_PER_PAX[lease.kind] * QUALITY_SPEND[lease.quality]
      const cut = Math.round(sales * lease.revenueShare)
      if (cut > 0) this.pay(books, 'retail_sales', cut, stamp, `${lease.brand} sales share`)
    }
    for (const lease of [...this.state.leases]) {
      if (day + 1 < lease.endDay) continue
      const unit = this.state.units.find((u) => u.id === lease.unitId)
      const stay = decideStay(pulse.satisfaction, pulse.passengers, lease.quality, this.rng().next())
      if (stay === 'renew') {
        lease.renewed += 1
        lease.startDay = lease.endDay
        lease.endDay += LEASE_DAYS
        lease.dailyRent = Math.min(MAX_DAILY_RENT, Math.round(lease.dailyRent * RENEW_RENT_BUMP))
        notes.push({
          text: `${lease.brand} renewed ${unit?.label ?? 'the unit'} for ${LEASE_DAYS} more days.`,
          tone: 'good',
        })
      } else {
        this.state.leases = this.state.leases.filter((l) => l.id !== lease.id)
        if (unit) {
          this.state.bids[unit.id] = this.openBids(unit)
          notes.push({
            text: `${lease.brand} left ${unit.label}. New bids are in.`,
            tone: 'ok',
          })
        }
      }
    }
    this.state.bucket.passengers += pulse.passengers
    this.state.bucket.satisfactionSum += pulse.satisfaction
    this.state.bucket.satisfactionN += 1
    this.state.bucket.cleanlinessSum += pulse.cleanliness
    this.state.bucket.cleanlinessN += 1
    if ((day + 1) % DAYS_PER_YEAR === 0) notes.push(...this.closeYear(books, day))
    return notes
  }

  private closeYear(books: TycoonBooks, day: number): TycoonNote[] {
    const year = Math.floor(day / DAYS_PER_YEAR) + 1
    const fromDay = (year - 1) * DAYS_PER_YEAR
    const toDay = year * DAYS_PER_YEAR
    const totals = operatingTotals(
      books.entriesBetween(fromDay * SIM_MINUTES_PER_GAME_DAY, toDay * SIM_MINUTES_PER_GAME_DAY),
    )
    const bucket = this.state.bucket
    const satisfaction = bucket.satisfactionN ? bucket.satisfactionSum / bucket.satisfactionN : 0
    const cleanliness = bucket.cleanlinessN ? bucket.cleanlinessSum / bucket.cleanlinessN : 0
    const leased = this.state.leases.length
    const units = this.state.units.length
    const avgQuality = leased
      ? this.state.leases.reduce((sum, l) => sum + l.quality, 0) / leased
      : 0
    const net = totals.revenue - totals.costs
    const awards = evaluateAwards(
      {
        passengers: bucket.passengers,
        satisfaction,
        cleanliness,
        net,
        leased,
        units,
        avgQuality,
      },
      year,
    )
    for (const award of awards) {
      this.state.prestige = Math.min(PRESTIGE_CAP, this.state.prestige + award.prestige)
      this.state.awards.push(award)
    }
    this.state.pendingReport = buildYearReport(
      {
        year,
        fromDay,
        toDay,
        revenue: totals.revenue,
        costs: totals.costs,
        passengers: bucket.passengers,
        satisfaction,
        cleanliness,
      },
      awards,
    )
    this.state.bucket = emptyBucket()
    const notes: TycoonNote[] = [{ text: `Year ${year} report is ready.`, tone: 'ok' }]
    for (const award of awards) {
      notes.push({
        text: `Award: ${award.name}. Prestige +${award.prestige}, reputation +${award.reputation}.`,
        tone: 'good',
        reputation: award.reputation,
      })
    }
    return notes
  }

  private activeCampaigns(day: number): RunningCampaign[] {
    return this.state.campaigns.filter((c) => day >= c.startDay && day < c.endDay)
  }

  private pruneCampaigns(day: number) {
    this.state.campaigns = this.state.campaigns.filter((c) => day < c.endDay + DAYS_PER_YEAR)
  }

  private leaseFor(unitId: string): Lease | null {
    return this.state.leases.find((l) => l.unitId === unitId) ?? null
  }

  private openBids(unit: TenantUnit): TenantBid[] {
    return makeBids(unit, this.rng(), () => this.nextId('bid'))
  }

  private rng() {
    const rng = createRng(this.state.seed)
    rng.setState(this.state.rngState)
    const next = rng.next.bind(rng)
    const wrapped = () => {
      const value = next()
      this.state.rngState = rng.getState()
      return value
    }
    return { next: wrapped }
  }

  private nextId(prefix: string): string {
    const id = `${prefix}-${this.state.seq}`
    this.state.seq += 1
    return id
  }

  private pay(
    books: TycoonBooks,
    category: MoneyCategory,
    amount: number,
    simMinutes: number,
    label: string,
  ): boolean {
    const rounded = Math.round(amount)
    if (!Number.isFinite(rounded) || rounded === 0) return false
    return books.post(category, rounded, {
      simMinutes: Math.max(0, simMinutes),
      source: 'tycoon',
      sourceId: label,
      label,
    })
  }
}
