# Terminal interior audit — 15 Oct 2026

Read-only look at `main` (`e06b38be`) after the owner's playtest. No game code changed.

The hall the player walks through is two buildings drawn in one camera. The walk, the queues and the starter kit live on an 8×5 zone grid in real metres (48×32). The picture is a 3×3 apron terminal, authored in world units (0.45 per metre), squeezed into that box, then dressed with every prop in the catalog. People, desks, security and the jet bridge each come from a different one of those layers, which is why they disagree about size, facing and which room they belong to.

Recommendation up front: gut the interior picture and rebuild it from one layout. Keep the queues, the editor, the passenger AI and the detailed check-in desks. A repair that tries to align the two layouts will keep reintroducing the same bugs, because a test currently requires the dressing pass to place every prop type.

## 1. People and props: every renderer, and why the sizes disagree

There is no single scale the hall obeys.

`WORLD_PER_METER = 0.45` is documented as the one apron scale for buildings, people, vehicles and pavement (`src/render/aircraft/specs.ts:12-13`). Aircraft add `AIRCRAFT_VISUAL_SCALE = 1.2` on top (`specs.ts:20`). The hall camera does not use that scale. The hall is 48×32 real metres (`src/game/terminal.ts:51-52`). PaxNav comments say coordinates are terminal metres and feet sit at y = 0 (`src/paxnav/paxnav.ts:13-14`). The embedded terminal is still in apron world units, and the fit that parents it does not convert those units back to metres.

### The fit that makes the interior a scale model

`hallFitFor` divides the 48×32 m box by the apron cluster's size in world units (`src/render/hallRooms.ts:47-59`). A starter terminal is a 3×3 of 22 m cells (`starterLayout.ts:119-120`, `specs.ts:31`). That is 66 m real, which is `3 * 22 * 0.45 = 29.7` world units. The fit is limited by the 32 m depth:

```
scale = min((48 - 2.2) / 29.7, (32 - 2.2) / 29.7) ≈ 1.003
```

`HallWorld.syncInterior` then sets `interiorGroup.scale` to that number (`src/render/hallWorld.ts:1244`). One world unit stays about one hall metre. A real metre inside the terminal is 0.45 hall metres. Nav people are not on that group, so they stay at real metres. That ratio, about 2.2×, is the giant next to the tiny person.

### People

| Renderer | Where | Authored height | Scale applied | Standing height in the hall camera |
|---|---|---|---|---|
| Baked terminal people | `TerminalBuilding.buildLife`, parented under `interiorGroup` | `peopleGeo()` is a ~0.9 m figure (`src/render/world/kit.ts:170-195`, head sphere at y = 0.77) | `PERSON_SCALE = WORLD_PER_METER * (1.75 / 0.9) = 0.875` (`src/render/world/terminal.ts:92-93`). Seated Y is `SEATED_SCALE = 0.62` (`terminal.ts:96`). Then `fit.scale ≈ 1.003` | `0.9 * 0.875 * 1.003 ≈ 0.79 m` |
| `HallNavCrowd` | Live departures, arrivals, crew. Metres, not parented to the fit (`src/render/hallNavCrowd.ts:5-6`) | Capsule body; head sphere radius 0.12 (`hallNavCrowd.ts:95`) placed at `1.58 * h` and scaled by `h` (`hallNavCrowd.ts:342`) | `heightOf = 0.94 + (hash % 6) * 0.02` (`hallNavCrowd.ts:513`). No `WORLD_PER_METER` | Top of head `1.70 * h` ≈ **1.60–1.77 m** |
| Near walkers inside `HallNavCrowd` | Nearest `nearCap` swap to `PeopleRenderer` (`hallNavCrowd.ts:281-299`) | Adult body 1.75 m (`src/people/parts.ts:7-8`) | Constructor passes no `unitsPerMeter`, so it defaults to **1** (`src/people/renderer.ts:71`, `hallNavCrowd.ts:166`) | ~1.75 m, same family as the capsules |
| `HallFigureBatch` / `buildFigure` | Guests the walk does not draw (`hallWorld.ts:1416-1424`) | Skeleton: hips 0.86, head pivot 1.58 (`hallWorld.ts:1325-1364`), `bodyH` 0.90–1.04 (`hallWorld.ts:1371`) | `hallGuestScale = (1.75 * WORLD_PER_METER * fit.scale) / HALL_FIGURE_M` with `HALL_FIGURE_M = 1.78` (`hallRooms.ts:126-131`, `hallCamera.ts:11`) ≈ **0.444** | Head pivot ≈ 0.63–0.73 m. Same toy scale as the baked terminal people |
| `HallServiceFx` staff | Desk and lane officers via `PeopleRenderer` | 1.75 m body | `new PeopleRenderer(...)` with no `unitsPerMeter`, so the default is 1 (`src/render/hallService.ts:211`, `src/people/renderer.ts:71`) | ~1.75 m |
| Officers baked into prop meshes | `person()` inside `security_lane` and the x-ray (`src/render/terminalProps/props.ts:79-104`) | Hip 0.92, hair at `hip + 0.92` ≈ 1.84 m | Prop placement scale (dressing caps at 0.48) times `WORLD_PER_METER` 0.45 times `fit.scale` | ≈ **0.40 m** |
| Apron `createCrowd` | Airport camera, not the hall | 1.75 m | `unitsPerMeter: WORLD_PER_METER` (`src/render/world/render.ts:838`) | Correct on the apron (~0.79 world units = 1.75 m). Irrelevant once the hall camera is open, except that it is a third copy of the same body |
| Apron `HallCrowd` | Low-quality apron guests | 0.9 m kit figure | `PERSON_SCALE` (`src/render/world/hallCrowd.ts`) | Matches apron `createCrowd`. Not the hall |
| Legacy apron capsules | `src/render/world.ts` grid people | 1.75 m via `WORLD_PER_METER` | Apron only | Not the hall |
| `CrewFigures` | Ramp crew | 1.75 m | `unitsPerMeter: WORLD_PER_METER` (`src/render/crew/figures.ts`) | Apron only |

