# Turnaround and servicing audit — 15 Oct 2026

Read-only look at `main` (`e06b38be`) after Trever's playtest. No game code changed.

The ramp the player watches is two clocks and three pictures of the same truck. The logistics module (`src/logistics/engine.ts`) runs a minute-scale turnaround, but it does not start until a vehicle depot and a fuel farm both exist (`src/game/logisticsBridge.ts:79-92`). The starter kit has a farm and no depot, and stamping a depot is refused until Airside Ops T3 (`Requires research: GSE depot`). So the first hour, which is what this playtest watched, is the flight phase machine in `src/game/sim.ts` plus legacy trucks. On top of those trucks, `LiveTurnaround` draws a second fuel tanker and a second belt loader whenever the real one is more than 36 m from the stand.

Recommendation up front: one service actor per vehicle, one mesh per actor, and only the gates Trever named. Keep the dock poses, the crew step shares, the metre-scale vehicle models, and the depot fleet. Stop clearing unfinished fuel, bags, and catering on a timer, and stop spawning a stand-in truck because the real one is busy at the farm. No two vehicles occupy the same space: aircraft first, then a pushback tug, then traffic already on the apron road, with a gap behind the vehicle ahead and a reserved slot at the stand.

Watched on `?playtest=1` with `window.__hatch`, headless, two full passenger turns (an E175, then a CRJ700) after buying a jet bridge on stand `11,6`. A Citation was on approach during the CRJ's board. The logistics minute-times below are from `LogisticsSim` on the module's own default graph, which is not the starter apron. Stills in `docs/devlog/media/turnaround-audit/` are those frames with the shadows lifted so the SwiftShader image reads. The mesh names in the log are the evidence for the swaps.

## 1. What each vehicle actually did

Starter services that drew, and the ones that never showed up.

| Service | On the starter apron | What the watch showed |
|---|---|---|
| Fuel bowser | Legacy `fuel` truck. Spawns on the farm cell the moment taxi-in ends (`sim.ts:12775-12783`, `beginServicing` at `27044`) | CRJ deboard at clock 46.6: truck already at `(7,5)`, the fuel tile. At 50.3 it is at the stand `(10.9,6)`. At 55.3 it is `fuel_reload` at `(8.3,6)`, heading back. It never waited for catering or bags |
| Baggage tug | Legacy `bags` | Unload starts at the south belt `(13,12)`, not at the hold. During board one tug sits at the claim `(13,13)` with dwell 0.3 and another sits on the stand. A tug was logged at `(13,9.4)` on the E175, which is the gap between the two belt runs |
| Belt loader | Not a legacy truck. `LiveTurnaround` spawns `rig:belt_loader` for the whole service (`liveTurnaround.ts:214-223`) | Present from the first deboard frame until pushback, including while the real tug was at the claim |
| GPU | Fallback prop from `turnaroundEquipment` (`sim.ts:12326-12332`), not a driven truck | `fleet:gpu` appeared at servicing (clock 50.3) and was gone by board |
| Pushback | `fleet:towbarless_tug` only while `phase === 'pushback'` | CRJ push at clock 96.0, taxi-out at 98.8. The shove is a fixed 2.8 s (`sim.ts:27307`) |
| Jet bridge | Only after `buyFitting('stand:11,6', 'jet_bridge')`. Starter stands are `remote` (`starterLayout.ts:117-118`) | Extend was 0.28 at the start of the E175 deboard and 0 for the whole board on that same jetway stand |
| Catering, lav, water, bus, stairs, cleaning van | In the depot grant (`src/scale/data.ts:152-161`) and in the logistics graph. Not in the legacy truck kinds (`types.ts:769-779`) | None of them dispatched. Catering stayed `posted: false` and `waitingOn.catering: false` through pushback. Cleaning is a fee posted 2.5 s into servicing (`sim.ts:27065-27073`), not a crew |

The depot fleet, once research and a depot exist, is 2 fuel, 2 catering, 3 baggage tugs, 2 pushback, 2 GPU, 2 buses, 2 belt loaders, 1 lav, 1 water. There is no stairs vehicle in that grant. Stairs are a pax-flow prop (`src/ramp/paxFlow.ts:164`).

## 2. Graphics: where the mesh changes

### Fuel truck at the farm

Trever: the bowser loses its graphics when it parks at the fuel station.

