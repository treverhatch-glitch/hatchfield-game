/**
 * Transfers, layovers, stranded passengers and airport hotels, held for the Game.
 * The Game passes plain context objects in; nothing here reaches into the sim.
 */
import {
  ConnectionsLedger,
  LATE_BANK_FROM,
  LONG_ITINERARY_MINUTES,
  LONG_ITINERARY_SHARE,
  MISCONNECT_DELIVERY_FEE,
  MORNING_WAVE,
  OVERNIGHT_ITINERARY_SHARE,
  REBOOK_SEAT_SHARE,
  REPUTATION_PER_MISS,
  SortLoad,
  STRAND_CANCEL_SHARE,
  STRAND_DELAY_MINUTES,
  STRAND_WINDOW_MINUTES,
  chooseOvernight,
  classifyLayover,
  isNightHour,
  layoutMct,
  layoverDrain,
  layoverNeeds,
  layoverTrait,
  misconnectRate,
  planTransfer,
  rebookStranded,
  roll01,
  sortCapacityPerHour,
  withScreening,
  type ConnectionsAlert,
  type ConnectionsDay,
  type LayoutMct,
  type LayoverClass,
  type OvernightChoice,
  type RebookDeparture,
  type StrandCause,
  type TransferRoute,
  type VoucherTerms,
} from '../connections/index.ts'
import type { PassengerLink } from '../connectivity/types.ts'
import type { ConnectionVerdict, HubFacilities } from '../hub/types.ts'
import {
  LOW_OCCUPANCY,
  OUTSIDE_VOUCHER_RATE,
  clampRate,
  crewRooms,
  localStays,
  settleHotelNight,
  type HotelDemand,
  type HotelNight,
  type HotelSite,
} from '../hotels/index.ts'
import type { PaxTag } from './guests.ts'
import { SIM_MINUTES_PER_GAME_DAY, SIM_MINUTES_PER_REAL_SECOND } from '../core/clock.ts'
import { simClockToHour } from '../render/world/daylight.ts'

const DAY_MINUTES = SIM_MINUTES_PER_GAME_DAY
/** Clock sampling step, game-minutes. */
const CLOCK_STEP = 10

/** Displayed wall-clock hour (0–24) for a sim-minute. The day runs fast, the night slow. */
export function displayHour(simMinutes: number): number {
  return simClockToHour(simMinutes / SIM_MINUTES_PER_REAL_SECOND)
}

/** What the layout looks like right now, for MCT. */
export interface ConnectionsLayout {
  facilities: HubFacilities
  pairMetres: number[]
  link: PassengerLink
  walkwayMetres: number
  /** A transfer security lane exists airside (comes with the Transfer Centre). */
  transferLane: boolean
  /** Share of today's connecting traffic that is re-screened. */
  screenShare: number
}

export interface TransferGuestInput {
  guestId: string
  tag: PaxTag
  /** Share of this carrier's transfers that must be re-screened. */
  screenShare: number
  arrivalAt: number
  departureAt: number
  metres: number
  link: PassengerLink
  walkwayMetres: number
  transferLane: boolean
  verdict: ConnectionVerdict
  mct: number
  hotels: { transitRooms: number; landsideRooms: number; landsideLinked: boolean; lounge: boolean }
}

export interface TransferGuestPlan {
  screened: boolean
  route: TransferRoute
  verdict: ConnectionVerdict
  layover: LayoverClass
  needs: { hunger: number; shop: number; play: number; energy: number } | null
  drain: number
  overnight: OvernightChoice | null
}

export interface StrandSlot {
  id: string
  airlineId: string
  status: string
  /** Game-minute arrival. */
  at: number
  /** Game-minutes behind schedule. */
  delayMinutes: number
  /** Expected seats on the rotation. */
  seats: number
  /** Share of the load that connects here. */
  transferShare: number
  cargo: boolean
  cell?: { c: number; r: number }
}

export interface StrandRoll {
  stranded: number
  rebooked: number
  overnight: number
  /** Desk and meal vouchers the airport pays now. */
  airportCost: number
  news: string[]
  alert: ConnectionsAlert | null
}

