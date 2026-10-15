# Hatchfield bot playtest

Generated 2026-10-15T04:48:51.461Z.

Headless bots use the player command API (new game, land, starter kit, the Apex Local fuel term, tile stamps, hall rooms, contract letters, loans, shop bids, the Growth research tree, desk agents, and a curb reaction) and run at 5×. One sim day is 180s. Tick dt is 0.25s. Once the day-1 research trickle banks a whole point, each persona furnishes a research desk, then a chalkboard, then a lab bench, when the hall exists and cash covers the catalog price. Careful and Greedy then hire one researcher. When a tree node is affordable they buy the cheapest one. They hire desk agents until check-in and security are both staffed. Careful and Greedy, once cash is above three times the stamp and the airfield says Over the runway or curb or stand pressure is above 1, build a second runway and two more stands. Careful, when that expansion is not affordable and the curb pressure is over 1, adds a bus bay, then a taxi rank, then a curb lane instead of that day's other stamp.

## Headless personas

### Careful

standard / pax, sandbox off. Requested 45 sim days, ran 45. 6480 ticks in 58.3s wall.

Flights 153 (3.4/day). Diverts 0 (connection diverts 0). Go-arounds 13. Missed-connection cash $0. Curb crossed 1 on day 19. Fuel groundings 0. Tree complete day —. Preferred day 21, Trusted day 39. Hub checklist station from day 1.

#### Time to first landing

41.3s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $494,514.

`▂▁▁▁▁▁▁▁▁▂▂▂▂▂▂▂▂▂▂▃▃▃▄▄▄▄▄▄▄▅▅▅▅▆▆▆▆▆▇▇▇▇▇███`  $2,475 → $494,514

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 4 | $16,671 |
| 8 | $28,376 |
| 12 | $73,645 |
| 16 | $55,388 |
| 20 | $136,717 |
| 24 | $223,231 |
| 28 | $246,364 |
| 32 | $300,593 |
| 36 | $364,326 |
| 40 | $426,236 |
| 44 | $484,066 |
| 45 | $494,514 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 0.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 47.3.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 4 | 11 | 70 | 78 |
| 8 | 1 | 63 | 83 |
| 12 | 30 | 70 | 82 |
| 16 | 10 | 64.4 | 79 |
| 20 | 2 | 58.5 | 78 |
| 24 | 1 | 75 | 75 |
| 28 | 72 | 36 | 67 |
| 32 | 31 | 10.9 | 63 |
| 36 | 50 | 22 | 60 |
| 40 | 56 | 3.8 | 59 |
| 44 | 50 | 16.8 | 58 |
| 45 | 68 | 50.4 | 55 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 93.9 | 0 | 13.8s | 0 | 0 |
| 44.6 | 36 | 6623.8s | 4 | 65 |
| 41.4 | 0 | 31.3s | 1 | 4 |
| 31.4 | 41 | 7486.3s | 4 | 32 |
| 31.3 | 37 | 6756.3s | 5 | 64 |
| 30.4 | 31 | 5661.3s | 4 | 40 |
| 30.4 | 35 | 6300s | 4 | 50 |
| 30 | 38 | 6938.8s | 4 | 52 |

#### Anything the bot could not do

263 failed commands.

- acceptContract ×214 — Harbor Heli signed, and they will remember the squeeze.
- acceptContract ×22 — Alpine Swift signed.
- stamp ×11 — runway: That strip sits inside runway clearance. Leave the shoulder empty.
- acceptContract ×8 — Harbor Heli signed.
- acceptContract ×3 — Alpine Swift signed, and they will remember the squeeze.
- acceptContract ×2 — Zoomjet signed.
- acceptContract ×1 — Zoomjet needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Alpine Swift needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Harbor Heli needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks

Built:

- Runway strips 2, stands 6, terminal tiles 9, snack bars 1
- Shop units 5, leased 5, flights completed 153
- Signed: air_regional_1
- Rooms: checkin 2, security 2, gate 2, bagclaim 1, food 2, souvenir 2, bagdrop 1, lounge 1, bathroom 3, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 148 points, 45 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, airside-4, landside-4, retail-4, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, safety-4, spec-cargo-3, terminal-4, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, airfield-5, airside-5, landside-5, retail-5, safety-5, spec-cargo-4, terminal-5, spec-green-3, spec-hub-3).
Desks: 3 agents, check-in empty, security empty.
Queues at the end: check-in 0, security 0. Peaks: check-in 2, security 8.
Check-in: Check-in · 2 of 2 desks staffed · 1 in use · Queue 3 · wait 10s · Throughput 17.8/min · Desk 1 · queue 3 · wait 10s · in use · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 0.8 (peak 1.6), queue 0 (peak 3.2), delay 0s, lanes 2, bus bays 1, curb lanes 1, taxi ranks 1.
Happiness peak 75. Guest peak 98. Field-ask fines booked at the full rate: 0. Penalties total $-45,214.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 1.

Measured room rate: 0.28 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.28 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.42 RP/s with 1 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 108 | 492 | 0 | 0 | 108 | 982 |
| 45 | 148 | 680 | 0 | 0 | 148 | 2052.68 |

End of run: desk 148 balance / 680 earned, Wave 3 0 balance / 0 earned, Growth 148 balance / 2052.68 earned.

Old research desk nodes bought:

- day 2: De-ice ops (deice) for 34 points
- day 3: Belts and sorter (bag_sorter) for 32 points
- day 3: Kiosks and bag drop (self_service) for 22 points
- day 4: Stand classes (stand_class) for 40 points
- day 4: Widebody ops (widebody_ops) for 48 points
- day 5: Travelators (travelator) for 26 points
- day 7: Hydrant fuel system (hydrant_fuel) for 36 points
- day 13: Transfer Centre (transfer_centre) for 36 points
- day 15: RFID bag line (rfid_bag_line) for 52 points
- day 19: Tank farm II (tank_farm_ii) for 30 points
- day 29: Scanner lanes (ct_lanes) for 28 points
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
- day 13: Transfer Centre (retail-1) for 0 points
- day 14: ARFF station (safety-1) for 0 points
- day 15: RFID bag line (retail-2) for 26 points
- day 16: Police post (safety-2) for 26 points
- day 17: Food hall (retail-3) for 38 points
- day 18: Guard lanes (safety-3) for 38 points
- day 19: Wide hangar (airside-4) for 54 points
- day 20: Bus station (landside-4) for 54 points
- day 21: Lounge (retail-4) for 54 points
- day 22: Specialisation charter (spec-charter) for 0 points
- day 23: Freight shed (spec-cargo-1) for 26 points
- day 24: Night freight (spec-cargo-2) for 38 points
- day 25: SAF blend (spec-green-1) for 39 points
- day 26: Transfer bank (spec-hub-1) for 39 points
- day 27: Fast turn (spec-lowcost-1) for 39 points
- day 28: Premium lane (spec-premium-1) for 39 points
- day 29: Security hall (safety-4) for 54 points
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
| payroll | $-523,438 |
| construction | $-376,900 |
| building_upkeep | $-116,207 |
| fuel_purchase | $-41,356 |
| land_holding | $-31,428 |
| loan_repayment | $-26,400 |
| city_levy | $-22,674 |
| staff_hiring | $-18,400 |
| penalties | $-16,414 |
| security_shock | $-12,000 |
| crash_fine | $-12,000 |
| retail_cogs | $-8,381 |
| loan_interest | $-7,040 |
| emergency_refuse | $-4,800 |
| parking_fees | $18,414 |
| level_reward | $20,500 |
| baggage_fees | $23,706 |
| loan_proceeds | $25,000 |
| task_rewards | $38,900 |
| passenger_fees | $46,189 |
| retail_sales | $90,849 |
| landside_fees | $175,200 |
| fuel_sales | $178,201 |
| contract_fees | $266,034 |
| landing_fees | $660,959 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 53.6 | warm | 3 Trusted |


- strip 2 open on day 25
- deferred 33
- guests 68
- taxi-out recoveries cleared 0 stalls; teleport entries: 0
- hub-offers:0
- hub-ladder:air_regional_1:score54:tier3:kept45:relok:otmissing:On-time 54%:tenok:band-:nextfocus

### Greedy expander

standard / pax, sandbox off. Requested 60 sim days, ran 60. 8640 ticks in 93.9s wall.

