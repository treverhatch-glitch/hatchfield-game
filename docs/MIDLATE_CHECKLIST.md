# Mid and late game checklist

Compared with `main` at `20e829d` (15 Oct 2026). The careful bot ran on `84db44f`, the parent of that commit. The commit in between shows the hub checklist; it does not change field XP. Design sources are `docs/DESIGN_PASS.md`, `docs/PROGRESSION.md`, `docs/RESEARCH.md`, `docs/design/HUB_PROGRESSION.md`, `docs/IDEAS.md`, and the in-repo catalogs those docs point at. `LATE_GAME_PLAN.md` is not in the repo. Tier III building comments cite it anyway (`src/content/buildings_tier3.ts`).

Marks:

- **PLAYABLE** — a player can reach it in a normal game, see it, and read what it does.
- **SIM ONLY** — code or data exists, and a normal game does not unlock it, schedule it, or show it.
- **MISSING** — no implementation of that feature.

## Careful bot, day 150

Headless careful persona (`src/playtest/personas.ts`, seed `0x5eed`, standard difficulty, passenger focus, sandbox off). Same driver as the playtest bots: 0.25s ticks at 5×, a decision every 12 sim seconds. One sim day is 180 seconds. Command:

`CAREFUL_150=1 npx vitest run src/playtest/careful150.test.ts --testTimeout 900000`

| | |
| --- | --- |
| Days ran | 150 |
| Cash | $168,000 → $984,063 |
| Flights turned | 756 |
| Carriers signed | 10 |
| Stands / runways | 4 / 1 |
| Growth-tree nodes | 62 (the whole tree) by day 90 |
| Prestige stars | 0 |
| Softlocks / errors | none |

Field level on the day it first opened. Day 0 is the opening clock.

| Level | Day |
| --- | --- |
| FL1 | 0 |
| FL2 | 4 |
| FL3 | 9 |
| FL4 | 15 |
| FL5 | 23 |
| FL6 | 39 |
| FL7 | 53 |
| FL8 | 74 |
| FL9 | 102 |
| FL10 | 138 |

FL10 needs 4,500 field XP (`FIELD_LEVEL_XP` in `src/game/catalog.ts`). Each prestige star needs another 2,000 XP (`PRESTIGE_STAR_XP`). This run was still on 0 stars at day 150. The star bar is on the field badge after FL10 (`src/ui/nav/levelUnlocks.ts`).

Late buildings use `lateFieldLevel()`, which follows the same XP through FL9 (3,200) and stays there (`LATE_FIELD_XP`). Hotel (7), SAF (8), and the rail link (9) are inside the levels this bot reached.

## Field levels

| Item | Status | Evidence |
| --- | --- | --- |
| FL4–FL10 | PLAYABLE | `src/game/catalog.ts` `638846f`. Levels open stamps in `src/ui/nav/FieldLevelsPanel.tsx` and grant cash plus research points in `src/research/config.ts`. The careful bot reached FL10 on day 138. |
| Prestige stars | PLAYABLE | Same XP bar, five stars after FL10 (`PRESTIGE_STARS`). The badge names the next star. This 150-day careful run earned none. |

## Late buildings

