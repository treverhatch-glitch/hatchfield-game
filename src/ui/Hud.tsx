import { AIRLINES, BUILDINGS, FUEL, money, ROOMS, TOOL_LABEL } from '../game/catalog'
import { formatClock, type Game } from '../game/sim'
import type { Speed, Tool } from '../game/types'

const TOOLS: Tool[] = [
  'pan',
  'runway',
  'taxi',
  'stand',
  'terminal',
  'snack',
  'bags',
  'fuel',
  'clear',
]

export function Hud({ game }: { game: Game }) {
  const flight = game.flights.find((f) => f.id === game.selectedFlight) ?? game.flights[0]
  const airline = flight ? AIRLINES[flight.airline] : null
  const origin = game.selectedTerminalOrigin()
  const fit = origin
    ? game.fits.find((f) => f.origin.c === origin.c && f.origin.r === origin.r)
    : null
  const tip = BUILDINGS.find((b) => b.tool === game.tool)

  return (
    <div className="hud">
      <header className="top">
        <div className="brand">
          <strong>Hatchfield</strong>
          <span>AT3-style field · CEO books</span>
        </div>
        <div className="stat cash">{money(game.cash)}</div>
        <div className="stat">{formatClock(game.clock)}</div>
        <div className="stat">{game.flightsDone} turns</div>
        <div className="speeds">
          {([0, 1, 3] as Speed[]).map((s) => (
            <button
              key={s}
              type="button"
              className={game.speed === s ? 'on' : ''}
              onClick={() => game.setSpeed(s)}
            >
              {s === 0 ? 'Pause' : `${s}x`}
            </button>
          ))}
        </div>
      </header>

      <aside className="side">
        <section>
          <h2>Flight</h2>
          {flight && airline ? (
            <div className="flight">
              <p className="fn" style={{ color: airline.color }}>
                {airline.name} {flight.flightNo}
              </p>
              <p className="phase">{labelPhase(flight.phase)} · {flight.pax} pax</p>
              <ul className="ledger">
                {flight.ledger.length === 0 ? (
                  <li>Nothing posted yet — wait until the picture earns it.</li>
                ) : (
                  flight.ledger.map((row, i) => (
                    <li key={i}>
                      {row.label}
                      <b>{money(row.amount)}</b>
                    </li>
                  ))
                )}
              </ul>
              <p className="muted">
                Bags {flight.posted.bags ? 'in' : '—'} · Fuel {flight.posted.fuel ? 'in' : '—'} ·
                Catering {flight.posted.catering ? 'in' : '—'}
              </p>
            </div>
          ) : (
            <p className="muted">Build a 6-tile runway, taxi, and stand. Northline will call.</p>
          )}
        </section>

        <section>
          <h2>Fuel desk</h2>
          <p className="muted">
            {game.fuelBrand
              ? `${FUEL[game.fuelBrand].name} · ${game.fuelLoads} loads`
              : 'No carrier. Jets still leave — they just do not buy your pump.'}
          </p>
          <div className="row">
            <button type="button" onClick={() => game.signFuel('apex')}>
              Sign Apex {money(FUEL.apex.sign)}
            </button>
            <button type="button" onClick={() => game.signFuel('kiln')}>
              Sign Kiln {money(FUEL.kiln.sign)}
            </button>
          </div>
          <button type="button" className="wide" onClick={() => game.buyLoads()}>
            Buy 4 loads
            {game.fuelBrand ? ` · ${money(FUEL[game.fuelBrand].wholesale * 4)}` : ''}
          </button>
        </section>

        <section>
          <h2>Hall furnish</h2>
          {origin ? (
            <ul className="rooms">
              {ROOMS.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => game.buyRoom(r.id)}>
                    {r.name}
                    <span>
                      {fit?.rooms[r.id] ?? 0} · {money(r.cost)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Select a terminal to place check-in, security, claim, food, gifts.</p>
          )}
        </section>

        <section className="news">
          <h2>Ops</h2>
          <ul>
            {game.news.map((n) => (
              <li key={n.id} data-tone={n.tone}>
                {n.text}
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <div className="dock">
        <div className="tools">
          {TOOLS.map((t) => (
            <button
              key={t}
              type="button"
              className={game.tool === t ? 'on' : ''}
              onClick={() => game.setTool(t)}
            >
              {TOOL_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="hint">
          {game.tool === 'runway'
            ? 'Click a start, then drag the far end. The strip snaps straight. Green ghost at 6+ tiles lays it.'
            : game.tool === 'pan'
              ? 'Click a jet or stand. Drag to look around the field.'
              : tip
                ? `${tip.blurb} ${money(tip.cost)}`
                : 'Clear refunds 40%.'}
          {game.harborUnlocked ? ' · Harbor Air is flying.' : ''}
        </p>
      </div>
    </div>
  )
}

function labelPhase(phase: string): string {
  const map: Record<string, string> = {
    hold: 'Holding',
    approach: 'On approach',
    landing: 'Landing',
    taxi_in: 'Taxi in',
    deboard: 'Deboarding',
    servicing: 'Bags / fuel / catering',
    board: 'Boarding',
    taxi_out: 'Taxi out',
    takeoff: 'Takeoff',
    gone: 'Airborne',
  }
  return map[phase] ?? phase
}
