# Hatchfield UI map

Player-facing surfaces. The build trays and the five manage menus are `src/ui/nav/taxonomy.ts`. Each apron tool and each manage panel is listed there once. A headless walk of every tab and sub-tab, with screenshots, lives in `src/ui/menuIntegrity.e2e.test.ts`.

Labels are title case. Short forms that were doing real work now say the work: Operations, Specializations, Campaigns, Runway, Maintenance hangar, Small / Medium / Wide / Jumbo stand.

## Title

- **Title screen** (`start-menu`)
  - New Game — opens the new-game sheet
  - Continue — resumes a save, when one exists
  - Starter kits — Passenger, Cargo
  - Sandbox cash toggle
  - Start with hints off
- **New-game sheet**
  - Back to title
  - Climate maps
  - Passenger kit, Cargo kit, Hybrid
  - Start with hints off

## Top bar

- Airport name and plot
- **Menu** — pause sheet (Esc)
- **Title** — back to the title screen. New Game and Continue live there
- Cash and daily flow — opens the cash forecast
- **Field level** — badge with the level, an XP bar, and a research-points counter. Click it to open Growth → Field Levels. A level-up card lists what just unlocked and has Open Progression.
- Reputation
- Free gates and holding
- HATCH price — only after listing; opens Money → Overview
- Runway condition, security, hall count, runway count
- Weather

## Cash forecast

Opened from the cash figure. Live income, daily charges (payroll, upkeep, holding), and the projected balance. Click the figure again to close.

## Boards

Corner toggle **Boards**. Split-flap departures and arrivals. Tabs: Departures, Arrivals. Close returns to the field. An empty board says “No movements on the board.”

## Phone

Desktop only (viewport at least 801 px wide). A peek on the left edge opens the handset.

- **Contracts** — signed contracts
- **Messages** — letters, with Sign / Decline and the other actions on the card
- **Close** — back to the peek

A card with no countdown is marked Note. Line maintenance is spelled out.

## System menu

**Menu**, or Esc when nothing else is open, holds the clock and opens the system sheet. The field stays visible. Settings and save/load are only here.

- Resume
- Save
- Load
- Settings
  - Game — sound, graphics, hints, tip chips, back to title
  - Controls — rebinding
- Quit to title

## Build bar

Bottom toolbar, then a named sub-tab row, then a thumbnail grid. Click the category again to close the tray. **Select** leaves stamp mode. **Facing east–west / north–south** rotates the stamp. There is no Late category. Locked stamps stay in their sub-tab, greyed, with a padlock. The hover card (about 400 ms) shows price, upkeep, capacity, and noise, and names the exact gate: a field level, a research node, or both. Open on that card jumps to Field Levels or that node on the research desk. The bag belt and the guard post appear once.

| Category | Sub-tabs |
| --- | --- |
| Airfield | Runways, Taxiways, Stands, Tower. Remote bay / Jetway gate toggles sit on the toolbar. |
| Terminal | Halls, Processing, Gates, Movers. Check-in, security, and gates open the hall kit. |
| Airside Ops | Fuel, GSE/Catering, Bags/Cargo, Hangars/MRO. |
| Safety & Security | Stations (fire, police, guard post). |
| Landside | Roads, Parking, Transit, Hotels. Short-term / Long-term toggles sit on the toolbar. |
| Retail & Comfort | Food, Shops, Lounges, Decor. Food, shops, lounges, and decor open the hall kit. |
| Tools | Edit (bulldoze, refunds 40%). |

## Manage bar

Five menus, one submenu each. The second click on an open sub-tab closes the panel. The Money button also shows the cash figure.

- **Money** — Overview, Income, Expenses, Loans, Charts, Fees, Payroll, Commercial. Fees are the commercial prices (landing, passenger, both aircraft-parking rates, and the rest). Payroll is the old budget desk: hiring, the guard agreement, and the operations sliders. Commercial is shop bids, campaigns, and the awards tab inside that desk. A year report appears here only while one is waiting.
- **Airlines** — Roster, Letters, Hubs, Rival, Negotiation.
- **Operations** — Planner, Stands, Services, Premium.
- **People** — Staff, Commute, Morale, Thoughts. Thoughts lists the passenger icons currently on the field.
- **Growth** — Research tree (the desk, lab rooms, and the passenger / cargo / efficiency / prestige branches), Field Levels, Specializations, Achievements. Achievements also lists yearly awards.

## Offers, letters, and goals

- **Inbound offer** — traffic or priority card (`inbound-offer`). Accept or Refuse. On a desktop the same letters also land on the phone, and the card shifts right while the handset is open so both stay clickable.
- **Letters** — contract, layover, hub, maintenance, security, and emergency cards on the left. A card with no countdown is marked Note. Emergencies and threats stay on this stack. The phone never receives them.
- **Diplomacy letters** — airline proposals with accept, counter, and decline
- **Goals** — field goals beside the apron, from the feedback layer
- **Coach** — first-hour steps. Got it dismisses the card
- **Tip chips** — one-time notes near cash, the build tray, or a tile. Dismiss with ×
- **Alerts** — bottom-right dock (`alert-dock`), above the build bar. Only Critical and Warning. Click a card to jump the camera to the problem. Pan to problem, Apply fix, Ignore, and Dismiss stay on the card and do not move the camera by themselves. Info notes are not stacked.
- **Hints** — hint list, mute, and the starter-kit hint
- **Year report** — card on the field, and again under Money → Commercial while it is open
- **Negotiation** — offer and counter sheet when a deal is on the table
- **Achievements** — toast when one unlocks
- **Debug** — recovery count, dev builds only

## Info views

Chips under the top bar. Each opens a short readout. Fuel farm, Maintenance, and Night hub appear when those buildings exist. Connections and Links appear from field level 3.

- Security
- Lost passengers
- Bags
- Shops
- Connections
- Links (repair offer when a link is down)
- Power
- Fuel farm
- Maintenance
- Night hub
- Show passenger flows

## Terminal interior

Airport / Terminal, or a hall button, opens the hall. The kit bar:

| Tab | What it places |
| --- | --- |
| Commercial | Fast food, café, restaurant, newsagent |
| Rooms | Bag drop, security scanner, wall, check-in belt, small security, toilet, wayfinding, bag system |
| Seating | Bench, seat row |
| Decor | Planter, art, flight screen, departures wall, gate sign, info kiosk, water feature |
| Links | Moving walkway |
| Service | Trash can |

Move and Bulldoze sit beside the tabs. A hover tooltip names the item, the price, and whether the cell accepts it. Esc cancels the stamp.

## Tooltips

- Build stamps: a hover card after about 400 ms with price, upkeep, capacity, and noise. A locked stamp names the field level or the research node and links to it.
- Stamp cursor tooltip on the apron: site name and build progress
- Kit tooltip in the hall
- Button `title` attributes on speed, fees, cash, and menu groups

## Next

- **Research-tree node UI.** The Research tree tab is still the desk list. The follow-up is the node graph: cost badges, prerequisite lines, locked / available / owned, and a Research button on a detail card.
- **Building info panel.** Clicking a placed building should open a docked panel on the left (upkeep, efficiency, staff, a capacity bar, KPIs) with an upgrades tray at the bottom. That panel is not built yet.
