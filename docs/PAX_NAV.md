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

## Guests: personalities, needs and thoughts (`src/paxnav/guests.ts`)

With `new PaxNav(layout, { guests: true })` every walker is also a guest,
RollerCoaster Tycoon style. `HallNav` turns this on (`HALL_NAV_TUNING.guests`).
With it off, the walker behaves exactly as described above. All tunables are in
`src/paxnav/guestConfig.ts` (`GUEST_TUNING`, `TRAIT_FX`, `THOUGHTS`).

- **Traits.** Each guest has one purpose (business, leisure, family or budget).
  Flags can be added on top: first-timer *or* frequent flyer, reduced mobility,
  with kids. They are rolled from the guest's own id and the walk's seed, so the
  same guest is the same person whoever else is in the hall. On a reload, the
  same ids give the same people, so nothing extra is saved. Traits multiply
  together (`TRAIT_FX`) and set:
  - walk speed
  - patience in a line
  - how much they spend
  - anxiety and the chance of getting lost
  - how fast each need rises
  - how much they want food or shops

  The sim's fare tag seeds the purpose: business and premium fares are business
  guests, budget fares are budget guests, and family fares roll. `spawn({ purpose,
  flags })` can force them.
- **Needs** (0 to 1): hunger, thirst, bladder, boredom, tiredness and comfort
  rise per nav hour. They rise faster in a line or a crowd, and sitting at the
  gate rests tiredness and comfort. Anxiety comes from the slack to boarding:
  the time left, less what the stops ahead should take. A departure board in
  view calms it.
- **Think step.** Needs, thoughts and choices run on each guest's staggered
  `thinkSec` step, never per frame. Walking stays the O(1) flow-field step.
- **Optional stops.** After security, a simple utility score decides whether
  to visit a toilet, food or a shop. The score is the urge times taste, minus
  anxiety, minus the share of the slack the stop would use. A stop only counts
  if it fits before boarding. `spawn({ needs })` still fixes the stops.
- **Wayfinding.** While walking to a stop, a guest can get lost:
  - The chance is `lostPerMin`, scaled by traits and anxiety, divided by the
    sign coverage on their cell.
  - A lost guest wanders 6–14 cells on walkable floor (a wrong turn, or back the
    way they came), then carries on.
  - Placed `wayfinding` signs and `info_screen` / `info_kiosk` boards
    (`hallSignage`) cover the cells around them. Scheme signs not placed as
    items count everywhere.
  - Lost guests set `WALKER_LOST` in `writeFlags`, which draws a thought marker
    over them.
- **Thoughts.** These are lines like "This queue is too long", "Can't find the
  restroom", "Shop is out of stock" and "Nice seats". Each one changes
  satisfaction (`THOUGHTS[key].delta`) and has a cooldown. The last five are on
  the guest card.
- **Shops.** Each shop counter holds `stockCap` units and restocks
  `restockPerHour`. An empty shelf means no sale, a satisfaction hit, and that
  guest avoids the counter for a while. `addStock(id, n)` lets other systems
  restock it or take stock away.
- **Groups.** `spawn({ groupOf })` adds a follower who walks the leader's own
  trail, `groupGapM` apart. The group walks at its slowest member's pace,
  queues as one (desks take longer per extra member), and boards or rebooks
  together. `HallNav` groups family fares on the same flight.
- **Crowds.** Past `crowdCellPax` bodies on a 1 m cell, walkers slow down and
  give way, down to `crowdMinPace`. Queue spacing is unchanged. Walk distance
  is linear in `dt`, so 3× and 5× game speed walk three and five times as far.
- **Impatience.** After half their patience in a line, a guest says it is too
  long. Once patience runs out, they leave the line if the stop is optional, or
  walk to another facility if it is clearly quicker. If they cannot leave,
  they complain.
- **Missed flights.** With guests on, a missed guest (`missed` event) walks to
  a rebooking desk: a check-in desk before security, any boarding desk after.
  They are served for `rebookSec` and leave (`rebooked` event). Both cost
  satisfaction and reputation.

