"""Clean the edges of the photographed airline livery plates (render only).

The plates in public/textures/liveries/<id>/ were cut from reference renders.
Three things made their paint edges look bad on the airframe:

1. The crop keeps the white, row-streaked studio background around the fin and
   fuselage silhouette. Planar UVs reach those texels at the nose, crown, belly
   and fin edges, so the mesh showed white fringes and "barcode" streaks there.
   The background is found by flood fill from the plate border and replaced with
   a smooth push-pull bleed of the painted pixels next to it (texture dilation),
   so the paint simply continues past the silhouette.
2. The JPEGs were stored with 4:2:0 chroma, so colour bled half a block across
   every cheatline and logo edge. Chroma is rebuilt with a guided filter that
   snaps Cb/Cr edges onto the full-resolution luma edges, and the result is
   saved 4:4:4 so it is not smeared again.
3. Tails were ~600 px. Plates are enlarged 2x (Lanczos, mild unsharp) up to the
   4096 px LIVERY_LONG_SIDE ceiling, so close-zoom edges are smooth instead of
   bilinear stair-steps. med/ and low/ are rebuilt from the cleaned high plate
   at their usual caps (640 / 320).

Idempotent: a plate that is already at or above its target size is not
enlarged again, and a cleaned plate has no border-connected background left.

    python3 scripts/clean-livery-edges.py            # every plate
    python3 scripts/clean-livery-edges.py siam_breeze  # one folder
    python3 scripts/clean-livery-edges.py --out /tmp/plates   # write elsewhere, leave the repo alone
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
LIVERIES = ROOT / 'public' / 'textures' / 'liveries'
# Keep in step with LIVERY_LONG_SIDE in src/render/aircraft/liveryFiles.ts.
LONG_SIDE = {'low': 320, 'med': 640, 'high': 4096}
# Enlarge plates whose long side is under these, by 2x, capped at LONG_SIDE['high'].
ENLARGE_BELOW = {'tail': 1400, 'fuselage': 3000}


def box(a: np.ndarray, r: int) -> np.ndarray:
    """Mean over a (2r+1)^2 window, edges clamped."""
    p = np.pad(a, ((r + 1, r), (r + 1, r)), mode='edge')
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return s / (k * k)


def guided(guide: np.ndarray, src: np.ndarray, r: int, eps: float) -> np.ndarray:
    mi, ms = box(guide, r), box(src, r)
    cov = box(guide * src, r) - mi * ms
    var = box(guide * guide, r) - mi * mi
    a = cov / (var + eps)
    b = ms - a * mi
    return box(a, r) * guide + box(b, r)


def fix_chroma(rgb: np.ndarray) -> np.ndarray:
    ycc = np.asarray(Image.fromarray(rgb).convert('YCbCr')).astype(np.float64) / 255.0
    y = ycc[..., 0]
    for ch in (1, 2):
        ycc[..., ch] = guided(y, ycc[..., ch], 2, 0.0004)
    out = np.clip(ycc * 255.0 + 0.5, 0, 255).astype(np.uint8)
    return np.asarray(Image.fromarray(out, 'YCbCr').convert('RGB'))


def flood(ok: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    """Pixels where ok holds, 4-connected to a seed pixel."""
    h, w = ok.shape
    seen = np.zeros((h, w), dtype=bool)
    stack = [tuple(p) for p in np.argwhere(seeds & ok)]
    while stack:
        y, x = stack.pop()
        if seen[y, x] or not ok[y, x]:
            continue
        seen[y, x] = True
        if y > 0: stack.append((y - 1, x))
        if y < h - 1: stack.append((y + 1, x))
        if x > 0: stack.append((y, x - 1))
        if x < w - 1: stack.append((y, x + 1))
    return seen


def border(shape: tuple[int, int]) -> np.ndarray:
    b = np.zeros(shape, dtype=bool)
    b[0, :] = b[-1, :] = b[:, 0] = b[:, -1] = True
    return b


def padding(rgb: np.ndarray) -> np.ndarray:
    """Flat letterbox columns/rows that contain() added around a fin crop (one exact colour)."""
    a = rgb.astype(np.int16)
    pad = np.zeros(a.shape[:2], dtype=bool)
    ref = a[0, 0]
    flat_col = (np.abs(a - ref).max(axis=2) <= 3).all(axis=0)
    flat_row = (np.abs(a - ref).max(axis=2) <= 3).all(axis=1)
    for idx in (range(a.shape[1]), reversed(range(a.shape[1]))):
        for x in idx:
            if not flat_col[x]:
                break
            pad[:, x] = True
    for idx in (range(a.shape[0]), reversed(range(a.shape[0]))):
        for y in idx:
            if not flat_row[y]:
                break
            pad[y, :] = True
    return pad


def studio_tail(rgb: np.ndarray) -> np.ndarray:
    """Tail crops: letterbox padding plus the light, unsaturated studio backdrop ahead of the swept
    leading edge and behind the trailing edge. The crop's lower rows are the rear fuselage and
    tailplane, where white is the airframe's own paint, so the backdrop search stays above them."""
    a = rgb.astype(np.int16)
    mx, mn = a.max(axis=2), a.min(axis=2)
    h = a.shape[0]
    light = (a.mean(axis=2) >= 205) & (mx - mn <= 52)
    light[int(h * TAIL_BACKDROP_ROWS):] = False
    # The letterbox meets the backdrop through a few resampled (ringing) pixels: count them as backdrop.
    pad = grow(padding(rgb), 3) if padding(rgb).any() else padding(rgb)
    light |= pad
    seeds = np.zeros_like(light)
    seeds[0, :] = True
    seeds |= pad
    return pad | flood(light, seeds)


