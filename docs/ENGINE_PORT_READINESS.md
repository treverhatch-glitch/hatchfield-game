# Engine port readiness

**Verdict: not yet.**

The tick already runs without a canvas. React never enters the sim. Three.js does not enter the production sim import graph. The sim is still not a library you can lift, and three loops the port would freeze are only proven headless.

## Boundary

Production code under `src/game` does not import React or `src/ui`.

These production files import `src/render`. None of the modules they import pull `three`:

| File | Imports |
| --- | --- |
| `src/game/sim.ts` | `getAircraftSpec`, `METERS_PER_CELL` from `aircraft/specs`; `bridgeMirror`, `standAccepts`, `standLetter`, `wingDiscsClash` from `aircraft/stands`; `planTerminal`, `terminalPlanSeed` from `world/plan`; `terminals` from `world/layout`; `RoomPlan` as a type from `world/rooms`; `hallFitFor`, `matchTerminal` from `hallRooms` |
| `src/game/rosterMetal.ts` | `REAL_AIRFRAMES` and `IcaoCode` from `aircraft/realworld` |
| `src/game/standFoot.ts` | `envelopeLetter`, `envelopeWorld` from `aircraft/stands`; `CELL` from `aircraft/specs` |
| `src/game/hallRoute.ts` | room graph from `world/rooms` (`navPath`, `roomAt`, `pointInRoom`, `HALL_NODE_ROOM`, `STERILE_ROOMS`) |

`src/render/hallRooms.ts` imports `src/game/hallRoute` and `src/game/terminal`. That is a folder cycle. It does not import `sim.ts`, so constructing `Game` does not run a render class. You still cannot load the tick without the room planner and the hall fit.

`src/servicepoints`, `src/landside`, `src/diplomacy`, `src/carts`, `src/catering`, `src/logistics`, `src/paxnav`, and `src/wave3` do not import render, React, or Three. `src/landside/wiring.test.tsx` is the exception, and it is a test.

## Trivial leaks fixed

Two paint helpers sat on the tick's import path. Both moves keep the same bytes.

- Mulberry32 lived in `src/render/world/raster.ts`, next to the texture painter and `GROUND_LOOK`. It is now `src/game/mulberry.ts`. `hallRoute` and `planTerminal` seed from there. `raster.ts` re-exports the same function, so ground textures stay on the old sequence.
- `roadKerbs` lived in `src/render/world/layout.ts` and was the only reason `terminals()` loaded `GROUND_LOOK`. It is now `src/render/world/kerbs.ts`.

## Left where they are

Moving these would be a port of the data, not a one-line leak fix. They stay under `src/render` and the sim keeps importing them:

- Airframe metres and the visual scale (`aircraft/specs.ts`, `aircraft/realworld.ts`). `WORLD_PER_METER` is 0.45 and `METERS_PER_CELL` is 22. Specs do not import Three.
- Stand acceptance and wing discs (`aircraft/stands.ts`).
- Terminal clusters, room plans, and doorway routes (`world/layout.ts`, `world/plan.ts`, `world/rooms.ts`). Their headers say they are plain data. The sim uses that data to place guests.
- Hall fit (`hallRooms.ts`), which maps one apron terminal into the 48×32 m hall and calls back into `src/game`.

Test-only imports, not on the shipped tick:

- `hallNav.test.ts`, `hallNavGuests.test.ts`, and `hallArrivals.test.ts` import `HallNavCrowd` from `render/hallNavCrowd.ts`, which imports Three.
- `rosterAirlines.test.ts` imports `rosterLivery` from `render/aircraft/procLivery.ts`. The function itself returns paint data. The file imports Three for the canvas plates, so the test loads Three. Splitting that file would touch the colour helpers.
- `starterLayout.test.ts` and `hallRoute.test.ts` import layout and rooms.

Other modules that are not the tick, listed so a port does not treat them as sim:

- `src/environment/sample.ts` reads daylight helpers from `render/world`. Those helpers do not import Three.
- `src/camera/layout.ts` and `src/audio/stage.ts` read `CELL` from specs.
- `src/fids/stage.ts`, `src/tier3/meshes.ts`, and `src/scale/placeholders.ts` build meshes and import Three on purpose.
- `src/ui` imports render to draw. That direction is the one a port wants.

## Render writes to sim state

