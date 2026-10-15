# Hatchfield: Vision Expansion (Relations, Exclusive Assets, Roads & Traffic, Retail, Mid/Endgame, UI)
Status: design proposal, Oct 14 2026. It builds on AIRLINE_DIPLOMACY_V2 (approved), LATE_GAME_PLAN, ECONOMY_TECHTREE, FLOW_SYSTEM, UI_SPEC and RESEARCH_COMPETITORS. Where those docs and this one disagree, the approved doc wins until Trever decides.
Tags: **[S]** comes from a cited source (§9). **[H]** is a Hatchfield original. All numbers are balance suggestions only.
Fixed rules this doc respects:
- Desktop only, with no forced tutorial.
- Hints never go in the phone UI. Whether alerts go in the phone is still UNDECIDED and needs a playtest.
- Vehicles are built with Manor Lords-level interaction.
- Passengers are RCT-style, with visible thoughts and their own free will.

---
## 1. Why these games work (research digest)
| Game | Why it works [S] | What reviewers complain about [S] | Take for Hatchfield |
|---|---|---|---|
| **RollerCoaster Tycoon 1/2** | Sawyer built it bottom-up as a construction set first, with the sim grown around it. Guests are "uncontrollable" and "make their own minds up based on what they see and feel". He made it "relatively easy to succeed" if you understand guests. Scenarios give the structure; in his view RCT2's extra freedom reduced that structure (tt-ms.de interviews). Goals take the form "X guests by end of October, rating ≥600" (rct.wiki). | Guests get lost in odd-shaped parks; Sawyer called that realistic. | Passengers with free will and readable thoughts. Scenario-style goals ("12k pax/day, rating ≥ 700 by Year 3"). Make it forgiving to succeed and hard to master. |
| **RCT3** | Moved to 3D, added a first-person "coaster cam", and gave you a peep's-eye view. | Camera and UI clutter (general consensus, unverified). | A "ride along" camera on a passenger or a vehicle. |
| **Airport CEO** | Deep management with self-drawn terminals. Franchises only offer contracts once your reputation is high enough; they pay rent per m², a sales commission and a daily sales bonus, and they cancel if you miss the daily target within 5 days (wiki.gg, Dev Blog 151). Airline and franchise contracts are star-rated; 1–2★ airports only get 1–2★ contracts (Dev Blog 151). | Opaque errors, stuck agents, and lag at 8–10k pax (RESEARCH_COMPETITORS). | Gate tenants and airlines on rating, the same way ACEO does. Always show the exact reason something is blocked. |
| **Airport Tycoon 1–3** | Approachable: you build shops and an airport freely. | The 3D view was disconnected from the sim. The required tower couldn't be found in the menus. Once set up, you "watch the money roll in" (IGN, MobyGames). | Everything you see is the simulation and can be clicked. Late-game pressure has to keep growing. |
| **Cities: Skylines 1** | The road tool's Upgrade mode changes a road's type in place, even downgrades, and right-click reverses a one-way. Prebuilt interchanges can be edited piece by piece. Traffic route and junction infoviews (Skylines wiki). Lane maths: the lanes going in at a junction should equal the lanes coming out (TM:PE docs). | Routes are chosen at the start of a trip, so cars don't reroute around jams (wiki). | An upgrade brush, prebuilt interchanges you can edit, and a live route overlay. |
| **Cities: Skylines 2** | 20 XP milestones plus Development Points to spend in a tree for each service. The XP comes from building and from happiness, not only population (Paradox dev diary, PC Gamer). Parking nodes stop on-street parking from blocking traffic (GamesRadar). | Unlocks run dry by 20k population. Poor performance. Turn bans ignored, bus stops that eat a whole node, traffic "out of nowhere" (PC Gamer, Steam). Parking garages on main roads lock the street at peak (Steam). | A milestone track plus a choice of tree. Content has to keep going past the midpoint. Parking entrances must sit on feeder roads. |
| **Civ VI diplomacy** | Each leader has a Historical Agenda plus a Hidden Agenda that you reveal through Diplomatic Visibility (Civilopedia). Grievances come from hostile acts and ignored requests, and they decay. City-states give envoys; you become Suzerain with ≥3 envoys and more than anyone else, which brings a unique bonus and +1 Favor. Diplomatic Favor buys World Congress votes (Civ6 Gathering Storm manual, Fandom). | Diplomacy feels opaque and the AI's moods seem random (V2 §1 sources). | Airline "agendas" with a hidden one revealed through history. Grievances. "Suzerain" status at small carriers. A yearly Aviation Council vote. |

