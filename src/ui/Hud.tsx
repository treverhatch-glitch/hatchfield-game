import { AIRFRAMES } from '../game/airframes'
import {
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
  personaBlurb,
  PREMADE_TERMINAL_COST,
  RAIL_CITY_COST,
  rewardBlurb,
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

/** Outside pavement / buildings — apron only. */
const APRON_TOOLS: Tool[] = [
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
  const airline = flight ? game.airline(flight.airline) : null
  const origin = game.selectedTerminalOrigin()
  const fit = origin
    ? game.fits.find((f) => f.origin.c === origin.c && f.origin.r === origin.r)
    : null
  const tip = BUILDINGS.find((b) => b.tool === game.tool)
  const ready = game.readiness()
  const site = game.site ? LAND[game.site] : null
  const offerAirline = game.offer ? game.airline(game.offer.airline) : null
  const mxAirline = game.mxOffer ? game.airline(game.mxOffer.airline) : null
  const layoverAirline = game.layoverOffer
    ? game.airline(game.layoverOffer.airline)
    : game.layover
      ? game.airline(game.layover.airline)
      : null
  const holding = game.holdingCount()
  const freeGates = game.freeStands().length

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
        <div className="stat" title="Free stands / jets holding">
          Gate {freeGates} · Hold {holding}
        </div>
        <div className="stat">Sec {ready.security}</div>
        <div
          className="stat"
          title={`Field Rating ${game.fieldRating()} — ${game.fieldRatingLabel()}. Blend of rep, airline heat, hall wear, security.`}
        >
          Field {game.fieldRating()} · {game.fieldRatingLabel()}
        </div>
        <div className="stat">Rep {Math.round(game.reputation)}</div>
        <div
          className="stat"
          title={game.stripCapabilityLine()}
        >
          {game.stripTierLabel()} {game.longestRunway()}c · RW{' '}
          {Math.round(game.runwayCondition)}%
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

      <button
        type="button"
        className="view-chip"
        onClick={() => game.setView(game.view === 'apron' ? 'hall' : 'apron')}
        title="Toggle Apron / Hall (H). Click a terminal tile to enter."
      >
        {game.view === 'apron'
          ? 'Apron · build outside · click hall to enter'
          : 'Hall · landside ↔ airside · Esc back out'}
      </button>

      {game.offer && offerAirline ? (
        <div className="offer">
          <div>
            <strong>
              {offerAirline.name} wants a contract
              {offerAirline.procedural ? ' · regional' : ''}
            </strong>
            <p>
              {personaBlurb(offerAirline.persona)} · {offerAirline.blurb}
            </p>
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

      {game.layoverOffer && layoverAirline ? (
        <div className="offer layover">
          <div>
            <strong>{layoverAirline.name} layover bank</strong>
            <p>
              {money(game.layoverOffer.fee)} up front · {game.layoverOffer.transferPax}{' '}
              transfers · ~{game.layoverOffer.duration}s. Keep heat above the ban line or
              they fine you.
            </p>
          </div>
          <div className="row">
            <button type="button" className="on" onClick={() => game.acceptLayover()}>
              Host layover
            </button>
            <button type="button" onClick={() => game.declineLayover()}>
              Decline
            </button>
          </div>
        </div>
      ) : null}

      {game.layover && !game.layoverOffer ? (
        <div className="offer layover live">
          <div>
            <strong>
              {game.airline(game.layover.airline).name} layover live
            </strong>
            <p>
              {game.layover.spawned}/{game.layover.transferPax} transfers ·{' '}
              {Math.ceil(game.layover.remaining)}s left · heat{' '}
              {Math.round(game.heatOf(game.layover.airline))}
              {game.layover.samples
                ? ` · avg happy ${Math.round(game.layover.happySum / game.layover.samples)}`
                : ''}
            </p>
          </div>
        </div>
      ) : null}

      {game.mxOffer && mxAirline ? (
        <div className="offer mx">
          <div>
            <strong>{mxAirline.name} wants line MX</strong>
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
              ? ` · MX: ${game.mxSigned.map((id) => game.airline(id).name).join(', ')}`
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
          <p className="muted">Fleet today: {game.fleetMixLine()}</p>
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
                        : flight.kind === 'freighter'
                          ? '#c97816'
                          : airline.color,
                }}
              >
                {game.roleLabel(flight.kind)}
                {flight.kind === 'military' ||
                flight.kind === 'helo_med' ||
                flight.kind === 'air_ambulance' ||
                flight.kind === 'helo_exec'
                  ? ''
                  : ` · ${airline.name}`}{' '}
                {flight.flightNo}
              </p>
              <p className="phase">
                {flight.airframeName || game.aircraftLabel(flight.kind)} ·{' '}
                {labelPhase(flight.phase, flight.craft)}
                {flight.pax > 0 ? ` · ${flight.pax} pax` : flight.cargo ? ' · freight' : ''}
                {(flight.craft ?? 'jet') === 'jet'
                  ? ` · ${game.gateLabel(flight.stand)}`
                  : ' · helipad'}
              </p>
              <p className="muted">
                Needs{' '}
                {flight.craft === 'helo'
                  ? 'helipad'
                  : `${AIRFRAMES[flight.airframeId]?.minRunway ?? '?'}c strip`}
                {' · '}
                size ×{(AIRFRAMES[flight.airframeId]?.scale ?? 1).toFixed(2)} · field{' '}
                {game.stripCapabilityLine()}
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
          <h2>Runway schedule</h2>
          <p className="muted">
            {game.scheduleAuto ? 'Auto bank on' : 'Manual bank'} ·{' '}
            {game.openSchedule().length} open
            {game.weather === 'storm' ? ' · storm may delay' : ''}
          </p>
          <div className="row">
            <button type="button" className={game.scheduleAuto ? 'on' : ''} onClick={() => game.setScheduleAuto(true)}>
              Auto
            </button>
            <button type="button" className={!game.scheduleAuto ? 'on' : ''} onClick={() => game.setScheduleAuto(false)}>
              Manual
            </button>
          </div>
          <div className="row">
            {game.signed.slice(0, 3).map((id) => (
              <button key={id} type="button" onClick={() => game.addManualSlot(id, 18)}>
                +{game.airline(id).name.slice(0, 6)}
              </button>
            ))}
          </div>
          <ul className="airlines">
            {game.openSchedule().slice(0, 8).length === 0 ? (
              <li>
                <span className="muted">No slots — sign an airline or add manual.</span>
              </li>
            ) : (
              game.openSchedule().slice(0, 8).map((s) => {
                const eta = Math.max(0, Math.round(s.eta - game.clock))
                return (
                  <li key={s.id}>
                    <b style={{ color: game.airline(s.airline).color }}>
                      {s.flightNo}{' '}
                      <span className="muted">
                        {s.status}
                        {s.delaySec > 0 ? ` +${Math.round(s.delaySec)}s` : ''}
                        {s.manual ? ' · manual' : ''}
                      </span>
                    </b>
                    <span className="muted">
                      {game.airline(s.airline).name} · ETA {eta}s
                      {s.delayReason ? ` · ${s.delayReason}` : ''}
                    </span>
                    {s.status !== 'inbound' ? (
                      <span className="row" style={{ marginTop: 4 }}>
                        <button type="button" onClick={() => game.bumpSlot(s.id)}>
                          Bump
                        </button>
                        <button type="button" onClick={() => game.cancelSlot(s.id)}>
                          Cancel
                        </button>
                      </span>
                    ) : null}
                  </li>
                )
              })
            )}
          </ul>
        </section>

        <section>
          <h2>Airline desk</h2>
          <p className="muted">
            Signed:{' '}
            {game.signed.length
              ? game.signed.map((id) => game.airline(id).name).join(', ')
              : 'none'}
            {ready.tower
              ? ` · tower queues ${game.maxInbound()} inbound`
              : ' · no tower (single approach)'}
          </p>
          <ul className="airlines">
            {game.allAirlines().map((a) => {
              const signed = game.signed.includes(a.id)
              const ok = game.meetsReq(a.id)
              const miss = game.missingReq(a.id)
              const banned = game.isBanned(a.id)
              const heat = Math.round(game.heatOf(a.id))
              const reward = game.rewardOf(a.id)
              const warned = Boolean(game.airlineWarned[a.id])
              return (
                <li key={a.id}>
                  <b style={{ color: a.color }}>
                    {a.name}{' '}
                    <span className="muted">
                      {personaBlurb(a.persona)}
                      {a.procedural ? ' · proc' : ''}
                    </span>{' '}
                    {banned
                      ? `· BAN ${Math.ceil(game.banRemaining(a.id))}s`
                      : signed
                        ? `· heat ${heat}${warned ? ' · WARN' : ''}${
                            reward ? ` · ${rewardBlurb(reward)}` : ''
                          }`
                        : ok
                          ? '· ready'
                          : ''}
                  </b>
                  <span className="muted">
                    {banned
                      ? 'Suspended after a bad layover / hall'
                      : signed
                        ? reward
                          ? `${rewardBlurb(reward)} active`
                          : a.kind === 'cargo'
                            ? 'Freighters scheduled'
                            : a.likesLayovers
                              ? 'Pax + may offer layovers'
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
          {game.view === 'hall' ? (
            <>
              <button type="button" className="on" onClick={() => game.exitHall()}>
                ← Apron outside
              </button>
              <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>
                Inside: furnish rooms in the Hall panel (check-in → security → gate)
              </span>
            </>
          ) : (
            <>
              {APRON_TOOLS.map((t) => (
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
              <button type="button" onClick={() => game.setView('hall')}>
                Enter hall
              </button>
            </>
          )}
        </div>
        <p className="hint">
          {game.view === 'hall'
            ? 'Inside the terminal: landside doors on the left, airside gates on the right. Buy rooms in Hall furnish. Esc / H returns to the apron.'
            : game.tool === 'runway_short'
            ? `Short strip 10×2 (${money(SHORT_RUNWAY_COST)}) — ATR / CRJ / E175 / Citation / F-15. A320+ and heavies refuse.`
            : game.tool === 'runway'
              ? `Regional strip 14×2 (${money(RUNWAY_PREFAB_COST)}) — A320 / 737 / A321 / 757F. Widebodies still refuse.`
              : game.tool === 'runway_heavy'
                ? `Heavy strip 20×3 (${money(HEAVY_RUNWAY_COST)}) — takes everything: 787 / A350 / 747-8F / C-17.`
                : game.tool === 'premade'
                ? `One-click working terminal (${money(PREMADE_TERMINAL_COST)}) — then pan-click it to walk inside.`
                : game.tool === 'pan'
                  ? 'Apron (outside): stamp pavement. Pan-click a terminal tile or press H to go inside and furnish.'
                  : tip
                    ? `${tip.blurb} ${money(tip.cost)}`
                    : 'Clear refunds 40%.'}
          {game.securityIncidents ? ` · ${game.securityIncidents} security incidents` : ''}
          {game.hallGuests.length
            ? ` · ${game.hallGuests.length} in hall${
                game.hallGuests.some((g) => g.transfer)
                  ? ` (${game.hallGuests.filter((g) => g.transfer).length} transfer)`
                  : ''
              }`
            : ''}
          {game.maxWear() >= 25 ? ` · wear ${Math.round(game.maxWear())}` : ''}
          {holding ? ` · ${holding} holding` : ''}
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
