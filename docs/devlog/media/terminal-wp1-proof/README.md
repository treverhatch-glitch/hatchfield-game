# Terminal rebuild WP1 proof clips

The real game in the Terminal view, recorded from the local dev server with `?playtest=1`, graphics Ultra, 1280×720. Each clip is 3 fps, H.264, no audio. Re-record with `npx tsx scripts/terminal-wp1-proof.mts`. That script also writes the stills in `docs/devlog/media/terminal-rebuild/wp1-*.png`.

The script fails instead of recording if the hall scene contains a node named for the jet bridge, a supply cart or the apron `TerminalBuilding`, or if `hall-root` and `hall-kit-detail` are missing. It also fails if any passenger is in the hall at the start, or 15 s into the empty clip. Green-shirted figures at the shops are retail clerks at their posts (hall crew), not passengers. The airline offer sheet is hidden while recording. Its offer stays pending, so no airline is signed and no flight comes in. That is why the passengers in clips 02 and 03 come from the `demoHallCrowd(16)` test hook on `window.__hatch` (also used by `terminal.test.ts` and the info-views e2e). They walk the real nav paths through the placed kit, but they are not a flight's show-up. Clip 01 is recorded before the hook runs.

| File | Length | What it shows | Playtest items |
| --- | --- | --- | --- |
| `01-empty-hall-before-first-flight.mp4` | 15 s | New pax game, starter kit stamped, speed 1. The hall stays empty (0 passengers) for the whole clip: there is no day-one crowd. Wide view at real metres: no dumped catalog props, no indoor jet bridge, no supply cart. | 35, 34, 36, 37 |
| `02-desk-lane-real-scale-then-pause.mp4` | 18 s | First 10 s: check-in desks at speed 1, with passengers at the counter and desk agents behind it, all the same adult height next to the 1.6 m counters. Then the camera moves to a security lane and the game pauses. The lane, scanner and tray belt are at scale 1, with no baked officers in the model, and nothing moves while paused. | 3, 5 (draws), 39 |
| `03-runway-burger-no-security.mp4` | 15 s | Runway Burger placed in retail, at speed 1. Inside the shop there are only counters, menu boards and its clerks, with hook passengers walking past. No x-ray, scanner or lane kit. | 38, 3 |

Stills (`docs/devlog/media/terminal-rebuild/`), as listed in the WP1 package:

| File | Shows |
| --- | --- |
| `wp1-overview-ultra.png`, `wp1-overview-high.png` | Starter hall at Ultra and High, 0 passengers |
| `wp1-person-desk.png` | Passenger at a check-in desk, agents behind it |
| `wp1-lane.png` | Placed security lane at scale 1 |
| `wp1-shop.png`, `wp1-burger.png` | Hatch Coffee and Runway Burger interiors, no security kit |
| `wp1-bagdrop.png`, `wp1-carousel.png` | Bag-drop kiosk and claim carousel (PR #119 props) at real size |
| `wp1-pause-a.png`, `wp1-pause-b.png` | Two paused frames 2 s apart. Every hall pixel is identical; the only difference is 3 pixels of HUD status text |

The tests behind each item are `src/render/scaleAudit.test.ts` (3), `src/render/hallKitPlacement.test.ts` (5), `src/render/orphanMesh.test.ts` (34, 36, 37, 38), `src/game/noPaxBeforeFirstFlight.test.ts` (35) and `src/render/interior/animClock.test.ts` (39).
