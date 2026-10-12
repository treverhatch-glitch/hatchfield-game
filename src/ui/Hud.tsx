import {
  AIRLINES,
  airlineList,
  BUILDINGS,
  CATER,
  FUEL,
  LAND,
  money,
  PREMADE_TERMINAL_COST,
  ROOMS,
  RUNWAY_PREFAB_COST,
  TOOL_LABEL,
} from '../game/catalog'
import { formatClock, type Game } from '../game/sim'
import type { Speed, Tool } from '../game/types'

const TOOLS: Tool[] = [
  'pan',
  'runway',
  'road',
  'taxi',
  'stand',
  'premade',
  'terminal',
  'snack',
  'bags',
  'fuel',
  'fire',
  'police',
  'cargo',
  'tower',
  'hangar',
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
  const ready = game.readiness()
  const site = game.site ? LAND[game.site] : null

  return (
    <div className="hud">
      <header className="top">
        <div className="brand">
          <strong>Hatchfield</strong>
          <span>
            {site ? site.name : 'No plot'} · AT3 build loop
          </span>
        </div>
        <div className="stat cash">{money(game.cash)}</div>
        <div className="stat">{formatClock(game.clock)}</div>
        <div className="stat">{game.signed.length} airlines</div>
        <div className="stat">Sec {ready.security}</div>
        <div className="stat">Rep {Math.round(game.reputation)}</div>
        <div className="speeds">
          <button
            type="button"
            className={game.view === 'apron' ? 'on' : ''}
            onClick={() => game.setView('apron')}
          >
            Apron
          </button>
          <button
            type="button"
            className={game.view === 'hall' ? 'on' : ''}
            onClick={() => game.setView('hall')}
          >
            Hall
          </button>
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

      {game.offer ? (
        <div className="offer">
          <div>
            <strong>{AIRLINES[game.offer.airline].name} wants a contract</strong>
            <p>{AIRLINES[game.offer.airline].blurb}</p>
          </div>
          <div className="row">
            <button type="button" className="on" onClick={() => game.acceptOffer()}>
              Sign
            </button>
            <button type="button" onClick={() => game.declineOffer()}>
              Decline
            </button>
          </div>
        </div>
      ) : null}

      <aside className="side">
        <section>
          <h2>Flight</h2>
          {flight && airline ? (
            <div className="flight">
              <p className="fn" style={{ color: airline.color }}>
                {airline.name} {flight.flightNo}
              </p>
              <p className="phase">
                {labelPhase(flight.phase)}
                {flight.cargo ? ' · cargo' : ` · ${flight.pax} pax`}
              </p>
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
            </div>
          ) : (
            <p className="muted">
              No flights until an airline signs. Meet their checklist, then answer the phone.
            </p>
          )}
        </section>

        <section>
          <h2>Airline desk</h2>
          <p className="muted">
            Signed: {game.signed.length ? game.signed.map((id) => AIRLINES[id].name).join(', ') : 'none'}
          </p>
          <ul className="airlines">
            {airlineList().map((a) => {
              const signed = game.signed.includes(a.id)
              const ok = game.meetsReq(a.id)
              const miss = game.missingReq(a.id)
              return (
                <li key={a.id}>
                  <b style={{ color: a.color }}>
                    {a.name} {signed ? '· signed' : ok ? '· ready' : ''}
                  </b>
                  <span className="muted">
                    {signed
                      ? a.kind === 'cargo'
                        ? 'Freighters scheduled'
                        : 'Pax flights scheduled'
                      : miss.slice(0, 4).join(', ') || 'Waiting to call'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h2>Fuel desk</h2>
          <p className="muted">
            {game.fuelBrand
              ? `${FUEL[game.fuelBrand].name} · ${game.fuelLoads} loads`
              : 'No carrier. Airlines that need fuel will not sign.'}
          </p>
          <div className="row">
            <button type="button" onClick={() => game.signFuel('apex')}>
              Apex {money(FUEL.apex.sign)}
            </button>
            <button type="button" onClick={() => game.signFuel('kiln')}>
              Kiln {money(FUEL.kiln.sign)}
            </button>
          </div>
          <button type="button" className="wide" onClick={() => game.buyLoads()}>
            Buy 4 loads
            {game.fuelBrand ? ` · ${money(FUEL[game.fuelBrand].wholesale * 4)}` : ''}
          </button>
        </section>

        <section>
          <h2>Catering desk</h2>
          <p className="muted">
            {game.caterBrand
              ? `${CATER[game.caterBrand].name} · ×${CATER[game.caterBrand].payoutMult} payout`
              : 'No catering vendor. Harbor / Summit will not sign without one + a snack bar.'}
          </p>
          <div className="row">
            <button type="button" onClick={() => game.signCater('skybite')}>
              SkyBite {money(CATER.skybite.sign)}
            </button>
            <button type="button" onClick={() => game.signCater('galleyprime')}>
              GalleyPrime {money(CATER.galleyprime.sign)}
            </button>
          </div>
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
            <p className="muted">
              Stamp a Premade hall or an empty Shell, then select it to furnish. Weak security = threats.
            </p>
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
          <button type="button" onClick={() => game.rotatePiece()}>
            Rotate {game.facing === 'h' ? 'H' : 'V'}
          </button>
        </div>
        <p className="hint">
          {game.tool === 'runway'
            ? `Stamp a regional runway (${money(RUNWAY_PREFAB_COST)}). Rotate for the other axis.`
            : game.tool === 'premade'
              ? `One-click working terminal (${money(PREMADE_TERMINAL_COST)}) — security included.`
              : game.tool === 'pan'
                ? game.view === 'hall'
                  ? 'Hall view: guests chase needs (hunger, WC, shop, boarding clock). Missing rooms = lost / angry.'
                  : 'Apron view. Airlines call when fire, fuel, road, hall, and stands match their list.'
                : tip
                  ? `${tip.blurb} ${money(tip.cost)}`
                  : 'Clear refunds 40%.'}
          {game.securityIncidents ? ` · ${game.securityIncidents} security incidents` : ''}
          {game.hallGuests.length ? ` · ${game.hallGuests.length} in hall` : ''}
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
    servicing: 'Servicing',
    board: 'Boarding',
    taxi_out: 'Taxi out',
    takeoff: 'Takeoff',
    gone: 'Airborne',
  }
  return map[phase] ?? phase
}
