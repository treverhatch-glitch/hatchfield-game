# Player-built halls — staffing

A hall the player built follows the same staffing rule as the prefab.

- A check-in desk or security lane needs someone on that post before it serves.
- A self-serve kiosk, and a bag drop defined with staff 0, runs on its own.
- The starter prefab keeps its bundled crew, so those desks and lanes stay open and nothing bottlenecks at the start.
- A point with nobody on it says `closed: no staff`. The info line and the building card offer a one-click hire.
- An open kiosk counts as an open check-in point, so the abstract check-in node does not wait on a clerk while a kiosk is open.
- While the walk is paused, the building card says `walk paused, estimate`.
- A kiosk serves in 45% of a staffed desk's time. A bag drop stays at desk speed.
