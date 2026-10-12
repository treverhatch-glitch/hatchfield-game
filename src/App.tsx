import { useState, useSyncExternalStore } from 'react'
import { Game } from './game/sim'
import { Field } from './ui/Field'
import { Hud } from './ui/Hud'
import { TitleScreen } from './ui/TitleScreen'

const game = new Game()

export default function App() {
  const [playing, setPlaying] = useState(false)
  useSyncExternalStore(
    game.subscribe,
    () =>
      `${game.cash}|${game.speed}|${game.tool}|${game.facing}|${game.selectedFlight}|${game.news[0]?.id}|${game.fuelLoads}|${game.fuelBrand}|${Math.floor(game.clock)}|${game.flights[0]?.phase}|${game.harborUnlocked}|${game.fits.length}`,
    () => 'ssr',
  )

  if (!playing) {
    return <TitleScreen game={game} onPlay={() => setPlaying(true)} />
  }

  return (
    <div className="shell">
      <Field game={game} />
      <Hud game={game} />
    </div>
  )
}