The truck's path target is the fuel tile. `walkableFor('truck')` includes `'fuel'` (`src/game/path.ts:41-47`), and `ensureLegacyFuel` paths from `farms[0]` to the stand, so the truck is created on the farm cell. A reload then holds it there: `preDwell = 1.4` when it is already at the farm (`sim.ts:25619-25629`), and the tick does not move a truck while `preDwell > 0` (`sim.ts:27426-27428`). Finishing a delivery sets `preDwell = 1.5` and `mission = 'fuel_reload'` (`sim.ts:27604-27608`). The farm mesh (`addFuelFarm` in `src/render/world/airsideMass.ts`) occupies that same cell, so the bowser sits in the tanks and under the canopy for that dwell.

At the same moment the mesh identity depends on the camera. `vehicleIsFar` divides world distance by `item.scale` (`WORLD_PER_METER`, 0.45) and compares to `VEHICLE_LOD_M = 130` (`vehicles.ts:118-120`, `vehicleModels.ts:189`). The default orbit is `dist = 88` (`world.ts:310`). A truck near the pivot is `88 / 0.45 ≈ 196` m, which is past 130, so the default view draws `buildVehicleFarParts`: three boxes, no tank, no hose, no livery (`vehicleModels.ts:1288-1298`).

Logged on the CRJ, same park, two frames:

- Dist 88, aimed at the farm: `far:fuel_tanker|#c9a227`. `02-fuel-farm-overview.png`.
- Dist 18, same truck: `fleet:fuel_tanker|#c9a227`. The tank exists again. `03-fuel-farm-close.png`.

That swap is the lost graphics. Zooming in does not reveal a truck that was clipped away. It swaps the three-box shell for the tanker. The close park still puts that tanker on the fuel cell, inside the station.

A second tanker is drawn at the aircraft for the whole time the real one is at the farm. `LiveTurnaround` looks for a fuel truck within `NEAR_M = 36` m (`liveTurnaround.ts:20, 68-70`). The farm is several cells away, so `ensureFuel` builds `rig:fuel_tanker`, parks its hose reel on `plane_fuel_port`, and hides the hose (`liveTurnaround.ts:279-302`). On the CRJ deboard frame the scene contained `rig:fuel_tanker`, `rig:belt_loader`, and `far:fuel_tanker` together (`05-stand-service.png`, `06-stand-default-zoom.png`). When the real bowser reached the stand the ghost fuel rig dropped (clock 50.3). When the bowser left for reload, the ghost came back for boarding (clock 55.3) even though fuel was already posted. The belt ghost never dropped, because the legacy tug's kind is `bags`, and `isBelt` only matches `belt_loader` (`liveTurnaround.ts:77-78`).

`shownPhase` makes the same class of pop on the logistics clock, which this starter save never reached. Loading at the farm dock is rewritten to phase `servicing` at `u = 0.5` (`serviceFlow.ts:386-392`), so the hose pays out while the truck is filling, and the dock offset is a few metres, still inside the fuel cell.

### Orange dots between stands

Two different orange things.

The ones that cross the apron are not crew. `syncBeltBags` builds eight cubes, colour `#ffb703`, and lerps them along every `belt` tile in row-major order, then wraps with `(idx + 1) % n` (`world.ts:2212-2249`). The starter belts are two runs: `(11,7)–(13,8)` and `(13,10)–(13,12)` plus `(12,12)` (`starterLayout.ts:133-140`). The wrap draws a straight line from the last cell back to `(11,7)`, and the gap between `(13,8)` and `(13,10)` draws another line across the face of the terminal, between the stands. Y is hardcoded `0.48`, not the belt height. On the E175 approach the eight cubes sat at world y `0.5` with z from about `-83` to `-35`, which is row 7 through row 12, including the cells that are not belt. `01-belt-gap.png`.

The other orange is the crew dot. Helper vests use `HI_VIS_B = 0xf97316` (`src/render/crew/figures.ts:22`). Full figures exist only inside 38 world units, and only 32 of them; past that, up to 80 dots, out to 110 (`src/ramp/crewConfig.ts:109-114`). At speed ≥ 5 both crew renderers are forced onto the lite path (`world.ts:2199-2200`). The playtest ran at 5×, so the marshaller and chock crew were dots whenever the camera was not in the close band. They walk the stand timeline. They are not what cuts across the gap. The belt cubes are.

