import { useState, useSyncExternalStore } from 'react'
import { ACTION_GROUPS, ACTIONS, actionDef, bindingLabel, type ActionId } from '../input/actions.ts'
import { inputMap } from '../input/map.ts'

/**
 * Every named action, with click-to-rebind. A new binding replaces that
 * action's whole set and is taken off anything else that used it.
 */
export function ControlsPanel() {
  const version = useSyncExternalStore(inputMap.subscribe, inputMap.getSnapshot)
  const [listening, setListening] = useState<ActionId | null>(null)
  const [note, setNote] = useState('Click an action, then press a key, scroll, or a gamepad button.')

  const start = (id: ActionId) => {
    setListening(id)
    setNote('Press a key, scroll, or a gamepad button. Esc cancels.')
    inputMap.captureNext(
      (binding) => {
        const stole = inputMap.rebindAction(id, binding)
        setListening(null)
        if (stole.length) {
          const names = stole.map((owner) => actionDef(owner)?.label ?? owner).join(', ')
          setNote(`Bound to ${bindingLabel(binding)}. Also used by ${names} — taken from them.`)
        } else {
          setNote(`Bound to ${bindingLabel(binding)}.`)
        }
      },
      () => {
        setListening(null)
        setNote('Rebind cancelled.')
      },
    )
  }

  const resetOne = (id: ActionId) => {
    const stole = inputMap.resetOne(id)
    setListening(null)
    if (stole.length) {
      const names = stole.map((owner) => actionDef(owner)?.label ?? owner).join(', ')
      setNote(`Restored. Took the default off ${names}.`)
    } else {
      setNote('Restored the default.')
    }
  }

  return (
    <div className="controls-panel" data-testid="controls-panel" data-rev={version}>
      <p className="muted controls-hint">{note}</p>
      {ACTION_GROUPS.map((group) => (
        <section key={group}>
          <h3 className="control-group">{group}</h3>
          {ACTIONS.filter((action) => action.group === group).map((action) => {
            const id = action.id as ActionId
            const labels = (inputMap.table[id] ?? []).map(bindingLabel)
            return (
              <div
                key={id}
                className={`control-row${listening === id ? ' listening' : ''}`}
                data-testid={`control-${id}`}
              >
                <button type="button" className="control-bind-hit" onClick={() => start(id)}>
                  <span>{action.label}</span>
                  <span className="control-bind">{listening === id ? 'Press a key…' : labels.join(' · ') || 'Unbound'}</span>
                </button>
                <button type="button" className="control-reset" data-testid={`control-reset-${id}`} onClick={() => resetOne(id)}>
                  Reset
                </button>
              </div>
            )
          })}
        </section>
      ))}
      <button
        type="button"
        className="wide"
        data-testid="controls-reset-all"
        onClick={() => {
          inputMap.resetEverything()
          setListening(null)
          setNote('All controls restored, including the sticks.')
        }}
      >
        Reset all controls
      </button>
      <p className="muted controls-hint">
        Rebinding replaces every key and stick on that action. Reset brings the sticks back.
      </p>
    </div>
  )
}