| Item | Status | Evidence |
| --- | --- | --- |
| People mover | PLAYABLE | Tray tool `people_mover` (`src/ui/nav/taxonomy.ts` `9d2e1ec`). Field level 7 and $420,000 in `src/connectivity/catalog.ts` `b9aca76`. Research node `terminal-6` grants it (`src/research/legacy.ts`). |
| Transfer centre | PLAYABLE | Growth node `retail-1` is the research gate. The build is a $42,000 cash bill that cuts minimum connect time from 60 to 45 game-minutes (`src/hub/upgrades.ts` `6205cb9`). The card states the price. |
| RFID bags | PLAYABLE | `retail-2`, then the $28,000 RFID line after the centre is paid. Connect time drops to 25 game-minutes. Same file. |
| Low-cost fit-out | PLAYABLE | Spec branch in `src/ui/SpecTree.tsx` `4833711` and Growth nodes `spec-lowcost-*` (`src/research/nodes.ts` `5b91d76`). Path points arrive at field levels 6, 8, and 10. |
| Premium fit-out | PLAYABLE | Same spec tree, plus the premium sheet (`src/ui/PremiumPanel.tsx` `7f1f1c7`): premium check-in at FL3, fast-track I at FL4, fast-track III and the VIP room at FL8 (`src/premium/data.ts`). |
| Fast-track lane II | PLAYABLE | The lane is on the premium sheet at FL6. `hasCtScanners()` is true when Growth node `safety-4` has granted `ct_lanes`, and still true for economy tech `safety_security.t2` (`src/game/sim.ts`). The card says whether CT scanners are online. |
| Code F stand | PLAYABLE | Jumbo stamp `stand_l` is in the stand tray. `standIcao` returns F for jumbo and legacy L (`src/game/sim.ts` `d31f542`). Airfield research `airfield-3` and field level 5. |
| Code F tray row | PLAYABLE as a bill | `code_f` at FL8 (`src/progression/unlocks.ts` `9d2e1ec`) is a commission: cash and daily upkeep. It does not place a stand. The stand is `stand_l`. |
| MARS stands | SIM ONLY | `mars_stands` in `src/content/research_tier5.ts` `4a49a28`. That list is not imported by the live tree. `StandClass` is only S, M, and L. |
| Cargo hub | PLAYABLE | Night hub stamp `nighthub` at FL4, opened by `airside-6` (`src/tier3/unlock.ts`). Cargo spec nodes add the rest. |
| Cargo hub II | SIM ONLY | `cargo_hub_ii` in `src/content/buildings_tier3.ts` `0501c63`. The file says it has no sim wiring and no UI. |
| Cold chain | SIM ONLY | Economy node “Cold-Chain & Express Hub” never unlocks (`src/economy/techTree.ts` `6205cb9`). Diplomacy reads `coldChainRooms: 0` in `src/game/sim.ts`. No cold-chain building. |
| MRO | PLAYABLE | Stamp `mro` at FL4. `airside-5` grants `mro_hangar`. Jobs run in `src/tier3/session.ts`. The economy income bonus `maintenance.mroIncome` stays off because that tech node is never bought. |
| Hotel | PLAYABLE | Hall stamps `hotel_inn`, `hotel_biz`, `hotel_resort`, and the late `airport_hotel` at FL7 (`src/tier3plus/catalog.ts` `4a2bae1`, landside research `landside-6`). |
| Rail link | PLAYABLE | `rail_link` at FL9 in that catalog, and the rail station stamp `rail` (`landside-5`). |
| Tower | PLAYABLE | Control tower stamp, research `airfield-5`. |
| Tower III | MISSING | No building or node with that name. |
| ATC approach | PLAYABLE as a bill | `atc_approach` at FL7 is a commission and daily upkeep (`src/progression/unlocks.ts`). |
| ATC approach centre / digital tower | SIM ONLY | `atc_approach_centre` in `buildings_tier3.ts`. `digital_tower` in `research_tier5.ts`. Neither is in the live tree or the tray as a placed building. |
| Third runway | PLAYABLE | `placeRunway` accepts another strip. One construction site at a time. Three strips raise the bank batch to 3 (`src/game/sim.ts`). |
| Third-runway studies | SIM ONLY | `third_runway_studies` in `research_tier5.ts` only. |
| Hydrant fuel | PLAYABLE | `airside-1` grants `hydrant_fuel`. Fueling uses it (`src/game/sim.ts`). |
| Hydrant pit row | PLAYABLE as a bill | `hydrant` at FL5 is a commission and upkeep. The fuel behavior is the research grant above. |
| SAF blending | PLAYABLE | `saf_blending` at FL8 (`src/tier3plus/catalog.ts`). Research `spec-green-1`. Raises the fuel bill and green demand. |
| Military apron | PLAYABLE | Hangar-side hardstands within ramp range, taxi to the strip, and away from a close passenger jetway. `safety-5` grants `mil_ramp` (C-5). `milRampLine()` explains the pads. There is no apron stamp. |
| Landmark commission | PLAYABLE as a bill | `prestige_landmark` at FL10. Cash and upkeep. It does not place a set piece. |
| Landmark set | PLAYABLE | Build > Landside > Landmarks: observation tower, aviation museum, sky garden, art concourse, grand arrivals hall, quiet hall (`src/tier3plus/catalog.ts` from `buildings_tier3.ts`, meshes in `src/render/world/landmarks.ts`). Field level from the late ladder (now reaches 10), prestige stars where the table says, one per airport. Door income, demand and rating bonuses once open. City approval is not modelled. |
| Spotters deck | MISSING | `docs/DESIGN_PASS.md` §12 (`78d868c`) is an idea called Spotter Reputation. No feature by that name. The closest data row is the unwired observation tower. |

