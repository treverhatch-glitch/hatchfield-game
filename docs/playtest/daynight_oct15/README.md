# Day/night stills — 15 Oct

High quality. Speed is 0 while the frame is taken, so apron floodlight pools stay on.

At 5× the renderer sets lite mode (`speed >= 5`) and turns apron floodlight pools off. Runway edge lights still follow the night factor. These stills were checked at 1× (speed 0, which is not lite). Do not judge the mast pools from a 5× frame.

| File | Clock | Cycle |
| --- | --- | --- |
| dawn.png | 06:36 | On |
| noon.png | 12:00 | On |
| dusk.png | 19:00 | On |
| night.png | 23:00 | On |
| cycle-off.png | 23:00 | Off, held at noon |

Off is the graphics pref `hatchfield-day-night` = `off`. It calls `setDayNight({ hour: 12, daylight: 1, lights: 0 })`. A frozen photo hour still replaces that hold.
