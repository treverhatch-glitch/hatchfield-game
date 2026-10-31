import { forceSimRandom } from '../game/simRng.ts'

/**
 * Test-only: run `run` with Math.random swapped for a seeded LCG, so a
 * test's rolls do not depend on whichever test ran first. Restores the
 * real Math.random afterwards, even if `run` throws. The rules roll their own dice (src/game/simRng.ts), so
 * those are forced onto the same seeded stream while `run` runs: every roll, rules or not, comes from one
 * sequence in the same order as before the rules had their own dice.
 */
export function withSeed<T>(seed: number, run: () => T): T {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  const forcedBefore = forceSimRandom(() => Math.random())
  try {
    return run()
  } finally {
    Math.random = orig
    forceSimRandom(forcedBefore)
  }
}

/** Async form of {@link withSeed}; keeps the seed until the promise settles. */
export async function withSeedAsync<T>(seed: number, run: () => Promise<T>): Promise<T> {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  const forcedBefore = forceSimRandom(() => Math.random())
  try {
    return await run()
  } finally {
    Math.random = orig
    forceSimRandom(forcedBefore)
  }
}
