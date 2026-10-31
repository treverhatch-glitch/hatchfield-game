/**
 * The rules' own dice. Every random roll the game rules make comes from here, never from Math.random, so:
 *   - a run is repeatable: the same seed and the same player actions give the same airport, tick for tick
 *     (the Unity port is checked against these runs);
 *   - drawing and sound can't change the game: they keep Math.random, which the rules no longer share;
 *   - a saved game carries its dice (seed and state) and picks up exactly where it left off.
 * The generator is Mulberry32, the same one src/people/rng.ts uses, and easy to port bit for bit to C#.
 */
export class SimRng {
  state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** A number in [0, 1), like Math.random. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let current = new SimRng(0x9e3779b9)
let forced: (() => number) | null = null

/** The rules' Math.random: the next roll of the active game's dice. */
export function simRandom(): number {
  return forced ? forced() : current.next()
}

/**
 * Tests only: force what the rules roll (for example `() => 0` for "always happens"), then pass null to put the
 * game's own dice back. Wins over the game's dice even while it ticks.
 */
export function forceSimRandom(fn: (() => number) | null): void {
  forced = fn
}

/** Make this game's dice the ones the rules roll (the game does this when it starts, loads and ticks). */
export function setSimRng(rng: SimRng): void {
  current = rng
}

/** A fresh seed for a new game. The one place the rules may ask Math.random: choosing which game to play. */
export function freshSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0
}