Flights 208 (3.5/day). Diverts 9 (connection diverts 0). Go-arounds 15. Missed-connection cash $0. Curb crossed 1 on day 16. Fuel groundings 0. Tree complete day 54. Preferred day 44, Trusted day —. Hub checklist station from day 1.

#### Time to first landing

41.3s (day 0) — PDJ101 entered landing.

#### Cash curve

Start $168,000 · end $65,586.

`▃▁▁▁▂▁▁▁▁▁▂▁▂█▃▁▂▂▁▂▂▂▃▁▂▂▃▁▂▂▂`  $6,524 → $312,840

| Day | Cash |
| --- | --- |
| 0 | $73,000 |
| 5 | $18,383 |
| 10 | $20,286 |
| 15 | $25,926 |
| 20 | $39,677 |
| 25 | $16,726 |
| 30 | $23,984 |
| 35 | $76,875 |
| 40 | $44,433 |
| 45 | $6,804 |
| 50 | $61,514 |
| 55 | $23,312 |
| 60 | $65,586 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 6.

Recovered:

- PDJ109 taxi_out for 55s step=repath cleared at 1179s
- PDJ109 stuck on the ground step=repath cleared at 1181s
- PDJ116 taxi_out for 45s step=none cleared at 2271s
- PDJ116 stuck on the ground step=none cleared at 2274s
- LIF167 taxi_out for 43s step=repath cleared at 2561s
- LIF167 stuck on the ground step=repath cleared at 2564s
- PDJ121 taxi_out for 46s step=none cleared at 3381s
- PDJ121 stuck on the ground step=none cleared at 3384s
- PDJ122 taxi_out for 41s step=repath cleared at 3508s
- PDJ244 taxi_out for 46s step=none cleared at 8101s
- PDJ244 stuck on the ground step=none cleared at 8104s

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 50.4.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 5 | 8 | 66.8 | 81 |
| 10 | 10 | 63.4 | 80 |
| 15 | 30 | 70.1 | 78 |
| 20 | 7 | 68.3 | 74 |
| 25 | 35 | 68.7 | 74 |
| 30 | 58 | 58.7 | 70 |
| 35 | 56 | 53.9 | 68 |
| 40 | 45 | 39.7 | 55 |
| 45 | 47 | 40.2 | 48 |
| 50 | 48 | 37.3 | 45 |
| 55 | 65 | 41.6 | 48 |
| 60 | 53 | 37.3 | 49 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 37.5 | 54 | 9861.3s | 7 | 81 |
| 36.2 | 44 | 8078.8s | 6 | 37 |
| 35.8 | 40 | 7306.3s | 7 | 40 |
| 35.7 | 27 | 4971.3s | 6 | 66 |
| 34.3 | 47 | 8583.8s | 6 | 44 |
| 33 | 53 | 9563.8s | 6 | 58 |
| 32.6 | 55 | 10078.8s | 6 | 67 |
| 32.3 | 44 | 7945s | 6 | 45 |

#### Anything the bot could not do

671 failed commands.

