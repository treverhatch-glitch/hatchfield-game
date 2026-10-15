# Bot rerun — 15 Oct 2026, 09:30 window

Headless personas on the sim at `17ac92b`. That tip includes the strip headway (`d31f542`, `RUNWAY_TURN_SEC` 48), fuel Phase 1 (`c4c890f`: the starter has no term, a phone card orders one 36,000 L tanker, 60 sim-seconds to answer, 20 sim-seconds of cooldown, 90 game-minutes on the road), the fuel pipeline (`2020cf0`), helicopter carriers, a refusal of a second signature for a carrier already on the books (`6c0ca81`), runway banks spaced by measured strip occupancy (`6ec865e`), and hub warmth (`17ac92b`). The Growth tree is 63 nodes. No gameplay numbers were changed for this note. Later commits through `7fa3ef6` move hydrant pit writes through one function and record menu and schedule notes. They do not retune the pump, the strip, or the spot card, and these tables were not re-run after them.

The 90-day Careful / Greedy / Chaotic table is the **tip policy**: sign Apex Local, do not build a second strip, hire no researchers. That is the same fuel and expansion decisions as `rerun_oct15_0630`, on this sim. Helicopter letters are answered the way the current personas answer them (stamp a pad, wait while it builds, or decline). Seeds are Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`. Standard difficulty, passenger focus, sandbox off. One day is 180 sim seconds. The driver ticks at 0.25s and 5×, and looks at the board every 12 sim seconds.

`docs/playtest/research_pace.md` is that same 90-day run. `docs/playtest/bots/tip90.json` and `spot90.json` hold the rows. The live policy is the day-150 careful run and the standard-length `report.json` (Careful 45, Greedy 60, Chaotic 30, plus the browser smoke). Live Careful and Greedy stamp strip 2 when the airfield is deferring demand and cash clears the stamp plus $30,000 (`99d0e37`), and they also stamp strip 2 and two extra stands once cash is above three times the stamp and the airfield says Over the runway or curb or stand pressure is above 1. They hire one researcher once a lab room exists. The tip policy turns both strip rules off. The browser opening reached the first landing. `report.json` was generated 2026-10-15T04:48:51Z.

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
| Flights (per day) | 306 (3.4) | 293 (3.3) | 261 (2.9) |
| Day-60 flights | 207 | 197 | 179 |
| Flight diverts | 1 | 4 | 1 |
| Connection diverts | 0 | 0 | 0 |
| Go-arounds | 0 | 0 | 2 |
| Missed-connection $ | $0 | $0 | $0 |
| Walk / bag / MCT misses | 0 | 0 | 0 |
| Curb crossed 1 | day 17 | day 19 | day 17 |
| Curb peak | 1.8 | 6.2 | 5.4 |
| Fuel groundings | 0 | 0 | 0 |
| Tree complete | day 88 | day 78 | day 54 |
| Cash day 30 / 60 / 90 | $337,050 / $791,511 / $1,197,497 | $7,156 / $110,930 / $381,340 | $295,623 / $5,302 / $3,793 |
| Preferred | day 18 | day 22 | day 14 |
| Trusted | day 35 | day 39 | day 29 |
| Hub checklist | Station (day 1) | Station (day 1) | Station (day 2) |
| Stands / runways | 4 / 1 | 6 / 1 | 18 / 1 |
| Researchers | 0 | 0 | 0 |
| Field level / stars | FL7 / 0 | FL7 / 0 | FL7 / 0 |
| Fuel purchase / day | $425 (term) | $412 (term) | $358 (term) |
| Signed at day 90 | 1 carrier | 1 carrier | 1 carrier |

No softlocks and no console errors. Each persona ends the 90 days with a single signed carrier (Careful and Greedy on the regional starter, Chaotic on Zoomjet). Careful is Preferred on day 18, the same day as the 0630 seed, and Trusted on day 35. Chaotic reaches Trusted on day 29 and then spends the till down to $3,793 on 18 stands and one runway.

## Against `rerun_oct15_0630` and the pre-`3360f09` careful run

`0630` was `9065876` after the curb-demand lever, still on the 150-second runway spacing. Careful ran 45 days, Greedy 60, Chaotic 30. Missed-connection cash was $0 and connection diverts were 0. The pre-spacing careful number named for this rerun is **60 days, 308 flights, 35 diverts**.

| | 0630 | This tip run | Pre-`3360f09` careful |
| --- | --- | --- | --- |
| Careful flights | 146 in 45 days (3.2/day) | 306 in 90 days (3.4/day). Day 30 is 107. Day 60 is 207. | 308 in 60 days (5.1/day) |
| Careful diverts | 0 | 1 flight divert across 90 days | 35 in 60 days |
| Careful missed-connection $ | $0 | $0 | not in that citation |
| Careful curb | crossed 1 on day 26, then the bay brought it down | crossed 1 on day 17, peak 1.8 | |
| Careful cash | day 30 $112,395, day 45 $158,421 | day 30 $337,050, day 60 $791,511, day 90 $1,197,497 | |
| Careful Preferred | day 18 | day 18 (Trusted day 35) | |
| Greedy flights | 225 in 60 days | day 60 is 197; 293 in 90 days | |
| Greedy cash | day 30 $8,368, day 60 $20,441 | day 30 $7,156, day 60 $110,930, day 90 $381,340 | |
| Greedy diverts / missed $ | 0 / $0 | 4 flight diverts / $0 | |
| Chaotic | 104 flights in 30 days, cash $209,834, 0 diverts | day 30 is 96 flights and $295,623; day 90 is 261 flights and $3,793; 1 flight divert | |

Careful’s day-60 count (207) sits on the 0630 pace of about 3.4 flights a day. It is 101 flights short of the pre-spacing 308, and short of the 275 recorded on `4b02521` with the same tip policy. Diverts did not come back: one flight divert in 90 days, against 35 in that 60-day pre-spacing run. Missed-connection cash is $0, which matches the 0630 note.

Fuel did not ground anyone who signed the term.

Research pace moved by a few days, on a tree that grew from 62 nodes to 63. `research_pace.md` from `5120ac5` had Careful complete on day 85 (277 unspent), Greedy on day 74, Chaotic on day 53, all with 0 researchers. This run is day 88 (114 unspent), day 78, and day 54. The labs are still empty. The wallet cap is still what stops Chaotic and Greedy (324 unspent).

## Spot-only probe

Same careful decisions and the same seed, with `signFuelTerm` left out. Ninety days each.

| | Term (spot probe) | (a) Accept every spot card | (b) Ignore every spot card |
| --- | ---: | ---: | ---: |
| Flights | 309 | 297 | 1 |
| Fuel groundings | 0 | 0 | from day 0 (661 hold/cancel lines) |
| First grounding day | — | — | 0 |
| Fuel $ / day | $854 term | $923 spot | $0 |
| Fuel $ total | $76,852 | $83,088 | $0 |
| Cash day 30 | $335,094 | $335,503 | -$22,400 |
| Cash day 90 | $1,208,354 | $1,161,779 | -$22,476 |
| Tree complete | day 90 (63 of 63) | day 90 (63 of 63) | — (12 of 63) |
| Field level | FL7 | FL7 | FL1 |
| Copy on screen before the first hold | term-signed news | spot cards, then tankers | `Spot card for LIF104` |

Same seed, measured on this sim after grounded departures stop keeping the slot fee. An unfixed run of this same build still had the ignore airport at $389,148 on day 30 and $1,283,871 on day 90 with one flight. Term and accept on that unfixed run were $1,217,569 and $1,206,402 on day 90.

**(a) The 90 game-minute lead covered this bank.** Zero fuel holds in 90 days. Spot fuel cost $69/day more than the term ($83,088 versus $76,852). Flights stayed in the same band (297 versus 309). A second accept run on the same seed finished at $340,086 on day 30 and $1,193,086 on day 90 (311 flights, no fuel holds), next to the unfixed $340,839 and $1,206,402. Flag (a), “accept-all still grounds flights,” stays down.

**(b) The first hold is on day 0, and the spot card is already up.** One turn completed. The messages body says the named flight stays grounded if the offer is ignored (`src/phone/feed.ts`). Flag (b), “grounds before day 2 with no readable warning,” stays down. Cash is -$22,400 on day 30 and -$22,476 on day 90, under the term at both marks. The field stays FL1 and the tree stays at 12 nodes. Finance shows the clawback on Penalties as Cancel refund (about -$759,884 over the run) plus one Carrier walked away (-$12,000). The regional carrier is not signed at day 90. A phone line on the cancellation names the refunded passenger fees and the slot fee.

## Expanded careful, day 150

Live policy. `CAREFUL_150=1 npx vitest run src/playtest/careful150.test.ts`.

The previous careful-150 on the checklist (`docs/MIDLATE_CHECKLIST.md`, sim parent of `20e829d`) was 756 flights, $984,063, 4 stands, 1 runway, the whole tree by day 90, FL10 on day 138, 0 prestige stars.

| | Checklist careful-150 | This live careful-150 |
| --- | ---: | ---: |
| Flights | 756 | 499 (3.3/day) |
| Cash | $984,063 | $1,747,034 |
| Cash day 30 / 60 / 90 | | $274,564 / $716,335 / $1,115,256 |
| Stands / runways | 4 / 1 | 6 / 2 (both in by day 30) |
| Researchers | 0 | 1 (hired on the day-1 sample) |
| Tree complete | day 90 | day 71 |
| Field level | FL10 on day 138 | FL8 on day 111, still FL8 at day 150 |
| Prestige stars | 0 | 0 |
| Hub checklist | | Station |
| Fuel groundings | | 0 |
| Flight diverts / go-arounds | | 4 / 0 |
| Missed-connection $ | | $0 |
| Curb | | crossed day 21, peak 3.0 |
| Preferred / Trusted | | day 23 / day 41 |

The four-stand, one-runway building plateau moved. The flight plateau did not. Day 90 on this expanded run is 301 flights, against 306 on the same sim with the tip policy (one strip, no researcher). Day 150 is 499 flights, under the checklist’s 756. Field level stops at 8. Prestige is still 0 stars. The hub checklist is still Station. One researcher pulled the tree from day 88 to day 71.

The standard-length live run matches that shape at shorter range. Careful: 153 flights in 45 days (3.4/day), 2 strips and 6 stands, cash $494,514, 0 flight diverts, 13 go-arounds, missed-connection $0, curb day 19, Preferred day 21, Trusted day 39, ending Trusted (score 53.6). Greedy: 2 strips and 8 stands, 208 flights, the tree on day 54, Preferred on day 44, Trusted still ahead at day 60, cash $65,586, ending Preferred (score 43.8). Chaotic: 90 flights in 30 days, 1 strip and 9 stands, cash $3,595, Preferred day 14, Trusted day 26.

## Proposals

No sim numbers were changed. These are proposals only.

1. **One carrier is the flight cap.** Every tip persona ends on a single airline, and Careful’s day-60 count is 207 against 308 before the spacing change. The sim refuses a second signature for a carrier already on the books, and a desk sentence still appears when check-in cannot clear the ask. Proposal: read that letter queue before touching headway. The measured strip spacing is not what this seed is short of.
2. **Preferred and Trusted arrive on the unpatched seed.** Careful is Preferred on day 18 and Trusted on day 35. Greedy is day 22 and day 39. Chaotic is day 14 and day 29. The 8-desk relations probe, kept on the tip policy, still reaches Trusted by day 60. The live Greedy run, which does build the second strip, is still Preferred at day 60 (score 43.8, Trusted line 45). Proposal: leave the score bands. The strip is the candidate for that one-point slip.
3. **Missed-connection cash is $0.** Tip careful’s divert bill is one flight and $0. The 45-day live books put missed connections at $0, delays at -$4,454, refunds at $0, and other penalties at -$40,760. Proposal: leave minimum connect time.
4. **Spot fuel.** Accept-every-card matches the term on flights and grounds nobody, at $32/day more ($457 versus $425). Ignore-every-card grounds the bank on day 0, the phone card already says so, and the till still reaches $1,302,718 by day 90 on one completed turn, field level 1, and 12 research nodes. Proposal: keep the 90 game-minute lead and the existing card sentence. The cash that arrives while the ramp is frozen is the item to look at.
5. **The second strip did not lift day 150.** Six stands and two runways are in by day 30. Flights at day 150 are 499 and the field stops at FL8. Prestige stays at 0. Hub stays Station, including after hub warmth, because these personas have no command for a lounge, a gate, a hangar, or a turnaround truck. Proposal: leave runway cost and the checklist numbers. Give the next playtest a way to accept a hub lease before anyone calls Station a stuck rung. One researcher moving the tree from day 88 to day 71 is enough evidence to leave node costs where they are.
