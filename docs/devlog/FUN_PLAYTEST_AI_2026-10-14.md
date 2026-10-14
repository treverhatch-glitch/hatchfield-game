# Fun playtest — 14 Oct 2026

First-time player, trunk `cursor/audit-playtest-562d` (`b1b5353`). Browser, Passenger start, sandbox switched off. No debug cheats. Fast-forward did not stick in the long sitting, so everything after the opening was played at 1x.

This is not a 45–90 minute run and it is not a Field Level 4–5 airport. Several openings were played. The longest continuous sitting reached **Field Level 2** (105/220 XP, about ten minutes of 1x after the kit) with Bushline, Zoomjet, Fogbank Air, and Northline signed. Cash peaked around **$43k** after touching **$932**.

**Untested:** Field Level 3, 4, and 5. Widebody stands, heavy strip, 787/777/A350, jumbo. Any research purchase (Night bank never became affordable). Placing a shop or a bag-claim item. Cargo start. A busy ramp watched at 3x/5x.

Media: `docs/devlog/media/fun-2026-10-14/`.

## Scores

| | Score |
| --- | --- |
| Overall fun | **2** |
| First 10 minutes | **2** |
| Clarity | **2** |
| Sense of progression | **2** |
| Challenge and balance | **2** |
| Satisfaction of watching the airport | **3** |
| UI and readability | **2** |
| Performance | **2** |

### Overall fun — 2

The first jet and the first deposit are a real game. After that the phone nags, the airplane on the stand is not the airplane I was sold, and the systems I came to play (shops, bags I can touch, research, widebodies) do not open. I would not start a second evening on this build.

### First 10 minutes — 2

The coach is the right idea. "Stamp Starter kit (or your own strip + stand)" is readable, and following it does produce a field and a call from Bushline within a minute. Two things wreck the opening.

Sandbox is ticked on the title screen and advertises **$9,999,999**, under a paragraph that says "Limited funds." Turning it off is silent about difficulty: New Game then shows **$150,000**, the city plot is **$95,000**, and I land with **$55,000**. Screenshot `01-title-sandbox-on.png`, `03-route-pick.png`.

The kit is not in the build bar. It is a button inside Economy. The bar is what the coach is pointing at, so I opened Pavement and stamped **Runway, $38,000**. The hint is good ("Regional strip 14×2 — A320 / 737 / A321 / 757F"). The field then says a contractor is driving in, about 12s. Cash is **$17,000**. Economy's kit button answers **"Need starter kit — short 31000."** There is no New Game, restart, or quit on the field. I had to come back as a new visit and hit New Game. `05-tray-pavement.png`, `10-after-runway-click.png`, `11-economy-first.png`.

Second try: kit from Economy. Cash **$7,000**. Budget says **Payroll ~$4,217 / 30s**. That is the number a new player stares at while the coach says wait for a plane. `15-starter-button.png`, `16-kit-down.png`.

### Clarity — 2

I knew the next verb for the first five minutes: kit, sign, wait. The Bushline letter is the clearest UI in the game. Requirements listed Met, terms shown (landing **$2,800**, bags **$400**), 36 seconds on the clock. `18-first-contract.png`.

I did not know the next verb after the first takeoff.

- Field asks ("Police post", "Car park") have one button, **Got it**. Pressing it folds the card. The card comes back. The police ask pays **$5,200**. The police post in the tray costs **$11,000**. Doing the chore loses money, and the letter does not say that.
- Airlines says Bushline is **Twin Otter / Islander, 9–19 seats**, and the contract says no hall is required. The planner's live flight was **BU102 Boeing 737-800, 160 passengers**, and in another sitting **Airbus A321, 180 passengers**, tagged `T1·G2·M·JW`. `23-airlines.png`.
- Research says what is next (Night bank, 28 RP) and also says drip **~0.00/s** and "hire researchers, furnish desk/board/bench." I had 4–6 RP. Nothing I could press. `24-research-first.png`.
- Shops / Food, Arrivals, Check-in, and Security in the hall produced no item list. The panel still said to pick a zone. Food court **$0**. Zoomjet's letter says "we bring mass travelers, just sell them things."

### Sense of progression — 2

XP is visible and it moved. First turnaround: **$7,000 → about $18,000–$22,000** and **23 or 46 XP**. Long sitting: **Field Level 2, 105/220**, four airlines, Standing in the 60s–70s, Fogbank's snack-franchise perk actually listed. That is a ladder.