export interface NightRoll {
  night: HotelNight
  day: ConnectionsDay
  /** Room revenue credited to the airport. */
  income: number
  /** Outside hotels for airport vouchers that did not fit. */
  outsideCost: number
  news: string[]
  alerts: ConnectionsAlert[]
}

export interface HotelPanelRow {
  id: string
  name: string
  stars: number
  side: 'landside' | 'airside'
  rooms: number
  rate: number
  link: string
  occupancy: number
  revenue: number
  upkeep: number
  cell?: { c: number; r: number }
}

interface BridgeSave {
  ledger: ReturnType<ConnectionsLedger['save']>
  rates: { landside: number; airside: number }
  terms: Record<string, Partial<VoucherTerms>>
  demand: HotelDemand
  prepaidVouchers: number
  odArrivals: number
  seen: string[]
  seatsTaken: Record<string, number>
  lastNight: HotelNight | null
  nights: { day: number; occupancy: number; revenue: number }[]
}

function emptyDemand(): HotelDemand {
  return { layoverAirside: 0, layoverLandside: 0, voucherAirline: 0, voucherAirport: 0, crew: 0, local: 0 }
}

export class ConnectionsBridge {
  ledger = new ConnectionsLedger()
  sortLoad = new SortLoad()
  /** Player rate setting per side (multiplier on rack). */
  rates = { landside: 1, airside: 1 }
  /** Contract voucher terms by airline. Missing terms use the defaults. */
  terms: Record<string, Partial<VoucherTerms>> = {}
  lastNight: HotelNight | null = null
  nights: { day: number; occupancy: number; revenue: number }[] = []
  private demand: HotelDemand = emptyDemand()
  /** Misconnect vouchers already billed by the hub layer. */
  private prepaidVouchers = 0
  private odArrivals = 0
  private seen = new Set<string>()
  private seatsTaken: Record<string, number> = {}

  reset() {
    this.ledger.reset()
    this.sortLoad.clear()
    this.rates = { landside: 1, airside: 1 }
    this.terms = {}
    this.lastNight = null
    this.nights = []
    this.demand = emptyDemand()
    this.prepaidVouchers = 0
    this.odArrivals = 0
    this.seen.clear()
    this.seatsTaken = {}
  }

  save(): BridgeSave {
    return {
      ledger: this.ledger.save(),
      rates: { ...this.rates },
      terms: { ...this.terms },
      demand: { ...this.demand },
      prepaidVouchers: this.prepaidVouchers,
      odArrivals: this.odArrivals,
      seen: [...this.seen].slice(-400),
      seatsTaken: { ...this.seatsTaken },
      lastNight: this.lastNight,
      nights: [...this.nights],
    }
  }

  load(raw: unknown) {
    this.reset()
    if (!raw || typeof raw !== 'object') return
    const s = raw as Partial<BridgeSave>
    this.ledger.load(s.ledger)
    if (s.rates) this.rates = { landside: clampRate(s.rates.landside), airside: clampRate(s.rates.airside) }
    if (s.terms && typeof s.terms === 'object') this.terms = { ...s.terms }
    if (s.demand) this.demand = { ...emptyDemand(), ...s.demand }
    this.prepaidVouchers = Number.isFinite(s.prepaidVouchers) ? (s.prepaidVouchers ?? 0) : 0
    this.odArrivals = Number.isFinite(s.odArrivals) ? (s.odArrivals ?? 0) : 0
    if (Array.isArray(s.seen)) this.seen = new Set(s.seen)
    if (s.seatsTaken && typeof s.seatsTaken === 'object') this.seatsTaken = { ...s.seatsTaken }
    this.lastNight = s.lastNight ?? null
    if (Array.isArray(s.nights)) this.nights = s.nights.slice(-14)
  }

  /** Today's hotel demand so far (read-only copy). */
  demandSoFar(): HotelDemand {
    return { ...this.demand, local: Math.round(localStays(this.odArrivals)) }
  }

  setRate(side: 'landside' | 'airside', mult: number) {
    this.rates[side] = clampRate(mult)
  }

  mct(layout: ConnectionsLayout): LayoutMct {
    return layoutMct(layout)
  }

