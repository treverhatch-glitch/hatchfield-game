# Turnaround sockets

Service locks read **world positions** from these empty objects. A replacement mesh keeps the same names; the animation does not store its own offsets.

Axes:

- Vehicles: `+X` forward, `+Y` up, `+Z` right. `dock` is the nose reference on every vehicle.
- Crew rig: feet at `y = 0`, facing `+Z` (the shared body).
- Aircraft: `+X` nose, `+Y` up, `+Z` port. Sockets sit on the aircraft in metres, under the same scale as the airframe.

Lock tolerance is **5 cm**. The hose is a catenary between `hose_reel_out` and `hose_nozzle`.

## Names

| Socket | Lives on | Locks to |
| --- | --- | --- |
| `dock` | every vehicle | nose reference, not a service lock |
| `hose_reel_out` | fuel tanker (and any truck with a hose) | reel end of the hose |
| `hose_nozzle` | the nozzle prop | `crew_hand_r` while carried, `plane_fuel_port` while fueling, then back to `hose_reel_out` |
| `crew_hand_r` | crew rig | carries the nozzle |
| `crew_hand_l` | crew rig | free hand |
| `belt_tip` | belt loader | `plane_cargo_door_fwd` |
| `catering_lip` | catering hi-lift | `catering_door` |
| `stairs_top` | stairs | `plane_pax_door` |
| `tug_hitch` | pushback tug | `plane_nose_gear` |
| `plane_fuel_port` | aircraft, under the wing on the port side | fuel nozzle |
| `plane_cargo_door_fwd` | aircraft, forward cargo door | belt tip |
| `catering_door` | aircraft, service door | catering lip |
| `plane_pax_door` | aircraft, forward passenger door | stair top |
| `plane_nose_gear` | aircraft | tug hitch |

Door sockets come from the airframe's own door stations. A freighter with no passenger door uses the crew door so `plane_pax_door` still exists.

## Turn order

`approach` → `align` → `carry_hose` → `fuel` → `stow_hose` → `dock_belt` → `dock_catering` → `dock_stairs` → `hitch_tug` → `depart`

Stand sizes use `e175` (S), `b738` (M) and `a380` (L).
