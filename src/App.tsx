import { useEffect, useState, useSyncExternalStore } from 'react'
import { Game } from './game/sim'
import { Field } from './ui/Field'
import { Hud } from './ui/Hud'
import { LandScreen } from './ui/LandScreen'
import { TerminalView } from './ui/TerminalView'
import { TitleScreen } from './ui/TitleScreen'

const game = new Game()
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

export default function App() {
  const [screen, setScreenState] = useState<Screen>(() => {
    // HMR / remount recovery — keep play if the in-memory field still has a plot.
    if (game.site) return 'play'
    return readScreen()
  })

  const setScreen = (s: Screen) => {
    writeScreen(s)
    setScreenState(s)
  }

  // If React remounted onto title but the singleton game still owns a plot, jump back in.
  useEffect(() => {
    if (screen === 'title' && game.site) setScreen('play')
    if (screen === 'land' && game.site) setScreen('play')
    if (screen === 'play' && !game.site) setScreen('title')
  }, [screen])

  useEffect(() => {
    if (screen !== 'play') return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      game.tick(dt)
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