  /**
   * Extra wait sold on this passenger's itinerary. Most take the first onward
   * bank; some a later flight. Late-bank arrivals may be sold the first wave
   * next morning (overnight).
   */
  itineraryOffset(guestId: string, arrivalAt: number): { offset: number; overnight: boolean } {
    const roll = roll01(`itin:${guestId}`)
    if (this.lateBank(arrivalAt) && roll < OVERNIGHT_ITINERARY_SHARE) {
      return { offset: this.untilMorning(arrivalAt), overnight: true }
    }
    if (roll >= 1 - LONG_ITINERARY_SHARE) return { offset: LONG_ITINERARY_MINUTES, overnight: false }
    return { offset: 0, overnight: false }
  }

  /** Game-minutes from this moment to the first wave next morning on the displayed clock. */
  untilMorning(at: number): number {
    for (let step = CLOCK_STEP; step <= DAY_MINUTES; step += CLOCK_STEP) {
      const hour = displayHour(at + step)
      const prev = displayHour(at + step - CLOCK_STEP)
      if (prev < MORNING_WAVE && hour >= MORNING_WAVE && hour < MORNING_WAVE + 1) return step
    }
    return DAY_MINUTES
  }

  /** The last bank of the day: with no onward flight tonight, it connects next morning. */
  lateBank(at: number): boolean {
    const hour = displayHour(at)
    return hour >= LATE_BANK_FROM || isNightHour(hour)
  }

  /** Any displayed night hour between the two moments. */
  crossesNight(from: number, to: number): boolean {
    if (!(to > from)) return false
    for (let t = from; t <= to; t += CLOCK_STEP) if (isNightHour(displayHour(t))) return true
    return isNightHour(displayHour(to))
  }

  /** Route, screening, layover class and overnight choice for one connecting passenger. */
  planGuest(input: TransferGuestInput): TransferGuestPlan {
    const screened = roll01(`screen:${input.guestId}`) < input.screenShare
    const route = planTransfer({
      metres: input.metres,
      link: input.link,
      walkwayMetres: input.walkwayMetres,
      screened,
      transferLane: input.transferLane,
    })
    const verdict = withScreening(input.verdict, route.screenMinutes)
    const wait = input.departureAt - input.arrivalAt
    const layover = classifyLayover(wait, input.mct, this.crossesNight(input.arrivalAt, input.departureAt))
    const trait = layoverTrait(input.tag)
    let needs: TransferGuestPlan['needs'] = null
    let overnight: OvernightChoice | null = null
    if (layover === 'short') needs = layoverNeeds(wait, trait)
    if (layover === 'long' || layover === 'overnight') {
      overnight = chooseOvernight(trait, { ...input.hotels, voucher: false })
      // A long day wait without a bed still browses airside.
      if (layover === 'long' && (overnight === 'lounge' || overnight === 'terminal_sleep')) {
        needs = layoverNeeds(Math.min(wait, 240), trait)
      }
    }
    const t = this.ledger
    t.add('transfers')
    if (screened) t.add('screened')
    if (!route.airsideOnly) t.add('landsideRecheck')
    if (layover === 'short') t.add('layoverShort')
    if (layover === 'long' || layover === 'overnight') t.add('layoverLong')
    if (layover === 'overnight' && overnight === 'transit_hotel') this.demand.layoverAirside += 1
    if (layover === 'overnight' && overnight === 'landside_hotel') this.demand.layoverLandside += 1
    return { screened, route, verdict, layover, needs, drain: layoverDrain(wait), overnight }
  }

  /** Bags fed to the sort. Any bag counts against capacity, not only transfers. */
  noteSorted(nowMinute: number, bags = 1) {
    this.sortLoad.add(nowMinute, bags)
  }

  /** Chance a transfer bag misses its onward flight right now. */
  misconnectRate(nowMinute: number, belts: number, facilities: HubFacilities): number {
    const capacity = sortCapacityPerHour({ belts, ...facilities })
    return misconnectRate(this.sortLoad.perHour(nowMinute), capacity, facilities.rfid)
  }

  /** One window closed. Returns the reputation hit for a miss. */
  noteResolved(made: boolean, belowMct: boolean): number {
    if (made) {
      this.ledger.add('made')
      return 0
    }
    this.ledger.add('missed')
    if (belowMct) this.ledger.add('missedMct')
    return REPUTATION_PER_MISS
  }

