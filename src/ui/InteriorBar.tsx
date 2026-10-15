import { useState } from 'react'
import type { Game } from '../game/sim'
import type { HallBuildMode } from '../render/hallWorld'
import { FLOOR_PAINTS, ROOM_SPEC, WALL_PAINTS } from '../terminalbuild/config.ts'
import type { RoomKind } from '../terminalbuild/types.ts'

const ROOM_KINDS: RoomKind[] = ['checkin', 'security', 'gate', 'retail', 'lounge', 'toilets', 'office', 'bagmakeup']

/** Sims-style interior tools. A strip, not a modal: the hall stays visible. */
export function InteriorBar({
  game,
  build,
  setBuild,
}: {
  game: Game
  build: HallBuildMode
  setBuild: (mode: HallBuildMode) => void
}) {
  const [open, setOpen] = useState<'floor' | 'wall' | 'room' | null>(null)
  const fit = game.activeHall()
  const rooms = fit?.interior?.rooms ?? []
  const selected = build?.kind === 'room' ? rooms.find((r) => r.id === build.selected) : undefined
  const findings = selected ? game.interiorFindings(selected.id) : []
  const tool = (mode: Exclude<HallBuildMode, null>) => {
    setOpen(null)
    const same =
      build?.kind === mode.kind &&
      (mode.kind !== 'wall' || (build.kind === 'wall' && build.erase === mode.erase)) &&
      (mode.kind !== 'room' || (build.kind === 'room' && build.room === mode.room))
    setBuild(same ? null : mode)
  }
  return (
    <div className="interior-bar" data-testid="interior-bar">
      <div className="kit-tabs">
        <button type="button" data-testid="interior-wall" className={build?.kind === 'wall' && !build.erase ? 'on' : ''} onClick={() => tool({ kind: 'wall', erase: false })}>
          Walls
        </button>
        <button type="button" data-testid="interior-erase" className={build?.kind === 'wall' && build.erase ? 'on' : ''} onClick={() => tool({ kind: 'wall', erase: true })}>
          Erase
        </button>
        <button type="button" data-testid="interior-door" className={build?.kind === 'door' ? 'on' : ''} onClick={() => tool({ kind: 'door' })}>
          Door
        </button>
        <button type="button" data-testid="interior-floor" className={build?.kind === 'floor' ? 'on' : ''} onClick={() => setOpen(open === 'floor' ? null : 'floor')}>
          Floor
        </button>
        <button type="button" data-testid="interior-wallpaper" className={build?.kind === 'wallpaper' ? 'on' : ''} onClick={() => setOpen(open === 'wall' ? null : 'wall')}>
          Wallpaper
        </button>
        <button type="button" data-testid="interior-room" className={build?.kind === 'room' ? 'on' : ''} onClick={() => setOpen(open === 'room' ? null : 'room')}>
          Room
        </button>
        {rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            data-testid={`interior-room-${room.id}`}
            className={selected?.id === room.id ? 'on' : ''}
            onClick={() => setBuild({ kind: 'room', room: room.kind, selected: room.id })}
          >
            {ROOM_SPEC[room.kind].label}
          </button>
        ))}
        {build?.kind === 'wall' || build?.kind === 'door' || build?.kind === 'floor' || build?.kind === 'wallpaper' || build?.kind === 'room' ? (
          <span className="kit-status" data-testid="interior-status">
            {build.kind === 'wall' ? (build.erase ? 'Erase · drag a wall' : 'Walls · drag') : null}
            {build.kind === 'door' ? 'Door · click a wall' : null}
            {build.kind === 'floor' ? `Floor · ${FLOOR_PAINTS.find((p) => p.id === build.paint)?.label ?? 'paint'}` : null}
            {build.kind === 'wallpaper' ? `Wallpaper · ${WALL_PAINTS.find((p) => p.id === build.paint)?.label ?? 'paint'}` : null}
            {build.kind === 'room' ? `${ROOM_SPEC[build.room].label} · drag a rectangle` : null}
            {' · Esc cancel'}
          </span>
        ) : null}
      </div>
      {open === 'floor' ? (
        <div className="kit-cards" data-testid="floor-paints">
          {FLOOR_PAINTS.map((p) => (
            <button key={p.id} type="button" data-testid={`floor-${p.id}`} className={build?.kind === 'floor' && build.paint === p.id ? 'on' : ''} onClick={() => { setOpen(null); setBuild({ kind: 'floor', paint: p.id }) }}>
              <strong>{p.label}</strong>
            </button>
          ))}
        </div>
      ) : null}
      {open === 'wall' ? (
        <div className="kit-cards" data-testid="wall-paints">
          {WALL_PAINTS.map((p) => (
            <button key={p.id} type="button" data-testid={`wall-${p.id}`} className={build?.kind === 'wallpaper' && build.paint === p.id ? 'on' : ''} onClick={() => { setOpen(null); setBuild({ kind: 'wallpaper', paint: p.id }) }}>
              <strong>{p.label}</strong>
            </button>
          ))}
        </div>
      ) : null}
      {open === 'room' ? (
        <div className="kit-cards" data-testid="room-kinds">
          {ROOM_KINDS.map((kind) => (
            <button key={kind} type="button" data-testid={`room-${kind}`} className={build?.kind === 'room' && build.room === kind ? 'on' : ''} onClick={() => { setOpen(null); setBuild({ kind: 'room', room: kind, selected: null }) }}>
              <strong>{ROOM_SPEC[kind].label}</strong>
            </button>
          ))}
        </div>
      ) : null}
      {selected && build?.kind === 'room' ? (
        <div className="interior-room" data-testid="interior-room">
          <strong>{ROOM_SPEC[selected.kind].label}</strong>
          <span>{selected.w}×{selected.h}</span>
          <button type="button" data-testid="room-wider" onClick={() => game.resizeInteriorRoom(selected.id, { ...selected, w: selected.w + 1 })}>+</button>
          <button type="button" data-testid="room-narrower" onClick={() => game.resizeInteriorRoom(selected.id, { ...selected, w: Math.max(1, selected.w - 1) })}>−</button>
          <button type="button" data-testid="room-deeper" onClick={() => game.resizeInteriorRoom(selected.id, { ...selected, h: selected.h + 1 })}>deeper</button>
          <button type="button" data-testid="room-shallower" onClick={() => game.resizeInteriorRoom(selected.id, { ...selected, h: Math.max(1, selected.h - 1) })}>shallower</button>
          <button type="button" data-testid="room-furnish" onClick={() => game.furnishInteriorRoom(selected.id)}>Place required</button>
          <button type="button" data-testid="room-delete" onClick={() => { game.deleteInteriorRoom(selected.id); setBuild({ kind: 'room', room: selected.kind, selected: null }) }}>Delete</button>
          {findings.map((f) => (
            <p key={f.id} className="bad" data-testid="room-finding">{f.title}. {f.fix}</p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