`HALL_PAX_SCALE = 1` (`hallCamera.ts:8`) is the figure the hall camera was designed around. Only `HallNavCrowd` and hall `PeopleRenderer` actually use it. `hallGuestScale` then shrinks the older doorway figures so they match the embedded terminal, which is the opposite of matching the nav crowd.

Kids on the apron rich crowd use `BODY.kidScale = 0.62` (`src/people/config.ts`). That spread is real variation. It is not what puts a child-sized person next to an adult in the hall. Those two adults are the 0.79 m baked figure and the 1.7 m nav walker.

### Props

| Renderer | Space | What multiplies size |
|---|---|---|
| Low-poly plan props (`kit.ts` parts, instanced in `terminal.ts`) | Apron world units, then `fit.scale` | Matrix scale is `WORLD_PER_METER` on X/Y/Z (`terminal.ts:880`). A metre of counter becomes ~0.45 hall metres |
| `buildHiDetailProps` | Same group | Authored in metres (`terminalHiDetail.ts:67-68`), per-prop `fitScale` with slack 1.35, floored at 0.35 (`terminalHiDetail.ts:61-90`), then the group is `scale.setScalar(worldPerMeter)` (`terminalHiDetail.ts:93`) |
| `buildInteriorDressing` | Same group | Same metre models, then an extra cap `Math.min(0.48, fitScale(...))` (`terminalHiDetail.ts:256`). A 14 m security lane lands near a quarter of real size |
| `hallKitMeshes` | Hall metres, direct | Header says real metres. A fast-food counter is 2.6×0.95×1 (`hallKitMeshes.ts:45-52`). **Hidden** whenever the room plan is on (`hallRooms.ts:113-116`, `hallWorld.ts:1147-1150`) |
| `buildHallDetail` | Hall metres, only on that hidden path | `fitScale` into the cell, except `checkin_pair` which forces `max(fit, 0.9)` (`hallKitDetail.ts:39-71`). No `WORLD_PER_METER`. This is the path that would have shown the r5 desks at real size |
| `HallServiceFx` belts, scales, trays | Hall metres | Geometries such as the bag scale `0.62×0.06×0.5` (`hallService.ts`) |

`BAY = CELL / 6.2` (`terminal.ts:90-91`) is a fourth number. It only stretches where plan props are dropped inside a cell. It does not change their mesh scale. `fitScale` (`src/render/terminalProps/index.ts:108-111`) shrinks a prop until it fits a slot and never scales up.

So a nav adult (~1.7 m) stands next to a baked terminal adult (~0.79 m), a prop-baked officer (~0.40 m), a dressing desk at ≤0.48×0.45 of its authored size, and (if the legacy layer were visible) a 2.6 m hall counter. The r5 check-in bank (`checkin_pair`, `props.ts:1181-1182`) is the one model that asks to stay near real size, and the hall hides the only renderer that honours that.

## 2. Leftover decorations that should go

