# Hatchfield bot playtest

Generated 2026-10-15T03:59:03.121Z.

Headless bots use the player command API (new game, land, starter kit, the Apex Local fuel term, tile stamps, hall rooms, contract letters, loans, shop bids, the Growth research tree, desk agents, and a curb reaction) and run at 5×. One sim day is 180s. Tick dt is 0.25s. Once the day-1 research trickle banks a whole point, each persona furnishes a research desk, then a chalkboard, then a lab bench, when the hall exists and cash covers the catalog price. Careful and Greedy then hire one researcher. When a tree node is affordable they buy the cheapest one. They hire desk agents until check-in and security are both staffed. Careful and Greedy, once cash is above three times the stamp and the airfield says Over the runway or curb or stand pressure is above 1, build a second runway and two more stands. Careful, when that expansion is not affordable and the curb pressure is over 1, adds a bus bay, then a taxi rank, then a curb lane instead of that day's other stamp.

## Headless personas

### Careful

standard / pax, sandbox off. Requested 45 sim days, ran 45. 6480 ticks in 48.6s wall.

Flights 143 (3.2/day). Diverts 0 (connection diverts 0). Go-arounds 1. Missed-connection cash $0. Curb crossed 1 on day 22. Fuel groundings 0. Tree complete day —. Preferred day 19, Trusted day 41. Hub checklist station from day 1.

#### Time to first landing

41.3s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $408,885.

`▂▁▁▁▁▁▁▁▂▂▂▂▂▂▂▂▂▂▂▂▃▃▃▄▄▄▄▅▅▅▆▆▆▆▆▇▇▇▇▇▇▇████`  $2,469 → $408,885

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 4 | $18,175 |
| 8 | $36,814 |
| 12 | $53,947 |
| 16 | $63,305 |
| 20 | $99,304 |
| 24 | $164,980 |
| 28 | $235,328 |
| 32 | $290,312 |
| 36 | $347,336 |
| 40 | $368,541 |
| 44 | $396,186 |
| 45 | $408,885 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 0.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 50.9.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 4 | 12 | 70 | 79 |
| 8 | 0 | — | 79 |
| 12 | 2 | 75.5 | 84 |
| 16 | 1 | 62 | 81 |
| 20 | 1 | 63 | 83 |
| 24 | 16 | 67.8 | 82 |
| 28 | 42 | 37.3 | 78 |
| 32 | 50 | 57.3 | 79 |
| 36 | 62 | 46.1 | 76 |
| 40 | 63 | 13.2 | 67 |
| 44 | 41 | 7.8 | 67 |
| 45 | 93 | 43.3 | 65 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 90.7 | 0 | 13.8s | 0 | 0 |
| 38.4 | 36 | 6633.8s | 3 | 38 |
| 38.1 | 0 | 31.3s | 1 | 4 |
| 30 | 44 | 8023.8s | 4 | 37 |
| 29.6 | 41 | 7385s | 4 | 67 |
| 29.3 | 43 | 7841.3s | 4 | 72 |
| 28.5 | 42 | 7658.8s | 4 | 67 |
| 28.1 | 40 | 7293.8s | 5 | 77 |

#### Anything the bot could not do

263 failed commands.

- acceptContract ×128 — Harbor Heli signed, and they will remember the squeeze.
- acceptContract ×94 — Harbor Heli signed.
- acceptContract ×26 — Alpine Swift signed.
- stamp ×11 — runway: That strip sits inside runway clearance. Leave the shoulder empty.
- acceptContract ×1 — Zoomjet needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Zoomjet signed.
- acceptContract ×1 — Alpine Swift needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Harbor Heli needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks

Built:

- Runway strips 2, stands 6, terminal tiles 9, snack bars 1
- Shop units 5, leased 5, flights completed 143
- Signed: air_regional_1
- Rooms: checkin 2, security 2, gate 2, bagclaim 1, food 2, souvenir 2, bagdrop 1, lounge 1, bathroom 3, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 149 points, 45 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, landside-4, retail-4, safety-4, terminal-4, airfield-5, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, airside-5, landside-5, retail-5, safety-5, spec-cargo-4, terminal-5, spec-green-3, spec-hub-3).
Desks: 3 agents, check-in empty, security staffed.
Queues at the end: check-in 0, security 15. Peaks: check-in 2, security 15.
Check-in: Check-in · 2 of 2 desks staffed · 2 in use · Queue 5 · wait 16s · Throughput 25.8/min · Desk 1 · queue 4 · wait 16s · in use · Desk 2 · queue 1 · wait 11s · in use
Security: Security · 2 of 2 lanes staffed · 2 in use · Queue 4 · wait 20s · Throughput 40.0/min · Lane 1 · queue 4 · wait 20s · in use · Lane 2 · queue 0 · wait 4s · in use
Curb: pressure 0.8 (peak 2.4), queue 0 (peak 8.3), delay 0s, lanes 2, bus bays 1, curb lanes 1, taxi ranks 1.
Happiness peak 75.5. Guest peak 93. Field-ask fines booked at the full rate: 0. Penalties total $-27,146.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 1.

Measured room rate: 0.28 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.28 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.42 RP/s with 1 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 78 | 462 | 0 | 0 | 78 | 1004 |
| 45 | 149 | 681 | 0 | 0 | 149 | 2053.18 |

End of run: desk 149 balance / 681 earned, Wave 3 0 balance / 0 earned, Growth 149 balance / 2053.18 earned.

Old research desk nodes bought:

- day 2: De-ice ops (deice) for 34 points
- day 3: Belts and sorter (bag_sorter) for 32 points
- day 3: Kiosks and bag drop (self_service) for 22 points
- day 4: Stand classes (stand_class) for 40 points
- day 4: Widebody ops (widebody_ops) for 48 points
- day 5: Travelators (travelator) for 26 points
- day 7: Hydrant fuel system (hydrant_fuel) for 36 points
- day 13: Tank farm II (tank_farm_ii) for 30 points
- day 14: Transfer Centre (transfer_centre) for 36 points
- day 16: RFID bag line (rfid_bag_line) for 52 points
- day 22: Scanner lanes (ct_lanes) for 28 points
- day 37: Hangar MRO (mro_hangar) for 72 points
- day 40: Military ramp (mil_ramp) for 42 points
- day 42: Skywalks (skywalk) for 34 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 1: Hall shell (terminal-1) for 0 points
- day 2: De-ice pad (airfield-2) for 26 points
- day 3: Processing (terminal-2) for 26 points
- day 4: Large stands (airfield-3) for 38 points
- day 5: Concourse (terminal-3) for 38 points
- day 6: Heavy runway (airfield-4) for 54 points
- day 7: Fuel farm (airside-1) for 0 points
- day 8: Curb road (landside-1) for 0 points
- day 9: Catering kitchen (airside-2) for 26 points
- day 10: Inn (landside-2) for 26 points
- day 11: GSE depot (airside-3) for 38 points
- day 12: Long-stay park (landside-3) for 38 points
- day 13: Wide hangar (airside-4) for 54 points
- day 14: Transfer Centre (retail-1) for 0 points
- day 15: ARFF station (safety-1) for 0 points
- day 16: RFID bag line (retail-2) for 26 points
- day 17: Police post (safety-2) for 26 points
- day 18: Food hall (retail-3) for 38 points
- day 19: Guard lanes (safety-3) for 38 points
- day 20: Bus station (landside-4) for 54 points
- day 21: Lounge (retail-4) for 54 points
- day 22: Security hall (safety-4) for 54 points
- day 23: Jet bridge (terminal-4) for 54 points
- day 24: Control tower (airfield-5) for 76 points
- day 25: Specialisation charter (spec-charter) for 0 points
- day 26: Freight shed (spec-cargo-1) for 26 points
- day 27: Night freight (spec-cargo-2) for 38 points
- day 28: SAF blend (spec-green-1) for 39 points
- day 29: Transfer bank (spec-hub-1) for 39 points
- day 30: Fast turn (spec-lowcost-1) for 39 points
- day 31: Premium lane (spec-premium-1) for 39 points
- day 32: Sorter (spec-cargo-3) for 54 points
- day 33: Quiet hours (spec-green-2) for 57 points
- day 34: Wave scheduling (spec-hub-2) for 57 points
- day 35: Remote stand (spec-lowcost-2) for 57 points
- day 36: Fast track (spec-premium-2) for 57 points
- day 37: MRO bay (airside-5) for 76 points
- day 38: Rail spur (landside-5) for 76 points
- day 39: Seating (retail-5) for 76 points
- day 40: Incident drill (safety-5) for 76 points
- day 41: Freighter stand (spec-cargo-4) for 76 points
- day 42: Skywalk (terminal-5) for 76 points
- day 43: Electric GSE (spec-green-3) for 81 points
- day 44: Minimum connect (spec-hub-3) for 81 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| payroll | $-442,109 |
| construction | $-376,900 |
| building_upkeep | $-101,227 |
| fuel_purchase | $-39,748 |
| land_holding | $-29,338 |
| loan_repayment | $-26,400 |
| staff_hiring | $-18,400 |
| city_levy | $-18,327 |
| emergency_refuse | $-11,200 |
| security_shock | $-8,800 |
| penalties | $-7,146 |
| loan_interest | $-7,040 |
| retail_cogs | $-6,351 |
| parking_fees | $16,740 |
| level_reward | $20,500 |
| baggage_fees | $21,364 |
| loan_proceeds | $25,000 |
| task_rewards | $38,900 |
| passenger_fees | $40,589 |
| retail_sales | $80,012 |
| fuel_sales | $161,025 |
| landside_fees | $175,200 |
| contract_fees | $261,432 |
| landing_fees | $493,109 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 51.5 | warm | 3 Trusted |


