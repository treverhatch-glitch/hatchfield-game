# Asset pack v2 (binaries live on Drive)

The GitHub connector used by the Grok assets worker can only commit text, so the raster pack is not in git yet.

1. Download `hatchfield_assets_v2.zip` from the Hatchfield Drive assets folder.
2. Copy the zip's `pack/*` into this folder (`public/assets/v2/`).
3. Run `npm test`. `src/assets/manifestV2.test.ts` then checks every WebP and PNG path.

The generators (`pbr.py`, `art.py`, `sheet.py`) are in the zip and are deterministic.