  /** Transfer bags through the sort, and how many missed. Returns the courier bill. */
  noteTransferBags(total: number, misconnected: number): number {
    this.ledger.add('transferBags', total)
    this.ledger.add('misconnectedBags', misconnected)
    return misconnected * MISCONNECT_DELIVERY_FEE
  }

  /** Local visitors and night-stopping crews, from one arrival. */
  noteArrival(opts: { odPax: number; seats: number; at: number; hub: boolean; cargo: boolean }) {
    if (opts.cargo) return
    this.odArrivals += Math.max(0, opts.odPax)
    this.demand.crew += crewRooms(opts.seats, displayHour(opts.at), opts.hub)
  }

  alert(kind: ConnectionsAlert['kind'], text: string, cell?: { c: number; r: number }): ConnectionsAlert {
    return this.ledger.alert({ kind, text, cell })
  }

  /**
   * Strand passengers from cancels close to departure and from long delays,
   * then rebook them on later departures of the same airline. Each slot
   * strands once. Anyone without a seat tonight gets a hotel voucher.
   */
  scanDisruptions(slots: readonly StrandSlot[], now: number, day: number): StrandRoll {
    const groups: { id: string; airlineId: string; pax: number; cause: StrandCause; at: number; cell?: { c: number; r: number } }[] = []
    for (const slot of slots) {
      if (slot.cargo || !(slot.seats > 0)) continue
      // Each rotation strands once, whether it is delayed into the night and later cancelled or not.
      if (this.seen.has(`s:${slot.id}`)) continue
      if (slot.status === 'cancelled') {
        this.seen.add(`s:${slot.id}`)
        // An early cancel is rebooked in advance; nobody is stuck here yet.
        if (slot.at - now > STRAND_WINDOW_MINUTES) continue
        const pax = Math.round(slot.seats * STRAND_CANCEL_SHARE)
        if (pax > 0) groups.push({ id: slot.id, airlineId: slot.airlineId, pax, cause: 'cancel', at: now, cell: slot.cell })
        continue
      }
      if (slot.status === 'cancelled' || slot.status === 'done') continue
      // A long delay that pushes the rotation into the night strands its departing load.
      // Connecting passengers on a late inbound are already missed connections in the hub layer.
      const cutoff = this.nightCutoff(Math.floor(slot.at / DAY_MINUTES))
      const intoNight = slot.at <= cutoff && slot.at + slot.delayMinutes > cutoff
      if (slot.delayMinutes >= STRAND_DELAY_MINUTES && intoNight) {
        this.seen.add(`s:${slot.id}`)
        const pax = Math.round(slot.seats * STRAND_CANCEL_SHARE)
        if (pax > 0) groups.push({ id: slot.id, airlineId: slot.airlineId, pax, cause: 'delay', at: now, cell: slot.cell })
      }
    }
    return this.rebook(groups, slots, day)
  }

  /**
   * Missed connections billed by the hub layer still need a seat or a bed.
   * Their compensation is already paid, so no voucher cost posts here.
   */
  strandMissed(airlineId: string, pax: number, slots: readonly StrandSlot[], now: number, day: number): StrandRoll {
    if (!(pax > 0)) return this.rebook([], slots, day)
    const id = `m:${airlineId}:${Math.round(now)}:${this.ledger.today.missed}`
    return this.rebook([{ id, airlineId, pax, cause: 'misconnect', at: now }], slots, day, true)
  }

