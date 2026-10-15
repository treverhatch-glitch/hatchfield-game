# Bot rerun — 15 Oct 2026, 09:30 window

Headless personas on `117db04`. That tip includes the strip headway (`d31f542`, `RUNWAY_TURN_SEC` 48), fuel Phase 1 (`c4c890f`: the starter has no term, a phone card orders one 36,000 L tanker, 60 sim-seconds to answer, 20 sim-seconds of cooldown, 90 game-minutes on the road), the fuel pipeline (`2020cf0`), helicopter carriers, and a refusal of a second signature for a carrier already on the books (`6c0ca81`). The Growth tree is 63 nodes. No gameplay numbers were changed for this note.

The 90-day Careful / Greedy / Chaotic table is the **tip policy**: sign Apex Local, do not build a second strip, hire no researchers. That is the same fuel and expansion decisions as `rerun_oct15_0630`, on this sim. Helicopter letters are answered the way the current personas answer them (stamp a pad, wait while it builds, or decline). Seeds are Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`. Standard difficulty, passenger focus, sandbox off. One day is 180 sim seconds. The driver ticks at 0.25s and 5×, and looks at the board every 12 sim seconds.

`docs/playtest/research_pace.md` is that same 90-day run. `docs/playtest/bots/tip90.json` and `spot90.json` hold the rows. The live policy (second strip, two extra stands, one researcher) is the day-150 careful run and the standard-length `report.json` (Careful 45, Greedy 60, Chaotic 30, plus the browser smoke). The browser opening reached the first landing.

Counting:

- **Flight diverts** are news lines that say a flight diverted.
- **Connection diverts** are connecting passengers tagged divert.
- **Go-arounds** are ledger lines labelled go-around.
- **Missed-connection $** is the `missed_connection` ledger (a negative expense).
- **Fuel groundings** are departures whose fuel hold flipped on. Each flight is counted once.
- **Curb day** is the first sim day the curb pressure was seen above 1, including mid-day.
- **Preferred / Trusted** are the first day-open samples with a carrier at that relationship tier.
- **Hub tier** is the highest checklist `current` among signed carriers. Station is the floor once anyone is signed.

## 90-day tip policy

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Flights (per day) | 298 (3.3) | 295 (3.3) | 224 (2.5) |
| Day-60 flights | 201 | 197 | 152 |
| Flight diverts | 1 | 1 | 1 |
| Connection diverts | 0 | 0 | 0 |
| Go-arounds | 0 | 0 | 0 |
| Missed-connection $ | $0 | $0 | $0 |
| Walk / bag / MCT misses | 0 | 0 | 0 |
| Curb crossed 1 | day 21 | day 23 | day 22 |
| Curb peak | 1.7 | 6.3 | 4.7 |
| Fuel groundings | 0 | 0 | 0 |
| Tree complete | day 88 | day 77 | day 55 |
| Cash day 30 / 60 / 90 | $321,816 / $760,967 / $1,164,144 | $176,626 / $22,962 / $432,192 | $6,729 / $7,327 / $39,905 |
| Preferred | day 14 | day 17 | day 34 |
| Trusted | day 35 | day 38 | day 46 |
| Hub checklist | Station (day 1) | Station (day 1) | Station (day 2) |
| Stands / runways | 4 / 1 | 6 / 1 | 17 / 1 |
| Researchers | 0 | 0 | 0 |
| Field level / stars | FL7 / 0 | FL7 / 0 | FL6 / 0 |
| Fuel purchase / day | $416 (term) | $420 (term) | $326 (term) |
| Signed at day 90 | 1 carrier | 1 carrier | 1 carrier |

No softlocks and no console errors. Each persona ends the 90 days with a single signed carrier (Careful and Greedy on the regional starter, Chaotic on Zoomjet). Careful and Greedy reach Preferred inside the 20–30 day band and Trusted in the following week. Chaotic reaches both later.

## Against `rerun_oct15_0630` and the pre-`3360f09` careful run

`0630` was `9065876` after the curb-demand lever, still on the 150-second runway spacing. Careful ran 45 days, Greedy 60, Chaotic 30. Missed-connection cash was $0 and connection diverts were 0. The pre-spacing careful number named for this rerun is **60 days, 308 flights, 35 diverts**.

| | 0630 | This tip run | Pre-`3360f09` careful |
| --- | --- | --- | --- |
| Careful flights | 146 in 45 days (3.2/day) | 298 in 90 days (3.3/day). Day 30 is 105. Day 60 is 201. | 308 in 60 days (5.1/day) |
| Careful diverts | 0 | 1 flight divert across 90 days | 35 in 60 days |
| Careful missed-connection $ | $0 | $0 | not in that citation |
| Careful curb | crossed 1 on day 26, then the bay brought it down | crossed 1 on day 21, peak 1.7 | |
| Careful cash | day 30 $112,395, day 45 $158,421 | day 30 $321,816, day 60 $760,967, day 90 $1,164,144 | |
| Careful Preferred | day 18 | day 14 (Trusted day 35) | |
| Greedy flights | 225 in 60 days | day 60 is 197; 295 in 90 days | |
| Greedy cash | day 30 $8,368, day 60 $20,441 | day 30 $176,626, day 60 $22,962, day 90 $432,192 | |
| Greedy diverts / missed $ | 0 / $0 | 1 flight divert / $0 | |
| Chaotic | 104 flights in 30 days, cash $209,834, 0 diverts | day 30 is 83 flights and $6,729; day 90 is 224 flights and $39,905; 1 flight divert | |

Careful’s day-60 count (201) sits on the 0630 pace of about 3.3 flights a day. It is 107 flights short of the pre-spacing 308, and short of the 275 recorded on `4b02521` with the same tip policy. Diverts did not come back: one flight divert in 90 days, against 35 in that 60-day pre-spacing run. Missed-connection cash is $0 again, which matches the 0630 note.

Fuel did not ground anyone who signed the term.

Research pace moved by a few days, on a tree that grew from 62 nodes to 63. `research_pace.md` from `5120ac5` had Careful complete on day 85 (277 unspent), Greedy on day 74, Chaotic on day 53, all with 0 researchers. This run is day 88 (110 unspent), day 77, and day 55. The labs are still empty. The wallet cap is still what stops Chaotic and Greedy (324 unspent).

## Spot-only probe

Same careful decisions and the same seed, with `signFuelTerm` left out. Ninety days each.

| | Term (the careful row above) | (a) Accept every spot card | (b) Ignore every spot card |
| --- | ---: | ---: | ---: |
| Flights | 298 | 294 | 1 |
| Fuel groundings | 0 | 0 | 297 |
| First grounding day | — | — | 0 |
| Fuel $ / day | $416 term | $432 spot | $0 |
| Fuel $ total | $37,440 | $38,880 | $0 |
| Cash day 90 | $1,164,144 | $1,180,381 | $1,253,746 |
| Tree complete | day 88 | day 88 | — (12 of 63) |
| Field level | FL7 | FL7 | FL1 |
| Copy on screen before the first hold | term-signed news | spot cards, then tankers | `Spot card for LIF103` |

**(a) The 90 game-minute lead covered this bank.** Zero fuel holds in 90 days. Spot fuel cost $16/day more than the term ($38,880 versus $37,440). Flights stayed in the same band (294 versus 298). Flag (a), “accept-all still grounds flights,” stays down.

**(b) The first hold is on day 0, and the spot card is already up.** 297 flights were held and one turn completed. The messages body says the named flight stays grounded if the offer is ignored (`src/phone/feed.ts`). Flag (b), “grounds before day 2 with no readable warning,” stays down. Cash still reached $1,253,746, with the field stuck at FL1, the tree stuck at 12 nodes, and a penalty total of -$17,400. The regional carrier was still signed.

## Expanded careful, day 150

Live policy only: once cash is above three times the stamp, and the airfield says Over the runway or curb or stand pressure is above 1, Careful builds strip 2 and up to six stands (the old cap of four, plus two). One researcher is hired once a lab room exists. `CAREFUL_150=1 npx vitest run src/playtest/careful150.test.ts`.

The previous careful-150 on the checklist (`docs/MIDLATE_CHECKLIST.md`, sim parent of `20e829d`) was 756 flights, $984,063, 4 stands, 1 runway, the whole tree by day 90, FL10 on day 138, 0 prestige stars.

| | Checklist careful-150 | This live careful-150 |
| --- | ---: | ---: |
| Flights | 756 | 484 (3.2/day) |
| Cash | $984,063 | $1,448,253 |
| Cash day 30 / 60 / 90 | | $265,801 / $595,925 / $929,509 |
| Stands / runways | 4 / 1 | 6 / 2 (both in by day 45; day 30 is still 4 / 1) |
| Researchers | 0 | 1 (hired on the day-1 sample) |
| Tree complete | day 90 | day 71 |
| Field level | FL10 on day 138 | FL8 on day 111, still FL8 at day 150 |
| Prestige stars | 0 | 0 |
| Hub checklist | | Station |
| Fuel groundings | | 0 |
| Flight diverts / go-arounds | | 2 / 0 |
| Missed-connection $ | | $0 |
| Curb | | crossed day 22, peak 2.9 |
| Preferred / Trusted | | day 17 / day 40 |

The four-stand, one-runway building plateau moved. The flight plateau did not. Day 90 on this expanded run is 291 flights, against 298 on the same sim with the tip policy (one strip, no researcher). Day 150 is 484 flights, under the checklist’s 756. Field level stops at 8. Prestige is still 0 stars. The hub checklist is still Station. One researcher pulled the tree from day 88 to day 71.

The standard-length live run (`report.json`, generated with this tip) matches that shape at shorter range. Careful: 143 flights in 45 days, 2 strips and 6 stands, cash $408,885, 0 flight diverts, missed-connection $0, curb day 22, Preferred day 19, Trusted day 41, ending Trusted (score 51.5). Greedy: 2 strips and 8 stands, 195 flights, the tree on day 53, Trusted on day 34, cash $57,180 at day 60, ending Priority (score 86.7). Chaotic: 68 flights in 30 days, 1 strip and 10 stands, cash $142,546, Preferred and Trusted still ahead.

## Proposals

No sim numbers were changed. These are proposals only.

1. **One carrier is the flight cap.** Every tip persona ends on a single airline, and Careful’s day-60 count is 201 against 308 before the spacing change. The 45-day live run records 252 failed contract accepts. One of them names the desk gate (28 passengers a minute asked, 22 cleared). The sim also refuses a second signature for a carrier already on the books. Proposal: read that letter queue before touching headway. The 48-second spacing is not what this seed is short of.
2. **Preferred and Trusted arrive on the unpatched seed.** Careful is Preferred on day 14 and Trusted on day 35. Greedy is day 17 and day 38. Chaotic is later (day 34 and day 46). The 8-desk relations probe, kept on the tip policy, still reaches Trusted by day 60. Proposal: leave the score bands. Chaotic missing the 20–30 day Preferred window is the outlier, and it is the persona that spends the till down to four figures.
3. **Missed-connection cash is $0.** Tip careful’s divert bill is one flight and $0. The 45-day live books put missed connections at $0, delays at -$346, refunds at -$5,000, and other penalties at -$21,800. Proposal: leave minimum connect time. The penalty line that remains is the “other” bucket, and it is small next to the cash pile.
4. **Spot fuel.** Accept-every-card matches the term on flights and on price ($432/day versus $416/day) and grounds nobody. Ignore-every-card grounds the bank on day 0, the phone card already says so, and the till still reaches $1,253,746 by day 90 on one completed turn, field level 1, and 12 research nodes. Proposal: keep the 90 game-minute lead and the existing card sentence. The cash that arrives while the ramp is frozen is the item to look at.
5. **The second strip did not lift day 150.** Six stands and two runways are in by day 45. Flights at day 150 are 484 and the field stops at FL8. Prestige stays at 0. Hub stays Station because these personas have no command for a lounge, a gate, a hangar, or a turnaround truck. Proposal: leave runway cost and the checklist numbers. Give the next playtest a way to accept a hub lease before anyone calls Station a stuck rung. One researcher moving the tree from day 88 to day 71 is enough evidence to leave node costs where they are.
