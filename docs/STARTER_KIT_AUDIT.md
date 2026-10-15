# Starter kit interior audit

Audited against `main` at `c17f68a`, after the hub dedicate picker and the concrete-stand merge. The hall scheme is unchanged from the furnishing pass. Passenger and hybrid share one prefab hall. Cargo has no hall. The three prefab schemes (`schemeItems` in `src/game/terminal.ts`) are the pre-designed terminals: I Linear, II Pier, III Satellites. The apron shell (`planTerminal`) dresses every hall, including the 3×3 starter. High and Ultra also drop the concept dressing from `1649715` (`buildInteriorDressing`): arrivals sign and claim carousel in check-in, a lounge cluster in the concourse, cubicles in the staff office, and the jet-bridge interior when the hall camera is close.

Ceilings stay the published Prefab I numbers (`STARTER_CAPACITY`): 46 passengers, two security servers, 37.5 per minute, 88 bag units, one staffed desk plus one kiosk. Bundle furniture does not add upkeep or raise those ceilings. The opening window is still 600 sim seconds. Lines are meant to show after that, not on the first bank.

## Must-haves on main

| Must-have | Where it lives now |
| --- | --- |
| Gate seating | Hall `seat_row`. Apron gate benches. High detail swaps benches for seat rows |
| Food counter | Hall `cafe`. Apron shop kiosk, tables, and stools. High detail uses the menu-band counters |
| Restrooms | Hall `toilet` (two on the prefab). Apron `wc` in check-in and in the shop. High detail draws a stall |
| Baggage claim belt | Hall `claim_carousel` and `bag_system`, plus a claim bench. High detail adds a carousel in the check-in room |
| Lounge | `rooms.lounge` is 1 on the starter fit, so a carrier can lease it. High detail draws `lounge_cluster` in the airside room. No lounge furniture item exists |
| Staff office | Apron shell splits one shop cell into office and lab. High detail draws `staff_office` cubicles |
| Jet bridge | Passenger and hybrid stands start as narrow concrete, rung 1, remote, with no bridge fitted. The player buys the bridge on the stand card. The hall still draws `jet_bridge` once a bridge is attached. Cargo is a heavy remote stand, rung 2 |
| Check-in with wayfinding | Hall `entrance`, `checkin_belt`, `kiosk`, `queue_rail`, `wayfinding`. Apron counters, belt, board, and stanchions. High detail adds `arrivals_sign` |
| Staffed general desk | One `checkin_belt`. It stays general until an airline's window opens, then the allocator brands it |
| Common-use desk | The same belt. `allocate` brands it to the airline whose window is open and shares it across that airline's flights |
| Dedicated desk | Player lock on a placed desk (`dedicateDesk`). A kiosk cannot be locked. The prefab does not pre-lock a desk |
| Self-service kiosk | Hall `kiosk`, always general. Apron check-in cells that do not face security get a kiosk prop |
| Security lanes | Two small lanes on tier I. Medium / large on II / III |
| Shop | Hall `newsagent` (souvenir) and the café. Apron shop cell |
| Signage / FIDS | Hall `wayfinding` and the apron departure boards. `info_screen` and `gate_pylon` stay out of the bundle: their comfort reaches the security row and softens a missed premium screen. `departures_wall` is field level 2 |
| Service bays | Stand (fuel, tug, bags, loader, catering), fuel farm (2), bag hall (2), cargo shed (1 loader) |

## What each kit was missing

### Passenger starter and Prefab I

The stamp is a 3×3 hall, curb on column 17, two medium concrete stands, bag belts, a bag hall, fuel farm, cargo shed, guard, fire station, tower, and a snack bar. The stands start with no jet bridge.

| Must-have | Before | After |
| --- | --- | --- |
| Gate seating | One bundle seat row. No claim bench | Seat row kept. Bench added beside the claim belt |
| Food counter | Café only | Café kept. No second food server, so shop-counter capacity stays put |
| Restrooms | One toilet. The room count already said two | Second toilet. Shop cell gains a restroom prop |
| Claim belt | Carousel and bag hall | Same, plus the bench |
| Lounge | Count of 1, no empty pier marked for it | Count of 1, and it is a lease target. Pier-end cells stay empty |
| Staff office | Apron office cell only | Unchanged. Cubicles come from the high-detail dressing |
| Jet bridge | Both stands jetway | Narrow concrete, no attachment. Buy the bridge on the stand card. Walk-out boarding still runs |
| Check-in + wayfinding | Doors, one desk, one kiosk, queue rail, two signs | Same pieces. Apron keeps the last desk slot empty and adds a kiosk off the security lane |
| Common-use / dedicated | Five check-in cells unused, with no note | Those cells are named spare desks. Branding runs on the one placed desk |
| Kiosk | Hall only | Hall kiosk, plus an apron kiosk on check-in cells that do not face security |
| Security | Two lanes, three unnamed empty cells | Two lanes. The cells between them stay empty |
| Shop | Souvenir room count, no newsagent | Newsagent on gate cell `(1,4)` |
| FIDS | Wayfinding only | Wayfinding plus apron boards. No comfort screens in the bundle |
| Service bays | Already on the buildings | Unchanged |

