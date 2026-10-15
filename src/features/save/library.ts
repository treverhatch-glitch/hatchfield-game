/**
 * Named copies beside the live autosave.
 * The field itself stays in SAVE_KEY. Continue still reads that key.
 * History and manual slots keep their own copies under SLOT_PREFIX.
 */

import { SAVE_KEY } from '../../game/types.ts'
import type { KeyValueStore } from './save.ts'

export const SLOT_INDEX_KEY = 'hatchfield.slots.v1'
export const SLOT_PREFIX = 'hatchfield.slot.'
export const AUTOSAVE_ID = 'autosave'
export const HISTORY_LIMIT = 2
export const MANUAL_LIMIT = 8

export interface SaveSlotMeta {
  id: string
  name: string
  savedAt: number
  /** `Game.gameDay()` — the first day is 0. */
  gameDay: number
  cash: number
  airport: string
  kind: 'autosave' | 'manual'
  /** JPEG data URL. Named copies only. */
  thumb?: string
}

interface SlotIndex {
  autosave: SaveSlotMeta | null
  history: SaveSlotMeta[]
  manual: SaveSlotMeta[]
}

const EMPTY = (): SlotIndex => ({ autosave: null, history: [], manual: [] })

function storeOf(store?: KeyValueStore): KeyValueStore {
  return store ?? (globalThis.localStorage as KeyValueStore)
}

export function readIndex(store?: KeyValueStore): SlotIndex {
  const raw = storeOf(store).getItem(SLOT_INDEX_KEY)
  if (!raw) return EMPTY()
  try {
    const parsed = JSON.parse(raw) as Partial<SlotIndex>
    return {
      autosave: parsed.autosave ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      manual: Array.isArray(parsed.manual) ? parsed.manual : [],
    }
  } catch {
    return EMPTY()
  }
}

function writeIndex(index: SlotIndex, store: KeyValueStore) {
  store.setItem(SLOT_INDEX_KEY, JSON.stringify(index))
}

export interface AutosaveFacts {
  savedAt: number
  gameDay: number
  cash: number
  airport: string
}

/**
 * Call immediately before SAVE_KEY is replaced.
 * When the stored autosave is from an earlier day, that copy becomes a history slot.
 */
export function rotateAutosave(nextDay: number, store?: KeyValueStore): void {
  const s = storeOf(store)
  try {
    const prev = s.getItem(SAVE_KEY)
    if (!prev) return
    const index = readIndex(s)
    const current = index.autosave
    if (!current || current.gameDay >= nextDay) return
    const id = `auto-${current.gameDay}-${current.savedAt || 0}`
    s.setItem(SLOT_PREFIX + id, prev)
    const archived: SaveSlotMeta = {
      ...current,
      id,
      kind: 'autosave',
      name: `Autosave · day ${current.gameDay + 1}`,
      thumb: undefined,
    }
    index.history = [archived, ...index.history.filter((row) => row.id !== id)]
    while (index.history.length > HISTORY_LIMIT) {
      const dropped = index.history.pop()
      if (dropped) s.removeItem(SLOT_PREFIX + dropped.id)
    }
    writeIndex(index, s)
  } catch {
    /* quota or private mode — the live save still writes */
  }
}

/** Call after SAVE_KEY is written. Refreshes the live autosave row. */
export function touchAutosave(facts: AutosaveFacts, store?: KeyValueStore): void {
  const s = storeOf(store)
  try {
    if (!s.getItem(SAVE_KEY)) return
    const index = readIndex(s)
    const renamed =
      index.autosave && index.autosave.name && index.autosave.name !== 'Autosave'
        ? index.autosave.name
        : 'Autosave'
    index.autosave = {
      id: AUTOSAVE_ID,
      name: renamed,
      savedAt: facts.savedAt,
      gameDay: facts.gameDay,
      cash: facts.cash,
      airport: facts.airport || 'Hatchfield',
      kind: 'autosave',
    }
    writeIndex(index, s)
  } catch {
    /* the field save is already stored */
  }
}

