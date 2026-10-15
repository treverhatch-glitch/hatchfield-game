# Visual QA — jet-bridge proof stills — 16 Oct 2026

Read-only check of the five things in the jet-bridge proof stills. No game code changed.

Watched on `?playtest=1` with `window.__hatch`, headless Chrome (SwiftShader). Passenger starter on the Riverside city plot, jet bridge bought on stand `11,6` (`standPaxMode` is `jetway`, `bridgeExtend` held at 1 through servicing). Three airframes were placed on that stand, `beginServicing` was called, and the sim ran until the legacy fuel truck and the legacy bag truck were both dwelling: 5.5 sim seconds on each. The scene was then frozen (`speed` 0) and measured from the live meshes.

The numbers below were taken on `3249f061`. `origin/main` has since moved to `3ceeeebc`. Those 13 commits are the jet-bridge fuselage seal, the bridge retract before pushback, and traffic packages 1 and 2. They do not change crew scale, the legacy truck target, the ghost belt, or the vehicle LOD distance. Line numbers are from `3ceeeebc`.

Airframes: BN-2 Islander (smallest regional), E175 (the airframe named in the proof HUD), 737-800 (narrowbody).

World scale is `WORLD_PER_METER` 0.45. Aircraft draw at that times `AIRCRAFT_VISUAL_SCALE` 1.2 (`src/render/aircraft/specs.ts`). Trucks and people are real metres. A bounding box reported as "visual m" is world size divided by 0.45, so it includes the 1.2 aircraft bump. Divide by 1.2 for the real airframe.

## What the meshes measured

| | BN-2 | E175 | 737-800 |
|---|---:|---:|---:|
| Spec, real m (L × H × span) | 10.86 × 4.18 × 14.94 | 31.68 × 9.73 × 28.65 | 39.47 × 12.55 × 35.79 |
| Drawn bbox, visual m (L × H × span) | 13.11 × 5.02 × 18.02 | 38.29 × 11.83 × 31.3 | 47.69 × 15.00 × 43.11 |
| Fuel truck and bag train offset from the aircraft origin | 0.00 m | 0.00 m | 0.00 m |
| Ghost belt centre, offset from the origin | 4.1 m | 7.8 m | 9.7 m |
| Live-turnaround head tops on the apron | 3.5–4.1 m | 3.2–5.1 m | 3.2–3.9 m |
| Tallest live-turnaround head (on the airframe) | 6.5 m | 8.2 m | 8.4 m |
| Ground-crew instance scale | 0.46 | 0.47 | 0.45 |

The drawn boxes match real length and height times 1.2. The span sample is a little short of the spec on the E175 (wingtip vertices were stepped). The aircraft are the right size. The people and the trucks are what read wrong.

Fuel fleet mesh scale was 0.45 on every frame (`fleet:fuel_tanker`). Ghost belt scale was 0.45 (`rig:belt_loader`). Neither truck is drawn at 2.2×. The 2.2× is the live-turnaround people.

## 1. Ground crew look oversized — REAL BUG

A 1.75 m person should stand a bit over half an E175 fuselage (diameter about 3.0 m) and well under the BN-2's high wing. The figures standing on the fuselage in the proof stills are about as tall as the tube.

Two body renderers draw the same turn.

- `CrewFigures` builds people at `unitsPerMeter: WORLD_PER_METER` (`src/render/crew/figures.ts:82`). Their instance scale measured 0.45–0.47. That is a 1.75 m person.
- `LiveTurnaround` builds a second set at `unitsPerMeter: 1` (`src/render/liveTurnaround.ts:135`) after `vehicleCrew` / `standCrew` have already multiplied positions by `WORLD_PER_METER` (0.45). The body is then 1 / 0.45 = 2.22 times too big. Head tops of those crew, standing on the apron beside the truck, measured 3.2–4.1 m. One figure per airframe stood up on the belt at the cargo door: head top 6.5 m on the BN-2, 8.2 m on the E175, 8.4 m on the 737. That is the yellow figure on the fuselage in the stills.

The aircraft are not shrunk. `airframes.ts` still has an old per-type `scale` (BN-2 0.36, E175 0.84). The renderer does not use it. `createAircraft` scales the LOD by `aircraftWorldPerMeter()` only.

**Fix.** Pass `WORLD_PER_METER` into the `LiveTurnaround` `PeopleRenderer`, the same way `CrewFigures` does. Positions are already in world units.

**Already owned.** This is the 2.2× scale on the turnaround runs 1+2 agent (`bc-540109cd`, fuel truck LOD / ghost rigs / 2.2× / belt cubes). The truck meshes themselves are already at 0.45. The 2.2× that shows up in the stills is this people renderer. Not filed as a second change.

