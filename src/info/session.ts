import type { MapViewId } from './types.ts'

export interface MapViewState {
  active: MapViewId | null
  /** Click-open numbers. The tint and the legend stay up either way. */
  detail: boolean
  focus: string | null
}

const CLOSED: MapViewState = { active: null, detail: false, focus: null }

let state: MapViewState = CLOSED
const listeners = new Set<() => void>()

function publish(next: MapViewState) {
  state = next
  for (const fn of listeners) fn()
}

export function mapViewSnapshot(): MapViewState {
  return state
}

export function subscribeMapView(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** One view at a time. Opening a view closes the previous detail. */
export function selectMapView(id: MapViewId) {
  if (state.active === id && !state.detail && state.focus == null) return
  publish({ active: id, detail: false, focus: null })
}

export function toggleMapView(id: MapViewId) {
  if (state.active === id) closeMapView()
  else selectMapView(id)
}

export function closeMapView() {
  if (!state.active && !state.detail && state.focus == null) return
  publish(CLOSED)
}

export function openMapDetail(focus: string | null = null) {
  if (!state.active) return
  if (state.detail && state.focus === focus) return
  publish({ ...state, detail: true, focus })
}

export function closeMapDetail() {
  if (!state.detail && state.focus == null) return
  publish({ ...state, detail: false, focus: null })
}

export function resetMapView() {
  publish(CLOSED)
}
