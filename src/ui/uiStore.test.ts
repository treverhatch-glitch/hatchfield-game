import { describe, expect, it, beforeEach } from 'vitest'
import {
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  clearTool,
  closeMenu,
  getUiState,
  openPanel,
  pressEscape,
  reopenLastMenu,
  resetUiStore,
  selectAsset,
  setFinanceTab,
  setUiScale,
  toggleHidden,
  toggleMenu,
  togglePanel,
} from './uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    resetUiStore()
  })

  it('keeps at most one of menu or panel open', () => {
    toggleMenu('stands')
    expect(getUiState().openMenu).toBe('stands')
    expect(getUiState().openPanel).toBeNull()

    openPanel('finances')
    expect(getUiState().openMenu).toBeNull()
    expect(getUiState().openPanel).toBe('finances')

    toggleMenu('pavement')
    expect(getUiState().openMenu).toBe('pavement')
    expect(getUiState().openPanel).toBeNull()
    expect(getUiState().lastMenu).toBe('pavement')
  })

  it('closes the submenu the instant an asset is selected', () => {
    toggleMenu('pavement')
    openPanel('airlines')
    toggleMenu('stands')
    selectAsset('stand', 'stand-m')
    const s = getUiState()
    expect(s.openMenu).toBeNull()
    expect(s.openPanel).toBeNull()
    expect(s.tool).toBe('stand')
    expect(s.assetId).toBe('stand-m')
  })

  it('toggles the same menu or panel shut', () => {
    toggleMenu('ops')
    toggleMenu('ops')
    expect(getUiState().openMenu).toBeNull()

    togglePanel('planner')
    togglePanel('planner')
    expect(getUiState().openPanel).toBeNull()
  })

  it('switches panels without leaving the previous one open', () => {
    openPanel('finances', 'overview')
    setFinanceTab('budget')
    expect(getUiState().openPanel).toBe('finances')
    expect(getUiState().financeTab).toBe('budget')
    openPanel('services')
    expect(getUiState().openPanel).toBe('services')
    expect(getUiState().openMenu).toBeNull()
  })

  it('follows Esc priority: tool, menu, panel, game menu', () => {
    selectAsset('runway', 'runway-regional')
    toggleMenu('landside')
    expect(pressEscape()).toBe('tool')
    expect(getUiState().tool).toBe('pan')
    expect(getUiState().openMenu).toBe('landside')

    expect(pressEscape()).toBe('menu')
    expect(getUiState().openMenu).toBeNull()

    openPanel('research')
    expect(pressEscape()).toBe('panel')
    expect(getUiState().openPanel).toBeNull()

    expect(pressEscape(false)).toBe('game-menu')
    expect(getUiState().openPanel).toBe('menu')
    expect(pressEscape(false)).toBe('panel')
    expect(getUiState().openPanel).toBeNull()
  })

  it('asks to leave the hall before opening the game menu', () => {
    expect(pressEscape(true)).toBe('hall')
    expect(getUiState().openPanel).toBeNull()
  })

  it('does not reopen the menu when the tool is cancelled', () => {
    toggleMenu('terminal')
    selectAsset('premade', 'premade')
    clearTool()
    expect(getUiState().tool).toBe('pan')
    expect(getUiState().openMenu).toBeNull()
    reopenLastMenu()
    expect(getUiState().openMenu).toBe('terminal')
  })

  it('clamps UI scale and toggles hide', () => {
    setUiScale(0.2)
    expect(getUiState().uiScale).toBe(UI_SCALE_MIN)
    setUiScale(4)
    expect(getUiState().uiScale).toBe(UI_SCALE_MAX)
    setUiScale(1.25)
    expect(getUiState().uiScale).toBe(1.25)
    toggleHidden()
    expect(getUiState().hidden).toBe(true)
    closeMenu()
  })
})
