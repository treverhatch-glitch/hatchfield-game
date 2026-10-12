import { useEffect, useRef } from 'react'
import { HALL_EDGES, isAirside, NODE_POS, type HallNode } from '../game/guests'
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
      if (game.view !== 'hall') {
        raf = requestAnimationFrame(draw)
        return
      }
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

      // Landside (city doors) vs airside (gates) wash — reads the cut.
      const land = ctx.createLinearGradient(0, 0, w * 0.45, 0)
      land.addColorStop(0, 'rgba(90, 140, 110, 0.14)')
      land.addColorStop(1, 'rgba(90, 140, 110, 0)')
      ctx.fillStyle = land
      ctx.fillRect(0, 0, w * 0.42, h)
      const air = ctx.createLinearGradient(w * 0.55, 0, w, 0)
      air.addColorStop(0, 'rgba(70, 120, 170, 0)')
      air.addColorStop(1, 'rgba(70, 120, 170, 0.16)')
      ctx.fillStyle = air
      ctx.fillRect(w * 0.55, 0, w * 0.45, h)
      ctx.fillStyle = 'rgba(232,238,244,0.35)'
      ctx.font = '700 13px IBM Plex Sans, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('LANDSIDE', 24, h - 28)
      ctx.textAlign = 'right'
      ctx.fillText('AIRSIDE', w - 24, h - 28)
      // Secure line marker near security x
      const secX = NODE_POS.security.x * w
      ctx.strokeStyle = 'rgba(201,162,39,0.45)'
      ctx.setLineDash([6, 6])
      ctx.beginPath()
      ctx.moveTo(secX, 48)
      ctx.lineTo(secX, h - 48)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(201,162,39,0.7)'
      ctx.font = '600 11px IBM Plex Sans, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('secure line', secX, 40)

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

      const hasSec = open.has('security')
      // Rooms
      for (const id of Object.keys(NODE_POS) as HallNode[]) {
        const p = NODE_POS[id]
        const x = p.x * w
        const y = p.y * h
        const live = open.has(id)
        const lockedAir = live && isAirside(id) && !hasSec
        ctx.fillStyle = lockedAir ? '#5a3a2a' : live ? '#2f6f9a' : '#3a4448'
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
        ctx.strokeStyle = lockedAir ? '#e09a4a' : live ? '#c9a227' : '#555'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = live ? '#e8eef4' : '#888'
        ctx.font = '600 12px IBM Plex Sans, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(lockedAir ? `${p.label}!` : p.label, x, y)
      }

      // Desk staff bodies (squares) — not just budget sliders.
      for (const s of game.hallStaff) {
        const p = NODE_POS[s.node]
        const x = p.x * w + (s.id.charCodeAt(4) % 5) - 2
        const y = p.y * h - 18
        ctx.fillStyle = s.stage === 0 ? s.color : '#666'
        ctx.fillRect(x - 5, y - 5, 10, 10)
        ctx.strokeStyle = '#e8eef4'
        ctx.lineWidth = 1
        ctx.strokeRect(x - 5, y - 5, 10, 10)
      }

      // Researchers walk R&D desk → chalkboard → lab bench; break/home leave the corner.
      for (const p of game.people) {
        if (p.job !== 'researcher') continue
        let node: HallNode =
          p.stage === 1
            ? 'lab_board'
            : p.stage === 2
              ? 'lab_bench'
              : p.stage === 3
                ? open.has('food')
                  ? 'food'
                  : open.has('bathroom')
                    ? 'bathroom'
                    : 'exit'
                : p.stage === 4
                  ? 'exit'
                  : open.has('lab_desk')
                    ? 'lab_desk'
                    : 'info'
        if (p.stage === 1 && !open.has('lab_board')) node = open.has('lab_desk') ? 'lab_desk' : 'info'
        if (p.stage === 2 && !open.has('lab_bench')) {
          node = open.has('lab_board')
            ? 'lab_board'
            : open.has('lab_desk')
              ? 'lab_desk'
              : 'info'
        }
        const np = NODE_POS[node]
        const jx = ((p.id.charCodeAt(4) % 5) - 2) * 3
        const jy = ((p.id.charCodeAt(5) % 5) - 2) * 3
        const x = np.x * w + jx
        const y = np.y * h + jy - 14
        ctx.fillStyle = p.stage >= 3 ? '#5a6570' : p.color
        ctx.beginPath()
        ctx.moveTo(x, y - 6)
        ctx.lineTo(x + 5, y + 5)
        ctx.lineTo(x - 5, y + 5)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(232,238,244,0.55)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      const hallKey = fit ? game.hallKey(fit) : null
      const hallGuests = game.hallGuests.filter(
        (g) => !g.hallId || !hallKey || g.hallId === hallKey,
      )

      // Guests — only this campus hall's crowd
      for (const g of hallGuests) {
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
      ctx.fillRect(16, 16, 300, fit ? 64 : 48)
      ctx.fillStyle = '#e8eef4'
      ctx.font = '600 14px IBM Plex Sans, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(
        fit ? `Inside ${game.hallLabel(fit)}` : 'Inside the terminal',
        28,
        38,
      )
      ctx.fillStyle = '#b7c4b8'
      ctx.font = '12px IBM Plex Sans, sans-serif'
      const lab = game.labCrewStatus()
      ctx.fillText(
        fit
          ? `${hallGuests.length} guests · ${game.standsForHall(fit).length} jetways · staff ${game.hallStaff.filter((s) => s.stage === 0).length}/${game.deskStaff} · R&D ${lab.working}/${lab.total} · secure ${hasSec ? 'open' : 'LOCKED'}`
          : 'Stamp a Premade hall or furnish a Shell outside first.',
        28,
        58,
      )

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const onClick = (e: MouseEvent) => {
      if (game.view !== 'hall') return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      let best: string | null = null
      let dist = 16
      const clickHall = game.activeHall()
      const clickKey = clickHall ? game.hallKey(clickHall) : null
      for (const g of game.hallGuests) {
        if (g.hallId && clickKey && g.hallId !== clickKey) continue
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
            <span
              style={{
                color:
                  guest.tag === 'premium'
                    ? '#c9a227'
                    : guest.tag === 'business'
                      ? '#6a9ec8'
                      : guest.tag === 'family'
                        ? '#7aaf78'
                        : '#b7c4b8',
              }}
            >
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
            <li>
              Wallet ${guest.wallet} · spent ${guest.spent}
            </li>
            <li className="muted" style={{ fontSize: 12 }}>
              Prefs food {guest.prefs.food.toFixed(2)} · shop{' '}
              {guest.prefs.shop.toFixed(2)} · play {guest.prefs.play.toFixed(2)} · nap{' '}
              {guest.prefs.nap.toFixed(2)} · landside {guest.prefs.landside.toFixed(2)}
            </li>
          </ul>
        </aside>
      ) : null}
    </div>
  )
}
