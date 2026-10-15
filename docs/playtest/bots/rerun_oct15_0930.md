# Bot rerun — 15 Oct 2026, 09:30 window

Headless personas on `1fc1927`. That tip includes the strip headway (`d31f542`, `RUNWAY_TURN_SEC` 48), fuel Phase 1 (`c4c890f`: the starter has no term, a phone card orders one 36,000 L tanker, 60 sim-seconds to answer, 20 sim-seconds of cooldown, 90 game-minutes on the road), and the Oct 15 hub work (lounge, gate, and hangar leases, dedicated turnaround trucks, hub tenure, desk clearance on a passenger contract). No gameplay numbers were changed for this note.

The 90-day Careful / Greedy / Chaotic table is the **tip policy**: sign Apex Local, do not build a second strip, hire no researchers. That is the same decisions as `rerun_oct15_0630`, on this sim. Seeds are Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`. Standard difficulty, passenger focus, sandbox off. One day is 180 sim seconds. The driver ticks at 0.25s and 5×, and looks at the board every 12 sim seconds.

`docs/playtest/research_pace.md` is that same 90-day run. `docs/playtest/bots/tip90.json` and `spot90.json` hold the rows. The live policy (second strip, two extra stands, one researcher) is the day-150 careful run and the standard-length `report.json` (Careful 45, Greedy 60, Chaotic 30, plus the browser smoke). The browser opening reached the first landing.

Counting:

- **Flight diverts** are news lines that say a flight diverted.
- **Connection diverts** are connecting passengers tagged divert.
- **Go-arounds** are ledger lines labelled go-around.
- **Missed-connection $** is the `missed_connection` ledger (a negative expense).
- **Fuel groundings** are departures whose fuel hold flipped on. Each flight is counted once.
- **Curb day** is the first sim day the curb pressure was seen above 1, including mid-day.
- **Preferred / Trusted** are the first day-open samples with a carrier at that relationship tier. A later sample can fall back.
- **Hub tier** is the highest checklist `current` among signed carriers. Station is the floor once anyone is signed.

## 90-day tip policy

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Flights (per day) | 309 (3.4) | 279 (3.1) | 277 (3.1) |
| Day-60 flights | 207 | 186 | 190 |
| Flight diverts | 9 | 5 | 23 |
| Connection diverts | 4 | 2 | 21 |
| Go-arounds | 25 | 16 | 53 |
| Missed-connection $ | -$3,720 | -$3,720 | -$37,200 |
| Walk / bag / MCT misses | 0 | 0 | 2 |
| Curb crossed 1 | day 21 | day 21 | day 21 |
| Curb peak | 1.8 | 5.6 | 5.8 |
| Fuel groundings | 0 | 0 | 0 |
| Tree complete | day 86 | day 75 | day 51 |
| Cash day 30 / 60 / 90 | $309,237 / $799,578 / $1,224,939 | $197,550 / $137,720 / $618,643 | $137,269 / $566,193 / $386,814 |
| Preferred | day 16 | day 17 | day 14 |
| Trusted | — | — | — |
| Hub checklist | Station (day 1) | Station (day 1) | Station (day 2) |
| Stands / runways | 4 / 1 | 6 / 1 | 21 / 1 |
| Researchers | 0 | 0 | 0 |
| Field level / stars | FL7 / 0 | FL7 / 0 | FL7 / 0 |
| Fuel purchase / day | $642 (term) | $665 (term) | $758 (term) |
| Signed at day 90 | 1 carrier | 1 carrier | 1 carrier |

No softlocks and no console errors. Each persona ends the 90 days with a single signed carrier (Careful and Greedy on the regional starter, Chaotic on Zoomjet). Preferred is the first day-open sample only. On the shorter live runs that sample does not stick: Careful is Preferred on days 16 and 21–24 and is Published hostile at day 45; Greedy is Preferred on days 14 and 16–26 and is Published hostile at day 60. Trusted does not appear on these unpatched personas, including careful day 150. They never add the desks a second carrier needs. A separate probe that forces 8 check-in desks and 2 kiosks, and stays on the tip policy, still reaches Trusted by day 60. The same probe with the live policy (second strip, one researcher) was at a best score of 39.7 on day 60, short of the Trusted line at 45, with Harbor Heli and Island Heli at Preferred and three other carriers hostile.

## Against `rerun_oct15_0630` and the pre-`3360f09` careful run

`0630` was `9065876` after the curb-demand lever, still on the 150-second runway spacing. Careful ran 45 days, Greedy 60, Chaotic 30. Missed-connection cash was $0 and connection diverts were 0. The pre-spacing careful number named for this rerun is **60 days, 308 flights, 35 diverts**.

| | 0630 | This tip run | Pre-`3360f09` careful |
| --- | --- | --- | --- |
| Careful flights | 146 in 45 days (3.2/day) | 309 in 90 days (3.4/day). Day 30 is 106. Day 60 is 207. | 308 in 60 days (5.1/day) |
| Careful diverts | 0 | 9 flight diverts across 90 days | 35 in 60 days |
| Careful missed-connection $ | $0 | -$3,720, with 0 walk / bag / MCT misses | not in that citation |
| Careful curb | crossed 1 on day 26, then the bay brought it down | crossed 1 on day 21, peak 1.8 | |
| Careful cash | day 30 $112,395, day 45 $158,421 | day 30 $309,237, day 60 $799,578, day 90 $1,224,939 | |
| Careful Preferred | day 18 | first sample day 16 (Trusted never) | |
| Greedy flights | 225 in 60 days | day 60 is 186; 279 in 90 days | |
| Greedy cash | day 30 $8,368, day 60 $20,441 | day 30 $197,550, day 60 $137,720, day 90 $618,643 | |
| Greedy diverts / missed $ | 0 / $0 | 5 flight diverts / -$3,720 | |
| Chaotic | 104 flights in 30 days, cash $209,834, 0 diverts | day 30 is 98 flights and $137,269; day 90 is 277 flights and $386,814; 23 flight diverts | |

Careful’s day-60 count (207) is above a 3.2/day pace and 101 flights short of the pre-spacing 308. It is also short of the 275 recorded on `4b02521` with the same tip policy, so the latest hub and contract commits moved the bank again. Diverts are back, and they are fewer than that 60-day 35. The 0630 claim that missed-connection cash stayed at $0 does not hold, and the bill is small next to the rest of the penalty ledger (below).

Fuel did not ground anyone who signed the term.

Research pace barely moved. `research_pace.md` from `5120ac5` had Careful complete on day 85 (277 unspent), Greedy on day 74, Chaotic on day 53, all with 0 researchers. This run is day 86 (269 unspent), day 75, and day 51. The wallet cap is still what stops the pile. More cash did not hire a researcher and did not finish the tree sooner.

## Spot-only probe

Same careful decisions and the same seed, with `signFuelTerm` left out. Ninety days each.

| | Term (the careful row above) | (a) Accept every spot card | (b) Ignore every spot card |
| --- | ---: | ---: | ---: |
| Flights | 309 | 312 | 1 |
| Fuel groundings | 0 | 0 | 384 |
| First grounding day | — | — | 0 |
| Fuel $ / day | $642 term | $1,128 spot | $0 |
| Fuel $ total | $57,772 | $101,556 | $0 |
| Cash day 90 | $1,224,939 | $1,344,035 | $99,656 |
| Tree complete | day 86 | day 86 | day 85 |
| Copy on screen before the first hold | term-signed news | spot cards, then tankers | `Spot card for LIF103` |

**(a) The 90 game-minute lead covered this bank.** Zero fuel holds in 90 days. Spot fuel cost $486/day more than the term ($101,556 versus $57,772). Flights stayed in the same band (312 versus 309). Flag (a), “accept-all still grounds flights,” stays down.

**(b) The first hold is on day 0, and the spot card is already up.** 384 flights were held and one turn completed. The messages body says the named flight stays grounded if the offer is ignored (`src/phone/feed.ts`). Flag (b), “grounds before day 2 with no readable warning,” stays down. Cash ended at $99,656, with a penalty total of -$938,200. The tree still completed on day 85, with no researcher and one completed turn, because the operations trickle kept paying.

## Expanded careful, day 150

Live policy only: once cash is above three times the stamp, and the airfield says Over the runway or curb or stand pressure is above 1, Careful builds strip 2 and up to six stands (the old cap of four, plus two). One researcher is hired once a lab room exists. `CAREFUL_150=1 npx vitest run src/playtest/careful150.test.ts`.

The previous careful-150 on the checklist (`docs/MIDLATE_CHECKLIST.md`, sim parent of `20e829d`) was 756 flights, $984,063, 4 stands, 1 runway, the whole tree by day 90, FL10 on day 138, 0 prestige stars.

| | Checklist careful-150 | This live careful-150 |
| --- | ---: | ---: |
| Flights | 756 | 469 (3.1/day) |
| Cash | $984,063 | $1,890,289 |
| Cash day 30 / 60 / 90 | | $371,976 / $845,425 / $1,250,185 |
| Stands / runways | 4 / 1 | 6 / 2 (both in by day 45; day 30 is still 4 / 1) |
| Researchers | 0 | 1 (hired on the day-1 sample) |
| Tree complete | day 90 | day 69 |
| Field level | FL10 on day 138 | FL8 on day 117, still FL8 at day 150 |
| Prestige stars | 0 | 0 |
| Hub checklist | | Station |
| Fuel groundings | | 0 |
| Flight diverts / go-arounds | | 176 / 147 |
| Missed-connection $ | | -$96,720 (18 walk / bag / MCT misses, plus 89 connection diverts) |
| Curb | | crossed day 21, peak 2.8 |
| Preferred / Trusted | | day 16 / — |

The four-stand, one-runway building plateau moved. The flight plateau did not. Day 90 on this expanded run is 290 flights, against 309 on the same sim with the tip policy (one strip, no researcher). Day 150 is 469 flights, under the checklist’s 756 and under the 826 recorded on `4b02521` with the same live policy. Field level stops at 8. Prestige is still 0 stars. The hub checklist is still Station. One researcher, not the headway, is what pulled the tree from day 86 to day 69.

The standard-length live run (`report.json`, generated 2026-10-15T03:29:57Z) matches that shape at shorter range: Careful 157 flights in 45 days, 2 strips and 6 stands, cash $491,042, 13 flight diverts, missed-connection -$16,740, curb day 21, Preferred first on day 16. Greedy builds 2 strips and 8 stands, finishes day 60 at $34,240 with 192 flights, and completes the tree on day 51 because the researcher is hired. Tip Greedy, which does not build the strip, is at $618,643 on day 90.

## Proposals

No sim numbers were changed. These are proposals only.

1. **One carrier is the flight cap.** Every tip persona ends on a single airline. Careful’s day-60 count is 207, against 308 before the spacing change and 275 on `4b02521`. On the 45-day live run, 252 failed contract accepts are recorded. A handful say the desks clear 22 passengers a minute against an ask of 28. The rest surface a squeeze-memory news line while the signed list does not grow. Proposal: read that gate before touching headway or stand counts.
2. **Trusted is a desk choice, and the second strip can spend it.** Unpatched personas stay on one carrier and never sample Trusted. Forcing 8 desks and 2 kiosks, tip-policy Careful still reaches Trusted by day 60. The same desks with the second strip stop at 39.7 (Preferred) on day 60. Proposal: leave the score bands (Preferred at 20, Trusted at 45). The unpatched bank is short of desks. The strip’s divert load is the candidate for the slip from 45, and this run does not justify moving the line.
3. **Refunds are the bill.** Tip careful’s missed-connection cash is -$3,720 across 90 days. The 45-day live books put refunds at -$135,000, delays at -$15,686, other penalties at -$35,400, and missed connections at -$16,740 (penalty total -$202,826). Proposal: leave minimum connect time. Look at the refund line.
4. **Spot fuel.** Accept-every-card matches the term on flights and grounds nobody, at $486/day more. Ignore-every-card grounds the bank on day 0, the phone card already says so, and the airport ends at $99,656 rather than a cash pile. The tree still finishes on day 85 from the trickle. Proposal: keep the 90 game-minute lead and the existing card sentence. The trickle completing a frozen tree is the item to look at.
5. **The second strip did not lift day 150.** Six stands and two runways are in by day 45. Flights at day 150 are 469 and the field stops at FL8. Prestige stays at 0. Hub stays Station because these personas have no command for a lounge, a gate, a hangar, or a turnaround truck. Proposal: leave runway cost and the checklist numbers. Give the next playtest a way to accept a hub lease before anyone calls Station a stuck rung. One researcher moving the tree from day 86 to day 69 is enough evidence to leave node costs where they are.
