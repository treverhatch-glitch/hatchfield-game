# Research

One Growth tree is the only research wallet. Points trickle in from operations and, mostly, from animated R&D rooms (a research desk, a chalkboard, and a lab bench). Hired researchers raise the room rate. The rooms still earn when nobody is on the payroll, and a researcher with no furniture does not open a second trickle. The old research desk and the Wave 3 node list are grants on this tree. They are not separate currencies.

A careful lab — one of each room, no researchers — earns less than the second-tier cost in one game day, so it cannot buy a node every day. Later tiers double. Hiring researchers, or placing more rooms, is how the rate climbs.

Locked nodes stay on the tree, greyed, with a padlock. Locked stamps stay in the tray with the node badge. Nothing research-gated is hidden.

A node unlocks one of three things the sim actually reads: a build stamp, a legacy desk project (aircraft, vehicles, tanks, bags, the night bank, the military ramp, and the two hub upgrades), or a stacked operations modifier. Hub upgrades also charge their cash build cost.

Old saves fold desk points 1:1 and Wave 3 points by the ratio of the tree catalog cost to the old Wave 3 catalog cost. Owned projects are granted, not rebought. Fractional points stay in the carry. A second load does not add the points again. Wave 3 relationship scores and the lab animation clock are kept.

| Node | Name | Cost | Unlocks | Also grants | Wave 3 folded here |
| --- | --- | --- | --- | --- | --- |
| `airfield-1` | Apron charter | 0 | Faster apron turns | turn ×0.99 | efficiency.1 |
| `airfield-2` | De-ice pad | 50 | De-ice pad | stamps deice; projects deice | — |
| `airfield-3` | Large stands | 100 | Wide stand, jumbo stand, widebody aircraft | stamps stand_w, stand_l; projects stand_class, widebody_ops | — |
| `airfield-4` | Heavy runway | 200 | Heavy strip | stamps runway_heavy | efficiency.7 |
| `airfield-5` | Control tower | 400 | Tower | stamps tower | efficiency.5 |
| `airfield-6` | Code E pier | 800 | Code E, jumbo hangar, heavy aircraft, tank farm III | stamps code_e, hangar_j; projects heavy_pack, tank_farm_iii | — |
| `terminal-1` | Hall shell | 0 | Faster security screening | security ×0.98 | passenger.1 |
| `terminal-2` | Processing | 50 | Kiosks, bag sorter, Prefab II | stamps prefab_ii; projects bag_sorter, self_service | passenger.4 |
| `terminal-3` | Concourse | 100 | Travelator | stamps travelator; projects travelator | — |
| `terminal-4` | Jet bridge | 200 | Jet bridge | stamps jet_bridge | — |
| `terminal-5` | Skywalk | 400 | Skywalk | stamps skywalk; projects skywalk | — |
| `terminal-6` | People mover | 800 | People mover, automated baggage | stamps mover, people_mover; projects bag_bhs, people_mover | passenger.8 |
| `airside-1` | Fuel farm | 0 | Hydrant fuel | projects hydrant_fuel | efficiency.3 |
| `airside-2` | Catering kitchen | 50 | Catering kitchen | stamps kitchen | — |
| `airside-3` | GSE depot | 100 | GSE depot | stamps depot | cargo.2 |
| `airside-4` | Wide hangar | 200 | Wide hangar, tank farm II | stamps hangar_w; projects tank_farm_ii | efficiency.6 |
| `airside-5` | MRO bay | 400 | MRO | stamps mro; projects mro_hangar | — |
| `airside-6` | Night bank | 800 | Night hub, fuel rail, night bank | stamps nighthub, fuel_rail, oil; projects night_bank, rail_fuel, cargo_night_hub | cargo.3 |
| `landside-1` | Curb road | 0 | More catchment demand | demand ×1.01 | — |
| `landside-2` | Inn | 50 | Inn | stamps hotel_biz | prestige.5 |
| `landside-3` | Long-stay park | 100 | Higher retail spend | retail ×1.02 | — |
| `landside-4` | Bus station | 200 | More catchment demand | demand ×1.01 | — |
| `landside-5` | Rail spur | 400 | Rail station | stamps rail | cargo.6 |
| `landside-6` | Airport hotel | 800 | Airport hotel | stamps airport_hotel | prestige.3 |
| `safety-1` | ARFF station | 0 | Faster security screening | security ×0.98 | efficiency.4 |
| `safety-2` | Police post | 50 | Faster apron turns | turn ×0.99 | — |
| `safety-3` | Guard lanes | 100 | Faster security screening | security ×0.98 | — |
| `safety-4` | Security hall | 200 | Security hall, scanner lanes | stamps security_hall; projects ct_lanes | — |
| `safety-5` | Incident drill | 400 | Military ramp | projects mil_ramp | — |
| `safety-6` | Hardened perimeter | 800 | E-gates | projects egates | — |
| `retail-1` | Transfer Centre | 0 | Transfer Centre | projects transfer_centre | — |
| `retail-2` | RFID bag line | 50 | RFID bag line | projects rfid_bag_line | — |
| `retail-3` | Food hall | 100 | Higher retail spend | retail ×1.02 | prestige.1 |
| `retail-4` | Lounge | 200 | Higher retail spend | retail ×1.02 | passenger.7 |
| `retail-5` | Seating | 400 | More catchment demand | demand ×1.01 | passenger.3 |
| `retail-6` | Comfort | 800 | Higher retail spend | retail ×1.02 | passenger.2 |
| `spec-charter` | Specialisation charter | 0 | Hub, Cargo, Low-cost, Premium, and Green | demand ×1.01 | prestige.2 |
| `spec-hub-1` | Transfer bank | 50 | Hub transfers | demand ×1.01 | passenger.6 |
| `spec-hub-2` | Wave scheduling | 100 | Wave timetable | turn ×0.99 | — |
| `spec-hub-3` | Minimum connect | 200 | Minimum connect time | security ×0.98 | — |
| `spec-hub-4` | Hub pier | 400 | Hub pier | demand ×1.01 | — |
| `spec-hub-5` | Alliance desk | 800 | Alliance desk | retail ×1.02 | prestige.8 |
| `spec-cargo-1` | Freight shed | 50 | Cargo shed | cargo +40 t | cargo.1 |
| `spec-cargo-2` | Night freight | 100 | Night freight | cargo +40 t | cargo.4 |
| `spec-cargo-3` | Sorter | 200 | Cargo sorter | cargo +40 t | cargo.7 |
| `spec-cargo-4` | Freighter stand | 400 | Freighter stand | cargo +40 t | cargo.5 |
| `spec-cargo-5` | Cargo airline | 800 | Cargo contract | cargo +40 t | cargo.8 |
| `spec-lowcost-1` | Fast turn | 50 | Fast-turn policy | turn ×0.99 | efficiency.2 |
| `spec-lowcost-2` | Remote stand | 100 | Remote-stand policy | turn ×0.99 | — |
| `spec-lowcost-3` | Thin lounge | 200 | Basic lounge | retail ×1.02 | — |
| `spec-lowcost-4` | High frequency | 400 | High-frequency slots | demand ×1.01 | — |
| `spec-lowcost-5` | Low-cost deal | 800 | Low-cost contract | turn ×0.99 | — |
| `spec-premium-1` | Premium lane | 50 | Premium check-in | security ×0.98 | passenger.5 |
| `spec-premium-2` | Fast track | 100 | Fast track | security ×0.98 | — |
| `spec-premium-3` | VIP room | 200 | VIP room | retail ×1.02 | prestige.4 |
| `spec-premium-4` | Bridge service | 400 | Bridge-only policy | demand ×1.01 | prestige.6 |
| `spec-premium-5` | Flagship deal | 800 | Premium contract | retail ×1.02 | prestige.7 |
| `spec-green-1` | SAF blend | 50 | SAF blending | stamps saf_blending | — |
| `spec-green-2` | Quiet hours | 100 | Quiet-hours policy | turn ×0.99 | efficiency.8 |
| `spec-green-3` | Electric GSE | 200 | Electric GSE | demand ×1.01 | — |
| `spec-green-4` | Rail first | 400 | Rail-first policy | cargo +40 t | — |
| `spec-green-5` | Green report | 800 | Green year report | retail ×1.02 | — |

Tier 1 of each line is free. Later tiers cost 50, 100, 200, 400, and 800 points and require the previous node. Specialisation nodes require the charter, then the previous node on that branch. A second specialisation branch costs 1.5×.
