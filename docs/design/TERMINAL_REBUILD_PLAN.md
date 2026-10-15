# Terminal interior rebuild plan

Status: plan only. No game code changes with this document.
Owner decision being executed: Trever, Oct 15, 8:06 PM. Gut the terminal interior and rebuild it with one scale, real flows and two stories.
Playtest items covered: 3, 5, 33, 34, 35, 36, 37, 38 and 46 from the Oct 15 list. Item 39 (pause) is covered too, because a requirement below depends on it.
Based on `main` at `68fde433`.

`docs/playtest/TERMINAL_AUDIT_OCT15.md` (agent bc-cf7345e0) was not on `main` or on any pushed branch when this was written. Every finding below comes from reading the code. If that audit lands later, the WP1 agent folds any extra findings into the delete list in section 2 before starting.

Related: [INTERIOR_EDITOR.md](./INTERIOR_EDITOR.md) (floor-ready schema), [TERMINAL_INTERIOR_BUILD.md](./TERMINAL_INTERIOR_BUILD.md) (Prison Architect editor), [STAND_UPGRADES.md](./STAND_UPGRADES.md) (stands and bridges), [../STARTER_KIT_AUDIT.md](../STARTER_KIT_AUDIT.md) (what the starter kit has to contain).

---

## 0. Owner decisions (answer these before WP3 starts)

| # | Decision | Recommendation | What it changes |
| --- | --- | --- | --- |
| D1 | **Starter story count.** Option S1: a 1-story starter that already separates arrivals from departures, with a 2-story upgrade in mid-game. Option S2: the starter ships 2-story. | **S1, then the S2 upgrade.** | One data file and one config value (`STARTER_TERMINAL`). The code is the same either way: every work package builds two-floor support. |
| D2 | **Starter footprint.** It goes from the 3×3 apron stamp (66×66 m) to 4×2 cells (88×44 m), with the long side facing the apron. | Approve. | Two code-C contact stands need about 40 m each of facade. 66 m fits only one and a half. The starter stamp's stands and roads shift. This touches Batch D's road work. |
| D3 | **Old saves.** The terminal interior is rebuilt on load. Player-bought fittings are refunded at purchase price, with a phone note. | Approve. | Without it, saves from before the rebuild need a fresh start. |
| D4 | **Walkers become the truth.** The passengers you see decide boarding, missed flights and mood. The sim's hidden hall model is retired. | Approve. | This fixes "placed fittings don't work" at the root. Balance moves, so the 30-day and 150-day soaks are the check. |
| D5 | **Gemini assets.** `bag_drop_kiosk`, `baggage_claim_carousel` and `passport_control` are on `main` in `public/art/textures/concepts/` (commit `f3ea5f90`, loaded by `src/render/servicePlates.ts`). `terminal_multistory`, `security`, `checkin_desk` and `gate_seats` are still missing. | Commit the missing four to the same folder and add them to `SERVICE_PLATES` before WP4. | WP4 and WP6 screenshot checks compare against these. Until they land, `public/art/refs/pack6/` is the target for those four. |
| D6 | **Apron unit.** The apron stays at `WORLD_PER_METER = 0.45`. The terminal is authored in metres and shown in the airport view under a single root scale node. | Approve. Moving the whole game to 1 unit = 1 m is a separate project. | Inside Terminal view, 1 unit = 1 m. Outside it, there is exactly one scale node, and the scale-audit test enforces that. |

Why S1 is recommended over a 2-story starter:

- A terminal capped at 46 passengers is single-storey in real life. Real regional terminals of about 4,000 m² keep arrivals and departures apart on one level, using a sterile claim hall and a one-way exit. S1 does the same, so arrivals still never pass security.
- The first hour is easier to read with no floor switching. The camera, the build bar and the inspector all work on one plane.
- Going 2-story becomes a visible mid-game milestone, which matches the existing "multi-story is a mid-game upgrade" decision.
- Risk: escalators, stairs and lift queues stay off the critical path of the first flight. They still ship and get tested in WP2. They are first played at the upgrade.
- Switching to S2 later costs only the starter data file (`stacked2f.ts`), its price, and one line in `STARTER_TERMINAL`.

---

## 1. What is wrong today (root causes found in code)