### Jet bridge seepage

The cab is an opaque Lambert box, `#7ec3e8`, placed at `skin + 0.8` in aircraft space, named `bridge` (`bridges.ts:28-37`). `applyBridge` moves and hides only `bridge-tunnel` and `bridge-column` (`world.ts:241-256`). The cab never scales and never hides, so it stays buried in the door when the tunnel is shut. The fuselage LOD fade sets `transparent` on the fade clones (`src/render/aircraft/pool.ts:200, 229, 259`). The bridge group is parented on the aircraft root, outside `CrossfadeLOD`. An opaque cab inside a transparent skin is the see-through seam.

The starter does not show this until a bridge is bought. Both starter stands are remote. After `buyFitting` on `11,6`, the E175's `bridgeExtend` was 0.28 at deboard start and 0 for the entire board (`08-jet-bridge.png`, `09-jet-bridge-quarter.png`). `bridgeExtend` is 0 outside deboard, board, servicing, and parked (`sim.ts:12366-12371`). During board it returns `samplePax(...).extend`, which is 0 in the `clear` span (`paxFlow.ts:144-151`). So the tunnel folds away while passengers are still the boarding picture, and the cab remains in the fuselage. That is the seepage on a stand that does have a bridge.

### Other pops on the same frames

- `LiveTurnaround` builds its people with `unitsPerMeter: 1` (`liveTurnaround.ts:135`) while `standCrew` already multiplies positions by `WORLD_PER_METER` (0.45). Those bodies are about 2.2× the apron people.
- GPU, and on the logistics path the cleaning van and the tug, can be drawn by `turnaroundEquipment` and again by the real vehicle (`sim.ts:12321-12324`).
- Legacy apron capsules are a third body, updated in the same `syncEntities` pass as `crewFigures` and `liveTurn`.
- Aircraft LOD and vehicle LOD do not share a distance. The aircraft comment says the default orbit is 54 (`src/render/aircraft/lod.ts:7-8`). The apron camera is 88 (`world.ts:310`). Vehicles pop to boxes well inside the distance where the aircraft is still the mid mesh.

## 3. Crew motion

The capture could not read crew world positions. `crewScene().people` carries ids (`pax:0`, `marshal`, `chock-1`, `cones`) and the renderer applies the pose. What the log shows:

- E175 board, about 40 s of sim time: crew count stayed at 2. Pax ids disappeared from the list one at a time (`pax:0`, then `pax:1`) instead of walking off a path.
- CRJ at 1× after taxi-out: the list was empty for several ticks, then only `marshal` and `chock-1`. Chocks are supposed to stay (`standArrivals` holds them until pushback, `sim.ts:12303-12314`). An empty list in the middle of a turn is a crew that is not drawn, not a crew that is waiting.
- At 5× the lite flag forces dots, so the close band never shows a walk cycle while the player is fast-forwarding the turn.

The step code is a linear share of whatever window the sim already has (`CREW_SHARES` in `crewConfig.ts:17`). Park, exit, walk, connect, work, disconnect, board, drive off. There is no blend between poses, no path smoothing, and no facing separate from the segment. `clampAim` in `src/ramp/crewActions.ts` caps a reach at 10 m, so a helper whose target is further away aims short and then the next step snaps. That is the motion quality to replace. It is not a second sim clock, and it should stay that way: the shares fill the service window and do not add time.

## 4. Timing

### Watched clock (sim seconds)

One game hour is 7.5 sim seconds (`logisticsBridge.ts:16-18`). These numbers are the flight the player sees, not airline minutes.

CRJ700 on the jetway stand, from the phase log:

| Phase | Clock | Length | Who was there |
|---|---|---|---|
| Deboard | 46.6 → 50.3 | 3.7 s | Bowser parked on the farm cell. Bags tug at the south belt. Ghost fuel and ghost belt at the aircraft. GPU not yet |
| Servicing | 50.3 → 55.3 | 5.0 s | Bowser at the stand. GPU mesh on. Ghost fuel gone, ghost belt still there. Cleaning fee posts at 2.5 s, no cleaning crew |
| Board | 55.3 → 96.0 | 40.7 s | Fuel already posted. Bowser on the reload trip. Ghost fuel back. One bags tug dwelling at the claim, one at the stand. This is where the turn waits |
| Pushback | 96.0 → 98.8 | 2.8 s | Towbarless tug only. Matches the fixed shove at `sim.ts:27307` |

