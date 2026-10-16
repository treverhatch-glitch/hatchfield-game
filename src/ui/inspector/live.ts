/** 4 Hz refresh for the open inspector. The rest of the HUD stays on its own cadence. */

const listeners = new Set<() => void>()
let rev = 0
let timer: ReturnType<typeof setInterval> | null = null

export function liveInspectorRev(): number {
  return rev
}

function idleRev(): number {
  return 0
}

function subscribeIdle(): () => void {
  return () => {}
}

export function subscribeLiveInspector(listener: () => void): () => void {
  listeners.add(listener)
  if (!timer && typeof window !== 'undefined') {
    timer = setInterval(() => {
      rev += 1
      for (const notify of listeners) notify()
    }, 250)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** Subscribe only while `active` is true, so a closed card does not tick. */
export function subscribeLiveWhen(active: boolean): (listener: () => void) => () => void {
  return active ? subscribeLiveInspector : subscribeIdle
}

export function liveRevWhen(active: boolean): () => number {
  return active ? liveInspectorRev : idleRev
}
