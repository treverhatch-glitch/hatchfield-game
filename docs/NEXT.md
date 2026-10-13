# Hatchfield — Next steps / development

Ordered plan. Ship top-down. Update checkboxes when merged.

**North star:** [VISION.md](./VISION.md). Ideas backlog: [IDEAS.md](./IDEAS.md). Progression: [PROGRESSION.md](./PROGRESSION.md).

## Now (solidify strategy)

- [x] Jetway / remote stands + terminal bus + walk congestion
- [x] Faster jetway turns → hall dwell/spend bonus
- [x] CS2 chrome (bottom menus, letter inbox)
- [x] 5x speed + inspect off + apron perf (mapRev, ghost cache, lite shadows)
- [x] Organized docs (`docs/*`)
- [x] Airline tiers T1–T5 panel + Field XP + multi-loan bank desk
- [x] Vision pass — emergency / mil / cargo dual-path documented + cross-linked
- [x] **Belt lite (Wave B.1 / E1)** — paint bag path; broken = late bags + Standing *(see [EXECUTION](./EXECUTION.md))*
- [x] Make congestion **readable** — news + HUD jam line when a neck costs ~8s *(E2)*
- [x] Player vocabulary — Standing / On-time / Jam (not “heat”) *(E2b)*
- [ ] Coach / Economy discoverability — Starter kit harder to miss
- [x] Emergency letters → Planner “stolen slot” highlight when divert occupies capacity *(E2)*
- [ ] **Cargo equality (E3)** — start focus + truck gate / screen chain

## Wave B — Layout skill (CEO spine)

1. **Baggage belt lite** — check-in drop → makeup → bay; trucks only at connected bays.
2. **Franchise brand contracts** — CounterBite / SkyGlass; spend mult + crisis mission.
3. **International zone lite** — passport room + intl flight flag.

Success: player breaks a belt, sees bags late, fixes path, recovers heat — without a wiki.

## Wave B′ — Cargo path equality

*(Can parallel Wave B once belt pattern exists — same “broken chain” verb.)*

1. **Start focus UI** — Passenger / Cargo / Hybrid + cargo starter kit ([PROGRESSION](./PROGRESSION.md#start-choice-planned)).
2. **Cargo truck gate + screen/sort** — landside choke; missing = late uplift.
3. **Warehouse makeup + loader GSE** — picture verb for freighter load.
4. **Cargo rail spur** — high volume, high upkeep; distinct from pax city rail.
5. Airlines panel **Cargo ladder** clarity (C1–C5 labels beside T1–T5).

## Wave B″ — Side seasons

1. Expand emergency pack + cooldowns ([IDEAS](./IDEAS.md#emergency-seasons-random-letters)).
2. Military mission letters + pilot training facility ([IDEAS](./IDEAS.md#military-host-side-missions)).
3. Keep both letter-sized — no fifth permanent game ([PROBLEMS](./PROBLEMS.md#fifth-loop-smell)).

## Wave C — Scale fantasy

1. Multi-terminal research gate (3rd+ halls).
2. Stairs / belt loader GSE on widebody/heavy (+ cargo Code F loaders).
3. Scenarios (3–5 timed goals) — include “cargo Kiln” and “Guard neighbor.”
4. Richer jetway / terminal ladder art.

*(Remote stand bus/walk already shipped — deepen with capacity & fee cuts.)*

## Parked (do not start early)

| Item | Why parked |
| --- | --- |
| **P2.5 Freeflow build** | Rewrites path, save, mesh, snap — after grid loops sacred |
| Custom wall painter | After belts + planner craft |
| Godot Steam shell | After Waves A–B feel unfair-fun |
| Admin commute / staff bureaucracy | Explicit non-goal |

## Quality bar (every PR)

1. Money posts with a picture (truck / guest / jet / letter).
2. No perfect hall oracle — keep Sawyer cap.
3. Playthrough smoke: `npx tsx scripts/playthrough-wake.mts`
4. Docs: if it changes a pillar, update DESIGN / ECONOMY / PROBLEMS; if it’s a new idea, IDEAS; if it’s sequencing, NEXT.

## Session checklist for agents

1. Read `docs/DESIGN.md` + `docs/NEXT.md` before inventing features.
2. Prefer deepening an existing loop over a new subsystem.
3. Commit on `main` (New Project flow); no PR unless asked.
4. Leave Vite on an uncommon port; link the live URL.

## Definition of done for “beyond first landing”

A new player, no wiki:

1. Boot → starter → Northline money (~2 min).
2. Choose jetway vs remote and feel the difference.
3. Break or clog something (belt / taxi / security) → money or heat hurts → fix → recover.
4. Survive a layover bank or public crisis.
5. Still want a second terminal or franchise — not “I’m done.”
