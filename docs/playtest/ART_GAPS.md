# Art gaps after the P1 landing pack

Objects that still draw as a flat colour, a shared generic plate, or a coloured box. Generate one file per row. Black background on sprite sheets (same treatment as `tree_sprites` / `bush_sprites`). Seamless tiles should tile. Elevations and vehicle sides should not.

Already in the store and wired, so do not regenerate: runway paint, wet asphalt, threshold bars, dirt shoulder, spring grass, autumn grass, farmland, snow grass / apron / asphalt, river, tree and bush sheets, dawn / noon / dusk / night / overcast / storm skies, the noon HDRI hint (lighting only), terminal elevation, hotel elevation, queue tape, carousel belt, chainlink, window glow, apron flood glow, and the nav-light sprite sheet.

People reference sheets already live in `assets/people/originals/` (`pax_*`, `crew_*`, `luggage_set.jpg`, `pax_body_atlas.jpg`). The figures in the hall and on the apron are still solid-colour primitives. Those sheets are not sampled onto the mesh. A new file is only useful if you want a wrap that fits the primitive (see the people row).

## Terrain

| Object | Where it appears | Asset |
| --- | --- | --- |
| Summer grass | Field outside the apron, summer season. Spring plate is reused. | Seamless texture, 2048×2048 |
| Snowy trees | Tree cards around the field in winter. The green sheet stays up. | Sprite sheet, 2752×1536, 2×2 on black |
| Snowy bushes | Bush cards in winter. Same green sheet. | Sprite sheet, 2752×1536, 2×2 on black |

## Exterior buildings

These use a shared warehouse, glass, or dock plate, or a flat colour. A dedicated elevation replaces that.

| Object | Where it appears | Asset |
| --- | --- | --- |
| Police station | Landside police tile | Elevation, 2048×2048, front of a small station |
| Guard booth | Airside guard tile | Elevation, 1024×1024 |
| Snack kiosk | Landside snack tile | Elevation, 1024×1024, small food stand |
| Catering kitchen | Airside kitchen tile | Elevation, 2048×1024, loading doors |
| Parking garage | Park tiles (surface, long, garage, underground) | Concrete elevation, 2048×1024, open decks |
| Ground-services depot | Depot tile | Elevation, 2048×1024, workshop doors |
| Transit station | Bus, taxi rank, rail, transfer bus | Elevation, 2048×1024, canopy and platform |
| Hotel plinth | Airport hotel (`late_hotel`) base | Seamless concrete, 1024×1024 |
| Hotel cornice band | Blue band on the airport hotel tower | Seamless trim, 1024×256 |
| Hotel penthouse | Box on top of the airport hotel | Elevation, 1024×1024 |
| Rail scaffold posts | Rail link while it is under construction | Timber or steel post texture, 512×1024 |
| Windsock | De-ice pad | Sprite, 512×512, orange sock on black |
| Roof HVAC boxes | Terminal roof | Photo of a rooftop unit, 1024×1024 |

## Vehicles

Every service vehicle is a rounded box with a shared yellow, white, or red paint tile (`gse_yellow_paint`, `truck_white_panel`, `diamond_plate`). Each row needs its own side elevation so the box can carry a real silhouette. Length × height is the in-game size; the image can be 2048×1024 with the vehicle filling the frame, facing left, ground along the bottom.

| Object | Where it appears | Asset |
| --- | --- | --- |
| Fuel tanker | Apron, fuel stand | Side elevation, 2048×1024 (10 × 3.2 m) |
| Hydrant cart | Apron, hydrant stand | Side elevation, 2048×1024 (6.2 × 2.5 m) |
| Baggage train | Apron, bag tug plus carts | Side elevation, 2048×1024 (9.6 × 1.9 m) |
| Baggage cart | Apron, behind the tug | Side elevation, 1024×1024 (3.0 × 1.7 m) |
| Belt loader | Apron, at the hold | Side elevation, 2048×1024 (7.6 × 2.4 m) |
| Catering hi-lift | Apron, at the galley door | Side elevation, 2048×1024 (8.6 × 3.7 m) |
| ARFF | Fire station apron | Side elevation, 2048×1024 (12 × 3.6 m) |
| De-ice truck | De-ice pad and stands | Side elevation, 2048×1024 (9.2 × 3.5 m) |
| Apron bus | Terminal to stand | Side elevation, 2048×1024 (14 × 3.1 m) |
| Coach | Landside curb | Side elevation, 2048×1024 (12.4 × 3.6 m) |
| Box truck | Landside cargo | Side elevation, 2048×1024 (8.5 × 3.4 m) |
| Van | Default landside vehicle | Side elevation, 2048×1024 (6 × 2.6 m) |
| Towbar tug | Apron pushback | Side elevation, 2048×1024 (6 × 1.6 m) |
| Towbarless tug | Apron, heavy pushback | Side elevation, 2048×1024 (7.8 × 1.7 m) |
| GPU | Stand, beside the nose | Side elevation, 1024×1024 (3.4 × 1.7 m) |
| Passenger stairs | Remote stand | Side elevation, 2048×1024 (7.4 × 3.6 m) |
| K-loader | Cargo stand | Side elevation, 2048×1024 (9 × 2.5 m) |
| ULD dolly | Cargo apron | Side elevation, 1024×512 (3.4 × 0.75 m) |
| Lavatory truck | Stand, rear service | Side elevation, 2048×1024 (7.2 × 2.8 m) |
| Water truck | Stand, rear service | Side elevation, 2048×1024 (7.0 × 2.7 m) |
| Police car | Landside and airside roads | Side elevation, 2048×1024 (4.9 × 1.65 m) |

## Terminal interior

| Object | Where it appears | Asset |
| --- | --- | --- |
| Duty-free bottles | Duty-free shelves and gondolas | Product sprite sheet, 1024×1024, 2×2 on black |
| Shelf goods (gold, plum, blue, cream boxes) | Duty-free and newsagent shelves | Product sprite sheet, 1024×1024, 2×2 on black |
| Burger bun | Grill and food-court counters | Sprite, 512×512, on black |
| Coffee cup | Coffee bar and food court | Sprite, 512×512, on black |
| Seat fabric | Gate seats, lounge chairs | Seamless fabric, 1024×1024, one blue and one grey |
| Lounge leather | Lounge cluster | Seamless leather, 1024×1024 |
| Carry-on bags | Carousel, queues, seats | Sprite sheet, 1024×1024, 2×2 on black. `luggage_set.jpg` exists and is not mapped; replace it only if that sheet is the wrong crop. |
| Pot plant | Planters in the hall | Sprite, 512×1024, on black |
| Restroom porcelain | Toilets (basin, bowl) | Photo, 1024×1024, white fixture on a neutral ground |
| Jet-bridge bellows | Jet bridge to the aircraft | Seamless rubber concertina, 1024×512 |
| Passenger and staff body | Hall crowd and apron crew. Mesh is a solid-colour primitive. Reference sheets already exist. | Wrap atlas, 2048×2048, front and side of one standing figure, only if `pax_body_atlas.jpg` is the wrong layout |
