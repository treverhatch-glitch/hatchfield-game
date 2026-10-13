# Crowd: local avoidance, queues, doorways, and prefab capacity tuning

Module: `src/crowd/`, self-contained with no imports from `game/` or `render/`.

## 1. What `src/crowd` does

| Piece | File | Behaviour |
|---|---|---|
| Spatial hash | `spatialHash.ts` | Counting-sort grid that is rebuilt each tick. No per-tick allocation. Each agent queries a 1.6 m neighbourhood. |
| Steering | `crowd.ts` | Helbing social force: a goal drive with τ = 0.5 s, exponential repulsion from people (A = 2.1, B = 0.3 m) and from walls. It adds an RVO-style anticipation term: if the closest approach falls within 1.8 s and inside both radii plus 0.25 m, the walker sidesteps to its right. This makes counter-flows form lanes. A hard rule stops walkers crossing walls, and one overlap-relaxation pass runs each tick. |
| Queues | `crowd.ts` (`addQueue / joinQueue / serveHead`) | A queue is a polyline running back from the service point, with a slot every 0.65 m. Queuers move to their slots, so a queue forms a line. Walkers give queuers 0.35 m of extra clearance and 2.5× repulsion. Queuers react to walkers at only 0.15× and weigh 10× in the overlap pass, so walkers go around the line and the line stays in place. |
| Doorways | `crowd.ts` (`addDoor`, `Waypoint.doorId`) | Each door has a token bucket that refills at width × 1.3 people/m/s (Fruin / SFPE). Within 1.2 m of a door, an agent without a token waits in the `DoorWait` state. Narrow doors in a player layout cause real back-ups. |
| Capacity model | `capacity.ts` | A deterministic copy of trunk `tickSecurityLane` that is used to tune the prefab (section 2). |

**Integration with PR #17:** each navPath room route becomes a `Waypoint[]`. Points that cross a doorway get `doorId` set. Room walls become `Wall` segments. Each service node (check-in desk, security lane, gate podium) gets a queue polyline. The sim keeps ownership of service timing: when `tickSecurityLane` admits a guest, call `serveHead(queueId, nextRoute)`. When an agent reaches `Arrived`, hand control back to the sim. The renderer reads `x / z / vx / vz`, with heading = atan2(vx, vz).

**Performance**, measured on the box (CPU-only VM) with all agents walking through each other and one 0.1 s tick each:

| Agents | ms per step |
|---|---|
| 1,000 | 5.4 |
| 3,000 | 7.3 |
| 5,000 | 13.1 |

The sim ticks at 10 Hz, so 5,000 agents use about 13% of one core.

**Tests:** `crowd.test.ts` has 10 tests and `capacity.test.ts` has 6. They cover:
- Counter-flow in a corridor with no overlap below 0.3 m, and everyone arrives.
- Early sidestepping.
- No crossing through walls.
- Queues forming evenly spaced lines.
- Queues moving up after the head is served.
- Walkers keeping more than 0.6 m from a queue while queuers move less than 0.15 m.
- Door flow capped at about 1.3 people/m/s, and a 2.4 m door draining at least 25% faster than a 0.9 m door.
- A narrow door under load building a backlog.
- 3,000 agents per step within budget.

## 2. Prefab terminal capacity: why it bottlenecks early, and the fix

### Trunk today (`src/game/terminal.ts`, `src/game/sim.ts`)

- **Prefab I · Linear:** 1 security server at 3 s per body, which is **20 bodies/min**. `capGuests` is 28 and the queue cap is 10.
- **Check-in:** no server limit. The desk deposit takes 0.55–2.8 s and runs in parallel, so it is not the choke point. Security is.
- **Service time** = `serviceSec × (1 + wear/100)`. Wear rises about 1.4 per body (bumpWear 0.6–2.2) and caps at 100, which **doubles** service time. The starter kit hires no janitor.
- **Over cap:** `svc *= 1 + (bodies − 28) × 0.08` with **no ceiling**. Every extra queuer slows the lane further, so a long queue makes itself longer.
- **Unstaffed lane:** service time ×1.35.
- **Demand:** each departing flight drops 6–18 hall bodies at the doors **all at once** (pax / 5.5 at a jetway). Starter traffic is 1 strip, 2 stands and 1–2 contracts. That works out to about one departure every 40 s with about 11 bodies each, roughly **16.5 bodies/min**. Hub or extra contracts bring flights every 16–28 s with about 14 bodies each.

### Load before and after

