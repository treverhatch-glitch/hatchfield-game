import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { AirlineMark } from '../AirlineMark'
import { LiveText } from '../LiveText'
import { blockInk, timelineAircraft } from './fictionalMetal'
import { axisTicks, barNote, boardRows, buildGantt, filterFlights, frac, pxToSec, runwayOf, viewSpan, type GanttBar } from './layout'
import { gameMinToSim, SCHEDULE, SHEET_MOTION, turnBand } from './scheduleConfig'
import { schedulePillOpen, setSchedulePill, sheetShown, subscribeScheduleSheet } from './scheduleSheet'
import { capacityPreview, type CapacityLight } from './schedulerBridge'
import { dragMomentumPx, useSheetMomentum } from './sheetMotion'
import { clockLabel, dayIndex, dropTarget, durationLabel, standFits } from './time'
import type { TimetableAdapter, TtFlight, TtStatus } from './types'
import './timetable.css'

type Mode = 'board' | 'timeline'
const ZOOMS = [6, 12, 24] as const
const DOCK_MIN = 160
const STATUS_ICON: Record<TtStatus, string> = {
  scheduled: '✓',
  delayed: '◷',
  inbound: '↘',
  on_stand: '▣',
  departing: '↗',
  done: '✓',
  cancelled: '✕',
}

interface Drag {
  id: string
  startX: number
  startY: number
  widthPx: number
  dx: number
  dy: number
  moved: boolean
  t0: number
  lastT: number
}

/**
 * Bottom-dock timetable. One sheet, Board or Timeline.
 * It sits clear of the phone and of the Planner sheet, and the player can
 * resize or collapse it.
 */
