import type { KitCategory } from '../../game/terminalKitData'

/** The build tray asks the hall kit to open a tab. The hall reads it once. */
let pending: KitCategory | null = null
const listeners = new Set<() => void>()

export function requestKit(tab: KitCategory): void {
  pending = tab
  for (const listener of listeners) listener()
}

export function subscribeKit(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function takeKitRequest(): KitCategory | null {
  const next = pending
  pending = null
  return next
}