**The pattern across all of them:** (1) a toy you love to fiddle with, (2) agents with visible wants, (3) structured goals inside sandbox freedom, (4) unlocks paced to keep pace with complexity, (5) feedback that tells you *why*. The failures are the opposite: mid-game content running out, opaque errors, and a "money rolls in" plateau.

---
## 2. Airline Relations ("Civ for airlines")
This extends AIRLINE_DIPLOMACY_V2; it does not replace it. V2's standing math, money-costed proposals and the Counter option all stay.
### 2.1 Tiers and gates [H]
| Tier | Example role | Reputation | Experience (flights handled) | General Trust | Facilities | History |
|---|---|---|---|---|---|---|
| 0 GA / charter | Bush charters, flight school | none | 0 | any | 1 stand, short runway | none |
| 1 Cargo feeder | Overnight parcels | 15 | 50 | 20 | Cargo apron, fuel | no fuel outages in 7 days |
| 2 Regional | Turboprop commuter | 25 | 200 | 30 | Check-in, security, 2 gates | on-time rate ≥ 75% |
| 3 Budget (LCC) | Quick-turn A320s | 40 | 800 | 40 | Turn time ≤ 35 min, low fees | 1 LCC "trial season" |
| 4 Flag carrier | National airline | 60 | 3k | 55 | Jet bridges, lounge, international area | Friendly with one regional |
| 5 Wide-body major | Long-haul alliance | 75 | 10k | 70 | Runway ≥ 3,000 m, wide stands, transfer flow | 2 Friendly airlines; no ban in 2 years |