- acceptContract ×317 — Harbor Heli signed, and they will remember the squeeze.
- buyParcel ×36 — Parcel locked — reach Field Level 5 first.
- acceptContract ×17 — Alpine Swift signed.
- buyResearch ×12 — Already unlocked.
- buyParcel ×7 — Parcel locked — reach Field Level 2 first.
- buyParcel ×4 — Need Fringe plot 4-3 — short 50600.
- buyParcel ×4 — Need Fringe plot 4-3 — short 42382.
- buyParcel ×4 — Need Fringe plot 4-3 — short 5013.
- buyParcel ×3 — Need Fringe plot 3-4 — short 7723.
- buyParcel ×3 — Need Fringe plot 4-4 — short 60370.
- buyParcel ×3 — Need Fringe plot 4-4 — short 60326.
- buyResearch ×2 — Need 76 RP (have 3).
- buyParcel ×2 — Need Fringe plot 3-4 — short 46253.
- buyParcel ×2 — Need Fringe plot 3-4 — short 46015.
- buyParcel ×2 — Need Fringe plot 3-4 — short 38652.
- buyParcel ×2 — Need Fringe plot 3-4 — short 26051.
- buyParcel ×2 — Need Fringe plot 3-4 — short 26436.
- buyParcel ×2 — Need Fringe plot 3-4 — short 13472.
- buyParcel ×2 — Need Fringe plot 3-4 — short 5008.
- buyParcel ×2 — Need Fringe plot 4-2 — short 52992.
- buyParcel ×2 — Need Fringe plot 4-2 — short 37603.
- buyParcel ×2 — Need Fringe plot 4-2 — short 15801.
- buyParcel ×2 — Need Fringe plot 4-2 — short 16569.
- buyParcel ×2 — Need Fringe plot 4-2 — short 8532.
- buyParcel ×2 — Need Fringe plot 4-3 — short 45946.
- buyParcel ×2 — Need Fringe plot 4-3 — short 27261.
- buyParcel ×2 — Need Fringe plot 4-3 — short 9054.
- buyParcel ×2 — Need Fringe plot 4-3 — short 10913.
- buyParcel ×2 — Need Fringe plot 4-4 — short 60711.
- buyParcel ×2 — Need Fringe plot 4-4 — short 42699.
- buyParcel ×2 — Need Fringe plot 4-4 — short 41873.
- buyParcel ×2 — Need Fringe plot 4-4 — short 41761.
- acceptContract ×1 — Zoomjet needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Zoomjet signed.
- acceptContract ×1 — Alpine Swift needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- acceptContract ×1 — Harbor Heli needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyResearch ×1 — Need 54 RP (have 1).
- buyParcel ×1 — Need Approach plot 2-1 — short 14490.

Built:

- Runway strips 2, stands 8, terminal tiles 9, snack bars 2
- Shop units 8, leased 2, flights completed 208
- Signed: air_regional_1
- Rooms: checkin 2, security 2, gate 3, bagclaim 1, food 3, souvenir 3, bagdrop 1, lounge 1, bathroom 2, rdesk 1, rboard 1, rmachine 1

#### New systems

Research tree: 324 points, 63 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airfield-5, terminal-5, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, airside-5, landside-5, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, retail-5, safety-5, airfield-6, airside-6, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2, spec-cargo-4, spec-green-3, spec-hub-3, spec-lowcost-3, spec-premium-3, landside-6, retail-6, safety-6, spec-cargo-5, terminal-6, spec-green-4, spec-hub-4, spec-lowcost-4, spec-premium-4, airside-7, spec-green-5, spec-hub-5, spec-lowcost-5, spec-premium-5).
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 0, security 0. Peaks: check-in 4, security 7.
Check-in: Check-in · 2 of 2 desks staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Desk 1 · queue 0 · wait 0s · idle · Desk 2 · queue 0 · wait 0s · idle
Security: Security · 2 of 2 lanes staffed · 0 in use · Queue 0 · wait 0s · Throughput 0.0/min · Lane 1 · queue 0 · wait 0s · idle · Lane 2 · queue 0 · wait 0s · idle
Curb: pressure 4.4 (peak 4.5), queue 20.9 (peak 20.9), delay 81s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 71.1. Guest peak 97. Field-ask fines booked at the full rate: 0. Penalties total $-55,900.

#### Research pools

Lab furniture at the end: 1 research desk, 1 chalkboard, 1 lab bench. Researchers on payroll: 1.

