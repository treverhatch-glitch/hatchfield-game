import {
  buyClearance,
  cancelMilitaryContract,
  createInboundState,
  daySorties,
  militaryTemplate,
  nightSorties,
  offerMilitaryContract,
  respond,
  signMilitaryContract,
  spawnOffer,
  tick,
  type InboundEvent,
  type InboundState,
  type InboundWorld,
  type LedgerEntry,
  type RequestKind,
  type RespondChoice,
} from '../inbound/index.ts'

/** Airframes the live field may use for each inbound kind, widest first. */
export const INBOUND_AIRFRAMES: Record<RequestKind, readonly string[]> = {
  weather_divert: ['a320neo', 'b738', 'e175'],
  medical: ['a320neo', 'b738', 'e175'],
  fuel_low: ['a320neo', 'b738', 'e175'],
  technical: ['a320neo', 'b738', 'e175'],
  vip: ['a320neo', 'citation', 'e175'],
  medevac: ['aw139'],
  tanker: ['cl415', 'at802'],
  tanker_mx: ['cl415', 'at802'],
  military: ['c130', 'c17'],
  ga: ['pc12', 'citation'],
  bizjet: ['citation', 'pc12'],
  charter: ['a320neo', 'b738', 'e175'],
  ferry: ['a320neo', 'b738', 'e175'],
  storage: ['pc12', 'citation'],
}

const CALLSIGN: Record<RequestKind, string> = {
  weather_divert: 'DIV',
  medical: 'MED',
  fuel_low: 'FUL',
  technical: 'TEC',
  vip: 'VIP',
  medevac: 'EVAC',
  tanker: 'TANK',
  tanker_mx: 'TMX',
  military: 'RDR',
  ga: 'GA',
  bizjet: 'BIZ',
  charter: 'CHR',
  ferry: 'FRY',
  storage: 'PRK',
}

export function inboundCallsign(kind: RequestKind, seq: number): string {
  return `${CALLSIGN[kind]}${seq}`
}

/** One row for the airlines Contracts section. */
export interface InboundContractRow {
  id: string
  templateId: string
  name: string
  status: string
  daySorties: number
  nightSorties: number
  noisePerNight: number
  approvalPerNight: number
}

/** Compact accept / refuse card. One of these is open at a time. */
export interface InboundOfferView {
  id: string
  title: string
  blurb: string
  priority: boolean
  reward: number
  fine: number
  dailyFee: number
  stayDays: number
  secondsLeft: number
  needs: string
}

/**
 * Holds the inbound module next to the sim.
 * The sim builds the world, posts the ledger, and spawns the aircraft.
 */
export class InboundBridge {
  state: InboundState
  /** Ledger rows already copied onto the airport books. */
  applied = 0

  constructor(seed = 1) {
    this.state = createInboundState(seed)
  }

  static restore(saved: InboundState | undefined, seed = 1): InboundBridge {
    const bridge = new InboundBridge(seed)
    if (saved?.version === 1 && Array.isArray(saved.requests)) {
      bridge.state = saved
      bridge.applied = saved.ledger.length
    }
    return bridge
  }

  offer(now: number): InboundOfferView | null {
    const request = this.state.requests.find((item) => item.status === 'pending')
    if (!request) return null
    return {
      id: request.id,
      title: request.title,
      blurb: request.blurb,
      priority: request.priority,
      reward: request.reward,
      fine: request.fineOnRefuse,
      dailyFee: request.dailyFee,
      stayDays: request.stayDays,
      secondsLeft: Math.max(0, request.deadline - now),
      needs: needLine(request.needs),
    }
  }

  /**
   * Catch the module clock up to the game clock.
   * A new Guard agreement offers a contract immediately.
   */
  advance(world: InboundWorld, dt: number, milAgreement: boolean): InboundEvent[] {
    const events: InboundEvent[] = []
    if (milAgreement && !this.state.licence.guardAgreement) {
      this.state.licence.guardAgreement = true
      const live = this.state.deals.some((deal) => {
        const status = deal.contract.status
        return status === 'offered' || status === 'active' || status === 'expiring'
      })
      if (!live) {
        const offered = offerMilitaryContract(this.state)
        if (offered.ok) events.push({ type: 'military_offered', contractId: offered.deal.contract.id })
      }
    }
    if (dt > 0) events.push(...tick(this.state, world, dt))
    return events
  }

  respond(world: InboundWorld, requestId: string, choice: RespondChoice): InboundEvent[] {
    return respond(this.state, world, requestId, choice)
  }

  /** Open one card now. Tests use this to force a kind. */
  inject(kind: RequestKind) {
    return spawnOffer(this.state, kind)
  }

  sign(contractId: string) {
    return signMilitaryContract(this.state, contractId)
  }

  cancel(contractId: string) {
    return cancelMilitaryContract(this.state, contractId)
  }

  buyClearance() {
    return buyClearance(this.state)
  }

  clearance(): boolean {
    return this.state.licence.clearance
  }

  contracts(): InboundContractRow[] {
    return this.state.deals.map((deal) => {
      let name = deal.templateId
      try {
        name = militaryTemplate(deal.templateId).name
      } catch {
        /* keep the id */
      }
      return {
        id: deal.contract.id,
        templateId: deal.templateId,
        name,
        status: deal.contract.status,
        daySorties: daySorties(deal.contract),
        nightSorties: nightSorties(deal.contract),
        noisePerNight: deal.noisePerNight,
        approvalPerNight: deal.approvalPerNight,
      }
    })
  }

  /** Ledger rows posted since the last drain. */
  freshLedger(): LedgerEntry[] {
    const rows = this.state.ledger.slice(this.applied)
    this.applied = this.state.ledger.length
    return rows
  }
}

function needLine(needs: {
  pad: string
  arff: boolean
  ambulance: boolean
  securityCorridor: boolean
  catering: boolean
  cleaning: boolean
  gpu: boolean
  customs: boolean
  fuelLitres: number
  hotelRooms: number
  hangarBays: number
  runwayMetres: number
}): string {
  const bits: string[] = []
  if (needs.pad !== 'none') bits.push(needs.pad)
  if (needs.arff) bits.push('ARFF')
  if (needs.ambulance) bits.push('ambulance')
  if (needs.securityCorridor) bits.push('corridor')
  if (needs.catering) bits.push('catering')
  if (needs.cleaning) bits.push('cleaning')
  if (needs.gpu) bits.push('GPU')
  if (needs.customs) bits.push('customs')
  if (needs.fuelLitres > 0) bits.push(`${Math.round(needs.fuelLitres).toLocaleString('en-US')} L`)
  if (needs.hotelRooms > 0) bits.push(`${needs.hotelRooms} rooms`)
  if (needs.hangarBays > 0) bits.push('hangar')
  if (needs.runwayMetres > 0) bits.push(`${needs.runwayMetres}m`)
  return bits.join(' · ')
}