# Fraction of a tail crop (from the top) that can be studio backdrop; below it is fuselage paint.
TAIL_BACKDROP_ROWS = 0.7


def studio_silhouette(rgb: np.ndarray) -> np.ndarray:
    """Whole-aircraft side views on a tinted backdrop: pixels near the dominant border colour, from the border."""
    a = rgb.astype(np.int16)
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    q = (edge // 16).astype(np.int32)
    keys, counts = np.unique(q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2], return_counts=True)
    top = keys[np.argmax(counts)]
    sel = (q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2]) == top
    ref = np.median(edge[sel], axis=0)
    near = np.abs(a - ref).max(axis=2) <= 34
    return flood(near, border(near.shape))


# The five hand-made plates: whole-aircraft silhouette fuselages and full-bleed fin tails. The 40 roster
# fuselage bands are cut inside the fuselage rows, where border white is the airframe's own paint, so
# they are not masked; their tails are photo fin crops and get the fin fit.
SILHOUETTE_FUSELAGE = {'bushline_local', 'zoomjet', 'crown_pacific', 'siam_breeze', 'northstar_cargo'}


def grow(mask: np.ndarray, px: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(px):
        g = out.copy()
        g[1:] |= out[:-1]; g[:-1] |= out[1:]; g[:, 1:] |= out[:, :-1]; g[:, :-1] |= out[:, 1:]
        out = g
    return out


def upsample(a: np.ndarray, h: int, w: int) -> np.ndarray:
    """Bilinear 2x (cell-centred) up to (h, w)."""
    sh, sw = a.shape[:2]
    ys = np.clip((np.arange(h) + 0.5) / 2 - 0.5, 0, sh - 1)
    xs = np.clip((np.arange(w) + 0.5) / 2 - 0.5, 0, sw - 1)
    y0 = np.floor(ys).astype(int); x0 = np.floor(xs).astype(int)
    y1 = np.minimum(y0 + 1, sh - 1); x1 = np.minimum(x0 + 1, sw - 1)
    fy = (ys - y0)[:, None, None]; fx = (xs - x0)[None, :, None]
    top = a[y0][:, x0] * (1 - fx) + a[y0][:, x1] * fx
    bot = a[y1][:, x0] * (1 - fx) + a[y1][:, x1] * fx
    return top * (1 - fy) + bot * fy


def push_pull(rgb: np.ndarray, keep: np.ndarray) -> np.ndarray:
    """Fill ~keep from keep with a smooth multiscale bleed (pull: weighted mean down, push: fill up)."""
    col = rgb.astype(np.float64) * keep[..., None]
    wgt = keep.astype(np.float64)
    levels = [(col, wgt)]
    while min(col.shape[:2]) > 2:
        h, w = col.shape[:2]
        h2, w2 = (h + 1) // 2, (w + 1) // 2
        pc = np.zeros((h2 * 2, w2 * 2, 3)); pw = np.zeros((h2 * 2, w2 * 2))
        pc[:h, :w] = col; pw[:h, :w] = wgt
        col = pc.reshape(h2, 2, w2, 2, 3).sum((1, 3))
        wgt = pw.reshape(h2, 2, w2, 2).sum((1, 3))
        levels.append((col, wgt))
    filled = levels[-1][0] / np.maximum(levels[-1][1], 1e-9)[..., None]
    for col, wgt in reversed(levels[:-1]):
        h, w = wgt.shape
        up = upsample(filled, h, w)
        a = np.clip(wgt, 0, 1)[..., None]
        mean = col / np.maximum(wgt, 1e-9)[..., None]
        filled = mean * a + up * (1 - a)
    out = rgb.astype(np.float64).copy()
    out[~keep] = filled[~keep]
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


# Fin side outline in tail-plate UV, from finGeometry (geom.ts) / FIN_UV (liveryUv.ts):
# root spans U 0 -> 1 at V 0, the swept tip spans U TIP_LEAD -> TIP_TRAIL at V 1.
TIP_LEAD = (0.42 + 0.04) / 0.92
TIP_TRAIL = (0.42 + 0.4) / 0.92


def bilinear(img: np.ndarray, ys: np.ndarray, xs: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    ys = np.clip(ys, 0, h - 1); xs = np.clip(xs, 0, w - 1)
    y0 = np.floor(ys).astype(int); x0 = np.floor(xs).astype(int)
    y1 = np.minimum(y0 + 1, h - 1); x1 = np.minimum(x0 + 1, w - 1)
    fy = (ys - y0)[..., None]; fx = (xs - x0)[..., None]
    f = img.astype(np.float64)
    return (f[y0, x0] * (1 - fx) + f[y0, x1] * fx) * (1 - fy) + (f[y1, x0] * (1 - fx) + f[y1, x1] * fx) * fy


def fin_fit(rgb: np.ndarray, bg: np.ndarray, side: int) -> np.ndarray | None:
    """Warp the painted fin onto the mesh fin outline, row by row, so the art's own swept leading and
    trailing edges land on the mesh edges instead of studio backdrop and letterbox. None if no clean fin."""
    h, w = bg.shape
    fin = ~bg
    rows = np.where(fin.any(axis=1))[0]
    if len(rows) < h * 0.3:
        return None
    tip = int(rows[0])
    left = np.array([np.argmax(fin[y]) if fin[y].any() else -1 for y in range(h)])
    right = np.array([w - 1 - np.argmax(fin[y, ::-1]) if fin[y].any() else -1 for y in range(h)])
    width = np.where(left >= 0, right - left, 0)
    # Fin root: the first row (below the top fifth of the fin) where the outline suddenly widens into
    # the fuselage / tailplane, or the backdrop search limit.
    root = int(min(h - 1, h * TAIL_BACKDROP_ROWS))
    start = tip + max(4, (root - tip) // 5)
    for y in range(start, root):
        if width[y] - width[y - 3] > w * 0.12:
            root = y - 3
            break
    span = root - tip
    if span < h * 0.25:
        return None
    ys = np.arange(tip + span // 10, root - span // 20)
    ys = ys[(left[ys] >= 0) & (width[ys] > 4)]
    if len(ys) < 8:
        return None
    lfit = np.polyfit(ys, left[ys], 1)
    rfit = np.polyfit(ys, right[ys], 1)
    l_tip, r_tip = np.polyval(lfit, tip), np.polyval(rfit, tip)
    l_root, r_root = np.polyval(lfit, root), np.polyval(rfit, root)
    resid = max(np.abs(np.polyval(lfit, ys) - left[ys]).mean(), np.abs(np.polyval(rfit, ys) - right[ys]).mean())
    # Needs a real swept edge (a crop that cut the leading edge off still has its trailing edge);
    # a plain vertical slice of a fin would only be squeezed into the tip, so it is left alone.
    if r_tip - l_tip < 4 or r_root - l_root < 4 or resid > w * 0.05 or max(abs(lfit[0]), abs(rfit[0])) < 0.12:
        return None
    # Supersample 2x, then Lanczos down: anti-aliased warp.
    n = side * 2
    v = 1.0 - (np.arange(n) + 0.5) / n          # image top = fin tip (V 1)
    u = (np.arange(n) + 0.5) / n
    vv, uu = np.meshgrid(v, u, indexing='ij')
    le = TIP_LEAD * vv
    te = 1 - (1 - TIP_TRAIL) * vv
    t = (uu - le) / (te - le)
    sy = tip + (1 - vv) * span
    sl = np.polyval(lfit, sy); sr = np.polyval(rfit, sy)
    sx = sl + t * (sr - sl)
    out = bilinear(rgb, sy, sx)
    known = (t >= 0) & (t <= 1) & ~(bilinear(bg.astype(np.float64)[..., None], sy, sx)[..., 0] > 0.5)
    big = np.clip(out + 0.5, 0, 255).astype(np.uint8)
    big = push_pull(big, known)
    return np.asarray(Image.fromarray(big).resize((side, side), Image.Resampling.LANCZOS))


def clean(path: Path, slot: str, folder_id: str, dry: Path | None = None) -> dict:
    im = Image.open(path).convert('RGB')
    rgb = fix_chroma(np.asarray(im))
    note = 'chroma'
    if slot == 'tail' and folder_id not in SILHOUETTE_FUSELAGE:
        # Roster tails are fin crops from a photo. The five hand-made plates are already full-bleed fins.
        long_side = max(rgb.shape[:2])
        side = 1024 if long_side < 700 else 2048 if long_side >= 1000 else 1536
        fitted = fin_fit(rgb, studio_tail(rgb), side)
        if fitted is not None:
            rgb, note = fitted, 'fin-fit'
        else:
            pad = padding(rgb)
            if pad.any() and pad.mean() < 0.7:
                # At least continue the paint across the flat letterbox bands instead of a slab of median colour.
                rgb, note = push_pull(rgb, ~grow(pad, 3)), 'pad-bleed'
    elif slot == 'fuselage' and folder_id in SILHOUETTE_FUSELAGE:
        bg = studio_silhouette(rgb)
        if 0.003 < float(bg.mean()) < 0.5:
            rgb, note = push_pull(rgb, ~grow(bg, 2)), 'bleed'
    out = Image.fromarray(rgb)
    long_side = max(out.size)
    if note != 'fin-fit' and long_side < ENLARGE_BELOW[slot]:
        s = min(2.0, LONG_SIDE['high'] / long_side)
        out = out.resize((round(out.width * s), round(out.height * s)), Image.Resampling.LANCZOS)
        out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=45, threshold=2))
    target = dry / folder_id / path.name if dry else path
    target.parent.mkdir(parents=True, exist_ok=True)
    out.save(target, quality=93, subsampling=0, optimize=True)
    for lvl, q in (('med', 90), ('low', 88)):
        if not (path.parent / lvl).is_dir():
            continue
        d = target.parent / lvl
        d.mkdir(exist_ok=True)
        cap = LONG_SIDE[lvl]
        sc = min(1.0, cap / max(out.size))
        small = out.resize((max(1, round(out.width * sc)), max(1, round(out.height * sc))), Image.Resampling.LANCZOS)
        small.save(d / path.name, quality=q, subsampling=0, optimize=True)
    return {'note': note, 'size': out.size}


def main(args: list[str]) -> None:
    dry = None
    if args[:1] == ['--out']:
        dry, args = Path(args[1]), args[2:]
    folders = sorted(p for p in LIVERIES.iterdir() if p.is_dir() and (p / 'tail.jpg').exists())
    if args:
        folders = [p for p in folders if p.name in args]
    for folder in folders:
        res = {slot: clean(folder / f'{slot}.jpg', slot, folder.name, dry) for slot in ('fuselage', 'tail')}
        print(folder.name, res, flush=True)


if __name__ == '__main__':
    main(sys.argv[1:])
