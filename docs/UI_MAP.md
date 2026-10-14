# Hatchfield UI map

Player-facing surfaces, as they sit after the integrity pass. The build trays and the bottom-bar tree are the arrays in `src/ui/uiCatalog.ts`. A headless walk of every tab and submenu lives in `src/ui/menuIntegrity.e2e.test.ts`.

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
- HATCH price — only after listing; opens Economy
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

## Fees

Corner toggle **Fees**. Commercial prices: landing, passenger, aircraft parking per hour, aircraft parking per day, fuel markup, catering, bags, cleaning, de-icing, pushback, ground power, lavatory and water, reduced-mobility assistance, cargo, helicopter landing, car parks, hotel. Deposit tier on the next signature. Close returns to the field.

## Pause

**Menu** opens a side sheet. The field stays visible and the clock waits.

- Resume
- Save
- Load
- Settings
  - Game — sound, graphics, hints, tip chips, back to title
  - Controls — rebinding
- Quit to title

## Build bar

Pick a category, then a stamp. Click the category again to close the tray. **Select** leaves stamp mode. **Facing east–west / north–south** rotates the stamp.

| Category | Stamps |
| --- | --- |
| Pavement | Short runway, Runway, Heavy runway, Taxiway, Access road, Helipad, De-ice pad |
| Stands | Small stand, Medium stand, Wide stand, Jumbo stand. Remote bay / Jetway gate toggles sit on this category. |
| Terminal | Premade hall, Terminal shell, Terminal bus depot, People mover, Transfer bus, Skywalk, Travelator, Pier skywalk, Pier mover. Later halls (Prefab II, Check-in hall, Security hall, Concourse, Pier II, Satellite) join this tray as the field levels. |
| Operations | Fuel farm, Fuel rail, Oil station, SAF blending, Catering kitchen, Vehicle depot, Bag sort, Bag belt, Fire station, Police post, Cargo shed, Guard post, Control tower, Line hangar, Wide hangar, Jumbo hangar, Maintenance hangar, Cargo night hub. Later ops (Substation, Hydrant pit, Tilt-tray sort, Fuel farm III, ATC approach, Remote screening) join this tray. |
| Commercial | Snack bar, Airport inn, Business hotel, Airport resort, Airport hotel |
| Landside | Small lot, Large lot, Parking garage, Underground park, Bus curb, Rail station, Rail link station. Short-term / Long-term toggles sit on this category. Prestige landmark joins this tray. |
| Bulldoze | Bulldoze (refunds 40%) |

Fuel, the fuel rail, the oil station, and SAF blending are operations. The snack bar and the hotels are commercial. The bag belt and the guard post are operations only — they are not repeated under Terminal or Landside.

## Bottom bar

Speed: Pause, 1×, 3×, 5×. Airport / Terminal switches the view. The ticker is recent announcements.

Info buttons open one side panel. A group opens a submenu first; the second click on an open item closes the panel.

- **Economy** (cash chip) — Overview, Income, Expenses, Loans, Charts. Cash, parcels, loans, maintenance contract, rail, car parks, hotel buy, HATCH exchange.
- **Operations**
  - Services — fuel desk, catering desk, power, bags, vehicles, hall operations rooms (check-in, security, gate hold, bag claim, bag drop, restrooms), scrub
  - Planner — selected flight and the flight planner. Phone copy points here when nobody has signed.
- **Commercial**
  - Shops — tenant bids, plus hall shops (hall food, souvenirs, lounge, indoor golf, waterfall court, gaming den, airside day rooms, massage spa, airside pool)
  - Premium — premium check-in, fast-track, VIP room
  - Campaigns — paid advertising
  - Awards — yearly awards
  - Year report — only while a year report is waiting
- **Management**
  - Staff — commute, housing, crew morale
  - Budget — operations payroll, mechanic / janitor / desk hiring, military host agreement, maintenance / security / cleaning / fire / ambulance sliders
- **R&D**
  - Research — research points, hire researcher, lab rooms (research desk, chalkboard, lab bench), unlocks
  - Branches — passenger, cargo, efficiency, and prestige research, plus the carrier card
  - Specializations — hub, low-cost, cargo, and luxury trees
- **Airlines** — standing desk (Standing, Contract, Demand, Fees, Contact, Rivals) and contracts
- **Rival** — Bellwater Intl fees, roster, catchment
- **Settings** — Game, Controls (same pages as the pause sheet)

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