Measured room rate: 0.28 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 1 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.28 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.42 RP/s with 1 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 63 | 836 | 0 | 0 | 63 | 2264.21 |
| 45 | 12 | 935 | 0 | 0 | 12 | 3444.61 |
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
- day 5: Hydrant fuel system (hydrant_fuel) for 36 points
- day 7: Tank farm II (tank_farm_ii) for 30 points
- day 9: Hangar MRO (mro_hangar) for 72 points
- day 13: Scanner lanes (ct_lanes) for 28 points
- day 15: Military ramp (mil_ramp) for 42 points
- day 15: Transfer Centre (transfer_centre) for 36 points
- day 16: Heavy metal pack (heavy_pack) for 55 points
- day 16: Tank farm III (tank_farm_iii) for 46 points
- day 17: RFID bag line (rfid_bag_line) for 52 points
- day 18: Night bank (night_bank) for 28 points
- day 18: Fuel rail (rail_fuel) for 44 points
- day 18: Cargo night hub (cargo_night_hub) for 68 points
- day 34: E-gates (egates) for 40 points
- day 37: Automated baggage (bag_bhs) for 58 points
- day 37: People mover (people_mover) for 52 points
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
- day 5: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 5: Catering kitchen (airside-2) for 26 points
- day 6: Inn (landside-2) for 26 points
- day 6: GSE depot (airside-3) for 38 points
- day 7: Long-stay park (landside-3) for 38 points
- day 7: Wide hangar (airside-4) for 54 points
- day 8: Bus station (landside-4) for 54 points
- day 9: MRO bay (airside-5) for 76 points
- day 10: Rail spur (landside-5) for 76 points
- day 11: Transfer Centre (retail-1) for 0 points
- day 11: ARFF station (safety-1) for 0 points
- day 11: RFID bag line (retail-2) for 26 points
- day 11: Police post (safety-2) for 26 points
- day 11: Food hall (retail-3) for 38 points
- day 12: Guard lanes (safety-3) for 38 points
- day 12: Lounge (retail-4) for 54 points
- day 13: Security hall (safety-4) for 54 points
- day 14: Seating (retail-5) for 76 points
- day 15: Incident drill (safety-5) for 76 points
- day 16: Code E pier (airfield-6) for 108 points
- day 18: Night bank (airside-6) for 108 points
- day 19: Specialisation charter (spec-charter) for 0 points
- day 19: Freight shed (spec-cargo-1) for 26 points
- day 19: Night freight (spec-cargo-2) for 38 points
- day 20: SAF blend (spec-green-1) for 39 points
- day 20: Transfer bank (spec-hub-1) for 39 points
- day 21: Fast turn (spec-lowcost-1) for 39 points
- day 21: Premium lane (spec-premium-1) for 39 points
- day 22: Sorter (spec-cargo-3) for 54 points
- day 23: Quiet hours (spec-green-2) for 57 points
- day 23: Wave scheduling (spec-hub-2) for 57 points
- day 24: Remote stand (spec-lowcost-2) for 57 points
- day 25: Fast track (spec-premium-2) for 57 points
- day 26: Freighter stand (spec-cargo-4) for 76 points
- day 27: Electric GSE (spec-green-3) for 81 points
- day 28: Minimum connect (spec-hub-3) for 81 points
- day 29: Thin lounge (spec-lowcost-3) for 81 points
- day 30: VIP room (spec-premium-3) for 81 points
- day 31: Airport hotel (landside-6) for 108 points
- day 32: Comfort (retail-6) for 108 points
- day 34: Hardened perimeter (safety-6) for 108 points
- day 35: Cargo airline (spec-cargo-5) for 108 points
- day 37: People mover (terminal-6) for 108 points
- day 38: Rail first (spec-green-4) for 114 points
- day 40: Hub pier (spec-hub-4) for 114 points
- day 41: High frequency (spec-lowcost-4) for 114 points
- day 42: Bridge service (spec-premium-4) for 114 points
- day 44: Fuel pipeline (airside-7) for 154 points
- day 46: Green report (spec-green-5) for 162 points
- day 48: Alliance desk (spec-hub-5) for 162 points
- day 50: Low-cost deal (spec-lowcost-5) for 162 points
- day 53: Flagship deal (spec-premium-5) for 162 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-1,290,397 |
| payroll | $-613,371 |
| loan_repayment | $-181,006 |
| building_upkeep | $-148,036 |
| land_holding | $-82,039 |
| fuel_purchase | $-53,852 |
| loan_interest | $-46,084 |
| penalties | $-22,300 |
| staff_hiring | $-19,700 |
| security_shock | $-18,400 |
| retail_cogs | $-11,303 |
| crash_fine | $-8,000 |
| emergency_refuse | $-7,200 |
| city_levy | $-834 |
| catering_fees | $13,685 |
| parking_fees | $23,715 |
| level_reward | $30,500 |
| baggage_fees | $31,291 |
| task_rewards | $38,900 |
| passenger_fees | $52,469 |
| retail_sales | $134,078 |
| fuel_sales | $234,023 |
| landside_fees | $252,000 |
| loan_proceeds | $365,000 |
| contract_fees | $507,489 |
| landing_fees | $716,958 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Puddle Jumper Airlines | 43.8 | warm | 2 Preferred |


