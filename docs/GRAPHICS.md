# Graphics — world render layer (Slice E)

`src/render/world/` is a drop-in layer that sits on top of the legacy apron
`World` (`src/render/world.ts`). It redraws the ground and terminals with more
detail, adds airfield lighting, day/night and weather, and has three quality
presets. The legacy `World` keeps owning the camera, picking, ghosts, aircraft,
trucks, people and the non-terminal buildings.

Owner: Slice E graphics. Other agents wire it in; please don't edit files under
`src/render/world/` without pinging the owner.

## What it draws

| Area | Detail |
| --- | --- |
| Ground | One merged mesh per surface (grass, runway, taxi, apron concrete, road, building pads). World-space UVs, so textures flow across tiles. Procedural textures (no image assets), and vertex-colour macro variation so tiling doesn't show. Outer farmland, trees, and a perimeter fence. |
| Markings | Runway edge lines, piano-key thresholds, designators (`09/27`, `18/36`), aiming point, touchdown zone, centreline. Taxi centrelines (no ladders on wide strips), edge lines, hold-short bars. Stand lead-in, stop bar, red safety envelope, and a class-tinted stand plate (S/M/L). Road dashes and edge lines. |
| Airfield lights | Runway edge, centre, threshold (green), and end (red) lights. Taxi centre (green) and edge (blue) lights. Instanced fixtures plus one additive glow `Points` draw. Apron flood masts with ground light pools at night. Windsocks. |
| Terminals | Each connected group of terminal tiles is one building. Curtain-wall glazing on every outside face, with mullions and fascia. A skylight roof with HVAC, a landside drop-off canopy, and `TERMINAL n` / `DEPARTURES` / `GATE An` signs. |
| Living interior | Zones come from the hall's orientation. Landside is **check-in** (staffed counters, monitors, bag belt, queue stanchions, FIDS). The middle is **security** (x-ray, arch, officers, queue), **shops / café** (kiosk with staff, tables with customers) and, when there's a spare cell, **back-of-house** (staff **offices** plus an **R&D lab**). Airside is an **airside concourse** strip plus **gate holdrooms** (bench rows with seated passengers, staffed podium, board). A **crowd walks between rooms through the doorways, pulling roller cases**. Staff walk between the offices, the lab and check-in. |
| Rooms | Each terminal gets a room plan (see [Terminal rooms, walls and pathing](#terminal-rooms-walls-and-pathing)): a floor tint per room, plaster partition walls with dark lintels over doors, low glass partitions between holdrooms, darker threshold strips at every doorway, and a hanging sign per room (`CHECK-IN HALL`, `SECURITY`, `AIRSIDE`, `SHOPS · CAFÉ`, `GATE A1…`, `R&D LAB`, `OFFICES`). Walls cut away so they never block the view. |
| Jet bridges | Built for every stand with jetway access: rotunda on the nearest facade, two telescoping tunnel sections with window strips, drive column and bogie, cab and bellows. |
| Sky / weather | Gradient sky dome with stars at night. The sun and moon move with the sim clock. Fog, exposure, and hemisphere light follow time of day. `rain`, `fog`, and `storm` darken the sky, wet the paving, turn the field lights on, and add rain streaks (storms also get lightning flashes). |

### Level of detail (zooming in)

Per-terminal LOD by camera distance, with hysteresis and fades, so nothing pops:

| LOD | Distance (med) | Shows |
| --- | --- | --- |
| 2 | > 120 | Shell, glass, roof, signs |
| 1 | 52 – 120 | + interior props, room walls and room signs (fade in) |
| 0 | < 52 | + staff, passengers, walkers with luggage (fade in) |
| cutaway | < 34, camera above roof | Roof, skylights, and ceiling lamps fade out (and lift), so the whole hall reads from above |
| wall cutaway | < 34 | Walls on the camera side of the focus, within 6 m of the camera, or everything when the camera is closer than 18 drop to 0.32 m stubs. The rest drop to 1.5 m, so rooms still read but you can see over them. Heights animate, and walls stand at full height (2.7 m) when zoomed out. |

Distances scale with the quality preset (`lodScale`). Also tied to zoom:

- The sun's shadow box tightens around the focus as you zoom in (crisp contact shadows on desks and benches). It snaps to shadow texels so panning doesn't shimmer.
- A near-camera grass-tuft ring appears below about 46 units. It is anchored to a world grid (no swimming) and shrinks toward its edge.
- Glow point size follows zoom.

## Integration API

```ts
import { initWorldRender, parseQuality, suggestQuality, type WorldRender } from './world/index'

const wr: WorldRender = initWorldRender(scene, 'med', { renderer, sun })
wr.hideLegacyTiles(tilesGroup, game) // hide legacy meshes this layer redraws
wr.update(game, camera, dtSeconds)   // once per frame, before renderer.render
wr.setQuality('low' | 'med' | 'high')
wr.setLiteMode(bool)                  // fast-forward: shadows + grass ring off, no rebuild
wr.setTimeOfDay(hour | null)          // photo mode / debug; null = follow sim clock
wr.setWeather('storm' | ... | null)   // override; null = follow game.weather
wr.stats()                            // LOD, counts (incl. rooms / doors / walls), draw meshes, shadow size
wr.roomPlans()                        // per-terminal RoomPlan: rooms, walls, doorways, nav grid (world space)
wr.dispose()                          // restores the legacy scene (fog, earth disc, lights)
```

- `update` takes any `WorldView` (`tiles`, `mapRev`, optional `clock`, `weather`, `speed`, `standClass`, `standAccessAt`). `Game` satisfies it as-is.
- Static content rebuilds only when `game.mapRev` changes.
- `initWorldRender` adopts the scene's existing `DirectionalLight`, `HemisphereLight` and `AmbientLight` and drives them; it doesn't add duplicate lights. It also hides the legacy root-level `CircleGeometry` ground discs (earth, horizon) and takes over fog and background. Pass `replaceEnvironment: false` to opt out.
- `REPLACED_TILES` lists the tiles this layer redraws: `grass`, `runway`, `taxi`, `stand`, `road`, `terminal`.

## Wiring it into `World` (for the terminal / render-owner agent)

About 15 lines in `src/render/world.ts`, plus one optional settings control. This
is exactly what `scripts/slice-e-media.mts` does through a prototype hook, so
the screenshots match what you'll get.

```ts
// world.ts
import { initWorldRender, parseQuality, REPLACED_TILES, suggestQuality, type WorldRender } from './world/index'

export class World {
  wr: WorldRender
  private lastFrame = performance.now()

  constructor(canvas: HTMLCanvasElement) {
    // ... existing renderer / scene / camera / lights setup ...
    const gl = this.renderer.getContext()
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
    const saved = localStorage.getItem('hatchfield-gfx')
    const quality = saved ? parseQuality(saved) : suggestQuality({
      renderer: gpu,
      deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
    })
    this.wr = initWorldRender(this.scene, quality, { renderer: this.renderer, sun: this.sun })
  }

  rebuildTiles(game: Game) {
    // ... in the per-tile loop, before creating any mesh:
    //   if (REPLACED_TILES.has(tile)) continue
    // (or keep the loop and call this.wr.hideLegacyTiles(this.tilesGroup, game) after it)
  }

  applyPerfMode(game: Game) {
    // Replace the body: let the layer own shadows / pixel ratio.
    this.wr.setLiteMode(game.speed >= 5)
  }

  render(game: Game) {
    const now = performance.now()
    const dt = (now - this.lastFrame) / 1000
    this.lastFrame = now
    this.resize()
    this.applyPerfMode(game)
    this.rebuildTiles(game)
    this.syncGhost(game)
    this.syncEntities(game)
    this.syncSites(game)
    this.wr.update(game, this.camera, dt)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.wr.dispose()
    // ... existing ...
  }
}
```

Also recommended:

1. **Allow closer zoom.** `onWheel` and `nudgeZoom` clamp `dist` to `[28, 160]`. Use `[12, 160]` so players can drop into the hall (the cutaway engages below about 34).
2. **Quality setting UI.** Add a Low / Med / High toggle (Settings or the bottom bar) that calls `world.wr.setQuality(q)` and stores `localStorage['hatchfield-gfx'] = q`.
3. **Fix `World.resize()`** (bug 1 below). The low preset renders at pixel ratio 0.8, which makes this bug fire on every frame.

## Terminal rooms, walls and pathing

### What the sim has today (audit, read-only)

**There is no navmesh, no room polygons, and no wall or collision data anywhere in
the sim.** People follow paths:

| Who | Where | How they move | Walls / collision |
| --- | --- | --- | --- |
| Apron people (`game.people`, drawn by `World.syncEntities`) | Tile map | 4-neighbour A* (`astar` in `src/game/path.ts`, `walkableFor(kind, tile)`), then step tile centre to tile centre. Terminal tiles count as walkable. | Tiles are walkable or not. There's no geometry inside a tile, and agents don't collide with each other. |
| Hall guests (`game.hallGuests`, `HallGuest` in `src/game/guests.ts`, drawn by `src/render/hallWorld.ts`) | Abstract hall | A node graph, `HALL_EDGES` (entrance, check-in, security, food, shop, gate, lab_* …). Each node has a normalised position in `NODE_POS`. `hallPath` does a BFS capped at depth 6 over open nodes. `sim.ts` (around line 3614) advances `g.t += dt * 1.35` per edge, and guests are lerped in a straight line between node points. | None. The landside / airside split is enforced only by graph topology (only `checkin` / `info` link to `security`) plus the `clearedSec` flag (`pathClearsSecurity`, `unclearedReachesGate`). |
| Hall zones (`TerminalFit.zones`) | 8 × 5 painted grid over a 48 × 32 abstract hall | Used for capacity and ceilings, and for drawing in `hallWorld.ts`. | `hallWorld.ts` draws perimeter walls with door gaps, and walls between secure and non-secure zone cells. They are **visual boxes only**; movement never reads them, so guests walk straight through them. |

### What this layer adds: `RoomPlan`

`src/render/world/rooms.ts` (pure TypeScript, no Three.js, safe to use in the sim and in
Vitest) derives one `RoomPlan` per terminal from the tile layout:

- A **nav grid** of 0.52 m squares (`NAV_RES = 12` per tile) over the footprint. Each square has a room id; solid props mark squares `blocked` (counters, belts, benches, podiums, x-rays, kiosks, café tables and stools, planters, and arch posts).
- **Rooms**: `checkin`, `security`, `airside`, `shops`, `gate` (one holdroom per airside cell, numbered like the exterior gate signs), `office`, `lab`. Each has a label and a centroid, and `roomEdges()` returns its outline.
- **Walls**: axis-aligned segments between rooms (`solid`, or `glass` between holdrooms), with `header` lintels over doors.
- **Doors**: a centre, axis, width and kind (`opening` / `door` / `staff`), plus the `doorEdges` set used for stepping. Door rules: check-in ↔ security, security ↔ airside, airside ↔ shops, airside ↔ gate, gate ↔ gate (glass with an opening), check-in ↔ offices (staff door), offices ↔ lab. Any other pair gets a solid wall. A fallback door is added only if a room would otherwise be unreachable.
- **Invariant (tested):** from check-in, the sterile rooms (`airside`, `shops`, `gate`) can only be reached through `security`.
- `navPath(plan, from, to, { staff?, strict? })` is a BFS on the nav grid that steps between rooms only through doorways, goes around blocked squares, and passes only through public rooms (staff rooms are allowed only as the start or goal, unless `staff: true`). The result is string-pulled with a 0.2 m body clearance from walls, wall ends and furniture. It returns a world-space polyline, or `null` with `strict`.
- Helpers: `roomAt`, `squareAt`, `canStep`, `pointInRoom`, and `HALL_NODE_ROOM` (sim `HallNode` → room kind).

The ambient crowd and staff walkers in the 3D terminal already route with `navPath`. A
test walks every route and asserts it stays at least 0.2 m from every wall and never
enters a blocked square.

### What the terminal agent must wire so sim pathing respects the walls

1. **Get the plans.** In the client, call `world.wr.roomPlans()` after `wr.update` (rebuilt on `mapRev`). Headless (sim or tests), call `planTerminal(terminals(game)[i]).rooms` from `src/render/world/plan.ts` and `layout.ts`. Both are pure and match the renderer exactly.
2. **Map nodes to rooms.** For a guest at `g.node`, the room kind is `HALL_NODE_ROOM[g.node]`. Pick the room of that kind in the guest's terminal (`g.hallId` ↔ `origin`), and a stable target point with `pointInRoom(plan, room, seededRand(g.id + node))`.
3. **Route on segment change.** Where `sim.ts` does `g.seg += 1` (around line 3614), compute `navPath(plan, currentPos, target, { strict: true })` and keep the polyline on the guest, for example as a new optional `HallGuest.route?: {x: number; z: number}[]` plus a distance along it. Advance by `dt * speed` along the polyline instead of lerping between `NODE_POS` points. Keep `g.t` as a 0..1 progress value so the existing service and queue logic is unchanged.
4. **Keep the security rule in data.** Uncleared departures should only be given targets outside `STERILE_ROOMS`. The door graph already makes security the only bridge, so `navPath` can't route around it. `strict: true` returns `null` instead of falling back to a prop-ignoring path.
5. **Draw guests in the 3D terminal.** If hall guests should appear in the airfield view, position them from their route, using `FLOOR_Y = 0.24` from `terminal.ts`. Then lower the ambient crowd with the quality preset's `walkersPerCell` (or set it to 0) so the two don't double up.
6. **Optional: unify the hall view.** `hallWorld.ts` could draw from the same `RoomPlan` (scaled into its 48 × 32 frame), so the 2D/3D hall and the airfield terminal show the same rooms.

Not covered: agent-to-agent avoidance, so walkers and queuing passengers can overlap. Queues are static props.

## Quality presets

| | low | med | high |
| --- | --- | --- | --- |
| Shadows | off | 1024 PCF, refreshed every 2nd frame | 2048 PCF, radius 2.5 |
| Max pixel ratio | 0.8 | 1.25 | 2 |
| Ground texture | 128² | 256² | 512² |
| LOD distance scale | 0.6 | 1.0 | 1.4 |
| Grass tufts | 0 | 1800 | 4200 |
| Trees | 140 | 320 | 640 |
| Night light pools | no | yes | yes |
| Walkers / terminal cell | 0.6 | 1 | 2 |

`suggestQuality` picks `low` for SwiftShader, llvmpipe, and other software GL, or for very small devices. It picks `high` for 8 GB / 8-core machines and `med` otherwise.

## Performance

How it stays fast:

- **Instancing:** lights, mullions, roof frames, masts, trees, fence posts, grass, and walkers.
- **Baking:** static interior props and seated or standing people are baked into one vertex-coloured mesh per building. There's one draw call for all counters, benches, and kiosks, and one for all static people.
- **Merged ground:** one mesh per surface type instead of the legacy 1,024 tile meshes.
- **No double fill:** the outer ground has a hole cut for the plot, so the software-GL fill cost isn't paid twice.
- **Cheap glass:** the glass is single-sided Lambert, and only walkers update each frame.

Measured with `scripts/slice-e-media.mts`: starter pax kit, 1280×720, HUD hidden, headless Chrome on SwiftShader (CPU software GL, 4 vCPU — no GPU in the CI/VM). Numbers are FPS:

| View | legacy (before) | low | med | high |
| --- | --- | --- | --- | --- |
| Wide (dist 150) | 10 | 14 | 7 | 6 |
| Mid (dist 60) | 11 | 13 | 6 | 6 |
| Close (dist 28) | 11 | 14 | 6 | 5 |
| Closest (dist 14, cutaway) | 10 | 14 | 6 | 6 |
| Facade (low angle) | 9 | 11 | 4 | 3 |
| Night, close | — | 12 | 6 | 5 |

Software GL is fill-bound and roughly 10–30× slower than any discrete or integrated
GPU. So the ≥ 30 FPS close-up target can't be verified on this VM: even the
legacy renderer does 10. What the table shows is that **low beats the legacy
renderer at every zoom while drawing far more**, and it's the auto-pick on
software GL. On medium, shadows cost about 30% and the terminal glass and interior
about 40% at close range, with ~57 draw meshes and ~1.4k instances
(`wr.stats()`). Please re-measure med and high on a real GPU before tuning further.

## Known bugs found in the legacy renderer (not fixed here — files owned elsewhere)

1. **`World.resize()` re-sizes every frame when `pixelRatio != 1`.** It compares `canvas.width` (device pixels) with `clientWidth` (CSS pixels). With the existing `1.25` cap on HiDPI screens, or the low preset's `0.8`, it calls `renderer.setSize` every frame, which reallocates the drawing buffer. Fix: compare against `Math.floor(clientWidth * renderer.getPixelRatio())`.
2. **Horizon disc z-fights the tiles.** `addHorizon()` puts a transparent disc at `y = 0.02`, the same height as the tiles. The triangular shards in `SLICE-E-before-wide.png` are this, and it also washes the whole field blue. The layer hides it when attached.
3. **`rebuildTiles` leaks GPU memory.** `tilesGroup.clear()` drops about 1,000 meshes per rebuild without disposing their per-tile `BoxGeometry` / `MeshStandardMaterial` (stand badges, jetways, buildings) or the shared plane geometry. Every build or bulldoze leaks. Dispose before clearing, or reuse shared geometries and materials.
4. **One mesh per grass / tarmac tile** (about 1,024 draw calls) is most of the legacy frame cost. With `REPLACED_TILES` skipped, that goes away.
5. **`applyPerfMode` force-enables shadows** when leaving 5x, which would override a user's low setting. Route it through `wr.setLiteMode` as above.

## Tests

`npx vitest run src/render/world` runs about 36 tests:

- `layout.test.ts`: clusters, runway axis and paint bounds, lights, terminal edges and airside, the taxi-ladder rule, starter-kit stands, bridges, and masts.
- `plan.test.ts`: zones, staffed desks in every zone, seated passengers, walkers with bags, footprint bounds, determinism.
- `lighting.test.ts`: sim clock vs `isNight()`, sun path, weather, LOD hysteresis, fades, shadow fit, quality presets, seamless noise.
- `render.test.ts`: full `initWorldRender` against the real starter kit. Covers light adoption, LOD and cutaway with zoom, walkers moving, night, quality swap, storm, 5x lite mode, rebuild-on-`mapRev`, `hideLegacyTiles`, dispose and restore, and the geometry builders.

## Media

`npx tsx scripts/slice-e-media.mts before` and `... after low|med|high` write
`SLICE-E-*.png` stills (wide, mid, close, closest, facade, night, night-close,
storm) to `docs/devlog/media` (override with `SLICE_E_OUT`). `SLICE_E_VIDEO=1`
adds a close-up crowd clip (needs `npx playwright install ffmpeg`).