At the start, **General Airline Trust** sits around 10. It's an industry-wide number that rises when you handle flights reliably and falls on incidents, broken contracts and cancellations. It is the reason no real airline turns up on day 1. The opening plays out as charters and cargo, then a first regional airline makes a "test route" offer. The gates panel shows each tier's requirements as a checklist with live values (the ACEO lesson: always show why).
### 2.2 Per-airline personality (agendas) [S→H]
- Every airline has a **public agenda** (for example, a budget airline "Hates high fees", a flag carrier "Wants premium lounges") and a **hidden agenda**, such as "rewards on-time streaks" or "dislikes sharing gates with rival X".
- The hidden agenda is revealed by **Insight** (Civ's Diplomatic Visibility). Insight levels come from 30 days of service, an airline liaison office, and a signed contract.
### 2.3 Actions
- **Favors** (they ask): extra slots at peak times, waived fees during a strike, a priority de-icing slot. Granting one banks a *favor token*. Ignoring one creates a **grievance**, as in Civ.
- **Favors** (you ask): add a route, base an aircraft, sponsor a gate. These cost tokens or money.
- **Contracts:** slot contracts, fee incentive deals, and base or hub status. All of them carry KPIs (on-time, bag delivery, turn time).
- **Grievances:** caused by missed KPIs, lost bags, broken promises, and favoring a rival. They decay over about 60 days. The airline card shows each one with its source and timer.
- **Rivalries:** pairs such as an LCC vs a flag carrier, or two majors in competing alliances. Courting one costs standing with the other unless you have separate piers.
- **Exclusive deals:** a hub agreement with one airline (+demand, +exclusive assets) locks out its rival for N years. This is the big strategic choice.
- **Patron status ("Suzerain"):** be the top partner of a small carrier (most of its flights, at least 3 contracts) to gain its unique perk. Examples: a cargo airline brings free night freight demand; a regional airline feeds transfers.
- **Aviation Council (endgame, the World Congress):** a yearly vote on regional rules such as a noise curfew, a carbon levy, an open-skies treaty, or a slot reform. You win votes with **Influence**, which comes from patron status and Friendly airlines. Influence is not a currency for proposals, which respects the V2 "no Clout currency" decision. It is only used for Council votes and can't be spent elsewhere. **Flag:** Trever needs to confirm this.
### 2.4 UI
- An **Airline Relations screen**: a grid of airline cards with logo, tier, standing bar, agenda icons, grievance chips, the active asks and Insight level. Clicking a card opens a Civ-style leader panel with a "relationship ledger" that lists every + and − modifier and its source.

---
## 3. Exclusive assets through relations [H, inspired by Civ's suzerain bonuses and ACEO's star-gated contracts]
| Unlock | How you earn it | What it gives |
|---|---|---|
| **Branded lounge** (per airline) | Friendly + 1 year contract | +premium spend and +standing; a unique interior kit |
| **Branded gate / jet bridge livery** | Hub or base deal | Faster boarding for that airline; a cosmetic wrap |
| **Livery decals and "special livery" aircraft visits** | 100-day on-time streak | A rare plane visits (a retro livery or an A380 promo); a spike in spotter demand |
| **Decor packs** (airline heritage museum, model planes, a hanging vintage aircraft) | Patron status | Terminal appeal +, photo spots |
| **Landmark buildings** (observation tower, alliance hub concourse, maintenance megahangar) | Wide-body major Helpful, or a Council win | Big appeal and capacity; they end up on the airport icon |
| **Ground vehicle liveries** (tugs, buses in airline colours) | A ground-handling contract | Cosmetic, plus a small speed buff for that airline's turns |

The rules:
- Exclusives are **lost or greyed** if the relationship collapses (stakes!).
- Each exclusive has a "how to earn" tooltip, so there's always a visible next goal.
- Assets come from the existing texture and livery pipeline (TEXTURE_MASTER_LIST, liveries batch).

---
## 4. Cars, roads and traffic
### 4.1 Road kit
- **Road sizes:** service lane (1+1), 2-lane local, 4-lane avenue, 6-lane boulevard with median, one-way ramps, and a 4-lane highway spur to the map edge.
- **Road Upgrade tool** (CS1 Upgrade mode [S]): brush over existing road to change its type in place, keeping the connections. Right-click reverses a one-way. Downgrades refund 50%. A ghost preview shows the cost and the lane change.
- **Prebuilt interchanges** (diamond, trumpet, roundabout, terminal loop) that you can edit piece by piece after placing them [S].
- **Lane-maths assist** [S/TM:PE]: when lanes in ≠ lanes out at a junction, show an amber marker with "add a lane / make a dedicated turn lane".
### 4.2 Terminal kerb and parking
- **Kerbs:** departures and arrivals kerbs as separate road levels (the elevated departures roadway is an upgrade). Kerb dwell time is simulated; cars that double-park block a lane.
- **Parking:** surface lots → multi-storey → short-stay and long-stay with a shuttle bus. Entrances must sit on feeder roads, because entrances on a main road jam at peak [S: CS2 Steam].
- **Taxis:** a taxi rank with a holding lot and a queue.
- **Rideshare:** a pickup zone.
- **Buses:** city bus stops, plus a later rail/metro station upgrade that takes cars off the road.
- **Rental car centre**, which is also revenue.
### 4.3 Traffic → passenger timing (the important link)
- Each passenger spawns with a mode (car, taxi, bus, rail) and a planned arrival time before departure.
- Congestion on their route adds travel time. If the delay pushes them past check-in cutoff, they become "running late": RCT-style thought bubbles ("Traffic was awful!"), lower spend, a sprint through security, and missed flights → airline grievance (on-time KPI).
- Like CS1, a route is fixed at spawn [S], but Hatchfield re-plans at checkpoints [H] to avoid the "doesn't reroute" complaint.
- **Overlays:** a road flow heatmap, a "routes through this segment" view (CS1 [S]), and a kerb dwell chart.
- **Performance:** cars far from the camera become aggregated flow; only the kerb, the lots and the visible area have individual vehicles (Airport CEO lag lesson).

---
## 5. Terminal retail, decoration and light theme-park assets
- **Retail as tenants** (ACEO franchise model [S]): zone a unit, pick from tenant offers that are star-rated by your rating, and meet the spec (m², shelves, tills, airside vs landside). The tenant pays rent, a commission and a daily-target bonus, and leaves if the target is missed 5 days running.
- **Categories:** café, fast food, sit-down restaurant, bar, duty free (international airside only), news & books, fashion, electronics, pharmacy, souvenirs, FX/bank, spa, kids' play area.
- **Dwell-time loop:** fast security plus a well-placed gate → more free minutes → more spend. A "walk-through duty free" layout gives a bonus.
- **Decoration:** plants, art, water features, lighting, flooring sets, seating styles. They give an RCT-style **appeal** radius that raises mood and spend.
- **Light theme-park set** (deliberately small, about 8 pieces): a carousel in the kids' zone, an indoor garden with a waterfall, a slide between levels (the Changi homage), an aviation simulator ride, a small observation deck, a rooftop mini-golf, a seasonal display slot and a vintage plane on a plinth. Each comes with capacity and maintenance costs. The rule is "amenity, not park".

---
## 6. Mid-game and endgame loops
### 6.1 Loops by phase
| Phase | Core loop | Goal examples | Pressure |
|---|---|---|---|
| Early (0–2 h) | Charters/cargo → build trust → first regional | "Handle 50 flights", "Trust 30" | cash, a single runway |
| Mid (2–8 h) | Courting LCC vs flag, retail income, roads and parking, second runway | Milestones 5–12, "Sign a budget carrier", "Avg kerb dwell < 3 min" | rivalries, peak waves, traffic jams |
| Late (8–20 h) | Hub deal, wide-bodies, transfer flow, landmarks, Council | "Become an alliance hub", "30k pax/day at rating ≥ 750" | slot scarcity, noise curfew votes, strikes, weather, airline bankruptcies |
| Endgame / sandbox | Prestige: World Airport Awards, records, monuments | "Skytrax-like 5★", "Win 3 Council votes", "Zero missed connections for a week" | an escalating random-crisis director, ageing infrastructure (refurbishment cycles) |

### 6.2 Structure
- **Milestones plus a tree** (CS2 [S]): XP comes from flights, happiness and relations, and each milestone grants points for a branch (Airside, Terminal, Landside, Commercial, Relations).
- Unlocks must run all the way to the final milestone; this fixes CS2's "ran out at 20k".
- **Scenario/charter mode** (RCT [S]): handcrafted maps with targets and deadlines, such as "Island strip", "Rescue a failing hub" or "Olympics week".
- **Late challenges:** an airline bankruptcy leaves empty gates, an alliance switch flips a rival, a runway refurbishment forces single-runway ops, an Aviation Council carbon levy, a mega-event surge, ageing jet bridges.

---
## 7. UI lessons and visual study
### 7.1 Patterns seen in the screenshots (/workspace/ui-study)
- **Airport CEO** (aceo/1–4): a top-down blueprint read. Zones are colour-coded (secure/insecure), and there's a night mode with lighting. The UI is minimal and the map is king. Lesson: a plan-view "blueprint" toggle for terminal building.
- **Cities: Skylines 2** (cs2/1–4):
  - The **bottom toolbar** shows a milestone badge (left), money, population and date.
  - The **road tool** sits in a floating panel with Tool Mode, Elevation and Parallel Mode rows plus thumbnails, and shows dimension labels and a snapping guide line on the curve.
  - **Infoviews** wash the city in white with a coloured data layer and a left-side legend/stat panel.
  - Lesson: a data-overlay mode that greys the world, and contextual road-tool option rows.
- **Cities: Skylines 1** (cs1/4): a route-view overlay with coloured transit lines over a desaturated city.
- **RCT2** (rct2/1–4): a thin top toolbar of icons, and a bottom status bar with money, guest count, rating, date and weather, plus a scrolling news ticker in the middle. Lesson: a one-line status strip, and the ticker as an alternative to phone alerts (an option for the alerts playtest).
- **RCT3** (rct3/1–4): a camera at peep level and dense themed scenery. Lesson: a ride-along camera and themed decor sets.
- **Civ VI** (civ6/1):
  - The **leader screen** puts a big portrait on the right and the left column lists Gossip, Access Level, Government, "Our Relationship: Friendly, No Grievances" and Agendas (with "1 Hidden agenda").
  - Action buttons sit at the bottom: Declare Friendship, Embassy, Denounce, Make Deal, Make Demand.
  - City screens use a left info panel plus lens icons on the map.
  - Lesson: this is the exact template for the airline leader panel, with a ledger column on the left and the airline mascot or CEO portrait plus livery on the right.
- **Airport Tycoon:** no official Steam store screenshots (the series isn't on Steam). Its lesson comes from reviews: the 3D view was disconnected from the data, and the menus hid required buildings.
### 7.2 Hatchfield UI rules
1. Desktop layout:
   - Top-left: milestone and XP.
   - Top bar: cash, rating, trust and date/speed.
   - Bottom: build categories.
   - Right: a context inspector.
   - Left edge: the phone (peeks out, flashes a preview, slides open).
2. **Hints** stay in their own corner card, never in the phone. **Alerts** are UNDECIDED. A/B test (a) phone message cards, (b) an RCT-style ticker, (c) a toast stack. Measure reaction time and annoyance.
3. Overlays follow the CS2 pattern: a desaturated world plus one data layer (flow, appeal, noise, traffic, relations by gate).
4. Every block or failure shows an exact clickable reason (the ACEO lesson).
5. Vehicles: Manor Lords-style direct manipulation. Drag to assign a route, click a depot to see its fleet, and preview the job chain in 3D.
6. Passengers: RCT thoughts, with a summarized "all passengers" view of the top 5 thoughts [S rct guest window].
7. No forced tutorial. Optional goals act as guidance, and hints can be dismissed.
### 7.3 Screenshot reference list
The files are in /workspace/ui-study/<game>/N.jpg (contact sheets are sheet.jpg). The source URLs are in /workspace/ui-study/sources.txt. All are official Steam store screenshots:
- Airport CEO: app 673610
- Cities: Skylines: app 255710
- Cities: Skylines II: app 949230
- RCT2 Triple Thrill Pack: app 285330
- RCT3 Complete Edition: app 1368820
- Civilization VI: app 289070

---
## 8. Phased build plan (GitHub issue sizing: S ≤ 1 day, M 2–3 days, L 1 week)
**Phase A: Foundations (relations v1 + gates)**
1. M: General Airline Trust stat plus Experience counter, shown in the HUD.
2. M: Tier gate data table and checklist panel (§2.1).
3. L: Airline cards and leader panel with relationship ledger (V2 math).
4. M: Agendas (public and hidden) plus Insight levels.
5. M: Grievances with decay and source chips.

**Phase B: Roads and traffic**
6. L: Road network data model (segments, nodes, lanes) and the 4 road sizes.
7. M: Road Upgrade brush, including the one-way reverse.
8. M: Prebuilt interchanges you can edit piece by piece.
9. L: Kerb sim, parking lots and garages, taxi rank, bus stop.
10. M: Traffic delay → passenger arrival time → late thoughts and missed flights.
11. M: Traffic overlays plus lane-maths warnings.
12. M: Aggregated far-traffic LOD (performance).

**Phase C: Commercial**
13. M: Tenant offers, star-rated by rating, with the ACEO-style contract (rent, commission, target).
14. M: Retail category set plus the dwell-time spend model.
15. S: Appeal radius for decoration.
16. M: Light theme-park set of 8 assets.

**Phase D: Deep relations and exclusives**
17. M: Favors and favor tokens.
18. M: Rivalries plus exclusive hub deals.
19. M: Patron ("Suzerain") perks.
20. L: Exclusive asset unlock framework, plus the first lounge, gate wrap and landmark.

**Phase E: Mid/endgame**
21. M: Milestones plus a development tree with 5 branches.
22. L: Aviation Council yearly vote (Influence).
23. M: Crisis director (bankruptcy, strike, refurbishment, mega-event).
24. L: Scenario mode with 3 handcrafted maps.
25. S: Prestige awards and records screen.

**Phase F: UI**
26. M: HUD layout pass (§7.2).
27. M: Alerts A/B playtest harness (phone vs ticker vs toast).
28. S: Summarized passenger thoughts panel.
29. S: Blueprint plan-view toggle.

Order: A → B and C in parallel → D → E, with F running alongside. Phase A plus B10 is the minimum needed to feel the new early game.

---
## 9. Sources
- Chris Sawyer interviews: https://www.tt-ms.de/presse/arcadettack_2018-08-10.pdf ; https://www.tt-ms.de/presse/medium_2024-03-27.pdf ; https://www.eurogamer.net/a-big-interview-with-chris-sawyer-the-creator-of-rollercoaster-tycoon
- RCT objectives: https://rct.wiki/wiki/The_Complete_Objectives_List ; guest thoughts: https://rct.fandom.com/wiki/Guest_Thoughts
- Airport CEO: https://airportceo.wiki.gg/wiki/Franchises ; https://airportceo.wiki.gg/wiki/Shopping ; https://www.airportceo.com/post/dev-blog-151-businesses-and-contracts ; https://www.airportceo.com/post/dev-blog-67-a-deeper-look-into-airlines-and-franchises ; https://store.steampowered.com/app/673610/Airport_CEO/
- Airport Tycoon: https://www.ign.com/articles/2000/06/03/airport-tycoon ; https://www.mobygames.com/game/4435/airport-tycoon/reviews/windows/ ; https://en.wikipedia.org/wiki/Airport_Tycoon_3
- Cities: Skylines: https://skylines.paradoxwikis.com/Roads ; https://skylines.paradoxwikis.com/Traffic ; https://doc.tmpe.me/lane-arithmetic.html
- Cities: Skylines II: https://www.paradoxinteractive.com/games/cities-skylines-ii/features/game-progression ; https://www.pcgamer.com/cities-skylines-2-review/ ; https://www.gamesradar.com/cities-skylines-2-development-nodes/ ; https://steamcommunity.com/app/949230/discussions/0/4031346899449226999/ ; https://steamcommunity.com/app/949230/discussions/0/694248493352676032/
- Civ VI: https://www.civilopedia.net/en-US/gathering-storm/concepts/diplo_13/ ; https://www.civilopedia.net/en-US/rise-and-fall/concepts/diplo_4/ ; https://cdn.2kgames.com/manuals/civilization-vi/gathering_storm/2KGMKT_CIV6_Gathering_Storm_PC_Online_Manual_V7_US.pdf ; https://civilization.fandom.com/wiki/Suzerain_(Civ6) ; https://civilization.fandom.com/wiki/Diplomatic_Favor_(Civ6)
- Earlier Hatchfield research with more sources: RESEARCH_COMPETITORS.md, AIRLINE_DIPLOMACY_V2.md §17.
- Video: YouTube blocked downloads from the box (bot check), so the official Steam trailers (first 5 min) are in /workspace/ui-study/videos/ instead: aceo_256797622.mp4, cs1_256785384.mp4, cs2_257297826.mp4, rct3_256802318.mp4, civ6_256672694.mp4. They aren't analysed in this doc yet.
