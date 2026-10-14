# Hatchfield bot playtest

Generated 2026-10-14T20:54:24.838Z.

Headless bots use the player command API (new game, land, starter kit, tile stamps, hall rooms, contract letters, loans, shop bids, the Growth research tree, desk agents, and a curb reaction) and run at 5×. One sim day is 180s. Tick dt is 0.25s. Once the day-1 research trickle banks a whole point, each persona furnishes a research desk, then a chalkboard, then a lab bench, when the hall exists and cash covers the catalog price. When a tree node is affordable they buy the cheapest one. They hire desk agents until check-in and security are both staffed. Careful, when the curb pressure is over 1 and cash can cover it, adds a bus bay or one more approach lane instead of that day's expansion.

## Headless personas

### Careful

standard / pax, sandbox off. Requested 45 sim days, ran 45. 6480 ticks in 35.3s wall.

#### Time to first landing

42.5s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $-16,952.

`█▃▄▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▄▃▃▃▃▃▃▃▂▃▂▂▂▂▂▂▂▁▁▁▁▁▁▁▁`  $-21,368 → $73,000

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 4 | $6,777 |
| 8 | $3,775 |
| 12 | $-613 |
| 16 | $3,916 |
| 20 | $1,926 |
| 24 | $4,044 |
| 28 | $863 |
| 32 | $-2,348 |
| 36 | $-11,584 |
| 40 | $-19,944 |
| 44 | $-21,365 |
| 45 | $-16,952 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 20.

Recovered:

- PDJ102 taxi_out for 45s cleared at 326s
- PDJ102 stuck on the ground cleared at 329s
- LIF113 taxi_out for 80s cleared at 560s
- LIF113 stuck on the ground cleared at 561s
- PDJ109 taxi_out for 51s cleared at 576s
- PDJ109 stuck on the ground cleared at 579s
- LIF129 taxi_out for 43s cleared at 836s
- LIF129 stuck on the ground cleared at 839s
- PDJ127 taxi_out for 41s cleared at 1040s
- ZO118 taxi_out for 41s cleared at 1225s
- ALS123 taxi_out for 45s cleared at 1409s
- ALS123 stuck on the ground cleared at 1411s
- … 25 more

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 87.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 4 | 1 | 121.4 | 77 |
| 8 | 54 | 84.2 | 78 |
| 12 | 68 | 79 | 71 |
| 16 | 7 | 165.6 | 64 |
| 20 | 12 | 72.7 | 49 |
| 24 | 19 | 97.2 | 47 |
| 28 | 12 | 67 | 45 |
| 32 | 0 | — | 32 |
| 36 | 0 | — | 25 |
| 40 | 5 | 75.5 | 25 |
| 44 | 12 | 98 | 25 |
| 45 | 7 | 133.3 | 25 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 67.7 | 0 | 13.8s | 0 | 0 |
| 28.5 | 7 | 1436.3s | 0 | 66 |
| 23.7 | 7 | 1435s | 0 | 65 |
| 22.9 | 15 | 2791.3s | 3 | 28 |
| 20.6 | 8 | 1503.8s | 3 | 61 |
| 20.5 | 8 | 1500s | 3 | 61 |
| 19.8 | 0 | 1.3s | 0 | 0 |
| 19.1 | 8 | 1470s | 2 | 62 |

#### Anything the bot could not do

0 failed commands.

Every command succeeded.

Built:

- Runway strips 1, stands 4, terminal tiles 9, snack bars 1
- Shop units 4, leased 4, flights completed 73
- Signed: air_regional_1, zoomjet, alpine_swift, air_lowcost_1, cityhopper, maple_coastal, outback_link, savanna_air, kauri_air, borneo_wings, air_cargo_1, dune_jet
- Rooms: checkin 2, security 2, gate 2, bagclaim 1, food 2, souvenir 1, bagdrop 1, lounge 1, bathroom 2, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 1001 points, 45 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airside-1, landside-1, airside-2, landside-2, airfield-3, airside-3, retail-1, safety-1, retail-2, safety-2, landside-3, retail-3, safety-3, terminal-3, airfield-4, airside-4, landside-4, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, retail-4, safety-4, spec-cargo-3, terminal-4, spec-green-3, spec-hub-3, spec-lowcost-3, spec-premium-3, airfield-5, airside-5, landside-5, retail-5, safety-5). Operations trickle: 1703 points.
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 3, security 0. Peaks: check-in 29, security 10.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 0.2 (peak 0.6), queue 0 (peak 0), delay 0s, lanes 1, bus bays 0.
Happiness peak 203.2. Guest peak 85. Field-ask fines booked at the full rate: 50. Penalties total $-426,474.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 0.

