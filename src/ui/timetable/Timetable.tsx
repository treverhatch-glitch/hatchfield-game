import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { axisTicks, barNote, boardRows, buildGantt, filterFlights, frac, hourTicks, pxToSec, runwayLanes, runwayOf, viewSpan, type GanttBar, type RunwayLaneModel, type ViewSpan } from './layout'
import { gameMinToSim, SCHEDULE } from './scheduleConfig'
import { schedulePillOpen, setSchedulePill, sheetShown, subscribeScheduleSheet } from './scheduleSheet'
import { clampToWindow, clockLabel, dayIndex, durationLabel, hourSecs, standFits } from './time'
import type { TimetableAdapter, TtFlight } from './types'
import './timetable.css'

type Tab = 'stands' | 'runway' | 'board'
const ZOOMS = [6, 12, 24] as const

interface Drag {
  id: string
  startX: number
  startY: number
  widthPx: number
  dx: number
  dy: number
  moved: boolean
}

/**
 * Bottom-dock timetable (Cities: Skylines 2 style). Collapsed it is one small
 * pill; open it sits above the category bar, never wider than ~half the
 * screen, and folds away by itself while a build menu is open.
 */
export function Timetable({
  adapter,
  menuOpen = false,
  plannerOpen = false,
  defaultOpen = false,
}: {
  adapter: TimetableAdapter
  menuOpen?: boolean
  plannerOpen?: boolean
  defaultOpen?: boolean
}) {
  const [pillOpen, setPillOpen] = useState(defaultOpen)
  const [tab, setTab] = useState<Tab>('stands')
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(24)
  const [dayShift, setDayShift] = useState(0)
  const [airlineFilter, setAirlineFilter] = useState<string | null>(null)
  const [conflictsOnly, setConflictsOnly] = useState(false)
  const [codeFilter, setCodeFilter] = useState('')
  const [query, setQuery] = useState('')
  const [checkIn, setCheckIn] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [swapFrom, setSwapFrom] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [, tick] = useState(0)
  const dragRef = useRef<Drag | null>(null)

  useEffect(() => setSchedulePill(pillOpen), [pillOpen])
  useEffect(() => subscribeScheduleSheet(() => setPillOpen(schedulePillOpen())), [])
  const shown = sheetShown({ pill: pillOpen, planner: plannerOpen, buildMenu: menuOpen })

  useEffect(() => {
    if (!shown) return
    const h = window.setInterval(() => tick((n) => n + 1), 500)
    return () => window.clearInterval(h)
  }, [shown])

  const day = adapter.dayLength
  const now = adapter.now()
  const flights = adapter.flights()
  const stands = adapter.stands()
  const span = viewSpan(now, day, zoom, dayShift)
  const conflictIds = new Set(
    buildGantt(flights, stands, span).flatMap((g) =>
      g.rows.flatMap((r) => r.bars.filter((b) => b.conflict).map((b) => b.flight.id)),
    ),
  )
  const shownFlights = filterFlights(flights, {
    airline: airlineFilter,
    conflictsOnly,
    code: codeFilter,
    query,
    conflictIds,
  })
  const filterOn = Boolean(airlineFilter || conflictsOnly || codeFilter || query.trim())
  const airlines = [...new Map(flights.map((f) => [f.airlineName, f])).values()]
  const runwayList = adapter.runways()
  const multiRw = runwayList.length > 1
  const rwLabel = (id: string | null | undefined) => (id ? runwayList.find((r) => r.id === id)?.label ?? id : 'Auto')

  const nextArr = flights.filter((f) => f.direction === 'arr' && f.time >= now && f.status !== 'cancelled').sort((a, b) => a.time - b.time)[0]
  const nextDep = flights.filter((f) => f.direction === 'dep' && f.time >= now && f.status !== 'cancelled').sort((a, b) => a.time - b.time)[0]

  const selFlight = sel ? flights.find((f) => f.id === sel) ?? null : null
  const preview = (f: TtFlight): number => {
    if (!drag || drag.id !== f.id) return 0
    const target = clampToWindow(f.time + pxToSec(drag.dx, drag.widthPx, span), f.window, now)
    return target - f.time
  }

  const onBarDown = (e: RPointerEvent<HTMLDivElement>, f: TtFlight) => {
    e.stopPropagation()
    if (swapFrom && swapFrom !== f.id) {
      adapter.swapStands(swapFrom, f.id)
      setSwapFrom(null)
      setSel(f.id)
      return
    }
    const lane = (e.currentTarget.parentElement as HTMLElement | null)?.getBoundingClientRect()
    const d: Drag = {
      id: f.id,
      startX: e.clientX,
      startY: e.clientY,
      widthPx: lane?.width ?? 600,
      dx: 0,
      dy: 0,
      moved: false,
    }
    dragRef.current = d
    setDrag(d)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onBarMove = (e: RPointerEvent<HTMLDivElement>, f: TtFlight) => {
    const d = dragRef.current
    if (!d || d.id !== f.id) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    const next = { ...d, dx, dy, moved: d.moved || Math.abs(dx) > 3 || Math.abs(dy) > 8 }
    dragRef.current = next
    setDrag(next)
  }
  const onBarUp = (e: RPointerEvent<HTMLDivElement>, f: TtFlight) => {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d || d.id !== f.id) return
    if (d.moved && f.movable) {
      if (adapter.caps.move && Math.abs(d.dx) > 3) {
        adapter.moveTo(f.id, f.time + pxToSec(d.dx, d.widthPx, span))
      }
      if (adapter.caps.pin && Math.abs(d.dy) > 8) {
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-stand]')
        const standId = hit?.getAttribute('data-stand') || null
        adapter.pinStand(f.id, standId)
      }
    }
    setSel(f.id)
  }

  const gantt = buildGantt(shownFlights, stands, span)
    .map((g) => (filterOn ? { ...g, rows: g.rows.filter((r) => r.bars.length > 0) } : g))
    .filter((g) => g.rows.length > 0)
  const ticks = axisTicks(span, day)
  const nowX = frac(now, span)
  const grid = ticks.map((t) => (
    <i key={t.t} className={t.minor ? 'tt-grid minor' : 'tt-grid'} style={{ left: `${frac(t.t, span) * 100}%` }} />
  ))

  const timeAxis = (
    <div className="tt-axis">
      {ticks.map((t) => (
        <span key={t.t} style={{ left: `${frac(t.t, span) * 100}%` }}>
          {t.label}
        </span>
      ))}
    </div>
  )
  const nowLine = <i className="tt-now" style={{ left: `${nowX * 100}%` }} />

  return (
    <div className="tt-root" data-hud-part="timetable" data-open={shown ? '1' : '0'}>
      {!shown ? (
        <button
          type="button"
          className="tt-pill"
          onClick={() => setPillOpen(true)}
          title={menuOpen ? 'Close the build menu to open the timetable' : 'Open timetable'}
        >
          <b>Timetable</b>
          <span>
            Day {dayIndex(now, day)} {clockLabel(now, day)}
          </span>
          {nextArr ? <span>↘ {nextArr.flightNo} {clockLabel(nextArr.time, day)}</span> : null}
          {nextDep ? <span>↗ {nextDep.flightNo} {clockLabel(nextDep.time, day)}</span> : null}
          <span className="tt-caret">▴</span>
        </button>
      ) : (
        <section className="tt-dock" onPointerDown={() => swapFrom === null && setSel(null)}>
          <header className="tt-head" onPointerDown={(e) => e.stopPropagation()}>
            <nav className="tt-tabs">
              {(['stands', 'runway', 'board'] as Tab[]).map((t) => (
                <button key={t} type="button" className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                  {t === 'stands' ? 'Stands' : t === 'runway' ? 'Runway' : 'List'}
                </button>
              ))}
            </nav>
            <span className="tt-clock">
              Day {dayIndex(now, day)} · {clockLabel(now, day)} · <em>{adapter.source}</em>
            </span>
            <span className="tt-zoom">
              <button type="button" onClick={() => setDayShift((d) => d - 1)} title="Previous day">
                ‹
              </button>
              {ZOOMS.map((z) => (
                <button key={z} type="button" className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>
                  {z}h
                </button>
              ))}
              <button type="button" onClick={() => setDayShift((d) => d + 1)} title="Next day">
                ›
              </button>
            </span>
            {plannerOpen ? null : (
              <button type="button" className="tt-close" onClick={() => setPillOpen(false)} title="Collapse">
                ▾
              </button>
            )}
          </header>
          <div className="tt-filter" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className={!airlineFilter ? 'on' : ''} onClick={() => setAirlineFilter(null)}>
              All
            </button>
            {airlines.map((a) => (
              <button
                key={a.airlineName}
                type="button"
                className={airlineFilter === a.airlineName ? 'on' : ''}
                style={{ borderColor: a.color, color: a.color }}
                onClick={() => setAirlineFilter(airlineFilter === a.airlineName ? null : a.airlineName)}
              >
                {a.airlineName}
              </button>
            ))}
            <button type="button" className={conflictsOnly ? 'on' : ''} onClick={() => setConflictsOnly((v) => !v)}>
              Conflicts
            </button>
            <select value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} aria-label="Aircraft code">
              <option value="">Code</option>
              {['A', 'B', 'C', 'D', 'E', 'F'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={query}
              placeholder="Flight"
              aria-label="Flight number"
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className={checkIn ? 'on' : ''} onClick={() => setCheckIn((v) => !v)}>
              Check-in
            </button>
          </div>
          {swapFrom ? (
            <p className="tt-hint">Pick another flight to swap stands with · <button type="button" onClick={() => setSwapFrom(null)}>Cancel</button></p>
          ) : null}

          <div className="tt-body">
            {tab === 'stands' ? (
              <div className="tt-gantt">
                <div className="tt-row tt-row-axis">
                  <span className="tt-label" />
                  <div className="tt-lane">{timeAxis}</div>
                </div>
                {gantt.length === 0 ? <p className="tt-empty">No stands or flights yet.</p> : null}
                {gantt.map((g) => (
                  <div key={g.icao} className="tt-group">
                    {g.icao === 'none' ? <h4>Tower</h4> : null}
                    {g.rows.map((row, ri) => (
                      <div key={row.stand?.id ?? `none-${ri}`} className="tt-row" data-stand={row.stand?.id ?? ''}>
                        <span
                          className="tt-label"
                          title={row.stand ? `Takes up to Code ${row.stand.icao}` : ''}
                          style={row.stand?.leaseColor ? { boxShadow: `inset 3px 0 0 ${row.stand.leaseColor}` } : undefined}
                        >
                          {row.stand ? row.stand.label : ri === 0 ? 'Tower' : ''}
                          {row.stand?.leaseAirline ? <small> · {row.stand.leaseAirline}</small> : null}
                        </span>
                        <div className="tt-lane">
                          {grid}
                          {nowLine}
                          {row.bars.map((b) => {
                            const f = b.flight
                            const off = preview(f)
                            const showBand = f.window && (sel === f.id || drag?.id === f.id)
                            const buf = gameMinToSim(SCHEDULE.standBufferMin)
                            const bufLeft = frac(f.onStandTo + off, span)
                            const bufWidth = frac(span.from + buf, span) - frac(span.from, span)
                            return (
                              <div key={f.id} className="tt-barwrap">
                                {checkIn && f.checkInFrom != null && f.checkInTo != null ? (
                                  <i
                                    className="tt-checkin"
                                    style={{
                                      left: `${Math.max(0, frac(f.checkInFrom, span)) * 100}%`,
                                      width: `${Math.max(0, frac(f.checkInTo, span) - Math.max(0, frac(f.checkInFrom, span))) * 100}%`,
                                    }}
                                  />
                                ) : null}
                                <i
                                  className="tt-buffer"
                                  data-tight={b.buffer ? '1' : '0'}
                                  style={{
                                    left: `${Math.max(0, bufLeft) * 100}%`,
                                    width: `${Math.max(0, bufWidth) * 100}%`,
                                  }}
                                />
                                {showBand && f.window ? (
                                  <i
                                    className="tt-window"
                                    style={{
                                      left: `${Math.max(0, frac(f.window.start, span)) * 100}%`,
                                      width: `${Math.max(0, Math.min(1, frac(f.window.end + (f.onStandTo - f.time), span)) - Math.max(0, frac(f.window.start, span))) * 100}%`,
                                    }}
                                  />
                                ) : null}
                                <div
                                  className="tt-bar"
                                  data-conflict={b.conflict ? '1' : '0'}
                                  data-sel={sel === f.id ? '1' : '0'}
                                  data-movable={f.movable ? '1' : '0'}
                                  style={{
                                    left: `${(b.left + frac(span.from + off, span)) * 100}%`,
                                    width: `${b.width * 100}%`,
                                    ['--al' as string]: f.color,
                                    ['--stripe' as string]: f.stripe ?? f.color,
                                  }}
                                  onPointerDown={(e) => onBarDown(e, f)}
                                  onPointerMove={(e) => onBarMove(e, f)}
                                  onPointerUp={(e) => onBarUp(e, f)}
                                  title={`${f.flightNo} ${clockLabel(f.time + off, day)}`}
                                >
                                  {f.pinned ? '📌' : ''}
                                  {f.flightNo}
                                  {multiRw ? <small className="tt-rw"> {rwLabel(f.runwayId)}</small> : null}
                                  {drag?.id === f.id && drag.moved ? <em> {clockLabel(f.time + off, day)}</em> : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}

            {tab === 'runway' ? (
              <RunwayLane adapter={adapter} flights={shownFlights} span={span} sel={sel} onSel={setSel} />
            ) : null}

            {tab === 'board' ? (
              <div className="tt-board">
                {(['arr', 'dep'] as const).map((dir) => (
                  <table key={dir}>
                    <caption>{dir === 'arr' ? 'Arrivals' : 'Departures'}</caption>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Flight</th>
                        <th>Airline</th>
                        <th>Stand</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boardRows(shownFlights, dir, now, day, 200, span).map((r) => (
                        <tr key={r.id} data-sel={sel === r.id ? '1' : '0'} onClick={() => setSel(r.id)}>
                          <td>
                            {r.est ? <s>{r.time}</s> : r.time}
                            {r.est ? <b className="late"> {r.est}</b> : null}
                          </td>
                          <td style={{ color: r.color }}>{r.flightNo}</td>
                          <td>{r.airline}</td>
                          <td>{r.stand}</td>
                          <td className={r.late ? 'late' : ''}>{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            ) : null}
          </div>

          {selFlight ? (
            <FlightCard
              adapter={adapter}
              flight={selFlight}
              note={barNote(gantt.flatMap((g) => g.rows.flatMap((r) => r.bars)).find((b) => b.flight.id === selFlight.id) ?? emptyBar(selFlight), day)}
              stands={stands}
              runways={runwayList}
              onSwap={() => setSwapFrom(selFlight.id)}
              onClose={() => setSel(null)}
            />
          ) : null}
        </section>
      )}
    </div>
  )
}

function emptyBar(flight: TtFlight): GanttBar {
  return { flight, left: 0, width: 0, conflict: false, buffer: false, gapSec: null }
}

function RunwayLane({
  adapter,
  flights,
  span,
  sel,
  onSel,
}: {
  adapter: TimetableAdapter
  flights: TtFlight[]
  span: ViewSpan
  sel: string | null
  onSel: (id: string) => void
}) {
  const day = adapter.dayLength
  const runways = adapter.runways()
  const { lanes, total } = runwayLanes(flights, runways, span, day)
  const [open, setOpen] = useState<{ lane: string; start: number } | null>(null)
  const all = [...lanes, total]
  const peak = Math.max(1, ...all.flatMap((l) => l.buckets.map((b) => Math.max(b.cap, b.arr + b.dep))))
  const openLane = open ? all.find((l) => l.id === open.lane) : undefined
  const ob = openLane?.buckets.find((b) => b.start === open?.start)

  const histogram = (lane: RunwayLaneModel) => (
    <div className="tt-lane tt-lane-hist">
      {lane.buckets.map((b) => {
        const l = Math.max(0, frac(b.start, span))
        const r = Math.min(1, frac(b.start + hourSecs(day), span))
        return (
          <button
            type="button"
            key={b.start}
            className="tt-bucket"
            data-over={b.over ? '1' : '0'}
            style={{ left: `${l * 100}%`, width: `${(r - l) * 100}%` }}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(open && open.lane === lane.id && open.start === b.start ? null : { lane: lane.id, start: b.start })
            }}
            title={`${lane.label} ${b.label}: ${b.arr + b.dep}/${b.cap}`}
          >
            <i className="arr" style={{ height: `${(b.arr / peak) * 100}%` }} />
            <i className="dep" style={{ height: `${(b.dep / peak) * 100}%`, bottom: `${(b.arr / peak) * 100}%` }} />
            {lane.id !== 'auto' ? <i className="cap" style={{ bottom: `${(b.cap / peak) * 100}%` }} /> : null}
          </button>
        )
      })}
      {lane.id !== 'total'
        ? lane.flights.map((f) => (
            <button
              type="button"
              key={f.id}
              className="tt-tick"
              data-dir={f.direction}
              data-sel={sel === f.id ? '1' : '0'}
              style={{ left: `${frac(f.time, span) * 100}%`, ['--al' as string]: f.color }}
              onClick={(e) => {
                e.stopPropagation()
                onSel(f.id)
              }}
              title={`${f.direction === 'arr' ? 'Arr' : 'Dep'} ${f.flightNo} ${clockLabel(f.time, day)}`}
            />
          ))
        : null}
    </div>
  )

  return (
    <div className="tt-runway">
      {lanes.map((lane) => (
        <div key={lane.id} className="tt-row tt-row-rw" data-lane={lane.id}>
          <span className="tt-label" title={lane.id === 'auto' ? 'Tower assigns a strip when the slot banks' : `${lane.cap} moves/h`}>
            {lane.label}
            {lane.id !== 'auto' ? <small> {lane.cap}/h</small> : null}
          </span>
          {histogram(lane)}
        </div>
      ))}
      <div className="tt-row tt-row-rw tt-row-total" data-lane="total">
        <span className="tt-label">
          Total<small> {total.cap}/h</small>
        </span>
        {histogram(total)}
      </div>
      <div className="tt-row tt-row-axis">
        <span className="tt-label" />
        <div className="tt-lane">
          {hourTicks(span, day).map((t) => (
            <span key={t.t} className="tt-axis-tick" style={{ left: `${frac(t.t, span) * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
      {ob && openLane ? (
        <div className="tt-card tt-card-inline" onPointerDown={(e) => e.stopPropagation()}>
          <b>
            {openLane.label} · {ob.label}–{clockLabel(ob.start + hourSecs(day), day)}
          </b>
          <span>
            {ob.arr} arrivals · {ob.dep} departures
            {openLane.id === 'auto'
              ? ' · not yet on a strip'
              : ` · capacity ${ob.cap}/h${openLane.id === 'total' ? ` across ${runways.length} runway${runways.length === 1 ? '' : 's'}` : ''}`}
          </span>
          {ob.over ? <span className="late">Over capacity: expect holds and delays.</span> : null}
        </div>
      ) : null}
    </div>
  )
}

function FlightCard({
  adapter,
  flight: f,
  note,
  stands,
  runways,
  onSwap,
  onClose,
}: {
  adapter: TimetableAdapter
  flight: TtFlight
  note: string | null
  stands: ReturnType<TimetableAdapter['stands']>
  runways: ReturnType<TimetableAdapter['runways']>
  onSwap: () => void
  onClose: () => void
}) {
  const day = adapter.dayLength
  const fits = stands.filter((s) => standFits(s.icao, f.icao))
  return (
    <aside className="tt-card" onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <b style={{ color: f.color }}>{f.flightNo}</b> <span>{f.airlineName}</span>
        <button type="button" onClick={onClose} title="Close">
          ×
        </button>
      </header>
      <dl>
        <dt>{f.direction === 'arr' ? 'Arrives' : 'Departs'}</dt>
        <dd>
          {clockLabel(f.time, day)}
          {f.delaySec > 0.5 ? <span className="late"> (+{durationLabel(f.delaySec, day)}{f.delayReason ? `, ${f.delayReason}` : ''})</span> : null}
        </dd>
        <dt>On stand</dt>
        <dd>
          {clockLabel(f.onStandFrom, day)}–{clockLabel(f.onStandTo, day)} · {durationLabel(f.onStandTo - f.onStandFrom, day)}
        </dd>
        {f.window ? (
          <>
            <dt>Window</dt>
            <dd>
              {clockLabel(f.window.start, day)}–{clockLabel(f.window.end, day)}{' '}
              <span className="muted">({f.window.source === 'contract' ? 'contract slot' : 'tower limit'})</span>
            </dd>
          </>
        ) : null}
        <dt>Aircraft</dt>
        <dd>
          {f.aircraft} · Code {f.icao}
        </dd>
        <dt>Stand</dt>
        <dd>
          {f.standLabel}
          {f.pinned ? ' (pinned)' : ''}
        </dd>
        <dt>Runway</dt>
        <dd>
          {(() => {
            const id = runwayOf(f)
            return id ? runways.find((r) => r.id === id)?.label ?? id : 'Auto (tower picks)'
          })()}
          {f.depRunwayId && f.depRunwayId !== f.runwayId ? ` · dep ${runways.find((r) => r.id === f.depRunwayId)?.label ?? f.depRunwayId}` : ''}
        </dd>
        {f.turnTarget ? (
          <>
            <dt>Turn target</dt>
            <dd>{durationLabel(f.turnTarget, day)}</dd>
          </>
        ) : null}
        {f.services?.length ? (
          <>
            <dt>Services</dt>
            <dd>{f.services.join(', ')}</dd>
          </>
        ) : null}
        <dt>Status</dt>
        <dd>{f.status.replace('_', ' ')}</dd>
      </dl>
      {note ? <p className={note.startsWith('Clash') || note.startsWith('This stand') ? 'late' : 'tight'}>{note}</p> : null}
      {f.movable ? (
        <>
          <div className="tt-actions">
            {adapter.caps.pullBump ? (
              <>
                <button type="button" onClick={() => adapter.pull(f.id)} title="Pulling ahead of another turn dips that queue's standing">
                  Pull · queue standing
                </button>
                <button type="button" onClick={() => adapter.bump(f.id)} title="A bump dips this carrier's standing">
                  Bump · standing
                </button>
              </>
            ) : null}
            {adapter.caps.swap ? (
              <button type="button" onClick={onSwap}>
                Swap stand…
              </button>
            ) : null}
            {adapter.caps.cancel ? (
              <button type="button" className="danger" onClick={() => adapter.cancel(f.id)} title="Cancelling hits standing. A banked turn costs more than a manual one.">
                Cancel · standing
              </button>
            ) : null}
          </div>
          {adapter.caps.pin ? (
            <div className="tt-actions">
              <span className="muted">Pin:</span>
              <button type="button" className={!f.pinned ? 'on' : ''} onClick={() => adapter.pinStand(f.id, null)}>
                Auto
              </button>
              {fits.slice(0, 8).map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={f.pinned && f.standId === s.id ? 'on' : ''}
                  onClick={() => adapter.pinStand(f.id, s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : null}
          {adapter.caps.runway && runways.length > 0 ? (
            <div className="tt-actions" data-testid="tt-runway-pick">
              <span className="muted">Runway:</span>
              <button type="button" className={!f.runwayId ? 'on' : ''} onClick={() => adapter.setRunway(f.id, null)}>
                Auto
              </button>
              {runways.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className={f.runwayId === r.id ? 'on' : ''}
                  onClick={() => adapter.setRunway(f.id, r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : null}
          <p className="muted">Drag the bar to move it inside its window.</p>
        </>
      ) : (
        <p className="muted">Locked: already in the air or on the ground.</p>
      )}
    </aside>
  )
}