| Playtest item | Root cause | Where |
| --- | --- | --- |
| 3, 34: mixed scales, tiny props | Four coordinate systems are stacked in one view. The apron uses 22 m cells at `WORLD_PER_METER` 0.45. The hall is a fixed 48×32 m frame (`HALL_W` / `HALL_D`) with 6 m zone cells. The editor uses 4 m build tiles. `hallFitFor` squeezes each apron terminal into the 48×32 m frame with a variable `fit.scale`. High-detail props are then shrunk again to fit cells (`fitScale` in `terminalHiDetail.ts`, and `hallKitDetail.ts`). | `src/render/hallRooms.ts`, `src/game/terminal.ts`, `src/render/world/terminalHiDetail.ts`, `src/render/hallKitDetail.ts`, `src/terminalbuild/config.ts` |
| 3: people at different sizes | There are three people paths in the hall. Baked figures use `PERSON_SCALE` and `hallGuestScale(fit)`. Walkers use `PeopleRenderer`. Service staff use `HallServiceFx`. | `src/render/world/hallCrowd.ts`, `src/render/hallNavCrowd.ts`, `src/render/hallService.ts` |
| 33: security split across two rooms, backwards desk, no proper entrance | `planTerminal` chooses rooms per apron cell. Security is "the middle cell of depth row 1", with shop cells on both sides. The hall scheme `SCHEME_I` paints a security row six cells wide, places lanes in separate cells, and keeps "the last security cell" as an exit nobody walks. Desk yaw comes from the apron `airside` direction, not from the hall's own entrance. | `src/render/world/plan.ts` (`zoneFor`, `planTerminal`), `src/game/terminal.ts` (`SCHEME_I`, `securityLaneSpots`) |
| 35: passengers at game start | `seedDayOneCrowd()` spawns 12 preview guests on a new game. `planTerminal` also places static `pax` and `seated` people in every cell. | `src/game/sim.ts` (`seedDayOneCrowd`, `tickPreviewGuest`, `retireDayOneCrowd`), `src/render/world/plan.ts` |
| 36: jet bridge indoors | `HallWorld.placeJetBridge` builds a `jet_bridge` prop at the hard-coded east "jetway door" of the hall box. `buildInteriorDressing` also places a `jet_bridge` dressing. | `src/render/hallWorld.ts` (`placeJetBridge`, east-wall gap), `src/render/world/terminalHiDetail.ts` |
| 37: yellow vehicle indoors | Two non-fitting layers draw vehicles in the hall: `SupplyCartLayer` (stores carts) and the bridge dressing. Confirm which one with a screenshot in WP4. Both leave the interior root. | `src/render/supplyCart.ts`, `src/render/hallWorld.ts` |
| 38: security kit inside a shop | The back-office cell is cut out of a shop cell and gets an `xray` "R&D test rig". `HI_DETAIL_KIND` maps `xray` to `xray_machine`, and `kiosk` in shop cells to `menu_counter`. So the burger shop shows screening kit. | `src/render/world/plan.ts` (backoffice branch), `src/render/world/terminalHiDetail.ts` |
| 5: placed fittings don't work | The walk you see (`paxnav`) is only a picture. "Fares, ratings and boarding still come from the sim's own hall model" (`HallNode` graph in `game/guests.ts`, with counts in `TerminalFit.rooms`). Fittings placed in Terminal view go into a nine-room plan in hall metres (`terminalplay/footprints.ts`), which is not the layout the walkers read. | `src/game/hallNav.ts`, `src/terminalplay/*`, `src/game/sim.ts` hall guests |
| 46: inspector not live, no panel for security | `buildinginfo/card.ts` covers apron buildings only. Interior kit gets hover tooltips (`KitTooltip`, `WalkerTooltip`), not a selected-item card. Nothing subscribes to the sim tick. | `src/buildinginfo/*`, `src/ui/TerminalView.tsx` |
| 39: pause doesn't stop the screener | X-ray trays and several hall loops animate from `performance.now()`, not the sim clock. | `src/render/terminalProps/index.ts` (trays `onBeforeRender`), `src/render/hallWorld.ts` (lines ~535, 932, 1261, 1945, 2036, 2058) |

---

## 2. Delete and keep

### Delete (the WP that removes each one is in brackets)

