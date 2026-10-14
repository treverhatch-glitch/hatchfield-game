/**
 * Fast HUD numbers (cash, clock, countdowns, stock) skip React. One throttled pump reads
 * them and writes a text node only when the string changed, so the HUD tree re-renders on
 * real state changes, not on every cent. Each live span is its own small composited layer
 * (see `.hud-live`), so a tick re-rasters a few glyphs instead of the whole HUD.
 */
export const HUD_CADENCE = {
  /** Live text interval at 1x/3x, about 4 updates a second. */
  liveMs: 250,
  /** At 5x the digits spin faster than anyone reads them. */
  liveMsFast: 500,
  /** Full HUD catch-up for figures derived from cash/clock (forecast, gates, panel lines). */
  treeMs: 2000,
  treeMsFast: 4000,
}

export interface LiveSlot {
  el: HTMLElement
  read: () => string
  last: string
}

const slots = new Set<LiveSlot>()
const treeListeners = new Set<() => void>()
let speedOf: () => number = () => 1
let fastKeyOf: () => string = () => ''
let timer = 0
let lastTree = 0
let lastFastKey = ''
let version = 0

/** App wires the game in once: sim speed sets the cadence, `fastKey` is what the tree catches up on. */
export function bindLiveHud(speed: () => number, fastKey: () => string) {
  speedOf = speed
  fastKeyOf = fastKey
}

function write(slot: LiveSlot) {
  let next: string
  try {
    next = slot.read()
  } catch {
    return
  }
  if (next === slot.last) return
  slot.last = next
  const node = slot.el.firstChild
  if (node && node.nodeType === 3 && !node.nextSibling) node.nodeValue = next
  else slot.el.textContent = next
}

function pump() {
  timer = 0
  const fast = speedOf() >= 5
  for (const slot of slots) write(slot)
  const now = performance.now()
  if (treeListeners.size && now - lastTree >= (fast ? HUD_CADENCE.treeMsFast : HUD_CADENCE.treeMs)) {
    lastTree = now
    const key = fastKeyOf()
    if (key !== lastFastKey) {
      lastFastKey = key
      version++
      for (const fn of treeListeners) fn()
    }
  }
  schedule()
}

function schedule() {
  if (timer || (!slots.size && !treeListeners.size)) return
  timer = window.setTimeout(pump, speedOf() >= 5 ? HUD_CADENCE.liveMsFast : HUD_CADENCE.liveMs)
}

function stopIfIdle() {
  if (slots.size || treeListeners.size || !timer) return
  window.clearTimeout(timer)
  timer = 0
}

/** Register a live span; it is written now and on every pump tick until removed. */
export function addLiveSlot(slot: LiveSlot) {
  slots.add(slot)
  write(slot)
  schedule()
  return () => {
    slots.delete(slot)
    stopIfIdle()
  }
}

/** Throttled "cash/clock moved" signal for `useSyncExternalStore`. */
export function subscribeHudTree(fn: () => void) {
  treeListeners.add(fn)
  schedule()
  return () => {
    treeListeners.delete(fn)
    stopIfIdle()
  }
}

export function hudTreeVersion(): number {
  return version
}
