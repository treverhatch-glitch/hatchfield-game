/**
 * The one-line read on a guest: name, mood word, the need that matters most
 * and what they are thinking now. Reads a `GuestCard`, changes nothing.
 */
import { GUEST_GLANCE, NEED_KEYS, type NeedKey } from './guestConfig.ts'
import type { GuestCard } from './paxnav.ts'

export interface GuestGlance {
  id: string
  name: string
  /** 0–100, or null for a guest the walk does not track needs for. */
  satisfaction: number | null
  mood: string
  /** The highest need above the floor, or null when none is pressing. */
  topNeed: { key: NeedKey; label: string; level: number } | null
  /** Latest thought as "icon text", or a plain line when they have none. */
  thought: string
}

export function moodWord(satisfaction: number): string {
  for (const band of GUEST_GLANCE.moods) if (satisfaction >= band.min) return band.label
  return GUEST_GLANCE.moods[GUEST_GLANCE.moods.length - 1].label
}

export function topNeedOf(needs: Readonly<Record<NeedKey, number>>): GuestGlance['topNeed'] {
  let best: NeedKey | null = null
  for (const k of NEED_KEYS) if (!best || needs[k] > needs[best]) best = k
  if (!best || needs[best] < GUEST_GLANCE.topNeedMin) return null
  return { key: best, label: GUEST_GLANCE.needLabels[best], level: needs[best] }
}

export function glanceOf(card: GuestCard): GuestGlance {
  const latest = card.thoughts[card.thoughts.length - 1]
  const thought = card.rebooking ? '✈️ Missed the flight, waiting to rebook' : card.lost ? '❓ Lost' : latest ? `${latest.icon} ${latest.text}` : GUEST_GLANCE.noThought
  return {
    id: card.id,
    name: card.name,
    satisfaction: card.satisfaction,
    mood: moodWord(card.satisfaction),
    topNeed: topNeedOf(card.needs),
    thought,
  }
}