Read-outs: `guest(id)` (the card), `satisfaction()`, `drainFeedback()`,
`writeFlags(out)`, `pick(x, z)` and `metrics()[i].stock` / `.leftQueue`.
`HallNav` adds `guestCard`, `pickAt` (hall metres) and `takeReputation()`. The
sim feeds `takeReputation()` into its eased reputation every tick
(`GUEST_TUNING.repPerSatPoint`, `repPerMissed`, `repPerComplaint`). The
Terminal view's guest card shows the walker section (`src/ui/WalkerCard.tsx`),
and a click on an instanced walker selects them.

## Facilities, queues, mood and crew (issue #195)

- **Placed walls and belts.** `prefabNavLayout` reads `facilityBlockers`
  (`src/terminalplay`). A placed `wall` or `bag_system` fills its hall cell, so
  those tiles get no floor and no zone. Walkers and crew go round them, and no
  kit is put on them.
- **Finished waits.** `PaxNav.drainWaits()` gives each wait that ended: who,
  at which kit, and how long, from joining the line to reaching the desk.
  `HallNav` collects them, and `Game.applyHallWaits` turns each one into a mood
  change for that sim guest (`waitMoodDelta`):
  - a wait under a quarter of the tolerance gives `quickMood`;
  - a wait up to `toleranceSec` changes nothing;
  - after that it costs `moodPerMinOver` per nav minute, capped at `maxMoodHit`.

  Preview (day-one) walkers are skipped. The sim's own hall queue model still
  runs as before; the walk adds the cost of the lines the player can see.
- **Live queues and bottlenecks.** Every `readEveryNavSec`, `HallNav` reads
  the facility metrics:
  - `loads()` gives per facility the line length, expected and average wait,
    and a `bottleneck` flag;
  - `queues()` groups those by hall node (check-in, security, restrooms,
    shops & food, gate), with the count, the worst wait and a badge spot at
    the back of the longest line, in hall metres.

  A facility is a bottleneck (`isNavBottleneck`) when someone joining now would
  wait `bottleneckSec`, or its line has spilled past its floor marks. While the
  walk is live:
  - the hall's queue badges use `queues()`;
  - the info panel (`facilityInfo` for a node) shows count, wait and the
    bottleneck hint;
  - a queue line's floor dots turn red while it is a bottleneck.

  Tunables: `HALL_QUEUE_TUNING` (`src/game/hallNavData.ts`).
- **Starter terminal pacing.** In a 16-day run of the starter kit with every
  airline offer accepted, lines stay short on days 1–4. They grow once the
  first airlines fill the hall (about day 5). Check-in and shops pass their
  bottleneck wait around days 5–7. The kit, not a cap, decides when.
- **Crew** (`src/paxnav/crew.ts`, `HallNav.crew`). Staff walk the same grid.
  - Check-in agents, screeners (two per lane), gate agents and shop staff each
    have a post behind their desk or in their lane, off every queue line.
  - Staff before security come in from the curb, and staff after security from
    a jet bridge door.
  - At shift change (`HALL_CREW_TUNING.shiftClockSec`), a relief walks in. The
    one on duty walks out only once the relief has arrived, so a post is never
    left empty.
  - Cleaners loop the toilet blocks.
  - Layout edits walk the staff of removed kit out and bring new staff in for
    new kit.
  - Crew draw after passengers in the pose order (`HallNav.crewRole(i)`), in
    uniform and with no bag. Tunables: `CREW_TUNING` (`src/paxnav/config.ts`).
- **Determinism and saves.** Nothing in the walk or the crew rolls outside the
  seeded RNG or fixed hashes, and none of it is saved. After a load the hall
  opens staffed and walkers restart from the next released guests. The only
  thing the walk writes back into the sim is guest happiness, through waits.
- **Tests:** `src/game/hallPathing.test.ts` covers:
  - placed walls;
  - the queue read-out;
  - 500 passengers through the starter hall, checked every tick;
  - waits feeding mood;
  - crew;
  - determinism, save safety, and 1,300+ walkers.

  `src/paxnav/crew.test.ts` covers posts, shift relief without wall crossing,
  edits, cleaners and determinism.
