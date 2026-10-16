import { useEffect, useRef, useState } from 'react'
import type { Camera } from 'three'
import { snapshotFrom, tracksFrom } from '../camera/actors.ts'
import { pngName, savePng } from '../camera/capture.ts'
import { pickTrackable } from '../camera/pick.ts'
import { cameraSession } from '../camera/session.ts'
import { shownWorld } from '../render/viewCue'
import { FIELD_LAYOUT } from '../camera/layout.ts'
import type { ApronInspect, Game } from '../game/sim'
import { apronForward, apronRight } from '../camera/pan.ts'
import { inputMap } from '../input/map.ts'
import { sharedSettings } from '../features/settings/settings.ts'
import { toWorld, World } from '../render/world'
import { mapViewSnapshot, openMapDetail } from '../info/session.ts'
import { writeTipPoints, type TipPoint } from './tipScreen'
import { writeAlertPoints, type AlertPoint } from './alerts/alertScreen'
import { criticalAlertMarks } from './alerts/marks'
import { ALERT_TUNING } from '../game/alertsData.ts'
import { syncFlightCardClick } from './inspector/flightCard.ts'
import { releaseApronAudio, syncApronAudio, type ApronTruck } from '../audio/stage'
import { serviceStateOf } from '../render/vehicleAnim'
import { METERS_PER_CELL } from '../render/aircraft/specs'
import type { QualityLevel } from '../render/world/quality.ts'

/** Apron voices. The reverse beep follows the same dock pose the mesh shows. */
function apronAudioSnap(game: Game): { view: Game['view']; flights: Game['flights']; trucks: ApronTruck[] } {
  const trucks: ApronTruck[] = game.trucks.map((t) => ({
    id: t.id,
    kind: t.kind,
    x: t.x,
    y: t.y,
    returning: t.returning,
    dwell: t.dwell,
    preDwell: t.preDwell,
    path: t.path,
  }))
  for (const pose of game.servicePoses()) {
    if (serviceStateOf(pose.phase, pose.u) !== 'dock') continue
    trucks.push({
      id: pose.id,
      kind: pose.type,
      x: pose.drawX ?? pose.x,
      y: pose.drawY ?? pose.y,
      returning: false,
      dwell: 0,
      preDwell: 0,
      path: [],
      reversing: true,
    })
  }
  for (const pose of game.cartPoses()) {
    if (pose.phase !== 'dock' && pose.phase !== 'queue') continue
    trucks.push({
      id: pose.id,
      kind: pose.kind,
      x: pose.x / METERS_PER_CELL,
      y: pose.y / METERS_PER_CELL,
      returning: false,
      dwell: 0,
      preDwell: 0,
      path: [],
      reversing: true,
    })
  }
  return { view: game.view, flights: game.flights, trucks }
}

