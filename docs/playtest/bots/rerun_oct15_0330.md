# Bot rerun — 15 Oct 2026, 03:30 window

Headless personas were rerun on `7776b7a` (standard difficulty, passenger focus, sandbox off). Careful ran 45 sim days, Greedy 60, Chaotic 30. The Playwright smoke then played the production build. Game rules and economy numbers were not changed. Bot personas now buy Growth-tree nodes, hire desk agents, and (Careful only) answer curb pressure above 1.

While that run was in progress, `main` moved to `6c45ccd` (“Stop treating taxi-out queues and apron crowds as stuck aircraft,” plus the fuel-farm supply chain). The cash, guest, research, fine, and taxi-out figures in this note are from the `7776b7a` run. They were not rolled again after `6c45ccd`. That commit changes which ground stalls the watchdog reports, so the taxi-out counts below are the pre-fix measurement.

Start cash on this main is **$168,000** (`START_CASH.standard`). The baseline report started at $150,000. Day-0 cash below is after the starter kit, not the bank at the title screen.

## Before / after

| | Baseline | This rerun |
| --- | --- | --- |
| Careful cash, day 45 | $150,000 → **−$21,490** | $168,000 → **−$16,952** (low −$21,368 on day 43) |
| Careful rating | 65 → **25** | 65 → **25** from day 36 through day 45 |
| Careful guests | **0 from day 36** | 0 on days 30–36, then 5 / 12 / 7 on days 40 / 44 / 45. Peak 85 (day 11) |
| Greedy cash, day 60 | **−$18,424** | **−$17,124** (low −$18,424 on day 31). 0 guests from day 30 |
| Greedy taxi-out recoveries | **32** per 60 days | **18** (plus a matching “stuck on the ground” row each time) |
| Careful taxi-out recoveries | — | **20** |
| Field-ask fines at the full $1,600 | **50** | Careful **50**, Greedy **51**, Chaotic **0** |
| Happiness | unclamped, peak **232.6** | still unclamped. Careful peak **203.2**, Greedy **136.4**, Chaotic no guests |

No NaNs. Nothing was still stuck at the end of a headless run. Headless console errors: none.

## Careful (45 days)

Cash after the kit is $73,000 on day 0, then $6,777 / $3,775 / −$613 / $3,916 / $1,926 / $4,044 / $863 / −$2,348 / −$11,584 / −$19,944 / −$21,365, and **−$16,952** at day 45. Rating falls 65 → 77 (day 4) → 40 (day 30) → 32 (day 32) → 25 from day 36. Mean happiness while guests were present: 87.

Sinks: penalties −$426,474, building upkeep −$216,105, payroll −$119,929, loan repayment −$38,808, fuel purchase −$26,800, staff hiring −$13,600, loan interest −$10,882. Income is led by landing fees $356,564 and contract fees $209,078.

First landing PDJ101 at 42.5s. 73 flights, 4 stands, 4/4 shops leased. 3 desk agents, check-in and security both staffed. Queue peaks: check-in 29, security 10. End of run the check-in line read 3 waiting. Curb pressure peaked at **0.6** (end 0.18), 1 lane, 0 bus bays, so the new “add a bay or a lane” reaction never fired. All 12 tracked airlines stayed tier 1 Published (HeavyLift +2 through Zoomjet −10).

## Greedy (60 days)

Day 0 after the kit is $73,000. Day 30 −$17,599, day 45 −$18,395, day 60 **−$17,124**. Rating 65 → 25 by day 35 and it stays there. Guest peak 116 (day 7); the hall is empty from day 30 through day 60. Mean happiness while guests were present: 78.2.

Sinks: penalties −$623,290, building upkeep −$372,509, payroll −$58,269, loan repayment −$34,560, fuel purchase −$22,640, staff hiring −$11,700, loan interest −$9,150. Income is led by landing fees $462,575 and contract fees $455,986.

