"""Side-livery atlas for the turnaround fleet.

Five cells, left to right: fuel tanker, catering hi-lift, belt loader,
pushback tug, apron bus. Names are fictional. JET A-1, FLAMMABLE and UN 1863
are the fuel grade and the hazard marks, not brands.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/art/textures/vehicles/livery_atlas.jpg"
B64 = ROOT / "public/art/textures/vehicles/_b64/livery_atlas.jpg.b64"
FONT = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
FONT_MED = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"

CELLS = 5
W, H = 512, 1024
ATLAS_W = W * CELLS


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT if bold else FONT_MED, size)


def text(draw: ImageDraw.ImageDraw, xy, s, fill, size, bold=True, anchor="mm"):
    draw.text(xy, s, font=font(size, bold), fill=fill, anchor=anchor)


def hazard(draw: ImageDraw.ImageDraw, cx, cy, s, fill):
    draw.polygon([(cx, cy - s), (cx + s, cy), (cx, cy + s), (cx - s, cy)], outline=fill, width=max(4, s // 8))
    # flame
    draw.polygon(
        [(cx, cy - s * 0.45), (cx + s * 0.28, cy + s * 0.15), (cx + s * 0.08, cy + s * 0.05), (cx + s * 0.18, cy + s * 0.42), (cx, cy + s * 0.12), (cx - s * 0.18, cy + s * 0.42), (cx - s * 0.08, cy + s * 0.05), (cx - s * 0.28, cy + s * 0.15)],
        fill=fill,
    )


def chevrons(draw: ImageDraw.ImageDraw, y0, y1, x0, x1):
    h = y1 - y0
    draw.rectangle((x0, y0, x1, y1), fill=(18, 18, 18))
    step = int(h * 0.92)
    x = x0 - step
    while x < x1:
        draw.polygon([(x, y1), (x + step * 0.45, y0), (x + step * 0.7, y0), (x + step * 0.25, y1)], fill=(242, 191, 31))
        x += step


def fuel(im):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(232, 234, 236))
    d.rectangle((0, 0, W, 70), fill=(196, 36, 32))
    text(d, (W / 2, 36), "NO SMOKING", (255, 255, 255), 36)
    text(d, (W / 2, 250), "JET A-1", (22, 24, 26), 92)
    text(d, (W / 2, 340), "HATCHFIELD FUEL", (90, 96, 102), 32, bold=False)
    hazard(d, 120, 520, 78, (196, 36, 32))
    text(d, (250, 490), "FLAMMABLE", (196, 36, 32), 36, anchor="lm")
    text(d, (250, 545), "UN 1863", (40, 40, 42), 28, anchor="lm")
    d.rounded_rectangle((36, 640, W - 36, 760), radius=12, outline=(210, 120, 20), width=6, fill=(255, 236, 210))
    text(d, (W / 2, 700), "JET A-1   UN 1863", (40, 40, 42), 32)
    chevrons(d, H - 120, H - 16, 16, W - 16)
    text(d, (W / 2, H - 150), "AIRCRAFT REFUELLING", (70, 74, 78), 26, bold=False)


def wing(d, x, y, s, fill):
    d.polygon([(x, y), (x + s, y - s * 0.35), (x + s * 0.55, y), (x + s, y + s * 0.35)], fill=fill)


def catering(im):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(244, 245, 246))
    d.rectangle((0, H - 180, W, H), fill=(168, 174, 180))
    wing(d, 70, 280, 150, (70, 110, 150))
    wing(d, 70, 280, 110, (36, 70, 110))
    text(d, (W / 2, 460), "HATCHFIELD", (36, 52, 72), 58)
    text(d, (W / 2, 540), "CATERING", (36, 52, 72), 64)
    text(d, (W / 2, H - 90), "GALLEY SERVICE", (255, 255, 255), 28, bold=False)


def belt(im):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(236, 238, 240))
    text(d, (W / 2, 280), "HATCHFIELD", (48, 52, 56), 52)
    text(d, (W / 2, 370), "GROUND", (48, 52, 56), 72)
    d.rounded_rectangle((40, 470, W - 40, 580), radius=10, fill=(242, 191, 31))
    text(d, (W / 2, 525), "KEEP CLEAR", (20, 20, 20), 40)
    d.rectangle((40, 640, W - 40, 760), fill=(20, 20, 20))
    text(d, (W / 2, 700), "MOVING BELT", (242, 191, 31), 40)
    chevrons(d, H - 110, H - 16, 16, W - 16)


def tug(im):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(214, 218, 222))
    d.rectangle((0, 0, W, H // 2), fill=(246, 247, 248))
    text(d, (W / 2, 220), "PUSHBACK", (40, 44, 48), 58)
    text(d, (W / 2, 310), "TUG 04", (40, 44, 48), 72)
    d.rounded_rectangle((70, 420, W - 70, 540), radius=40, outline=(30, 32, 34), width=6)
    text(d, (W / 2, 480), "HATCH TUG", (30, 32, 34), 40)
    d.rectangle((40, 620, W - 40, 720), fill=(196, 36, 32))
    text(d, (W / 2, 670), "NO STEP", (255, 255, 255), 40)
    chevrons(d, H - 120, H - 16, 16, W - 16)


def bus(im):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(240, 242, 244))
    d.rectangle((0, H - 200, W, H), fill=(150, 156, 162))
    text(d, (W / 2, 160), "HATCHFIELD", (36, 70, 110), 40, bold=False)
    text(d, (W / 2, 280), "AIRPORT", (40, 44, 48), 64)
    text(d, (W / 2, 380), "SHUTTLE", (40, 44, 48), 72)
    text(d, (W / 2, 500), "GATE TRANSFER", (90, 96, 102), 28, bold=False)
    for i, label in enumerate(("100 PAX", "30 KM/H")):
        y = 600 + i * 90
        d.rounded_rectangle((80, y, W - 80, y + 70), radius=8, outline=(180, 40, 36), width=4)
        text(d, (W / 2, y + 35), label, (180, 40, 36), 28)
    chevrons(d, H - 80, H - 12, 12, W - 12)


def main():
    cells = []
    for paint in (fuel, catering, belt, tug, bus):
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
