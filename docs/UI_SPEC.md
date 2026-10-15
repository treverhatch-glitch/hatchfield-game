# Hatchfield UI spec

Desktop HUD for the airport. This is the implementable description of the chrome on `main`. G5-1 through G5-7 are shipped. G5-8 and G5-9 are the remaining tickets. Do not rebuild the surfaces listed under [Shipped, leave it](#shipped-leave-it).

Cities: Skylines 1 and 2 are the reference for how panels open, how an info view tints the map, how a milestone bar shows what the next bit of XP unlocks, and how a development tree shows cost, prerequisites, and locked nodes. The video notes in the UI research are opinion: the model did not see the frames, and one pass described Factorio. Use the patterns in this file, not those corner maps.

Desktop only. The layout target is 1920×1080. There is no phone-width layout to design. The in-game handset already hides below 801 px (`PHONE_DESKTOP_MIN`).

## Rules

1. The centre of the screen stays clear for the apron. Chrome sits on the edges.
2. A second click on the open tab or subsection closes it. No blocking modal over the field. Esc follows `nextEscape`: close the pause sheet, release a captured camera, cancel the stamp, close info numbers (hotspot lines, then the More menu, then the map Numbers panel), close the info view, close the flight card, and only then open the pause sheet. It does not close the manage panel or the handset.
3. Detailed numbers live in a click-open submenu. A chip, a legend swatch, or a roster row may show a name, a status word, or one headline figure. The breakdown opens on click.
4. The handset peeks from the left edge. A new contract or message flashes a short preview, then the handset slides out on click. It has two tabs and full cards with actions.
5. Hints and tip chips stay off the handset. They already do (`PHONE_EXCLUDED_KINDS` includes `hint` and `tip`). Do not route them through it.
6. Whether alerts and emergencies also appear on the handset is undecided. See [Phone, hints, and alerts](#phone-hints-and-alerts). Do not pick an option in code until that playtest is written down.

Tunables stay in config (`src/research/config.ts`, `src/info/config.ts`, `src/game/catalog.ts` `FIELD_LEVEL_XP`, `src/game/alertsData.ts`). Do not hard-code a new threshold in a component.

## Shipped, leave it

Described below as it works. Tickets may extend a file; they may not replace the taxonomy, the dock, the build bar, the six info views, the More menu, the flight card, the alert pins, the building panel, the handset, or the Airlines relations submenu.

| Surface | Where | Landed as |
| --- | --- | --- |
| Chrome taxonomy, alert dock, build bar, research badges | `src/ui/nav/taxonomy.ts`, `src/ui/nav/BuildTray.tsx`, `src/ui/isolated/AlertStack.tsx` | PR #15 era |
| Info-view bar: Traffic, Queues, Bays, Airfield, Power, Fuel, plus More | `src/ui/InfoViews.tsx`, `src/info/` | `287d068`, Airfield and More with G5-3 |
| Left building panel, bay limits, click-open subsections | `src/ui/BuildingPanel.tsx`, `src/buildinginfo/` | `68a42cc` |
| Handset: Contracts and Messages | `src/ui/phone/`, `src/phone/` | phone v1 |
| Relations score in a click-open Airlines submenu | `src/ui/AirlinesDesk.tsx` | `a959aa3` |
| Flight card for the selected flight | `src/ui/inspector/FlightCard.tsx` | G5-5 |
| Critical alert pin on the first cell | `src/ui/alerts/AlertMark.tsx` | G5-6 |

Menu labels are title case. The only menu tree is `taxonomy.ts`. A tool and a manage tab are each listed once. `src/ui/nav/taxonomy.test.ts` and `src/ui/menuIntegrity.e2e.test.ts` keep it that way.

## Screen

1920×1080, apron view. The top bar wraps if the window is narrower; do not add a second always-on row to compensate.

| Edge | What sits there |
| --- | --- |
| Top bar | Airport name and plot, Menu, Title, cash with the daily flow, clock, speed, field badge (level, XP bar, the next unlock line, research points), Standing, reputation, the status chip, season and weather, free gates and holding, HATCH price after listing, a quiet vitals line (strip, runway, security, halls). |
| Under the top bar, full width | Ground-stock line on the left, passenger-flow toggle on the right (`OwnerChrome` `info-strip`). Hotspot labels are not on this strip. |
| Under that, centred | The six info-view pills and More. One legend hangs under the selected pill. |
| Left edge | Handset peek. Map goals and the first-hour coach sit above it. The building panel is inset to `left: 56px` so the peek stays clickable. |
| Left, mid | Letter stack (contracts, layovers, hubs, maintenance, security, emergencies) and diplomacy prospect tabs. |
| Right | Manage panel when a group is open. Hall kit when a hall is open. The flight card, about 320 px, when a flight is selected and the card is open. It sits above the alert dock. |
| Bottom centre | Build bar: categories, then one sub-tab row, then the stamp grid. |
| Bottom right | Alert dock, above the build bar. When the dock has rows, the hint badge sits above it. When the dock is empty, the hint badge keeps its rest place. A critical alert with a cell also pins that cell. |

Cash opens a forecast (`cash-menu`): live income, daily charges, the seven-day balance, and Open books, which is Money → Overview. Click the cash figure again to close it.

## Chrome taxonomy

Two bars. Build is the apron catalogue. Manage is the books. Settings are not a manage tab.

### Build bar

Bottom centre. Click a category to open its sheet. Click the same category to close it. Select leaves stamp mode. Facing east–west / north–south rotates the stamp. There is no Late category. Bulldoze is Tools → Edit and refunds 40%.

| Category | Sub-tabs | Stamps |
| --- | --- | --- |
| Airfield | Runways, Taxiways, Stands, Tower | Short / standard / heavy runway, helipad; taxiway, de-ice; small / medium / wide / jumbo stand; tower. Remote bay and jetway toggles sit on the toolbar, not as extra stamps. |
| Terminal | Halls, Processing, Gates, Movers | Premade hall, terminal hall, bag belt; check-in and security open the hall kit; gates open the hall kit; travelator, skywalk, hub skywalk, people mover, terminal bus, transfer bus. |
| Airside Ops | Fuel, GSE/Catering, Bags/Cargo, Hangars/MRO | Fuel farm, fuel rail, oil, SAF blending; GSE depot, catering kitchen; baggage hall, cargo; hangars, MRO, night hub. |
| Safety & Security | Stations | Fire, police, guard post. |
| Landside | Roads, Curb, Parking, Transit, Hotels | Road; bus, curb lane, taxi rank; car parks; rail, rail link; inn, business hotel, resort, airport hotel. Short-term / long-term toggles sit on the toolbar. |
| Retail & Comfort | Food, Shops, Lounges, Decor | Snack kiosk on the apron; food, shops, lounges, and decor open the hall kit. |
| Tools | Edit | Bulldoze. |

The bag belt and the guard post appear once. Roads are Landside, not Airfield. Fire and police are Safety, not Airside Ops.

### Manage bar

Five groups. The Money button also shows the cash figure. The second click on an open sub-tab closes the panel.

| Group | Sub-tabs | Sheet |
| --- | --- | --- |
| Money | Overview, Income, Expenses, Loans, Charts, Fees, Payroll, Commercial | Economy, fees, the old budget desk, shop bids and campaigns. A year report appears under Commercial only while one is waiting. |
| Airlines | Roster, Letters, Hubs, Rival, Negotiation | Carrier cards, diplomacy, Bellwater, the open counter-offer. |
| Operations | Planner, Stands, Services, Premium | Timetable and the selected flight, stands, fuel and catering, premium lanes. |
| People | Staff, Commute, Morale, Thoughts | Housing and roster, the commute, retention, passenger icons on the field. |
| Growth | Research tree, Field Levels, Specializations, Achievements | The development tree, the level list, the spec trees, milestones and yearly awards. |

### System

Menu, or Esc when nothing else is open, opens the pause sheet. The field stays visible. Resume, Save, Load, Settings (sound, graphics, hints, tip chips, controls), New game, Quit to title. Settings are only here, not on the manage bar.

## How panels open

Cities: Skylines keeps the HUD thin and puts the breakdown on the thing you clicked. Hatchfield does the same with subsections, not with a new window per number.

| Click | Opens | Numbers stay behind |
| --- | --- | --- |
| A placed building (not grass, runway, or taxiway) | Left building panel: name, status, one why line, bottleneck icons | Throughput, Bays, Queue, Staff, Upkeep, Bottleneck. Each figure's tooltip starts with "Inputs:". Bays lists each bay, including "Bay 2 idle: no tug". Queue is people at a desk or vehicles waiting on a taken bay. Check-in and security use this same panel from inside the hall. |
| An info-view pill | Legend: title, colour key, short scores, a why tooltip that starts with "Inputs:" | The Numbers control. Traffic reuses the landside panel. Fuel reuses the fuel-farm panel. The others use `info-view-panel` (scores, per-cell details, fix lines). |
| Field badge | Growth → Field Levels | The per-level stamp list. |
| Cash | Forecast card | The charge lines. Open books jumps to Money → Overview. |
| Airlines → a carrier | One card | Standing, Contract, Demand, Fees, Contact, Rivals. |
| Airlines → Relations | The signed-carrier list: tier, label, score | The meter, the part lines, extra routes, and the hub request. |
| A research node | The card on the right of the tree | Cost, state, what it unlocks, the Unlock button. |
| A build stamp, after 400 ms | Hover card: price, upkeep, capacity, noise, the lock sentence | The Open link jumps to Field Levels or the research node. |
| A guest in the hall | Walker card | Needs, thoughts, satisfaction. |
| A flight on the apron | Right-edge flight card | Airline, aircraft, stand, turnaround by service, delay reason, connections, and the ledger. Planner shows the same lines. |
| More on the info bar | The hotspot list | `infoLines` for that hotspot, in the Numbers panel. |
| A critical alert pin | The same pan as the dock card | Warning and info alerts have no pin. |
| Menu | Pause sheet | Settings pages. |

The building panel is not an info view. Closing one does not clear the other.

Relations (`a959aa3`): the Relations control on the Airlines desk toggles the submenu. Each signed carrier is a row with the score. Clicking the row opens the meter, the relationship fee, the extra timetable slots that tier adds, and the non-zero parts (fees, on-time, and the rest of `RELATION_PART_LABELS`). That fee is the only carrier multiplier on the landing bill. No signed carrier yet reads "No signed carriers yet. A kept contract is what starts the climb."

## Info views

One overlay at a time. Esc closes it. The pills are Traffic, Queues, Bays, Airfield, Power, Fuel (`MAP_VIEWS`), then More. Desktop only, and hidden inside a hall.

Picking a pill desaturates the reading toward green / amber / red (`HEAT` in `src/info/config.ts`). Tint opacity is 0.42, 0.62 on the hot cells, so aircraft stay readable. Traffic does not tint cells; it uses the landside ribbons. The legend under the pill is the colour key plus the short scores. Each score's `title` and tooltip name the inputs.

| View | Green | Amber | Red | Short scores | Numbers panel |
| --- | --- | --- | --- | --- | --- |
| Traffic | Under 70% | 70–100% | Over capacity | Pressure, arrivals, queue, delay | Landside segments and the curb fixes |
| Queues | Wait under 45 s | Wait under 2 min | Long wait | Check-in and security wait | The queue rows |
| Bays | Idle | In use | Bay queue | In use against the bay count | Per-stand lines |
| Airfield | Spare movements | Bank over 70% | Contracts over capacity | Movements, arrival gap | Contract load against the strips. Tint sits on the runway cells. |
| Power | Spare capacity | Load over 70% | At or over capacity | Capacity and demand | The power lines |
| Fuel | Stock comfortable | Quarter to two thirds | Under a quarter | Tank level | The fuel-farm panel (low stock is the hot end) |

Owner rule for anything added later: a new figure goes in the Numbers panel, not on the pill and not on the top bar. The short scores already on the legend stay; they are the headline, and each one already explains itself on hover.

More sits on that same bar. It lists the hotspot labels that are not already a map pill: Check-in, Security, Lost passengers, Bags, Shops, and, from field level 3, Connections and Links. Maintenance and Night hub appear when those buildings exist. Fuel farm and Power stay on the pills only. Choosing a More item opens its `infoLines` in the Numbers panel, not in a second centred card. The ground-stock line and the flow toggle stay on the strip. A visible critical alert with a cell draws one pin on the first cell; clicking the pin pans the same way the dock card does. Warning and info alerts do not pin.

## Milestone bar and XP

Cities: Skylines 1 puts a milestone bar on the HUD. It fills as the city grows, and the milestone list shows what each step unlocks, including the steps you have not reached. Cities: Skylines 2 spends the same idea as an XP bar into a development tree. Hatchfield uses both: the field badge is the bar, Field Levels is the milestone list, and the research tree is where points are spent.

The badge (`FieldBadge`) shows `Field Lv N` (or `Field Lv 10 · P2` after level 10), a 4 px fill, the research-point count, and one muted line of what the next rung opens (`nextUnlockLine`). The fill is `fieldProgress(xp).pct` between `FIELD_LEVEL_XP[level]` and the next rung. The line names up to three unlocks from `unlocksAtLevel(level + 1)` and appends `+N` for the rest. At level 10 it names the next prestige star. At max prestige the line is empty. Clicking the badge opens Growth → Field Levels. It does not open the research tree. The level-up card is unchanged.

Rungs (`FIELD_LEVEL_XP`): 1 at 0, 2 at 90, 3 at 220, 4 at 420, 5 at 700, then 1100, 1600, 2300, 3200, 4500 for levels 6–10. After level 10, five prestige stars are 2000 XP apart. XP comes from turnarounds, cargo, contracts, loans, parcels, and hosted emergencies. It does not come from idle time.

Field Levels lists every level, marks the current one, and names the stamps and research-desk nodes that open there (`unlocksAtLevel`). A level with nothing new says "No new stamp at this level."

When the level changes, a card sits on the left, under the top bar, and does not cover the apron. It lists what just unlocked and has Open Progression (scrolls to `level-N`) and Close.

## Growth tree

Growth → Research tree is the development tree. One wallet. Points trickle from operations and from the research rooms. The old desk and the Wave 3 list are grants on this tree, not a second currency. Costs and category gates live in `src/research/config.ts`. The node table is `docs/RESEARCH.md`.

### Layout

- A category column, then one lane, then a detail card. Specialisations are five lanes under the charter node.
- A line joins a node to the previous node in its lane. That line is the prerequisite.
- Categories and their field levels: Airfield 1, Terminal 1, Airside Ops 2, Landside 2, Safety & Security 3, Retail & Comfort 3, Specialisations 4. A shut category stays in the list with a padlock and `Lv N`. It is not removed.
- Tier 1 of a line is free. Later tiers cost 50, 52, 54, 56, 62 points and require the previous node. A second specialisation branch costs 1.5× after the first pick.

### Node states

`nodeState` is the only state function. The button uses it as `data-state`.

| State | When | How it looks | Card |
| --- | --- | --- | --- |
| Owned | The id is in `state.unlocked` | Green border, filled ring, no button | "Owned" and the cost already paid |
| Available | Category is open and every `requires` id is owned | Blue border, open ring, cost highlighted | Unlock, or `Need N more RP (~D days)` when short |
| Locked | Category is shut, or a prerequisite is missing | Grey, padlock, cost still shown | The button reads Locked and stays disabled. Under the state line, `lockCopy` names the gate. |

Locked nodes stay on the lane. Do not hide them, and do not skip ahead: `buyNode` refuses a locked id.

A locked card says why. Category shut → `Needs Field Level N.` Prerequisite missing → `Research {previous node name} first.` Owned and available return null, so a node that is only short of points still shows `Need N more RP`. The button stays disabled and still reads Locked.

Clicking a locked build stamp's Open link scrolls to `research-node-{id}` on this tree.

## Build sub-menu locks

Cities: Skylines 1 hides a lot of locked buildings until the milestone. Players miss what is coming. Hatchfield does the other thing, which matches the development tree: a locked stamp stays in its sub-tab, greyed (`filter: grayscale(1)`, opacity 0.58), with the exact gate on the stamp.

`stampCard` decides the gate. A stamp is locked when the field level is short, the research-tree node is unowned, or an older desk grant is still missing.

| Gate | On the stamp | On the hover card (400 ms) | Click |
| --- | --- | --- | --- |
| Field level only | Padlock. The price line reads `Field level N`. | "Unlocks at Field level N." Open jumps to `level-N`. | Opens Field Levels. Does not place. |
| Research tree | The node's own name, in green, not a padlock. | "Requires research: {node name}." | Opens that node. |
| Tree already owned, desk grant still missing | The desk node's name | The same research sentence, naming the desk node | Opens the tree at that id. |
| Both a level and a node | The node name wins the badge. The sentence includes both. | Both sentences | Opens the node. |

A padlock is only the field-level gate. Hall-kit shortcuts (Check-in, Food, Shops, and the rest) are not locked in the tray; the lock, when there is one, is on the kit item inside the hall. An unlocked stamp shows its price. The hover card also shows upkeep, capacity, and whether the city bills noise.

Do not add a second copy of a stamp to another category to "make it easier to find." Search, if it comes, filters this same list (G5-9).

## Phone, hints, and alerts

### Handset (shipped)

Left edge, desktop only. Three positions: peek (about 46 px of the bezel), flash (about 210 px, a two-line preview), open (the full 320 px handset, 10 px off the edge).

- A new message preview holds for 4.5 s, then the bezel returns to the peek.
- A new contract preview stays on the peek until the player opens the handset.
- Click the peek to slide it out. Close returns to the peek. The handset does not take keyboard focus and does not block apron clicks.
- Tabs: Contracts, Messages. Each shows a count. Clicking the open tab shuts that page without closing the handset ("Contracts closed" / "Messages closed").
- A card has the kind, the sender, a countdown or the word Note, a title, the body, optional requirement lines (including the relationship fee and the slot line on a contract), and the action buttons (Sign, Decline, and the others already on `PhoneAction`).
- Swipe on the card body moves between cards. Buttons do not swipe.
- While a card with a letter countdown is on the open tab, that letter's timer pauses (`holdLetters`).

Empty copy: "No signed contracts yet." and "No messages."

The same offer can also sit on the letter stack. On a desktop the card shifts right while the handset is open so both stay clickable.

### Hints

Separate. `HintPanel` is a bottom-right badge of advisor hints. Tip chips sit near cash, the build tray, or a tile and dismiss with ×. The first-hour coach is its own card. None of these are phone kinds. Settings can turn tip chips off. Do not add a hint tab, a hint preview, or a "tips" inbox.

### Alert dock (shipped)

Bottom right, above the build bar (`alert-dock`). Critical and warning only. Info notes stay in the sim and off the dock. Clicking the card pans the camera. Pan to problem, Apply fix (disruptions), Ignore, and Dismiss stay on the card; the last three do not pan by themselves. The stack can minimise to `Critical · N` or `Warning · N`. Empty dock renders nothing.

The top bar still has a separate status chip. It can name a hard threat, an emergency, standing low, holding, an apron jam, a security queue, lost passengers, power, a loan short, and disruption titles. It drops a phrase when a critical or warning dock row already covers that condition (power brown-out, a disruption title, a security queue when a queue alert is up, a fuel line the dock shows). Holding, standing low, the emergency letter, and the threat stay, because the dock does not raise them. With nothing left, it reads **No alerts**. Clicking the chip scrolls to the letter when the first phrase is a letter, and otherwise expands the dock when the dock has rows. The chip never creates a phone card. It does not pan and has no severity colour beyond a CSS class. It is not the dock.

Emergencies and threats are letters on the left stack. The handset refuses kinds `alert`, `emergency`, and `threat`. That is the current code, not the decision below.

### Undecided: alerts and emergencies on the handset

Do not implement any of these until the playtest result is written down. The handset copy and the dock stay as they are meanwhile.

**Option A — keep the split.** Contracts and messages on the handset. Critical and warning operations on the dock. Emergencies and threats on the letter stack. Hints untouched. This is what the code does today.

**Option B — emergencies also flash on the handset.** A threat or an emergency still has its letter, and it also gets one phone preview so a player who lives in the handset sees it. The dock does not gain those letters. The preview must not steal the apron click.

**Option C — emergencies only on the handset.** Remove them from the letter stack. The dock stays for stuck aircraft, queues, fuel, cash, and the other `cond:` alerts. A missed phone preview is a missed emergency, so this option needs a preview that does not expire until it is opened (the contract rule).

**Playtest, one session, desktop 1920×1080, hints left on.** Start a passenger field, place a hall and a fuel farm, and sign one carrier. Then force three moments, in order, while a stamp is in hand:

1. A new contract (handset preview).
2. A critical dock alert with a map target (empty fuel, or a stuck departure).
3. A security threat or an emergency letter.

For each moment write down: did the player see it without being told where to look, did it cover the stamp or the apron click, and which surface they used to act (handset, dock, letter). Run it once per option with a different person, or the same person on a new field after a break. The option that gets all three seen, and does not cover the stamp, is the one to build. If they tie, stay on Option A.

G5-8 is that playtest. It has no code.

## G5 tickets

G5-1 through G5-7 are done. G5-8 is the handset playtest. G5-9 waits until that note exists.

### G5-1 — Next unlocks on the XP bar

**Done.** The field badge names the next rung while the bar fills. See [Milestone bar and XP](#milestone-bar-and-xp).

Cities shows the coming milestone's unlocks while the bar fills, not only after the fanfare.

- **Files:** `src/ui/nav/FieldBadge.tsx`, `src/ui/nav/levelUnlocks.ts`, `src/index.css` (`.field-badge` only).
- **Build:** Under the research-point line, one muted line of the names from `unlocksAtLevel(level + 1)`. Cap the visible names at three and append `+N` for the rest. At level 10, show the next prestige star instead of a stamp list. At max prestige, the line is empty.
- **Accept:** A field at level 1 with XP below 90 renders the level-2 names from `unlocksAtLevel(2)` on the badge without opening Growth. Clicking the badge still opens Field Levels. The level-up card is unchanged. A unit test renders the badge at level 1 and at level 10.

### G5-2 — Locked research card names the gate

**Done.** A locked card names the field level or the missing node. See [Node states](#node-states).

Cities: Skylines 2 prints the missing prerequisite on the locked node. The lane already draws the line; the card now says why.

- **Files:** `src/research/logic.ts`, `src/ui/research/ResearchTree.tsx`, `src/research/research.test.ts`.
- **Build:** Add `lockCopy(state, node, fieldLevel): string | null`. Category shut → `Needs Field Level N.` Prerequisite missing → `Research {previous node name} first.` Owned and available return null. The card shows that sentence under the state line when the node is locked. The button stays disabled and still reads Locked.
- **Accept:** A test locks Airside by field level and expects `Needs Field Level 2.` A test with the category open and the previous node unowned expects that node's name. An available node with too few points still shows `Need N more RP`. Locked nodes remain in the lane.

### G5-3 — One info menu

**Done.** One bar holds the six map pills and More. See [Info views](#info-views).

Cities has one info-view list. The hotspot labels (Check-in, Security, Lost passengers, Bags, Shops, Connections, Links, Fuel farm, Power, Maintenance, Night hub) used to be a second row. Fuel farm and Power are pills. The rest are in More. The passenger-flow toggle stays on the strip.

- **Files:** `src/ui/InfoViews.tsx`, `src/ui/infoViews.css`, `src/ui/isolated/OwnerChrome.tsx`, `src/info/types.ts` if a view id is added, `src/ui/infoViews.e2e.test.ts`.
- **Build:** Keep Traffic, Queues, Bays, Airfield, Power, and Fuel as the map pills. Move the hotspot labels that are not already a map pill into one More menu on that same bar. Choosing one opens its `infoLines` in the existing Numbers panel, not in a second centred card. Fuel farm and Power do not appear twice. The ground-stock line and the flow toggle stay on the strip; they are not pills.
- **Accept:** With a hall placed, one `info-view-bar` contains the six pills and More. More includes Check-in and, at field level 3, Connections. Opening More → Bags shows the bag lines and no second `info-panel` from `OwnerChrome`. Esc closes it. The e2e shot for each map pill still shows a legend whose score tooltips start with "Inputs:".

### G5-4 — Status chip stops repeating the dock

**Done.** The chip drops a phrase the dock is already showing. See [Alert dock (shipped)](#alert-dock-shipped).

The top-bar chip is a second alert list with no pan and no severity.

- **Files:** `src/ui/Hud.tsx`.
- **Build:** Drop a phrase when a dock row of severity critical or warning already covers that condition (power brown-out, disruption titles, security queue when a queue alert is up). Keep phrases the dock does not raise (holding count, standing low, the emergency letter, the threat). Clicking the chip opens the letter stack scroll target when the first phrase is a letter, otherwise it expands the dock if the dock has rows. Empty copy stays "No alerts".
- **Accept:** With a critical fuel alert on the dock and no threat, the chip does not also say a fuel or power line that the dock shows. With only an emergency letter, the chip names it and a click reveals the letter. The chip never creates a phone card. A render test covers the empty string.

### G5-5 — Flight card off the Planner tab

**Done.** A selected flight opens a right-edge card. Planner still shows that flight. See [How panels open](#how-panels-open).

Cities opens an inspector on the thing you clicked. The selected flight used to live only inside Operations → Planner.

- **Files:** `src/ui/Hud.tsx` (the Selected flight block), a new `src/ui/inspector/FlightCard.tsx` that only moves that markup.
- **Build:** Clicking a flight on the apron opens a right-edge card, about 320 px, with the same status lines the Planner block already shows. Esc or a second click closes it. Opening Planner still shows the same flight. The card does not cover the alert dock: it sits above the dock, or the dock shifts left of it while the card is open.
- **Accept:** A test renders the card from a selected flight id with Planner closed. Dismissing the card leaves the flight selected in the sim. Walker cards in the hall are unchanged.

### G5-6 — Critical alert marks the cell

**Done.** A visible critical alert with a cell pins that cell. See [Info views](#info-views).

Cities pins a problem icon on the building. The dock pans, and the pin does the same pan.

- **Files:** `src/ui/isolated/AlertStack.tsx` or a sibling `src/ui/alerts/AlertMark.tsx`, `src/index.css`.
- **Build:** For each visible critical alert that has `at.cells`, draw one marker at the first cell. Clicking the marker calls the same `panToAlert` as the card. Warning alerts do not mark. Info alerts do not mark. The marker is not a letter and not a phone card.
- **Accept:** A critical alert with a cell renders one marker. A warning with a cell does not. Clicking the marker and clicking the card both call pan. Dismissing the alert removes the marker.

### G5-7 — Hints sit clear of the dock

**Done.** With dock rows, the hint badge sits above the dock. See [Screen](#screen).

Both the hint badge and the alert dock use the bottom-right corner.

- **Files:** `src/ui/isolated/HintPanel.tsx`, `src/index.css` (`.alert-dock` bottom offset only if the hint moves).
- **Build:** When the dock has rows, the hint badge anchors above the dock, not over its cards. When the dock is empty, the hint badge keeps today's place. Hints still do not enter the handset.
- **Accept:** A static render with one warning alert and one hint does not overlap their boxes. Turning hints off removes only the hint badge.

### G5-8 — Playtest the handset against emergencies

No code. Run the playtest in [Undecided](#undecided-alerts-and-emergencies-on-the-handset) and write the three results under `docs/playtest/`. The owner picks A, B, or C after that note exists. A ticket that changes `PHONE_EXCLUDED_KINDS` before then is out of spec.

- **Files:** `docs/playtest/phone-alerts.md` only.
- **Accept:** The note names the option, the three moments, and whether the stamp stayed clickable. It does not edit `src/phone/` or `AlertStack.tsx`.

### G5-9 — Find a stamp

Later. Cities players added Find It because the build bar got long. Not before the G5-8 playtest note exists.

- **Files:** `src/ui/nav/BuildTray.tsx`, `src/ui/nav/taxonomy.ts` only if a label is missing.
- **Build:** A filter at the right of the open tray. It matches stamp names in the current category. Locked stamps stay in the results, still grey, still with their badge. Esc clears the filter before it closes the tray.
- **Accept:** Typing "wide" in Airfield → Stands shows the wide stand, locked or not, and does not show the fuel farm. A locked result still opens Growth instead of placing.

## Out of this spec

Not HUD tickets, and not decided here: airline dossier layout, CEO traits, policy ghost-previews on the fee sliders, a delayed-flight breadcrumb, an upgrade brush, an eyedropper, world-space passenger thought bubbles, and any phone tab other than Contracts and Messages. Financials and Settings on the handset are rejected. Chirper-style scrolling citizen text is rejected; passenger lines stay in People → Thoughts and on the walker card.
