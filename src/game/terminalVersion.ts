/**
 * Bumped once per sim tick. The fitting card subscribes to this and
 * reads `hallNav.metrics()` itself, throttled to 4 Hz.
 */
let version = 0
const listeners = new Set<() => void>()

export function terminalVersion(): number {
  return version
}

export function bumpTerminalVersion(): void {
  version += 1
  for (const listener of listeners) listener()
}

export function subscribeTerminalVersion(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test hook. */
export function resetTerminalVersion(): void {
  version = 0
}
