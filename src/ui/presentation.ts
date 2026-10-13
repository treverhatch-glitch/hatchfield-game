import type { Game } from '../game/sim.ts'

/**
 * Wires the sim event bus to the browser. The tick only publishes occupancy
 * and cue names. This subscriber is what touches the audio device.
 */
export function attachPresentation(game: Game): () => void {
  const offSfx = game.events.on('sfx', ({ name }) => game.playSfx(name))
  const offAmbience = game.events.on('ambience', ({ sample, dt }) => game.playAmbience(sample, dt))
  return () => {
    offSfx()
    offAmbience()
  }
}
