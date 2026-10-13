# Hatchfield — Implementation build plan

**Stop planning-only. Ship code in this order.**  
North star: [VISION](./VISION.md) · Ops bible: [REAL_OPS](./REAL_OPS.md) · Wave board: [EXECUTION](./EXECUTION.md)

## Already shipped (do not re-litigate)

- E1 belt lite · E2 jam/stolen-slot · E2b Standing vocabulary  
- Jetway/remote/bus · T1–T5 · Field XP · loans · dual-path docs  

## Build order (execute top → bottom)

| # | Slice | Player feels | Status |
| --- | --- | --- | --- |
| **0** | Docs sync + this plan | — | **NOW** |
| **1** | **Bag units + premade ceilings + layover through-bags** | Mix matters; starter hall hits limits; transfers don’t claim | **SHIPPED** |
| **2** | Guard post tile + city cargo trucks → shed | Cargo has a journey | Next |
| **3** | Cargo start focus + kit + volume letter + warehouse meter | Cargo is a real start fantasy | Next |
| **4** | Fuel bowser capacity + farm stock refill contract | Manor Lords fuel picture | After 2–3 |
| **5** | Budget panel clarity + coach for kit/loan | Money readable | Parallel anytime |
| **6** | Screen building + loader GSE + C-ladder UI | Cargo midgame | After 3 |
| **7** | Intl zone · franchises · scenarios · mega-hub look | Scale | Late |
| **—** | Spaceport · full ACEO construction BOM | Expansion / never default | Parked |

## Slice 1 — shipped

1. ~~`bagUnits` on flights from PaxTag mix~~  
2. ~~Handling pay scales; claim jammed news when units > premade claim cap~~  
3. ~~Premade `capGuests` / `claimRate`; crowd slows claim~~  
4. ~~Layover through-transfer; claim fallback → Standing~~  
5. ~~`scripts/soak-bag-units.mts`~~

## Slice 2 — **next code session** (start here next)

1. `guard` tile on city road edge.  
2. Spawn city cargo trucks off-map → guard → cargo shed.  
3. New Game focus + cargo starter (shed, guard, cargo stand, no pax hall required).  
4. Volume letter + warehouse fill meter + On-time.

## Rules while building

- Money = picture.  
- No per-bag agents.  
- Field Level gates growth; research is specialty.  
- Keep AT3 first hour (kit still works).  
- Prefer deepening loops over new HUD games.

## Agent checklist each session

1. Read BUILD § current slice.  
2. Ship one vertical slice + soak.  
3. Update EXECUTION checkboxes.  
4. Commit/push `main`; leave Vite up.  
