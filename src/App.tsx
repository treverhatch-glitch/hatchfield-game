import { useEffect, useState, useSyncExternalStore } from 'react'
import { CameraChrome } from './camera/chrome.tsx'
import { cameraSession } from './camera/session.ts'
import { perfEnd, perfStart } from './core/perf'
import { recordSimTick } from './perf/simSample'
import { Game } from './game/sim'
import { Field } from './ui/Field'
import { Hud } from './ui/Hud'
import { InfoViews } from './ui/InfoViews'
import { bindLiveHud, hudTreeVersion, subscribeHudTree } from './ui/liveHud'
import { LandScreen } from './ui/LandScreen'
import { MenuFlyover } from './ui/MenuFlyover'
import { TerminalView } from './ui/TerminalView'
import { OwnerChrome } from './ui/isolated/OwnerChrome'
import { OfferPanel } from './negotiation/OfferPanel'
import { PriceWarCard } from './rival/PriceWarCard'
import { PlaytestYearPanel } from './reports/PlaytestYearPanel'
import { TitleScreen } from './ui/TitleScreen'
import { PlayInput } from './ui/PlayInput'
import { PauseMenu } from './ui/PauseMenu'
import { pauseState } from './ui/pauseState'
import type { MenuSection } from './ui/menu/sections'
import type { StartFocus } from './game/types'
import { applyStoredAudio, bindUiClicks, installGestureUnlock, preloadAudioClips, watchAudioSettings } from './audio'
import { tickLiveFeedback } from './feedback/live.ts'
import { FeedbackChrome } from './feedback/ui/FeedbackChrome.tsx'

/** Survive Vite HMR — a fresh `new Game()` was wiping the plot and bouncing to title. */
function getGame(): Game {
  const hot = import.meta.hot
  if (hot?.data?.game instanceof Game) return hot.data.game as Game
  const g = new Game()
  if (hot) hot.data.game = g
  return g
}

const game = getGame()
const SCREEN_KEY = 'hatchfield-screen'

// Dev builds always expose the sim and the debug HUD.
// Production exposes the sim only for `?playtest=1`.
const playtestSearch = `${globalThis.location?.search ?? ''}`
if (import.meta.env.DEV) game.debugHud = true
if (import.meta.env.DEV || playtestSearch.includes('playtest=1')) {
  ;(window as unknown as { __hatch?: Game }).__hatch = game
}

type Screen = 'title' | 'land' | 'play'

function readScreen(): Screen {
  try {
    const s = sessionStorage.getItem(SCREEN_KEY)
    if (s === 'land' || s === 'play' || s === 'title') return s
  } catch {
    /* ignore */
  }
  return 'title'
}

function writeScreen(s: Screen) {
  try {
    sessionStorage.setItem(SCREEN_KEY, s)
  } catch {
    /* ignore */
  }
}

/** Route-pick refresh should keep the New Game cash / sandbox choice. */
function applyPendingNewGame() {
  try {
    const raw = sessionStorage.getItem('hatchfield-pending')
    if (!raw) return
    const pending = JSON.parse(raw) as {
      sandbox?: boolean
      difficulty?: 'easy' | 'standard'
      enableHints?: boolean
      mapId?: 'temperate' | 'tropical' | 'desert'
    }
    game.sandbox = Boolean(pending.sandbox)
    game.enableHintsAtStart = pending.enableHints !== false
    game.beginNew(pending.difficulty === 'standard' ? 'standard' : 'easy')
    if (pending.mapId) game.setMap(pending.mapId)
  } catch {
    /* ignore */
  }
}

function bootScreen(): Screen {
  // In-memory plot wins (HMR remount).
  if (game.site) return 'play'
  const remembered = readScreen()
  // Same-tab refresh on the route cards.
  if (remembered === 'land') {
    applyPendingNewGame()
    return 'land'
  }
  // Same-tab refresh mid-play resumes. A new visit (no session) stays on the title
  // so Continue and New Game both remain reachable.
  if (remembered === 'play' && Game.hasSave() && game.load()) return 'play'
  if (remembered === 'play') return 'title'
  return remembered
}