  private rebook(
    groups: { id: string; airlineId: string; pax: number; cause: StrandCause; at: number; cell?: { c: number; r: number } }[],
    slots: readonly StrandSlot[],
    day: number,
    prepaid = false,
  ): StrandRoll {
    const empty: StrandRoll = { stranded: 0, rebooked: 0, overnight: 0, airportCost: 0, news: [], alert: null }
    if (!groups.length) return empty
    const departures: RebookDeparture[] = slots
      .filter((s) => !s.cargo && s.status !== 'cancelled' && s.status !== 'done')
      .map((s) => ({
        id: s.id,
        airlineId: s.airlineId,
        at: s.at + s.delayMinutes,
        seatsFree: Math.max(0, Math.round(s.seats * REBOOK_SEAT_SHARE) - (this.seatsTaken[s.id] ?? 0)),
      }))
    const cutoff = this.nightCutoff(day)
    const results = rebookStranded(groups, departures, { cutoff, terms: (id) => this.terms[id] })
    const roll = { ...empty, news: [] as string[] }
    for (const result of results) {
      for (const [dep, n] of Object.entries(result.taken)) this.seatsTaken[dep] = (this.seatsTaken[dep] ?? 0) + n
      const pax = result.sameDay + result.overnight
      roll.stranded += pax
      roll.rebooked += result.sameDay
      roll.overnight += result.overnight
      this.ledger.add('stranded', pax)
      this.ledger.add('rebooked', result.sameDay)
      this.ledger.add('overnight', result.overnight)
      const cost = prepaid ? 0 : result.handling
      if (result.payer === 'airport') {
        this.demand.voucherAirport += result.overnight
        if (prepaid) this.prepaidVouchers += result.overnight
        this.ledger.add('voucherAirport', cost)
        roll.airportCost += cost
      } else {
        this.demand.voucherAirline += result.overnight
        this.ledger.add('voucherAirline', cost)
      }
      if (result.cause !== 'misconnect') {
        const why = result.cause === 'cancel' ? 'cancellation' : 'long delay'
        const night = result.overnight > 0 ? `, ${result.overnight} need a hotel tonight` : ''
        roll.news.push(`${pax} stranded by a ${why} — ${result.sameDay} rebooked${night} (${result.payer} pays).`)
      }
    }
    const worst = groups.find((g) => g.cause !== 'misconnect')
    if (worst && roll.stranded > 0) {
      roll.alert = this.alert(
        'stranded',
        `${roll.stranded} stranded passengers — ${roll.overnight} overnight`,
        worst.cell,
      )
    }
    return roll
  }

  /** Sim-minute on this game day when the displayed clock reaches the night window. */
  nightCutoff(day: number): number {
    const start = day * DAY_MINUTES
    for (let t = start; t < start + DAY_MINUTES; t += CLOCK_STEP) {
      if (isNightHour(displayHour(t))) return t
    }
    return start + DAY_MINUTES
  }

  /**
   * Book tonight's rooms and close the connections day.
   * Room revenue is credited; airport vouchers past the rooms go outside at cost.
   */
  closeDay(day: number, hotels: readonly HotelSite[]): NightRoll {
    const demand = this.demandSoFar()
    const night = settleHotelNight(hotels, demand, (this.rates.landside + this.rates.airside) / 2)
    const paidOutside = Math.max(0, night.overflow.voucherAirport - this.prepaidVouchers)
    const outsideCost = paidOutside * OUTSIDE_VOUCHER_RATE
    this.ledger.add('voucherAirport', outsideCost)
    const news: string[] = []
    const alerts: ConnectionsAlert[] = []
    const stuck = night.overflow.layoverAirside + night.overflow.layoverLandside + night.overflow.voucherAirline
    if (hotels.length && stuck + night.overflow.voucherAirport > 0) {
      const full = [...night.lines].sort((a, b) => b.occupancy - a.occupancy)[0]
      const site = hotels.find((h) => h.id === full?.id)
      alerts.push(
        this.alert(
          'hotel_full',
          `Hotels full — ${stuck + night.overflow.voucherAirport} guests turned away last night`,
          site?.cell,
        ),
      )
    } else if (!hotels.length && demand.layoverAirside + demand.layoverLandside + demand.voucherAirport > 0) {
      news.push('No airport hotel — overnight transfers slept in the terminal.')
    }
    for (const line of night.lines) {
      if (line.rooms > 0 && line.occupancy < LOW_OCCUPANCY) {
        news.push(`${line.name} ran ${Math.round(line.occupancy * 100)}% full — rates or links?`)
        break
      }
    }
    if (night.revenue > 0) news.push(`Hotels: ${night.occupied}/${night.rooms} rooms, +$${night.revenue.toLocaleString('en-US')}.`)
    this.lastNight = night
    this.nights = [...this.nights, { day, occupancy: night.occupancy, revenue: night.revenue }].slice(-14)
    this.demand = emptyDemand()
    this.prepaidVouchers = 0
    this.odArrivals = 0
    this.seatsTaken = {}
    const done = this.ledger.closeDay(day + 1)
    return { night, day: done, income: night.revenue, outsideCost, news, alerts }
  }
}
