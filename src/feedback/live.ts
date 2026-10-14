import { getAudio } from '../audio/index.ts'
import type { Game } from '../game/sim.ts'
import { clearCameraBeat, setCameraBeat } from './beat.ts'
import { readFeedback } from './read.ts'
import { FeedbackSession } from './session.ts'
import { setLiveBubbles } from './stage.ts'

export const liveFeedback = new FeedbackSession()

let lastClock = 0
let lastPax = 0
let lastFlights = 0

/** Advance the feedback sim from the airport. Rewards and sounds are applied here, not inside the pure step. */
export function tickLiveFeedback(game: Game) {
  const clock = game.clock
  if (clock < lastClock - 1e-3 || game.paxServed < lastPax || game.flightsDone < lastFlights) {
    liveFeedback.reset()
    clearCameraBeat()
    setLiveBubbles([])
  }
  lastClock = clock
  lastPax = game.paxServed
  lastFlights = game.flightsDone

  const frame = liveFeedback.step(readFeedback(game))
  setLiveBubbles(frame.bubbles.map((bubble) => ({ passengerId: bubble.passengerId, icon: bubble.icon })))
  if (frame.beat) setCameraBeat(frame.beat)
  for (const reward of frame.rewards) {
    game.earn(reward.cash, reward.label, undefined, 'task_rewards', true)
  }
  playSoundHooks(frame.sounds)
  return frame
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __feedbackTick?: typeof tickLiveFeedback }).__feedbackTick = tickLiveFeedback
}

/** Named mixer events. Missing audio (tests, a locked device) stays silent. */
export function playSoundHooks(names: readonly string[]): void {
  if (names.length === 0 || typeof window === 'undefined') return
  try {
    const audio = getAudio()
    for (const name of names) audio.playEvent(name)
  } catch {
    // Headless runs have no audio device.
  }
}