- taxi-out recoveries cleared 0 stalls; teleport entries: 0

### Greedy expander

standard / pax, sandbox off. Requested 60 sim days, ran 60. 8640 ticks in 91.1s wall.

Flights 195 (3.3/day). Diverts 0 (connection diverts 0). Go-arounds 0. Missed-connection cash $0. Curb crossed 1 on day 21. Fuel groundings 0. Tree complete day 53. Preferred day 16, Trusted day 34. Hub checklist station from day 1.

#### Time to first landing

42.5s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $57,180.

`▂▁▁▁▁▁▂▁▁▁▁▁▂█▃▃▂▁▁▂▂▁▂▂▃▁▂▂▁▁▂`  $6,755 → $351,640

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 5 | $12,687 |
| 10 | $21,954 |
| 15 | $42,705 |
| 20 | $24,478 |
| 25 | $10,964 |
| 30 | $116,192 |
| 35 | $16,784 |
| 40 | $80,001 |
| 45 | $47,518 |
| 50 | $26,972 |
| 55 | $87,979 |
| 60 | $57,180 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 3.

Recovered:

- LIF154 taxi_out for 43s step=none cleared at 1828s
- LIF154 stuck on the ground step=none cleared at 1829s
- PDJ244 taxi_out for 41s step=none cleared at 7360s
- PDJ255 taxi_out for 41s step=none cleared at 8066s
- PDJ255 stuck on the ground step=none cleared at 8069s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 42.5.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 5 | 15 | 70 | 85 |
| 10 | 15 | 70 | 88 |
| 15 | 13 | 64.8 | 87 |
| 20 | 30 | 64.9 | 85 |
| 25 | 18 | 69.7 | 87 |
| 30 | 32 | 18.4 | 74 |
| 35 | 41 | 17.7 | 73 |
| 40 | 57 | 26.2 | 69 |
| 45 | 75 | 34.7 | 66 |
| 50 | 47 | 18.7 | 69 |
| 55 | 61 | 29.3 | 63 |
| 60 | 51 | 25.1 | 64 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 43.8 | 26 | 4846.3s | 5 | 41 |
| 39 | 46 | 8436.3s | 5 | 67 |
| 36.6 | 27 | 4970s | 5 | 49 |
| 35.8 | 53 | 9572.5s | 5 | 56 |
| 35.7 | 51 | 9186.3s | 6 | 82 |
| 35.7 | 54 | 9773.8s | 5 | 79 |
| 35.1 | 47 | 8496.3s | 5 | 87 |
| 34 | 50 | 9135s | 6 | 66 |

#### Anything the bot could not do

673 failed commands.

