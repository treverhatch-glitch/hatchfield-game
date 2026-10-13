import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { pngName, savePng } from '../camera/capture.ts'
import { cameraSession } from '../camera/session.ts'
import { money } from '../game/catalog'
import { lockTip, unlockLevel } from '../progression/unlocks'
import { NODE_POS, paxTagColor, paxTagLabel } from '../game/guests'
import type { Game } from '../game/sim'
import { HallWorld, type HallBuildMode, type HallHover } from '../render/hallWorld'
import {
  GRID_C,
  GRID_R,
  ceilingsFor,
  itemDef,
  ITEMS,
  itemsForZone,
  lookaheadDepth,
  moodWord,
  PREFAB_TIERS,
  unclearedReachesGate,
  zoneDef,
  type ZoneId,
} from '../game/terminal'
import { refundFor } from '../game/terminalKit'
import type { KitCategory } from '../game/terminalKitData'

const KIT_TABS: { id: KitCategory; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'seating', label: 'Seating' },
  { id: 'decor', label: 'Decor' },
  { id: 'links', label: 'Links' },
  { id: 'service', label: 'Service' },
]

/** Slim build bar for the terminal kit. Cards close once the item is placed. */
function KitBar({
  game,
  build,
  setBuild,
}: {
  game: Game
  build: HallBuildMode
  setBuild: (mode: HallBuildMode) => void
}) {
  const [tab, setTab] = useState<KitCategory | null>(null)
  const cards = tab ? ITEMS.filter((i) => i.category === tab) : []
  const placing = build?.kind === 'place' ? itemDef(build.def) : null
  return (
    <div className="kit-bar" data-testid="kit-bar">
      <div className="kit-tabs">
        {KIT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`kit-tab-${t.id}`}
            className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(tab === t.id ? null : t.id)}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          data-testid="kit-bulldoze"
          className={build?.kind === 'bulldoze' ? 'on' : ''}
          onClick={() => {
            setTab(null)
            setBuild(build?.kind === 'bulldoze' ? null : { kind: 'bulldoze' })
          }}
        >
          Bulldoze
        </button>
        {build ? (
          <span className="kit-status" data-testid="kit-status">
            {placing ? `Placing ${placing.name} · R rotate` : 'Bulldoze · click an item for a refund'} · Esc
            cancel
          </span>
        ) : null}
      </div>
      {tab ? (
        <div className="kit-cards" data-testid="kit-cards">
          {cards.map((item) => {
            const need = Math.max(item.minFieldLevel, unlockLevel(item.id))
            const locked = game.fieldLevel() < need
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`kit-${item.id}`}
                className={`kit-card${locked ? ' locked' : ''}`}
                disabled={locked}
                title={locked ? lockTip(item.name, need, item.blurb) : `${item.blurb} · $${item.upkeep}/day`}
                onClick={() => {
                  setTab(null)
                  setBuild({ kind: 'place', def: item.id, rot: 0 })
                }}
              >
                <strong>{item.name}</strong>
                <span>{locked ? `FL${need}` : money(item.cost)}</span>
                <span>${item.upkeep}/day</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function KitTooltip({ build, hover }: { build: HallBuildMode; hover: HallHover | null }) {
  if (!build || !hover) return null
  const style = { left: hover.sx + 16, top: hover.sy + 16 }
  if (build.kind === 'bulldoze') {
    const def = hover.target ? itemDef(hover.target.def) : null
    return (
      <div className="kit-tip" style={style} data-testid="kit-tip">
        {def ? (
          <>
            <strong>{def.name}</strong>
            <span className="good">Refund {money(refundFor(def))}</span>
          </>
        ) : (
          <span className="muted">Nothing placed here</span>
        )}
      </div>
    )
  }
  const def = itemDef(build.def)
  if (!def) return null
  return (
    <div className="kit-tip" style={style} data-testid="kit-tip">
      <strong>{def.name}</strong>
      <span>
        {money(def.cost)} · ${def.upkeep}/day
      </span>
      <span className={hover.check?.ok ? 'good' : 'bad'}>{hover.check?.reason ?? ''}</span>
    </div>
  )
}

/**
 * 3D hall — WASD/arrows pan, Q/E rotate, scroll zoom, middle/right orbit.
 * Apron keeps simulating in the background.
 */
export function TerminalView({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<HallWorld | null>(null)
  const [zone, setZone] = useState<ZoneId | null>(null)
  const [build, setBuild] = useState<HallBuildMode>(null)
  const [hover, setHover] = useState<HallHover | null>(null)
  const buildRef = useRef<HallBuildMode>(null)

  useEffect(() => {
    buildRef.current = build
    worldRef.current?.setBuild(build)
  }, [build])

  useEffect(() => {
    // Capture phase, so Esc cancels a build before it leaves the hall.
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (game.view !== 'hall' || !buildRef.current) return
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setBuild(null)
      } else if ((e.key === 'r' || e.key === 'R') && buildRef.current.kind === 'place') {
        const cur = buildRef.current
        setBuild({ ...cur, rot: (cur.rot + 1) % 4 })
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [game])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const world = new HallWorld(canvas)
    worldRef.current = world
    if (import.meta.env.DEV) {
      ;(window as unknown as { __hall?: HallWorld }).__hall = world
    }
    world.onPlaced = () => setBuild(null)
    world.onHover = setHover
    world.onCaptured = (url) => savePng(url, pngName(new Date()))
    world.setBuild(buildRef.current)
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
          if (cameraSession.consumeCapture()) w.requestCapture()
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
      if (import.meta.env.DEV) {
        const probe = window as unknown as { __hall?: HallWorld }
        if (probe.__hall === world) delete probe.__hall
      }
      worldRef.current = null
      world.dispose()
    }
  }, [game])

  const guest = game.hallGuests.find((g) => g.id === game.selectedGuest)
  const fit = game.activeHall()
  const tier = (fit?.tier ?? 1) as 1 | 2 | 3
  const prefab = Boolean(fit?.premade && !fit?.redesigned)
  const nextTier = tier < 3 ? ((tier + 1) as 2 | 3) : null
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
  const pathOk = fit ? unclearedReachesGate(game.hallOpen(), lookaheadDepth(fit.signs ?? 0)) : false
  const open = game.hallOpen()
  const missing = (
    [
      ['checkin', 'check-in'],
      ['security', 'security'],
      ['gate', 'boarding desk'],
    ] as const
  )
    .filter(([node]) => !open.has(node))
    .map(([, label]) => label)

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
      <KitBar game={game} build={build} setBuild={setBuild} />
      <KitTooltip build={build} hover={hover} />
      {game.view === 'hall'
        ? createPortal(
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
          <p data-testid="hall-path" className={pathOk ? 'good' : 'bad'}>
            {pathOk
              ? 'Curb → gate path works'
              : missing.length
                ? `No curb → gate path · needs ${missing.join(', ')}`
                : 'No curb → gate path · check the layout'}
          </p>
          <p className="muted" data-testid="food-court">
            Food court {money(game.foodCourtRevenue)} · {game.foodShelf} servings
          </p>
        </div>
        {prefab && nextTier ? (
          <button
            type="button"
            data-testid="upgrade-prefab"
            title={
              game.fieldLevel() < unlockLevel(nextTier === 2 ? 'prefab_ii' : 'satellite')
                ? lockTip(
                    PREFAB_TIERS[nextTier].label,
                    unlockLevel(nextTier === 2 ? 'prefab_ii' : 'satellite'),
                  )
                : `Upgrade to ${PREFAB_TIERS[nextTier].label}`
            }
            onClick={() => game.upgradeHall()}
          >
            Upgrade to {PREFAB_TIERS[nextTier].label} · {money(PREFAB_TIERS[nextTier].upgradeCost)}
            {game.fieldLevel() < unlockLevel(nextTier === 2 ? 'prefab_ii' : 'satellite')
              ? ` · FL${unlockLevel(nextTier === 2 ? 'prefab_ii' : 'satellite')}`
              : ''}
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
            {zoneItems.length === 0 ? (
              <p className="muted">Nothing in this zone is for sale yet.</p>
            ) : null}
            {zoneItems.map((item) => {
              const need = Math.max(item.minFieldLevel, unlockLevel(item.id))
              const locked = game.fieldLevel() < need
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`item-${item.id}`}
                  className={locked ? 'locked' : ''}
                  disabled={locked}
                  title={locked ? lockTip(item.name, need, item.blurb) : `${item.blurb} · $${item.upkeep}/day`}
                  onClick={() => {
                    setBuild({ kind: 'place', def: item.id, rot: 0 })
                  }}
                >
                  <span>{item.name}</span>
                  <span>
                    {locked ? `FL${need}` : money(item.cost)} · ${item.upkeep}/day
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="muted">Pick a zone. Placing uses the same hall cursor as the build bar.</p>
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
                    // A coloured cell is the zone. Selecting it lists what fits there.
                    // Painting a new colour still happens when a different zone is armed.
                    if (painted && (!zone || zone === painted)) {
                      setZone(painted)
                      return
                    }
                    if (zone) game.paintHallCell(c, r, zone)
                  }}
                />
              )
            }),
          )}
        </div>
      </aside>,
              document.body,
            )
        : null}
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
