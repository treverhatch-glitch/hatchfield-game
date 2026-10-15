# Hatchfield bot playtest

Generated 2026-10-15T03:29:57.051Z.

Headless bots use the player command API (new game, land, starter kit, the Apex Local fuel term, tile stamps, hall rooms, contract letters, loans, shop bids, the Growth research tree, desk agents, and a curb reaction) and run at 5×. One sim day is 180s. Tick dt is 0.25s. Once the day-1 research trickle banks a whole point, each persona furnishes a research desk, then a chalkboard, then a lab bench, when the hall exists and cash covers the catalog price. Careful and Greedy then hire one researcher. When a tree node is affordable they buy the cheapest one. They hire desk agents until check-in and security are both staffed. Careful and Greedy, once cash is above three times the stamp and the airfield says Over the runway or curb or stand pressure is above 1, build a second runway and two more stands. Careful, when that expansion is not affordable and the curb pressure is over 1, adds a bus bay, then a taxi rank, then a curb lane instead of that day's other stamp.

## Headless personas

### Careful

standard / pax, sandbox off. Requested 45 sim days, ran 45. 6480 ticks in 66.5s wall.

Flights 157 (3.5/day). Diverts 13 (connection diverts 6). Go-arounds 45. Missed-connection cash -$16,740. Curb crossed 1 on day 21. Fuel groundings 0. Tree complete day —. Preferred day 16, Trusted day —. Hub checklist station from day 1.

#### Time to first landing

41.3s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $491,042.

`▂▁▁▁▁▁▁▁▂▂▂▂▂▂▂▁▂▂▂▂▃▃▃▄▄▄▄▅▅▅▅▅▅▅▆▆▆▆▇▇▇▇▇███`  $2,464 → $491,042

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 4 | $19,972 |
| 8 | $47,468 |
| 12 | $77,248 |
| 16 | $52,101 |
| 20 | $118,823 |
| 24 | $196,711 |
| 28 | $273,418 |
| 32 | $304,278 |
| 36 | $361,397 |
| 40 | $417,585 |
| 44 | $480,804 |
| 45 | $491,042 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 0.

Recovered:

- PDJ231 hold for 73s step=none cleared at 5484s
- PDJ231 stuck in the hold step=none cleared at 5486s
- PDJ236 hold for 95s step=none cleared at 5716s
- PDJ236 stuck in the hold step=none cleared at 5719s
- PDJ240 hold for 65s step=none cleared at 5794s
- PDJ240 stuck in the hold step=none cleared at 5796s
- PDJ240 hold for 95s step=none cleared at 5885s
- PDJ240 stuck in the hold step=none cleared at 5886s
- PDJ263 hold for 95s step=none cleared at 6536s
- PDJ263 stuck in the hold step=none cleared at 6539s
- PDJ271 hold for 85s step=none cleared at 6795s
- PDJ271 stuck in the hold step=none cleared at 6796s
- … 14 more

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 50.4.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 4 | 12 | 70 | 78 |
| 8 | 11 | 70 | 81 |
| 12 | 13 | 69 | 81 |
| 16 | 15 | 70.7 | 82 |
| 20 | 13 | 68.7 | 79 |
| 24 | 13 | 75.8 | 79 |
| 28 | 51 | 44 | 75 |
| 32 | 112 | 13.8 | 64 |
| 36 | 87 | 31 | 61 |
| 40 | 97 | 20.4 | 61 |
| 44 | 129 | 21.4 | 61 |
| 45 | 119 | 23.6 | 60 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 96.5 | 0 | 13.8s | 0 | 0 |
| 47.9 | 36 | 6588.8s | 4 | 99 |
| 44.1 | 37 | 6836.3s | 5 | 115 |
| 42.8 | 38 | 6953.8s | 4 | 132 |
| 42.5 | 40 | 7227.5s | 4 | 96 |
| 42 | 41 | 7386.3s | 4 | 133 |
| 41.9 | 0 | 31.3s | 1 | 4 |
| 39.3 | 43 | 7763.8s | 3 | 111 |

#### Anything the bot could not do