- acceptContract ×218 — Harbor Heli signed, and they will remember the squeeze.
- acceptContract ×101 — Harbor Heli signed.
- buyParcel ×69 — Parcel locked — reach Field Level 5 first.
- acceptContract ×14 — Alpine Swift signed.
- buyResearch ×12 — Already unlocked.
- buyParcel ×7 — Parcel locked — reach Field Level 2 first.
- buyParcel ×5 — Need Fringe plot 4-4 — short 26315.
- buyParcel ×4 — Need Fringe plot 4-3 — short 37988.
- buyResearch ×3 — Need 108 RP (have 3).
- buyParcel ×3 — Need Fringe plot 3-4 — short 8502.
- buyParcel ×3 — Need Fringe plot 4-2 — short 36313.
- buyParcel ×3 — Need Fringe plot 4-3 — short 12433.
- buyParcel ×3 — Need Fringe plot 4-4 — short 52597.
- acceptContract ×2 — Zoomjet signed.
- buyParcel ×2 — Need Fringe plot 3-4 — short 20183.
- buyParcel ×2 — Need Fringe plot 4-2 — short 43425.
- buyParcel ×2 — Need Fringe plot 4-2 — short 24288.
- buyParcel ×2 — Need Fringe plot 4-2 — short 7430.
- buyParcel ×2 — Need Fringe plot 4-3 — short 56459.
- buyParcel ×2 — Need Fringe plot 4-3 — short 44498.
- buyParcel ×2 — Need Fringe plot 4-3 — short 12398.
- buyParcel ×2 — Need Fringe plot 4-3 — short 5104.
- buyParcel ×2 — Need Fringe plot 4-4 — short 41955.
- buyParcel ×2 — Need Fringe plot 4-4 — short 41823.
- buyParcel ×2 — Need Fringe plot 4-4 — short 17893.
- buyParcel ×2 — Need Fringe plot 4-4 — short 9008.
- buyParcel ×2 — Need Approach plot 4-1 — short 70179.
- buyParcel ×2 — Need Approach plot 4-1 — short 70165.
- acceptContract ×1 — Zoomjet needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Alpine Swift needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Harbor Heli needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- buyResearch ×1 — Need 76 RP (have 3).
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyResearch ×1 — Need 54 RP (have 4).
- buyResearch ×1 — Need 76 RP (have 0).
- buyResearch ×1 — Need 108 RP (have 5).
- buyParcel ×1 — Need Approach plot 2-1 — short 1466.
- buyParcel ×1 — Need Approach plot 3-1 — short 11296.
- buyParcel ×1 — Need Approach plot 3-1 — short 7817.

Built:

- Runway strips 2, stands 8, terminal tiles 9, snack bars 2
- Shop units 8, leased 2, flights completed 195
- Signed: air_regional_1
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 3, souvenir 3, bagdrop 1, lounge 1, bathroom 2, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 324 points, 63 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airfield-5, terminal-5, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, airside-5, landside-5, airfield-6, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, retail-5, safety-5, airside-6, landside-6, retail-6, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, spec-cargo-4, spec-green-3, spec-hub-3, spec-lowcost-3, spec-premium-3, safety-6, spec-cargo-5, terminal-6, spec-green-4, spec-hub-4, spec-lowcost-4, spec-premium-4, airside-7, spec-green-5, spec-hub-5, spec-lowcost-5, spec-premium-5).
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 0, security 0. Peaks: check-in 2, security 5.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 3.9 (peak 4), queue 18 (peak 18), delay 69s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 75.9. Guest peak 82. Field-ask fines booked at the full rate: 0. Penalties total $-41,060.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 1.

Measured room rate: 0.28 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.28 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.42 RP/s with 1 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 60 | 833 | 0 | 0 | 60 | 2315.33 |
| 45 | 67 | 990 | 0 | 0 | 67 | 3499.68 |
| 60 | 324 | 1247 | 0 | 0 | 324 | 4404.54 |

End of run: desk 324 balance / 1247 earned, Wave 3 0 balance / 0 earned, Growth 324 balance / 4404.54 earned.

Old research desk nodes bought:

- day 1: De-ice ops (deice) for 34 points
- day 1: Belts and sorter (bag_sorter) for 32 points
- day 1: Kiosks and bag drop (self_service) for 22 points
- day 1: Stand classes (stand_class) for 40 points
- day 1: Widebody ops (widebody_ops) for 48 points
- day 2: Travelators (travelator) for 26 points
- day 5: Skywalks (skywalk) for 34 points
- day 6: Hydrant fuel system (hydrant_fuel) for 36 points
- day 7: Tank farm II (tank_farm_ii) for 30 points
- day 9: Hangar MRO (mro_hangar) for 72 points
- day 11: Heavy metal pack (heavy_pack) for 55 points
- day 11: Tank farm III (tank_farm_iii) for 46 points
- day 14: Scanner lanes (ct_lanes) for 28 points
- day 15: Transfer Centre (transfer_centre) for 36 points
- day 16: RFID bag line (rfid_bag_line) for 52 points
- day 16: Military ramp (mil_ramp) for 42 points
- day 18: Night bank (night_bank) for 28 points
- day 18: Fuel rail (rail_fuel) for 44 points
- day 18: Cargo night hub (cargo_night_hub) for 68 points
- day 33: E-gates (egates) for 40 points
- day 36: Automated baggage (bag_bhs) for 58 points
- day 36: People mover (people_mover) for 52 points
- day 44: pipeline_fuel (pipeline_fuel) for 0 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 1: De-ice pad (airfield-2) for 26 points
- day 1: Processing (terminal-2) for 26 points
- day 1: Large stands (airfield-3) for 38 points
- day 2: Concourse (terminal-3) for 38 points
- day 3: Heavy runway (airfield-4) for 54 points
- day 3: Jet bridge (terminal-4) for 54 points
- day 4: Control tower (airfield-5) for 76 points
- day 5: Skywalk (terminal-5) for 76 points
- day 6: Fuel farm (airside-1) for 0 points
- day 6: Curb road (landside-1) for 0 points
- day 6: Catering kitchen (airside-2) for 26 points
- day 6: Inn (landside-2) for 26 points
- day 6: GSE depot (airside-3) for 38 points
- day 7: Long-stay park (landside-3) for 38 points
- day 7: Wide hangar (airside-4) for 54 points
- day 8: Bus station (landside-4) for 54 points
- day 9: MRO bay (airside-5) for 76 points
- day 10: Rail spur (landside-5) for 76 points
- day 11: Code E pier (airfield-6) for 108 points
- day 12: Transfer Centre (retail-1) for 0 points
- day 12: ARFF station (safety-1) for 0 points
- day 12: RFID bag line (retail-2) for 26 points
- day 12: Police post (safety-2) for 26 points
- day 13: Food hall (retail-3) for 38 points
- day 13: Guard lanes (safety-3) for 38 points
- day 14: Lounge (retail-4) for 54 points
- day 14: Security hall (safety-4) for 54 points
- day 15: Seating (retail-5) for 76 points
- day 16: Incident drill (safety-5) for 76 points
- day 18: Night bank (airside-6) for 108 points
- day 19: Airport hotel (landside-6) for 108 points
- day 20: Comfort (retail-6) for 108 points
- day 21: Specialisation charter (spec-charter) for 0 points
- day 21: Freight shed (spec-cargo-1) for 26 points
- day 21: Night freight (spec-cargo-2) for 38 points
- day 22: SAF blend (spec-green-1) for 39 points
- day 22: Transfer bank (spec-hub-1) for 39 points
- day 23: Fast turn (spec-lowcost-1) for 39 points
- day 23: Premium lane (spec-premium-1) for 39 points
- day 24: Sorter (spec-cargo-3) for 54 points
- day 25: Quiet hours (spec-green-2) for 57 points
- day 25: Wave scheduling (spec-hub-2) for 57 points
- day 26: Remote stand (spec-lowcost-2) for 57 points
- day 27: Fast track (spec-premium-2) for 57 points
- day 28: Freighter stand (spec-cargo-4) for 76 points
- day 29: Electric GSE (spec-green-3) for 81 points
- day 30: Minimum connect (spec-hub-3) for 81 points
- day 31: Thin lounge (spec-lowcost-3) for 81 points
- day 32: VIP room (spec-premium-3) for 81 points
- day 33: Hardened perimeter (safety-6) for 108 points
- day 35: Cargo airline (spec-cargo-5) for 108 points
- day 36: People mover (terminal-6) for 108 points
- day 37: Rail first (spec-green-4) for 114 points
- day 39: Hub pier (spec-hub-4) for 114 points
- day 40: High frequency (spec-lowcost-4) for 114 points
- day 42: Bridge service (spec-premium-4) for 114 points
- day 44: Fuel pipeline (airside-7) for 154 points
- day 46: Green report (spec-green-5) for 162 points
- day 48: Alliance desk (spec-hub-5) for 162 points
- day 50: Low-cost deal (spec-lowcost-5) for 162 points
- day 52: Flagship deal (spec-premium-5) for 162 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-1,387,882 |
| payroll | $-689,828 |
| loan_repayment | $-184,135 |
| building_upkeep | $-147,826 |
| land_holding | $-81,013 |
| fuel_purchase | $-50,864 |
| loan_interest | $-45,850 |
| staff_hiring | $-19,700 |
| penalties | $-16,260 |
| emergency_refuse | $-14,400 |
| retail_cogs | $-10,379 |
| security_shock | $-6,400 |
| crash_fine | $-4,000 |
| city_levy | $-1,022 |
| catering_fees | $12,397 |
| parking_fees | $21,483 |
| baggage_fees | $28,607 |
| level_reward | $30,500 |
| task_rewards | $38,900 |
| passenger_fees | $50,720 |
| retail_sales | $126,202 |
| fuel_sales | $199,671 |
| landside_fees | $259,200 |
| loan_proceeds | $365,000 |
| contract_fees | $516,540 |
| landing_fees | $899,520 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 86.7 | partner | 4 Priority |


