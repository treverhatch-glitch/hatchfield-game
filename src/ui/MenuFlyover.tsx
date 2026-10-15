import { useEffect, useRef } from 'react'
import { readDayNightCycle } from '../features/settings/settings.ts'
import { Game } from '../game/sim'
import { toWorld, World } from '../render/world'

type Bag = { local: [string, string][]; session: [string, string][] }

/** Copy both stores so the backdrop field cannot eat a real save. */
function readBag(): Bag {
  const local: [string, string][] = []
  const session: [string, string][] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) local.push([key, localStorage.getItem(key) ?? ''])
    }
  } catch {
    /* private mode */
  }
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key) session.push([key, sessionStorage.getItem(key) ?? ''])
    }
  } catch {
    /* private mode */
  }
  return { local, session }
}

function writeBag(bag: Bag) {
  const put = (store: Storage, rows: [string, string][]) => {
    const keep = new Set(rows.map(([key]) => key))
    const drop: string[] = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key && !keep.has(key)) drop.push(key)
    }
    for (const key of drop) store.removeItem(key)
    for (const [key, value] of rows) store.setItem(key, value)
  }
  try {
    put(localStorage, bag.local)
  } catch {
    /* private mode */
  }
  try {
    put(sessionStorage, bag.session)
  } catch {
    /* private mode */
  }
}

/**
 * Live apron behind the start menu. A throwaway field, camera orbiting the
 * passenger starter kit. It never writes the player's save.
 */
export function MenuFlyover() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const bag = readBag()
    let game: Game | null = null
    try {
      game = new Game()
      game.persist = () => {}
      game.sandbox = true
      game.beginNew('easy')
      game.startFocus = 'pax'
      if (game.buyLand('city')) game.buildStarterKit()
      game.speed = 3
    } finally {
      writeBag(bag)
    }
    if (!game?.site) return

    let world: World | null = null
    let raf = 0
    let stopped = false
    try {
      world = new World(canvas)
    } catch (err) {
      console.error('menu flyover', err)
      return
    }
    const aim = toWorld(14, 14)
    world.pivot.set(aim.x, 0, aim.z)
    world.yaw = 0.55
    world.pitch = 0.62
    world.dist = 96
    world.placeCam()

    let last = performance.now()
    let t = 0
    let signed = false
    const live = game
    const loop = (now: number) => {
      if (stopped || !world) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      try {
        if (!signed && live.offer) {
          live.acceptOffer()
          signed = true
        }
        live.tick(dt)
      } catch (err) {
        console.error('menu flyover tick', err)
      }
      live.camGoal = null
      live.dayNightCycle = readDayNightCycle()
      // Same family of shot as the apron camera, drifting so the field reads as a flyover.
      world.yaw = 0.45 + t * 0.07
      world.pitch = 0.58 + Math.sin(t * 0.11) * 0.04
      world.dist = 86 + Math.sin(t * 0.08) * 8
      world.placeCam()
      try {
        world.render(live)
      } catch (err) {
        console.error('menu flyover render', err)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      world?.dispose()
    }
  }, [])

  return <canvas ref={ref} className="menu-flyover" data-testid="menu-flyover" aria-hidden="true" />
}
