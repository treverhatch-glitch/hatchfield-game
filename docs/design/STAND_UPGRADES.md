# Stand sizes, surfaces, and attachments

Status: design only. No gameplay code in this note. Trever, Oct 2026.

Numbers in the audit are the ones in the tree on 15 Oct 2026. Numbers in the proposal are tunables for a later config file. They are not a retune of the live economy.

Related: [FUEL_CONTRACTS.md](./FUEL_CONTRACTS.md) ticket 6 (a stand fuels by hydrant only with a pit and a dispenser), [HUB_PROGRESSION.md](./HUB_PROGRESSION.md) (a dedicated gate is a lease on a stand), [TURNAROUND_REFERENCE.md](./TURNAROUND_REFERENCE.md), [SOCKETS.md](../SOCKETS.md), [UI_SPEC.md](../UI_SPEC.md).

## Recommendation

Do it, and keep it narrow.

Three stand stamps replace the four we have. Each stamp is a footprint. A surface rung, bought on the stand, decides which aircraft in that footprint may use it and which attachments the pad will hold. Attachments are bought on that same card. A jet bridge, a hydrant pit, a power cable, a light, a de-ice outlet, and a flag are attachments. They are not new stand types.

The part worth copying is Airport CEO's stand card (three sizes, pave in place, jetway added and removed on the stand) and Two Point's room machines (research opens a thing you can see, the thing changes the job). The part to leave behind is anything that makes the player demolish a working stand, hunt a second-floor security zone, or buy an upgrade that only adds a number.

Do this much:

- Three footprints, in-place surface rungs, and a refusal when the next footprint does not fit.
- An attachment list on the building card, shared by stands and other buildings.
- The first attachments that already have a picture in the sim: jet bridge, hydrant pit, ground power.
- A fire-station bell as the proof that the list is not stand-only.

Leave these for later, or out:

- A fourth footprint. Code D, E, and F share the heavy pad. The rung changes the box.
- Helipads folded into the light stand. `aw139` and `s76` stay on the pad.
- Grass under a heavy jet. The heavy pad starts as concrete.
- Stand wear and a repair minigame, until a playtest shows pavement is free power. Airport CEO players already hate repairing stands by hand.
- A "upgrade every stand" button, until a pier actually has more than a handful of stands.
- Staff assigned to one stand. That is the Two Point complaint, and it is a different project.

## 1. What players said

### Airport CEO

The game already did Trever's shape. The wiki lists three stands: small (5×7, general aviation and small commercial), medium (10×10), large (16×16). Each stand upgrades its surface. Small goes grass, asphalt, or concrete. Medium and large go asphalt or concrete, and a jetway is built or removed on the stand. Small stands do not take a jetway. Demolish is a button on the stand, and only when the stand is closed. Fuel and baggage vehicles need a service road into the stand.

