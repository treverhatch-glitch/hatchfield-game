/** Click-open flag for the board panel. The 3D board and the HUD button share it. */

type Listener = (open: boolean) => void

let open = false
const listeners = new Set<Listener>()

export function fidsIsOpen(): boolean {
  return open
}

export function setFidsOpen(next: boolean) {
  if (open === next) return
  open = next
  for (const listener of listeners) listener(open)
}

export function toggleFidsOpen() {
  setFidsOpen(!open)
}

export function subscribeFids(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