## 2. Fuel truck parks inside the wing and fuselage — REAL BUG

On all three airframes the dwelling fuel truck's centre was the aircraft origin. Distance measured 0.00 m. The path ends on the stand cell.

`ensureLegacyFuel` and the fuel dispatch inside `beginServicing` both route to `f.stand` (`src/game/sim.ts:12944`, `src/game/sim.ts:25245`). The stand cell is the aircraft origin. There is no per-airframe fuel spot on this path.

The tanker is `fuel_tanker` 10.0 × 3.2 × 2.5 m (`src/render/vehicleModels.ts` `MODEL_SIZE`). Centred on the origin, half-width 1.25 m, roof at 3.2 m:

| | Fuselage half-width | Wing height | What the 10 × 2.5 × 3.2 m body does |
|---|---:|---:|---|
| BN-2 | 0.90 m | high wing, about 2.9 m | Wider than the fuselage (0.35 m of body past the skin on each side) and the roof goes through the wing. The 10 m length covers almost the whole 10.9 m aeroplane. |
| E175 | 1.48 m | low wing, underside about 2.9 m | The 2.5 m body sits inside the 3.0 m tube, and the roof meets the wing. This is the proof still. |
| 737-800 | 1.88 m | low wing, underside about 3.4 m | Still buried in the belly at the wing root. The larger tube hides it more; the centre is the same point. |

`standAnchors` does know a fuel stop (`src/logistics/serviceFlow.ts:163`): `span/2 + 8` m outboard of a generic S/M/L frame, hold on the other side. The starter apron never uses it. Logistics docking waits on a GSE depot, and the starter kit has a farm and no depot. The turn the player watches is the legacy path.

`aircraftSocketTable` already has a per-airframe `plane_fuel_port` (`src/render/socketLayout.ts:173`): outboard of the skin by `max(rx + 1.2, span × 0.18)`. The ghost fuel rig parks its hose reel on that port, but only when no real fuel truck is within 36 m (`NEAR_M` in `src/render/liveTurnaround.ts:20`). During the dwell the real tanker is on the stand, so the ghost fuel rig was absent. The truck in the still is the real one.

**Fix.** Stop routing the legacy bowser at the stand cell. Aim it at `plane_fuel_port` for that airframe, then back the body up by half the tanker length so the tank stays outside the skin. A BN-2 and a 737 cannot share one cell. The S/M/L frame in `standAnchors` is too coarse for the Islander (its real half-span is 9.9 m; the S frame parks fuel at 21 m).

**Not the owned LOD work.** No `far:` mesh was in the scene, including at the default orbit (distance 88). `FULL_DETAIL_DIST` is 8000 (`src/render/viewBudget.ts:14`), so the close tanker does not swap for the three-box shell inside the playable zoom. The Oct 15 "lost graphics at the farm" LOD pop is not what these stills show. Leave any remaining LOD pass with the turnaround agent.

## 3. Bag truck and fuel truck occupy the same spot — REAL BUG

The bag train's centre was the same point as the fuel truck: 0.00 m from the aircraft origin, on every airframe. Both paths end at `f.stand`.

- Bags: `beginServicing` routes the unload tug to the stand cell (`src/game/sim.ts:25221`). Kind `bags` draws as `baggage_train`, 9.6 × 1.9 × 1.6 m.
- Fuel: the 10.0 × 2.5 × 3.2 m tanker, same cell.

Centres coincide, so the bag train's footprint sits inside the tanker's. That is the overlap in the stills, before the extra belt is counted.

A third body is the ghost belt. `isBelt` matches only `belt_loader` (`src/render/liveTurnaround.ts:77`). The legacy tug's kind is `bags`, so `ensureBelt` (`src/render/liveTurnaround.ts:305`) always adds `rig:belt_loader` (7.6 × 2.4 × 2.1 m, scale 0.45, correct size) with `belt_tip` locked to `plane_cargo_door_fwd`. Its centre was 4.1 m from the origin on the BN-2, 7.8 m on the E175, 9.7 m on the 737. On the Islander that door is still inside the tanker's 10 m length, so the belt is parked in the fuel truck. On the E175 the centres are 7.8 m apart against a combined half-length of about 8.8 m, which is the overlap in the proof still. The 737 is the least bad and still shows the belt against the tanker.

`bag:belt:<flight>:0..2` (the three ride-along bags) and `box|belt|0` (the apron belt cubes from `syncBeltBags`, `src/render/world.ts:2087`) were in the scene. Those cubes are the owned belt-cube item.

