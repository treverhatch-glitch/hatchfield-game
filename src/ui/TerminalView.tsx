import { useEffect, useRef } from 'react'
import { HALL_EDGES, NODE_POS, type HallNode } from '../game/guests'
import type { Game } from '../game/sim'

export function TerminalView({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.clearRect(0, 0, w, h)

      // Hall atmosphere
      const grad = ctx.createLinearGradient(0, 0, w, h)
      grad.addColorStop(0, '#1a2a32')
      grad.addColorStop(1, '#243840')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // Floor tiles
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      const open = game.hallOpen()
      const fit = game.activeHall()

      // Edges
      ctx.lineWidth = 6
      for (const [a, b] of HALL_EDGES) {
        if (!open.has(a) || !open.has(b)) continue
        const pa = NODE_POS[a]
        const pb = NODE_POS[b]
        ctx.strokeStyle = 'rgba(201,162,39,0.35)'
        ctx.beginPath()
        ctx.moveTo(pa.x * w, pa.y * h)
        ctx.lineTo(pb.x * w, pb.y * h)
        ctx.stroke()
      }

      // Rooms
      for (const id of Object.keys(NODE_POS) as HallNode[]) {
        const p = NODE_POS[id]
        const x = p.x * w
        const y = p.y * h
        const live = open.has(id)
        ctx.fillStyle = live ? '#2f6f9a' : '#3a4448'
        ctx.beginPath()
        ctx.moveTo(x - 34, y - 20)
        ctx.lineTo(x + 34, y - 20)
        ctx.lineTo(x + 42, y - 12)
        ctx.lineTo(x + 42, y + 12)
        ctx.lineTo(x + 34, y + 20)
        ctx.lineTo(x - 34, y + 20)
        ctx.lineTo(x - 42, y + 12)
        ctx.lineTo(x - 42, y - 12)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = live ? '#c9a227' : '#555'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = live ? '#e8eef4' : '#888'
        ctx.font = '600 12px IBM Plex Sans, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.label, x, y)
      }

      // Guests
      for (const g of game.hallGuests) {
        let x = NODE_POS[g.node].x * w
        let y = NODE_POS[g.node].y * h
        if (g.path.length && g.seg < g.path.length - 1) {
          const a = NODE_POS[g.path[g.seg]]
          const b = NODE_POS[g.path[g.seg + 1]]
          x = (a.x + (b.x - a.x) * g.t) * w
          y = (a.y + (b.y - a.y) * g.t) * h
        }
        // jitter so crowds read as a cluster
        const jx = ((g.id.charCodeAt(2) % 7) - 3) * 3
        const jy = ((g.id.charCodeAt(3) % 7) - 3) * 3
        ctx.fillStyle = g.color
        ctx.beginPath()
        ctx.arc(x + jx, y + jy, game.selectedGuest === g.id ? 7 : 5, 0, Math.PI * 2)
        ctx.fill()
        if (game.selectedGuest === g.id) {
          ctx.strokeStyle = '#e6c85a'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      ctx.fillStyle = 'rgba(10,20,16,0.72)'
      ctx.fillRect(16, 16, 280, fit ? 64 : 48)
      ctx.fillStyle = '#e8eef4'
      ctx.font = '600 14px IBM Plex Sans, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('Terminal hall · RCT-style needs', 28, 38)
      ctx.fillStyle = '#b7c4b8'
      ctx.font = '12px IBM Plex Sans, sans-serif'
      ctx.fillText(
        fit
          ? `${game.hallGuests.length} guests · click a dot · missing rooms = lost people`
          : 'Stamp a Premade hall or furnish a Shell first.',
        28,
        58,
      )

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      let best: string | null = null
      let dist = 16
      for (const g of game.hallGuests) {
        let x = NODE_POS[g.node].x * w
        let y = NODE_POS[g.node].y * h
        if (g.path.length && g.seg < g.path.length - 1) {
          const a = NODE_POS[g.path[g.seg]]
          const b = NODE_POS[g.path[g.seg + 1]]
          x = (a.x + (b.x - a.x) * g.t) * w
          y = (a.y + (b.y - a.y) * g.t) * h
        }
        const d = Math.hypot(mx - x, my - y)
        if (d < dist) {
          dist = d
          best = g.id
        }
      }
      game.selectGuest(best)
    }
    canvas.addEventListener('click', onClick)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('click', onClick)
    }
  }, [game])

  const guest = game.hallGuests.find((g) => g.id === game.selectedGuest)

  return (
    <div className="hall-wrap">
      <canvas ref={ref} className="hall-canvas" />
      {guest ? (
        <aside className="guest-card">
          <h2>
            {guest.name}{' '}
            <span style={{ color: guest.tag === 'premium' ? '#c9a227' : '#b7c4b8' }}>
              {guest.tag}
            </span>
          </h2>
          <p className="muted">{guest.thought}</p>
          <ul>
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
            <li>Spent ${guest.spent}</li>
          </ul>
        </aside>
      ) : null}
    </div>
  )
}