- taxi-out recoveries cleared 3 stalls; teleport entries: 0

### Chaotic random clicker

standard / pax, sandbox off. Requested 30 sim days, ran 30. 4320 ticks in 26.7s wall.

Flights 68 (2.3/day). Diverts 0 (connection diverts 0). Go-arounds 0. Missed-connection cash $0. Curb crossed 1 on day 24. Fuel groundings 0. Tree complete day —. Preferred day —, Trusted day —. Hub checklist station from day 2.

#### Time to first landing

80s (day 0) — LIF101 entered landing.

#### Cash curve

Start $168,000 · end $142,546.

`▇▃▁▁▁▁▁▁▁▁▁▁▁▁▂▂▂▂▂▂▁▂▂▃▃▃▃▃███`  $-2,086 → $145,500

| Day | Cash |
| --- | --- |
| 0 | $118,000 |
| 3 | $963 |
| 6 | $2,976 |
| 9 | $3,631 |
| 12 | $4,620 |
| 15 | $27,509 |
| 18 | $8,960 |
| 21 | $13,575 |
| 24 | $32,821 |
| 27 | $44,328 |
| 30 | $142,546 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 0.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 65.3.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 3 | 0 | — | 71 |
| 6 | 18 | 71.2 | 67 |
| 9 | 18 | 70 | 73 |
| 12 | 18 | 64.6 | 71 |
| 15 | 36 | 70 | 71 |
| 18 | 18 | 67.9 | 65 |
| 21 | 38 | 62.4 | 64 |
| 24 | 46 | 68.5 | 65 |
| 27 | 17 | 52 | 63 |
| 30 | 28 | 51.5 | 63 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 21.8 | 0 | 38.8s | 0 | 0 |
| 21.3 | 28 | 5182.5s | 5 | 45 |
| 20.1 | 21 | 3893.8s | 3 | 3 |
| 20 | 20 | 3755s | 3 | 42 |
| 18.8 | 22 | 3985s | 3 | 42 |
| 17.2 | 22 | 4076.3s | 4 | 64 |
| 16.8 | 25 | 4545s | 5 | 25 |
| 16.5 | 24 | 4350s | 5 | 61 |

#### Anything the bot could not do

41 failed commands.

- hireJanitor ×20 — Janitor crew maxed (6).
- acceptContract ×7 — Puddle Jumper Airlines signed.
- hireJanitor ×1 — Need hire janitor — short 1142.
- hireJanitor ×1 — Need hire janitor — short 3200.
- buyRoom ×1 — Need Gate hold — short 2600.
- buyRoom ×1 — Need Hall food — short 3651.
- acceptContract ×1 — Puddle Jumper Airlines needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- buyRoom ×1 — Need Hall food — short 2567.
- buyRoom ×1 — Need Check-in — short 2804.
- hireJanitor ×1 — Need hire janitor — short 3070.
- hireJanitor ×1 — Need hire janitor — short 152.
- buyRoom ×1 — Need Research desk — short 3038.
- buyRoom ×1 — Need Hall food — short 2327.
- buyRoom ×1 — Need Airline lounge — short 4527.
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.