Measured room rates from that furniture: the Wave 3 R&D pool at 0.19 RP/s; the Growth tree at 0.13 RP/s.
Old research desk lab rate 0 RP/s (operations trickle 0.05 RP/s, which does not read the rooms). Wave 3 room rate 0.19 RP/s on top of its 0.02 RP/s operations trickle. Growth tree room rate 0.13 RP/s on top of its 0.01 RP/s operations trickle.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0.19 RP/s and the Growth room rate was 0.13 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 529.38 | 529.38 | 1135 | 1135.05 | 709 | 756.63 |
| 45 | 679.38 | 679.38 | 1703 | 1703.1 | 1001 | 1134.63 |

End of run: desk 679.38 balance / 679.38 earned, Wave 3 1703 balance / 1703.1 earned, Growth 1001 balance / 1134.63 earned.

Old research desk: no nodes bought.

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 1: Hall shell (terminal-1) for 0 points
- day 2: De-ice pad (airfield-2) for 1 points
- day 3: Processing (terminal-2) for 1 points
- day 4: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 6: Catering kitchen (airside-2) for 1 points
- day 7: Inn (landside-2) for 1 points
- day 8: Large stands (airfield-3) for 2 points
- day 9: GSE depot (airside-3) for 2 points
- day 10: Snack bar (retail-1) for 0 points
- day 11: ARFF station (safety-1) for 0 points
- day 12: Shop row (retail-2) for 1 points
- day 13: Police post (safety-2) for 1 points
- day 14: Long-stay park (landside-3) for 2 points
- day 15: Food hall (retail-3) for 2 points
- day 16: Guard lanes (safety-3) for 2 points
- day 17: Concourse (terminal-3) for 2 points
- day 18: Heavy runway (airfield-4) for 4 points
- day 19: Wide hangar (airside-4) for 4 points
- day 20: Bus station (landside-4) for 4 points
- day 21: Specialisation charter (spec-charter) for 0 points
- day 22: Freight shed (spec-cargo-1) for 1 points
- day 23: Night freight (spec-cargo-2) for 2 points
- day 24: SAF blend (spec-green-1) for 2 points
- day 25: Transfer bank (spec-hub-1) for 2 points
- day 26: Fast turn (spec-lowcost-1) for 2 points
- day 27: Premium lane (spec-premium-1) for 2 points
- day 28: Quiet hours (spec-green-2) for 3 points
- day 29: Wave scheduling (spec-hub-2) for 3 points
- day 30: Remote stand (spec-lowcost-2) for 3 points
- day 31: Fast track (spec-premium-2) for 3 points
- day 32: Lounge (retail-4) for 4 points
- day 33: Security hall (safety-4) for 4 points
- day 34: Sorter (spec-cargo-3) for 4 points
- day 35: Jet bridge (terminal-4) for 4 points
- day 36: Electric GSE (spec-green-3) for 6 points
- day 37: Minimum connect (spec-hub-3) for 6 points
- day 38: Thin lounge (spec-lowcost-3) for 6 points
- day 39: VIP room (spec-premium-3) for 6 points
- day 40: Control tower (airfield-5) for 8 points
- day 41: MRO bay (airside-5) for 8 points
- day 42: Rail spur (landside-5) for 8 points
- day 43: Seating (retail-5) for 8 points
- day 44: Incident drill (safety-5) for 8 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| penalties | $-426,474 |
| building_upkeep | $-216,105 |
| payroll | $-119,929 |
| loan_repayment | $-38,808 |
| fuel_purchase | $-26,800 |
| staff_hiring | $-13,600 |
| loan_interest | $-10,882 |
| parking_fees | $10,431 |
| baggage_fees | $20,434 |
| passenger_fees | $24,872 |
| retail_sales | $31,074 |
| loan_proceeds | $50,000 |
| fuel_sales | $121,893 |
| contract_fees | $209,078 |
| landing_fees | $356,564 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| HeavyLift Cargo | 2 | neutral | 1 Published |
| Dune Jet | 1 | neutral | 1 Published |
| Outback Link | 0.5 | neutral | 1 Published |
| Borneo Wings | -1 | neutral | 1 Published |
| Maple Coastal | -1 | neutral | 1 Published |
| Savanna Air | -1 | neutral | 1 Published |
| Alpine Swift | -2.5 | neutral | 1 Published |
| SkyCheap | -2.5 | neutral | 1 Published |
| Cityhopper | -4 | neutral | 1 Published |
| Kauri Air | -4 | neutral | 1 Published |
| Puddle Jumper Airlines | -9.7 | neutral | 1 Published |
| Zoomjet | -10 | neutral | 1 Published |