254 failed commands.

- acceptContract ×134 — Harbor Heli signed, and they will remember the squeeze.
- acceptContract ×106 — Harbor Heli signed.
- acceptContract ×8 — Alpine Swift signed.
- stamp ×2 — runway: That strip sits inside runway clearance. Leave the shoulder empty.
- acceptContract ×1 — Zoomjet needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Zoomjet signed.
- acceptContract ×1 — Alpine Swift needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Harbor Heli needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks

Built:

- Runway strips 2, stands 6, terminal tiles 9, snack bars 1
- Shop units 5, leased 5, flights completed 157
- Signed: air_regional_1
- Rooms: checkin 2, security 2, gate 2, bagclaim 1, food 2, souvenir 2, bagdrop 1, lounge 1, bathroom 3, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 147 points, 45 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, airfield-4, airside-4, landside-4, retail-4, safety-4, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, terminal-4, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, airfield-5, airside-5, landside-5, retail-5, safety-5, spec-cargo-4, terminal-5, spec-green-3, spec-hub-3).
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 0, security 0. Peaks: check-in 2, security 3.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 1 in use · Queue 0 · wait 2s · Throughput 20.0/min · Lane 1 · queue 0 · wait 2s · in use · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 0.8 (peak 2.1), queue 0 (peak 6.1), delay 0s, lanes 2, bus bays 1, curb lanes 1, taxi ranks 1.
Happiness peak 75.9. Guest peak 133. Field-ask fines booked at the full rate: 0. Penalties total $-202,826.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 1.

Measured room rate: 0.28 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.28 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.42 RP/s with 1 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 108 | 492 | 0 | 0 | 108 | 982 |
| 45 | 147 | 679 | 0 | 0 | 147 | 2051.8 |

End of run: desk 147 balance / 679 earned, Wave 3 0 balance / 0 earned, Growth 147 balance / 2051.8 earned.

Old research desk nodes bought:

- day 2: De-ice ops (deice) for 34 points
- day 3: Belts and sorter (bag_sorter) for 32 points
- day 3: Kiosks and bag drop (self_service) for 22 points
- day 4: Stand classes (stand_class) for 40 points
- day 4: Widebody ops (widebody_ops) for 48 points
- day 5: Travelators (travelator) for 26 points
- day 6: Hydrant fuel system (hydrant_fuel) for 36 points
- day 12: Transfer Centre (transfer_centre) for 36 points
- day 14: RFID bag line (rfid_bag_line) for 52 points
- day 19: Tank farm II (tank_farm_ii) for 30 points
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
- day 6: Fuel farm (airside-1) for 0 points
- day 7: Curb road (landside-1) for 0 points
- day 8: Catering kitchen (airside-2) for 26 points
- day 9: Inn (landside-2) for 26 points
- day 10: GSE depot (airside-3) for 38 points
- day 11: Long-stay park (landside-3) for 38 points
- day 12: Transfer Centre (retail-1) for 0 points
- day 13: ARFF station (safety-1) for 0 points
- day 14: RFID bag line (retail-2) for 26 points
- day 15: Police post (safety-2) for 26 points
- day 16: Food hall (retail-3) for 38 points
- day 17: Guard lanes (safety-3) for 38 points
- day 18: Heavy runway (airfield-4) for 54 points
- day 19: Wide hangar (airside-4) for 54 points
- day 20: Bus station (landside-4) for 54 points
- day 21: Lounge (retail-4) for 54 points
- day 22: Security hall (safety-4) for 54 points
- day 23: Specialisation charter (spec-charter) for 0 points
- day 24: Freight shed (spec-cargo-1) for 26 points
- day 25: Night freight (spec-cargo-2) for 38 points
- day 26: SAF blend (spec-green-1) for 39 points
- day 27: Transfer bank (spec-hub-1) for 39 points
- day 28: Fast turn (spec-lowcost-1) for 39 points
- day 29: Premium lane (spec-premium-1) for 39 points
- day 30: Sorter (spec-cargo-3) for 54 points
- day 31: Jet bridge (terminal-4) for 54 points
- day 32: Quiet hours (spec-green-2) for 57 points
- day 33: Wave scheduling (spec-hub-2) for 57 points
- day 34: Remote stand (spec-lowcost-2) for 57 points
- day 35: Fast track (spec-premium-2) for 57 points
- day 36: Control tower (airfield-5) for 76 points
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
| payroll | $-627,503 |
| construction | $-376,900 |
| penalties | $-152,486 |
| building_upkeep | $-105,073 |
| fuel_purchase | $-54,828 |
| land_holding | $-31,358 |
| loan_repayment | $-26,400 |
| city_levy | $-22,535 |
| staff_hiring | $-18,400 |
| emergency_refuse | $-18,400 |
| missed_connection | $-16,740 |
| security_shock | $-11,200 |
| retail_cogs | $-11,069 |
| loan_interest | $-7,040 |
| crash_fine | $-4,000 |
| level_reward | $20,500 |
| loan_proceeds | $25,000 |
| parking_fees | $32,643 |
| task_rewards | $38,900 |
| baggage_fees | $42,179 |
| passenger_fees | $80,886 |
| retail_sales | $137,578 |
| landside_fees | $187,200 |
| fuel_sales | $289,845 |
| contract_fees | $335,450 |
| landing_fees | $616,793 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | -99.4 | hostile | 1 Published |