- strip 2 open on day 27
- deferred 31
- guests 53
- taxi-out recoveries cleared 6 stalls; teleport entries: 0
- hub-offers:0
- hub-ladder:air_regional_1:score44:tier2:kept60:relok:otmissing:On-time 54%:tenok:band-:nextfocus

### Chaotic random clicker

standard / pax, sandbox off. Requested 30 sim days, ran 30. 4320 ticks in 31.9s wall.

Flights 90 (3/day). Diverts 0 (connection diverts 0). Go-arounds 1. Missed-connection cash $0. Curb crossed 1 on day 17. Fuel groundings 0. Tree complete day —. Preferred day 14, Trusted day 26. Hub checklist station from day 2.

#### Time to first landing

80s (day 0) — LIF101 entered landing.

#### Cash curve

Start $168,000 · end $3,595.

`█▄▂▁▁▁▁▁▂▁▂▁▁▂▂▃▃▃▃▂▁▁▁▁▁▁▁▁▂▂▁`  $0 → $118,000

| Day | Cash |
| --- | --- |
| 0 | $118,000 |
| 3 | $1,974 |
| 6 | $5,350 |
| 9 | $5,716 |
| 12 | $7,059 |
| 15 | $34,287 |
| 18 | $32,349 |
| 21 | $0 |
| 24 | $3,857 |
| 27 | $5,350 |
| 30 | $3,595 |

#### Stuck or recovered

No entity was still stuck at the end.

Taxi-out watchdog recoveries: 0.

#### Console errors

None.

#### Softlocks

None detected.

#### Passenger satisfaction

Mean happiness while guests were present: 39.

| Day | Guests | Happiness | Field rating |
| --- | --- | --- | --- |
| 0 | 0 | — | 65 |
| 3 | 0 | — | 76 |
| 6 | 54 | 67.5 | 82 |
| 9 | 5 | 47.8 | 81 |
| 12 | 36 | 68 | 76 |
| 15 | 25 | 62 | 79 |
| 18 | 31 | 32.2 | 79 |
| 21 | 48 | 27.3 | 71 |
| 24 | 54 | 22.3 | 67 |
| 27 | 51 | 2.4 | 66 |
| 30 | 36 | 1.2 | 57 |

#### Slowest sim ticks

| ms | Day | Clock | Flights | Guests |
| --- | --- | --- | --- | --- |
| 26.2 | 25 | 4513.8s | 4 | 67 |
| 25.6 | 17 | 3096.3s | 3 | 36 |
| 25.2 | 0 | 38.8s | 0 | 0 |
| 25.1 | 15 | 2861.3s | 3 | 48 |
| 23.3 | 21 | 3867.5s | 3 | 63 |
| 22.8 | 26 | 4707.5s | 3 | 51 |
| 22.6 | 17 | 3167.5s | 4 | 41 |
| 22.5 | 29 | 5346.3s | 4 | 36 |

#### Anything the bot could not do

30 failed commands.

- hireJanitor ×17 — Janitor crew maxed (6).
- acceptContract ×5 — Puddle Jumper Airlines signed, and they will remember the squeeze.
- buyRoom ×2 — Need Chalkboard — short 878.
- acceptContract ×1 — Puddle Jumper Airlines needs 28 passengers a minute at check-in. Desks and kiosks clear 22. Add check-in desks
- buyRoom ×1 — Need Security — short 3828.
- buyRoom ×1 — Need Research desk — short 2228.
- buyTree ×1 — Need $42,000 cash.
- buyTree ×1 — Need Transfer Centre first.
- buyRoom ×1 — Need Airline lounge — short 2842.

Built:

- Runway strips 1, stands 9, terminal tiles 13, snack bars 12
- Shop units 20, leased 3, flights completed 90
- Signed: zoomjet
- Rooms: checkin 5, security 5, gate 8, bagclaim 1, food 5, souvenir 3, bagdrop 1, lounge 1, bathroom 8, rdesk 6, rboard 3, rmachine 8

#### New systems