/**
 * Values that move every tick (cash, clock, countdowns, build progress). They are not in
 * the HUD key: `LiveText` spans show them at ~4 Hz, and the tree catches up on them only
 * at the slow `HUD_CADENCE.tree*` pace.
 */
function hudFastKey(): string {
  return [
    game.cash,
    Math.floor(game.clock / 2),
    Math.ceil(game.offer?.deadline ?? 0),
    Math.ceil(game.mxOffer?.deadline ?? 0),
    Math.ceil(game.fieldTaskLeft()),
    Math.ceil(game.cargoVolumeLeft()),
    Math.ceil(game.inboundOffer()?.secondsLeft ?? 0),
    game.sites.map((s) => Math.round(s.elapsed)).join(','),
  ].join('|')
}

bindLiveHud(() => game.speed, hudFastKey)

/** Discrete HUD state: a change here re-renders the chrome straight away. */
function hudSnapshot(): string {
  const council = game.councilView()
  return [
        game.speed,
        game.tool,
        game.facing,
        game.site,
        game.view,
        game.offer?.airline,
        game.mxOffer?.airline,
        game.fieldTask?.id,
        game.ackedLetters.join(','),
        game.starterFreehand ? 1 : 0,
        game.starterKitStamped ? 1 : 0,
        game.cargoVolume?.id,
        game.cargoVolume?.delivered,
        game.cargoWarehouse,
        game.startFocus,
        game.layoverOffer?.airline,
        game.layover?.airline,
        game.hubOffer?.airline,
        game.airlineDeskAsk?.n ?? 0,
        game.parkingOffer?.callsign,
        game.pendingThreat?.id,
        game.pendingEmergency?.id,
        game.disruptionStamp(),
        game.signed.join(','),
        game.selectedFlight,
        game.selectedBuilding ?? '',
        game.selectedGuest,
        game.news[0]?.id,
        game.fuelLoads,
        game.caterBrand,
        Math.round(game.reputation),
        game.loanBalance,
        game.loanProductId,
        game.fieldXp,
        game.fieldLevel(),
        game.specPaths.join(','),
        game.specNodes.join(','),
        game.parcels,
        game.railLinked,
        game.public,
        game.sharePrice,
        game.sharesOwned,
        game.mission?.id,
        game.flights[0]?.phase,
        game.flights[0]?.airframeId,
        game.hallGuests.length,
        game.hallNav.passengers,
        game.fits.length,
        game.mechanics,
        game.runwayCondition,
        game.weather,
        game.longestRunway(),
        game.budgets.maintenance,
        game.budgets.security,
        game.budgets.cleaning,
        game.budgets.fire,
        game.budgets.ambulance,
        game.milAgreement,
        game.hotelLevel,
        game.landsideUses,
        Math.round(game.landsideFeeWindow),
        game.janitors,
        game.parkTerm,
        game.plannerRwFilter,
        game.standAccessMode,
        game.sandbox ? 1 : 0,
        game.depositTier,
        Object.values(game.fees).join(','),
        game.premium.built.length,
        game.premium.securityOfficers,
        game.premium.feeEnabled ? 1 : 0,
        game.mapId,
        game.mapGoalCards().map((goal) => `${goal.id}:${goal.value}`).join(','),
        game.hallRev,
        game.fits[0]?.tier ?? 0,
        game.fits[0]?.redesigned ? 1 : 0,
        game.securityQueueCount(),
        game.lostPaxCount(),
        game.hallGuests.find((g) => g.id === game.selectedGuest)?.thought ?? '',
        game.selectedFacility ?? '',
        game.showFlows ? 1 : 0,
        game.advice.map((a) => a.id).join(','),
        game.advisorCells.length,
        game.standingAdvisor.activeCards.map((c) => `${c.id}:${c.daysToLeave}`).join(','),
        game.inboundOffer()?.id ?? '',
        game.inboundContracts().map((d) => `${d.id}:${d.status}`).join(','),
        game.inboundHasClearance() ? 1 : 0,
        game.apronFocus.length,
        game.alerts.rev,
        game.recoveryCount,
        game.debugHud ? 1 : 0,
        game.hintPrefs.muted.join(','),
        game.hintPrefs.allEnabled ? 1 : 0,
        game.enableHintsAtStart ? 1 : 0,
        game.sidePanel,
        game.landsideOpen ? 1 : 0,
        game.fuelOpen ? 1 : 0,
        Math.round(game.fuelView().litres),
        game.fuelView().queue.map((row) => `${row.state}:${Math.round(row.progress * 10)}`).join(','),
        game.fuelView().groundedIds.length,
        game.landsideFocus ?? '',
        Math.round(game.landsideView().delaySec),
        Math.round(game.landsideView().queue),
        Math.round(game.landsideView().pressure * 100),
        Math.round(game.landsideView().curbBusy),
        game.landsideView().curbStalls,
        game.missedCheckIns,
        game.playtestYear.rev,
        game.hallOverloaded ? 1 : 0,
        game.sites.length,
        game.hover ? `${game.hover.c},${game.hover.r}` : '',
        game.pendingYearReport()?.year ?? 0,
        Math.floor(game.researchPoints),
        game.wave3.chromeKey(),
        game.researchTree.chromeKey(),
        Math.round(game.tycoonDemand() * 100),
        Math.round(game.tycoonAirlineInterest() * 100),
        council.standing,
        council.pending?.id ?? '',
        council.votes.length,
      ].join('|')
}

