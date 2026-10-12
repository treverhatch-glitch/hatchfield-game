import { useEffect, useState, useSyncExternalStore } from 'react'
import { Game } from './game/sim'
import { Field } from './ui/Field'
import { Hud } from './ui/Hud'
import { LandScreen } from './ui/LandScreen'
import { TerminalView } from './ui/TerminalView'
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

function bootScreen(): Screen {
  // In-memory plot wins (HMR remount).
  if (game.site) return 'play'
  // Reload mid-session — restore save before showing title.
  if (Game.hasSave() && game.load()) return 'play'
  return readScreen()
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
        game.mxOffer?.airline,
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
        game.parcels,
        game.railLinked,
        game.public,
        game.sharePrice,
        game.sharesOwned,
        game.mission?.id,
        Math.floor(game.clock),
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
      ].join('|'),
    () => 'ssr',
  )

  if (screen === 'title') {
    return (
      <TitleScreen
        onEasy={() => {
          game.beginNew('easy')
          setScreen('land')
        }}
        onStandard={() => {
          game.beginNew('standard')
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
    </div>
  )
}