Sources: [Stand, Airport CEO Wiki](https://airportceo.wiki.gg/wiki/Stand).

What players pushed on:

- Jetways demand a secured upper floor. Players with security on the ground floor were told to build a second floor before the bridge would arm. One player gave up and rebuilt the airport. [Steam, Jul 2019](https://steamcommunity.com/app/673610/discussions/0/1643167006295629790/), [r/airportceo](https://www.reddit.com/r/airportceo/comments/f0k2va/jet_way_requires_second_floor/), [Steam, jetway building problem](https://steamcommunity.com/app/673610/discussions/0/3146305075712901342/).
- Expanding means demolishing, and a busy stand or check-in desk will not turn off. A 2025 new-player thread calls that the game-breaking part: the campaign wants you to rebuild, and the building will not empty. [r/airportceo](https://www.reddit.com/r/airportceo/comments/1k1mit2/new_player_frustrations/).
- Heavy-jet fuel is a truck problem. The advice players give each other is bigger trucks, more depots, parking next to the stands. [r/airportceo, Mar 2023](https://www.reddit.com/r/airportceo/comments/1268sgh/how_do_you_go_about_fuel_and_large_stands_serious/).
- A hydrant was requested in 2018 as a late-game pipe, with the dispenser cart and no bowser. Players noticed the underground-fuel marks already painted on the medium stand. [Steam, fuel depot idea](https://steamcommunity.com/app/673610/discussions/0/1693785669867614794/).
- Early threads ask for less clicking around contracts, vehicle shops, and pavement repair, and they also say the micromanagement is the game they wanted. The split is the lesson: the stand card is the fun click. Renewing every contract and repairing every slab by hand is the tedious one. [r/airportceo, 2017](https://www.reddit.com/r/airportceo/comments/736miq/a_few_thoughts/).

### Cities: Skylines 1 and 2

Skylines 1 zoned buildings level themselves. Players liked watching a block grow. They hated the abandonment spiral that followed a drop in land value, because the fix was to bulldoze. Service buildings did not grow in place.

The expansions that players still point at are the ones where you place the piece: Parklife, Industries, Campus, then Airports. Parklife's modules did a job (visitors, tickets, attractiveness). The Airports DLC reused the paint-an-area tool and then made the three architectural styles do the same thing, with a lot of the modules only raising a level meter. Leveling an airport is "wait until the passenger count goes up." Taxiways and runways that cannot cross pushed players back to mods. [Mega Bears Fan, Airports](http://www.megabearsfan.net/post/2022/03/16/Cities-Skylines-Airports-DLC-game-review.aspx), [r/CitiesSkylines, Airports vs modular mods](https://www.reddit.com/r/CitiesSkylines/comments/sbub3m/airports_dlc_vs_modular_airports_mods_kind_of_a/).

Skylines 2 started with upgrades stuck to one socket. Economy 2.0 (the June 2024 dev diary) changed that: you place the extension yourself inside a radius, and you can move it, delete it, or turn it off. [r/CitiesSkylines2](https://www.reddit.com/r/CitiesSkylines2/comments/1dcmvt6/economy_20_dev_diary_2/). Before and after that patch, the same complaints repeat:

- A capacity upgrade with no tradeoff is bought on every building and then feels pointless. A player who reached 1.1 million population wrote that they will never not upgrade school capacity. [r/CitiesSkylines2](https://www.reddit.com/r/CitiesSkylines2/comments/1ep3gq7/my_findings_after_reaching_11m_population/).
- Players wanted the upgrade to be a specialisation, with a reason to stop. [r/CitiesSkylines, Oct 2023](https://www.reddit.com/r/CitiesSkylines/comments/176ygc0/not_so_excited_by_the_buildings_upgrade_system/), [Steam, the upgrade menu](https://steamcommunity.com/app/949230/discussions/0/3874841497806736633/).
- Fixed sockets that cannot rotate, and sub-buildings that have to touch the parent, fight the terrain. The useful version is a radius and a connection the player draws. [Mega Bears Fan, Feb 2024](http://www.megabearsfan.net/post/2024/02/29/Suggestion-for-improving-Cities-Skylines-II-modular-buildings.aspx).
- The upgrade idea is welcome on a fire station or a school. It is a poor fit for a landmark that should be laid out by hand. Airports were the example players did not want flattened into one upgradable prop.

### SimAirport

Gates have sizes, and a larger aircraft needs a larger gate. Players asked for the jetway to be an upgrade on top of stairs, including on large gates, so a 1960s field can board a 747 on stairs and a remote stand does not grow a bridge in the middle of the apron. [Steam, plane requirements](https://steamcommunity.com/app/598330/discussions/0/3160848559772023965/).

Remote stands work, and the threads are mostly about the path. A bus stop, a secure door, a desk, a vehicle, and a road whose arrows point the right way. When the path is wrong the error often does not say why. Players who got it working describe the constraint as the fun part. Players who did not get it working were guessing. [Apog Labs forum](https://forum.apoglabs.com/t/new-to-this-remote-stand-thing/11406), [Steam, remote gates](https://steamcommunity.com/app/598330/discussions/3/1642044369651491941/), [r/SimAirport](https://www.reddit.com/r/SimAirport/comments/rarj4h/how_do_i_make_an_remote_walking_gate/).

### Airport Tycoon 3

A plane stand is the cheap pad ($40,000 in the GameFAQs guide). A jetway is "an upgraded planestand" at $100,000, and it only connects to a two-storey terminal. Bigger terminals unlock more jetway sockets, up to 28 on terminal 8. The guide tells you to buy terminal 4 specifically because that is when jetways, and the bigger aircraft that want them, show up. [GameFAQs, AT3 strategy](https://gamefaqs.gamespot.com/pc/917833-airport-tycoon-3/faqs/62508).

The player memory of the game is the fantasy, plus bugs that no amount of building would clear: "not enough bus stops" with hundreds of stops down, refuel income that could not see the maintenance buildings that were already there. The mods that fixed terminals 7 and 8 are what people recommend. [Metacritic user reviews](https://www.metacritic.com/game/airport-tycoon-3/user-reviews/). A hidden prerequisite that the UI will not confirm is the failure mode.

### Planet Coaster

Planet Coaster's shop and ride research unlocks a new building. It does not grow the building you already placed. The complaints that fill the suggestion threads are paths (click, length slider, nodes that will not join) and stations that are too bulky for the grid, with gates that cannot be themed. [r/PlanetCoaster, 2016](https://www.reddit.com/r/PlanetCoaster/comments/4bz09q/weekly_suggestionsideas_thread/), [r/PlanetCoaster, station overhaul](https://www.reddit.com/r/PlanetCoaster/comments/1jyao19/anyone_else_still_hoping_for_an_actual_station/).

The lesson for us is small. An attachment that needs its own path puzzle will be hated even when the attachment is a good idea. The jet bridge should arm because the stand is in range of a hall, which we already measure. It should not ask the player to draw a second network.

### Two Point

Two Point Hospital's good click is the room. You place the room, you add the machine, research opens two further upgrades of that machine, a janitor with the right qualification installs them, and the cure chance moves. Players teach that loop to beginners without complaining about it. [Research room, wiki](https://two-point-hospital.fandom.com/wiki/Research_(Room)), [Steam beginner's guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1632044281).

The tedious loop is staff. People leave the room they were trained for, diagnosis and treatment share a room, and the player ends up forbidding jobs by hand. [Steam, staff assigned rooms](https://steamcommunity.com/app/535930/discussions/0/2590022385667031315/). Two Point Campus uses the same room-and-item pattern. Copy the machine. Leave the staff roster alone.

A second Two Point lesson: a researched machine that does not fit means rebuilding the room. Our surface upgrade has the same risk when the heavy pad grows from code D to code F. The buy has to show the larger box first and refuse, with the cell that is in the way named. The player keeps the stand they have.

### Manor Lords

Burgage plots are the attachment fantasy players actually got excited about: the plot stays a house, and the backyard becomes a garden, a coop, or a workshop. [r/ManorLords](https://www.reddit.com/r/ManorLords/comments/1c0hdgh/the_burgage_plot_mechanics_are_the_true_game/).

The sour notes came later. Upgrading a whole plot to add one living space feels like a waste of timber. Clicking every house to level it up is a chore once the town is large, and players asked for a multi-select. A level that does not change how the household works gets skipped. [Steam, burgage update](https://steamcommunity.com/app/1363080/discussions/0/687494495670940516/), [r/ManorLords, upgrade clicking](https://www.reddit.com/r/ManorLords/comments/1qp3ck6/this_really_makes_me_wish_for_a_better_way_to/), [Steam, upgrade button](https://steamcommunity.com/app/1363080/discussions/3/4355620138225394847/).

Visible service points are the other Manor Lords bar. A granary works because you watch the cart arrive. Our turnaround sockets already name the hose, the belt, the bridge cab, and the GPU plug ([SOCKETS.md](../SOCKETS.md)). An attachment that does not add one of those points is a stat, and it does not ship.

## 2. What the game does today

Stands are one tile of type `stand`. The aircraft box is computed around that tile. Four tools place them.

| Tool | Class | Scale | ICAO box | Cost | Upkeep / day | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| `stand_s` | S | small | B, 30×42 m | $4,800 | none on the daily bill | Field level 1 |
| `stand` | M | small | C, 45×52 m | $6,200 | none on the daily bill | Field level 1 |
| `stand_w` | L | wide | E, 80×82 m | $16,000 | $90 | Field level 4, `widebody_ops` (48 points) |
| `stand_l` | L | jumbo, or wide if heavy metal is locked | F, 95×88 m | $28,000 | $160 | Field level 5, `heavy_pack` (55 points) |

`STAND_OFFERS.small.upkeepPerDay` is $40 and is not added in `pillarUpkeep`. Only wide and jumbo stands are. The proposal in §4 puts an upkeep on every rung, including the two cheap pads, which is a new bill and needs the bot run on ticket 2.

Sources: `STAND_S_COST` and `STAND_COST` in `src/game/catalog.ts`, `STAND_OFFERS` and `STAND_ENVELOPE` in `src/scale/data.ts` and `src/render/aircraft/specs.ts`, `standClassForTool` / `standScaleForTool` in `src/scale/logic.ts`, unlock levels in `src/progression/unlocks.ts`. A missing scale on an L stand stays code F (`envelopeLetter` in `src/render/aircraft/stands.ts`). `stand_l` writes `wide` when `heavy_pack` is missing and the field is below level 5, so the jumbo tool can silently place a wide stand.

Who fits is `standAccepts`: a stand takes its letter or a smaller one. Helicopters take a helipad only. Wings also have to clear other parked aircraft and terminal tiles (`standFitsAirframe` in `src/game/sim.ts`). The airframes in `src/render/aircraft/realworld.ts` land like this today:

| Letter | Airframes | Smallest stand that accepts them |
| --- | --- | --- |
| A | `bn2`, `f15` | Small |
| B | `dhc6`, `pc12`, `at802`, `citation`, `crj700` | Small |
| C | `atr72`, `e175`, `cl415`, `a223`, `e195e2`, `a320neo`, `b738`, `b38m`, `a321`, `a21xlr` | Medium |
| D | `c130`, `kc135`, `b752f`, `b763f`, `c17` | Wide (code E) |
| E | `b789`, `a359`, `b77w` | Wide |
| F | `b748f`, `a380`, `an124`, `c5` | Jumbo |
| H | `aw139`, `s76` | Helipad |

There is no grass, dirt, or concrete state on a stand. The apron around it is whatever tile was there. Grass is a legal wing overlay (`WING_CLEAR_TILES` in `src/game/standFoot.ts`) and is not a surface you upgrade. Pavement quality does not change who may park.

Jetway versus remote is a toggle on the airfield tray, `standAccessMode`, default `remote`. A jetway stamp costs ×1.85 (`STAND_JETWAY_MULT`). The stand stores `standAccess`. Old saves with no entry are grandfathered: a hall within `JETWAY_RANGE` (8 cells) counts as a jetway. Boarding already branches on that flag. In `src/game/sim.ts` the board phase (sim seconds, before pace) is about 3.2 to 7.5 on a jetway, 5 to 13 by bus, and 5 to 17 on foot. Jetway guests linger and spend more in the hall. The logistics side asks for one bridge on a small or medium turn and two or three on a large one (`maxBridgeDoors` in `src/logistics/needs.ts`).

The tray also sells progression stamps that are a second stand track: `jet_bridge` (field level 4, cost $0, "arms a single jet bridge on the next stand"), `code_e` (level 5, $54,000, upkeep $660), `code_f` (level 8, $160,000, upkeep $2,100), `jet_bridge_3` (level 8, $140,000, upkeep $1,500). Those prices must not be stacked on top of `STAND_OFFERS`. One concrete pad has one price.

Hydrant fuel is a research flag. `hydrant_fuel` (36 points, field level 4, after `widebody_ops`) moves the whole farm's draw from "trucks" to "hydrant" in `tickFuel`. The pit stamp (`hydrant`, $40,000, upkeep $480, tray field level 5) is a different object and does not have to exist for the flag to count. [FUEL_CONTRACTS.md](./FUEL_CONTRACTS.md) ticket 6 already says the opposite: a stand fuels by hydrant only with a pit and a dispenser, and the stand card says which.

Ground power is a vehicle. `gpuMinutes` is 20 / 35 / 60 by size class, and the GPU costs $1,500 with $40 a day upkeep (`src/logistics/needs.ts`, `src/logistics/defaults.ts`). Nothing on the stand replaces it. Pre-conditioned air is not a system. The turnaround note already wants GPU and PCA at block-in.

De-ice is a pad stamp (`deice`, $11,500) plus the `deice` research (34 points, after night bank). It is a building, not a fitting on a stand.

The fire station is a `fire` tile at $12,000. Airlines will not sign without one. The fire budget line multiplies by the station count, and a field with no station pays a skeleton rate (`budgetLineCost` in `src/game/economy.ts`). There is no scramble clock and no bell. ARFF categories exist as a data table (`src/arff/data.ts`) and are not an attachment.

The building card (`src/buildinginfo/card.ts`, `src/ui/BuildingPanel.tsx`) opens on a placed building: name, status, one why line, then throughput, bays, queue, staff, upkeep, bottleneck. It has no upgrade row and no attachment row. In-place upgrades that do exist are the power plant (three tiers) and the prefab hall (`PREFAB_TIERS`). Hotels have three grades chosen at stamp time, which is the pattern we are moving stands away from.

`src/render/attachments.ts` is the turnaround socket rig (hose, belt, bridge). It is not a building-module system. No building stores a list of bought fittings.

## 3. Three base sizes

The stamp is the footprint. A smaller aircraft may always use a larger pad. A larger aircraft may not use a smaller pad. The surface rung, in the next section, narrows that further.

| Size | Player name | Box at the top rung | Who it is for |
| --- | --- | --- | --- |
| `light` | Light stand | Code B, 30×42 m | Bush props, the trainer, the bizjet, the CRJ |
| `narrow` | Narrow stand | Code C, 45×52 m | ATR through the A321 |
| `heavy` | Heavy stand | Code F, 95×88 m, grown from a code D pad | 757 and 767 class, then the widebodies, then the code F metal |

Helipads stay a helipad. Folding `aw139` onto a light stand would let a helicopter occupy a fixed-wing gate, which `standAccepts` already refuses.

The heavy pad is the one that grows. Code D is 67×70 m, code E is 80×82 m, code F is 95×88 m. The player places the anchor on grass, as today. The buy button for the next rung draws that larger box first. If a cell is off the map, inside runway clearance, on another stand, or on a building, the button stays disabled and uses the sentence `standPlaceBlock` already returns. Wings may still cover grass, taxi, runway, road, and belt.

Airframes by the size that first accepts them, at the rung named in §4:

| Airframe | Letter | Size | Lowest rung that accepts it |
| --- | --- | --- | --- |
| `bn2` | A | Light | Grass |
| `dhc6`, `pc12`, `at802` | B | Light | Grass (bush list, even though the letter is B) |
| `f15`, `citation`, `crj700` | A–B | Light | Low concrete |
| `atr72`, `e175` | C | Narrow | Asphalt |
| `cl415`, `a223`, `e195e2`, `a320neo`, `b738`, `b38m`, `a321`, `a21xlr` | C | Narrow | Concrete |
| `c130`, `kc135`, `b752f`, `b763f`, `c17` | D | Heavy | Hardstand |
| `b789`, `a359`, `b77w` | E | Heavy | Widebody slab |
| `b748f`, `a380`, `an124`, `c5` | F | Heavy | Heavy slab |

`f15` is a small airframe. It parks on a paved light stand. The military ramp rule in the hub note (hangar-side, not a passenger jetway) still applies when that flight is a Guard turn. The stand size does not replace it.

A bizjet (`citation`) fits the light pad from low concrete upward. Finished concrete does not admit a new airframe. It is the rung a VIP contract can require, and it is the rung that unlocks the light pad's power and pit attachments. That is the "top tier is VIP on a small stand, wide and heavy on a large stand" split: the light pad's top rung is a better pad for the same metal, and the heavy pad's top rung is a bigger aircraft.

## 4. Surface ladder

Three rungs on every size. The player-facing name depends on the size, because a grass heavy pad is not a thing we should sell. The stored value is `0 | 1 | 2`.

| Rung | Light | Narrow | Heavy | What changes |
| --- | --- | --- | --- | --- |
| 0 | Grass | Asphalt | Hardstand (code D) | The cheap pad. The bottom of that size's aircraft list. |
| 1 | Low concrete | Concrete | Widebody slab (code E) | The everyday jet pad for that size. |
| 2 | Finished concrete | Reinforced | Heavy slab (code F) | The pad airlines ask for, and the pad the expensive attachments need. |

### Gates

Field level is the XP gate. `fieldLevelOf` already maps XP to a level (`FIELD_LEVEL_XP` in `src/game/catalog.ts`). A surface does not grow a second XP bar.

| Buy | Field level | Research | Notes |
| --- | --- | --- | --- |
| Light, grass | 1 | — | Default when the light stamp is placed. |
| Light, low concrete | 1 | — | Same metal the small stand takes today. The opening field can pave. |
| Light, finished | 3 | — | Pavement, not a technology. VIP letters may require it. |
| Narrow, asphalt | 1 | — | Default for a new narrow stamp. |
| Narrow, concrete | 1 | — | Today's medium stand. A 737 fits on day one. |
| Narrow, reinforced | 3 | — | Unlocks the pit and a second door. Same aircraft. |
| Heavy stamp, hardstand | 3 | — | New cheaper entry. Code D only. |
| Heavy, widebody slab | 4 | `widebody_ops` | Same gate as today's wide stand. |
| Heavy, heavy slab | 5 | `heavy_pack` | Same gate as today's jumbo stand. |

Research stays on the things that are a technology: widebody ops, heavy metal, hydrant, de-ice, night bank. Pouring concrete is a field-level check. Adding a research node for "better cement" would put a lab between the player and a pad they can already see.

`stand_class` (40 points, after de-ice) stays the parent of `widebody_ops`. It does not become a pavement node.

### What each rung does

Effects are modifiers the sim already has a place for, plus two that are named below so they cannot sneak in as a hidden roll.

- Grass takes the bush list only (`bn2`, `dhc6`, `pc12`, `at802`). Rain adds a named taxi delay on that stand, shown on the card. A jet bridge, a pit, and a GPU cable refuse with "Pave this stand first."
- Low concrete and asphalt take the middle list. A jet bridge is legal. Fuel is a bowser.
- Finished, reinforced, and the two heavy slabs take the top list for that size. They are the rungs a hydrant pit can be cut into. Flag and VIP letters can name the rung. The aircraft on the rung below still fit.
- The heavy rungs change the ICAO letter, so they change who can park. The light and narrow top rungs do not. They change which attachments and which contract asks are legal. A top rung that only added "stand quality +10%" would be the school-capacity upgrade players called pointless.

Wear is not in this pass. Airport CEO degrades stands fast and then asks the player to repair them one at a time, and players asked for that to be automatic. If a later playtest shows a paved stand is strictly better and everyone buys it, the answer is a higher upkeep on rung 2, which is already in the table, not a repair click.

### Prices

The totals for the pads we already sell match today's stamp prices. New choices are the cheap rungs.

| Pad, brought to this rung | Pay for this step | Total spent | Upkeep / day after |
| --- | --- | ---: | ---: |
| Light grass | $2,800 stamp | $2,800 | $20 |
| Light low concrete | $2,000 | $4,800 | $35 |
| Light finished | $3,500 | $8,300 | $55 |
| Narrow asphalt | $4,400 stamp | $4,400 | $30 |
| Narrow concrete | $1,800 | $6,200 | $40 |
| Narrow reinforced | $4,000 | $10,200 | $70 |
| Heavy hardstand | $9,000 stamp | $9,000 | $60 |
| Heavy widebody slab | $7,000 | $16,000 | $90 |
| Heavy heavy slab | $12,000 | $28,000 | $160 |

$4,800, $6,200, $16,000, and $28,000 are `STAND_S_COST`, `STAND_COST`, and `STAND_OFFERS`. The upkeep on the widebody and heavy slabs matches the wide and jumbo figures that `pillarUpkeep` already charges. The upkeep on light and narrow pads is new: those stands are free to run today. Ticket 2 is the one that adds that bill, and it wants the same bot run as ticket 4 before the numbers are treated as final. A player who wants today's medium stand still pays today's $6,200 to build it. A player who wants a grass strip for Bushline pays less and cannot park a CRJ.

Bulldoze stays at 40% (`BULLDOZE_REFUND`). An in-place upgrade has to stay cheaper than demolishing and placing a second stand, or players will do what Airport CEO already makes them do. These steps are.

The progression stamps `code_e` ($54,000), `code_f` ($160,000), `jet_bridge` ($0, arms the toggle), and `jet_bridge_3` ($140,000) retire as placement tools. Their job becomes the rung button and the bridge attachment. Copying the $54,000 or the $140,000 onto every door would price a normal gate like a landmark. The landmark money stays on the terminal and the pier, where those stamps were already pretending to be buildings.

## 5. Attachment catalog

An attachment is bought on one host, has a cost and a daily upkeep, and adds a socket the player can see. The sim reads the effect. The mesh is a later render pass on the same id. A missing mesh does not turn the effect off. The card still names the socket, and the art for that id lands in the same ticket so the player is not left with a stat.

Nothing here is a capacity upgrade you always want. Each one removes a vehicle, a walk, or a delay the player can already see, and it adds a bill. A stand without it keeps working.

| Id | Hosts | Cost | Upkeep / day | Gate | Effect |
| --- | --- | ---: | ---: | --- | --- |
| `jet_bridge` | Light and narrow, rung ≥ 1. Heavy, any rung. | $4,500 light, $5,000 narrow, $8,000 heavy | $30 / $45 / $70 | A hall within 8 cells. Heavy's second door needs reinforced or widebody slab. The third door needs the heavy slab. | Sets pax mode to `jetway`. Boarding clocks stay the ones already in `sim.ts`. Extra doors use `maxBridgeDoors` (1, or 2, or 3 on the A380). |
| `hydrant_pit` | Narrow rung 2. Heavy rung ≥ 1. Light rung 2 gets a cabinet, one hose. | $8,000, or $4,000 for the light cabinet | $40, or $20 on light | `hydrant_fuel`. A line from the farm, fuel ticket 6. A dispenser on the fleet. | This stand fuels at 2,500 L/min from the farm. No bowser. A heavy slab wants two pits; the second pit is a second buy. A stand with no pit still calls a bowser. |
| `gpu_pca` | Any stand, rung ≥ 1, and not grass. | $4,500 | $25 | Substation built, or the power plant has spare capacity. | Drops the GPU truck request while the cable is live. `gpuMinutes` (20 / 35 / 60) is the time saved. PCA only bites when winter ops or a hot-day flag is on: it removes the weather dwell, and it does nothing on a mild day. |
| `apron_light` | Any stand. | $2,200 | $12 | Field level 2. | A night turn on an unlit stand takes +20% on the board limit between dusk and dawn. The card says "Unlit". Lights remove that and nothing else. |
| `deice_outlet` | Narrow and heavy, rung ≥ 1. | $6,500 | $20 | `deice` researched, and at least one de-ice pad on the field. | The truck sprays at this stand. The aircraft does not taxi to the pad. Glycol still comes off the pad's stock. A storm with no outlet and no free pad still holds. |
| `flag` | Any stand. | $800 | $5 | — | Paint. If the hub lease on this stand is dedicated, the flag is that airline's mark and the existing dedication credit applies. A flag with no lease does not move standing. |
| `alarm_bell` | Fire station. | $3,500 | $15 | Field level 2. | Scramble time × 0.8. |

### Jet bridge

Today the bridge is decided when you stamp, at ×1.85. After this, the stamp is always the remote pad and the bridge is a row on the card. A grass stand cannot take one. A stand with no hall inside 8 cells cannot take one. The refusal names the missing hall or the distance. There is no upper-floor security check. That was the Airport CEO thread.

Remote boarding stays the bus if a terminal-bus depot exists, and a walk if it does not. Both already exist. A bridge in the middle of the apron, with no hall, is the thing SimAirport players said would look wrong, so the range check stays.

Removing a bridge refunds 40%, the same as a bulldoze, and the stand goes back to bus or walk on the next turn. An aircraft already on the bridge finishes the turn.

### Hydrant pit

This is fuel ticket 6, not a new fuel design. The research stops flipping every stand. The $40,000 / $480 pit stamp retires. The $420 a day research upkeep stays on `hydrant_fuel` and is the pump house. The per-stand pit is the $8,000 row, which is cheap enough that a player builds it on the stands they care about and leaves the others on bowsers.

A pit with no line from the farm can still be bought. It stays dry. The card says "Pit dry. Connect a line from the farm." The bowser keeps coming until the line, the research, and a dispenser are all true. Ticket 7's pipeline is one way to feed that line. A painted hydrant trunk from the farm is the other, and it should be the same connection test the fuel note already uses for rail: the pieces meet, or the flow stays off.

Two pits on a heavy slab match the turnaround note (a widebody wants two points, a jumbo wants the hydrant). The second pit is a second attachment, not a hidden bonus of the slab.

### Ground power and PCA

The GPU truck is the picture. The cable removes that truck from this stand's turn. If the substation is missing or the plant is over cap, the cable is dark and the GPU request is raised again. The card says "Ground power dark. A GPU truck is coming." Power is already a player bottleneck. The attachment hooks onto it.

PCA is the hose next to the cable, on the same buy, because the real turn hooks both at block-in. It has no effect on a mild day. On a winter-ops day or a hot-day flag it cancels the extra dwell those modes add for an unconditioned cabin. If those modes have no dwell yet, the ticket that adds the hose also adds the dwell, and the card names it. A PCA that is a flat speed bonus on every turn is the upgrade everyone buys.

### Lighting

There is no night-ramp penalty in the sim today. The lighting ticket adds one, and only between dusk and dawn, and only on stands without the lamp. Day operations do not change. Night bank remains the research that makes night freighters worth flying. The lamp is how a stand stops paying the dark tax.

### De-ice outlet

The pad building stays the place fluid is stored and trucks are filled. The outlet is a mark and a hose reel on the stand so the spray happens where the aircraft already is. Buying an outlet on a field with no pad refuses: "Build a de-ice pad. The truck fills there." This keeps one glycol stock.

### Flag

Cosmetic on purpose. Hub progression already has the lease and the score. The flag is the mesh for a dedicated stand. It does not invent a second relationship bonus.

### Fire bell

Trever's example, and the first non-stand host. There is no response clock today, so the bell ticket adds one. Scramble is 45 sim seconds at the station, then the drive at the existing vehicle speed. The bell multiplies the 45 by 0.8 (36 seconds). It does not multiply the drive. Distance stays the bottleneck the layout chose. The bell is a socket on the roof, and the crew run to the bay socket that already exists for the ARFF truck. A second station does not need a bell to function. A station with no crew still does not roll, bell or not. Staffing stays the fire budget.

## 6. Generic attachment system

One table, every host. Stands are the first hosts. The fire station is the second. A later host (a hangar bay, a fuel-farm coupler) is another row, not another UI.

Proposed home: `src/stands/attachments.ts` for the data, and a tiny applier next to it that the sim calls. The data file imports types only. It does not import the sim, and it does not import Three.js.

```ts
type HostKind = 'stand' | 'fire' | 'hangar' | 'fuel'

interface AttachmentDef {
  id: string
  name: string
  hosts: HostKind[]
  /** Empty means every size. */
  sizes: Array<'light' | 'narrow' | 'heavy'>
  minRung: 0 | 1 | 2
  cost: number
  upkeepPerDay: number
  minFieldLevel: number
  research: ResearchId | null
  /** A tile that must already exist somewhere on the field. */
  needsTile: string | null
  sockets: string[]
  effects: AttachmentEffect[]
}
```

Effects are a closed list: `pax_mode`, `fuel_mode`, `skip_service`, `night_lit`, `deice_here`, `brand`, `scramble_mult`. A new effect is a new variant and a sim branch that reads it. The render side maps `id` to a prop and hangs it on `sockets`. `docs/SOCKETS.md` gains a row per socket. Names that already exist and should be reused: `bridge_cab`, `bridge_hall`, `plane_gpu_port`, `cable_reel_out`, the hydrant `dispenser` bay.

Save shape, keyed by the stand's `c,r` the same way `standClass` is keyed today. Buildings that are not stands use their tile key the same way.

```ts
standSize: Record<string, 'light' | 'narrow' | 'heavy'>
standRung: Record<string, 0 | 1 | 2>
attachments: Record<string, { id: string; granted?: 'legacy' }[]>
```

Upkeep sums from the defs in the daily bill, beside stand upkeep. The building card's upkeep line lists the fittings under it, each with its "Inputs:" tooltip, which is the rule `UI_SPEC.md` already sets.

A buy checks, in order: host kind, size, rung, field level, research, needed tile, footprint room for a growing stand, cash. The first failure is the sentence on the row. There is no second failure hidden behind it.

Caps: one of each id, except `hydrant_pit` and `jet_bridge`, which allow a count up to the airframe's fuel points and bridge doors. Extra copies past that refuse with "This stand already has two pits."

## 7. UI

Click the stand. The left building panel opens. That panel already exists. Two sections join the ones it has.

```
┌ Light stand · Grass ─────────────── × ┐
│ Idle                                   │
│ Bushline can use this. A CRJ needs     │
│ low concrete.                          │
│                                        │
│ Upgrade                          ▸     │
│ Attachments                      ▸     │
│ Throughput                       ▸     │
│ ...                                    │
└────────────────────────────────────────┘
```

Upgrade, opened:

```
Grass                         now
Low concrete          $2,000  Field level 1
  Takes the Citation and the CRJ.
Finished concrete     $3,500  Reach Field level 3
```

The next heavy rung also draws the ghost box on the apron while the row is hovered. A blocked grow names the cell. The player does not find out by buying.

Attachments, opened, one row each:

```
Jet bridge            $4,500  Pave this stand first
Hydrant cabinet       $4,000  Research Hydrant fuel system
Apron light           $2,200
Flag                    $800
```

A bought row shows the upkeep and Remove. Remove refunds 40% and pulls the prop off on the next tick. An aircraft on the stand keeps the fitting until it pushes.

The airfield tray loses the jetway / remote toggle. It shows three stamps: Light, Narrow, Heavy. Heavy is locked until field level 3, with the lock sentence on the stamp, the same way locked stamps work today. The old tools `stand_s`, `stand`, `stand_w`, and `stand_l` remain as aliases for one release so tests and the starter kit can place a known pad. They are not on the tray.

The panel is not a modal. Esc closes it in the existing order, before the pause sheet. The apron stays visible.

Service points: a bought fitting gets a marker on the apron at its socket. A GPU cable is a cable. A pit is a pit. A bell is a bell on the station roof. The vehicle or the passenger travels to that marker using the hand-off rules in `docs/HAND_OFFS.md`. A fitting with no marker is unfinished, even if the number is already applied.

When a pier has more than about twelve stands, a later ticket can add "pave every light stand on this pier" as a single confirm that lists the bill. It is not in the first build. Manor Lords players asked for it only after the per-house click got old, and a new field has two stands.

## 8. Save migration

Old keys stay readable for one version: `standClass`, `standScale`, `standAccess`. New keys are written on load. A save that already has the new keys is left alone.

The migration keeps every aircraft that can park today able to park tomorrow. It does not drop a paved stand back to grass.

| Old record | Size | Rung | Letter after |
| --- | --- | --- | --- |
| Class S | light | 1, low concrete | B |
| Class M, scale missing or small | narrow | 1, concrete | C |
| Class L, scale wide | heavy | 1, widebody slab | E |
| Class L, scale jumbo, or L with no scale | heavy | 2, heavy slab | F |

A stored `jetway`, or a grandfathered hall within 8 cells, writes `jet_bridge` with `granted: 'legacy'`. No charge, and the upkeep starts. A remote stand gains no bridge.

If the save has researched `hydrant_fuel`, every existing stand gains `hydrant_pit` with `granted: 'legacy'`. That preserves today's "the whole field is on the hydrant" behavior for old fields. New stands placed after the load do not get a pit. The player can remove a legacy pit. The research flag on its own no longer changes a stand that has no pit. This is the migration fuel ticket 6 needs, and it should land with that ticket so the two do not fight.

The starter kit's two stands are class M. They migrate to narrow concrete and the first jet still fits. The kit price is unchanged in this note.

Tests for the migration ticket: every id in `REAL_AIRFRAMES` is accepted by the migrated stand that accepts it today, and rejected by the one that rejects it today. Helicopters still fail a fixed-wing stand. A fixture with no `standScale` on an L stand still accepts `a380`.

## 9. Fuel, hubs, and the other infrastructure

Fuel. Ticket 6 is the pit row in §5. This note does not change suppliers, the per-litre price, rail, or the pipeline. The pipeline, when it exists, is one legal feed for the pit. Until the line exists, a bought pit is dry and the card says so. The dispenser vehicle stays the thing at the wing. A pit without a dispenser still does not fuel.

Hubs. A dedicated gate in [HUB_PROGRESSION.md](./HUB_PROGRESSION.md) is a lease on a stand id. The lease is not an attachment. The flag attachment is how that lease shows up on the apron. A fuel hook in the hub note is a slice of the contract (litres or a truck window reserved for one airline). A hydrant pit is the pipe. An airline can have a hook and still be served by a bowser. An airline can use a pit that is not reserved for them. The checklist line "fuel hook" must not be implemented as "has a pit", or a common-use hydrant would read as a dedicated lease.

Runways, taxiways, and the de-ice pad are not stands and do not grow rungs in this pass. Hangars already have small / wide / jumbo offers that mirror the old stand tools. A follow-up can point hangars at the same three sizes. It is not required for the stand card to work.

Power. `gpu_pca` reads the plant and the substation. It does not add a third power system.

## 10. Sim, rendering, and bottlenecks

The sim stores size, rung, and attachment ids, and it applies the effects in §5 and §6. It asks the render world for a socket position the same way the turnaround already does. It does not import a mesh.

The renderer reads the same ids and instances the prop. A prop that is late does not block the effect. The ticket is not done until the prop is there, because a cable the player cannot see is not a service point.

Bottlenecks stay choices:

- A CRJ on grass is refused because the pad is grass. The card says pave it.
- A 787 on a hardstand is refused because the slab is still code D. The button shows the larger box and the price.
- A jetway with no hall in range is refused, with the distance.
- A dry pit calls a bowser. The card says the pit is dry.
- A dark cable calls a GPU truck. The card says the plant is short.
- An unlit stand at night boards slower, and the card says unlit.
- A fire crew still drives the distance. The bell only shortens the scramble.
- No stand randomly fails, and no hidden quality roll slows a turn. Weather delays that do exist name the fitting that would cancel them.

## 11. Build tickets

Each ticket is one module. Tunables live in the config file from ticket 1. Do not touch `src/diplomacy`. Do not retune fuel prices or inbound lateness. Tickets that add a daily bill say when a bot run is required.

1. **Config and migration read.** Add the defs and the load path. Old tools still place old stands. New keys are written beside them. Unit test the acceptance table in §8. No tray change, no new button.
2. **Three stamps, in-place rungs.** The tray shows Light, Narrow, and Heavy. The upgrade section buys a rung. The ghost box and the refusal land here. Old tool ids stay as aliases. Starter kit unchanged in price and in who can park. Light and narrow upkeep is new, so this ticket gets a bot run before the daily figures are locked.
3. **Attachment list and the jet bridge.** The panel section, buy, remove, upkeep. The tray toggle goes away. Boarding keeps using `standPaxMode`. A legacy bridge from ticket 1 still counts.
4. **Hydrant pits, with fuel ticket 6.** Research no longer flips the field. Legacy pits from the migration keep old saves whole. A new pit is dry until the line and a dispenser exist. Bot run: Careful, Greedy, and Chaotic, because fuel timing moves.
5. **Power, lights, de-ice outlet, flag.** Four rows, four sockets. The night dwell and the weather dwell ship in this ticket, both named on the card, both absent when the fitting is present.
6. **Fire bell, and one extra host.** The scramble clock, the ×0.8, the roof socket. A hangar or the fuel farm takes one fitting so the host list is not a stand-only switch. No new staff roster.
7. **Pier bulk buy, only if a playtest asks.** One confirm, one bill, stands on the pier the player clicked. Skip it if twelve stands is still a comfortable amount of clicking.

Tickets 1 through 3 are the stand card. Ticket 4 waits on the fuel line, and can merge before the pipeline if dry pits and the legacy migration are in. Tickets 5 and 6 are the rest of the catalog. Ticket 7 is the Manor Lords complaint, and it is optional.

Wear and repair are not a ticket until the upkeep in §4 has been played and is not enough.
