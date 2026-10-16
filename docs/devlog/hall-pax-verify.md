# Hall passenger verification (main `05153a4d1f54`)

Verification only. No game code was changed. Production build of current `main`, `vite preview` at `http://127.0.0.1:45217/?playtest=1`, Graphics High (shadow map 4096). New passenger game, starter kit stamped. A bag-drop kiosk was bought with the live place action (`$25,000` → `$18,000`). Clips are 1280×720, H.264, yuv420p, faststart, 12 fps, no audio.

Nothing below is a fix.

## Verdicts

| Item | Verdict |
| --- | --- |
| 1. Queue entry | **Broken** when a queue exists (`02-queue-entry.mp4` 0:02, `03-checkin-service.mp4` 0:03). **Works** when the queue is empty (`01-no-queue-to-service.mp4` 0:02–0:05): the passenger walks straight to the kiosk and does not follow the empty rails. |
| 2. Service points | **Broken.** Check-in (`03-checkin-service.mp4` 0:03), bag drop (`04-bag-drop.mp4` 0:04), and the security arch (`05-security-lane.mp4` 0:03). Passengers stand inside the desk, the bag-drop counter, and the walk-through arch. Nobody stands beside the carry-on belt and then walks through the arch. People also pass through rails and a wall. |
| 3. Clipping scan | **Broken.** 2.00 game days, 99,383 passenger positions. 61,372 overlaps of placed hall items and queue rails (11,313 with the body center inside the footprint). |
| 4. Arrivals | **Missing** as a filmed chain. The aircraft sits at the gate with no one leaving (`06-deboard.mp4`, whole clip). An empty bag truck drives up and parks (`07-bag-vehicle.mp4` 0:00–0:01). It is still at the aircraft in `08-inbound-sort.mp4`. No bags leave the hold, enter the truck, enter a sort building, or move onto the carousel. Claim shows static bags; nobody picks one up (`09-claim-and-pickup.mp4` 0:01 and 0:08). |

## 1. Queue entry

Empty queue. One departure with bags, no line yet. In `01-no-queue-to-service.mp4` he walks diagonally across the open floor to the self-check kiosk. The blue stanchions stay empty. From 0:04 to 0:07 he is standing inside that kiosk (see item 2). Pose track: `solo-1` stays `place -1` / phase `walk`, from about (-20.6, -19.6) to (-20.5, -13.1), aimed at the check-in row.

Queue present. Sixteen more departures. The kiosk line reached 5, then 8, and was serving. They do not enter at the back of the line and walk it in order.

- `02-queue-entry.mp4` 0:02. Camera is outside the south wall. A passenger in a white hat and purple top comes out of the wall, crosses the blue rail, and stands on it through 0:09. Others in the line also stand in the rails.
- `03-checkin-service.mp4` 0:03. Inside the hall. The front passenger (orange pants) is inside the check-in counter, a red jacket intersects a rail, and a purple top stands in the wall. The line runs beside the stanchions, not between them.

Pose track at the start of clip 02: kiosk place 6 (`q-4`) is at x=-23.1 while place 5 is already at x=-24.0, so that body is standing in an earlier slot, then slides back. Belt joiners (`q-2`, `q-12`) walk in from the open floor (z≈-11) and appear on a middle slot, not from the tail of the line.

## 2. Service points

Check-in desk. `03-checkin-service.mp4` 0:03, and again at 0:05. The person being served stands in the counter mesh. `q-11` holds service place 0 at (-20.5, -14.5) for the whole clip, which is the head cell of the kiosk line, on the counter.

Bag drop. `04-bag-drop.mp4` 0:00–0:07, called out at 0:04. A woman with a red bag and yellow pants stands inside the black-and-yellow bag-drop counter. She does not walk the blue stanchion line, which sits off to the side. `q-14` is service place 0 at (3.5, -14.5) for the whole clip. The clip is essentially static.

Security. `05-security-lane.mp4`. Camera is outside the west wall. From 0:00 to 0:03 a passenger in blue walks through the tan wall. From 0:02 to 0:09 a passenger in purple walks into the grey arch and stops there. There is no stop beside the carry-on X-ray belt and no second move through the arch. `q-11` is service place 0 at the lane head (-14.5, -1.5) for the whole 10 seconds. That cell is the middle of the security tile.

## 3. Clipping scan

Every passenger position for 2.00 game days (clock 64.12 → 424.21, one day = 180 s). Sample step 1/12 s. Movement between samples was tested every 0.12 m so a thin rail is not skipped. Body radius 0.2 m. 975 blocking boxes from placed hall solids and the queue posts/tape. 99,383 passenger-position samples.

A hit counts when the body center is inside a footprint, or the 0.2 m body overlaps it. Segment samples count center-inside only.

