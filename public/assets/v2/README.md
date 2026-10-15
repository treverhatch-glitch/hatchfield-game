# Asset pack v2 (binaries live on Drive)

The GitHub connector used by the Grok assets worker can only commit text, so most of the raster pack is not in git yet. The Batch 11 wayfinding banners and pictogram tiles are committed under `signage/`.

1. Download `hatchfield_assets_v2.zip` from the Hatchfield Drive assets folder.
2. Copy the zip's `pack/*` into this folder (`public/assets/v2/`).
3. Run `npm test`. `src/assets/manifestV2.test.ts` then checks every WebP and PNG path.

The generators (`pbr.py`, `art.py`, `sheet.py`) are in the zip and are deterministic.

The Drive copy checked on 13 Oct is `hatchfield_assets_v2.zip` (about 39 MB, file id `1A5Rf5VM6hVneGVe-lGji1oUYrN7Sv5RL`). The Drive connector used here stops at 10 MB, and the file is not public, so the rasters are not in git yet. The manifest test skips until `textures/` exists. If the unpacked pack is large, commit the WebP files and leave the PNG twins out.
