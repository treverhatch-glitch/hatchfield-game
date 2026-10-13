import { useEffect, useRef } from 'react'
import { paxTagColor, paxTagLabel } from '../game/guests'
import type { Game } from '../game/sim'
import { HallWorld } from '../render/hallWorld'

/**
 * 3D hall — orbit/pan like the apron. Apron keeps simulating in the background
 * (Field skips GL while this view is live; Game.tick still runs both).
 */
export function TerminalView({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const world = new HallWorld(canvas)
    let raf = 0
    const loop = () => {
      if (game.view === 'hall') world.render(game)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      world.dispose()
    }
  }, [game])

  const guest = game.hallGuests.find((g) => g.id === game.selectedGuest)

  return (
    <div className="hall-wrap">
      <canvas ref={ref} className="hall-canvas" />
      <div className="hall-chrome">
        <p className="muted">
          3D hall · drag orbit · shift-drag pan · scroll zoom · Esc/H apron
          {game.hasSecurityChoke()
            ? ' · security choke live'
            : ' · NO SECURITY — airside risk'}
          {' · '}
          {game.hallGuests.length} pax (apron still simming)
        </p>
      </div>
      {guest ? (
        <aside className="guest-card">
          <h2>
            {guest.name}{' '}
            <span style={{ color: paxTagColor(guest.tag) }}>{paxTagLabel(guest.tag)}</span>
          </h2>
          <p className="muted">{guest.thought}</p>
          <ul>
            <li>At {guest.node}</li>
            <li>Hunger {Math.round(guest.needs.hunger)}</li>
            <li>Bathroom {Math.round(guest.needs.bladder)}</li>
            <li>Energy {Math.round(guest.needs.energy)}</li>
            <li>Shop itch {Math.round(guest.needs.shop)}</li>
            {guest.job === 'depart' ? (
              <li>Boarding clock {guest.needs.boarding.toFixed(0)}m</li>
            ) : (
              <li>Bags {Math.round(guest.needs.bags)}</li>
            )}
            <li>Happiness {Math.round(guest.happiness)}</li>
            <li>
              Wallet ${guest.wallet} · spent ${guest.spent}
            </li>
            <li className="muted" style={{ fontSize: 12 }}>
              Prefs food {guest.prefs.food.toFixed(2)} · shop {guest.prefs.shop.toFixed(2)} ·
              landside {guest.prefs.landside.toFixed(2)}
            </li>
            <li>{guest.clearedSec ? 'Cleared security' : 'Landside — must clear security'}</li>
          </ul>
        </aside>
      ) : null}
    </div>
  )
}