export function Field({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const [inspect, setInspect] = useState<ApronInspect | null>(null)
  const [placeReason, setPlaceReason] = useState<string | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const world = new World(canvas)
    worldRef.current = world
    // Production keeps the sim on ?playtest=1. The apron camera has to be on
    // the same flag, or a proof clip of that build cannot aim the lens.
    const playtestSearch = `${globalThis.location?.search ?? ''}`
    if (import.meta.env.DEV || playtestSearch.includes('playtest=1')) {
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
    world.onClick = (v, _shift, flightId = null) => {
      if (game.view !== 'apron') return
      if (game.tool === 'pan') {
        const hit = pickTrackable({ c: v.c, r: v.r }, tracksFrom(snapshotFrom(game)))
        if (hit) {
          cameraSession.select(hit)
          if (hit.kind === 'vehicle') cameraSession.startFollow()
        }
      }
      const beforeFlight = game.selectedFlight
      game.clickTile(v, flightId)
      syncFlightCardClick(game, v, beforeFlight, flightId)
      if (game.tool === 'pan') {
        const active = mapViewSnapshot().active
        const tile = game.tile(v)
        const id = `${v.c},${v.r}`
        if (tile === 'stand' && active === 'bays') openMapDetail(id)
        if ((tile === 'mro' || tile === 'nighthub' || tile === 'tower') && active === 'power') openMapDetail(id)
      }
    }
    world.onUserDrag = () => {
      cameraSession.noteDrag()
    }
    world.onFollowZoom = (deltaY) => cameraSession.noteWheel(deltaY)
    world.onCaptured = (url) => savePng(url, pngName(new Date()))
    world.getTool = () => game.tool
    const unbindPose = cameraSession.bindPose(() => world.cameraPose())
    const offCamera = cameraSession.subscribe(() => {
      const live = worldRef.current
      if (!live) return
      if (!cameraSession.following && live.followHeld) live.releaseFollow()
      if (!cameraSession.frozen) live.setTimeOfDay(null)
    })

    const gfxOrder: QualityLevel[] = ['low', 'med', 'high', 'ultra']
    const offPress = inputMap.onPress((id) => {
      if (id !== 'system.graphics') return
      const live = worldRef.current
      if (!live) return
      const next = gfxOrder[(gfxOrder.indexOf(live.wr.quality) + 1) % gfxOrder.length]
      if (next) live.setGraphicsQuality(next)
    })

    let alive = true
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      if (!alive) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (shownWorld(game.view, game.viewCue) === 'apron') {
        const w = worldRef.current
        if (w) {
          // The roof beat owns the camera until it finishes or the player skips.
          if (!game.viewCue && game.diplomacyTourSeconds > 0) {
            w.nudgeYaw(0.45 * dt)
            w.nudgePan(Math.sin(now / 900) * 10 * dt, 5 * dt)
            game.diplomacyTourSeconds = Math.max(0, game.diplomacyTourSeconds - dt)
          } else if (!game.viewCue && !cameraSession.following) {
            const speed = 28 * sharedSettings().get().cameraSpeed * dt
            const fx = apronRight(inputMap.analog('camera.panRight'), inputMap.analog('camera.panLeft')) * speed
            const fy = apronForward(inputMap.analog('camera.panForward'), inputMap.analog('camera.panBack')) * speed
            if (fx || fy) w.nudgePan(fx, fy)
            const yaw = (inputMap.analog('camera.rotateLeft') - inputMap.analog('camera.rotateRight')) * 1.4 * dt
            if (yaw) w.nudgeYaw(yaw)
            const zoom = inputMap.analog('camera.zoomIn') - inputMap.analog('camera.zoomOut')
            if (zoom) w.nudgeZoom(-zoom * 48 * dt)
            if (w.followHeld) w.releaseFollow()
          } else if (!game.viewCue) {
            const pose = cameraSession.step(dt, tracksFrom(snapshotFrom(game)), FIELD_LAYOUT)
            if (pose) w.applyFollow(pose.position, pose.aim)
            else if (w.followHeld) w.releaseFollow()
            const zoom = inputMap.analog('camera.zoomIn') - inputMap.analog('camera.zoomOut')
            if (zoom) cameraSession.noteWheel(-zoom * 80 * dt)
          }
          w.setTimeOfDay(cameraSession.frozen ? cameraSession.timeOfDay : null)
          if (cameraSession.consumeCapture()) w.requestCapture()
          w.render(game)
          const cam = w.camera
          cam.updateMatrixWorld()
          const tips = new Map<string, TipPoint>()
          for (const tip of game.visibleTips()) {
            if (tip.anchor.kind !== 'world') continue
            const v = toWorld(tip.anchor.cell.c, tip.anchor.cell.r, 3)
            v.project(cam)
            const nx = v.x * 0.5 + 0.5
            const ny = -v.y * 0.5 + 0.5
            // project() leaves z in clip space. In front of the camera it stays below 1.
            const on = v.z < 1 && nx >= 0.02 && nx <= 0.98 && ny >= 0.04 && ny <= 0.92
            tips.set(tip.id, { x: nx, y: ny, on })
          }
          writeTipPoints(tips)
          writeAlertPoints(projectAlertMarks(game, cam))
          const e = cam.matrixWorld.elements
          syncApronAudio(apronAudioSnap(game), {
            position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
            right: { x: e[0], y: e[1], z: e[2] },
          })
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
        const reason = game.placementGhostReason()
        setPlaceReason((prev) => (prev === reason ? prev : reason))
      } else {
        releaseApronAudio()
        writeAlertPoints(new Map())
        setPlaceReason((prev) => (prev === null ? prev : null))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      offPress()
      cancelAnimationFrame(raf)
      releaseApronAudio()
      unbindPose()
      offCamera()
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
          ) : inspect.kind === 'curb' ? (
            <>
              <header>
                <strong>{inspect.title}</strong>
                <span className="muted">Landside</span>
              </header>
              <p className="inspect-line" data-testid="curb-load">
                Curb load {inspect.loadLabel}
              </p>
              <p className="inspect-activity">{inspect.blurb}</p>
              <p className="muted inspect-next">Pressure {Math.round(inspect.pressure * 100)}%</p>
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
      {placeReason && game.view === 'apron' ? (
        <p className="placement-reason" data-testid="placement-reason" role="status">
          {placeReason}
        </p>
      ) : null}
    </div>
  )
}

/** One screen point per visible critical alert, on its first apron cell. */
function projectAlertMarks(game: Game, cam: Camera): Map<string, AlertPoint> {
  const next = new Map<string, AlertPoint>()
  for (const mark of criticalAlertMarks(game.alerts.ranked(), ALERT_TUNING.visible)) {
    if (mark.view !== 'apron') continue
    const v = toWorld(mark.cell.c, mark.cell.r, 2)
    v.project(cam)
    const nx = v.x * 0.5 + 0.5
    const ny = -v.y * 0.5 + 0.5
    const on = v.z < 1 && nx >= -0.08 && nx <= 1.08 && ny >= -0.08 && ny <= 1.08
    next.set(mark.id, {
      x: Math.min(0.98, Math.max(0.02, nx)),
      y: Math.min(0.96, Math.max(0.04, ny)),
      on,
    })
  }
  return next
}
