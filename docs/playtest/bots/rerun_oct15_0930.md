# Bot rerun — 15 Oct 2026, 09:30 window

Headless personas on `4b02521`. That tip includes the strip headway (`d31f542`, `RUNWAY_TURN_SEC` 48) and fuel Phase 1 (`c4c890f`: the starter has no term, a phone card orders one 36,000 L Apex tanker, 60 sim-seconds to answer, 20 sim-seconds of cooldown, 90 game-minutes on the road). No gameplay numbers were changed for this note.

The 90-day Careful / Greedy / Chaotic table is the **tip policy**: sign Apex Local, do not build a second strip, hire no researchers. That is the same decisions as `rerun_oct15_0630`, on the new sim. Seeds are Careful `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`. Standard difficulty, passenger focus, sandbox off. One day is 180 sim seconds. The driver ticks at 0.25s and 5×, and looks at the board every 12 sim seconds.

`docs/playtest/research_pace.md` is that same 90-day run. `docs/playtest/bots/tip90.json` and `spot90.json` hold the rows. The live policy (second strip, two extra stands, one researcher) is only the day-150 careful run below. `report.json` is the standard-length live-policy playtest (Careful 45, Greedy 60, Chaotic 30) plus the browser smoke, not the 90-day tip table.

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
| Flights (per day) | 442 (4.9) | 360 (4.0) | 437 (4.9) |
| Day-60 flights | 275 | 231 | 287 |
| Flight diverts | 12 | 6 | 2 |
| Connection diverts | 16 | 5 | 0 |
| Go-arounds | 31 | 10 | 4 |
| Missed-connection $ | -$29,760 | -$5,580 | $0 |
| Walk / bag / MCT misses | 0 | 0 | 0 |
| Curb crossed 1 | day 16 | day 19 | day 20 |
| Curb peak | 2.6 | 7.4 | 9.3 |
| Fuel groundings | 0 | 0 | 0 |
| Tree complete | day 85 | day 74 | day 51 |
| Cash day 30 / 60 / 90 | $141,513 / $354,306 / $573,105 | $7,443 / $36,855 / $50,984 | $63,155 / $46,694 / $112,086 |
| Preferred | day 12 | day 14 | day 15 |
| Trusted | day 25 | day 27 | day 50 |
| Hub checklist | Station | Station | Station |
| Stands / runways | 4 / 1 | 6 / 1 | 24 / 1 |
| Researchers | 0 | 0 | 0 |
| Field level / stars | FL8 / 0 | FL8 / 0 | FL8 / 0 |
| Fuel purchase / day | $617 (term) | $636 (term) | $610 (term) |

No softlocks and no console errors. Careful’s carrier is Preferred inside the 20–30 day band only if Trusted is the band that matters; Preferred itself landed on day 12, earlier than the 0630 seed (day 18) and earlier than the 20–30 note. Trusted, the next relationship step, is day 25 for Careful.

## Against `rerun_oct15_0630` and the pre-`3360f09` careful run

`0630` was `9065876` after the curb-demand lever, still on the 150-second runway spacing. Careful ran 45 days, Greedy 60, Chaotic 30. Missed-connection cash was $0 and connection diverts were 0. The pre-spacing careful number named for this rerun is **60 days, 308 flights, 35 diverts**.

| | 0630 | This tip run | Pre-`3360f09` careful |
| --- | --- | --- | --- |
| Careful flights | 146 in 45 days (3.2/day). Day 45 on this seed is 199. | 442 in 90 days (4.9/day). Day 60 is 275. | 308 in 60 days (5.1/day) |
| Careful diverts | 0 | 12 flight diverts across 90 days | 35 in 60 days |
| Careful missed-connection $ | $0 | -$29,760, all of it divert-tagged (0 walk / bag / MCT misses) | not in that citation |
| Careful curb | crossed 1 on day 26, then the bay brought it down | crossed 1 on day 16, peak 2.6, still over 1 at day 90 | |
| Careful cash | day 30 $112,395, day 45 $158,421 | day 30 $141,513, day 60 $354,306, day 90 $573,105 | |
| Careful Preferred | day 18 | day 12 (Trusted day 25) | |
| Greedy flights | 225 in 60 days | day 60 is 231; 360 in 90 days | |
| Greedy cash | day 30 $8,368, day 60 $20,441 | day 30 $7,443, day 60 $36,855, day 90 $50,984 | |
| Greedy diverts / missed $ | 0 / $0 | 6 flight diverts / -$5,580 | |
| Chaotic | 104 flights in 30 days, cash $209,834, 0 diverts | day 30 is 115 flights and $63,155; day 90 is 437 flights and $112,086; 2 flight diverts | |

The headway put turns back on the field. Careful’s day-60 count (275) is well above a 3.2/day pace and still 33 flights short of the pre-spacing 308. Diverts came back, and they are fewer than that 60-day 35 even across 90 days. They are also the whole of Careful’s missed-connection bill. The 0630 claim that missed-connection cash stayed at $0 does not hold on this tip.

Fuel did not ground anyone who signed the term. The 0630 tank note (no departure grounded) still holds for the term path.