export function Timetable({
  adapter,
  menuOpen = false,
  plannerOpen = false,
  defaultOpen = false,
  fuelLine = null,
  fuelShort = false,
  onFuel,
}: {
  adapter: TimetableAdapter
  menuOpen?: boolean
  plannerOpen?: boolean
  defaultOpen?: boolean
  fuelLine?: string | null
  fuelShort?: boolean
  onFuel?: () => void
}) {
  const [pillOpen, setPillOpen] = useState(defaultOpen)
  const [userClosed, setUserClosed] = useState(false)
  const [mode, setMode] = useState<Mode>('board')
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(6)
  const [dayShift, setDayShift] = useState(0)
  const [airlineFilter, setAirlineFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [terminalFilter, setTerminalFilter] = useState('')
  const [trafficFilter, setTrafficFilter] = useState('')
  const [conflictsOnly, setConflictsOnly] = useState(false)
  const [height, setHeight] = useState(320)
  const [sel, setSel] = useState<string | null>(null)
  const [swapFrom, setSwapFrom] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [pinNote, setPinNote] = useState<string | null>(null)
  const [, tick] = useState(0)
  const dragRef = useRef<Drag | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const plannerTick = plannerOpen ? 1 : 0
  const [seenPlanner, setSeenPlanner] = useState(plannerTick)
  if (seenPlanner !== plannerTick) {
    setSeenPlanner(plannerTick)
    if (plannerOpen) setUserClosed(false)
  }

  useEffect(() => setSchedulePill(pillOpen), [pillOpen])
  useEffect(() => subscribeScheduleSheet(() => setPillOpen(schedulePillOpen())), [])
  const shown = !userClosed && sheetShown({ pill: pillOpen, planner: plannerOpen, buildMenu: menuOpen })
  const [painted, setPainted] = useState(shown)
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    if (shown) {
      setPainted(true)
      setClosing(false)
      return
    }
    if (!painted) return
    setClosing(true)
    const t = window.setTimeout(() => {
      setPainted(false)
      setClosing(false)
    }, SHEET_MOTION.openMs)
    return () => window.clearTimeout(t)
  }, [shown, painted])
  useSheetMomentum(bodyRef, painted && !closing)

  useEffect(() => {
    if (!painted) return
    const h = window.setInterval(() => tick((n) => n + 1), 500)
    return () => window.clearInterval(h)
  }, [painted])

  useEffect(() => {
    const hud = document.querySelector('.hud')
    if (!(hud instanceof HTMLElement)) return
    if (painted) hud.style.setProperty('--tt-h', `${height}px`)
    else hud.style.removeProperty('--tt-h')
    return () => {
      hud.style.removeProperty('--tt-h')
    }
  }, [painted, height])

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
    airline: airlineFilter || null,
    status: statusFilter || undefined,
    terminal: terminalFilter || undefined,
    traffic: trafficFilter || undefined,
    conflictsOnly,
    conflictIds,
  })
  const filterOn = Boolean(airlineFilter || statusFilter || terminalFilter || trafficFilter || conflictsOnly)
  const airlines = [...new Map(flights.map((f) => [f.airlineName, f])).values()]
  const terminals = [
    ...new Set(flights.map((f) => f.terminal ?? (f.standLabel.match(/^T\d+/)?.[0] ?? 'Apron'))),
  ].sort()
  const runwayList = adapter.runways()
  const multiRw = runwayList.length > 1
  const rwLabel = (id: string | null | undefined) => (id ? runwayList.find((r) => r.id === id)?.label ?? id : 'Auto')

  const offerKey =
    mode === 'timeline'
      ? [
          day,
          flights
            .filter((f) => f.direction === 'arr' && f.status !== 'cancelled')
            .slice(0, 12)
            .map((f) => `${f.id}:${Math.round(f.time)}:${f.icao}:${f.traffic ?? ''}`)
            .join('|'),
          stands.map((s) => `${s.id}:${s.icao}`).join(','),
          runwayList.map((r) => `${r.id}:${r.hourlyCap}`).join(','),
        ].join(';')
      : ''
  const offer = useMemo(() => {
    if (mode !== 'timeline') return { hours: [] as CapacityLight[], warnings: [] as string[] }
    try {
      return capacityPreview(flights, stands, runwayList, day)
    } catch {
      return { hours: [] as CapacityLight[], warnings: [] as string[] }
    }
    // offerKey is the signature of the flights, stands, and runways above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerKey, mode])

  const nextArr = flights.filter((f) => f.direction === 'arr' && f.time >= now && f.status !== 'cancelled').sort((a, b) => a.time - b.time)[0]
  const nextDep = flights.filter((f) => f.direction === 'dep' && f.time >= now && f.status !== 'cancelled').sort((a, b) => a.time - b.time)[0]

  const selFlight = sel ? flights.find((f) => f.id === sel) ?? null : null
  const preview = (f: TtFlight): number => {
    if (!drag || drag.id !== f.id) return 0
    return pxToSec(drag.dx, drag.widthPx, span)
  }

  const onBarDown = (e: RPointerEvent<HTMLDivElement>, f: TtFlight) => {
    e.stopPropagation()
    if (swapFrom && swapFrom !== f.id) {
      setPinNote(adapter.swapStands(swapFrom, f.id))
      setSwapFrom(null)
      setSel(f.id)
      return
    }
    const lane = (e.currentTarget.parentElement as HTMLElement | null)?.getBoundingClientRect()
    const nowMs = performance.now()
    const d: Drag = {
      id: f.id,
      startX: e.clientX,
      startY: e.clientY,
      widthPx: lane?.width ?? 600,
      dx: 0,
      dy: 0,
      moved: false,
      t0: nowMs,
      lastT: nowMs,
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
    const next = { ...d, dx, dy, lastT: performance.now(), moved: d.moved || Math.abs(dx) > 3 || Math.abs(dy) > 8 }
    dragRef.current = next
    setDrag(next)
  }
  const onBarUp = (e: RPointerEvent<HTMLDivElement>, f: TtFlight) => {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d || d.id !== f.id) return
    if (d.moved && f.movable) {
      const momentum = dragMomentumPx(d.dx, Math.max(1, d.lastT - d.t0))
      const target = dropTarget(f.time, pxToSec(d.dx + momentum, d.widthPx, span), f.window)
      if (adapter.caps.move && Math.abs(d.dx) > 3 && target != null) adapter.moveTo(f.id, target)
      if (adapter.caps.pin && Math.abs(d.dy) > 8) {
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-stand]')
        const standId = hit?.getAttribute('data-stand') || null
        setPinNote(adapter.pinStand(f.id, standId))
      }
      tick((n) => n + 1)
    }
    setSel(f.id)
  }

  const onResizeDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    const move = (ev: PointerEvent) => {
      const max = Math.round(window.innerHeight * 0.7)
      const next = Math.round(startH + (startY - ev.clientY))
      setHeight(Math.max(DOCK_MIN, Math.min(max, next)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const collapse = () => {
    setUserClosed(true)
    setPillOpen(false)
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
  const nowLine = <i className="tt-now" data-testid="tt-now" style={{ left: `${nowX * 100}%` }} />

  return (
    <div
      className="tt-root"
      data-hud-part="timetable"
      data-open={painted && !closing ? '1' : '0'}
      data-planner={plannerOpen ? '1' : '0'}
      style={{
        ['--tt-h' as string]: `${height}px`,
        ['--tt-spring' as string]: SHEET_MOTION.spring,
        ['--tt-open' as string]: `${SHEET_MOTION.openMs}ms`,
        ['--tt-settle' as string]: `${SHEET_MOTION.settleMs}ms`,
      }}
    >
      {!painted ? (
        <button
          type="button"
          className="tt-pill"
          onClick={() => {
            setUserClosed(false)
            setPillOpen(true)
          }}
          title={menuOpen ? 'Close the build menu to open the timetable' : 'Open timetable'}
        >
          <b>Timetable</b>
          <span>
            <LiveText
              testId="tt-pill-clock"
              read={() => `Day ${dayIndex(adapter.now(), adapter.dayLength)} ${clockLabel(adapter.now(), adapter.dayLength)}`}
            />
          </span>
          {nextArr ? <span>↘ {nextArr.flightNo} {clockLabel(nextArr.time, day)}</span> : null}
          {nextDep ? <span>↗ {nextDep.flightNo} {clockLabel(nextDep.time, day)}</span> : null}
          <span className="tt-caret">▴</span>
        </button>
      ) : (
        <section
          className="tt-dock"
          data-closing={closing ? '1' : '0'}
          style={{ height, maxHeight: height }}
          onPointerDown={() => swapFrom === null && setSel(null)}
        >
          <div
            className="tt-resize"
            data-testid="tt-resize"
            title="Drag to resize"
            onPointerDown={onResizeDown}
          />
          <header className="tt-head" onPointerDown={(e) => e.stopPropagation()}>
            <nav className="tt-tabs">
              <button
                type="button"
                data-testid="tt-mode-board"
                className={mode === 'board' ? 'on' : ''}
                onClick={() => setMode('board')}
              >
                Board
              </button>
              <button
                type="button"
                data-testid="tt-mode-timeline"
                className={mode === 'timeline' ? 'on' : ''}
                onClick={() => setMode('timeline')}
              >
                Timeline
              </button>
            </nav>
            <span className="tt-clock">
              <LiveText
                testId="tt-dock-clock"
                read={() =>
                  `Day ${dayIndex(adapter.now(), adapter.dayLength)} · ${clockLabel(adapter.now(), adapter.dayLength)}`
                }
              />
              {' · '}
              <em>{adapter.source}</em>
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
            <button type="button" className="tt-close" onClick={collapse} title="Collapse">
              ▾
            </button>
          </header>
          <div className="tt-filter" onPointerDown={(e) => e.stopPropagation()}>
            {mode === 'board' ? (
              <select
                aria-label="Airline"
                value={airlineFilter}
                onChange={(e) => setAirlineFilter(e.target.value)}
              >
                <option value="">Airline</option>
                {airlines.map((a) => (
                  <option key={a.airlineName} value={a.airlineName}>
                    {a.airlineName}
                  </option>
                ))}
              </select>
            ) : null}
            <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Status</option>
              <option value="scheduled">On time</option>
              <option value="delayed">Delayed</option>
              <option value="inbound">Approach</option>
              <option value="on_stand">At gate</option>
              <option value="departing">Departed</option>
              <option value="done">Landed</option>
            </select>
            <select aria-label="Terminal" value={terminalFilter} onChange={(e) => setTerminalFilter(e.target.value)}>
              <option value="">Terminal</option>
              {terminals.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select aria-label="Traffic" value={trafficFilter} onChange={(e) => setTrafficFilter(e.target.value)}>
              <option value="">Cargo / GA</option>
              <option value="pax">Passenger</option>
              <option value="cargo">Cargo</option>
              <option value="ga">GA</option>
            </select>
            <button type="button" className={conflictsOnly ? 'on' : ''} onClick={() => setConflictsOnly((v) => !v)}>
              Conflicts
            </button>
          </div>
          {swapFrom ? (
            <p className="tt-hint">Pick another flight to swap stands with · <button type="button" onClick={() => setSwapFrom(null)}>Cancel</button></p>
          ) : null}

          <div className="tt-body" ref={bodyRef}>
            {mode === 'timeline' ? (
              <div className="tt-timeline">
              <aside className="tt-carriers" onPointerDown={(e) => e.stopPropagation()}>
                <button type="button" className={!airlineFilter ? 'on' : ''} onClick={() => setAirlineFilter('')}>
                  <i className="tt-swatch all" />
                  <span>All carriers</span>
                </button>
                {airlines.map((a) => (
                  <button
                    key={a.airlineName}
                    type="button"
                    className={airlineFilter === a.airlineName ? 'on' : ''}
                    onClick={() => setAirlineFilter(airlineFilter === a.airlineName ? '' : a.airlineName)}
                  >
                    <i className="tt-swatch" style={{ background: a.color }} />
                    <span>{a.airlineName}</span>
                  </button>
                ))}
              </aside>
              <div className="tt-gantt" data-testid="tt-timeline">
                {offer.hours.length ? (
                  <div className="tt-offer" data-testid="tt-offer-preview" title={offer.warnings.join(' ') || 'Offer preview'}>
                    <span>Offer preview</span>
                    {offer.hours.map((h) => (
                      <i key={h.hour} data-light={h.light} title={`${String(h.hour).padStart(2, '0')}:00 ${h.light}`} />
                    ))}
                  </div>
                ) : null}
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
                          title={row.stand ? `${row.stand.label} · up to code ${row.stand.icao}` : 'Tower picks a stand'}
                          style={row.stand?.leaseColor ? { boxShadow: `inset 3px 0 0 ${row.stand.leaseColor}` } : undefined}
                        >
                          <b>{row.stand ? shortGate(row.stand.label) : ri === 0 ? 'Twr' : ''}</b>
                          {row.stand?.leaseAirline ? <small>{row.stand.leaseAirline}</small> : null}
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
                                {f.checkInFrom != null && f.checkInTo != null ? (
                                  <i
                                    className="tt-checkin"
                                    data-testid="tt-checkin"
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
                                  data-tight={!b.conflict && b.buffer ? '1' : '0'}
                                  data-sel={sel === f.id ? '1' : '0'}
                                  data-movable={f.movable ? '1' : '0'}
                                  data-dragging={drag?.id === f.id ? '1' : '0'}
                                  data-size={f.sizeBand ?? turnBand(f.icao)}
                                  style={{
                                    left: `${(b.left + frac(span.from + off, span)) * 100}%`,
                                    width: `${b.width * 100}%`,
                                    ['--al' as string]: f.color,
                                    ['--ink' as string]: blockInk(f.color),
                                    ['--stripe' as string]: f.stripe ?? f.color,
                                  }}
                                  onPointerDown={(e) => onBarDown(e, f)}
                                  onPointerMove={(e) => onBarMove(e, f)}
                                  onPointerUp={(e) => onBarUp(e, f)}
                                  title={`${f.flightNo} · ${timelineAircraft(f.aircraft, f.sizeBand ?? turnBand(f.icao))} · ${clockLabel(f.time + off, day)}${multiRw ? ` · ${rwLabel(f.runwayId)}` : ''}`}
                                >
                                  <b>{f.flightNo}{f.pinned ? ' ·' : ''}</b>
                                  <small>
                                    {timelineAircraft(f.aircraft, f.sizeBand ?? turnBand(f.icao))}
                                    {drag?.id === f.id && drag.moved ? ` ${clockLabel(f.time + off, day)}` : ''}
                                  </small>
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
              </div>
            ) : (
              <div className="tt-board" data-testid="tt-board">
                {(['arr', 'dep'] as const).map((dir) => (
                  <table key={dir} data-testid={dir === 'arr' ? 'tt-arrivals' : 'tt-departures'}>
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
                          <td className="tt-code" style={{ color: r.color }}>{r.flightNo}</td>
                          <td className="tt-airline">
                            <AirlineMark id={r.airlineId} color={r.color} />
                            <span>{r.airline}</span>
                          </td>
                          <td>{r.stand}</td>
                          <td className={r.late ? 'late' : ''}>
                            <span className={`tt-status tt-status-${r.statusKey}`}>
                              <i aria-hidden>{STATUS_ICON[r.statusKey]}</i>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            )}
          </div>

          {fuelLine ? (
            <button
              type="button"
              className={`tt-fuel${fuelShort ? ' short' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onFuel?.()
              }}
            >
              {fuelLine}
            </button>
          ) : null}
          {selFlight ? (
            <FlightCard
              adapter={adapter}
              flight={selFlight}
              note={barNote(gantt.flatMap((g) => g.rows.flatMap((r) => r.bars)).find((b) => b.flight.id === selFlight.id) ?? emptyBar(selFlight), day)}
              pinNote={pinNote}
              stands={stands}
              runways={runwayList}
              onPinNote={setPinNote}
              onSwap={() => setSwapFrom(selFlight.id)}
              onClose={() => setSel(null)}
            />
          ) : null}
        </section>
      )}
    </div>
  )
}

function shortGate(label: string): string {
  const gate = label.match(/G(\d+)/)
  if (gate) return `G${gate[1]}`
  const head = label.split('·')[0]?.trim()
  return head || label
}

function emptyBar(flight: TtFlight): GanttBar {
  return { flight, left: 0, width: 0, conflict: false, buffer: false, gapSec: null }
}

function FlightCard({
  adapter,
  flight: f,
  note,
  pinNote,
  stands,
  runways,
  onPinNote,
  onSwap,
  onClose,
}: {
  adapter: TimetableAdapter
  flight: TtFlight
  note: string | null
  pinNote: string | null
  stands: ReturnType<TimetableAdapter['stands']>
  runways: ReturnType<TimetableAdapter['runways']>
  onPinNote: (reason: string | null) => void
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
          {timelineAircraft(f.aircraft, f.sizeBand ?? turnBand(f.icao))} · Code {f.icao}
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
      {pinNote ? (
        <p className="late" data-testid="tt-pin-reason">
          {pinNote}
        </p>
      ) : null}
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
              <button type="button" className={!f.pinned ? 'on' : ''} onClick={() => onPinNote(adapter.pinStand(f.id, null))}>
                Auto
              </button>
              {fits.slice(0, 8).map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={f.pinned && f.standId === s.id ? 'on' : ''}
                  onClick={() => onPinNote(adapter.pinStand(f.id, s.id))}
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
