import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { pngName, savePng } from '../camera/capture.ts'
import { cameraSession } from '../camera/session.ts'
import { money } from '../game/catalog'
import { lockTip, unlockLevel } from '../progression/unlocks'
import { NODE_POS, paxTagColor, paxTagLabel } from '../game/guests'
import type { Game } from '../game/sim'
import { registerHallTools } from '../input/hallTools.ts'
import { inputMap } from '../input/map.ts'
import { GUEST_GLANCE } from '../paxnav/guestConfig.ts'
import { HallWorld, type HallBuildMode, type HallHover } from '../render/hallWorld'
import { WalkerCard, WalkerOnlyCard } from './WalkerCard'
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
  zoneCellBlocked,
  zoneDef,
  type ZoneId,
} from '../game/terminal'
import { refundFor } from '../game/terminalKit'
import type { KitCategory } from '../game/terminalKitData'
import { KIT_TABS } from './uiCatalog'
import { InteriorBar } from './InteriorBar'
import { subscribeKit, takeKitRequest } from './nav/kitFocus'

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
  useEffect(() => {
    const apply = () => {
      const next = takeKitRequest()
      if (next) setTab(next)
    }
    apply()
    return subscribeKit(apply)
  }, [])
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
          data-testid="kit-move"
          className={build?.kind === 'move' ? 'on' : ''}
          onClick={() => {
            setTab(null)
            setBuild(build?.kind === 'move' ? null : { kind: 'move', itemId: null, def: null, rot: 0 })
          }}
        >
          Move
        </button>
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
            {placing
              ? `Placing ${placing.name} · R rotate`
              : build.kind === 'move'
                ? build.def
                  ? `Moving ${itemDef(build.def)?.name ?? 'item'} · click a free cell`
                  : 'Move · click an item, then a free cell'
                : 'Bulldoze · click an item for a refund'}{' '}
            · Esc cancel
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
                <span>{locked ? `Lv ${need}` : money(item.cost)}</span>
                <span>${item.upkeep}/day</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/** Hover read on a passenger: name, mood, the need that matters most and what they are thinking. */
function WalkerTooltip({ game, hover }: { game: Game; hover: { id: string; sx: number; sy: number } | null }) {
  if (!hover || game.view !== 'hall') return null
  const g = game.hallNav.glance(hover.id)
  if (!g) return null
  return (
    <div className="walker-tip" style={{ left: hover.sx + 16, top: hover.sy + 16 }} data-testid="walker-tip">
      <strong data-testid="walker-tip-name">{g.name}</strong>
      <span data-testid="walker-tip-mood">
        Mood: {g.mood}
        {g.satisfaction != null ? ` (${Math.round(g.satisfaction)})` : ''}
      </span>
      <span data-testid="walker-tip-need">
        Top need: {g.topNeed ? `${g.topNeed.label} (${Math.round(g.topNeed.level * 100)}%)` : GUEST_GLANCE.calmNeed}
      </span>
      <span className="walker-tip-thought" data-testid="walker-tip-thought">
        {g.thought}
      </span>
    </div>
  )
}

