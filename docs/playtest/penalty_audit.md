# Penalty audit — 15 Oct

The morning note (`docs/playtest/morning_oct15.md`) billed **$170k–$300k** of penalties over 90 days and left Greedy and Chaotic under **$10k**. This pass splits those charges by source, checks that each one names a cause and a fix, and retunes the two lines that were erasing a field by themselves.

Inbound lateness, diverts, missed-connection dollars, and go-around dollars were left alone. Another agent owns those.

## Morning complaint

Older main, 90 sim days, `Math.random` unseeded. Cash at day 90: Careful **$562,139**, Greedy **$7,348**, Chaotic **$4,864**.

| Category | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Missed connection | $99,280 | $120,900 | $24,180 |
| Penalties | $64,704 | $51,258 | $26,266 |
| Emergency refuse | $35,600 | $44,400 | $44,400 |
| Crash fine | $0 | $48,000 | $60,000 |
| Security shock | $14,400 | $35,000 | $14,300 |
| Task miss, inbound, cargo | $0 | $0 | $0 |
| **Penalty total** | **$213,984** | **$299,558** | **$169,146** |

Of the `penalties` category, delay and go-around labels were $35,404 / $28,307 / $13,331. Every recorded connection miss was a divert. Those two systems are the bulk of the morning total, and they are not retuned here.

## How this was measured

Same driver as the morning note: Careful seed `0x5eed`, Greedy `0x6eed`, Chaotic `0xc0a0`, 90 sim days, 5×, tick 0.25s, act every 12 sim seconds. Persona choices are seeded. The field’s `Math.random` is not, so the before and after runs are different draws. Do not read a dollar as a paired delta.

`books().sinks` is the lifetime category total. `penaltySources` is only what is still in the journal. Old entries are trimmed, so a source row can be smaller than its sink. Crash is the clear case: Chaotic’s before sink is −$60,000 (five × $12,000) while the journal still shows four.

The harness is `PENALTY_AUDIT=1 npx vitest run src/playtest/penaltyAudit.test.ts`. It stays skipped in `npm test`.

## Before (this main, old amounts)

Missed connections were already **$0** on this checkout. Go-arounds were a few hundred to about $1,500. The remaining spiral was the crash cap and uncapped stuck-flight refunds.

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Day 30 cash | $128,339 | $37,178 | $55,751 |
| Day 60 cash | $291,247 | $6,936 | $39,253 |
| Day 90 cash | $438,187 | $10,971 | $1,825 |
| Cash low | $8,672 | −$424 | −$9,132 |
| Rating | 66 | 58 | 31 |
| Flights | 333 | 331 | 334 |
| **Fine sinks** | **−$72,603** | **−$113,006** | **−$122,846** |

Lifetime sinks:

| Category | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Emergency refuse | −$49,600 | −$44,400 | −$45,200 |
| Security shock | −$15,200 | −$30,100 | −$9,600 |
| Penalties | −$7,803 | −$26,506 | −$8,046 |
| Crash fine | $0 | −$12,000 | −$60,000 |
| Missed connection, task, inbound, cargo | $0 | $0 | $0 |

Journal still on the tape (trimmed, so smaller than the sinks):

| Persona | Source | Amount | Count |
| --- | --- | ---: | ---: |
| Careful | Emergency refuse, unlabeled | −$27,200 | 68 |
| Careful | Suspicious bag story | −$6,400 | 8 |
| Careful | Go-around delay | −$354 | 1 |
| Greedy | Cancel refund | −$23,654 | 4 |
| Greedy | Emergency refuse, unlabeled | −$22,800 | 57 |
| Greedy | Suspicious bag story | −$16,800 | 21 |
| Greedy | Crash write-off, unlabeled | −$12,000 | 1 |
| Greedy | Security failure (private hard, $1,500) | −$4,500 | 3 |
| Greedy | Go-around delay | −$708 | 2 |
| Chaotic | Crash write-off, unlabeled | −$48,000 | 4 |
| Chaotic | Emergency refuse, unlabeled | −$26,000 | 65 |
| Chaotic | Cancel refund | −$4,807 | 1 |
| Chaotic | Suspicious bag story | −$2,400 | 3 |
| Chaotic | Go-around delay | −$1,439 | 3 |