Built:

- Runway strips 1, stands 10, terminal tiles 9, snack bars 8
- Shop units 14, leased 12, flights completed 68
- Signed: zoomjet
- Rooms: checkin 4, security 4, gate 10, bagclaim 1, food 2, souvenir 4, bagdrop 1, lounge 2, bathroom 7, rdesk 5, rboard 7, rmachine 7

#### New systems

Research tree: 52 points, 37 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airfield-5, terminal-5, airfield-6, terminal-6, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, airside-5, landside-5, airside-6, landside-6, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, retail-5, safety-5, retail-6, safety-6, airside-7).
Desks: 3 agents, check-in empty, security staffed.
Queues at the end: check-in 0, security 0. Peaks: check-in 3, security 7.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 1 (peak 1.3), queue 0.5 (peak 0.5), delay 2s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 71.2. Guest peak 64. Field-ask fines booked at the full rate: 0. Penalties total $-60,100.

#### Research pools

Lab furniture at the end: 5 research desks, 7 chalkboards, 7 lab benches. Researchers on payroll: 0.

Measured room rate: 0.46 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 0 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.16 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.16 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 52 | 887 | 0 | 0 | 52 | 2018 |

End of run: desk 52 balance / 887 earned, Wave 3 0 balance / 0 earned, Growth 52 balance / 2018 earned.

Old research desk nodes bought:

- day 1: De-ice ops (deice) for 34 points
- day 1: Belts and sorter (bag_sorter) for 32 points
- day 1: Kiosks and bag drop (self_service) for 22 points
- day 2: Stand classes (stand_class) for 40 points
- day 2: Widebody ops (widebody_ops) for 48 points
- day 3: Travelators (travelator) for 26 points
- day 7: Skywalks (skywalk) for 34 points
- day 9: Heavy metal pack (heavy_pack) for 55 points
- day 9: Tank farm III (tank_farm_iii) for 46 points
- day 11: Automated baggage (bag_bhs) for 58 points
- day 11: People mover (people_mover) for 52 points
- day 11: Hydrant fuel system (hydrant_fuel) for 36 points
- day 14: Tank farm II (tank_farm_ii) for 30 points
- day 15: Hangar MRO (mro_hangar) for 72 points
- day 18: Night bank (night_bank) for 28 points
- day 18: Fuel rail (rail_fuel) for 44 points
- day 18: Cargo night hub (cargo_night_hub) for 68 points
- day 23: Scanner lanes (ct_lanes) for 28 points
- day 25: Military ramp (mil_ramp) for 42 points
- day 27: E-gates (egates) for 40 points
- day 29: pipeline_fuel (pipeline_fuel) for 0 points

Wave 3 R&D: no nodes bought.

Growth tree nodes bought:

- day 0: Apron charter (airfield-1) for 0 points
- day 0: Hall shell (terminal-1) for 0 points
- day 1: De-ice pad (airfield-2) for 26 points
- day 1: Processing (terminal-2) for 26 points
- day 2: Large stands (airfield-3) for 38 points
- day 3: Concourse (terminal-3) for 38 points
- day 4: Heavy runway (airfield-4) for 54 points
- day 5: Jet bridge (terminal-4) for 54 points
- day 6: Control tower (airfield-5) for 76 points
- day 7: Skywalk (terminal-5) for 76 points
- day 9: Code E pier (airfield-6) for 108 points
- day 11: People mover (terminal-6) for 108 points
- day 11: Fuel farm (airside-1) for 0 points
- day 11: Curb road (landside-1) for 0 points
- day 11: Catering kitchen (airside-2) for 26 points
- day 12: Inn (landside-2) for 26 points
- day 12: GSE depot (airside-3) for 38 points
- day 13: Long-stay park (landside-3) for 38 points
- day 14: Wide hangar (airside-4) for 54 points
- day 14: Bus station (landside-4) for 54 points
- day 15: MRO bay (airside-5) for 76 points
- day 16: Rail spur (landside-5) for 76 points
- day 18: Night bank (airside-6) for 108 points
- day 19: Airport hotel (landside-6) for 108 points
- day 20: Transfer Centre (retail-1) for 0 points
- day 20: ARFF station (safety-1) for 0 points
- day 20: RFID bag line (retail-2) for 26 points
- day 21: Police post (safety-2) for 26 points
- day 21: Food hall (retail-3) for 38 points
- day 21: Guard lanes (safety-3) for 38 points
- day 22: Lounge (retail-4) for 54 points
- day 23: Security hall (safety-4) for 54 points
- day 24: Seating (retail-5) for 76 points
- day 25: Incident drill (safety-5) for 76 points
- day 26: Comfort (retail-6) for 108 points
- day 27: Hardened perimeter (safety-6) for 108 points
- day 29: Fuel pipeline (airside-7) for 154 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-442,700 |
| payroll | $-203,146 |
| loan_repayment | $-53,447 |
| building_upkeep | $-46,804 |
| penalties | $-29,300 |
| fuel_purchase | $-26,824 |
| staff_hiring | $-26,400 |
| loan_interest | $-14,033 |
| land_holding | $-13,126 |
| security_shock | $-12,000 |
| emergency_refuse | $-10,800 |
| crash_fine | $-8,000 |
| retail_cogs | $-5,536 |
| catering_fees | $4,350 |
| baggage_fees | $6,084 |
| level_reward | $6,500 |
| parking_fees | $8,352 |
| task_rewards | $22,800 |
| passenger_fees | $48,300 |
| retail_sales | $70,342 |
| landside_fees | $86,400 |
| fuel_sales | $96,776 |
| loan_proceeds | $135,000 |
| landing_fees | $166,572 |
| contract_fees | $215,185 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Zoomjet | -6.5 | neutral | 1 Published |
| Puddle Jumper Airlines | -9 | neutral | 1 Published |


- Driver put the clock back to 5× after the persona touched the speed buttons.
- taxi-out recoveries cleared 0 stalls; teleport entries: 0

## Browser smoke

Scripted opening finished.

Opening played through the first landing.

Wall 130.7s. Clock ended at 160s.

#### Time to first landing

18.4s.

#### Cash curve

Ended at $60,241.

▄  $27,500

#### Stuck or recovered

None still stuck.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness 62.

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 14.7 | 0 | 9.8s | 1 | 16 |
| 10.1 | 0 | 8.2s | 1 | 16 |
| 8.4 | 0 | 51.1s | 1 | 28 |
| 8.3 | 0 | 21.9s | 1 | 12 |
| 8.2 | 0 | 10.6s | 1 | 17 |
| 8.2 | 0 | 24.6s | 1 | 14 |
| 8.2 | 0 | 45s | 1 | 28 |
| 8.2 | 0 | 54.6s | 1 | 28 |

#### Anything the bot could not do

Scripted clicks landed.

Script:

- open http://127.0.0.1:45991/?playtest=1
- sandbox off
- new game
- passenger start
- starter kit stamped from the coach
- phone preview flashed
- open contract letter
- accept contract
- open airfield tray
- select taxiway
- click the field
- open services menu
- services tab
- open shops menu
- shops tab
- furnish Hall food
- furnish Souvenirs
- terminal view
- 5x

Screenshots:

- docs/playtest/bots/smoke/01-title.png
- docs/playtest/bots/smoke/02-route.png
- docs/playtest/bots/smoke/03-field.png
- docs/playtest/bots/smoke/04-kit.png
- docs/playtest/bots/smoke/05-contract.png
- docs/playtest/bots/smoke/06-accepted.png
- docs/playtest/bots/smoke/07-services.png
- docs/playtest/bots/smoke/07b-hall.png
- docs/playtest/bots/smoke/08-five-minutes.png

- Coach stamped the starter kit on the empty plot.
- Sim clock reached 155s before the 90s wall cap (target 300s).
- Opening check passed. Screenshots: /workspace/docs/playtest/opening/01-title.png, /workspace/docs/playtest/opening/02-plot.png, /workspace/docs/playtest/opening/03-coach.png, /workspace/docs/playtest/opening/04-runway-refused.png, /workspace/docs/playtest/opening/05-kit-stamped.png, /workspace/docs/playtest/opening/06-contract.png, /workspace/docs/playtest/opening/07-landing.png, /workspace/docs/playtest/opening/08-pause.png
