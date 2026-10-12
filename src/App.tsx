import { useEffect, useState, useSyncExternalStore } from 'react'
import { Game } from './game/sim'
import { Field } from './ui/Field'
import { Hud } from './ui/Hud'
import { LandScreen } from './ui/LandScreen'
import { TerminalView } from './ui/TerminalView'
import { TitleScreen } from './ui/TitleScreen'

const game = new Game()

type Screen = 'title' | 'land' | 'play'

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')

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
      `${game.cash}|${game.speed}|${game.tool}|${game.facing}|${game.site}|${game.view}|${game.offer?.airline}|${game.signed.join(',')}|${game.selectedFlight}|${game.selectedGuest}|${game.news[0]?.id}|${game.fuelLoads}|${game.caterBrand}|${Math.round(game.reputation)}|${game.loanBalance}|${game.parcels}|${game.railLinked}|${game.public}|${game.sharePrice}|${game.sharesOwned}|${game.mission?.id}|${Math.floor(game.clock)}|${game.flights[0]?.phase}|${game.hallGuests.length}|${game.fits.length}`,
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
      {game.view === 'hall' ? <TerminalView game={game} /> : <Field game={game} />}
      <Hud game={game} />
    </div>
  )
}
