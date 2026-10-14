# Turnaround reference: what overlaps in real life

Hatchfield rule (Trever): ground services overlap like a real turn and don't queue up behind deplaning.
Taken from the manufacturer turn charts (Boeing ACAPS §5.2 "Terminal Operations – Turnaround Station",
Airbus AC §5-2-0 "Full Servicing Turn Round Time Chart") plus ramp write-ups. The times are typical for a full-service turn at a jet bridge, in minutes.

| Task | Start trigger (real life) | Must finish before | Narrow (737-800 / A320) | Wide (787 / A350) | Very large (777 / A380) | In sim |
|---|---|---|---|---|---|---|
| Chocks, GPU/PCA, bridge on | Block-in | Pushback | 2–4 | 3–5 | 3–6 | `gpu` at block-in |
| Deplaning | Door open (~2–3 min after block-in) | Cleaning | 7–10 | 12–15 | 15–20 (3 doors on A380) | `deplane` |
| Bag / cargo unload | Block-in (holds are separate from the cabin) | Bag / cargo load | 10–12 | 15–25 (ULDs) | 20–30 | `bag_unload` / `cargo_unload` at 0 |
| Lav (waste) service | Block-in, from the external aft panel, **during deplaning** | Door close | 5–10 | 10–15 | 15–20 | **`lav` now at block-in** |
| Potable water | Block-in, from the external panel, **during deplaning** | Door close | 5–10 | 10–15 | 15–20 | **`water` now at block-in** |
| Catering | Once deplaning is under way, on the service-side doors (R2/R4, upper deck on the A380) | Boarding | 10–15 | 20–30 | 25–40 | **`catering` now starts with deplaning** |
| Fueling | After deplaning; or with passengers on board **only with fire/rescue cover or an attendant at a door with stairs/bridge, seatbelt sign off and No Smoking on** | Door close | 12–20 | 20–35 | 30–45 (2 points) | `fuel`, overlap gated by `pax.fuelWithPaxOnBoard` |
| Cabin cleaning | Last passenger off | Boarding | 6–12 | 15–25 | 20–30 | `cleaning` after `deplane` |
| Boarding | Cleaning and catering done (and fueling, unless fueling with pax is allowed) | Door close | 12–15 | 20–30 | 30–40 | `boarding` |
| Bag / cargo load | Hold empty (the unload is done) | Door close | 10–15 | 15–25 | 20–30 | `bag_load` / `cargo_load` |
| Door close, bridge off | Boarding and loading done, servicing trucks clear | Pushback | 2–4 | 3–5 | 3–5 | `door_close` (now also waits on lav and water) |
| Pushback | Doors closed, stand clear | — | 3–5 | 5–8 | 5–8 | `pushback` |

Totals for comparison: A320 full-service turn is about 35–45 min (Airbus). A 737-800 is about 40–45 min (Boeing). The 787 and A350 run about 60–90 min, and the 777 and A380 about 90–140 min.

## Sources
- Boeing plan manuals index: https://www.boeing.com/commercial/airports/plan-manuals
- Boeing 737NG ACAPS Rev C, §5.1 and §5.2: https://www.boeing.com/content/dam/boeing/v2/airports/acaps/737NG_REV_C.pdf
- Boeing 787 and 777 ACAPS, §5.2 (same index above)
- Airbus A320 AC, §5-2-0 turn chart, §5-4-9 potable water, §5-4-10 waste: https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2025-01/AC_A320_0624.pdf
- Airbus A350 and A380 AC, §5-2-0 (Airbus aircraft characteristics library: https://aircraft.airbus.com/en/customer-care/fleet-wide-care/airport-operations-and-technical-data/aircraft-characteristics)
- Narrowbody ramp sequence (deplaning, unloading and water at the same time; then fuel, catering and cleaning; then boarding and loading): https://simpleflying.com/narrowbody-jets-ramp-activity-turnaround-time-guide/
- Observed A319 turn (waste service during deboarding): https://simpleflying.com/narrowbody-turnaround-times-time-differences-guide/
