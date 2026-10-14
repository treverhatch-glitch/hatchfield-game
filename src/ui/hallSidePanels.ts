/**
 * Offer letters (left) and the prefab card (right) fold when the player
 * enters the hall, so the interior stays visible. Either side can reopen.
 */
type Listener = () => void

let lettersFolded = true
let cardFolded = true
const listeners = new Set<Listener>()

function emit() {
  for (const fn of listeners) fn()
}

/** '1' folded, '0' open. Letters digit, then the hall card. */
export function hallSidesKey(): string {
  return `${lettersFolded ? '1' : '0'}${cardFolded ? '1' : '0'}`
}

export function subscribeHallSides(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function foldHallSides() {
  if (lettersFolded && cardFolded) return
  lettersFolded = true
  cardFolded = true
  emit()
}

export function setHallLettersFolded(folded: boolean) {
  if (lettersFolded === folded) return
  lettersFolded = folded
  emit()
}

export function setHallCardFolded(folded: boolean) {
  if (cardFolded === folded) return
  cardFolded = folded
  emit()
}