### Greedy expander

standard / pax, sandbox off. Requested 60 sim days, ran 60. 8640 ticks in 65.5s wall.

#### Time to first landing

41.3s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $-17,124.

`█▃▃▃▃▃▂▂▂▃▃▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁`  $-18,424 → $73,000

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 5 | $5,370 |
| 10 | $7,341 |
| 15 | $-17,329 |
| 20 | $7,745 |
| 25 | $5,136 |
| 30 | $-17,599 |
| 35 | $-15,553 |
| 40 | $-18,310 |
| 45 | $-18,395 |
| 50 | $-18,409 |
| 55 | $-18,417 |
| 60 | $-17,124 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 18.

Recovered:

- PDJ101 taxi_out for 56s cleared at 175s
- PDJ101 stuck on the ground cleared at 176s
- PDJ111 taxi_out for 66s cleared at 523s
- PDJ111 stuck on the ground cleared at 524s
- LIF118 taxi_out for 46s cleared at 538s
- LIF118 stuck on the ground cleared at 539s
- LIF129 taxi_out for 41s cleared at 716s
- LIF129 stuck on the ground cleared at 719s
- PDJ125 taxi_out for 78s cleared at 1074s
- PDJ125 stuck on the ground cleared at 1076s
- LIF136 taxi_out for 60s cleared at 1089s
- LIF136 stuck on the ground cleared at 1091s
- … 24 more

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 78.2.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 5 | 1 | 124.4 | 81 |
| 10 | 100 | 58.9 | 60 |
| 15 | 15 | 57 | 61 |
| 20 | 16 | 79.8 | 49 |
| 25 | 7 | 51.2 | 41 |
| 30 | 0 | — | 26 |
| 35 | 0 | — | 25 |
| 40 | 0 | — | 25 |
| 45 | 0 | — | 25 |
| 50 | 0 | — | 25 |
| 55 | 0 | — | 25 |
| 60 | 0 | — | 25 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 29.5 | 10 | 1935s | 1 | 91 |
| 26 | 9 | 1683.8s | 4 | 135 |
| 25.6 | 8 | 1473.8s | 3 | 128 |
| 25.5 | 8 | 1470s | 4 | 130 |
| 25.2 | 9 | 1645s | 2 | 117 |
| 25.1 | 9 | 1776.3s | 2 | 96 |
| 24.7 | 8 | 1601.3s | 0 | 90 |
| 24.6 | 8 | 1580s | 1 | 91 |

#### Anything the bot could not do

8 failed commands.

- buyParcel ×8 — Parcel locked — reach Field Level 2 first.

Built:

- Runway strips 1, stands 6, terminal tiles 9, snack bars 2
- Shop units 8, leased 2, flights completed 62
- Signed: air_regional_1, zoomjet, alpine_swift, air_lowcost_1, cityhopper, maple_coastal, outback_link, savanna_air, kauri_air, borneo_wings, air_cargo_1
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 3, souvenir 3, bagdrop 1, lounge 1, bathroom 2, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 1107 points, 62 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airfield-5, terminal-5, airfield-6, terminal-6, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, airside-5, landside-5, airside-6, landside-6, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, retail-5, safety-5, retail-6, safety-6, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, spec-cargo-3, spec-green-3, spec-hub-3, spec-lowcost-3, spec-premium-3, spec-cargo-4, spec-green-4, spec-hub-4, spec-lowcost-4, spec-premium-4, spec-cargo-5, spec-green-5, spec-hub-5, spec-lowcost-5, spec-premium-5). Operations trickle: 2269 points.
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 0, security 0. Peaks: check-in 60, security 13.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 0.2 (peak 0.6), queue 0 (peak 0), delay 0s, lanes 1, bus bays 0.
Happiness peak 136.4. Guest peak 116. Field-ask fines booked at the full rate: 51. Penalties total $-623,290.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 0.

Measured room rates from that furniture: the Wave 3 R&D pool at 0.19 RP/s; the Growth tree at 0.13 RP/s.
Old research desk lab rate 0 RP/s (operations trickle 0.05 RP/s, which does not read the rooms). Wave 3 room rate 0.19 RP/s on top of its 0.02 RP/s operations trickle. Growth tree room rate 0.13 RP/s on top of its 0.01 RP/s operations trickle.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0.19 RP/s and the Growth room rate was 0.13 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 148.38 | 506.38 | 1135 | 1135.4 | 351 | 756.63 |
| 45 | 283.38 | 641.38 | 1702 | 1702.4 | 729 | 1134.63 |
| 60 | 418.38 | 776.38 | 2269 | 2269.4 | 1107 | 1512.63 |

End of run: desk 418.38 balance / 776.38 earned, Wave 3 2269 balance / 2269.4 earned, Growth 1107 balance / 1512.63 earned.

Old research desk nodes bought:

- day 1: Night bank (night_bank) for 28 points
- day 2: Kiosks and bag drop (self_service) for 22 points
- day 4: De-ice ops (deice) for 34 points
- day 6: Stand classes (stand_class) for 40 points
- day 9: Belts and sorter (bag_sorter) for 32 points
- day 10: Travelators (travelator) for 26 points
- day 11: Scanner lanes (ct_lanes) for 28 points
- day 20: Widebody ops (widebody_ops) for 48 points
- day 20: Hydrant fuel system (hydrant_fuel) for 36 points
- day 20: Tank farm II (tank_farm_ii) for 30 points
- day 20: Skywalks (skywalk) for 34 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 0: De-ice pad (airfield-2) for 1 points
- day 0: Processing (terminal-2) for 1 points
- day 0: Large stands (airfield-3) for 2 points
- day 0: Concourse (terminal-3) for 2 points
- day 0: Heavy runway (airfield-4) for 4 points
- day 0: Jet bridge (terminal-4) for 4 points
- day 1: Control tower (airfield-5) for 8 points
- day 1: Skywalk (terminal-5) for 8 points
- day 2: Code E pier (airfield-6) for 16 points
- day 2: People mover (terminal-6) for 16 points
- day 2: Fuel farm (airside-1) for 0 points
- day 2: Curb road (landside-1) for 0 points
- day 3: Catering kitchen (airside-2) for 1 points
- day 3: Inn (landside-2) for 1 points
- day 3: GSE depot (airside-3) for 2 points
- day 3: Long-stay park (landside-3) for 2 points
- day 3: Wide hangar (airside-4) for 4 points
- day 3: Bus station (landside-4) for 4 points
- day 3: MRO bay (airside-5) for 8 points
- day 3: Rail spur (landside-5) for 8 points
- day 4: Night bank (airside-6) for 16 points
- day 5: Airport hotel (landside-6) for 16 points
- day 9: Snack bar (retail-1) for 0 points
- day 9: ARFF station (safety-1) for 0 points
- day 9: Shop row (retail-2) for 1 points
- day 9: Police post (safety-2) for 1 points
- day 9: Food hall (retail-3) for 2 points
- day 10: Guard lanes (safety-3) for 2 points
- day 10: Lounge (retail-4) for 4 points
- day 10: Security hall (safety-4) for 4 points
- day 10: Seating (retail-5) for 8 points
- day 10: Incident drill (safety-5) for 8 points
- day 10: Comfort (retail-6) for 16 points
- day 10: Hardened perimeter (safety-6) for 16 points
- day 20: Specialisation charter (spec-charter) for 0 points
- day 20: Freight shed (spec-cargo-1) for 1 points
- day 20: Night freight (spec-cargo-2) for 2 points
- day 20: SAF blend (spec-green-1) for 2 points
- day 20: Transfer bank (spec-hub-1) for 2 points
- day 20: Fast turn (spec-lowcost-1) for 2 points
- day 20: Premium lane (spec-premium-1) for 2 points
- day 20: Quiet hours (spec-green-2) for 3 points
- day 21: Wave scheduling (spec-hub-2) for 3 points
- day 21: Remote stand (spec-lowcost-2) for 3 points
- day 21: Fast track (spec-premium-2) for 3 points
- day 21: Sorter (spec-cargo-3) for 4 points
- day 21: Electric GSE (spec-green-3) for 6 points
- day 21: Minimum connect (spec-hub-3) for 6 points
- day 21: Thin lounge (spec-lowcost-3) for 6 points
- day 21: VIP room (spec-premium-3) for 6 points
- day 21: Freighter stand (spec-cargo-4) for 8 points
- day 21: Rail first (spec-green-4) for 12 points
- day 21: Hub pier (spec-hub-4) for 12 points
- day 21: High frequency (spec-lowcost-4) for 12 points
- day 21: Bridge service (spec-premium-4) for 12 points
- day 21: Cargo airline (spec-cargo-5) for 16 points
- day 22: Green report (spec-green-5) for 24 points
- day 22: Alliance desk (spec-hub-5) for 24 points
- day 22: Low-cost deal (spec-lowcost-5) for 24 points
- day 22: Flagship deal (spec-premium-5) for 24 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| penalties | $-623,290 |
| building_upkeep | $-372,509 |
| payroll | $-58,269 |
| loan_repayment | $-34,560 |
| fuel_purchase | $-22,640 |
| staff_hiring | $-11,700 |
| loan_interest | $-9,150 |
| parking_fees | $9,999 |
| baggage_fees | $18,307 |
| catering_fees | $22,867 |
| passenger_fees | $25,500 |
| retail_sales | $35,427 |
| loan_proceeds | $45,000 |
| fuel_sales | $102,533 |
| contract_fees | $455,986 |
| landing_fees | $462,575 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| HeavyLift Cargo | 2 | neutral | 1 Published |
| Outback Link | 2 | neutral | 1 Published |
| Maple Coastal | 0.8 | neutral | 1 Published |
| Borneo Wings | 0.5 | neutral | 1 Published |
| Kauri Air | -1 | neutral | 1 Published |
| Savanna Air | -1 | neutral | 1 Published |
| SkyCheap | -1 | neutral | 1 Published |
| Cityhopper | -2.5 | neutral | 1 Published |
| Alpine Swift | -10 | neutral | 1 Published |
| Puddle Jumper Airlines | -11.2 | neutral | 1 Published |
| Zoomjet | -11.5 | neutral | 1 Published |


### Chaotic random clicker

standard / pax, sandbox off. Requested 30 sim days, ran 30. 4320 ticks in 17.5s wall.

#### Time to first landing

80s (day 0) — LIF102 entered landing.

#### Cash curve

Start $168,000 · end $-15,367.

`█▄▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▁▁▁▁`  $-22,491 → $118,000

| Day | Cash |
| --- | --- |
| 0 | $118,000 |
| 3 | $-836 |
| 6 | $-304 |
| 9 | $-5,241 |
| 12 | $-2,716 |
| 15 | $-5,056 |
| 18 | $-1,119 |
| 21 | $-4,325 |
| 24 | $-3,186 |
| 27 | $-22,491 |
| 30 | $-15,367 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 0.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