First landing PDJ101 at 41.3s. 62 flights, 6 stands, 2/8 shops leased. Eight `buyParcel` stamps failed with “Parcel locked — reach Field Level 2 first.” 3 desk agents, both posts staffed. Queue peaks: check-in 60, security 13. Curb peak pressure 0.6, 1 lane, 0 bays. Every relation stayed tier 1 Published (Zoomjet −11.5).

## Chaotic (30 days)

Day 0 cash $118,000 (less of the opening budget spent), end **−$15,367** (low −$22,491 on day 27). Rating 65 → 43. Guests stayed 0, so happiness was never sampled. Taxi-out recoveries: 0. First landing LIF102 at 80s. 21 flights, 3 stands, nobody signed. 77 commands failed because the clicker was short of cash. The driver put the clock back to 5× after the persona touched the speed buttons.

Sinks: penalties −$111,493, building upkeep −$107,320, staff hiring −$13,600, payroll −$13,298, loan repayment −$12,305, fuel purchase −$6,800, loan interest −$3,450. Relations on the books: HeavyLift and Puddle Jumper, both score −3, tier 1 Published. 3 desk agents, both posts staffed, queue peaks 0. Curb peak pressure 0.3, 1 lane, 0 bays.

## What the new systems did

- **Desk queues.** Careful and Greedy both staffed check-in and security (3 agents; the kit already starts with one). Lines formed: Careful peaked at 29 / 10, Greedy at 60 / 13. Chaotic staffed the posts and never grew a line.
- **Curb.** Pressure stayed under 1 on every persona (peaks 0.6, 0.6, 0.3). Lanes stayed 1 and bus bays stayed 0. Careful’s congestion reaction is armed only above pressure 1, so it did not stamp a bay.
- **Relations.** Every scored airline was still tier 1 Published. No Preferred / Trusted / Priority / Flagship tier was reached.
- **Research.** Measured below. The three pools are separate.

## Three research pools

Lab furniture is the research desk (`rdesk`), chalkboard (`rboard`), and lab bench (`rmachine`). All three personas place that furniture on day 1, once the day-1 trickle banks a whole point. Researchers on payroll stayed **0** for the whole run, because the personas do not hire them.

The same room counts are handed to all three pools. Only two of them go up:

| Pool | What the furniture does | Measured room rate, day 0 → day 1 |
| --- | --- | --- |
| Old research desk (`game.researchPoints`) | `labResearchRate()` returns 0 until `researchers >= 1` (`src/game/sim.ts`). The rooms are ignored. The 0.05 RP/s operations trickle does not read the rooms. | 0 → **0** |
| Wave 3 R&D (`game.wave3`, b0a2e30) | `roomRate` adds the desk, board, and bench (`src/wave3/research.ts`) on top of a 0.02 RP/s operations trickle that runs with or without furniture. | 0 → **0.19** (Chaotic **0.23**, extra chalkboard) |
| Growth tree (`game.researchTree`, ce290e5) | `roomRate` adds the same rooms (`src/research/logic.ts`) on top of a 0.01 RP/s operations trickle. No staff required. | 0 → **0.13** (Chaotic **0.16**) |

Day 1 gear was 1 desk, 1 board, 1 bench for Careful and Greedy, and 1 desk, 2 boards, 1 bench for Chaotic. Those rates match the config: Wave 3 is 0.06 + 0.04 + 0.09 per room, Growth is 0.04 + 0.03 + 0.06, and a second board adds 0.04 or 0.03.

**Earned** is the balance still in that pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash. Growth earned also contains field-level research rewards, because those land in the same balance. The old desk stores fractional points directly, so its carry column is 0.

### Points by day

| Persona | Day | Desk balance / earned | Wave 3 balance / earned | Growth balance / earned |
| --- | --- | --- | --- | --- |
| Careful | 30 | 529.38 / 529.38 | 1135 / 1135.05 | 709 / 756.63 |
| Careful | 45 | 679.38 / 679.38 | 1703 / 1703.10 | 1001 / 1134.63 |
| Greedy | 30 | 148.38 / 506.38 | 1135 / 1135.40 | 351 / 756.63 |
| Greedy | 45 | 283.38 / 641.38 | 1702 / 1702.40 | 729 / 1134.63 |
| Greedy | 60 | 418.38 / 776.38 | 2269 / 2269.40 | 1107 / 1512.63 |
| Chaotic | 30 | 331.13 / 331.13 | 1323 / 1323.13 | 837 / 899.25 |

