# Morning playtest — 15 Oct

No rules, prices, or relations weights were changed for this note.

The 90-day numbers are a headless rerun on `1c8c21c9131777ec90a7838dc2c2143526d0f76d` (`Show why connections miss, and let a late inbound catch its own turn.`), which also includes `207e6e3` (named service bays on airside buildings). Two commits landed on main while the first pass was being written. The screenshots are from a production build of the parent, `d6aa69e`, taken before those two commits. Treat the pictures as the opening of that build, and the tables as the later main.

Headless Careful, Greedy, and Chaotic each ran **90 sim days**. One day is 180 sim seconds. The driver uses the player command API at **5×**, tick dt **0.25s**, and looks at the board every **12 sim seconds**. Difficulty is standard, focus is passengers, sandbox is off. Persona decision seeds are Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`. The field’s own `Math.random` was left unseeded, so a rerun will not match these dollars. Nothing was still stuck, nothing NaN’d, and there were no console errors or softlocks.

The browser pass is a production build at **1×**. The timed session is the first **600 sim seconds** (10 minutes, about 3.3 game days) after the starter kit. Title, opening, research, Airlines Relations, and the fuel farm are from that session. The landing, apron, curb, and building card were aimed on a second production opening of the same build, because the first pass could not point the camera. Those beats did happen inside the 600 seconds. Livery close-ups are **posed** after that opening, one parked airframe per silhouette class, in a roster livery. They are not arrivals from the first 10 minutes.

## Headless, 90 days

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Wall | 103s | 110s | 87s |
| Cash start | $168,000 | $168,000 | $168,000 |
| Cash end | $562,139 | $7,348 | $4,864 |
| Cash low | $4,106 day 1 | $190 day 76 | −$8,051 day 76 |
| Field rating, day 90 | 69 | 58 | 27 |
| Satisfaction avg | 66 | 68 | 55 |
| Flights turned | 463 | 394 | 431 |
| First landing | 40s PDJ101 | 43.8s PDJ101 | 80s LIF101 |
| Stands / terminal rooms | 4 / 9 | 6 / 9 | 24 / 17 |
| Shops leased | 5 / 5 | 8 / 8 | 4 / 58 |
| Carriers signed | 10 | 28 | 11 |
| Tree nodes bought | 62 | 62 | 62 |
| Tree points left | 380 | 150 | 17,160 |
| Could-not acts | 1 | 275 | 101 |
| Recoveries (still stuck) | 10 (0) | 18 (0) | 13 (0) |

Cash and rating through the run. Day-1 cash is after the kit.

| Day | Careful cash | Careful rating | Greedy cash | Greedy rating | Chaotic cash | Chaotic rating |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | $4,106 | 77 | $48,464 | 80 | $50,497 | 64 |
| 3 | $29,903 | 87 | $10,239 | 88 | $2,761 | 73 |
| 7 | $29,159 | 73 | $7,368 | 72 | $7,805 | 87 |
| 14 | $45,338 | 77 | $6,782 | 79 | $18,452 | 82 |
| 30 | $164,133 | 84 | $7,276 | 68 | $30,464 | 76 |
| 60 | $389,386 | 76 | $35,780 | 58 | $192,111 | 52 |
| 90 | $562,139 | 69 | $7,348 | 58 | $4,864 | 27 |

Greedy borrowed $365,000 and paid $302,748 back plus $75,672 interest. Chaotic borrowed $275,000. Careful took a $25,000 loan and paid it off ($26,400 plus $7,040 interest).

### Relations

“Preferred+” and “Trusted+” are cumulative (tier 2 or better, tier 3 or better) at the start of that day.

| Day | Careful best | Pref+ | Trust+ | Greedy best | Pref+ | Trust+ | Chaotic best | Pref+ | Trust+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 4.9 | 0 | 0 | 2.9 | 0 | 0 | 0 | 0 | 0 |
| 30 | 28.0 | 1 | 0 | 32.2 | 1 | 0 | 4.5 | 0 | 0 |
| 60 | 64.0 | 4 | 2 | 70.6 | 4 | 2 | 30.9 | 2 | 0 |
| 90 | 79.2 | 5 | 4 | 97.2 | 9 | 3 | 82.3 | 5 | 2 |

**Careful** ends two Priority, two Trusted, one Preferred, five Published. No Flagship. The five Published carriers are helicopters with no turns.

| Carrier | Tier | Score | On time | Delayed | Kept | Fines |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Alpine Swift | 4 Priority | 79.2 | 0 | 22 | 88 | 21 |
| Puddle Jumper Airlines | 4 Priority | 73.8 | 2 | 33 | 90 | 27 |
| Zoomjet | 3 Trusted | 66.1 | 0 | 31 | 89 | 25 |
| SkyCheap | 3 Trusted | 53.8 | 1 | 29 | 86 | 20 |
| Cityhopper | 2 Preferred | 44.5 | 0 | 22 | 70 | 15 |
| Harbor Heli | 1 Published | 17.1 | 0 | 0 | — | — |
| Island Heli | 1 Published | 16.6 | 0 | 0 | — | — |
| Medevac One | 1 Published | 16.2 | 0 | 0 | — | — |
| Rotorlink | 1 Published | 15.5 | 0 | 0 | — | — |
| Skyline Rescue | 1 Published | 15.1 | 0 | 0 | — | — |

**Greedy** ends Flagship, two Priority, six Preferred, 19 Published. No Trusted. The Published list includes the same five helicopters at 11–13 points with no turns.

| Carrier | Tier | Score | On time | Delayed |
| --- | --- | ---: | ---: | ---: |
| Puddle Jumper Airlines | 5 Flagship | 97.2 | 2 | 12 |
| Zoomjet | 4 Priority | 76.1 | 0 | 15 |
| Alpine Swift | 4 Priority | 71.0 | 0 | 8 |
| SkyCheap | 2 Preferred | 38.0 | 0 | 9 |
| Cityhopper | 2 Preferred | 26.2 | 0 | 8 |
| Savanna Air | 2 Preferred | 24.3 | 0 | 4 |
| Kauri Air | 2 Preferred | 22.2 | 0 | 4 |
| Prestige Air | 2 Preferred | 21.2 | 1 | 2 |
| Tango Air | 2 Preferred | 20.9 | 1 | 4 |

**Chaotic** ends two Priority, three Preferred, six Published. No Trusted and no Flagship.

| Carrier | Tier | Score | On time | Delayed |
| --- | --- | ---: | ---: | ---: |
| Zoomjet | 4 Priority | 82.3 | 2 | 37 |
| Puddle Jumper Airlines | 4 Priority | 76.8 | 2 | 26 |
| Alpine Swift | 2 Preferred | 30.0 | 0 | 5 |
| SkyCheap | 2 Preferred | 28.8 | 0 | 3 |
| Cityhopper | 2 Preferred | 27.5 | 0 | 8 |

On-time turns are still rare. Careful’s Alpine Swift is 0 on time and 22 delayed at Priority. Greedy’s Puddle Jumper is 2 on time and 12 delayed at Flagship.

### Research

All three bought the whole 62-node Growth tree, plus the desk nodes that were affordable (Careful 21, Greedy 22, Chaotic 20). Wave 3 research points stayed at 0. Careful’s lab is one desk, one board, one machine, with 380 tree points left. Greedy has 150 left. Chaotic furnished 14 desks, 18 boards, and 16 machines and is holding **17,160** unspent tree points.

### Penalties

Ledger categories. Amounts are cash out. Field-ask fines posted at the full ask amount were **$0**.

| Category | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Missed connection | $99,280 | $120,900 | $24,180 |
| Penalties | $64,704 | $51,258 | $26,266 |
| Emergency refuse | $35,600 | $44,400 | $44,400 |
| Crash fine | $0 | $48,000 | $60,000 |
| Security shock | $14,400 | $35,000 | $14,300 |
| Task miss | $0 | $0 | $0 |
| Inbound fine | $0 | $0 | $0 |
| Cargo miss | $0 | $0 | $0 |
| **Penalty total** | **$213,984** | **$299,558** | **$169,146** |

Of the `penalties` category, the portion whose label is a delay or a go-around is $35,404 Careful, $28,307 Greedy, $13,331 Chaotic. Refund labels were $0.

Connections judged this run, and why a connection missed:

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Made | 383 | 358 | 170 |
| Diverted | 54 | 65 | 13 |
| Below minimum connect | 0 | 0 | 0 |
| Passenger late to the gate | 0 | 0 | 0 |
| Bag late | 0 | 0 | 0 |
| Inbound delay, minutes | 338,766 | 309,460 | 126,779 |

Every recorded miss is a divert. The connection clock on the inbounds that did make it is still measured in hundreds of thousands of minutes.

## Browser, first 10 minutes at 1×

Production preview of `d6aa69e`, sandbox off, passenger start, starter kit, opening contract accepted. Clock at the end of the timed session: **600.7s**. Cash **$68,106**. Field rating **76 Solid**. Flights turned: **7**. One carrier signed: Puddle Jumper Airlines, score **+0.36**, tier **1 Published**. Desk research points: **32**. Growth-tree points: **0**. No page errors.

In that timed session the first landing was PDJ101 (CRJ-700) at **20.7s**, cash $34,157, rating 72. A serviced turn was on the apron at **52.7s** (one aircraft in deboard, service, or board; two turnaround pieces; two trucks on a flight). The curb had **14** cars and taxis, all stopped or queued, by **40.7s**.

### Opening

![Title](morning_oct15/opening-title.png)

![Starter kit on the plot](morning_oct15/opening.png)

### First landing

The framed shot is a second opening of the same build: PDJ101, an ATR 72, on short final at 18.6s with the gear down. The timed session’s first landing was the same flight number on a CRJ-700 at 20.7s.

![First landing](morning_oct15/first-landing.png)

### Busy apron

Second opening, 43.6s: a turn on stand with a fuel tanker and a bag tug assigned. The timed session’s first serviced turn was at 52.7s. This frame is from before the named service-bay meshes.

![Apron with service vehicles](morning_oct15/apron-service.png)

### Curb

Second opening, 37.6s: cars and taxis queued on the terminal road. The timed session peaked at 14 vehicles by 40.7s.

![Curb with cars](morning_oct15/curb-cars.png)

### Research tree

Growth → Research tree, at the end of the 600 seconds. The tree shows 0 points. The airfield nodes are still locked. Desk points (32) do not appear as tree points.

![Research tree](morning_oct15/research-tree.png)

### Airlines Relations

Airlines → Letters → Relations, same session. One signed carrier. Puddle Jumper is Published at about +0.4.

![Airlines Relations](morning_oct15/airline-relations.png)

### Fuel farm

The fuel panel on the starter farm during the timed session. The delivery line was waiting on cash while the cash bar showed about $68,000 and the tank read empty.

![Fuel farm](morning_oct15/fuel-farm.png)

### Building info card

Medium stand, status Working. Throughput, bays, upkeep, and staff stay behind the row until opened.

![Building info card](morning_oct15/building-card.png)

### Livery close-ups

Posed parked airframes after the opening, not traffic from the first 10 minutes. One per silhouette class, in a roster livery.

![Turboprop, Savanna Air ATR 72](morning_oct15/livery-turboprop.png)

![Regional jet, Cityhopper CRJ-700](morning_oct15/livery-regional.png)

![Narrowbody, Zoomjet 737-800](morning_oct15/livery-narrowbody.png)

![Widebody, Crown 777-300ER](morning_oct15/livery-widebody.png)

![Jumbo, Ironclad Cargo 747-8F](morning_oct15/livery-jumbo.png)

![Superjumbo, Crown A380](morning_oct15/livery-superjumbo.png)

![Helicopter, Harbor Heli AW139](morning_oct15/livery-heli.png)

## Top 5 fun / feel

1. **A late airline still becomes the important one.** On-time turns stay in the single digits. Careful’s Alpine Swift is 0 on time and 22 delayed and ends Priority at 79. Greedy’s Puddle Jumper is 2 on time and 12 delayed and ends Flagship at 97. Kept days carry the tier. The ladder does not feel like a reward for running the ramp on time.

2. **The connection bill got a reason, and the reason is “the inbound diverted.”** On this main, missed-connection cash is $99k / $121k / $24k, and the new tally records 54, 65, and 13 diverts. Minimum-connect, late-passenger, and late-bag misses are all zero. The inbounds that do connect still carry 127k–339k minutes of delay. The opening hour we shot never surfaces that tally: the stand card says Working, and the relations card shows one Published carrier at +0.4.

3. **Careful gets rich. The other two end the quarter near zero, and Chaotic’s rating falls off.** Careful finishes at $562,139 with a 69. Greedy finishes at $7,348 with a 58 after a $365k loan. Chaotic finishes at $4,864 with a **27**, having stamped 24 stands and 58 shopfronts and leased 4 of them. The first day already drops Careful to $4,106. Placing more airport is still how you stop having a business.

4. **Research is empty at minute 10 and finished well before day 90.** The Growth tree in the opening shows 0 points and locked nodes, while 32 desk points sit on the other pool. All three personas then buy all 62 tree nodes. Chaotic is left holding 17,160 points on 14 desks, 18 boards, and 16 machines. There is no stretch where research is the thing you are still working on.

5. **What you see in the first hour is not what the day-90 book calls the problem.** The curb is a line of cars at one minute and still a line at ten, but the 90-day curb pressure never becomes the story. Five helicopter carriers sit on the relations list with zero flights and stay Published in the teens. The fuel panel in that first session shows a delivery waiting on cash next to a $68k balance and an empty tank. The field looks busy. The money says the misses are diverts, the rating is sliding, and the tree is already done.