The ladder stops. Level 3 was 12% when I quit. Widebody ops sits behind Night bank (28) → De-ice (34) → Stand classes (40) → Widebody ops (48). Lab drip was zero with no researchers and no gear. I never bought a node. Tiers above T2 stayed stories in the airline list.

### Challenge and balance — 2

The pinch after the kit is real, and then it evaporates for reasons I don't respect.

- Kit leaves **$7,000** against a payroll line of **~$4,200 / 30s**. Cash did not fall at that rate. It rose into the **$30–40k** range by level 2, with a chart span of **$7,000–$40,496** in one sitting and a spike down to **$932** in another (below). I cannot tell if I am winning.
- Zoomjet's posted bag fee is **$1**. Landing **$680**. I signed them because every requirement said Met.
- Planner billed **SkyBite catering at $0** on BU102 while fuel was **$2,400**, bags **~$530–$560**, landing **~$1,900–$2,000**. The kit brags that SkyBite is included.
- Micro strip's button says **$25,000**. The desk then says **owe $26,400**.
- Northline opened negotiation at **56%** of posted fees. Every term, 6 / 12 / 24 months, quoted the same **$13k/day**. Counter, then accept. `27-negotiate.png`.
- Police ask bonus **$5,200**, building **$11,000**. I stamped it because the letter nagged. The contractor message appeared, the tile did not look occupied, a second stamp also started a site, and the bank went **$11,932 → $932**. Then the loan.

### Watching the airport work — 3

This is the part I would come back for. BU101 on approach (ATR 72-600 in one run, A321 in another), then a turnaround that hits the book and the cash line. The planner names the phase ("Taxi out"), the gate (`T1·G2·M·JW`), and the line items. An Air Tractor showed up as an emergency and the ticker said a schedule cascade slid five flights. The hall reports "Curb → gate path works" and a security rate. `19-flight-approach.png`, `20-first-turn-done.png`, `clip-first-turn.webm`.

It does not sustain. Food court stayed **$0**. Catering billed **$0**. I never saw a bag I could follow as a problem to solve. The terminal is a prefab scoreboard (40 passengers, 34/min, bags 70, upkeep $90/day), not a place I operated. `21-hall.png`.

### UI and readability — 2

Trays are the right pattern: name, price, one-line hint. Met/Missing on letters is the right pattern. The tier list telling me Northline still needs hall security and bags is the right pattern.

The failures are crowding and lying labels. Coach and letters share the top-left, and a contract dies in ~36s while I am reading Budget. Economy still offers **Starter kit · $48,000 · Empty plot only** after the kit is down. Income and the bank are split across a top bar, a chip, and a panel whose tabs I could not get to show a simple "you earn this, you burn this" once the loan desk was open. Hall zone buttons render, then no cards. Negotiate is the gold button on a letter; Accept is the one that actually starts the airline. I hit Accept first because I wanted a plane. A player who hits the gold button is in a spreadsheet.

### Performance — 2

