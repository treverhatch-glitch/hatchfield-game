import { simRandom } from '../core/rng.ts'
import {
  AIRLINES,
  FIELD_LEVEL_XP,
  PERSONA_LABEL,
  REWARD_DETAIL,
  REWARD_LABEL,
} from './catalogData.ts'
import type {
  Airline,
  AirlinePersona,
  AirlineReq,
  AirlineRewardId,
  AirlineTier,
  ParkTerm,
  StandAccess,
  StandClass,
} from './types.ts'

export * from './catalogData.ts'

/** XP thresholds in `FIELD_LEVEL_XP` map to field level 1–5. */
export function fieldLevelFromXp(xp: number): AirlineTier {
  if (xp >= FIELD_LEVEL_XP[5]) return 5
  if (xp >= FIELD_LEVEL_XP[4]) return 4
  if (xp >= FIELD_LEVEL_XP[3]) return 3
  if (xp >= FIELD_LEVEL_XP[2]) return 2
  return 1
}

export function bizModelBlurb(m: Airline['bizModel']): string {
  switch (m) {
    case 'charter':
      return 'Charter'
    case 'lcc':
      return 'LCC'
    case 'full_service':
      return 'Full-service'
    case 'cargo':
      return 'Cargo'
  }
}

const baseReq: AirlineReq = {
  stands: 1,
  fuelContract: true,
  fuelFarm: true,
  fire: true,
  police: false,
  terminal: true,
  security: 1,
  bags: true,
  snack: false,
  catering: false,
  cargo: false,
  road: true,
  tower: false,
  heavyRunway: false,
}

const PROC_NAMES = [
  'CedarLink',
  'Prairie Hop',
  'Bay Circlet',
  'Mesa Runner',
  'Lakeline',
  'Copper State',
  'Fogbank Air',
  'Redrock Express',
]
const PROC_COLORS = ['#4a6fa5', '#6a8f4e', '#8a5a3a', '#5a4a7a', '#2a6a6a', '#7a4a4a']

/** Light procedural regional — variety on the phone without replacing majors. */
export function createProcAirline(usedNames: string[] = []): Airline {
  const taken = new Set(usedNames.map((n) => n.toLowerCase()))
  const free = PROC_NAMES.filter((n) => !taken.has(n.toLowerCase()))
  const name = free.length
    ? free[Math.floor(simRandom() * free.length)]
    : `${PROC_NAMES[Math.floor(simRandom() * PROC_NAMES.length)]} ${10 + Math.floor(simRandom() * 89)}`
  const color = PROC_COLORS[Math.floor(simRandom() * PROC_COLORS.length)]
  const budget = simRandom() < 0.65
  const id = `proc-${simRandom().toString(36).slice(2, 7)}`
  return {
    id,
    name,
    color,
    stripe: '#e8eef4',
    kind: 'pax',
    persona: budget ? 'budget' : 'business',
    tier: budget ? 1 : 2,
    bizModel: budget ? 'lcc' : 'full_service',
    fleetBlurb: budget ? 'Twin turboprop · 40–68 seats' : 'Small RJ · 55–90 seats',
    landing: budget ? 4800 : 6200,
    catering: budget ? 1200 : 1800,
    bags: budget ? 900 : 1400,
    paxMin: budget ? 40 : 55,
    paxMax: budget ? 68 : 90,
    minRep: budget ? 10 : 35,
    req: {
      ...baseReq,
      stands: budget ? 1 : 2,
      police: !budget,
      snack: !budget,
      catering: !budget,
      security: budget ? 1 : 2,
      tower: !budget,
    },
    blurb: budget
      ? 'T1/T2 procedural hopper. Easy to please — until the hall fails a layover.'
      : 'T2 procedural business regional. Wants a tidy hall and a second stand.',
    likesLayovers: true,
    heatSensitivity: budget ? 1 : 1.2,
    procedural: true,
  }
}

/** Backfill tier/biz fields on older saves / procs. */
export function normalizeAirline(a: Airline): Airline {
  if (a.tier && a.bizModel && a.fleetBlurb) return a
  const kindTier: AirlineTier =
    a.kind === 'cargo' ? 3 : a.persona === 'luxury' ? 4 : a.persona === 'business' ? 3 : 2
  return {
    ...a,
    tier: a.tier ?? (a.procedural ? 1 : kindTier),
    bizModel:
      a.bizModel ??
      (a.kind === 'cargo' ? 'cargo' : a.persona === 'budget' ? 'lcc' : 'full_service'),
    fleetBlurb: a.fleetBlurb ?? (a.kind === 'cargo' ? 'Freighter' : 'Regional metal'),
  }
}

export function standAccessLabel(a: StandAccess): string {
  return a === 'jetway' ? 'Jetway gate' : 'Remote bay'
}

export function hotelClassLabel(c: 'inn' | 'business' | 'resort'): string {
  return c === 'inn' ? 'Inn' : c === 'resort' ? 'Resort' : 'Business hotel'
}

export function standClassLabel(c: StandClass): string {
  return c === 'S' ? 'Stand S' : c === 'L' ? 'Stand L' : 'Stand M'
}

export function standClassRank(c: StandClass): number {
  return c === 'S' ? 1 : c === 'M' ? 2 : 3
}

export function parkTermLabel(t: ParkTerm): string {
  return t === 'short' ? 'Short-term' : 'Long-term'
}

export function money(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
}

export function airlineList(): Airline[] {
  return Object.values(AIRLINES)
}

/** Premade majors only — procedural fillers live on Game.extraAirlines. */
export function premadeAirlineList(): Airline[] {
  return Object.values(AIRLINES)
}

export function personaBlurb(p: AirlinePersona): string {
  return PERSONA_LABEL[p]
}

/** Persona → one-time high-heat perk. */
export function rewardForPersona(p: AirlinePersona): AirlineRewardId {
  switch (p) {
    case 'luxury':
      return 'brand_lounge'
    case 'budget':
      return 'budget_perk'
    case 'business':
      return 'biz_priority'
    case 'cargo_night':
      return 'cargo_night'
    case 'military_gov':
      return 'biz_priority'
  }
}

export function rewardBlurb(id: AirlineRewardId): string {
  return REWARD_LABEL[id]
}

export function rewardDetail(id: AirlineRewardId): string {
  return REWARD_DETAIL[id]
}