These are drawn on top of the starter kit. The starter kit itself is `schemeItems(1)` (`terminal.ts:822-871`). The picture ignores that list whenever the 3×3 room plan is up, and draws the procedural plan plus a catalog dump instead.

The dump is intentional. `buildInteriorDressing` places every `TERMINAL_PROP_TYPES` entry that the explicit block did not (`terminalHiDetail.ts:228-258`), and `terminalHiDetail.test.ts:52-53` asserts that every type is present. Deleting leftovers means changing that test.

| What the player sees | Source | Why it is stale |
|---|---|---|
| Ceiling lights in every cell | `plan.ts:149-150` | Not a catalog item. Procedural fill |
| Check-in counters, monitors, stanchions, a belt, a kiosk, a WC, bins, bags, a board, and static staff and passengers | `plan.ts:152-185` | A second check-in, beside the kit's `checkin_belt` / `kiosk` / `queue_rail`. Static people are baked even though hall walkers are forced off (`hallWorld.ts:1236-1238`, `terminal.ts:1058-1072`) |
| Security x-ray, arch, planters, staff and queued passengers | `plan.ts:186-198` | Duplicates the dressing security lane, which already contains an x-ray, an arch and a body scanner (`props.ts:300-309`) |
| Shop kiosk, awning, tables, stools, seated people, planters, a WC, a bin, a bag | `plan.ts:199-217` | The kiosk is swapped for a menu counter at high detail (`terminalHiDetail.ts:21-24, 80-81`). The dressing then drops a whole food court and every shop into the same room |
| Back-office counters and an x-ray "test rig" | `plan.ts:218-234` | Security equipment in the lab, which passengers cannot enter |
| Gate benches, a podium, a board, a planter, a bin, a bag, seated people | `plan.ts:235-252` | Second set of seats beside `seat_row` / `gate_seating` |
| Decorative walker routes, including check-in straight to the gate | `plan.ts:259-275` | `walkersPerCell: 0` in the hall, but the route list still encodes a path that skips security |
| Arrivals sign and baggage carousel inside check-in | `terminalHiDetail.ts:140-156` | Comment says render-only. Claim does not belong in departures check-in |
| Lounge cluster in the airside strip | `terminalHiDetail.ts:158-164` | Extra, on top of the prefab lounge cells (`PREFAB_I_OPEN`, `terminal.ts:897-899`) |
| Staff-office cubicles | `terminalHiDetail.ts:165-171` | On top of the plan back office |
| `shop_gadget` and `food_court`, then every remaining shop type including `shop_fastfood` | `terminalHiDetail.ts:172-194` and the pending loop `228-258` | One shops cell receives the whole catalog. Runway Burger is `shop_fastfood` (`props.ts:337-342`, sign `RUNWAY BURGER` at `materials.ts`) |
| `jet_bridge` assigned to the airside room | `terminalHiDetail.ts:226, 249-257` | A bridge is not interior furniture. See §3 |
| `checkin_desk` at scale ≤ 0.48 | `terminalHiDetail.ts:197, 256` | The small extra desk. See §3 |
| Types missing from `preferred`, dropped into the biggest check-in room: `checkin_pair`, `xray_machine`, `body_scanner`, `seat_row`, `planter`, `bin`, `stanchion`, `departures_wall`, `menu_counter`, `restroom_stall` | `preferred` is `terminalHiDetail.ts:195-227`; fallback is `preferred[type] ?? 'checkin'` at line 233 | Security scanners land in check-in because they are not in the map |
| Second jet bridge on the facade | `hallWorld.ts:977-1012` | Right idea (outside), duplicated by the dressing bridge |
| Concourse columns at hardcoded metres | `hallWorld.ts:1051-1056` | Legacy filler. Only on the nav-shell path; the room-plan path skips `buildShell` (`hallWorld.ts:1143-1145`) |
| `BEFORE SECURITY` / `AFTER SECURITY` floor labels | `hallWorld.ts:355-364`, hidden at `1017-1020` | Left in the scene, visibility off |
| Zone-tinted floor, kit meshes, invisible pick boxes | `hallWorld.ts:1153-1205` | Built only when the room plan is off. Dead in a normal starter hall, which is why placed kit vanishes (§5) |
| `terminalProps/demo.ts` showroom | `demo.ts:39-72` | Not the game. Same prop types the dressing pass copies in |

`schemeItems` placements (entrance, kiosk, belt, queue rail, two security lanes, secure exit, boarding desk, seats, newsagent, carousel, bag system, bench, two toilets, cafe) are the sim's starter. They should stay as data. They should not be redrawn by `planTerminal`.

