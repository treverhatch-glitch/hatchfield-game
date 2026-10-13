import { useState, type ReactNode } from 'react'
import { AIRFRAMES } from '../../game/airframes'
import {
  AIRLINE_TIER_META,
  BUDGET_BLURB,
  BUDGET_LABEL,
  CARPARK_LONG_COST,
  CARPARK_SHORT_COST,
  CATER,
  DESK_STAFF_HIRE,
  FUEL,
  HALL_SCRUB_COST,
  HEAT_ABANDON_THRESHOLD,
  HEAT_REWARD_THRESHOLD,
  HEAT_WARN_THRESHOLD,
  HOTEL_COST,
  HOTEL_COST_L2,
  JANITOR_HIRE,
  LOAN_PRODUCTS,
  MECHANIC_HIRE,
  MIL_AGREE_COST,
  PARCEL_COST,
  RAIL_CITY_COST,
  RESEARCH_NODES,
  RESEARCHER_HIRE,
  ROOMS,
  STARTER_KIT_COST,
  bizModelBlurb,
  personaBlurb,
  rewardBlurb,
  rewardDetail,
  rewardForPersona,
} from '../../game/catalog'
import { tilesOf } from '../../game/path'
import { formatSimDate, type Game } from '../../game/sim'
import type { AirlineTier, BudgetKey } from '../../game/types'
import { LineChart } from '../LineChart'
import { moneyAbbrev, perDayFromHour, perDayFromTick, ratePerDay } from '../moneyFormat'
import {
  closePanel,
  getUiState,
  setFinanceTab,
  setUiScale,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  type PanelId,
} from '../uiStore'

const BUDGET_KEYS: BudgetKey[] = ['maintenance', 'security', 'cleaning', 'fire', 'ambulance']

const TITLES: Record<PanelId, string> = {
  finances: 'Finances',
  research: 'Research',
  airlines: 'Airlines',
  planner: 'Planner',
  services: 'Services',
  notifications: 'Notifications',
  selection: 'Selection',
  info: 'Info',
  menu: 'Menu',
}

export function SidePanel({
  game,
  notices,
}: {
  game: Game
  notices: ReactNode
}) {
  const panel = getUiState().openPanel
  if (!panel || panel === 'info') return null
  return (
    <section
      className="hf-panel panel-rollout"
      data-hud-part="panel"
      data-panel={panel}
      aria-label={TITLES[panel]}
    >
      <div className="panel-head">
        <h2>{TITLES[panel]}</h2>
        <button type="button" className="ghost" onClick={() => closePanel()}>
          Close
        </button>
      </div>
      <div className="panel-body">
        {panel === 'menu' ? <GameMenu /> : null}
        {panel === 'finances' ? <Finances game={game} /> : null}
        {panel === 'research' ? <Research game={game} /> : null}
        {panel === 'airlines' ? <Airlines game={game} /> : null}
        {panel === 'planner' ? <Planner game={game} /> : null}
        {panel === 'services' ? <Services game={game} /> : null}
        {panel === 'notifications' ? notices : null}
        {panel === 'selection' ? <Selection game={game} /> : null}
      </div>
    </section>
  )
}

