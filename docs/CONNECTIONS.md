# Transfers, layovers and airport hotels

Built on top of the hub layer (`src/hub/`: transfer share, facility MCT 60/45/25, bag sort minutes, missed-connection bill).

## Modules
- `src/connections/` (pure, no sim types): O&D/transfer mix, airside transfer routing, layout MCT, sort-capacity misconnects, layovers, stranded rebooking, daily ledger. Tunables in `config.ts`.
- `src/hotels/` (pure): hotel tiers, links, demand segments, nightly booking. Tunables in `config.ts`.
- `src/game/connectionsBridge.ts`: holds the state for `Game` (save/load, day close, alerts).
- UI: `src/ui/ConnectionsPanel.tsx` (Connections info view), `src/ui/HotelPanel.tsx` (hotels, rates).

## Rules
- **Mix:** the transfer share is the hub layer's (airline type, hub contract, tier, field level). A share of transfers must be re-screened, set per airline type (`TRANSFER_SCREEN_SHARE`).
- **Routing:** arrival gate, then transfer security (only if re-screened), then the departure gate. The transfer lane comes with the Transfer Centre research. Without it, re-screened passengers go out through arrivals and back through main security (`LANDSIDE_RECHECK_MINUTES`). That is the only landside path.
- **MCT:** the published MCT is `max(facility floor, deplane + p85 gate-pair walk + screening)`, rounded up to 5 min. Itineraries are sold on it.
- **Misconnected bags:** sort capacity is bag halls × 420 bags/h, ×1.35 with the Transfer Centre and ×1.6 with RFID. The misconnect rate has a floor of 1.2% (0.4% with RFID) and climbs past 70% utilisation. Each misconnected bag gets an $85 courier bill.
- **Misses:** the hub layer bills them and cuts Standing. This layer adds a reputation hit and rebooks the passenger.
- **Layovers:** a few itineraries are sold on a later flight, and late-bank arrivals may connect the next morning.
  - Short waits seed food, shop and lounge needs.
  - Long waits drain needs faster.
  - Overnight passengers pick a transit hotel, a linked landside hotel, the lounge or a terminal bench, by trait.
- **Stranded:** a cancel within 4 h of the slot, or a delay of 3 h or more that pushes a rotation into the night, strands 60% of its load.
  - Stranded passengers are rebooked on the same airline's later departures (12% spare seats each) before night.
  - The rest get hotel vouchers.
  - Who pays (airline or airport) depends on the cause (`DEFAULT_VOUCHER_TERMS`). Set per-airline terms in `connections.terms`.
- **Hotels:**
  - Landside inn/business/resort stamps are 2★/3★/5★ hotels. The hotel wings count as 3★. Airside day rooms are a 3★ transit hotel.
  - Landside hotels link by walkway (≤ 320 m) or by shuttle (needs a bus curb). Unlinked hotels get no airside guests.
  - Demand comes from layovers, vouchers, crew rest (late arrivals, plus hub crews) and local O&D.
  - Booking order: contracted rooms first, then guests paying their own way, which are price-elastic to the player's rate setting.
  - Room revenue posts at day close. Upkeep is already billed with the building.

Screenshots: `docs/screenshots/connections/` (`scripts/connections-shots.mts`).