The E175 was the same shape: fuel posted before board, catering never requested, board held past 35 s of `phaseTime`, pushback about 2 s. `fuelDwellSeconds` for a narrowbody is 1.6–9 s (`airframes.ts:603-606`), so the pump itself is not the 40 s. The board phase is.

### Logistics clock (minutes, default graph, not the starter)

`LogisticsSim` with `defaultConfig()`, `fuelWithPaxOnBoard: false`.

| Airframe | Stand | Block | What the critical path was |
|---|---|---|---|
| B738 | stand-2, bridge | 92.5 min | Deplane 0–8.4. Fuel blocked until 8.4, bowser arrives 19.0, fuel done 34.6. Boarding starts at 34.6 because it waits for fuel, and runs to the 80 min gate. Door close 80–82. Pushback done 92.5 |
| A320neo | stand-1, hydrant | 92.5 min | Fuel 8.0–13.7, no fuel truck. Boarding starts at 20, when catering (19.7) and cleaning (20) finish, and still runs to 80 |
| A359 | stand-2, bridge | 126.5 min | Fuel 7.2–82.0, three bowser trips. Boarding is held until 82. The pump is the critical path only because boarding is not allowed to overlap it |
| B738 | remote-1, bus | 122.5 min | Buses, no bridge. Causes include `no_bridge` and `late_pax`. Boarding 38–111 |
| A320neo, flag on | stand-1 | 92.5 min | Fuel starts at 0 and is done at 5.7, before deplane finishes (8). Boarding still waits for cleaning and catering |

Catering on the B738 starts at t = 0, while deplane is under way, and finishes at 20. The README still says catering waits until the cabin is empty (`src/logistics/README.md:19`). The code does not (`engine.ts:1068-1071`). `turnaround.test.ts:32-45` locks the code's order, including "boarding waits for fuel, catering, and cleaning."

## 5. Dependency graph

Two graphs. Both have to change, or the player clock will keep skipping the logistics one.

### Logistics `advancePhases` (`engine.ts:1055-1113`)

| Service | Starts when | Trever |
|---|---|---|
| Deplane, bag unload, cargo unload, loader, GPU | Block-in | GPU at block-in is right. It does not gate anyone else. Chocks are not in this graph at all |
| Lav, water | Block-in, if the fleet owns the truck (`1065-1067`) | Essential that they use the panels and that they are clear before pushback. Starting at block-in is right |
| Catering | Deplane is no longer `blocked` (`1069-1071`) | Essential gate: deplaning under way, service door. Keep |
| Fuel | Deplane done, unless `fuelWithPaxOnBoard` (`1060-1062`). Default is false (`defaults.ts:118`) | False coupling. If the bowser is docked and refuelling is allowed, it starts. The safety rule is the flag, not a blanket wait for an empty cabin |
| Cleaning | Deplane done (`1072-1073`) | Essential. Empty cabin |
| Boarding | Deplane, cleaning, catering, and (fuel done or the flag) (`1074-1079`) | False coupling on catering and on fuel. Cleaning before boarding stays. Opposite-side catering and fuel-with-pax must not hold the passenger door |
| Bag load, cargo load | Both unloads done (`1081-1083`) | Essential per hold. Waiting for the other hold is false coupling when the holds are separate |
| Door close | Boarding, both loads, lav, water, and `(fuel done \|\| !flag \|\| booked === 0)` (`1084-1093`) | The lav/water/bags/boarding gates are essential. The fuel clause is inverted: with the flag on, door close does not wait for fuel. Trever wants the hose off and the equipment clear before the doors shut, flag or not |
| Pushback | `door_close` has left `blocked` (`1094-1095`), so the tug may pre-position. `maybeStartPushback` still waits until every service except pushback and the loader is done (`1126-1141`) | The pre-position is fine. The push itself is the join, and that part matches Trever |

### Player flight machine (`sim.ts:27037-27312`)