function GameMenu() {
  const scale = getUiState().uiScale
  return (
    <section>
      <h3>UI scale</h3>
      <label className="hf-scale">
        <span>{Math.round(scale * 100)}%</span>
        <input
          type="range"
          min={UI_SCALE_MIN * 100}
          max={UI_SCALE_MAX * 100}
          step={5}
          value={Math.round(scale * 100)}
          aria-label="UI scale"
          onChange={(e) => setUiScale(Number(e.target.value) / 100)}
        />
      </label>
      <p className="hf-muted">
        Scale stays inside the screen budget, from 70% to 150%. H or ` hides the HUD.
      </p>
      <p className="hf-muted">
        R pavement · S stands · T terminal · O ops · L landside · B bulldoze · I info · F finances ·
        U research · A airlines · P planner · G services · V apron/hall · Space pause · 1 2 3 speed ·
        Tab last menu · / search · Esc back.
      </p>
    </section>
  )
}

function Finances({ game }: { game: Game }) {
  const tab = getUiState().financeTab
  const payroll = ratePerDay(perDayFromTick(game.payrollPreview()))
  const upkeep = ratePerDay(perDayFromTick(game.landsideUpkeep()))
  const income = ratePerDay(perDayFromHour(game.incomePerHour))
  return (
    <>
      <div className="eco-tabs" role="tablist">
        {(
          [
            ['overview', 'Overview'],
            ['budget', 'Budget'],
            ['charts', 'Charts'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            data-testid={id === 'budget' ? 'tab-budget' : undefined}
            aria-selected={tab === id}
            className={tab === id ? 'on' : ''}
            onClick={() => setFinanceTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' ? (
        <section>
          <h3>Cash & capital</h3>
          <p className="muted eco-line" data-testid="economy-cash" data-money-unit="day">
            Bank {moneyAbbrev(game.cash)}
            {game.sandbox ? ' · sandbox' : ''}
            {game.loanBalance ? ` · loan owed ${moneyAbbrev(game.loanBalance)}` : ''}
            {' · '}income {income} · landside upkeep {upkeep}
          </p>
          <button
            type="button"
            className="wide on"
            data-testid="starter-kit"
            onClick={() => game.buildStarterKit()}
          >
            Starter kit · {moneyAbbrev(STARTER_KIT_COST)}
          </button>
          <p className="muted">
            {game.startFocus === 'cargo'
              ? 'Cargo kit: strip, freighter stand, guard, shed. Empty plot only.'
              : game.startFocus === 'hybrid'
                ? 'Hybrid kit: hall, jetways, and a cargo road. Empty plot only.'
                : 'Passenger kit: hall, Apex, and SkyBite. Empty plot only.'}
          </p>
          <div className="loan-products">
            <h4 className="loan-h">Bank desk</h4>
            <div className="loan-grid">
              {LOAN_PRODUCTS.map((p) => {
                const open = game.availableLoans().some((x) => x.id === p.id)
                const active = game.loanProductId === p.id && game.loanBalance > 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={active ? 'on' : ''}
                    disabled={!open || game.loanBalance > 0}
                    title={open ? p.blurb : `Locked — Field Lv${p.minFieldLevel}+`}
                    onClick={() => game.takeLoanProduct(p.id)}
                  >
                    {p.label} · {moneyAbbrev(p.principal)}
                    {!open ? ' · locked' : ''}
                  </button>
                )
              })}
            </div>
            <div className="row">
              <button type="button" onClick={() => game.repayLoan()}>
                Pay loan
              </button>
              <button type="button" onClick={() => game.buyParcel()}>
                Parcel {moneyAbbrev(PARCEL_COST * game.parcels)}
              </button>
              <button type="button" onClick={() => game.investRail()}>
                City rail {moneyAbbrev(RAIL_CITY_COST)}
              </button>
            </div>
          </div>
          <div className="row">
            <button type="button" onClick={() => game.buyHotel()}>
              Hotel{' '}
              {game.hotelLevel >= 2
                ? 'max'
                : moneyAbbrev(game.hotelLevel === 0 ? HOTEL_COST : HOTEL_COST_L2)}
            </button>
            <button type="button" onClick={() => game.buyCarPark('short')}>
              Short park {game.carParkShort ? '✓' : moneyAbbrev(CARPARK_SHORT_COST)}
            </button>
            <button type="button" onClick={() => game.buyCarPark('long')}>
              Long park {game.carParkLong ? '✓' : moneyAbbrev(CARPARK_LONG_COST)}
            </button>
          </div>
          <h3>Exchange · HATCH</h3>
          {game.public ? (
            <>
              <p className="fn">
                ${game.sharePrice.toFixed(2)}{' '}
                <span className="muted">
                  IPO ${game.ipoPrice.toFixed(2)} · you own {game.sharesOwned}
                </span>
              </p>
              <div className="row">
                <button type="button" onClick={() => game.buyShares(10)}>
                  Buy 10
                </button>
                <button type="button" onClick={() => game.sellShares(10)}>
                  Sell 10
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">{game.canIpo().why}</p>
              <button type="button" className="wide on" onClick={() => game.goPublic()}>
                IPO the airport
              </button>
            </>
          )}
        </section>
      ) : null}
      {tab === 'budget' ? (
        <section data-testid="budget-panel">
          <h3>Ops budgets</h3>
          <p className="muted" data-testid="budget-payroll" data-money-unit="day">
            Payroll {payroll}
            {game.fieldOpsMult() > 1.05 ? ` · field load ×${game.fieldOpsMult().toFixed(2)}` : ''}
            {' · '}upkeep {upkeep} · crash risk {Math.round(game.crashChance() * 1000) / 10}% · RW{' '}
            {Math.round(game.runwayCondition)}% · {game.weatherLabel()}
          </p>
          <div className="row">
            <button type="button" className="on" onClick={() => game.hireMechanic()}>
              Hire mechanic · {moneyAbbrev(MECHANIC_HIRE)}
            </button>
            <button type="button" onClick={() => game.hireJanitor()}>
              Hire janitor · {moneyAbbrev(JANITOR_HIRE)}
            </button>
            <button type="button" onClick={() => game.hireResearcher()}>
              Hire researcher · {moneyAbbrev(RESEARCHER_HIRE)}
            </button>
            <button type="button" onClick={() => game.hireDeskStaff()}>
              Hire desk agent · {moneyAbbrev(DESK_STAFF_HIRE)}
            </button>
            <button type="button" onClick={() => game.fireMechanic()}>
              Lay off
            </button>
          </div>
          <p className="muted">
            {game.mechanics} mechanics · {game.researchers} researchers · {game.deskStaff} desk
            {game.mxSigned.length
              ? ` · MX: ${game.mxSigned.map((id) => game.airline(id).name).join(', ')}`
              : ''}
          </p>
          {game.milAgreement ? (
            <p className="muted">Guard host active — {game.milRampLine()}</p>
          ) : (
            <>
              <button type="button" className="wide" onClick={() => game.signMilitaryAgreement()}>
                Host military / Guard · {moneyAbbrev(MIL_AGREE_COST)}
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
      ) : null}
      {tab === 'charts' ? (
        <section data-testid="eco-charts">
          <h3>Charts</h3>
          <p className="muted" data-money-unit="day">
            Income {income} · payroll {payroll}. One point per in-game hour.
          </p>
          <LineChart
            title="Cash"
            series={[{ name: 'Cash', color: '#e7c56a', values: game.econHist.map((p) => p.cash) }]}
            empty="Cash line starts after the first hour."
          />
          <LineChart
            title="Income vs expenses"
            series={[
              { name: 'Income', color: '#34d399', values: game.econHist.map((p) => p.income) },
              { name: 'Expenses', color: '#fb7185', values: game.econHist.map((p) => p.expense) },
            ]}
          />
          <LineChart
            title="Passengers / day"
            series={[{ name: 'Pax', color: '#38bdf8', values: game.econHist.map((p) => p.pax) }]}
          />
          <LineChart
            title="Cargo / day"
            series={[{ name: 'Cargo', color: '#fbbf24', values: game.econHist.map((p) => p.cargo) }]}
          />
          <ul className="airlines">
            {game.econHist.slice(-6).reverse().map((p) => (
              <li key={p.t}>
                {formatSimDate(p.t)} · in {moneyAbbrev(p.income)} · out {moneyAbbrev(p.expense)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

function Research({ game }: { game: Game }) {
  return (
    <section>
      <h3>Research desk</h3>
      <p className="muted">
        {Math.floor(game.researchPoints)} RP · ~{game.researchRate().toFixed(2)}/s
        {game.researchUnlocked.length
          ? ` · ${game.researchUnlocked.length}/${RESEARCH_NODES.length} unlocked`
          : ' · no unlocks yet'}
      </p>
      <ul className="airlines">
        {RESEARCH_NODES.map((n) => {
          const owned = game.hasResearch(n.id)
          const gate = game.canBuyResearch(n.id)
          return (
            <li key={n.id}>
              <b>
                {n.name} <span className="muted">{owned ? '· live' : `· ${n.cost} RP`}</span>
              </b>
              <span className="muted">{n.blurb}</span>
              {!owned ? (
                <button
                  type="button"
                  className="wide"
                  disabled={!gate.ok}
                  title={gate.ok ? `Buy ${n.name}` : gate.why}
                  onClick={() => game.buyResearch(n.id)}
                >
                  {gate.ok ? `Unlock · ${n.cost} RP` : gate.why}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Airlines({ game }: { game: Game }) {
  const prog = game.fieldXpToNext()
  return (
    <section className="airline-tiers">
      <h3>Airline tiers</h3>
      <p className="muted">
        Field Level {prog.level}
        {prog.level < 5 ? ` · ${prog.xp}/${prog.need} XP` : ' · max'}
        {' · '}
        {game.signed.length
          ? game.signed.map((id) => game.airline(id).name).join(', ')
          : 'none signed'}
      </p>
      <p className="muted">
        Standing {HEAT_REWARD_THRESHOLD}+ unlocks a perk · warn ≤{HEAT_WARN_THRESHOLD} · abandon ≤
        {HEAT_ABANDON_THRESHOLD}.
      </p>
      {([1, 2, 3, 4, 5] as AirlineTier[]).map((tier) => {
        const meta = AIRLINE_TIER_META[tier]
        const unlocked = game.tierUnlocked(tier)
        const carriers = game
          .allAirlines()
          .filter((a) => a.tier === tier)
          .sort((a, b) => a.name.localeCompare(b.name))
        if (!carriers.length) return null
        return (
          <div key={tier} className={`tier-block${unlocked ? '' : ' locked'}`}>
            <header className="tier-head">
              <strong>
                {meta.short} · {meta.label}
              </strong>
              <span className="muted">
                {unlocked ? 'Unlocked' : `Needs Field Lv${Math.max(1, tier - 1)}`}
              </span>
            </header>
            <ul className="airlines">
              {carriers.map((a) => {
                const signed = game.signed.includes(a.id)
                const banned = game.isBanned(a.id)
                const standing = Math.round(game.standingOf(a.id))
                const reward = game.rewardOf(a.id)
                const miss = game.missingReq(a.id)
                return (
                  <li key={a.id}>
                    <b style={{ color: a.color }}>
                      {a.name}{' '}
                      <span className="muted">
                        {bizModelBlurb(a.bizModel)} · {personaBlurb(a.persona)}
                      </span>
                    </b>
                    <span className="muted">
                      {banned
                        ? `Suspended ${Math.ceil(game.banRemaining(a.id))}s`
                        : signed
                          ? `Standing ${standing}${reward ? ` · ${rewardBlurb(reward)}` : ''}${
                              reward ? ` — ${rewardDetail(reward)}` : ''
                            }`
                          : !unlocked
                            ? meta.scope
                            : miss.slice(0, 3).join(', ') || a.blurb}
                      {signed && !reward
                        ? ` · chase ${rewardBlurb(rewardForPersona(a.persona))}`
                        : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

function Planner({ game }: { game: Game }) {
  const [selSlot, setSelSlot] = useState<string | null>(null)
  const flight = game.flights.find((f) => f.id === game.selectedFlight) ?? game.flights[0]
  const airline = flight ? game.airline(flight.airline) : null
  return (
    <>
      <section>
        <h3>Selected flight</h3>
        {flight && airline ? (
          <div className="flight">
            <p className="fn" style={{ color: airline.color }}>
              {game.roleLabel(flight.kind)} · {airline.name} {flight.flightNo}
            </p>
            <p className="phase">
              {flight.airframeName || game.aircraftLabel(flight.kind)} · {labelPhase(flight.phase, flight.craft)}
              {(flight.craft ?? 'jet') === 'jet' ? ` · ${game.gateLabel(flight.stand)}` : ' · helipad'}
            </p>
            <p className="muted">
              Needs{' '}
              {flight.craft === 'helo'
                ? 'helipad'
                : `${AIRFRAMES[flight.airframeId]?.minRunway ?? '?'}c strip`}
            </p>
            <ul className="ledger">
              {flight.ledger.length === 0 ? (
                <li>Nothing posted yet.</li>
              ) : (
                flight.ledger.map((row, i) => (
                  <li key={i}>
                    {row.label}
                    <b>{moneyAbbrev(row.amount)}</b>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : (
          <p className="muted">No flights until an airline signs.</p>
        )}
      </section>
      <section>
        <h3>Flight planner</h3>
        <p className="muted">
          {game.scheduleAuto ? 'Auto bank on' : 'Manual bank'} · {game.openSchedule().length}/
          {game.scheduleCap()} open · {game.runwayStripCount()} strip
          {game.runwayStripCount() === 1 ? '' : 's'}
        </p>
        <div className="row">
          <button
            type="button"
            className={game.scheduleAuto ? 'on' : ''}
            onClick={() => game.setScheduleAuto(true)}
          >
            Auto
          </button>
          <button
            type="button"
            className={!game.scheduleAuto ? 'on' : ''}
            onClick={() => game.setScheduleAuto(false)}
          >
            Manual
          </button>
          {game.signed.slice(0, 3).map((id) => (
            <button key={id} type="button" onClick={() => game.addManualSlot(id, 18)}>
              +{game.airline(id).name.slice(0, 6)}
            </button>
          ))}
        </div>
        {selSlot ? (
          <div className="row">
            <button type="button" onClick={() => game.nudgeSlotEta(selSlot, -10)}>
              ETA −10
            </button>
            <button type="button" onClick={() => game.nudgeSlotEta(selSlot, 10)}>
              ETA +10
            </button>
            <button type="button" onClick={() => game.setSlotStandPref(selSlot, null)}>
              Auto stand
            </button>
            {tilesOf(game.tiles, 'stand').slice(0, 4).map((st) => (
              <button key={`${st.c},${st.r}`} type="button" onClick={() => game.setSlotStandPref(selSlot, st)}>
                {game.gateLabel(st)}
              </button>
            ))}
          </div>
        ) : null}
        <ul className="airlines">
          {game.schedule.slice(0, 8).map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setSelSlot(s.id)}>
                <b style={{ color: game.airline(s.airline).color }}>{s.flightNo}</b>
                <span className="muted">
                  {' '}
                  {s.status} · ETA {Math.max(0, Math.round(s.eta - game.clock))}s
                </span>
              </button>
              {s.status !== 'inbound' ? (
                <span className="row">
                  <button type="button" onClick={() => game.pullSlot(s.id)}>
                    Pull
                  </button>
                  <button type="button" onClick={() => game.bumpSlot(s.id)}>
                    Bump
                  </button>
                  <button type="button" onClick={() => game.cancelSlot(s.id)}>
                    Cancel
                  </button>
                </span>
              ) : null}
            </li>
          ))}
          {game.schedule.length === 0 ? (
            <li>
              <span className="muted">No slots — sign an airline or add one.</span>
            </li>
          ) : null}
        </ul>
      </section>
    </>
  )
}

function Services({ game }: { game: Game }) {
  const origin = game.selectedTerminalOrigin()
  const fit = origin ? game.fits.find((f) => f.origin.c === origin.c && f.origin.r === origin.r) : null
  return (
    <>
      <section>
        <h3>Fuel desk</h3>
        <p className="muted">
          {game.fuelBrand ? `${FUEL[game.fuelBrand].name} · ${game.fuelLoads} loads` : 'No carrier signed.'}
        </p>
        <div className="row">
          <button type="button" onClick={() => game.signFuel('apex')}>
            Apex {moneyAbbrev(FUEL.apex.sign)}
          </button>
          <button type="button" onClick={() => game.signFuel('kiln')}>
            Kiln {moneyAbbrev(FUEL.kiln.sign)}
          </button>
        </div>
        <button type="button" className="wide" onClick={() => game.buyLoads()}>
          Buy 4 loads
          {game.fuelBrand ? ` · ${moneyAbbrev(FUEL[game.fuelBrand].wholesale * 4)}` : ''}
        </button>
      </section>
      <section>
        <h3>Catering desk</h3>
        <p className="muted">
          {game.caterBrand ? CATER[game.caterBrand].name : 'No catering vendor.'}
        </p>
        <div className="row">
          <button type="button" onClick={() => game.signCater('skybite')}>
            SkyBite {moneyAbbrev(CATER.skybite.sign)}
          </button>
          <button type="button" onClick={() => game.signCater('galleyprime')}>
            GalleyPrime {moneyAbbrev(CATER.galleyprime.sign)}
          </button>
        </div>
      </section>
      <section>
        <h3>Hall furnish</h3>
        {origin ? (
          <>
            <button type="button" className="wide" onClick={() => game.scrubHall()}>
              Scrub hall · {moneyAbbrev(HALL_SCRUB_COST)}
            </button>
            <ul className="rooms">
              {ROOMS.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => game.buyRoom(r.id)}>
                    {r.name}
                    <span>
                      {fit?.rooms[r.id] ?? 0} · {moneyAbbrev(r.cost)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Stamp a hall, then select it to furnish rooms.</p>
        )}
      </section>
    </>
  )
}

function Selection({ game }: { game: Game }) {
  const flight = game.flights.find((f) => f.id === game.selectedFlight)
  const airline = flight ? game.airline(flight.airline) : null
  const tile = game.selectedTile
  const kind = tile ? game.tile(tile) : null
  return (
    <section>
      <h3>{kind ? kind.replace('_', ' ') : 'Nothing selected'}</h3>
      {tile ? (
        <p className="muted">
          Cell {tile.c},{tile.r}
          {kind ? ` · ${kind}` : ''}
        </p>
      ) : null}
      {flight && airline ? (
        <>
          <p className="fn" style={{ color: airline.color }}>
            {airline.name} {flight.flightNo}
          </p>
          <p className="phase">
            {flight.airframeName || game.aircraftLabel(flight.kind)} · {labelPhase(flight.phase, flight.craft)}
          </p>
          <p className="muted">{game.gateLabel(flight.stand)}</p>
        </>
      ) : (
        <p className="muted">Click a jet or a building. Empty grass closes this panel.</p>
      )}
    </section>
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
    mx_taxi: 'Taxi to hangar',
    mx_bay: 'Hangar MX',
    mx_return: 'Return from hangar',
    board: 'Boarding',
    pushback: 'Pushback',
    parked: 'Parked',
    taxi_out: 'Taxi out',
    takeoff: 'Takeoff',
    gone: 'Airborne',
  }
  return map[phase] ?? phase
}
