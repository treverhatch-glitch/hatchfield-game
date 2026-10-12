import { useEffect, useRef } from 'react'
import type { Game } from '../game/sim'
import { World } from '../render/world'

export function Field({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const world = new World(canvas)
    world.onHover = (v) => {
      if (game.view !== 'apron') return
      game.hover = v
    }
    world.onClick = (v) => {
      if (game.view !== 'apron') return
      game.clickTile(v)
    }
    world.getTool = () => game.tool
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        game.exitHall()
        return
      }
      if (e.key === 'h' || e.key === 'H') {
        game.setView(game.view === 'hall' ? 'apron' : 'hall')
        return
      }
      if (game.view !== 'apron') return
      if (e.key === 'r' || e.key === 'R') game.rotatePiece()
    }
    window.addEventListener('keydown', onKey)
    let raf = 0
    const loop = () => {
      // Skip GL work while Hall is front — both layers stay mounted for crossfade.
      if (game.view === 'apron') world.render(game)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
      world.dispose()
    }
  }, [game])

  return <canvas ref={ref} className="field" />
}
