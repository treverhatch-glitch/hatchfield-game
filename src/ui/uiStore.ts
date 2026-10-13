import type { Tool } from '../game/types'

/** Build categories that open the asset submenu. */
export type BuildCategory = 'pavement' | 'stands' | 'terminal' | 'ops' | 'landside'

export type PanelId =
  | 'finances'
  | 'research'
  | 'airlines'
  | 'planner'
  | 'services'
  | 'notifications'
  | 'selection'
  | 'info'
  | 'menu'

export type FinanceTab = 'overview' | 'budget' | 'charts'

export type InfoViewId =
  | 'pax'
  | 'congestion'
  | 'noise'
  | 'satisfaction'
  | 'power'
  | 'wear'

export const UI_SCALE_MIN = 0.7
export const UI_SCALE_MAX = 1.5

export type UiState = {
  openMenu: BuildCategory | null
  openPanel: PanelId | null
  tool: Tool
  assetId: string | null
  hidden: boolean
  uiScale: number
  lastMenu: BuildCategory | null
  search: string
  financeTab: FinanceTab
  infoView: InfoViewId | null
}

export type EscStep = 'tool' | 'menu' | 'panel' | 'hall' | 'game-menu'

const initial: UiState = {
  openMenu: null,
  openPanel: null,
  tool: 'pan',
  assetId: null,
  hidden: false,
  uiScale: 1,
  lastMenu: null,
  search: '',
  financeTab: 'overview',
  infoView: null,
}

let state: UiState = { ...initial }
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function commit(next: UiState) {
  // One slot: a menu and a panel never stay open together.
  if (next.openMenu && next.openPanel) next = { ...next, openMenu: null }
  state = next
  emit()
}

export function getUiState(): UiState {
  return state
}

export function subscribeUi(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetUiStore() {
  state = { ...initial }
  emit()
}

export function toggleMenu(category: BuildCategory) {
  if (state.openMenu === category) {
    commit({ ...state, openMenu: null })
    return
  }
  commit({
    ...state,
    openMenu: category,
    openPanel: null,
    lastMenu: category,
  })
}

export function closeMenu() {
  if (!state.openMenu) return
  commit({ ...state, openMenu: null })
}

export function reopenLastMenu() {
  const category = state.lastMenu ?? 'pavement'
  commit({
    ...state,
    openMenu: category,
    openPanel: null,
    lastMenu: category,
  })
}

export function openPanel(panel: PanelId, financeTab?: FinanceTab) {
  commit({
    ...state,
    openPanel: panel,
    openMenu: null,
    financeTab: financeTab ?? (panel === 'finances' ? state.financeTab : state.financeTab),
  })
}

export function togglePanel(panel: PanelId, financeTab?: FinanceTab) {
  if (state.openPanel === panel && (!financeTab || financeTab === state.financeTab)) {
    commit({ ...state, openPanel: null })
    return
  }
  openPanel(panel, financeTab)
}

export function closePanel() {
  if (!state.openPanel) return
  commit({ ...state, openPanel: null })
}

export function setFinanceTab(financeTab: FinanceTab) {
  commit({ ...state, financeTab, openPanel: 'finances', openMenu: null })
}

export function setInfoView(infoView: InfoViewId | null) {
  commit({ ...state, infoView, openPanel: 'info', openMenu: null })
}

/** Picking a stamp closes the menu and any panel immediately. */
export function selectAsset(tool: Tool, assetId: string) {
  commit({
    ...state,
    tool,
    assetId,
    openMenu: null,
    openPanel: null,
    search: '',
  })
}

export function clearTool() {
  if (state.tool === 'pan' && !state.assetId) return
  commit({ ...state, tool: 'pan', assetId: null })
}

/**
 * Esc order: cancel the tool, then the submenu, then the panel,
 * then leave the hall, then open the game menu.
 */
export function pressEscape(inHall = false): EscStep {
  if (state.tool !== 'pan') {
    commit({ ...state, tool: 'pan', assetId: null })
    return 'tool'
  }
  if (state.openMenu) {
    commit({ ...state, openMenu: null })
    return 'menu'
  }
  if (state.openPanel) {
    commit({ ...state, openPanel: null })
    return 'panel'
  }
  if (inHall) return 'hall'
  commit({ ...state, openPanel: 'menu', openMenu: null })
  return 'game-menu'
}

export function toggleHidden() {
  commit({ ...state, hidden: !state.hidden })
}

export function setHidden(hidden: boolean) {
  if (state.hidden === hidden) return
  commit({ ...state, hidden })
}

export function setUiScale(uiScale: number) {
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, uiScale))
  const rounded = Math.round(clamped * 100) / 100
  if (rounded === state.uiScale) return
  commit({ ...state, uiScale: rounded })
}

export function setSearch(search: string) {
  commit({ ...state, search })
}

/** True when the player is placing or bulldozing — the field should stay clear. */
export function toolIsActive(tool: Tool = state.tool): boolean {
  return tool !== 'pan'
}