## 3. How the starter interior is defined, and the four layout bugs

The starter is data plus two procedural pictures that do not read that data.

Call order for a passenger or hybrid new game:

1. `buildStarterKit` (`sim.ts:5973`) spends the kit cost and calls `stampStarterKit` (`starterLayout.ts:184`).
2. `stampStarterKit` paints apron tiles only: a 3×3 terminal at columns 14–16, rows 8–10, apron to the west (`starterLayout.ts:111-120`). It does not place a desk or a lane.
3. `emptyFit(..., premade: true, { security: 2, ... })` (`sim.ts:6032-6043`) then `decorateFit` (`sim.ts:1059-1065`) fills `zones` from `SCHEME_I` and `items` from `schemeItems(1)`.
4. The walk is `prefabNavLayout` over that 8×5 grid (`hallNav.ts:140`).
5. The hall camera ignores the 8×5. `syncInterior` builds `planTerminal` for the 3×3 apron cluster (`hallWorld.ts:1218-1249`). Rooms come from `zoneFor` plus a flood fill (`plan.ts:79-85`, `rooms.ts:168-225`).

`SCHEME_I` (`terminal.ts:718-724`), 8 columns by 5 rows, C check-in, S security, G gates, A arrivals, R retail, T toilets:

```
CCCCCCAA
CCCCTTAA
SSSSSSAA
GGRTGGGG
GGGRGGGG
```

`zoneFor` on the 3×3 is a different building (`plan.ts:79-85`). Depth 0 is check-in, depth 2 is gates, and the middle row is security only on the centre cell. The other two middle cells are shops, and the higher one is then rewritten to back office (`plan.ts:129-133`). Gate cells are split again: the landside third of each becomes airside (`rooms.ts:162-165`). So the furnished interior is check-in | shops / security / office+lab | airside strip + three gates. The walk still thinks it is the 8×5 letter grid.

### Security spans two places, and passengers skip the furnished one

Two separate splits.

**Sim lanes.** Prefab I has `servers: 2` (`openingData.ts:18`). `securityLaneSpots` puts the tier lane on the first security cell and the extra lane on the last lane cell, leaving the middle empty on purpose (`terminal.ts:790-818`, `PREFAB_I_OPEN` at `894-896`). The last security cell is the secure exit, not a lane (`terminal.ts:847-848`).

Those cells are not the centre of the hall. The nav grid is 12×8 tiles of 4 m (`BUILD_TUNING.tileMetres`, `hallNav.ts:137-145`), origin at the hall centre (`hallNav.ts:864-880`). The first security cell (column 0, row 2) sits near x = −22. The fitted 3×3 is about 30 m wide and centred, so it only reaches about x = −15. That lane is in the empty floor band beside the rooms. The second lane (column 4) sits near x = 2, z = 0, which is the visual security cell. The entrance kit is check-in cell 0 (`terminal.ts:840`), the same end of the hall as the outer lane. PaxNav picks the nearest staffed lane, so departures queue in the empty band and never enter the room that has the x-ray in it.

The wall rule makes this worse to look at. Security is walled off from check-in except on a lane tile, and the comment says the two sides of security never share an open edge (`hallNav.ts:274-290`). The airside edge of security is not walled: `parts` only returns a wall when the other side is landside. The gate side of the security row is open floor.

**Visual rooms.** Passengers also skip a second furnished security. `plan.ts:232` drops an x-ray in the lab half of the back-office cell. Lab and office are staff-only (`rooms.ts:32-35`, door rule `checkin|office` is `staff` at `rooms.ts:133`). Public routes never enter it. The dressing pass then fills the real security cell with `security_lane`, `security_lane_ct`, `walkthrough_arch` and `divest_station`, and because `xray_machine` and `body_scanner` are absent from `preferred` they are dumped into check-in (`terminalHiDetail.ts:233`).

### The small backwards check-in desk

The desks that face the queue are the plan counters: yaw `yawAir + Math.PI`, with the comment "Staffed desk faces the landside queue" (`plan.ts:165-168`). Starter airside is west (`starterLayout.ts:111`), so those face back toward the road.

The small one is a different prop. The dressing pass adds `checkin_desk` (`checkinDeskSingle`, a single 1.6 m desk) into whichever room got the check-in batch, at yaw `alongX ? π/2 : 0` and scale `min(0.48, fitScale)` (`terminalHiDetail.ts:249-257`). That yaw follows the room's long axis, not `yawAir`. On top of the 0.45 world scale the desk is about a fifth of real size, and it faces 0° or 90° rather than the landside queue. Counters themselves stay on the low-poly path on purpose (`terminalHiDetail.ts:18-19`), so the r5 `checkin_pair` never replaces them in this view. `checkin_pair` only appears if the dressing fallback drops one into check-in, at the same ≤0.48 cap.

