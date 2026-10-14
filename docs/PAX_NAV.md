# Passenger movement in a built terminal (`src/paxnav`)

Departing passengers walk a build-from-scratch terminal (`src/terminalbuild`)
on the ground, from the curb to the jet bridge:

curb pavement → curb door → check-in / bag drop (if they have a bag) →
security lane → toilet / food / shop (per needs, if there is time) →
gate seats → boarding desk (when boarding opens) → apron door.

Pure TypeScript, deterministic per seed. It reads `BuildLayout` and nothing
else; it does not touch the build tools, the view, or the UI.

## How it works

- **Nav grid** (`grid.ts`). Each 4 m build tile is split into 1 m cells. Walls
  and doors are on tile edges: a wall closes the edge, a door opens only its
  middle `doorCells` (2 m). Kit that is not walk-through (desks, belts, seats,
  counters, toilets) blocks its tile; bag halls and bare plot are not
  walkable. A one-tile margin holds the curb pavement outside each curb door,
  which is where people spawn, on the road edge. Exit, staff and apron doors
  are closed to departures (apron is the boarding goal).
- **Two layers.** PRE cells are walkable before security, AIR cells after.
  Only a security lane is on both, and a passenger only switches layer when a
  lane has served them. Other lanes cost `laneCorridorCost` to walk through.
- **Flow fields** (`field.ts`). One Dijkstra per goal (each facility, each
  gate's seats, each gate's jet bridge) gives every cell its next step. 8-way
  moves; a diagonal needs both corner routes open, so nobody clips a wall
  corner. Fields are built on first use and dropped on every layout change.
- **Facilities and lines** (`facilities.ts`). Check-in desks, security lanes,
  toilets, shop counters and boarding desks each serve one person at a time
  from a service cell. Each gets a marked line (up to `maxLineCells`) running
  back toward where people come from, turning at walls. Cells beside the line
  cost `ropeCost` to enter, so people join at the tail; crossing someone
  else's line costs `foreignLineCost`.
- **Agents** (`paxnav.ts`). Pick the facility with the lowest walk time plus
  wait. Nobody walks past the back of a line. Once in line they slide along it
  to `place × queueSpacingM` from the desk, so queues read as real lines.
  Service time comes from `EQUIP_SPEC` and slows with wear.

## API

```ts
const nav = new PaxNav(layout, { seed })
nav.spawn({ id, gate: 'g1', departAt, bags?, needs? }) // false if no curb door
nav.tick(dt, now)                // seconds; departAt uses the same clock
nav.setLayout(nextLayout)        // after any build edit: everyone re-plans
nav.writePoses(float32Array)     // x, y(=0), z, yaw per passenger, stride 4
nav.poses()                      // id, x, y, z, yaw, phase, facility, place, airside
nav.metrics()                    // per facility: queueLength, serving, incoming,
                                 // avgWaitSec, longestWaitSec, estWaitSec, served, line
nav.drainEvents()                // boarded / missed / stuck
nav.bounds()                     // grid extent, metres
```

Coordinates are terminal metres: x east, z south, tile (0,0) at the origin.
Map to the hall's world frame in the renderer.

## Rules it keeps

- Nobody spawns in the air, off the grid, or inside the building: always on
  the curb pavement outside a curb door, at y = 0.
- No walking through walls, desks, belts or over roofs; no going back through
  security; airside only through a lane.
- Queues come only from the kit the player built and where they put it. No
  caps, no batch spawns. Skippable stops (check-in, needs) are skipped when
  unreachable or out of time; security and the gate are not. Those passengers
  are `stuck` (with an event) and retry, and re-plan on every edit.
- Missing the gate close (`gateCloseSec`) is a `missed` event.

## Not done yet

- Arrivals inside `PaxNav` itself. They walk in the game glue instead (see
  "Arrivals" below). Transfers still use the old hall figures.
- Body-to-body avoidance for walkers outside queues. Each walker keeps a fixed
  sideways offset so crowds do not walk single file. Use `render/world/guestMotion`
  for visual steering if needed.

Tunables live in `src/paxnav/config.ts`.

## Live in the game (`src/game/hallNav.ts`)

`Game.hallNav` (a `HallNav`) runs one PaxNav for the active hall:

- **Layout.** The hall's own `fit.build` when it has one. Prefab and
  zone-painted halls have none, so `prefabNavLayout` reads them as one on
  4 m tiles (48 m x 32 m = 12 x 8):
  - Zones: check-in, security, gates and retail map across. Arrivals become
    the bag hall. Toilets take the side they open onto.
  - Kit: placed kit becomes desks, lanes, toilets, counters, seats and
    boarding desks, one piece per server where the cell has room.
  - Lanes sit on the security tiles that face the check-in side.
  - Doors: curb doors at the entrance kit, and a jet bridge door on each
    gate room's outside wall.
  - Walls: security is walled from the check-in side except at the lanes.
  - The read is free: no cost and no refund.
- **Edits.** `Game.tickHallNav` re-reads the layout whenever `hallRev`
  changes (prefab edits and `applyHallBuild`). It calls `setLayout` only when
  the layout really changed, and everyone re-plans.
- **Spawns.** Each departing guest the sim releases into the hall gets a
  walker at a curb door. Its gate is a gate room picked by flight. Its
  `departAt` is the flight's STD, scaled to nav time. Day-one walkers loop
  back to the curb after boarding until real passengers replace them.
- **Time.** PaxNav runs in real seconds; a game day is 180 clock seconds.
  `HALL_NAV_TUNING` (`src/game/hallNavData.ts`) sets two scales:
  - `navSecPerClockSec` (10) sets walking pace: 13 m/s on screen at 1x
    (1.3 m/s × 10). 3x and 5x multiply that, because the tick is already
    in clock seconds × game speed.
  - `departLeadScale` (360) stretches the sim's 3-hour show-up window into
    135 nav minutes, so the slower walk still leaves time for the needs
    stops before boarding opens. Only real queues make anyone miss.
- **Render.** `HallWorld` draws the walkers with `HallNavCrowd`. That is three
  instanced meshes (body, head, bag) whatever the headcount, plus a floor
  dot on every marked queue line. While the walk is live it replaces the old
  departing and day-one figures, and the shell walls are drawn from the nav
  layout, so a drawn wall is always a wall to the walkers.
- **Read-outs.** `game.hallNav.metrics()` gives per-facility queue length,
  waits and served counts. `boarded`, `missed` and `stuck` are running totals.

The walk is the hall's picture and its queue read-out. Fares, ratings and
the sim's own boarding still come from the hall model in `sim.ts`. Walkers
are not saved; they restart from the next released guests after a load.

## Arrivals (`src/game/hallArrivals.ts`)

`HallNav.arrivals` (a `HallArrivals`) walks each non-transfer arrival the sim
releases into the hall: jet bridge door of its gate room → toilet / shop if
needed → bag claim (if it has a bag and the hall has a belt) or an exit door →
curb door, then it is gone. It is glue over the paxnav exports (`buildNavGrid`,
`computeField`, `buildFacilities`, `apronCells`) and does not change `src/paxnav`.

- **Grid.** The departures' layout with the arrival rules from
  `terminalbuild`: exit doors open (one way), security lanes closed, and a
  prefab hall's painted arrivals zone (`prefabClaimHall`) is floor with its
  carousel and bag hall kit solid. Built halls have no passenger claim hall;
  their arrivals leave through exit doors.
- **Layers.** Arrivals walk AIR until they reach a claim spot or an exit, then
  PRE to the curb, and never go back. The security floor is never a way out.
- **Queues.** At a toilet or shop counter they stand on the same marked line,
  behind everyone in the departures' line, and are served when the desk is
  free.
- **Claim.** They wait at a free spot within `claimReachCells` of a belt for
  `claimWaitSec`. Tunables: `HALL_ARRIVAL_TUNING` (`src/game/hallNavData.ts`).
- **Fallback.** No way from the jet bridge to a curb: no walker, and the old
  hall figure keeps that guest.

## Drawing the crowd (`src/render/hallNavCrowd.ts`)

The sim walks everyone; drawing only picks who is on screen.
`HALL_CROWD_TUNING` sets the following:

- `drawDistM`: walkers farther than this from the camera are skipped.
- Frustum: walkers outside the camera's frustum are skipped.
- `lodDistM`: past this distance a walker is drawn as a body only.
- `maxVisible`: the most walkers drawn, nearest first.

Instance matrices and colours go straight into preallocated buffers, and only
the drawn range is uploaded. The per-frame path allocates nothing.
`crowd.stats` reports walkers, visible, bodies, heads, bags and instances.

Smoke: `npx tsx scripts/hall-nav-smoke.mts`. It starts Vite and runs the
starter kit into the Terminal view. It takes a close shot, an arrivals close
shot and a 1200-walker shot. Then it reports FPS, per-frame glue cost and draw
stats, with the cap and cull on and then off, on the same camera.