No hall guests were sampled.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 3 | 0 | — | 57 |
| 6 | 0 | — | 46 |
| 9 | 0 | — | 45 |
| 12 | 0 | — | 45 |
| 15 | 0 | — | 45 |
| 18 | 0 | — | 45 |
| 21 | 0 | — | 45 |
| 24 | 0 | — | 45 |
| 27 | 0 | — | 43 |
| 30 | 0 | — | 43 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 16.5 | 0 | 38.8s | 0 | 0 |
| 8.3 | 5 | 936.3s | 0 | 0 |
| 8.2 | 5 | 901.3s | 0 | 0 |
| 7.9 | 28 | 5057.5s | 0 | 0 |
| 7.8 | 29 | 5328.8s | 0 | 0 |
| 7.3 | 5 | 918.8s | 0 | 0 |
| 7.3 | 28 | 5048.8s | 0 | 0 |
| 7.1 | 4 | 893.8s | 1 | 0 |

#### Anything the bot could not do

77 failed commands.

- buyRoom ×3 — Need Restrooms — short 4407.
- hireJanitor ×2 — Need hire janitor — short 3965.
- hireJanitor ×2 — Need hire janitor — short 3776.
- hireJanitor ×2 — Need hire janitor — short 5166.
- buyRoom ×2 — Need Gate hold — short 5233.
- buyRoom ×1 — Need Lab bench — short 2738.
- buyRoom ×1 — Need Restrooms — short 476.
- buyRoom ×1 — Need Hall food — short 4534.
- buyRoom ×1 — Need Check-in — short 1634.
- hireJanitor ×1 — Need hire janitor — short 2434.
- hireJanitor ×1 — Need hire janitor — short 3175.
- buyRoom ×1 — Need Check-in — short 2375.
- hireJanitor ×1 — Need hire janitor — short 3504.
- hireJanitor ×1 — Need hire janitor — short 5207.
- buyRoom ×1 — Need Research desk — short 4907.
- hireJanitor ×1 — Need hire janitor — short 2107.
- buyRoom ×1 — Need Security — short 2800.
- buyRoom ×1 — Need Research desk — short 3600.
- buyRoom ×1 — Need Research desk — short 7465.
- buyRoom ×1 — Need Airline lounge — short 5565.
- buyRoom ×1 — Need Gate hold — short 2565.
- buyRoom ×1 — Need Lab bench — short 7378.
- buyRoom ×1 — Need Gate hold — short 1878.
- buyRoom ×1 — Need Security — short 5378.
- buyRoom ×1 — Need Research desk — short 10597.
- hireJanitor ×1 — Need hire janitor — short 4597.
- buyRoom ×1 — Need Souvenirs — short 8597.
- buyRoom ×1 — Need Chalkboard — short 4916.
- buyRoom ×1 — Need Lab bench — short 8116.
- buyRoom ×1 — Need Research desk — short 8816.
- buyRoom ×1 — Need Lab bench — short 10616.
- buyRoom ×1 — Need Security — short 10965.
- buyRoom ×1 — Need Lab bench — short 13565.
- buyRoom ×1 — Need Gate hold — short 12465.
- hireJanitor ×1 — Need hire janitor — short 13865.
- buyRoom ×1 — Need Gate hold — short 7224.
- buyRoom ×1 — Need Research desk — short 9024.
- hireJanitor ×1 — Need hire janitor — short 11124.
- buyRoom ×1 — Need Lab bench — short 10456.
- hireJanitor ×1 — Need hire janitor — short 8256.

Built:

- Runway strips 1, stands 3, terminal tiles 9, snack bars 1
- Shop units 4, leased 1, flights completed 21
- Signed: nobody
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 2, souvenir 1, bagdrop 1, lounge 1, bathroom 2, rdesk 1, rboard 2, rmachine 1

#### New systems

Research tree: 837 points, 12 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airfield-5, terminal-5, airfield-6, terminal-6). Operations trickle: 1323 points.
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 0, security 0. Peaks: check-in 0, security 0.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 0.2 (peak 0.3), queue 0 (peak 0), delay 0s, lanes 1, bus bays 0.
Happiness peak —. Guest peak 0. Field-ask fines booked at the full rate: 0. Penalties total $-111,493.

