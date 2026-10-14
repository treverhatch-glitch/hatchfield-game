"""Turn full-res livery plates into browser JPEGs.

Originals live in assets/liveries/<id>/{fuselage,tail}.jpg and are not served.
Browser copies land in public/textures/liveries/<id>/ (high, the default)
and in med/ and low/ beside them. Long-side caps match LIVERY_LONG_SIDE in
src/render/aircraft/liveryFiles.ts. Nothing else resamples these files.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets' / 'liveries'
OUT = ROOT / 'public' / 'textures' / 'liveries'

# Keep in step with src/render/aircraft/liveryFiles.ts
LONG_SIDE = {'low': 320, 'med': 640, 'high': 1280}

LIVERIES = [
    {
        'id': 'bushline_local',
        'engine': '#F5E6C8',
        'airlines': ['bushline', 'bushline_local'],
        'flip_tail': True,
    },
    {
        'id': 'zoomjet',
        'engine': '#D5D8DC',
        'airlines': ['zoomjet'],
        'flip_tail': True,
    },
    {
        'id': 'crown_pacific',
        'engine': '#C5A059',
        'airlines': ['crown', 'crown_pacific'],
        'flip_tail': True,
    },
    {
        'id': 'siam_breeze',
        'engine': '#F7FBFA',
        'airlines': ['siam_breeze'],
        'flip_tail': False,
    },
    {
        'id': 'northstar_cargo',
        'engine': '#FFC107',
        'airlines': ['northstar_cargo'],
        'flip_tail': False,
    },
]


def load_rgb(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert('RGB')).astype(np.int16)


def content_mask(arr: np.ndarray, tol: int = 28) -> np.ndarray:
    """Pixels that are not the corner background. Flooded from the corners so
    white lettering inside the fin is kept."""
    h, w = arr.shape[:2]
    bg = np.median(np.stack([arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1]]), axis=0)
    near = np.max(np.abs(arr.astype(np.int16) - bg), axis=2) <= tol
    bg_px = np.zeros((h, w), dtype=bool)
    stack = [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or bg_px[y, x] or not near[y, x]:
            continue
        bg_px[y, x] = True
        stack.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    return ~bg_px


def bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def inpaint(arr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Fill background texels with the nearest content color so a JPEG stays opaque."""
    color = arr.copy()
    filled = mask.copy()
    h, w = filled.shape
    guard = 0
    while not filled.all() and guard < max(h, w):
        guard += 1
        up_f = np.zeros_like(filled)
        up_f[:-1] = filled[1:]
        down_f = np.zeros_like(filled)
        down_f[1:] = filled[:-1]
        left_f = np.zeros_like(filled)
        left_f[:, :-1] = filled[:, 1:]
        right_f = np.zeros_like(filled)
        right_f[:, 1:] = filled[:, :-1]
        up_c = np.zeros_like(color)
        up_c[:-1] = color[1:]
        down_c = np.zeros_like(color)
        down_c[1:] = color[:-1]
        left_c = np.zeros_like(color)
        left_c[:, :-1] = color[:, 1:]
        right_c = np.zeros_like(color)
        right_c[:, 1:] = color[:, :-1]
        grew = False
        for src_f, src_c in ((up_f, up_c), (down_f, down_c), (left_f, left_c), (right_f, right_c)):
            take = ~filled & src_f
            if not take.any():
                continue
            color[take] = src_c[take]
            filled |= take
            grew = True
        if not grew:
            break
    return color


def longest_run(flags: np.ndarray) -> tuple[int, int]:
    best = (0, 0)
    start = None
    for i, on in enumerate(flags.tolist()):
        if on and start is None:
            start = i
        if not on and start is not None:
            if i - start > best[1] - best[0]:
                best = (start, i)
            start = None
    if start is not None and len(flags) - start > best[1] - best[0]:
        best = (start, len(flags))
    return best


def prep_fuselage(arr: np.ndarray) -> np.ndarray:
    mask = content_mask(arr)
    x0, _, x1, _ = bbox(mask)
    span = max(1, (x1 - x0) // 6)
    if mask[:, x1 - span : x1].any(axis=1).sum() < mask[:, x0 : x0 + span].any(axis=1).sum():
        arr = arr[:, ::-1]
        mask = mask[:, ::-1]
        x0, _, x1, _ = bbox(mask)
    body_x1 = x0 + int((x1 - x0) * 0.72)
    body = mask[:, x0:body_x1]
    wide = body.sum(axis=1) > max(8, body.shape[1] * 0.35)
    top, bot = longest_run(wide)
    if bot <= top:
        _, top, _, bot = bbox(mask)
    pad = 2
    top = max(0, top - pad)
    bot = min(arr.shape[0], bot + pad)
    crop = arr[top:bot, x0:x1]
    return inpaint(crop, mask[top:bot, x0:x1])


def prep_tail(arr: np.ndarray, flip: bool) -> np.ndarray:
    mask = content_mask(arr, tol=22)
    x0, y0, x1, y1 = bbox(mask)
    crop = arr[y0:y1, x0:x1]
    cmask = mask[y0:y1, x0:x1]
    if flip:
        crop = crop[:, ::-1]
        cmask = cmask[:, ::-1]
    return inpaint(crop, cmask)


def save_levels(im: Image.Image, folder: Path, name: str) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    w, h = im.size
    long = max(w, h)
    for quality, cap in LONG_SIDE.items():
        scale = min(1.0, cap / long)
        sized = im if scale == 1 else im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.LANCZOS)
        dest_dir = folder if quality == 'high' else folder / quality
        dest_dir.mkdir(parents=True, exist_ok=True)
        q = {'high': 92, 'med': 86, 'low': 80}[quality]
        sized.save(dest_dir / name, quality=q, optimize=True)


def main() -> None:
    for entry in LIVERIES:
        slug = entry['id']
        src = SRC / slug
        fuse = prep_fuselage(load_rgb(src / 'fuselage.jpg'))
        tail = prep_tail(load_rgb(src / 'tail.jpg'), bool(entry['flip_tail']))
        folder = OUT / slug
        save_levels(Image.fromarray(fuse.astype(np.uint8), 'RGB'), folder, 'fuselage.jpg')
        save_levels(Image.fromarray(tail.astype(np.uint8), 'RGB'), folder, 'tail.jpg')
        print(f'{slug} fuselage {fuse.shape[1]}x{fuse.shape[0]} tail {tail.shape[1]}x{tail.shape[0]}')
    manifest = {
        'defaultQuality': 'high',
        'liveries': [{k: entry[k] for k in ('id', 'engine', 'airlines')} for entry in LIVERIES],
    }
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