- taxi-out recoveries cleared 0 stalls; teleport entries: 0

### Greedy expander

standard / pax, sandbox off. Requested 60 sim days, ran 60. 8640 ticks in 119.4s wall.

Flights 192 (3.2/day). Diverts 45 (connection diverts 23). Go-arounds 64. Missed-connection cash -$44,640. Curb crossed 1 on day 19. Fuel groundings 0. Tree complete day 51. Preferred day 14, Trusted day —. Hub checklist station from day 1.

#### Time to first landing

42.5s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $34,240.

`▂▁▁▁▁▁▁▁▂▂▂▂▁▃▃▄▁▂▂▁▂▂▁▂▂▁▂▂▃▁▂`  $6,631 → $358,750

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 5 | $19,487 |
| 10 | $24,284 |
| 15 | $21,639 |
| 20 | $47,143 |
| 25 | $358,750 |
| 30 | $153,977 |
| 35 | $54,922 |
| 40 | $52,129 |
| 45 | $26,685 |
| 50 | $16,831 |
| 55 | $77,321 |
| 60 | $34,240 |

#### Stuck or recovered

- PDJ381 hold for 93s (since 10769s)

Taxi-out watchdog recoveries: 6.

Recovered:

- LIF145 taxi_out for 43s step=none cleared at 1170s
- LIF145 stuck on the ground step=none cleared at 1171s
- PDJ139 hold for 95s step=none cleared at 4985s
- PDJ139 stuck in the hold step=none cleared at 4986s
- PDJ230 hold for 95s step=none cleared at 5090s
- PDJ230 stuck in the hold step=none cleared at 5091s
- PDJ234 hold for 95s step=none cleared at 5463s
- PDJ234 stuck in the hold step=none cleared at 5464s
- PDJ242 hold for 95s step=none cleared at 5726s
- PDJ242 stuck in the hold step=none cleared at 5729s
- PDJ245 hold for 95s step=none cleared at 5859s
- PDJ245 stuck in the hold step=none cleared at 5861s
- … 58 more

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 38.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 5 | 11 | 77.2 | 87 |
| 10 | 2 | 59 | 86 |
| 15 | 0 | — | 85 |
| 20 | 13 | 65.6 | 83 |
| 25 | 12 | 62.6 | 84 |
| 30 | 118 | 22.2 | 74 |
| 35 | 84 | 11 | 73 |
| 40 | 90 | 6.9 | 70 |
| 45 | 117 | 31.5 | 67 |
| 50 | 111 | 15.8 | 66 |
| 55 | 110 | 16.8 | 66 |
| 60 | 90 | 13.7 | 63 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 51.3 | 40 | 7331.3s | 4 | 100 |
| 50.9 | 49 | 8988.8s | 5 | 111 |
| 48.7 | 53 | 9556.3s | 4 | 120 |
| 43.8 | 53 | 9598.8s | 3 | 133 |
| 43.2 | 54 | 9758.8s | 4 | 130 |
| 42.9 | 53 | 9576.3s | 5 | 120 |
| 42.3 | 42 | 7568.8s | 4 | 112 |
| 42.2 | 43 | 7751.3s | 3 | 93 |

