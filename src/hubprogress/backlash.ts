/**
 * What accepting Base, Hub, or Primary does to the holder's rivals.
 * One roll for the whole accept. Allies are spared.
 */
import { allianceOf, pairIntensity, rivalsOfRoster, type PairIntensity } from '../airlines/rivals.ts'
import { RIVAL_BACKLASH, type HubOfferTier } from './config.ts'

export type RivalEffect = 'score' | 'refuse' | 'trim' | 'relocate'

export interface BacklashHit {
  airlineId: string
  name: string
  /** Ladder hit after relationship scale and pair intensity. Negative. */
  score: number
  standing: number
  intensity: PairIntensity
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

/** A rival at +76 takes much less. One already negative takes more. */
export function relationshipScale(standing: number): number {
  const s = Math.max(-100, Math.min(100, Number.isFinite(standing) ? standing : 0))
  return Math.max(0.2, Math.round((1 - (s / 100) * 0.8) * 1000) / 1000)
}

const INTENSITY_MULT: Record<PairIntensity, number> = { ally: 0, none: 0, fierce: 1.6, rival: 1 }

export function scaledHit(base: number, standing: number, intensity: PairIntensity): number {
  const mult = INTENSITY_MULT[intensity]
  if (base === 0 || mult === 0) return 0
  return Math.round(base * relationshipScale(standing) * mult * 10) / 10
}

export function effectLabel(effect: RivalEffect, intensity: PairIntensity): string {
  const tone = intensity === 'fierce' ? 'fierce rival' : intensity === 'rival' ? 'rival' : 'ally'
  if (effect === 'relocate') return `${tone} · may move to Bellwater`
  if (effect === 'trim') return `${tone} · may cut flights`
  if (effect === 'refuse') return `${tone} · may refuse the next ask`
  return `${tone} · absorbs it`
}

function effectFor(tier: Exclude<HubOfferTier, 'focus'>, roll: number, standing: number, poachStandingMax: number): RivalEffect {
  const row = RIVAL_BACKLASH[tier]
  const bias = standing < 0 ? Math.min(0.7, -standing / 40) : 0
  const pressure = Math.max(0, roll - bias)
  if (pressure < row.relocate) return standing <= poachStandingMax ? 'relocate' : 'trim'
  if (pressure < row.trim) return 'trim'
  if (pressure < row.refuse) return 'refuse'
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
  const hit = rivals.map((carrier) => {
    const intensity = pairIntensity(input.holderId, carrier.id)
    const score = scaledHit(row.score, carrier.standing, intensity === 'none' ? 'rival' : intensity)
    return {
      airlineId: carrier.id,
      name: carrier.name,
      score,
      standing: carrier.standing,
      intensity: intensity === 'none' ? 'rival' : intensity,
      effect: effectFor(tier, roll, carrier.standing, input.poachStandingMax),
    }
  })
  return {
    anger: hit.map((row) => `${row.name} ${row.score} · ${effectLabel(row.effect, row.intensity)}`).join('\n'),
    spared: sparedSentence(spared),
    hit,
  }
}