| Wait | What it does | Trever |
|---|---|---|
| `beginServicing` at the end of taxi-in (`27044`) | Trucks dispatch before the phase is `servicing` | Right idea, then the phase machine makes them wait anyway |
| Deboard (`27046-27058`) | Jetway holds the phase for `3.2 * pace` even after the trucks have left the depot. Bus and walk have their own minimums and a timeout | False coupling. Deboarding is a passenger actor. It should not be a gate on the bowser that is already allowed to pump |
| Servicing (`27060-27086`) | Leaves only when bags, fuel, and catering are posted and `phaseTime > 4 * pace`, or when `phaseTime > min(36, 22 * pace)`, which clears those three flags | The timeout is a fake bottleneck. It violates "bottlenecks come only from player choices." Catering that never spawned cannot be a real gate, and the timeout pretends it finished |
| Board (`27232-27292`) | Needs `paxIn` and bags loaded, or `boardLimit`. Pushback then waits on `rampCall`, and `boardLimit + 4` / `+ 80` release an unfinished ramp | Bags loaded before pushback is essential. Releasing on the timer is not |
| `rampCall` (`12630-12659`) | An empty farm holds the aircraft. Any other gap returns `'short'` once `timedOut` is set, with a Standing hit | The empty-farm hold is essential. The short release is the same fake skip |
| Pushback phase (`27303-27307`) | Fixed 2.8 s shove, then taxi-out | Not a service clock. The tug's own work should be the shove |

Chocks and a live GPU are not gates on either clock. Chocks are a picture on `STAND_TIMELINE`. The GPU is a timer (logistics) or a prop (legacy).

## 6. Collisions and right of way

Trever's rule: no two vehicles ever overlap. An aircraft has priority over every vehicle. A pushback tug has priority, and a vehicle already on the main apron road has priority over one entering it. Merges and intersections yield. A vehicle follows and brakes to keep a gap. The stand reserves slots so trucks do not converge on one point. A deadlock has a way out that does not drive through anyone.

### What exists

Three systems, and they do not share a body list.

| System | Where | What it actually does |
|---|---|---|
| Legacy `followPath` | Every starter truck, city cargo, the aircraft once it is taxiing or pushing (`sim.ts:24849-24895`, truck call at `27511`) | Each entity lerps its own polyline. Nothing reads another body's length. `congestionAt` (`24533-24570`) counts jets, trucks, and some people inside 1.15 cells and divides speed by `1 + n * 0.65`. A crowd slows. It never stops, yields, or reserves a cell |
| `ApronTraffic` | Logistics vehicles, and only after a depot and a farm exist (`logisticsBridge.ts:177-179`, `traffic.ts:1-18`) | Capsules, a 1.2 m gap, keep-right, follow by refusing a step that would overlap, parking slots, yield, and a deadlock hop (`traffic.ts:33`, `199-241`, `309-338`, `375-471`). Tests lock "no overlap" for that set alone (`traffic.test.ts:30-66`) |
| `LandsideTraffic` | Curb cars, taxis, buses (`landside/engine.ts:292-296`) | One polyline. Cars in `drive` or `queue` stop `queueGapM` (8 m) behind the vehicle ahead (`config.ts:49-53`, `engine.ts:446`). The header says this is a capacity model, not a street sim (`config.ts:4-8`) |
| `GroundControl` | Aircraft on taxi and runway cells (`atc/groundControl.ts:116-150`) | A cell queue and a runway lock for aircraft. `atcRoleOf` (`sim.ts:24577-24591`) returns null for deboard, servicing, board, and parked, so a jet on stand is not holding its cells. Trucks are not entries |

`ApronTraffic` priority is "whoever set off first, then id" (`traffic.ts:397-399`). It is not aircraft, not pushback, not "already on the apron road." `mustYield` (`309-338`) only fires for a crossing heading. Following and oncoming traffic rely on the capsule test. The deadlock break, after 1.5 min, hops up to 60 m along the route to the next clear sample, and after 3 min teleports into a newly reserved slot (`433-459`). That hop is a disappear-and-reappear, which reads as driving through the queue even though the landing spot is clear.

`reserveSlot` searches rings and, if none fit, parks on the node centre anyway (`traffic.ts:239`). That fallback is an allowed overlap. The clearance test also never sees the mesh the player sees: `poses()` asks traffic for a road body, then `withDock` (`engine.ts:713-720`) and `placeServicePose` (`sim.ts:12222-12240`) slide the draw position onto the hose, door, or hold. Bag unload, bag load, cargo, and the belt loader all share `stand:{id}:hold` (`serviceFlow.ts:254-275`). Two clear road capsules can still draw on top of each other and on top of the fuselage.

