/**
 * The 45-airline roster as playable game airlines. Each roster carrier takes
 * the economics and facility asks of a catalog carrier of the same kind
 * (ROSTER_TEMPLATE), its own name, colours and fleet, and a reputation gate
 * from the roster unlock table. Liveries come from procLivery: a flight whose
 * airline id is a roster id is painted procedurally.
 */
import { ROSTER, rosterAirline, rosterByType, type AirlineType, type RosterAirline } from '../airlines/roster.ts'
import { unlockGate } from '../airlines/rosterOffers.ts'
import { AIRLINES } from './catalog.ts'
import type { Airline, AirlineBizModel, AirlinePersona } from './types.ts'

interface Template {
  /** Catalog carrier whose fees, demand and asks this roster airline copies, by rank within its type. */
  base: readonly string[]
  persona?: AirlinePersona
  bizModel?: AirlineBizModel
  paxMin?: number
  paxMax?: number
}

/** Tunable: which catalog carrier each roster type plays like. */
export const ROSTER_TEMPLATE: Record<AirlineType, Template> = {
  heli: { base: ['bushline'], persona: 'business', bizModel: 'charter', paxMin: 4, paxMax: 12 },
  regional: { base: ['bushline', 'northline', 'northline', 'northline'] },
  budget: { base: ['northline', 'harbor'], persona: 'budget', bizModel: 'lcc' },
  charter: { base: ['harbor'], persona: 'budget', bizModel: 'charter' },
  cargo: { base: ['upps', 'umazon', 'umazon', 'exfed'] },
  flag: { base: ['harbor', 'summit', 'summit', 'summit', 'summit', 'crown'], persona: 'luxury', bizModel: 'full_service' },
}

const TYPE_LABEL: Record<AirlineType, string> = {
  heli: 'Helicopter operator',
  regional: 'Regional',
  budget: 'Low-cost',
  charter: 'Leisure charter',
  cargo: 'Freight',
  flag: 'Flag carrier',
}

/** Catalog ids: still resolvable, no longer sending new letters while the roster is live. */
export const CATALOG_AIRLINE_IDS: ReadonlySet<string> = new Set(Object.keys(AIRLINES))

function toGame(r: RosterAirline): Airline {
  const t = ROSTER_TEMPLATE[r.type]
  const rank = Math.max(0, rosterByType(r.type).findIndex((a) => a.id === r.id))
  const base = AIRLINES[t.base[Math.min(rank, t.base.length - 1)]] ?? AIRLINES.northline
  const gate = unlockGate(r)
  return {
    ...base,
    req: { ...base.req },
    id: r.id,
    name: r.name,
    color: r.primary,
    stripe: r.secondary,
    persona: t.persona ?? base.persona,
    bizModel: t.bizModel ?? base.bizModel,
    paxMin: t.paxMin ?? base.paxMin,
    paxMax: t.paxMax ?? base.paxMax,
    minRep: gate.reputation,
    fleetBlurb: r.fleet.map((id) => id.toUpperCase()).join(' / '),
    blurb: `${TYPE_LABEL[r.type]} · ${r.code}. Talks once the field is size ${gate.size}+ with reputation ${gate.reputation}+.`,
  }
}

let cache: Map<string, Airline> | null = null

function table(): Map<string, Airline> {
  if (!cache) cache = new Map(ROSTER.map((r) => [r.id, toGame(r)]))
  return cache
}

/** All 45 roster carriers as game airlines, in roster order. */
export function rosterGameAirlines(): Airline[] {
  return [...table().values()]
}

export function rosterGameAirline(id: string): Airline | undefined {
  return table().get(id)
}

export function isRosterAirlineId(id: string): boolean {
  return table().has(id)
}

/** Roster fleet ids for a carrier (aircraft model ids), or undefined for non-roster ids. */
export function rosterFleet(id: string): readonly string[] | undefined {
  return rosterAirline(id)?.fleet
}

export function rosterType(id: string): AirlineType | undefined {
  return rosterAirline(id)?.type
}