### The jet bridge inside the hall

`preferred` sends `jet_bridge` to room kind `airside` (`terminalHiDetail.ts:226`). That kind is not the apron. It is the landside third of each gate cell (`rooms.ts:163`). For a 3-wide gate row that strip is longer in X than in Z, so `alongX` is true and the "outside" nudge is 0 (`terminalHiDetail.ts:255`):

```
const outside = type === 'jet_bridge' ? (alongX ? 0 : Math.sign(side || 1) * across * worldPerMeter * 0.65) : 0
```

The bridge is placed on the interior strip. `dockAirsideBridge` (`hallWorld.ts:1004-1012`) also builds one on the facade gate door, 2.2 m outside the opening (`hallWorld.ts:988-989`). One bridge belongs there. The dressing one does not.

### Security props in the Runway Burger shop

Runway Burger is the `shop_fastfood` shell. The wordmark is `sgnBurger` / `RUNWAY BURGER` (`props.ts:342`, `materials.ts`). Nothing in `schemeItems` places a fast-food shop. The cafe on the retail cell maps to `shop_coffee` (`hallKitDetail.ts:27`), and that mesh is hidden with the rest of the kit. The burger exists only because the dressing pass assigns `shop_fastfood` to the shops room (`terminalHiDetail.ts:213`) and then packs every other shop type into that same room (`terminalHiDetail.ts:240-258`).

The security lane is assigned to the security room, not the shop. The two rooms are neighbours: on the starter 3×3 the middle column is shops, security, back office (`plan.ts:79-85`). The shops room also already has the plan kiosk, which high detail turns into a menu counter (`terminalHiDetail.ts:80-81`). The security room receives a 14.2×6.2 m `security_lane` (`props.ts:301`) which itself contains the x-ray, the arch, the body scanner, trays and four officers (`props.ts:300-329`), plus the plan's own x-ray and arch. Placements are not clipped to the room polygon. The shop shell is open at the front (`shopShell`, `props.ts:344-371`). With both rooms one cell wide and the cutaway dropping near walls, the scanner reads as part of the burger. The scanners that miss the `preferred` map (`xray_machine`, `body_scanner`) do not go to the shop either: they fall through to check-in (`terminalHiDetail.ts:233`).

## 4. Does pathing follow the flow?

The flow the owner described is written as the PaxNav header (`paxnav.ts:1-4`): curb, check-in / bag drop, security, toilet / food / shop as needed, gate seating, boarding desk, jet bridge. Two engines run it, and they do not agree.

- **PaxNav** (`paxnav.ts`, driven by `HallNav.admit` / `tick` at `sim.ts:10693-10699`) is what the hall draws for departures when `hallNav.live` (`hallNav.ts:643-647`: a curb spawn and at least one gate room).
- **The hall graph** (`tickHall`, `guests.ts`, doorway polylines in `hallRoute.ts`) still ticks the same `HallGuest` for fares, bag timing and boarding. Departures are not drawn from it while the walk is live (`hallWorld.ts:1422-1424`).

