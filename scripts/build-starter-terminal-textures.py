#!/usr/bin/env python3
"""Starter (prefab I) terminal exterior plates. Procedural, seamless, full-res.

Writes public/art/textures/exteriors/starter/*.jpg. Every plate tiles: noise is
FFT-filtered on a torus and every joint pattern divides the plate edge.
Run: python3 scripts/build-starter-terminal-textures.py [--size 2048]
"""
import argparse
import os

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'art', 'textures', 'exteriors', 'starter')
RNG = np.random.default_rng(20261017)


def noise(h, w, scale, rng=RNG):
    """Periodic band-limited noise in [-1, 1]. scale = feature size in px."""
    f = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    r = np.sqrt(fx * fx + fy * fy) * scale
    spec = np.fft.fft2(f) * np.exp(-(r ** 2))
    n = np.real(np.fft.ifft2(spec))
    n -= n.mean()
    return n / (np.abs(n).max() + 1e-9)


def fbm(h, w, base, octaves=5, rng=RNG):
    out = np.zeros((h, w))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * noise(h, w, base / (2 ** o), rng)
        tot += amp
        amp *= 0.5
    return out / tot


def lines(n, period, width, offset=0.0):
    """1D soft mask of joints: 1 on the joint, 0 elsewhere (periodic)."""
    x = (np.arange(n) + offset) % period
    d = np.minimum(x, period - x)
    return np.clip(1.0 - d / max(width, 1e-6), 0.0, 1.0)


def normal_from_height(hgt, strength):
    gy, gx = np.gradient(np.pad(hgt, 1, mode='wrap'))
    gx = gx[1:-1, 1:-1] * strength
    gy = gy[1:-1, 1:-1] * strength
    nz = np.ones_like(gx)
    n = np.stack([-gx, gy, nz], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)


