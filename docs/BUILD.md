# Hatchfield — Implementation build plan

**Stop planning-only. Ship code in this order.**  
North star: [VISION](./VISION.md) · Ops bible: [REAL_OPS](./REAL_OPS.md) · Wave board: [EXECUTION](./EXECUTION.md)

> **IMPORTANT:** [HAND_OFFS.md](./HAND_OFFS.md) — Manor Lords load/unload on every service, **including terminal** (check-in, security, claim, amenities). New movers/serves must ship travel + dwell + visible load/queue + pay-on-clear. Cross-cuts all slices.

## Already shipped (do not re-litigate)

- E1 belt lite · E2 jam/stolen-slot · E2b Standing vocabulary  
- Jetway/remote/bus · T1–T5 · Field XP · loans · dual-path docs  

## Build order (execute top → bottom)

| # | Slice | Player feels | Status |
| --- | --- | --- | --- |
| **0** | Docs sync + this plan | — | **NOW** |
| **1** | **Bag units + premade ceilings + layover through-bags** | Mix matters; starter hall hits limits; transfers don’t claim | **SHIPPED** |
| **1b** | **Full bag journey + claim scheduling** | Check-in deposit → process → plane; inbound unload → process → assigned claim | **SHIPPED** |
| **2** | Guard post tile + city cargo trucks → shed | Cargo has a journey | **SHIPPED** |
| **3** | Cargo start focus + kit + volume letter + warehouse meter | Cargo is a real start fantasy | **SHIPPED** |
| **4** | Fuel bowser capacity + farm stock refill contract | Manor Lords fuel picture | **NEXT** |
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

## Slice 1b — shipped

1. ~~Bag flow stages on flight (deposit → sort → load → inflight → unload → sort → claim)~~  
2. ~~Inbound **claim lane** assigned when the slot is banked (and on divert spawn); only arrivals use claims~~  
3. ~~Check-in **deposit dwell** by PaxTag bag weight~~  
4. ~~Truck load/unload/process dwells scale with `bagUnits`; crate mesh on carts~~  
5. ~~Arrivals only clear `needs.bags` when flight is **on claim**~~  
6. ~~Activity / Planner show claim + stage~~  
7. ~~`scripts/soak-bag-journey.mts`~~

## Slice 2 — shipped

1. ~~`guard` tile on city road edge (stamp + starter kit)~~  
2. ~~City cargo trucks: edge → guard screen dwell → shed deliver → depart~~  
3. ~~Warehouse stock meter; intake fee; freighter uplift consumes stock / late if thin~~  
4. ~~Missing guard → deny / unscreened incident + On-time dips~~  
5. ~~`scripts/soak-city-cargo.mts`~~

## Slice 3 — shipped

1. ~~New Game focus: Passengers / Cargo / Hybrid (Land screen)~~  
2. ~~Cargo starter kit — strip, freighter stand, guard → shed, no pax hall~~  
3. ~~Volume letters — stage N units through shed for fee + On-time + XP~~  
4. ~~Warehouse % + volume progress on HUD; offer bias by focus~~  
5. ~~`scripts/soak-cargo-start.mts`~~

## Slice 4 — fuel picture (**coding next**)

1. Bowser tank capacity + farm stock.  
2. Refill contract / bulk buy.  
3. Visible empty bowser → farm reload (already partially live).

## Rules while building

- Money = picture.  
- **Hand-offs = picture** ([HAND_OFFS](./HAND_OFFS.md)) — no silent `posted.X = true`.  
- No per-bag agents.  
- Field Level gates growth; research is specialty.  
- Keep AT3 first hour (kit still works).  
- Prefer deepening loops over new HUD games.

## Agent checklist each session

1. Read BUILD § current slice.  
2. Ship one vertical slice + soak.  
3. Update EXECUTION checkboxes.  
4. Commit/push `main`; leave Vite up.  