| Stage | PaxNav (what you see) | Hall graph (what the sim still ticks) |
|---|---|---|
| Door | Spawn on the curb door (`paxnav.ts:538-547`) | `openDepartingGuest` sets node `entrance` and routes to check-in (`sim.ts:9702-9705`) |
| Check-in | Stop included only when `bags` is true (`paxnav.ts:551-562`). `bags` defaults to a roll against `checkinShare` | Everyone is routed to check-in if the room is open. Carry-on does not skip it |
| Bag drop if they have bags | Not its own stop. `bagdrop` items are mapped to `checkin_desk` (`hallNavData.ts` `PREFAB_ROOM_KIT`) and the graph's `openNodesFromRooms` turns `bagdrop > 0` into the check-in node only (`guests.ts:691`) | Deposit dwell happens at the check-in node (`serveNode`), not at a bag-drop node. Closed check-in sets `bagsDropped` and sends them on |
| Security | Mandatory. The skip loop refuses to drop `security` or `gate` (`paxnav.ts:826-829`). Service flips the layer to airside (`paxnav.ts:1418-1419`) | Mandatory for uncleared departures (`hallRoute.ts:43-46`). Preview guests are created with `clearedSec: true` (`sim.ts:10621`) so the graph does not queue them (`sim.ts:10640-10643`). The drawn walk still queues them, because admit does not pass that flag into PaxNav |
| Airside shops, food, toilets, seats | Toilet, food and shop are `NEED_STOPS` (`config.ts:81`), inserted when there is time before boarding (`paxnav.ts:794-807`). Seats are phase `seat` / `seated` (`paxnav.ts:802-807`) | `bathroom`, `food` and `shop` exist. There is no seat stage. Needs under 35 are ignored. The day-one path is hard-coded `entrance → checkin → security → shop → gate` (`sim.ts:10551`) and has no toilet |
| Gate desk queue | Final stop `gate` uses `gate_desk` (`config.ts:66-72`). After service, phase becomes `board` (`paxnav.ts:1420-1422`) | No queue. At the gate node, boarding sets `dead` as soon as the flight calls, or earlier if hunger and bladder are both under 40 (`sim.ts:15756-15764`). The same instant board also happens in `tickHall` (`sim.ts:10761-10763`) |
| Boarding method | `stepBoard` follows the apron field of the gate (`paxnav.ts:1520-1523`). The comment says that with no jet-bridge door they board from the desk. No stairs geometry and no bus ride | `standPaxMode` returns `jetway`, `bus` or `walk` (`sim.ts:6399-6408`) and only changes a thought string and a timing number. The passenger is removed at the gate node |
| Arrivals: claim, then exit | `HallArrivals.spawn` steps them off at the jet-bridge door (`hallArrivals.ts:302-315`). Stops are optional toilet/shop, then claim if they have bags, then exit, then curb (`hallArrivals.ts:335`). Claim is skipped when that layout is missing | Start at the gate, already cleared, route to claim, then exit when bags are done. Transfers do not use the arrival walk (`hallNav.ts:736-737`) |

Stages that are missing or skipped against the owner's list:

- **Bag drop as its own stage.** Folded into check-in on both engines. A passenger with only a carry-on skips check-in on PaxNav (good) and still dwells at check-in on the graph (not what is drawn).
- **Toilets.** Present as an optional need on PaxNav and as a `bathroom` node on the graph. Easy to skip when boarding is close (`paxnav.ts:794-796`). The day-one loop never visits one.
- **Gate desk queue.** Real on PaxNav, absent on the graph. The graph is what marks the passenger boarded.
- **Boarding method.** Jet bridge or "board from the desk" only. Bus and walk are labels on the stand, not a path. Arrivals always appear at the jet-bridge door (`hallArrivals.ts`), never off a bus.

### Passengers at game start

`buildStarterKit` calls `seedDayOneCrowd` (`sim.ts:6060`, body at `10547`). Twelve preview guests are pushed onto `hallGuests` before any flight releases. Cargo kits return earlier and get none (`sim.ts:6007-6029`). They are marked `preview: true` and `clearedSec: true`, and they loop curb to gate (`tickPreviewGuest`, `sim.ts:10644`). `HallNav.admit` still spawns them onto the live walk (`hallNav.ts:747-752`), which is the crowd on screen. They retire once eight real released passengers exist (`sim.ts:10632-10637`).

## 5. Why placed fittings do not spawn or work

`commitHallItem` writes the piece into `fit.items` and bumps `hallRev` (`sim.ts:15331-15370`). The walk rebuilds from `hallNavLayout` each tick (`sim.ts:10674-10699`). The mesh does not.

`rebuildRooms` returns as soon as the 3×3 room plan exists (`hallWorld.ts:1147-1150`):

```
if (hasRooms) {
  this.clearKit()
  this.applyRoomLayer()
  return
}
```

`showLegacyHallFurniture` is `!hasRoomPlan` (`hallRooms.ts:113-116`), so `kitGroup` is hidden. The kit meshes, the hi-detail catalog models and the invisible `item:` pick boxes (`hallWorld.ts:1185-1205`) are never created in a normal hall. The piece is in the save and not in the room.

Even on the legacy path, several defs do not become equipment:

- `prefabNavLayout` turns security items into a server count and places `lane-0`, `lane-1`, … on `laneSpots`. It then `continue`s any per-item kind that mapped to `security_lane` (`hallNav.ts:182-211`). A placed lane does not spawn at the cell the player clicked.
- `PREFAB_ROOM_KIT` has no `bagclaim` (`hallNavData.ts:150-158`). A carousel does not become a claim belt on the walk. `secure_exit`, `queue_rail`, plants, art, the fountain and wayfinding have no `room`, so the same loop skips them. They can still affect comfort or signage. They do not serve anyone.
- `includedSecurityLanes` counts only `bundle` items (`hallNav.ts:458-466`). A player-placed lane is `included: false` until a spare officer is assigned (`servicepoints/points.ts:37-44`). It draws (on the legacy path) and does not open.
- `hallBaseLayout` returns `fit.build` immediately when the scratch build exists (`hallNav.ts:355-357`) and never merges `fit.items`.
- Footprint placement (`placeHallFootprint`) only runs for defs in `FOOTPRINTS` (`src/terminalplay/footprints.ts:22-37`: belts, security lanes, shops, toilets, seats). Anything else uses the zone cell, which the 3×3 view is not showing.

The editor and the sim agree that the item exists. The renderer that is actually on screen is `planTerminal` plus the dressing pass, which does not read `fit.items`.

## 6. Inspector

Two selections share `BuildingPanel`. The apron card is the flight card (`src/ui/inspector/FlightCard.tsx`), with its own subscription. The hall card is `game.buildingCard()` (`sim.ts:8810-8814`), rendered because `PlayChrome` subscribed to `chromeSnapshot` (`App.tsx:273-285, 315-316`).

### Why it is not live

`chromeSnapshot` is `hudSnapshot()` plus the HUD tree version (`App.tsx:283-285`). React re-renders only when that string changes. `hudSnapshot` (`App.tsx:125-208`) includes `selectedFacility`, `hallNav.passengers`, `hallRev` and `securityQueueCount()`. It does not include `hallNav.metrics()`: per-lane queue length, who is being served, or service time.

When the walk is live, `queueReading` builds the bays from those metrics (`sim.ts:20696-20749`). A lane going from empty to serving does not change the snapshot unless the passenger count or the aggregate security queue count also changes. The slow catch-up (`HUD_CADENCE.treeMs = 2000`, `src/ui/liveHud.ts:12-14`) is what eventually bumps the tree version. The flight card does not work this way. The hall panel has no `useSyncExternalStore` of its own (`BuildingPanel.tsx:183-187` only resets open sections when the card id changes).

### Which assets have no detail panel

Clicks on the furnished interior do not select it. The hall pointer treats `facilityId` only on queue sprites and `roomGroup` (`hallWorld.ts:649-666`). Interior meshes are under `interiorGroup`. The only interior hit that is special-cased is a FIDS board (`hallWorld.ts:644-647`). A security lane, an x-ray, a body scanner, a desk and the burger have no `userData.facilityId`. The click falls through to guest picking and often selects nothing.

`facilityReading` (`sim.ts:20662-20693`) is what the panel actually renders. `facilityInfo` (`sim.ts:8823-8847`) builds blurb, wear, upkeep and service lines, and `buildingCard` never reads it.

| Click | Panel |
|---|---|
| Queue badge `checkin` or `security` | `queueReading`. Real bays when metrics exist, otherwise one idle bay plus a paused-walk note (`sim.ts:20700-20721`) |
| `item:` whose def room is check-in, bag drop or security | Same aggregate queue, titled with the def name (`sim.ts:20669-20671`). Those pick boxes exist only on the hidden kit path |
| Any other `item:` (gate desk, toilet, food, seats, carousel, secure exit, queue rail, plant, fountain, wayfinding) | Stub: `demand: 0`, one idle bay, no queue (`sim.ts:20673-20683`) |
| A bare id that `facilityInfo` knows | Title only, upkeep 0, demand 0 (`sim.ts:20685-20693`) |
| A bare id with no hall, or an `item:` whose row was not saved | `null`. No card (`sim.ts:8826-8831`, `20667`, `20686`) |
| The 3×3 security props, the dressing desks, the burger, the indoor bridge | No `facilityId`. No card at all |

That is the "security assets show no details" report. The meshes on screen are not facilities. The facility that does have a card is the aggregate security node, and its bay rows do not subscribe to the walk.

## 7. Gut and rebuild, not repair

Repairing this in place means keeping both layouts and teaching them about each other. The bugs above are that teaching failing: the fit scale, the dressing dump (locked in by test), the 8×5 lanes that do not sit in the 3×3 security cell, and the kit renderer that bails out when the room plan exists. Each new desk or lane gets drawn by one system and simulated by the other.

Keep:

- **Queues.** PaxNav service points, marked lines, one server at a time (`paxnav.ts`, `servicepoints/`).
- **The editor.** `commitHallItem`, the kit catalog, footprints, wear and upkeep (`terminalKit.ts`, `terminalKitData.ts`). It should write the same layout the walk and the renderer read.
- **Passenger AI.** Needs, groups, thoughts, lost passengers (`paxnav/guests.ts`). One stop list, not a second graph that skips toilets and boards instantly.
- **The r5 desks.** `checkinDesk` / `checkin_pair` in `src/render/terminalProps/props.ts`, authored in metres, forced toward real size by `REAL_SIZE` today and then hidden. They are the desks worth keeping. The low-poly counters and the 0.48-scale `checkin_desk` are not.

Throw out of the hall camera:

- `planTerminal` as an interior (zones, props, baked people, decorative routes).
- `buildInteriorDressing` and the test that every prop type must appear.
- `hallGuestScale` and the doorway figure batch for anyone the nav crowd already draws.
- Parenting `TerminalBuilding` under `interiorGroup` with `fit.scale`.
- The legacy zone floor, columns and before/after labels once nothing reads them.

### Rebuild shape

**One scale.** Hall metres. People and props authored in metres, `unitsPerMeter = 1`, no `fit.scale` and no `WORLD_PER_METER` inside the hall. `WORLD_PER_METER` stays the apron constant. The hall stops embedding an apron building.

**One renderer.** `HallNavCrowd` plus `PeopleRenderer` for every person, including staff (so the 0.40 m officers inside `security_lane()` come out of the prop mesh). One prop instancer, fed by placements in the layout, using the `terminalProps` models at scale 1 unless a socket says otherwise. `HallServiceFx` belts and trays stay, driven by the same sockets.

**One starter layout, in data.** Replace `SCHEME_I` plus `zoneFor` with a single document the walk, the renderer and the editor share. Rooms in flow order, each with sockets and empty sockets beside them:

1. Curb door.
2. Check-in bank, with empty sockets for more desks (the r5 desk on the sockets that start filled).
3. Bag drop, own sockets, used only by passengers who have a hold bag.
4. One security room. Lanes in a row, empty sockets for more lanes. Not a second room, not a lab x-ray.
5. Airside: shop, food, toilets, seats, each with empty sockets.
6. Gate desk queue, empty sockets for more desks.
7. Boarding socket outside the glass: stairs, bus or bridge, chosen from the stand. The bridge is not a prop inside the room.
8. Arrivals: claim belt, then the exit door. No carousel in check-in.

**One flow-stage graph.** The PaxNav stop list becomes data both engines read: `door → checkin? → bagdrop? → security → (toilet | food | shop | seat)* → gateDesk → boarding(method)`. Arrivals: `offAircraft → claim? → exit`. Optional stages carry the skip rule in the graph (no bags, no need, boarding too close) instead of a second path in `tickHall`. Bus and stairs can be sockets with a duration before they have unique meshes. They should not be a thought string on an instant despawn.

### Size

Six agent runs, plus one if remote-stand boarding needs its own meshes in the same pass. Each run is one module and should leave `npm run gate` green before the next.

| Run | What it touches | Done when |
|---|---|---|
| 1 | Hall camera only. Stop embedding `planTerminal`. Draw nav people and nothing else. Delete `hallGuestScale` for that view | One person height in the hall, about 1.7 m, no baked crowd |
| 2 | Layout document and the starter instance. Sockets, empty sockets, rooms in the order above. Nav reads it instead of `SCHEME_I` / `zoneFor` | Security is one room. Both lanes sit in it. The entrance queue reaches them |
| 3 | Flow graph shared by PaxNav and `tickHall`. Bag drop conditional, toilets as a real stop, gate desk required, boarding method id on the stand | A traced departure hits every stage or a named skip. Arrivals hit claim then the exit |
| 4 | Editor writes sockets on that layout. Renderer instances `terminalProps` at metre scale from the same sockets. r5 desks on the check-in sockets | A placed lane, desk, toilet and bench appears where it was put and serves |
| 5 | Inspector subscribes to `hallNav.metrics()`. Every socket type has a card. Security props carry the lane id | Queue length moves while the panel is open. Clicking a lane shows that lane |
| 6 | Delete the dressing pass, the "every prop type" test, the legacy floor and the indoor bridge. `npm run gate` | The starter hall matches the flow with no catalog leftovers |
| 7 (only if in scope) | Stairs and bus meshes on the boarding socket, remote-stand arrivals walking in from the bus door | Stand access changes the path, not just the thought |

Runs 1–2 remove the size bug and the skipped security room. Runs 3–5 make the flow and the editor true. Run 6 is the gut. Doing 6 first, without 2, leaves an empty box.
