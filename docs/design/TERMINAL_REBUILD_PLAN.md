# Terminal interior rebuild plan

Status: plan, with owner and producer decisions D1–D6 recorded below. WP1 (hall picture gutted, one metre scale) is the first code package and has landed.
Owner decision being executed: Trever, Oct 15, 8:06 PM. Gut the terminal interior and rebuild it with one scale, real flows and two stories.
Playtest items covered: 3, 5, 33, 34, 35, 36, 37, 38 and 46 from the Oct 15 list. Item 39 (pause) is covered too, because a requirement below depends on it.
Based on `main` at `68fde433`, with the audit folded in. PR [#119](https://cursor.com/codebase/hatchtag/hatchfield-game/pull/119) (bag-drop kiosk, claim carousel and passport booth plates) is part of that base. Its props are kept assets at real metres (sections 2 and 4.4). Passport control is for international arrivals only (section 4.3).

Audit: [TERMINAL_AUDIT_OCT15.md](../playtest/TERMINAL_AUDIT_OCT15.md) (agent bc-cf7345e0, PR [#118](https://cursor.com/codebase/hatchtag/hatchfield-game/pull/118)), which lands on `main` together with this plan. It cites every finding to a file and line on `e06b38be`. Section 1 summarises it with the audit section number (§) and adds what this plan's own code read found. The work packages in section 11 follow the audit's run order (section 12 maps them).

Related: [INTERIOR_EDITOR.md](./INTERIOR_EDITOR.md) (floor-ready schema), [TERMINAL_INTERIOR_BUILD.md](./TERMINAL_INTERIOR_BUILD.md) (Prison Architect editor), [STAND_UPGRADES.md](./STAND_UPGRADES.md) (stands and bridges), [../STARTER_KIT_AUDIT.md](../STARTER_KIT_AUDIT.md) (what the starter kit has to contain).

---

## 0. Owner decisions (D1–D3 before WP2 starts, D4 before WP3, D5 before WP4)

| # | Decision | Recommendation | What it changes |
| --- | --- | --- | --- |
| D1 | **Starter story count.** Option S1: a 1-story starter that already separates arrivals from departures, with a 2-story upgrade in mid-game. Option S2: the starter ships 2-story. | **S1, then the S2 upgrade.** | One data file and one config value (`STARTER_TERMINAL`). The code is the same either way: every work package builds two-floor support. |
| D2 | **Starter footprint.** It goes from the 3×3 apron stamp (66×66 m) to 4×2 cells (88×44 m), with the long side facing the apron. | Approve. | Two code-C contact stands need about 40 m each of facade. 66 m fits only one and a half. The starter stamp's stands and roads shift. This touches Batch D's road work. WP2 makes the change. |
| D3 | **Old saves.** The terminal interior is rebuilt on load. Player-bought fittings are refunded at purchase price, with a phone note. | Approve. | Without it, saves from before the rebuild need a fresh start. |
| D4 | **Walkers become the truth.** The passengers you see decide boarding, missed flights and mood. The sim's hidden hall model (`tickHall`, which boards by setting `dead` with no gate-desk queue, audit §4) is retired. | Approve. The audit reaches the same conclusion: one stop list, not a second graph. | This fixes "placed fittings don't work" at the root. Balance moves, so the 30-day and 150-day soaks are the check. |
| D5 | **Gemini assets.** `bag_drop_kiosk`, `baggage_claim_carousel` and `passport_control` are on `main` in `public/art/textures/concepts/` (PR #119, merged at `68fde433`, loaded by `src/render/servicePlates.ts`). They are kept assets (section 2) and need no decision. `terminal_multistory`, `security`, `checkin_desk` and `gate_seats` are still missing. | Commit the missing four to the same folder and add them to `SERVICE_PLATES` before WP4. | WP4 and WP6 screenshot checks compare against these. Until they land, `public/art/refs/pack6/` is the target for those four. |
| D6 | **Apron unit.** The apron stays at `WORLD_PER_METER = 0.45`. The terminal is authored in metres and shown in the airport view under a single root scale node. | Approve. Moving the whole game to 1 unit = 1 m is a separate project. | Inside Terminal view, 1 unit = 1 m. Outside it, there is exactly one scale node, and the scale-audit test enforces that. |

## Decisions recorded (15 Oct)

The producer decided D2 through D6. The owner picked S1 for D1 when WP1 restarted. WP1 does not implement the later packages.

| # | Status | What later packages own |
| --- | --- | --- |
| D1 | Approved: S1. The starter is 1 story and keeps arrivals apart from departures on one level. S2 is the mid-game upgrade. | WP2 writes `split1f` as the starter and `stacked2f` as the upgrade. WP1 draws the existing 1-story hall at real metres and adds no story code. |
| D2 | Approved. Starter footprint is 4×2 cells (88×44 m). | WP2 moves the stamp. WP1 stays on the existing 8×5 walk (48×32 m) and does not move the apron stamp. |
| D3 | Approved. Old saves rebuild their interiors and refund player-bought fittings at purchase price. | WP2, save schema 5→6. Not in WP1. |
| D4 | Approved. Walking passengers are the authority. | WP3 retires `tickHall` boarding. Not in WP1. |
| D5 | Approved. Commit `terminal_multistory`, `security`, `checkin_desk` and `gate_seats` into `public/art/textures/concepts/` and add them to `SERVICE_PLATES` before WP4. | Those four files are not in the tree. Until they land, `public/art/refs/pack6/` is the target. The three plates already on main stay at native 2752×1536 and are not downscaled. |
| D6 | Approved. The apron stays at `WORLD_PER_METER = 0.45`. Terminal view is 1 unit = 1 m. | WP1: no node under `hall-root` has a scale other than 1. The single airport-view `terminal-root` node is the WP4 scale audit (v2). |
| #125 | Superseded by WP1. Its real-size list (`HALL_REAL_SIZE`) is kept, but at scale 1, not its 0.9 floor. | `src/render/scaleAudit.test.ts` pins each listed prop's real footprint. |

Why S1 is recommended over a 2-story starter:

- A terminal capped at 46 passengers is single-storey in real life. Real regional terminals of about 4,000 m² keep arrivals and departures apart on one level, using a sterile claim hall and a one-way exit. S1 does the same, so arrivals still never pass security.
- The first hour is easier to read with no floor switching. The camera, the build bar and the inspector all work on one plane.
- Going 2-story becomes a visible mid-game milestone, which matches the existing "multi-story is a mid-game upgrade" decision.
- Risk: escalators, stairs and lift queues stay off the critical path of the first flight. They still ship and get tested in WP2. They are first played at the upgrade.
- Switching to S2 later costs only the starter data file (`stacked2f.ts`), its price, and one line in `STARTER_TERMINAL`.

---

## 1. What is wrong today (root causes)

The short version, from the audit: two buildings are drawn in one camera. The walk, the queues and the starter kit live on an 8×5 zone grid in real metres (48×32 m). The picture is the 3×3 apron terminal, authored at `WORLD_PER_METER` 0.45 units per metre, scaled into that box by `hallFitFor`, then dressed with every prop in the catalog. People, desks, security and the jet bridge each come from a different layer, which is why they disagree about size, facing and room.

| Item | Root cause | Audit | Where |
| --- | --- | --- | --- |
| 3, 34 | **Two buildings at once.** `hallFitFor` gives `fit.scale ≈ 1.003` for the 29.7-unit-wide 3×3, so one world unit is about one hall metre. A real metre inside the picture is therefore 0.45 hall metres, while walkers stay at real metres. That 2.2× ratio is the giant next to the tiny person. | §1 | `src/render/hallRooms.ts:47-59`, `src/render/hallWorld.ts:1244` |
| 3 | **People at several sizes.** Baked `TerminalBuilding` people stand about 0.79 m (`PERSON_SCALE` × `fit.scale`). `HallFigureBatch` doorway figures shrunk by `hallGuestScale` are about 0.63–0.73 m. `HallNavCrowd` capsules are 1.60–1.77 m, and its near `PeopleRenderer` swap is 1.75 m. `HallServiceFx` staff are 1.75 m. Officers baked into the `security_lane` and x-ray prop meshes come out around 0.40 m. | §1 | `src/render/world/terminal.ts:92-96`, `hallRooms.ts:126-131`, `src/render/hallNavCrowd.ts:342, 513`, `src/render/hallWorld.ts:1325-1424`, `src/render/terminalProps/props.ts:79-104` |
| 3, 34 | **Props shrunk twice.** Plan props are placed at `WORLD_PER_METER`. Hi-detail props are `fitScale`d (floored at 0.35) and then × 0.45. The dressing caps them again at 0.48. The one metre-scale kit renderer (`hallKitMeshes` / `hallKitDetail`), which is the only path that shows the round 5 desks near real size, is hidden whenever the room plan exists. | §1 | `src/render/world/terminalHiDetail.ts:61-93, 256`, `hallRooms.ts:113-116` |
| 34 | **Catalog dump.** `planTerminal` adds a second full set of check-in, security, shop and gate props, ceiling lights and baked people. `buildInteriorDressing` places every `TERMINAL_PROP_TYPES` entry, and `terminalHiDetail.test.ts:52-53` asserts that every type is present. Types missing from `preferred` (`xray_machine`, `body_scanner`, `seat_row` and others) fall back into check-in. | §2 | `src/render/world/plan.ts:149-252`, `terminalHiDetail.ts:195-258` |
| 33 | **Security in two places.** Prefab I places its two lanes at opposite ends of the six-cell security row (`securityLaneSpots`, with the middle left empty). The outer lane sits near x = −22 m, outside the fitted 3×3 (about ±15 m), at the same end as the entrance. Departures pick the nearest staffed lane, so they queue in an empty band and never enter the room with the x-ray. A second "security" exists too: the x-ray rig in the staff-only lab. | §3 | `src/game/terminal.ts:790-818`, `src/game/hallNav.ts:137-145`, `plan.ts:232` |
| 33 | **Small, backwards desk.** The plan counters face `yawAir + π`, with airside to the west, so they face the road. The small desk is the dressing's single `checkin_desk` at ≤ 0.48 × 0.45, about a fifth of real size, yawed along the room's long axis. The round 5 `checkin_pair` never replaces the counters in this view. | §3 | `plan.ts:165-168`, `terminalHiDetail.ts:249-257` |
| 36 | **Jet bridge indoors.** The dressing sends `jet_bridge` to room kind `airside`, which is the landside third of each gate cell, with an outside nudge of 0. So it lands on the interior strip. `dockAirsideBridge` builds a second bridge 2.2 m outside the facade door, which is the right place but a duplicate. | §3 | `terminalHiDetail.ts:226, 255`, `src/render/world/rooms.ts:163`, `hallWorld.ts:977-1012` |
| 37 | **Yellow vehicle indoors.** Not covered by the audit. From this plan's read, the candidates are `SupplyCartLayer` (stores carts drawn in the hall) or a vehicle piece of the bridge dressing. WP1 identifies it from a screenshot, and both leave the hall. | — | `src/render/supplyCart.ts`, `hallWorld.ts` |
| 38 | **Security kit in Runway Burger.** The burger is `shop_fastfood`. It exists only because the dressing assigns it to the shops room and packs every other shop type into the same room. The neighbouring security cell gets a 14.2 m `security_lane` (x-ray, arch, scanner, four baked officers) plus the plan's own x-ray and arch. Placements are not clipped to rooms, and the shop shell is open, so the scanner reads as part of the burger. | §3 | `terminalHiDetail.ts:213, 240-258`, `props.ts:300-371` |
| 35 | **Passengers at start.** `buildStarterKit` calls `seedDayOneCrowd`, which pushes 12 preview guests (`preview`, `clearedSec`). `HallNav.admit` spawns them onto the live walk. `planTerminal` also bakes static people. | §4 | `src/game/sim.ts:6060, 10547`, `hallNav.ts:747-752` |
| 5 | **Placed fittings never draw.** `commitHallItem` saves the piece to `fit.items` and bumps `hallRev`, and the walk rebuilds. But `rebuildRooms` returns early when the 3×3 room plan exists, so no mesh and no pick box is created. Even on the legacy path: `prefabNavLayout` moves placed lanes onto fixed `laneSpots`; `PREFAB_ROOM_KIT` has no `bagclaim`; `secure_exit`, `queue_rail` and wayfinding have no room; `includedSecurityLanes` counts only bundle lanes, so a placed lane stays shut until a spare officer is assigned; `hallBaseLayout` ignores `fit.items` once `fit.build` exists. | §5 | `hallWorld.ts:1147-1150`, `hallNav.ts:182-211, 355-357, 458-466`, `src/game/hallNavData.ts:150-158`, `src/servicepoints/points.ts:37-44` |
| 46 | **Inspector not live, no security panel.** The hall card is `game.buildingCard()`, re-rendered only when `hudSnapshot` changes. That snapshot holds aggregates (passenger count, `hallRev`, the security queue count) but not `hallNav.metrics()` per lane, so the card catches up only on the 2 s tree cadence. Interior meshes carry no `userData.facilityId`, so clicking a lane, scanner, desk or the burger selects nothing. Other `item:` picks get stub cards (demand 0, one idle bay). `facilityInfo` is built but never read. | §6 | `src/App.tsx:125-208, 283-285`, `hallWorld.ts:644-666`, `sim.ts:8810-8847, 20662-20749` |
| Flow | **Two passenger engines.** PaxNav draws the walk. The hall graph (`tickHall`, `game/guests.ts`, `hallRoute.ts`) still ticks fares, bags and boarding. The sim boards a passenger by setting `dead` at the gate node when the flight calls, or earlier, with no gate-desk queue. Bag drop is folded into check-in on both engines. The day-one path never visits a toilet. `standPaxMode` returns `jetway`, `bus` or `walk`, but that only changes a thought string and a timing number. Arrivals always step off at the jet-bridge door. | §4 | `sim.ts:15756-15764, 10761-10763, 6399-6408`, `src/game/hallArrivals.ts:302-315` |
| 39 | **Pause doesn't stop the screener.** Found in this plan's read, not the audit. X-ray trays and several hall loops animate from `performance.now()`. | — | `src/render/terminalProps/index.ts` (trays `onBeforeRender`), `hallWorld.ts` (lines ~535, 932, 1261, 1945, 2036, 2058) |

---

## 2. Delete and keep

### Delete

Brackets show when a piece stops being used and when its file is removed. WP1 switches the hall camera off the old layers without deleting files. WP4 deletes them once the new renderer draws the layout.

| Path | What goes | Why |
| --- | --- | --- |
| `src/render/hallWorld.ts` | `syncInterior` embedding `TerminalBuilding` under `interiorGroup` with `fit.scale`; the `rebuildRooms` early return; `HallFigureBatch` / `buildFigure`; every `performance.now()` animation [WP1]. Hard-coded hall box walls, concourse columns, the hidden `BEFORE` / `AFTER SECURITY` labels, the legacy zone floor, and `dockAirsideBridge` (replaced by PR #114 sockets) [WP4]. Camera and picking move to `src/render/interior/` [WP4]. | 3, 5, 34, 36, 39 |
| `src/render/world/plan.ts` | `planTerminal` as an interior: zones, props, baked people, decorative walker routes. Not drawn in the hall from WP1; the interior parts are deleted in WP4. Keep an exterior footprint read only if the airport-view shell still needs it. | 33, 35, 38 |
| `src/render/world/terminalHiDetail.ts` and `terminalHiDetail.test.ts` | The whole file, including `buildInteriorDressing`, `HI_DETAIL_KIND` and the "every prop type" assertion. Not drawn from WP1; deleted in WP4. | 34, 36, 38 |
| `src/render/hallRooms.ts` | `hallGuestScale` and `poseOnPlan` [WP1]; `hallFitFor`, `apronToHall`, `hallToApron` [WP4]. `matchTerminal` and `stampAnchor` move to `src/game/terminalMatch.ts` [WP4]. | 3 |
| `src/render/hallKitDetail.ts`, `src/render/hallKitMeshes.ts` | These become the interim metre-scale kit renderer in WP1, with no `fitScale` shrink below 1. They are replaced by `src/render/interior/fittings.ts` and deleted in WP4. | 3, 5, 33 |
| `src/render/terminalProps/props.ts` | The baked `person()` officers inside `security_lane` and the x-ray models. Staff are drawn by `HallServiceFx` through `PeopleRenderer` on the lane's staff sockets [WP1]. | 3 |
| `src/render/supplyCart.ts` in the hall | Removed from the hall scene. Stores restock becomes a staff walk to the shop's stock door [WP1]. | 37 |
| `src/game/sim.ts` | `seedDayOneCrowd`, `tickPreviewGuest`, `retireDayOneCrowd`, `preview` guests [WP1]. `tickHall` node routing, boarding by setting `dead`, and the thought-only `standPaxMode` [WP3]. | 35, flow |
| `src/game/guests.ts`, `src/game/hallRoute.ts` | `NODE_POS`, `HALL_EDGES`, node routing and the doorway polylines. Keep the `PaxTag` colours and labels [WP3]. | One passenger model |
| `src/game/terminal.ts` | `SCHEME_I/II/III`, `GRID_C`, `GRID_R`, `HALL_W`, `HALL_D`, `cellCenter`, `schemeItems`, `prefabBundle`, `PREFAB_I_OPEN`, `securityLaneSpots`, `zoneCellBlocked`. The nav stops reading them in WP2; they are deleted in WP4. `ItemDef` prices, wear, upkeep and service times stay, and the catalog reads them. | 33 |
| `src/game/hallNav.ts`, `src/game/hallNavData.ts` | `prefabNavLayout`, `laneSpots`, `PREFAB_ROOM_KIT`, the bundle-only `includedSecurityLanes`, and the `hallBaseLayout` early return that ignores `fit.items` [WP2]. | 5, 33 |
| `src/terminalplay/` | The nine-room plan, lines, place and queues. The `FOOTPRINTS` numbers move into the catalog in WP2; the folder is deleted in WP4. | 5 |
| `src/game/shellFloor.ts` | `FloorExtra` zone-column growth. The shell grows in whole apron cells through the layout instead [WP4]. | 6 m cell scheme |
| Tests on deleted code | `hallRooms.test.ts`, `hallKitDetail.test.ts`, `hallKitMeshes.test.ts`, `world/plan.test.ts`, `world/rooms.test.ts`, `world/terminalHiDetail.test.ts`, `terminalplay/terminalplay.test.ts`, `game/starterInterior.test.ts`, `game/shellFloor.test.ts`, `game/hallPathing.test.ts` go in the WP that deletes their source. The real-behaviour parts of `hallNav.test.ts`, `hallNavGuests.test.ts`, `hallArrivals.test.ts`, `opening.test.ts`, `servicePoints.test.ts`, `litter.test.ts`, `shellExpand.test.ts` and `playtestFixes.test.ts` are rewritten against the new model in the same WP. | |

Out of scope: `src/render/world/hallCrowd.ts` and `PERSON_SCALE` draw low-quality guests on the apron, not in the hall (audit §1). They stay until a separate apron-people pass.

### Keep and reuse

| System | Path | How it is used |
| --- | --- | --- |
| Queues and service points | `src/servicepoints/*`, queue logic in `src/paxnav/paxnav.ts` | Every fitting that serves someone is a service point: desk, kiosk, bag drop, BP podium, lane, gate desk, shop counter, WC, lift. One server at a time, with marked lines. |
| Editor and kit catalog | `commitHallItem` (`sim.ts:15331-15370`), `src/game/terminalKit.ts`, `src/game/terminalKitData.ts`, `ItemDef` in `src/game/terminal.ts`, and `src/terminalbuild/*` (`layout.ts`, `interior.ts`, `validate.ts`, `grid.ts`, `floors.ts`), `src/render/interiorBuild.ts`, `src/ui/InteriorBar.tsx` | The editor writes the same layout the walk and the renderer read. Foundation, walls, doors, zones and floor paint stay. Kit items become fittings with real footprints. Stairs, escalator and lift tools are added. |
| P1 passenger AI | `src/paxnav/guests.ts`, `guestConfig.ts`, `guestNames.ts`, `guestGlance.ts`, `crew.ts`, `src/game/hallArrivals.ts` | Names, traits, moods, needs, families, lost passengers, rebooking, and the arrival walk. One stop list (section 4.3), not a second graph. |
| Round 5 desks and staff art | `src/render/terminalProps/*` (`checkinDesk` / `checkin_pair`, the `rbox` prim, `parts.ts`, `shell.ts`, `interiorTex.ts`), `src/people/*`, `assets/people/originals/*` | Builders are already in metres with the origin at the floor centre. Render them at scale 1. The low-poly counters and the 0.48-capped `checkin_desk` copy go. |
| People | `src/people/renderer.ts` (`PeopleRenderer`), driven by `src/render/hallNavCrowd.ts` | `PeopleRenderer` is the only body, at `unitsPerMeter = 1`, for passengers, staff and crew indoors. `HallNavCrowd` stays as the crowd driver and LOD manager. Its far capsule LOD is allowed only at the same height range, and the scale audit checks it. |
| Service effects | `src/render/hallService.ts` (`HallServiceFx`) | Belts, scales, trays and desk/lane staff, driven by fitting sockets. Animation reads `animSec`. |
| Live metrics | `hallNav.metrics()` | The inspector's data source (WP5). |
| Phone feed | `src/phone/*` | Blocking findings and "terminal ready" notes go to the phone. No modals. |
| Stand and jet-bridge upgrade | `src/stands/*`, PR [#114](https://cursor.com/codebase/hatchtag/hatchfield-game/pull/114) (`src/render/aircraft/bridges.ts`, `src/render/world/airfield.ts`) | The bridge roots on the terminal facade socket. The new layout publishes those sockets from its gate-head doors (section 7). |
| Advisor reference | `src/terminaladvisor/*` | Untouched. Its multi-floor model already matches. |
| Interior textures | `public/art/textures/interiors/*`, `public/art/textures/signage/*` | Floor and wall paint, desk headers, wayfinding. |
| PR #119 service props (bag-drop kiosk, claim carousel, passport booth) | Plates: `public/art/textures/concepts/{bag_drop_kiosk,baggage_claim_carousel,passport_control}.jpeg`, `SERVICE_PLATES` / `SERVICE_PLATE_NATIVE` / `SERVICE_PLATE_BYTES` in `src/assets/manifest.ts`, `src/render/servicePlates.ts` (full-resolution loader). Materials: `plateBagDrop`, `plateClaim`, `platePassport` in `terminalProps/materials.ts`. Builders: `bagDropKiosk`, `carousel` and `passportBooth` in `terminalProps/props.ts`. Build menu: the glyphs in `src/ui/kitGlyph.tsx`, the `passport_booth` kind in `src/game/terminal.ts`, its `KIT_ITEMS` entry in `src/game/terminalKitData.ts`, and `EQUIP_PLATE` plus the immigration and claim rooms in `src/terminaladvisor/rooms.ts`. | Kept as they are. They are the art for the `bag_drop`, `claim_carousel` and `passport_booth` fittings. The builders are already in metres, so the rebuild draws them at scale 1 and takes the catalog footprints from their measured sizes (section 4.4). Plates stay at native resolution and are never downscaled. Only their placement goes: the `terminalHiDetail.ts` dressing puts the kiosk and booth in check-in at `Math.min(1, fitScale(...))`, which is the wrong room and the wrong size. That dressing stops in WP1 and is deleted in WP4. The low-poly copies in `hallKitMeshes.ts` go when that file is deleted. |
| Dev showroom | `src/render/terminalProps/demo.ts`, `terminal-props.html` | Kept as a prop viewer. Not part of the game scene. |

---

## 3. One scale

- Inside Terminal view, 1 unit = 1 m. Fittings, walls, doors and people are built at real size and never scaled per object.
- In the airport view, the whole interior hangs under one node named `terminal-root`, scaled by `WORLD_PER_METER` (decision D6). That is the only non-unit scale allowed anywhere under the terminal.
- Build tiles become 1 m. `BuildLayout` gains `tileM` (missing means 4, the legacy value). New layouts use 1. The nav grid uses `cellsPerTile = 2`, so cells are 0.5 m, about one person's shoulder width.
- Per-tile prices are rescaled per square metre, so a 16 m² floor costs what one old 4 m tile did. For example, `FLOOR_COST.build` 900 per tile becomes 56.25 per m², and walls go from 400 per 4 m to 100 per m. All of these live in `src/terminalbuild/config.ts`.
- Real sizes are in the catalog (section 4.4). The scale-audit test fails any mesh outside its range.

Scale constants go in a new file, `src/terminalbuild/scale.ts`:

| Constant | Value |
| --- | --- |
| `PERSON_M` | 1.75 (variants 1.55–1.95, children 1.0–1.4) |
| `SHOULDER_M` | 0.5 |
| `DOOR_H_M` | 2.2 (curb auto doors 2.4) |
| `DESK_H_M` | 1.1 |
| `BELT_W_M` | 0.8 |
| `SEAT_H_M` | 0.45 |
| `FLOOR_TO_FLOOR_M` | 5.0 |
| `CLEAR_H_GROUND_M` | 4.2 |
| `ROOF_H_M` | 9.0 on 2-story, 6.0 on 1-story |

---

## 4. Data model

All of this is pure data in `src/terminalbuild`. There is no DOM, Three or React in it.

### 4.1 Floors

```ts
interface FloorSlab { index: number; elevationM: number; tiles: boolean[][]; zones: (BuildZone | null)[][]; paint?: (string | null)[][] }
interface BuildLayout {
  version: 2
  tileM: 1
  w: number; h: number            // tiles (metres)
  stories: 1 | 2                  // how many slabs this hall may hold
  floors: FloorSlab[]             // floors[0] is ground; floors[1] exists on 2-story halls
  walls: Edge[]; doors: Door[]; rooms: Room[]; fittings: Fitting[]; verticals: Vertical[]; belts: BeltRun[]; ports: Port[]
}
```

`floor` stays on every piece, as [INTERIOR_EDITOR.md](./INTERIOR_EDITOR.md) already specifies. `ENABLED_STORIES` becomes 2. `STARTER_STORIES` comes from `STARTER_TERMINAL`.

### 4.2 Zones and sides

`BuildZone` gains `claim`, `arrivals` (sterile corridor), `vertical` and `bagroom`. `ZoneSide` gains `sterile_arr`. Each zone maps to exactly one side:

| Side | Zones | Who may stand there |
| --- | --- | --- |
| `landside` | landside, checkin, retail (landside) | Departures before security, arrivals after the exit, meeters |
| `security` | security | Departures only, one way, landside to airside |
| `airside` | airside, gates, retail (airside) | Departures after security |
| `sterile_arr` | arrivals, claim | Arrivals only, from the aircraft to the exit door |
| `staff` | office, bagroom, R&D | Staff only |

Door kinds gain `gate_bridge` (a facade door on a bridge socket), `gate_apron` (walk-out or bus) and `arrivals_in` (apron to sterile). The existing `exit` is one-way from sterile or airside to landside. A door's two tiles must sit on sides the door allows, and the validator rejects any door that joins `airside` to `sterile_arr`.

### 4.3 Flow-stage graph

Stages are data (`src/terminalbuild/stages.ts`). A passenger walks the stages in order. Within a stage, they pick one of the fittings that serve it (section 5).

```
DEPARTURE
 CURB_IN -> LANDSIDE_FREE* -> CHECKIN -> BAG_DROP? -> SECURITY -> AIRSIDE_FREE* -> GATE_HOLD -> GATE_QUEUE -> BOARD(stairs|bus|bridge)
ARRIVAL
 DEPLANE(stairs|bus|bridge) -> ARR_CORRIDOR -> PASSPORT? -> ARR_FREE*? -> CLAIM? -> EXIT -> LANDSIDE_FREE* -> CURB_OUT
```

**Passport control is for international arrivals only.** `PASSPORT` runs only when the arriving flight is international, and it sits between the aircraft and the carousel, served by a `passport_booth` (concept plate `passport_control`). Domestic arrivals walk past it. Departures never have a passport stage, domestic or international, and there is no emigration stage. An international departure only gets the earlier show-up and check-in close it already has (`planShowUp` / `checkInCloseAt` in `src/pax/showup.ts`).

There is one international test: `flightIsIntl(flight)` in `src/pax/showup.ts`, added in WP3. It reads the route's own flag once routes carry one. Until then it falls back to today's `isIntlKind(kind)`, which treats widebodies as international. Departure show-up timing and the arrival `PASSPORT` stage both call it, so they can't disagree. The starter can't land a widebody, so `PASSPORT` stays off and the starter has no booths. The S1 and S2 claim halls keep a passport slot (`P` in section 5) for when the first international route is scheduled.

| Stage | Served by | Skip rule | Side |
| --- | --- | --- | --- |
| `CURB_IN` | curb door | never | landside |
| `LANDSIDE_FREE` (optional, needs-driven) | food, shop, WC, bench, FIDS | no need above threshold, or the show-up is late | landside |
| `CHECKIN` | `checkin_desk` (also takes bags), `checkin_kiosk` | online check-in with no bags | landside |
| `BAG_DROP` | `bag_drop`, or the desk if the desk already took the bags | no checked bags | landside |
| `SECURITY` | `bp_podium`, then `security_lane` | never for departures | security |
| `AIRSIDE_FREE` (optional) | airside food, shop, WC, seats | boarding has opened | airside |
| `GATE_HOLD` | `seat_row` or bench in the holdroom of the assigned gate | gate not yet assigned: wait in the lounge | airside |
| `GATE_QUEUE` | `gate_desk` (boarding-pass scan) | never | airside |
| `BOARD` | gate door matched to the stand's boarding method | never | airside to apron |
| `DEPLANE` | aircraft door to bridge or stairs, then `arrivals_in` door or gate-head sterile door | never | apron to sterile |
| `ARR_CORRIDOR` | sterile corridor tiles | never | sterile_arr |
| `PASSPORT` | staffed `passport_booth` (one officer per booth) | flight is not international (`flightIsIntl` is false); never skipped on an international arrival | sterile_arr |
| `ARR_FREE` (optional) | arrivals WC, arrivals shop (duty-free before claim) | no need | sterile_arr |
| `CLAIM` | `claim_carousel` (waits for own bag sequence number) | no checked bags | sterile_arr |
| `EXIT` | one-way `exit` door | never | sterile to landside |
| `CURB_OUT` | curb door | never | landside |

Each stage holds the fitting kinds that can serve it, the side mask an agent carries while in it, and the skip predicate. The validator walks the graph on the actual layout. It produces one finding per stage that can't be reached, plus these hard rules:

- Every departure path crosses exactly one `security` room.
- No arrival path touches a `security` or `airside` tile.
- Every desk and bag drop has a belt path to a `bag_out` port.
- Every claim carousel has a belt path from a `bag_in` port.
- Every gate's door kinds cover the boarding methods of the stands assigned to it.
- A `passport_booth` may only stand on `sterile_arr` tiles (the claim hall or the arrivals corridor). Placing one on a landside, security or airside tile is a room-rule finding, so no departure path can ever reach a booth.
- When an international flight is scheduled, every arrival path from its stand crosses a staffed passport booth before `CLAIM`. If not, the finding "International arrivals need passport control" blocks that flight. With no international flight scheduled there is no finding. Booths built early stand idle and still cost upkeep, and the inspector says so.

### 4.4 Fittings at real size

`Fitting` replaces `Equip`:

```ts
interface Fitting { id: string; kind: FittingKind; x: number; y: number; floor: number; rot: 0|1|2|3; wear: number; staffed?: boolean; gateId?: string }
```

The catalog (`src/terminalbuild/fittings.ts`) is data. For each kind it holds: footprint, height, clearance in front, the rooms it may go in, the stage it serves, service time, servers, staff, cost, upkeep, wear rate, the prop builder, and the inspector fields. Prices, wear, upkeep, outlet specs and service times are read from `ItemDef` / `KIT_ITEMS` (`src/game/terminal.ts`, `src/game/terminalKitData.ts`) and `EQUIP_SPEC`, never forked. Footprints start from `FOOTPRINTS` (`src/terminalplay/footprints.ts`). Values for new kinds are proposed in WP2 and reviewed in its PR.

| Kind | Footprint w × d (m) | Height (m) | Audit range, height (m) | Room | Prop builder (`terminalProps`) |
| --- | --- | --- | --- | --- | --- |
| `checkin_desk` (desk, agent space, weigh belt, takeaway belt) | 2.0 × 2.6 | 1.1 counter, 2.4 header | 1.0–1.2 counter | checkin | `checkin_desk` (round 5 bank) |
| `checkin_kiosk` | 0.6 × 0.6, plus 1.2 clearance | 1.6 | 1.4–1.8 | checkin, landside | `self_checkin_kiosk` |
| `bag_drop` (self bag drop: kiosk, scale, injection belt, plate board) | 1.9 × 1.9 | 1.6 screen, 2.5 board top | 1.3–1.8 screen | checkin | `bag_drop_kiosk` (PR #119), plate `bag_drop_kiosk` |
| `queue_rail` (per 1 m of rail) | 1.0 × 0.3 | 1.0 | 0.9–1.1 | checkin, security, gates | `stanchion_queue` |
| `bp_podium` (boarding-pass e-gate) | 1.0 × 2.0 | 1.1 | 1.0–1.6 | security | new |
| `security_lane` (divest, x-ray, scanner, recompose) | 4.0 × 10.0 | 2.3 scanner, 1.9 x-ray | 1.8–2.5 | security | `security_lane_ct`, `body_scanner`, `divest_station`; target: Gemini `security` |
| `gate_desk` | 2.4 × 1.2 | 1.1 | 1.0–1.2 | gates | `gate_podium` |
| `seat_row` (3 seats) | 1.95 × 0.75, row pitch 1.6 | 0.8 back, 0.45 seat | 0.4–0.5 seat | gates, airside, landside | `seat_row`, `gate_seating`; target: Gemini `gate_seats` |
| `bench` | 1.8 × 0.6 | 0.45 | 0.4–0.5 | any public | `seat_row` variant |
| `shop_counter` | 4.0 × 1.0 | 1.1 | 1.0–1.2 | retail | `shop_*`, `cafe_counter`, `menu_*` |
| `cafe_table` (4 seats) | 1.6 × 1.6 | 0.75 | 0.7–0.8 | retail (food) | `cafe_table` |
| `wc_block` (per cubicle, with basins) | 1.0 × 1.6 | 2.1 partition | 1.9–2.3 | toilets | `restroom_block`, `restroom_stall` |
| `claim_carousel` (flat plate with feed hood, small) | 14.4 × 4.2 | 0.46 belt, 4.0 board top on a 3.5 m pole | 0.4–0.6 belt | claim | `baggage_carousel` (PR #119), plate `baggage_claim_carousel` |
| `passport_booth` (bank of 3 booths, 1 officer each) | 4.3 × 1.3, plus 1.3 of queue rail in front | 1.1 desk, 3.9 board top | 1.0–1.2 desk | claim, arrivals (sterile_arr only) | `passport_booth` (PR #119), plate `passport_control` |
| `belt` (per 1 m) | 1.0 × 0.8 | 0.7 | 0.6–0.8 | checkin, bagroom, claim | conveyor `belt` prim |
| `belt_incline` (5 m rise) | 0.8 × 14.0 | 0 to 5.0 | n/a | shaft | new |
| `bag_port` (wall) | 1.2 on a facade edge | 1.0 opening | n/a | facade | new |
| `fids` | 3.0 × 0.3, mounted at 2.2 | 1.8 panel | 1.6–2.0 | any public | `departures_board` |
| `wayfinding` | 0.4 × 0.4 | 2.6 | 2.4–3.0 | any public | `wayfinding_totem` |
| `escalator` (one direction) | 1.6 × 14.0 | 5.0 rise | n/a | vertical | new |
| `stairs` | 3.0 × 10.0 | 5.0 rise | n/a | vertical | new |
| `lift` | 2.6 × 2.6 shaft | both floors | n/a | vertical | new |
| `gate_head` (bridge vestibule) | 4.0 × 6.0 (1-story) or 4.0 × 14.0 core with sterile stair (2-story) | wall height | n/a | gates | new |
| person | 0.5 × 0.3 | 1.75 | 1.55–1.95 (adult) | n/a | `PeopleRenderer` only |

There are no `jet_bridge`, vehicle, lounge-cluster or staff-office "dressing" kinds indoors. A bridge exists only on the apron.

The bag drop, carousel and passport booth rows are measured from the PR #119 builders, which are already in real metres. WP2 pins those numbers in `fittings.test.ts` against each builder's bounding box, and the scale audit holds them to ±5%. A bigger carousel adds straight belt segments (the builder's straight-run length `L`, a constant of 9 m today, which WP4 turns into a parameter) and keeps the 2.7 × 1.5 m plate board as it is. It is never scaled up. A bigger passport hall adds banks of three booths side by side. The plates load at native resolution through `servicePlates.ts`.

### 4.5 Belts and ports

```ts
interface BeltRun { id: string; floor: number; tiles: {x:number;y:number}[]; dir: 'out' | 'in'; incline?: { toFloor: number } }
interface Port { id: string; kind: 'bag_out' | 'bag_in'; edge: Edge; socket: string }  // socket: 'terminal:<hallId>:bag_out:<id>'
```

Belts are fittings drawn tile by tile. The validator treats them as a directed graph from desk or bag drop to `bag_out`, and from `bag_in` to the carousel. Belt tiles block walking.

---

## 5. Starter layouts

Both are 88 m × 44 m, which is 4×2 apron cells (D2). North (y = 0) is the apron facade with the stands. South (y = 44) is the curb. The bag sort building sits outside the west facade with its front facing the apron (Batch D). One character is 2 m. The scale is drawn along the top.

Legend: `+ - |` wall · `D` curb door · `A` apron gate door (stairs or bus) · `B` bridge socket door · `a` arrivals door (apron to sterile) · `X` one-way exit · `d` inside door · `g` gate-head door (opens while boarding) · `C` staffed check-in desk · `b` bag drop · `k` kiosk · `q` queue rail area · `S` built security lane · `s` empty lane slot · `p` boarding-pass podiums · `G` gate desk · `h` gate seats · `O` claim carousel · `P` passport-control slot (empty until an international route is scheduled) · `=` belt · `o` bag_out port · `i` bag_in port · `E` escalator · `T` stairs · `L` lift · `#` stair core (solid below the run) · `:` growth slot · `W` landside WC.

### 5.1 S1: 1-story split-flow starter (recommended)

```
S1 ground floor (the only floor), 88 m x 44 m, 2 m per character
      0    1    2    3    4    5    6    7    8
  0m  +---aa------+--AA-------------------AA--+---+
  2m  |           |  d                        |   |
  4m  | BAG CLAIM |NSdG hhhhhhh:::hhhhhhh  G  d   |
  6m  | (sterile) |  |  hhhhhhh:::hhhhhhh     dFD |
  8m  | PPPPPPPPP +--+  hhhhhhh:::hhhhhhh     d   |
 10m  |           |                           |   |
 12m  | OOOOOOOO  |      AIRSIDE LOUNGE       |   |
 14m  i=OOOOOOOO  +-+ddddd----------+-----+---+dd-+
 16m  |           | SSSSssssssssssss|     |   |   |
 18m  |           | SSSSssssssssssss|     |   |   |
 20m  | arrivals  W SSSSsssSECURITYs|R&D  |OFF|WC |
 22m  |           | SSSSssssssssssss|     |   |   |
 24m  |           | pppppp          |     |   |   |
 26m  o========-XXdd+ddddd----------+-dd--+dd-+---+
 28m  |CCb:::::                                   |
 30m  |qqqqqqqq                                   |
 32m  |qqqqqqqq                                   |
 34m  |                             +dddd-+dd-+   |
 36m  | kk                          |     |   |   |
 38m  |               LANDSIDE HALL |CAFE |SHP|   |
 40m  |                             |     |   |   |
 42m  |                             |     |   |   |
 44m  +---DDD----DDD----------------+-----+---+---+
```

| Area | Rectangle (m) | Contents at start | Room to grow |
| --- | --- | --- | --- |
| Baggage claim (sterile) | x 0–24, y 0–26 | 1 carousel in a 16 × 4 m slot at y 12–16 (the PR #119 carousel measures 14.4 × 4.2). Claim feed belt from `bag_in` (west wall, y 14). Arrivals door `a` at x 8–12 on the apron facade. One-way exit `X` at x 20–24 into the hall. No passport booths. | Passport line `P` across the hall at y 8–10, between door `a` and the carousel. It holds up to 4 banks of 3 booths, joined by a glass partition so nobody walks round it, with the queue in y 0–8. A bridge arrivals corridor must join the hall north of y 8. Second carousel at y 18–22. Arrivals WC or shop along the east wall. |
| Check-in | x 0–24, y 26–38 | Desk row along y 26–28.6 facing south, toward the entrance doors. 2 desks (1 staffed, 1 built but unstaffed), 1 bag drop, 1 kiosk (one more kiosk slot), queue rails y 28.6–34. Takeaway belt behind the desks at y 26.4 to `bag_out` (west wall). | 5 more desk slots along the same belt (x 8–18). The kiosk island grows east. |
| Landside hall (shared) | x 0–88, y 26–44 | Departure doors `D` x 8–14 (in front of check-in). Arrival exit doors `D` x 22–28 (in line with the claim exit). Café (x 60–72) and shop (x 72–80) open onto the hall. Benches, FIDS, landside WC (x 24–28, y 14–26). | East strip x 80–88. Café and shop units can double in depth. |
| Security (one room) | x 28–60, y 14–26 | BP podiums y 24–26. 2 built lanes (x 28–36), each 4 × 10 m. Entry at y 26 from the hall, exit at y 14 into the lounge. Every departure path crosses this room once. | 6 more lane slots at 4 m pitch (x 36–60). |
| R&D, office, airside WC | x 60–72 / 72–80 / 80–88, y 14–26 | R&D lab and staff office (staff doors from the hall). Airside WC (door into the lounge). | n/a |
| Airside lounge | x 24–88, y 0–14 | Newsagent (x 24–30). Food (x 80–88). Gate 1 desk and holdroom (about 36 seats, door `A` x 30–34). Gate 2 desk and holdroom (about 36 seats, door `A` x 72–76). Doors are 42 m apart, which fits two code-C stands. | Seat slots between the holdrooms. Gates 3–4 come by extending the shell east by one apron cell (22 m). |

Opening ceilings must stay within ±10% of `STARTER_CAPACITY` (46 passengers, 37.5 per minute, 88 bag units). A WP1 test checks this.

Jet bridges on S1: a bought bridge fits a `gate_head` on the gate's facade door. Deplaning passengers need a sterile route from the gate head to the claim hall, so the validator raises "Bridge arrivals need a corridor to baggage claim" until the player builds one. That is a player-made bottleneck by design. Stairs and bus arrivals use door `a`.

### 5.2 S2: 2-story (the mid-game upgrade, or the starter if D1 picks S2)

The footprint is the same. The upgrade adds floor 1 at +5.0 m and moves departures upstairs. The player rebuilds the ground floor into arrivals at their own pace and cost. The S1 ground floor keeps working until they do.

```
S2 ground floor (arrivals + entry), 88 m x 44 m, 2 m per character
      0    1    2    3    4    5    6    7    8
  0m  +---aa--------------+-AAA-TT----AAA---##----+
  2m  |              ##   |     TT          ##    |
  4m  | BAG CLAIM    ##   |     TT BUS GATE LOBBY |
  6m  | (sterile)    ##   |     TT          ##    |
  8m  |              ##   |                 ##    |
 10m  |              TT   d-----------------TT----+
 12m  |                   d STERILE ARR CORRIDOR  |
 14m  | PPPPPPPPPPPPPPPPP +-----------------------+
 16m  |                   |                       |
 18m  | OOOOOOOOO ::::::::|                       |
 20m  i=OOOOOOOOO ::::::::| R&D  OFFICE  PLANT  WC|
 22m  |                   |                       |
 24m  |                   |                       |
 26m  +----------------XXX+-------+-ddd-----------+
 28m  =                           |E              |
 30m  =                           |E TT  L        |
 32m  =                           |E TT           |
 34m  = ARRIVALS HALL (landside)  |E TT           |
 36m  =                           |E TT     ENTRY |
 38m  =                           |E TT           |
 40m  =                           |E              |
 42m  o                           |               |
 44m  +--------------DDD----------+----DDD--------+
```

```
S2 upper floor (departures, +5.0 m), 88 m x 44 m, 2 m per character
      0    1    2    3    4    5    6    7    8
  0m  +--------------BB+--------TT----------BB+---+
  2m  |              TT|        TT          TT|   |
  4m  | hhhhhhhhhhhh TTgGhhhhhh TT hhhhhhhh gT|G  |
  6m  | hhhhhhhhhhhh TTg hhhhhh TT hhhhhhhh gT|   |
  8m  | hhhhhhhhhhhh TT| hhhhhh    hhhhhhhh TT|   |
 10m  |              TT|          G         TT|   |
 12m  |              | | AIRSIDE LOUNGE     | |   |
 14m  +---dddd----+ddddd------------+----dddd-+---+
 16m  |           SSSSssssssssssssss|             |
 18m  |           SSSSssssssssssssss|             |
 20m  | FOOD NEWS SSSSsssSECURITYsss|SHOP WC FOOD |
 22m  |           SSSSssssssssssssss|             |
 24m  |           pppppp            |             |
 26m  +-----------+ddddd------------+-------------+
 28m  ==CCb:::::::::::::::         E              |
 30m  = qqqqqqqqqqqqqqqqqq         E TT  L        |
 32m  = qqqqqqqqqqqqqqqqqq         E TT           |
 34m  =                            E TT           |
 36m  =                            E TT           |
 38m  =                     kk     E TT           |
 40m  = CHECK-IN / UPPER LANDSIDE HALL            |
 44m  +-------------------------------------------+
```

| Area | Floor | Rectangle (m) | Notes |
| --- | --- | --- | --- |
| Entry lobby and vertical core | 0 and 1 | x 56–88, y 26–44 | Curb doors at x 66–72. Up escalator (1.6 × 14, x 58–60), stairs (3 × 10, x 62–66), lift (2.6 × 2.6, x 70–72). All are landside. A down escalator goes beside the up one when the player adds it. |
| Check-in and upper landside hall | 1 | x 0–56, y 26–44 | Desk row at y 28 facing south. 17 desk slots. Takeaway belt behind it to `belt_incline` down the west wall (x 0–2, y 28–42), then `bag_out` at ground (0, 42). The incline shaft is walled on both floors. |
| Security | 1 | x 24–60, y 14–26 | One room, 9 lane slots. |
| Airside shops, food, WC | 1 | x 0–24 and x 60–88, y 14–26 | Doors into the lounge. |
| Lounge and holdrooms | 1 | x 0–88, y 0–14 | Gate 1 (bridge `B` x 30–34), gate 2 (bridge `B` x 76–80), gate 3 (bus: airside stairs `T` x 52–56 down to the bus lobby). Each bridge gate has a walled sterile core (4 × 14 m) with stairs (and a lift slot) down to the ground. Gate-head doors `g` open only while that gate boards. |
| Baggage claim | 0 | x 0–40, y 0–26 | Every arrival enters north of y 14: door `a` for stairs or bus arrivals, gate 1's sterile stair, and the corridor door from gate 2. Passport line `P` across the hall at y 14–16, empty at start. The carousel sits south of it at y 18–22, with a second-carousel slot beside it (x 24–40). `bag_in` on the west wall at y 20. |
| Sterile arrivals corridor | 0 | x 40–88, y 10–14 | Gate 2's sterile stair lands here. Leads west into the claim hall. |
| Bus gate lobby | 0 | x 40–88, y 0–10 | Airside departures only. Bus doors `A` x 44–50 and x 64–70. Stair cores `#` are solid at ground level. |
| Arrivals hall | 0 | x 0–56, y 26–44 | Meeters, café slot. Exit `X` from claim at x 34–40. Curb doors at x 30–36. |
| Staff | 0 | x 40–88, y 14–26 | R&D, office, plant, staff WC. |

Both layouts are hand-written data files: `src/terminalbuild/starter/split1f.ts` and `src/terminalbuild/starter/stacked2f.ts`. A dump script, `scripts/terminal-layout-dump.mts`, prints these exact grids from the data. WP2 checks the printout against this section.

---

## 6. How passengers walk the stage graph

Code lives in `src/paxnav`. It stays pure and deterministic.

1. **Grid.** `buildNavGrid` builds one 0.5 m cell grid per floor. A cell index is `floor * gw * gh + i`. The `mask` bits gain `ARR` (sterile) and `STAFF` next to `PRE`, `AIR`, `LANE` and `CURB`. Belt and fitting footprints are solid. Door cells carry the door's side rule.
2. **Links.** Each `Vertical` becomes a graph edge between its two landing cells.

   | Link | Direction | Cost |
   | --- | --- | --- |
   | Escalator | One way, set by the fitting | 14 m at 0.5 m/s, about 28 s, plus boarding headway 1.2 s per person per lane |
   | Stairs | Both ways | 10 m at 0.6 m/s with a trait multiplier |
   | Lift | Both ways | A service point (car 13 people, door cycle 12 s, travel 5 m at 1 m/s) with its own queue on each landing |

   Each link has a side, and both landings must match it. The validator checks this.
3. **Flow fields.** These are cached per `(target set, side mask, mobility class)`. Links make costs uneven, so the uniform BFS becomes Dial's algorithm (integer costs, still O(cells)). There are two mobility classes. `any` may use stairs and escalators. `step_free` uses lifts only. Agents with a trolley, a stroller, or reduced mobility from their traits are `step_free`.
4. **Stage step.** On entering a stage, an agent lists the serving fittings it can reach under its current side mask and scores each one by walk time (from the flow field) plus `(queue + incoming) × serviceSec`. This extends the scoring paxnav already does at `paxnav.ts` around line 742. It picks the lowest score, with the existing taste and patience noise. Optional `*_FREE` stages run off the P1 needs (hunger, toilet, shopping, rest), capped by the time left before `GATE_QUEUE` opens.
5. **Side changes.** These happen only at fittings or doors: `security_lane` exit turns `PRE` into `AIR`, and the `exit` door turns `ARR` into `PRE`. No other edge changes an agent's mask. That is what makes "arrivals never pass security" structural: an arrival never carries the `LANE` bit.
6. **Boarding.** `GATE_QUEUE` opens when the flight's boarding window opens. The gate desk serves one person at a time. Then:

   | Stand's boarding method | Route |
   | --- | --- |
   | `stairs` | The `gate_apron` door, then an apron walk polyline to the stand's stairs |
   | `bus` | The `gate_apron` door, then bus loads (capacity from the vehicle) |
   | `bridge` | `gate_head`, `g` door, `gate_bridge` door, then the PR #114 bridge to the aircraft door |

   The boarding method is read from the stand (`src/stands`). It is never stored on the gate. Until WP6 adds stairs and bus meshes, each method is a socket with a real route and duration, not a thought string on an instant despawn (audit §4).
7. **Arrivals.** At `DEPLANE`, agents spawn at the aircraft door, at the deplane rate in `BUILD_TUNING.deboardGapSec`. They walk the method's route to an `arrivals_in` door or a sterile gate-head stair. If `flightIsIntl` is true for their flight, they queue at a staffed passport booth (`PASSPORT`) before claim. Domestic arrivals skip it. At `CLAIM`, a passenger waits at the carousel until the flight's `onClaim` counter passes their bag sequence number. Then they take the `exit` door to the curb.
8. **Spawning.** Agents exist only for booked flights. Departures spawn at `CURB_IN` across the show-up window before STD. Arrivals spawn at `DEPLANE`. Nothing exists before the first flight's show-up window, and there is no preview crowd.
9. **Authority (D4).** Each agent's outcome is reported to the sim: boarded, missed, satisfaction, and spend. Fares, ratings, missed-flight penalties and shop revenue read those outcomes. The 150-day soak keeps its speed because paxnav is O(1) per agent per tick. WP3 records soak wall time against `main`, and more than 25% slower fails the gate.

---

## 7. Bag flow hookup

```
Outbound: desk / bag_drop -> takeaway belt (0.5 m/s) [-> belt_incline on 2-story] -> bag_out port -> apron belt -> BAG SORT -> carts -> stand -> aircraft
Inbound:  aircraft -> carts -> BAG SORT -> apron belt -> bag_in port -> claim feed belt -> claim_carousel -> passenger
```

- Bags are counts on `BagBook` (`src/game/luggage.ts`), as they are today: `dropped`, `screened`, `sorted`, `loaded`, `unloaded` and `onClaim`. The terminal adds two transit legs. `dropped` to `atPortOut` takes belt length divided by `beltMps`. `atPortIn` to `onClaim` takes the claim feed length divided by `beltMps`. The visible parade stays capped, as it is now.
- Ports publish sockets through `terminalSockets(layout, origin)` in a new file, `src/terminalbuild/sockets.ts`. It returns world positions for `bag_out`, `bag_in` and each `gate_bridge` door. Logistics (Batch D's bag sort and apron belts) docks belts to the `bag_*` sockets. PR #114's rotunda reads the `gate_bridge` sockets instead of a fixed facade point.
- Hold-baggage screening (`screened`) stays in the bag sort building. The terminal has no screening kit for bags.
- Blocking findings, each with a phone alert and a "Show me" button:
  - "Bags have no way out": a desk or bag drop with no belt path to `bag_out`.
  - "Claim belt is not fed": a carousel with no path from `bag_in`.
  - "Bag port not connected to the bag sort".
- If Batch D has not landed when WP3 starts, the ports connect to the existing bag hall building through the same socket API.

---

## 8. Inspector, pause and start state

- **Inspector (item 46).** A new pure model, `src/ui/inspector/fittingCard.ts`, and a view, `src/ui/inspector/FittingCard.tsx`. Every `FittingKind` has an inspector entry in the catalog. A test fails if one is missing. The card shows: name, status (working, no staff, worn out, not connected, closed), queue now, average wait over the last hour, served today, throughput per minute against capacity, wear, upkeep per day, staff, and the stage or flow it serves. A passport booth also shows the international arrivals due in the next hour; with none due it reads "Idle: no international flights". Actions are staff or unstaff, repair, move, and sell. The card reads `hallNav.metrics()` per fitting and subscribes to a `terminalVersion` counter that the sim bumps each tick, throttled to 4 Hz with `useSyncExternalStore`. It never reads `hudSnapshot` aggregates or a one-time snapshot (audit §6). Every interior mesh carries `userData.facilityId`. Selecting a walker shows the existing P1 glance in the same right-hand inspector slot. Batch B's rule of one inspector at a time applies.
- **Pause (item 39).** A new file, `src/render/interior/animClock.ts`. The sim advances `animSec` by `dt × speed`, which is 0 while paused. Every interior animation reads `animSec`: trays, belts, carousel, escalator steps, doors, people. A Vitest source scan fails on `performance.now` or `Date.now` anywhere under `src/render/interior/` or `src/render/terminalProps/`.
- **Start state (item 35).** The new-game seed builds the starter layout with zero agents. The first agent appears when the first booked flight's show-up window opens.

---

## 9. Save migration (schema 5 to 6)

`src/features/save/schema.ts` bumps `SAVE_SCHEMA_VERSION` to 6. The migration lives in `src/terminalbuild/migrate.ts`, with fixtures in `src/features/save/fixtures/`.

| Old hall state (`TerminalFit`) | Migration |
| --- | --- |
| Prefab tier 1 (`tier`, `zones`, `items`, `floorExtra`, no `build`) | Replace with `split1f`. Bundle items are dropped at no cost. Player-bought items (`bundle !== true`) are refunded at their purchase price as one "Terminal rebuild refund" ledger line, with a phone note. |
| Prefab tier 2 or 3 | Replace with `stacked2f`, with stories set to 2. This hall had already paid for a bigger terminal. Refunds as above. |
| `interior` (an `InteriorEdit` on a prefab) | Drop it. Refund the build cost of its walls, doors, rooms, zones, floor paint and foundation, from `config.ts` prices. |
| `build` (a built-from-scratch `BuildLayout`, 4 m tiles) | Convert in place. Each tile becomes 4×4 one-metre tiles. Walls and doors scale on their edges. Each `Equip` becomes a `Fitting` centred in its old tile. If it collides or breaks room rules, it goes into the `unplaced` tray and the player places it again for free. `stories: 1`. |
| `rooms` counts, `capGuests`, `secPerMin`, `claimRate` | Recomputed from fittings. The old fields are ignored after load. |
| Hall guests in flight | Dropped. Flights whose show-up window is open re-spawn their booked passengers at `CURB_IN`. Arrivals with bags on claim spawn at `CLAIM`. No passengers are added for free. |
| Passport booths (`passport_booth` kit) | Kept as fittings if they sit on a claim or arrivals tile. Anywhere else they go into the `unplaced` tray so the player can place them again for free. |
| Stands, bridges, boarding method | Unchanged (`src/stands/migrate.ts`). |

`TerminalFit` gains `layout: BuildLayout` (version 2) and drops `zones`, `items`, `floorExtra`, `build`, `interior`, `tier` and `redesigned` after migration. A test loads every fixture in `src/features/save/fixtures/`, migrates it, then runs 1 sim day with no throw and no finding that blocks flow.

---

## 10. Acceptance tests mapped to playtest items

| Item | Automated test (new file) | Screenshot check | WP |
| --- | --- | --- | --- |
| 3: one scale | `scaleAudit.test.ts`. v1 (WP1): every hall person, including capsule LOD and staff, is 1.55–1.95 m; every `terminalProps` type drawn in the hall is within its catalog height range; no node under the hall root has a scale other than 1. v2 (WP4): adds catalog footprints (±5%) and checks that `terminal-root` is the only scaled node in the airport view. | Close-up of a person beside a desk, a scanner and a gate seat. Crew, officers and passengers look the same height. | WP1, WP4 |
| 5: fittings appear and work | WP1: `hallKitPlacement.test.ts`, a placed desk, lane, toilet and bench each produce a mesh and a pick box. WP4: `src/terminalbuild/placeEveryFitting.test.ts`, every kind placed in a valid room on S1 serves at least one agent (or moves one bag) within 30 sim minutes, plus a UI e2e: place a desk, see status "Working" and a served count above 0. | Before and after placing a third desk and a third lane. The queue visibly splits. | WP1, WP4 |
| 33: starter layout | `src/terminalbuild/starter.test.ts`. Curb entrance and exit doors exist. Each desk's front faces the nearest curb entrance within 45°. Desk footprint is 2.0 m. Exactly one security room holds every lane, and every departure path crosses it once. The R&D room exists. Arrival and departure paths are both valid. Ceilings are within ±10% of `STARTER_CAPACITY`. Plus a nav trace: the entrance queue reaches both lanes. | S1 overview from above. Check-in hall from the entrance doors. Security room from the BP podiums. | WP2 |
| 34: no leftovers, no floating objects | `orphanMesh.test.ts`. v1 (WP1): nothing from `planTerminal`, `buildInteriorDressing` or `TerminalBuilding` is under the hall root. v2 (WP4): every mesh maps back to a layout piece (floor, wall, door, fitting, belt, person); no bounding box sits above `ROOF_H_M`; belt meshes appear only on belt tiles. | Wide shot at High and at Ultra: no dark object above the roof, no stray belt bar, no catalog dump. | WP1, WP4 |
| 35: no passengers at start | `src/game/noPaxBeforeFirstFlight.test.ts`. New game: agent count is 0 every tick until the first show-up window opens, then it rises above 0. | Day 0 terminal at game start, empty. | WP1 |
| 36: no indoor jet bridge | `orphanMesh.test.ts`: no `jet_bridge` kind under the hall interior. `src/terminalbuild/sockets.test.ts`: bridge sockets sit on facade `gate_bridge` doors. | Facade with a bought bridge rooted on the outside wall. Interior with no bridge. | WP1, WP4 |
| 37: no vehicles indoors | `orphanMesh.test.ts`: no vehicle model under the hall interior. | Same interior shot. | WP1 |
| 38: security only in security | WP1: no shop room contains a security prop. WP2: `validate.test.ts`, a room-rule finding blocks a security-kit placement outside a security room, and the S1 and S2 data hold no security kit outside security. | Inside the airside and landside food units. | WP1, WP2 |
| 46: live inspector for every fitting | `src/ui/inspector/FittingCard.test.tsx`. Every fitting kind renders a card. Advancing the walk changes the queue and served text while the panel is open, without reselecting. Clicking a lane mesh selects that lane's id. | Two frames 1 game minute apart on a security lane card, showing different numbers. | WP5 |
| 39: pause freezes everything | `animClock.test.ts` plus a source scan. While paused, tray, belt, carousel, escalator and people transforms don't change across 60 frames. The scan fails on `performance.now` or `Date.now` in hall render code. | Two frames 2 s apart while paused. They are identical. | WP1 |
| Flow rules | `src/paxnav/stages.test.ts`: a traced departure hits every stage or a named skip, and boarding requires a gate-desk service. `arrivals.test.ts`: no arrival cell ever has `LANE` or `AIR`, and arrivals hit claim then the exit. `src/game/bagFlow.test.ts`: bags run from desk to `bag_out` and from `bag_in` to claim. `boardingMethod.test.ts`: stairs, bus and bridge each give a different route and duration. `src/paxnav/passport.test.ts`: domestic arrivals never visit a passport booth, international arrivals always do (before claim), and no departure, domestic or international, ever visits one. `validate.test.ts`: a booth on a landside, security or airside tile is a room-rule finding; an international flight with no staffed booth on its arrival path gets the blocking finding; with no international flight there is no finding. `vertical.test.ts` (WP6): `step_free` agents use only lifts, and escalators are one-way. | n/a | WP3, WP6 |

---

## 11. Work packages

These run in order, one cloud agent each, on Cursor's default models. The order follows the audit's runs: the size bug and the extra security room go first, the flow and the editor next, two floors last. Each WP is a PR into `main` (or into the playtest trunk, if the merge captain prefers), with `npm run gate` green and the gate summary pasted. Screenshots go to `docs/devlog/media/terminal-rebuild/wpN-*.png` and are taken by a script based on `scripts/terminal-r5-ingame.mts`. Every WP leaves the game playable.

### WP1: Gut the hall picture and get to one scale (audit runs 1 and 6)

- **Depends on:** nothing. It can run alongside fix-plan Batches B and D.
- **Does:**
  - Stop embedding `TerminalBuilding` / `planTerminal` and the dressing under `interiorGroup` in the hall camera, and stop the `fit.scale` parenting.
  - Remove the `rebuildRooms` early return, so the hall draws the walk's own layout through the metre-scale kit path: `hallKitMeshes`, and `hallKitDetail` with real size for every type and no `fitScale` shrink below 1. This one change makes placed kit appear and gives the hall one coordinate system, while still on the 8×5 layout.
  - People: `HallNavCrowd` plus `PeopleRenderer` only. Delete `HallFigureBatch` / `buildFigure` and `hallGuestScale`. Take the baked officers out of the `security_lane` and x-ray models; `HallServiceFx` draws them.
  - Delete `seedDayOneCrowd`, `tickPreviewGuest`, `retireDayOneCrowd` and `preview` guests.
  - Take `SupplyCartLayer` and any vehicle out of the hall scene.
  - Keep the PR #119 bag-drop kiosk, carousel and passport booth, and draw them at scale 1 through the kit path. That ends the `terminalHiDetail.ts` dressing that shrinks the kiosk and booth with `Math.min(1, fitScale(...))` and puts them in check-in. The booth then appears only where a player has built one in arrivals.
  - Add `src/render/interior/animClock.ts`. The sim advances `animSec` by `dt × speed`, which is 0 while paused, and trays and hall loops read it.
- **Files:** `src/render/hallWorld.ts`, `hallRooms.ts`, `hallKitDetail.ts`, `hallKitMeshes.ts`, `hallNavCrowd.ts`, `hallService.ts`, `terminalProps/props.ts`, `terminalProps/index.ts`, `src/game/sim.ts` (day-one crowd and `animSec`). New: `src/render/interior/animClock.ts`, `scaleAudit.test.ts` (v1), `orphanMesh.test.ts` (v1), `hallKitPlacement.test.ts`, `animClock.test.ts`, `src/game/noPaxBeforeFirstFlight.test.ts`. Edit `opening.test.ts`, `playtestFixes.test.ts` and `hallNavGuests.test.ts` wherever they assert the preview crowd.
- **Done when:** one person height (about 1.75 m) in the hall. No baked crowd, no catalog dump, no indoor bridge, no vehicle. A placed desk, lane, toilet and bench appears where it was put. No passengers at start. Pause freezes the hall.
- **Gate:** `npm run gate`, including the perf and people draw-call budget tests.
- **Screenshots:** starter hall overview at High and Ultra, a person beside a desk, a placed lane, the shop interior, two paused frames, and a person beside the bag-drop kiosk and the carousel at real size.
- **Items:** 3, 34, 35, 36, 37, 38, 39, and the "draws" half of 5.

### WP2: Layout document, starter instance, nav reads it, saves (audit run 2)

- **Depends on:** WP1, plus decisions D1, D2 and D3.
- **Does:**
  - Add the data model from section 4: 1 m tiles, floors, sides, door kinds, fittings with sockets and empty sockets (the growth slots), belts and ports, and the stage list as data.
  - Build the fitting catalog on `ItemDef` / `KIT_ITEMS` plus the `FOOTPRINTS` numbers. The catalog adds only geometry, side, stage, prop and inspector fields; prices are not forked. The bag drop, carousel and passport booth footprints are measured from the PR #119 builders (section 4.4). `passport_booth` is allowed only in the `claim` and `arrivals` zones (side `sterile_arr`). Its `KIT_ITEMS` entry already lists only `arrivals`, and the catalog adds `claim`.
  - Write the `split1f` and `stacked2f` data files.
  - Replace `SCHEME_I` / `zoneFor` / `prefabNavLayout` as the nav input. `commitHallItem` writes fittings onto the layout, and the WP1 kit renderer reads layout fittings.
  - Save schema 5 to 6 migration (section 9). Move the starter stamp to 4×2 cells.
- **Files (new):** `src/terminalbuild/scale.ts`, `fittings.ts`, `stages.ts`, `sockets.ts`, `migrate.ts`, `starter/split1f.ts`, `starter/stacked2f.ts`, `scripts/terminal-layout-dump.mts`. Tests: `scale.test.ts`, `fittings.test.ts`, `starter.test.ts`, `validate.test.ts` additions, `sockets.test.ts`, `migrate.test.ts`, plus fixtures in `src/features/save/fixtures/`.
- **Files (edit):** `src/terminalbuild/types.ts`, `config.ts` (per-m² prices, `STARTER_TERMINAL`), `floors.ts`, `validate.ts`, `index.ts`; `src/game/hallNav.ts`, `hallNavData.ts`, `types.ts` (`TerminalFit.layout`), `sim.ts` (`decorateFit`, `buildStarterKit`, `commitHallItem`); `src/game/starterLayout.ts` (4×2 stamp); `src/features/save/schema.ts`; `src/render/hallKitMeshes.ts` and `hallKitDetail.ts` (read fittings).
- **Done when:** security is one room, both lanes sit in it, and the entrance queue reaches them. The dump script prints the section 5 grids. Old saves load and run 1 day.
- **Gate:** `npm run gate`, and the 30-day soak completes at least as many flights as `main`.
- **Screenshots:** S1 overview, check-in from the entrance, the security room. Commit the dump output as `wp2-layout-dump.txt`.
- **Items:** 33, 38 (room rules).

### WP3: One flow graph, one passenger model, bags (audit run 3)

- **Depends on:** WP2, plus decision D4. The bag sockets connect to Batch D's bag sort if it has landed, otherwise to the current bag hall.
- **Does:**
  - PaxNav walks the stage data (section 6). Bag drop is its own stage, toilets are a real stop, and the gate-desk queue is required before boarding.
  - Retire the `tickHall` graph. Boarded, missed, satisfaction and spend come from walkers, and boarding by setting `dead` goes.
  - The boarding method comes from the stand as a route plus a duration on the boarding socket: stairs walk, bus with load capacity, or bridge. Arrivals come off the same method, from a bus or stairs door as well as the bridge.
  - Claim waits on the bag sequence number. `BagBook` gets the port transit legs, and `bag_out` / `bag_in` sockets go to logistics.
  - Passport control for international arrivals only (section 4.3). Add `flightIsIntl(flight)` to `src/pax/showup.ts` and route the existing `isIntlKind` callers in `sim.ts` and `src/ui/timetable/*` through it. Arrivals get the flag from their inbound flight. `PASSPORT` runs only when it is true, and the validator adds the two passport rules. No emigration stage.
- **Files:** `src/paxnav/paxnav.ts`, `config.ts`, `guests.ts`; new `src/paxnav/stages.ts`, `arrivals.ts`. `src/pax/showup.ts` (`flightIsIntl`), `src/ui/timetable/checkInGhost.ts`, `gameAdapter.ts`, `src/terminalbuild/validate.ts` (passport rules). `src/game/sim.ts` (`tickHall`, `openDepartingGuest`, `standPaxMode`, gate boarding), `hallNav.ts`, `hallArrivals.ts`, `guests.ts`, `hallRoute.ts`, `luggage.ts`, `src/logistics/adapter.ts`. Tests: `stages.test.ts`, `arrivals.test.ts`, `boardingMethod.test.ts`, `passport.test.ts`, `src/game/bagFlow.test.ts`, `starterWalk.test.ts` (S1 pushes 46 departures and 46 arrivals with no stuck agent).
- **Done when:** a traced departure hits every stage or a named skip. Arrivals hit claim, then the exit, and never touch security. International arrivals pass a passport booth first; domestic arrivals and all departures never do. Stand access changes the path, not just the thought.
- **Gate:** `npm run gate`. The 30-day soak completes at least as many flights as `main`, with wall time no more than 25% above `main`. Bot playtest `--quick` is green.
- **Screenshots:** gate-desk queue at boarding, a bus-stand departure leaving through the apron door, arrivals at the carousel, and a widebody's arrivals queueing at a passport bank in the claim hall.
- **Items:** flow rules, and the "serves" half of 5.

### WP4: One renderer from the layout, editor on sockets (audit runs 4 and 6)

- **Depends on:** WP3, and PR #114 merged.
- **Does:**
  - Add `src/render/interior/`:
    - `InteriorView.ts`: scene and camera, moved from `hallWorld.ts`.
    - `shell.ts`: floors, walls, doors and glazing from the layout, reusing `terminalProps/shell.ts` and `interiorBuild.ts`.
    - `fittings.ts`: `terminalProps` builders at scale 1, instanced per kind, with the round 5 desks on the check-in sockets and the PR #119 bag drop, carousel and passport booth with their full-resolution plates. The carousel builder takes its straight-run length as a parameter.
    - `people.ts`: the `HallNavCrowd` driver.
    - `picking.ts`.
  - The editor (`src/terminalbuild/interior.ts` `placeFitting`, `src/ui/InteriorBar.tsx` palette from the catalog) places on sockets and footprints. The palette keeps the `kitGlyph.tsx` glyphs. The passport booth is offered only on sterile arrivals tiles.
  - The facade bridge comes from `terminalSockets` through PR #114's rotunda.
  - Delete everything marked [WP4] in section 2, with its tests.
- **Files:** as listed, plus `src/ui/TerminalView.tsx` and `src/render/world/terminal.ts` (exterior shell from the layout footprint, `terminal-root` single scale). Tests: `placeEveryFitting.test.ts`, `scaleAudit.test.ts` v2, `orphanMesh.test.ts` v2, and an editor e2e (place a desk, see it serve, sell it, get the refund).
- **Done when:** a placed lane, desk, toilet and bench appears where it was put and serves. The starter hall matches the flow with no catalog leftovers.
- **Gate:** `npm run gate`, with no draw-call budget regression against `main`. Record the S1 interior draw-call count at Ultra in the PR.
- **Screenshots:** S1 at High and Ultra, a third desk and lane placed with the queue splitting, the facade bridge on the outside wall. Compare against `public/art/refs/pack6/` and the Gemini plates (D5). The bag drop, carousel and passport booth sit beside a person and next to their concept plate.
- **Items:** 5, 33, 34, 36.

### WP5: Live inspector for every fitting (audit run 5)

- **Depends on:** WP4. Use Batch B's right-hand inspector slot if it has landed.
- **Does:** add `src/ui/inspector/fittingCard.ts` (pure model) and `FittingCard.tsx`. The card subscribes with `useSyncExternalStore` to `hallNav.metrics()` through a `terminalVersion` counter that the sim bumps each tick, throttled to 4 Hz. Every fitting kind has a card with the fields in section 8. Meshes carry `userData.facilityId = fitting.id`, so clicking a lane shows that lane. `facilityInfo` is merged into the card. Walker selection uses the same slot.
- **Files:** new `src/ui/inspector/fittingCard.ts`, `FittingCard.tsx`, `src/game/terminalVersion.ts`; edit `src/render/interior/picking.ts`, `src/ui/BuildingPanel.tsx`, `src/App.tsx` (stop routing hall cards through `hudSnapshot`), `src/game/sim.ts` (`facilityReading`, `queueReading`). Tests: `FittingCard.test.tsx`, `fittingCard.test.ts`.
- **Done when:** the queue length moves while the panel is open. Every fitting kind, security included, has a real card.
- **Gate:** `npm run gate`.
- **Screenshots:** a security lane card, two frames 1 game minute apart; cards for a bag drop, a carousel and a gate desk.
- **Items:** 46.

### WP6: Two floors, stand-access meshes and the acceptance pass (audit run 7, plus the 2-story ask)

- **Depends on:** WP5 and D1. If D1 picks a 2-story starter, run this WP's nav and vertical half before WP4 instead, as WP3b.
- **Does:**
  - Multi-floor nav (section 6): per-floor grids, `ARR` and `STAFF` bits, links, Dial flow fields, `step_free` agents, the lift as a service point.
  - Stairs, escalator and lift fittings and editor tools, enabled when `stories === 2`.
  - A floor view: "Ground / Upper" pill, floors above hidden, floor below dimmed.
  - The upper-floor upgrade unlock and prices. Proposed: escalator $220k plus $60/day, stairs $40k plus $5/day, lift $120k plus $30/day.
  - Stairs and bus meshes on the boarding sockets, with remote-stand arrivals walking in from the bus door.
  - `docs/playtest/TERMINAL_REBUILD_ACCEPTANCE.md`, with before and after shots for every item.
  - Update `INTERIOR_EDITOR.md` and `TERMINAL_INTERIOR_BUILD.md` to the shipped state.
- **Files:** `src/paxnav/grid.ts`, `paxnav.ts`, `config.ts`; new `src/paxnav/vertical.ts`; `src/terminalbuild/interior.ts`, `floors.ts`, `config.ts`; `src/render/interior/floors.ts`, `fittings.ts`; `src/ui/TerminalView.tsx`, `InteriorBar.tsx`; `src/progression/unlocks.ts`, `src/levelgates/*`; `src/render/materials/*`. Tests: `vertical.test.ts`, `starterWalk.test.ts` (S2 case), plus a paxnav perf check (400 agents on S2 under 2 ms per tick in Node).
- **Done when:** the S2 upgrade can be bought and lived in. Arrivals descend a sterile stair to claim and never meet departures.
- **Gate:** `npm run gate`. The merge captain then runs `npm run gate -- --full` (150-day soak, every bot persona, browser smoke) before Trever re-checks.
- **Screenshots:** the upgrade bought on S1; S2 upper and ground floors in use; a passenger on the escalator; side by side with Gemini `terminal_multistory`.
- **Items:** the acceptance pass for 3, 5, 33–39 and 46.

---

## 12. How this fits the audit and the Oct 15 fix plan

| Audit run | This plan | Difference |
| --- | --- | --- |
| 1: hall camera, nav people only | WP1 | WP1 also un-hides the metre-scale kit path, so the hall is not an empty box between WP1 and WP4. It also does the day-one crowd, pause and indoor-vehicle fixes. |
| 2: layout document and starter instance | WP2 | Adds floors, sides, 1 m tiles, the stage list as data, the two starter layouts, save migration and the 4×2 stamp. |
| 3: shared flow graph | WP3 | The hall graph is retired rather than shared (D4). Adds bag ports and claim timing. |
| 4: editor writes sockets, renderer instances them | WP4 | Adds the `src/render/interior/` module and the PR #114 socket source. |
| 5: inspector on `hallNav.metrics()` | WP5 | Same. |
| 6: delete the dressing pass and legacy layers | Split: WP1 stops using them, WP4 deletes the files | Dead code goes once the new renderer replaces it, rather than in a separate final run. |
| 7 (optional): stairs and bus meshes | WP6 | Combined with the 2-story work. |

Fix-plan batches:

- **Batch C** (items 3, 5, 33, 34, 36, 37, 38) is replaced by WP1–WP6. Don't run Batch C.
- **Batch A:** items 35 and 39 move to WP1. Batch A keeps its other items (1, 12, 16, 22, 29).
- **Batch B:** item 4 (centred build bar) and the one-inspector rule stay with Batch B. WP5's card uses Batch B's right-hand slot.
- **Batch D:** the bag sort beside the terminal, the guard post and roads stay with Batch D. WP2 publishes the sockets and WP3 connects bags to them. The 4×2 starter stamp (D2) is agreed with Batch D before WP2.
- **PR [#114](https://cursor.com/codebase/hatchtag/hatchfield-game/pull/114):** must merge before WP4. WP4 switches its socket source to `terminalSockets`.

## 13. Risks

- **Balance shift when walkers become authoritative (D4).** Mitigation: WP3's soak comparison against `main`, and the bot playtest.
- **Soak runtime.** Mitigation: Dial flow-field caching and the WP6 perf check. WP3 fails above +25% wall time.
- **WP1's interim picture runs on the old 8×5 layout until WP2.** It is deliberately small, mostly switching layers off and un-hiding the metre-scale kit path. No new renderer code is written there that WP4 throws away.
- **Starter stamp change (D2) touches apron layout tests.** Mitigation: agree it with Batch D. WP2 owns the stamp edit.
- **WP3 and WP6 are the largest packages.** If an agent runs long, split at the natural seam and push the working half: WP3 into the flow graph and boarding methods, then bags; WP6 into floors and verticals, then stand-access meshes and the acceptance pass.
