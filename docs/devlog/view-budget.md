# View budget and the roof beat

Airport view keeps full aircraft and vehicle meshes at every zoom the player can reach. Terminal view does not draw that scene. The hall uses the same graphics preset as the apron, including its shadow map. Nothing reads frame time to drop LOD, textures, or shadows.

Max-zoom fps is a log only: `[view-budget] max-zoom N fps (reference only)`. Trever reports lag in playtest if the desktop frame rate is short.

## Frame rate

Reference desktop in `docs/PERF_BUDGET.md` is an i7-14700KF and RTX 4070 Super at 1920×1080, 60 fps. This machine is SwiftShader. The number below is not that desktop.

Starter passenger kit, graphics high, apron orbit at distance 280 (the far cap):

**1.9 fps** on SwiftShader. Logged once, and the preset stayed high.

## Stills

Same new game, graphics high.

| | |
| --- | --- |
| Before, max zoom | ![Before](media/view-budget/before-max-zoom.png) |
| After, max zoom | ![After wide](media/view-budget/after-max-zoom.png) |
| After, distance 140 | ![After mid](media/view-budget/after-mid-zoom.png) |

Distance 140 used to sit in the cheap aircraft band. The fuselage, gear, and engines stay on the full mesh there. The cheap silhouette only replaces the body past 8000 world units, which the orbit never reaches. Vehicles use that same distance.

| Entering | Leaving |
| --- | --- |
| ![Roof sections lifting](media/view-budget/transition-enter.png) | ![Walls down, roof dropping](media/view-budget/transition-leave.png) |

Entering lifts the roof in four sections while the camera dollies in. Walls stay up. Leaving drops those roof sections and snaps the walls up from the slab. The beat is 1.25s. A click or key after a short grace skips it. The sim view changes when the beat ends. `setView` is still immediate for tests, bots, and saves.

Terminal view after the beat, with the hall shadow map on: ![Hall](media/view-budget/after-hall.png)

Clip: [transition.webm](media/view-budget/transition.webm)
