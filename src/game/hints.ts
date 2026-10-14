/**
 * One source of hints: the hall advisor, the live terminal plan, the kit and
 * litter notes, and the apron notes are merged, deduped, ranked worst-first,
 * and filtered by the player's mutes. Pure; the sim and the panel both call it.
 */
import type { Advice } from './advisor.ts'
import { HINT_KIND_PREFIX, HINT_SAME, HINT_SETTINGS_KEY, HINT_SEVERITY } from './hintsData.ts'

export type HintSeverity = 'blocker' | 'warning' | 'tip'

export const SEVERITY_RANK: Record<HintSeverity, number> = { blocker: 0, warning: 1, tip: 2 }

/** Mute kind for a note. Per-hall / per-stand / per-airline ids collapse to one kind. */
export function hintKind(id: string): string {
  for (const [prefix, kind] of HINT_KIND_PREFIX) if (id.startsWith(prefix)) return kind
  return id
}

export function severityOf(a: Advice): HintSeverity {
  return a.severity ?? HINT_SEVERITY[hintKind(a.id)] ?? 'warning'
}

/** Merge note lists into one ranked list. Same id or same group keeps the worst. */
export function mergeHints(...lists: Advice[][]): Advice[] {
  const out: Advice[] = []
  const byGroup = new Map<string, number>()
  for (const list of lists) {
    for (const raw of list) {
      const a = { ...raw, severity: severityOf(raw) }
      const group = HINT_SAME[a.id] ?? `id:${a.id}`
      const at = byGroup.get(group)
      if (at == null) {
        byGroup.set(group, out.length)
        out.push(a)
        continue
      }
      const cur = out[at]
      if (SEVERITY_RANK[a.severity] < SEVERITY_RANK[cur.severity!]) {
        out[at] = { ...a, cells: a.cells.length ? a.cells : cur.cells }
      } else if (!cur.cells.length && a.cells.length) {
        out[at] = { ...cur, cells: a.cells }
      }
    }
  }
  // Stable: equal severities keep their source order.
  return out
    .map((a, i) => ({ a, i }))
    .sort((x, y) => SEVERITY_RANK[x.a.severity!] - SEVERITY_RANK[y.a.severity!] || x.i - y.i)
    .map((x) => x.a)
}

export function worstSeverity(list: readonly Advice[]): HintSeverity | null {
  let best: HintSeverity | null = null
  for (const a of list) {
    const s = severityOf(a)
    if (!best || SEVERITY_RANK[s] < SEVERITY_RANK[best]) best = s
  }
  return best
}

/**
 * Hint switches. Kept in the save and mirrored to settings.
 *
 * Rules:
 * - New games start with All hints enabled ON and nothing muted.
 * - The pregame "Start with hints off" box, checked, starts the game with every kind
 *   muted (`'*'`) and All hints enabled OFF.
 * - "Don't show hints of this type" mutes one kind, and muting any kind flips
 *   All hints enabled OFF — the toggle only reads ON while nothing is muted.
 * - Muted kinds come back only through the in-game Settings toggle. Turning
 *   All hints enabled ON clears every mute; turning it OFF mutes everything.
 */
export interface HintPrefs {
  allEnabled: boolean
  muted: string[]
}

export const ALL_KINDS = '*'

export function newGameHintPrefs(enableHints = true): HintPrefs {
  return enableHints ? { allEnabled: true, muted: [] } : { allEnabled: false, muted: [ALL_KINDS] }
}

export function muteHintKind(prefs: HintPrefs, kind: string): HintPrefs {
  const muted = prefs.muted.includes(kind) ? prefs.muted : [...prefs.muted, kind]
  // Muting any kind flips All hints enabled off (see the rules above).
  return { allEnabled: false, muted }
}

export function setAllHintsEnabled(on: boolean): HintPrefs {
  return newGameHintPrefs(on)
}

export function isHintMuted(prefs: HintPrefs, idOrKind: string): boolean {
  if (prefs.muted.includes(ALL_KINDS)) return true
  return prefs.muted.includes(hintKind(idOrKind))
}

/** What the panel and its badge show. */
export function visibleHints(list: readonly Advice[], prefs: HintPrefs): Advice[] {
  return list.filter((a) => !isHintMuted(prefs, a.id))
}

/** Coerces old or partial saves. Missing means a new game's defaults. */
export function sanitizeHintPrefs(raw: unknown): HintPrefs {
  if (!raw || typeof raw !== 'object') return newGameHintPrefs()
  const r = raw as Partial<HintPrefs>
  const muted = Array.isArray(r.muted) ? r.muted.filter((m): m is string => typeof m === 'string') : []
  return { allEnabled: muted.length === 0 && r.allEnabled !== false, muted }
}

interface KeyValue {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStore(): KeyValue | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function writeHintSettings(prefs: HintPrefs, store: KeyValue | null = defaultStore()): void {
  try {
    store?.setItem(HINT_SETTINGS_KEY, JSON.stringify(prefs))
  } catch {
    /* private mode */
  }
}

export function readHintSettings(store: KeyValue | null = defaultStore()): HintPrefs | null {
  try {
    const raw = store?.getItem(HINT_SETTINGS_KEY)
    return raw ? sanitizeHintPrefs(JSON.parse(raw)) : null
  } catch {
    return null
  }
}
