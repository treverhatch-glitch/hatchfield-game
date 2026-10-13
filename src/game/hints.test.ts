import { beforeEach, describe, expect, it } from 'vitest'
import type { Advice } from './advisor.ts'
import {
  hintKind,
  isHintMuted,
  mergeHints,
  muteHintKind,
  newGameHintPrefs,
  readHintSettings,
  sanitizeHintPrefs,
  setAllHintsEnabled,
  visibleHints,
  worstSeverity,
  writeHintSettings,
} from './hints.ts'
import { HINT_SETTINGS_KEY } from './hintsData.ts'
import { Game } from './sim.ts'

const note = (id: string, extra: Partial<Advice> = {}): Advice => ({
  id,
  title: id,
  detail: '',
  fix: '',
  cells: [],
  ...extra,
})

function memStore() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe('hint merge', () => {
  it('ranks worst first and keeps source order inside a severity', () => {
    const out = mergeHints(
      [note('litter-floor'), note('plan-no_curb', { severity: 'blocker' })],
      [note('low-meals'), note('standing-northline')],
    )
    expect(out.map((a) => a.id)).toEqual(['plan-no_curb', 'litter-floor', 'standing-northline', 'low-meals'])
    expect(worstSeverity(out)).toBe('blocker')
  })

  it('folds the plan and hall checks that say the same thing', () => {
    const out = mergeHints(
      [note('unreachable-gate', { cells: [{ c: 1, r: 1 }] })],
      [note('plan-gates_unreachable', { severity: 'blocker' })],
    )
    expect(out).toHaveLength(1)
    expect(out[0].severity).toBe('blocker')
    expect(out[0].cells).toEqual([{ c: 1, r: 1 }])
  })

  it('keeps the worse of two notes in a group', () => {
    const out = mergeHints([note('claim-far')], [note('plan-missing_bagclaim', { severity: 'blocker' })])
    expect(out.map((a) => a.id)).toEqual(['plan-missing_bagclaim'])
  })

  it('suffixed ids share one mute kind', () => {
    expect(hintKind('standing-northline')).toBe('standing')
    expect(hintKind('delay-4-7')).toBe('turnaround-delay')
    expect(hintKind('plan-dead_restrooms')).toBe('plan-dead-end')
    expect(hintKind('litter-floor')).toBe('litter-floor')
  })
})

describe('hint mute rules', () => {
  it('new games start with All hints enabled and nothing muted', () => {
    expect(newGameHintPrefs()).toEqual({ allEnabled: true, muted: [] })
  })

  it('muting any kind hides it and flips All hints enabled off', () => {
    const p = muteHintKind(newGameHintPrefs(), 'standing')
    expect(p.allEnabled).toBe(false)
    const list = [note('standing-a'), note('standing-b'), note('litter-floor')]
    expect(visibleHints(list, p).map((a) => a.id)).toEqual(['litter-floor'])
    expect(isHintMuted(p, 'standing-c')).toBe(true)
  })

  it('only the All hints enabled toggle brings muted kinds back', () => {
    let p = muteHintKind(newGameHintPrefs(), 'litter-floor')
    p = muteHintKind(p, 'standing')
    expect(p.muted).toEqual(['litter-floor', 'standing'])
    p = setAllHintsEnabled(true)
    expect(p).toEqual({ allEnabled: true, muted: [] })
  })

  it('switching All hints enabled off hides every hint', () => {
    const p = setAllHintsEnabled(false)
    expect(visibleHints([note('plan-no_curb'), note('low-fuel')], p)).toEqual([])
  })

  it('pregame Enable hints unchecked starts with hints off', () => {
    const p = newGameHintPrefs(false)
    expect(p.allEnabled).toBe(false)
    expect(visibleHints([note('plan-no_curb')], p)).toEqual([])
  })

  it('sanitizes old or partial saves', () => {
    expect(sanitizeHintPrefs(undefined)).toEqual({ allEnabled: true, muted: [] })
    expect(sanitizeHintPrefs({ muted: ['standing', 4] })).toEqual({ allEnabled: false, muted: ['standing'] })
    // All on can never coexist with a mute.
    expect(sanitizeHintPrefs({ allEnabled: true, muted: ['x'] }).allEnabled).toBe(false)
  })

  it('round-trips through the settings mirror', () => {
    const s = memStore()
    writeHintSettings(muteHintKind(newGameHintPrefs(), 'low-fuel'), s)
    expect(s.m.has(HINT_SETTINGS_KEY)).toBe(true)
    expect(readHintSettings(s)).toEqual({ allEnabled: false, muted: ['low-fuel'] })
    expect(readHintSettings(memStore())).toBeNull()
  })
})

describe('hint prefs on the game', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  function started(enableHints = true): Game {
    const game = new Game()
    game.sandbox = true
    game.enableHintsAtStart = enableHints
    game.beginNew('easy')
    game.buyLand('city')
    game.buildStarterKit()
    return game
  }

  it('a new game has All hints enabled and shows hints', () => {
    const game = started()
    expect(game.hintPrefs).toEqual({ allEnabled: true, muted: [] })
    game.markHallOverloaded()
    expect(game.visibleHints().some((a) => a.id === 'over-capacity')).toBe(true)
  })

  it('the pregame Enable hints box off starts with hints hidden', () => {
    const game = started(false)
    game.markHallOverloaded()
    expect(game.advice.some((a) => a.id === 'over-capacity')).toBe(true)
    expect(game.visibleHints()).toEqual([])
    expect(game.hintPrefs.allEnabled).toBe(false)
    // The choice is per game: the next new game starts on again.
    game.enableHintsAtStart = true
    game.beginNew('easy')
    expect(game.hintPrefs.allEnabled).toBe(true)
  })

  it('mute hides the kind, saves, and only Settings brings it back', () => {
    const game = started()
    game.markHallOverloaded()
    game.muteHint('over-capacity')
    expect(game.hintPrefs.allEnabled).toBe(false)
    expect(game.visibleHints().some((a) => a.id === 'over-capacity')).toBe(false)
    expect(readHintSettings()?.muted).toContain('over-capacity')

    game.persist()
    const again = new Game()
    expect(again.load()).toBe(true)
    expect(again.hintPrefs).toEqual({ allEnabled: false, muted: ['over-capacity'] })

    again.setAllHints(true)
    expect(again.hintPrefs).toEqual({ allEnabled: true, muted: [] })
    expect(readHintSettings()).toEqual({ allEnabled: true, muted: [] })
  })

  it('Show me pans the camera to the note and highlights it', () => {
    const game = started()
    game.markHallOverloaded()
    game.showHint('over-capacity')
    expect(game.view).toBe('hall')
    expect(game.advisorCells.length).toBeGreaterThan(0)
    expect(game.camGoal?.view).toBe('hall')
    expect(game.camGoal?.c).toBe(game.advisorCells[0].c)
  })

  it('the hint list and a HUD panel are never open together', () => {
    const game = started()
    game.setSidePanel('hints')
    expect(game.sidePanel).toBe('hints')
    game.setSidePanel('hud')
    expect(game.sidePanel).toBe('hud')
  })
})