Tier III rows that are data only (`pier_iii`, garage, remote screening, de-icing apron II, business and resort hotels, fuel farm III, satellite) stay out of the tray. Putting them on the commission button would charge upkeep for effects the sim does not run.

## Tech, hub, disruptions, rivals, scenarios, council, automation

| Item | Status | Evidence |
| --- | --- | --- |
| Growth tree, including spec branches | PLAYABLE | `src/research/nodes.ts` `5b91d76` and `src/ui/research/ResearchTree.tsx`. Costs are 0 / 26 / 38 / 54 / 76 / 108 (`src/research/config.ts`, `docs/RESEARCH.md`). The careful bot finished all 62 nodes on day 90. |
| Economy tech tree | PLAYABLE (partly) | Growth > Ops wallet (`src/ui/OpsWalletPanel.tsx`, `src/economy/wallet.ts`). Nodes the sim reads (`src/economy/wiring.ts` `LIVE_TECH`) and their prerequisites can be bought; the rest are held back so points are not spent on nothing. Solar array and battery bank appear on the apron. Economy state is saved. |
| Research tier 4 and 5 lists | SIM ONLY | `src/content/research_tier4.ts` and `research_tier5.ts` `4a49a28`. Tests check the ids. The live tree does not import them. Prerequisites are old desk ids. |
| Hub connections and banks | PLAYABLE | From FL3 (`src/hub/share.ts`). `buildBanks` (`src/hub/banks.ts` `6205cb9`) feeds `tickHubConnections`. The flight card and the info views name Connections and Links. |
| Hub-tier checklist | PLAYABLE | Airlines desk and the Hubs sheet (`src/ui/hub/HubPanels.tsx`, `20e829d`). Progress, the next tier’s rewards, and a common-use showcase are on the card. Desk and lane lines stay on “Waiting on the desk allocator” until a lease exists, and dedicating a desk stays disabled. |
| Late disruptions | PLAYABLE | Seven events in `src/disruptions/catalog.ts` `fc4a2c8`: volcanic ash, state visit, software outage, strike day, hub meltdown, health screening, rival price war. Quiet before FL3. Chance rises through FL5 (`src/disruptions/data.ts`). `tickDisruptions` posts the alert text. |
| Rival airport | PLAYABLE | Bellwater is created when the player buys land (`ensureRival` in `src/game/sim.ts`) and advances each day inside `sampleEconomy`. The rival sheet is `src/rival/RivalPanel.tsx` `8bc65f8`. |
| Scenarios | PLAYABLE | Eight templates in `src/scenarios/templates.ts` `b502bfa`. The Field Levels sheet lists them (`src/ui/nav/ScenarioPanel.tsx`). Start is opt-in: a new game does not apply one. Island Hop blocks further parcels, Cramped City keeps the night curfew after Night bank, Mountain Gateway caps strip length, and Rescue puts $250,000 on the loan book without wiring cash. The day close scores passengers, profit days, night-hub revenue, and connecting share. |
| Airport Council | MISSING | No council type, meeting, or vote in `src/` or `docs/`. `docs/IDEAS.md` `dbd0fb0` parks “AGM / shareholder votes after IPO” as an idea. |
| Auto bank | PLAYABLE | `scheduleAuto` defaults on. The planner labels Auto bank and Manual bank. |
| Desk staff on posts | PLAYABLE | Hired desk staff are spread across check-in and security in the sim. |
| Stand and staff automation tech | SIM ONLY | Economy modifiers `airside.autoStandAllocation` and `staff.dynamicAllocation` are never read (`src/economy/techTree.ts`). `ai_stand_planner` is only in `research_tier5.ts`. |
| Bag system upgrade | PLAYABLE | The operations sheet calls `upgradeBagSystem`. |

## Still unwired

Green Pioneer’s net-zero goal cannot be met. `src/sustainability/carbon.ts` is not on the day book, and the sheet says so before Start.

Left alone on purpose:

- Tier III catalog buildings stay data until their effects exist.
- Economy wallet nodes no system reads stay held back in the wallet. Add a `LIVE_TECH` row in the same change that wires a modifier.
- The hub checklist is already on the airlines desk. Desk lines wait on the allocator. A second lease table would fight that design.
- Airport Council and the spotters deck have no code to schedule.
