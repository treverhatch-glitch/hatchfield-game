# Hatchfield — IMPORTANT: Manor Lords hand-offs

> **STATUS: DESIGN LAW — PROTECT THIS**  
> Owner brief (trial-run era): every traffic flow and every item that moves through the airport — **including inside the terminal** — must feel like a **real load / unload / service hand-off**, not a teleport or an instant flag flip.  
> Cross-links: [VISION](./VISION.md) · [DESIGN](./DESIGN.md) · [REAL_OPS](./REAL_OPS.md) · [BUILD](./BUILD.md)

---

## Why this exists

The fantasy is **planes being serviced** and **stuff actually passing through** the field **and the hall**:

**Apron / landside**

- Passengers deboard and board (you watch the process).  
- Bags unload / deposit / load.  
- Catering docks and clears.  
- Fuel bowsers bond and pump.  
- City cargo trucks screen, stage, uplift.  
- Terminal buses ferry.  
- De-ice sprays.  

**Terminal / hall (same law)**

- Check-in desk accepts bags (dwell).  
- Security screens people (queue + process time).  
- Claim delivers bags before pax clear.  
- Food / shop / lounge / amenities: order → wait → receive / spend.  
- Staffed desks, info, transfers: a body does work; guests don’t blink through rooms.  

If something important “just appears done,” the loop is wrong — same rule as **money = picture**.

This is the **Manor Lords** energy on an airport: timed, visible journeys and hand-offs at every choke, not spreadsheet ticks. **Apron and terminal use the same verb.**

---

## Design law (non-negotiable)

1. **No silent completion** — a service does not finish without a visible dwell and/or a mover finishing a path.  
2. **Hand-off at every join** — city→guard, guard→shed, shed→stand, stand→cabin, cabin→claim, curb→hall→gate→plane, farm→bowser→wing, **and inside the hall:** entrance→check-in→security→gate, claim→exit, amenity serve beats.  
3. **Duration scales with load** — bag units, pax count, ULD/freight units, fuel volume, cater level, **security wear / desk staffing / amenity ticket size**. Bigger job = longer picture.  
4. **Aggregate, don’t agent-spam** — bag *units*, crate meshes, passenger clusters / hall guests — not 200 suitcase AIs or per-fry cooks.  
5. **Broken chain hurts Standing / On-time / Happiness / money** — late or missing hand-off is the teacher (apron *or* hall).  
6. **AT3 first hour still works** — dwells stay readable at 3x/5x; never soft-lock the first landing.  
7. **Terminal = same picture** — hall rooms are service stations with travel + dwell + clear, not teleporters between graph nodes.

---

## System note — what “a hand-off” means in code

Every transported thing (and every hall service) should be modeled as a short pipeline:

```
STAGE → TRAVEL → ARRIVE DWELL (load/unload/service) → CLEAR → NEXT STAGE
         ▲                         ▲
  path on tiles /              preDwell / dwell / bagDepositLeft /
  hall room graph              bagWorkSeconds / serve timers / queue
```

| Layer | Responsibility |
| --- | --- |
| **Flight / job / guest stage** | What is needed next (`bagStage`, posted fuel/cater/bags, cargo warehouse, board/deboard, guest `node` + serve timers) |
| **Mover** | Truck / bus / walker / **hall guest** that *carries* the picture |
| **Visible load** | `cargoUnits`, crates, pax meshes, bowser fullness; in hall: queue at desk, deposit progress, claim wait thoughts |
| **Timer** | `preDwell`, `dwell`, `bagDepositLeft`, security/amenity serve clocks — scaled by units / staffing / wear |
| **Pay / Standing / Happiness** | Posts when the hand-off *picture* finishes — never on room-enter alone |

**Anti-patterns (ban these):**

- `posted.X = true` with no truck/guest dwell  
- Money earned when a letter is accepted for work that never moved  
- Freight / bags / fuel “warping” onto the stand  
- Instant board/deboard with no people or bus picture  
- **Hall: guest enters food/shop/security/check-in and instantly clears needs with no dwell**  
- **Hall: claim clears bags before the inbound cart picture hit `on_claim`**  
- **Hall: unstaffed desk that still “serves” at full speed with no wait picture**

---

## Coverage map — every flow that must feel serviced

### Passengers (apron ↔ hall)

| Step | Picture (target feel) | Live today (approx) |
| --- | --- | --- |
| Deboard | Jetway stream / bus ferry / walkers leave aircraft | Partial — mode timers + pax meshes / bus |
| Hall arrive path | Claim wait until bags on claim; amenities | Partial — claim gated on `bagStage` |
| Board | Hall → gate → jetway/bus/walk onto aircraft | Partial — boarding clocks + movers |
| Missed board | Visible late / Standing nick | Live |

### Terminal / hall processes (**same Manor Lords law**)