export function listSlots(store?: KeyValueStore): SaveSlotMeta[] {
  const s = storeOf(store)
  const index = readIndex(s)
  const rows: SaveSlotMeta[] = []
  if (s.getItem(SAVE_KEY)) {
    rows.push(
      index.autosave ?? {
        id: AUTOSAVE_ID,
        name: 'Autosave',
        savedAt: 0,
        gameDay: 0,
        cash: 0,
        airport: 'Hatchfield',
        kind: 'autosave',
      },
    )
  }
  for (const row of index.history) {
    if (s.getItem(SLOT_PREFIX + row.id)) rows.push(row)
  }
  const manual = [...index.manual].sort((a, b) => b.savedAt - a.savedAt)
  for (const row of manual) {
    if (s.getItem(SLOT_PREFIX + row.id)) rows.push(row)
  }
  return rows
}

function slotId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Copy the live autosave into a named slot. Null when the browser cannot store it. */
export function writeManualSlot(
  facts: AutosaveFacts & { name: string; thumb?: string },
  store?: KeyValueStore,
): SaveSlotMeta | null {
  const s = storeOf(store)
  const payload = s.getItem(SAVE_KEY)
  if (!payload) return null
  const index = readIndex(s)
  const name = facts.name.trim().slice(0, 48) || 'Saved game'
  const meta: SaveSlotMeta = {
    id: slotId(),
    name,
    savedAt: facts.savedAt,
    gameDay: facts.gameDay,
    cash: facts.cash,
    airport: facts.airport || 'Hatchfield',
    kind: 'manual',
    thumb: facts.thumb && facts.thumb.startsWith('data:image/') && facts.thumb.length < 90_000 ? facts.thumb : undefined,
  }
  try {
    s.setItem(SLOT_PREFIX + meta.id, payload)
  } catch {
    return null
  }
  const next = [meta, ...index.manual]
  const dropped = next.slice(MANUAL_LIMIT)
  index.manual = next.slice(0, MANUAL_LIMIT)
  for (const row of dropped) s.removeItem(SLOT_PREFIX + row.id)
  try {
    writeIndex(index, s)
  } catch {
    meta.thumb = undefined
    index.manual = index.manual.map((row) => (row.id === meta.id ? meta : row))
    try {
      writeIndex(index, s)
    } catch {
      s.removeItem(SLOT_PREFIX + meta.id)
      return null
    }
  }
  return meta
}

export function renameSlot(id: string, name: string, store?: KeyValueStore): boolean {
  const next = name.trim().slice(0, 48)
  if (!next) return false
  const s = storeOf(store)
  const index = readIndex(s)
  if (id === AUTOSAVE_ID) {
    if (!index.autosave || !s.getItem(SAVE_KEY)) return false
    index.autosave = { ...index.autosave, name: next }
    writeIndex(index, s)
    return true
  }
  let hit = false
  const rename = (row: SaveSlotMeta): SaveSlotMeta => {
    if (row.id !== id) return row
    hit = true
    return { ...row, name: next }
  }
  index.history = index.history.map(rename)
  index.manual = index.manual.map(rename)
  if (!hit) return false
  writeIndex(index, s)
  return true
}

export function deleteSlot(id: string, store?: KeyValueStore): void {
  const s = storeOf(store)
  const index = readIndex(s)
  if (id === AUTOSAVE_ID) {
    s.removeItem(SAVE_KEY)
    index.autosave = null
    writeIndex(index, s)
    return
  }
  s.removeItem(SLOT_PREFIX + id)
  index.history = index.history.filter((row) => row.id !== id)
  index.manual = index.manual.filter((row) => row.id !== id)
  writeIndex(index, s)
}

/** Point SAVE_KEY at a slot so `Game.load()` resumes it. */
export function activateSlot(id: string, store?: KeyValueStore): boolean {
  const s = storeOf(store)
  if (id === AUTOSAVE_ID) return Boolean(s.getItem(SAVE_KEY))
  const payload = s.getItem(SLOT_PREFIX + id)
  if (!payload) return false
  try {
    s.setItem(SAVE_KEY, payload)
  } catch {
    return false
  }
  const index = readIndex(s)
  const meta = [...index.history, ...index.manual].find((row) => row.id === id)
  if (meta) {
    index.autosave = {
      id: AUTOSAVE_ID,
      name: 'Autosave',
      savedAt: meta.savedAt,
      gameDay: meta.gameDay,
      cash: meta.cash,
      airport: meta.airport,
      kind: 'autosave',
    }
    try {
      writeIndex(index, s)
    } catch {
      /* the payload is already the live save */
    }
  }
  return true
}
