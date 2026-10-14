# Turnaround sockets

Service locks and travelling items read **world positions** from these empty objects. A replacement mesh keeps the same names; animation and handoffs do not store their own offsets.

Axes:

- Vehicles: `+X` forward, `+Y` up, `+Z` right. `dock` is the nose reference on every vehicle.
- Crew rig: feet at `y = 0`, facing `+Z` (the shared body).
- Aircraft: `+X` nose, `+Y` up, `+Z` port. Sockets sit on the aircraft in metres, under the same scale as the airframe.
- Check-in, the carousel and the apron bridge prop are in metres, in the prop's own frame.
- The fuel-farm **tile** socket is in that tile's units. The handoff rig uses the same name in metres.

Lock tolerance is **5 cm**. A moving item may hop at most **40 cm** between samples. Anything longer is a teleport. The hose is a catenary between its two end sockets, and it stays above the ground.

## Names

| Socket | Lives on | Locks to |
| --- | --- | --- |
| `dock` | every vehicle | nose reference, not a service lock |
| `hose_reel_out` | fuel tanker, lavatory truck, water truck (any truck with a hose) | reel end of the hose |
| `hose_nozzle` | the nozzle prop | `crew_hand_r` while carried, `plane_fuel_port` while fueling, then back to `hose_reel_out` |
| `truck_fill` | fuel tanker | farm coupler while the truck is being filled |
| `farm_fill` | fuel farm | farm end of the fill hose |
| `farm_bay` | fuel farm rig | where `truck_fill` stops |
| `crew_hand_r` | crew rig | carries the nozzle |
| `crew_hand_l` | crew rig | free hand |
| `belt_low` | belt loader | low end of the belt, where a bag comes off the cart |
| `belt_tip` | belt loader | `plane_cargo_door_fwd` |
| `catering_lip` | catering hi-lift | `catering_door` |
| `cart_slot` | catering hi-lift | catering cart while it is still on the truck |
| `stairs_top` | stairs | `plane_pax_door` |
| `stairs_foot` | stairs | bottom of the flight, on the ground side |
| `tug_hitch` | pushback tug | `plane_nose_gear` |
| `cart_bed` | bag cart and baggage train | a suitcase |
| `cart_hitch` | bag cart | tow |
| `train_hitch` | baggage train | drawbar |
| `dolly_deck` | ULD dolly | a ULD |
| `dolly_hitch` | ULD dolly | tow |
| `loader_deck` | cargo loader | a ULD before the hold |
| `lav_nozzle` | lavatory truck | hose end at full pay-out; locks toward `plane_lav_port` |
| `water_nozzle` | water truck | hose end at full pay-out; locks toward `plane_water_port` |
| `cable_reel_out` | GPU cart | reel end of the power cable |
| `gpu_plug` | GPU cart | plug at full pay-out; locks toward `plane_gpu_port` |
| `deice_nozzle` | de-icer | spray nozzle in the basket |
| `foam_nozzle` | ARFF | roof monitor |
| `patrol_door` | police car | driver's door |
| `clean_door` | cleaning van | side door |
| `plane_fuel_port` | aircraft, under the wing on the port side | fuel nozzle |
| `plane_cargo_door_fwd` | aircraft, forward cargo door | belt tip |
| `plane_hold` | aircraft, inside that door | a bag or a ULD |
| `catering_door` | aircraft, service door | catering lip |
| `galley_slot` | aircraft, inside the service door | catering cart |
| `plane_pax_door` | aircraft, forward passenger door | stair top |
| `plane_pax_sill` | aircraft, floor of that door | a passenger's feet |
| `plane_nose_gear` | aircraft | tug hitch |
| `plane_lav_port` | aircraft, aft lower fuselage, starboard | lavatory nozzle |
| `plane_water_port` | aircraft, aft lower fuselage, starboard | water nozzle |
| `plane_gpu_port` | aircraft, lower nose | GPU plug |
| `bridge_cab` | jet bridge | mouth at the door |
| `bridge_hall` | jet bridge | terminal end of the tunnel |
| `desk_drop` | check-in desk | a bag on the weigh belt |
| `belt_in` | check-in | where the desk feeds the collector |
| `belt_out` | check-in row | curtain end of the collector |
| `makeup_stop` | check-in row | `cart_bed` while the cart is loaded |
| `carousel_feed` | claim carousel | bags entering from the back |
| `carousel_lip` | claim carousel | a bag on the public run |
| `claim_stop` | claim carousel | `cart_bed` at the claim |
| `bag_rest` | suitcase | the station socket it is sitting on |
| `bag_grip` | suitcase | handle |
| `uld_lock` | ULD | dolly, loader or hold |
| `cart_deck` | catering cart | truck, lip or galley |
| `counter_restock` | food counter, shop counter | crate while it is being shelved |
| `stores_dock` | back-of-house dock | stores cart while it is loading |
| `pax_feet` | passenger | bridge or door sill |
| `coupler_jaw` | fuel coupler | `farm_fill`, then `truck_fill` |

Door sockets come from the airframe's own door stations. A freighter with no passenger door uses the crew door so `plane_pax_door` still exists. Passenger doors prefer the port side, which is the bridge side.

## Turn order

`approach` → `align` → `carry_hose` → `fuel` → `stow_hose` → `dock_belt` → `dock_catering` → `dock_stairs` → `hitch_tug` → `depart`

Stand sizes use `e175` (S), `b738` (M) and `a380` (L).

## Handoffs

Each item is parented to one socket, then walked to the next in steps of at most 40 cm. It is never left loose above the ground.

Bag, check-in to the hold and back to the carousel:

`check_in` (`desk_drop`) → `onto_belt` (`belt_in`) → `along_belt` (`belt_out`) → `onto_cart` (`cart_bed`) → `cart_to_stand` → `onto_loader` (`belt_low`) → `up_to_hold` (`belt_tip`) → `in_hold` (`plane_hold`) → `out_of_hold` → `down_loader` → `onto_cart_return` → `cart_to_claim` → `onto_carousel` (`carousel_lip`)

ULD: `dolly_deck` → `loader_deck` → `plane_hold`

Catering cart: `cart_slot` → `catering_lip` → `galley_slot`

Passengers, then the return:

`bridge_hall` → `bridge_cab` → `plane_pax_sill` → `bridge_cab` → `bridge_hall`

Fuel farm: the coupler waits on `farm_fill`, the truck stops with `truck_fill` on `farm_bay`, the coupler follows a catenary onto `truck_fill`, and it leaves with the truck.
