import { useState } from 'react'
import { money } from '../../game/catalog.ts'
import {
  AUTOSAVE_ID,
  deleteSlot,
  listSlots,
  renameSlot,
  type SaveSlotMeta,
} from '../../features/save/library.ts'

function when(savedAt: number): string {
  if (!savedAt) return 'This browser'
  try {
    return new Date(savedAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Saved'
  }
}

function Thumb({ slot }: { slot: SaveSlotMeta }) {
  if (slot.thumb) return <img className="hf-thumb" src={slot.thumb} alt="" />
  return (
    <span className="hf-thumb hf-thumb-fallback" aria-hidden="true">
      <b>{String(slot.gameDay + 1).padStart(2, '0')}</b>
      <i>Day</i>
    </span>
  )
}

export function SaveBrowser({
  onLoad,
  onChanged,
  saveCopy,
}: {
  onLoad: (id: string) => void
  onChanged?: () => void
  /** Named copy of the field that is open. Omitted on the title. */
  saveCopy?: { defaultName: string; onSave: (name: string) => string }
}) {
  const [tick, setTick] = useState(0)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [copyName, setCopyName] = useState(saveCopy?.defaultName ?? '')
  const [note, setNote] = useState('')
  const slots = listSlots()

  const bump = () => {
    setTick((n) => n + 1)
    onChanged?.()
  }

  return (
    <div data-testid="save-browser" data-rev={tick}>
      <h2>Load game</h2>
      <p className="hf-muted">Autosave is the field this browser last wrote. A named copy stays when you start again.</p>
      {saveCopy ? (
        <form
          className="hf-save-as"
          onSubmit={(e) => {
            e.preventDefault()
            setNote(saveCopy.onSave(copyName))
            bump()
          }}
        >
          <input
            type="text"
            value={copyName}
            maxLength={48}
            aria-label="Save name"
            data-testid="save-name"
            onChange={(e) => setCopyName(e.target.value)}
          />
          <button type="submit" data-testid="save-copy">
            Save a copy
          </button>
        </form>
      ) : null}
      {note ? (
        <p className="hf-note" data-testid="save-browser-note">
          {note}
        </p>
      ) : null}
      {slots.length === 0 ? (
        <p className="hf-muted" data-testid="save-empty">
          No saves yet. A field writes an autosave while you play.
        </p>
      ) : (
        <ul className="hf-slots">
          {slots.map((slot) => {
            const confirming = confirmId === slot.id
            const editing = renaming === slot.id
            return (
              <li key={slot.id} className="hf-slot" data-testid={`save-slot-${slot.id}`} data-kind={slot.kind}>
                <Thumb slot={slot} />
                <div className="hf-slot-body">
                  {editing ? (
                    <form
                      className="hf-rename"
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (renameSlot(slot.id, draft)) {
                          setRenaming(null)
                          bump()
                        }
                      }}
                    >
                      <input
                        type="text"
                        value={draft}
                        maxLength={48}
                        aria-label="New name"
                        data-testid={`save-rename-input-${slot.id}`}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <button type="submit" data-testid={`save-rename-ok-${slot.id}`}>
                        Keep name
                      </button>
                    </form>
                  ) : (
                    <strong>{slot.name}</strong>
                  )}
                  <p>
                    {slot.airport} · Day {slot.gameDay + 1} · {money(slot.cash)}
                  </p>
                  <p className="hf-muted">
                    {slot.id === AUTOSAVE_ID ? 'Latest autosave · ' : slot.kind === 'autosave' ? 'Earlier autosave · ' : ''}
                    {when(slot.savedAt)}
                  </p>
                  <div className="hf-slot-actions">
                    {confirming ? (
                      <>
                        <span>Delete this save?</span>
                        <button
                          type="button"
                          className="danger"
                          data-testid={`save-delete-confirm-${slot.id}`}
                          onClick={() => {
                            deleteSlot(slot.id)
                            setConfirmId(null)
                            bump()
                          }}
                        >
                          Delete
                        </button>
                        <button type="button" data-testid={`save-delete-cancel-${slot.id}`} onClick={() => setConfirmId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="primary" data-testid={`save-load-${slot.id}`} onClick={() => onLoad(slot.id)}>
                          Load
                        </button>
                        <button
                          type="button"
                          data-testid={`save-rename-${slot.id}`}
                          onClick={() => {
                            setRenaming(slot.id)
                            setDraft(slot.name)
                            setConfirmId(null)
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="danger"
                          data-testid={`save-delete-${slot.id}`}
                          onClick={() => {
                            setConfirmId(slot.id)
                            setRenaming(null)
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
