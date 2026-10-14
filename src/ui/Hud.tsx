import { memo, useEffect, useRef, useState } from 'react'
import { moneySummaryLine, projectCash } from './cashForecast'
import { useHudBandVar } from './hudBand'
import { LiveText } from './LiveText'
import { ViewModeToggle } from './ViewModeToggle'
import { PremiumPanel } from './PremiumPanel.tsx'
import { GameTimetable } from './timetable/GameTimetable'
import { AirlinesDesk } from './AirlinesDesk'
import { DiplomacyLetters } from './DiplomacyLetters'
import { loanAmountLabel, loanDeskRows, loanProductLabel, payrollPreviewLabel, payrollPreviewTitle } from '../game/economy.ts'
import { REAL_SECONDS_PER_GAME_DAY } from '../core/clock.ts'
import { AIRFRAMES } from '../game/airframes'
import type { StandingAdvisorCard } from '../game/standingAdvisor.ts'
import { canUpgradePower, powerPlantOffer } from '../economy/powerPlant'
import { BAG_SYSTEMS, FUEL_CONTRACTS, PAX_UNITS, TANK_TIERS, VEHICLE_OFFERS } from '../scale/data'
import { canBuyPax, canBuyVehicle, canSignContract, canUpgradeBags, canUpgradeTank, tankDef } from '../scale/logic'
import {
  BUDGET_BLURB,
  BUDGET_LABEL,
  BUILDINGS,
  CATER,
  FUEL,
  CARPARK_LONG_COST,
  CARPARK_SHORT_COST,
  HALL_SCRUB_COST,
  HEAVY_RUNWAY_COST,
  HOTEL_COST,
  HOTEL_COST_L2,
  JANITOR_HIRE,
  RESEARCHER_HIRE,
  DESK_STAFF_HIRE,
  LAND,
  LOAN_PRODUCTS,
  AIRLINE_TIER_META,
  bizModelBlurb,
  MECHANIC_HIRE,
  MIL_AGREE_COST,
  LAND_PLOT,
  money,
  parkTermLabel,
  personaBlurb,
  STAND_JETWAY_MULT,
  standAccessLabel,
  PREMADE_TERMINAL_COST,
  RAIL_CITY_COST,
  HEAT_ABANDON_THRESHOLD,
  HEAT_REWARD_THRESHOLD,
  HEAT_WARN_THRESHOLD,
  RESEARCH_NODES,
  rewardBlurb,
  rewardDetail,
  rewardForPersona,
  ROOMS,
  RUNWAY_PREFAB_COST,
  SHORT_RUNWAY_COST,
  STARTER_KIT_COST,
  TOOL_LABEL,
} from '../game/catalog'
import { starterKitPreview } from '../game/starterLayout'
import { capstoneCost, SPEC_PATHS } from '../progression/specializations'
import { SpecTree } from './SpecTree'
import { lockTip, PROGRESSION_BUILDABLES, unlockLevel } from '../progression/unlocks'
import { lateIdForTool, lateStampLabel } from '../game/lateBuildings.ts'
import { buildingById } from '../tier3plus/index.ts'
import { tilesOf } from '../game/path'
import { CLEARANCE_LICENCE_COST } from '../inbound/data.ts'
import { environmentCaption, seasonAtClock } from '../environment/index.ts'
import { formatSimDate, type Game } from '../game/sim'
import { inputMap } from '../input/map'
import { pauseState } from './pauseState'
import { GameSettings } from './PauseMenu'
import { ControlsPanel } from './ControlsPanel'
import type { AirlineTier, BudgetKey, Speed, Tool } from '../game/types'
import { RivalPanel } from '../rival/RivalPanel.tsx'
import { LineChart } from './LineChart'
import { FeesPanel } from './FeesPanel'
import { TycoonPanel, YearReportCard } from '../tycoon/TycoonPanel.tsx'
import type { TycoonTab } from '../tycoon/types.ts'
import { StaffHousingPanel } from './StaffHousingPanel'
import { AchievementToast, type AchievementDef } from '../achievements'

function parcelButtonLabel(game: Game): string {
  const offer = game.nextParcelOffer()
  if (!offer) return game.site ? 'Parcels full' : 'Buy land first'
  return `${offer.name} ${money(offer.price)}${offer.locked ? ` · need Lv${offer.needLevel}` : ''}`
}

const BUDGET_KEYS: BudgetKey[] = [
  'maintenance',
  'security',
  'cleaning',
  'fire',
  'ambulance',
]

/** Cities: Skylines-style build categories — pick a menu, then a stamp from the tray. */
const BUILD_MENUS: { id: string; label: string; tools: Tool[] }[] = [
  {
    id: 'pavement',
    label: 'Pavement',
    tools: ['runway_short', 'runway', 'runway_heavy', 'taxi', 'road', 'helipad', 'deice'],
  },
  {
    id: 'stands',
    label: 'Stands',
    tools: ['stand_s', 'stand', 'stand_w', 'stand_l'],
  },
  {
    id: 'terminal',
    label: 'Terminal',
    tools: [
      'premade',
      'terminal',
      'term_bus',
      'people_mover',
      'xfer_bus',
      'hub_skywalk',
      'belt',
      'travelator',
      'skywalk',
      'mover',
    ],
  },
  {
    id: 'ops',
    label: 'Ops',
    tools: [
      'fuel',
      'kitchen',
      'depot',
      'bags',
      'belt',
      'snack',
      'fire',
      'police',
      'cargo',
      'guard',
      'tower',
      'hangar',
      'hangar_w',
      'hangar_j',
      'mro',
      'nighthub',
      'fuel_rail',
      'oil',
    ],
  },
  {
    id: 'landside',
    label: 'Landside',
    tools: [
      'hotel_inn',
      'hotel_biz',
      'hotel_resort',
      'park_s',
      'park_l',
      'park_g',
      'park_u',
      'bus',
      'rail',
      'guard',
    ],
  },
  {
    id: 'late',
    label: 'Late',
    tools: ['airport_hotel', 'rail_link', 'saf_blending'],
  },
  {
    id: 'bulldoze',
    label: 'Bulldoze',
    tools: ['clear'],
  },
]

type PanelId =
  | 'economy'
  | 'budget'
  | 'research'
  | 'specialize'
  | 'airlines'
  | 'planner'
  | 'services'
  | 'settings'
  | 'premium'
  | 'tycoon'
  | 'rival'
  | 'staff'
  | null

type EcoTab = 'overview' | 'income' | 'expenses' | 'loans' | 'charts'

const ECO_TABS: { id: EcoTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'income', label: 'Income' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'loans', label: 'Loans' },
  { id: 'charts', label: 'Charts' },
]

function toolCost(tool: Tool): number | null {
  if (tool === 'runway_short') return SHORT_RUNWAY_COST
  if (tool === 'runway') return RUNWAY_PREFAB_COST
  if (tool === 'runway_heavy') return HEAVY_RUNWAY_COST
  if (tool === 'premade') return PREMADE_TERMINAL_COST
  if (tool === 'clear') return null
  return BUILDINGS.find((b) => b.tool === tool)?.cost ?? null
}

function TrayMark({ tool }: { tool: string }) {
  const kind = tool.includes('runway')
    ? 'strip'
    : tool === 'taxi' || tool === 'road' || tool === 'belt'
      ? 'path'
      : tool.startsWith('stand')
        ? 'stand'
        : tool === 'clear'
          ? 'clear'
      : tool.includes('hotel') ||
          tool.startsWith('park') ||
          tool === 'bus' ||
          tool === 'rail' ||
          tool === 'rail_link'
        ? 'land'
            : 'ops'
  return (
    <svg className="tray-ico" viewBox="0 0 32 32" aria-hidden>
      {kind === 'strip' ? <rect x="3" y="13" width="26" height="6" rx="1" fill="currentColor" /> : null}
      {kind === 'path' ? (
        <path d="M6 24 L16 8 L26 24" fill="none" stroke="currentColor" strokeWidth="2.4" />
      ) : null}
      {kind === 'stand' ? (
        <circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" />
      ) : null}
      {kind === 'clear' ? (
        <path d="M8 8 L24 24 M24 8 L8 24" stroke="currentColor" strokeWidth="2.4" />
      ) : null}
      {kind === 'land' ? <rect x="7" y="9" width="18" height="14" rx="2" fill="currentColor" /> : null}
      {kind === 'ops' ? <path d="M16 5 L28 26 H4 Z" fill="currentColor" /> : null}
    </svg>
  )
}

const INFO_MENUS: { id: Exclude<PanelId, null>; label: string; tip: string }[] = [
  { id: 'economy', label: 'Economy', tip: 'Cash, loans, parcels, IPO / HATCH' },
  { id: 'budget', label: 'Budget', tip: 'Ops payroll sliders and hiring' },
  { id: 'staff', label: 'Staff', tip: 'Commute, housing, morale' },
  { id: 'research', label: 'Research', tip: 'RP unlocks and lab crew' },
  { id: 'specialize', label: 'Specs', tip: 'Hub, low-cost, cargo, and luxury trees' },
  { id: 'airlines', label: 'Airlines', tip: 'Standing, letters, hubs · L' },
  { id: 'planner', label: 'Planner', tip: 'Timetable, stands, selected flight' },
  { id: 'services', label: 'Services', tip: 'Fuel, catering, hall furnish' },
  { id: 'settings', label: 'Settings', tip: 'Sound, graphics, hints, and game options' },
  { id: 'premium', label: 'Premium', tip: 'Premium check-in, fast-track, VIP room' },
  { id: 'tycoon', label: 'Tycoon', tip: 'Shop bids, ad campaigns, awards, year report' },
  { id: 'rival', label: 'Rival', tip: 'Bellwater Intl — fees, roster, catchment' },
]