Research tree: 27 points, 45 nodes (airfield-1, terminal-1, airfield-2, terminal-2, airfield-3, terminal-3, airfield-4, terminal-4, airside-1, landside-1, airside-2, landside-2, airside-3, landside-3, airside-4, landside-4, airfield-5, airside-5, retail-1, safety-1, retail-2, safety-2, retail-3, safety-3, retail-4, safety-4, landside-5, retail-5, safety-5, terminal-5, airfield-6, airside-6, landside-6, spec-charter, spec-cargo-1, spec-cargo-2, spec-green-1, spec-hub-1, spec-lowcost-1, spec-premium-1, spec-cargo-3, spec-green-2, spec-hub-2, spec-lowcost-2, spec-premium-2).
Desks: 3 agents, check-in staffed, security staffed.
Queues at the end: check-in 0, security 12. Peaks: check-in 3, security 12.
Check-in: walk paused, estimate · 0 waiting at check-in
Security: walk paused, estimate · 12 waiting at security
Curb: pressure 1.2 (peak 1.4), queue 1.9 (peak 1.9), delay 8s, lanes 1, bus bays 0, curb lanes 0, taxi ranks 0.
Happiness peak 71.2. Guest peak 87. Field-ask fines booked at the full rate: 0. Penalties total $-22,471.

#### Research pools

Lab furniture at the end: 6 research desks, 3 chalkboards, 8 lab benches. Researchers on payroll: 0.

Measured room rate: 0.46 RP/s from the R&D rooms, on top of 0.01 RP/s from operations.
One research pool. The Growth tree is the only wallet.
First day with lab furniture was day 1 (1 desk, 1 board, 0 bench). That day's Wave 3 room rate was 0 RP/s and the Growth room rate was 0.16 RP/s; the day before, Wave 3 room rate was 0 and the Growth room rate was 0. The old desk lab rate that day was 0.16 RP/s with 0 researchers.

Earned is the balance still in the pool, plus fractional carry, plus the catalog cost of nodes already bought from that pool. It is not cash.

| Day | Desk balance | Desk earned | Wave 3 balance | Wave 3 earned | Growth balance | Growth earned |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | 27 | 712 | 0 | 0 | 27 | 2017.08 |

End of run: desk 27 balance / 712 earned, Wave 3 0 balance / 0 earned, Growth 27 balance / 2017.08 earned.

Old research desk nodes bought:

- day 1: De-ice ops (deice) for 34 points
- day 1: Belts and sorter (bag_sorter) for 32 points
- day 1: Kiosks and bag drop (self_service) for 22 points
- day 2: Stand classes (stand_class) for 40 points
- day 2: Widebody ops (widebody_ops) for 48 points
- day 3: Travelators (travelator) for 26 points
- day 5: Hydrant fuel system (hydrant_fuel) for 36 points
- day 8: Tank farm II (tank_farm_ii) for 30 points
- day 11: Hangar MRO (mro_hangar) for 72 points
- day 15: Scanner lanes (ct_lanes) for 28 points
- day 18: Military ramp (mil_ramp) for 42 points
- day 19: Skywalks (skywalk) for 34 points
- day 20: Heavy metal pack (heavy_pack) for 55 points
- day 20: Tank farm III (tank_farm_iii) for 46 points
- day 21: Night bank (night_bank) for 28 points
- day 21: Fuel rail (rail_fuel) for 44 points
- day 21: Cargo night hub (cargo_night_hub) for 68 points

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
- day 5: Fuel farm (airside-1) for 0 points
- day 5: Curb road (landside-1) for 0 points
- day 6: Catering kitchen (airside-2) for 26 points
- day 6: Inn (landside-2) for 26 points
- day 7: GSE depot (airside-3) for 38 points
- day 7: Long-stay park (landside-3) for 38 points
- day 8: Wide hangar (airside-4) for 54 points
- day 9: Bus station (landside-4) for 54 points
- day 10: Control tower (airfield-5) for 76 points
- day 11: MRO bay (airside-5) for 76 points
- day 12: Transfer Centre (retail-1) for 0 points
- day 12: ARFF station (safety-1) for 0 points
- day 12: RFID bag line (retail-2) for 26 points
- day 12: Police post (safety-2) for 26 points
- day 13: Food hall (retail-3) for 38 points
- day 13: Guard lanes (safety-3) for 38 points
- day 14: Lounge (retail-4) for 54 points
- day 15: Security hall (safety-4) for 54 points
- day 16: Rail spur (landside-5) for 76 points
- day 17: Seating (retail-5) for 76 points
- day 18: Incident drill (safety-5) for 76 points
- day 19: Skywalk (terminal-5) for 76 points
- day 20: Code E pier (airfield-6) for 108 points
- day 21: Night bank (airside-6) for 108 points
- day 23: Airport hotel (landside-6) for 108 points
- day 24: Specialisation charter (spec-charter) for 0 points
- day 24: Freight shed (spec-cargo-1) for 26 points
- day 24: Night freight (spec-cargo-2) for 38 points
- day 25: SAF blend (spec-green-1) for 39 points
- day 25: Transfer bank (spec-hub-1) for 39 points
- day 26: Fast turn (spec-lowcost-1) for 39 points
- day 26: Premium lane (spec-premium-1) for 39 points
- day 27: Sorter (spec-cargo-3) for 54 points
- day 27: Quiet hours (spec-green-2) for 57 points
- day 28: Wave scheduling (spec-hub-2) for 57 points
- day 29: Remote stand (spec-lowcost-2) for 57 points
- day 29: Fast track (spec-premium-2) for 57 points