#### Research pools

Lab furniture at the end: 1 research desk, 2 chalkboards, 1 lab bench. Researchers on payroll: 0.

Measured room rates from that furniture: the Wave 3 R&D pool at 0.23 RP/s; the Growth tree at 0.16 RP/s.
Old research desk lab rate 0 RP/s (operations trickle 0.05 RP/s, which does not read the rooms). Wave 3 room rate 0.23 RP/s on top of its 0.02 RP/s operations trickle. Growth tree room rate 0.16 RP/s on top of its 0.01 RP/s operations trickle.
First day with lab furniture was day 1 (1 desk, 2 board, 1 bench). That day's Wave 3 room rate was 0.23 RP/s and the Growth room rate was 0.16 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 331.13 | 331.13 | 1323 | 1323.13 | 837 | 899.25 |

End of run: desk 331.13 balance / 331.13 earned, Wave 3 1323 balance / 1323.13 earned, Growth 837 balance / 899.25 earned.

Old research desk: no nodes bought.

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 1: De-ice pad (airfield-2) for 1 points
- day 1: Processing (terminal-2) for 1 points
- day 1: Large stands (airfield-3) for 2 points
- day 1: Concourse (terminal-3) for 2 points
- day 1: Heavy runway (airfield-4) for 4 points
- day 2: Jet bridge (terminal-4) for 4 points
- day 2: Control tower (airfield-5) for 8 points
- day 2: Skywalk (terminal-5) for 8 points
- day 2: Code E pier (airfield-6) for 16 points
- day 2: People mover (terminal-6) for 16 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| penalties | $-111,493 |
| building_upkeep | $-107,320 |
| staff_hiring | $-13,600 |
| payroll | $-13,298 |
| loan_repayment | $-12,305 |
| fuel_purchase | $-6,800 |
| loan_interest | $-3,450 |
| retail_sales | $31 |
| loan_proceeds | $45,000 |
| fuel_sales | $50,400 |
| contract_fees | $66,470 |
| landing_fees | $106,498 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| HeavyLift Cargo | -3 | neutral | 1 Published |
| Puddle Jumper Airlines | -3 | neutral | 1 Published |


- Driver put the clock back to 5× after the persona touched the speed buttons.

## Browser smoke

Scripted opening finished.

Opening played through the first landing.

Wall 131.5s. Clock ended at 304s.

#### Time to first landing

82.4s.

#### Cash curve

Ended at $22,761.

`█▁`  $23,641 → $24,804

#### Stuck or recovered

None still stuck.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

No hall guests sampled.

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 5.9 | 0 | 179.9s | 0 | 12 |
| 5.1 | 1 | 260.1s | 1 | 12 |
| 5 | 0 | 43s | 0 | 12 |
| 5 | 1 | 304.3s | 1 | 12 |
| 4.8 | 0 | 135.6s | 1 | 12 |
| 4.7 | 0 | 97.8s | 1 | 12 |
| 4.7 | 1 | 180.1s | 0 | 12 |
| 4.6 | 0 | 179s | 0 | 12 |

#### Anything the bot could not do

- acceptContract — contract letter did not appear on the stack or the phone
- buyRoom — Hall food was not on the services panel (no hall selected)
- buyRoom — Souvenirs was not on the services panel (no hall selected)

Script:

- open http://127.0.0.1:45991/?playtest=1
- sandbox off
- new game
- passenger start
- starter kit stamped by the new-game card
- open phone
- open pavement tray
- select taxiway
- click the field
- operations menu
- services tab
- terminal view
- 5x

Screenshots:

- docs/playtest/bots/smoke/01-title.png
- docs/playtest/bots/smoke/02-route.png
- docs/playtest/bots/smoke/03-field.png
- docs/playtest/bots/smoke/04-kit.png
- docs/playtest/bots/smoke/05-contract.png
- docs/playtest/bots/smoke/07-services.png
- docs/playtest/bots/smoke/07b-hall.png
- docs/playtest/bots/smoke/08-five-minutes.png

- Starter kit stamped by the new-game card. The coach no longer shows starter-kit-coach.