Careful and Chaotic did not reach day 45 or 60. Greedy’s old-desk balance is lower than earned because catalog nodes were bought. Growth balance is lower than earned on every persona for the same reason. Wave 3 balance and earned stay together because nothing was bought from that pool.

### Nodes bought

**Old research desk.** Careful: none. Chaotic: none. Greedy bought the catalog stamps (not Growth nodes):

- day 1: Night bank (`night_bank`) 28
- day 2: Kiosks and bag drop (`self_service`) 22
- day 4: De-ice ops (`deice`) 34
- day 6: Stand classes (`stand_class`) 40
- day 9: Belts and sorter (`bag_sorter`) 32
- day 10: Travelators (`travelator`) 26
- day 11: Scanner lanes (`ct_lanes`) 28
- day 20: Widebody ops (`widebody_ops`) 48, Hydrant fuel (`hydrant_fuel`) 36, Tank farm II (`tank_farm_ii`) 30, Skywalks (`skywalk`) 34

Those eleven costs sum to 358 points, which is Greedy’s day-60 desk earned minus desk balance.

**Wave 3 R&D.** No persona bought a node. There is no persona command for `buyWave3`. Greedy finished with 2,269 points, above the 2,000 first-node cost, and the first tech was still locked.

**Growth tree.** Tier-1 nodes cost 0. Careful buys one affordable node a day (45 nodes, days 0–44):

`airfield-1` 0, `terminal-1` 0, `airfield-2` 1, `terminal-2` 1, `airside-1` 0, `landside-1` 0, `airside-2` 1, `landside-2` 1, `airfield-3` 2, `airside-3` 2, `retail-1` 0, `safety-1` 0, `retail-2` 1, `safety-2` 1, `landside-3` 2, `retail-3` 2, `safety-3` 2, `terminal-3` 2, `airfield-4` 4, `airside-4` 4, `landside-4` 4, `spec-charter` 0, `spec-cargo-1` 1, `spec-cargo-2` 2, `spec-green-1` 2, `spec-hub-1` 2, `spec-lowcost-1` 2, `spec-premium-1` 2, `spec-green-2` 3, `spec-hub-2` 3, `spec-lowcost-2` 3, `spec-premium-2` 3, `retail-4` 4, `safety-4` 4, `spec-cargo-3` 4, `terminal-4` 4, `spec-green-3` 6, `spec-hub-3` 6, `spec-lowcost-3` 6, `spec-premium-3` 6, `airfield-5` 8, `airside-5` 8, `landside-5` 8, `retail-5` 8, `safety-5` 8.

Greedy buys every time it looks, 62 nodes. Days 0–5 clear the airfield, terminal, airside, and landside lines through tier 6 (`airfield-6` / `terminal-6` on day 2, `airside-6` day 4, `landside-6` day 5). Days 9–10 buy retail and safety through tier 6. Days 20–22 buy the specialisation charter and all five spec branches through their top node (`spec-cargo-5` 16, `spec-green-5` 24, `spec-hub-5` 24, `spec-lowcost-5` 24, `spec-premium-5` 24).

Chaotic bought 12 Growth nodes on days 0–2 and then stopped: `airfield-1` through `terminal-6` (costs 0, 0, then pairs of 1, 2, 4, 8, 16). No airside, landside, retail, safety, or spec node.

## Browser smoke

The production opening finished. Clock ended at 304s. First landing at 82.4s. Cash ended at $22,761. No console errors, no softlock, nothing left stuck. Slowest captured tick was 5.9 ms.

The new-game card stamps the starter kit, so `starter-kit-coach` is not on the coach. The smoke script follows that path. In the first 24 seconds the contract letter was not on the letter stack or the phone. Services opened from the Operations menu; Hall food and Souvenirs were not on that panel because no hall was selected. Feature stills are in `docs/playtest/screens_oct15/`.
