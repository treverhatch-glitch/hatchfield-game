/**
 * HUD store clock. Game emits can arrive every frame; the shell reads a
 * snapshot at a steady rate so speed buttons stay mounted under the cursor.
 * 8 Hz sits in the 4–10 Hz band: fast enough for cash and letters, slow
 * enough that a click lands on the same button.
 */
export const HUD_HZ = 8

export interface HudClock {
  subscribe(listener: () => void): () => void
  getSnapshot(): string
}

export function bindHudClock(
  source: (fn: () => void) => () => void,
  read: () => string,
  hz = HUD_HZ,
): HudClock {
  let current = read()
  let timer: ReturnType<typeof setTimeout> | null = null
  let sourceUnsub: (() => void) | null = null
  const listeners = new Set<() => void>()
  const wait = Math.round(1000 / hz)

  const flush = () => {
    timer = null
    const next = read()
    if (next === current) return
    current = next
    for (const listener of listeners) listener()
  }

  const poke = () => {
    if (timer != null) return
    timer = setTimeout(flush, wait)
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (!sourceUnsub) sourceUnsub = source(poke)
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) return
        sourceUnsub?.()
        sourceUnsub = null
        if (timer != null) clearTimeout(timer)
        timer = null
      }
    },
    getSnapshot() {
      return current
    },
  }
}
