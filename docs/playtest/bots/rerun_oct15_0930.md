# Bot rerun — 15 Oct 2026, 09:30 window

Headless personas on `9ee4a3a`. That tip includes the strip headway (`d31f542`, `RUNWAY_TURN_SEC` 48), fuel Phase 1 (`c4c890f`: the starter has no term, a phone card orders one 36,000 L tanker, 60 sim-seconds to answer, 20 sim-seconds of cooldown, 90 game-minutes on the road), the fuel pipeline (`2020cf0`), helicopter carriers, a refusal of a second signature for a carrier already on the books (`6c0ca81`), and night/weather boarding time when a stand has no apron lights or ground power (`9ee4a3a`). The Growth tree is 63 nodes. No gameplay numbers were changed for this note.

The 90-day Careful / Greedy / Chaotic table is the **tip policy**: sign Apex Local, do not build a second strip, hire no researchers. That is the same fuel and expansion decisions as `rerun_oct15_0630`, on this sim. Helicopter letters are answered the way the current personas answer them (stamp a pad, wait while it builds, or decline). Seeds are Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`. Standard difficulty, passenger focus, sandbox off. One day is 180 sim seconds. The driver ticks at 0.25s and 5×, and looks at the board every 12 sim seconds.

`docs/playtest/research_pace.md` is that same 90-day run. `docs/playtest/bots/tip90.json` and `spot90.json` hold the rows. The live policy (second strip, two extra stands, one researcher) is the day-150 careful run and the standard-length `report.json` (Careful 45, Greedy 60, Chaotic 30, plus the browser smoke). The browser opening reached the first landing. `report.json` was generated 2026-10-15T04:27:54Z.

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
| Flights (per day) | 289 (3.2) | 287 (3.2) | 221 (2.5) |
| Day-60 flights | 192 | 190 | 148 |
| Flight diverts | 1 | 1 | 1 |
| Connection diverts | 0 | 0 | 0 |
| Go-arounds | 0 | 0 | 0 |
| Missed-connection $ | $0 | $0 | $0 |
| Walk / bag / MCT misses | 0 | 0 | 0 |
| Curb crossed 1 | day 22 | day 23 | day 22 |
| Curb peak | 1.7 | 6.0 | 4.7 |
| Fuel groundings | 0 | 0 | 0 |
| Tree complete | day 88 | day 77 | day 57 |
| Cash day 30 / 60 / 90 | $311,105 / $758,912 / $1,153,157 | $161,843 / $113,167 / $379,746 | $7,913 / $3,936 / $16,472 |
| Preferred | day 18 | day 18 | day 30 |
| Trusted | day 38 | day 37 | day 42 |
| Hub checklist | Station (day 1) | Station (day 1) | Station (day 2) |
| Stands / runways | 4 / 1 | 6 / 1 | 19 / 1 |
| Researchers | 0 | 0 | 0 |
| Field level / stars | FL7 / 0 | FL7 / 0 | FL6 / 0 |
| Fuel purchase / day | $416 (term) | $410 (term) | $331 (term) |
| Signed at day 90 | 1 carrier | 1 carrier | 1 carrier |

No softlocks and no console errors. Each persona ends the 90 days with a single signed carrier (Careful and Greedy on the regional starter, Chaotic on Zoomjet). Careful and Greedy reach Preferred on day 18, the same day as the 0630 careful seed, and Trusted about three weeks later. Chaotic reaches Preferred on day 30 and Trusted on day 42.

## Against `rerun_oct15_0630` and the pre-`3360f09` careful run

`0630` was `9065876` after the curb-demand lever, still on the 150-second runway spacing. Careful ran 45 days, Greedy 60, Chaotic 30. Missed-connection cash was $0 and connection diverts were 0. The pre-spacing careful number named for this rerun is **60 days, 308 flights, 35 diverts**.

| | 0630 | This tip run | Pre-`3360f09` careful |
| --- | --- | --- | --- |
| Careful flights | 146 in 45 days (3.2/day) | 289 in 90 days (3.2/day). Day 30 is 95. Day 60 is 192. | 308 in 60 days (5.1/day) |
| Careful diverts | 0 | 1 flight divert across 90 days | 35 in 60 days |
| Careful missed-connection $ | $0 | $0 | not in that citation |
| Careful curb | crossed 1 on day 26, then the bay brought it down | crossed 1 on day 22, peak 1.7 | |
| Careful cash | day 30 $112,395, day 45 $158,421 | day 30 $311,105, day 60 $758,912, day 90 $1,153,157 | |
| Careful Preferred | day 18 | day 18 (Trusted day 38) | |
| Greedy flights | 225 in 60 days | day 60 is 190; 287 in 90 days | |
| Greedy cash | day 30 $8,368, day 60 $20,441 | day 30 $161,843, day 60 $113,167, day 90 $379,746 | |
| Greedy diverts / missed $ | 0 / $0 | 1 flight divert / $0 | |
| Chaotic | 104 flights in 30 days, cash $209,834, 0 diverts | day 30 is 79 flights and $7,913; day 90 is 221 flights and $16,472; 1 flight divert | |

Careful’s day-60 count (192) sits on the 0630 pace of about 3.2 flights a day. It is 116 flights short of the pre-spacing 308, and short of the 275 recorded on `4b02521` with the same tip policy. Diverts did not come back: one flight divert in 90 days, against 35 in that 60-day pre-spacing run. Missed-connection cash is $0, which matches the 0630 note.

Fuel did not ground anyone who signed the term.

Research pace moved by a few days, on a tree that grew from 62 nodes to 63. `research_pace.md` from `5120ac5` had Careful complete on day 85 (277 unspent), Greedy on day 74, Chaotic on day 53, all with 0 researchers. This run is day 88 (134 unspent), day 77, and day 57. The labs are still empty. The wallet cap is still what stops Chaotic and Greedy (324 unspent).

## Spot-only probe

Same careful decisions and the same seed, with `signFuelTerm` left out. Ninety days each.

| | Term (the careful row above) | (a) Accept every spot card | (b) Ignore every spot card |
| --- | ---: | ---: | ---: |
| Flights | 289 | 290 | 1 |
| Fuel groundings | 0 | 0 | 294 |
| First grounding day | — | — | 0 |
| Fuel $ / day | $416 term | $454 spot | $0 |
| Fuel $ total | $37,440 | $40,896 | $0 |
| Cash day 90 | $1,153,157 | $1,181,635 | $1,250,778 |
| Tree complete | day 88 | day 88 | — (12 of 63) |
| Field level | FL7 | FL7 | FL1 |
| Copy on screen before the first hold | term-signed news | spot cards, then tankers | `Spot card for LIF103` |

**(a) The 90 game-minute lead covered this bank.** Zero fuel holds in 90 days. Spot fuel cost $38/day more than the term ($40,896 versus $37,440). Flights stayed in the same band (290 versus 289). Flag (a), “accept-all still grounds flights,” stays down.

**(b) The first hold is on day 0, and the spot card is already up.** 294 flights were held and one turn completed. The messages body says the named flight stays grounded if the offer is ignored (`src/phone/feed.ts`). Flag (b), “grounds before day 2 with no readable warning,” stays down. Cash still reached $1,250,778, with the field stuck at FL1, the tree stuck at 12 nodes, and a penalty total of -$18,600. The regional carrier was still signed. An emergency host was also missed while the farm was empty: “Firefighting plane went elsewhere — we could not host it (fuel farm empty).”

## Expanded careful, day 150

Live policy only: once cash is above three times the stamp, and the airfield says Over the runway or curb or stand pressure is above 1, Careful builds strip 2 and up to six stands (the old cap of four, plus two). One researcher is hired once a lab room exists. `CAREFUL_150=1 npx vitest run src/playtest/careful150.test.ts`.

The previous careful-150 on the checklist (`docs/MIDLATE_CHECKLIST.md`, sim parent of `20e829d`) was 756 flights, $984,063, 4 stands, 1 runway, the whole tree by day 90, FL10 on day 138, 0 prestige stars.

| | Checklist careful-150 | This live careful-150 |
| --- | ---: | ---: |
| Flights | 756 | 491 (3.3/day) |
| Cash | $984,063 | $1,752,524 |
| Cash day 30 / 60 / 90 | | $283,966 / $727,794 / $1,126,497 |
| Stands / runways | 4 / 1 | 6 / 2 (strip 2 is in by day 30; the sixth stand is in by day 45) |
| Researchers | 0 | 1 (hired on the day-1 sample) |
| Tree complete | day 90 | day 71 |
| Field level | FL10 on day 138 | FL9 on day 150 |
| Prestige stars | 0 | 0 |
| Hub checklist | | Station |
| Fuel groundings | | 0 |
| Flight diverts / go-arounds | | 2 / 0 |
| Missed-connection $ | | $0 |
| Curb | | crossed day 21, peak 2.9 |
| Preferred / Trusted | | day 14 / day 34 |

The four-stand, one-runway building plateau moved. The flight plateau did not. Day 90 on this expanded run is 299 flights, against 289 on the same sim with the tip policy (one strip, no researcher). Day 150 is 491 flights, under the checklist’s 756. Field level reaches 9 on day 150 and does not reach 10. Prestige is still 0 stars. The hub checklist is still Station. One researcher pulled the tree from day 88 to day 71.

The standard-length live run matches that shape at shorter range. Careful: 153 flights in 45 days (3.4/day), 2 strips and 6 stands, cash $508,046, 0 flight diverts, missed-connection $0, curb day 20, Preferred day 14, Trusted day 30, ending Trusted (score 64.5). Greedy: 2 strips and 8 stands, 197 flights, the tree on day 53, Trusted on day 34, cash $70,861 at day 60, ending Priority (score 86.7). Chaotic: 84 flights in 30 days, 1 strip and 12 stands, cash $202,742, Preferred day 15, Trusted day 28.

## Proposals

No sim numbers were changed. These are proposals only.

1. **One carrier is the flight cap.** Every tip persona ends on a single airline, and Careful’s day-60 count is 192 against 308 before the spacing change. The sim refuses a second signature for a carrier already on the books, and a desk sentence still appears when check-in cannot clear the ask (28 passengers a minute against 22). Proposal: read that letter queue before touching headway. The 48-second spacing is not what this seed is short of.
2. **Preferred and Trusted arrive on the unpatched seed.** Careful and Greedy are Preferred on day 18 and Trusted on day 38 and day 37. Chaotic is Preferred on day 30 and Trusted on day 42. The 8-desk relations probe, kept on the tip policy, still reaches Trusted by day 60. Proposal: leave the score bands.
3. **Missed-connection cash is $0.** Tip careful’s divert bill is one flight and $0. The 45-day live books put missed connections at $0, delays at $0, refunds at -$2,500, and other penalties at -$22,200. Proposal: leave minimum connect time.
4. **Spot fuel.** Accept-every-card matches the term on flights and grounds nobody, at $38/day more ($454 versus $416). Ignore-every-card grounds the bank on day 0, the phone card already says so, and the till still reaches $1,250,778 by day 90 on one completed turn, field level 1, and 12 research nodes. Proposal: keep the 90 game-minute lead and the existing card sentence. The cash that arrives while the ramp is frozen is the item to look at.
5. **The second strip did not lift day 150.** Strip 2 is in by day 30 and six stands by day 45. Flights at day 150 are 491 and the field reaches FL9 on the last day. Prestige stays at 0. Hub stays Station because these personas have no command for a lounge, a gate, a hangar, or a turnaround truck. Proposal: leave runway cost and the checklist numbers. Give the next playtest a way to accept a hub lease before anyone calls Station a stuck rung. One researcher moving the tree from day 88 to day 71 is enough evidence to leave node costs where they are.
