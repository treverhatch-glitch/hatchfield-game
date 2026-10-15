import { beforeEach, describe, expect, it } from 'vitest'
import { SAVE_KEY } from '../../game/types.ts'
import {
  AUTOSAVE_ID,
  HISTORY_LIMIT,
  activateSlot,
  deleteSlot,
  listSlots,
  renameSlot,
  rotateAutosave,
  touchAutosave,
  writeManualSlot,
} from './library.ts'
import { memoryStore } from './save.ts'

function facts(gameDay: number, cash = 1000) {
  return { savedAt: 1_700_000_000_000 + gameDay, gameDay, cash, airport: 'Hatchfield' }
}

describe('save slots', () => {
  const store = memoryStore()

  beforeEach(() => {
    for (const key of Object.keys(store.dump())) store.removeItem(key)
  })

  it('lists the live autosave and keeps an earlier day', () => {
    store.setItem(SAVE_KEY, '{"day":0}')
    rotateAutosave(0, store)
    touchAutosave(facts(0, 500), store)
    rotateAutosave(1, store)
    store.setItem(SAVE_KEY, '{"day":1}')
    touchAutosave(facts(1, 800), store)

    const rows = listSlots(store)
    expect(rows[0]).toMatchObject({ id: AUTOSAVE_ID, name: 'Autosave', gameDay: 1, cash: 800, kind: 'autosave' })
    expect(rows[1]).toMatchObject({ kind: 'autosave', gameDay: 0, cash: 500, name: 'Autosave · day 1' })
    expect(store.getItem(SAVE_KEY)).toBe('{"day":1}')
    expect(store.getItem(`hatchfield.slot.${rows[1]!.id}`)).toBe('{"day":0}')
    expect(rows).toHaveLength(2)
  })

  it('caps autosave history', () => {
    store.setItem(SAVE_KEY, 'a')
    touchAutosave(facts(0), store)
    for (let day = 1; day <= HISTORY_LIMIT + 2; day++) {
      rotateAutosave(day, store)
      store.setItem(SAVE_KEY, `day-${day}`)
      touchAutosave(facts(day), store)
    }
    const history = listSlots(store).filter((row) => row.id !== AUTOSAVE_ID)
    expect(history).toHaveLength(HISTORY_LIMIT)
    expect(history.map((row) => row.gameDay)).toEqual([3, 2])
  })

  it('stores, renames, loads, and deletes a named copy', () => {
    store.setItem(SAVE_KEY, 'live')
    touchAutosave(facts(2, 4200), store)
    const saved = writeManualSlot({ ...facts(2, 4200), name: '  Morning bank  ', thumb: 'not-an-image' }, store)
    expect(saved?.name).toBe('Morning bank')
    expect(saved?.thumb).toBeUndefined()
    expect(renameSlot(saved!.id, 'Evening bank', store)).toBe(true)
    expect(listSlots(store).find((row) => row.id === saved!.id)?.name).toBe('Evening bank')

    store.setItem(SAVE_KEY, 'later')
    expect(activateSlot(saved!.id, store)).toBe(true)
    expect(store.getItem(SAVE_KEY)).toBe('live')

    deleteSlot(saved!.id, store)
    expect(listSlots(store).some((row) => row.id === saved!.id)).toBe(false)
    expect(store.getItem(`hatchfield.slot.${saved!.id}`)).toBeNull()
  })

  it('keeps a renamed autosave name across the next write', () => {
    store.setItem(SAVE_KEY, 'live')
    touchAutosave(facts(1, 10), store)
    expect(renameSlot(AUTOSAVE_ID, 'Dawn', store)).toBe(true)
    touchAutosave(facts(1, 12), store)
    expect(listSlots(store)[0]?.name).toBe('Dawn')
    deleteSlot(AUTOSAVE_ID, store)
    expect(store.getItem(SAVE_KEY)).toBeNull()
    expect(listSlots(store)).toHaveLength(0)
  })

  it('refuses a named copy when nothing is saved', () => {
    expect(writeManualSlot({ ...facts(0), name: 'Empty' }, store)).toBeNull()
  })
})
