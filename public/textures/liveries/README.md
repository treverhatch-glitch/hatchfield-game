# Airline livery strips

Drop PNGs here when the art is ready. List the airline id in `manifest.json`
(`["northline", "crown"]`). Airlines that are absent keep the procedural paint.

```
public/textures/liveries/<airline>/fuselage.png
public/textures/liveries/<airline>/tail.png
public/textures/liveries/<airline>/engine.png
```

Airline ids match the catalog: `bushline`, `northline`, `harbor`, `summit`,
`crown`, `umazon`, `upps`, `exfed`.

Three.js flips the image, so the **top row of the PNG is V = 1**. Opaque pixels
replace the procedural colour. Transparent pixels leave it.

| File | Pixels | U (left → right) | V (bottom → top) |
| --- | --- | --- | --- |
| `fuselage.png` | 1024×256 (4:1) | nose → tail | belly → crown |
| `tail.png` | 512×512 | leading edge → trailing edge | root → tip |
| `engine.png` | 512×128 (4:1) | around the cowling, seam at the bottom | intake → exhaust |

The fuselage strip is a flat side elevation, mapped the same way on both sides
(not mirrored). Horizontal bands and window rows line up. A word in the strip
reads on the port side and is mirrored on the starboard side, so keep titles
symmetric or put the mark in `tail.png`. The nose tip sits near the vertical
middle of the strip; the crown is the top edge.

`engine.png` is the unwrapped barrel. A horizontal stripe becomes a band around
the cowling. The intake lip, nozzle and pylon stay bare metal.

The maps bind on the mid and far shells (the airframe you see from the apron).
Close-up doors and fan blades stay procedural.
