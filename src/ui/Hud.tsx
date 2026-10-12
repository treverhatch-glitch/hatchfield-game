import {
  AIRLINES,
  airlineList,
  BUDGET_BLURB,
  BUDGET_LABEL,
  BUILDINGS,
  CATER,
  FUEL,
  HALL_SCRUB_COST,
  HEAVY_RUNWAY_COST,
  LAND,
  LOAN_PRINCIPAL,
  MECHANIC_HIRE,
  MIL_AGREE_COST,
  money,
  PARCEL_COST,
  PREMADE_TERMINAL_COST,
  RAIL_CITY_COST,
  ROOMS,
  RUNWAY_PREFAB_COST,
  SHORT_RUNWAY_COST,
  STARTER_KIT_COST,
  TOOL_LABEL,
} from '../game/catalog'
import { formatClock, type Game } from '../game/sim'
import type { BudgetKey, Speed, Tool } from '../game/types'

const BUDGET_KEYS: BudgetKey[] = [
  'maintenance',
  'security',
  'cleaning',
  'fire',
  'ambulance',
]

const TOOLS: Tool[] = [
  'pan',
  'runway_short',
  'runway',
  'runway_heavy',
  'helipad',
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
        <div className="stat" title="Runway condition / longest strip">
          RW {Math.round(game.runwayCondition)}% · {game.longestRunway()}c
        </div>
        <div className="stat">{game.weatherLabel()}</div>
        {game.public ? (
          <div className="stat cash">HATCH ${game.sharePrice.toFixed(2)}</div>
        ) : null}
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

      {game.mxOffer ? (
        <div className="offer mx">
          <div>
            <strong>{AIRLINES[game.mxOffer.airline].name} wants line MX</strong>
            <p>
              Hangar turnaround fee {money(game.mxOffer.payout)} per visit. Needs funded
              mechanics.
            </p>
          </div>
          <div className="row">
            <button type="button" className="on" onClick={() => game.acceptMxOffer()}>
              Sign MX
            </button>
            <button type="button" onClick={() => game.declineMxOffer()}>
              Decline
            </button>
          </div>
        </div>
      ) : null}

      {game.pendingThreat ? (
        <div className="offer threat">
          <div>
            <strong>
              {game.pendingThreat.severity === 'hard' ? 'HARD THREAT' : 'Security alert'}
            </strong>
            <p>
              {game.pendingThreat.blurb} ({Math.ceil(game.pendingThreat.deadline)}s)
            </p>
          </div>
          <div className="row">
            <button type="button" className="on" onClick={() => game.resolveThreat('scramble')}>
              Scramble
            </button>
            <button type="button" onClick={() => game.resolveThreat('ignore')}>
              Ignore
            </button>
          </div>
        </div>
      ) : null}

      <aside className="side">
        <section>
          <h2>Build & bank</h2>
          <button type="button" className="wide on" onClick={() => game.buildStarterKit()}>
            Starter kit · {money(STARTER_KIT_COST)}
          </button>
          <p className="muted">
            Drops a Northline-ready regional field + Apex + SkyBite. Empty plot only.
          </p>
          <div className="row">
            <button type="button" onClick={() => game.takeLoan()}>
              Loan {money(LOAN_PRINCIPAL)}
            </button>
            <button type="button" onClick={() => game.repayLoan()}>
              Pay loan
            </button>
          </div>
          <div className="row">
            <button type="button" onClick={() => game.buyParcel()}>
              Parcel {money(PARCEL_COST * game.parcels)}
            </button>
            <button type="button" onClick={() => game.investRail()}>
              City rail {money(RAIL_CITY_COST)}
            </button>
          </div>
          <p className="muted">
            Loan owed {money(game.loanBalance)} · parcels {game.parcels}
            {game.railLinked ? ' · rail linked' : ''}
          </p>
        </section>

        <section>
          <h2>Ops budgets</h2>
          <p className="muted">
            Payroll ~{money(game.payrollPreview())} / 30s · crash risk{' '}
            {Math.round(game.crashChance() * 1000) / 10}% · RW {Math.round(game.runwayCondition)}%
            · {game.weatherLabel()}
          </p>
          <div className="row">
            <button type="button" className="on" onClick={() => game.hireMechanic()}>
              Hire mechanic · {money(MECHANIC_HIRE)}
            </button>
            <button type="button" onClick={() => game.fireMechanic()}>
              Lay off
            </button>
          </div>
          <p className="muted">
            {game.mechanics} mechanics
            {game.mxSigned.length
              ? ` · MX: ${game.mxSigned.map((id) => AIRLINES[id].name).join(', ')}`
              : ' · no airline MX yet (need hangar + mechanic)'}
          </p>
          {game.milAgreement ? (
            <p className="muted">Guard host active — military metal will transit.</p>
          ) : (
            <>
              <button type="button" className="wide" onClick={() => game.signMilitaryAgreement()}>
                Host military / Guard · {money(MIL_AGREE_COST)}
              </button>
              <p className="muted">{game.canHostMilitary().why}</p>
            </>
          )}
          <ul className="budgets">
            {BUDGET_KEYS.map((key) => (
              <li key={key}>
                <label>
                  <span>
                    {BUDGET_LABEL[key]} · {game.budgets[key]}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={game.budgets[key]}
                    onChange={(e) => game.setBudget(key, Number(e.target.value))}
                  />
                </label>
                <small>{BUDGET_BLURB[key]}</small>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Exchange · HATCH</h2>
          {game.public ? (
            <>
              <p className="fn" style={{ color: '#c9a227' }}>
                ${game.sharePrice.toFixed(2)}{' '}
                <span className="muted">
                  IPO ${game.ipoPrice.toFixed(2)} · you own {game.sharesOwned} / float{' '}
                  {game.sharesFloat}
                </span>
              </p>
              <p className="muted">
                Stake mark {money(Math.round(game.sharePrice * game.sharesOwned))} · fair ~
                ${game.fairSharePrice().toFixed(2)}
              </p>
              <div className="row">
                <button type="button" onClick={() => game.buyShares(10)}>
                  Buy 10
                </button>
                <button type="button" onClick={() => game.sellShares(10)}>
                  Sell 10
                </button>
              </div>
              {game.mission ? (
                <p className="muted">
                  Mission: {game.mission.title} — {Math.round(game.mission.progress)}/
                  {game.mission.target} · {Math.ceil(game.mission.deadline)}s
                </p>
              ) : (
                <p className="muted">No active street mission. Keep the hall clean.</p>
              )}
            </>
          ) : (
            <>
              <p className="muted">{game.canIpo().why}</p>
              <button type="button" className="wide on" onClick={() => game.goPublic()}>
                IPO the airport
              </button>
              <p className="muted">
                Listing invites capital — and crises. A bomb past security will tank HATCH.
              </p>
            </>
          )}
        </section>

        <section>
          <h2>Passenger flow</h2>
          <p className="muted">
            Apron walkers: {game.people.filter((p) => p.job === 'arrive' || p.job === 'board').length}
            {' · '}Hall: {game.hallGuests.length}
          </p>
          <ul className="airlines">
            {game.people
              .filter((p) => p.job === 'arrive' || p.job === 'board')
              .slice(0, 6)
              .map((p) => (
                <li key={p.id}>
                  <b>{p.job === 'arrive' ? 'Arrival' : 'Departure'}</b>
                  <span className="muted">{p.label}</span>
                </li>
              ))}
          </ul>
        </section>

        <section>
          <h2>Flight</h2>
          {flight && airline ? (
            <div className="flight">
              <p
                className="fn"
                style={{
                  color:
                    flight.kind === 'military'
                      ? '#8a9a6a'
                      : flight.kind === 'air_ambulance' || flight.kind === 'helo_med'
                        ? '#b33a2a'
                        : airline.color,
                }}
              >
                {flight.kind === 'military'
                  ? 'Military'
                  : flight.kind === 'helo_med' || flight.kind === 'air_ambulance'
                    ? 'Emergency'
                    : flight.kind === 'helo_exec'
                      ? 'Executive'
                      : airline.name}{' '}
                {flight.flightNo}
              </p>
              <p className="phase">
                {flight.airframeName} · {labelPhase(flight.phase, flight.craft)}
                {flight.pax > 0 ? ` · ${flight.pax} pax` : ''}
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
            <>
              <p className="muted">
                Wear WC {Math.round(fit?.wearBath ?? 0)} · Sec {Math.round(fit?.wearSec ?? 0)}
                {ready.heavyRunway ? ' · heavy strip ready' : ''}
                {ready.helipad ? ' · helipad' : ''}
              </p>
              <button type="button" className="wide" onClick={() => game.scrubHall()}>
                Scrub hall · {money(HALL_SCRUB_COST)}
              </button>
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
            </>
          ) : (
            <p className="muted">
              Stamp a Premade hall or an empty Shell, then select it to furnish. Weak security = threats.
              Budget crowds wear WC and lanes — scrub or the street writes exposés.
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
          {game.tool === 'runway_short'
            ? `Short strip 10×2 (${money(SHORT_RUNWAY_COST)}) — CRJ / E-Jets / Citations. Long metal refuses.`
            : game.tool === 'runway'
              ? `Regional strip 14×2 (${money(RUNWAY_PREFAB_COST)}) — A320 / 737 class. Rotate for axis.`
              : game.tool === 'runway_heavy'
                ? `Heavy strip 20×3 (${money(HEAVY_RUNWAY_COST)}) — 787 / A350 / 747F. Rotate for axis.`
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
          {game.maxWear() >= 25 ? ` · wear ${Math.round(game.maxWear())}` : ''}
        </p>
      </div>
    </div>
  )
}

function labelPhase(phase: string, craft?: string): string {
  if (craft === 'helo') {
    const helo: Record<string, string> = {
      approach: 'Hover in',
      landing: 'Settling',
      servicing: 'On pad',
      takeoff: 'Lifting',
    }
    return helo[phase] ?? phase
  }
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
