"""Build browser livery plates from the Gemini airline refs.

The 40 roster carriers with a photo in public/art/refs/airlines/ get a fuselage
band and a tail plate, plus a square logo. The five base carriers have no ref,
so they only get a code logo; their airframes stay on the procedural paint.
Plates are limited to the airframes that carrier flies (roster fleet).

Long-side caps match LIVERY_LONG_SIDE in src/render/aircraft/liveryFiles.ts.
High is the default file. med/ and low/ are the only smaller copies.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
REFS = ROOT / 'public' / 'art' / 'refs' / 'airlines'
OUT = ROOT / 'public' / 'textures' / 'liveries'
LOGOS = ROOT / 'public' / 'assets' / 'airline-logos'
MANIFEST = OUT / 'manifest.json'
ROSTER = ROOT / 'src' / 'airlines' / 'roster.ts'
DATA = ROOT / 'src' / 'airlines' / 'data.ts'

# Keep in step with src/render/aircraft/liveryFiles.ts
LONG_SIDE = {'low': 320, 'med': 640, 'high': 1280}
LOGO_SIDE = {'low': 64, 'med': 128, 'high': 256}

GROK_IDS = ('bushline_local', 'zoomjet', 'crown_pacific', 'siam_breeze', 'northstar_cargo')


def parse_pools(text: str) -> dict[str, list[list[str]]]:
    block = text.split('export const FLEET_POOLS', 1)[1].split('const SEEDS', 1)[0]
    pools: dict[str, list[list[str]]] = {}
    for kind, body in re.findall(r'(\w+):\s*\[(.*?)\]\s*,?\s*(?=\w+:|})', block, re.S):
        rows = [re.findall(r"'([^']+)'", row) for row in re.findall(r'\[(.*?)\]', body, re.S)]
        pools[kind] = [row for row in rows if row]
    return pools


def parse_seeds(text: str) -> list[tuple[str, str]]:
    block = text.split('const SEEDS', 1)[1].split('interface BasePaint', 1)[0]
    return re.findall(r"id:\s*'([^']+)'.*?type:\s*'([^']+)'", block, re.S)


def parse_base(text: str) -> list[tuple[str, str, str]]:
    block = text.split('const BASE', 1)[1].split('interface PaletteFile', 1)[0]
    rows = re.findall(
        r"(\w+):\s*\{[^}]*code:\s*'([^']+)'[^}]*primary:\s*'(#[0-9a-fA-F]+)'",
        block,
    )
    return [(aid, code, primary) for aid, code, primary in rows]


def parse_data_fleets(text: str) -> dict[str, list[str]]:
    fleets: dict[str, list[str]] = {}
    for aid, body in re.findall(r"id:\s*'(air_[^']+)'(.*?)(?=id:\s*'air_|$)", text, re.S):
        fleet = re.search(r'fleet:\s*\[(.*?)\]', body, re.S)
        if fleet:
            fleets[aid] = re.findall(r"'([^']+)'", fleet.group(1))
    return fleets


def assign_fleets() -> tuple[list[dict], list[dict]]:
    roster = ROSTER.read_text()
    pools = parse_pools(roster)
    seeds = parse_seeds(roster)
    base_paint = parse_base(roster)
    data_fleets = parse_data_fleets(DATA.read_text())
    palettes = json.loads((REFS / 'palettes.json').read_text())['airlines']
    used = {kind: 0 for kind in pools}
    gemini: list[dict] = []
    for aid, kind in seeds:
        pool = pools[kind]
        fleet = pool[used[kind] % len(pool)]
        used[kind] += 1
        pal = palettes[aid]
        gemini.append({
            'id': aid,
            'engine': pal['primary'],
            'airlines': [aid],
            'types': fleet,
            'preload': False,
            'primary': pal['primary'],
            'secondary': pal.get('secondary', '#f0f0f0'),
        })
    base: list[dict] = []
    for aid, code, primary in base_paint:
        base.append({'id': aid, 'code': code, 'primary': primary, 'fleet': data_fleets[aid]})
    return gemini, base


def remove_bg(im: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    arr = np.asarray(im.convert('RGB'))
    h, w = arr.shape[:2]
    corners = np.stack([arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1], arr[min(2, h - 1), w // 2]])
    bg = np.median(corners, axis=0)
    dist = np.max(np.abs(arr.astype(np.int16) - bg.astype(np.int16)), axis=2)
    near = dist <= 30
    seen = np.zeros((h, w), dtype=bool)
    stack = [(0, x) for x in range(0, w, 3)] + [(h - 1, x) for x in range(0, w, 8)]
    stack += [(y, 0) for y in range(0, h, 8)] + [(y, w - 1) for y in range(0, h, 8)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or not near[y, x]:
            continue
        seen[y, x] = True
        stack.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    return arr, ~seen


def longest_run(idxs: np.ndarray) -> np.ndarray:
    if len(idxs) == 0:
        return idxs
    splits = np.where(np.diff(idxs) > 3)[0]
    parts = np.split(idxs, splits + 1) if len(splits) else [idxs]
    return max(parts, key=len)


def fuselage_rows(mask: np.ndarray) -> tuple[int, int]:
    _h, w = mask.shape
    widths = mask.sum(axis=1)
    rows = np.where(widths >= w * 0.55)[0]
    if len(rows) < 6:
        rows = np.where(widths >= w * 0.4)[0]
    if len(rows) < 4:
        rows = np.where(widths >= w * 0.25)[0]
    run = longest_run(rows)
    if len(run) == 0:
        return 0, mask.shape[0]
    return int(run[0]), int(run[-1]) + 1


def facing_left(mask: np.ndarray, r0: int, r1: int) -> bool:
    """The tail is the end with a fin rising above the fuselage."""
    h, w = mask.shape
    top = np.full(w, h)
    for x in range(w):
        hit = np.where(mask[:, x])[0]
        if len(hit):
            top[x] = hit[0]
    rise = r0 - top
    left = float(rise[: w // 3].max()) if w else 0
    right = float(rise[w * 2 // 3 :].max()) if w else 0
    return right >= left


def fin_crop(col: np.ndarray, mask: np.ndarray, r0: int, r1: int) -> np.ndarray | None:
    h, w = mask.shape
    top = np.full(w, h)
    for x in range(w):
        hit = np.where(mask[:, x])[0]
        if len(hit):
            top[x] = hit[0]
    rise = r0 - top
    cols = np.where((np.arange(w) > w * 0.55) & (rise > max(8, h * 0.1)))[0]
    if len(cols) < 4:
        return None
    part = cols
    splits = np.where(np.diff(cols) > 8)[0]
    if len(splits):
        parts = [p for p in np.split(cols, splits + 1) if len(p) > 3]
        if parts:
            part = parts[-1]
    x0 = max(0, int(part[0]) - 4)
    x1 = min(w, int(part[-1]) + 5)
    # Keep the fin narrow. A wide crop is a wing, not a tail.
    max_w = int((r1 - r0) * 2.2)
    if x1 - x0 > max_w:
        x0 = x1 - max_w
    y0 = int(top[x0:x1].min())
    y1 = min(h, r1)
    fin = col[y0:y1, x0:x1]
    if fin.size == 0 or fin.shape[0] < 16 or fin.shape[1] < 16:
        return None
    if fin.shape[1] > fin.shape[0] * 1.6:
        return None
    return fin


def contain(im: Image.Image, side: int, bg: tuple[int, int, int]) -> Image.Image:
    canvas = Image.new('RGB', (side, side), bg)
    scale = side / max(im.size)
    resized = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((side - resized.width) // 2, (side - resized.height) // 2))
    return canvas


def cap(im: Image.Image, long_side: int) -> Image.Image:
    w, h = im.size
    longest = max(w, h)
    if longest <= long_side:
        return im
    scale = long_side / longest
    return im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)


def save_levels(im: Image.Image, folder: Path, name: str, sides: dict[str, int]) -> None:
    high = cap(im, sides['high'])
    med = cap(high, sides['med'])
    low = cap(high, sides['low'])
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'med').mkdir(parents=True, exist_ok=True)
    (folder / 'low').mkdir(parents=True, exist_ok=True)
    high.save(folder / name, quality=82, optimize=True)
    med.save(folder / 'med' / name, quality=80, optimize=True)
    low.save(folder / 'low' / name, quality=76, optimize=True)


def plates_for(aid: str, primary: str) -> tuple[Image.Image, Image.Image, Image.Image]:
    rgb, mask = remove_bg(Image.open(REFS / f'{aid}.jpg'))
    ys, xs = np.where(mask)
    if len(xs) == 0:
        raise RuntimeError(f'no aircraft in {aid}')
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    col = rgb[y0:y1, x0:x1]
    sub = mask[y0:y1, x0:x1]
    r0, r1 = fuselage_rows(sub)
    if not facing_left(sub, r0, r1):
        col = col[:, ::-1]
        sub = sub[:, ::-1]
    band = col[max(0, r0 - 1) : min(col.shape[0], r1 + 1)]
    med = tuple(int(v) for v in np.median(band.reshape(-1, 3), axis=0))
    fuse = Image.fromarray(band).resize((1024, 256), Image.Resampling.LANCZOS)
    fin = fin_crop(col, sub, r0, r1)
    if fin is None:
        # No clean fin (helicopters, odd angles). The logo is the title band.
        logo_src = Image.fromarray(band)
        logo = contain(logo_src, 256, med)
        tail = Image.new('RGB', (512, 512), med)
        mark = logo.resize((360, 360), Image.Resampling.LANCZOS)
        tail.paste(mark, ((512 - mark.width) // 2, (512 - mark.height) // 2))
    else:
        fin_im = Image.fromarray(fin)
        logo = contain(fin_im, 256, (255, 255, 255))
        tail = contain(fin_im, 512, med)
    # Engine colour falls back to the palette primary when the plate is flat.
    _ = primary
    return fuse, tail, logo


def code_logo(code: str, primary: str) -> Image.Image:
    side = 256
    im = Image.new('RGB', (side, side), primary)
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((18, 18, side - 18, side - 18), radius=36, outline='#f4f7fb', width=10)
    font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    font = ImageFont.truetype(font_path, 72) if Path(font_path).exists() else ImageFont.load_default()
    ink = '#1a1a1a' if primary.lower() in ('#f2c200', '#f0f0f0') else '#f7f4ea'
    box = draw.textbbox((0, 0), code, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    draw.text(((side - tw) / 2, (side - th) / 2 - 8), code, fill=ink, font=font)
    return im


def main() -> None:
    gemini, base = assign_fleets()
    if len(gemini) != 40:
        raise SystemExit(f'expected 40 Gemini carriers, got {len(gemini)}')
    manifest = json.loads(MANIFEST.read_text())
    kept = [row for row in manifest['liveries'] if row['id'] in GROK_IDS]
    if len(kept) != 5:
        raise SystemExit('the five Grok plates must stay in the manifest')
    rows = list(kept)
    for row in gemini:
        fuse, tail, logo = plates_for(row['id'], row['primary'])
        folder = OUT / row['id']
        save_levels(fuse, folder, 'fuselage.jpg', LONG_SIDE)
        save_levels(tail, folder, 'tail.jpg', LONG_SIDE)
        save_levels(logo, LOGOS, f"{row['id']}.jpg", LOGO_SIDE)
        rows.append({
            'id': row['id'],
            'engine': row['engine'],
            'airlines': row['airlines'],
            'types': row['types'],
            'preload': False,
        })
        print(row['id'], row['types'])
    for row in base:
        save_levels(code_logo(row['code'], row['primary']), LOGOS, f"{row['id']}.jpg", LOGO_SIDE)
        print('logo-only', row['id'], row['code'])
    pack4 = ROOT / 'public' / 'assets' / 'pack4'
    for stem in GROK_IDS:
        save_levels(Image.open(pack4 / f'logo_{stem}.jpg').convert('RGB'), LOGOS, f'{stem}.jpg', LOGO_SIDE)
    manifest['liveries'] = rows
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'wrote {len(gemini)} plates, {len(base)} fallback logos')


if __name__ == '__main__':
    main()