### Hybrid starter

Same hall and the same gaps as the passenger kit, plus a police post on the freight road. Same concrete stands, no bridge fitted, and the same service bays. The menu line now names desks, kiosk, lanes, shop, claim, and wayfinding.

### Cargo starter

No passenger hall, so the hall must-haves do not apply. One remote code-L freighter stand (no jet bridge). Fuel farm (two fuel bays), cargo shed (one loader bay), guard, fire, police, tower. No bag hall. The stand still carries the five apron service points. No hangar bay, so a hangar lease has nothing to name.

### Prefab II and III

Same furnishing pattern as tier I: newsagent, second toilet, claim bench, one desk, one kiosk. Security is the tier's own lane plus small lanes up to the published server count (3 and 4). Cells between those lanes and the exit stay empty.

## What changed

Hall scheme, all three tiers, still bundled so ceilings and upkeep stay put:

- Newsagent on gate cell `(1,4)`, clear of the player's stamp at `(2,4)` and the move target at `(5,4)`
- Second toilet, matching `rooms.bathroom`
- Bench beside the claim belt
- Café stays the only food counter

Apron shell (`planTerminal`):

- Each check-in row keeps its last desk position empty
- Check-in cells that do not face the screening door get a self-service kiosk off that lane
- The shop cell gets a second restroom

The starter fit already had `rooms.lounge = 1`. That room is a lease target on main (`dedicateHubFacility`), and both concrete stands are gate-lease targets. Nothing new is pre-leased.

## Slots left open

Prefab I coordinates. Tiers II and III keep the same pattern: check-in cells after the fifth piece, security cells between the placed lanes and the exit, and gate cells this furnishing does not use.

| Cell | Left open because |
| --- | --- |
| `(5,0)` `(0,1)` `(1,1)` `(2,1)` `(3,1)` | Spare desks. Placing them would raise the opening past one staffed desk and one kiosk. Common-use branding and dedicated locks already apply once the player drops a desk |
| `(1,2)` `(2,2)` `(3,2)` | Spare security lanes. Placing them would add servers past the published ceiling of 2 |
| `(7,3)` `(6,4)` `(7,4)` | Pier space beside the one lounge room. The lounge lease and the concourse cluster are already on main |
| `(3,4)` | The player's first retail stamp (`fast_food` or another café) |

Also not in the stamp:

- A hangar or heavy-check bay. Lounge and gate leases have a building. A hangar lease does not, until the player builds one
- `info_screen` and `gate_pylon` in the bundle (comfort reaches security)
- `departures_wall` (field level 2)
- A kitchen or a vehicle depot. Stand catering covers the opening. A depot would bill a building the first bank does not need

## After the hub and stand merges

Checked at 15:00 ICT on `c17f68a`.

The stand merge (`d88a6f6`) already set passenger and hybrid kits to two narrow concrete stands with no jet bridge, and the cargo kit to a heavy remote stand. The dedicate picker (`81e2a28`) leases desks, stands, lounges, and trucks. Spare check-in cells stay empty so the opening is still one staffed desk and one kiosk; the player places a desk before a lease can name it. Spare security cells and the pier-end lounge cells are unchanged. Ceilings stay 46 / 37.5 / 88.

J28 check-in theming and J25 interior dressing were already on main. No further hall furnishing went in with these merges.

## Checks

- `src/game/starterInterior.test.ts` — shipped pieces are in the scheme, the open cells stay empty, ceilings stay 46 / 37.5 / 88, the lounge and both gates are lease targets, and the three stamps keep their bays
- Opening soak, re-run on `c17f68a` — no nav bottleneck inside 600 sim seconds. Spare cells stay empty and the passenger stands stay remote concrete
- 30-day soak (`SOAK_STARTER=1`) — letters the desks can clear are signed; the rest are declined, because a refused letter stays on the desk and blocks the next one. The two placed desks plus the kiosk clear 22 passengers a minute, which is the smallest regional and not the next carrier (28). One carrier stays on the bank. No nav bottleneck inside the opening. Across the 30 days the first bottleneck was either absent or at 5399s (day 30)
- Browser stills in `docs/devlog/media/starter_kits/`
