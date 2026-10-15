import { memo, useEffect, useRef, useState } from 'react'
import { moneySummaryLine, projectCash } from './cashForecast'
import { useHudBandVar } from './hudBand'
import { LiveText } from './LiveText'
import { ViewModeToggle } from './ViewModeToggle'
import { PremiumPanel } from './PremiumPanel.tsx'
import { OpsWalletPanel } from './OpsWalletPanel.tsx'
import { GameTimetable } from './timetable/GameTimetable'
import { manualSlotLabel } from './timetable/manualSlot'
import { setSchedulePlanner } from './timetable/scheduleSheet'
import { AirlineMark } from './AirlineMark'
import { AirlinesDesk } from './AirlinesDesk'
import { AirlinesHub } from './hub/AirlinesHub.tsx'
import { HubAssign, HubProgress } from './hub/HubPanels.tsx'
import { openHubProfile } from './hub/session.ts'
import { AssignPanel } from './hub/AssignPanel.tsx'
import { HUB_TIER_LABEL } from '../hubprogress/config.ts'
import { DiplomacyLetters } from './DiplomacyLetters'
import { Phone } from './phone/Phone.tsx'
import { AlertStackView } from './isolated/AlertStack.tsx'
import { BuildTray } from './nav/BuildTray.tsx'
import { FieldBadge, LevelUpCard } from './nav/FieldBadge.tsx'
import { StatusChip } from './StatusChip.tsx'
import { ApronFlightCard, FlightCard } from './inspector/FlightCard.tsx'
import { dockHasRows, runStatusChipAction, statusChipFromGame, statusChipOpensPhone } from './statusChip.ts'
import { FieldLevelsPanel } from './nav/FieldLevelsPanel.tsx'
import { ScenarioPanel } from './nav/ScenarioPanel.tsx'
import type { UnlockLink } from './nav/stampFacts.ts'
import { useDesktop } from './phone/useDesktop.ts'
import { letterOnStack } from '../phone/logic.ts'
import { loanAmountLabel, loanDeskRows, loanDrawLabel, loanFeeForAmount, loanProductLabel, payrollPreviewLabel } from '../game/economy.ts'
import { financeBreakdown } from '../game/financeBreakdown.ts'
import { AIRFRAMES } from '../game/airframes'
import type { StandingAdvisorCard } from '../game/standingAdvisor.ts'
import { canUpgradePower, powerPlantOffer } from '../economy/powerPlant'
import { SPOT_OFFER, termBandLitres } from '../fuel/offerData'
import { siteHasWater } from '../fuel/barge'
import { BAG_SYSTEMS, FUEL_CONTRACTS, PAX_UNITS, TANK_TIERS, VEHICLE_OFFERS } from '../scale/data'
import { canBuyPax, canBuyVehicle, canSignContract, canUpgradeBags, canUpgradeTank, contractById, tankDef } from '../scale/logic'
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
  PREMADE_TERMINAL_COST,
  RAIL_CITY_COST,
  HEAT_ABANDON_THRESHOLD,
  HEAT_REWARD_THRESHOLD,
  HEAT_WARN_THRESHOLD,
  rewardBlurb,
  rewardDetail,
  rewardForPersona,
  ROOMS,
  RUNWAY_PREFAB_COST,
  SHORT_RUNWAY_COST,
  STARTER_KIT_COST,
} from '../game/catalog'
import { starterKitPreview } from '../game/starterLayout'
import { SPEC_PATHS } from '../progression/specializations'
import { SpecTree } from './SpecTree'
import { CeoCardView } from './wave3/CeoCard'
import { ResearchTree } from './research/ResearchTree'
import { lateIdForTool } from '../game/lateBuildings.ts'
import { tilesOf } from '../game/path'
import { CLEARANCE_LICENCE_COST } from '../inbound/data.ts'
import { environmentCaption, seasonAtClock } from '../environment/index.ts'
import { formatSimDate, type Game } from '../game/sim'
import { inputMap } from '../input/map'
import { pauseState } from './pauseState'
import type { AirlineTier, BudgetKey, Speed } from '../game/types'
import { RivalPanel } from '../rival/RivalPanel.tsx'
import { LineChart } from './LineChart'
import { BoardPanel } from '../fids/BoardPanel'
import { fidsIsOpen, setFidsOpen, subscribeFids } from '../fids/open'
import { FeesPanel } from './FeesPanel'
import { TycoonPanel, YearReportCard } from '../tycoon/TycoonPanel.tsx'
import type { TycoonTab } from '../tycoon/types.ts'
import { CouncilPanel } from '../council/CouncilPanel.tsx'
import { StaffHousingPanel } from './StaffHousingPanel'
import { ACHIEVEMENTS, AchievementToast, type AchievementDef } from '../achievements'
import { liveBubbles } from '../feedback/stage'
import { DebugHud } from './DebugHud'
import { BuildingPanel } from './BuildingPanel'
import { HALL_ROOMS } from './uiCatalog'
import {
  BUILD_MENUS,
  headingFor,
  MANAGE_MENUS,
  sheetFor,
  type ManageTabId,
} from './nav/taxonomy'

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