Buildings, crew, landside cars, and legacy trucks are outside `ApronTraffic.overlaps()`. The starter save never constructs that object, because the depot stamp is refused until Airside Ops T3. Every overlap below was on the legacy clock.

### Logged on the two watched turns

Distances are in cells. One cell is 22 m (`specs.ts`). A bowser is 10 m long and a city truck about 8.5 m, so anything under about half a cell is one vehicle inside another.

| When (sim clock) | Where | What overlapped | Cause |
|---|---|---|---|
| E175 deboard 45.5; CRJ deboard 46.6 | Fuel tile `(7,5)` | Bowser spawned on the farm cell and held there (`fuel/fuel@7,5`) | `walkableFor('truck')` includes `'fuel'` (`path.ts:41-47`). `ensureLegacyFuel` paths from that cell (`sim.ts:12775-12783`). `preDwell` freezes the truck inside the station (`25629`, `27426-27428`). The farm mesh occupies the same cell |
| Same frames | Stand `11,6`, on the fuselage | `rig:fuel_tanker` and `rig:belt_loader` while the real bowser is still at the farm | `ensureFuel` / `ensureBelt` park the stand-in on `plane_fuel_port` and `plane_cargo_door_fwd` (`liveTurnaround.ts:279-326`). No test against the aircraft body or against each other |
| 20.8–22.1, again 31.8, 41.4–42.1, 63.2–63.7 | Guard road, column 17 around row 2 | Two `citycargo` trucks. Closest was 0.1 cells (~2 m) at clock 21.6: `city_depart@17,1.9` and `city_guard@17,2`. Same pair again at 31.8 with `city_shed` | Each truck calls `followPath` on its own path (`27511-27514`). A truck that has arrived dwells on the guard cell for ~1.4 s (`27519-27521`) and does not reserve it. The next truck's path ends on that cell (`9530-9558`). `congestionAt` only slows them. A departure then reverses the same polyline (`27500-27505`) and meets the arrival head-on |
| CRJ servicing 50.3 through pushback 96.0 | Stand cell `(11,6)` | `bags/load` sits on `(11,6)` while the CRJ is on that stand, including the pushback frame that also draws `fleet:towbarless_tug` | The bags path ends on the stand tile. Pushback is `followPath` on the aircraft (`27303-27307`) plus a tug prop. `GroundControl` is not holding the stand, and the truck is not an aircraft entry, so the jet rolls through the tug's cell |
| Whole deboard and board | Stand sockets | Ghost belt stays after the real tug arrives, because `isBelt` only matches `belt_loader` and the legacy kind is `bags` (`liveTurnaround.ts:77-78`) | The ghost and the real tug are two meshes for one job, and the ghost is pinned to the cargo door |
| Not a separate frame; the same fuel park | Fuel farm props | Bowser footprint vs tank and canopy meshes | No building volume is subtracted from the truck path. The decorative canopy tankers are a second pair of trucks that never move |

Crew are not in any of those body tests. `congestionAt` counts a few passenger jobs so an aircraft slows down. It does not steer the crew, and a truck never brakes for a marshaller. At 5× the crew are dots (`world.ts:2199-2200`) walking the stand timeline through whatever mesh is parked there.

### Landside, from the code

The curb watch was not a separate camera pass. The cars are a second simulator on the same road tiles the city trucks use.

- A car or taxi keeps an 8 m centre gap (`LANDSIDE.queueGapM`). A bus is a longer body and uses that same gap (`engine.ts:398`, dwell 40 s at `config.ts:31`). Two buses, or a bus and the car behind it, overlap by the difference between 8 m and the bus length.
- `carsPerLaneCell: 2` (`config.ts:12`) is the capacity count for one 22 m cell. The drawn agents are not capped by vehicle length.
- A vehicle in `leave` adds speed and does not look at `ahead` (`engine.ts:422-425`). A car dwells 28 s and a bus 40 s, so the car behind a bus finishes first, switches to `leave`, and drives through the bus that is still stopped.
- Those cars never appear in `followPath` or `ApronTraffic`. A city truck and a curb car on the public road (`starterLayout.ts` road column and the row 4 / row 14 bypasses) can occupy one cell. Neither sim knows the other exists.

