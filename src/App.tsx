import { useState, useSyncExternalStore } from 'react'
import { Game } from './game/sim'
import { Field } from './ui/Field'
import { Hud } from './ui/Hud'
import { LandScreen } from './ui/LandScreen'
import { TitleScreen } from './ui/TitleScreen'

const game = new Game()

type Screen = 'title' | 'land' | 'play'

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  useSyncExternalStore(
    game.subscribe,
    () =>
      `${game.cash}|${game.speed}|${game.tool}|${game.facing}|${game.site}|${game.offer?.airline}|${game.signed.join(',')}|${game.selectedFlight}|${game.news[0]?.id}|${game.fuelLoads}|${game.caterBrand}|${Math.round(game.reputation)}|${Math.floor(game.clock)}|${game.flights[0]?.phase}|${game.fits.length}`,
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
      <Field game={game} />
      <Hud game={game} />
    </div>
  )
}