/** Keep a route-screen refresh on the hints choice the player just made. */
function setEnableHints(on: boolean) {
  game.enableHintsAtStart = on
  try {
    const raw = sessionStorage.getItem('hatchfield-pending')
    if (raw) {
      const pending = JSON.parse(raw) as { enableHints?: boolean }
      pending.enableHints = on
      sessionStorage.setItem('hatchfield-pending', JSON.stringify(pending))
    }
  } catch {
    /* ignore */
  }
  game.emit()
}

function PlaytestYearMount({ game }: { game: Game }) {
  const report = game.playtestYearCard()
  if (!report) return null
  return <PlaytestYearPanel report={report} onDismiss={() => game.dismissPlaytestYear()} />
}

/** Sim emits plus the throttled cash/clock catch-up. Module-level so the store never resubscribes. */
function subscribeChrome(fn: () => void) {
  const offGame = game.subscribe(fn)
  const offTree = subscribeHudTree(fn)
  return () => {
    offGame()
    offTree()
  }
}

function chromeSnapshot(): string {
  return `${hudSnapshot()}#${hudTreeVersion()}`
}

function CanvasLayers() {
  // Apron play keeps this snapshot stable so the WebGL trees do not reconcile
  // on each HUD tick. The hall chrome subscribes only while that view is open.
  useSyncExternalStore(
    subscribeChrome,
    () => (game.view === 'hall' ? chromeSnapshot() : game.view),
    () => 'apron',
  )
  const view = game.view
  // The hall is a second WebGL context. On SwiftShader that context switch
  // shows up in the compositor even while the canvas is hidden, so it stays
  // unmounted until the player opens Terminal, then it stays warm.
  const [hallLive, setHallLive] = useState(view === 'hall')
  if (view === 'hall' && !hallLive) setHallLive(true)
  return (
    <>
      <div className={`view-layer ${view === 'apron' ? 'live' : 'dim'}`}>
        <Field game={game} />
      </div>
      {hallLive ? (
        <div className={`view-layer ${view === 'hall' ? 'live' : 'dim'}`}>
          <TerminalView game={game} />
        </div>
      ) : null}
    </>
  )
}

