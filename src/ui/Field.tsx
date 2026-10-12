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
      game.hover = v
    }
    world.onClick = (v) => {
      game.clickTile(v)
    }
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      game.tick(dt)
      world.render(game)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      world.dispose()
    }
  }, [game])

  return <canvas ref={ref} className="field" />
}