| Path | What goes | Why |
| --- | --- | --- |
| `src/render/world/plan.ts` | `planTerminal` interior props, `people`, `walkers`, `zoneFor` cell zoning, the backoffice/R&D xray. Keep only an exterior footprint read, if the exterior shell still needs one. [WP4] | Cell-based fake interior (33, 35, 38) |
| `src/render/world/terminalHiDetail.ts` | Whole file: `HI_DETAIL_KIND`, `buildHiDetailProps`, `buildInteriorDressing` (arrivals sign, lounge cluster, office cubicles, jet-bridge dressing). [WP4] | Shrunk props and leftover decoration (3, 34, 36) |
| `src/render/world/hallCrowd.ts`, the `PERSON_SCALE` / `SEATED_SCALE` exports in `src/render/world/terminal.ts` | Second people path. [WP4] | One people renderer (3) |
| `src/render/hallRooms.ts` | `hallFitFor`, `apronToHall`, `hallToApron`, `hallGuestScale`, `poseOnPlan`. Move `matchTerminal` and `stampAnchor` (used by `sim.ts`) to `src/game/terminalMatch.ts`. [WP4] | The variable apron-to-hall scale (3) |
| `src/render/hallKitDetail.ts`, `src/render/hallKitMeshes.ts` | Per-item fit-scaled meshes. The catalog renders `terminalProps` builders at scale 1 instead. [WP4] | Shrunk desks (3, 33) |
| `src/render/hallWorld.ts` | Hard-coded hall box walls (west curb gap, east jetway gap), `placeJetBridge`, `TerminalBuilding` children in the hall, room meshes from `NODE_POS`, every `performance.now()` animation. Camera and picking move to `src/render/interior/`. [WP4] | 34, 36, 39 |
| `src/render/supplyCart.ts` in the hall | Removed from the interior scene. Stores restock becomes a staff walk to the shop's stock door. [WP4] | 37 |
| `src/terminalplay/` (all) | Footprints in hall metres, nine-room plan, lines, place, queues. [WP4] | Replaced by the catalog and the editor (5) |
| `src/game/terminal.ts` | `SCHEME_I/II/III`, `GRID_C`, `GRID_R`, `HALL_W`, `HALL_D`, `cellCenter`, `schemeItems`, `prefabBundle`, `PREFAB_I_OPEN`, `securityLaneSpots`, `zoneCellBlocked`. Service times, costs and upkeep move into the fitting catalog first. [WP3 moves the numbers, WP4 deletes] | 6 m cell scheme (33) |
| `src/game/hallNav.ts` | Prefab-to-4 m-tile conversion (painted zones read as a build layout). [WP3] | Walkers read the real layout |
| `src/game/sim.ts` | `seedDayOneCrowd`, `tickPreviewGuest`, `retireDayOneCrowd`, `preview` guests, and the `HallNode` hall-guest walk (`armGuestRoute`, the node routing). Aggregate fares and ratings read walker outcomes instead. [WP3] | 35, 5 |
| `src/game/guests.ts` | `NODE_POS`, `HALL_EDGES` and node routing. Keep the `PaxTag` colours and labels. [WP3] | One passenger model |
| `src/game/shellFloor.ts` | `FloorExtra` zone-column growth. The shell grows in whole apron cells through the layout instead. [WP4] | 6 m cell scheme |
| Tests on deleted code | `src/render/hallRooms.test.ts`, `hallKitDetail.test.ts`, `hallKitMeshes.test.ts`, `world/plan.test.ts`, `world/rooms.test.ts`, `world/terminalHiDetail.test.ts`, `terminalplay/terminalplay.test.ts`, `game/starterInterior.test.ts`, `game/shellFloor.test.ts`, `game/hallPathing.test.ts`. Rewrite, against the new model, the parts of `hallNav.test.ts`, `hallNavGuests.test.ts`, `hallArrivals.test.ts`, `opening.test.ts`, `servicePoints.test.ts`, `litter.test.ts`, `shellExpand.test.ts` and `playtestFixes.test.ts` that test real behaviour. [the WP that deletes the source] | |

### Keep and reuse