Measured here on SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero))`), not on a gaming GPU. About **12 fps**, p95 frame **150ms**, with a few aircraft and the prefab hall. The tab did not crash. The sim kept producing flights. It feels thick: camera moves and the approach clip are readable and not pleasant. I would not judge a discrete-GPU player by this number, and I also would not ship a first impression that chugs with one jet on a software renderer this hard without a quality notch.

## Top 5 frustrations

1. **The recommended first building is hidden, and the obvious one bankrupts it.** Runway is on the bar for $38,000. The kit is inside Economy for $48,000. After the runway I was $31,000 short, the strip was a construction site rather than a runway I could see as "done," and the HUD has no restart.
2. **Field asks nag and punish.** Got it does not finish "Police post" or "Car park." Building the police post costs more than the bonus. Clicking again during the contractor timer bought a second post and left me at **$932**.
3. **The contract lies about the airplane.** Bushline is sold as a 9–19 seat commuter that does not need a hall. The turn on the stand was a 737-800 or an A321 with 150–180 people.
4. **Money text cannot be trusted.** Payroll "~$4,217 / 30s" with $7,000 in the bank. Catering $0. Zoomjet bags $1. Loan button $25,000, balance $26,400. Negotiation $13k/day on every term.
5. **The second layer is locked behind a blank menu and a zero drip.** Hall shops never listed an item. Food court $0 while a carrier's whole pitch is retail. Research showed a chain to widebodies and a drip of 0.00/s. I had no move.

## Top 5 delights

1. **Bushline's letter.** Who they are, what they pay, every requirement marked Met, a deadline. I signed without a wiki. `18-first-contract.png`.
2. **The first turnaround hitting the book.** Approach, then cash and XP moving together ($7k to the high teens, XP on the Field line). `clip-first-turn.webm`.
3. **Tray hints.** "Regional strip 14×2 ($38,000) — A320 / 737 / A321 / 757F" is the voice the rest of the UI should use.
4. **The airline ladder, including the locked rows.** T1 Bushline standing and fleet blurb, T2 Northline "ready to call" with the missing infra written out, everyone else still visible. I could see a future.
5. **Northline's offer sheet.** 56% of posted fees, line by line, a face, Round 1/4, Counter. I wanted the daily number to move when I changed the term. The sheet itself is the right toy. `27-negotiate.png`.

## Bugs

Repro is Passenger, sandbox off, Economy → Starter kit, unless noted. Cash figures moved between sittings; the shapes did not.

1. **Signed fleet does not match the carrier card or the contract.** Accept Bushline (T1, "Twin Otter / Islander · 9–19 seats", "No hall required"). Open Planner on the live turn. Observed BU102 as Boeing 737-800 / 160 pax and, in another sitting, Airbus A321 / 180 pax, on a regional 14-cell strip, tagged like a jetway turn.
2. **SkyBite catering bills $0 on a kit that signs SkyBite.** Same turn, Planner lines: catering (SkyBite) **$0**, fuel **$2,400**, bag handling **~$530+**, landing **~$1,900+**.
3. **Field-ask "Got it" does not retire the ask.** After the first turn, letters "Police post … $5,200 if done" and "Car park … $4,800 if done" stay in the stack after Got it. They come back with a fresh timer.
4. **A stamp during the contractor window reads as "nothing happened," so a second stamp spends again.** Police post **$11,000**. First click: "Police post is a construction site — a contractor is driving in. About 4s." Cash still looked unspent in the tile. Another click on a nearby grass cell started a second site. Bank **$11,932 → $932**. Same pattern on the opening runway: cash dropped $38,000 while the tile census still showed no runway, only the contractor line.
5. **Starter kit button survives the kit.** Economy overview after a successful kit still shows **Starter kit · $48,000** and "Empty plot only."
6. **Loan principal on the button is not the balance you owe.** Click Micro strip · **$25,000**. Desk immediately reads **Open: Micro strip · owe $26,400**.

No page crash and no red console error from the game itself in these sittings. The sim kept scheduling after the cascade line.

## Untested

- Field Level 3, 4, 5 and the XP grind past 105.
- Widebody ops, Stand W, heavy strip, hydrant fuel, jumbo, military ramp. All visible as locked research, none buyable (had at most ~23 RP, Night bank costs 28, drip 0.00/s).
- Placing or running a shop, café, or extra bag claim. Hall zones did not give me an item card. Food court stayed $0.
- Whether bags actually jam, and whether I can fix a jam.
- 3x / 5x as a player tool. Scripted clicks on Pause and 5x left `speed` at 1, so I will not call the buttons broken. I also will not claim I played the late game.
- Cargo start, hybrid, sandbox-on, and anything past one terminal.

## Five changes, in order

1. **Make the first minute one path.** Put "Starter kit · $48,000" on the coach. Keep the runway click from being able to spend the kit. Add New Game on the field. Default sandbox off, and say the word "standard" next to $150,000.
2. **Fly the airplane you sold.** Bushline's first turns are Twin Otters until the player has the stands, the hall, and the level for a 737. The planner line and the airline card have to name the same metal.
3. **One true money sentence.** Replace "Payroll ~$4,217 / 30s" with the period that is actually charged, put the fee on the loan button, and don't show a catering brand next to $0. If Zoomjet bags are $1 on purpose, the letter has to say they make it back in the hall, and the hall has to have a shop I can buy.
4. **Field asks either build or go away.** A button that stamps the police post, shows **$11,000 cost / $5,200 bonus**, and disables itself when I can't afford it. Got it must clear the card. Block a second stamp while "contractor is driving in" is true for that tool.
5. **Open one toy before Field Level 2.** A single shop in the prefab hall with a price and a daily take, wired to Zoomjet's "sell them things," and a research drip that moves before I have hired a researcher and furnished a bench. The widebody chain can stay gated. The dead desk cannot be the first thing Research shows.
