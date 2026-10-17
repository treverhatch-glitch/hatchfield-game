/**
 * Test-only: run `run` with Math.random swapped for a seeded LCG, so a
 * test's rolls do not depend on whichever test ran first. Restores the
 * real Math.random afterwards, even if `run` throws.
 */
export function withSeed<T>(seed: number, run: () => T): T {
  const orig = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    return run()
  } finally {
    Math.random = orig
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
  try {
    return await run()
  } finally {
    Math.random = orig
  }
}