### The rule to build

One body list. Apron trucks, pushback tugs, aircraft, landside cars on shared roads, and crew footprints are all on it. A building footprint (farm, hall, shed, guard) is a static body. The draw position is the body position. `withDock` may slide onto a slot only when that slot was reserved for this vehicle.

Priority, highest first:

1. Aircraft, including one parked, pushing, or taxiing. Every vehicle yields. A vehicle already inside the clearance box finishes leaving; it does not cross the nose.
2. Pushback tug while it is attached or pushing. Other vehicles yield and stay out of the shove path.
3. A vehicle already on the main apron road, over a vehicle entering from a stand, a farm, or a depot spur. At a merge or a crossing, the vehicle that is not yet on the road stops at a yield line.
4. Same road, same direction: follow. Brake so the gap behind the vehicle ahead stays at least the sum of the two half-lengths plus the gap (the 1.2 m in `DEFAULT_TRAFFIC` is the right kind of number; 8 m centres are not, once a bus is in the queue).
5. Stand and bay slots. Reserving a slot is what `reserveSlot` and `standAnchors` are each half of. One table: fuel, catering, hold, gpu, lav, water, pushback, bus. A second vehicle for that socket waits on the spur. The hold is not a shared point for the tug and the belt loader.
6. Deadlock. If the highest waiter has been stopped longer than `deadlockMinutes`, the lowest-priority vehicle in the knot reverses to the previous yield line, or its dispatch is delayed. It does not hop 60 m through the queue, and it does not teleport into the destination. `stats.unjams` should count a reverse or a re-dispatch, and a test should fail if any body clearance goes negative, including against the aircraft and the farm.

`GroundControl` stays the runway and taxi lock for aircraft. It should treat a truck body on a taxi cell as a blocker the same way it treats another aircraft, and a truck should see an aircraft reservation as a body it cannot enter.

Service clocks still overlap in time. That is the rule in §7. Two services overlapping means two actors working at once, in two reserved slots, with a gap between the trucks.

## 7. The state machine to build

One actor per service. Each actor is `dispatch → approach → dock → work → clear → done`, on its own clock. Pushback is the only join.

Real gates:

1. Chocks in, and GPU connected or fixed power live, before any hose, belt, or cabin door opens. This gate does not exist today. Add it.
2. Catering may dock once deplane has started, at the service door. It does not wait for an empty cabin and it does not block boarding.
3. Cleaning starts when deplane is done. Boarding starts when deplane and cleaning are done. Fuel and catering do not appear in that predicate.
4. Fuel starts when the bowser or the hydrant is docked and refuelling is allowed. Allowed means the cabin is empty, or `fuelWithPaxOnBoard` is on and a door attendant is actually posted. The flag alone is not a live check today.
5. Bag unload and cargo unload start at block-in. Each load starts when its own hold is empty. Lav and water start at block-in from the panels.
6. Door close starts when boarding is done, bags are loaded, lav and water are clear of the panels, and every fuel hose is disconnected. The truck may still be driving away. The hose may not be connected.
7. Pushback starts when the doors are closed and the clearance box around the nose gear is empty. No timer may skip a gate. A missing truck holds the aircraft and raises the advice the depot hint already has. It does not mark the service done.

Delete from the player machine: the servicing timeout that zeros `waitingOn`, the board-limit short push, and the fixed 2.8 s shove as a substitute for the tug. The phase the HUD shows should be derived from these actors (`deboard` while deplane is active, `board` while boarding is active, `pushback` while the tug is in `work`).

`turnaround.test.ts` will have to change with the predicates. The README line about catering waiting for an empty cabin should be rewritten to the rule above so the next agent does not "fix" the code back.

## 8. What to keep

- Dock phases and `poseFor` (`serviceFlow.ts`). Approach, align, service, depart are the right shape. Stop mapping all of them onto a single `servicing` pose that deploys the hose at the farm.
- `CREW_SHARES`. Pictures fill the service window. They do not add minutes.
- Metre-scale vehicle models and `DEPOT_GRANT`. The fleet list is the right set of actors, including lav, water, and the bus. Stairs stay a prop until a vehicle exists.
- The fuel-with-passengers flag, once door-close stops ignoring fuel and the attendant check is real.
- The empty-farm hold in `rampCall`. That one is a player-choice bottleneck.
- Service clocks overlapping in time. The comment at `engine.ts:1063-1064` already says Boeing and Airbus charts overlap. The predicates underneath it do not. Vehicle bodies do not overlap. That is §6, and it is a different rule from two services running at once.

