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

- Arrivals (jet bridge → exit door → curb) and transfers.
- Body-to-body avoidance for walkers outside queues. Each walker keeps a fixed
  sideways offset so crowds do not walk single file. Use `render/world/guestMotion`
  for visual steering if needed.
- Hooking into `GameSim` and the hall renderer. That is the build/view
  workstream's call; the API above is all it needs.

Tunables live in `src/paxnav/config.ts`.