Careful paid about the same emergency bill as the other two (~$45k–$50k) and finished at $438k. Emergency volume is not what separates the personas. Chaotic’s five crashes at the $12,000 cap were about half of their fines and many times their ending cash. Greedy’s four stuck cancellations refunded $23,654 with no ceiling.

The old public threat rates ($18,000 hard, $9,000 soft, twelve times the private fine) did not fire in this draw. Greedy’s three hard headlines posted at the private $1,500. The preview card could still show the private number while a listed field was billed the public one.

## Readable cause, and a fix

Each charge below names what the player did and what they can do next. Amounts that another system owns are listed so the audit is complete, and they were not changed.

| Charge | What the player sees | What they can do | Proportion |
| --- | --- | --- | --- |
| Missed connection | Rebook or a hotel night. On the morning run every miss was a divert. | Own the divert path. | Left alone. |
| Go-around delay | The go-around line, `260 + seats × 1.2`. | Keep the approach clear. | Left alone. A few hundred to ~$1.5k here. |
| Inbound fine | An inbound ask that was refused. An expired toast is not billed. | Answer the ask. | Left alone. $0 in both runs. |
| Emergency timed out | “Missed — no answer. Fine $400. Answer the card when the field can host it.” | Answer the card. A field that cannot host is not billed. | $400 left alone. Careful pays the same order and stays rich. |
| Refused emergency | “Refused divert… Accept the next one if a stand is free.” Tanker copy names a hangar and a mechanic, or a fuel farm with stock. | Accept the next one the field can take. | $800 left alone. |
| Failed emergency host | The penalties line “Failed emergency host”, not the refuse category. | Build the stand, hangar, or fuel the card asked for. | $4,500 left alone. |
| Crash write-off | Flight ledger plus news: fund maintenance and resurface the runway. A listed field is told the write-off is already on the crash line. | Fund maintenance, resurface, keep fire and ambulance budgets up. The formula still shrinks the fine when those budgets are high; the cap is the ceiling. | Was $12,000 a crash, and a listed crash also booked the write-off again as a security shock. Cap is now $4,000, and the second bill is gone. |
| No medics | “No medics on call… Fund ambulances.” Separate penalties line. | Raise the ambulance budget above 20%. | $4,000 left alone. |
| Suspicious bag | “Scramble the next alarm, or raise the security budget.” The preview uses the same number the ignore will bill. | Scramble, or raise security. | Private $800 left alone. Public was $9,000; now $1,600. |
| Security failure | “Threat reached a departure. Add a security lane and raise the security budget.” | Add a lane and raise the budget. | Private $1,500 left alone. Public was $18,000; now $3,000. One headline is no longer the month. |
| Cancel refund | “Refunded $X of the fees already taken. Clear the taxi or add a stand so the next arrival is not stuck.” | Clear the taxi or add a stand. | Was the whole fee already collected. Capped at $2,500. |
| Apron fire | Fund fire crews. Ledger label “Apron fire”. | Fund fire. | Formula unchanged. |
| Security breach | “Staff the security lane before passengers walk airside.” | Staff the lane. | $1,800, now labeled. |
| Carrier ban | Fine, plus “Raise their Standing before the ban ends.” | Raise Standing. | $8,000, or $12,000 for a hub. Unchanged. |
| Carrier walked away | “Win Standing back, then sign them again.” | Win Standing and sign them. | $12,000. Unchanged. |
| Parking overstay | “Release parking or turn auto schedule on.” | Free a stand or turn auto schedule on. | $5,000, and it can repeat. Unchanged. The news now says the fix. |

## What changed

Tunables live in `src/game/catalog.ts` and `src/game/stuckWatchdogData.ts`.