The draw loops read flights, tiles, guests, and poses. They do not assign cash, tiles, guests, or flights.

Production writes, all through `Game` methods:

- `src/render/hallWorld.ts` pointer-up and build click call `selectGuest`, `selectFacility`, `toggleInfo`, `placeHallFootprint`, `placeHallItemAt`, `moveHallFootprint`, `moveHallItem`, and `removeHallItem`. That is input, not a leak. An engine port keeps these as commands from the new view.
- `src/render/world.ts` `followCameraCue` calls `consumeCameraCue`, which clears `cameraCue` during the frame. That is the one draw-path mutation. Leaving the cue for the view to clear would risk a second pan. It stays.

Tests, not the running game: `src/render/world/fixtures.ts` sets `sandbox` and `startFocus` and calls `beginNew`, `buyLand`, and `buildStarterKit`. `src/render/world/render.test.ts` assigns `view`, `spawnCool`, `hallGuests`, `clock`, and `speed`, and calls `tick`.

## What a port would take

Two shapes. Neither is a calendar estimate. Both wait on the gaps below.

**JS bridge (Godot or Unity hosting this TypeScript).** Keep the tick. It already runs under Vitest with no WebGL. The bridge has to ship the pure modules listed above or `Game` will not start. Replace the files that import Three — `render/world.ts` (about 2,500 lines), `render/hallWorld.ts` (about 2,000), the aircraft mesh factory, vehicles, materials, and the rest of the mesh tree — and replace `src/ui` (React 19). Hall clicks and the camera cue move to the engine's input and call the same `Game` methods. Godot can embed JavaScript. Unity needs a JS host or a WASM build of the same sources. The view is a rewrite either way. The sim source stays.

**C# rewrite.** Reimplement the host in `src/game/sim.ts` (about 23,000 lines) plus the pure engines: landside, diplomacy, carts, catering, logistics (about 2,100 lines), paxnav (about 1,700), hall nav, service points, wave3, and economy. Copy the data tables with them: realworld, specs, stands, rooms, plan, layout, hall fit. Do not port Three or React. Cut or copy the `hallRooms` cycle first. `src/game/mulberry.ts` has to stay bit-identical or doorway targets move. This is a behavior port of the tick, not a scene conversion.

## Unproven in the browser

**Diplomacy.** `src/diplomacy` is pure TypeScript with no React or Three. Vitest covers standing, letters, churn, and headless one- and two-year sims (`docs/DIPLOMACY.md`). `Game.tickDiplomacy` advances the bridge, and `DiplomacyLetters` plus the owner chrome read `diplomacyLetters()` and `diplomacyRoster()`. No browser session in this tree closes a letter, a standing change, a capacity cut, and a changed flight bank as one loop. This audit did not edit `src/diplomacy`. Wave3 airline relations are a different system and are not this gap.

**Traffic.** `LandsideTraffic.tick` runs from `tickLandside`, and `LandsideLayer` draws the snapshot. `src/landside/landside.test.ts` and `soak.test.ts` are headless: a small bank stays on time, a bigger bank queues, a built-out curb clears it. The traffic info view is markup (`wiring.test.tsx`, and the info-views e2e checks that the panel is present). A player session has not shown curb vehicles, a growing queue, a missed check-in, and the lost passenger fee as one loop you can see and fix.

**Service-point vehicle flow.** Check-in desks and security lanes are staffed in the sim, including a player-built hall, and that rule has unit tests. The vehicle loop is separate. `tickCarts` posts bag carts and catering trucks between named sockets. `src/game/cartHandoff.test.ts` asserts those socket names after a headless tick. `world.ts` draws `cartPoses`, `cateringPoses`, and `servicePoses`. Nothing in the browser proves a cart leaves the desk, docks, and the bag stage moves because of that dock. The hall-restock screen test shows a counter chip, not that drive. Apron turnaround vehicles from the logistics engine are the same shape: posed and drawn, not a closed browser proof.

## What would change the verdict

Move the pure tables (specs, stands, realworld, plan, layout, rooms, hall fit) to a folder the renderer imports, or accept that a JS bridge ships them with the tick. Then prove diplomacy, curb traffic, and the cart-to-socket loop in a browser session. After that, a JS bridge is a view replacement. A C# port is the same proof plus a behavior port of `sim.ts`. Until then the port would freeze unproven rules and a sim that still reaches into the render tree.
