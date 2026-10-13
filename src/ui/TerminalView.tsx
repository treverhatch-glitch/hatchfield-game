import { useEffect, useState, useRef } from 'react'
import { money } from '../game/catalog'
import { NODE_POS, paxTagColor, paxTagLabel } from '../game/guests'
import type { Game } from '../game/sim'
import { HallWorld } from '../render/hallWorld'
import {
  GRID_C,
  GRID_R,
  ceilingsFor,
  itemsForZone,
  moodWord,
  needsMaintenance,
  PREFAB_TIERS,
  zoneDef,
  type ZoneId,
} from '../game/terminal'

/**
 * 3D hall — WASD/arrows pan, Q/E rotate, scroll zoom, middle/right orbit.
 * Apron keeps simulating in the background.
 */
export function TerminalView({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<HallWorld | null>(null)
  const [zone, setZone] = useState<ZoneId | null>(null)

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
  const fit = game.activeHall()
  const tier = (fit?.tier ?? 1) as 1 | 2 | 3
  const prefab = Boolean(fit?.premade && !fit?.redesigned)
  const nextTier = tier < 3 ? ((tier + 1) as 2 | 3) : null
  const queue = game.securityQueueCount()
  const lost = game.lostPaxCount()
  const wear = fit?.wearSec ?? 0
  const zoneItems = zone ? itemsForZone(zone) : []
  const zones = fit?.zones
  const ceil = fit
    ? ceilingsFor({
        premade: fit.premade,
        redesigned: fit.redesigned,
        tier: fit.tier,
        items: fit.items as never,
        roomsSecurity: fit.rooms.security,
      })
    : null

  return (
    <div className="hall-wrap">
      <canvas ref={ref} className="hall-canvas" />
      <div className="hall-chrome">
        <p className="muted">
          Roof cut away · WASD pan · Q/E rotate · click a person
          {game.hasSecurityChoke() ? ' · security choke live' : ' · NO SECURITY LANE'}
          {' · '}
          {game.hallGuests.length} pax
        </p>
      </div>
      {queue >= 3 || lost > 0 ? (
        <div className="hall-alert" data-testid="bottleneck">
          {queue >= 3 ? `Security bottleneck — ${queue} waiting` : null}
          {queue >= 3 && lost > 0 ? ' · ' : null}
          {lost > 0 ? `${lost} lost` : null}
          {needsMaintenance(wear) ? ' · lane needs a scrub' : null}
        </div>
      ) : null}
      <aside className="hall-build" data-testid="hall-build">
        <div data-testid="prefab-ceilings">
          <strong>{prefab ? PREFAB_TIERS[tier].label : 'Custom hall'}</strong>
          <p>
            {fit?.capGuests ?? 0} passengers · security {Math.round(fit?.secPerMin ?? 0)}/min · bags{' '}
            {fit?.bagAllowance ?? 0}
          </p>
          <p className="muted">
            Upkeep ${ceil?.upkeepDay ?? 0}/day
            {prefab ? ' · prefab bundle' : ' · per item, prefab discount off'}
          </p>
        </div>
        {prefab && nextTier ? (
          <button
            type="button"
            data-testid="upgrade-prefab"
            onClick={() => game.upgradeHall()}
          >
            Upgrade to {PREFAB_TIERS[nextTier].label} · {money(PREFAB_TIERS[nextTier].upgradeCost)}
            <span>
              {PREFAB_TIERS[nextTier].paxCap} pax · {Math.round(PREFAB_TIERS[nextTier].servers / PREFAB_TIERS[nextTier].serviceSec * 60)}
              /min · upkeep ${PREFAB_TIERS[nextTier].upkeepDay}/day
            </span>
          </button>
        ) : (
          <p className="muted">Place bigger items to raise a custom hall.</p>
        )}
        <div className="zone-bar" data-testid="zone-bar">
          {(['checkin', 'security', 'gates', 'arrivals', 'retail', 'toilets'] as ZoneId[]).map((id) => (
            <button
              key={id}
              type="button"
              data-testid={`zone-${id}`}
              className={zone === id ? 'on' : ''}
              style={{ borderColor: zoneDef(id).color }}
              onClick={() => setZone(id)}
            >
              {zoneDef(id).label}
            </button>
          ))}
        </div>
        {zone ? (
          <div className="item-menu" data-testid="item-menu">
            {zoneItems.map((item) => {
              const locked = game.fieldLevel() < item.minFieldLevel
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`item-${item.id}`}
                  disabled={locked}
                  title={item.blurb}
                  onClick={() => game.placeHallItem(item.id)}
                >
                  <span>{item.name}</span>
                  <span>
                    {locked ? `Field ${item.minFieldLevel}` : money(item.cost)} · ${item.upkeep}/day
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="muted">Pick a zone. The menu only lists what fits there.</p>
        )}
        <div
          className="zone-plan"
          data-testid="zone-plan"
          style={{
            gridTemplateColumns: `repeat(${zones?.[0]?.length || GRID_C}, 1fr)`,
          }}
        >
          {Array.from({ length: zones?.length || GRID_R }, (_, r) =>
            Array.from({ length: zones?.[r]?.length || zones?.[0]?.length || GRID_C }, (_, c) => {
              const painted = (zones?.[r]?.[c] ?? null) as ZoneId | null
              const color = painted ? zoneDef(painted).color : '#2a3840'
              return (
                <button
                  key={`${c}-${r}`}
                  type="button"
                  data-testid={`cell-${c}-${r}`}
                  style={{ background: color }}
                  title={painted ? zoneDef(painted).label : 'Bare'}
                  onClick={() => {
                    if (zone) game.paintHallCell(c, r, zone)
                  }}
                />
              )
            }),
          )}
        </div>
      </aside>
      {guest ? (
        <aside className="guest-card" data-testid="guest-card">
          <h2>
            {guest.name}{' '}
            <span style={{ color: paxTagColor(guest.tag) }}>{paxTagLabel(guest.tag)}</span>
          </h2>
          <p className="mood" data-testid="guest-thought">
            {moodWord(guest.happiness)}
            {guest.lost ? ' · lost' : ''} — {guest.thought}
          </p>
          <ul>
            <li>At {NODE_POS[guest.node].label}</li>
            <li>
              Hunger <i style={{ width: `${Math.round(guest.needs.hunger)}%` }} />
            </li>
            <li>
              Bathroom <i style={{ width: `${Math.round(guest.needs.bladder)}%` }} />
            </li>
            <li>
              Energy <i style={{ width: `${Math.round(guest.needs.energy)}%` }} />
            </li>
            <li>
              Shop <i style={{ width: `${Math.round(guest.needs.shop)}%` }} />
            </li>
            {guest.job === 'depart' ? (
              <li>Boarding clock {guest.needs.boarding.toFixed(0)}m</li>
            ) : (
              <li>Bags {Math.round(guest.needs.bags)}</li>
            )}
            <li>Mood {Math.round(guest.happiness)}</li>
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