#### Anything the bot could not do

660 failed commands.

- acceptContract ×219 — Harbor Heli signed, and they will remember the squeeze.
- acceptContract ×113 — Harbor Heli signed.
- buyParcel ×59 — Parcel locked — reach Field Level 5 first.
- buyResearch ×11 — Already unlocked.
- buyParcel ×7 — Parcel locked — reach Field Level 2 first.
- buyParcel ×3 — Need Approach plot 3-1 — short 13856.
- acceptContract ×2 — Zoomjet signed.
- acceptContract ×2 — Alpine Swift signed.
- buyResearch ×2 — Need 76 RP (have 2).
- buyResearch ×2 — Need 108 RP (have 0).
- acceptContract ×1 — Zoomjet needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Alpine Swift needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Harbor Heli needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- buyResearch ×1 — Need 76 RP (have 5).
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyResearch ×1 — Need 54 RP (have 5).
- buyResearch ×1 — Need 76 RP (have 1).
- buyParcel ×1 — Need Approach plot 2-1 — short 9165.
- buyParcel ×1 — Need Approach plot 2-1 — short 6283.
- buyParcel ×1 — Need Approach plot 2-1 — short 42029.
- buyResearch ×1 — Need 108 RP (have 3).
- buyParcel ×1 — Need Approach plot 3-1 — short 15721.
- buyParcel ×1 — Need Approach plot 3-1 — short 14597.
- buyParcel ×1 — Need Approach plot 3-1 — short 14549.
- buyParcel ×1 — Need Approach plot 3-1 — short 12477.
- buyParcel ×1 — Need Approach plot 3-1 — short 3644.
- stamp ×1 — runway: That strip sits inside runway clearance. Leave the shoulder empty.
- buyResearch ×1 — Need 108 RP (have 5).
- buyParcel ×1 — Need Fringe plot 4-2 — short 55277.
- buyParcel ×1 — Need Fringe plot 4-2 — short 55028.
- buyParcel ×1 — Need Fringe plot 4-2 — short 54593.
- buyParcel ×1 — Need Fringe plot 4-2 — short 54134.
- buyParcel ×1 — Need Fringe plot 4-2 — short 51734.
- buyParcel ×1 — Need Fringe plot 4-2 — short 51665.
- buyParcel ×1 — Need Fringe plot 4-2 — short 51445.
- buyParcel ×1 — Need Fringe plot 4-2 — short 50253.
- buyParcel ×1 — Need Fringe plot 4-2 — short 47312.
- buyParcel ×1 — Need Fringe plot 4-2 — short 45451.
- buyParcel ×1 — Need Fringe plot 4-2 — short 48398.

Built:

- Runway strips 2, stands 8, terminal tiles 9, snack bars 2
- Shop units 8, leased 2, flights completed 192
- Signed: air_regional_1
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 3, souvenir 3, bagdrop 1, lounge 1, bathroom 2, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 324 points, 62 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airfield-5, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, airside-5, landside-5, terminal-5, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, retail-5, safety-5, airfield-6, airside-6, landside-6, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, spec-cargo-4, spec-green-3, spec-hub-3, spec-lowcost-3, spec-premium-3, retail-6, safety-6, spec-cargo-5, terminal-6, spec-green-4, spec-hub-4, spec-lowcost-4, spec-premium-4, spec-green-5, spec-hub-5, spec-lowcost-5, spec-premium-5).
Desks: 3 agents, check-in empty, security empty.
Queues at the end: check-in 0, security 0. Peaks: check-in 3, security 9.
Check-in: Check-in · 2 of 2 desks staffed · 1 in use · Queue 2 · wait 7s · Throughput 17.8/min · Desk 1 · queue 2 · wait 7s · in use · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 3.7 (peak 3.8), queue 16.5 (peak 16.5), delay 64s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 77.2. Guest peak 130. Field-ask fines booked at the full rate: 0. Penalties total $-334,600.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 1.