function KitTooltip({ build, hover }: { build: HallBuildMode; hover: HallHover | null }) {
  if (!build || !hover) return null
  if (build.kind === 'foundation' || build.kind === 'wall' || build.kind === 'door' || build.kind === 'floor' || build.kind === 'wallpaper' || build.kind === 'room') {
    return null
  }
  const style = { left: hover.sx + 16, top: hover.sy + 16 }
  if (build.kind === 'move') {
    const def = build.def ? itemDef(build.def) : hover.target ? itemDef(hover.target.def) : null
    return (
      <div className="kit-tip" style={style} data-testid="kit-tip">
        <strong>{def?.name ?? 'Move'}</strong>
        <span className={hover.check?.ok === false ? 'bad' : 'good'}>
          {hover.check?.reason ?? (hover.target ? 'Click to pick up' : 'Click an item')}
        </span>
      </div>
    )
  }
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
  const [sheet, setSheet] = useState(false)
  const [hover, setHover] = useState<HallHover | null>(null)
  const [walkerHover, setWalkerHover] = useState<{ id: string; sx: number; sy: number } | null>(null)
  const buildRef = useRef<HallBuildMode>(null)

  useEffect(() => {
    buildRef.current = build
    worldRef.current?.setBuild(build)
  }, [build])

  useEffect(() => {
    worldRef.current?.setPaintZones(zone != null)
  }, [zone])

  useEffect(() => {
    return registerHallTools({
      active: () => game.view === 'hall' && buildRef.current != null,
      cancel: () => {
        if (game.view !== 'hall' || !buildRef.current) return false
        setBuild(null)
        return true
      },
      rotate: () => {
        const cur = buildRef.current
        if (game.view !== 'hall' || !cur || (cur.kind !== 'place' && cur.kind !== 'move')) return false
        setBuild({ ...cur, rot: (cur.rot + 1) % 4 })
        return true
      },
    })
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
    world.onInteriorSelect = (id) => {
      setBuild((cur) => {
        const hit = game.activeHall()?.interior?.rooms.find((room) => room.id === id)
        const room = hit?.kind ?? (cur?.kind === 'room' ? cur.room : 'retail')
        return { kind: 'room', room, selected: id }
      })
    }
    world.onMovePick = (id, def) =>
      setBuild({ kind: 'move', itemId: id, def, rot: buildRef.current?.kind === 'move' ? buildRef.current.rot : 0 })
    world.onHover = setHover
    world.onWalkerHover = setWalkerHover
    world.onCaptured = (url) => savePng(url, pngName(new Date()))
    world.setBuild(buildRef.current)

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (game.view === 'hall') {
        const w = worldRef.current
        if (w) {
          const speed = 18 * dt
          const fx = (inputMap.analog('camera.panRight') - inputMap.analog('camera.panLeft')) * speed
          const fy = (inputMap.analog('camera.panBack') - inputMap.analog('camera.panForward')) * speed
          if (fx || fy) w.nudgePan(fx, fy)
          const yaw = (inputMap.analog('camera.rotateLeft') - inputMap.analog('camera.rotateRight')) * 1.4 * dt
          if (yaw) w.nudgeYaw(yaw)
          const zoom = inputMap.analog('camera.zoomIn') - inputMap.analog('camera.zoomOut')
          if (zoom) w.nudgeZoom(-zoom * 28 * dt)
          if (cameraSession.consumeCapture()) w.requestCapture()
          w.render(game)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
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
          Terminal · roof off · WASD pan · Q/E rotate · scroll zoom · click a person or a desk
          {game.hasSecurityChoke() ? ' · security choke live' : ' · NO SECURITY LANE'}
          {' · '}
          {game.terminalPaxCount()} pax
          <button
            type="button"
            className={sheet ? 'on' : ''}
            data-testid="hall-sheet-toggle"
            onClick={() => setSheet((open) => !open)}
          >
            {sheet ? 'Hide sheet' : prefab ? PREFAB_TIERS[tier].label : 'Hall sheet'}
          </button>
        </p>
      </div>
      <InteriorBar game={game} build={build} setBuild={setBuild} />
      <KitBar game={game} build={build} setBuild={setBuild} />
      <KitTooltip build={build} hover={hover} />
      <WalkerTooltip game={game} hover={build ? null : walkerHover} />
      {game.view === 'hall' && sheet
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
          <ul className="muted" data-testid="hall-shops">
            {game.hallShopLines().map((line, i) => (
              <li key={`${line}-${i}`}>{line}</li>
            ))}
          </ul>
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
              const blocked = zoneCellBlocked(fit?.items ?? [], c, r)
              const color = blocked ? '#6a3030' : painted ? zoneDef(painted).color : '#2a3840'
              return (
                <button
                  key={`${c}-${r}`}
                  type="button"
                  data-testid={`cell-${c}-${r}`}
                  data-blocked={blocked ? '1' : '0'}
                  style={{
                    background: blocked
                      ? `repeating-linear-gradient(135deg, ${color}, ${color} 4px, #e0574a 4px, #e0574a 6px)`
                      : color,
                  }}
                  title={blocked ? 'Belt or wall — zone paint stops here' : painted ? zoneDef(painted).label : 'Bare'}
                  onClick={() => {
                    if (blocked) return
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
          <WalkerCard game={game} id={guest.id} />
          <button type="button" data-testid="guest-follow" onClick={() => worldRef.current?.setFollow(guest.id)}>
            Follow
          </button>
        </aside>
      ) : (
        <WalkerOnlyCard
          game={game}
          id={game.selectedGuest}
          onFollow={(id) => worldRef.current?.setFollow(id)}
        />
      )}
    </div>
  )
}
