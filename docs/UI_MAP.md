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
- Field level
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

Pick a category, then a stamp. Click the category again to close the tray. **Select** leaves stamp mode. **Facing east–west / north–south** rotates the stamp. There is no Late category. SAF blending, the airport hotel, and the rail link sit in their real trays with a Field level badge until they unlock. The bag belt and the guard post appear once.

| Category | What it holds |
| --- | --- |
| Airfield | Runways, taxiway, stands, helipad, de-icing, tower. Remote bay / Jetway gate toggles sit here. Later: jet bridge, Code E, Code F, triple jet bridge, ATC approach. |
| Terminal | Halls, bag belt, walkways, people mover, terminal bus, transfer bus. Check-in, security, and gates open the hall kit. Later halls: Prefab II, check-in hall, security hall, concourse, Pier II, satellite, remote screening. |
| Airside Ops | Fuel, fuel rail, oil, SAF blending, ground-vehicle depot, catering, baggage hall, cargo, hangars, maintenance hangar, night hub. Later: hydrant, substation, tilt-tray sort, fuel farm III. |
| Safety & Security | Fire station, police post, guard post. |
| Landside | Roads, parking, bus, rail, rail link, hotels. Short-term / Long-term toggles sit here. |
| Retail & Comfort | Snack bar, plus Food, Shops, Lounges, and Decor, which open the hall kit. Prestige landmark joins this tray. |
| Tools | Bulldoze (refunds 40%). |

## Manage bar

Five menus, one submenu each. The second click on an open sub-tab closes the panel. The Money button also shows the cash figure.

- **Money** — Overview, Income, Expenses, Loans, Charts, Fees, Payroll. Fees are the commercial prices (landing, passenger, both aircraft-parking rates, and the rest). Payroll is the old budget desk: hiring, the guard agreement, and the operations sliders.
- **Airlines** — Roster, Letters, Hubs, Rival, Negotiation.
- **Operations** — Planner, Stands, Services, Premium.
- **People** — Staff, Commute, Morale, Thoughts. Thoughts lists the passenger icons currently on the field.
- **Growth** — Research (desk, lab rooms, and the passenger / cargo / efficiency / prestige branches), Specializations, Commercial (shop bids and campaigns), Awards, Achievements. A year report appears here only while one is waiting.

## Offers, letters, and goals

- **Inbound offer** — traffic or priority card (`inbound-offer`). Accept or Refuse. On a desktop the same letters also land on the phone, and the card shifts right while the handset is open so both stay clickable.
- **Letters** — contract, layover, hub, maintenance, security, and emergency cards on the left. A card with no countdown is marked Note.
- **Diplomacy letters** — airline proposals with accept, counter, and decline
- **Goals** — field goals beside the apron, from the feedback layer
- **Coach** — first-hour steps. Got it dismisses the card
- **Tip chips** — one-time notes near cash, the build tray, or a tile. Dismiss with ×
- **Alerts** — stack with pan, fix, ignore, dismiss
- **Hints** — hint list, mute, and the starter-kit hint
- **Year report** — card on the field, and again under Commercial while it is open
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

- Build-tray titles: blurb, price, daily upkeep, or the field-level lock
- Stamp cursor tooltip on the apron: site name and build progress
- Kit tooltip in the hall
- Button `title` attributes on speed, fees, cash, and menu groups