The traffic presets in `capacity.ts` are estimates. Utilisation ρ is the offered load: arrival rate × service time ÷ servers.

| Scenario | ρ trunk, fresh | ρ trunk, worn | ρ proposed, fresh | ρ proposed, worn |
|---|---|---|---|---|
| Starter (40 s gap, 11 bodies, staffed) | 0.83 | **1.65** | 0.48 | 0.72 |
| Grown (22 s gap, 14 bodies) | 1.91 | 3.82 | 1.11 | 1.67 |
| QA heavy (20 s, 14, unstaffed) | 2.84 | 5.67 | 1.65 | 2.48 |

So at starter traffic, the trunk lane goes past capacity as soon as it wears in, around day 2–3. That happens before the player has added anything.

### Simulated results

The model runs at 10 days × 180 s and a body gives up after waiting 150 s. Each cell shows **max queue, then the number of missed bodies** for that day.

| Day | 1 | 2 | 3 | 4 | 5 | 7 | 10 |
|---|---|---|---|---|---|---|---|
| Trunk, starter | 11 / 0 | 19 / 0 | 33 / 0 | 44 / 27 | 45 / 32 | 50 / 31 | 47 / 37 |
| Trunk, QA heavy | 100 / 0 | 113 / 125 | 121 / 111 | 118 / 114 | 107 / 117 | 116 / 125 | 122 / 133 |
| **Proposed, starter** | 2 / 0 | 2 / 0 | 3 / 0 | 5 / 0 | 3 / 0 | 5 / 0 | 4 / 0 |
| **Proposed, ramp** (airlines added days 4→10) | 2 / 0 | 2 / 0 | 3 / 0 | 6 / 0 | 4 / 0 | 8 / 0 | **39** / 0 (wait 70 s) |
| Proposed, grown | 24 / 0 | 67 / 0 | 109 / 32 | 109 / 75 | … | | |

This matches what the QA bot saw: under heavy load, the queue sat at 100+ (156 queued at security by day 7).

### Tuning proposal, Prefab I (exact values are in `PROPOSED_PREFAB_I`)

| Knob | Trunk | Proposed | Why |
|---|---|---|---|
| `PREFAB_TIERS[1].servers` | 1 | **2** | A real linear terminal opens 2 lanes. |
| `PREFAB_TIERS[1].serviceSec` | 3 | **3.5** | Per-lane screening is a little slower, but capacity goes from 20 to **34.3 bodies/min**. |
| `PREFAB_TIERS[1].paxCap` (`capGuests`) | 28 | **40** | Gives the queue room before the slowdown starts. |
| Over-cap slowdown | +8%/body, no ceiling | **+2%/body, max ×1.4** | Removes the runaway loop. Strain still shows, but queues don't keep growing by themselves. |
| Wear per body (prefab bundle lanes) | ~1.4 | **0.7** | Halves wear on the bundled lane. |
| Wear divisor in `slowedService` | 100 | **200** | A fully worn lane runs ×1.5 slower instead of ×2. A janitor still matters. |
| Departure release | all bodies at t = 0 | **spread over 45 s** | People show up over time instead of in one burst, which removes the per-flight spike. |
| Unstaffed ×1.35 | keep | keep | Staffing is still a lever the player controls. |

**Tiers II and III** (suggested, not modelled): keep the same multiples over the new Tier I.
- Tier II: 3 servers at 3 s, about 60/min.
- Tier III: 4 servers at 2.5 s, about 96/min.

With these values, upgrading is the answer once the player passes 3–4 airlines. Player-placed security items keep their catalogue numbers.

**Result:**
- At starter traffic, the queue stays at 8 or fewer, the mean wait under 10 s, and nobody misses a flight across all 10 days.
- Strain shows about 3–5 days after the player starts signing airlines: 16 by day 8, 30 by day 9 and 39 by day 10.
- At fully grown traffic (ρ > 1), the player has to add lanes, upgrade the prefab, hire janitors or redesign. That is the intended "design around it" gridlock.

### Caveats

- The traffic presets are estimates from `seedScheduleForAirline` spacing, the guest-count formula and a 2-stand turnaround limit. They are not taken from a live run.
- Check them against the QA bot's next merged-build run (queue at security per day). If the measured starter flight gap is under 30 s, raise `serviceSec` capacity by making it 3.0 instead of tightening anything else.
- This PR does **not** change `sim.ts` or `terminal.ts`. The values above are a proposal for the terminal agent to apply when it merges, so this branch can't conflict with the integration.
