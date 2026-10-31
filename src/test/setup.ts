import { beforeEach } from 'vitest'
import { forceSimRandom } from '../game/simRng.ts'

/** In-memory Storage so Game persist/load can run under Vitest (node). */
function memoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage(),
  configurable: true,
})
Object.defineProperty(globalThis, 'sessionStorage', {
  value: memoryStorage(),
  configurable: true,
})

// The rules roll their own seeded dice (src/game/simRng.ts). In tests they follow Math.random by default, so every
// test that steers Math.random (vi.spyOn, withSeed) steers the rules exactly as before. Tests of the dice themselves
// (tests/sim/repeatable.test.ts, tests/sim/replay.test.ts) call forceSimRandom(null) to use the game's own dice.
beforeEach(() => {
  forceSimRandom(() => Math.random())
})
