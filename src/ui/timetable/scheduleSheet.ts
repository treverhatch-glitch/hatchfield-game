/** Whether the stand sheet is on screen. The pill and Planner share one dock. */
export function sheetShown(opts: { pill: boolean; planner: boolean; buildMenu: boolean }): boolean {
  if (opts.buildMenu) return false
  return opts.pill || opts.planner
}

let pill = false
let planner = false
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function schedulePillOpen(): boolean {
  return pill
}

export function schedulePlannerOpen(): boolean {
  return planner
}

/** Esc closes a pill-opened sheet. A Planner-opened sheet stays until the tab closes. */
export function schedulePillEscape(): boolean {
  return pill && !planner
}

export function setSchedulePill(on: boolean) {
  if (pill === on) return
  pill = on
  emit()
}

export function setSchedulePlanner(on: boolean) {
  if (planner === on) return
  planner = on
  emit()
}

export function subscribeScheduleSheet(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