Measured room rate: 0.28 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.28 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.42 RP/s with 1 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 10 | 783 | 0 | 0 | 10 | 2319.13 |
| 45 | 60 | 983 | 0 | 0 | 60 | 3500.78 |
| 60 | 324 | 1247 | 0 | 0 | 324 | 4250 |

End of run: desk 324 balance / 1247 earned, Wave 3 0 balance / 0 earned, Growth 324 balance / 4250 earned.

Old research desk nodes bought:

- day 1: De-ice ops (deice) for 34 points
- day 1: Belts and sorter (bag_sorter) for 32 points
- day 1: Kiosks and bag drop (self_service) for 22 points
- day 1: Stand classes (stand_class) for 40 points
- day 1: Widebody ops (widebody_ops) for 48 points
- day 2: Travelators (travelator) for 26 points
- day 5: Hydrant fuel system (hydrant_fuel) for 36 points
- day 6: Tank farm II (tank_farm_ii) for 30 points
- day 8: Hangar MRO (mro_hangar) for 72 points
- day 10: Skywalks (skywalk) for 34 points
- day 13: Scanner lanes (ct_lanes) for 28 points
- day 15: Military ramp (mil_ramp) for 42 points
- day 16: Transfer Centre (transfer_centre) for 36 points
- day 16: Heavy metal pack (heavy_pack) for 55 points
- day 16: Tank farm III (tank_farm_iii) for 46 points
- day 18: RFID bag line (rfid_bag_line) for 52 points
- day 18: Night bank (night_bank) for 28 points
- day 18: Fuel rail (rail_fuel) for 44 points
- day 18: Cargo night hub (cargo_night_hub) for 68 points
- day 33: E-gates (egates) for 40 points
- day 36: Automated baggage (bag_bhs) for 58 points
- day 36: People mover (people_mover) for 52 points

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
- day 5: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 5: Catering kitchen (airside-2) for 26 points
- day 5: Inn (landside-2) for 26 points
- day 5: GSE depot (airside-3) for 38 points
- day 6: Long-stay park (landside-3) for 38 points
- day 6: Wide hangar (airside-4) for 54 points
- day 7: Bus station (landside-4) for 54 points
- day 8: MRO bay (airside-5) for 76 points
- day 9: Rail spur (landside-5) for 76 points
- day 10: Skywalk (terminal-5) for 76 points
- day 10: Transfer Centre (retail-1) for 0 points
- day 10: ARFF station (safety-1) for 0 points
- day 10: RFID bag line (retail-2) for 26 points
- day 11: Police post (safety-2) for 26 points
- day 11: Food hall (retail-3) for 38 points
- day 12: Guard lanes (safety-3) for 38 points
- day 12: Lounge (retail-4) for 54 points
- day 13: Security hall (safety-4) for 54 points
- day 14: Seating (retail-5) for 76 points
- day 15: Incident drill (safety-5) for 76 points
- day 16: Code E pier (airfield-6) for 108 points
- day 18: Night bank (airside-6) for 108 points
- day 19: Airport hotel (landside-6) for 108 points
- day 19: Specialisation charter (spec-charter) for 0 points
- day 20: Freight shed (spec-cargo-1) for 26 points
- day 20: Night freight (spec-cargo-2) for 38 points
- day 20: SAF blend (spec-green-1) for 39 points
- day 21: Transfer bank (spec-hub-1) for 39 points
- day 21: Fast turn (spec-lowcost-1) for 39 points
- day 22: Premium lane (spec-premium-1) for 39 points
- day 22: Sorter (spec-cargo-3) for 54 points
- day 23: Quiet hours (spec-green-2) for 57 points
- day 24: Wave scheduling (spec-hub-2) for 57 points
- day 25: Remote stand (spec-lowcost-2) for 57 points
- day 25: Fast track (spec-premium-2) for 57 points
- day 26: Freighter stand (spec-cargo-4) for 76 points
- day 27: Electric GSE (spec-green-3) for 81 points
- day 28: Minimum connect (spec-hub-3) for 81 points
- day 29: Thin lounge (spec-lowcost-3) for 81 points
- day 30: VIP room (spec-premium-3) for 81 points
- day 32: Comfort (retail-6) for 108 points
- day 33: Hardened perimeter (safety-6) for 108 points
- day 35: Cargo airline (spec-cargo-5) for 108 points
- day 36: People mover (terminal-6) for 108 points
- day 37: Rail first (spec-green-4) for 114 points
- day 39: Hub pier (spec-hub-4) for 114 points
- day 40: High frequency (spec-lowcost-4) for 114 points
- day 42: Bridge service (spec-premium-4) for 114 points
- day 44: Green report (spec-green-5) for 162 points
- day 46: Alliance desk (spec-hub-5) for 162 points
- day 48: Low-cost deal (spec-lowcost-5) for 162 points
- day 50: Flagship deal (spec-premium-5) for 162 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-1,508,293 |
| payroll | $-937,697 |
| penalties | $-261,560 |
| loan_repayment | $-188,605 |
| building_upkeep | $-139,608 |
| land_holding | $-85,369 |
| fuel_purchase | $-68,928 |
| loan_interest | $-46,800 |
| missed_connection | $-44,640 |
| emergency_refuse | $-21,200 |
| retail_cogs | $-19,739 |
| staff_hiring | $-19,700 |
| security_shock | $-7,200 |
| city_levy | $-1,092 |
| catering_fees | $25,599 |
| level_reward | $30,500 |
| task_rewards | $38,900 |
| parking_fees | $44,361 |
| baggage_fees | $58,469 |
| passenger_fees | $108,613 |
| retail_sales | $209,299 |
| landside_fees | $266,400 |
| loan_proceeds | $365,000 |
| fuel_sales | $382,166 |
| contract_fees | $623,914 |
| landing_fees | $1,063,449 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | -98.5 | hostile | 1 Published |