Research pace did not move. `research_pace.md` from `5120ac5` had Careful complete on day 85, Greedy on day 74, Chaotic on day 53, all with 0 researchers. This run is day 85, day 74, and day 51. Careful’s unspent points at day 90 rose from 277 to 319. The wallet cap is still what stops the pile. More flights did not hire a researcher and did not finish the tree sooner.

## Spot-only probe

Same careful decisions and the same seed, with `signFuelTerm` left out. Ninety days each.

| | Term (the careful row above) | (a) Accept every spot card | (b) Ignore every spot card |
| --- | ---: | ---: | ---: |
| Flights | 442 | 434 | 1 |
| Fuel groundings | 0 | 0 | 496 |
| First grounding day | — | — | 0 |
| Fuel $ / day | $617 term | $696 spot | $0 |
| Cash day 90 | $573,105 | $594,843 | $952,031 |
| Copy on screen before the first hold | term-signed news | spot cards, then tankers | `Spot card for LIF103` |

**(a) does not ground the scheduled bank.** Zero fuel holds in 90 days. The 90 game-minute lead was long enough for these departures. Spot fuel cost about $79/day more than the term ($62,640 versus $55,520). Flights and cash stayed in the same band as the term. One emergency host was missed while a tanker was already on the road: “Firefighting plane went elsewhere — we could not host it (fuel farm empty).” That is not a departure hold. It is a gap between card and delivery for an unscheduled visitor.

**(b) grounds on day 0.** 496 flights were held and one turn completed. The phone card was already up: the messages body says the named flight stays grounded if the offer is ignored (`src/phone/feed.ts`). The “no readable warning” flag does not trip. The failure mode is ignoring a card that already says so. Cash still reached $952,031 on that frozen ramp, with the tree stuck at 24 nodes and the field at FL2.

## Expanded careful, day 150

Live policy only: once cash is above three times the stamp, and the airfield says Over the runway or curb or stand pressure is above 1, Careful builds strip 2 and up to six stands (the old cap of four, plus two). One researcher is hired once a lab room exists. `CAREFUL_150=1 npx vitest run src/playtest/careful150.test.ts`.

The previous careful-150 on the checklist (`docs/MIDLATE_CHECKLIST.md`, sim parent of `20e829d`) was 756 flights, $984,063, 4 stands, 1 runway, the whole tree by day 90, FL10 on day 138, 0 prestige stars.

| | Checklist careful-150 | This live careful-150 |
| --- | ---: | ---: |
| Flights | 756 | 826 (5.5/day) |
| Cash | $984,063 | $1,021,035 |
| Cash day 30 / 60 / 90 | | $189,208 / $432,927 / $702,108 |
| Stands / runways | 4 / 1 | 6 / 2 (both in by day 45) |
| Researchers | 0 | 1 (hired on day 1) |
| Tree complete | day 90 | day 69 |
| FL10 | day 138 | day 126 |
| Prestige stars | 0 | 0 |
| Hub checklist | | Station |
| Fuel groundings | | 0 |
| Flight diverts / go-arounds | | 45 / 88 |
| Missed-connection $ | | -$74,400 (31 walk / bag / MCT misses, plus 48 connection diverts) |
| Curb | | crossed day 18, peak 5.4 |
| Preferred / Trusted | | day 14 / day 28 |

The four-stand, one-runway plateau moved. Flights kept climbing after day 90 (480 at day 90, 826 at day 150). Field level 10 arrived 12 days earlier. Prestige is still 0 stars. The hub checklist is still Station. The extra strip also raised go-arounds, divert bills, and the curb peak. One researcher, not the headway, is what pulled the tree from day 85 to day 69.

## Proposals

No sim numbers were changed. These are proposals only.

1. **Hub checklist.** Every run, including the day-150 field at FL10 with two strips, is still on Station. The checklist’s desk lines wait on a lease the game does not assign. Proposal: either let a player dedicate the desk the card already names, or do not offer Focus and above until that lease exists.
2. **Researchers.** The tip policy still finishes the tree with an empty lab (Careful day 85, same day as `5120ac5`). Hiring one researcher moves that day to 69. Proposal: the lab card should name the hire the way the desk card names agents. Leave node costs where they are; this run does not justify a retune.
3. **Spot fuel.** Accept-every-card matches the term and does not ground departures, at about $79/day more. Ignore-every-card grounds the bank on day 0, and the phone card already says that. Proposal: keep the 90 game-minute lead. Do not add a second warning. Do look at why an ignored ramp still banks $952k by day 90 on one completed turn.
4. **Diverts and missed connections.** Headway brought flights most of the way back (275 versus 308 at careful day 60) and brought a divert bill the 0630 rerun did not have. On the tip seed the bill is divert-tagged, not a walking-time miss. Proposal: leave the 48-second headway. Do not retune minimum connect time off this seed.
5. **Curb after the first bay.** Careful crosses pressure 1 on day 16 now, day 26 in the 0630 note, and one bay, one rank, and one lane do not bring it back under 1. The second strip made the peak worse (5.4) because more aircraft reached the door. Proposal: the next player-built curb stamp is the bottleneck, not a slower runway. Prestige staying at 0 stars after FL10 is a separate bar; this run did not hit it as the thing that stopped growth.