function PlayChrome({ onNewGame }: { onNewGame: () => void }) {
  useSyncExternalStore(subscribeChrome, chromeSnapshot, () => 'ssr')
  return (
    <>
      <Hud game={game} onNewGame={onNewGame} />
      <InfoViews game={game} />
      <OfferPanel game={game} />
      <OwnerChrome game={game} />
      <FeedbackChrome />
      <PlaytestYearMount game={game} />
      <CameraChrome view={game.view} clockOf={() => game.clock} />
    </>
  )
}

export default function App() {
  const [screen, setScreenState] = useState<Screen>(() => bootScreen())
  const [section, setSection] = useState<MenuSection>('home')

  const setScreen = (s: Screen) => {
    writeScreen(s)
    setScreenState(s)
  }

  useEffect(() => {
    const stopWatch = watchAudioSettings()
    const disarm = installGestureUnlock(window, undefined, () => {
      applyStoredAudio()
      void preloadAudioClips()
    })
    void preloadAudioClips()
    const unclicks = bindUiClicks()
    return () => {
      stopWatch()
      disarm()
      unclicks()
      game.releaseAudio()
    }
  }, [])

  // Keep screen aligned with game ownership; never dump a saved field to title.
  useEffect(() => {
    if (game.site) {
      if (screen !== 'play') setScreen('play')
      return
    }
    if (screen === 'play') {
      if (Game.hasSave() && game.load()) return
      setScreen('title')
    }
  }, [screen])

  useEffect(() => {
    if (screen !== 'play') return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t0 = perfStart()
      const tickAt = performance.now()
      if (!cameraSession.frozen && !pauseState.open) {
        try {
          game.tick(dt)
          tickLiveFeedback(game)
        } catch (err) {
          console.error('tick failed', err)
        }
      }
      recordSimTick(performance.now() - tickAt)
      perfEnd('sim.tick', t0)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      game.releaseAudio()
    }
  }, [screen])

  const openNewGame = (focus: StartFocus) => {
    game.beginNew(game.sandbox ? 'easy' : 'standard')
    game.startFocus = focus
    setScreen('land')
  }

  if (screen === 'title' || screen === 'land') {
    return (
      <div className="menu-shell">
        <MenuFlyover />
        <div className="menu-scrim" aria-hidden="true" />
        {screen === 'title' ? (
          <TitleScreen
            game={game}
            section={section}
            onSection={setSection}
            sandbox={game.sandbox}
            onSandboxChange={(on) => {
              game.sandbox = on
              game.emit()
            }}
            enableHints={game.enableHintsAtStart}
            onEnableHintsChange={setEnableHints}
            onNewGame={() => openNewGame('pax')}
            onContinue={() => {
              if (game.load()) setScreen('play')
            }}
          />
        ) : (
          <LandScreen
            game={game}
            enableHints={game.enableHintsAtStart}
            onEnableHintsChange={setEnableHints}
            onBought={() => setScreen('play')}
            onBack={() => {
              setSection('home')
              setScreen('title')
            }}
            onContinue={() => {
              if (game.load()) setScreen('play')
            }}
            onNavigate={(next) => {
              setSection(next)
              setScreen('title')
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="shell">
      <CanvasLayers />
      <PlayInput game={game} />
      <PlayChrome
        onNewGame={() => {
          game.beginNew(game.sandbox ? 'easy' : game.difficulty)
          setScreen('title')
        }}
      />
      <PauseMenu
        game={game}
        onQuit={() => {
          setSection('home')
          setScreen('title')
        }}
        onNewGame={() => {
          game.beginNew(game.sandbox ? 'easy' : game.difficulty)
          setSection('home')
          setScreen('title')
        }}
      />
      <PriceWarCard game={game} />
    </div>
  )
}
