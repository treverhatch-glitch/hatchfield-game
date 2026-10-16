# Airline livery plates

`assets/liveries/<id>/{fuselage,tail}.jpg` are the uncropped source photos
(1280×720 fuselage, 960×960 tail). They are not a UV layout, so the game does
not sample them directly. `scripts/build-liveries.py` crops each one onto the
fuselage and tail plates and writes the browser copies here. High-res is the
default file and keeps the crop's own pixels, up to 4096 on the long side.
`med/` and `low/` are the only smaller copies. The game picks one with
`localStorage['hatchfield-texture-quality']` (`low`, `med`, or `high`).
Anything else, including a missing key, stays on high.

```
public/textures/liveries/<id>/fuselage.jpg
public/textures/liveries/<id>/tail.jpg
public/textures/liveries/<id>/med/…
public/textures/liveries/<id>/low/…
```

`manifest.json` lists each plate, the catalog ids that wear it, and the solid
engine colour. Engines are not a texture file.

| Airline | Also worn by | Engine |
| --- | --- | --- |
| `bushline_local` | `bushline` | cream `#F5E6C8` |
| `zoomjet` | `zoomjet` | light grey `#D5D8DC` |
| `crown_pacific` | `crown` | gold `#C5A059` |
| `siam_breeze` | — | white `#F7FBFA` |
| `northstar_cargo` | — | yellow `#FFC107` |

Roster carriers with a Gemini ref are added by `scripts/build-roster-liveries.py`.
Each row's `types` are the airframes that carrier flies. `preload: false` keeps
those plates off the boot fetch.

`bushline_local` paints Bushline (`bn2`, `dhc6`). `crown_pacific` paints Crown
(`a380`, `b77w`). `zoomjet` paints Zoomjet when the airframe is `a320neo`,
`b738`, or `b38m`. Zoomjet is a negotiation carrier listed by
`game.allAirlines()` and can be signed. Its contract does not name metal, so
other types in the 180-seat band stay procedural.
`siam_breeze` is the roster carrier Siam Breeze and wears this plate on `a320neo`.
`northstar_cargo` resolves to a plate, and no airline in the catalog, the
roster, or the negotiation book uses that id, so no flight wears it.

The five base roster carriers (Puddle Jumper, SkyCheap, Prestige Air, National
Airways, HeavyLift) stay on procedural paint. Their colours and tail decals
come from `docs/art/livery-concepts/`. See `docs/art/LIVERIES.md`.

Three.js flips Y, so the **top row of the JPEG is V = 1**. The plates are
opaque. Nose is on the left of `fuselage.jpg` and the crown is the top.
`tail.jpg` has the leading edge on the left and the tip at the top. A word
reads on the port side and is mirrored on the starboard side.

High plates keep the crop's own pixels, up to 4096 on the long side. Med is 640, low is 320. Those two folders are the only downscale.
