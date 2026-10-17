"""Hatchfield CC0 texture encoder: PNG/JPEG -> WebP, visually lossless.
Keeps native resolution unless a smaller size reconstructs the texture with PSNR >= 50 dB
(i.e. flat or near-flat plates, where the downscale is invisible). Colour maps use WebP q95,
normal maps and tiny plates are stored lossless.
usage: tex.py src dst kind(color|normal|data)"""
import sys
import numpy as np
from PIL import Image

src, dst, kind = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src); im.load()
if im.mode not in ('RGB', 'RGBA'):
    im = im.convert('RGBA' if 'A' in im.mode else 'RGB')
if im.mode == 'RGBA' and im.getextrema()[3][0] == 255:
    im = im.convert('RGB')
a = np.asarray(im, dtype=np.float64)

def psnr(small):
    up = np.asarray(small.resize(im.size, Image.BICUBIC), dtype=np.float64)
    mse = float(np.mean((up - a) ** 2))
    return 99.0 if mse < 1e-9 else 10 * np.log10(255 ** 2 / mse)

best = im
w, h = im.size
s = 2
while min(w, h) // s >= 16:
    cand = im.resize((w // s, h // s), Image.LANCZOS)
    if psnr(cand) < 50:
        break
    best = cand
    s *= 2
lossless = kind == 'normal' or max(best.size) <= 64
best.save(dst, 'WEBP', quality=100 if lossless else 95, lossless=lossless, method=6)
print(best.size[0], best.size[1])
