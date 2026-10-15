"""Tileable interior plates for the hall props.

The nine Gemini concepts (arrivals hall, baggage claim, food court, gate seating,
jet-bridge interior, lounge, restrooms, office, check-in) are the colour and
material reference. These plates are the full-resolution files the game loads.
The texture-quality setting is the only downscale.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = Path('public/art/textures/interiors')
SIZE = 2048


def rng(seed: int) -> random.Random:
    return random.Random(seed)


def noise(img: Image.Image, amount: int, seed: int) -> Image.Image:
    r = rng(seed)
    px = img.load()
    w, h = img.size
    for _ in range(amount):
        x = r.randrange(w)
        y = r.randrange(h)
        dr = r.randint(-18, 18)
        base = px[x, y]
        px[x, y] = tuple(max(0, min(255, c + dr)) for c in base[:3])
    return img


def speckles(img: Image.Image, n: int, colors: list[tuple[int, int, int]], seed: int, radius: int = 2) -> Image.Image:
    r = rng(seed)
    d = ImageDraw.Draw(img)
    w, h = img.size
    for _ in range(n):
        x = r.randrange(w)
        y = r.randrange(h)
        rad = r.randint(1, radius)
        d.ellipse((x, y, x + rad, y + rad), fill=r.choice(colors))
    return img


def seamless(img: Image.Image, band: float = 0.12) -> Image.Image:
    w, h = img.size
    off = ImageChops.offset(img, w // 2, h // 2)
    mask = Image.new('L', (w, h), 0)
    md = ImageDraw.Draw(mask)
    b = int(min(w, h) * band)
    for i in range(b):
        v = int(255 * i / max(1, b))
        md.rectangle((i, i, w - 1 - i, h - 1 - i), outline=v)
    md.rectangle((b, b, w - 1 - b, h - 1 - b), fill=255)
    return Image.composite(img, off, mask).filter(ImageFilter.SMOOTH)


def save(img: Image.Image, name: str) -> None:
    path = OUT / name
    img.convert('RGB').save(path, 'JPEG', quality=90, optimize=True)
    print(name, img.size, path.stat().st_size)


def terrazzo(base: tuple[int, int, int], chips: list[tuple[int, int, int]], seed: int) -> Image.Image:
    img = Image.new('RGB', (SIZE, SIZE), base)
    img = speckles(img, 28000, chips, seed, 3)
    img = speckles(img, 4000, chips, seed + 1, 7)
    return seamless(noise(img, 8000, seed + 2))


def carpet(base: tuple[int, int, int], fleck: tuple[int, int, int], seed: int, grid: int = 0) -> Image.Image:
    img = Image.new('RGB', (SIZE, SIZE), base)
    img = speckles(img, 50000, [fleck, tuple(max(0, c - 20) for c in base)], seed, 2)
    if grid:
        d = ImageDraw.Draw(img)
        line = tuple(max(0, c - 16) for c in base)
        for i in range(0, SIZE, grid):
            d.line((i, 0, i, SIZE), fill=line, width=2)
            d.line((0, i, SIZE, i), fill=line, width=2)
    return seamless(img)


def subway() -> Image.Image:
    img = Image.new('RGB', (SIZE, SIZE), (236, 236, 232))
    d = ImageDraw.Draw(img)
    grout = (196, 194, 188)
    tw, th = SIZE // 8, SIZE // 16
    for row in range(16):
        shift = (tw // 2) if row % 2 else 0
        y0 = row * th
        d.rectangle((0, y0, SIZE, y0 + 6), fill=grout)
        for col in range(-1, 10):
            x0 = col * tw + shift
            d.rectangle((x0, y0, x0 + 6, y0 + th), fill=grout)
            face = (244 - (row * 3 + col) % 5, 243, 238)
            d.rectangle((x0 + 6, y0 + 6, x0 + tw - 2, y0 + th - 2), fill=face)
    return seamless(img, 0.02)


def wall_panels() -> Image.Image:
    img = Image.new('RGB', (SIZE, SIZE), (232, 226, 214))
    d = ImageDraw.Draw(img)
    seam = (196, 188, 172)
    n = 4
    w = SIZE // n
    for i in range(n):
        x = i * w
        d.rectangle((x, 0, x + 8, SIZE), fill=seam)
        d.rectangle((x + 18, 24, x + w - 18, SIZE - 24), outline=(214, 208, 196), width=3)
    return seamless(noise(img, 4000, 11), 0.04)


def counter() -> Image.Image:
    img = Image.new('RGB', (SIZE, SIZE), (236, 232, 224))
    img = noise(img, 6000, 21)
    d = ImageDraw.Draw(img)
    d.rectangle((0, SIZE - 90, SIZE, SIZE), fill=(42, 46, 52))
    d.rectangle((0, 0, SIZE, 28), fill=(214, 206, 194))
    return seamless(img, 0.08)


def belt() -> Image.Image:
    img = Image.new('RGB', (SIZE, SIZE), (28, 30, 34))
    d = ImageDraw.Draw(img)
    for y in range(0, SIZE, 18):
        shade = 22 + (y // 18) % 3 * 6
        d.rectangle((0, y, SIZE, y + 10), fill=(shade, shade + 1, shade + 2))
        d.line((0, y + 10, SIZE, y + 10), fill=(12, 12, 14))
    return seamless(noise(img, 3000, 31), 0.06)


def office_panel() -> Image.Image:
    img = Image.new('RGB', (SIZE, SIZE), (36, 52, 84))
    img = speckles(img, 20000, [(48, 66, 102), (28, 40, 68)], 41, 2)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, SIZE, 36), fill=(24, 34, 56))
    d.rectangle((0, SIZE - 36, SIZE, SIZE), fill=(24, 34, 56))
    return seamless(img)


def jet_panel() -> Image.Image:
    img = Image.new('RGB', (SIZE, SIZE), (198, 202, 206))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 10, SIZE), fill=(150, 154, 160))
    d.rectangle((SIZE // 2, 0, SIZE // 2 + 8, SIZE), fill=(160, 164, 170))
    d.rectangle((0, SIZE // 3, SIZE, SIZE // 3 + 6), fill=(170, 174, 178))
    r = rng(51)
    for _ in range(80):
        x = r.randrange(40, SIZE - 40)
        y = r.randrange(40, SIZE - 40)
        d.ellipse((x, y, x + 7, y + 7), fill=(120, 124, 128))
    return seamless(noise(img, 2500, 52), 0.05)


def wood() -> Image.Image:
    img = Image.new('RGB', (SIZE, SIZE), (138, 98, 62))
    d = ImageDraw.Draw(img)
    r = rng(61)
    for x in range(0, SIZE, 28):
        tone = 120 + r.randint(0, 40)
        d.rectangle((x, 0, x + 22, SIZE), fill=(tone, int(tone * 0.7), int(tone * 0.42)))
        for _ in range(12):
            y = r.randrange(SIZE)
            d.line((x + 2, y, x + 20, y + r.randint(-8, 8)), fill=(90, 60, 36))
    return seamless(img, 0.06)


def stall() -> Image.Image:
    img = Image.new('RGB', (SIZE, SIZE), (92, 98, 104))
    d = ImageDraw.Draw(img)
    d.rectangle((80, 80, SIZE - 80, SIZE - 80), outline=(70, 74, 80), width=10)
    d.rectangle((0, SIZE // 2 - 8, SIZE, SIZE // 2 + 8), fill=(64, 68, 74))
    return seamless(noise(img, 2000, 71), 0.05)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    save(terrazzo((214, 206, 192), [(160, 154, 146), (232, 226, 214), (90, 86, 82), (176, 120, 96)], 1), 'floor_terrazzo.jpg')
    save(terrazzo((186, 186, 182), [(140, 142, 144), (220, 220, 216), (96, 98, 100)], 2), 'floor_restroom.jpg')
    save(carpet((48, 56, 70), (90, 120, 130), 3, 256), 'floor_carpet.jpg')
    save(subway(), 'wall_tile.jpg')
    save(wall_panels(), 'wall_panel.jpg')
    save(counter(), 'counter_front.jpg')
    save(belt(), 'belt_claim.jpg')
    save(office_panel(), 'office_panel.jpg')
    save(jet_panel(), 'jetbridge_panel.jpg')
    save(wood(), 'lounge_wood.jpg')
    save(stall(), 'wall_stall.jpg')


if __name__ == '__main__':
    main()
