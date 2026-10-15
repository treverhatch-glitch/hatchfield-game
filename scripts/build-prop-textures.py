#!/usr/bin/env python3
"""Full-resolution apron prop plates.

The Gemini sheets are orthographic references with dimension marks and
labels. Those strokes are not texture. This writes seamless plates whose
colours are sampled from the sheets and whose pattern matches the view:
corrugated tunnel skin, chain-link with holes, and the red stand hatch.

High keeps every pixel. Med and low are the only downscale, applied at
load time by src/render/world/propArt.ts.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SHEETS = Path('/cursor/stores/bot/art/gemini/props')
OUT = ROOT / 'public' / 'art' / 'textures' / 'props'
SIZE = 2048


def sample_rgb(path: Path, luma_lo: float, luma_hi: float, chroma_max: float) -> np.ndarray:
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    mx = im.max(axis=2)
    mn = im.min(axis=2)
    luma = im.mean(axis=2)
    mask = (luma >= luma_lo) & (luma <= luma_hi) & ((mx - mn) <= chroma_max)
    if int(mask.sum()) < 500:
        return np.array([180, 184, 188], dtype=np.float32)
    return np.median(im[mask], axis=0)


def save_jpeg(arr: np.ndarray, path: Path) -> None:
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')
    img.save(path, quality=92, subsampling=0)


def corrugation(rgb: np.ndarray) -> np.ndarray:
    y = np.arange(SIZE, dtype=np.float32)[:, None]
    x = np.arange(SIZE, dtype=np.float32)[None, :]
    ribs = 48
    phase = (y / SIZE) * ribs * np.pi * 2
    # Raised rib, dark valley. Seamless because the phase closes on SIZE.
    rib = 0.5 + 0.5 * np.cos(phase)
    valley = np.clip((rib - 0.82) / 0.18, 0, 1)
    shade = 0.72 + 0.28 * rib - 0.08 * valley
    grain = 0.03 * np.sin((x * 0.37 + y * 0.11) * 0.2)
    img = rgb.reshape(1, 1, 3) * (shade + grain)[..., None]
    return img


def chainlink(rgb: np.ndarray) -> np.ndarray:
    """RGBA. Holes are transparent so the grass shows through."""
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    period = 36.0
    u = np.mod(x + y, period)
    v = np.mod(x - y, period)
    d1 = np.minimum(u, period - u)
    d2 = np.minimum(v, period - v)
    wire = (d1 < 1.35) | (d2 < 1.35)
    # A second, slightly offset strand so the diamond reads as twisted wire.
    u2 = np.mod(x + y + period * 0.5, period)
    v2 = np.mod(x - y + 2.0, period)
    d3 = np.minimum(u2, period - u2)
    d4 = np.minimum(v2, period - v2)
    wire = wire | (((d3 < 0.7) | (d4 < 0.7)) & (d1 > 4) & (d2 > 4))
    shade = np.where(d1 < d2, 0.92, 1.05).astype(np.float32)
    shade = np.where(wire, shade, 0)
    rgb_img = np.clip(rgb.reshape(1, 1, 3) * shade[..., None], 0, 255)
    alpha = np.where(wire, 255, 0).astype(np.uint8)
    out = np.dstack([rgb_img.astype(np.uint8), alpha])
    return out


def hatch(red: np.ndarray) -> np.ndarray:
    """Red diagonal safety stripes on concrete. One period tiles via world UVs."""
    y, x = np.mgrid[0:SIZE, 0:SIZE]
    period = 160
    band = np.mod(x + y, period)
    stripe = band < 72
    concrete = np.array([176, 178, 174], dtype=np.float32)
    img = np.where(stripe[..., None], red.reshape(1, 1, 3), concrete.reshape(1, 1, 3))
    # Soft edge so the JPEG doesn't ring as hard as a 1-bit mask.
    edge = np.clip(np.minimum(np.abs(band - 72), np.abs(band.astype(np.int16))) / 6.0, 0, 1)
    # edge unused for the solid; a one-pixel blend is enough
    blend = (band >= 68) & (band <= 76)
    mid = (red + concrete) / 2
    img = np.where(blend[..., None], mid.reshape(1, 1, 3), img)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    bridge = sample_rgb(SHEETS / 'jet_bridge.jpeg', 130, 210, 28)
    fence = sample_rgb(SHEETS / 'fence_panel.jpeg', 140, 210, 24)
    print('bridge', bridge.astype(int).tolist(), 'fence', fence.astype(int).tolist())
    save_jpeg(corrugation(bridge), OUT / 'corrugation.jpg')
    link = chainlink(fence)
    Image.fromarray(link, 'RGBA').save(OUT / 'chainlink.png', optimize=True)
    red = np.array([196, 40, 36], dtype=np.float32)
    save_jpeg(hatch(red), OUT / 'hatch.jpg')
    for name in ('corrugation.jpg', 'chainlink.png', 'hatch.jpg'):
        p = OUT / name
        print(name, p.stat().st_size, Image.open(p).size, Image.open(p).mode)


if __name__ == '__main__':
    main()