Throw out of the picture:

- `ensureFuel` / `ensureBelt` stand-in rigs.
- The far shell of three boxes inside the default orbit. A tanker at dist 88 has to still read as a tanker.
- Belt-cube wrap across disconnected runs.
- The cab that does not move with `applyBridge`.
- `LiveTurnaround`'s `unitsPerMeter: 1` people, and the legacy capsules on a stand that already has crew.
- Both timeout skips (`min(36, 22 * pace)` and `boardLimit + 80`).

## 9. Work packages

Six agent runs. Each one is one module and should leave `npm run gate` green before the next. The player clock and the logistics clock are package 4. Right of way is package 5, and it has to apply to the legacy trucks as well as `ApronTraffic`, because the starter apron is where the overlaps were watched. Doing the pictures first (1–3) does not depend on it, and the ghosts are visible on a new game today.

| Run | What it touches | Done when |
|---|---|---|
| 1 | Fuel station and vehicle LOD. Path the bowser to a socket beside the farm, not the fuel cell (`path.ts` truck walk, `retargetFuelTruck`, `placeServicePose`). Stop `shownPhase` deploying the hose on a farm load. Fix `vehicleIsFar` so the default `dist = 88` keeps the tanker mesh. Delete `ensureFuel` / `ensureBelt` | At dist 88 the bowser at the farm is still a tanker, outside the tanks, and no second tanker sits at the stand |
| 2 | Belt cubes and crew dots. Build one polyline per connected belt run. No wrap across the gap. Sit the cubes on the belt. Dots only for crew inside `CREW_LOD`, never as a substitute for a bag | The eight amber cubes stay on the two starter runs. None cross the apron between `(13,8)` and `(13,10)` |
| 3 | Jet bridge seal. Move or hide the cab with `applyBridge`. Keep the bridge inside the same fade as the fuselage, or keep the fuselage opaque while a bridge intersects it. Hold `extend` at 1 for the whole board span, not only the extend span | On a bought bridge, the cab is not inside the skin at extend 0 or during board, and the tunnel meets the door |
| 4 | One service actor. Replace the false gates in `advancePhases` and the timeouts in the flight machine with the seven gates in §7. One clock. `turnaround.test.ts` and the README updated to that order | A bowser that docks during deplane starts pumping when the safety rule passes. Boarding does not wait for it. Nothing is marked done by a timer. Pushback waits for doors, bags, and a clear box |
| 5 | Right of way, after 1 and 4. One body list for legacy trucks, logistics vehicles, aircraft, crew, buildings, and landside cars on shared roads. Priority in §6: aircraft, then the pushback tug, then whoever is already on the apron road. Yield at merges. Follow and brake to a real gap. One slot table per stand socket, and the hold is not shared by the tug and the belt. Deadlock reverses or re-dispatches the lowest-priority vehicle. Delete the 60 m hop and the on-node slot fallback. `followPath` and the landside `leave` state both consult the list | A headless starter turn reports no city-truck pair under half a cell, the bowser never enters the farm mesh, a bags truck is off the stand before pushback, and a car does not drive through a stopped bus. `ApronTraffic` overlaps stay empty with the aircraft and the farm included |
| 6 | Crew and docking polish, after 4 and 5. One people renderer at `WORLD_PER_METER`. Blend poses, smooth the walk, face along the segment. Drive the existing dock phases (approach, align, service, depart) into the reserved slot instead of a linear share that snaps at the next step | At 1× and at 5× a helper walks onto the stand without popping to a dot or a second body, and a truck arrives on a curve into its own socket without crossing another body |

Runs 1 and 2 are the two bugs Trever can see on a new game without a depot: the bowser at the farm, and the orange cubes between the stands. Run 3 is the bridge, which needs a fitting before it shows. Run 4 is the sequencing rule. Run 5 is the collision rule, including the city trucks and the curb. Run 6 is the motion, and it should not start until the slots exist or it will animate the wrong waits.