**Fix, split so it is not a second copy of the owned work.**

- The two legacy trucks need different per-airframe stops: fuel at `plane_fuel_port`, bags at `plane_cargo_door_fwd`, on opposite sides when both doors exist. Same change as issue 2.
- The ghost belt is the owned ghost-rig work. Drop `ensureBelt` when a `bags` truck is already on the stand, or teach `isBelt` that `bags` is the belt for this apron. Do not start that here.

**Not the traffic agent.** Traffic packages 1 and 2 (`bc-4998fa17`) own physical bodies and right of way on the curb and the apron lanes. These two trucks are given the same stand cell by the service dispatch. A right-of-way rule would not pick a fuel spot.

## 4. Tiny people on the apron — ARTIFACT

The small figures are the correctly scaled ground crew. They read as tiny because the live-turnaround crew beside them are 2.2×.

Measured on the jetway stand during servicing:

- `game.people` within 8 cells of the stand: empty. Jetway boarding does not spawn the apron arrival walkers (`beginServicing` sets `paxOut` to 0 when `standPaxMode` is `jetway`). They are not preview passengers.
- Ground-crew mid bodies (`people-headLo` under `ground-crew`): instance scale 0.45–0.47, i.e. 1.75 m. Two of them on the BN-2 (the fuel driver and helper). Six on the E175 and the 737 (fuel, plus the cleaning pair and the GPU pair, whose feet are placed 1.0–1.5 m up at the door).
- One capsule in the whole scene: 1.85 m, the mechanic height (`src/render/world.ts:2037`), about 440 m from the stand. Not on this apron.

After the live-turnaround people drop to 1.75 m, these figures match them. No separate scale bug, and no stray passenger stream on this stand.

## 5. Stutter — ARTIFACT of this machine's frame time

At 1×, with the E175 turn on screen and no screenshots being taken, 3.5 s of `requestAnimationFrame` was flat: 8 frames, median 383 ms, min 383 ms, p95 417 ms, max 483 ms. About 2.6 fps, with no spike.

At 5× over the same window: 7 frames, median 317 ms, one frame at 17 ms and one at 1300 ms.

The 12 s capture (48 frames, 4 fps) compressed to 163 KB. Consecutive frames are almost the same picture. The scene is not popping meshes or teleporting the truck between grabs. It is a slow, steady slideshow.

This Chrome is SwiftShader. `docs/handoff/MERGE_STATE.md` already records that this VM often cannot hold a playable frame rate. A flat 383 ms frame is that renderer being full, not a sim hitch and not a video encoder dropping frames out of a smooth 60 fps. The 5× sample has a single 1.3 s stall in a short window. That is too thin to call a game bug.

**Fix.** None from this sample. Re-time a capture on a GPU before treating the proof clips' stutter as a render defect. The owned turnaround and traffic work should not pick this up as an FPS task.

## Ownership

| Finding | Verdict | Who already has it |
|---|---|---|
| 1. Crew at 2.2× | Real bug | Turnaround runs 1+2 (`bc-540109cd`). The 2.2× is the people renderer, not the truck mesh. |
| 2. Fuel truck on the aircraft origin | Real bug | Nobody. LOD and the ghost fuel rig are the other agent's; this truck is the legacy one. |
| 3. Bag train on that same cell | Real bug | The shared cell is new. The extra `rig:belt_loader` and the belt cubes are the turnaround agent's. |
| 4. Tiny apron figures | Artifact | Goes away with the 2.2× crew fix. |
| 5. Stutter | Artifact on this VM | Not a task for the traffic agent. |

Traffic packages 1 and 2 (`bc-4998fa17`, branch `cursor/traffic-lanes-7406`) stay on lanes, stalls, and right of way.

## Stills and clip

Captured from the frozen servicing dwell, canvas 1440×900, plus one 12 s / 4 fps clip of the E175 at 1× while the camera swung in.

- `/opt/cursor/artifacts/visual-qa-oct16/01-bn2-service.jpg`
- `/opt/cursor/artifacts/visual-qa-oct16/02-e175-service.jpg`
- `/opt/cursor/artifacts/visual-qa-oct16/03-b738-service.jpg`
- `/opt/cursor/artifacts/visual-qa-oct16/04-b738-default-orbit.jpg`
- `/opt/cursor/artifacts/visual-qa-oct16/05-e175-wide.jpg`
- `/opt/cursor/artifacts/visual-qa-oct16/06-e175-close.jpg`
- `/opt/cursor/artifacts/visual-qa-oct16/e175-turnaround.mp4` (12.0 s, 4 fps, 163 KB)
