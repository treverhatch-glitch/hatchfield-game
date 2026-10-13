/**
 * Simulation RNG.
 *
 * Unseeded play (`kind: 'math'`) calls `Math.random` at the moment of the
 * roll, so existing tests that stub `Math.random` and the live game keep
 * the same stream. `useSeed` / `createRng(seed)` switches that same object
 * to mulberry32. Same seed, same sequence.
 *
 * Audio and the renderer keep their own `Math.random` calls. Those are
 * presentation, and they must not consume the sim stream.
 */

export interface RngState {
  kind: 'math' | 'mulberry32'
  /** mulberry32 state word. Zero while `kind` is `math`. */
  state: number
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
  /** Integer in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number
  pick<T>(items: readonly T[]): T
  snapshot(): RngState
  load(state: RngState): void
}

export function createRng(seed?: number): Rng {
  let kind: RngState['kind'] = seed === undefined ? 'math' : 'mulberry32'
  let s = (seed ?? 0) >>> 0
  const next = (): number => {
    if (kind === 'math') return Math.random()
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (minInclusive, maxExclusive) =>
      minInclusive + Math.floor(next() * (maxExclusive - minInclusive)),
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from empty list')
      return items[Math.floor(next() * items.length)]!
    },
    snapshot: () => ({ kind, state: kind === 'math' ? 0 : s }),
    load: (state) => {
      kind = state.kind
      s = state.state >>> 0
    },
  }
}

let active: Rng = createRng()

/** The stream `simRandom()` currently reads. */
export function currentSimRng(): Rng {
  return active
}

/** Point every `simRandom()` call at this generator. */
export function bindSimRng(rng: Rng): Rng {
  active = rng
  return rng
}

/**
 * Run `fn` on `rng`, then restore whatever stream was active.
 * Nested sim entry points (a tick inside a test helper) stay isolated.
 */
export function usingSimRng<T>(rng: Rng, fn: () => T): T {
  const prev = active
  active = rng
  try {
    return fn()
  } finally {
    active = prev
  }
}

/** Uniform [0, 1) from the active sim generator. */
export function simRandom(): number {
  return active.next()
}

/**
 * Visual and audio rolls (lightning, sample variant). Always `Math.random`,
 * never the sim seed, so a replay does not change the picture or the mix.
 */
export function presentationRandom(): number {
  return Math.random()
}