def save(name, arr, q=93):
    a = np.asarray(arr)
    if a.dtype != np.uint8:
        a = (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
    im = Image.fromarray(a)
    path = os.path.join(OUT, name)
    im.save(path, quality=q, subsampling=0 if q >= 93 else 2, optimize=True)
    print(name, im.size, os.path.getsize(path))


def gray(v):
    return np.repeat(np.asarray(v)[..., None], 3, -1)


def cladding(S):
    """Aluminium composite panels. Plate = 3.0 m square: 2 panels across, 3 rows (1.5 x 1.0 m)."""
    px_m = S / 3.0
    jw = 0.012 * px_m
    jx = lines(S, S / 2, jw)[None, :]
    jy = lines(S, S / 3, jw)[:, None]
    joint = np.maximum(jx, jy)
    # Per-panel tone (a panel is one coil, slightly different sheen).
    col = (np.arange(S) // (S // 2))[None, :]
    row = (np.arange(S) // (S // 3))[:, None]
    pid = (col * 7 + row * 3) % 6
    tone = np.array([0.0, 0.018, -0.012, 0.01, -0.02, 0.006])[pid]
    grain = fbm(S, S, 3.0, 3) * 0.012 + noise(S, S, 60) * 0.02
    # Rain streaks under every horizontal joint, fading downward.
    yy = (np.arange(S) % (S / 3)) / (S / 3)
    streak = (noise(S, S, 2.0) * 0.5 + 0.5)[0:1, :] ** 3
    streak = np.repeat(streak, S, 0) * (np.exp(-yy * 4.0)[:, None]) * 0.05
    base = np.array([0.86, 0.875, 0.885])
    v = 1.0 + tone + grain - streak
    rgb = base[None, None, :] * v[..., None]
    rgb = rgb * (1 - joint[..., None] * 0.72)
    save('clad_albedo.jpg', rgb)
    hgt = -joint * 1.0 + grain * 0.4
    # Panel edges fold back: tiny bevel ramp next to each joint.
    bev = np.maximum(lines(S, S / 2, jw * 3)[None, :], lines(S, S / 3, jw * 3)[:, None])
    hgt = hgt - bev * 0.35
    save('clad_normal.jpg', normal_from_height(hgt, 6.0), 95)
    rough = 0.34 + grain * 1.5 + joint * 0.45 + streak * 2.0
    save('clad_rough.jpg', gray(rough))


def roof(S):
    """TPO single-ply membrane. Plate = 8 m square, lap seams every 2 m, light walk-pad mottling."""
    px_m = S / 8.0
    seam = lines(S, S / 4, 0.03 * px_m, offset=0)[None, :]
    lap = lines(S, S / 4, 0.09 * px_m, offset=-0.05 * px_m)[None, :] * 0.5
    m1 = fbm(S, S, 220, 5)
    m2 = noise(S, S, 3) * 0.5
    dirt = np.clip(fbm(S, S, 400, 3) * 1.4, 0, 1) * 0.07
    base = np.array([0.70, 0.71, 0.70])
    v = 1.0 + m1 * 0.06 + m2 * 0.025 - dirt * 1.4 - seam * 0.16 + lap * 0.04
    rgb = base[None, None, :] * v[..., None]
    save('roof_albedo.jpg', rgb)
    hgt = lap * 1.0 + seam * 0.6 + noise(S, S, 8) * 0.08 + m1 * 0.3
    save('roof_normal.jpg', normal_from_height(hgt, 5.0), 95)
    save('roof_rough.jpg', gray(0.78 + m1 * 0.05 + dirt + seam * 0.05 - lap * 0.05))


def concrete(S):
    """Precast plinth concrete. Plate = 4 m: formwork joints every 2 m, tie holes, fine pores."""
    px_m = S / 4.0
    jv = lines(S, S / 2, 0.008 * px_m)[None, :]
    jh = lines(S, S / 2, 0.006 * px_m)[:, None] * 0.6
    joint = np.maximum(jv, jh)
    m1 = fbm(S, S, 300, 6)
    pores = (noise(S, S, 1.2) > 0.82).astype(float) * 0.35
    yy, xx = np.mgrid[0:S, 0:S]
    tie = np.zeros((S, S))
    for cx in (0.25, 0.75):
        for cy in (0.25, 0.75):
            d = np.hypot(((xx / S - cx + 0.5) % 1) - 0.5, ((yy / S - cy + 0.5) % 1) - 0.5) * 4.0
            tie = np.maximum(tie, np.clip(1 - d / 0.012, 0, 1))
    base = np.array([0.70, 0.69, 0.66])
    v = 1.0 + m1 * 0.06 - pores * 0.25 - joint * 0.35 - tie * 0.5
    save('concrete_albedo.jpg', base[None, None, :] * v[..., None])
    save('concrete_normal.jpg', normal_from_height(-joint - pores * 0.8 - tie + m1 * 0.5, 4.0), 95)


def glazing(W, H):
    """One curtain-wall pane, 5.5 m wide x 3.06 m tall (FLOOR_Y..GLASS_TOP).

    Three lites per pane, a ceiling soffit seen through the glass near the top,
    check-in desks and a lit hall behind. Albedo is the daytime read (dark,
    reflective glass); glow is the night interior (emissive, multiplied by night).
    """
    yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W])[:, None, None]
    v = 1.0 - yy  # 0 bottom .. 1 top (image row 0 is the top)
    lite = lines(W, W / 3, 0.006 * W)[None, :]
    edge = lines(W, W, 0.004 * W)[None, :]
    frame = np.maximum(lite * 0.8, edge)
    # Inner-sky gradient and soft, broad reflections baked low so the env map leads.
    refl = fbm(H, W, 380, 3)
    soffit = np.clip((v - 0.86) / 0.03, 0, 1)  # ceiling band behind the glass top
    desks = ((v > 0.0) & (v < 0.32)).astype(float)
    dx = (xx * 6.0) % 1.0
    desks *= ((dx > 0.12) & (dx < 0.88)).astype(float)
    people = np.zeros((H, W))
    rng = np.random.default_rng(7)
    aspect = W / H * (3.06 / 5.5)  # px per metre match on both axes
    for _ in range(7):
        cx = rng.uniform(0.05, 0.95)
        top = rng.uniform(0.50, 0.58)  # 1.55..1.75 m of a 3.06 m pane
        sx = rng.uniform(0.020, 0.026)  # shoulder half-width ~ 0.12 m
        torso = np.exp(-(((xx - cx) / sx) ** 4)) * np.clip((top - 0.05 - v) / 0.015, 0, 1) * (v > 0.0)
        head = np.exp(-(((xx - cx) / 0.011) ** 2 + ((v - top + 0.022) / 0.024) ** 2))
        people = np.maximum(people, np.clip(np.maximum(torso, head), 0, 1))
    glass = np.array([0.30, 0.40, 0.46])
    day = glass[None, None, :] * (0.9 + 0.25 * v[..., None] + refl[..., None] * 0.08)
    day = day * (1 - soffit[..., None] * 0.35) * (1 - desks[..., None] * 0.18) * (1 - people[..., None] * 0.12)
    day = day * (1 - frame[..., None] * 0.6)
    save('glass_albedo.jpg', day)
    # Night: warm hall, ceiling downlights, bright desk tops, silhouettes in front.
    hall = np.array([1.0, 0.78, 0.50])[None, None, :] * (0.32 + 0.38 * np.clip(1 - np.abs(v - 0.55) * 1.6, 0, 1))[..., None]
    lamps = np.zeros((H, W))
    for k in range(12):
        cx = (k + 0.5) / 12
        lamps = np.maximum(lamps, np.exp(-(((xx - cx) / 0.012) ** 2 + ((v - 0.83) / 0.018) ** 2)))
    lamp_rgb = np.array([1.0, 0.95, 0.85])[None, None, :] * lamps[..., None] * 1.0
    deskglow = np.array([0.95, 0.9, 0.8])[None, None, :] * (((v > 0.305) & (v < 0.32)) & (dx > 0.12) & (dx < 0.88)).astype(float)[..., None] * 0.6
    night = hall * (1 - soffit[..., None] * 0.75) + lamp_rgb + deskglow
    night = night * (1 - desks[..., None] * 0.55) * (1 - people[..., None] * 0.7) * (1 - frame[..., None] * 0.95)
    save('glass_glow.jpg', night)


def soffit(S):
    """Canopy soffit: linear aluminium slats, round downlights. Plate = 3 m."""
    px_m = S / 3.0
    slat = lines(S, 0.1 * px_m, 0.008 * px_m)[:, None] * np.ones((1, S))
    yy, xx = np.mgrid[0:S, 0:S]
    lamp = np.zeros((S, S))
    rim = np.zeros((S, S))
    for cx in (0.25, 0.75):
        for cy in (0.25, 0.75):
            d = np.hypot(((xx / S - cx + 0.5) % 1) - 0.5, ((yy / S - cy + 0.5) % 1) - 0.5) * 3.0
            lamp = np.maximum(lamp, np.clip((0.075 - d) / 0.01, 0, 1))
            rim = np.maximum(rim, np.clip(1 - np.abs(d - 0.085) / 0.008, 0, 1))
    g = noise(S, S, 2.0) * 0.015
    base = np.array([0.78, 0.79, 0.80])
    alb = base[None, None, :] * (1 + g - slat * 0.45)[..., None]
    alb = alb * (1 - rim[..., None] * 0.6) + lamp[..., None] * np.array([0.95, 0.94, 0.9])[None, None, :] * 0.4
    save('soffit_albedo.jpg', alb)
    glow = lamp[..., None] * np.array([1.0, 0.92, 0.78])[None, None, :]
    save('soffit_glow.jpg', glow)


def unit(S):
    """Rooftop AHU side: louvre bank in a framed panel. Plate = 2 m square."""
    px_m = S / 2.0
    yy, xx = np.mgrid[0:S, 0:S] / S
    louv = (yy * 2.0 / 0.05) % 1.0  # 5 cm blades
    blade = np.clip(1 - louv * 1.4, 0, 1)
    inside = ((xx % 0.5 > 0.04) & (xx % 0.5 < 0.46) & (yy % 0.5 > 0.06) & (yy % 0.5 < 0.44)).astype(float)
    frame = 1 - inside
    g = fbm(S, S, 60, 3) * 0.03
    base = np.array([0.80, 0.83, 0.85])
    alb = base[None, None, :] * (1 + g - inside * (0.28 - blade * 0.22))[..., None] * (1 - frame * 0.0)[..., None]
    save('unit_albedo.jpg', alb)
    hgt = inside * (blade * 1.0 - 0.6) + frame * 0.3
    save('unit_normal.jpg', normal_from_height(hgt, 5.0 * px_m / 1024), 95)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', type=int, default=2048)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    S = a.size
    cladding(S)
    roof(S)
    concrete(S)
    glazing(S, S // 2)
    soffit(S // 2)
    unit(S // 2)


if __name__ == '__main__':
    main()
