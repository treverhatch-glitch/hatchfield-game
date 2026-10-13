# Hatchfield — Execution plan (active)

Working plan for expanding the game. Derived from [VISION](./VISION.md) + [NEXT](./NEXT.md). Update checkboxes as we ship.

## Principle

Deepen layout skill with **one reusable verb**: *broken chain → late job → heat/money hurt → fix → recover*.  
Pax belts teach it first; cargo landside copies it; emergencies steal capacity on the same apron.

## Wave order (execute in sequence)

| Wave | Goal | First ship slice | Status |
| --- | --- | --- | --- |
| **E1** | Pax layout skill | **Baggage belt lite** — stamp belt, bags↔stand↔terminal link, break = delay + heat | **SHIPPED** |
| **E2** | Readability | Congestion / stolen-slot feedback (news + Planner tint) | **NEXT** |
| **E3** | Cargo equality | Start focus + truck gate / screen (same broken-chain verb) | After E1 pattern solid |
| **E4** | Side seasons | Richer emergency pack + mil mission letters | Parallel once E1–E2 live |
| **E5** | Scale | Franchises, intl zone, scenarios | After layout verbs feel unfair-fun |

Parked: freeflow P2.5, Godot, custom wall painter, combat.

## E1 — Belt lite ✓

**Player-facing success test:** stamp a belt from hall → bag sort → stand; break it; see late bags + heat nick; reconnect; recover.

### Shipped

- [x] Apron tile `belt` (stamp in Terminal / Ops)
- [x] Connectivity: `bags` must belt-path to **stand** and to **terminal**
- [x] Broken chain → `boardingSlow` + heat dip + news; assignStand prefers linked bays
- [x] Starter kit paints a working belt stub (snack moved off the belt row)
- [x] World mesh (low conveyor strip) + soak-belt script
- [x] Docs: NEXT + this file

### Non-scope (later)

- Animated belt meshes / claim loop art  
- Multi-makeup hubs  
- Player-drawn hall bagdrop rooms rewriting graph  

## E2 — Readability (next)

1. News / HUD when apron walk congestion costs >N seconds.  
2. Planner tint or letter flag when a divert / emergency steals a slot.  
3. Keep feedback cheap — no full heat-map shader required for v1.

## Session cadence

1. ~~Ship E1 slice → playthrough smoke → commit/push.~~  
2. E2 readability before adding more systems.  
3. E3 cargo reuses belt BFS patterns (`cargo_gate` / `cargo_screen` later).
