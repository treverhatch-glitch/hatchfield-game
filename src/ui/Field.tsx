import { useEffect, useRef, useState } from 'react'
import type { ApronInspect, Game } from '../game/sim'
import { World } from '../render/world'

export function Field({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const [inspect, setInspect] = useState<ApronInspect | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const world = new World(canvas)
    worldRef.current = world
    if (import.meta.env.DEV) {
      ;(window as unknown as { __world?: World }).__world = world
    }
    world.onHover = (v) => {
      if (game.view !== 'apron') {
        setInspect(null)
        return
      }
      game.setHover(v)
      setInspect(game.inspectEnabled() ? game.hoverInspect : null)
    }
    world.onClick = (v) => {
      if (game.view !== 'apron') return
      game.clickTile(v)
    }
    world.getTool = () => game.tool

    const keys = new Set<string>()
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Escape') {
        game.exitHall()
        return
      }
      if (e.key === 'h' || e.key === 'H') {
        game.setView(game.view === 'hall' ? 'apron' : 'hall')
        return
      }
      if (game.view !== 'apron') return
      if (e.key === 'r' || e.key === 'R') {
        game.rotatePiece()
        return
      }
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
      if (game.view === 'apron') {
        const w = worldRef.current
        if (w) {
          const speed = 28 * dt
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
        if (game.hover && game.inspectEnabled()) {
          const next = game.inspectAt(game.hover)
          setInspect((prev) => {
            if (!next) return null
            if (
              prev &&
              next.kind === prev.kind &&
              next.kind === 'flight' &&
              prev.kind === 'flight' &&
              next.flightId === prev.flightId &&
              next.activity === prev.activity &&
              next.fuel === prev.fuel &&
              next.catering === prev.catering &&
              next.next === prev.next
            ) {
              return prev
            }
            if (
              prev &&
              next.kind === 'hangar' &&
              prev.kind === 'hangar' &&
              next.occupant === prev.occupant &&
              Math.floor(next.remaining) === Math.floor(prev.remaining) &&
              next.blurb === prev.blurb
            ) {
              return prev
            }
            return next
          })
        } else if (!game.inspectEnabled()) {
          setInspect(null)
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
      const probe = window as unknown as { __world?: World }
      if (probe.__world === world) probe.__world = undefined
      world.dispose()
    }
  }, [game])

  return (
    <div className="field-wrap">
      <canvas ref={ref} className="field" />
      {inspect && game.view === 'apron' ? (
        <aside className="inspect-card" data-kind={inspect.kind}>
          {inspect.kind === 'flight' ? (
            <>
              <header>
                <strong>{inspect.callsign}</strong>
                <span className="muted">{inspect.airline}</span>
              </header>
              <p className="inspect-model">{inspect.model}</p>
              <p className="inspect-line">
                <span className="muted">To</span> {inspect.destination}
                <span className="muted"> · </span>
                {inspect.gate}
              </p>
              <p className="muted inspect-next" style={{ marginTop: 2 }}>
                Access{' '}
                {inspect.gate.includes('JW')
                  ? 'jetway'
                  : inspect.gate.includes('bus')
                    ? 'terminal bus'
                    : 'apron walk'}
              </p>
              <p className="inspect-activity">{inspect.activity}</p>
              <p className="muted inspect-next">{inspect.next}</p>
              {inspect.mx ? <p className="inspect-mx">{inspect.mx}</p> : null}
              <div className="service-bars">
                <label>
                  <span>Fuel</span>
                  <span className="bar-val">{inspect.fuel}%</span>
                  <span className="bar">
                    <i style={{ width: `${inspect.fuel}%` }} />
                  </span>
                </label>
                <label>
                  <span>Catering</span>
                  <span className="bar-val">{inspect.catering}%</span>
                  <span className="bar">
                    <i style={{ width: `${inspect.catering}%` }} />
                  </span>
                </label>
              </div>
            </>
          ) : (
            <>
              <header>
                <strong>{inspect.title}</strong>
                <span className="muted">Maintenance</span>
              </header>
              <p className="inspect-model">
                {inspect.occupant === 'Empty' ? 'No aircraft' : inspect.occupant}
              </p>
              {inspect.occupant !== 'Empty' ? (
                <>
                  <p className="inspect-line">{inspect.model}</p>
                  <p className="inspect-activity">{inspect.blurb}</p>
                  {inspect.total > 0 ? (
                    <div className="service-bars">
                      <label>
                        <span>MX progress</span>
                        <span className="bar-val">{Math.ceil(inspect.remaining)}s</span>
                        <span className="bar">
                          <i
                            style={{
                              width: `${Math.max(
                                4,
                                (1 - inspect.remaining / Math.max(1, inspect.total)) * 100,
                              )}%`,
                            }}
                          />
                        </span>
                      </label>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="muted inspect-next">{inspect.blurb}</p>
              )}
            </>
          )}
        </aside>
      ) : null}
    </div>
  )
}