- taxi-out recoveries cleared 6 stalls; teleport entries: 0

### Chaotic random clicker

standard / pax, sandbox off. Requested 30 sim days, ran 30. 4320 ticks in 30.3s wall.

Flights 91 (3/day). Diverts 0 (connection diverts 0). Go-arounds 0. Missed-connection cash $0. Curb crossed 1 on day 23. Fuel groundings 0. Tree complete day —. Preferred day 20, Trusted day —. Hub checklist station from day 2.

#### Time to first landing

80s (day 0) — LIF102 entered landing.

#### Cash curve

Start $168,000 · end $352,102.

`▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▂▂▂▂▂▂▂▂▁▂▂▂▂█▇▇`  $2,798 → $398,812

| Day | Cash |
| --- | --- |
| 0 | $118,000 |
| 3 | $6,081 |
| 6 | $7,646 |
| 9 | $5,597 |
| 12 | $7,465 |
| 15 | $35,683 |
| 18 | $43,138 |
| 21 | $40,043 |
| 24 | $43,132 |
| 27 | $71,836 |
| 30 | $352,102 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 0.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 65.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 3 | 8 | 37 | 75 |
| 6 | 17 | 75.1 | 79 |
| 9 | 18 | 64.9 | 82 |
| 12 | 18 | 70 | 80 |
| 15 | 18 | 64.5 | 79 |
| 18 | 36 | 65.3 | 78 |
| 21 | 53 | 69.5 | 77 |
| 24 | 54 | 67.9 | 73 |
| 27 | 70 | 62.8 | 71 |
| 30 | 69 | 54.1 | 73 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 40.3 | 27 | 4891.3s | 3 | 68 |
| 25.6 | 28 | 5067.5s | 3 | 101 |
| 25 | 25 | 4611.3s | 4 | 34 |
| 24.9 | 27 | 4885s | 3 | 68 |
| 24.1 | 27 | 4976.3s | 3 | 59 |
| 24 | 29 | 5250s | 3 | 60 |
| 23.9 | 24 | 4418.8s | 3 | 63 |
| 23.8 | 28 | 5206.3s | 4 | 63 |