| Step | Picture (target feel) | Live today (approx) |
| --- | --- | --- |
| Arrive landside | Enter entrance; path to check-in / claim / transfer | Partial — room graph travel |
| **Check-in / bag drop** | Queue or desk dwell; bags accepted onto belt (deposit timer) | Live deposit dwell (`bagDepositLeft`) — deepen queue when unstaffed |
| **Security choke** | Line + screen process time; wear slows / threats | Partial — clearance flag; deepen visible process dwell |
| **Gate hold / board call** | Wait at gate with boarding clock; then exit to apron mode | Partial — boarding need + route |
| **Baggage claim** | Wait until flight `on_claim`; then pick-up dwell → exit | Partial — wait gated; deepen pick-up dwell |
| **Food / shop / lounge / play** | Arrive → order/serve dwell → pay → need drops | Thin — often near-instant serve; **must match hand-off law** |
| **Info desk** | Short help dwell; then longer lookahead | Thin |
| **Transfer / layover** | Airside stay; through-bags skip claim; amenity dwells still count | Partial through-bags |
| **Staff posts** | Empty desk = wait / anger picture, not silent skip | Partial (`staffedPost`) |
| **Wear / scrub** | Dirty WC/security slows process (longer dwell) | Partial wear; tie to serve time |

Hall rule of thumb: **entering a room starts a service beat; leaving means the beat finished.** Needs and cash change on **clear**, not on collide-with-node.

### Bags (apron + terminal join)

| Step | Picture | Live today |
| --- | --- | --- |
| Check-in deposit | Pax dwell at desk; units accumulate | Live (`bagDepositLeft`) |
| Outbound sort / load | Cart makeup → stand dwell → crates | Live (scaled dwell + crates) |
| Inbound unload → sort → claim | Ramp dwell → process → assigned claim | Live (stages + claim lanes) |
| Claim pick-up | Guest dwell at carousel after `on_claim` | Thin — deepen |
| Through-transfer | Airside skip claim | Live |

### Catering / cleaning

| Step | Picture | Live today |
| --- | --- | --- |
| Cater truck dock | Travel + stand dwell; trays “clear” | Partial — truck mission; deepen visible load |
| Cabin clean | Timed service on stand | Live fee; deepen picture |

### Fuel

| Step | Picture | Live today |
| --- | --- | --- |
| Farm bottom-load | Bowser preDwell at farm | Partial |
| Pump at wing | Stand dwell | Partial |
| Empty → reload | Return farm; stock capacity | **Slice 4 target** — real tank/stock |

### Cargo landside

| Step | Picture | Live today |
| --- | --- | --- |
| City truck → guard screen | Edge travel + screen dwell | Live |
| Guard → shed deliver | Travel + unload dwell → warehouse | Live |
| Shed → freighter uplift | Stock consume + stand dwell | Live basic |
| Screen building / loaders | Extra choke + ULD picture | Later slices |

### Other GSE / traffic

| Step | Picture | Live today |
| --- | --- | --- |
| Terminal bus ferry | Depot ↔ remote stand dwell | Live |
| De-ice | Pad → spray dwell | Live |
| Guard / police / fire response | Path + dwell (when used) | Thin |
| Contractors (builds) | City → guard → site work | Briefed / not default |

---

## Player-facing feel (acceptance test)

A player at **1x–3x** should be able to answer without opening a spreadsheet:

**Apron**

1. Is that plane still unloading passengers or bags?  
2. Is catering actually at the door?  
3. Are city trucks stuck at the guard?  
4. Is the warehouse filling before the freighter?  

**Terminal**

5. Are people actually checking in / dumping bags, or blinking past the desk?  
6. Is security a real choke (wait), or a free teleport airside?  
7. Are claim guests waiting on the cart picture?  
8. Does food/shop/lounge take a beat before money and needs move?  

**Either**

9. Why is this turn / guest late — which hand-off is thin?

If they cannot see *which* hand-off is late, the picture failed.

---

## Implementation rules for agents

1. When adding any new transported good, **hall service**, or amenity, ship **travel + dwell + visible load/queue + pay-on-clear** in the same slice.  
2. Prefer extending `Truck` / guest dwell / `bagStage` / serve timers over new HUD minigames.  
3. Scale timers from existing helpers (`bagWorkSeconds`, unit counts, pax, staffing, wear).  
4. Hall: put serve clocks on check-in, security, claim pick-up, and spend nodes — mirror bag deposit.  
5. Update this coverage table when a row goes from Partial → Live.  
6. Do **not** “optimize away” dwells for speed — use sim speed (3x/5x) instead.  
7. Cross-check [REAL_OPS](./REAL_OPS.md) so hand-offs match real pipelines (landside *and* terminal).

---

## Priority vs build board

This is a **cross-cutting law**, not a single BUILD slice.  

- Already strongest on **bags** (incl. check-in deposit) and **city cargo**.  
- **Terminal amenity / security / claim pick-up dwells** are explicit gaps — deepen on playtest pain or alongside readability work.  
- Next apron deepen: **slice 4 (fuel capacity)** + board/deboard/cater polish.  
- Never mark a service “done” in code review if the hand-off picture is missing — **hall included**.

**Owner note:** Trial runs should judge the field by whether turns *and terminal flows* look serviced. Gaps found in play → fix hand-offs before adding new systems.