| Knob | Before | After |
| --- | ---: | ---: |
| `CRASH_FINE_CAP` | $12,000 | $4,000 |
| Listed crash booked again via `shockStock` | the write-off, again | $0 on that shock (the stock still moves) |
| `STUCK_WATCH.maxRefund` | no cap | $2,500 |
| Public hard threat | $18,000, inline | `SECURITY_PUBLIC_HARD_FINE` $3,000 |
| Public soft threat | $9,000, inline | `SECURITY_PUBLIC_SOFT_FINE` $1,600 |
| Threat preview | private number on a listed field | `threatFine`, the number that will be billed |

Ledger labels added where the charge had been blank: carrier ban, carrier walked away, apron fire, crash write-off, no medics, parking overstay, security breach, emergency timed out, refused emergency. News for ban, abandon, overstay, breach, timeout, divert refuse, and tanker refuse now names the fix.

## After (same bots, new draw)

| | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Day 30 cash | $146,269 | $37,443 | $16,883 |
| Day 60 cash | $300,013 | $7,936 | $6,167 |
| Day 90 cash | $452,006 | $16,617 | $7,572 |
| Cash low | $3,813 | −$1,672 | −$1,729 |
| Rating | 66 | 59 | 25 |
| Flights | 336 | 335 | 342 |
| **Fine sinks** | **−$64,600** | **−$85,806** | **−$86,276** |

Lifetime sinks:

| Category | Careful | Greedy | Chaotic |
| --- | ---: | ---: | ---: |
| Emergency refuse | −$44,400 | −$46,400 | −$46,000 |
| Security shock | −$18,400 | −$26,200 | −$16,000 |
| Penalties | −$1,800 | −$13,206 | −$8,276 |
| Crash fine | $0 | $0 | −$16,000 |
| Missed connection, task, inbound, cargo | $0 | $0 | $0 |

Journal still on the tape:

| Persona | Source | Amount | Count |
| --- | --- | ---: | ---: |
| Careful | Emergency timed out | −$23,200 | 58 |
| Careful | Suspicious bag story | −$5,600 | 7 |
| Greedy | Emergency timed out | −$24,000 | 60 |
| Greedy | Suspicious bag story | −$15,200 | 19 |
| Greedy | Cancel refund | −$5,000 | 2 |
| Greedy | Security failure (public hard, $3,000) | −$3,000 | 2 |
| Greedy | Go-around delay | −$708 | 2 |
| Chaotic | Emergency timed out | −$27,200 | 68 |
| Chaotic | Crash write-off | −$12,000 | 3 |
| Chaotic | Suspicious bag story | −$8,800 | 11 |
| Chaotic | Cancel refund | −$5,000 | 2 |
| Chaotic | Go-around delay | −$1,476 | 3 |

Chaotic’s crash sink is −$16,000, four writes at the new cap. The journal still shows three.

## Reading it

Careful stays solvent. $438k before, $452k after, rating 66 both times. Their fine bill is almost entirely emergency timeouts and soft security stories, and the airport still makes money.

Greedy is punished and not wiped out. They finish at $16,617 against Careful’s $452,006, and they touch −$1,672 on day 85. The stuck-refund bucket in the journal drops from $23,654 (four uncapped cancellations) to $5,000 (two at the $2,500 cap). This draw had no crash, so the crash cap is not in their after cash. The security drip is still the greedy tax: nineteen soft stories plus two public hard headlines. That is the punishment for running security thin. It is recoverable. It is tight.

Chaotic struggles and no longer spirals from crashes alone. Ending cash moves from $1,825 to $7,572, still under $10k, and the low improves from −$9,132 to −$1,729. Crash fines fall from $60,000 to $16,000, about a fifth of the fine bill instead of half. The largest line is emergency timeouts at $46,000, the same order Careful pays while finishing rich. Cutting that fine to lift Chaotic over $10k would also pay Careful for ignoring the card. The thin ending is the operation plus a bill every persona shares.

The cap stays at $4,000. A second unseeded run would not make the comparison tighter, and a lower cap would stop a crash from mattering.
