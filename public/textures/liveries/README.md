# Airline livery plates

Full-resolution originals live in `assets/liveries/<id>/` and are not served.
`scripts/build-liveries.py` writes the browser copies here. High-res is the
default file. `med/` and `low/` are the only smaller copies. The game picks
one with `localStorage['hatchfield-texture-quality']` (`low`, `med`, or
`high`). Anything else, including a missing key, stays on high.

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
those plates off the boot fetch. The five base carriers have a logo only.

Three.js flips Y, so the **top row of the JPEG is V = 1**. The plates are
opaque. Nose is on the left of `fuselage.jpg` and the crown is the top.
`tail.jpg` has the leading edge on the left and the tip at the top. A word
reads on the port side and is mirrored on the starboard side.

High plates keep the crop's own pixels, up to 4096 on the long side. Med is 640, low is 320. Those two folders are the only downscale.
