# Hatchfield — IMPORTANT: Manor Lords hand-offs

> **STATUS: DESIGN LAW — PROTECT THIS**  
> Owner brief (trial-run era): every traffic flow and every item that moves through the airport must feel like a **real load / unload / service hand-off**, not a teleport or an instant flag flip.  
> Cross-links: [VISION](./VISION.md) · [DESIGN](./DESIGN.md) · [REAL_OPS](./REAL_OPS.md) · [BUILD](./BUILD.md)

---

## Why this exists

The fantasy is **planes being serviced** and **stuff actually passing through** the field:

- Passengers deboard and board (you watch the process).  
- Bags unload / deposit / load.  
- Catering docks and clears.  
- Fuel bowsers bond and pump.  
- City cargo trucks screen, stage, uplift.  
- Terminal buses ferry.  
- De-ice sprays.  

If something important “just appears done,” the loop is wrong — same rule as **money = picture**.

This is the **Manor Lords** energy on an airport: timed, visible journeys and hand-offs at every choke, not spreadsheet ticks.

---

## Design law (non-negotiable)

1. **No silent completion** — a service does not finish without a visible dwell and/or a mover finishing a path.  
2. **Hand-off at every join** — city→guard, guard→shed, shed→stand, stand→cabin, cabin→claim, curb→hall→gate→plane, farm→bowser→wing, etc.  
3. **Duration scales with load** — bag units, pax count, ULD/freight units, fuel volume, cater level. Bigger job = longer picture.  
4. **Aggregate, don’t agent-spam** — bag *units*, crate meshes, passenger clusters / hall guests — not 200 suitcase AIs.  
5. **Broken chain hurts Standing / On-time / money** — late or missing hand-off is the teacher.  
6. **AT3 first hour still works** — dwells stay readable at 3x/5x; never soft-lock the first landing.

---

## System note — what “a hand-off” means in code

Every transported thing should be modeled as a short pipeline:

```
STAGE → TRAVEL → ARRIVE DWELL (load/unload/service) → CLEAR → NEXT STAGE
         ▲                         ▲
    path on tiles            preDwell / dwell / bagWorkSeconds-style timer
```

| Layer | Responsibility |
| --- | --- |
| **Flight / job stage** | What the turn needs next (`bagStage`, posted fuel/cater/bags, cargo warehouse, board/deboard clocks) |
| **Mover** | Truck / bus / walker / hall guest that *carries* the picture |
| **Visible load** | `cargoUnits`, crates on carts, pax meshes, fuel bowser fullness (target) |
| **Timer** | `preDwell` (makeup/farm prep), `dwell` (at aircraft / post / shed), scaled by units |
| **Pay / Standing** | Posts when the hand-off *picture* finishes — never on spawn alone |

**Anti-patterns (ban these):**

- `posted.X = true` with no truck/guest dwell  
- Money earned when a letter is accepted for work that never moved  
- Freight / bags / fuel “warping” onto the stand  
- Instant board/deboard with no people or bus picture  

---

## Coverage map — every flow that must feel serviced

### Passengers (apron ↔ hall)

| Step | Picture (target feel) | Live today (approx) |
| --- | --- | --- |
| Deboard | Jetway stream / bus ferry / walkers leave aircraft | Partial — mode timers + pax meshes / bus |
| Hall arrive path | Claim wait until bags on claim; amenities | Partial — claim gated on `bagStage` |
| Board | Hall → gate → jetway/bus/walk onto aircraft | Partial — boarding clocks + movers |
| Missed board | Visible late / Standing nick | Live |

### Bags

| Step | Picture | Live today |
| --- | --- | --- |
| Check-in deposit | Pax dwell at desk; units accumulate | Live (`bagDepositLeft`) |
| Outbound sort / load | Cart makeup → stand dwell → crates | Live (scaled dwell + crates) |
| Inbound unload → sort → claim | Ramp dwell → process → assigned claim | Live (stages + claim lanes) |
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

1. Is that plane still unloading passengers or bags?  
2. Is catering actually at the door?  
3. Are city trucks stuck at the guard?  
4. Is the warehouse filling before the freighter?  
5. Why is this turn late — which hand-off is thin?

If they cannot see *which* hand-off is late, the picture failed.

---

## Implementation rules for agents

1. When adding any new transported good or service, ship **travel + dwell + visible load + pay-on-clear** in the same slice.  
2. Prefer extending `Truck` / guest dwell / `bagStage`-style enums over new HUD minigames.  
3. Scale timers from existing helpers (`bagWorkSeconds`, unit counts, pax).  
4. Update this coverage table when a row goes from Partial → Live.  
5. Do **not** “optimize away” dwells for speed — use sim speed (3x/5x) instead.  
6. Cross-check [REAL_OPS](./REAL_OPS.md) so hand-offs match real pipelines.

---

## Priority vs build board

This is a **cross-cutting law**, not a single BUILD slice.  

- Already strongest on **bags** and **city cargo**.  
- Next deepen while shipping **slice 4 (fuel capacity)** and any board/deboard/cater polish that falls out of playtests.  
- Never mark a service “done” in code review if the hand-off picture is missing.

**Owner note:** Trial runs should judge the field by whether turns *look* serviced. Gaps found in play → fix hand-offs before adding new systems.
