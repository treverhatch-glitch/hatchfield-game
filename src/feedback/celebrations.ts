import { CELEBRATION_SOUND } from './config.ts'
import type { FeedbackWorld } from './types.ts'

export type CelebrationKind = keyof typeof CELEBRATION_SOUND

export interface Celebration {
  id: string
  kind: CelebrationKind
  title: string
  detail: string
  /** Mixer event name. Playback stays outside this module. */
  sound: string
  seed: number
}

export interface CelebrationMemory {
  landing: boolean
  hundred: boolean
  airlines: ReadonlySet<string>
}

export function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Firsts since the last memory: the first landing, the 100th passenger,
 * and each airline that was not on the board before.
 * The caller primes memory on the first read so a loaded field does not replay them.
 */
export function detectCelebrations(world: FeedbackWorld, memory: CelebrationMemory): Celebration[] {
  const out: Celebration[] = []
  if (!memory.landing && world.flightsLanded >= 1) {
    out.push(celebration('first_landing', 'first_landing', 'First landing', 'A flight is on your runway.'))
  }
  if (!memory.hundred && world.passengersServed >= 100) {
    out.push(celebration('pax_100', 'pax_100', '100th passenger', 'One hundred people have come through.'))
  }
  for (const airline of world.airlines) {
    if (memory.airlines.has(airline.id)) continue
    out.push(
      celebration(
        `new_airline:${airline.id}`,
        'new_airline',
        `${airline.name} signed`,
        'A new airline is on the board.',
      ),
    )
  }
  return out
}

export function rememberCelebrations(world: FeedbackWorld, memory: CelebrationMemory): CelebrationMemory {
  const airlines = new Set(memory.airlines)
  for (const airline of world.airlines) airlines.add(airline.id)
  return {
    landing: memory.landing || world.flightsLanded >= 1,
    hundred: memory.hundred || world.passengersServed >= 100,
    airlines,
  }
}

function celebration(id: string, kind: CelebrationKind, title: string, detail: string): Celebration {
  return { id, kind, title, detail, sound: CELEBRATION_SOUND[kind], seed: hashSeed(id) }
}
