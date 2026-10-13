import { useEffect, useRef } from 'react'
import { NODE_POS, paxTagColor, paxTagLabel } from '../game/guests'
import type { Game } from '../game/sim'
import { HallWorld } from '../render/hallWorld'

/**
 * 3D hall — WASD/arrows pan, Q/E rotate, scroll zoom, middle/right orbit.
 * Apron keeps simulating in the background.
 */
export function TerminalView({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<HallWorld | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const world = new HallWorld(canvas)
    worldRef.current = world
    const keys = new Set<string>()
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (game.view !== 'hall') return
      keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (game.view === 'hall') {
        const w = worldRef.current
        if (w) {
          const speed = 18 * dt
          let fx = 0
          let fy = 0
          if (keys.has('w') || keys.has('ArrowUp')) fy -= speed
          if (keys.has('s') || keys.has('ArrowDown')) fy += speed
          if (keys.has('a') || keys.has('ArrowLeft')) fx -= speed
          if (keys.has('d') || keys.has('ArrowRight')) fx += speed
          if (fx || fy) w.nudgePan(fx, fy)
          if (keys.has('q')) w.nudgeYaw(1.4 * dt)
          if (keys.has('e')) w.nudgeYaw(-1.4 * dt)
          w.render(game)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      cancelAnimationFrame(raf)
      worldRef.current = null
      world.dispose()
    }
  }, [game])

  const guest = game.hallGuests.find((g) => g.id === game.selectedGuest)

  return (
    <div className="hall-wrap">
      <canvas ref={ref} className="hall-canvas" />
      <div className="hall-chrome">
        <p className="muted">
          3D hall · WASD/arrows pan · Q/E rotate · scroll zoom · Esc leaves · V apron · H hides UI
          {game.hasSecurityChoke()
            ? ' · security choke live'
            : ' · NO SECURITY — checkpoint missing'}
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
            <li>At {NODE_POS[guest.node].label}</li>
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
            <li>{guest.clearedSec ? 'Cleared security' : 'Before security'}</li>
          </ul>
        </aside>
      ) : null}
    </div>
  )
}
