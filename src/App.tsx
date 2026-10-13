import { useEffect, useState, useSyncExternalStore } from 'react'
import { Game } from './game/sim'
import { Field } from './ui/Field'
import { Hud } from './ui/Hud'
import { LandScreen } from './ui/LandScreen'
import { TerminalView } from './ui/TerminalView'
import { OwnerChrome } from './ui/isolated/OwnerChrome'
import { TitleScreen } from './ui/TitleScreen'

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

// Dev-only probe for playtests (stripped from production builds).
if (import.meta.env.DEV) {
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
    const pending = JSON.parse(raw) as { sandbox?: boolean; difficulty?: 'easy' | 'standard' }
    game.sandbox = Boolean(pending.sandbox)
    game.beginNew(pending.difficulty === 'standard' ? 'standard' : 'easy')
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

export default function App() {
  const [screen, setScreenState] = useState<Screen>(() => bootScreen())

  const setScreen = (s: Screen) => {
    writeScreen(s)
    setScreenState(s)
  }

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
      try {
        game.tick(dt)
      } catch (err) {
        console.error('tick failed', err)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [screen])

  useSyncExternalStore(
    game.subscribe,
    () =>
      [
        game.cash,
        game.speed,
        game.tool,
        game.facing,
        game.site,
        game.view,
        game.offer?.airline,
        Math.ceil(game.offer?.deadline ?? 0),
        game.mxOffer?.airline,
        Math.ceil(game.mxOffer?.deadline ?? 0),
        game.fieldTask?.id,
        Math.ceil(game.fieldTaskLeft()),
        game.cargoVolume?.id,
        game.cargoVolume?.delivered,
        Math.ceil(game.cargoVolumeLeft()),
        game.cargoWarehouse,
        game.startFocus,
        game.layoverOffer?.airline,
        game.layover?.airline,
        game.hubOffer?.airline,
        game.parkingOffer?.callsign,
        game.pendingThreat?.id,
        game.pendingEmergency?.id,
        game.signed.join(','),
        game.selectedFlight,
        game.selectedGuest,
        game.news[0]?.id,
        game.fuelLoads,
        game.caterBrand,
        Math.round(game.reputation),
        game.loanBalance,
        game.loanProductId,
        game.fieldXp,
        game.fieldLevel(),
        game.parcels,
        game.railLinked,
        game.public,
        game.sharePrice,
        game.sharesOwned,
        game.mission?.id,
        Math.floor(game.clock / 2),
        game.flights[0]?.phase,
        game.flights[0]?.airframeId,
        game.hallGuests.length,
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
        game.hallRev,
        game.fits[0]?.tier ?? 0,
        game.fits[0]?.redesigned ? 1 : 0,
        game.securityQueueCount(),
        game.lostPaxCount(),
        game.hallGuests.find((g) => g.id === game.selectedGuest)?.thought ?? '',
        game.showFlows ? 1 : 0,
        game.advice.length,
        game.advisorCells.length,
        game.hallOverloaded ? 1 : 0,
        game.sites.map((s) => Math.round(s.elapsed)).join(','),
        game.hover ? `${game.hover.c},${game.hover.r}` : '',
      ].join('|'),
    () => 'ssr',
  )

  if (screen === 'title') {
    return (
      <TitleScreen
        sandbox={game.sandbox}
        onSandboxChange={(on) => {
          game.sandbox = on
          game.emit()
        }}
        onNewGame={() => {
          game.beginNew(game.sandbox ? 'easy' : 'standard')
          setScreen('land')
        }}
        onContinue={() => {
          if (game.load()) setScreen('play')
        }}
      />
    )
  }

  if (screen === 'land') {
    return <LandScreen game={game} onBought={() => setScreen('play')} />
  }

  return (
    <div className="shell">
      <div className={`view-layer ${game.view === 'apron' ? 'live' : 'dim'}`}>
        <Field game={game} />
      </div>
      <div className={`view-layer ${game.view === 'hall' ? 'live' : 'dim'}`}>
        <TerminalView game={game} />
      </div>
      <Hud game={game} />
      <OwnerChrome game={game} />
    </div>
  )
}
