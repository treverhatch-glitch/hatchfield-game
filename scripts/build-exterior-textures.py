#!/usr/bin/env python3
"""Full-resolution exterior plates for the five playtest buildings.

The Gemini sheets (terminal, hangar, fuel farm, tower, fire station) are
orthographic references with dimension marks and labels. Those strokes are
not texture. Colours follow the material targets that were matched to those
sheets. The pattern is the part the sheet is actually showing: curtain-wall
mullions, hangar ribs, tank bands, fire-station masonry, a red bay door,
a tower shaft, and a roof membrane.

High keeps every pixel. Med and low are the only downscale, applied at
load time by src/render/world/exteriorArt.ts.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'art' / 'textures' / 'exteriors'
SIZE = 2048


def save_jpeg(arr: np.ndarray, path: Path) -> None:
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')
    img.save(path, quality=92, subsampling=0)


def rgb(hex_s: str) -> np.ndarray:
    h = hex_s.lstrip('#')
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float32)


def grid_lines(period: int, width: int, axis: int) -> np.ndarray:
    coord = np.arange(SIZE, dtype=np.float32)
    d = np.minimum(np.mod(coord, period), period - np.mod(coord, period))
    line = d < width
    return line[:, None] if axis == 0 else line[None, :]


def curtain() -> np.ndarray:
    glass = rgb('#d5e3ee')
    mullion = rgb('#24384c')
    y, x = np.mgrid[0:SIZE, 0:SIZE]
    # Eight bays across, four floors. Periods divide 2048, so the tile repeats.
    vu = np.minimum(np.mod(x, 256), 256 - np.mod(x, 256))
    vv = np.minimum(np.mod(y, 512), 512 - np.mod(y, 512))
    bar = (vu < 7) | (vv < 6)
    transom = np.minimum(np.mod(y + 180, 512), 512 - np.mod(y + 180, 512)) < 3
    sky = 0.92 + 0.08 * np.sin((x * 0.01 + y * 0.004))
    img = glass.reshape(1, 1, 3) * sky[..., None]
    img = np.where((bar | transom)[..., None], mullion.reshape(1, 1, 3), img)
    return img


def cladding() -> np.ndarray:
    base = rgb('#d0d4d8')
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    ribs = 16
    phase = (x / SIZE) * ribs * np.pi * 2
    rib = 0.5 + 0.5 * np.cos(phase)
    shade = 0.78 + 0.22 * rib
    grain = 0.02 * np.sin((y * 0.05))
    return base.reshape(1, 1, 3) * (shade + grain)[..., None]


def tank() -> np.ndarray:
    base = rgb('#e4e8eb')
    band = rgb('#9aa6b0')
    y, _x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    phase = (y / SIZE) * 8 * np.pi * 2
    rib = 0.5 + 0.5 * np.cos(phase)
    shade = 0.86 + 0.14 * rib
    img = base.reshape(1, 1, 3) * shade[..., None]
    seam = np.minimum(np.mod(y, 256), 256 - np.mod(y, 256)) < 5
    img = np.where(seam[..., None], band.reshape(1, 1, 3), img)
    return img


def masonry() -> np.ndarray:
    brick = rgb('#e4d9cc')
    mortar = rgb('#b7aea3')
    y, x = np.mgrid[0:SIZE, 0:SIZE]
    row = y // 128
    xx = x + np.where(row % 2 == 1, 128, 0)
    vu = np.minimum(np.mod(xx, 256), 256 - np.mod(xx, 256))
    vv = np.minimum(np.mod(y, 128), 128 - np.mod(y, 128))
    joint = (vu < 5) | (vv < 5)
    shade = 0.94 + 0.06 * np.sin((x + y) * 0.02)
    img = brick.reshape(1, 1, 3) * shade[..., None]
    img = np.where(joint[..., None], mortar.reshape(1, 1, 3), img)
    return img


def bay() -> np.ndarray:
    red = rgb('#c8262b')
    dark = rgb('#8e1c22')
    y, _x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    d = np.minimum(np.mod(y, 64), 64 - np.mod(y, 64))
    slat = d < 4
    shade = 0.82 + 0.18 * (d / 32)
    img = red.reshape(1, 1, 3) * shade[..., None]
    img = np.where(slat[..., None], dark.reshape(1, 1, 3), img)
    return img


def shaft() -> np.ndarray:
    base = rgb('#e7ebef')
    joint = rgb('#b7c0c8')
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    shade = 0.94 + 0.04 * np.sin(x * 0.03) + 0.02 * np.sin(y * 0.01)
    img = base.reshape(1, 1, 3) * shade[..., None]
    seam = np.minimum(np.mod(y, 512), 512 - np.mod(y, 512)) < 6
    img = np.where(seam[..., None], joint.reshape(1, 1, 3), img)
    return img


def membrane() -> np.ndarray:
    base = rgb('#8e98a0')
    seam = rgb('#6a737a')
    y, x = np.mgrid[0:SIZE, 0:SIZE]
    vu = np.minimum(np.mod(x, 512), 512 - np.mod(x, 512))
    vv = np.minimum(np.mod(y, 512), 512 - np.mod(y, 512))
    line = (vu < 4) | (vv < 4)
    shade = 0.9 + 0.08 * np.sin((x * 0.02 + y * 0.015))
    img = base.reshape(1, 1, 3) * shade[..., None]
    img = np.where(line[..., None], seam.reshape(1, 1, 3), img)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    plates = {
        'curtain.jpg': curtain(),
        'cladding.jpg': cladding(),
        'tank.jpg': tank(),
        'masonry.jpg': masonry(),
        'bay.jpg': bay(),
        'shaft.jpg': shaft(),
        'membrane.jpg': membrane(),
    }
    for name, arr in plates.items():
        path = OUT / name
        save_jpeg(arr, path)
        print(f'{name} {path.stat().st_size // 1024}KB')


if __name__ == '__main__':
    main()