#### Anything the bot could not do

29 failed commands.

- hireJanitor ×17 — Janitor crew maxed (6).
- acceptContract ×6 — Puddle Jumper Airlines signed.
- acceptContract ×1 — Puddle Jumper Airlines needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- buyRoom ×1 — Need Check-in — short 1839.
- buyRoom ×1 — Need Chalkboard — short 181.
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- acceptContract ×1 — Puddle Jumper Airlines signed, and they will remember the squeeze.

Built:

- Runway strips 1, stands 9, terminal tiles 22, snack bars 7
- Shop units 19, leased 5, flights completed 91
- Signed: zoomjet
- Rooms: checkin 7, security 9, gate 10, bagclaim 2, food 4, souvenir 8, bagdrop 2, lounge 5, bathroom 5, rdesk 5, rboard 8, rmachine 7

#### New systems

Research tree: 10 points, 47 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airfield-5, terminal-5, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, airside-5, landside-5, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, retail-5, safety-5, airfield-6, airside-6, landside-6, retail-6, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, spec-cargo-4).
Desks: 3 agents, check-in staffed, security empty.
Queues at the end: check-in 3, security 1. Peaks: check-in 6, security 7.
Check-in: Check-in · 2 of 2 desks staffed · 2 in use · Queue 9 · wait 25s · Throughput 25.8/min · Desk 1 · queue 6 · wait 24s · in use · Desk 2 · queue 3 · wait 25s · in use
Security: Security · 2 of 2 lanes staffed · 1 in use · Queue 0 · wait 5s · Throughput 13.3/min · Lane 1 · queue 0 · wait 5s · in use · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 1.4 (peak 1.5), queue 2.7 (peak 3), delay 11s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 77.6. Guest peak 89. Field-ask fines booked at the full rate: 0. Penalties total $-49,200.

#### Research pools

Lab furniture at the end: 5 research desks, 8 chalkboards, 7 lab benches. Researchers on payroll: 0.

Measured room rate: 0.46 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 0 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.16 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.16 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 10 | 695 | 0 | 0 | 10 | 2184.65 |

End of run: desk 10 balance / 695 earned, Wave 3 0 balance / 0 earned, Growth 10 balance / 2184.65 earned.

Old research desk nodes bought:

- day 1: De-ice ops (deice) for 34 points
- day 1: Belts and sorter (bag_sorter) for 32 points
- day 1: Kiosks and bag drop (self_service) for 22 points
- day 2: Stand classes (stand_class) for 40 points
- day 2: Widebody ops (widebody_ops) for 48 points
- day 3: Travelators (travelator) for 26 points
- day 7: Skywalks (skywalk) for 34 points
- day 7: Hydrant fuel system (hydrant_fuel) for 36 points
- day 10: Tank farm II (tank_farm_ii) for 30 points
- day 12: Hangar MRO (mro_hangar) for 72 points
- day 16: Scanner lanes (ct_lanes) for 28 points
- day 18: Military ramp (mil_ramp) for 42 points
- day 19: Heavy metal pack (heavy_pack) for 55 points
- day 19: Tank farm III (tank_farm_iii) for 46 points
- day 20: Night bank (night_bank) for 28 points
- day 20: Fuel rail (rail_fuel) for 44 points
- day 20: Cargo night hub (cargo_night_hub) for 68 points

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
- day 7: Fuel farm (airside-1) for 0 points
- day 7: Curb road (landside-1) for 0 points
- day 8: Catering kitchen (airside-2) for 26 points
- day 8: Inn (landside-2) for 26 points
- day 9: GSE depot (airside-3) for 38 points
- day 9: Long-stay park (landside-3) for 38 points
- day 10: Wide hangar (airside-4) for 54 points
- day 11: Bus station (landside-4) for 54 points
- day 12: MRO bay (airside-5) for 76 points
- day 13: Rail spur (landside-5) for 76 points
- day 13: Transfer Centre (retail-1) for 0 points
- day 14: ARFF station (safety-1) for 0 points
- day 14: RFID bag line (retail-2) for 26 points
- day 14: Police post (safety-2) for 26 points
- day 14: Food hall (retail-3) for 38 points
- day 15: Guard lanes (safety-3) for 38 points
- day 15: Lounge (retail-4) for 54 points
- day 16: Security hall (safety-4) for 54 points
- day 17: Seating (retail-5) for 76 points
- day 18: Incident drill (safety-5) for 76 points
- day 19: Code E pier (airfield-6) for 108 points
- day 20: Night bank (airside-6) for 108 points
- day 22: Airport hotel (landside-6) for 108 points
- day 23: Comfort (retail-6) for 108 points
- day 23: Specialisation charter (spec-charter) for 0 points
- day 23: Freight shed (spec-cargo-1) for 26 points
- day 24: Night freight (spec-cargo-2) for 38 points
- day 24: SAF blend (spec-green-1) for 39 points
- day 25: Transfer bank (spec-hub-1) for 39 points
- day 25: Fast turn (spec-lowcost-1) for 39 points
- day 25: Premium lane (spec-premium-1) for 39 points
- day 26: Sorter (spec-cargo-3) for 54 points
- day 27: Quiet hours (spec-green-2) for 57 points
- day 27: Wave scheduling (spec-hub-2) for 57 points
- day 28: Remote stand (spec-lowcost-2) for 57 points
- day 29: Fast track (spec-premium-2) for 57 points
- day 29: Freighter stand (spec-cargo-4) for 76 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-532,150 |
| payroll | $-249,473 |
| loan_repayment | $-59,069 |
| building_upkeep | $-43,117 |
| staff_hiring | $-26,400 |
| fuel_purchase | $-24,500 |
| land_holding | $-17,467 |
| penalties | $-16,800 |
| emergency_refuse | $-15,600 |
| loan_interest | $-15,256 |
| crash_fine | $-12,000 |
| retail_cogs | $-9,881 |
| security_shock | $-4,800 |
| city_levy | $-3,255 |
| refunds | $180 |
| baggage_fees | $8,170 |
| parking_fees | $10,962 |
| level_reward | $12,500 |
| task_rewards | $35,300 |
| passenger_fees | $66,606 |
| fuel_sales | $73,600 |
| landside_fees | $96,000 |
| retail_sales | $110,042 |
| landing_fees | $182,087 |
| contract_fees | $253,424 |
| loan_proceeds | $365,000 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Zoomjet | 10.8 | neutral | 1 Published |
| Puddle Jumper Airlines | -15 | neutral | 1 Published |


- Driver put the clock back to 5× after the persona touched the speed buttons.
- taxi-out recoveries cleared 0 stalls; teleport entries: 0

## Browser smoke

Scripted opening finished.

Opening played through the first landing.

Wall 128.7s. Clock ended at 150s.

#### Time to first landing

19.2s.

#### Cash curve

Ended at $51,824.

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
| 11 | 0 | 9.9s | 1 | 16 |
| 8.7 | 0 | 25.4s | 1 | 12 |
| 8.3 | 0 | 10.4s | 1 | 16 |
| 7.9 | 0 | 8.1s | 0 | 15 |
| 7.7 | 0 | 32.7s | 1 | 12 |
| 7.4 | 0 | 45.5s | 1 | 24 |
| 7.3 | 0 | 21.2s | 1 | 10 |
| 6.9 | 0 | 11.2s | 1 | 17 |

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
- Sim clock reached 146s before the 90s wall cap (target 300s).
- Opening check passed. Screenshots: /workspace/docs/playtest/opening/01-title.png, /workspace/docs/playtest/opening/02-plot.png, /workspace/docs/playtest/opening/03-coach.png, /workspace/docs/playtest/opening/04-runway-refused.png, /workspace/docs/playtest/opening/05-kit-stamped.png, /workspace/docs/playtest/opening/06-contract.png, /workspace/docs/playtest/opening/07-landing.png, /workspace/docs/playtest/opening/08-pause.png
