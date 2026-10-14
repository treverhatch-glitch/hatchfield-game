"""Side-livery atlas for the ground fleet.

Landscape cells, left to right. The first five stay the turnaround set
(fuel, catering, belt, tug, bus). The rest are lav, water, GPU, stairs,
bags, dolly, loader, de-ice, fire, police and the cleaning van.
Names are fictional Hatchfield brands. JET A-1 is the fuel grade, not a brand.
Each line is scaled to fit the cell so the placard is not clipped.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/art/textures/vehicles/livery_atlas.jpg"
B64 = ROOT / "public/art/textures/vehicles/_b64/livery_atlas.jpg.b64"
FONT = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
FONT_MED = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"

CELLS = 16
# Landscape banner. The game scales each placard to this aspect (LIVERY_CELL_ASPECT).
W, H = 1024, 280
ATLAS_W = W * CELLS


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT if bold else FONT_MED, size)


def fit_font(draw: ImageDraw.ImageDraw, s: str, max_w: float, max_h: float, bold: bool = True) -> ImageFont.FreeTypeFont:
    """Largest face that stays inside the box, so a line is never clipped."""
    lo, hi = 8, max(8, int(max_h))
    best = font(8, bold)
    while lo <= hi:
        mid = (lo + hi) // 2
        face = font(mid, bold)
        box = draw.textbbox((0, 0), s, font=face)
        if box[2] - box[0] <= max_w and box[3] - box[1] <= max_h:
            best = face
            lo = mid + 1
        else:
            hi = mid - 1
    return best


def banner(draw: ImageDraw.ImageDraw, lines: list[tuple[str, tuple[int, int, int]]], y0: float, y1: float):
    """Stack lines in the inner 88% of the cell so a 2% UV inset still clears the glyphs."""
    pad_x = W * 0.08
    gap = 8
    band = (y1 - y0 - gap * (len(lines) - 1)) / len(lines)
    y = y0
    for s, fill in lines:
        face = fit_font(draw, s, W - pad_x * 2, band * 0.92)
        draw.text((W / 2, y + band / 2), s, font=face, fill=fill, anchor="mm")
        y += band + gap


def fuel(im):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(236, 238, 240))
    d.rectangle((0, 0, 18, H), fill=(196, 36, 32))
    banner(d, [("HATCHFIELD FUEL", (22, 24, 26)), ("JET A-1", (196, 36, 32))], 28, H - 28)


def catering(im):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(244, 245, 246))
    d.rectangle((0, H - 36, W, H), fill=(70, 110, 150))
    banner(d, [("HATCHFIELD", (36, 52, 72)), ("CATERING", (36, 70, 110))], 24, H - 48)


def belt(im):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(236, 238, 240))
    d.rectangle((0, H - 28, W, H), fill=(242, 191, 31))
    banner(d, [("HATCHFIELD GROUND", (40, 44, 48)), ("KEEP CLEAR", (20, 20, 20))], 22, H - 40)


def tug(im):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(232, 234, 236))
    d.rectangle((0, 0, W, 16), fill=(40, 44, 48))
    banner(d, [("HATCH TUG", (30, 32, 34)), ("PUSHBACK", (196, 36, 32))], 28, H - 16)


def bus(im):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(240, 242, 244))
    d.rectangle((0, H - 32, W, H), fill=(36, 70, 110))
    banner(d, [("HATCHFIELD", (36, 70, 110)), ("SHUTTLE", (40, 44, 48))], 20, H - 44)


def panel(bg, ink, word, bar):
    def paint(im):
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, W, H), fill=bg)
        d.rectangle(bar[0], fill=bar[1])
        banner(d, [("HATCHFIELD", ink), (word, ink)], 24, H - 36)
    return paint


def main():
    rest = [
        panel((232, 236, 242), (24, 58, 96), "LAV", ((0, 0, 18, H), (42, 106, 168))),
        panel((236, 244, 248), (28, 92, 140), "WATER", ((0, H - 32, W, H), (63, 168, 214))),
        panel((244, 242, 230), (40, 44, 48), "POWER", ((0, H - 28, W, H), (242, 191, 31))),
        panel((240, 242, 244), (40, 44, 48), "STAIRS", ((0, 0, W, 16), (242, 191, 31))),
        panel((236, 238, 240), (36, 52, 72), "BAGS", ((0, H - 28, W, H), (47, 74, 106))),
        panel((232, 234, 236), (40, 44, 48), "DOLLY", ((0, 0, 18, H), (125, 134, 143))),
        panel((244, 240, 220), (40, 44, 48), "LOADER", ((0, H - 28, W, H), (242, 191, 31))),
        panel((232, 244, 248), (28, 92, 130), "DEICE", ((0, H - 32, W, H), (63, 168, 214))),
        panel((248, 236, 234), (160, 28, 24), "FIRE", ((0, 0, 18, H), (200, 35, 30))),
        panel((230, 236, 246), (22, 48, 96), "POLICE", ((0, H - 28, W, H), (42, 108, 255))),
        panel((240, 242, 238), (40, 44, 48), "CLEAN", ((0, H - 28, W, H), (90, 140, 96))),
    ]
    paints = [fuel, catering, belt, tug, bus, *rest]
    cells = []
    for paint in paints:
        im = Image.new("RGB", (W, H), (255, 255, 255))
        paint(im)
        cells.append(im)
    atlas = Image.new("RGB", (ATLAS_W, H), (255, 255, 255))
    for i, im in enumerate(cells):
        atlas.paste(im, (i * W, 0))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT, quality=90, optimize=True)
    import base64
    B64.write_text(base64.b64encode(OUT.read_bytes()).decode("ascii"))
    print(OUT, OUT.stat().st_size, "b64", B64.stat().st_size)


if __name__ == "__main__":
    main()
