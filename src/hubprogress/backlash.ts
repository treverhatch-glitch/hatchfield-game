/**
 * What accepting Base, Hub, or Primary does to the holder's rivals.
 * One roll for the whole accept. Allies are spared.
 */
import { allianceOf, rivalsOfRoster } from '../airlines/rivals.ts'
import { RIVAL_BACKLASH, type HubOfferTier } from './config.ts'

export type RivalEffect = 'score' | 'refuse' | 'trim' | 'relocate'

export interface BacklashHit {
  airlineId: string
  name: string
  score: number
  effect: RivalEffect
}

export interface BacklashPlan {
  anger: string
  spared: string
  hit: BacklashHit[]
}

export function backlashRoll(holderId: string, tier: string, day: number): number {
  let hash = 2166136261
  const text = `${holderId}:${tier}:${day}`
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return (hash >>> 0) / 2 ** 32
}

export function angerSentence(names: readonly string[], score: number): string {
  if (names.length === 0) return ''
  const hit = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
  return `Accepting will anger ${hit} (${score}).`
}

export function sparedSentence(names: readonly string[]): string {
  if (names.length === 0) return ''
  const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
  const verb = names.length === 1 ? 'is an alliance partner and is spared.' : 'are alliance partners and are spared.'
  return `${who} ${verb}`
}

function effectFor(tier: Exclude<HubOfferTier, 'focus'>, roll: number, standing: number, poachStandingMax: number): RivalEffect {
  const row = RIVAL_BACKLASH[tier]
  if (roll < row.relocate) return standing <= poachStandingMax ? 'relocate' : 'trim'
  if (roll < row.trim) return 'trim'
  if (roll < row.refuse) return 'refuse'
  return 'score'
}

export function planBacklash(input: {
  holderId: string
  tier: HubOfferTier
  signed: readonly { id: string; name: string; standing: number }[]
  roll: number
  poachStandingMax: number
}): BacklashPlan {
  if (input.tier === 'focus') return { anger: '', spared: '', hit: [] }
  const tier = input.tier
  const row = RIVAL_BACKLASH[tier]
  const signed = new Map(input.signed.map((carrier) => [carrier.id, carrier]))
  const rivals = rivalsOfRoster(input.holderId).flatMap((id) => {
    const carrier = signed.get(id)
    return carrier ? [carrier] : []
  })
  const spared = allianceOf(input.holderId).flatMap((id) => {
    const carrier = signed.get(id)
    return carrier ? [carrier.name] : []
  })
  const roll = Number.isFinite(input.roll) ? Math.max(0, Math.min(0.999999, input.roll)) : 0.999999
  return {
    anger: angerSentence(rivals.map((carrier) => carrier.name), row.score),
    spared: sparedSentence(spared),
    hit: rivals.map((carrier) => ({
      airlineId: carrier.id,
      name: carrier.name,
      score: row.score,
      effect: effectFor(tier, roll, carrier.standing, input.poachStandingMax),
    })),
  }
}