| System | Path | How it is used |
| --- | --- | --- |
| Queues and service points | `src/servicepoints/*`, queue logic in `src/paxnav/paxnav.ts` | Every fitting that serves someone is a service point: desk, kiosk, bag drop, BP podium, lane, gate desk, shop counter, WC, lift. |
| Prison Architect editor | `src/terminalbuild/*` (`layout.ts`, `interior.ts`, `validate.ts`, `grid.ts`, `floors.ts`), `src/render/interiorBuild.ts`, `src/ui/InteriorBar.tsx` | Foundation, walls, doors, zones and floor paint stay. Equipment becomes fittings with real footprints. Stairs, escalator and lift tools are added. |
| P1 passenger AI | `src/paxnav/guests.ts`, `guestConfig.ts`, `guestNames.ts`, `guestGlance.ts`, `crew.ts` | Names, traits, moods, needs, families, rebooking. Needs now pick stops from stage options (section 5). |
| Round 5 desks and staff art | `src/render/terminalProps/*` (`props.ts`, `parts.ts`, `shell.ts`, `interiorTex.ts`), `src/people/*`, `assets/people/originals/*` | Builders are already in metres with the origin at the floor centre. Render them at scale 1. Keep the `rbox` bevel prim and the two-desk check-in bank. |
| People renderer | `src/people/renderer.ts` (`PeopleRenderer`) | The only renderer for passengers, staff and crew indoors. |
| Phone feed | `src/phone/*` | Blocking findings and "terminal ready" notes go to the phone. No modals. |
| Stand and jet-bridge upgrade | `src/stands/*`, PR [#114](https://cursor.com/codebase/hatchtag/hatchfield-game/pull/114) (`src/render/aircraft/bridges.ts`, `src/render/world/airfield.ts`) | The bridge roots on the terminal facade socket. The new layout publishes those sockets from its gate-head doors (section 6). |
| Advisor reference | `src/terminaladvisor/*` | Untouched. Its multi-floor model already matches. |
| Interior textures | `public/art/textures/interiors/*`, `public/art/textures/signage/*` | Floor and wall paint, desk headers, wayfinding. |
| Gemini concept plates | `public/art/textures/concepts/*`, `SERVICE_PLATES` in `src/assets/manifest.ts`, `src/render/servicePlates.ts`, the bag-drop, carousel and passport-booth builders in `terminalProps/props.ts` | These are the visual targets for `bag_drop`, `claim_carousel` and `passport_booth`. The props move into the catalog. Their hooks in `hallKitMeshes.ts` and `terminalHiDetail.ts` go when those files are deleted. |

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

`PASSPORT` is an optional stage that runs only on international flights, served by a `passport_booth` (concept plate `passport_control`). The starter has none, and its slot is the claim hall's east wall. A matching outbound `EMIGRATION` stage after security is reserved in the graph but turned off until international departures exist.

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

### 4.4 Fittings at real size

`Fitting` replaces `Equip`:

```ts
interface Fitting { id: string; kind: FittingKind; x: number; y: number; floor: number; rot: 0|1|2|3; wear: number; staffed?: boolean; gateId?: string }
```

The catalog (`src/terminalbuild/fittings.ts`) is data. For each kind it holds: footprint, height, clearance in front, the rooms it may go in, the stage it serves, service time, servers, staff, cost, upkeep, wear rate, the prop builder, and the inspector fields. Costs and service times move over from `EQUIP_SPEC` and `ItemDef` (`src/game/terminal.ts`). Values for new kinds are proposed in WP1 and reviewed in its PR.

| Kind | Footprint w × d (m) | Height (m) | Audit range, height (m) | Room | Prop builder (`terminalProps`) |
| --- | --- | --- | --- | --- | --- |
| `checkin_desk` (desk, agent space, weigh belt, takeaway belt) | 2.0 × 2.6 | 1.1 counter, 2.4 header | 1.0–1.2 counter | checkin | `checkin_desk` (round 5 bank) |
| `checkin_kiosk` | 0.6 × 0.6, plus 1.2 clearance | 1.6 | 1.4–1.8 | checkin, landside | `self_checkin_kiosk` |
| `bag_drop` (self bag drop) | 1.6 × 2.4 | 1.6 | 1.3–1.8 | checkin | bag-drop kiosk builder (`f3ea5f90`); target: Gemini `bag_drop_kiosk` |
| `queue_rail` (per 1 m of rail) | 1.0 × 0.3 | 1.0 | 0.9–1.1 | checkin, security, gates | `stanchion_queue` |
| `bp_podium` (boarding-pass e-gate) | 1.0 × 2.0 | 1.1 | 1.0–1.6 | security | new |
| `security_lane` (divest, x-ray, scanner, recompose) | 4.0 × 10.0 | 2.3 scanner, 1.9 x-ray | 1.8–2.5 | security | `security_lane_ct`, `body_scanner`, `divest_station`; target: Gemini `security` |
| `gate_desk` | 2.4 × 1.2 | 1.1 | 1.0–1.2 | gates | `gate_podium` |
| `seat_row` (3 seats) | 1.95 × 0.75, row pitch 1.6 | 0.8 back, 0.45 seat | 0.4–0.5 seat | gates, airside, landside | `seat_row`, `gate_seating`; target: Gemini `gate_seats` |
| `bench` | 1.8 × 0.6 | 0.45 | 0.4–0.5 | any public | `seat_row` variant |
| `shop_counter` | 4.0 × 1.0 | 1.1 | 1.0–1.2 | retail | `shop_*`, `cafe_counter`, `menu_*` |
| `cafe_table` (4 seats) | 1.6 × 1.6 | 0.75 | 0.7–0.8 | retail (food) | `cafe_table` |
| `wc_block` (per cubicle, with basins) | 1.0 × 1.6 | 2.1 partition | 1.9–2.3 | toilets | `restroom_block`, `restroom_stall` |
| `claim_carousel` (flat plate, small) | 16.0 × 4.0 | 0.45 | 0.4–0.6 | claim | `baggage_carousel`; target: Gemini `baggage_claim_carousel` |
| `passport_booth` (2 officers) | 2.4 × 2.0 | 1.2 desk, 2.2 screen | 1.1–1.3 desk | claim, arrivals | passport booth bank (`f3ea5f90`); target: Gemini `passport_control` |
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

### 4.5 Belts and ports

```ts
interface BeltRun { id: string; floor: number; tiles: {x:number;y:number}[]; dir: 'out' | 'in'; incline?: { toFloor: number } }
interface Port { id: string; kind: 'bag_out' | 'bag_in'; edge: Edge; socket: string }  // socket: 'terminal:<hallId>:bag_out:<id>'
```

Belts are fittings drawn tile by tile. The validator treats them as a directed graph from desk or bag drop to `bag_out`, and from `bag_in` to the carousel. Belt tiles block walking.

---

## 5. Starter layouts

Both are 88 m × 44 m, which is 4×2 apron cells (D2). North (y = 0) is the apron facade with the stands. South (y = 44) is the curb. The bag sort building sits outside the west facade with its front facing the apron (Batch D). One character is 2 m. The scale is drawn along the top.

Legend: `+ - |` wall · `D` curb door · `A` apron gate door (stairs or bus) · `B` bridge socket door · `a` arrivals door (apron to sterile) · `X` one-way exit · `d` inside door · `g` gate-head door (opens while boarding) · `C` staffed check-in desk · `b` bag drop · `k` kiosk · `q` queue rail area · `S` built security lane · `s` empty lane slot · `p` boarding-pass podiums · `G` gate desk · `h` gate seats · `O` claim carousel · `=` belt · `o` bag_out port · `i` bag_in port · `E` escalator · `T` stairs · `L` lift · `#` stair core (solid below the run) · `:` growth slot · `W` landside WC.

### 5.1 S1: 1-story split-flow starter (recommended)

```
S1 ground floor (the only floor), 88 m x 44 m, 2 m per character
      0    1    2    3    4    5    6    7    8
  0m  +---aa------+--AA-------------------AA--+---+
  2m  |           |  d                        |   |
  4m  | BAG CLAIM NS dG hhhhhhh:::hhhhhhh  G  d   |
  6m  | (sterile) |  |  hhhhhhh:::hhhhhhh     dFD |
  8m  |           +--+  hhhhhhh:::hhhhhhh     d   |
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
| Baggage claim (sterile) | x 0–24, y 0–26 | 1 carousel 16 × 4. Claim feed belt from `bag_in` (west wall, y 14). Arrivals door `a` at x 8–12 on the apron facade. One-way exit `X` at x 20–24 into the hall. | Second carousel at y 18–22. Arrivals WC or shop along the east wall. |
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
 10m  | OOOOOOOOO    TT   d-----------------TT----+
 12m  i=OOOOOOOOO         d STERILE ARR CORRIDOR  |
 14m  |                   +-----------------------+
 16m  |                   |                       |
 18m  | :::::::::         |                       |
 20m  | :::::::::         | R&D  OFFICE  PLANT  WC|
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
| Baggage claim | 0 | x 0–40, y 0–26 | Carousel, plus a second-carousel slot. `bag_in` on the west wall. Gate 1's sterile stair lands here. Arrivals door `a` for stairs or bus arrivals. |
| Sterile arrivals corridor | 0 | x 40–88, y 10–14 | Gate 2's sterile stair lands here. Leads west into the claim hall. |
| Bus gate lobby | 0 | x 40–88, y 0–10 | Airside departures only. Bus doors `A` x 44–50 and x 64–70. Stair cores `#` are solid at ground level. |
| Arrivals hall | 0 | x 0–56, y 26–44 | Meeters, café slot. Exit `X` from claim at x 34–40. Curb doors at x 30–36. |
| Staff | 0 | x 40–88, y 14–26 | R&D, office, plant, staff WC. |

Both layouts are hand-written data files: `src/terminalbuild/starter/split1f.ts` and `src/terminalbuild/starter/stacked2f.ts`. A dump script, `scripts/terminal-layout-dump.mts`, prints these exact grids from the data. WP1 checks the printout against this section.

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

   The boarding method is read from the stand (`src/stands`). It is never stored on the gate.
7. **Arrivals.** At `DEPLANE`, agents spawn at the aircraft door, at the deplane rate in `BUILD_TUNING.deboardGapSec`. They walk the method's route to an `arrivals_in` door or a sterile gate-head stair. At `CLAIM`, a passenger waits at the carousel until the flight's `onClaim` counter passes their bag sequence number. Then they take the `exit` door to the curb.
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

- **Inspector (item 46).** A new pure model, `src/ui/inspector/fittingCard.ts`, and a view, `src/ui/inspector/FittingCard.tsx`. Every `FittingKind` has an inspector entry in the catalog. A test fails if one is missing. The card shows: name, status (working, no staff, worn out, not connected, closed), queue now, average wait over the last hour, served today, throughput per minute against capacity, wear, upkeep per day, staff, and the stage or flow it serves. Actions are staff or unstaff, repair, move, and sell. The card subscribes to a `terminalVersion` counter that the sim bumps each tick, throttled to 4 Hz with `useSyncExternalStore`. It never reads a one-time snapshot. Selecting a walker shows the existing P1 glance in the same right-hand inspector slot. Batch B's rule of one inspector at a time applies.
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
| Stands, bridges, boarding method | Unchanged (`src/stands/migrate.ts`). |

`TerminalFit` gains `layout: BuildLayout` (version 2) and drops `zones`, `items`, `floorExtra`, `build`, `interior`, `tier` and `redesigned` after migration. A test loads every fixture in `src/features/save/fixtures/`, migrates it, then runs 1 sim day with no throw and no finding that blocks flow.

---

## 10. Acceptance tests mapped to playtest items

| Item | Automated test (new file) | Screenshot check |
| --- | --- | --- |
| 3: one scale | `src/render/interior/scaleAudit.test.ts`. Builds every catalog kind and a person through `PeopleRenderer`. Checks the `Box3` against the catalog range and the footprint against the catalog footprint (±5%). No node under the interior root has a scale other than 1. Under the airport view, `terminal-root` is the only scaled node. | Close-up of a person beside a desk, a scanner and a gate seat. Crew and passengers look the same height. |
| 5: fittings work | `src/terminalbuild/placeEveryFitting.test.ts`. For every kind: place it in a valid room on S1, run a headless walk, and the fitting serves at least one agent (or moves one bag) within 30 sim minutes. The UI e2e places a desk and sees status "Working" plus a served count above 0. | Before and after placing a third desk and a third lane. The queue visibly splits. |
| 33: starter layout | `src/terminalbuild/starter.test.ts`. Curb entrance and exit doors exist. Each desk's front faces the nearest curb entrance within 45°. Desk footprint is 2.0 m. Exactly one security room, and every departure path crosses it once. The R&D room exists. Arrival and departure paths are both valid. Ceilings are within ±10% of `STARTER_CAPACITY`. | S1 overview from above. Check-in hall from the entrance doors. Security room from the BP podiums. |
| 34: no floating objects, no clutter | `src/render/interior/orphanMesh.test.ts`. Every mesh under the interior root maps back to a layout piece (floor, wall, door, fitting, belt, person). No bounding box sits above `ROOF_H_M`. Belt meshes appear only on belt tiles. | Wide shot at High and at Ultra: no dark object above the roof, no stray belt bar. |
| 35: no passengers at start | `src/game/noPaxBeforeFirstFlight.test.ts`. New game: agent count is 0 every tick until the first show-up window opens, then it rises above 0. | Day 0 terminal at game start, empty. |
| 36: no indoor jet bridge | `orphanMesh.test.ts` allow-list: no `jet_bridge` kind indoors. `src/terminalbuild/sockets.test.ts`: bridge sockets sit on facade `gate_bridge` doors. | Facade with a bought bridge rooted on the outside wall. Interior with no bridge. |
| 37: no vehicles indoors | `orphanMesh.test.ts`: no vehicle model indoors. | Same interior shot. |
| 38: security only in security | `src/terminalbuild/validate.test.ts`. A room-rule finding blocks a security-kit placement outside a security room. The S1 and S2 data contain no security kit outside security. | Inside the airside and landside food units. |
| 46: live inspector for every fitting | `src/ui/inspector/FittingCard.test.tsx`. Every kind renders a card. Advancing the sim changes the queue and served text without reselecting. | Two frames 1 game minute apart on a security lane card, showing different numbers. |
| 39: pause freezes everything | `src/render/interior/animClock.test.ts` plus the source scan. While paused, tray, belt, carousel, escalator and people transforms don't change across 60 frames. | Two frames 2 s apart while paused. They are identical. |
| Flow rules | `src/paxnav/stages.test.ts`: departures visit the stages in order. `arrivals.test.ts`: no arrival cell ever has `LANE` or `AIR`. `vertical.test.ts`: `step_free` agents use only lifts, and escalators are one-way. `src/game/bagFlow.test.ts`: bags run from desk to `bag_out`, and from `bag_in` to claim, on S1 and S2. | n/a |

---

## 11. Work packages

These run in order, one cloud agent each, on Cursor's default models. Each WP is a PR into `main` (or into the playtest trunk, if the merge captain prefers), with `npm run gate` green and the gate summary pasted. Screenshots go to `docs/devlog/media/terminal-rebuild/wpN-*.png` and are taken by a script based on `scripts/terminal-r5-ingame.mts`. Every WP keeps the game playable at merge.

### WP1: Scale, catalog and layout data (no visible change)

- **Depends on:** nothing. It can run alongside Batches A, B and D.
- **Files (new):** `src/terminalbuild/scale.ts`, `fittings.ts`, `stages.ts`, `sockets.ts`, `starter/split1f.ts`, `starter/stacked2f.ts`, `scripts/terminal-layout-dump.mts`. Tests: `scale.test.ts`, `fittings.test.ts`, `starter.test.ts` (data parts), `stages.test.ts` (graph validation), `sockets.test.ts`.
- **Files (edit):** `src/terminalbuild/types.ts` (adds `version`, `tileM`, `floors`, `Fitting`, `BeltRun`, `Port`, sides, door kinds), `config.ts` (per-m² prices, `STARTER_TERMINAL`), `floors.ts` (`ENABLED_STORIES = 2`), `validate.ts` (stage reachability, side and room rules, belt-to-port rules), `index.ts`.
- **Gate:** `npm run gate`. The dump script output matches the grids in section 5. Every catalog kind has a footprint, a height range, a prop builder (or `new` with a placeholder box at the right size), and an inspector entry.
- **Screenshots:** none. Commit the dump output as `docs/devlog/media/terminal-rebuild/wp1-layout-dump.txt`.

### WP2: Multi-floor stage walk (headless)

- **Depends on:** WP1.
- **Files (edit):** `src/paxnav/grid.ts` (per-floor cells, `ARR` and `STAFF` bits, links), `paxnav.ts` (stage stepping, Dial flow fields, mobility classes, side changes only at lanes and exits), `config.ts` (link speeds, lift car, escalator headway), `guests.ts` (needs feed the `*_FREE` stages).
- **Files (new):** `src/paxnav/stages.ts`, `arrivals.ts`, `vertical.ts`. Tests: `stages.test.ts`, `arrivals.test.ts`, `vertical.test.ts`, `starterWalk.test.ts`. The last one checks that S1 and S2 each push 46 departures and 46 arrivals through with no stuck agent after 4 nav hours, and lift queues form only when step-free demand exceeds the car.
- **Gate:** `npm run gate`, plus the paxnav perf check: 400 agents on S2 under 2 ms per tick in Node.
- **Screenshots:** optional heatmap PNG from `scripts/paxnav-heatmap.mts`.

### WP3: Sim wiring, bags, start state and saves

- **Depends on:** WP2, D3 and D4 answered, PR #114 merged. If Batch D's bag sort move has not landed, connect to the current bag hall building.
- **Files (edit):**
  - `src/game/sim.ts`: delete `seedDayOneCrowd`, `tickPreviewGuest`, `retireDayOneCrowd` and the `HallNode` guest walk. Spawn from booked flights only. Read walker outcomes.
  - `src/game/hallNav.ts`: read `fit.layout` and drop the prefab conversion.
  - `src/game/luggage.ts`: port transit legs.
  - `src/game/types.ts`: `TerminalFit.layout`.
  - `src/game/guests.ts`: drop `NODE_POS` routing.
  - `src/game/terminal.ts`: move service numbers into `fittings.ts`.
  - `src/features/save/schema.ts`: version 6.
  - The logistics bag socket hookup in `src/logistics/adapter.ts`.
  - The PR #114 socket source in `src/render/world/airfield.ts`, which reads `terminalSockets`.
  - The starter stamp moves to 4×2 cells, wherever the starter kit is stamped (`src/game/sim.ts` new-game seed and the `scenarios` data).
- **Files (new):** `src/terminalbuild/migrate.ts`, `src/game/terminalMatch.ts`. Tests: `src/game/noPaxBeforeFirstFlight.test.ts`, `src/game/bagFlow.test.ts`, `src/terminalbuild/migrate.test.ts`, and fixture saves in `src/features/save/fixtures/`.
- **Gate:** `npm run gate`. The 30-day soak shows completed flights at least equal to `main`, and soak wall time no more than 25% above `main`. Bot playtest `--quick` is green. Rewrite or delete the old tests listed in section 2 that this WP's deletions break.
- **Screenshots:** game start with an empty terminal (item 35). The old renderer still draws in this WP, fed by the new walkers.

### WP4: One renderer at one scale

- **Depends on:** WP3.
- **Files (new):** `src/render/interior/`:
  - `InteriorView.ts`: scene and camera, moved from `hallWorld.ts`.
  - `shell.ts`: floors, walls, doors and glazing per floor from the layout, reusing `terminalProps/shell.ts` and `interiorBuild.ts`.
  - `fittings.ts`: catalog kind to `terminalProps` builder at scale 1, instanced per kind.
  - `people.ts`: `PeopleRenderer` only, with y taken from the floor or the link progress.
  - `floors.ts`: active floor, floors above hidden, floor below dimmed.
  - `animClock.ts`, `picking.ts`.
  - Tests: `scaleAudit.test.ts`, `orphanMesh.test.ts`, `animClock.test.ts`.
- **Files (edit):** `src/ui/TerminalView.tsx` (mount `InteriorView`, floor pill "Ground / Upper" in a corner that never covers the hall), `src/render/world/terminal.ts` (exterior shell from the layout footprint, `terminal-root` single scale), `src/render/terminalProps/index.ts` (trays read `animSec`).
- **Files (delete):** everything marked [WP4] in section 2, with its tests.
- **Gate:** `npm run gate`, including the perf and people draw-call budget tests with no regression against `main`. Record the S1 interior draw-call count at Ultra in the PR.
- **Screenshots:**
  - S1 overview at High and Ultra.
  - Check-in from the entrance, with a person beside a desk.
  - The security room, showing one room and both lanes.
  - The inside of each food and shop unit (item 38).
  - The facade with no indoor bridge (items 36 and 37).
  - Two paused frames (item 39).
  - Compare against `public/art/refs/pack6/ref_terminal_props.jpg`, `ref_security_lane.jpg`, and the Gemini plates if D5 has landed.

### WP5: Editor fittings, verticals and the live inspector

- **Depends on:** WP4.
- **Files (edit):** `src/terminalbuild/interior.ts` (`placeFitting` with footprint, rotation, floor and room rules; `placeVertical`; `placeBelt`; `placePort`), `layout.ts`, `src/ui/InteriorBar.tsx` (fitting palette from the catalog with icons; a stairs, escalator and lift tool, enabled only when `stories === 2`), `src/render/interior/picking.ts`.
- **Files (new):** `src/ui/inspector/fittingCard.ts`, `FittingCard.tsx`, `src/game/terminalVersion.ts` (tick counter store). Tests: `src/terminalbuild/placeEveryFitting.test.ts`, `src/ui/inspector/FittingCard.test.tsx`, plus an editor e2e that places a desk, sees it serve, sells it and gets the refund.
- **Gate:** `npm run gate`.
- **Screenshots:** the inspector on a security lane, two frames 1 game minute apart. A third desk and a third lane placed, with the queue splitting (item 5). The inspector on a bag drop, a lift and a carousel (item 46).

### WP6: The 2-story upgrade, visual targets and acceptance pass

- **Depends on:** WP5 and D1. If D1 picks S2, this WP only flips `STARTER_TERMINAL` and sets the starter price.
- **Files (edit):** `src/progression/unlocks.ts` and `src/levelgates/*` (unlock "Upper floor" at the mid-game gate), `src/terminalbuild/config.ts` (upgrade build cost and upkeep, plus proposed vertical prices: escalator $220k plus $60/day, stairs $40k plus $5/day, lift $120k plus $30/day), `src/render/interior/shell.ts` and `src/render/materials/*` (finishes matched to the Gemini plates).
- **Files (new):** `docs/playtest/TERMINAL_REBUILD_ACCEPTANCE.md`, with before and after shots for items 3, 5, 33, 34, 35, 36, 37, 38, 39 and 46. Update [INTERIOR_EDITOR.md](./INTERIOR_EDITOR.md) and [TERMINAL_INTERIOR_BUILD.md](./TERMINAL_INTERIOR_BUILD.md) to the shipped state.
- **Gate:** `npm run gate`. The merge captain then runs `npm run gate -- --full` (150-day soak, every bot persona, browser smoke) before Trever re-checks.
- **Screenshots:** the upgrade bought on S1, with floor 1 slab and verticals. The S2 upper and ground floors, each lived in. A passenger riding the escalator. Arrivals descending a sterile stair. Side by side with Gemini `terminal_multistory`.

---

## 12. How this fits the Oct 15 fix plan

- **Batch C** (items 3, 5, 33, 34, 36, 37, 38) is replaced by WP1–WP6. Don't run Batch C.
- **Batch A:** items 35 and 39 are owned by WP3 and WP4. If Batch A lands first, those WPs keep its tests and remove any interim code.
- **Batch B:** item 4 (centred build bar) and the one-inspector rule stay with Batch B. WP5's card uses Batch B's right-hand inspector slot.
- **Batch D:** the bag sort beside the terminal, the guard post and roads stay with Batch D. WP3 publishes the `bag_out` and `bag_in` sockets Batch D connects to, and the 4×2 starter stamp (D2) is agreed with Batch D before WP3.
- **PR [#114](https://cursor.com/codebase/hatchtag/hatchfield-game/pull/114):** must merge before WP3. WP3 switches its socket source to `terminalSockets`.

## 13. Risks

- **Balance shift when walkers become authoritative (D4).** Mitigation: WP3's soak comparison against `main`, and the bot playtest.
- **Soak runtime.** Mitigation: Dial flow-field caching and the WP2 perf check. WP3 fails above +25% wall time.
- **Starter stamp change (D2) touches apron layout tests.** Mitigation: agree it with Batch D. WP3 owns the stamp edit.
- **WP3 and WP4 are the largest packages.** If an agent runs long, split at the natural seam and push the working half: WP3 into sim wiring and saves/bags, WP4 into shell and fittings and people/floors.
