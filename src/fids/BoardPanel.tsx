import { useEffect, useRef, useState } from 'react'
import { COLUMNS } from './config'
import { flapKind, settleFlaps, stepFlaps, type FlapCell, type FlapState } from './flap'
import { boardSnapshot } from './project'
import type { BoardKind, BoardStatus, FidsSource } from './types'

const STATUS_WORD: Record<string, BoardStatus> = {
  BOARDING: 'Boarding',
  DELAYED: 'Delayed',
  DEPARTED: 'Departed',
}

function statusOf(cell: FlapCell): BoardStatus | null {
  return STATUS_WORD[cell.target.trim()] ?? null
}

function Glyphs({ cell, status }: { cell: FlapCell; status: boolean }) {
  const word = statusOf(cell)
  return (
    <span className="fids-cell" data-value={cell.shown.trim()} data-status={status ? (word ?? '').toLowerCase() : undefined}>
      {cell.shown.split('').map((ch, index) => (
        <span key={`${index}-${ch}`} className="fids-glyph">
          {ch === ' ' ? '\u00a0' : ch}
        </span>
      ))}
    </span>
  )
}

/**
 * Side panel for the same split-flap board that hangs in the terminal.
 * It sits on the edge and leaves the apron clickable.
 */
export function BoardPanel({ source, onClose }: { source: FidsSource; onClose: () => void }) {
  const sourceRef = useRef(source)
  const [kind, setKind] = useState<BoardKind>('departures')
  const [flaps, setFlaps] = useState<FlapState>(() => settleFlaps(boardSnapshot(source)))
  const flapsRef = useRef(flaps)

  useEffect(() => {
    sourceRef.current = source
  }, [source])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const stepped = stepFlaps(flapsRef.current, boardSnapshot(sourceRef.current), dt)
      flapsRef.current = stepped.state
      if (stepped.dirty) setFlaps(stepped.state)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const rows = flapKind(flaps, kind)

  return (
    <aside className="fids-dock" data-testid="fids-panel" aria-label="Flight board">
      <div className="fids-head">
        <h2>Flight board</h2>
        <span className="fids-clock" data-testid="fids-clock">
          {flaps.clock || '--:--'}
        </span>
        <button type="button" className="ghost" data-testid="fids-close" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="fids-tabs" role="tablist">
        {(['departures', 'arrivals'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={kind === tab}
            className={kind === tab ? 'on' : ''}
            data-testid={`fids-tab-${tab}`}
            onClick={() => setKind(tab)}
          >
            {tab === 'departures' ? 'Departures' : 'Arrivals'}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="muted" data-testid="fids-empty">
          No movements on the board.
        </p>
      ) : (
        <table className="fids-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-testid="fids-row">
                {COLUMNS.map((col) => (
                  <td key={col.key}>
                    <Glyphs cell={row.cells[col.key]} status={col.key === 'status'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </aside>
  )
}