| Item | Overlaps | Center inside | Example |
| --- | ---: | ---: | --- |
| security_small `bundle-security_small-0-2` | 58,560 | 9,512 | `q-11` seat, (-15.45, -0.46), t=66.29, body |
| cafe `bundle-cafe-2-3` | 989 | 828 | `q-2` walk, (-9.59, -1.48), t=82.62, body |
| seat_row `bundle-seat_row-1-3` | 770 | 628 | `q-3` walk, (-15.51, 4.65), t=70.46, body |
| queue post | 583 | 39 | `q-2` queue, (-13.76, -14.20), t=64.21, body |
| newsagent `bundle-newsagent-1-4` | 234 | 194 | `q-6` walk, (-15.35, 8.91), t=83.29, body |
| queue tape | 88 | 3 | `q-12` queue, (-14.37, -13.83), t=64.21, body |
| security_small `bundle-security_small-4-2` | 62 | 52 | `q-2` walk, (0.75, -2.01), t=86.54, center |
| entrance `bundle-entrance-0-0` | 31 | 21 | `q-3` walk, (-20.51, -12.86), t=65.62, center |
| wayfinding `bundle-wayfinding-4-0` | 28 | 22 | `q-14` walk, (0.05, -11.05), t=68.46, center |
| toilet `bundle-toilet-4-1` | 15 | 13 | `q-14` walk, (-0.43, -10.60), t=68.54, center |
| kiosk `bundle-kiosk-1-0` | 12 | 1 | `q-8` walk, (-14.45, -12.54), t=66.79, body |

Total item + rail overlaps: 61,372, of which 11,313 are center-inside.

Shell walls were measured separately and are not in that total. `shell-wall`: 4 overlaps, 2 center-inside. Example: `q-14` walk, (-10.55, -4.23), t=69.37, body.

Queue geometry over the same window: 12,218 queue/service samples, 1,035 of them more than 0.55 m off the marked line. 32 joins landed on place 0 (empty line, straight to the service cell). 35 joins landed on place 1 or later; all 35 were more than 2.5 m from the painted tail of the lane, and 1 of those crossed a rail on the join step. The painted lane is longer than the occupied queue, so “far from the painted tail” includes people who appear on a slot near the head instead of walking from the back.

Full records: `docs/devlog/media/hall-pax-verify/clip-scan.json`.

## 4. Arrivals

Flight PDJ103, phase `deboard`, bag stage `unload_aircraft`, stand cell (11, 6). The bag truck’s mission was `unload` with `cargoUnits` 0 while these clips were shot. The wait after the truck clip never reached `sort_inbound`, `to_claim`, or `on_claim`. At the claim shot, luggage motion was belt on, carousel off, sort on, and the decorative hall bag parade was visible.

| Step | What the film shows | Verdict |
| --- | --- | --- |
| Passengers off the plane | `06-deboard.mp4`, 0:00–0:06. Airliner at the jet bridge. No person leaves the aircraft. Scene barely moves. | **Missing.** Jetway deboard is a timer. No apron walkers are drawn. |
| Bags off the plane | No bag leaves the hold in clip 06 or 07. | **Missing.** |
| Bags into a vehicle | `07-bag-vehicle.mp4` 0:00–0:01. A bag truck drives in and parks by the aircraft. The carts are empty. From 0:01 to 0:08 it sits. | **Missing** as a transfer. The truck is real and it drives. The bags are not put into it. Cargo count was 0. |
| Inbound sort | `08-inbound-sort.mp4`, whole 6 s. Same truck, still at the aircraft. No sort building, no belt. | **Missing.** The sort step was not reached. In the sim it is a dwell at the shed, then a stage change. |
| Bags onto the claim carousel | `09-claim-and-pickup.mp4`. Suitcases are already on the belt at 0:00. They do not arrive from a truck, and they do not travel onto the belt. | **Faked.** Static carousel bags plus the hall parade. `carousel` motion was off. The sim injects `on_claim` and sets the truck’s cargo to 0. |
| Passenger picks up the bag | Clip 09 at 0:01 and 0:08. People stand at the carousel, one of them at the belt edge. No bag leaves the belt. | **Missing** as an action. Pickup is a timer and the thought “Got my bag”, not a bag mesh leaving the carousel. |

## Clip paths

All under `docs/devlog/media/hall-pax-verify/`.

- `01-no-queue-to-service.mp4` (8.0 s) — empty queue, straight walk to the kiosk
- `02-queue-entry.mp4` (10.0 s) — queue entry from outside the south wall
- `03-checkin-service.mp4` (8.0 s) — check-in desk, inside the hall
- `04-bag-drop.mp4` (8.0 s) — bag-drop counter
- `05-security-lane.mp4` (10.0 s) — security arch and X-ray, from outside the west wall
- `06-deboard.mp4` (6.0 s) — aircraft at the gate, no deplaning
- `07-bag-vehicle.mp4` (8.0 s) — empty bag truck arrives and parks
- `08-inbound-sort.mp4` (6.0 s) — same truck still at the aircraft
- `09-claim-and-pickup.mp4` (10.0 s) — claim carousel, static bags, no pickup

Supporting files in the same folder: `clip-scan.json`, `layout.json`, `bag-hunt.json`, `bag-drop-place.json`, `probe.json`, and one `*.samples.json` beside each clip.

## Smallest fixes (not applied)

1. Queue. Let a passenger take a place only when they are within about a metre of the back of the people already in that line, then slide on the polyline with no lateral offset. Give the queue posts a blocking footprint so the route cannot cross the tape.
2. Desks and bag drop. Put the service cell on the public face of the counter, about a metre in front of the mesh, and block the counter solid.
3. Security. Stop treating the whole lane tile as walk-through. One stand cell beside the X-ray, one walk cell through the arch, and a block on the scanner housing and the lane wall.
4. Arrivals. Draw passengers at a jetway door, or keep the deboard timer from pretending people walked. Carry one bag mesh on the truck (the cargo count is assigned only when the unload dwell starts, and it was 0 while the truck drove). After the shed dwell, parent that mesh to the carousel instead of injecting `on_claim` and zeroing cargo. Remove that mesh when the owner is ready, instead of only setting the “Got my bag” thought.
