import type { MeasureUnit, ThoughtCause } from './types.ts'

/** Tunables for the phase-1 feedback layer. Logic reads these; it does not embed them. */
export const FEEDBACK = {
  /** Current goals shown at once. */
  stackSize: 3,
  /** Sim seconds a lever change is watched before the effect is reported. */
  effectSettleSec: 8,
  /** Toasts kept on screen. */
  toastLimit: 3,
  /** Sim seconds a before/after toast stays up. */
  toastLifeSec: 7,
  /** Thought bubbles alive at once. The instanced meshes are sized to this. */
  bubbleCap: 8,
  /** Icon width in metres. Big enough to read when the camera is in on the hall. */
  bubbleWidthM: 1.15,
  /** Sim seconds an icon stays over a passenger. */
  bubbleLifeSec: 4,
  /** Sim seconds before that passenger can think again. */
  bubbleCooldownSec: 16,
  /** Sim seconds between bubble samples. */
  bubbleSampleEvery: 3,
  /** Share of eligible passengers who speak on a sample. */
  bubbleChance: 0.12,
  /** Wait, in minutes, that reads as a queue even without a queue line. */
  queueWaitMin: 4,
  /** Happiness (0–100) that counts as delight. */
  delightHappiness: 80,
  /** Happiness below this, while prices are high, blames the prices. */
  priceHappiness: 58,
  /** Passenger fee above the schedule by this ratio counts as pricey. */
  priceyFeeRatio: 1.12,
  /** Published fee index above this counts as pricey. */
  priceyIndex: 1.08,
  /** Passengers scanned for bubbles each read. */
  passengerScan: 240,
  /** Sim seconds a celebration banner stays up. */
  celebrationSec: 4.5,
  /** Camera punch length, wall-clock seconds. */
  beatSec: 2.4,
  /** How far the camera dollies in during a beat, as a fraction of distance. */
  beatDolly: 0.18,
  /** Confetti pieces in one burst. */
  confettiCount: 70,
  /** Confetti lifetime, wall-clock seconds. */
  confettiLifeSec: 2.8,
} as const

export type MilestoneMeter = 'airlines' | 'flights' | 'passengers' | 'reputation'

export interface MilestoneDef {
  id: string
  title: string
  detail: string
  target: number
  meter: MilestoneMeter
  rewardCash: number
  rewardLabel: string
}

/** Early-field goals, in the order the stack reveals them. */
export const MILESTONES: readonly MilestoneDef[] = [
  {
    id: 'first_airline',
    title: 'Sign an airline',
    detail: 'A carrier on the board starts the field.',
    target: 1,
    meter: 'airlines',
    rewardCash: 8_000,
    rewardLabel: 'First airline bonus',
  },
  {
    id: 'first_landing',
    title: 'Land a flight',
    detail: 'The first arrival on your runway.',
    target: 1,
    meter: 'flights',
    rewardCash: 5_000,
    rewardLabel: 'First landing bonus',
  },
  {
    id: 'pax_50',
    title: 'Serve 50 passengers',
    detail: 'Get the hall working.',
    target: 50,
    meter: 'passengers',
    rewardCash: 4_000,
    rewardLabel: 'First crowd bonus',
  },
  {
    id: 'pax_100',
    title: 'Serve 100 passengers',
    detail: 'A hundred people through the doors.',
    target: 100,
    meter: 'passengers',
    rewardCash: 12_000,
    rewardLabel: 'Hundredth passenger bonus',
  },
  {
    id: 'airlines_3',
    title: 'Three airlines',
    detail: 'A small network, not a one-carrier field.',
    target: 3,
    meter: 'airlines',
    rewardCash: 15_000,
    rewardLabel: 'Network bonus',
  },
  {
    id: 'reputation_60',
    title: 'Reputation 60',
    detail: 'Carriers notice a well-run field.',
    target: 60,
    meter: 'reputation',
    rewardCash: 6_000,
    rewardLabel: 'Good name bonus',
  },
  {
    id: 'pax_500',
    title: 'Serve 500 passengers',
    detail: 'The terminal is a habit.',
    target: 500,
    meter: 'passengers',
    rewardCash: 25_000,
    rewardLabel: 'Busy terminal bonus',
  },
]

export const CAUSE_RANK: Record<ThoughtCause, number> = {
  queue: 0,
  prices: 1,
  delight: 2,
}

/** Audio event names already in the mixer. The feedback layer only names them. */
export const CELEBRATION_SOUND = {
  first_landing: 'hub_granted',
  pax_100: 'research_complete',
  new_airline: 'rating_up',
} as const

export const CONFETTI_COLORS = ['#f0c14a', '#7eb6e0', '#e0574a', '#7dcea0', '#f5f0e6', '#c9a27a'] as const

export function measureSuffix(unit: MeasureUnit): string {
  if (unit === 'min') return 'm'
  if (unit === 'pct') return '%'
  return ''
}