Sinks and income by category:

| Category | Amount |
| --- | --- |
| construction | $-483,350 |
| payroll | $-223,693 |
| loan_repayment | $-52,080 |
| building_upkeep | $-44,041 |
| staff_hiring | $-26,400 |
| fuel_purchase | $-25,328 |
| land_holding | $-17,968 |
| loan_interest | $-13,550 |
| emergency_refuse | $-12,400 |
| retail_cogs | $-4,788 |
| crash_fine | $-4,000 |
| security_shock | $-4,000 |
| penalties | $-2,071 |
| catering_fees | $2,250 |
| baggage_fees | $4,160 |
| parking_fees | $5,742 |
| level_reward | $12,500 |
| passenger_fees | $32,651 |
| task_rewards | $35,300 |
| retail_sales | $50,592 |
| loan_proceeds | $70,000 |
| fuel_sales | $81,632 |
| landside_fees | $127,200 |
| contract_fees | $157,408 |
| landing_fees | $169,829 |

Relation tiers:

| Airline | Score | Band | Tier |
| --- | --- | --- | --- |
| Zoomjet | 53.3 | warm | 3 Trusted |
| Puddle Jumper Airlines | -12 | neutral | 1 Published |


- Driver put the clock back to 5× after the persona touched the speed buttons.
- deferred 12
- guests 36
- strip 2 not built
- taxi-out recoveries cleared 0 stalls; teleport entries: 0
- hub-offers:0
- hub-ladder:zoomjet:score53:tier3:kept29:relok:otmissing:On-time 74%:tenok:bandok:nextfocus

## Browser smoke

Scripted opening finished.

Opening played through the first landing.

Wall 129.7s. Clock ended at 153s.

#### Time to first landing

21.1s.

#### Cash curve

Ended at $65,146.

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
| 16.8 | 0 | 9.7s | 1 | 16 |
| 16.2 | 0 | 9.2s | 1 | 16 |
| 13.1 | 0 | 47.4s | 1 | 28 |
| 12.8 | 0 | 44.9s | 1 | 28 |
| 12 | 0 | 10.6s | 1 | 17 |
| 11.9 | 0 | 8.2s | 0 | 15 |
| 10.4 | 0 | 24.6s | 1 | 13 |
| 10.2 | 0 | 16.3s | 1 | 8 |

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
- Sim clock reached 148s before the 90s wall cap (target 300s).
- Opening check passed. Screenshots: /workspace/docs/playtest/opening/01-title.png, /workspace/docs/playtest/opening/02-plot.png, /workspace/docs/playtest/opening/03-coach.png, /workspace/docs/playtest/opening/04-runway-refused.png, /workspace/docs/playtest/opening/05-kit-stamped.png, /workspace/docs/playtest/opening/06-contract.png, /workspace/docs/playtest/opening/07-landing.png, /workspace/docs/playtest/opening/08-pause.png