export function Hud({ game, onNewGame }: { game: Game; onNewGame?: () => void }) {
  const [selSlot, setSelSlot] = useState<string | null>(null)
  const [buildMenu, setBuildMenu] = useState<string | null>(null)
  const [panelPick, setPanel] = useState<PanelId>(null)
  // One panel at a time: an open hint list folds the HUD rollout away.
  const panel = game.sidePanel === 'hints' ? null : panelPick
  const [openLetter, setOpenLetter] = useState<string | null>(null)
  const [hoverLetter, setHoverLetter] = useState<string | null>(null)
  // A letter being read (open or hovered) holds its countdown in the sim.
  useEffect(() => {
    game.holdLetters([openLetter, hoverLetter].filter((id): id is string => id != null))
  }, [game, openLetter, hoverLetter])
  useEffect(() => () => game.holdLetters([]), [game])
  const [chromePinned, setChromePinned] = useState(false)
  const [ecoTab, setEcoTab] = useState<EcoTab>('overview')
  const [loanAmount, setLoanAmount] = useState(25_000)
  const [tycoonTab, setTycoonTab] = useState<TycoonTab>('shops')
  const [inboxOpen, setInboxOpen] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const [feesOpen, setFeesOpen] = useState(false)
  // Terminal view folds the apron cards. A peek belongs to the view it was opened in.
  const [hallPeek, setHallPeek] = useState<{ view: string; id: 'coach' | 'offer' | 'map' } | null>(null)
  const inHall = game.view === 'hall'
  const peek = hallPeek?.view === game.view ? hallPeek.id : null
  const openPeek = (id: 'coach' | 'offer' | 'map') =>
    setHallPeek((cur) => (cur?.view === game.view && cur.id === id ? null : { view: game.view, id }))
  const pendingYear = game.pendingYearReport()?.year ?? null
  const [yearShown, setYearShown] = useState<number | null>(null)
  if (panel === 'tycoon' && pendingYear !== yearShown) {
    setYearShown(pendingYear)
    if (pendingYear != null) setTycoonTab('year')
  }
  useEffect(() => {
    game.pokeTycoon()
  }, [game, panel])
  const forecast = projectCash(game.cash, game.incomeRate(), game.dailyOperatingCharges())
  const flowLabel = `${forecast.dailyNet > 0 ? '+' : ''}${money(forecast.dailyNet)}/day`
  const menuTools = buildMenu
    ? (BUILD_MENUS.find((m) => m.id === buildMenu)?.tools ?? [])
    : []
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

  const [newAchievements, setNewAchievements] = useState<AchievementDef[]>([])
  useEffect(() => {
    const unlocks = game.achievements.popUnlocks()
    if (unlocks.length > 0) {
      setNewAchievements(unlocks)
    }
  }, [game.achievements.state.unlocked, game])

  const layoverAirline = game.layoverOffer
    ? game.airline(game.layoverOffer.airline)
    : game.layover
      ? game.airline(game.layover.airline)
      : null
  const hubAirline = game.hubOffer ? game.airline(game.hubOffer.airline) : null
  const holding = game.holdingCount()
  const freeGates = game.freeStands().length
  const rival = game.rivalPanel()
  const topBar = useRef<HTMLElement>(null)
  useHudBandVar(topBar, '--hud-bar-bottom', 'bottom')

  useEffect(() => {
    return inputMap.onPress((id) => {
      if (id !== 'view.airlines') return
      setPanel((cur) => {
        if (cur === 'airlines') {
          setChromePinned(false)
          return null
        }
        setChromePinned(true)
        return 'airlines'
      })
    })
  }, [])

  const togglePanel = (id: Exclude<PanelId, null>) => {
    const closing = panel === id
    setPanel(closing ? null : id)
    setChromePinned(!closing)
    game.setSidePanel(closing ? null : 'hud')
  }

  /** Open a tab without accidental close when already selected. */
  const openPanel = (id: Exclude<PanelId, null>) => {
    setPanel(id)
    setChromePinned(true)
    game.setSidePanel('hud')
  }

  const ticker = game.news.slice(0, 5)
  const xp = game.fieldXpToNext()
  const standing = game.avgStanding()
  const alerts: string[] = []
  if (game.pendingThreat) alerts.push(game.pendingThreat.severity === 'hard' ? 'Hard threat' : 'Security')
  if (game.pendingEmergency) alerts.push('Emergency')
  if (game.warnedAirlines().length) alerts.push('Standing low')
  if (holding) alerts.push(`${holding} holding`)
  if (game.apronJamLine()) alerts.push('Apron jam')
  if (game.securityQueueCount() >= 3) alerts.push('Security queue')
  if (game.lostPaxCount() > 0) alerts.push('Lost pax')
  const power = game.powerReport()
  if (power.brownout) alerts.push('Power')
  const powerGate = canUpgradePower(game.powerPlantTier, game.fieldLevel())
  if (game.loanBalance > game.loanOpened && game.loanOpened > 0) alerts.push('Loan short')
  for (const item of game.disruptionFeed()) alerts.push(item.title)

  return (
    <div className="hud">
      <AchievementToast achievements={newAchievements} />
      {panel || buildMenu ? null : <GameTimetable game={game} menuOpen={false} />}
      <button
        type="button"
        className={`fees-toggle${feesOpen ? ' on' : ''}`}
        title="Landing, passenger, and service prices"
        data-testid="tab-fees"
        onClick={() => setFeesOpen((open) => !open)}
      >
        Fees
      </button>
      {feesOpen ? (
        <FeesPanel
          fees={game.fees}
          depositTier={game.depositTier}
          onFee={(key, value) => game.setFee(key, value)}
          onTier={(tier) => game.setDepositTier(tier)}
          onClose={() => setFeesOpen(false)}
        />
      ) : null}
      <header className="top" data-testid="stats-bar" ref={topBar}>
        <div className="brand">
          <strong>{game.branding.airportName}</strong>
          <span>
            {site ? site.name : 'No plot'} · {game.view === 'apron' ? 'Airport' : 'Terminal'}
          </span>
        </div>
        <button
          type="button"
          className="stat"
          data-testid="hud-menu"
          title="Menu (Esc)"
          onClick={() => pauseState.openMenu()}
        >
          Menu
        </button>
        <button
          type="button"
          className="stat"
          data-testid="hud-new-game"
          title="Back to the title — New Game and Continue live there"
          onClick={() => onNewGame?.()}
        >
          New Game
        </button>
        <div className="cash-hero-wrap">
          <button
            type="button"
            className="stat cash top-cash cash-hero"
            title="Cash and forecast — click for income and charges"
            data-testid="cash-hero"
            onClick={() => setCashOpen((open) => !open)}
          >
            <LiveText className="cash-amount" read={() => money(game.cash)} />
            <span className={`cash-flow${forecast.dailyNet >= 0 ? ' up' : ' down'}`} data-testid="cash-forecast">
              {flowLabel}
            </span>
          </button>
          {cashOpen ? (
            <div className="cash-menu" data-testid="cash-menu">
              <p>
                Live income <strong>{money(forecast.hourlyIncome)}/hr</strong>
                <span className="muted"> · {money(forecast.dailyIncome)}/day</span>
              </p>
              <p>
                Daily charges <strong>{money(forecast.dailyCharges)}</strong>
              </p>
              <ul>
                <li>Payroll {money(forecast.charges.payroll)}</li>
                <li>Upkeep {money(forecast.charges.upkeep)}</li>
                <li>Holding {money(forecast.charges.holding)}</li>
                <li>Levy {money(forecast.charges.levy)}</li>
              </ul>
              <p>
                Weekly charges <strong>{money(forecast.weeklyCharges)}</strong>
              </p>
              <p>
                Forecast <strong className={forecast.dailyNet >= 0 ? 'up' : 'down'}>{flowLabel}</strong>
                <span className="muted"> · in 7 days {money(forecast.cashInSevenDays)}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setCashOpen(false)
                  setEcoTab('overview')
                  openPanel('economy')
                }}
              >
                Open books
              </button>
            </div>
          ) : null}
        </div>
        <div className="stat" title="One day is a 180-second cycle">
          <LiveText read={() => formatSimDate(game.clock)} />
        </div>
        <SpeedButtons game={game} speed={game.speed} className="speeds stat-speeds" />
        <div
          className="stat"
          title={`Field Rating ${game.fieldRating()} — ${game.fieldRatingLabel()}`}
          data-testid="field-level"
        >
          Field {xp.label}
          {xp.pct < 1 ? ` · ${xp.xp}/${xp.need} XP` : ` · ${xp.xp} XP`}
        </div>
        <div className="stat" title="Average Standing of signed airlines">
          Standing {standing == null ? '—' : Math.round(standing)}
        </div>
        <div className="stat" data-testid="reputation-stat" title="Public reputation, 0 to 100">
          Rep <LiveText read={() => `${game.reputationDisplay()}%`} />
        </div>
        <div
          className={`stat${alerts.length ? ' alert' : ''}`}
          title={alerts.join(' · ') || 'No alerts'}
        >
          {alerts.length ? alerts.slice(0, 2).join(' · ') : 'Clear'}
        </div>
        <div
          className="stat"
          title={
            game.mapId === 'temperate'
              ? environmentCaption(game.clock, game.weather, game.holidayPeakHook)
              : game.climateCaption()
          }
          data-testid="weather-stat"
        >
          {game.mapId === 'temperate'
            ? `${seasonAtClock(game.clock).name} · ${game.weatherLabel()}`
            : game.weatherLabel()}
        </div>
        <div className="stat" title="Free stands / jets holding">
          Gate {freeGates} · Hold {holding}
        </div>
        {game.public ? (
          <button
            type="button"
            className="stat cash top-cash"
            title="Open Economy · HATCH"
            onClick={() => openPanel('economy')}
          >
            HATCH ${game.sharePrice.toFixed(2)}
          </button>
        ) : null}
        <div className="stat vitals-quiet" title={game.stripCapabilityLine()}>
          {game.stripTierLabel()} · RW {Math.round(game.runwayCondition)}% · Sec{' '}
          {ready.security}
          {game.fits.length > 1 ? ` · ${game.fits.length}T` : ''}
          {game.runwayStripCount() > 0 ? ` · ${game.runwayStripCount()}RW` : ''}
        </div>
      </header>

      {inHall ? (
        <div className="hall-peeks" data-testid="hall-peeks">
          {game.showCoach() ? (
            <button
              type="button"
              data-testid="peek-coach"
              className={peek === 'coach' ? 'on' : ''}
              onClick={() => openPeek('coach')}
            >
              First hour
            </button>
          ) : null}
          {game.inboundOffer() ? (
            <button
              type="button"
              data-testid="peek-offer"
              className={peek === 'offer' ? 'on' : ''}
              onClick={() => openPeek('offer')}
            >
              {game.inboundOffer()?.title ?? 'Offer'}
            </button>
          ) : null}
          {game.site ? (
            <button
              type="button"
              data-testid="peek-map"
              className={peek === 'map' ? 'on' : ''}
              onClick={() => openPeek('map')}
            >
              {game.mapSummary().name}
            </button>
          ) : null}
        </div>
      ) : null}

      {game.site && (!inHall || peek === 'map') ? (
        <aside className="map-goals" data-testid="map-goals" aria-label="Map goals">
          <div className="map-goals-head">
            <strong>{game.mapSummary().name}</strong>
            <span>{game.mapSummary().season}</span>
          </div>
          <ul>
            {game.mapGoalCards().map((goal) => (
              <li key={goal.id} data-testid={`goal-${goal.id}`} data-done={goal.done ? '1' : '0'}>
                <span className="mark">{goal.done ? '✓' : '·'}</span>
                <span>
                  {goal.title}{' '}
                  <em>
                    {goal.value}/{goal.target}
                  </em>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      {game.showCoach() && (!inHall || peek === 'coach') ? (
        <div className="coach" data-testid="coach">
          <div className="coach-head">
            <strong>First hour</strong>
            <button type="button" className="ghost" onClick={() => game.dismissCoach()}>
              Got it
            </button>
          </div>
          <ol>
            {game.coachSteps().map((s) =>
              s.id === 'field' && game.showStarterKit() ? (
                // First step points straight at the kit: one click stamps it, so a
                // new player doesn't spend the opening budget on a lone runway.
                <li key={s.id} data-done="0" className="coach-kit-step">
                  <span className="mark">→</span>
                  <span>
                    <button
                      type="button"
                      className="coach-kit"
                      data-testid="starter-kit-coach"
                      title={starterKitPreview(game.startFocus).summary}
                      onClick={() => game.buildStarterKit()}
                    >
                      {starterKitPreview(game.startFocus).label} · {money(STARTER_KIT_COST)}
                    </button>
                    {game.starterFreehand ? null : (
                      <button
                        type="button"
                        className="coach-freehand"
                        data-testid="build-freehand"
                        onClick={() => game.chooseFreehand()}
                      >
                        or build freehand
                      </button>
                    )}
                  </span>
                </li>
              ) : (
                <li key={s.id} data-done={s.done ? '1' : '0'}>
                  <span className="mark">{s.done ? '✓' : '·'}</span>
                  {s.label}
                </li>
              ),
            )}
          </ol>
          <p className="muted">
            Field {game.fieldRating()} · {game.fieldRatingLabel()} — Standing, hall, and security
            all count.
          </p>
        </div>
      ) : null}

      {game.inboundOffer() && (!inHall || peek === 'offer') ? (
        <aside
          className={`inbound-panel${game.showCoach() && !inHall ? ' beside-coach' : ''}`}
          data-testid="inbound-offer" data-request-id={game.inboundOffer()?.id}>
          {(() => {
            const card = game.inboundOffer()
            if (!card) return null
            return (
              <div className="inbound-card">
                <header>
                  <span className="kind">{card.priority ? 'Priority' : 'Traffic'}</span>
                  <LiveText className="timer" read={() => `${Math.ceil(game.inboundOffer()?.secondsLeft ?? 0)}s`} />
                </header>
                <h3>{card.title}</h3>
                <p>{card.blurb}</p>
                <p className="needs">{card.needs}</p>
                <p className="pay">
                  {card.reward > 0 ? `Fee ${money(card.reward)}` : `Day-rate ${money(card.dailyFee)}`}
                  {card.fine > 0 ? ` · refuse ${money(card.fine)}` : ''}
                  {` · ${card.stayDays}d`}
                </p>
                <div className="row">
                  <button
                    type="button"
                    className="on"
                    data-testid="inbound-accept"
                    onClick={() => game.acceptInbound(card.id)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    data-testid="inbound-refuse"
                    onClick={() => game.refuseInbound(card.id)}
                  >
                    Refuse
                  </button>
                </div>
              </div>
            )
          })()}
        </aside>
      ) : null}
      {!panel && game.pendingYearReport() ? (
        <YearReportCard
          report={game.pendingYearReport()!}
          formatMoney={money}
          onDismiss={() => game.dismissYearReport()}
        />
      ) : null}
      <div
        className={`letter-stack${game.showCoach() ? ' below-coach' : ''}${game.inboundOffer() ? ' below-inbound' : ''}`}
        aria-label="Incoming letters"
        data-testid="letter-stack"
      >
        <DiplomacyLetters game={game} />
        {(() => {
          type Letter = {
            id: string
            kind: string
            from: string
            title: string
            blurb: string
            tone: 'ok' | 'good' | 'bad' | 'warn'
            /** Countdown in seconds; read by the live pump, not on render. */
            left: (() => number) | null
            live?: boolean
            cardData?: StandingAdvisorCard
          }
          const letters: Letter[] = []
          if (game.offer && offerAirline) {
            letters.push({
              id: 'contract',
              kind: 'Contract',
              from: offerAirline.name,
              title: `${offerAirline.name} wants a contract${offerAirline.procedural ? ' · regional' : ''}`,
              blurb: `${personaBlurb(offerAirline.persona)} · ${offerAirline.blurb}`,
              tone: 'good',
              left: () => Math.ceil(game.offer?.deadline ?? 0),
            })
          }
          if (game.fieldTask && !game.letterAcked(`field:${game.fieldTask.id}`)) {
            letters.push({
              id: 'field',
              kind: 'Field ask',
              from: game.airline(game.fieldTask.airline).name,
              title: `${game.airline(game.fieldTask.airline).name} · ${game.fieldTask.title}`,
              blurb: `${game.fieldTask.blurb} · ${money(game.fieldTask.bonus)} if done`,
              tone: 'ok',
              left: () => Math.ceil(game.fieldTaskLeft()),
            })
          }
          if (game.cargoVolume && !game.letterAcked(`cargo:${game.cargoVolume.id}`)) {
            const v = game.cargoVolume
            const a = game.airline(v.airline)
            letters.push({
              id: 'cargo-vol',
              kind: 'Volume',
              from: a.name,
              title: `${a.name} volume window`,
              blurb: `Stage ${v.delivered}/${v.targetUnits}u through the shed · ${money(v.fee)} · On-time on the line`,
              tone: v.delivered >= v.targetUnits * 0.55 ? 'good' : 'ok',
              left: () => Math.ceil(game.cargoVolumeLeft()),
              live: true,
            })
          }
          if (game.layoverOffer && layoverAirline) {
            letters.push({
              id: 'layover',
              kind: 'Layover',
              from: layoverAirline.name,
              title: `${layoverAirline.name} layover bank`,
              blurb: `${money(game.layoverOffer.fee)} up front · ${game.layoverOffer.transferPax} transfers · ~${game.layoverOffer.duration}s. Keep Standing above the ban line.`,
              tone: 'good',
              left: () => Math.ceil(game.layoverOffer?.deadline ?? 0),
            })
          } else if (game.layover && layoverAirline && !game.letterAcked(`layover-live:${game.layover.airline}`)) {
            letters.push({
              id: 'layover-live',
              kind: 'Layover live',
              from: layoverAirline.name,
              title: `${layoverAirline.name} layover live`,
              blurb: `${game.layover.spawned}/${game.layover.transferPax} transfers · ${Math.ceil(game.layover.remaining)}s left · Standing ${Math.round(game.standingOf(game.layover.airline))}${game.layover.samples ? ` · avg happy ${Math.round(game.layover.happySum / game.layover.samples)}` : ''}`,
              tone: 'ok',
              left: () => Math.ceil(game.layover?.remaining ?? 0),
              live: true,
            })
          }
          if (game.hubOffer && hubAirline) {
            letters.push({
              id: 'hub',
              kind: 'Hub',
              from: hubAirline.name,
              title: `${hubAirline.name} Hub plaque`,
              blurb: `${money(game.hubOffer.fee)} · denser slots, brand lounge, persona reward. Fail a layover and the ban is harsher.`,
              tone: 'good',
              left: () => Math.ceil(game.hubOffer?.deadline ?? 0),
            })
          }
          if (game.mxOffer && mxAirline) {
            letters.push({
              id: 'mx',
              kind: 'Line MX',
              from: mxAirline.name,
              title: `${mxAirline.name} wants line MX`,
              blurb: `Hangar turnaround fee ${money(game.mxOffer.payout)} per visit. Needs funded mechanics.`,
              tone: 'good',
              left: () => Math.ceil(game.mxOffer?.deadline ?? 0),
            })
          }
          if (game.pendingThreat) {
            letters.push({
              id: 'threat',
              kind: 'Security',
              from: 'Tower',
              title:
                game.pendingThreat.severity === 'hard' ? 'HARD THREAT' : 'Security alert',
              blurb: game.pendingThreat.blurb,
              tone: 'bad',
              left: () => Math.ceil(game.pendingThreat?.deadline ?? 0),
            })
          }
          if (game.pendingEmergency) {
            const e = game.pendingEmergency
            letters.push({
              id: 'emergency',
              kind: 'Emergency',
              from: 'Ops',
              title:
                e.kind === 'tanker_mx'
                  ? 'Firefighting plane · refuel + MX'
                  : e.kind === 'tanker'
                    ? 'Firefighting plane · refuel only'
                    : 'Weather divert',
              blurb: `${e.blurb} · ${money(e.fee)} · Needs ${game.emergencyNeedsLine(e)}${(() => {
                const gap = game.emergencyHostGap(e)
                return gap ? ` · RISK: ${gap}` : ' · ready to host'
              })()}`,
              tone: 'warn',
              left: () => Math.ceil(e.deadline),
            })
          }
          if (game.parkingOffer) {
            letters.push({
              id: 'parking',
              kind: 'GA parking',
              from: game.parkingOffer.callsign,
              title: `Independent parking · ${game.parkingOffer.callsign}`,
              blurb: `${AIRFRAMES[game.parkingOffer.airframeId]?.name ?? 'Aircraft'} · fee ${money(game.parkingOffer.fee)} · ~${game.parkingOffer.staySec}s then leave request`,
              tone: 'ok',
              left: () => Math.ceil(game.parkingOffer?.deadline ?? 0),
            })
          }
          const warnKey = `warn:${game.warnedAirlines().slice().sort().join(',')}`
          if (!game.letterAcked(warnKey) && game.warnedAirlines().length) {
            letters.push({
              id: 'warn',
              kind: 'Relations',
              from: 'Desk',
              title: 'Relations cooling',
              blurb: `${game
                .warnedAirlines()
                .map((id) => {
                  const a = game.airline(id)
                  const perk = game.rewardOf(id)
                  const standing = Math.round(game.standingOf(id))
                  return perk
                    ? `${a.name} Standing ${standing} — ${rewardBlurb(perk)} at risk`
                    : `${a.name} Standing ${standing} — walk at ${HEAT_ABANDON_THRESHOLD}`
                })
                .join(' · ')}. Standing ≤${HEAT_WARN_THRESHOLD} warns; ≤${HEAT_ABANDON_THRESHOLD} and they abandon.`,
              tone: 'warn',
              left: null,
            })
          }
          for (const card of game.standingAdvisor.activeCards) {
            const a = game.airline(card.airlineId)
            const causesSummary = card.topCauses
              .map((c, i) => `${i + 1}. ${c.label} (Fix: ${c.fix})`)
              .join(' · ')
            letters.push({
              id: card.id,
              kind: 'Advisor Warning',
              from: a.name,
              title: `Standing Collapse Risk · ${a.name}`,
              blurb: `Standing ${card.standing} · predicted departure in ~${card.daysToLeave} game days. Causes & fixes: ${causesSummary}`,
              tone: 'warn',
              left: null,
              cardData: card,
            })
          }
          if (!letters.length) return null
          const active =
            openLetter && letters.some((l) => l.id === openLetter)
              ? openLetter
              : null
          const openOne = letters.find((l) => l.id === active) ?? null
          const rest = letters.filter((l) => l.id !== active)
          const cards = openOne ? [openOne, ...rest.slice(0, 1)] : letters.slice(0, 2)
          const inbox = openOne ? rest.slice(1) : letters.slice(2)
          const renderLetter = (letter: (typeof letters)[number]) => {
            const open = active === letter.id
            return (
              <article
                key={letter.id}
                className={`letter${open ? ' open' : ''} tone-${letter.tone}${letter.live ? ' live' : ''}`}
                onMouseEnter={() => setHoverLetter(letter.id)}
                onMouseLeave={() => setHoverLetter((cur) => (cur === letter.id ? null : cur))}
                data-testid={
                  letter.id === 'field'
                    ? 'field-task'
                    : letter.id === 'contract'
                      ? 'contract-letter'
                      : undefined
                }
              >
                <button
                  type="button"
                  className="letter-tab"
                  onClick={() =>
                    setOpenLetter((cur) => (cur === letter.id ? null : letter.id))
                  }
                >
                  <span className="letter-kind">{letter.kind}</span>
                  <span className="letter-from">{letter.from}</span>
                  {letter.left != null ? (
                    <LiveText className="letter-timer" read={() => `${letter.left?.() ?? 0}s`} />
                  ) : (
                    <span className="letter-timer">info</span>
                  )}
                </button>
                <div className="letter-body">
                  <strong>{letter.title}</strong>
                  <p>{letter.blurb}</p>
                  {letter.id === 'contract' && offerAirline ? (
                    <>
                      <p className="muted">
                        Terms · landing {money(offerAirline.landing)} · bags {money(offerAirline.bags)}
                        {offerAirline.catering
                          ? ` · catering ${money(offerAirline.catering)}`
                          : ''}
                      </p>
                      <ul className="req-list">
                        {(() => {
                          const verdict = game.letterVerdict(offerAirline.id)
                          return (
                            <li data-met={verdict.met ? '1' : '0'} data-testid="contract-verdict">
                              <strong>{verdict.label}</strong>
                            </li>
                          )
                        })()}
                        {game.reqReport(offerAirline.id).map((row) => (
                          <li key={row.label} data-met={row.met ? '1' : '0'}>
                            {row.met ? 'Met' : 'Missing'} · {row.label}
                          </li>
                        ))}
                      </ul>
                      <p className="muted letter-hint" data-testid="contract-hint">
                        Accept: start flights now · Negotiate: haggle fees
                      </p>
                    </>
                  ) : null}
                  <div className="row letter-actions">
                    {letter.id === 'contract' ? (
                      <>
                        <button
                          type="button"
                          className="on"
                          data-testid="contract-accept"
                          onClick={() => game.acceptNegotiation()}
                        >
                          Accept
                        </button>
                        <button type="button" onClick={() => game.openNegotiationPanel()}>
                          Negotiate
                        </button>
                        <button type="button" onClick={() => game.walkNegotiation()}>
                          Walk
                        </button>
                        <button type="button" onClick={() => game.snoozeOffer()}>
                          Later
                        </button>
                      </>
                    ) : null}
                    {letter.id === 'layover' ? (
                      <>
                        <button type="button" className="on" onClick={() => game.acceptLayover()}>
                          Host layover
                        </button>
                        <button type="button" onClick={() => game.declineLayover()}>
                          Decline
                        </button>
                      </>
                    ) : null}
                    {letter.id === 'layover-live' && game.layover ? (
                      <button
                        type="button"
                        onClick={() => {
                          game.ackLetter(`layover-live:${game.layover?.airline ?? ''}`)
                          setOpenLetter(null)
                        }}
                      >
                        Dismiss
                      </button>
                    ) : null}
                    {letter.id === 'hub' ? (
                      <>
                        <button type="button" className="on" onClick={() => game.acceptHub()}>
                          Take Hub
                        </button>
                        <button type="button" onClick={() => game.declineHub()}>
                          Decline
                        </button>
                      </>
                    ) : null}
                    {letter.id === 'mx' ? (
                      <>
                        <button type="button" className="on" onClick={() => game.acceptMxOffer()}>
                          Sign MX
                        </button>
                        <button type="button" onClick={() => game.declineMxOffer()}>
                          Decline
                        </button>
                      </>
                    ) : null}
                    {letter.id === 'threat' ? (
                      <>
                        <button
                          type="button"
                          className="on"
                          onClick={() => game.resolveThreat('scramble')}
                        >
                          Scramble
                        </button>
                        <button type="button" onClick={() => game.resolveThreat('ignore')}>
                          Ignore
                        </button>
                      </>
                    ) : null}
                    {letter.id === 'emergency' ? (
                      <>
                        <button
                          type="button"
                          className="on"
                          onClick={() => game.resolveEmergency('accept')}
                        >
                          Host landing
                        </button>
                        <button type="button" onClick={() => game.resolveEmergency('refuse')}>
                          Refuse
                        </button>
                      </>
                    ) : null}
                    {letter.id === 'parking' ? (
                      <>
                        <button type="button" className="on" onClick={() => game.acceptParking()}>
                          Host parking
                        </button>
                        <button type="button" onClick={() => game.declineParking()}>
                          Wave off
                        </button>
                      </>
                    ) : null}
                    {letter.id === 'field' && game.fieldTask ? (
                      <>
                        {game.fieldAskOffer() ? (
                          <button
                            type="button"
                            className="on"
                            data-testid="field-build"
                            disabled={!game.fieldAskOffer()?.enabled}
                            onClick={() => game.buildFieldTask()}
                          >
                            {game.fieldAskOffer()?.text}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          data-testid="field-got-it"
                          onClick={() => {
                            game.ackLetter(`field:${game.fieldTask?.id ?? ''}`)
                            setOpenLetter(null)
                          }}
                        >
                          Got it
                        </button>
                      </>
                    ) : null}
                    {letter.id === 'cargo-vol' && game.cargoVolume ? (
                      <button
                        type="button"
                        onClick={() => {
                          game.ackLetter(`cargo:${game.cargoVolume?.id ?? ''}`)
                          setOpenLetter(null)
                        }}
                      >
                        Dismiss
                      </button>
                    ) : null}
                    {letter.id === 'warn' ? (
                      <button
                        type="button"
                        onClick={() => {
                          game.ackLetter(warnKey)
                          setOpenLetter(null)
                        }}
                      >
                        Dismiss
                      </button>
                    ) : null}
                    {letter.cardData ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (letter.cardData) game.standingAdvisor.dismissCard(letter.cardData.id)
                          game.emit()
                        }}
                      >
                        Dismiss
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          }
          return (
            <>
              {cards.map(renderLetter)}
              {inbox.length ? (
                <div className="letter-inbox">
                  <button
                    type="button"
                    className="letter-tab"
                    onClick={() => setInboxOpen((v) => !v)}
                  >
                    <span className="letter-kind">Inbox</span>
                    <span className="letter-from">{inbox.length} more</span>
                  </button>
                  {inboxOpen
                    ? inbox.map((letter) => (
                        <button
                          key={letter.id}
                          type="button"
                          className="inbox-row"
                          onClick={() => {
                            setOpenLetter(letter.id)
                            setInboxOpen(false)
                          }}
                        >
                          {letter.kind} · {letter.from}
                          {letter.left != null ? ` · ${letter.left()}s` : ''}
                        </button>
                      ))
                    : null}
                </div>
              ) : null}
            </>
          )
        })()}
      </div>

      <div
        className={`chrome${panel ? ' has-panel' : ''}${chromePinned ? ' pinned' : ''}`}
        onMouseLeave={() => {
          if (!chromePinned) return
          /* Keep pinned while interacting; unpin only via Close / toggle. */
        }}
      >
        {panel ? (
          <div className="panel-rollout" data-panel={panel}>
            <div className="panel-head">
              <h2>{INFO_MENUS.find((m) => m.id === panel)?.label ?? panel}</h2>
              <button
                type="button"
                className="ghost"
                data-testid="panel-close"
                onClick={() => {
                  setPanel(null)
                  setChromePinned(false)
                }}
              >
                Close
              </button>
            </div>
            <div className="panel-body">
              {panel === 'economy' ? (
                <>
                  <p
                    className={`money-summary ${forecast.dailyNet >= 0 ? 'up' : 'down'}`}
                    data-testid="money-summary"
                  >
                    {moneySummaryLine(forecast, money)}
                  </p>
                  <div className="eco-tabs" role="tablist">
                    {ECO_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={ecoTab === tab.id}
                        className={ecoTab === tab.id ? 'on' : ''}
                        onClick={() => setEcoTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {ecoTab === 'income' ? (
                    <section data-testid="eco-income">
                      <h3>Income</h3>
                      <p className="muted eco-line">
                        Recent {money(game.incomeRate())}/hr · pax/day {game.paxPerDay || game.dayPax}{' '}
                        · cargo/day {game.cargoPerDay || game.dayCargo}
                      </p>
                      <p className="muted">
                        Landside fees {money(game.landsideIncome())} this window · fill{' '}
                        {Math.round(game.landsideUsageRate() * 100)}%
                      </p>
                      <ul className="airlines">
                        {game.econHist.length ? (
                          game.econHist
                            .slice(-8)
                            .reverse()
                            .map((p) => (
                              <li key={p.t}>
                                {formatSimDate(p.t)} · {money(p.income)}
                              </li>
                            ))
                        ) : (
                          <li className="muted">Income lines appear after the first hour.</li>
                        )}
                      </ul>
                    </section>
                  ) : null}
                  {ecoTab === 'expenses' ? (
                    <section data-testid="eco-expenses">
                      <h3>Expenses</h3>
                      <p
                        className="muted eco-line"
                        data-testid="budget-payroll"
                        title={payrollPreviewTitle(REAL_SECONDS_PER_GAME_DAY)}
                      >
                        {payrollPreviewLabel(game.payrollPreview(), money)}
                        {game.fieldOpsMult() > 1.05
                          ? ` · field load ×${game.fieldOpsMult().toFixed(2)}`
                          : ''}{' '}
                        · landside {money(game.landsideUpkeep())}/day
                      </p>
                      <p className="muted">
                        {game.loanBalance > 0
                          ? `Open loan ${money(game.loanBalance)} — interest posts on the loan clock.`
                          : 'No loan interest running.'}
                      </p>
                      <ul className="airlines">
                        {game.econHist.length ? (
                          game.econHist
                            .slice(-8)
                            .reverse()
                            .map((p) => (
                              <li key={p.t}>
                                {formatSimDate(p.t)} · {money(p.expense)}
                              </li>
                            ))
                        ) : (
                          <li className="muted">Expense lines appear after the first hour.</li>
                        )}
                      </ul>
                    </section>
                  ) : null}
                  {ecoTab === 'charts' ? (
                    <section data-testid="eco-charts">
                      <h3>Charts</h3>
                      <p className="muted">One point per in-game hour. A day is 180 seconds.</p>
                      <LineChart
                        title="Cash"
                        series={[{ name: 'Cash', color: '#e7c56a', values: game.econHist.map((p) => p.cash) }]}
                        empty="Cash line starts after the first hour."
                      />
                      <LineChart
                        title="Income vs expenses"
                        series={[
                          { name: 'Income', color: '#8ee0a8', values: game.econHist.map((p) => p.income) },
                          { name: 'Expenses', color: '#ff9b8f', values: game.econHist.map((p) => p.expense) },
                        ]}
                      />
                      <LineChart
                        title="Passengers / day"
                        series={[{ name: 'Pax', color: '#6a9ec8', values: game.econHist.map((p) => p.pax) }]}
                      />
                      <LineChart
                        title="Cargo / day"
                        series={[{ name: 'Cargo', color: '#c9a227', values: game.econHist.map((p) => p.cargo) }]}
                      />
                    </section>
                  ) : null}
                  {ecoTab === 'overview' || ecoTab === 'loans' ? (
                  <section>
                    {ecoTab === 'overview' ? (
                    <>
                    <h3>Cash & capital</h3>
                    <p className="muted eco-line" data-testid="economy-cash">
                      Bank <LiveText read={() => money(game.cash)} />
                      {game.sandbox ? ' · sandbox' : ''}
                      {game.loanBalance ? ` · loan owed ${money(game.loanBalance)}` : ''}
                      {' · '}pax fees {money(game.landsideIncome())} / expense{' '}
                      {money(game.landsideUpkeep())}/day · fill{' '}
                      {Math.round(game.landsideUsageRate() * 100)}%
                    </p>
                    {!game.showStarterKit() ? (
                      <p className="muted">Starter kit is down. Build from the bar.</p>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="wide on"
                          data-testid="starter-kit"
                          onClick={() => game.buildStarterKit()}
                        >
                          {starterKitPreview(game.startFocus).label} · {money(STARTER_KIT_COST)}
                        </button>
                        <p className="muted">
                          {starterKitPreview(game.startFocus).summary}{' '}
                          {starterKitPreview(game.startFocus).includes.join(' · ')}
                        </p>
                      </>
                    )}
                    <p className="muted" data-testid="cash-forecast-detail">
                      Live {money(forecast.hourlyIncome)}/hr · daily charges {money(forecast.dailyCharges)} · weekly{' '}
                      {money(forecast.weeklyCharges)} · forecast {flowLabel}
                    </p>
                    <p className="muted">
                      Pax/day {game.paxPerDay || game.dayPax} · cargo/day {game.cargoPerDay || game.dayCargo}
                    </p>
                    </>
                    ) : null}
                    {ecoTab === 'loans' ? (
                    <>
                    <div className="loan-products">
                      <h4 className="loan-h">Bank desk</h4>
                      <p className="muted eco-line">
                        {game.loanBalance > 0
                          ? `Open: ${
                              LOAN_PRODUCTS.find((p) => p.id === game.loanProductId)?.label ??
                              'Loan'
                            } · owe ${money(game.loanBalance)}`
                          : 'No open loan — pick a product (bigger = higher fee, needs Field Level).'}
                      </p>
                      <label className="loan-amount" data-testid="loan-amount">
                        <span>{loanAmountLabel(loanAmount)}</span>
                        <input
                          type="range"
                          min={25_000}
                          max={250_000}
                          step={5_000}
                          value={loanAmount}
                          aria-label="Loan amount"
                          aria-valuetext={money(loanAmount)}
                          onChange={(e) => setLoanAmount(Number(e.target.value))}
                        />
                        <output>{money(loanAmount)}</output>
                      </label>
                      <div className="loan-grid">
                        {loanDeskRows(LOAN_PRODUCTS).map((p) => {
                          const open = game.availableLoans().some((x) => x.id === p.id)
                          const active = game.loanProductId === p.id && game.loanBalance > 0
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={active ? 'on' : ''}
                              disabled={!open || game.loanBalance > 0}
                              title={
                                open
                                  ? `${p.blurb} Fee ${money(p.fee)} · rate ${(p.rate * 100).toFixed(1)}%/tick`
                                  : `Locked — Field Lv${p.minFieldLevel}+ · rep ${p.minRep}+`
                              }
                              onClick={() => game.takeLoanProduct(p.id)}
                            >
                              {loanProductLabel(p)}
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
                          {parcelButtonLabel(game)}
                        </button>
                        <button type="button" onClick={() => game.toggleMaintenanceContract()}>
                          MX contract{' '}
                          {game.maintenanceContract ? 'on' : money(LAND_PLOT.maintenanceContract)}
                        </button>
                        <button type="button" onClick={() => game.investRail()}>
                          City rail {money(RAIL_CITY_COST)}
                        </button>
                      </div>
                    </div>
                    <div className="row">
                      <button type="button" onClick={() => game.buyHotel()}>
                        Hotel{' '}
                        {game.hotelLevel >= 2
                          ? 'max'
                          : money(game.hotelLevel === 0 ? HOTEL_COST : HOTEL_COST_L2)}
                      </button>
                      <button type="button" onClick={() => game.buyCarPark('short')}>
                        Short park {game.carParkShort ? '✓' : money(CARPARK_SHORT_COST)}
                      </button>
                      <button type="button" onClick={() => game.buyCarPark('long')}>
                        Long park {game.carParkLong ? '✓' : money(CARPARK_LONG_COST)}
                      </button>
                    </div>
                    </>
                    ) : null}
                    {ecoTab === 'overview' ? (
                    <p className="muted">
                      parcels {game.parcels}
                      {game.site ? ` · holding ${money(game.dailyHoldingQuote())}/day` : ''}
                      {game.railLinked ? ' · rail' : ''}
                      {game.hotelLevel ? ` · hotel L${game.hotelLevel}` : ''}
                      {game.janitors ? ` · janitors ${game.janitors}` : ''}
                      {' · '}
                      strips {game.runwayStripCount()} · inbound {game.maxInbound()}
                      {' · '}pax ×{game.landsidePaxMult().toFixed(2)}
                      {' · '}
                      {[
                        game.hasHotelBeds() ? 'hotel' : null,
                        game.hasShortParking() ? 'lot-S' : null,
                        game.hasLongParking() ? 'lot-L' : null,
                        game.hasBusCurb() ? 'bus' : null,
                        game.hasRailStation() ? 'rail' : null,
                      ]
                        .filter(Boolean)
                        .join('/') || 'no arrival modes'}
                    </p>
                    ) : null}
                  </section>
                  ) : null}
                  {ecoTab === 'overview' || ecoTab === 'income' ? (
                  <section>
                    <h3>Exchange · HATCH</h3>
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
                  ) : null}
                </>
              ) : null}

              {panel === 'settings' ? <HudSettings game={game} onNewGame={onNewGame} /> : null}

              {panel === 'budget' ? (
                <section data-testid="budget-panel">
                  <h3>Ops budgets</h3>
                  <p
                    className={`money-summary ${forecast.dailyNet >= 0 ? 'up' : 'down'}`}
                    data-testid="budget-money-summary"
                  >
                    {moneySummaryLine(forecast, money)}
                  </p>
                  <p
                    className="muted"
                    data-testid="budget-payroll"
                    title={payrollPreviewTitle(REAL_SECONDS_PER_GAME_DAY)}
                  >
                    {payrollPreviewLabel(game.payrollPreview(), money)}
                    {game.fieldOpsMult() > 1.05
                      ? ` · field load ×${game.fieldOpsMult().toFixed(2)}`
                      : ''}{' '}
                    · crash risk {Math.round(game.crashChance() * 1000) / 10}% · RW{' '}
                    {Math.round(game.runwayCondition)}% · {seasonAtClock(game.clock).name} · {game.weatherLabel()}
                  </p>
                  <div className="row">
                    <button type="button" className="on" onClick={() => game.hireMechanic()}>
                      Hire mechanic · {money(game.staffHireCost(MECHANIC_HIRE))}
                    </button>
                    <button type="button" onClick={() => game.hireJanitor()}>
                      Hire janitor · {money(game.staffHireCost(JANITOR_HIRE))}
                    </button>
                    <button type="button" onClick={() => game.hireResearcher()}>
                      Hire researcher · {money(game.staffHireCost(RESEARCHER_HIRE))}
                    </button>
                    <button type="button" onClick={() => game.hireDeskStaff()}>
                      Hire desk agent · {money(game.staffHireCost(DESK_STAFF_HIRE))}
                    </button>
                    <button type="button" onClick={() => game.fireMechanic()}>
                      Lay off
                    </button>
                  </div>
                  <p className="muted">
                    {game.mechanics} mechanics · {game.researchers} researchers ·{' '}
                    {game.deskStaff} desk
                    {game.staffedPost('checkin') ? ' · check-in' : ''}
                    {game.staffedPost('security') ? ' · security' : ''}
                    {game.staffedPost('gate') ? ' · gate' : ''}
                    {game.mxSigned.length
                      ? ` · MX: ${game.mxSigned.map((id) => game.airline(id).name).join(', ')}`
                      : ' · no airline MX yet (need hangar + mechanic)'}
                  </p>
                  {game.milAgreement ? (
                    <p className="muted">
                      Guard host active — {game.milRampLine()}
                      {game.hasResearch('mil_ramp') ? ' · C-5M eligible' : ''}
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="wide"
                        onClick={() => game.signMilitaryAgreement()}
                      >
                        Host military / Guard · {money(MIL_AGREE_COST)}
                      </button>
                      <p className="muted">{game.canHostMilitary().why}</p>
                      <p className="muted">{game.milRampLine()}</p>
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
                            aria-label={`${BUDGET_LABEL[key]} budget`}
                            aria-valuetext={`${game.budgets[key]} percent`}
                            onChange={(e) => game.setBudget(key, Number(e.target.value))}
                          />
                          <output data-testid={`budget-${key}`}>{game.budgets[key]}%</output>
                        </label>
                        <small>{BUDGET_BLURB[key]}</small>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {panel === 'research' ? (
                <section>
                  <h3>Research desk</h3>
                  <p className="muted">
                    {Math.floor(game.researchPoints)} RP · turnarounds + lab drip ~
                    {game.researchRate().toFixed(2)}/s
                    {(() => {
                      const g = game.labGear()
                      return ` · gear D${g.desks}/B${g.boards}/M${g.machines}`
                    })()}
                    {game.researchers
                      ? (() => {
                          const c = game.labCrewStatus()
                          return ` · ${c.working} working / ${c.break} break / ${c.home} home`
                        })()
                      : game.opsResearchRate() > 0
                        ? ' · operations trickle is running — a lab crew speeds it up'
                        : ' · stamp a strip and a stand to start the operations trickle'}
                    {game.researchUnlocked.length
                      ? ` · unlocked ${game.researchUnlocked.length}/${RESEARCH_NODES.length}`
                      : ' · no unlocks yet'}
                    {game.isNight() ? ' · night lab slow + more off-shift' : ''}
                  </p>
                  <ul className="airlines">
                    {RESEARCH_NODES.map((n) => {
                      const owned = game.hasResearch(n.id)
                      const gate = game.canBuyResearch(n.id)
                      return (
                        <li key={n.id}>
                          <b>
                            {n.name}{' '}
                            <span className="muted">
                              {owned ? '· live' : `· ${n.cost} RP`}
                            </span>
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
              ) : null}

              {panel === 'specialize' ? <SpecTree game={game} /> : null}

              {panel === 'rival' ? (
                rival ? (
                  <RivalPanel model={rival} onCourt={(id) => game.courtRivalCarrier(id)} />
                ) : (
                  <section data-testid="rival-panel">
                    <h3>Bellwater Intl</h3>
                    <p className="muted">Buy a plot and Bellwater starts sharing the catchment.</p>
                  </section>
                )
              ) : null}

              {panel === 'airlines' ? (
                <>
                <AirlinesDesk game={game} />
                <section className="inbound-contracts" data-testid="contracts-panel">
                  <h3>Contracts</h3>
                  <p className="muted eco-line">
                    Guard {game.milAgreement ? 'agreement signed' : 'agreement is on the Budget panel'}
                    {' · '}
                    clearance {game.inboundHasClearance() ? 'held' : money(CLEARANCE_LICENCE_COST)}
                  </p>
                  <button
                    type="button"
                    data-testid="buy-clearance"
                    disabled={game.inboundHasClearance() || (!game.sandbox && game.cash < CLEARANCE_LICENCE_COST)}
                    onClick={() => game.buyInboundClearance()}
                  >
                    {game.inboundHasClearance()
                      ? 'Security clearance · Owned'
                      : `Buy security clearance · ${money(CLEARANCE_LICENCE_COST)}`}
                  </button>
                  {game.inboundContracts().length === 0 ? (
                    <p className="muted">No Guard contracts yet. A signed agreement brings the first offer.</p>
                  ) : (
                    <ul className="airlines">
                      {game.inboundContracts().map((deal) => (
                        <li key={deal.id}>
                          <b>
                            {deal.name}{' '}
                            <span className="muted">
                              {deal.status} · {deal.daySorties} day / {deal.nightSorties} night
                            </span>
                          </b>
                          <span className="muted">
                            Night circuit {deal.noisePerNight} noise · {deal.approvalPerNight} approval
                          </span>
                          <div className="row">
                            {deal.status === 'offered' ? (
                              <button type="button" className="on" onClick={() => game.signInboundContract(deal.id)}>
                                Sign
                              </button>
                            ) : null}
                            {deal.status === 'active' || deal.status === 'expiring' ? (
                              <button type="button" onClick={() => game.cancelInboundContract(deal.id)}>
                                Cancel early
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="airline-tiers">
                  <h3>Airline tiers</h3>
                  {(() => {
                    const prog = game.fieldXpToNext()
                    return (
                      <p className="muted eco-line">
                        Field {prog.label}
                        {prog.pct < 1
                          ? ` · ${prog.xp}/${prog.need} XP (${Math.round(prog.pct * 100)}% to ${prog.nextLabel})`
                          : ` · ${prog.xp} XP · max`}
                        {' · '}
                        Signed:{' '}
                        {game.signed.length
                          ? game.signed.map((id) => game.airline(id).name).join(', ')
                          : 'none'}
                        {ready.tower
                          ? ` · tower ${game.maxInbound()} inbound`
                          : ' · no tower'}
                      </p>
                    )
                  })()}
                  <p className="muted">
                    Letters slide in from the left. Standing{' '}
                    {HEAT_REWARD_THRESHOLD}+ unlocks persona perks · warn ≤
                    {HEAT_WARN_THRESHOLD} · abandon ≤{HEAT_ABANDON_THRESHOLD}.
                    Cross-cut: Charter / LCC / Full-service / Cargo.
                  </p>
                  <p className="muted" data-testid="spec-paths">
                    Specs {game.specPointsLeft()} path point{game.specPointsLeft() === 1 ? '' : 's'}{' '}
                    left · {game.treePointsLeft()} tree point{game.treePointsLeft() === 1 ? '' : 's'}{' '}
                    left
                    {game.specPaths.length
                      ? ` · ${game.specPaths
                          .map((id) => SPEC_PATHS.find((p) => p.id === id)?.label ?? id)
                          .join(', ')}`
                      : ''}
                    . Open Specs for the trees. Paths mix: capstone +50% and site upkeep +10% after
                    the first.
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
                      <div
                        key={tier}
                        className={`tier-block${unlocked ? '' : ' locked'}`}
                      >
                        <header className="tier-head">
                          <strong>
                            {meta.short} · {meta.label}
                          </strong>
                          <span className="muted">
                            {unlocked
                              ? 'Unlocked'
                              : `Needs Field Lv${Math.max(1, tier - 1)}`}
                          </span>
                        </header>
                        <p className="muted tier-blurb">
                          {meta.blurb} · {meta.fleet}
                        </p>
                        <ul className="airlines">
                          {carriers.map((a) => {
                            const signed = game.signed.includes(a.id)
                            const ok = game.meetsReq(a.id)
                            const miss = game.missingReq(a.id)
                            const banned = game.isBanned(a.id)
                            const standing = Math.round(game.standingOf(a.id))
                            const reward = game.rewardOf(a.id)
                            const warned = Boolean(game.airlineWarned[a.id])
                            const hub = game.isHub(a.id)
                            const targetPerk = rewardForPersona(a.persona)
                            return (
                              <li key={a.id}>
                                <b style={{ color: a.color }}>
                                  {a.name}{' '}
                                  <span className="muted">
                                    {bizModelBlurb(a.bizModel)} · {personaBlurb(a.persona)}
                                    {a.procedural ? ' · proc' : ''}
                                    {hub ? ' · HUB' : ''}
                                  </span>{' '}
                                  {banned
                                    ? `· BAN ${Math.ceil(game.banRemaining(a.id))}s`
                                    : signed
                                      ? `· Standing ${standing}${warned ? ' · WARN' : ''}${
                                          reward ? ` · ${rewardBlurb(reward)}` : ''
                                        }`
                                      : !unlocked
                                        ? '· locked tier'
                                        : ok
                                          ? '· ready to call'
                                          : '· missing infra'}
                                </b>
                                <span className="muted">
                                  {a.fleetBlurb}
                                  {' · '}
                                  {banned
                                    ? 'Suspended after a bad layover / hall'
                                    : signed
                                      ? reward
                                        ? rewardDetail(reward)
                                        : warned
                                          ? `Cooling — walk at ${HEAT_ABANDON_THRESHOLD}.`
                                          : `Chase ${rewardBlurb(targetPerk)} at Standing ${HEAT_REWARD_THRESHOLD}+.`
                                      : !unlocked
                                        ? meta.scope
                                        : miss.slice(0, 4).join(', ') || a.blurb}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </section>
                </>
              ) : null}

              {panel === 'planner' ? (
                <>
                  <section>
                    <h3>Selected flight</h3>
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
                          {flight.pax > 0
                            ? ` · ${flight.pax} pax`
                            : flight.cargo
                              ? ' · freight'
                              : ''}
                          {(flight.craft ?? 'jet') === 'jet'
                            ? ` · ${game.gateLabel(flight.stand)}`
                            : ' · helipad'}
                          {flight.ga && flight.phase === 'parked'
                            ? flight.parkLeaveRequestedAt && flight.parkLeaveBy
                              ? ` · LEAVE WINDOW ${Math.max(0, Math.round(flight.parkLeaveBy - game.clock))}s`
                              : ` · parked ${Math.round(flight.phaseTime)}s / ask ~${flight.parkStaySec ?? '?'}s`
                            : ''}
                        </p>
                        {flight.ga && flight.phase === 'parked' ? (
                          <button
                            type="button"
                            className="wide"
                            onClick={() => game.releaseGa(flight.id)}
                          >
                            {flight.parkLeaveRequestedAt
                              ? 'Release (manual departure)'
                              : 'Release early'}
                          </button>
                        ) : null}
                        <p className="muted">
                          Needs{' '}
                          {flight.craft === 'helo'
                            ? 'helipad'
                            : `${AIRFRAMES[flight.airframeId]?.minRunway ?? '?'}c strip`}
                          {' · '}
                          size ×{(AIRFRAMES[flight.airframeId]?.scale ?? 1).toFixed(2)} · field{' '}
                          {game.stripCapabilityLine()}
                          {flight.waitingOn.deice
                            ? ' · waiting de-ice'
                            : flight.posted.deiced
                              ? ' · de-iced'
                              : ''}
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
                        No flights until an airline signs. Meet their checklist, then answer the
                        phone.
                      </p>
                    )}
                  </section>
                  <section>
                    <h3>Flight planner</h3>
                    <p className="muted">
                      {game.scheduleAuto ? 'Auto bank on' : 'Manual bank'} ·{' '}
                      {game.openSchedule().length}/{game.scheduleCap()} open ·{' '}
                      {game.runwayStripCount()} strip
                      {game.runwayStripCount() === 1 ? '' : 's'} · inbound {game.maxInbound()}
                      {game.weather === 'storm'
                        ? ' · storm delays'
                        : game.weather === 'fog'
                          ? ' · fog slips'
                          : ''}
                      {game.stolenHosts().length
                        ? ` · ${game.stolenHosts().length} emergency host stealing gate`
                        : ''}
                      {' · '}
                      stamp more strips for more banks — cycle RW on each slot
                    </p>
                    {game.runwayStripCount() >= 1 ? (
                      <div className="row">
                        <button
                          type="button"
                          className={game.plannerRwFilter == null ? 'on' : ''}
                          onClick={() => game.setPlannerRwFilter(null)}
                        >
                          All banks
                        </button>
                        {Array.from({ length: game.runwayStripCount() }, (_, i) => (
                          <button
                            key={i}
                            type="button"
                            className={game.plannerRwFilter === i ? 'on' : ''}
                            onClick={() => game.setPlannerRwFilter(i)}
                          >
                            RW{i + 1} ({game.scheduleForRunway(i).length})
                          </button>
                        ))}
                        <button
                          type="button"
                          className={game.plannerRwFilter === -1 ? 'on' : ''}
                          onClick={() => game.setPlannerRwFilter(-1)}
                        >
                          Auto
                        </button>
                      </div>
                    ) : null}
                    {(() => {
                      const strip = game.plannerStrip(120)
                      const night = game.plannerNightBand(120)
                      const nightUnlocked = game.hasResearch('night_bank')
                      return (
                        <div
                          className="day-strip"
                          title="Next 120s — click a bar to select that slot for drag / stand pin"
                        >
                          <div className="day-strip-rail">
                            <span className="day-strip-now">now</span>
                            <span className="day-strip-end">+2m</span>
                            {night ? (
                              <span
                                className={`day-strip-night${nightUnlocked ? '' : ' locked'}`}
                                style={{
                                  left: `${(night.from / strip.horizon) * 100}%`,
                                  width: `${Math.max(2, ((night.to - night.from) / strip.horizon) * 100)}%`,
                                }}
                                title={
                                  nightUnlocked
                                    ? 'Night bank open'
                                    : 'Night column — research Night bank to clear curfew'
                                }
                              />
                            ) : null}
                            {strip.hosts.map((h, i) => (
                              <span
                                key={h.id}
                                className="day-strip-slot stolen host"
                                style={{ left: `${4 + i * 8}%` }}
                                title={`${h.flightNo} · ${h.kind} host on ${h.stand} — steals bank capacity`}
                              >
                                {h.kind === 'divert' ? 'DIV' : 'TNK'}
                              </span>
                            ))}
                            {strip.slots.map((s) => {
                              const left = Math.min(96, (s.t / strip.horizon) * 100)
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  className={`day-strip-slot${s.status === 'delayed' ? ' delayed' : ''}${s.stolen ? ' stolen' : ''}${selSlot === s.id ? ' selected' : ''}`}
                                  style={{
                                    left: `${left}%`,
                                    background: s.stolen
                                      ? '#c45a2a'
                                      : game.airline(s.airline).color,
                                  }}
                                  title={
                                    s.stolen
                                      ? `${s.flightNo} · slipped — emergency stole a gate · ${s.stand}`
                                      : `${s.flightNo} · ${Math.round(s.t)}s · ${s.stand} · ${s.runway}`
                                  }
                                  onClick={() => setSelSlot(s.id)}
                                >
                                  {s.flightNo.slice(-3)}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                    {selSlot ? (
                      <div className="planner-drag">
                        <p className="muted">
                          Selected{' '}
                          {game.schedule.find((s) => s.id === selSlot)?.flightNo ?? 'slot'} — drag
                          ETA / pin stand
                        </p>
                        <div className="row">
                          <button type="button" onClick={() => game.nudgeSlotEta(selSlot, -10)}>
                            ETA −10
                          </button>
                          <button type="button" onClick={() => game.nudgeSlotEta(selSlot, 10)}>
                            ETA +10
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              game.setSlotStandPref(selSlot, null)
                            }}
                          >
                            Auto stand
                          </button>
                        </div>
                        <div className="row">
                          {tilesOf(game.tiles, 'stand').map((st) => (
                            <button
                              key={`${st.c},${st.r}`}
                              type="button"
                              title={`Pin ${game.gateLabel(st)}`}
                              onClick={() => game.setSlotStandPref(selSlot, st)}
                            >
                              {game.gateLabel(st)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
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
                    </div>
                    <div className="row">
                      {game.signed.slice(0, 3).map((id) => (
                        <button key={id} type="button" onClick={() => game.addManualSlot(id, 18)}>
                          +{game.airline(id).name.slice(0, 6)}
                        </button>
                      ))}
                    </div>
                    <ul className="airlines">
                      {game.scheduleForRunway(game.plannerRwFilter).slice(0, 8).length === 0 ? (
                        <li>
                          <span className="muted">No slots — sign an airline or add manual.</span>
                        </li>
                      ) : (
                        game.scheduleForRunway(game.plannerRwFilter).slice(0, 8).map((s) => {
                          const eta = Math.max(0, Math.round(s.eta - game.clock))
                          const stand = s.standPref ? game.gateLabel(s.standPref) : 'auto'
                          const rw = game.runwayLabel(s.runwayPref)
                          return (
                            <li key={s.id}>
                              <b style={{ color: game.airline(s.airline).color }}>
                                {s.flightNo}{' '}
                                <span className="muted">
                                  {s.status}
                                  {s.delaySec > 0 ? ` +${Math.round(s.delaySec)}s` : ''}
                                  {s.manual ? ' · manual' : ''}
                                  {' · '}
                                  {rw}/{stand}
                                </span>
                              </b>
                              <span className="muted">
                                {game.airline(s.airline).name} · ETA {eta}s
                                {s.claimLane ? ` · claim ${s.claimLane}` : ''}
                                {s.delayReason ? ` · ${s.delayReason}` : ''}
                              </span>
                              {s.status !== 'inbound' ? (
                                <span className="row" style={{ marginTop: 4 }}>
                                  <button type="button" onClick={() => game.pullSlot(s.id)}>
                                    Pull
                                  </button>
                                  <button type="button" onClick={() => game.bumpSlot(s.id)}>
                                    Bump
                                  </button>
                                  <button type="button" onClick={() => game.cycleSlotStand(s.id)}>
                                    Stand
                                  </button>
                                  {game.runwayStripCount() >= 1 ? (
                                    <button
                                      type="button"
                                      onClick={() => game.cycleSlotRunway(s.id)}
                                    >
                                      RW
                                    </button>
                                  ) : null}
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
                </>
              ) : null}

              {panel === 'premium' ? <PremiumPanel game={game} /> : null}
              {panel === 'tycoon' ? (
                <TycoonPanel
                  view={game.tycoonView()}
                  cash={game.cash}
                  tab={tycoonTab === 'year' && !game.pendingYearReport() ? 'shops' : tycoonTab}
                  formatMoney={money}
                  onTab={setTycoonTab}
                  onAccept={(unitId, bidId) => game.acceptTenantBid(unitId, bidId)}
                  onReroll={(unitId) => game.rerollTenantBids(unitId)}
                  onCampaign={(kind) => game.startAdCampaign(kind)}
                  onDismissReport={() => {
                    game.dismissYearReport()
                    setTycoonTab('shops')
                  }}
                />
              ) : null}
              {panel === 'staff' ? <StaffHousingPanel game={game} /> : null}

              {panel === 'services' ? (
                <>
                  <section>
                    <h3>Fuel desk</h3>
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
                    <p className="muted">
                      Tank {game.tankTier} · {Math.round(game.tankLitres).toLocaleString('en-US')} /{' '}
                      {tankDef(game.tankTier).capacityLitres.toLocaleString('en-US')} L · {game.fuelSupply}
                      {game.contractId ? ` · ${FUEL_CONTRACTS.find((c) => c.id === game.contractId)?.name}` : ''}
                    </p>
                    <div className="row">
                      {FUEL_CONTRACTS.map((c) => {
                        const gate = canSignContract(c.id, game.fieldLevel(), game.researchUnlocked)
                        return (
                          <button key={c.id} type="button" disabled={!gate.ok} onClick={() => game.signScaleContract(c.id)}>
                            {c.name} {money(c.sign)}
                          </button>
                        )
                      })}
                    </div>
                    <div className="row">
                      <button type="button" onClick={() => game.setFuelSupply('road')}>
                        Road tankers
                      </button>
                      <button type="button" onClick={() => game.setFuelSupply('rail')}>
                        Rail
                      </button>
                      <button
                        type="button"
                        onClick={() => game.upgradeTank()}
                        disabled={!canUpgradeTank(game.tankTier, game.fieldLevel(), game.researchUnlocked).ok}
                      >
                        Tank {TANK_TIERS[Math.min(2, game.tankTier)] ? `→ ${tankDef(game.tankTier === 3 ? 3 : ((game.tankTier + 1) as 2 | 3)).capacityLitres.toLocaleString('en-US')} L` : ''}
                      </button>
                    </div>
                    <p className="muted">
                      {powerPlantOffer(game.powerPlantTier).name} · capacity{' '}
                      {Math.round(power.capacity).toLocaleString('en-US')} · demand{' '}
                      {Math.round(power.demand).toLocaleString('en-US')}
                      {power.brownout ? ' · brown-out' : ''}
                    </p>
                    <button
                      type="button"
                      data-testid="upgrade-power"
                      disabled={!powerGate.ok}
                      onClick={() => game.upgradePowerPlant()}
                    >
                      {powerGate.next
                        ? `Build ${powerPlantOffer(powerGate.next).name} ${money(powerGate.cost)}`
                        : 'Power plant III'}
                    </button>
                    <p className="muted">
                      Bags: {BAG_SYSTEMS[game.bagSystem].name}. Check-in desks {game.paxDesks}, kiosks {game.paxKiosks}, bag drop {game.paxBagDrops}, scanners {game.scannerLanes}, e-gates {game.eGates}.
                    </p>
                    <div className="row">
                      <button
                        type="button"
                        disabled={!canUpgradeBags(game.bagSystem, game.fieldLevel(), game.researchUnlocked).ok}
                        onClick={() => game.upgradeBagSystem()}
                      >
                        Upgrade bags
                      </button>
                      {(Object.keys(PAX_UNITS) as (keyof typeof PAX_UNITS)[]).map((id) => {
                        const gate = canBuyPax(id, game.fieldLevel(), game.researchUnlocked)
                        return (
                          <button key={id} type="button" disabled={!gate.ok} onClick={() => game.buyPaxUnit(id)}>
                            {PAX_UNITS[id].name} {money(PAX_UNITS[id].cost)}
                          </button>
                        )
                      })}
                    </div>
                    <div className="row">
                      {VEHICLE_OFFERS.map((offer) => {
                        const gate = canBuyVehicle(offer.type, game.fieldLevel(), game.researchUnlocked)
                        const owned = game.scaleFleet[offer.type] ?? 0
                        return (
                          <button key={offer.type} type="button" disabled={!gate.ok} onClick={() => game.buyScaleVehicle(offer.type)}>
                            {offer.role} {owned > 0 ? `×${owned} ` : ''}
                            {money(gate.cost)}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                  <section>
                    <h3>Catering desk</h3>
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
                    <h3>Hall furnish</h3>
                    {origin ? (
                      <>
                        <p className="muted">
                          Wear WC {Math.round(fit?.wearBath ?? 0)} · Sec{' '}
                          {Math.round(fit?.wearSec ?? 0)}
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
                        Stamp a Premade hall or an empty Shell, then select it to furnish. Weak
                        security = threats. Budget crowds wear WC and lanes — scrub or the street
                        writes exposés.
                      </p>
                    )}
                  </section>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={`dock${inHall ? ' dock-slim' : ''}`}>
          {inHall ? null : (
          <div className="dock-extend">
            {game.view === 'hall' ? (
              <div className="tools">
                <button type="button" className="on" onClick={() => game.exitHall()}>
                  ← Apron outside
                </button>
                <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>
                  Furnish rooms in Services · doors → check-in → security → gates
                </span>
              </div>
            ) : (
              <>
                <div className="build-menus">
                  {game.showStarterKit() ? (
                    <>
                      <button
                        type="button"
                        className={`on${game.showCoach() ? ' dock-kit-target' : ''}`}
                        data-testid="starter-kit-dock"
                        title={starterKitPreview(game.startFocus).summary}
                        onClick={() => game.buildStarterKit()}
                      >
                        {starterKitPreview(game.startFocus).label} · {money(STARTER_KIT_COST)}
                      </button>
                      {game.starterKitProtected() ? (
                        <button
                          type="button"
                          data-testid="build-freehand-dock"
                          title="Release the kit budget and build the strip yourself"
                          onClick={() => game.chooseFreehand()}
                        >
                          Build freehand
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  <button
                    type="button"
                    className={game.tool === 'pan' ? 'on' : ''}
                    title="Select / inspect — WASD pans, Q/E rotate, scroll zooms"
                    onClick={() => game.setTool('pan')}
                  >
                    Select
                  </button>
                  {BUILD_MENUS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={buildMenu === m.id ? 'on' : ''}
                      onClick={() => {
                        setBuildMenu((cur) => (cur === m.id ? null : m.id))
                        setPanel(null)
                        setChromePinned(false)
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => game.rotatePiece()}>
                    Rotate {game.facing === 'h' ? 'H' : 'V'}
                  </button>
                  {buildMenu === 'landside' ? (
                    <>
                      <button
                        type="button"
                        className={game.parkTerm === 'short' ? 'on' : ''}
                        onClick={() => game.setParkTerm('short')}
                      >
                        {parkTermLabel('short')}
                      </button>
                      <button
                        type="button"
                        className={game.parkTerm === 'long' ? 'on' : ''}
                        onClick={() => game.setParkTerm('long')}
                      >
                        {parkTermLabel('long')}
                      </button>
                    </>
                  ) : null}
                  {buildMenu === 'stands' ? (
                    <>
                      <button
                        type="button"
                        className={game.standAccessMode === 'remote' ? 'on' : ''}
                        onClick={() => game.setStandAccessMode('remote')}
                        title="Cheaper bay — terminal bus or walking pax"
                      >
                        {standAccessLabel('remote')}
                      </button>
                      <button
                        type="button"
                        className={game.standAccessMode === 'jetway' ? 'on' : ''}
                        onClick={() => game.setStandAccessMode('jetway')}
                        title={`Pre-attached gate · ×${STAND_JETWAY_MULT} cost · fast board, no apron walk`}
                      >
                        {standAccessLabel('jetway')} · ×{STAND_JETWAY_MULT}
                      </button>
                    </>
                  ) : null}
                </div>
                {buildMenu ? (
                <div className="tools build-tray" data-testid="build-tray">
                  {menuTools.map((t) => {
                    const lateId = lateIdForTool(t)
                    if (lateId) {
                      const spec = buildingById(lateId)
                      const locked = Boolean(spec && game.lateFieldLevel() < spec.fieldLevel)
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`tray-item${game.tool === t ? ' on' : ''}${locked ? ' is-locked' : ''}`}
                          data-testid={`late-stamp-${lateId}`}
                          onClick={() => {
                            game.toggleInfo(`late:${lateId}`)
                            if (!locked) game.setTool(t)
                          }}
                        >
                          <TrayMark tool={t} />
                          <span className="tray-name">{lateStampLabel(lateId)}</span>
                        </button>
                      )
                    }
                    const def = BUILDINGS.find((b) => b.tool === t)
                    const cost = toolCost(t)
                    const name = def?.name ?? TOOL_LABEL[t]
                    const need = unlockLevel(t)
                    const locked = t !== 'clear' && game.fieldLevel() < need
                    const upkeep = def?.upkeepPerDay ?? 0
                    const tip =
                      t === 'clear'
                        ? 'Bulldoze — refunds 40% of the stamp.'
                        : locked
                          ? lockTip(name, need, def?.blurb)
                          : (def?.blurb ?? TOOL_LABEL[t])
                    const priceTip = locked
                      ? tip
                      : cost != null
                        ? `${tip} ${money(cost)}${upkeep > 0 ? ` · $${upkeep}/day` : ''}`
                        : tip
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`tray-item${game.tool === t ? ' on' : ''}${locked ? ' locked' : ''}`}
                        onClick={() => game.setTool(t)}
                        title={priceTip}
                        data-testid={`tray-${t}`}
                      >
                        <TrayMark tool={t} />
                        <span className="tray-name">{name}</span>
                        <span className="tray-price">
                          {locked ? `FL${need}` : cost != null ? money(cost) : 'Refund'}
                        </span>
                        {upkeep > 0 ? <span className="tray-upkeep">${upkeep}/day</span> : null}
                      </button>
                    )
                  })}
                  {PROGRESSION_BUILDABLES.filter((row) => row.menu === buildMenu).map((row) => {
                    const need = unlockLevel(row.id)
                    const locked = game.fieldLevel() < need
                    const cost = capstoneCost(row.cost, game.specPaths, row.id)
                    const tip = locked
                      ? lockTip(row.name, need, row.blurb)
                      : `${row.blurb}${row.cost > 0 ? ` ${money(cost)}` : ''}${
                          row.upkeepPerDay > 0 ? ` · $${row.upkeepPerDay}/day` : ''
                        }`
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className={`tray-item${locked ? ' locked' : ''}${
                          game.progressionBuilt.includes(row.id) ? ' on' : ''
                        }`}
                        title={tip}
                        data-testid={`tray-${row.id}`}
                        onClick={() => game.commission(row.id)}
                      >
                        <TrayMark tool={row.id} />
                        <span className="tray-name">{row.name}</span>
                        <span className="tray-price">
                          {locked ? `FL${need}` : row.cost > 0 ? money(cost) : 'Select'}
                        </span>
                        {row.upkeepPerDay > 0 ? (
                          <span className="tray-upkeep">${row.upkeepPerDay}/day</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
                ) : null}
              </>
            )}
            <p className="hint">
              {game.view === 'hall'
                ? 'Terminal: doors → check-in → security → gate. Esc / H returns — the airport keeps running.'
                : game.tool === 'runway_short'
                  ? `Short strip 10×2 (${money(SHORT_RUNWAY_COST)}) — ATR / CRJ / E175 / Citation / F-15.`
                  : game.tool === 'runway'
                    ? `Regional strip 14×2 (${money(RUNWAY_PREFAB_COST)}) — A320 / 737 / A321 / 757F.`
                    : game.tool === 'runway_heavy'
                      ? `Heavy strip 20×3 (${money(HEAVY_RUNWAY_COST)}) — 787 / A350 / 747-8F / C-17.`
                      : game.tool === 'premade'
                        ? `One-click working terminal (${money(PREMADE_TERMINAL_COST)}) — pan-click it to walk inside.`
                        : game.tool === 'pan'
                          ? 'Select: click a tile or hall. WASD/arrows pan · Q/E rotate · scroll zoom · middle/right orbit.'
                          : lateIdForTool(game.tool)
                            ? 'Click the stamp to read cost, upkeep, and the field-level gate.'
                            : tip
                            ? `${tip.blurb} ${money(tip.cost)}${
                                tip.upkeepPerDay ? ` · $${tip.upkeepPerDay}/day` : ''
                              }`
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
              {game.apronJamLine() ? ` · ${game.apronJamLine()}` : ''}
              {tilesOf(game.tiles, 'cargo').length
                ? ` · warehouse ${Math.round(game.cargoWarehouseFill() * 100)}% (${game.cargoWarehouse}u)`
                : ''}
              {game.cargoVolume
                ? ` · volume ${game.cargoVolume.delivered}/${game.cargoVolume.targetUnits}u`
                : ''}
            </p>
          </div>
          )}

          <div className="bottom-bar">
            <div className="bar-cluster view-cluster">
              <ViewModeToggle game={game} />
              {game.fits.length > 1
                ? game.fits.map((f) => {
                    const active =
                      game.activeHall()?.origin.c === f.origin.c &&
                      game.activeHall()?.origin.r === f.origin.r
                    return (
                      <button
                        key={`${f.origin.c},${f.origin.r}`}
                        type="button"
                        className={active && game.view === 'hall' ? 'on' : ''}
                        title={`${game.hallLabel(f)} · ${game.standsForHall(f).length} jetway stands`}
                        onClick={() => game.selectHall(f)}
                      >
                        {game.hallLabel(f)}
                      </button>
                    )
                  })
                : null}
            </div>

            {inHall ? null : (
            <>
            <SpeedButtons game={game} speed={game.speed} className="bar-cluster speed-cluster" />

            <div className="ticker" title="Recent announcements">
              {ticker.length === 0 ? (
                <span className="muted">No announcements yet — keep the field moving.</span>
              ) : (
                <ul>
                  {ticker.map((n) => (
                    <li key={n.id} data-tone={n.tone}>
                      {n.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bar-cluster info-menus">
              <button
                type="button"
                className={`cash-chip${panel === 'economy' ? ' on' : ''}`}
                title="Economy"
                onClick={() => openPanel('economy')}
              >
                <LiveText read={() => money(game.cash)} />
              </button>
              {INFO_MENUS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={panel === m.id ? 'on' : ''}
                  title={m.tip}
                  data-testid={`tab-${m.id}`}
                  onClick={() => {
                    /* Second click on the same tab closes; switching tabs always opens. */
                    if (panel === m.id) togglePanel(m.id)
                    else openPanel(m.id)
                  }}
                >
                  {m.label}
                  {m.id === 'tycoon' && game.pendingYearReport() ? ' •' : ''}
                </button>
              ))}
            </div>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Speed cluster stays mounted when the rest of the HUD refreshes. */
const SpeedButtons = memo(function SpeedButtons({
  game,
  speed,
  className,
}: {
  game: Game
  speed: Speed
  className: string
}) {
  return (
    <div className={className} aria-label="Speed">
      {([0, 1, 3, 5] as Speed[]).map((s) => (
        <button
          key={s}
          type="button"
          className={speed === s ? 'on' : ''}
          title={
            s === 5 ? '5x fast-forward — hover inspect off' : s === 0 ? 'Pause' : `${s}x speed`
          }
          onClick={() => game.setSpeed(s)}
        >
          {s === 0 ? 'Pause' : `${s}x`}
        </button>
      ))}
    </div>
  )
})

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
    parked: 'Parked (GA)',
    taxi_out: 'Taxi out',
    takeoff: 'Takeoff',
    gone: 'Airborne',
  }
  return map[phase] ?? phase
}

function HudSettings({ game, onNewGame }: { game: Game; onNewGame?: () => void }) {
  const [tab, setTab] = useState<'game' | 'controls'>('game')
  return (
    <section data-testid="settings-panel">
      <div className="settings-tabs">
        <button
          type="button"
          className={tab === 'game' ? 'on' : ''}
          data-testid="hud-settings-tab-game"
          onClick={() => setTab('game')}
        >
          Game
        </button>
        <button
          type="button"
          className={tab === 'controls' ? 'on' : ''}
          data-testid="hud-settings-tab-controls"
          onClick={() => setTab('controls')}
        >
          Controls
        </button>
      </div>
      {tab === 'game' ? <GameSettings game={game} onNewGame={onNewGame} /> : <ControlsPanel />}
    </section>
  )
}