export function Hud({ game, onNewGame }: { game: Game; onNewGame?: () => void }) {
  const [buildMenu, setBuildMenu] = useState<string | null>(null)
  const [panelPick, setPanel] = useState<ManageTabId | null>(null)
  const [infoGroup, setInfoGroup] = useState<string | null>(null)
  const [growthFocus, setGrowthFocus] = useState<string | null>(null)
  // One panel at a time: an open hint list folds the HUD rollout away.
  const manageTab = game.sidePanel === 'hints' ? null : panelPick
  const panel = manageTab ? sheetFor(manageTab) : null
  const [openLetter, setOpenLetter] = useState<string | null>(null)
  const [phoneOpenSignal, setPhoneOpenSignal] = useState(0)
  const [hoverLetter, setHoverLetter] = useState<string | null>(null)
  // Desktop reads those letters on the phone, which holds them itself.
  const desktopPhone = useDesktop()
  useEffect(() => {
    if (desktopPhone) return
    game.holdLetters([openLetter, hoverLetter].filter((id): id is string => id != null))
  }, [game, openLetter, hoverLetter, desktopPhone])
  useEffect(() => () => game.holdLetters([]), [game])
  const [chromePinned, setChromePinned] = useState(false)
  const ecoTab =
    manageTab === 'income' ||
    manageTab === 'expenses' ||
    manageTab === 'loans' ||
    manageTab === 'charts' ||
    manageTab === 'overview'
      ? manageTab
      : 'overview'
  const [loanAmount, setLoanAmount] = useState(25_000)
  const [tycoonTab, setTycoonTab] = useState<TycoonTab>('shops')
  const [inboxOpen, setInboxOpen] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const [boardsOpen, setBoardsOpen] = useState(fidsIsOpen)
  useEffect(() => subscribeFids(setBoardsOpen), [])
  // Terminal view folds the apron cards. A peek belongs to the view it was opened in.
  const [hallPeek, setHallPeek] = useState<{ view: string; id: 'coach' } | null>(null)
  const [coachOpen, setCoachOpen] = useState(false)
  const inHall = game.view === 'hall'
  const peek = hallPeek?.view === game.view ? hallPeek.id : null
  const openPeek = (id: 'coach') =>
    setHallPeek((cur) => (cur?.view === game.view && cur.id === id ? null : { view: game.view, id }))
  const pendingYear = game.pendingYearReport()?.year ?? null
  const [yearShown, setYearShown] = useState<number | null>(null)
  const fieldNow = game.fieldLevel()
  const [fieldSeen, setFieldSeen] = useState(fieldNow)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const [unlockFocus, setUnlockFocus] = useState<string | null>(null)
  if (fieldNow > fieldSeen) {
    setFieldSeen(fieldNow)
    setLevelUp(fieldNow)
  }
  if (manageTab === 'commercial' && pendingYear !== yearShown) {
    setYearShown(pendingYear)
    if (pendingYear != null) setTycoonTab('year')
  }
  useEffect(() => {
    game.pokeTycoon()
    game.pokeCouncil()
  }, [game, panel])
  const forecast = projectCash(game.cash, game.incomeRate(), game.dailyOperatingCharges())
  const flowLabel = `${forecast.dailyNet > 0 ? '+' : ''}${money(forecast.dailyNet)}/day`
  const buildEntry = buildMenu ? BUILD_MENUS.find((m) => m.id === buildMenu) : undefined
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

  const panelRef = useRef(panelPick)
  panelRef.current = panelPick
  const airlineAsk = game.airlineDeskAsk?.n ?? 0
  useEffect(() => {
    if (!game.airlineDeskAsk) return
    setChromePinned(true)
    setInfoGroup('airlines')
    setPanel('letters')
    game.setSidePanel('hud')
    if (game.airlineDeskAsk.airlineId) openHubProfile(game.airlineDeskAsk.airlineId)
  }, [airlineAsk, game])

  useEffect(() => {
    return inputMap.onPress((id) => {
      if (id !== 'view.airlines') return
      if (panelRef.current === 'letters') {
        setChromePinned(false)
        setPanel(null)
        return
      }
      game.openAirlines(game.signed[0] ?? '')
    })
  }, [game])

  const focusHallDesk = (id: ManageTabId) => {
    const sheet = sheetFor(id)
    if (sheet === 'services' || sheet === 'research' || sheet === 'tycoon') game.focusHallForDesk()
  }

  const togglePanel = (id: ManageTabId) => {
    const closing = manageTab === id
    setPanel(closing ? null : id)
    setChromePinned(!closing)
    game.setSidePanel(closing ? null : 'hud')
    if (!closing) focusHallDesk(id)
  }

  /** Open a tab without accidental close when already selected. */
  const openPanel = (id: ManageTabId) => {
    setPanel(id)
    setChromePinned(true)
    focusHallDesk(id)
    game.setSidePanel('hud')
  }

  useEffect(() => {
    if (game.hubDeepLinkTick <= 0) return
    setChromePinned(true)
    setInfoGroup('airlines')
    openPanel('letters')
    game.setSidePanel('hud')
    const id = game.airlineDeskAsk?.airlineId || game.hubDeepLinkAirline
    if (id) openHubProfile(id)
  }, [game.hubDeepLinkTick, game])

  const relationsAsk = game.hubRelationsTick
  useEffect(() => {
    if (relationsAsk <= 0) return
    setChromePinned(true)
    setInfoGroup('airlines')
    openPanel('relations')
  }, [relationsAsk, game])

  const openUnlock = (link: UnlockLink) => {
    setUnlockFocus(link.anchor)
    if (link.anchor.startsWith('research-node-')) setGrowthFocus(link.anchor.slice('research-node-'.length))
    setInfoGroup('growth')
    openPanel(link.tab)
  }

  useEffect(() => {
    if (!unlockFocus) return
    document.getElementById(unlockFocus)?.scrollIntoView({ block: 'nearest' })
  }, [unlockFocus, manageTab])

  useEffect(() => {
    setSchedulePlanner(manageTab === 'planner')
    return () => setSchedulePlanner(false)
  }, [manageTab])

  const building = game.buildingCard()
  const ticker = game.news.slice(0, 5)
  const xp = game.fieldXpToNext()
  const standing = game.avgStanding()
  const power = game.powerReport()
  const powerGate = canUpgradePower(game.powerPlantTier, game.fieldLevel())
  const chipPhrases = statusChipFromGame(game)
  const chipDock = dockHasRows(game)

  return (
    <div className="hud">
      <ApronFlightCard game={game} />
      <AssignPanel game={game} />
      <BuildingPanel
        card={building}
        onClose={() => game.closeBuilding()}
        onHire={building?.hire ? () => game.hireDeskStaff() : undefined}
        onAction={(id) => game.buildingCardAction(id)}
        onPreview={(id) => game.previewStandRow(id)}
      />
      <DebugHud game={game} />
      <AchievementToast achievements={newAchievements} />
      <GameTimetable
        game={game}
        menuOpen={!!buildMenu}
        plannerOpen={manageTab === 'planner'}
        onFuel={() => openPanel('services')}
      />
      <button
        type="button"
        className={`fids-toggle${boardsOpen ? ' on' : ''}`}
        title="Departures and arrivals"
        data-testid="tab-boards"
        onClick={() => setFidsOpen(!fidsIsOpen())}
      >
        Boards
      </button>
      {boardsOpen ? <BoardPanel source={game} onClose={() => setFidsOpen(false)} /> : null}
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
          title="Back to the title. New Game and Continue are there."
          onClick={() => onNewGame?.()}
        >
          Title
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
                  setInfoGroup('money')
                  openPanel('overview')
                }}
              >
                Open books
              </button>
            </div>
          ) : null}
        </div>
        <div className="stat clock-climate" title="One day is a 180-second cycle">
          <LiveText testId="hud-clock" read={() => formatSimDate(game.clock)} />
          {game.site ? (
            <span
              className="climate-line"
              data-testid="climate-line"
              title={`${game.mapSummary().name}. ${game.mapSummary().blurb}`}
            >
              {game.mapSummary().region} · {game.mapSummary().season}
            </span>
          ) : null}
        </div>
        <SpeedButtons game={game} speed={game.speed} className="speeds stat-speeds" />
        <FieldBadge
          progress={xp}
          points={() => `${Math.floor(game.researchTree.points())} RP`}
          title={`Field ${xp.label}. Rating ${game.fieldRating()} — ${game.fieldRatingLabel()}. ops trickle -> tree · ${Math.floor(game.researchTree.points())} research points.`}
          onOpen={() => {
            setInfoGroup('growth')
            openPanel('levels')
          }}
        />
        <div className="stat" title="Average Standing of signed airlines">
          Standing {standing == null ? '—' : Math.round(standing)}
        </div>
        <div className="stat" data-testid="reputation-stat" title="Public reputation, 0 to 100">
          Rep <LiveText read={() => `${game.reputationDisplay()}%`} />
        </div>
        <StatusChip
          phrases={chipPhrases}
          dockHasRows={chipDock}
          onAct={(target) => {
            if (statusChipOpensPhone(desktopPhone, target)) {
              setPhoneOpenSignal((n) => n + 1)
              return
            }
            runStatusChipAction(target, {
              openLetter: setOpenLetter,
              scrollLetter: (id) => {
                const node = document.getElementById(`letter-${id}`) ?? document.getElementById('letter-stack')
                node?.scrollIntoView({ block: 'nearest' })
              },
              expandDock: () => game.minimiseAlerts(false),
            })
          }}
        />
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
          Free gates {freeGates} · Holding {holding}
        </div>
        {game.public ? (
          <button
            type="button"
            className="stat cash top-cash"
            title="Open Money · HATCH"
            onClick={() => openPanel('overview')}
          >
            HATCH ${game.sharePrice.toFixed(2)}
          </button>
        ) : null}
        <div className="stat vitals-quiet" title={game.stripCapabilityLine()}>
          {game.stripTierLabel()} · Runway {Math.round(game.runwayCondition)}% · Security{' '}
          {ready.security}
          {game.fits.length > 1 ? ` · ${game.fits.length} halls` : ''}
          {game.runwayStripCount() > 0
            ? ` · ${game.runwayStripCount()} runway${game.runwayStripCount() === 1 ? '' : 's'}`
            : ''}
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
        </div>
      ) : null}

      {game.showCoach() && (!inHall || peek === 'coach') ? (
        <div
          className={`coach${game.showStarterKit() || coachOpen ? '' : ' is-chip'}${game.sidePanel === 'hints' ? ' below-hints' : ''}`}
          data-testid="coach"
        >
          {game.showStarterKit() || coachOpen ? (
          <>
          <div className="coach-head">
            <strong>First hour</strong>
            <span className="coach-actions">
              {game.showStarterKit() ? null : (
                <button type="button" className="ghost" data-testid="coach-collapse" onClick={() => setCoachOpen(false)}>
                  Hide
                </button>
              )}
              <button type="button" className="ghost" onClick={() => game.dismissCoach()}>
                Got it
              </button>
            </span>
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
          </>
          ) : (
            <button type="button" className="coach-toggle" data-testid="coach-toggle" onClick={() => setCoachOpen(true)}>
              First hour
            </button>
          )}
        </div>
      ) : null}

      {!panel && game.pendingYearReport() ? (
        <YearReportCard
          report={game.pendingYearReport()!}
          formatMoney={money}
          onDismiss={() => game.dismissYearReport()}
        />
      ) : null}
      <Phone game={game} desktop={desktopPhone} openSignal={phoneOpenSignal} />
      <AlertStackView game={game} />
      {levelUp != null ? (
        <LevelUpCard
          level={levelUp}
          onClose={() => setLevelUp(null)}
          onProgression={() => {
            const reached = levelUp
            setLevelUp(null)
            setUnlockFocus(`level-${reached}`)
            setInfoGroup('growth')
            openPanel('levels')
          }}
        />
      ) : null}
      <div
        id="letter-stack"
        className={`letter-stack${game.showCoach() ? ' below-coach' : ''}`}
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
            locked?: boolean
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
              blurb: `${game.fieldTask.blurb} · ${money(game.fieldTask.bonus)} if done · ${game.fieldAskClockLine()}`,
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
            const tier = game.hubOffer.tier ?? 'hub'
            const list = game.hubChecklistFor(game.hubOffer.airline)
            letters.push({
              id: 'hub',
              kind: 'Hub',
              from: hubAirline.name,
              title: `${hubAirline.name} · ${HUB_TIER_LABEL[tier]} offer`,
              blurb: `${money(game.hubOffer.fee)}. ${list.rewards[0] ?? 'The next step on their ladder.'}`,
              tone: 'good',
              left: () => Math.ceil(game.hubOffer?.deadline ?? 0),
              locked: !(list.eligible && list.next === tier),
            })
          }
          if (game.mxOffer && mxAirline) {
            letters.push({
              id: 'mx',
              kind: 'Line maintenance',
              from: mxAirline.name,
              title: `${mxAirline.name} wants line maintenance`,
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
                game.pendingThreat.severity === 'hard' ? 'Hard threat' : 'Security alert',
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
              from: 'Operations',
              title:
                e.kind === 'tanker_mx'
                  ? 'Firefighting plane · refuel and maintenance'
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
          const fuelOut = game.alerts.ranked().find((alert) => alert.key === 'cond:fuel-out')
          if (fuelOut) {
            letters.push({
              id: 'fuel-out',
              kind: 'Fuel outage',
              from: 'Operations',
              title: fuelOut.title,
              blurb: fuelOut.detail,
              tone: 'bad',
              left: null,
            })
          }
          const crash = game.news.find((item) => item.text.startsWith('CRASH on') && item.age < 90)
          if (crash) {
            letters.push({
              id: 'crash',
              kind: 'Crash',
              from: 'Tower',
              title: 'Crash on the field',
              blurb: crash.text,
              tone: 'bad',
              left: null,
            })
          }
          if (desktopPhone) {
            for (let i = letters.length - 1; i >= 0; i--) {
              if (!letterOnStack(letters[i].id, true)) letters.splice(i, 1)
            }
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
                id={`letter-${letter.id}`}
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
                    <span className="letter-timer">Note</span>
                  )}
                </button>
                <div className="letter-body">
                  <strong>{letter.title}</strong>
                  <p>{letter.blurb}</p>
                  {letter.id === 'contract' && offerAirline ? (
                    <>
                      <p className="muted">
                        Terms · landing {money(game.wave3.landingOffer(offerAirline.id, offerAirline.landing))} · bags{' '}
                        {money(offerAirline.bags)}
                        {` · catering ${money(game.quotedCatering(offerAirline.id, Math.max(offerAirline.paxMin || 40, 1)))}`}
                      </p>
                      <p className="muted" data-testid="relationship-fee">
                        {game.wave3.feeLine(offerAirline.id)} · {game.wave3.slotLine(offerAirline.id)}
                      </p>
                      {(() => {
                        const rel = game.wave3.relation(offerAirline.id)
                        return (
                          <CeoCardView
                            card={rel.ceo}
                            score={rel.score}
                            band={rel.band}
                            tierLabel={`T${rel.tier} ${rel.label}`}
                            fleet={rel.fleetLabel}
                            line={rel.ceo.voice}
                          />
                        )
                      })()}
                      <p className="muted" data-testid="contract-capacity">
                        {game.letterCapacity(offerAirline.id)}
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
                        {(() => {
                          const desks = game.checkinSignReport(offerAirline.id)
                          if (!desks.line) return null
                          return (
                            <li data-met={desks.ok ? '1' : '0'} data-testid="contract-desks">
                              {desks.ok ? 'Met' : 'Missing'} · {desks.line}
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
                          title={
                            offerAirline && !game.checkinSignReport(offerAirline.id).ok
                              ? game.checkinSignReport(offerAirline.id).line
                              : undefined
                          }
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
                        <button type="button" className="on" disabled={letter.locked} onClick={() => game.acceptHub()}>
                          Accept
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
                        <p className="muted" data-testid="field-expiry">
                          {game.fieldAskClockLine()}
                        </p>
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
                          data-testid="field-decline"
                          onClick={() => {
                            game.declineFieldTask()
                            setOpenLetter(null)
                          }}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          data-testid="field-later"
                          onClick={() => {
                            game.ackLetter(`field:${game.fieldTask?.id ?? ''}`)
                            setOpenLetter(null)
                          }}
                        >
                          Later
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

      <HubAssign game={game} />
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
              <h2>{manageTab ? headingFor(manageTab) : ''}</h2>
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
            <div className="panel-body" data-testid="panel-body">
              {panel === 'economy' ? (
                <>
                  <p
                    className={`money-summary ${forecast.dailyNet >= 0 ? 'up' : 'down'}`}
                    data-testid="money-summary"
                  >
                    {moneySummaryLine(forecast, money)}
                  </p>
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
                        title={game.payrollChargeTitle()}
                      >
                        {payrollPreviewLabel(game.payrollCharged(), money)}
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
                    <section data-testid="finance-breakdown">
                      <h3>Ledger</h3>
                      {financeBreakdown(game.bank.ledger()).length ? (
                        financeBreakdown(game.bank.ledger()).map((line) => (
                          <p
                            key={`${line.category}${line.unpaid ? '-unpaid' : ''}`}
                            className="muted eco-line"
                            data-testid={`finance-line-${line.category}${line.unpaid ? '-unpaid' : ''}`}
                            title={line.why}
                          >
                            {line.label} {money(line.amount)}{' '}
                            <span className="why" title={line.why}>
                              why
                            </span>
                          </p>
                        ))
                      ) : (
                        <p className="muted">No ledger lines yet. Opening cash is the balance, not a charge.</p>
                      )}
                    </section>
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
                        <span>{loanAmountLabel(loanAmount, loanFeeForAmount(loanAmount))}</span>
                        <input
                          type="range"
                          min={25_000}
                          max={250_000}
                          step={5_000}
                          value={loanAmount}
                          aria-label="Loan amount"
                          aria-valuetext={loanAmountLabel(loanAmount, loanFeeForAmount(loanAmount))}
                          onChange={(e) => setLoanAmount(Number(e.target.value))}
                        />
                        <output>{money(loanAmount + loanFeeForAmount(loanAmount))}</output>
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
                              {active
                                ? `${p.label} · owe ${money(game.loanBalance)}`
                                : loanProductLabel(p)}
                              {!open ? ' · locked' : ''}
                            </button>
                          )
                        })}
                      </div>
                      <div className="row">
                        <button
                          type="button"
                          data-testid="loan-draw"
                          disabled={game.loanBalance > 0}
                          onClick={() => game.drawLoan(loanAmount)}
                        >
                          {loanDrawLabel(loanAmount, loanFeeForAmount(loanAmount))}
                        </button>
                        <button type="button" onClick={() => game.repayLoan()}>
                          Pay loan{game.loanBalance > 0 ? ` ${money(game.loanBalance)}` : ''}
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

              {panel === 'fees' ? (
                <FeesPanel
                  fees={game.fees}
                  depositTier={game.depositTier}
                  onFee={(key, value) => game.setFee(key, value)}
                  onTier={(tier) => game.setDepositTier(tier)}
                  onClose={() => {
                    setPanel(null)
                    setChromePinned(false)
                    game.setSidePanel(null)
                  }}
                />
              ) : null}

              {panel === 'budget' ? (
                <section data-testid="budget-panel">
                  <h3>Operations budgets</h3>
                  <p
                    className={`money-summary ${forecast.dailyNet >= 0 ? 'up' : 'down'}`}
                    data-testid="budget-money-summary"
                  >
                    {moneySummaryLine(forecast, money)}
                  </p>
                  <p
                    className="muted"
                    data-testid="budget-payroll"
                    title={game.payrollChargeTitle()}
                  >
                    {payrollPreviewLabel(game.payrollCharged(), money)}
                    {game.fieldOpsMult() > 1.05
                      ? ` · field load ×${game.fieldOpsMult().toFixed(2)}`
                      : ''}{' '}
                    · crash risk {Math.round(game.crashChance() * 1000) / 10}% · Runway{' '}
                    {Math.round(game.runwayCondition)}% · {seasonAtClock(game.clock).name} · {game.weatherLabel()}
                  </p>
                  <div className="row">
                    <button type="button" className="on" onClick={() => game.hireMechanic()}>
                      Hire mechanic · {money(game.staffHireCost(MECHANIC_HIRE))}
                    </button>
                    <button type="button" onClick={() => game.hireJanitor()}>
                      Hire janitor · {money(game.staffHireCost(JANITOR_HIRE))}
                    </button>
                    <button type="button" onClick={() => game.hireDeskStaff()}>
                      Hire desk agent · {money(game.staffHireCost(DESK_STAFF_HIRE))}
                    </button>
                    <button type="button" onClick={() => game.fireMechanic()}>
                      Lay off mechanic
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
                <ResearchTree
                  key={growthFocus ?? 'growth'}
                  state={researchTreeState(game)}
                  fieldLevel={game.fieldLevel()}
                  ratePerSec={game.researchRate()}
                  focusId={growthFocus}
                  onUnlock={(id) => game.buyResearchNode(id)}
                  livePoints={() => `${Math.floor(game.researchTree.points())}`}
                />
              ) : null}

              {panel === 'research' ? (
                <section>
                  <h3>R&D rooms</h3>
                  <p className="muted">
                    ops trickle -&gt; tree · {Math.floor(game.researchTree.points())} RP ·{' '}
                    {game.researchRate().toFixed(2)}/s
                    {(() => {
                      const g = game.labGear()
                      return ` · desks ${g.desks} · boards ${g.boards} · machines ${g.machines}`
                    })()}
                    {game.researchers
                      ? (() => {
                          const c = game.labCrewStatus()
                          return ` · ${c.working} working / ${c.break} break / ${c.home} home`
                        })()
                      : game.opsResearchRate() > 0
                        ? ' · operations trickle is running — furnished rooms add the rest, and researchers raise that room rate'
                        : ' · buy land to start the operations trickle'}
                  </p>
                  <div className="row">
                    <button type="button" onClick={() => game.hireResearcher()}>
                      Hire researcher · {money(game.staffHireCost(RESEARCHER_HIRE))}
                    </button>
                  </div>
                  <h3>Lab rooms</h3>
                  <HallRoomList game={game} ids={HALL_ROOMS.research} />
                </section>
              ) : null}

              {panel === 'specialize' ? <SpecTree game={game} /> : null}
              {panel === 'wallet' ? <OpsWalletPanel game={game} /> : null}

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

              {manageTab === 'letters' ? <AirlinesDesk game={game} /> : null}
              {manageTab === 'relations' ? <AirlinesHub game={game} /> : null}
              {manageTab === 'hubs' ? <HubProgress game={game} /> : null}
              {manageTab === 'negotiation' ? (
                <section data-testid="negotiation-desk">
                  <h3>Negotiation</h3>
                  <p className="muted">
                    {game.offer
                      ? `${game.airline(game.offer.airline).name} has an open offer.`
                      : 'No offer on the table. A letter opens one.'}
                  </p>
                  <button type="button" onClick={() => game.openNegotiationPanel()} disabled={!game.offer}>
                    Open negotiation
                  </button>
                </section>
              ) : null}
              {manageTab === 'roster' ? (
                <>
                <section className="inbound-contracts" data-testid="contracts-panel">
                  <h3>Contracts</h3>
                  <p className="muted eco-line">
                    Guard {game.milAgreement ? 'agreement signed' : 'agreement is under Money → Payroll'}
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
                    Specializations {game.specPointsLeft()} path point{game.specPointsLeft() === 1 ? '' : 's'}{' '}
                    left · {game.treePointsLeft()} tree point{game.treePointsLeft() === 1 ? '' : 's'}{' '}
                    left
                    {game.specPaths.length
                      ? ` · ${game.specPaths
                          .map((id) => SPEC_PATHS.find((p) => p.id === id)?.label ?? id)
                          .join(', ')}`
                      : ''}
                    . Open Growth → Specializations for the trees. Paths mix: capstone +50% and site upkeep +10% after
                    the first.
                  </p>
                  {([1, 2, 3, 4, 5] as AirlineTier[]).map((tier) => {
                    const meta = AIRLINE_TIER_META[tier]
                    const unlocked = game.tierUnlocked(tier)
                    const carriers = game
                      .panelAirlines()
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
                                  <AirlineMark id={a.id} color={a.color} />
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

              {manageTab === 'stands' ? (
                <section data-testid="stands-panel">
                  <h3>Stands</h3>
                  <p className="muted">{game.campusLine()}</p>
                  <p className="muted">
                    {tilesOf(game.tiles, 'stand').length} stands · {game.jetwayCount()} jetway · {game.freeStands().length}{' '}
                    free. A jet bridge is bought on the stand card.
                  </p>
                </section>
              ) : null}

              {manageTab === 'planner' ? (
                <>
                  <section>
                    <h3>Selected flight</h3>
                    <p className="muted">Fleet today: {game.fleetMixLine()}</p>
                    {flight && airline ? (
                      <FlightCard game={game} flight={flight} />
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
                      stamp more strips for more banks — cycle Runway on each slot
                    </p>
                    <p className="muted">Edit a turn on the schedule sheet. This panel does not move it.</p>
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
                      {game.signed.slice(0, 3).map((id) => {
                        const banned = game.isBanned(id)
                        return (
                          <button
                            key={id}
                            type="button"
                            data-testid={`manual-slot-${id}`}
                            disabled={banned}
                            onClick={() => {
                              if (!game.isBanned(id)) game.addManualSlot(id, 18)
                            }}
                          >
                            {manualSlotLabel(game.airline(id).name, banned)}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                </>
              ) : null}

              {panel === 'premium' ? <PremiumPanel game={game} /> : null}
              {manageTab === 'commercial' ? (
                <>
                  <TycoonPanel
                    view={game.tycoonView()}
                    cash={game.cash}
                    showTabs
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
                  {manageTab === 'commercial' &&
                  (tycoonTab === 'year' && !game.pendingYearReport() ? 'shops' : tycoonTab) === 'shops' ? (
                    <section>
                      <h3>Hall shops</h3>
                      <p className="muted">Food, retail, and lounge rooms inside the selected hall.</p>
                      <HallRoomList game={game} ids={HALL_ROOMS.commercial} />
                    </section>
                  ) : null}
                </>
              ) : null}
              {manageTab === 'staff' ? <StaffHousingPanel game={game} focus="housing" /> : null}
              {manageTab === 'commute' ? <StaffHousingPanel game={game} focus="commute" /> : null}
              {manageTab === 'morale' ? <StaffHousingPanel game={game} focus="morale" /> : null}
              {manageTab === 'thoughts' ? (
                <section data-testid="thoughts-panel">
                  <h3>Passenger thoughts</h3>
                  <p className="muted">Icons sit over the hall. A quiet field has nothing to say.</p>
                  {liveBubbles().length === 0 ? (
                    <p className="muted">No passenger is speaking right now.</p>
                  ) : (
                    <ul className="airlines">
                      {liveBubbles().map((bubble) => (
                        <li key={bubble.passengerId}>
                          <b>{bubble.icon === 'queue' ? 'Queue' : bubble.icon === 'prices' ? 'Prices' : 'Delight'}</b>
                          <span className="muted">{bubble.passengerId}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}
              {manageTab === 'levels' ? (
                <>
                  <FieldLevelsPanel level={game.fieldLevel()} focus={unlockFocus} />
                  <ScenarioPanel game={game} />
                </>
              ) : null}
              {manageTab === 'achievements' ? (
                <>
                  <section data-testid="achievements-panel">
                    <h3>Achievements</h3>
                    <ul className="airlines">
                      {Object.values(ACHIEVEMENTS).map((item) => {
                        const unlocked = game.achievements.state.unlocked[item.id]
                        return (
                          <li key={item.id}>
                            <b>
                              {item.name} <span className="muted">{unlocked ? '· earned' : '· still ahead'}</span>
                            </b>
                            <span className="muted">{item.description}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                  <h3>Awards</h3>
                  <TycoonPanel
                    view={game.tycoonView()}
                    cash={game.cash}
                    showTabs={false}
                    tab="awards"
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
                </>
              ) : null}
              {panel === 'council' ? (
                <CouncilPanel
                  view={game.councilView()}
                  missions={game.seasonMissions()}
                  onVote={(requestId, choiceId) => game.answerCouncilRequest(requestId, choiceId)}
                />
              ) : null}

              {panel === 'services' ? (
                <>
                  <section>
                    <h3>Fuel desk</h3>
                    <p className="muted" data-testid="fuel-desk-status">
                      {(() => {
                        const contract = contractById(game.contractId)
                        if (contract) {
                          const band = termBandLitres(contract.id)
                          return `${contract.name} · $${game.termUnitPrice(contract.id).toFixed(3)}/L · band ${Math.round(game.termUpliftLitres).toLocaleString('en-US')} / ${band.toLocaleString('en-US')} L today`
                        }
                        if (game.spotInbound) {
                          return `Spot · ${game.spotInbound.supplier ?? SPOT_OFFER.supplier} tanker on the road · ${game.spotInbound.litres.toLocaleString('en-US')} L`
                        }
                        if (game.spotOffer) {
                          const price = game.spotOffer.perLitre ?? SPOT_OFFER.perLitre
                          return `Spot offer · ${game.spotOffer.flightNo} · ${game.spotOffer.supplier ?? SPOT_OFFER.supplier} $${price.toFixed(3)}/L`
                        }
                        const quote = game.quoteSpot()
                        return game.fuelBrand
                          ? `${FUEL[game.fuelBrand].name} · spot $${quote.perLitre.toFixed(3)}/L · no term`
                          : 'No carrier. A spot tanker or a term keeps fuel on the wing.'
                      })()}
                    </p>
                    <p className="muted">
                      Tank {game.tankTier} · {Math.round(game.tankLitres).toLocaleString('en-US')} /{' '}
                      {tankDef(game.tankTier).capacityLitres.toLocaleString('en-US')} L · {game.fuelSupply}
                    </p>
                    <button
                      type="button"
                      data-testid="open-fuel-rack"
                      onClick={() => {
                        setPanel(null)
                        game.showFuelRack()
                      }}
                    >
                      Open the fuel rack
                    </button>
                    <div className="row">
                      {FUEL_CONTRACTS.map((c) => {
                        const gate = canSignContract(c.id, game.fieldLevel(), game.researchGrants())
                        const signed = game.contractId === c.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            disabled={!gate.ok || signed}
                            title={gate.ok ? `$${game.termUnitPrice(c.id).toFixed(3)} per litre` : gate.why}
                            onClick={() => game.signScaleContract(c.id)}
                          >
                            {c.name} {money(c.sign)} · ${game.termUnitPrice(c.id).toFixed(3)}/L
                            {!gate.ok ? ` · ${gate.why}` : ''}
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
                      <button type="button" data-testid="fuel-supply-pipeline" onClick={() => game.setFuelSupply('pipeline')}>
                        Pipeline
                      </button>
                      {siteHasWater(game.site) ? (
                        <button type="button" data-testid="fuel-supply-barge" onClick={() => game.setFuelSupply('barge')}>
                          Barge
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => game.upgradeTank()}
                        disabled={!canUpgradeTank(game.tankTier, game.fieldLevel(), game.researchGrants()).ok}
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
                        disabled={!canUpgradeBags(game.bagSystem, game.fieldLevel(), game.researchGrants()).ok}
                        onClick={() => game.upgradeBagSystem()}
                      >
                        Upgrade bags
                      </button>
                      {(Object.keys(PAX_UNITS) as (keyof typeof PAX_UNITS)[]).map((id) => {
                        const gate = canBuyPax(id, game.fieldLevel(), game.researchGrants())
                        return (
                          <button key={id} type="button" disabled={!gate.ok} onClick={() => game.buyPaxUnit(id)}>
                            {PAX_UNITS[id].name} {money(PAX_UNITS[id].cost)}
                          </button>
                        )
                      })}
                    </div>
                    <div className="row">
                      {VEHICLE_OFFERS.map((offer) => {
                        const gate = canBuyVehicle(offer.type, game.fieldLevel(), game.researchGrants())
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
                          Wear restrooms {Math.round(fit?.wearBath ?? 0)} · Security{' '}
                          {Math.round(fit?.wearSec ?? 0)}
                          {ready.heavyRunway ? ' · heavy strip ready' : ''}
                          {ready.helipad ? ' · helipad' : ''}
                        </p>
                        <button type="button" className="wide" onClick={() => game.scrubHall()}>
                          Scrub hall · {money(HALL_SCRUB_COST)}
                        </button>
                        <HallRoomList game={game} ids={HALL_ROOMS.services} />
                      </>
                    ) : (
                      <p className="muted" data-testid="hall-furnish-note">
                        {game.hallFurnishNote()}
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
                  Operations rooms in Services · shops in Commercial · lab in R&D
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
                      data-testid={`build-${m.id}`}
                      onClick={() => {
                        setBuildMenu((cur) => (cur === m.id ? null : m.id))
                        setPanel(null)
                        setChromePinned(false)
                        setInfoGroup(null)
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    title="Rotate the stamp between east–west and north–south"
                    onClick={() => game.rotatePiece()}
                  >
                    Facing {game.facing === 'h' ? 'east–west' : 'north–south'}
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
                </div>
                {buildEntry ? <BuildTray game={game} menu={buildEntry} onOpen={openUnlock} /> : null}
              </>
            )}
            <p className="hint">
              {game.view === 'hall'
                ? 'Terminal: doors → check-in → security → gate. Esc / H returns — the airport keeps running.'
                : game.tool === 'runway_short'
                  ? `Short runway 10×2 (${money(SHORT_RUNWAY_COST)}) — ATR / CRJ / E175 / Citation / F-15.`
                  : game.tool === 'runway'
                    ? `Regional runway 14×2 (${money(RUNWAY_PREFAB_COST)}) — A320 / 737 / A321 / 757F.`
                    : game.tool === 'runway_heavy'
                      ? `Heavy runway 20×3 (${money(HEAVY_RUNWAY_COST)}) — 787 / A350 / 747-8F / C-17.`
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
                            : 'Bulldoze refunds 40%.'}
              {game.securityIncidents ? ` · ${game.securityIncidents} security incidents` : ''}
              {game.terminalPaxCount()
                ? ` · ${game.terminalPaxCount()} in hall${
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

            <button
              type="button"
              className="bar-cluster"
              data-testid="hud-airlines"
              title="Airlines — relationship, hub level, checklist, rewards, rivals, and dedicated desks"
              onClick={() => {
                if (manageTab === 'letters') {
                  setPanel(null)
                  setChromePinned(false)
                  return
                }
                game.openAirlines(game.signed[0] ?? '')
              }}
            >
              Airlines
            </button>

            <div className="bar-cluster info-menus">
              {MANAGE_MENUS.map((menu) => {
                const open = infoGroup === menu.id
                const active = menu.tabs.some((item) => item.id === manageTab)
                return (
                  <div key={menu.id} className="info-group">
                    <button
                      type="button"
                      className={open || active ? 'on' : ''}
                      title={menu.tip}
                      aria-expanded={open}
                      data-testid={`menu-${menu.id}`}
                      onClick={() => setInfoGroup(open ? null : menu.id)}
                    >
                      {menu.label}
                      {menu.id === 'money' ? (
                        <>
                          {' · '}
                          <LiveText read={() => money(game.cash)} />
                        </>
                      ) : null}
                      {menu.id === 'money' && game.pendingYearReport() ? ' •' : ''}
                    </button>
                    {open ? (
                      <div className="info-sub" data-testid={`submenu-${menu.id}`} role="menu">
                        {menu.tabs.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            className={manageTab === item.id ? 'on' : ''}
                            title={item.tip}
                            data-testid={`tab-${item.id}`}
                            onClick={() => {
                              if (item.id === 'commercial') setTycoonTab('shops')
                              if (manageTab === item.id) togglePanel(item.id)
                              else openPanel(item.id)
                              setInfoGroup(null)
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                        {menu.id === 'money' && game.pendingYearReport() ? (
                          <button
                            type="button"
                            role="menuitem"
                            data-testid="tab-year"
                            onClick={() => {
                              setTycoonTab('year')
                              openPanel('commercial')
                              setInfoGroup(null)
                            }}
                          >
                            Year report
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
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

/** Hide a node that still owes its cash build cost so the tree can charge it. */
function researchTreeState(game: Game) {
  const pending = new Set(game.unpaidResearchNodes())
  const state = game.researchTree.state
  if (!pending.size) return state
  return { ...state, unlocked: state.unlocked.filter((id) => !pending.has(id)) }
}

function HallRoomList({ game, ids }: { game: Game; ids: readonly string[] }) {
  const origin = game.selectedTerminalOrigin()
  const fit = origin
    ? game.fits.find((f) => f.origin.c === origin.c && f.origin.r === origin.r)
    : null
  const rooms = ROOMS.filter((room) => ids.includes(room.id))
  if (!origin) {
    return (
      <p className="muted" data-testid="hall-furnish-note">
        {game.hallFurnishNote()}
      </p>
    )
  }
  return (
    <ul className="rooms">
      {rooms.map((room) => (
        <li key={room.id}>
          <button type="button" onClick={() => game.buyRoom(room.id)}>
            {room.name}
            <span>
              {fit?.rooms[room.id] ?? 0} · {money(room.cost)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

